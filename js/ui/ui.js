// DOM side of the game shell: the HUD, the sheet, cards, toasts and speech bubbles.
// Pure rendering: main.js owns the game state and passes callbacks in.
const $ = id => document.getElementById(id);

// every string that reaches innerHTML goes through esc(): other players' snapshots are untrusted
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

// effects as icons, always shown before the player commits (pillar 2)
export function chips(e = {}, { later, energy } = {}) {
  const out = [];
  const add = (n, text) => out.push(`<span class="chip ${n > 0 ? 'up' : n < 0 ? 'down' : ''}">${text}</span>`);
  if (e.money) add(e.money, `${signed(e.money)} €`);
  if (e.rep) add(e.rep, `${signed(e.rep)} ★`);
  const en = e.energy ?? (energy ? -energy : 0);
  if (en) add(en, `${signed(en)} ⚡`);
  for (const [id, n] of Object.entries(e.skill || {})) add(n, `${signed(n)} 🔧 ${esc(id)}`);
  if (e.fix) add(1, `🏠 fixes ${esc(e.label || e.fix)}`);
  else if (e.label) out.push(`<span class="chip">${esc(e.label)}</span>`);
  if (later) out.push('<span class="chip later">⏳ This will be remembered</span>');
  return `<div class="chips">${out.join('')}</div>`;
}

export function toast(html, ms = 4200) {
  const t = document.createElement('div');
  t.className = 'toast panel';
  t.innerHTML = html;
  $('toasts').append(t);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => t.remove(), ms);
}

export function renderStats(s) {
  $('stats').innerHTML =
    `<span>€${esc(Math.round(s.money))}</span><span>★ ${esc(s.rep)}</span>` +
    `<span>⚡ ${esc(s.energy)}<small>/${esc(s.maxEnergy)}</small></span><span><small>Day</small> ${esc(s.day)}</span>`;
}

export function renderLadder(l) {
  const list = l.next?.checklist || [];
  const done = list.filter(c => c.done).length;
  const todo = list.find(c => !c.done);
  $('ladder').innerHTML = l.next
    ? `<span class="rung">${esc(l.title)} → <em>${esc(l.next.title)}</em></span><span class="bar"><i style="width:${list.length ? (100 * done) / list.length : 0}%"></i></span>` +
      `<span class="next">${todo ? `Next: ${esc(todo.label)} · ${done}/${list.length}` : 'Ready for promotion'}</span>`
    : `<span class="rung"><em>${esc(l.title)}</em></span><span></span>`;
}

export function setGoal(html) {
  $('goal').hidden = !html;
  $('goal').innerHTML = html || '';
}

export function setBadge(panel, n) {
  const b = document.querySelector(`#dock [data-panel="${panel}"] .badge`);
  b.hidden = !n;
  b.textContent = n || '';
}

// one sheet at a time; `panel` names what is open so main.js can refresh it in place
export const sheet = { panel: null };
export function openSheet(panel, title, html) {
  sheet.panel = panel;
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheet').hidden = false;
  for (const b of document.querySelectorAll('#dock [data-panel]')) b.classList.toggle('on', b.dataset.panel === panel);
}
export function closeSheet() {
  sheet.panel = null;
  $('sheet').hidden = true;
  for (const b of document.querySelectorAll('#dock [data-panel]')) b.classList.remove('on');
}

// Cards queue up so an event arriving during another card waits its turn.
// card({ cls, html, options: [{ id, html, go, disabled }], onShow(el), act(id, el) }) → Promise<chosen option id>
let queue = Promise.resolve();
export const cardOpen = () => !$('modal').hidden;
export function card(o) {
  const p = queue.then(() => new Promise(resolve => {
    $('card').className = 'card panel ' + (o.cls || '');
    $('card').innerHTML = o.html + `<div class="opts">${(o.options || []).map(x =>
      `<button class="${x.go ? 'go' : 'opt'}" data-opt="${esc(x.id)}" ${x.disabled ? 'disabled' : ''}>${x.html}</button>`).join('')}</div>`;
    $('modal').hidden = false;
    if (o.onShow) o.onShow($('card'));
    $('card').onclick = e => {
      const b = e.target.closest('[data-opt]');
      if (!b || b.disabled) return;
      if (o.act && o.act(b.dataset.opt, $('card'))) return; // act() returns true to keep the card open
      $('modal').hidden = true;
      $('card').onclick = null;
      resolve(b.dataset.opt);
    };
  }));
  queue = p.catch(() => {});
  return p;
}

// speech bubbles over buildings and people: [{ id (anchor id), text, key }]; positions from world.anchors()
const pool = new Map();
export function bubbles(items, anchors, onTap) {
  const at = new Map(anchors.map(a => [a.id, a]));
  const keep = new Set();
  for (const it of items) {
    const a = at.get(it.id);
    if (!a || !a.visible) continue;
    keep.add(it.key);
    let el = pool.get(it.key);
    if (!el) {
      el = document.createElement('button');
      el.className = 'bubble';
      el.dataset.key = it.key;
      el.onclick = () => onTap(it.key);
      $('bubbles').append(el);
      pool.set(it.key, el);
    }
    if (el.textContent !== it.text) el.textContent = it.text;
    el.style.transform = `translate(${Math.round(a.x)}px,${Math.round(a.y)}px) translate(-50%,-100%)`;
  }
  for (const [k, el] of pool) if (!keep.has(k)) { el.remove(); pool.delete(k); }
}
