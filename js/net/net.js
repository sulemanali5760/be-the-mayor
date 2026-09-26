// Online towns (build plan §3.4). Supabase with anonymous sign-in; likes, signs and help go only through the
// interact() RPC, which enforces the daily cap, no self-likes and once per town per day on the server.
// config null (or no connection) → offline mode with the curated towns in data/seed-towns.json.
const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let sb = null, me = null, seeds = null, lastSave = 0;
export const net = { online: false, init, saveTown, listTowns, getTown, like, sign, help, inbox };

// server messages → what the player reads
function friendly(error) {
  const m = String(error?.message || error || '');
  if (/already done/i.test(m)) return 'Already done for this town today';
  if (/enough helping|come back tomorrow/i.test(m)) return 'That is enough helping for today, come back tomorrow';
  if (/own town/i.test(m)) return 'That is your own town';
  if (/too often/i.test(m)) return 'Saving too often, try again in a minute';
  if (/sign in/i.test(m)) return 'Could not sign in, you are playing offline';
  if (/check constraint|clean_names/i.test(m)) return 'That name is not allowed';
  if (/fetch|network|failed/i.test(m)) return 'Could not reach the other towns, try again later';
  return 'Something went wrong, try again later';
}

async function init(config) {
  seeds = null;
  net.online = false;
  if (!config) return net;
  try {
    const { createClient } = await import(SUPABASE);
    sb = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    let { data } = await sb.auth.getSession();
    if (!data.session) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) throw r.error;
      data = r.data;
    }
    me = data.session.user.id;
    net.online = true;
  } catch (e) {
    console.warn('offline mode:', e?.message || e); // warn, not error: offline play is a normal state
    sb = null;
  }
  return net;
}

// Snapshots come from other players' clients: keep only known fields, sane types and sizes.
const str = (s, n) => (typeof s === 'string' || typeof s === 'number' ? String(s) : '').slice(0, n);
export function cleanSnapshot(s = {}) {
  return {
    v: 1, town: str(s.town, 24), mayor: str(s.mayor, 24), rank: Math.max(0, Math.min(6, s.rank | 0)), title: str(s.title, 32), day: Math.max(1, s.day | 0),
    buildings: (Array.isArray(s.buildings) ? s.buildings : []).slice(0, 60).map(b => ({
      id: str(b?.id, 40), type: str(b?.type, 40), x: +b?.x || 0, z: +b?.z || 0, rot: +b?.rot || 0,
      state: b?.state === 'ok' ? 'ok' : 'broken', ...(b?.label ? { label: str(b.label, 60) } : {}),
    })),
    posted: (Array.isArray(s.posted) ? s.posted : []).slice(0, 10).map(p => ({ id: str(p?.id, 40), title: str(p?.title, 80) })),
  };
}

async function loadSeeds() {
  seeds ??= await fetch(`data/seed-towns.json?v=${V}`).then(r => r.json());
  return seeds;
}

// ---- own town -------------------------------------------------------------------------------------------
// The server allows one snapshot a minute, so main.js saves at session end and day end, and we skip early calls.
async function saveTown(snapshot) {
  if (!net.online) return { ok: true, offline: true };
  if (Date.now() - lastSave < 61000) return { ok: false, msg: 'Saving too often, try again in a minute' };
  const row = { town: snapshot.town, mayor: snapshot.mayor, rank: snapshot.rank, title: snapshot.title, snapshot };
  // no upsert: players may not write the id column; it defaults to auth.uid() on insert
  let { data, error } = await sb.from('towns').update(row).eq('id', me).select('id');
  if (!error && !data.length) ({ error } = await sb.from('towns').insert(row));
  if (error) return { ok: false, msg: friendly(error) };
  lastSave = Date.now();
  return { ok: true };
}

// ---- other towns ----------------------------------------------------------------------------------------
// real towns first, then the curated towns so the list is never empty (the guided first visit uses one)
async function listTowns({ limit = 12 } = {}) {
  const curated = (await loadSeeds()).map(({ id, town, mayor, title, rank, likes, updatedAt }) => ({ id, town, mayor, title, rank, likes: likes + localGiven(id, 'like'), updatedAt, curated: true }));
  if (!net.online) return curated.slice(0, limit);
  const { data, error } = await sb.from('towns').select('id, town, mayor, title, rank, likes, updated_at').neq('id', me).order('updated_at', { ascending: false }).limit(limit);
  const real = error ? [] : data.map(({ updated_at, ...t }) => ({ ...t, updatedAt: updated_at }));
  return [...real, ...curated].slice(0, Math.max(limit, curated.length));
}

async function getTown(id) {
  if (!net.online || id.startsWith('seed-')) {
    const t = (await loadSeeds()).find(s => s.id === id);
    if (!t) return null;
    const mine = localSigns(id);
    return { snapshot: cleanSnapshot(t.snapshot), likes: t.likes + localGiven(id, 'like'), signs: [...mine, ...t.signs], helps: t.helps + localGiven(id, 'help') };
  }
  const [town, acts] = await Promise.all([
    sb.from('towns').select('snapshot, likes').eq('id', id).single(),
    sb.from('interactions').select('kind, phrase').eq('town', id).order('created_at', { ascending: false }).limit(60),
  ]);
  if (town.error) return null;
  const list = acts.data || [];
  return {
    snapshot: cleanSnapshot(town.data.snapshot), likes: town.data.likes,
    signs: list.filter(a => a.kind === 'sign').slice(0, 12).map(a => ({ phrase: a.phrase })),
    helps: list.filter(a => a.kind === 'help').length,
  };
}

// ---- positive-only interactions ---------------------------------------------------------------------------
async function interact(id, kind, phrase = null, problem = null) {
  if (!net.online || id.startsWith('seed-')) return localInteract(id, kind, phrase, problem);
  const { error } = await sb.rpc('interact', { p_town: id, p_kind: kind, p_phrase: phrase, p_problem: problem });
  return error ? { ok: false, msg: friendly(error) } : { ok: true };
}
function like(id) { return interact(id, 'like'); }
function sign(id, phraseId) { return interact(id, 'sign', phraseId); }
function help(id, problemId) { return interact(id, 'help', null, problemId); }

// what happened to my town since `since` (ms): for the newspaper
async function inbox(since = 0) {
  const none = { likes: 0, signs: [], helps: 0 };
  if (!net.online) return none;
  const { data, error } = await sb.from('interactions').select('kind, phrase').eq('town', me).gt('created_at', new Date(since).toISOString()).limit(200);
  if (error) return none;
  return { likes: data.filter(a => a.kind === 'like').length, signs: data.filter(a => a.kind === 'sign').map(a => ({ phrase: a.phrase })), helps: data.filter(a => a.kind === 'help').length };
}

// ---- offline: the same rules as the server, kept in localStorage per UTC day ---------------------------------
const KEY = 'btm.given';
const today = () => new Date().toISOString().slice(0, 10);
function given() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY));
    if (g && g.day === today()) return g;
  } catch { /* fresh */ }
  return { day: today(), acts: [] };
}
const localGiven = (id, kind) => given().acts.filter(a => a.town === id && a.kind === kind).length;
const localSigns = id => given().acts.filter(a => a.town === id && a.kind === 'sign').map(a => ({ phrase: a.phrase }));
function localInteract(town, kind, phrase, problem) {
  const g = given();
  if (kind === 'sign' && phrase == null) return { ok: false, msg: 'Pick a sign' };
  if (kind === 'help' && !problem) return { ok: false, msg: 'Pick a problem to help with' };
  if (g.acts.length >= 20) return { ok: false, msg: 'That is enough helping for today, come back tomorrow' };
  if (g.acts.some(a => a.town === town && a.kind === kind)) return { ok: false, msg: 'Already done for this town today' };
  g.acts.push({ town, kind, phrase, problem });
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* private mode: still counts for this session */ }
  return { ok: true };
}
