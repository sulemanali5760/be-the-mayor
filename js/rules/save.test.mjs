// Update-safe saves (build 0.2.2 §2.4, LESSONS S1): every release's real save shape must load with its progress intact.
// Fixtures in fixtures/saves/<version>.json are the local-storage wrapper { v, t, meta, save } as that version wrote it.
// Every release adds one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createLife } from './life.js';
import { newSave, migrate, pickSave, progress, encodeSave, decodeSave } from './save.js';
import { loadContent, rng } from './testkit.mjs';

const content = loadContent();
const DIR = new URL('./fixtures/saves/', import.meta.url);
const fixtures = readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
  .map(f => ({ version: f.replace(/\.json$/, ''), w: JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) }));
const defaults = newSave();

test('there are fixtures for 0.1.0 and 0.2.x', () => {
  const vs = fixtures.map(f => f.version);
  assert.ok(vs.includes('0.1.0'), vs.join());
  assert.ok(vs.some(v => v.startsWith('0.2.')), vs.join());
});

for (const { version, w } of fixtures) {
  test(`save ${version}: the wrapper loads with its progress intact`, () => {
    // main.js's loader takes any { save } object; the clock and the shell's meta come from the wrapper
    assert.equal(typeof w.save, 'object');
    assert.ok(Number.isFinite(w.t) && w.t > 0, 'a play clock');
    assert.equal(typeof w.meta, 'object');

    const s = migrate(w.save);
    for (const k of Object.keys(defaults)) {
      if (k === 'v' || k === 'avatar') continue;
      if (k in w.save) assert.deepEqual(s[k], w.save[k], `${k} is kept`);
      else assert.deepEqual(s[k], defaults[k], `${k} gets its default`);
    }
    const look = w.save.avatar ?? { skin: 0, hair: 0, face: 0, extra: null, owned: [] }; // 0.1 saves: the default look
    assert.deepEqual(s.avatar, look);

    const life = createLife(content, structuredClone(w.save), rng(1)); // createLife works on the save in place
    const st = life.state;
    assert.deepEqual([st.name, st.town, st.money, st.rep, st.rank, st.day], [w.save.name, w.save.town, w.save.money, w.save.rep, w.save.rank, w.save.day]);
    assert.equal(life.ladder().title, w.meta.title, 'the same rank title');
    for (const b of w.save.buildings) {
      const now = st.buildings.find(x => x.id === b.id);
      assert.ok(now, `building ${b.id} is kept`);
      assert.deepEqual([now.state, now.label], [b.state, b.label], `building ${b.id}: state and label are the player's`);
    }
    assert.equal(st.buildings.length, content.town.buildings.length, 'buildings added since are there');
    assert.deepEqual(st.avatar, look, 'the avatar is kept');
    assert.deepEqual(st.upgrades, w.save.upgrades, 'courses and purchases are kept');
    assert.deepEqual(st.jobs, w.save.jobs);
    assert.equal(st.offers.length, 2, 'a full job board');
    assert.ok(progress(w));
  });

  test(`save ${version}: export then import gives the same life`, () => {
    const back = decodeSave(encodeSave(w));
    assert.equal(back.t, w.t);
    assert.deepEqual(back.meta, w.meta);
    assert.deepEqual(back.save, migrate(w.save));
    assert.equal(back.synced, undefined, 'a code carries no cloud mark');
  });
}

test('save codes: junk, empty and non-save codes are refused', () => {
  for (const code of ['', 'not base64 at all!', btoa('{"a":1}'), btoa('[1,2]'), btoa('{"save":"x"}'), btoa('nope')]) {
    assert.equal(decodeSave(code), null, code);
  }
  const w = fixtures[0].w;
  const spaced = encodeSave(w).replace(/(.{60})/g, '$1\n  '); // pasted from a chat app with line breaks
  assert.deepEqual(decodeSave(spaced).save, migrate(w.save));
});

test('progress: a fresh game has none', () => {
  assert.equal(progress({ save: newSave('Ana', 'Testville') }), false);
  assert.equal(progress(null), false);
  assert.equal(progress({ save: { ...newSave(), day: 2 } }), true);
  assert.equal(progress({ save: { ...newSave(), jobs: ['keller_wall'] } }), true);
});

test('pickSave: the newer lineage wins silently, a real conflict asks', () => {
  const at = (w, t, extra = {}) => ({ ...w, t, ...extra });
  const [old, , mid] = fixtures.map(f => f.w); // 0.1.0 (day 2), 0.2.1 (day 7), 0.2.2 (day 3)
  const cloudOf = (w, play_t = w.t) => ({ save: w, version: '0.2.2', play_t, updated_at: '2026-09-28T10:00:00Z' });
  const fresh = { v: 1, t: 5, meta: {}, save: newSave('Ana', 'Testville') };
  const me = 'user-1';

  assert.equal(pickSave(old, null, me), 'local', 'no cloud save');
  assert.equal(pickSave(null, cloudOf(old), me), 'cloud', 'a new device');
  // this device synced at t=300; the cloud still has that, the device played on: keep the device
  assert.equal(pickSave(at(mid, 700, { synced: { id: me, t: 300 } }), cloudOf(old, 300), me), 'local');
  // this device synced at t=300 and hasn't played since; the cloud moved on (another device): take the cloud
  assert.equal(pickSave(at(old, 300, { synced: { id: me, t: 300 } }), cloudOf(mid, 900), me), 'cloud');
  // both moved on since the last sync, both with progress: ask
  assert.equal(pickSave(at(old, 400, { synced: { id: me, t: 300 } }), cloudOf(mid, 900), me), 'ask');
  // no mark (first sign-in on this device), both with progress and different: ask
  assert.equal(pickSave(old, cloudOf(mid), me), 'ask');
  // a mark from another account means nothing here
  assert.equal(pickSave(at(old, 300, { synced: { id: 'someone-else', t: 300 } }), cloudOf(mid, 300), me), 'ask');
  // an empty side never wins against progress, whatever its clock
  assert.equal(pickSave(fresh, cloudOf(mid, 1), me), 'cloud');
  assert.equal(pickSave(at(old, 1), cloudOf(fresh, 9999), me), 'local');
  // the same save on both sides
  assert.equal(pickSave(old, cloudOf(JSON.parse(JSON.stringify(old)), 12), me), 'local');
});
