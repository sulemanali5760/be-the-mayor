// Delivery: in the town view, draw the van's route through 3-4 stops before the 45 s run out.
// Twist: a closed road across the most direct leg. The rules (drive, tour, stars) live in rules.js.
// Time is only the dt that world.frame passes on from main.js's game clock (LESSONS T6).
import * as THREE from 'three';

const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const { DELIVERY: D, box, inBox, distToBox, drive, bestTour, deliveryStars } = await import(`./rules.js?v=${V}`);

const SKIP = new Set(['tree', 'streetlight']); // not somewhere a parcel goes
const DOT = 1, MAX_DOTS = 400;                 // route dots every metre, at most 400 m of route queued
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

// the ground point 2 m in front of a building's door (front is +z, turned by the group's rotation)
function front({ b, group }) {
  const a = group.rotation.y, r = group.userData.foot[1] / 2 + 2;
  return [b.x + Math.sin(a) * r, b.z + Math.cos(a) * r];
}
const footBox = ({ b, group }, pad = 0) => box(b.x, b.z, group.userData.foot[0] / 2 + pad, group.userData.foot[1] / 2 + pad, group.rotation.y);

export function start(ctx, params, done) {
  const M = ctx.mat, own = []; // own: geometries and materials made here, disposed at the end
  const geo = g => (own.push(g), g), mine = m => (own.push(m), m);
  const pool = [...ctx.items.values()].filter(it => !SKIP.has(it.group.userData.type));
  const closed = /closed|road/.test(params.twist ?? '');
  if (params.twist && !closed) console.warn('Unknown delivery twist, playing without one:', params.twist);

  // where the van starts, and the stops: params.stops is a list of building ids or a count (3-4)
  const home = ctx.items.get(params.from) ?? pool.find(it => it.group.userData.type === 'cafe') ?? pool[0];
  const want = Math.max(3, Math.min(4, Array.isArray(params.stops) ? params.stops.length : Number.isFinite(params.stops) ? params.stops : params.count ?? 3));
  const picked = (Array.isArray(params.stops) ? params.stops : []).map(id => ctx.items.get(id)).filter(it => it && it !== home);
  const rest = pool.filter(it => it !== home && !picked.includes(it)).sort(() => Math.random() - 0.5);
  const stops = [...picked, ...rest].slice(0, want).map(it => ({ id: it.b.id, at: front(it), foot: footBox(it), done: false }));
  const origin = home ? front(home) : [ctx.view.x, ctx.view.z];
  const best = bestTour(origin, stops.map(s => s.at));

  // the van can't drive through solid buildings (with a 1 m margin) or the closed road
  const obstacles = [...ctx.items.values()].filter(it => it.group.userData.solid).map(it => footBox(it, D.margin));
  const group = new THREE.Group();
  ctx.scene.add(group);
  let barrier = null;
  if (closed) {
    // across the longest leg of a nearest-first tour, where it isn't on top of a stop
    const pts = [origin], left = stops.map(s => s.at);
    while (left.length) { const last = pts[pts.length - 1]; left.sort((p, q) => dist(p, last) - dist(q, last)); pts.push(left.shift()); }
    const legs = pts.slice(1).map((q, i) => [pts[i], q]).sort((a, b) => dist(...b) - dist(...a));
    const leg = legs.find(([p, q]) => { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; return pts.every(s => dist(s, m) > 6); });
    if (leg) {
      const [p, q] = leg, rot = Math.atan2(q[0] - p[0], q[1] - p[1]); // the barrier's local z runs along the road
      barrier = box((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 7, 0.4, rot);
      obstacles.push(barrier);
      const bg = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const seg = new THREE.Mesh(geo(new THREE.BoxGeometry(2, 1, 0.3)), M(i % 2 ? 'white' : 'red'));
        seg.position.set(-6 + i * 2, 0.9, 0); bg.add(seg);
      }
      for (const x of [-6.5, 6.5]) { const leg2 = new THREE.Mesh(geo(new THREE.BoxGeometry(0.2, 0.9, 0.8)), M('metal')); leg2.position.set(x, 0.45, 0); bg.add(leg2); }
      const tag = ctx.label('Road closed', 3.2);
      bg.add(tag);
      own.push(tag.material.map, tag.material);
      bg.position.set(barrier.cx, 0, barrier.cz);
      bg.rotation.y = rot;
      group.add(bg);
    } else console.warn('No room for the closed road in this town.');
  }

  // the van: white box body, yellow cab, four wheels; front is +z
  const van = new THREE.Group();
  const part = (g, m, x, y, z) => { const o = new THREE.Mesh(geo(g), M(m)); o.position.set(x, y, z); o.castShadow = true; van.add(o); return o; };
  part(new THREE.BoxGeometry(2.2, 2, 3), 'white', 0, 1.4, -0.6);
  part(new THREE.BoxGeometry(2.2, 1.4, 1.4), 'yellow', 0, 1.1, 1.6);
  for (const [x, z] of [[-1.1, -1.4], [1.1, -1.4], [-1.1, 1.4], [1.1, 1.4]]) part(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 8), 'dark', x, 0.45, z).rotation.z = Math.PI / 2;
  van.position.set(origin[0], 0, origin[1]);
  group.add(van);

  // a bouncing cone over each stop; it turns green and sinks once the parcel is in
  const coneGeo = geo(new THREE.ConeGeometry(0.9, 1.8, 8).rotateX(Math.PI)), ringGeo = geo(new THREE.RingGeometry(D.reach - 0.3, D.reach, 24).rotateX(-Math.PI / 2));
  const todo = mine(new THREE.MeshLambertMaterial({ color: 0xf5b400, emissive: 0x6b4a00 })), doneMat = mine(new THREE.MeshLambertMaterial({ color: 0x3fbf5f }));
  const ringMat = mine(new THREE.MeshBasicMaterial({ color: 0xf5b400, transparent: true, opacity: 0.7, depthWrite: false }));
  for (const s of stops) {
    s.cone = new THREE.Mesh(coneGeo, todo);
    s.ring = new THREE.Mesh(ringGeo, ringMat);
    s.cone.position.set(s.at[0], 4, s.at[1]); s.ring.position.set(s.at[0], 0.12, s.at[1]);
    group.add(s.cone, s.ring);
  }

  // the route still to drive: a dot every metre on the ground
  const dots = new THREE.InstancedMesh(geo(new THREE.CircleGeometry(0.35, 6).rotateX(-Math.PI / 2)), mine(new THREE.MeshBasicMaterial({ color: 0x1e88e5 })), MAX_DOTS);
  dots.count = 0; dots.frustumCulled = false;
  group.add(dots);
  const m4 = new THREE.Matrix4();

  // frame the van and every stop; the player's own view comes back afterwards
  const saved = { x: ctx.view.x, z: ctx.view.z, d: ctx.view.d };
  const all = [origin, ...stops.map(s => s.at)], xs = all.map(p => p[0]), zs = all.map(p => p[1]);
  ctx.frameOn((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 8);

  const el = ctx.hud(), row = style => { const d = document.createElement('div'); d.style.cssText = style; el.appendChild(d); return d; };
  const titleEl = row(''), twistEl = row('color:#ffd76a;font-size:14px'), hintEl = row('margin-top:6px');
  twistEl.textContent = barrier ? 'A road is closed: find a way round.' : '';

  let t = 0, pos = origin.slice(), path = [], pathLen = 0, drawing = null, ended = null, closedDone = false;
  const delivered = () => stops.filter(s => s.done).length;

  function addPoint(e) {
    const p = ctx.groundAt(e);
    if (!p || path.length >= MAX_DOTS) return;
    if (dist(p, path[path.length - 1] ?? pos) >= DOT) path.push(p);
  }
  function drivePath(dt) {
    let budget = D.speed * dt;
    for (let n = 0; n < 50 && budget > 1e-4 && path.length; n++) {
      const obs = obstacles.filter(o => !inBox(pos, o)); // never stuck inside a box it started in
      const next = drive(pos, path[0], obs, budget), moved = dist(pos, next);
      if (moved > 1e-3) van.rotation.y = Math.atan2(next[0] - pos[0], next[1] - pos[1]);
      pos = next; pathLen += moved; budget -= moved;
      if (dist(pos, path[0]) < 0.3 || moved < 1e-3) path.shift(); // reached it, or blocked: try the next point
    }
    van.position.set(pos[0], 0, pos[1]);
    for (const s of stops) if (!s.done && distToBox(pos, s.foot) <= D.reach) { s.done = true; s.cone.material = doneMat; }
  }
  function end() {
    const seconds = Math.min(t, D.limit), stars = deliveryStars({ delivered: delivered(), total: stops.length, pathLen, best, seconds });
    ended = { stars, seconds, t: 0 };
    drawing = null; path = [];
  }
  function close(result) {
    if (closedDone) return;
    closedDone = true;
    el.remove();
    ctx.scene.remove(group);
    for (const o of own) o.dispose();
    Object.assign(ctx.view, saved);
    ctx.placeCamera();
    done(result);
  }

  function frame(dt) {
    t += dt;
    if (ended) {
      ended.t += dt;
      if (ended.t >= 1.5) { close({ stars: ended.stars, seconds: ended.seconds }); return; }
    } else {
      drivePath(dt);
      if (delivered() === stops.length || t >= D.limit) end();
    }
    for (const s of stops) {
      s.cone.position.y = s.done ? Math.max(0.9, s.cone.position.y - dt * 6) : 4 + 0.4 * Math.sin(t * 4);
      s.ring.visible = !s.done;
    }
    const route = [pos, ...path];
    dots.count = path.length;
    for (let i = 0; i < path.length; i++) dots.setMatrixAt(i, m4.makeTranslation(route[i + 1][0], 0.15, route[i + 1][1]));
    dots.instanceMatrix.needsUpdate = true;

    el.place();
    const txt = `${params.title ?? 'Deliveries'} · ${delivered()} / ${stops.length} stops · ${Math.floor(Math.min(t, D.limit))} s of ${D.limit}`;
    if (titleEl.textContent !== txt) titleEl.textContent = txt;
    const hint = ended ? `${'★'.repeat(ended.stars)}${'☆'.repeat(3 - ended.stars)}`
      : t < 0.5 && !path.length ? 'Drag from the van to draw its route through every yellow stop.'
        : path.length || drawing ? '' : 'Draw the next part of the route.';
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
    ctx.renderTown();
  }

  return {
    frame,
    down(e) {
      if (ended || drawing || e.button > 0) return;
      try { ctx.canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
      drawing = e.pointerId;
      path = []; // a new stroke replaces the route not yet driven
      addPoint(e);
    },
    move(e) { if (e.pointerId === drawing) addPoint(e); },
    up(e) { if (e.pointerId === drawing) drawing = null; },
    finish(stars) { close({ stars, seconds: Math.min(t, D.limit) }); },
    info: () => ({ kind: 'delivery', twist: barrier ? 'closed' : null, t, van: pos.slice(), queued: path.length, pathLen, best,
      delivered: delivered(), total: stops.length, stops: stops.map(s => ({ id: s.id, x: s.at[0], z: s.at[1], done: s.done })),
      barrier: barrier && { x: barrier.cx, z: barrier.cz, rot: barrier.rot } }),
  };
}
