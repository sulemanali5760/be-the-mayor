// The 3D world: the top-down town (Hay Day / Clash of Clans camera) and the tasks that take over the canvas.
// Contract: docs/builds/01-first-15.md §3.3. Time moves only through frame(dt) from main.js's game clock (LESSONS T6).
import * as THREE from 'three';

// main.js imports this file as world.js?v=…; every file below is fetched with the same ?v= (LESSONS H3)
const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const B = await import(`./buildings.js?v=${V}`);

const YAW = Math.PI / 4, PITCH = 0.9; // fixed view from the south-east, about 52° down
const MIN_D = 22, MAX_D = 240;         // camera distance to the ground point it looks at (m)
const TAP_PX = 8;                      // a pointer that moves less than this is a tap, not a pan
const PICK_PX = 36;                    // a tap on nothing picks the nearest building anchor this close (screen space, T8)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// the contract says state.town; a visit snapshot (§3.4) has buildings. Take whichever is there.
const buildingsOf = s => (Array.isArray(s?.town) ? s.town : s?.buildings ?? s?.town?.buildings ?? []);

export function createWorld(canvas, content) { // content: not needed yet, kept for the contract
  const LOW = new URLSearchParams(location.search).get('q') === 'low'; // weak GPUs and the software-GL QA runner
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW });
  renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = !LOW;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9d6ee);
  scene.fog = new THREE.Fog(0xa9d6ee, 260, 520);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x6b8f4a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: 0x8cc063 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const town = new THREE.Group();
  scene.add(town);

  /* ---------- size (resize guard, T5) ---------- */
  const size = { w: 0, h: 0 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // a 0-px layout pass would make every aspect ratio NaN
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  const fit = cam => { if (size.w && size.h && cam.aspect !== size.w / size.h) { cam.aspect = size.w / size.h; cam.updateProjectionMatrix(); } };

  /* ---------- camera ---------- */
  const view = { x: 0, z: 0, d: 80, box: [-60, 60, -60, 60] };
  let tween = null;
  function clampView() {
    view.d = clamp(view.d, MIN_D, MAX_D);
    view.x = clamp(view.x, view.box[0], view.box[1]);
    view.z = clamp(view.z, view.box[2], view.box[3]);
  }
  function placeCamera() {
    fit(camera);
    const c = Math.cos(PITCH) * view.d;
    camera.position.set(view.x + Math.sin(YAW) * c, Math.sin(PITCH) * view.d, view.z + Math.cos(YAW) * c);
    camera.lookAt(view.x, 0, view.z);
    camera.updateMatrixWorld();
  }
  // look at (x, z) from far enough to see a circle of radius r
  function frameOn(x, z, r) {
    const a = size.w && size.h ? size.w / size.h : 1;
    view.x = x; view.z = z;
    view.d = r / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, a));
    tween = null;
    clampView();
    placeCamera();
  }

  /* ---------- town ---------- */
  const items = new Map(); // id → { key, group, b }
  let idsKey = '';
  function drop(group) {
    town.remove(group);
    group.traverse(o => { o.geometry?.dispose(); if (o.userData.own) { o.material.map?.dispose(); o.material.dispose(); } });
  }
  function fitTown() {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const { b } of items.values()) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z); }
    if (!items.size) x0 = x1 = z0 = z1 = 0;
    view.box = [x0 - 10, x1 + 10, z0 - 10, z1 + 10];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.max(x1 - x0, z1 - z0) / 2 + 12, R = r + 25;
    sun.position.set(cx + 40, 80, cz + 30);
    sun.target.position.set(cx, 0, cz);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 300 });
    sun.shadow.camera.updateProjectionMatrix();
    frameOn(cx, cz, r);
  }
  // rebuilds only buildings whose type, place, state or label changed; a different set of ids (a visit) re-frames
  function showTown(state) {
    const seen = new Set();
    for (const b of buildingsOf(state)) {
      seen.add(b.id);
      const key = JSON.stringify([b.type, b.x, b.z, b.rot, b.state, b.label]), it = items.get(b.id);
      if (it?.key === key) { it.b = b; continue; }
      if (it) drop(it.group);
      const group = B.makeBuilding(b);
      town.add(group);
      items.set(b.id, { key, group, b });
    }
    for (const [id, it] of items) if (!seen.has(id)) { drop(it.group); items.delete(id); }
    const ids = [...items.keys()].sort().join();
    if (ids !== idsKey) { idsKey = ids; fitTown(); }
  }

  /* ---------- picking and screen positions ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function setRay(p, cam) {
    const r = canvas.getBoundingClientRect();
    ndc.set((p.clientX - r.left) / r.width * 2 - 1, -((p.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
  }
  const groundAt = p => { setRay(p, camera); return ray.ray.intersectPlane(plane, v) ? [v.x, v.z] : null; };
  function anchors() {
    if (!active) placeCamera();
    return [...items.values()].map(({ b, group }) => {
      v.set(b.x, group.userData.h + 1, b.z).project(camera);
      const x = (v.x + 1) / 2 * size.w, y = (1 - v.y) / 2 * size.h;
      return { id: b.id, x, y, visible: !active && v.z < 1 && x >= 0 && y >= 0 && x <= size.w && y <= size.h };
    });
  }
  function pickAt(p) {
    setRay(p, camera);
    let o = ray.intersectObjects(town.children, true)[0]?.object;
    while (o && o.userData.id === undefined) o = o.parent;
    if (o) return o.userData.id;
    const r = canvas.getBoundingClientRect(), px = p.clientX - r.left, py = p.clientY - r.top;
    let best = null, bd = PICK_PX;
    for (const a of anchors()) { const d = Math.hypot(a.x - px, a.y - py); if (a.visible && d < bd) { bd = d; best = a.id; } }
    return best;
  }
  const listeners = [];
  const emitPick = id => { for (const fn of listeners) fn({ id }); };

  /* ---------- input: drag pans, pinch or wheel zooms, a tap picks; a running task gets the events ---------- */
  const pts = new Map();
  let tap = null;
  canvas.addEventListener('pointerdown', e => {
    if (active) { active.down?.(e); return; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    pts.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    tap = pts.size === 1 ? { x: e.clientX, y: e.clientY, moved: false } : null;
    tween = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (active) { active.move?.(e); return; }
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { clientX: e.clientX, clientY: e.clientY };
    if (pts.size === 1) {
      if (tap && !tap.moved && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < TAP_PX) return;
      if (tap) tap.moved = true;
      const a = groundAt(prev), b = groundAt(cur); // grab the ground: the point under the finger stays under it
      if (a && b) { view.x += a[0] - b[0]; view.z += a[1] - b[1]; }
    } else if (pts.size === 2) {
      const other = [...pts.entries()].find(([id]) => id !== e.pointerId)[1];
      const mid = (p, q) => ({ clientX: (p.clientX + q.clientX) / 2, clientY: (p.clientY + q.clientY) / 2 });
      const d0 = Math.hypot(prev.clientX - other.clientX, prev.clientY - other.clientY);
      const d1 = Math.hypot(cur.clientX - other.clientX, cur.clientY - other.clientY);
      const a = groundAt(mid(prev, other)), b = groundAt(mid(cur, other));
      if (a && b) { view.x += a[0] - b[0]; view.z += a[1] - b[1]; }
      if (d0 > 0 && d1 > 0) view.d *= d0 / d1;
    }
    pts.set(e.pointerId, cur);
    clampView();
    placeCamera();
  });
  const up = e => {
    if (active) { active.up?.(e); return; }
    if (!pts.delete(e.pointerId)) return;
    if (e.type === 'pointerup' && tap && !tap.moved && !pts.size) { const id = pickAt(e); if (id !== null) emitPick(id); }
    if (pts.size) tap = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => {
    if (active) return;
    e.preventDefault();
    view.d *= Math.exp(e.deltaY * 0.0015);
    tween = null;
    clampView();
  }, { passive: false });

  function focus(id) {
    const it = items.get(id);
    if (!it) return;
    tween = { t: 0, dur: 0.8, from: { x: view.x, z: view.z, d: view.d }, to: { x: it.b.x, z: it.b.z, d: Math.min(view.d, 55) } };
  }

  /* ---------- tasks ---------- */
  let active = null, busy = false, t = 0;
  // an overlay line of text over the canvas for a running task (removed by the task)
  function hud() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;z-index:20;pointer-events:none;box-sizing:border-box;text-align:center;padding:10px 16px;'
      + 'font:600 16px/1.4 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)';
    el.place = () => { const r = canvas.getBoundingClientRect(); Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` }); };
    el.place();
    document.body.appendChild(el);
    return el;
  }
  function renderTown() { placeCamera(); renderer.render(scene, camera); }
  const ctx = { renderer, canvas, size, fit, scene, camera, view, items, groundAt, frameOn, placeCamera, renderTown, hud, label: B.label, mat: B.mat };

  async function playTask(kind, params = {}) {
    const file = { wall: 'wall.js', delivery: 'delivery.js' }[kind];
    if (!file) throw new Error(`Unknown task: ${kind}`);
    if (busy) throw new Error('A task is already running.');
    busy = true;
    // main.js passes the offer's twist as a string ('closed road') or an object ({ id, label }): make it 'closedroad'
    const tw = typeof params.twist === 'string' ? params.twist : params.twist?.id;
    params = { ...params, twist: tw ? String(tw).toLowerCase().replace(/[^a-z]/g, '') : null };
    try {
      const mod = await import(`./${file}?v=${V}`);
      await mod.ready?.();
      pts.clear(); tap = null; tween = null;
      return await new Promise(resolve => { active = mod.start(ctx, params, result => { active = null; resolve(result); }); });
    } finally { busy = false; }
  }
  // load the wall's models in the background so the first wall task starts at once
  import(`./wall.js?v=${V}`).then(m => m.ready()).catch(e => console.warn('Wall models not preloaded:', e));

  function frame(dt) {
    t += dt;
    if (active) { active.frame(dt); return; }
    if (tween) {
      tween.t += dt;
      const k = Math.min(1, tween.t / tween.dur), e = k * k * (3 - 2 * k);
      for (const q of ['x', 'z', 'd']) view[q] = tween.from[q] + (tween.to[q] - tween.from[q]) * e;
      if (k >= 1) tween = null;
    }
    renderTown();
  }

  const world = { showTown, anchors, onPick: fn => { listeners.push(fn); }, focus, playTask, frame };
  // QA and console hooks (Lane U's qa/acceptance.mjs drives these; see docs/ASSETS.md "QA hooks")
  window.__btmWorld = {
    world,
    tap(id) { if (!items.has(id)) return false; emitPick(id); return true; },
    finish(stars = 3) { if (!active) return false; active.finish(clamp(Math.round(stars), 0, 3)); return true; },
    task: () => active?.info() ?? null,
    screen(x, z) { v.set(x, 0, z).project(camera); return [(v.x + 1) / 2 * size.w, (1 - v.y) / 2 * size.h]; }, // a ground point in canvas px
    get view() { return { x: view.x, z: view.z, d: view.d }; },
    stats: () => ({ ...renderer.info.render, buildings: items.size, time: t }),
  };
  return world;
}
