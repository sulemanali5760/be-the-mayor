// Balance bot: plays the first 20 minutes 200 times with random-but-sane choices (build plan §4, LESSONS D2/D5).
// Days pace everything (contract change 4): 3 slots a day for jobs, study and help. The play-time model is a new
// player's pace, in seconds of the game clock: see T. One visit to another town after 9:00, as in GAMES §5.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { createLife } from './life.js';
import { newSave } from './save.js';
import { loadContent, rng } from './testkit.mjs';

const CONTENT = loadContent();
const RUNS = 200;
const LIMIT = 1200;
const COURSES = [['night_school'], ['computer', 'online_plumbing']];
// board = read the two offers, pick, see the result; a first-person task adds its own seconds
const T = { board: 20, quick: 20, study: 15, card: 15, buy: 15, sleep: 30, visit: 90 };

function play(seed, content = CONTENT) {
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const life = createLife(content, newSave('Bot', 'Botton'), r);
  const s = life.state;
  const has = n => !n || (s.skills[n] ?? 0) > 0;
  const can = o => has(o.needs) && s.money + (o.effects.money ?? 0) >= 0 && s.slots + (o.effects.energy ?? 0) >= 0;
  const path = pick(COURSES);
  const m = { skilledAt: null, jobs: 0, jobsToSkilled: null, choices15: 0, events15: 0, later15: 0, bought: 0,
    broke: 0, brokeAt: null, moneyAtSkilled: null, fp: { wall: 0, delivery: 0 }, fpMax: null,
    days: [[]], daysToSkilled: null };
  let now = 0;
  let visited = false;
  const did = what => m.days.at(-1).push(what);

  const step = secs => {
    now += secs;
    for (const e of life.tick(now)) {
      if (e.type === 'promotion' && e.rank === 1 && m.skilledAt === null) {
        m.skilledAt = now;
        m.jobsToSkilled = m.jobs;
        m.moneyAtSkilled = s.money;
        m.fpMax = Math.max(m.fp.wall, m.fp.delivery);
        m.daysToSkilled = s.day;
      }
      if (e.type === 'consequence' && now <= 900) m.later15 += 1;
    }
  };
  const choose = (card, isEvent) => {
    const o = pick(card.options.filter(can));
    assert.ok(life.choose(card.id, o.id, now).ok, `${card.id}/${o.id}`);
    did(o.help ? 'help' : o.effects.energy ? 'event' : 'card');
    if (now <= 900) {
      m.choices15 += 1;
      if (isEvent) m.events15 += 1;
    }
    step(T.card);
  };
  const buy = id => {
    assert.ok(life.startUpgrade(id, now).ok, id);
    m.bought += 1;
    did('buy');
    step(T.buy);
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

    const ups = life.upgrades();
    const course = ups.find(u => path.includes(u.id) && u.status === 'available');
    if (course && s.money >= course.cost) { buy(course.id); continue; }

    // sane: study one evening every day while enrolled
    const enrolled = ups.find(u => path.includes(u.id) && u.status === 'running')
      ?? ups.find(u => u.kind === 'course' && u.status === 'running');
    if (enrolled && s.studiedDay !== s.day && s.slots > 0) {
      assert.ok(life.study(enrolled.id, now).ok);
      did('study');
      step(T.study);
      continue;
    }

    // sane: the bridge tin and extras get spare money only, not the course savings
    const extra = ups.filter(u => u.status === 'available' && !path.includes(u.id) && u.cost <= s.money
      && !(u.repeat && course));
    if (extra.length && r() < 0.3) { buy(pick(extra).id); continue; }

    const open = life.problems().filter(p => p.options.some(can));
    if (open.length && r() < 0.6) { choose(pick(open), false); continue; }

    if (!visited && now >= 540) { visited = true; did('visit'); step(T.visit); continue; }

    const ready = life.offers().filter(o => o.energy <= s.slots);
    if (ready.length) {
      const offer = pick(ready);
      if (offer.quick) {
        now += T.quick;
        assert.ok(life.doJob(offer.id, { quick: true }, now).ok);
        did('quick');
      } else {
        const x = r();
        const stars = x < 0.5 ? 3 : x < 0.85 ? 2 : 1;
        const seconds = offer.task === 'wall' ? 50 + r() * 40 : 25 + r() * 20;
        now += seconds + T.board; // the task takes over the screen; the world ticks again when it ends
        assert.ok(life.doJob(offer.id, { stars, seconds }, now).ok);
        if (m.skilledAt === null) m.fp[offer.task] += 1;
        did(offer.task);
      }
      m.jobs += 1;
      step(0);
      continue;
    }

    life.endDay(now);
    m.days.push([]);
    step(T.sleep);
  }
  return m;
}

const SLOT_ACTIONS = new Set(['wall', 'delivery', 'quick', 'study', 'help', 'event']);
// distinct slot-using action types per full day before the day of Skilled
const typesPerDay = x => x.days.slice(0, x.daysToSkilled - 1)
  .map(d => new Set(d.filter(a => SLOT_ACTIONS.has(a))).size);

const median = xs => {
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor((a.length - 1) / 2)];
};
const pct = (xs, p) => [...xs].sort((x, y) => x - y)[Math.floor(p * (xs.length - 1))];
const min = sec => (sec === Infinity ? 'never' : `${(sec / 60).toFixed(1)} min`);
const mean = xs => xs.reduce((a, x) => a + x, 0) / xs.length;

function measure(content) {
  const runs = Array.from({ length: RUNS }, (_, i) => play(i + 1, content));
  const reached = runs.filter(x => x.skilledAt !== null);
  const skilled = runs.map(x => x.skilledAt ?? Infinity);
  return {
    runs, reached, skilled,
    med: median(skilled),
    jobs: median(reached.map(x => x.jobsToSkilled)),
    jobsP90: pct(reached.map(x => x.jobsToSkilled), 0.9),
    types: mean(reached.flatMap(typesPerDay)),
    within: reached.filter(x => x.fpMax <= 2).length,
  };
}

// ponytail: tuning sweep of course prices, printed only; delete once the prices settle
function sweep() {
  return [0, 40, 80].map(add => {
    const content = { ...CONTENT, upgrades: CONTENT.upgrades.map(u =>
      (['night_school', 'online_plumbing'].includes(u.id) ? { ...u, cost: u.cost + add } : u)) };
    const b = measure(content);
    return `| course +€${add} | ${min(b.med)} | ${b.jobs} (p90 ${b.jobsP90}) | ${b.types.toFixed(2)} | ${b.within}/${b.reached.length} |`;
  });
}

test('balance bot: 200 runs of the first 20 minutes', () => {
  const { runs, reached, skilled, med, jobs, jobsP90, types, within } = measure(CONTENT);
  const brokeRuns = runs.filter(x => x.broke);
  const fpDist = [1, 2, 3].map(n => reached.filter(x => x.fpMax === n).length)
    .concat(reached.filter(x => x.fpMax >= 4).length).join(' / ');
  const rows = [
    ['Skilled reached (median)', min(med), '12–18 min'],
    ['Skilled reached (p10 / p90)', `${min(pct(skilled, 0.1))} / ${min(pct(skilled, 0.9))}`, ''],
    ['Runs reaching Skilled by 20 min', `${reached.length}/${RUNS}`, ''],
    ['Day of Skilled (median)', median(reached.map(x => x.daysToSkilled)), ''],
    ['Jobs before Skilled (median / p90)', `${jobs} / ${jobsP90}`, '≤ 12'],
    ['Slot action types per day before Skilled (mean)', types.toFixed(2), '≥ 2'],
    ['First-person tasks per kind before Skilled (runs with max 1 / 2 / 3 / 4+)', fpDist, 'max 2 in ≥ 95 %'],
    ['Money in hand at Skilled (median)', `€${median(reached.map(x => x.moneyAtSkilled))}`, ''],
    ['Choices in the first 15 min (median)', median(runs.map(x => x.choices15)), '≥ 3'],
    ['Events in the first 15 min (median)', median(runs.map(x => x.events15)), '≥ 1'],
    ['Runs with a delayed consequence by 15 min', `${runs.filter(x => x.later15).length}/${RUNS}`, ''],
    ['Upgrades bought in 20 min (median)', median(runs.map(x => x.bought)), ''],
    ['Money with nowhere to go (runs / decisions)', `${brokeRuns.length} / ${runs.reduce((a, x) => a + x.broke, 0)}`, '0'],
  ];
  const mid = reached.find(x => x.skilledAt === med);
  const mix = mid ? mid.days.slice(0, mid.daysToSkilled).map((d, i) => `| ${i + 1} | ${d.join(', ')} |`) : [];
  const table = ['### Balance bot (200 runs)', '', '| Measure | Result | Target |', '|---|---|---|',
    ...rows.map(r => `| ${r.join(' | ')} |`),
    '', `### A median run, day by day (Skilled at ${min(med)})`, '', '| Day | Actions |', '|---|---|', ...mix,
    '', '### Course price sweep', '', '| Variant | Skilled | Jobs | Types/day | ≤ 2 FP |', '|---|---|---|---|---|', ...sweep(),
  ].join('\n');
  console.log(`BALANCE\n${table}`);
  if (brokeRuns.length) console.log(`BALANCE first stuck: ${brokeRuns[0].brokeAt}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);

  assert.ok(med >= 720 && med <= 1080, `median Skilled at ${min(med)}, target 12–18 min`);
  assert.ok(jobs <= 12, `median ${jobs} jobs before Skilled, target ≤ 12`);
  assert.ok(types >= 2, `${types.toFixed(2)} action types per day, target ≥ 2`);
  assert.ok(within >= 0.95 * reached.length, `max 2 first-person tasks per kind in only ${within}/${reached.length} runs`);
  assert.equal(brokeRuns.length, 0, `money had nowhere to go: ${brokeRuns[0]?.brokeAt}`);
  assert.ok(median(runs.map(x => x.choices15)) >= 3, 'at least 3 choices in 15 min');
  assert.ok(median(runs.map(x => x.events15)) >= 1, 'at least 1 event in 15 min');
});
