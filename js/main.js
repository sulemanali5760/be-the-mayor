// Be the Mayor: the game shell. One game clock (LESSONS T6), the local save, the main loop and the flow of
// the first 15 minutes (GAMES §5.1). Rules live in js/rules/, the 3D world in js/world/, online in js/net/.
// The release version lives once, in index.html's <script src="js/main.js?v=…">; every file gets the same ?v=.
const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const Q = new URLSearchParams(location.search);
const imp = p => import(`${p}?v=${V}`);
const $ = id => document.getElementById(id);

const [{ createLife, CONTENT }, { newSave, migrate, pickSave, encodeSave, decodeSave }, { createWorld }, ui, { drawPromo, downloadPng }, { net }, config] = await Promise.all([
  imp('./rules/life.js'), imp('./rules/save.js'), imp('./world/world.js'), imp('./ui/ui.js'), imp('./ui/promo.js'), imp('./net/net.js'), imp('./net/config.js'),
]);
const { esc, chips, toast, card } = ui;

const content = Object.fromEntries(await Promise.all(CONTENT.map(async f => [f, await fetch(`data/${f}.json?v=${V}`).then(r => r.json())])));

// ---- the one game clock: seconds of play, advancing only while the game runs and the tab is visible ----------
const clock = { t: 0, speed: 1, running: false };
const qa = { tasks: [], quick: [], visits: [], promo: null, tod: [], avatar: [], walks: [], ms: [], choice: [], cloud: [] }; // evidence for qa/acceptance.mjs

// ---- local save: { v, t, meta, save, synced }; life.state is the rules' save object, meta is the shell's own ---------
// synced (0.2.2) = { id, t }: the user and the cloud play_t this device last wrote or loaded (js/rules/save.js pickSave)
const KEY = 'btm.save.v1';
const BAK = 'btm.save.bak'; // the save a choice card, an import or a new life replaced, kept just in case
const FRESH = 'btm.fresh';  // "Start a new life" until the new one is saved: the cloud's old life must not come back
let synced = null, leaving = false; // leaving: a reload is replacing the save, so nothing may write the old one back
// cloud sync state (see "cloud save" below): checked = this session has compared the cloud save with ours
let cloudChecked = false, cloudDirty = false, cloudBusy = false, cloudTry = 0, cloudAt = 0, cloudMsg = '', sinceCloud = 0;
// ponytail: real time between cloud writes, not the game clock, because the limit is the server's; a fixed 21 s gap, no backoff
const CLOUD_GAP = 21000;
const rankTitle = n => content.ranks.find(r => r.rank === n)?.title || 'Labourer';
const saveLine = w => { const s = migrate(w?.save); return `Day ${s.day} · ${rankTitle(s.rank)} · €${Math.round(s.money)}`; };
const fromCloud = c => ({ ...c.save, synced: { id: net.account().id, t: c.play_t } });
const META = { jobs: 0, choices: 0, visits: 0, paper: [], hook: '', seenAt: 0, title: '' };
const TOD = [0.75, 0.55, 0.3, 0]; // time of day by slots left 3/2/1/0 (morning … evening); sleeping is night (1)
const WALK = 3;                   // the walk before an action: at most 3 s of game time
let life, meta, mode = 'town', visiting = null, shownEvent = null, night = false, tod = null;
function loadSaved() {
  try { const w = JSON.parse(localStorage.getItem(KEY)); if (w && w.save) return w; } catch { /* no save or unreadable: new game */ }
  return null;
}
const wrap = () => ({ v: 1, t: clock.t, meta, save: life.state, synced });
function persist() {
  if (leaving) return;
  try { localStorage.setItem(KEY, JSON.stringify(wrap())); } catch { /* storage full or blocked */ }
}
function keep(w) { try { if (w) localStorage.setItem(BAK, JSON.stringify(w)); } catch { /* best effort */ } }
// replaces the local save and reloads (a choice card mid-game, an import): the load path runs everything through migrate
function replaceWith(w) {
  keep(wrap());
  try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { toast('This browser blocks saving, so that did not work'); return; }
  leaving = true;
  location.reload();
}

const world = createWorld($('view'), content);
// every town shares data/town.json's roads, paths, props, homes and work; buildings come from the state or snapshot
const { buildings: _, ...layout } = content.town;
const draw = s => world.showTown({ ...s, ...layout });
if (Q.has('reset')) localStorage.removeItem(KEY);
await net.init(Q.has('offline') ? null : config.default);

// build 0.2.2: the cloud copy may be newer (another device, a cleared browser); pickSave decides, a card asks on a real conflict
let saved = loadSaved();
const cloud = await cloudRead();
$('boot').hidden = true;
const fresh = (() => { try { return !!localStorage.getItem(FRESH); } catch { return false; } })();
if (cloud && !fresh) {
  let use = pickSave(saved, cloud, net.account().id);
  if (use === 'ask') { draw(content.town); use = await chooseSave(saved, cloud); }
  if (use === 'cloud') { keep(saved); saved = fromCloud(cloud); }
}
synced = saved?.synced ?? null;
if (saved) {
  clock.t = +saved.t || 0;
  meta = { ...META, ...saved.meta };
  for (const k in META) if (typeof meta[k] !== typeof META[k] || Array.isArray(meta[k]) !== Array.isArray(META[k])) meta[k] = META[k]; // imported codes
  life = createLife(content, migrate(saved.save));
} else {
  draw(content.town); // the town behind the character creator
  const { name, town, look } = await intro();
  meta = { ...META, seenAt: Date.now() };
  life = createLife(content, newSave(name, town, look));
}
meta.title ||= life.ladder().title;
draw(life.state);
dress();
world.onPick(pick);
clock.running = true;
refresh();
persist();
if (fresh) try { localStorage.removeItem(FRESH); } catch { /* blocked */ }
cloudDirty = !synced || synced.id !== net.account().id || Math.abs(clock.t - synced.t) > 0.01; // the cloud lacks what we have
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

// ---- build 0.2: the avatar, the time of day, the walk before an action -------------------------------------------
// the avatar wears its rank's outfit (world side); a visit shows the other town's avatar
function dress(a = life.snapshot().avatar) {
  world.setAvatar(a);
  qa.avatar.push({ ...a, visit: mode === 'visit' });
}
function setTod(t) {
  if (t === tod) return;
  tod = t;
  world.setTimeOfDay(t);
  qa.tod.push({ t, slots: life.state.slots, night });
}
// the avatar walks to the building before a task or card opens: at most WALK s of game time, a tap skips it
async function walkTo(id) {
  if (!id) return;
  const t0 = clock.t;
  let how = '';
  const skip = () => { how ||= 'tap'; };
  mode = 'walk';
  addEventListener('pointerdown', skip, true);
  world.walkTo(id).then(() => { how ||= 'arrived'; }, () => { how ||= 'failed'; });
  await new Promise(done => (function wait() { if (how || clock.t - t0 >= WALK) done(); else requestAnimationFrame(wait); })());
  removeEventListener('pointerdown', skip, true);
  qa.walks.push({ id, how: how || 'cap', game: +(clock.t - t0).toFixed(2) });
  mode = 'town';
}

// ---- the character creator: skin, hair and face, one tap each, shown on the avatar at once ----------------------
// the looks in data/wardrobe.json are in the order of the manifest's character skins, hairs and faces (the avatar takes indices)
function lookPicker(look, onChange) {
  const { skins, hairs, faces } = content.wardrobe.looks;
  const dot = c => `<i style="background:${esc(c)}"></i>`;
  const row = (k, label, list, cell, cls = 'sw') => `<div class="looks"><span>${label}</span>${list.map((v, i) =>
    `<button type="button" class="${cls}" data-k="${k}" data-i="${i}" aria-pressed="${look[k] === i}" aria-label="${label} ${i + 1}">${cell(v)}</button>`).join('')}</div>`;
  return {
    html: row('skin', 'Skin', skins, dot) + row('hair', 'Hair', hairs, h => (h.color ? dot(h.color) : '') + esc(h.label), 'sw pill') + row('face', 'Face', faces, esc),
    bind: el => {
      for (const b of el.querySelectorAll('.sw')) b.onclick = () => {
        look[b.dataset.k] = +b.dataset.i;
        for (const x of el.querySelectorAll(`.sw[data-k="${b.dataset.k}"]`)) x.setAttribute('aria-pressed', x === b);
        onChange(look);
      };
    },
  };
}

// ---- intro: name yourself and the town (2 taps, suggestions prefilled), then your look (3 taps, defaults set) -----
async function intro() {
  const names = ['Sam', 'Alex', 'Jo', 'Robin', 'Kim', 'Charlie', 'Ayla', 'Noor', 'Mika'];
  const ok = s => /^[\p{L}\p{N} .'-]{2,24}$/u.test(s) && !/(nazi|hitler|fuck|shit|cunt|nigg|faggot|rape)/i.test(s);
  let name = names[Math.floor(Math.random() * names.length)], town = 'Brookfield';
  const look = { skin: 0, hair: 0, face: 0 };
  const picker = lookPicker(look, l => world.setAvatar({ ...l, extra: null, rank: 0 }));
  world.setAvatar({ ...look, extra: null, rank: 0 });
  await card({
    html: `<div class="eyebrow">A new life</div><h1>Be the Mayor</h1>
      <p>You're 19. <b id="introTown">Brookfield</b> has 212 people, a broken bridge, and a mayor nobody likes.</p>
      <label>Your name<input id="inName" maxlength="24" value="${esc(name)}" autocomplete="off"></label>
      <label>Your town<input id="inTown" maxlength="24" value="${esc(town)}" autocomplete="off"></label>${picker.html}<p class="err"></p>`,
    options: [{ id: 'go', go: true, html: 'Start' }],
    onShow: el => { picker.bind(el); el.querySelector('#inTown').oninput = e => { el.querySelector('#introTown').textContent = e.target.value || 'Your town'; }; },
    act: (_, el) => {
      name = el.querySelector('#inName').value.trim();
      town = el.querySelector('#inTown').value.trim();
      if (ok(name) && ok(town)) return false;
      el.querySelector('.err').textContent = '2–24 letters, numbers, spaces, dots, dashes or apostrophes, and nothing rude.';
      return true;
    },
  });
  return { name, town, look };
}

// the wardrobe's mirror: change skin, hair and face later (0.1 saves start with the default look)
async function changeLook() {
  const look = { ...life.state.avatar };
  const preview = l => world.setAvatar({ ...life.snapshot().avatar, skin: l.skin, hair: l.hair, face: l.face });
  const picker = lookPicker(look, preview);
  const id = await card({ html: `<div class="eyebrow">Mirror</div><h2>Your look</h2>${picker.html}`, onShow: picker.bind,
    options: [{ id: 'ok', go: true, html: 'Done' }, { id: '', html: 'Cancel' }] });
  if (id) life.setLook(look);
  dress();
  after();
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
  if (mode !== 'visit') setTod(night ? 1 : TOD[stats().slots] ?? 0);
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
const tabs = on => `<div class="tabs">${[['upgrades', '🎓 Learn'], ['wardrobe', '👕 Wardrobe']].map(([id, label]) =>
  `<button data-tab="${id}" aria-pressed="${id === on}">${label}</button>`).join('')}</div>`;
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
    ui.openSheet('upgrades', 'Invest in yourself', tabs('upgrades') + (html || '<p class="muted">Nothing to learn yet.</p>'));
  } else if (name === 'wardrobe') {
    // build 0.2: extras are a money sink with no slot cost; the outfit itself comes with your rank
    const html = life.wardrobe().map(x => `<div class="item"><h3>${esc(x.title)}</h3>${whoLine(x.who)}
      ${x.owned ? `<button class="opt" data-wear="${x.worn ? '' : esc(x.id)}">${x.worn ? '✅ Wearing it · take it off' : 'Wear it'}</button>`
        : `${chips({ money: -x.cost })}<button class="go" data-extra="${esc(x.id)}" ${x.cost > s.money ? 'disabled' : ''}>${x.cost > s.money ? `Need €${esc(x.cost)}` : `Buy · €${esc(x.cost)}`}</button>`}</div>`).join('');
    ui.openSheet('wardrobe', 'Wardrobe', `${tabs('wardrobe')}<p class="muted">Your outfit comes with your rank: ${esc(life.ladder().title)}.</p><button class="opt" data-act="look">🪞 Change your look</button>${html}`);
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
// a person's line is shown as written: it names its speaker ("Frau Keller: “…”") or is narration (0.1 bug: doubled names)
function applyResult(r) {
  if (!r.ok) { toast(esc(r.msg || 'Not possible right now')); return false; }
  const items = addNews(r.news);
  toast(`${chips(r.effects)}${items[0] ? `<div>${esc(items[0].title)}</div>` : ''}${r.msg ? `<div>${esc(r.msg)}</div>` : ''}`);
  if (r.effects?.fix) { draw(life.state); world.focus(r.effects.fix); world.celebrate('fixed'); }
  return true;
}

async function doJob(id) {
  const o = life.offers().find(x => x.id === id);
  if (!o || mode !== 'town') return;
  ui.closeSheet();
  await walkTo(o.params.at || o.params.from || o.params.stops?.[0]);
  mode = 'task';
  document.body.classList.add('task');
  const t0 = clock.t;
  let result;
  try { result = await world.playTask(o.task, o.params); } // params.twist is the twist id; o.twist is its text
  finally { document.body.classList.remove('task'); mode = 'town'; }
  qa.tasks.push({ kind: o.task, game: +(clock.t - t0).toFixed(2), seconds: result.seconds, stars: result.stars });
  draw(life.state);
  if (applyResult(life.doJob(o.id, result, clock.t))) meta.jobs++;
  after();
}

// a task you have mastered (≥ 2 stars) can be done as a quick shift: 80% pay, no first-person time (contract change 2)
function quickShift(id) {
  const o = life.offers().find(x => x.id === id);
  if (!o || mode !== 'town') return;
  ui.closeSheet();
  qa.quick.push(o.task);
  draw(life.state);
  if (applyResult(life.doJob(o.id, { quick: true }, clock.t))) meta.jobs++;
  after();
}

async function openProblem(id) {
  const p = life.problems().find(x => x.id === id);
  if (!p || mode !== 'town') return;
  ui.closeSheet();
  if (p.at) world.focus(p.at);
  await walkTo(p.at);
  const opt = await card({
    html: `<div class="eyebrow">Town problem</div><h2>${esc(p.title)}</h2>${whoLine(p.who)}${p.text ? `<p>${esc(p.text)}</p>` : ''}`,
    options: [...p.options.map(optionCard), { id: '', html: 'Not now' }],
  });
  if (!opt) return;
  if (applyResult(life.choose(p.id, opt, clock.t))) meta.choices++;
  after();
}

async function showEvent(ev) {
  shownEvent = ev.id;
  const opt = await card({
    html: `<div class="eyebrow">Something happened</div>${whoLine(ev.who)}<h2>${esc(ev.title || ev.text)}</h2>${ev.title && ev.text ? `<p>${esc(ev.text)}</p>` : ''}`,
    options: ev.options.map(optionCard),
  });
  if (applyResult(life.choose(ev.id, opt, clock.t))) meta.choices++;
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

function buyExtra(id) {
  const r = life.buyExtra(id);
  if (!r.ok) toast(esc(r.msg || 'Not possible right now'));
  else { toast(`${chips(r.effects)}<div>${esc(r.msg)}</div>`); dress(); }
  after();
}
function wear(id) {
  if (life.wear(id).ok) dress();
  after();
}

// one evening of a course: 1 slot, at most one a day (contract change 4)
function study(id) {
  const r = life.study(id, clock.t);
  if (!r.ok) toast(esc(r.msg || 'Not possible right now'));
  else if (r.msg) toast(`📚 ${esc(r.msg)}`);
  after();
}

// sleep: night falls, the newspaper, then morning
async function sleep() {
  if (mode !== 'town') return;
  ui.closeSheet();
  night = true;
  const r = life.endDay(clock.t);
  const items = addNews(r.news);
  const got = await net.inbox(meta.seenAt);
  meta.seenAt = Date.now();
  net.saveTown(life.snapshot()).then(s => { if (!s.ok && !/too often/i.test(s.msg)) toast(esc(s.msg)); });
  after();
  await paper([...visitorNews(got), ...items], `Day ${stats().day}`);
  night = false;
  refresh();
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
  if (mode !== 'visit') { dress(); world.celebrate('promotion'); } // the new rank's outfit (home dresses it after a visit)
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
  draw(t.snapshot);
  dress(t.snapshot.avatar);
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
    draw(life.state);
    dress();
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
  if (r.ok) {
    btn.disabled = true;
    toast({ like: '❤️ Liked!', sign: '🪧 Your sign is up', help: '🤝 Thanks for helping!' }[kind]);
    if (kind === 'like') world.celebrate('like');
  }
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
  cloudDirty = true;
}

async function restart() {
  const ok = await card({ html: '<h2>Start a new life?</h2><p>Your town and progress are replaced, on this device and in your cloud save.</p>',
    options: [{ id: 'yes', html: 'Yes, start over' }, { id: '', html: 'Keep playing' }] });
  if (!ok) return;
  leaving = true; // pagehide must not save the old life back
  keep(wrap());
  try { localStorage.removeItem(KEY); localStorage.setItem(FRESH, '1'); } catch { /* blocked storage: nothing to replace */ }
  location.reload();
}

// ---- cloud save (build 0.2.2): after actions, every 60 s of play and on hide; the server takes one write per 20 s --------
// the cloud row, null when there is none, undefined when it can't be read: then nothing is uploaded until it can be
async function cloudRead() {
  if (!net.online) return undefined;
  try {
    const row = await Promise.race([net.cloudLoad(), new Promise((_, no) => setTimeout(() => no(new Error('timed out')), 8000))]);
    cloudChecked = true;
    return row;
  } catch (e) { console.warn('cloud save not reachable:', e.message); return undefined; }
}

async function chooseSave(local, cloud) {
  const here = saveLine(local), there = saveLine(cloud.save), newer = cloud.play_t > (+local.t || 0) ? 'cloud' : 'local';
  const id = await card({
    html: `<div class="eyebrow">Two saves</div><h2>Which life do you want to keep playing?</h2>
      <p>This device and your cloud save have gone different ways. The one you don't pick is kept as a backup.</p>`,
    options: [{ id: 'local', go: newer === 'local', html: `📱 This device: ${esc(here)}` }, { id: 'cloud', go: newer === 'cloud', html: `☁️ Cloud: ${esc(there)}` }],
  });
  qa.choice.push({ here, there, id });
  return id;
}

// the start couldn't read the cloud: compare now, before the first upload; mid-game a different cloud save always asks
async function recheck() {
  const c = await cloudRead();
  if (c === undefined) return false;
  if (c && pickSave(wrap(), c, net.account().id) !== 'local' && await chooseSave(wrap(), c) === 'cloud') {
    replaceWith(fromCloud(c));
    return false;
  }
  return true;
}

async function sync() {
  if (leaving || !net.online || cloudBusy || Date.now() - cloudTry < CLOUD_GAP) return;
  cloudBusy = true;
  cloudTry = Date.now();
  try {
    if (!cloudChecked && !(await recheck())) return;
    if (!cloudDirty) return;
    cloudDirty = false; // before the upload: anything that happens meanwhile marks it again
    const w = wrap();
    const r = await net.cloudSave(w, { version: V, play_t: w.t });
    qa.cloud.push({ ok: r.ok, msg: r.msg || '' });
    if (r.ok) { cloudAt = Date.now(); cloudMsg = ''; synced = { id: net.account().id, t: r.play_t }; persist(); }
    else { cloudDirty = true; cloudMsg = r.msg; } // offline or too soon: try again later
  } finally { cloudBusy = false; }
}

function cloudLine() {
  if (!net.online) return 'Only on this device (offline)';
  if (!cloudAt && (cloudDirty || !cloudChecked)) return cloudMsg ? `Only on this device for now: ${cloudMsg}` : 'Only on this device for now';
  const s = Math.round((Date.now() - cloudAt) / 1000);
  const ago = !cloudAt ? '' : s < 60 ? ` · ${s} s ago` : s < 3600 ? ` · ${Math.round(s / 60)} min ago` : ` · ${Math.round(s / 3600)} h ago`;
  return `Saved to cloud${ago}${net.account().anonymous ? ', but only this browser can open it' : ''}`;
}

// ⚙ settings: the account, the cloud status, export and import
async function settings() {
  const a = net.account();
  const who = !net.online ? '<p>Playing offline. Your progress is saved on this device.</p>'
    : a.anonymous ? `<p>Add your email so a cleared browser, incognito or a new phone can't take your town away.</p>
      ${a.pending ? `<p class="status">📬 Waiting for you to tap the link we sent to ${esc(a.pending)}.</p>` : ''}
      <label>Email<input id="inEmail" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com"></label>`
    : `<p>Signed in as <b>${esc(a.email || 'you')}</b>. Your progress follows you to any device.</p>`;
  const id = await card({
    html: `<div class="eyebrow">Settings</div><h2>Your progress</h2><p class="status" id="cloudStatus">${esc(cloudLine())}</p>${who}<p class="status" id="mailMsg"></p>`,
    options: [
      ...(net.online && a.anonymous ? [{ id: 'link', go: true, html: '💾 Save my progress' }, { id: 'login', html: '🔑 Log in on this device' }] : []),
      ...(net.online && !a.anonymous ? [{ id: 'logout', html: 'Log out' }] : []),
      { id: 'export', html: '📤 Export save code' }, { id: 'import', html: '📥 Import save code' }, { id: '', html: 'Close' },
    ],
    act: (id, el) => {
      if (id !== 'link' && id !== 'login') return false;
      const input = el.querySelector('#inEmail'), msg = el.querySelector('#mailMsg'), email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Type your email address first.'; input.focus(); return true; }
      msg.textContent = 'Sending…';
      (id === 'link' ? net.linkEmail(email) : net.signInEmail(email)).then(r => {
        qa.cloud.push({ act: id, ok: r.ok, msg: r.msg || '' });
        msg.textContent = r.ok ? `📬 Check your inbox at ${email} and tap the link${id === 'login' ? ' on this device' : ''}.` : r.msg;
      });
      return true;
    },
  });
  if (id === 'export') exportSave();
  else if (id === 'import') importSave();
  else if (id === 'logout') {
    const r = await net.signOut();
    cloudChecked = false; cloudAt = 0; synced = null; cloudDirty = true;
    persist();
    toast(esc(r.ok ? 'Logged out. Your progress stays on this device.' : r.msg));
  }
}

async function exportSave() {
  const code = encodeSave(wrap());
  await card({
    html: `<div class="eyebrow">Export</div><h2>Your save code</h2><p>Keep it somewhere safe, e.g. in an email to yourself. <b>Import save code</b> brings this life back on any device.</p>
      <textarea id="saveCode" readonly rows="5" spellcheck="false">${esc(code)}</textarea><p class="status"></p>`,
    options: [{ id: 'copy', go: true, html: '📋 Copy' }, { id: 'ok', html: 'Done' }],
    act: (id, el) => {
      if (id !== 'copy') return false;
      el.querySelector('#saveCode').select();
      const done = ok => { el.querySelector('.status').textContent = ok ? 'Copied.' : 'Select the code and copy it.'; };
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => done(true), () => done(false));
      return true;
    },
  });
}

// every import goes through migrate (decodeSave); the cloud mark stays, so the imported life is what gets uploaded next
async function importSave() {
  let w = null;
  const id = await card({
    html: `<div class="eyebrow">Import</div><h2>Paste a save code</h2><textarea id="saveCode" rows="5" spellcheck="false" placeholder="Paste the code here"></textarea><p class="err"></p>`,
    options: [{ id: 'go', go: true, html: 'Import' }, { id: '', html: 'Cancel' }],
    act: (id, el) => {
      if (!id) return false;
      w = decodeSave(el.querySelector('#saveCode').value);
      if (w) return false;
      el.querySelector('.err').textContent = 'That code does not work. Copy the whole code and try again.';
      return true;
    },
  });
  if (!id || !w) return;
  const ok = await card({
    html: `<h2>Replace your progress on this device?</h2><p>Now: ${esc(saveLine(wrap()))}<br>Save code: ${esc(saveLine(w))}</p>`,
    options: [{ id: 'yes', go: true, html: 'Yes, load the code' }, { id: '', html: 'Keep playing' }],
  });
  if (ok) replaceWith({ ...w, synced });
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
  else if (b.dataset.tab) panel(b.dataset.tab);
  else if (b.dataset.extra) buyExtra(b.dataset.extra);
  else if ('wear' in b.dataset) wear(b.dataset.wear || null);
  else if (b.dataset.act === 'look') changeLook();
  else if (b.dataset.act === 'restart') restart();
};
$('visitbar').onclick = e => { const b = e.target.closest('[data-visit]'); if (b && !b.disabled) visitAct(b.dataset.visit, b); };
$('gear').onclick = () => { if (mode === 'town' && !ui.cardOpen()) settings(); };
addEventListener('resize', () => document.documentElement.style.setProperty('--topH', $('top').offsetHeight + 'px'));
// session end: keep the local save, upload the town snapshot (the server takes one a minute) and the cloud save
addEventListener('visibilitychange', () => { if (document.hidden) { persist(); net.saveTown(life.snapshot()); sync(); } });
addEventListener('pagehide', () => { persist(); sync(); });

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
  const js = performance.now(); // QA C3: this frame's JS time (perf only; game time is clock.t)
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
  if ((sinceCloud += dt) > 60) { sinceCloud = 0; cloudDirty = true; } // every 60 s of play
  if (cloudDirty) sync(); // returns at once while a write is running or the 20 s limit isn't up
  if (mode === 'town') { qa.ms.push(performance.now() - js); if (qa.ms.length > 120) qa.ms.shift(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- QA hooks (qa/acceptance.mjs): the game clock, not real time ------------------------------------------------
window.__btm = {
  V, clock, content, world, net, qa, TOD, get life() { return life; }, get mode() { return mode; }, get meta() { return meta; }, get tod() { return tod; }, stats,
  get synced() { return synced; },
  advance(sec) { clock.t += sec; handle(life.tick(clock.t)); }, // skip ahead in game time, e.g. to finish a course
};
