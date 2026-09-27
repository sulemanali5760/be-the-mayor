// Automated acceptance run (GitHub Actions): headless Chrome plays the first 15 minutes at desktop,
// small-window and phone sizes, checks B1–B4 of build 0.1 and C1–C4 of build 0.2, and saves screenshots to qa/out/.
//   node qa/acceptance.mjs http://localhost:8080/
// Offline mode (?offline=1): CI never talks to the live Supabase project. Time is the game clock (LESSONS T6).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:8080/') + '?q=low&offline=1';
const FULL = (process.argv[2] || 'http://localhost:8080/') + '?offline=1'; // C3: the real phone look (outlines, shadows)
const LOOK = { skin: 2, hair: 1, face: 1 }; // the creator's 3 taps
const BUDGET = { ms: 8, calls: 150, triangles: 60000 }; // C3, build 0.2 §3.1
const OUT = 'qa/out';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'small', viewport: { width: 640, height: 400 } },
  { name: 'phone', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const results = [];
let low = null; // C3: the phone's frame JS at ?q=low, measured after its play-through
const check =(view, id, ok, note) => results.push({ view, id, ok: !!ok, note: String(note) });
async function shot(page, name) {
  try { await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 45000 }); } catch (e) { console.log('screenshot failed', name, String(e.message).split('\n')[0]); }
}

// B4: HUD pieces must not overlap each other and must stay inside the viewport, with no sideways scroll
function layout(sels) {
  const W = innerWidth, H = innerHeight, boxes = [];
  for (const s of sels) {
    const e = document.querySelector(s);
    const b = e && e.getBoundingClientRect();
    if (b && b.width && b.height) boxes.push({ s, b });
  }
  const bad = [];
  for (const { s, b } of boxes) if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) bad.push(`${s} outside`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].b, c = boxes[j].b;
    if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push(`${boxes[i].s} × ${boxes[j].s}`);
  }
  if (document.scrollingElement.scrollWidth > W + 1) bad.push('sideways scroll');
  return { seen: boxes.map(x => x.s), bad };
}

const snapshotState = () => {
  const b = __btm, L = b.life, l = L.ladder();
  return {
    rank: l.rank, mode: b.mode, t: +b.clock.t.toFixed(1), ...b.stats(), visits: b.meta.visits, hook: b.meta.hook, tod: b.tod, todWant: b.TOD[b.stats().slots],
    card: !document.getElementById('modal').hidden, promoCard: document.getElementById('card').classList.contains('promo'),
    cardOpts: [...document.querySelectorAll('#card [data-opt]')].map(x => ({ id: x.dataset.opt, disabled: x.disabled })),
    cardKind: document.querySelector('#card .eyebrow')?.textContent || '', studiedDay: L.state.studiedDay,
    offers: L.offers().map(o => ({ id: o.id, energy: o.energy ?? 0, task: o.task, quick: !!o.quick })),
    problems: L.problems().map(p => ({ id: p.id, options: p.options.map(o => ({ id: o.id, money: o.effects?.money || 0, rep: o.effects?.rep || 0,
      slots: -(o.effects?.energy || 0), help: !!o.help, needsOk: !o.needs || L.state.skills?.[o.needs] > 0 })) })),
    upgrades: L.upgrades().map(u => ({ id: u.id, status: u.status, cost: u.cost ?? 0, kind: u.kind, studied: u.studied, evenings: u.evenings, repeat: !!u.repeat })),
    checklist: l.next?.checklist || [],
  };
};

async function openPanel(page, name) {
  if (!(await page.$(`#dock [data-panel="${name}"].on`))) await page.click(`#dock [data-panel="${name}"]`);
  await page.waitForTimeout(150);
}

// ends the running first-person task through Lane W's QA hook (docs/ASSETS.md): wait until the task has
// loaded its models and started, let it run a few frames, then finish with 3 stars
async function finishTask(page) {
  await page.waitForFunction(() => window.__btmWorld?.task(), null, { timeout: 60000 });
  await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r)); });
  await page.waitForFunction(() => __btmWorld.finish(3), null, { timeout: 30000 });
}

async function visitFirst(page, index = 0) {
  await openPanel(page, 'visit');
  await page.waitForSelector('#sheetBody [data-town]', { timeout: 30000 });
  const ids = await page.$$eval('#sheetBody [data-town]', bs => bs.map(b => b.dataset.town));
  await page.click(`#sheetBody [data-town="${ids[index % ids.length]}"]`);
  await page.waitForFunction(() => __btm.mode === 'visit', null, { timeout: 30000 });
  return ids[index % ids.length];
}
async function goHome(page) {
  await page.click('[data-visit="home"]');
  await page.waitForFunction(() => __btm.mode === 'town', null, { timeout: 30000 });
}

const botLog = []; // kept outside the bot so a failure report can show its last steps
// a player's pace in game seconds per action, the same as Lane S's balance bot (js/rules/balance.test.mjs);
// first-person tasks add their own time. The bot is faster than a person, so it advances the game clock by these.
const T = { board: 20, quick: 20, study: 15, card: 15, buy: 15, sleep: 30, visit: 90 };
const pace = (page, sec) => page.evaluate(x => __btm.advance(x), sec);

// B1 bot: plays through the real UI with sane choices until the ladder says Skilled
async function playToSkilled(page, v) {
  const log = botLog, tried = {}, acts = []; // acts: [{ day, type }] for the action types per day
  const todBad = []; // C2: town steps whose time of day doesn't match the slots left
  log.length = 0;
  let want = null, promo = null, downloaded = '', walked = 0;
  for (let step = 0; step < 160; step++) {
    const s = await page.evaluate(snapshotState);
    if (s.mode === 'town' && !s.card && s.tod !== s.todWant) todBad.push(`d${s.day}/${s.slots} slots: ${s.tod}`);
    if (s.rank >= 1 && promo && !s.card) return { ok: true, s, log, promo, downloaded, acts, todBad };
    let did;
    if (s.mode === 'walk') {
      // build 0.2: the avatar walks to the building first. Watch the first walk end by itself, tap to skip the others
      if (walked++) {
        const box = await page.locator('#view').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else await shot(page, `${v}-4a-walk`);
      await page.waitForFunction(() => __btm.mode !== 'walk', null, { timeout: 60000 });
      did = walked > 1 ? 'walk (tap)' : 'walk (watched)';
    } else if (s.card && !s.promoCard && /Something happened|Town problem/.test(s.cardKind)) {
      // an event or a problem: pick the planned option, else the first one that can be taken
      const ids = s.cardOpts.filter(o => !o.disabled).map(o => o.id);
      const id = want && ids.includes(want) ? want : ids.find(x => x !== '') ?? ids[0];
      const help = want && id === want && s.problems.some(p => p.options.some(o => o.id === id && o.help));
      want = null;
      await page.click(`#card [data-opt="${id}"]`);
      if (id) acts.push({ day: s.day, type: /Town problem/.test(s.cardKind) ? (help ? 'help' : 'problem') : 'event' });
      await pace(page, T.card);
      did = `card → ${id}`;
    } else if (s.card) {
      const ids = s.cardOpts.filter(o => !o.disabled).map(o => o.id);
      if (s.promoCard) {
        promo = await page.evaluate(() => __btm.qa.promo?.toDataURL('image/png').length || 0);
        await shot(page, `${v}-5-promotion`);
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.click('#card [data-opt="save"]')]);
        downloaded = dl ? dl.suggestedFilename() : '';
        await page.click('#card [data-opt="ok"]');
        did = 'promotion card';
      } else {
        const id = want && ids.includes(want) ? want : ids.find(x => x !== '') ?? ids[0];
        want = null;
        await page.click(`#card [data-opt="${id}"]`);
        did = `card → ${id}`;
      }
    } else if (s.mode === 'task') {
      await finishTask(page);
      await page.waitForFunction(() => __btm.mode !== 'task', null, { timeout: 30000 });
      await pace(page, T.board); // reading the board and the result; the task itself ran on the game clock
      did = 'task finished';
    } else if (s.mode === 'visit') {
      await goHome(page);
      did = 'home';
    } else {
      // contract change 4: enrol in one course, study one evening a day, buy extras only once enrolled
      const enrolled = s.upgrades.find(u => u.kind === 'course' && (u.status === 'running' || u.status === 'done'));
      const course = !enrolled && s.upgrades.find(u => u.kind === 'course' && u.status === 'available' && u.cost <= s.money);
      const study = s.upgrades.find(u => u.status === 'running') && s.studiedDay !== s.day && s.slots > 0 && s.upgrades.find(u => u.status === 'running');
      const extra = enrolled && s.upgrades.find(u => u.kind === 'buy' && u.status === 'available' && u.cost <= s.money && !log.includes(`buy ${u.id}`));
      // rotate job kinds so both verbs get played
      const offers = s.offers.filter(o => o.energy <= s.slots);
      const last = log.filter(l => l.startsWith('job ')).pop();
      const offer = offers.find(o => !last || !last.endsWith(o.task)) || offers[0];
      // a sane player takes a problem once they can afford an option that helps (rep up), and gives up after 2 tries
      const prob = s.problems.filter(p => (tried[p.id] || 0) < 2)
        .map(p => ({ p, o: p.options.filter(o => s.money + o.money >= 0 && o.rep > 0 && o.needsOk && o.slots <= s.slots).sort((a, b) => b.rep - a.rep)[0] })).find(x => x.o);
      if (course || extra) {
        const u = course || extra;
        await openPanel(page, 'upgrades');
        await page.click(`#sheetBody [data-upgrade="${u.id}"]`);
        acts.push({ day: s.day, type: 'buy' });
        await pace(page, T.buy);
        did = `${course ? 'enrol' : 'buy'} ${u.id}`;
      } else if (study) {
        await openPanel(page, 'upgrades');
        if (!log.some(l => l.startsWith('study '))) await shot(page, `${v}-3c-learn`);
        await page.click(`#sheetBody [data-study="${study.id}"]`);
        acts.push({ day: s.day, type: 'study' });
        await pace(page, T.study);
        did = `study ${study.id} ${study.studied + 1}/${study.evenings}`;
      } else if (enrolled && !s.visits) {
        await visitFirst(page);
        await shot(page, `${v}-6-visit`);
        await page.click('[data-visit="like"]');
        acts.push({ day: s.day, type: 'visit' });
        await pace(page, T.visit);
        did = 'visit + like';
      } else if (prob) {
        await openPanel(page, 'problems');
        await page.click(`#sheetBody [data-problem="${prob.p.id}"]`);
        want = prob.o.id;
        tried[prob.p.id] = (tried[prob.p.id] || 0) + 1;
        did = `problem ${prob.p.id}`;
      } else if (offer) {
        await openPanel(page, 'jobs');
        if (offer.quick) { // contract change 2: a mastered task is taken as a quick shift whenever offered
          if (!log.some(l => l.startsWith('quick '))) await shot(page, `${v}-3b-quick`);
          await page.click(`#sheetBody [data-quick="${offer.id}"]`);
          acts.push({ day: s.day, type: 'quick' });
          await pace(page, T.quick);
          did = `quick ${offer.task}`;
        } else {
          if (!log.some(l => l.startsWith('job '))) await shot(page, `${v}-3-jobs`);
          await page.click(`#sheetBody [data-job="${offer.id}"]`);
          acts.push({ day: s.day, type: offer.task });
          await page.waitForTimeout(300);
          if (!log.some(l => l.startsWith('job '))) await shot(page, `${v}-4-task`);
          did = `job ${offer.task}`;
        }
      } else if (s.rank >= 1) {
        did = 'waiting for the promotion card';
      } else {
        if (!log.some(l => l.startsWith('sleep'))) await shot(page, `${v}-3d-day-done`);
        await page.click('#dock [data-act="sleep"]');
        await pace(page, T.sleep);
        did = `sleep (day ${s.day}, ${s.slots} slots left)`;
      }
    }
    log.push(did);
    await page.waitForTimeout(350);
  }
  return { ok: false, s: await page.evaluate(snapshotState), log, promo, downloaded, acts, todBad };
}

// C3: frame JS (median of n town frames, measured by main.js) and the world's draw calls and triangles
async function perf(page, n = 60) {
  return page.evaluate(async n => {
    __btm.qa.ms.length = 0;
    for (let i = 0; i < 400 && __btm.qa.ms.length < n; i++) await new Promise(r => requestAnimationFrame(r));
    const ms = [...__btm.qa.ms].sort((a, b) => a - b);
    const st = __btmWorld.stats();
    return { ms: +(ms[ms.length >> 1] ?? NaN).toFixed(2), n: ms.length, calls: st.calls, triangles: st.triangles };
  }, n);
}
const perfNote = p => `JS ${p.ms} ms (median of ${p.n}), ${p.calls} draw calls, ${p.triangles} triangles`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, deviceScaleFactor: v.deviceScaleFactor || 1, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.goto(BASE);
    await page.waitForSelector('#inName', { timeout: 120000 });
    for (const [k, i] of Object.entries(LOOK)) await page.click(`#card .sw[data-k="${k}"][data-i="${i}"]`); // the creator: 3 taps
    await shot(page, `${v.name}-1-intro`);
    await page.click('#card [data-opt="go"]');
    await page.waitForFunction(() => window.__btm && __btm.life, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await shot(page, `${v.name}-2-town`);

    // B4: town HUD, then with the job sheet open
    // (toasts are short-lived and may sit over an open sheet, so they are checked against the fixed HUD only)
    const b4a = await page.evaluate(layout, ['#top', '#dock', '#toasts .toast']);
    await openPanel(page, 'jobs');
    const b4b = await page.evaluate(layout, ['#top', '#dock', '#sheet']);
    await page.click('#sheetClose');

    // B1 + B2: play to Skilled through the UI
    const t0 = Date.now();
    const b1 = await playToSkilled(page, v.name);
    check(v.name, 'B1 start → Skilled', b1.ok && !!b1.s.hook,
      `rank ${b1.s.rank} after ${b1.log.length} steps, game ${b1.s.t} s, real ${Math.round((Date.now() - t0) / 1000)} s, hook “${b1.s.hook || '—'}”; ${b1.ok ? '' : 'last: ' + b1.log.slice(-6).join(' · ')}`);
    check(v.name, 'B1 promotion card PNG', b1.promo > 20000 && /\.png$/.test(b1.downloaded), `canvas ${b1.promo} chars, download “${b1.downloaded}”`);
    const tasks = await page.evaluate(() => __btm.qa.tasks);
    const kinds = new Set(tasks.map(t => t.kind));
    // rule D1 via contract change 2: at most 2 first-person tasks per kind on the way to Skilled (B1 plays no others)
    const per = {};
    for (const t of tasks) per[t.kind] = (per[t.kind] || 0) + 1;
    const quick = await page.evaluate(() => __btm.qa.quick);
    check(v.name, 'B1 ≤ 2 first-person tasks per kind', Object.values(per).every(n => n <= 2),
      `${Object.entries(per).map(([k, n]) => `${k} ×${n}`).join(', ')}; quick shifts: ${quick.join(', ') || 'none'}`);
    // contract change 4 targets: ≤ 12 jobs before Skilled, on average ≥ 2 different action types per day
    const days = {};
    for (const a of b1.acts) (days[a.day] ||= new Set()).add(['wall', 'delivery', 'quick'].includes(a.type) ? 'job' : a.type);
    const jobs = tasks.length + quick.length, perDay = Object.values(days).map(d => d.size), avg = perDay.reduce((a, b) => a + b, 0) / (perDay.length || 1);
    check(v.name, 'B1 days: ≤ 12 jobs, ≥ 2 action types a day', jobs <= 12 && avg >= 2,
      `${jobs} jobs over ${perDay.length} days; action types a day ${perDay.join('/')} (avg ${avg.toFixed(1)}); ` +
      Object.entries(days).map(([d, set]) => `d${d}: ${b1.acts.filter(a => a.day == d).map(a => a.type).join('+')}`).join(' · '));
    check(v.name, 'B2 first-person tasks ≤ 90 s game time', tasks.length >= 2 && kinds.size >= 2 && tasks.every(t => t.game <= 90 && t.seconds <= 90),
      tasks.map(t => `${t.kind} ${t.game}s/${t.seconds}s`).join(', ') || 'no tasks played');

    // C1: your look from the creator, in the Labourer outfit, then the Skilled one after the promotion
    const ev = await page.evaluate(() => ({ av: __btm.qa.avatar, walks: __btm.qa.walks, tod: __btm.qa.tod, stubs: __btm.stubs, seen: window.__btmWorld?.avatar?.() ?? null }));
    const stub = k => ev.stubs.includes(k) ? ` (world.${k} is a stub)` : '';
    const home = ev.av.filter(a => !a.visit), r0 = home.findIndex(a => a.rank === 0), r1 = home.findIndex(a => a.rank === 1);
    const mine = r0 >= 0 && Object.entries(LOOK).every(([k, i]) => home[r0][k] === i);
    check(v.name, 'C1 avatar: your look, outfit changes at Skilled', mine && r1 > r0 && (stub('setAvatar') || ev.seen?.visible),
      `look ${JSON.stringify(home[r0] || {})}; Skilled at call ${r1} of ${home.length}; world ${JSON.stringify(ev.seen)}${stub('setAvatar')}`);
    const walkNote = ev.walks.map(w => `${w.id} ${w.how} ${w.game}s`).join(', ');
    check(v.name, 'C1 walk before a task or card (≤ 3 s, a tap skips)', ev.walks.length >= 3 && ev.walks.every(w => w.game <= 3.1) && (stub('walkTo') || ev.walks.some(w => w.how === 'tap')),
      `${ev.walks.length} walks: ${walkNote}${stub('walkTo')}`);
    // C2: every town step matched the slots (checked in the bot), and a night fell and turned to morning
    const seq = ev.tod.map(x => x.t), slept = seq.some((t, i) => t === 1 && seq[i + 1] === 0);
    check(v.name, 'C2 time of day follows the slots', !b1.todBad.length && slept && [0, 0.3, 0.55, 0.75].every(t => seq.includes(t)),
      `${seq.length} changes: ${seq.slice(0, 12).join(' → ')}…; mismatches: ${b1.todBad.slice(0, 3).join(', ') || 'none'}${stub('setTimeOfDay')}`);

    await page.click('#ladder');
    await page.waitForTimeout(200);
    await shot(page, `${v.name}-7-ladder`);
    await page.click('#sheetClose');

    // C1 wardrobe: buy the cheapest extra in the Learn sheet's Wardrobe tab; the avatar wears it
    const x = await page.evaluate(() => [...__btm.life.wardrobe()].sort((a, b) => a.cost - b.cost)[0]);
    const topUp = await page.evaluate(c => { const s = __btm.life.state, n = Math.max(0, c - s.money); s.money += n; return n; }, x.cost);
    await openPanel(page, 'upgrades');
    await page.click('#sheetBody [data-tab="wardrobe"]');
    await page.click(`#sheetBody [data-extra="${x.id}"]`);
    await page.waitForTimeout(200);
    await shot(page, `${v.name}-7b-wardrobe`);
    const worn = await page.evaluate(() => ({ a: __btm.life.state.avatar, last: __btm.qa.avatar.at(-1) }));
    check(v.name, 'C1 wardrobe: buy and wear an extra', worn.a.extra === x.id && worn.a.owned.includes(x.id) && worn.last.extra === x.id,
      `${x.title} €${x.cost}${topUp ? ` (QA topped up €${topUp})` : ''}; avatar ${JSON.stringify(worn.last)}`);
    await page.click('#sheetClose');

    // B3: offline visit, like (and the once-per-day rule), sign, help, home
    const id = await visitFirst(page, 1);
    const b4c = await page.evaluate(layout, ['#top', '#visitbar', '#toasts .toast']);
    // C4: the visited town's avatar (from its snapshot), then yours again at home
    const theirs = await page.evaluate(i => __btm.net.getTown(i).then(t => t.snapshot.avatar), id);
    const shown = await page.evaluate(() => ({ last: __btm.qa.avatar.at(-1), seen: window.__btmWorld?.avatar?.() ?? null }));
    await shot(page, `${v.name}-8a-visit-avatar`);
    await page.click('[data-visit="like"]');
    await page.waitForTimeout(200);
    const again = await page.evaluate(i => __btm.net.like(i), id);
    await page.click('[data-visit="sign"]');
    await page.click('#card [data-opt="0"]');
    await page.waitForTimeout(200);
    await page.click('[data-visit="help"]');
    await page.waitForSelector('#card [data-opt]');
    await page.click('#card .opt >> nth=0');
    await page.waitForTimeout(200);
    await shot(page, `${v.name}-8-visit-done`);
    const acts = await page.evaluate(() => __btm.qa.visits.slice(-3));
    await goHome(page);
    const ok3 = acts.length === 3 && acts.every(a => a.ok) && acts.map(a => a.kind).join() === 'like,sign,help' && /already done/i.test(again.msg || '');
    check(v.name, 'B3 offline visit, like, sign, help', ok3, `${acts.map(a => `${a.kind}:${a.ok ? 'ok' : a.msg}`).join(', ')}; second like: “${again.msg}”`);
    const back = await page.evaluate(() => __btm.qa.avatar.at(-1));
    const same = (a, b) => ['skin', 'hair', 'face', 'extra', 'rank'].every(k => a?.[k] === b?.[k]);
    check(v.name, 'C4 a visit shows the other avatar', shown.last.visit && same(shown.last, theirs) && !back.visit && back.rank === 1 && (stub('setAvatar') || shown.seen?.visible),
      `visit ${JSON.stringify(shown.last)} vs snapshot ${JSON.stringify(theirs)}; home ${JSON.stringify(back)}; world ${JSON.stringify(shown.seen)}${stub('setAvatar')}`);

    // C3 (phone): frame JS here at ?q=low; draw calls and triangles below at full quality
    if (v.name === 'phone') low = await perf(page);

    const bad = [...b4a.bad, ...b4b.bad.map(x => 'jobs sheet: ' + x), ...b4c.bad.map(x => 'visit: ' + x)];
    check(v.name, 'B4 layout: no overlaps', bad.length === 0, bad.join('; ') || `checked ${[...new Set([...b4a.seen, ...b4b.seen, ...b4c.seen])].join(' ')}`);
  } catch (e) {
    // the first lines of a Playwright error carry the call log (e.g. which element intercepts the click)
    check(v.name, 'run', false, `${String(e.message).split('\n').slice(0, 5).join(' / ')}; bot: ${botLog.slice(-6).join(' · ')}`);
    await shot(page, `${v.name}-x-failure`);
  }
  check(v.name, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// C3: a phone at full quality (no ?q=low): a new game's town, then the world's draw calls and triangles
{
  const v = VIEWS.find(x => x.name === 'phone');
  const ctx = await browser.newContext({ viewport: v.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(FULL);
    await page.waitForSelector('#inName', { timeout: 120000 });
    await page.click('#card [data-opt="go"]');
    await page.waitForFunction(() => window.__btm?.life && __btm.mode === 'town', null, { timeout: 60000 });
    const full = await perf(page, 8); // software GL is slow at full quality; draw calls and triangles are per frame
    await shot(page, 'phone-9-full-quality');
    const ok = low && low.ms <= BUDGET.ms && full.calls <= BUDGET.calls && full.triangles <= BUDGET.triangles;
    check('phone', 'C3 phone perf (JS ≤ 8 ms, ≤ 150 draw calls, ≤ 60k triangles)', ok,
      `q=low: ${low ? perfNote(low) : 'not measured'}; full quality: ${perfNote(full)}`);
  } catch (e) {
    check('phone', 'C3 phone perf', false, String(e.message).split('\n')[0]);
  }
  await ctx.close();
}
await browser.close();

const table = ['| view | check | result | notes |', '|---|---|---|---|', ...results.map(r => `| ${r.view} | ${r.id} | ${r.ok ? '✅' : '❌'} | ${r.note.replace(/\|/g, '/')} |`)].join('\n');
console.log(table);
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Acceptance run (0.2)\n\n${table}\n\nScreenshots: the qa-screenshots artifact.\n`);
process.exit(results.every(r => r.ok) ? 0 : 1);
