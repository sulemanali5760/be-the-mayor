// Content checks: every id resolves, counts match the build plan (§3.2), and no card has a dominant option.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContent } from './testkit.mjs';

const c = loadContent();
const ids = list => new Set(list.map(x => x.id));
const people = ids(c.people);
const buildings = ids(c.town.buildings);
const skills = new Set(['wall', 'delivery', ...c.upgrades.map(u => u.gives)]);
const cards = [...c.problems, ...c.events];
const EFFECT_KEYS = new Set(['money', 'rep', 'energy', 'skill', 'fix', 'label']);

test('ids are unique in every file', () => {
  const lists = { jobs: c.jobs, people: c.people, problems: c.problems, events: c.events, upgrades: c.upgrades, town: c.town.buildings, wardrobe: c.wardrobe.extras };
  for (const [n, list] of Object.entries(lists)) assert.equal(ids(list).size, list.length, n);
  for (const k of cards) assert.equal(ids(k.options).size, k.options.length, k.id);
});

test('every reference resolves: people, buildings, skills', () => {
  for (const x of [...c.jobs, ...cards, ...c.upgrades]) assert.ok(people.has(x.who), `${x.id}: who ${x.who}`);
  for (const later of c.events.flatMap(e => e.options.map(o => o.later)).filter(Boolean)) {
    if (later.who) assert.ok(people.has(later.who), later.who);
  }
  for (const x of [...c.jobs, ...c.upgrades, ...c.events]) if (x.needs) assert.ok(skills.has(x.needs), `${x.id}: needs ${x.needs}`);
  for (const k of cards) {
    if (k.at) assert.ok(buildings.has(k.at), `${k.id}: at ${k.at}`);
    if (k.requires) assert.ok(buildings.has(k.requires), `${k.id}: requires ${k.requires}`);
    for (const o of k.options) {
      if (o.needs) assert.ok(skills.has(o.needs), `${k.id}/${o.id}: needs ${o.needs}`);
      if (o.effects.fix) assert.ok(buildings.has(o.effects.fix), `${k.id}/${o.id}: fix`);
      for (const key of Object.keys(o.effects)) assert.ok(EFFECT_KEYS.has(key), `${k.id}/${o.id}: effect ${key}`);
    }
  }
  for (const j of c.jobs) {
    if (j.fix) assert.ok(buildings.has(j.fix), `${j.id}: fix`);
    for (const s of j.params.stops ?? []) assert.ok(buildings.has(s), `${j.id}: stop ${s}`);
    if (j.params.at) assert.ok(buildings.has(j.params.at), `${j.id}: at`);
  }
});

test('jobs fit the tasks: wall twists the world plays, delivery 3-4 stops in 45 s, 2+ twists each', () => {
  for (const j of c.jobs) {
    assert.ok(['wall', 'delivery'].includes(j.task), j.id);
    assert.ok(j.twists.length >= 2, `${j.id}: twists`);
    // ASSETS.md: the wall is always 11 bricks, twists rain / cracked / hurry
    if (j.task === 'wall') assert.ok(j.twists.every(t => ['rain', 'cracked', 'hurry'].includes(t.id)), `${j.id}: twists`);
    else {
      // the first stop is the pickup unless params.from is set; 3-4 drops after it
      const drops = j.params.stops.length - (j.params.from ? 0 : 1);
      assert.ok(drops >= 3 && drops <= 4 && j.params.seconds <= 45, `${j.id}: ${drops} drops`);
    }
  }
  // Skilled pays +30-60% over Labourer (REAL-WORLD §2.2)
  const avg = list => list.reduce((a, j) => a + j.pay, 0) / list.length;
  const gain = avg(c.jobs.filter(j => j.rank === 1)) / avg(c.jobs.filter(j => !j.rank)) - 1;
  assert.ok(gain >= 0.3 && gain <= 0.6, `skilled pay gain ${gain.toFixed(2)}`);
});

test('upgrades are buy or course (with evenings), no timers; help options show their slot', () => {
  for (const u of c.upgrades) {
    assert.ok(u.kind === 'buy' || (u.kind === 'course' && Number.isInteger(u.evenings) && u.evenings > 0), u.id);
    assert.ok(!('seconds' in u) && !('endsAt' in u), `${u.id}: no timers`);
  }
  assert.equal(c.upgrades.find(u => u.id === 'night_school').evenings, 4);
  const help = c.problems.flatMap(p => p.options.filter(o => o.help).map(o => [p.id, o]));
  assert.ok(help.length >= 8, 'help options marked');
  for (const [id, o] of help) assert.equal(o.effects.energy, -1, `${id}/${o.id}: help uses a slot`);
});

test('counts match the build plan', () => {
  assert.ok(c.events.length >= 15, 'about 15 events');
  assert.ok(c.events.filter(e => e.options.some(o => o.later)).length >= 2, '2+ events with later');
  assert.ok(c.signs.length >= 20 && c.signs.every(s => typeof s === 'string' && s.length <= 60), 'about 20 signs');
  assert.ok(c.town.buildings.length >= 12, 'about 12 buildings');
  assert.ok(c.town.buildings.every(b => Number.isInteger(b.x) && Number.isInteger(b.z) && ['ok', 'broken'].includes(b.state)), '1 m grid');
  assert.deepEqual(c.ranks.slice(0, 2).map(r => r.title), ['Labourer', 'Skilled']);
  assert.ok(c.ranks.slice(2).every(r => r.locked), 'later ranks locked');
});

// ---- the town's layout: Brookfield (data/town.json) and the curated towns (data/seed-towns.json) share it ----
// w × d in metres, front towards +z; the bridge includes its 36 m stream. Unknown types draw a house.
const FOOT = { house: [6, 5], garden: [7, 5], cafe: [7, 5], shop: [7, 5], busstop: [3.6, 1.6], bridge: [36, 12],
  townhall: [12, 8], school: [12, 6], park: [12, 10], playground: [8, 8], statue: [2, 2], streetlight: [0.6, 0.6], tree: [2, 2],
  yard: [10, 8], dumppile: [6, 5] };
const ALIAS = { hall: 'townhall', stop: 'busstop', store: 'shop', lamp: 'streetlight', gardenwall: 'garden' };
const SOLID = new Set(['house', 'cafe', 'shop', 'busstop', 'townhall', 'school', 'statue']); // paths never cross these
const kindOf = b => { const k = b.type.toLowerCase().replace(/[^a-z]/g, ''); return ALIAS[k] ?? k; };
const box = (b, m) => {
  const [w, d] = FOOT[kindOf(b)] ?? FOOT.house;
  assert.equal(b.rot % 90, 0, `${b.id}: rot`);
  const [hx, hz] = b.rot % 180 ? [d / 2, w / 2] : [w / 2, d / 2];
  return { id: b.id, x0: b.x - hx - m, x1: b.x + hx + m, z0: b.z - hz - m, z1: b.z + hz + m };
};
const EPS = 1e-9;
const away = (p, r) => Math.hypot(Math.max(r.x0 - p[0], 0, p[0] - r.x1), Math.max(r.z0 - p[1], 0, p[1] - r.z1));
const inside = (p, r) => p[0] > r.x0 + EPS && p[0] < r.x1 - EPS && p[1] > r.z0 + EPS && p[1] < r.z1 - EPS;
// points every 25 cm along a polyline
const along = line => line.slice(1).flatMap((q, i) => {
  const p = line[i], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.25));
  return Array.from({ length: n + 1 }, (_, k) => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]);
});
const toLine = (p, line) => Math.min(...along(line).map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));
const seeds = JSON.parse(readFileSync(new URL('../../data/seed-towns.json', import.meta.url), 'utf8'));
const towns = [['Brookfield', c.town.buildings], ...seeds.map(t => [t.town, t.snapshot.buildings])];

test('town: footprints from ASSETS.md never overlap (1 m apart at least), in every town', () => {
  for (const [name, list] of towns) {
    const boxes = list.map(b => box(b, 0.5));
    const hits = [];
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) hits.push(`${a.id} × ${b.id}`);
    }));
    assert.deepEqual(hits, [], name);
  }
});

test('town layout: roads (4 m) clear of buildings, paths never through solid ones, props off both, a node near every building', () => {
  const { roads, paths, props } = c.town;
  for (const line of [...roads, ...paths]) assert.ok(line.length >= 2 && line.every(p => p.length === 2 && p.every(Number.isFinite)), 'polyline of [x, z]');
  for (const [name, list] of towns) {
    const bad = new Set();
    const raw = list.map(b => ({ b, r: box(b, 0), k: kindOf(b) }));
    roads.forEach((line, i) => { for (const p of along(line)) for (const { b, r, k } of raw) if (k !== 'bridge' && away(p, r) < 2 - EPS) bad.add(`road ${i} × ${b.id}`); });
    paths.forEach((line, i) => { for (const p of along(line)) for (const { b, r, k } of raw) if (SOLID.has(k) && inside(p, r)) bad.add(`path ${i} × ${b.id}`); });
    for (const pr of props) {
      const p = [pr.x, pr.z], at = `${pr.type} at ${p}`;
      for (const { b, r } of raw) if (away(p, r) < 1 - EPS) bad.add(`${at} × ${b.id}`);
      if (roads.some(l => toLine(p, l) < 2.5 - EPS)) bad.add(`${at} on a road`);
      if (paths.some(l => toLine(p, l) < 1 - EPS)) bad.add(`${at} on a path`);
    }
    const nodes = [...roads, ...paths].flat();
    for (const b of list) if (!nodes.some(n => Math.hypot(n[0] - b.x, n[1] - b.z) <= 6)) bad.add(`${b.id}: no node within 6 m`);
    assert.deepEqual([...bad], [], name);
  }
  assert.ok(props.every(p => ['tree', 'bench', 'lamp', 'flowers', 'bin', 'fence'].includes(p.type) && Number.isFinite(p.rot)), 'prop types');
});

test('town layout: one connected graph, every junction a shared vertex (walkTo can reach every building)', () => {
  const lines = [...c.town.roads, ...c.town.paths], key = p => p.join();
  const joined = new Set([0]);
  for (let grew = true; grew;) {
    grew = false;
    lines.forEach((l, i) => {
      if (joined.has(i)) return;
      const ks = new Set(l.map(key));
      if ([...joined].some(j => lines[j].some(p => ks.has(key(p))))) { joined.add(i); grew = true; }
    });
  }
  assert.equal(joined.size, lines.length);
});

test('routines: named people live and work at real buildings, at times of day between 0 and 1', () => {
  assert.ok(c.town.routines.length >= 6);
  for (const r of c.town.routines) {
    assert.ok(people.has(r.who) && buildings.has(r.home) && buildings.has(r.work), r.who);
    const [a, b] = r.hours;
    assert.ok(a >= 0 && a < b && b <= 1, `${r.who}: hours`);
  }
  assert.equal(new Set(c.town.routines.map(r => r.who)).size, c.town.routines.length, 'one routine each');
});

test('seed towns share the layout: same id, same place; each shows an avatar', () => {
  const home = new Map(c.town.buildings.map(b => [b.id, b]));
  for (const t of seeds) {
    for (const b of t.snapshot.buildings) {
      const h = home.get(b.id);
      if (h) assert.deepEqual([b.type, b.x, b.z, b.rot], [h.type, h.x, h.z, h.rot], `${t.town}/${b.id}`);
    }
    const a = t.snapshot.avatar;
    assert.ok([a.skin, a.hair, a.face].every(Number.isInteger), t.town);
    assert.ok(a.extra === null || c.wardrobe.extras.some(x => x.id === a.extra), `${t.town}: extra`);
    assert.equal(a.rank, t.snapshot.rank, t.town);
  }
});

test('wardrobe: 4-6 extras from named people with prices, and the looks for the creator', () => {
  const { extras, looks } = c.wardrobe;
  assert.ok(extras.length >= 4 && extras.length <= 6);
  for (const x of extras) assert.ok(Number.isInteger(x.cost) && x.cost > 0 && people.has(x.who) && x.title && x.says, x.id);
  for (const k of ['skins', 'hairs', 'faces']) assert.ok(looks[k].length >= 2 && looks[k].length <= 32, k);
});

test('no problem or event option is best on every effect (dominance check)', () => {
  const score = o => {
    const e = o.effects, l = o.later?.effects ?? {};
    return {
      money: (e.money ?? 0) + (l.money ?? 0),
      rep: (e.rep ?? 0) + (l.rep ?? 0),
      energy: e.energy ?? 0,
      skill: Object.values(e.skill ?? {}).reduce((a, n) => a + n, 0),
      fix: e.fix ? 1 : 0,
    };
  };
  const bad = [];
  for (const k of cards) {
    const all = k.options.map(score);
    all.forEach((a, i) => {
      const others = all.filter((_, j) => j !== i);
      if (Object.keys(a).every(d => others.every(b => a[d] >= b[d]))) bad.push(`${k.id}/${k.options[i].id}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('no card can lock you out: every event has a free option, every problem one without a skill', () => {
  for (const e of c.events) {
    assert.ok(e.options.some(o => !o.needs && (o.effects.money ?? 0) >= 0 && (o.effects.energy ?? 0) >= 0), e.id);
  }
  for (const p of c.problems) assert.ok(p.options.some(o => !o.needs), p.id);
});
