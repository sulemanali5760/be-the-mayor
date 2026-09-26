// Automated acceptance run (GitHub Actions): headless Chrome plays the first 15 minutes at desktop,
// small-window and phone sizes, checks B1–B4 of build 0.1 and saves screenshots to qa/out/.
//   node qa/acceptance.mjs http://localhost:8080/
// Offline mode (?offline=1): CI never talks to the live Supabase project. Time is the game clock (LESSONS T6).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:8080/') + '?q=low&offline=1';
const OUT = 'qa/out';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'small', viewport: { width: 640, height: 400 } },
  { name: 'phone', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const results = [];
const check = (view, id, ok, note) => results.push({ view, id, ok: !!ok, note: String(note) });
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
    rank: l.rank, mode: b.mode, t: +b.clock.t.toFixed(1), ...b.stats(), visits: b.meta.visits, hook: b.meta.hook,
    card: !document.getElementById('modal').hidden, promoCard: document.getElementById('card').classList.contains('promo'),
    cardOpts: [...document.querySelectorAll('#card [data-opt]')].map(x => ({ id: x.dataset.opt, disabled: x.disabled })),
    offers: L.offers().map(o => ({ id: o.id, energy: o.energy ?? 0, task: o.task, quick: !!o.quick })),
    problems: L.problems().map(p => ({ id: p.id, options: p.options.map(o => ({ id: o.id, money: o.effects?.money || 0, rep: o.effects?.rep || 0 })) })),
    upgrades: L.upgrades().map(u => ({ id: u.id, status: u.status, cost: u.cost ?? 0, endsAt: u.endsAt ?? 0, repeat: !!u.repeat })),
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
// B1 bot: plays through the real UI with sane choices until the ladder says Skilled
async function playToSkilled(page, v) {
  const log = botLog, tried = {};
  log.length = 0;
  let want = null, promo = null, downloaded = '';
  for (let step = 0; step < 160; step++) {
    const s = await page.evaluate(snapshotState);
    if (s.rank >= 1 && promo && !s.card) return { ok: true, s, log, promo, downloaded };
    let did;
    if (s.card) {
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
      did = 'task finished';
    } else if (s.mode === 'visit') {
      await goHome(page);
      did = 'home';
    } else {
      // courses and tools when affordable; a repeatable (the bridge fund) once, so money still goes to the courses
      const up = s.upgrades.find(u => u.status === 'available' && u.cost <= s.money && !(u.repeat && log.includes(`upgrade ${u.id}`)));
      const running = s.upgrades.find(u => u.status === 'running');
      // rotate job kinds so both verbs get played
      const offers = s.offers.filter(o => o.energy <= s.energy);
      const last = log.filter(l => l.startsWith('job ')).pop();
      const offer = offers.find(o => !last || !last.endsWith(o.task)) || offers[0];
      // a sane player takes a problem once they can afford an option that helps (rep up), and gives up after 2 tries
      const prob = s.problems.filter(p => (tried[p.id] || 0) < 2)
        .map(p => ({ p, o: p.options.filter(o => s.money + o.money >= 0 && o.rep > 0).sort((a, b) => b.rep - a.rep)[0] })).find(x => x.o);
      if (up) {
        await openPanel(page, 'upgrades');
        await page.click(`#sheetBody [data-upgrade="${up.id}"]`);
        did = `upgrade ${up.id}`;
      } else if (running && !s.visits) {
        await visitFirst(page);
        await shot(page, `${v}-6-visit`);
        await page.click('[data-visit="like"]');
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
          log.push(`quick ${offer.task}`);
          await page.waitForTimeout(350);
          continue;
        }
        if (!log.some(l => l.startsWith('job '))) await shot(page, `${v}-3-jobs`);
        await page.click(`#sheetBody [data-job="${offer.id}"]`);
        await page.waitForTimeout(300);
        if (!log.some(l => l.startsWith('job '))) await shot(page, `${v}-4-task`);
        did = `job ${offer.task}`;
      } else if (running) {
        await page.evaluate(sec => __btm.advance(sec), running.endsAt - s.t + 0.5);
        did = `wait ${Math.round(running.endsAt - s.t)} s for ${running.id}`;
      } else if (s.rank >= 1) {
        did = 'waiting for the promotion card';
      } else {
        await page.click('#dock [data-act="sleep"]');
        did = 'sleep';
      }
    }
    log.push(did);
    await page.waitForTimeout(350);
  }
  return { ok: false, s: await page.evaluate(snapshotState), log, promo, downloaded };
}

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
    check(v.name, 'B2 first-person tasks ≤ 90 s game time', tasks.length >= 2 && kinds.size >= 2 && tasks.every(t => t.game <= 90 && t.seconds <= 90),
      tasks.map(t => `${t.kind} ${t.game}s/${t.seconds}s`).join(', ') || 'no tasks played');
    await page.click('#ladder');
    await page.waitForTimeout(200);
    await shot(page, `${v.name}-7-ladder`);
    await page.click('#sheetClose');

    // B3: offline visit, like (and the once-per-day rule), sign, help, home
    const id = await visitFirst(page, 1);
    const b4c = await page.evaluate(layout, ['#top', '#visitbar', '#toasts .toast']);
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
await browser.close();

const table = ['| view | check | result | notes |', '|---|---|---|---|', ...results.map(r => `| ${r.view} | ${r.id} | ${r.ok ? '✅' : '❌'} | ${r.note.replace(/\|/g, '/')} |`)].join('\n');
console.log(table);
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Acceptance run (0.1)\n\n${table}\n\nScreenshots: the qa-screenshots artifact.\n`);
process.exit(results.every(r => r.ok) ? 0 : 1);
