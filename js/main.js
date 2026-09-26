// Be the Mayor: the game shell. One game clock (LESSONS T6), the local save, the main loop and the flow of
// the first 15 minutes (GAMES §5.1). Rules live in js/rules/, the 3D world in js/world/, online in js/net/.
// The release version lives once, in index.html's <script src="js/main.js?v=…">; every file gets the same ?v=.
const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const Q = new URLSearchParams(location.search);
const imp = p => import(`${p}?v=${V}`);
const $ = id => document.getElementById(id);

const [{ createLife }, { newSave, migrate }, { createWorld }, ui, { drawPromo, downloadPng }, { net }, config] = await Promise.all([
  imp('./rules/life.js'), imp('./rules/save.js'), imp('./world/world.js'), imp('./ui/ui.js'), imp('./ui/promo.js'), imp('./net/net.js'), imp('./net/config.js'),
]);
const { esc, chips, toast, card } = ui;

const FILES = ['jobs', 'people', 'problems', 'events', 'upgrades', 'ranks', 'signs', 'town'];
const content = Object.fromEntries(await Promise.all(FILES.map(async f => [f, await fetch(`data/${f}.json?v=${V}`).then(r => r.json())])));

// ---- the one game clock: seconds of play, advancing only while the game runs and the tab is visible ----------
const clock = { t: 0, speed: 1, running: false };
const qa = { tasks: [], quick: [], visits: [], promo: null }; // evidence for qa/acceptance.mjs

// ---- local save: { v, t, meta, save }; life.state is the rules' save object, meta is the shell's own ---------
const KEY = 'btm.save.v1';
const META = { jobs: 0, choices: 0, visits: 0, paper: [], hook: '', seenAt: 0, title: '' };
let life, meta, mode = 'town', visiting = null, shownEvent = null;
function loadSaved() {
  try { const w = JSON.parse(localStorage.getItem(KEY)); if (w && w.save) return w; } catch { /* no save or unreadable: new game */ }
  return null;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, t: clock.t, meta, save: life.state })); } catch { /* storage full or blocked */ }
}

const world = createWorld($('view'), content);
if (Q.has('reset')) localStorage.removeItem(KEY);
await net.init(Q.has('offline') ? null : config.default);
$('boot').hidden = true;

const saved = loadSaved();
if (saved) {
  clock.t = +saved.t || 0;
  meta = { ...META, ...saved.meta };
  life = createLife(content, migrate(saved.save));
} else {
  const { name, town } = await intro();
  meta = { ...META, seenAt: Date.now() };
  life = createLife(content, newSave(name, town));
}
meta.title ||= life.ladder().title;
world.showTown(life.state);
world.onPick(pick);
clock.running = true;
refresh();
persist();
if (saved) whileAway();

// ---- helpers over the rules' state -----------------------------------------------------------------------------
function stats() {
  const s = life.state;
  return { money: s.money ?? 0, rep: s.rep ?? 0, slots: s.slots ?? 0, maxSlots: 3, day: s.day ?? 1 }; // 3 action slots a day (contract change 4)
}
const person = id => content.people?.find?.(p => p.id === id) || { name: id };
const skillName = k => content.upgrades.find(u => u.gives === k)?.title || k;
const upgradeEffects = u => content.upgrades.find(x => x.id === u.id)?.effects || {}; // a repeatable's instant payout
// why an option can't be taken right now (shown on the card, the button is disabled); mirrors life.choose's checks
function blocked(o) {
  const s = life.state, e = o.effects || {};
  if (o.needs && !(s.skills?.[o.needs] > 0)) return `Needs ${skillName(o.needs)}`;
  if (s.money + (e.money ?? 0) < 0) return 'Not enough money';
  if (life.state.slots + (e.energy ?? 0) < 0) return 'No time left today';
  return '';
}
const optionCard = o => { const why = blocked(o); return { id: o.id, disabled: !!why, html: `${esc(o.label)}${chips(o.effects, { later: o.later })}${why ? `<span class="status">${esc(why)}</span>` : ''}` }; };
const whoLine = id => { const p = person(id); return `<div class="who">${esc(p.name)}${p.line ? ` · “${esc(p.line)}”` : ''}</div>`; };
const newsItem = x => typeof x === 'string' ? { title: x } : { title: x.headline || x.title || x.text || '', text: x.headline || x.title ? x.text || x.body || '' : '' };
function addNews(list = []) {
  const items = list.map(newsItem).filter(n => n.title);
  meta.paper = [...items.reverse(), ...meta.paper].slice(0, 12);
  return items;
}

// ---- intro: name yourself and the town (2 taps, suggestions prefilled) -------------------------------------------
async function intro() {
  const names = ['Sam', 'Alex', 'Jo', 'Robin', 'Kim', 'Charlie', 'Ayla', 'Noor', 'Mika'];
  const ok = s => /^[\p{L}\p{N} .'-]{2,24}$/u.test(s) && !/(nazi|hitler|fuck|shit|cunt|nigg|faggot|rape)/i.test(s);
  let name = names[Math.floor(Math.random() * names.length)], town = 'Brookfield';
  await card({
    html: `<div class="eyebrow">A new life</div><h1>Be the Mayor</h1>
      <p>You're 19. <b id="introTown">Brookfield</b> has 212 people, a broken bridge, and a mayor nobody likes.</p>
      <label>Your name<input id="inName" maxlength="24" value="${esc(name)}" autocomplete="off"></label>
      <label>Your town<input id="inTown" maxlength="24" value="${esc(town)}" autocomplete="off"></label><p class="err"></p>`,
    options: [{ id: 'go', go: true, html: 'Start' }],
    onShow: el => { el.querySelector('#inTown').oninput = e => { el.querySelector('#introTown').textContent = e.target.value || 'Your town'; }; },
    act: (_, el) => {
      name = el.querySelector('#inName').value.trim();
      town = el.querySelector('#inTown').value.trim();
      if (ok(name) && ok(town)) return false;
      el.querySelector('.err').textContent = '2–24 letters, numbers, spaces, dots, dashes or apostrophes, and nothing rude.';
      return true;
    },
  });
  return { name, town };
}

// ---- HUD ------------------------------------------------------------------------------------------------------
function guide() {
  const s = stats(), up = life.upgrades();
  if (s.slots <= 0) return '🌙 Day done: <b>Sleep</b> → tomorrow\'s newspaper'; // the main call to action at 0 slots
  if (meta.hook) return `🎯 ${esc(meta.hook)}`;
  if (!meta.jobs) return '👉 Pick a job from the <b>Jobs</b> board';
  if (!meta.choices && life.problems().length) return '👉 Someone needs you: tap a speech bubble';
  if (!up.some(u => u.status === 'running' || u.status === 'done') && up.some(u => u.status === 'available' && u.kind === 'course')) return '👉 Invest in yourself: open <b>Learn</b>';
  if (up.some(u => u.status === 'running') && life.state.studiedDay !== s.day) return '👉 Your course: <b>Learn</b> → study tonight';
  if (!meta.visits && up.some(u => u.status === 'running')) return '👉 <b>Visit</b> a neighbour to see where you\'re heading';
  return '';
}
function refresh() {
  ui.renderStats(stats());
  document.querySelector('#dock [data-act="sleep"]').classList.toggle('due', stats().slots <= 0);
  ui.renderLadder(life.ladder());
  ui.setGoal(guide());
  ui.setBadge('jobs', life.offers().length && !meta.jobs ? life.offers().length : 0);
  ui.setBadge('problems', life.problems().length);
  ui.setBadge('upgrades', life.upgrades().filter(u => u.status === 'available' && !u.repeat).length); // the always-open bridge fund is no news
  document.documentElement.style.setProperty('--topH', $('top').offsetHeight + 'px');
  if (ui.sheet.panel && ui.sheet.panel !== 'visit') panel(ui.sheet.panel);
}

// ---- panels -----------------------------------------------------------------------------------------------------
function panel(name) {
  const s = stats();
  if (name === 'jobs') {
    const html = life.offers().map(o => `<div class="item"><h3>${esc(o.title)}</h3>${whoLine(o.who)}
      ${o.twist ? `<p>Twist: ${esc(typeof o.twist === 'string' ? o.twist : o.twist.label || o.twist.id)}</p>` : ''}
      ${chips({ money: o.pay }, { energy: o.energy })}
      ${o.energy > s.slots ? '<button class="go" disabled>No time left today: sleep</button>'
        : o.quick ? `<div class="row"><button class="go" data-job="${esc(o.id)}">Do it (first person)</button><button class="opt" data-quick="${esc(o.id)}">Quick shift · 80%${chips({ money: Math.round(o.pay * 0.8) })}</button></div>`
        : `<button class="go" data-job="${esc(o.id)}">${o.task === 'delivery' ? 'Plan the route' : 'Start the job'}</button>`}</div>`).join('');
    ui.openSheet('jobs', 'Job board', html || '<p class="muted">No offers right now. New ones come tomorrow.</p>');
  } else if (name === 'problems') {
    const html = life.problems().map(p => `<div class="item"><h3>${esc(p.title)}</h3>${whoLine(p.who)}
      <button class="opt" data-problem="${esc(p.id)}">Hear them out</button></div>`).join('');
    ui.openSheet('problems', 'Town problems', html || '<p class="muted">Nobody needs you right now. Enjoy it while it lasts.</p>');
  } else if (name === 'upgrades') {
    // contract change 4: `buy` items are instant; a `course` is enrolled once, then studied one evening a day (1 slot)
    const studied = life.state.studiedDay === s.day;
    const html = life.upgrades().map(u => {
      const course = u.kind === 'course';
      const status = u.status === 'running' ? `Enrolled · evening ${u.studied}/${u.evenings}`
        : u.status === 'done' ? '✅ Yours'
        : u.status === 'locked' ? `🔒 ${u.needs && !(life.state.skills?.[u.needs] > 0) ? `Needs ${esc(skillName(u.needs))}` : `Unlocks at ${esc(content.ranks.find(r => r.rank === u.rank)?.title || 'a later rank')}`}`
        : u.repeat ? 'Any time, as often as you like' : course ? `${u.evenings} evenings of study, one a day` : 'Yours at once';
      const act = u.status === 'running'
        ? `${chips({ energy: -1 })}<button class="go" data-study="${esc(u.id)}" ${studied || s.slots < 1 ? 'disabled' : ''}>${studied ? 'Studied tonight already' : s.slots < 1 ? 'No time left today' : `Study tonight (evening ${u.studied + 1}/${u.evenings})`}</button>`
        : u.status === 'available'
          ? `${chips({ money: -u.cost, ...upgradeEffects(u) })}<button class="go" data-upgrade="${esc(u.id)}" ${u.cost > s.money ? 'disabled' : ''}>${u.cost > s.money ? `Need €${esc(u.cost)}` : u.repeat ? `Pay €${esc(u.cost)}` : course ? `Enrol · €${esc(u.cost)}` : `Buy · €${esc(u.cost)}`}</button>`
          : '';
      return `<div class="item"><h3>${esc(u.title)}</h3>${u.text && u.status !== 'done' ? `<p>${esc(u.text)}</p>` : ''}<div class="status">${status}</div>${act}</div>`;
    }).join('');
    ui.openSheet('upgrades', 'Invest in yourself', html || '<p class="muted">Nothing to learn yet.</p>');
  } else if (name === 'ladder') {
    const l = life.ladder(), ranks = content.ranks || [];
    const html = `<ol class="ranks">${ranks.map((r, i) => `<li class="${i < l.rank ? 'done' : i === l.rank ? 'me' : ''}">${i < l.rank ? '✓' : i + 1}. ${esc(r.title)}</li>`).join('')}</ol>
      ${l.next ? `<div class="eyebrow">To become ${esc(l.next.title)}</div><ul class="check">${l.next.checklist.map(c => `<li class="${c.done ? 'done' : ''}">${esc(c.label)}</li>`).join('')}</ul>` : ''}
      <button class="linkish" data-act="restart">Start a new life</button>`;
    ui.openSheet('ladder', 'Career ladder', html);
  } else if (name === 'visit') {
    ui.openSheet('visit', 'Visit a town', '<p class="muted">Looking for neighbours…</p>');
    net.listTowns({ limit: 12 }).then(list => {
      if (ui.sheet.panel !== 'visit') return;
      ui.openSheet('visit', 'Visit a town', list.map(t => `<div class="item"><h3>${esc(t.town)}</h3>
        <div class="who">${esc(t.title)} ${esc(t.mayor)} · ❤️ ${esc(t.likes)}${t.curated ? ' · featured' : ''}</div>
        <button class="opt" data-town="${esc(t.id)}">Visit ${esc(t.town)}</button></div>`).join('') || '<p class="muted">No towns found.</p>');
    });
  } else if (name === 'paper') {
    ui.closeSheet();
    paper(meta.paper.slice(0, 6), 'The latest');
  }
}

// ---- actions ----------------------------------------------------------------------------------------------------
function applyResult(r, who) {
  if (!r.ok) { toast(esc(r.msg || 'Not possible right now')); return false; }
  const items = addNews(r.news);
  const said = person(who);
  toast(`${chips(r.effects)}${items[0] ? `<div><b>${esc(said.name || 'Brookfield')}:</b> ${esc(items[0].title)}</div>` : ''}${r.msg ? `<div>${esc(r.msg)}</div>` : ''}`);
  if (r.effects?.fix) { world.showTown(life.state); world.focus(r.effects.fix); }
  return true;
}

async function doJob(id) {
  const o = life.offers().find(x => x.id === id);
  if (!o || mode !== 'town') return;
  ui.closeSheet();
  mode = 'task';
  document.body.classList.add('task');
  const t0 = clock.t;
  let result;
  try { result = await world.playTask(o.task, o.params); } // params.twist is the twist id; o.twist is its text
  finally { document.body.classList.remove('task'); mode = 'town'; }
  qa.tasks.push({ kind: o.task, game: +(clock.t - t0).toFixed(2), seconds: result.seconds, stars: result.stars });
  world.showTown(life.state);
  if (applyResult(life.doJob(o.id, result, clock.t), o.who)) meta.jobs++;
  after();
}

// a task you have mastered (≥ 2 stars) can be done as a quick shift: 80% pay, no first-person time (contract change 2)
function quickShift(id) {
  const o = life.offers().find(x => x.id === id);
  if (!o || mode !== 'town') return;
  ui.closeSheet();
  qa.quick.push(o.task);
  world.showTown(life.state);
  if (applyResult(life.doJob(o.id, { quick: true }, clock.t), o.who)) meta.jobs++;
  after();
}

async function openProblem(id) {
  const p = life.problems().find(x => x.id === id);
  if (!p || mode !== 'town') return;
  ui.closeSheet();
  if (p.at) world.focus(p.at);
  const opt = await card({
    html: `<div class="eyebrow">Town problem</div><h2>${esc(p.title)}</h2>${whoLine(p.who)}${p.text ? `<p>${esc(p.text)}</p>` : ''}`,
    options: [...p.options.map(optionCard), { id: '', html: 'Not now' }],
  });
  if (!opt) return;
  if (applyResult(life.choose(p.id, opt, clock.t), p.who)) meta.choices++;
  after();
}

async function showEvent(ev) {
  shownEvent = ev.id;
  const opt = await card({
    html: `<div class="eyebrow">Something happened</div>${whoLine(ev.who)}<h2>${esc(ev.title || ev.text)}</h2>${ev.title && ev.text ? `<p>${esc(ev.text)}</p>` : ''}`,
    options: ev.options.map(optionCard),
  });
  if (applyResult(life.choose(ev.id, opt, clock.t), ev.who)) meta.choices++;
  shownEvent = null;
  after();
}

function startUpgrade(id) {
  const r = life.startUpgrade(id, clock.t);
  const u = life.upgrades().find(x => x.id === id);
  if (!r.ok) toast(esc(r.msg || 'Not possible right now'));
  else if (u?.repeat) toast(`${chips({ money: -u.cost, ...upgradeEffects(u) })}${r.msg ? `<div>${esc(r.msg)}</div>` : ''}`); // pays out at once
  else if (u?.kind === 'course') toast(`🎓 Enrolled: <b>${esc(u.title)}</b>. Study one evening a day.${r.msg ? `<div>${esc(r.msg)}</div>` : ''}`);
  else if (r.msg) toast(esc(r.msg)); // a bought thing announces itself through tick's upgradeDone
  after();
}

// one evening of a course: 1 slot, at most one a day (contract change 4)
function study(id) {
  const r = life.study(id, clock.t);
  if (!r.ok) toast(esc(r.msg || 'Not possible right now'));
  else if (r.msg) toast(`📚 ${esc(r.msg)}`);
  after();
}

async function sleep() {
  if (mode !== 'town') return;
  ui.closeSheet();
  const r = life.endDay(clock.t);
  const items = addNews(r.news);
  const got = await net.inbox(meta.seenAt);
  meta.seenAt = Date.now();
  net.saveTown(life.snapshot()).then(s => { if (!s.ok && !/too often/i.test(s.msg)) toast(esc(s.msg)); });
  after();
  paper([...visitorNews(got), ...items], `Day ${stats().day}`);
}

function visitorNews(got) {
  const out = [];
  if (got.likes) out.push({ title: `${got.likes} visitor${got.likes > 1 ? 's' : ''} liked your town`, text: 'Word gets around.' });
  if (got.helps) out.push({ title: `Neighbours helped with ${got.helps} of your problems`, text: '' });
  for (const s of got.signs.slice(0, 3)) out.push({ title: `A visitor left a sign: “${signText(s.phrase)}”`, text: '' });
  return out;
}
const signText = i => { const s = content.signs?.[i]; return typeof s === 'string' ? s : s?.text || s?.label || '…'; };

async function whileAway() {
  const got = await net.inbox(meta.seenAt);
  meta.seenAt = Date.now();
  const items = [...visitorNews(got), ...meta.paper.slice(0, 3)];
  if (items.length) paper(items, 'While you were away');
}

function paper(items, dateline) {
  const town = life.snapshot().town || 'Brookfield';
  return card({
    cls: 'paper',
    html: `<div class="mast">The ${esc(town)} Chronicle</div><div class="dateline">${esc(dateline)} · day ${esc(stats().day)}</div>` +
      (items.length ? items.map(n => `<h3>${esc(n.title)}</h3>${n.text ? `<p>${esc(n.text)}</p>` : ''}`).join('') : '<p>A quiet day in town. Suspiciously quiet.</p>'),
    options: [{ id: 'ok', go: true, html: 'Back to town' }],
  });
}

async function promotion(e) {
  const l = life.ladder(), s = stats(), snap = life.snapshot();
  const d = { name: snap.mayor, town: snap.town, day: s.day, money: Math.round(s.money), rep: s.rep, jobs: meta.jobs,
    from: meta.title || 'Labourer', to: e.title || l.title, moment: meta.paper.find(n => n.title.length < 90)?.title || '' };
  meta.title = d.to;
  const cv = document.createElement('canvas');
  drawPromo(cv, d);
  qa.promo = cv;
  await card({
    cls: 'promo',
    html: `<div class="eyebrow">Promotion</div><h2>You are now ${esc(d.to)}!</h2>${e.text ? `<p>${esc(e.text)}</p>` : ''}`,
    onShow: el => el.prepend(cv),
    options: [{ id: 'save', go: true, html: '📸 Save the card' }, { id: 'ok', html: 'Back to work' }],
    act: id => { if (id === 'save') { downloadPng(cv, `be-the-mayor-${d.to.toLowerCase().replace(/\W+/g, '-')}.png`); return true; } return false; },
  });
}

// visits: a read-only view of another town; likes, signs and help are counted by the server
async function visit(id) {
  const t = await net.getTown(id);
  if (!t) { toast('That town could not be found'); return; }
  ui.closeSheet();
  visiting = { id, ...t };
  mode = 'visit';
  meta.visits++;
  document.body.classList.add('visiting');
  $('visitbar').hidden = false;
  $('dock').hidden = true;
  $('visitName').textContent = `${t.snapshot.town} · ${t.snapshot.title} ${t.snapshot.mayor}`;
  document.documentElement.style.setProperty('--barH', $('visitbar').offsetHeight + 'px'); // toasts sit above the taller visit bar
  for (const b of document.querySelectorAll('[data-visit]')) b.disabled = false;
  world.showTown(t.snapshot);
  toast(`❤️ ${esc(t.likes)} likes · 🤝 ${esc(t.helps)} helps${t.signs[0] ? `<div>A sign here: “${esc(signText(t.signs[0].phrase))}”</div>` : ''}`);
  persist();
}

async function visitAct(kind, btn) {
  if (kind === 'home') {
    mode = 'town'; visiting = null;
    document.body.classList.remove('visiting');
    $('visitbar').hidden = true;
    $('dock').hidden = false;
    document.documentElement.style.removeProperty('--barH');
    world.showTown(life.state);
    refresh();
    return;
  }
  const v = visiting;
  let r;
  if (kind === 'like') r = await net.like(v.id);
  else if (kind === 'sign') {
    const signs = content.signs || [];
    const pickI = await card({ html: '<div class="eyebrow">Leave a sign</div><h2>What should it say?</h2>',
      options: [...signs.map((s, i) => ({ id: String(i), html: esc(signText(i)) })), { id: '', html: 'Cancel' }] });
    if (!pickI) return;
    r = await net.sign(v.id, +pickI);
  } else if (kind === 'help') {
    if (!v.snapshot.posted.length) { toast(`${esc(v.snapshot.mayor)} has not posted any problems`); return; }
    const pid = await card({ html: '<div class="eyebrow">Lend a hand</div><h2>Which problem?</h2>',
      options: [...v.snapshot.posted.map(p => ({ id: p.id, html: esc(p.title) })), { id: '', html: 'Cancel' }] });
    if (!pid) return;
    r = await net.help(v.id, pid);
  }
  qa.visits.push({ kind, ok: r.ok, msg: r.msg });
  if (r.ok) { btn.disabled = true; toast({ like: '❤️ Liked!', sign: '🪧 Your sign is up', help: '🤝 Thanks for helping!' }[kind]); }
  else toast(esc(r.msg));
}

function pick({ id }) {
  if (mode !== 'town' || ui.cardOpen()) return;
  const p = life.problems().find(x => x.at === id || x.who === id);
  if (p) openProblem(p.id);
}

function after() {
  refresh();
  persist();
}

async function restart() {
  const ok = await card({ html: '<h2>Start a new life?</h2><p>Your town and progress on this device are replaced.</p>',
    options: [{ id: 'yes', html: 'Yes, start over' }, { id: '', html: 'Keep playing' }] });
  if (ok) { localStorage.removeItem(KEY); location.reload(); }
}

// ---- input ------------------------------------------------------------------------------------------------------
$('dock').onclick = e => {
  const b = e.target.closest('button');
  if (!b || mode !== 'town') return;
  if (b.dataset.act === 'sleep') return sleep();
  if (ui.sheet.panel === b.dataset.panel) return ui.closeSheet();
  panel(b.dataset.panel);
};
$('ladder').onclick = () => (ui.sheet.panel === 'ladder' ? ui.closeSheet() : panel('ladder'));
$('sheetClose').onclick = ui.closeSheet;
$('sheetBody').onclick = e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.job) doJob(b.dataset.job);
  else if (b.dataset.quick) quickShift(b.dataset.quick);
  else if (b.dataset.problem) openProblem(b.dataset.problem);
  else if (b.dataset.upgrade) startUpgrade(b.dataset.upgrade);
  else if (b.dataset.study) study(b.dataset.study);
  else if (b.dataset.town) visit(b.dataset.town);
  else if (b.dataset.act === 'restart') restart();
};
$('visitbar').onclick = e => { const b = e.target.closest('[data-visit]'); if (b && !b.disabled) visitAct(b.dataset.visit, b); };
addEventListener('resize', () => document.documentElement.style.setProperty('--topH', $('top').offsetHeight + 'px'));
// session end: keep the local save and upload the town snapshot (the server takes one a minute)
addEventListener('visibilitychange', () => { if (document.hidden) { persist(); net.saveTown(life.snapshot()); } });
addEventListener('pagehide', persist);

// ---- main loop ----------------------------------------------------------------------------------------------------
let last = performance.now(), sinceSave = 0;
function handle(events) {
  for (const e of events || []) {
    if (e.type === 'upgradeDone') toast(`✅ <b>${esc(e.title || 'Course')}</b> is yours!${e.text ? `<div>${esc(e.text)}</div>` : ''}`);
    else if (e.type === 'promotion') promotion(e);
    else if (e.type === 'consequence') {
      const items = addNews(e.news || (e.text ? [e.text] : []));
      card({ html: `<div class="eyebrow">Remember this?</div>${e.who ? whoLine(e.who) : ''}<h2>${esc(items[0]?.title || e.text || 'Your past caught up with you')}</h2>${chips(e.effects)}`,
        options: [{ id: 'ok', go: true, html: 'Fair enough' }] });
    } else if (e.type === 'newOffers') ui.setBadge('jobs', life.offers().length);
    else if (e.type === 'hook') meta.hook = e.text || e.title || meta.hook;
  }
  if (events?.length) after();
}
function frame(now) {
  // real frame time only paces the clock; everything else reads clock.t (LESSONS T6)
  const real = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const dt = clock.running && !document.hidden ? real * clock.speed : 0;
  clock.t += dt;
  world.frame(dt);
  if (mode !== 'task') {
    handle(life.tick(clock.t));
    const ev = mode === 'town' && !ui.cardOpen() && !shownEvent ? life.pendingEvent() : null;
    if (ev) showEvent(ev);
    ui.bubbles(mode === 'town' ? life.problems().map(p => ({ id: p.at || p.who, key: p.id, text: p.title })) : [], world.anchors(), openProblem);
  }
  if ((sinceSave += dt) > 10) { sinceSave = 0; persist(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- QA hooks (qa/acceptance.mjs): the game clock, not real time ------------------------------------------------
window.__btm = {
  V, clock, content, world, net, qa, get life() { return life; }, get mode() { return mode; }, get meta() { return meta; }, stats,
  advance(sec) { clock.t += sec; handle(life.tick(clock.t)); }, // skip ahead in game time, e.g. to finish a course
};
