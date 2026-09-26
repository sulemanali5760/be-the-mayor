// Balance bot: plays the first 20 minutes 200 times with random-but-sane choices (build plan §4, LESSONS D2/D5).
// Play-time model: a task takes its own seconds plus 10 s at the board; a card 8 s; an upgrade 5 s; sleep and
// the paper 12 s; one visit to another town (90 s) after 9:00, as in GAMES §5.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { createLife } from './life.js';
import { newSave } from './save.js';
import { loadContent, rng } from './testkit.mjs';

const content = loadContent();
const RUNS = 200;
const LIMIT = 1200;
const COURSES = [['night_school'], ['computer', 'online_plumbing']];

function play(seed) {
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const life = createLife(content, newSave('Bot', 'Botton'), r);
  const s = life.state;
  const has = n => !n || (s.skills[n] ?? 0) > 0;
  const can = o => has(o.needs) && s.money + (o.effects.money ?? 0) >= 0 && s.energy + (o.effects.energy ?? 0) >= 0;
  const path = pick(COURSES);
  const m = { skilledAt: null, jobs: 0, jobsToSkilled: null, choices15: 0, events15: 0, later15: 0, bought: 0,
    broke: 0, brokeAt: null, verbs15: new Set(), moneyAtSkilled: null };
  let now = 0;
  let visited = false;

  const step = secs => {
    now += secs;
    for (const e of life.tick(now)) {
      if (e.type === 'promotion' && e.rank === 1 && m.skilledAt === null) {
        m.skilledAt = now;
        m.jobsToSkilled = m.jobs;
        m.moneyAtSkilled = s.money;
      }
      if (e.type === 'consequence' && now <= 900) m.later15 += 1;
    }
  };
  const choose = (card, isEvent) => {
    const o = pick(card.options.filter(can));
    assert.ok(life.choose(card.id, o.id, now).ok, `${card.id}/${o.id}`);
    if (now <= 900) {
      m.choices15 += 1;
      if (isEvent) m.events15 += 1;
    }
    step(8);
  };

  step(0);
  while (now < LIMIT) {
    // money always has somewhere to go: an upgrade or a paid fix within the two jobs on the board
    const reach = s.money + life.offers().reduce((a, o) => a + o.pay, 0);
    const costs = [
      ...life.upgrades().filter(u => u.status === 'available').map(u => u.cost),
      ...life.problems().flatMap(p => p.options.filter(o => has(o.needs) && o.effects.money < 0).map(o => -o.effects.money)),
    ];
    if (!costs.some(c => c <= reach)) {
      m.broke += 1;
      m.brokeAt ??= `${Math.round(now)}s rank ${s.rank} money ${s.money} reach ${reach} left ${costs.join('/') || 'none'}`;
    }

    const event = life.pendingEvent();
    if (event) { choose(event, true); continue; }

    const course = life.upgrades().find(u => path.includes(u.id) && u.status === 'available');
    if (course && s.money >= course.cost) {
      life.startUpgrade(course.id, now);
      m.bought += 1;
      step(5);
      continue;
    }

    const extra = life.upgrades().filter(u => u.status === 'available' && !path.includes(u.id) && u.cost <= s.money);
    if (extra.length && r() < 0.3) {
      assert.ok(life.startUpgrade(pick(extra).id, now).ok);
      m.bought += 1;
      step(5);
      continue;
    }

    const open = life.problems().filter(p => p.options.some(can));
    if (open.length && r() < 0.6) { choose(pick(open), false); continue; }

    if (!visited && now >= 540) { visited = true; step(90); continue; }

    const ready = life.offers().filter(o => o.energy <= s.energy);
    if (ready.length) {
      const offer = pick(ready);
      const x = r();
      const stars = x < 0.5 ? 3 : x < 0.85 ? 2 : 1;
      const seconds = offer.task === 'wall' ? 50 + r() * 40 : 25 + r() * 20;
      if (now <= 900) m.verbs15.add(offer.task);
      now += seconds + 10; // the task takes over the screen; the world ticks again when it ends
      assert.ok(life.doJob(offer.id, { stars, seconds }, now).ok);
      m.jobs += 1;
      step(0);
      continue;
    }

    life.endDay(now);
    step(12);
  }
  return m;
}

const median = xs => {
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor((a.length - 1) / 2)];
};
const pct = (xs, p) => [...xs].sort((x, y) => x - y)[Math.floor(p * (xs.length - 1))];
const min = sec => (sec === Infinity ? 'never' : `${(sec / 60).toFixed(1)} min`);

test('balance bot: 200 runs of the first 20 minutes', () => {
  const runs = Array.from({ length: RUNS }, (_, i) => play(i + 1));
  const skilled = runs.map(x => x.skilledAt ?? Infinity);
  const reached = runs.filter(x => x.skilledAt !== null);
  const brokeRuns = runs.filter(x => x.broke);
  const rows = [
    ['Skilled reached (median)', min(median(skilled)), '12–18 min'],
    ['Skilled reached (p10 / p90)', `${min(pct(skilled, 0.1))} / ${min(pct(skilled, 0.9))}`, ''],
    ['Runs reaching Skilled by 20 min', `${reached.length}/${RUNS}`, ''],
    ['Jobs done by Skilled (median)', median(reached.map(x => x.jobsToSkilled)), ''],
    ['Money in hand at Skilled (median)', `€${median(reached.map(x => x.moneyAtSkilled))}`, ''],
    ['Choices in the first 15 min (median)', median(runs.map(x => x.choices15)), '≥ 3'],
    ['Events in the first 15 min (median)', median(runs.map(x => x.events15)), '≥ 1'],
    ['Runs with a delayed consequence by 15 min', `${runs.filter(x => x.later15).length}/${RUNS}`, ''],
    ['Runs with both job verbs by 15 min', `${runs.filter(x => x.verbs15.size === 2).length}/${RUNS}`, 'the bot picks at random'],
    ['Upgrades bought in 20 min (median)', median(runs.map(x => x.bought)), ''],
    ['Money with nowhere to go (runs / decisions)', `${brokeRuns.length} / ${runs.reduce((a, x) => a + x.broke, 0)}`, '0'],
  ];
  const table = ['### Balance bot (200 runs)', '', '| Measure | Result | Target |', '|---|---|---|',
    ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
  console.log(`BALANCE\n${table}`);
  if (brokeRuns.length) console.log(`BALANCE first stuck: ${brokeRuns[0].brokeAt}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);

  const med = median(skilled);
  assert.ok(med >= 720 && med <= 1080, `median Skilled at ${min(med)}, target 12–18 min`);
  assert.equal(brokeRuns.length, 0, `money had nowhere to go: ${brokeRuns[0]?.brokeAt}`);
  assert.ok(median(runs.map(x => x.choices15)) >= 3, 'at least 3 choices in 15 min');
  assert.ok(median(runs.map(x => x.events15)) >= 1, 'at least 1 event in 15 min');
});
