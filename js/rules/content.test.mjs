// Content checks: every id resolves, counts match the build plan (§3.2), and no card has a dominant option.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './testkit.mjs';

const c = loadContent();
const ids = list => new Set(list.map(x => x.id));
const people = ids(c.people);
const buildings = ids(c.town);
const skills = new Set(['wall', 'delivery', ...c.upgrades.map(u => u.gives)]);
const cards = [...c.problems, ...c.events];
const EFFECT_KEYS = new Set(['money', 'rep', 'energy', 'skill', 'fix', 'label']);

test('ids are unique in every file', () => {
  for (const n of ['jobs', 'people', 'problems', 'events', 'upgrades', 'town']) {
    assert.equal(ids(c[n]).size, c[n].length, n);
  }
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

test('jobs fit the tasks: wall 8-12 bricks, delivery 3-4 stops in 45 s, 2+ twists each', () => {
  for (const j of c.jobs) {
    assert.ok(['wall', 'delivery'].includes(j.task), j.id);
    assert.ok(j.twists.length >= 2, `${j.id}: twists`);
    if (j.task === 'wall') assert.ok(j.params.bricks >= 8 && j.params.bricks <= 12, `${j.id}: bricks`);
    else assert.ok(j.params.stops.length >= 3 && j.params.stops.length <= 4 && j.params.seconds <= 45, `${j.id}: stops`);
  }
  // Skilled pays +30-60% over Labourer (REAL-WORLD §2.2)
  const avg = list => list.reduce((a, j) => a + j.pay, 0) / list.length;
  const gain = avg(c.jobs.filter(j => j.rank === 1)) / avg(c.jobs.filter(j => !j.rank)) - 1;
  assert.ok(gain >= 0.3 && gain <= 0.6, `skilled pay gain ${gain.toFixed(2)}`);
});

test('counts match the build plan', () => {
  assert.ok(c.events.length >= 15, 'about 15 events');
  assert.ok(c.events.filter(e => e.options.some(o => o.later)).length >= 2, '2+ events with later');
  assert.ok(c.signs.length >= 20 && c.signs.every(s => typeof s === 'string' && s.length <= 60), 'about 20 signs');
  assert.ok(c.town.length >= 12, 'about 12 buildings');
  assert.ok(c.town.every(b => Number.isInteger(b.x) && Number.isInteger(b.z) && ['ok', 'broken'].includes(b.state)), '1 m grid');
  assert.deepEqual(c.ranks.slice(0, 2).map(r => r.title), ['Labourer', 'Skilled']);
  assert.ok(c.ranks.slice(2).every(r => r.locked), 'later ranks locked');
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
