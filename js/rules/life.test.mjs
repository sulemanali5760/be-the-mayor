// Deterministic cases, one per mechanic (LESSONS T2). Contract: docs/builds/01-first-15.md §3.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLife } from './life.js';
import { newSave, migrate } from './save.js';
import { loadContent, rng } from './testkit.mjs';

const content = loadContent();
const fresh = (seed = 1) => createLife(content, newSave('Ana', 'Testville'), rng(seed));
const offerOf = (life, job) => life.offers().find(o => o.job === job);
const types = events => events.map(e => e.type);

test('save: new, broken and partial saves always load', () => {
  const s = newSave('  ', '');
  assert.equal(s.name, 'You');
  assert.equal(s.town, 'Brookfield');
  assert.deepEqual(migrate(null), newSave());
  assert.deepEqual(migrate('junk'), newSave());
  const m = migrate({ name: 'Old', money: 'lots', rep: 7, offers: 'bad', energy: NaN, event: 5 });
  assert.equal(m.name, 'Old');
  assert.equal(m.money, 0);
  assert.equal(m.rep, 7);
  assert.deepEqual(m.offers, []);
  assert.equal(m.energy, 3);
  assert.equal(m.event, null);
});

test('save: stale content ids are dropped and new buildings are added', () => {
  const life = createLife(content, {
    name: 'Old', rank: 9, event: 'gone', problems: ['nope'], offers: [{ id: 'x', job: 'gone' }],
    buildings: [{ id: 'bus_stop', type: 'bus_stop', x: 4, z: -3, rot: 0, state: 'ok', label: 'Mine' }],
  }, rng(1));
  const s = life.state;
  assert.equal(s.rank, 0);
  assert.equal(s.event, null);
  assert.deepEqual(s.problems, []);
  assert.equal(life.offers().length, 2);
  assert.equal(s.buildings.length, content.town.length);
  assert.equal(s.buildings.find(b => b.id === 'bus_stop').label, 'Mine');
  assert.equal(life.ladder().title, 'Labourer');
});

test('save: a JSON round trip gives the same life', () => {
  const a = fresh(3);
  a.doJob(a.offers()[0].id, { stars: 2, seconds: 40 }, 50);
  a.tick(100);
  const b = createLife(content, JSON.parse(JSON.stringify(a.state)), rng(3));
  assert.deepEqual(b.offers(), a.offers());
  assert.deepEqual(b.problems(), a.problems());
  assert.deepEqual(b.snapshot(), a.snapshot());
});

test('board: starts with the two story jobs, two different verbs, contract shape', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const offers = fresh(seed).offers();
    assert.deepEqual(offers.map(o => o.job).sort(), ['keller_wall', 'lindner_cakes']);
    for (const o of offers) {
      assert.deepEqual(Object.keys(o).sort(), ['energy', 'id', 'job', 'params', 'pay', 'task', 'title', 'twist', 'who']);
      assert.ok(o.twist && o.params.twist);
    }
  }
});

test('job: pay by stars, energy, skill, the fix appears in the town', () => {
  const life = fresh();
  const s = life.state;
  const r = life.doJob(offerOf(life, 'keller_wall').id, { stars: 3, seconds: 70 }, 80);
  assert.equal(r.ok, true);
  assert.deepEqual(r.effects, { money: 45, rep: 4, energy: -1, skill: { wall: 3 }, fix: 'keller_garden', label: "Keller's wall – built by you" });
  assert.equal(r.news.length, 1);
  assert.equal(s.money, 45);
  assert.equal(s.energy, 2);
  const wall = s.buildings.find(b => b.id === 'keller_garden');
  assert.equal(wall.state, 'ok');
  assert.equal(wall.label, "Keller's wall – built by you");
  assert.equal(life.offers().length, 2);
  assert.ok(!life.offers().some(o => o.job === 'keller_wall'), 'once-only job is gone');

  const cakes = life.doJob(offerOf(life, 'lindner_cakes').id, { stars: 0, seconds: 45 }, 130);
  assert.equal(cakes.effects.money, 18);
  assert.equal(life.doJob('nope', { stars: 3 }, 140).ok, false);
  s.energy = 0;
  assert.deepEqual(life.doJob(life.offers()[0].id, { stars: 3 }, 150), { ok: false, msg: 'Too tired. Sleep first.', effects: {}, news: [] });
});

test('job: the next task of the same verb never repeats the last twist', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const life = fresh(seed);
    life.doJob(offerOf(life, 'keller_wall').id, { stars: 3 }, 80);
    const next = life.offers().find(o => o.task === 'wall');
    assert.ok(next, 'a new wall job is offered');
    assert.notEqual(next.params.twist, life.state.lastTwist.wall);
  }
});

test('problem: appears on time, effects before choosing, money and skill checks', () => {
  const life = fresh();
  const s = life.state;
  life.tick(89);
  assert.deepEqual(life.problems(), []);
  life.tick(90);
  const [p] = life.problems();
  assert.equal(p.id, 'bus_stop_roof');
  assert.equal(p.at, 'bus_stop');
  assert.deepEqual(p.options[0].effects, { money: -20, rep: 4, fix: 'bus_stop', label: 'Bus stop roof – patched by you' });
  assert.equal(life.choose('bus_stop_roof', 'tarp', 95).msg, 'Not enough money.');
  s.money = 25;
  const r = life.choose('bus_stop_roof', 'tarp', 95);
  assert.equal(r.ok, true);
  assert.equal(r.news.length, 1);
  assert.equal(s.money, 5);
  assert.equal(s.rep, 4);
  assert.equal(s.buildings.find(b => b.id === 'bus_stop').state, 'ok');
  assert.deepEqual(life.problems(), []);
  assert.equal(life.choose('bus_stop_roof', 'tarp', 96).ok, false);

  life.tick(200);
  assert.equal(life.problems()[0].id, 'dump_pile');
  assert.equal(life.choose('dump_pile', 'post', 200).msg, 'Needs Second-hand computer first.');
  s.energy = 0;
  assert.equal(life.choose('dump_pile', 'haul', 200).msg, 'Too tired. Sleep first.');
  assert.equal(life.choose('dump_pile', 'nope', 200).msg, 'No such choice.');
});

test('event: arrives on schedule, and a later consequence lands on time and in the paper', () => {
  const life = fresh();
  const s = life.state;
  life.tick(239);
  assert.equal(life.pendingEvent(), null);
  life.tick(240);
  const e = life.pendingEvent();
  assert.equal(e.id, 'cut_corners');
  assert.equal(e.options.find(o => o.id === 'skip').later, true);
  s.rep = 10;
  assert.equal(life.choose('cut_corners', 'skip', 240).ok, true);
  assert.equal(s.money, 30);
  assert.equal(life.pendingEvent(), null);
  assert.ok(s.nextEventAt >= 390 && s.nextEventAt <= 510);
  assert.ok(!types(life.tick(539)).includes('consequence'));
  const out = life.tick(540).find(x => x.type === 'consequence');
  assert.equal(out.who, 'brandt');
  assert.deepEqual(out.effects, { rep: -5 });
  assert.equal(s.rep, 5);
  const { news } = life.endDay(600);
  assert.ok(news.includes('Garage wall found leaning; foreman blames ‘the new kid’'));
});

test('upgrade: cost, timer on the game clock, skill, locks with reasons', () => {
  const life = fresh();
  const s = life.state;
  const status = id => life.upgrades().find(u => u.id === id);
  assert.equal(life.startUpgrade('night_school', 0).msg, 'Not enough money.');
  s.money = 200;
  assert.deepEqual(life.startUpgrade('night_school', 10), { ok: true });
  assert.equal(s.money, 80);
  assert.equal(status('night_school').status, 'running');
  assert.equal(status('night_school').endsAt, 490);
  assert.equal(life.startUpgrade('night_school', 11).msg, 'Already yours.');
  assert.ok(!types(life.tick(489)).includes('upgradeDone'));
  const done = life.tick(490).find(x => x.type === 'upgradeDone');
  assert.equal(done.id, 'night_school');
  assert.equal(s.skills.electric, 1);
  assert.equal(status('night_school').status, 'done');
  assert.equal(life.startUpgrade('online_plumbing', 500).msg, 'Needs Second-hand computer first.');
  assert.equal(life.startUpgrade('electric_kit', 500).msg, 'Unlocks at Skilled.');
  assert.equal(life.startUpgrade('nope', 500).ok, false);
});

test('upgrade: a new tool puts its new work on the board', () => {
  const life = fresh();
  life.state.money = 35;
  life.startUpgrade('trowel', 0);
  const out = life.tick(15);
  assert.deepEqual(types(out).filter(t => t !== 'upgradeDone'), ['newOffers']);
  assert.ok(life.offers().some(o => o.job === 'pizza_oven'));
  assert.equal(life.offers().length, 2);
});

test('upgrade: the bridge fund is a standing destination that pays out at once', () => {
  const life = fresh();
  const s = life.state;
  s.money = 45;
  const a = life.startUpgrade('bridge_fund', 10);
  assert.equal(a.ok, true);
  assert.ok(a.msg);
  assert.equal(life.startUpgrade('bridge_fund', 11).ok, true);
  assert.equal(s.money, 5);
  assert.equal(s.rep, 2);
  assert.equal(life.upgrades().find(u => u.id === 'bridge_fund').status, 'available');
  assert.equal(life.startUpgrade('bridge_fund', 12).msg, 'Not enough money.');
});

test('ladder: promotion to Skilled with its card and hook, never into a locked rank', () => {
  const life = fresh();
  const s = life.state;
  assert.deepEqual(life.ladder().next.checklist.map(c => c.done), [false, false, false]);
  Object.assign(s, { rep: 15, jobs: ['a', 'b', 'c', 'd'], skills: { electric: 1 }, upgrades: { night_school: { endsAt: 0, done: true } } });
  assert.deepEqual(life.ladder().next.checklist.map(c => c.done), [true, true, true]);
  const out = life.tick(700);
  assert.deepEqual(types(out).slice(0, 3), ['promotion', 'hook', 'newOffers']);
  assert.equal(out[0].title, 'Skilled');
  assert.equal(s.rank, 1);
  assert.ok(life.offers().every(o => content.jobs.find(j => j.id === o.job).rank === 1));
  const l = life.ladder();
  assert.equal(l.title, 'Skilled');
  assert.equal(l.next.locked, true);
  s.rep = 500;
  assert.ok(!types(life.tick(800)).includes('promotion'));
  assert.equal(life.endDay(900).news[0], 'Ana qualifies; Testville gains a tradesperson and loses an excuse');
});

test('day: sleep refills energy, new board, headlines go to the paper once', () => {
  const life = fresh();
  const s = life.state;
  life.doJob(offerOf(life, 'keller_wall').id, { stars: 1 }, 80);
  s.energy = 0;
  const a = life.endDay(100);
  assert.equal(a.day, 2);
  assert.equal(s.energy, 3);
  assert.deepEqual(a.news, ['Garden wall rises on Keller corner; neighbours stop to stare']);
  assert.equal(life.offers().length, 2);
  assert.deepEqual(life.endDay(110).news, ['A quiet day in Testville. Dieter Mahlke complained anyway.']);
});

test('snapshot: the public shape from contract §3.4', () => {
  const life = fresh();
  life.tick(90);
  const snap = life.snapshot();
  assert.deepEqual(Object.keys(snap).sort(), ['buildings', 'day', 'mayor', 'posted', 'rank', 'title', 'town', 'v']);
  assert.equal(snap.v, 1);
  assert.equal(snap.mayor, 'Ana');
  assert.equal(snap.buildings.length, content.town.length);
  for (const b of snap.buildings) assert.deepEqual(Object.keys(b), ['id', 'type', 'x', 'z', 'rot', 'state', 'label']);
  assert.deepEqual(snap.posted, [{ id: 'bus_stop_roof', title: 'The bus stop roof leaks, again' }]);
  assert.doesNotThrow(() => JSON.stringify(snap));
});

test('determinism: the same seed and inputs give the same life', () => {
  const run = () => {
    const life = fresh(42);
    for (let t = 60; t <= 900; t += 60) {
      life.tick(t);
      const e = life.pendingEvent();
      if (e) life.choose(e.id, e.options.at(-1).id, t);
      if (life.state.energy) life.doJob(life.offers()[0].id, { stars: 2 }, t);
      else life.endDay(t);
    }
    return JSON.stringify(life.state);
  };
  assert.equal(run(), run());
});
