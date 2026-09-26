// Row-level security and interact() rules, against a LOCAL Supabase started on the CI runner (db.yml).
// Every player is a fresh anonymous user, exactly like the game. Never point this at the live project.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… node --test supabase/tests/policies.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL || '')) throw new Error(`refusing to run against a non-local Supabase: ${URL}`);
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function player(name) {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return { sb, id: data.user.id, name };
}
const snap = (n = 3) => ({ v: 1, buildings: Array.from({ length: n }, (_, i) => ({ id: 'b' + i, type: 'house', state: 'ok' })), posted: [{ id: 'p1', title: 'Bus stop roof' }] });
const row = (name, extra = {}) => ({ town: name, mayor: 'Mayor ' + name, rank: 0, title: 'Labourer', snapshot: snap(), ...extra });
const act = (p, town, kind, phrase = null, problem = null) => p.sb.rpc('interact', { p_town: town, p_kind: kind, p_phrase: phrase, p_problem: problem });
const likesOf = async id => (await client().from('towns').select('likes').eq('id', id).single()).data.likes;

let A, B, others;
before(async () => {
  A = await player('Alpha');
  B = await player('Bravo');
  others = [];
  for (let i = 1; i <= 7; i++) others.push(await player('Town ' + i));
  for (const p of [A, B, ...others]) {
    const { error } = await p.sb.from('towns').insert(row(p.name));
    assert.ifError(error);
  }
});

test('signed-out visitors can read towns but cannot interact', async () => {
  const anon = client();
  const { data, error } = await anon.from('towns').select('id, town, likes');
  assert.ifError(error);
  assert.ok(data.length >= 9);
  const r = await act({ sb: anon }, A.id, 'like');
  assert.ok(r.error, 'anon interact must fail');
  assert.equal(await likesOf(A.id), 0);
});

test('a visitor cannot edit, take over or delete another town', async () => {
  const up = await B.sb.from('towns').update({ town: 'Hacked' }).eq('id', A.id).select('id');
  assert.deepEqual(up.data ?? [], [], 'update of a foreign row must match nothing');
  const del = await B.sb.from('towns').delete().eq('id', A.id).select('id');
  assert.deepEqual(del.data ?? [], [], 'delete of a foreign row must match nothing');
  const ins = await B.sb.from('towns').insert({ id: A.id, ...row('Stolen') });
  assert.ok(ins.error, 'insert with a foreign id must fail');
  const { data } = await client().from('towns').select('town').eq('id', A.id).single();
  assert.equal(data.town, 'Alpha');
});

test('nobody can set their own likes or reports', async () => {
  const likes = await A.sb.from('towns').update({ likes: 999 }).eq('id', A.id);
  assert.ok(likes.error, 'writing likes must be denied');
  const reports = await A.sb.from('towns').update({ reports: 0 }).eq('id', A.id);
  assert.ok(reports.error, 'writing reports must be denied');
  assert.equal(await likesOf(A.id), 0);
});

test('the snapshot is saved at most once a minute', async () => {
  const r = await A.sb.from('towns').update({ snapshot: snap(4) }).eq('id', A.id);
  assert.match(r.error?.message || '', /too often/i);
});

test('names are filtered, rank is capped and snapshots must be plausible', async () => {
  const C = await player('Charlie');
  assert.ok((await C.sb.from('towns').insert(row('Nazi Town'))).error, 'word filter');
  assert.ok((await C.sb.from('towns').insert(row('<script>'))).error, 'name characters');
  assert.ok((await C.sb.from('towns').insert(row('Charlie', { rank: 2 }))).error, 'rank cap');
  const big = await C.sb.from('towns').insert(row('Charlie', { snapshot: snap(61) }));
  assert.match(big.error?.message || '', /implausible/i);
  assert.ifError((await C.sb.from('towns').insert(row('Charlie'))).error);
});

test('no self-likes', async () => {
  const r = await act(A, A.id, 'like');
  assert.match(r.error?.message || '', /own town/i);
  assert.equal(await likesOf(A.id), 0);
});

test('a like counts once per town per day, through the server', async () => {
  assert.ifError((await act(B, A.id, 'like')).error);
  assert.equal(await likesOf(A.id), 1);
  const again = await act(B, A.id, 'like');
  assert.match(again.error?.message || '', /already done for this town today/i);
  assert.equal(await likesOf(A.id), 1);
});

test('no direct writes to interactions', async () => {
  const ins = await B.sb.from('interactions').insert({ giver: B.id, town: A.id, kind: 'sign', phrase: 1 });
  assert.ok(ins.error, 'direct insert must be denied');
  const del = await B.sb.from('interactions').delete().eq('giver', B.id);
  assert.ok(del.error, 'direct delete must be denied');
  const { data } = await client().from('interactions').select('kind').eq('town', A.id);
  assert.equal(data.length, 1);
});

test('signs and help need their details', async () => {
  assert.match((await act(B, A.id, 'sign')).error?.message || '', /pick a sign/i);
  assert.match((await act(B, A.id, 'help')).error?.message || '', /pick a problem/i);
});

test('a giver can interact at most 20 times a day', async () => {
  // B has 1 interaction (the like above); 7 towns × 3 kinds = 21 more attempts → 19 succeed, then the cap
  const results = [];
  for (const t of others) {
    results.push(!(await act(B, t.id, 'like')).error);
    results.push(!(await act(B, t.id, 'sign', 3)).error);
    results.push(!(await act(B, t.id, 'help', null, 'p1')).error);
  }
  assert.equal(results.filter(Boolean).length, 19);
  const last = await act(B, others[0].id, 'like');
  assert.match(last.error?.message || '', /enough helping|already done/i);
  const capped = await act(B, A.id, 'sign', 2);
  assert.match(capped.error?.message || '', /enough helping/i);
  // another giver is not affected by B's cap
  assert.ifError((await act(others[0], A.id, 'like')).error);
});
