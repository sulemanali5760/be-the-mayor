// The 3D world: the top-down town (Hay Day / Clash of Clans camera) with its life and your avatar, and the tasks
// that take over the canvas. Contracts: docs/builds/01-first-15.md §3.3 and 02-look-and-feel.md §3.2.
// Time moves only through frame(dt) from main.js's game clock (LESSONS T6).
import * as THREE from 'three';

// main.js imports this file as world.js?v=…; every file below is fetched with the same ?v= (LESSONS H3)
const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const [B, L, A, Life] = await Promise.all(['buildings', 'look', 'avatar', 'life'].map(f => import(`./${f}.js?v=${V}`)));

const YAW = Math.PI / 4, PITCH = 0.9; // fixed view from the south-east, about 52° down
const MIN_D = 22, MAX_D = 240;         // camera distance to the ground point it looks at (m)
const TAP_PX = 8;                      // a pointer that moves less than this is a tap, not a pan
const PICK_PX = 36;                    // a tap on nothing picks the nearest anchor this close (screen space, T8)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// the contract says state.town; a visit snapshot (§3.4) has buildings. Take whichever is there.
const buildingsOf = s => (Array.isArray(s?.town) ? s.town : s?.buildings ?? s?.town?.buildings ?? []);

export function createWorld(canvas, content = {}) {
  const LOW = new URLSearchParams(location.search).get('q') === 'low'; // weak GPUs and the software-GL QA runner
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW });
  renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 1.75));
  canvas.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const look = L.createLook(renderer, scene, LOW);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), L.town({ color: 0x8cc063 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const town = new THREE.Group();
  scene.add(town);
  const life = Life.createLife(scene, content || {});
  const avatar = A.createAvatar(scene);

  /* ---------- size (resize guard, T5) ---------- */
  const size = { w: 0, h: 0 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // a 0-px layout pass would make every aspect ratio NaN
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    look.setSize();
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
  const zones = new Map(); // id → grey area { x, z, r, a, to }: broken buildings grey their surroundings
  let idsKey = '', lastFixed = null;
  function drop(group) {
    town.remove(group);
    group.traverse(o => { o.geometry?.dispose(); if (o.userData.own) { o.material.map?.dispose(); o.material.dispose(); } });
  }
  function fitTown() {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const { b } of items.values()) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z); }
    if (!items.size) x0 = x1 = z0 = z1 = 0;
    view.box = [x0 - 10, x1 + 10, z0 - 10, z1 + 10];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.max(x1 - x0, z1 - z0) / 2 + 12;
    look.fit(cx, cz, r + 25);
    frameOn(cx, cz, r);
  }
  // roads, paths, props and people's homes: the state's own (a snapshot may carry them), else data/town.json's
  // when this is a Brookfield (every town.json building is here), else none (a ring road is drawn)
  function layoutOf(state) {
    if (state?.roads) return state;
    const own = content?.town && !Array.isArray(content.town) ? content.town : null;
    const ids = own ? buildingsOf(own).map(b => b.id) : [];
    return own && ids.length && ids.every(id => items.has(id)) ? own : {};
  }
  // the avatar starts by your flat (else the first house), on the side the camera sees, facing the camera
  function placeHome() {
    const it = items.get('flat') ?? [...items.values()].find(i => i.group.userData.type === 'house');
    const r = it ? Math.hypot(...it.group.userData.foot) / 2 + 1.2 : 0, [x, z] = it ? [it.b.x, it.b.z] : [view.x, view.z];
    avatar.place(x + Math.sin(YAW) * r, z + Math.cos(YAW) * r, YAW);
  }
  // rebuilds only buildings whose type, place, state or label changed; a different set of ids (a visit) re-frames
  function showTown(state) {
    const seen = new Set();
    for (const b of buildingsOf(state)) {
      seen.add(b.id);
      const key = JSON.stringify([b.type, b.x, b.z, b.rot, b.state, b.label]), it = items.get(b.id);
      if (it?.key === key) { it.b = b; continue; }
      if (it) { if (it.b.state === 'broken' && b.state !== 'broken') lastFixed = b.id; drop(it.group); }
      const group = B.makeBuilding(b);
      town.add(group);
      items.set(b.id, { key, group, b });
    }
    for (const [id, it] of items) if (!seen.has(id)) { drop(it.group); items.delete(id); }
    const ids = [...items.keys()].sort().join();
    if (ids !== idsKey) {
      idsKey = ids; lastFixed = null;
      zones.clear();
      fitTown();
      life.build(items, layoutOf(state));
      placeHome();
    } else life.refresh();
    for (const [id, { b, group }] of items) {
      const z = zones.get(id), r = Math.hypot(...group.userData.foot) / 2 + 0.5;
      if (b.state === 'broken') zones.set(id, { x: b.x, z: b.z, r, a: z ? z.a : 1, to: 1 }); // a new town starts grey at once
      else if (z) z.to = 0; // fixed: the colour comes back over about 1.5 s
    }
    for (const id of zones.keys()) if (!items.has(id)) zones.delete(id);
  }
  function updateZones(dt) {
    for (const [id, z] of zones) { z.a += (z.to - z.a) * Math.min(1, dt * 2.5); if (!z.to && z.a < 0.01) zones.delete(id); }
    const list = [...zones.values()];
    L.U.uGrey.value.forEach((u, i) => { const z = list[i]; if (z) u.set(z.x, z.z, z.r, z.a); else u.set(0, 0, 0, 0); });
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
  function project(x, y, z) {
    v.set(x, y, z).project(camera);
    const sx = (v.x + 1) / 2 * size.w, sy = (1 - v.y) / 2 * size.h;
    return { x: sx, y: sy, visible: !active && v.z < 1 && sx >= 0 && sy >= 0 && sx <= size.w && sy <= size.h };
  }
  // buildings (kind 'building') and people walking about (kind 'person'), for Lane G's bubbles
  function anchors() {
    if (!active) placeCamera();
    return [...[...items.values()].map(({ b, group }) => ({ id: b.id, kind: 'building', ...project(b.x, group.userData.h + 1, b.z) })), ...life.anchors(project)];
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

  /* ---------- input: drag pans, pinch or wheel zooms, a tap picks (or skips a walk); a running task gets the events ---------- */
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
    if (e.type === 'pointerup' && tap && !tap.moved && !pts.size) {
      if (avatar.walking) avatar.skip(); // a tap during a walk only skips it (build 02 §3.3)
      else { const id = pickAt(e); if (id !== null) emitPick(id); }
    }
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

  /* ---------- the avatar ---------- */
  // walks along roads and paths to a building's door, or up to a person; resolves once there (a tap skips to the end).
  // Resolves false at once for an unknown id.
  function walkTo(id) {
    const it = items.get(id), from = [avatar.root.position.x, avatar.root.position.z];
    let to = it ? B.door(it.b) : life.personAt(id);
    if (!to) return Promise.resolve(false);
    const face = it ? [it.b.x, it.b.z] : to;
    if (!it) { const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1, k = Math.min(1.2, d) / d; to = [to[0] - (to[0] - from[0]) * k, to[1] - (to[1] - from[1]) * k]; } // stop in front of them
    return avatar.walkPath(life.route(from, to) ?? [from, to], face);
  }
  const bounces = [];
  // 'fixed' (the building fixed last, else the avatar) | 'promotion' | 'like': confetti, a bounce, the avatar cheers
  function celebrate(kind = 'fixed') {
    const it = kind === 'fixed' ? items.get(lastFixed) : null, p = avatar.root.position;
    life.confetti(it ? [it.b.x, it.group.userData.h + 1, it.b.z] : [p.x, 2.6, p.z], kind === 'promotion' ? 170 : kind === 'like' ? 60 : 110,
      kind === 'like' ? [0xe8505b, 0xf28cb1, 0xffffff] : undefined);
    if (it) bounces.push({ g: it.group, t: 0 });
    avatar.play(kind === 'like' ? 'wave' : 'cheer');
  }
  function updateBounces(dt) {
    for (let i = bounces.length - 1; i >= 0; i--) {
      const b = bounces[i], k = Math.min(1, (b.t += dt) / 0.8), s = Math.sin(k * Math.PI * 3) * (1 - k);
      b.g.scale.set(1 - 0.08 * s, 1 + 0.2 * s, 1 - 0.08 * s);
      if (k >= 1) { b.g.scale.set(1, 1, 1); bounces.splice(i, 1); }
    }
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
  function renderTown() { placeCamera(); look.render(camera); }
  const ctx = { renderer, canvas, size, fit, scene, camera, view, items, groundAt, frameOn, placeCamera, renderTown, hud, label: B.label, mat: B.mat, outfit: A.outfitOf };

  async function playTask(kind, params = {}) {
    const file = { wall: 'wall.js', delivery: 'delivery.js' }[kind];
    if (!file) throw new Error(`Unknown task: ${kind}`);
    if (busy) throw new Error('A task is already running.');
    busy = true;
    // params.twist is the twist id ('closed_road'); match it without case or punctuation: 'closedroad'
    const tw = typeof params.twist === 'string' ? params.twist : params.twist?.id;
    params = { ...params, avatar: params.avatar ?? avatar.look, twist: tw ? String(tw).toLowerCase().replace(/[^a-z]/g, '') : null };
    avatar.skip();
    try {
      const mod = await import(`./${file}?v=${V}`);
      await mod.ready?.();
      pts.clear(); tap = null; tween = null;
      avatar.root.visible = false; // you are the one in first person, or driving the van
      return await new Promise(resolve => { active = mod.start(ctx, params, result => { active = null; resolve(result); }); });
    } finally { busy = false; avatar.root.visible = true; }
  }
  // load the wall's models in the background so the first wall task starts at once
  import(`./wall.js?v=${V}`).then(m => m.ready()).catch(e => console.warn('Wall models not preloaded:', e));

  function frame(dt) {
    t += dt;
    renderer.info.reset(); // stats() covers every pass of one frame
    if (active) { active.frame(dt); return; }
    if (tween) {
      tween.t += dt;
      const k = Math.min(1, tween.t / tween.dur), e = k * k * (3 - 2 * k);
      for (const q of ['x', 'z', 'd']) view[q] = tween.from[q] + (tween.to[q] - tween.from[q]) * e;
      if (k >= 1) tween = null;
    }
    look.update(dt);
    life.update(dt);
    avatar.update(dt);
    updateZones(dt);
    updateBounces(dt);
    renderTown();
  }

  const world = { showTown, anchors, onPick: fn => { listeners.push(fn); }, focus, playTask, frame,
    setTimeOfDay: look.setTime, setAvatar: av => avatar.set(av), walkTo, celebrate };
  // QA and console hooks (qa/acceptance.mjs and tools/smoke_world.mjs drive these)
  const screen = (x, z, y = 0) => { const p = project(x, y, z); return [p.x, p.y]; };
  window.__btmWorld = {
    world,
    tap(id) { if (!items.has(id) && !life.personAt(id)) return false; emitPick(id); return true; },
    finish(stars = 3) { if (!active) return false; active.finish(clamp(Math.round(stars), 0, 3)); return true; },
    task: () => active?.info() ?? null,
    screen, // a ground point in canvas px under the town camera
    get view() { return { x: view.x, z: view.z, d: view.d }; },
    stats: () => ({ ...renderer.info.render, buildings: items.size, time: t, quality: LOW ? 'low' : 'high' }),
    // the avatar: look, place, clip, walking, the outfit parts it shows, and where it is on screen
    avatar() { const a = avatar.info(), p = project(a.x, 2.2, a.z); return { ...a, screen: [p.x, p.y], visible: avatar.root.visible && p.visible }; },
    skipWalk() { const w = avatar.walking; avatar.skip(); return w; },
    tod: () => look.info(),
    grey: () => [...zones].map(([id, z]) => ({ id, a: +z.a.toFixed(3), to: z.to })),
    life: () => life.info(),
    lastFixed: () => lastFixed,
    // the rendered colour [r, g, b] at a ground point, read back straight after a render
    sample(x, z) {
      const [px, py] = screen(x, z);
      renderTown();
      const gl = renderer.getContext(), out = new Uint8Array(4), pr = renderer.getPixelRatio();
      gl.readPixels(Math.round(px * pr), Math.round((size.h - py) * pr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return [out[0], out[1], out[2]];
    },
  };
  return world;
}
