// First-person garden wall: Brick by Brick's rig, models and levelling mechanic, cut to 11 bricks and ≤ 90 s.
// The rules live in rules.js (tested in CI); this file is the 3D, the input and the task HUD.
// Time is only the dt that world.frame passes on from main.js's game clock (LESSONS T6).
import * as THREE from 'three';

const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const { WALL, createWall } = await import(`./rules.js?v=${V}`);
const { loadGltf } = await import(`./assets.js?v=${V}`);

const [, BD, BH] = WALL.brick, FOOT_TOP = 0.25;
const WALL_LEN = WALL.bricks * (WALL.brick[0] + WALL.headJoint) - WALL.headJoint;
const MODELS = ['brick_nf', 'brick_half', 'trowel', 'fp_arms', 'mortar_tub', 'pallet_euro', 'line_pin', 'spirit_level'];
// stand-in box (size in m, colour; origin at the bottom centre) when a model fails to load
const PLACEHOLDER = { brick_nf: [0.24, 0.071, 0.115, 0xa8432a], brick_half: [0.115, 0.071, 0.115, 0xa8432a] };
const TWISTS = {
  rain: 'Rain: the mortar goes off in 12 s.',
  cracked: 'Check each brick: one came off the pallet cracked.',
  hurry: 'The client is in a hurry: 3 stars need 35 s.',
};
const GRADES = {
  perfect: ['Perfect!', '#7cd992'], good: ['Good', '#f5c542'], rough: ['Set proud: the mortar went off', '#ff9a7a'],
  cracked: ['A cracked brick in the wall. The client will notice.', '#ff9a7a'],
};
const WET = new THREE.Color(0x8e887d), DRY = new THREE.Color(0xdcd6c9);
// elbows low and forward, forearms up into the view (Brick by Brick)
const BASE = {
  R: { p: new THREE.Vector3(0.17, -0.34, -0.1), r: new THREE.Euler(0.46, 0.16, 0) },
  L: { p: new THREE.Vector3(-0.17, -0.34, -0.1), r: new THREE.Euler(0.46, -0.16, 0) },
};

/* ---------- models: self-contained .gltf decoded in memory (LESSONS H1, assets.js) ---------- */
let M = null, loading = null;
export function ready() {
  return loading ??= Promise.all(MODELS.map(async n => {
    let root;
    try {
      root = (await loadGltf(new URL(`../../assets/models/${n}.gltf?v=${V}`, import.meta.url))).scene;
    } catch (e) {
      console.warn('Model failed, using a placeholder:', n, e);
      const [sx, sy, sz, color] = PLACEHOLDER[n] ?? [0.2, 0.2, 0.2, 0xff00ff];
      root = new THREE.Group();
      root.add(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz).translate(0, sy / 2, 0), new THREE.MeshStandardMaterial({ color })));
    }
    root.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return [n, root];
  })).then(list => { M = Object.fromEntries(list); });
}

/* ---------- the garden: built once, reset for every wall ---------- */
let site = null;
function buildSite() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, 6, 28);
  scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x5d7a3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(2.5, 6, 4);
  sun.target.position.set(WALL_LEN / 2, 0.3, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 1, far: 15 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const lambert = c => new THREE.MeshLambertMaterial({ color: c });
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
  const solid = o => { o.castShadow = o.receiveShadow = true; return o; };

  const grass = put(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), lambert(0x7fae5a)), 0, 0, 0);
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
  solid(put(new THREE.Mesh(new THREE.BoxGeometry(WALL_LEN + 0.41, FOOT_TOP, 0.36), lambert(0xa9a49b)), WALL_LEN / 2, FOOT_TOP / 2, 0));
  solid(put(new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 0.7), lambert(0x3f8f45)), WALL_LEN / 2, 0.55, -2.6)); // hedge
  const pallet = put(M.pallet_euro.clone(), -0.6, 0, 0.25, Math.PI / 2);
  const brickMesh = M.brick_nf.getObjectByProperty('isMesh', true);
  const stack = new THREE.InstancedMesh(brickMesh.geometry, brickMesh.material, 12);
  for (let k = 0; k < 12; k++) stack.setMatrixAt(k, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-0.25 + Math.floor(k / 3) * 0.125, 0.144, ((k % 3) - 1) * 0.25));
  stack.castShadow = stack.receiveShadow = true;
  pallet.add(stack);
  put(M.mortar_tub.clone(), 1.8, 0, 0.3);
  put(M.spirit_level.clone(), 1.5, 0, 0.75, 0.4);

  // the pink string line along the front of the course being laid, a line pin at each end
  const line = new THREE.Group();
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, WALL_LEN + 0.08, 6), new THREE.MeshLambertMaterial({ color: 0xff3d8b, emissive: 0x551028 }));
  str.rotation.z = Math.PI / 2; str.position.set(WALL_LEN / 2, 0, BD / 2 + 0.004);
  line.add(str);
  for (const x of [-0.04, WALL_LEN + 0.04]) { const p = M.line_pin.clone(); p.position.set(x, -0.125, BD / 2 + 0.004); line.add(p); }
  scene.add(line);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.02, 60);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const rig = new THREE.Group();
  camera.add(rig);
  const armR = M.fp_arms.getObjectByName('ArmR') || new THREE.Group(), armL = M.fp_arms.getObjectByName('ArmL') || new THREE.Group();
  const sleeveMat = new THREE.MeshLambertMaterial(), cuffMat = new THREE.MeshLambertMaterial({ color: 0xf7f4ee });
  const cuffs = [armR, armL].map(a => sleeve(a, sleeveMat, cuffMat)).filter(Boolean);
  for (const a of [armR, armL]) { a.traverse(o => { o.castShadow = false; }); rig.add(a); }
  const trowel = M.trowel;
  trowel.rotation.set(0, Math.PI / 2, -0.2); // handle through the fist (grip axis at 0.29 m), blade forward
  trowel.position.set(0, 0, -0.29);
  trowel.traverse(o => { o.castShadow = false; });
  armR.add(trowel);
  const mortarMat = new THREE.MeshLambertMaterial({ color: 0xc9c2b5 });
  const lump = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mortarMat);
  lump.scale.set(0.07, 0.022, 0.05); lump.position.set(0.24, -0.035, 0);
  trowel.add(lump);
  const hand = {};
  for (const kind of ['full', 'half']) {
    const b = (kind === 'full' ? M.brick_nf : M.brick_half).clone();
    b.rotation.y = Math.PI / 2;
    b.position.set(0, -0.012 - BH, -0.3); // hangs under the palm
    b.traverse(o => { o.castShadow = false; });
    armL.add(b); hand[kind] = b;
  }
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.008, BH + 0.003, BD + 0.003), new THREE.MeshBasicMaterial({ color: 0x1b1210 }));
  crack.position.set(0.03, BH / 2, 0); crack.rotation.y = 0.35;
  hand.full.add(crack);

  const ghostFill = new THREE.MeshBasicMaterial({ color: 0xf5b400, transparent: true, opacity: 0.25, depthWrite: false });
  const ghost = new THREE.Group();
  ghost.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghostFill));
  ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xf5b400 })));
  scene.add(ghost);
  const wall = new THREE.Group();
  scene.add(wall);

  const N = 400, drops = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = -1 + Math.random() * 3.5, y = Math.random() * 3, z = -2 + Math.random() * 3.3;
    drops.set([x, y, z, x, y - 0.09, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(drops, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xd6e6f2, transparent: true, opacity: 0.55 }));
  rain.frustumCulled = false;
  scene.add(rain);

  return { scene, camera, rig, armR, armL, lump, hand, crack, ghost, ghostFill, wall, line, rain, mortarMat, sleeveMat, cuffs, unitBox: new THREE.BoxGeometry(1, 1, 1) };
}

// a sleeve of the rank's outfit over the elbow end of a forearm (origin = elbow, hand along +y), sized from the
// arm model's own bounds; a white shirt cuff at its end shows under a jacket
function sleeve(arm, mat, cuffMat) {
  arm.updateWorldMatrix(true, true);
  const inv = arm.matrixWorld.clone().invert(), box = new THREE.Box3();
  arm.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); } });
  if (box.isEmpty()) return null;
  const s = box.getSize(new THREE.Vector3()), r = Math.max(s.x, s.z) / 2, len = s.y * 0.45;
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.1, len, 12), mat);
  cloth.position.set((box.min.x + box.max.x) / 2, box.min.y + len / 2, (box.min.z + box.max.z) / 2);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, len * 0.14, 12), cuffMat);
  cuff.position.y = len * 0.5;
  cloth.add(cuff);
  arm.add(cloth);
  return cuff;
}

/* ---------- one wall task ---------- */
export function start(ctx, params, done) {
  site ??= buildSite();
  const S = site, cam = S.camera;
  const twist = TWISTS[params.twist] ? params.twist : null;
  if (params.twist && !twist) console.warn('Unknown wall twist, playing without one:', params.twist);
  const game = createWall(twist), slots = game.slots;
  const slotY = sl => FOOT_TOP + sl.y;
  let t = 0, down = null, ended = null, closed = false, shake = 0, flashMsg = null;
  const view = { yaw: 0, pitch: -0.9 }, anims = [], beds = new Map(), bricks = new Map();

  // your sleeves: the outfit of your rank (params.avatar, build 02 §3.2)
  const outfit = ctx.outfit(params.avatar);
  S.sleeveMat.color.setHex(outfit.sleeve);
  for (const c of S.cuffs) c.visible = !!outfit.cuff;

  // reset the garden from the last wall
  for (const o of [...S.wall.children]) { S.wall.remove(o); o.traverse(m => { if (m.isMesh && m.material !== S.mortarMat) m.material.dispose(); }); }
  S.rain.visible = twist === 'rain';
  S.scene.background.setHex(twist === 'rain' ? 0x8e9dab : 0xbfd8e8);
  S.scene.fog.color.copy(S.scene.background);
  S.rig.position.y = 0;
  const lineY = c => slotY(slots.find(sl => sl.course === c)) + BH;
  S.line.position.y = lineY(0);
  let lineTarget = lineY(0);

  // the task HUD: a line of text over the canvas, and a swap button for the cracked twist
  const el = ctx.hud(), row = style => { const d = document.createElement('div'); d.style.cssText = style; el.appendChild(d); return d; };
  const titleEl = row(''), twistEl = row('color:#ffd76a;font-size:14px'), hintEl = row('margin-top:6px');
  const swapBtn = document.createElement('button');
  swapBtn.textContent = 'Swap it for a good brick';
  swapBtn.style.cssText = 'pointer-events:auto;margin-top:8px;padding:8px 14px;font:600 15px system-ui,sans-serif;border:0;border-radius:8px;background:#f5b400;color:#1e2226;cursor:pointer';
  swapBtn.hidden = true;
  swapBtn.onclick = () => handle(game.swap());
  el.appendChild(swapBtn);
  twistEl.textContent = twist ? TWISTS[twist] : '';
  const setText = (node, s) => { if (node.textContent !== s) node.textContent = s; };
  const flash = (text, color) => { flashMsg = { text, color, until: t + 1.4 }; };

  /* bricks and mortar (Brick by Brick) */
  function newBrick(sl, cracked) {
    const b = (sl.kind === 'half' ? M.brick_half : M.brick_nf).clone();
    b.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone(); // real walls vary in tone: some bricks fired darker, some paler
      const k = (cracked ? 0.55 : 0.82) + Math.random() * 0.28;
      o.material.color.setRGB(k, k * (0.9 + Math.random() * 0.12), k * (0.88 + Math.random() * 0.12));
    });
    if (cracked) { const c = S.crack.clone(); c.material = S.crack.material.clone(); c.visible = true; b.add(c); }
    return b;
  }
  function bedFor(i, extraMM, fresh) {
    const sl = slots[i];
    let b = beds.get(i);
    if (!b) {
      const mesh = new THREE.Mesh(S.unitBox, new THREE.MeshLambertMaterial({ color: WET.clone() }));
      mesh.castShadow = mesh.receiveShadow = true;
      b = { mesh, at: t };
      beds.set(i, b); S.wall.add(mesh);
    }
    if (fresh) b.at = t;
    const h = Math.max(0.004, WALL.bedJoint + extraMM / 1000);
    b.mesh.scale.set(sl.len + 0.006, h, BD - 0.012);
    b.mesh.position.set(sl.x, slotY(sl) - WALL.bedJoint + h / 2, 0);
  }
  // a, b = height of the left and right end above the line (mm); the tilt is drawn 3x so you can see it
  function setBrickHeight(i, a, b) {
    const sl = slots[i], brick = bricks.get(i), mid = (a + b) / 2;
    brick.position.set(sl.x, slotY(sl) + mid / 1000, 0);
    brick.rotation.set(0, 0, Math.atan((b - a) / 1000 * 3 / sl.len));
    bedFor(i, mid);
  }
  function headJoint(i) {
    const sl = slots[i];
    if (!sl.joint) return;
    const m = new THREE.Mesh(S.unitBox, S.mortarMat);
    m.scale.set(WALL.headJoint, BH, BD - 0.012);
    m.position.set(sl.x - sl.len / 2 - WALL.headJoint / 2, slotY(sl) + BH / 2, 0);
    S.wall.add(m);
  }
  function layBrick(i, cracked) {
    const b = newBrick(slots[i], cracked);
    bricks.set(i, b); S.wall.add(b);
    bedFor(i, 6, true);
  }

  const play = (arm, kind, dur) => anims.push({ arm, kind, t0: t, dur });
  function armPose(name, arm, spread) {
    const p = BASE[name].p.clone(), r = BASE[name].r.clone();
    p.x *= spread;
    for (const a of anims) {
      if (a.arm !== name) continue;
      const k = (t - a.t0) / a.dur;
      if (k < 0 || k > 1) continue;
      const s = Math.sin(Math.PI * k), jab = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
      if (a.kind === 'spread') { p.x -= 0.1 * Math.sin(2 * Math.PI * k); p.z -= 0.08 * s; r.z += 0.35 * s; }
      if (a.kind === 'tap') { p.y -= 0.04 * jab; r.x -= 0.35 * jab; }
      if (a.kind === 'knock') { p.y -= 0.08 * jab; r.x -= 0.7 * jab; }
      if (a.kind === 'reach') { p.z -= 0.14 * s; p.y -= 0.06 * s; }
    }
    arm.position.copy(p); arm.rotation.copy(r);
  }

  // turn a rules event into visuals and HUD
  function handle(ev) {
    if (!ev.ok) { flash(ev.msg, '#ff9a7a'); return; }
    if (ev.event === 'placed') {
      layBrick(ev.slot, ev.cracked);
      setBrickHeight(ev.slot, ev.a, ev.b);
      play('R', 'spread', 0.45); play('L', 'reach', 0.38);
    }
    if (ev.event === 'swapped') { play('L', 'reach', 0.38); flash('Good brick. The cracked one goes in the skip.', '#7cd992'); }
    if (ev.event === 'hit' || ev.event === 'sunk' || (ev.event === 'set' && !ev.proud)) {
      play('R', ev.knock ? 'knock' : 'tap', ev.knock ? 0.26 : 0.18);
      shake = ev.knock ? 0.006 : 0.002;
    }
    if (ev.event === 'hit' || ev.event === 'sunk') setBrickHeight(ev.slot, ev.a, ev.b);
    if (ev.event === 'sunk') flash('Too low! Lifted and bedded again.', '#ff9a7a');
    if (ev.event === 'set') {
      setBrickHeight(ev.slot, ev.a, ev.b);
      headJoint(ev.slot);
      flash(...GRADES[ev.grade]);
      if (ev.course !== undefined && !ev.done) lineTarget = lineY(ev.course + 1);
      if (ev.done) end();
    }
    if (ev.event === 'timeout') {
      // time is up: the foreman lays the rest, so the wall always gets finished
      for (let i = ev.from; i < slots.length; i++) { if (!bricks.has(i)) layBrick(i, false); setBrickHeight(i, 0, 0); headJoint(i); }
      flash('Time! The foreman lays the last bricks.', '#f5c542');
      end();
    }
  }

  function end() {
    ended = { stars: game.stars(), seconds: game.state.seconds, t: 0, from: { pos: cam.position.clone(), pitch: view.pitch } };
    down = null;
  }
  function close(result) {
    if (closed) return;
    closed = true;
    el.remove();
    done(result);
  }

  /* screen-space intent (LESSONS T8): where along the brick a tap lies, 0 = left end, 1 = right end */
  const proj = (x, y, z) => { const p = new THREE.Vector3(x, y, z).project(cam); return [(p.x + 1) / 2 * ctx.size.w, (1 - p.y) / 2 * ctx.size.h]; };
  function alongBrick(px, py) {
    const sl = slots[game.state.cur], y = slotY(sl) + BH;
    const [x0, y0] = proj(sl.x - sl.len / 2, y, BD / 2), [x1, y1] = proj(sl.x + sl.len / 2, y, BD / 2);
    const dx = x1 - x0, dy = y1 - y0;
    return Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1)));
  }
  function act(hold, u) {
    const a = game.next();
    if (a === 'lay') handle(game.lay(t));
    else if (a === 'level') handle(game.hit(hold, u, t));
  }

  // touch and narrow screens: turn towards the brick you're on when it drifts off the middle
  function follow(dt) {
    const sl = slots[Math.min(game.state.cur, slots.length - 1)];
    const p = new THREE.Vector3(sl.x, slotY(sl), 0).project(cam);
    if (Math.abs(p.x) < 0.55 && p.z < 1) return;
    const want = Math.atan2(-(sl.x - cam.position.x), cam.position.z);
    view.yaw += Math.atan2(Math.sin(want - view.yaw), Math.cos(want - view.yaw)) * Math.min(1, dt * 3);
  }

  function updateHud() {
    el.place();
    const laid = game.state.results.length, next = game.next(), st = game.state.setting;
    setText(titleEl, `${params.title ?? 'Garden wall'} · ${laid} / ${slots.length} bricks · ${Math.floor(Math.min(t, WALL.limit))} s of ${WALL.limit}`);
    let hint = '', color = '#fff';
    if (ended) hint = `${'★'.repeat(ended.stars)}${'☆'.repeat(3 - ended.stars)}`;
    else if (flashMsg && t < flashMsg.until) ({ text: hint, color } = flashMsg);
    else if (next === 'lay') hint = game.state.hand === 'cracked' ? 'This brick is cracked. Swap it, or lay it anyway.' : laid ? 'Tap to lay the next brick.' : 'Tap to lay a brick on fresh mortar.';
    else if (next === 'level' && down) {
      const held = t - down.t, mm = WALL.mm;
      hint = held < WALL.holdForKnock ? 'Light tap' : `Knock ~${Math.min(mm.knock[1], mm.knock[0] + (held - WALL.holdForKnock) * mm.knockPerSec).toFixed(1)} mm`;
    } else if (next === 'level') {
      const f = mm => `${mm >= 0 ? '+' : '−'}${Math.abs(mm).toFixed(1)}`, left = game.mortarLeft(t);
      hint = `Left ${f(st.a)} · right ${f(st.b)} mm over the line. Tap the high end, hold to knock.${left < 6 ? ` Mortar sets in ${Math.ceil(left)} s!` : ''}`;
    }
    setText(hintEl, hint);
    hintEl.style.color = color;
    swapBtn.hidden = !!ended || next !== 'lay' || game.state.hand !== 'cracked';
  }

  function frame(dt) {
    t += dt;
    if (!ended) for (const ev of game.tick(t)) handle(ev);
    ctx.fit(cam);
    const fov = cam.aspect < 1 ? 82 : 70;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const home = new THREE.Vector3(WALL_LEN / 2, 1.5, cam.aspect < 0.8 ? 1.45 : 0.95);
    if (ended) {
      // admire: hands down, step back to see the whole wall, then hand back to the town
      ended.t += dt;
      const k = Math.min(1, ended.t / 1.2), e = k * k * (3 - 2 * k);
      cam.position.lerpVectors(ended.from.pos, new THREE.Vector3(WALL_LEN / 2, 1.9, home.z + 1.3), e);
      view.pitch = ended.from.pitch + (-0.5 - ended.from.pitch) * e;
      view.yaw *= 1 - e;
      S.rig.position.y = -0.45 * e;
      if (ended.t >= 2) { close({ stars: ended.stars, seconds: ended.seconds }); return; }
    } else {
      cam.position.copy(home);
      follow(dt);
    }
    shake *= 0.85;
    cam.rotation.set(view.pitch + (Math.random() - 0.5) * shake, view.yaw + (Math.random() - 0.5) * shake, 0);
    const spread = Math.max(0.55, Math.min(1, cam.aspect * 0.8)); // arms move in on portrait screens
    armPose('R', S.armR, spread); armPose('L', S.armL, spread);
    for (let i = anims.length - 1; i >= 0; i--) if (t - anims[i].t0 > anims[i].dur) anims.splice(i, 1);

    const next = game.next(), sl = slots[game.state.cur];
    S.ghost.visible = next === 'lay';
    if (sl) { S.ghost.scale.set(sl.len + 0.004, BH + 0.004, BD + 0.004); S.ghost.position.set(sl.x, slotY(sl) + BH / 2, 0); }
    S.ghostFill.opacity = 0.18 + 0.12 * Math.sin(t * 3.3);
    S.hand.full.visible = next === 'lay' && sl?.kind === 'full';
    S.hand.half.visible = next === 'lay' && sl?.kind === 'half';
    S.crack.visible = game.state.hand === 'cracked';
    S.lump.visible = next === 'lay';
    for (const b of beds.values()) { const k = Math.min(1, (t - b.at) / game.open); if (b.k !== k) { b.k = k; b.mesh.material.color.copy(WET).lerp(DRY, k); } }
    S.line.position.y += (lineTarget - S.line.position.y) * Math.min(1, dt * 5);
    if (S.rain.visible) {
      const p = S.rain.geometry.attributes.position, a = p.array;
      for (let i = 0; i < a.length; i += 6) { let y = a[i + 1] - 6 * dt; if (y < 0) y += 3; a[i + 1] = y; a[i + 4] = y - 0.09; }
      p.needsUpdate = true;
    }
    updateHud();
    ctx.renderer.render(S.scene, cam);
  }

  const local = e => { const r = ctx.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return {
    frame,
    down(e) {
      if (ended || down || e.button > 0) return;
      try { ctx.canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
      const [x, y] = local(e);
      down = { id: e.pointerId, t, u: game.next() === 'level' ? alongBrick(x, y) : 0.5 };
    },
    up(e) {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      if (!ended && e.type === 'pointerup') act(t - d.t, d.u);
    },
    finish(stars) { close({ stars, seconds: Math.min(t, WALL.limit) }); },
    // aim: the current brick's top front middle in canvas px, for QA bots
    info: () => ({ kind: 'wall', twist, t, sleeve: S.sleeveMat.color.getHex(), cuffs: S.cuffs.length, next: game.next(), aim: slots[game.state.cur] ? proj(slots[game.state.cur].x, slotY(slots[game.state.cur]) + BH, BD / 2) : null, laid: game.state.results.length, total: slots.length, hand: game.state.hand, setting: game.state.setting && { a: game.state.setting.a, b: game.state.setting.b } }),
  };
}
