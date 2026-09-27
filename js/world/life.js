// Town life (build 02 §3.2): roads and paths, trees that sway, props that appear once their area is fixed, named
// citizens walking routines on the path graph, cars looping on roads, birds, and confetti. Every kind of thing is
// one instanced draw call; time is only frame's dt (LESSONS T6).
import * as THREE from 'three';

const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const L = await import(`./look.js?v=${V}`);
const R = await import(`./rules.js?v=${V}`);
const B = await import(`./buildings.js?v=${V}`);
const K = await import(`./assets.js?v=${V}`);

// Lane A's kit models for props, trees and cars (docs/ASSETS.md); a prop type is one or more models [id, x, z]
const PROP_KIT = { bench: [['bench']], fence: [['fence']], lamp: [['streetlight']], bush: [['potted_bush']],
  flowers: [['flower_red', -0.4, 0], ['flower_yellow', 0, 0.12], ['flower_purple', 0.4, 0]] };
const TREE_KIT = ['tree', 'tree_oak', 'tree_pine', 'tree_fat'];
const CAR_KIT = ['car_hatchback', 'car_sedan', 'car_stationwagon'];
export const KIT = [...new Set([...Object.values(PROP_KIT).flat().map(([id]) => id), ...TREE_KIT, ...CAR_KIT])];

const ROAD_W = 5, PATH_W = 2, LANE = 1.3, MAX_PEOPLE = 12, CARS = 3, BIRDS = 5, CONFETTI = 180; // widths as in docs/GDD.md
const P = L.piece;
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;
const ANIMAL = /dog|dachshund|goat|cat\b|horse|parrot/i;
const SHIRTS = [0xe8505b, 0x3f7fbf, 0xf2c14e, 0x5bb07a, 0xb58cf2, 0xf28c4b, 0x4fb3bf, 0xe9e4da];
const TROUSERS = [0x3d4f66, 0x5a4a3a, 0x2f3b4a, 0x6b7a8c, 0x3a3f4a];
const SKIN = [0xf6d7bd, 0xe8b894, 0xc98f63, 0x9c6440, 0x6b4128];
const CAR = [0xd9453b, 0x3f7fbf, 0xf2c14e, 0x5bb07a];

// prop models by type (data/town.json `props`); unknown types draw a bush
const PROPS = {
  flowers: () => [P(new THREE.BoxGeometry(1.1, 0.35, 0.5), 0x8a5a33, 0, 0.175, 0),
    ...[0xe8505b, 0xf2c14e, 0xf28cb1].map((c, i) => P(new THREE.IcosahedronGeometry(0.2, 0), c, (i - 1) * 0.35, 0.45, 0))],
  bench: () => [P(new THREE.BoxGeometry(1.6, 0.08, 0.45), 0x9a6a3f, 0, 0.45, 0), P(new THREE.BoxGeometry(1.6, 0.35, 0.06), 0x9a6a3f, 0, 0.7, -0.2),
    ...[-0.7, 0.7].map(x => P(new THREE.BoxGeometry(0.08, 0.45, 0.4), 0x4a525a, x, 0.225, 0))],
  lamp: () => [P(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 6), 0x4a525a, 0, 1.6, 0), P(new THREE.SphereGeometry(0.25, 8, 6), 0xfff2b0, 0, 3.35, 0, 0, 1)],
  bin: () => [P(new THREE.CylinderGeometry(0.28, 0.24, 0.8, 8), 0x3f7a4a, 0, 0.4, 0)],
  fence: () => [...[-0.9, 0, 0.9].map(x => P(new THREE.BoxGeometry(0.1, 0.8, 0.1), 0xf1e3c8, x, 0.4, 0)),
    ...[0.3, 0.6].map(y => P(new THREE.BoxGeometry(2, 0.08, 0.06), 0xf1e3c8, 0, y, 0))],
  bush: () => [P(new THREE.IcosahedronGeometry(0.7, 0).scale(1, 0.75, 1), 0x4f9a4c, 0, 0.5, 0)],
};
// props every fixed building gets, in its own frame (front +z): [type, x, z, turn]; w, d = footprint
const AUTO = {
  flowers: (w, d) => [[-(w / 2 - 0.8), d / 2 + 0.6], [w / 2 - 0.8, d / 2 + 0.6]],
  bench: (w, d, t) => (['cafe', 'shop', 'park', 'busstop'].includes(t) ? [[-(w / 2) + 1.3, d / 2 + 1.7]] : []),
  lamp: (w, d, t) => (['townhall', 'school'].includes(t) ? [[-(w / 2 + 0.8), d / 2 + 1], [w / 2 + 0.8, d / 2 + 1]] : []),
};
const NO_AUTO = new Set(['tree', 'streetlight', 'bridge', 'statue']);

const up = new THREE.Vector3(0, 1, 0), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), q = new THREE.Quaternion();
const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), col = new THREE.Color();
function put(mesh, i, x, y, z, ry = 0, s = 1) { mesh.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.setFromAxisAngle(up, ry), s3.setScalar(s))); }
function instanced(geo, mat, n, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  m.count = n;
  m.visible = n > 0; // an empty InstancedMesh still costs a draw call
  m.frustumCulled = false; // instances move; the whole town is on screen anyway
  m.castShadow = shadow;
  return m;
}
// the polyline shifted d metres to its right (drive on the right)
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - dz / l * d, p[1] + dx / l * d];
  });
}
const valid = line => Array.isArray(line) && line.length >= 2 && line.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));

export function createLife(scene, content = {}) {
  const group = new THREE.Group();
  group.name = 'life';
  scene.add(group);
  const mats = {
    road: L.town({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    tree: L.town({ vertexColors: true }, { wind: true }),
    body: L.toon(), head: L.toon({ vertexColors: true }), car: L.toon({ vertexColors: true }),
    bird: new THREE.MeshBasicMaterial({ color: 0x2b2f36, side: THREE.DoubleSide }),
    confetti: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  };
  const geos = {
    tree: L.bake([P(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 5), 0x7a5234, 0, 0.8, 0), P(new THREE.IcosahedronGeometry(1.3, 0), 0x4f9f4a, 0, 2.3, 0),
      P(new THREE.IcosahedronGeometry(0.9, 0), 0x67b457, 0.2, 3.2, 0.1)], false),
    torso: new THREE.CapsuleGeometry(0.24, 0.36, 2, 7).translate(0, 1.1, 0), // low-poly: 12 citizens, twice with shadows
    leg: new THREE.CapsuleGeometry(0.09, 0.52, 1, 5).translate(0, -0.35, 0),
    head: L.bake([P(new THREE.SphereGeometry(0.26, 8, 6), 0xffffff, 0, 1.76, 0),
      P(new THREE.SphereGeometry(0.27, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-0.3), 0x5a3a22, 0, 1.79, -0.02)], false),
    car: L.bake([P(new THREE.BoxGeometry(1.9, 0.75, 3.8), 0xffffff, 0, 0.7, 0), P(new THREE.BoxGeometry(1.7, 0.7, 2), 0xffffff, 0, 1.4, -0.25),
      P(new THREE.BoxGeometry(1.74, 0.34, 2.04), 0x2a3440, 0, 1.45, -0.25),
      ...[[-0.95, 1.2], [0.95, 1.2], [-0.95, -1.2], [0.95, -1.2]].map(([x, z]) => P(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10).rotateZ(Math.PI / 2), 0x22262b, x, 0.36, z)),
      ...[-0.6, 0.6].map(x => P(new THREE.BoxGeometry(0.34, 0.16, 0.05), 0xfff2b0, x, 0.8, 1.9))], false),
    bird: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      [0, 0, 0.25, 0, 0, -0.15, -0.65, 0.25, 0, 0, 0, 0.25, 0.65, 0.25, 0, 0, 0, -0.15], 3)),
    confetti: new THREE.PlaneGeometry(0.3, 0.18),
    props: {},
  };
  const propGeo = t => (geos.props[t] ??= L.bake(PROPS[t](), true));
  // the kit's scenes (id → scene) once world.js has loaded them; their meshes as instancing parts
  let kit = null;
  const partsOf = new Map();
  const kitParts = id => (kit?.has(id) ? partsOf.get(id) ?? partsOf.set(id, K.parts(kit.get(id))).get(id) : null);

  // confetti lives across towns
  const conf = instanced(geos.confetti, mats.confetti, CONFETTI, false);
  conf.count = 0; conf.visible = false;
  for (let i = 0; i < CONFETTI; i++) conf.setColorAt(i, col.set(0xffffff));
  scene.add(conf);
  let bits = [];

  let T = null; // this town's life
  let clock = 0;

  /* ---------- build: once per town (a new set of building ids) ---------- */
  function clear() {
    if (!T) return;
    for (const o of [...group.children]) { group.remove(o); if (o.isInstancedMesh) o.dispose(); else o.geometry.dispose(); }
    T = null;
  }
  function build(items, layout = {}) {
    clear();
    const list = [...items.values()];
    if (!list.length) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const { b, group: g } of list) {
      const r = Math.hypot(...g.userData.foot) / 2;
      x0 = Math.min(x0, b.x - r); x1 = Math.max(x1, b.x + r); z0 = Math.min(z0, b.z - r); z1 = Math.max(z1, b.z + r);
    }
    let roads = (layout.roads || []).filter(valid), ring = false;
    const paths = (layout.paths || []).filter(valid);
    if (!roads.length) { // no road data (0.1 town, seed towns): a ring road round the town
      const m = 7;
      roads = [[[x0 - m, z0 - m], [x1 + m, z0 - m], [x1 + m, z1 + m], [x0 - m, z1 + m], [x0 - m, z0 - m]]];
      ring = true;
    }
    for (const l of [...roads, ...paths]) for (const [x, z] of l) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const lanes = [...roads.map(pts => ({ pts, w: ROAD_W })), ...paths.map(pts => ({ pts, w: PATH_W }))];
    const walls = list.filter(it => it.group.userData.solid).map(({ b, group: g }) => R.box(b.x, b.z, g.userData.foot[0] / 2 + 0.4, g.userData.foot[1] / 2 + 0.4, g.rotation.y));
    const grid = R.navGrid([x0 - 6, x1 + 6, z0 - 6, z1 + 6], walls, lanes);
    const rand = rng(hash(list.map(it => it.b.id).sort().join()));

    // roads, paths and centre-line dashes: one baked mesh
    const pieces = [];
    const ribbon = (pts, w, c, y) => pts.forEach((p, i) => {
      pieces.push(P(new THREE.CircleGeometry(w / 2, 12).rotateX(-Math.PI / 2), c, p[0], y, p[1]));
      if (!i) return;
      const a = pts[i - 1], dx = p[0] - a[0], dz = p[1] - a[1], len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
      pieces.push(P(new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2), c, (a[0] + p[0]) / 2, y, (a[1] + p[1]) / 2, ry));
      if (w === ROAD_W) for (let s = 1.5; s < len - 1; s += 3.5) pieces.push(P(new THREE.PlaneGeometry(0.16, 1.4).rotateX(-Math.PI / 2), 0xf4f1e8, a[0] + dx * s / len, y + 0.01, a[1] + dz * s / len, ry));
    });
    for (const pts of paths) ribbon(pts, PATH_W, 0xdcc79c, 0.035);
    for (const pts of roads) ribbon(pts, ROAD_W, 0x9da3a8, 0.03);
    const ground = new THREE.Mesh(L.bake(pieces, false), mats.road);
    ground.receiveShadow = true;
    group.add(ground);

    const nearLane = (x, z, pad) => lanes.some(l => l.pts.some((a, i) => i > 0 && R.distToBox([x, z], segBox(l.pts[i - 1], a, l.w / 2)) < pad));

    // trees: town.json's in town (they cast shadows), and a ring round the town, off the roads (no shadows: the
    // shadow map only covers the town, and they would double their triangles)
    const trees = [];
    for (const pr of layout.props || []) if (pr?.type === 'tree' && Number.isFinite(pr.x) && Number.isFinite(pr.z)) trees.push([pr.x, pr.z, rand() * 6, 0.9 + rand() * 0.3, false]);
    const inTown = trees.length;
    for (let k = 0; k < 600 && trees.length < inTown + 24; k++) {
      const x = x0 - 30 + rand() * (x1 - x0 + 60), z = z0 - 30 + rand() * (z1 - z0 + 60);
      if (x > x0 - 8 && x < x1 + 8 && z > z0 - 8 && z < z1 + 8) continue;
      if (nearLane(x, z, 2.5)) continue;
      trees.push([x, z, rand() * 6, 0.8 + rand() * 0.5, true]);
    }
    const kinds = TREE_KIT.map(kitParts).filter(Boolean); // the kit's trees, taken in turn; else the code-built one
    for (const [k, parts] of (kinds.length ? kinds : [[{ geo: geos.tree, mat: mats.tree }]]).entries()) {
      for (const edge of [false, true]) {
        const mine = trees.filter((t, i) => i % Math.max(1, kinds.length) === k && t[4] === edge);
        for (const pt of parts) {
          const m = instanced(pt.geo, pt.geo.attributes.color ? mats.tree : pt.mat, mine.length, !edge);
          mine.forEach(([x, z, r, s], i) => put(m, i, x, 0, z, r, s));
          m.receiveShadow = true;
          group.add(m);
        }
      }
    }

    // props: town.json's, plus flowers, benches and lamps at every building; each belongs to its nearest building
    const props = [];
    for (const pr of layout.props || []) {
      if (!pr || pr.type === 'tree' || !Number.isFinite(pr.x) || !Number.isFinite(pr.z)) continue;
      let owner = null, bd = 12;
      for (const { b } of list) { const d = Math.hypot(b.x - pr.x, b.z - pr.z); if (d < bd) { bd = d; owner = b.id; } }
      props.push({ type: PROPS[pr.type] ? pr.type : 'bush', x: pr.x, z: pr.z, rot: THREE.MathUtils.degToRad(pr.rot || 0), owner });
    }
    for (const { b, group: g } of layout.props ? [] : list) { // a town without its own props gets a few
      const t = g.userData.type;
      if (NO_AUTO.has(t)) continue;
      const [w, d] = g.userData.foot, a = g.rotation.y, c = Math.cos(a), s = Math.sin(a);
      for (const [type, at] of Object.entries(AUTO)) for (const [lx, lz] of at(w, d, t)) props.push({ type, x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, rot: a, owner: b.id });
    }
    const propMeshes = {}; // type → [{ mesh, off }]: one instanced mesh per model part
    for (const type of new Set(props.map(p => p.type))) {
      const mine = props.filter(p => p.type === type);
      mine.forEach((p, i) => { p.i = i; p.shown = false; p.pop = 1; });
      const models = PROP_KIT[type]?.map(([id, x = 0, z = 0]) => [kitParts(id), x, z]);
      const pieces = models?.every(([ps]) => ps) ? models.flatMap(([ps, x, z]) => ps.map(pt => ({ ...pt, off: new THREE.Matrix4().makeTranslation(x, 0, z) })))
        : [{ geo: propGeo(type), mat: L.townMat, off: new THREE.Matrix4() }];
      propMeshes[type] = pieces.map(({ geo, mat, off }) => {
        const m = instanced(geo, mat, mine.length, !['flowers', 'bin', 'bush'].includes(type)); // low things: no shadow
        m.receiveShadow = true;
        group.add(m);
        return { mesh: m, off };
      });
      mine.forEach(p => placeProp(propMeshes, p, 0));
    }

    // named citizens: town.json homes and work ({ personId: buildingId }) first, then other people spread over
    // houses and workplaces. Each keeps a spot of their own by a door, so crowds don't stack.
    const homes = list.filter(it => it.group.userData.type === 'house').map(it => it.b.id);
    const jobs = list.filter(it => it.group.userData.solid && it.group.userData.type !== 'house').map(it => it.b.id);
    const any = list.map(it => it.b.id);
    const placed = p => items.has(layout.homes?.[p.id]) || items.has(layout.work?.[p.id]);
    const people = (Array.isArray(content.people) ? content.people : []).filter(p => p?.id && !ANIMAL.test(p.role || ''))
      .sort((a, b) => placed(b) - placed(a)).slice(0, MAX_PEOPLE);
    const citizens = people.map((p, i) => {
      const home = items.has(layout.homes?.[p.id]) ? layout.homes[p.id] : (homes.length ? homes : any)[i % (homes.length || any.length)];
      const work = items.has(layout.work?.[p.id]) ? layout.work[p.id] : (jobs.length ? jobs : any)[i % (jobs.length || any.length)];
      const h = hash(p.id), a = rand() * Math.PI * 2, o = 0.5 + rand() * 1.3, spot = [Math.sin(a) * o, Math.cos(a) * o];
      const at = B.door(items.get(home).b);
      return { id: p.id, name: p.name, home, work, spot, x: at[0] + spot[0], z: at[1] + spot[1],
        dir: rand() * 6, route: null, s: 0, len: 0, step: 0, speed: 1.2 + rand() * 0.4, wait: rand() * 6, plan: i % 2, inside: false,
        shirt: SHIRTS[h % SHIRTS.length], legs: TROUSERS[(h >> 3) % TROUSERS.length], skin: SKIN[(h >> 5) % SKIN.length] };
    });
    const n = citizens.length;
    const bodies = { torso: instanced(geos.torso, mats.body, n), head: instanced(geos.head, mats.head, n), legs: instanced(geos.leg, mats.body, n * 2) };
    citizens.forEach((c, i) => {
      bodies.torso.setColorAt(i, col.set(c.shirt)); bodies.head.setColorAt(i, col.set(c.skin));
      bodies.legs.setColorAt(i * 2, col.set(c.legs)); bodies.legs.setColorAt(i * 2 + 1, col);
    });
    group.add(bodies.torso, bodies.head, bodies.legs);

    // cars: each loops its road, there on the right lane and back on the other
    const loops = roads.map(pts => {
      const closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.5;
      const lp = closed ? offset(pts, LANE) : [...offset(pts, LANE), ...offset([...pts].reverse(), LANE)];
      lp.push(lp[0]);
      return { pts: lp, len: R.pathLength(lp) };
    }).filter(l => l.len > 10).sort((a, b) => b.len - a.len);
    const cars = loops.length ? Array.from({ length: CARS }, (_, i) => ({ loop: loops[i % loops.length], s: (i / CARS) * loops[i % loops.length].len, speed: 5.5 + i * 0.8 })) : [];
    const carKits = CAR_KIT.map(kitParts).filter(Boolean); // the kit's cars, one each; else one tinted code-built mesh
    const shared = carKits.length ? null : instanced(geos.car, mats.car, cars.length);
    if (shared) { cars.forEach((_, i) => shared.setColorAt(i, col.set(CAR[i % CAR.length]))); group.add(shared); }
    cars.forEach((c, i) => {
      c.slots = shared ? [{ mesh: shared, i }] : carKits[i % carKits.length].map(pt => {
        const m = instanced(pt.geo, pt.geo.attributes.color ? mats.car : pt.mat, 1);
        group.add(m);
        return { mesh: m, i: 0 };
      });
    });

    const birds = instanced(geos.bird, mats.bird, BIRDS, false);
    group.add(birds);

    T = { items, grid, roads, paths, ring, trees, props, propMeshes, citizens, bodies, cars, birds, routes: new Map(),
      centre: [(x0 + x1) / 2, (z0 + z1) / 2], radius: Math.max(x1 - x0, z1 - z0) / 2, leisure: [] };
    refresh();
    update(0); // place everyone before the first render
  }
  function placeProp(pm, p, s) {
    m5.compose(p3.set(p.x, 0, p.z), q.setFromAxisAngle(up, p.rot), s3.setScalar(s));
    for (const { mesh, off } of pm[p.type]) { mesh.setMatrixAt(p.i, m4.multiplyMatrices(m5, off)); mesh.instanceMatrix.needsUpdate = true; }
  }
  function segBox(a, b, hw) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    return R.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, hw, len / 2, Math.atan2(dx, dz));
  }

  /* ---------- building states changed: props appear, places to go ---------- */
  function refresh() {
    if (!T) return;
    const ok = id => T.items.get(id)?.b.state !== 'broken';
    for (const p of T.props) {
      const show = !p.owner || !T.items.has(p.owner) || ok(p.owner);
      if (show && !p.shown) p.pop = 0; // pops in over half a second
      if (!show) placeProp(T.propMeshes, p, 0);
      p.shown = show;
    }
    T.leisure = [...T.items.values()].filter(it => it.b.state !== 'broken' && !['house', 'streetlight', 'tree'].includes(it.group.userData.type)).map(it => it.b.id);
  }

  function route(from, to) {
    if (!T) return null;
    const key = `${from.map(Math.round)}>${to.map(Math.round)}`;
    if (!T.routes.has(key)) {
      if (T.routes.size > 300) T.routes.clear();
      T.routes.set(key, R.findPath(T.grid, from, to));
    }
    const pts = T.routes.get(key);
    return pts && [from, ...pts.slice(1, -1), to];
  }
  const doorOf = id => { const it = T.items.get(id); return it ? B.door(it.b) : null; };

  // where a citizen goes next: home at night; else work every other trip, or somewhere fixed to be. Nobody goes to
  // a broken place, so people turn up where you fixed things.
  function nextGoal(c, night) {
    if (night) return c.home;
    if (c.plan++ % 2 === 0 && T.items.get(c.work)?.b.state !== 'broken') return c.work;
    const fun = T.leisure.filter(id => id !== c.goal);
    return c.goal !== c.home && Math.random() < 0.4 ? c.home : fun[Math.floor(Math.random() * fun.length)] ?? c.home;
  }

  /* ---------- every frame ---------- */
  function update(dt) {
    clock += dt;
    updateConfetti(dt);
    if (!T) return;
    const night = L.U.uNight.value > 0.6;
    for (const p of T.props) if (p.shown && p.pop < 1) {
      p.pop = Math.min(1, p.pop + dt * 2);
      const k = p.pop, s = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2; // ease out with a little overshoot
      placeProp(T.propMeshes, p, s);
    }
    T.citizens.forEach((c, i) => {
      if (c.route) {
        c.s += c.speed * dt; c.step += c.speed * dt;
        const pt = R.pointAt(c.route, c.s);
        c.x = pt.x; c.z = pt.z;
        c.dir += Math.atan2(Math.sin(pt.dir - c.dir), Math.cos(pt.dir - c.dir)) * Math.min(1, dt * 8);
        if (c.s >= c.len) { c.route = null; c.wait = 3 + Math.random() * 8; if (night && c.goal === c.home) c.inside = true; }
      } else if (c.inside) {
        if (!night) { c.inside = false; c.wait = Math.random() * 4; }
      } else if ((c.wait -= dt) <= 0) {
        const goal = nextGoal(c, night), door = doorOf(goal), to = door && [door[0] + c.spot[0], door[1] + c.spot[1]];
        const pts = to && route([c.x, c.z], to);
        const len = pts ? R.pathLength(pts) : 0;
        if (len > 0.5) { c.route = pts; c.len = len; c.s = 0; c.goal = goal; } else { c.wait = 4 + Math.random() * 4; c.goal = goal; if (night && goal === c.home) c.inside = true; }
      }
      const walking = !!c.route, sw = walking ? Math.sin(c.step * 4.5) : 0, bob = walking ? Math.abs(sw) * 0.06 : 0, s = c.inside ? 0 : 1;
      put(T.bodies.torso, i, c.x, bob, c.z, c.dir, s);
      put(T.bodies.head, i, c.x, bob, c.z, c.dir, s);
      m5.compose(p3.set(c.x, bob, c.z), q.setFromAxisAngle(up, c.dir), s3.setScalar(s));
      for (const [k, side] of [[0, 0.12], [1, -0.12]]) T.bodies.legs.setMatrixAt(i * 2 + k, m4.makeRotationX((k ? -sw : sw) * 0.55).setPosition(side, 0.7, 0).premultiply(m5));
    });
    for (const m of Object.values(T.bodies)) m.instanceMatrix.needsUpdate = true;
    for (const c of T.cars) {
      c.s = (c.s + c.speed * dt) % c.loop.len;
      const pt = R.pointAt(c.loop.pts, c.s);
      for (const { mesh, i } of c.slots) { put(mesh, i, pt.x, 0, pt.z, pt.dir); mesh.instanceMatrix.needsUpdate = true; }
    }
    T.birds.visible = !night;
    for (let i = 0; i < BIRDS; i++) {
      const w = (0.22 + 0.04 * i) * (i % 2 ? -1 : 1), a = clock * w + i * 1.3, r = T.radius * 0.6 + 6 * i;
      const x = T.centre[0] + Math.cos(a) * r, z = T.centre[1] + Math.sin(a) * r;
      T.birds.setMatrixAt(i, m4.compose(p3.set(x, 24 + 3 * i, z), q.setFromAxisAngle(up, Math.atan2(-Math.sin(a) * w, Math.cos(a) * w)), s3.set(1.4, 1.4 * Math.sin(clock * 9 + i * 2), 1.4)));
    }
    T.birds.instanceMatrix.needsUpdate = true;
  }

  /* ---------- confetti ---------- */
  function confetti([x, y, z], n = 90, colors = [0xe8505b, 0xf2c14e, 0x3f7fbf, 0x5bb07a, 0xf28cb1, 0xffffff]) {
    for (let i = 0; i < n && bits.length < CONFETTI; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      bits.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(Math.cos(a) * sp, 6 + Math.random() * 6, Math.sin(a) * sp),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: 4 + Math.random() * 8, life: 2 + Math.random() * 1.2, c: colors[i % colors.length] });
    }
  }
  function updateConfetti(dt) {
    if (!bits.length) return;
    bits = bits.filter(b => (b.life -= dt) > 0);
    conf.visible = bits.length > 0;
    conf.count = bits.length;
    bits.forEach((b, i) => {
      b.v.y -= 9 * dt; b.v.multiplyScalar(1 - Math.min(1, 1.6 * dt)); b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.05) { b.p.y = 0.05; b.v.set(0, 0, 0); }
      b.r.x += b.w * dt; b.r.y += b.w * 0.7 * dt;
      conf.setMatrixAt(i, m4.compose(b.p, q.setFromEuler(b.r), s3.setScalar(1)));
      conf.setColorAt(i, col.set(b.c));
    });
    conf.instanceMatrix.needsUpdate = true;
    conf.instanceColor.needsUpdate = true;
  }

  /* ---------- people for bubbles, taps and walkTo ---------- */
  function anchors(project) {
    return T ? T.citizens.filter(c => !c.inside).map(c => ({ id: c.id, kind: 'person', ...project(c.x, 2.3, c.z) })) : [];
  }
  const personAt = id => { const c = T?.citizens.find(x => x.id === id && !x.inside); return c ? [c.x, c.z] : null; };

  const info = () => (T ? {
    citizens: T.citizens.filter(c => !c.inside).length, walking: T.citizens.filter(c => c.route).length, people: T.citizens.map(c => ({ id: c.id, x: c.x, z: c.z, inside: c.inside })),
    cars: T.cars.map(c => { const p = R.pointAt(c.loop.pts, c.s); return [p.x, p.z]; }), birds: T.birds.visible ? BIRDS : 0, trees: T.trees.length,
    props: { total: T.props.length, shown: T.props.filter(p => p.shown).length }, roads: T.roads.length, paths: T.paths.length, ring: T.ring, confetti: bits.length,
  } : null);

  // the kit is in (world.js rebuilds this town's life right after)
  const useKit = scenes => { kit = scenes; partsOf.clear(); };
  return { group, build, refresh, update, route, confetti, anchors, personAt, info, useKit };
}
