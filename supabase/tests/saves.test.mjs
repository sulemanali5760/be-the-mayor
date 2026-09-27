// Cloud saves (build 0.2.2 §2.1), against a LOCAL Supabase started on the CI runner (db.yml). Never the live project.
// The local service key is used only to confirm an email and make a magic link, as the inbox would; the game never has it.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… node --test supabase/tests/saves.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY, ADMIN = process.env.SUPABASE_SERVICE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL || '')) throw new Error(`refusing to run against a non-local Supabase: ${URL}`);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(URL, KEY, opts);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function player() {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return { sb, id: data.user.id };
}
// the local save wrapper, as main.js writes it
const wrapper = (day, money = 40) => ({ v: 1, t: day * 100, meta: { jobs: day }, save: { v: 1, name: 'Sam', town: 'Elbwinkel', day, money, rank: 0 } });
const row = (day, money) => ({ save: wrapper(day, money), version: '0.2.2', play_t: day * 100 });
const mine = async p => (await p.sb.from('saves').select('*').eq('id', p.id).single()).data;

let A, B;
before(async () => {
  A = await player();
  B = await player();
  assert.ifError((await A.sb.from('saves').insert(row(2))).error);
});

test('a save is private: another player cannot read, change, take over or delete it', async () => {
  const read = await B.sb.from('saves').select('id').eq('id', A.id);
  assert.deepEqual(read.data ?? [], [], 'reading a foreign save must match nothing');
  const up = await B.sb.from('saves').update(row(9, 999)).eq('id', A.id).select('id');
  assert.deepEqual(up.data ?? [], [], 'updating a foreign save must match nothing');
  const del = await B.sb.from('saves').delete().eq('id', A.id).select('id');
  assert.deepEqual(del.data ?? [], [], 'deleting a foreign save must match nothing');
  const ins = await B.sb.from('saves').insert({ id: A.id, ...row(9, 999) });
  assert.ok(ins.error, 'insert with a foreign id must fail');
  const a = await mine(A);
  assert.equal(a.save.save.day, 2);
  assert.equal(a.save.save.money, 40);
});

test('signed-out visitors cannot read any save', async () => {
  const { data, error } = await client().from('saves').select('id, save');
  assert.ok(error || data.length === 0, 'anon must see no saves');
});

test('players cannot write the id, the timestamp or the backups; only objects under 200 kB', async () => {
  const C = await player();
  for (const bad of [{ prev1: { save: {} } }, { prev2: { save: {} } }, { updated_at: '2020-01-01T00:00:00Z' }]) {
    const r = await C.sb.from('saves').insert({ ...row(1), ...bad });
    assert.ok(r.error, `writing ${Object.keys(bad)} must be denied`);
  }
  assert.ok((await C.sb.from('saves').insert({ save: [1, 2], version: '0.2.2', play_t: 1 })).error, 'an array is not a save');
  const big = { v: 1, t: 1, meta: {}, save: { junk: 'x'.repeat(200000) } };
  assert.ok((await C.sb.from('saves').insert({ save: big, version: '0.2.2', play_t: 1 })).error, 'too big');
  assert.ifError((await C.sb.from('saves').insert(row(1))).error);
});

test('saves are rate-limited to one write per 20 s, and each write keeps the last two as backups', async () => {
  const P = await player();
  assert.ifError((await P.sb.from('saves').insert(row(1))).error);
  const fast = await P.sb.from('saves').update(row(2)).eq('id', P.id);
  assert.match(fast.error?.message || '', /too often/i);
  assert.equal((await mine(P)).save.save.day, 1, 'the rejected write changed nothing');

  await sleep(21000);
  assert.ifError((await P.sb.from('saves').update(row(2)).eq('id', P.id)).error);
  let r = await mine(P);
  assert.equal(r.save.save.day, 2);
  assert.deepEqual(r.prev1.save, wrapper(1));
  assert.equal(r.prev1.version, '0.2.2');
  assert.equal(+r.prev1.play_t, 100);
  assert.equal(r.prev2, null);

  await sleep(21000);
  assert.ifError((await P.sb.from('saves').update(row(3)).eq('id', P.id)).error);
  r = await mine(P);
  assert.equal(r.save.save.day, 3);
  assert.deepEqual(r.prev1.save, wrapper(2));
  assert.deepEqual(r.prev2.save, wrapper(1));
});

test('an anonymous player who links an email keeps the same id, and the save stays theirs on a new device', async () => {
  assert.ok(ADMIN, 'SUPABASE_SERVICE_KEY (the local stack\'s) is needed to stand in for the inbox');
  const admin = createClient(URL, ADMIN, opts);
  const P = await player();
  assert.ifError((await P.sb.from('saves').insert(row(7, 310))).error);
  const email = `mayor-${Date.now()}@example.test`;

  // what net.linkEmail does: the same user gets an email
  const linked = await P.sb.auth.updateUser({ email });
  assert.ifError(linked.error);
  assert.equal(linked.data.user.id, P.id, 'updateUser keeps the user id');
  // the confirmation click (the local stack may already have confirmed it: anonymous users can be autoconfirmed)
  const auto = linked.data.user.email === email;
  if (!auto) {
    const { error } = await admin.auth.admin.updateUserById(P.id, { email, email_confirm: true });
    assert.ifError(error);
  }
  const { data: u } = await admin.auth.admin.getUserById(P.id);
  assert.equal(u.user.id, P.id);
  assert.equal(u.user.email, email);
  if (auto) assert.equal(u.user.is_anonymous, false, 'the account is permanent now');
  assert.equal((await mine(P)).save.save.day, 7, 'the same row, still readable by the same session');

  // another device: the magic link from signInWithOtp, made by the admin API instead of the inbox
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  assert.ifError(le);
  const phone = client();
  const { data: s, error: ve } = await phone.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: link.properties.verification_type || 'magiclink' });
  assert.ifError(ve);
  assert.equal(s.user.id, P.id, 'the magic link signs in the same user');
  const { data: rows } = await phone.from('saves').select('id, save, play_t');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, P.id);
  assert.equal(rows[0].save.save.day, 7);
  assert.equal(rows[0].save.save.money, 310);
});
