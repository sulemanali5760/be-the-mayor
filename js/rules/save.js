// Be the Mayor: the save object. Pure JS, JSON-serialisable. Contract: docs/builds/01-first-15.md §3.1.
export const SAVE_VERSION = 1;

const clean = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const pick = n => (Number.isInteger(n) && n >= 0 && n < 32 ? n : 0);

// the avatar (build 0.2 §3.3): look indices into data/wardrobe.json `looks`, the worn extra and the owned ones.
// The outfit is not saved: it follows state.rank.
export function cleanAvatar(a) {
  const ok = a && typeof a === 'object';
  return {
    skin: pick(ok && a.skin), hair: pick(ok && a.hair), face: pick(ok && a.face),
    extra: ok && typeof a.extra === 'string' ? a.extra : null,
    owned: ok && Array.isArray(a.owned) ? a.owned.filter(x => typeof x === 'string') : [],
  };
}

export function newSave(name, town, look) {
  return {
    v: SAVE_VERSION,
    name: clean(name, 'You'),
    town: clean(town, 'Brookfield'),
    day: 1,
    money: 0,
    rep: 0,
    slots: 3,          // action slots left today (contract change 4)
    rank: 0,
    skills: {},        // { wall: stars, delivery: stars, electric: 1, computer: 1, ... }
    jobs: [],          // ids of jobs done, in order
    lastTwist: {},     // { wall: 'rain' } so a verb never repeats with the same twist
    best: {},          // best first-person stars per kind; 2+ unlocks the quick shift
    offers: [],        // the job board
    seq: 0,            // offer id counter
    problems: [],      // open problem ids
    seen: [],          // problem and event ids already shown
    event: null,       // pending event id
    nextEventAt: 240,  // play seconds
    nextProblemAt: 0,
    upgrades: {},      // { id: { studied, done, told } }: studied = course evenings done
    studiedDay: 0,     // the day of the last evening of study (one a day)
    later: [],         // delayed consequences: [{ at, who, text, effects, headline }]
    headlines: [],     // for the next newspaper
    buildings: null,   // filled from data/town.json by createLife
    avatar: cleanAvatar(look),
  };
}

const kind = v => (Array.isArray(v) ? 'array' : v === null ? 'null'
  : typeof v === 'number' ? (Number.isFinite(v) ? 'number' : 'bad') : typeof v);

// Old, partial or broken saves always load: every field of the wrong type falls back to its default.
export function migrate(save) {
  if (kind(save) !== 'object') return newSave();
  const s = newSave(save.name, save.town);
  for (const [k, def] of Object.entries(s)) {
    if (k === 'name' || k === 'town' || k === 'v') continue;
    const v = save[k];
    const ok = k === 'event' ? typeof v === 'string' || v === null
      : k === 'buildings' ? Array.isArray(v)
      : kind(v) === kind(def);
    if (ok) s[k] = v;
  }
  s.avatar = cleanAvatar(save.avatar); // 0.1 saves have none: the default look
  return s;
}

// ---- the save wrapper (build 0.2.2): main.js keeps { v, t, meta, save, synced } in localStorage, the cloud a copy of it ----
// t is the game clock; synced = { id, t }: the user and the cloud play_t this device last wrote or loaded.

// real progress: something a player would miss
export function progress(w) {
  const s = w && w.save;
  return kind(s) === 'object' && (s.day > 1 || s.money > 0 || s.rank > 0 || (Array.isArray(s.jobs) && s.jobs.length > 0));
}

// which save to play when both exist: 'local', 'cloud' or 'ask' (the choice card). cloud = net.cloudLoad()'s row.
// Never silently drops a save with more progress: only an ancestor (by the synced mark) or an empty save loses.
export function pickSave(local, cloud, uid) {
  if (!cloud) return 'local';
  if (!local) return 'cloud';
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const mark = local.synced && local.synced.id === uid ? +local.synced.t : NaN;
  if (near(+cloud.play_t, mark)) return 'local';  // the cloud hasn't moved since this device synced
  if (near(+local.t, mark)) return 'cloud';       // this device hasn't moved since
  if (!progress(cloud.save)) return 'local';
  if (!progress(local)) return 'cloud';
  if (JSON.stringify(local.save) === JSON.stringify(cloud.save.save)) return 'local';
  return 'ask';
}

// export / import codes: base64 of the wrapper's JSON (UTF-8, so names like "Jürgen" survive); imports go through migrate
export function encodeSave(w) {
  let bin = '';
  for (const b of new TextEncoder().encode(JSON.stringify({ v: 1, t: w.t, meta: w.meta, save: w.save }))) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function decodeSave(code) {
  try {
    const bin = atob(String(code).replace(/\s+/g, ''));
    const w = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (kind(w) !== 'object' || kind(w.save) !== 'object') return null;
    return { v: 1, t: Number.isFinite(+w.t) ? Math.max(0, +w.t) : 0, meta: kind(w.meta) === 'object' ? w.meta : {}, save: migrate(w.save) };
  } catch { return null; }
}
