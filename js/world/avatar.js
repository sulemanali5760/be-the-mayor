// The player's avatar (build 02 §3.1-3.2). Until Lane A's rigged character lands it is a code-built toon figure
// whose nodes carry the manifest's attach names (head, spine, handR), so the four clips (idle, walk, wave, cheer)
// run through an AnimationMixer and every outfit part hangs off a named node. Time is only frame's dt (T6).
import * as THREE from 'three';

const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const L = await import(`./look.js?v=${V}`);
const { pointAt, pathLength, walkSpeed } = await import(`./rules.js?v=${V}`);

export const SKINS = [0xf6d7bd, 0xe8b894, 0xc98f63, 0x9c6440, 0x6b4128, 0x47291a];
export const HAIRS = [
  { id: 'short', style: 'short', color: 0x3b2618 }, { id: 'long', style: 'long', color: 0x6b3f1f },
  { id: 'bun', style: 'bun', color: 0x1e1712 }, { id: 'curly', style: 'curly', color: 0x2a1c14 },
  { id: 'blond', style: 'short', color: 0xd8b26a }, { id: 'buzz', style: 'buzz', color: 0x4a4a4a },
];
export const FACES = ['smile', 'grin', 'calm'];
export const EXTRAS = ['cap', 'scarf', 'sunglasses', 'flowers', 'bowtie', 'headphones'];
// rank → cloth colours and the parts it wears (docs/builds/02-look-and-feel.md §3.1, the outfit table)
export const OUTFITS = [
  { title: 'Labourer', top: 0xff8a1f, sleeve: 0x55708f, legs: 0x3d4f66, shoes: 0x7a5230, parts: ['hardhat', 'stripes'] },
  { title: 'Skilled', top: 0x3e6fa8, sleeve: 0x3e6fa8, legs: 0x2f3b4a, shoes: 0x5a3a22, parts: ['belt', 'tester'] },
  { title: 'Community helper', top: 0x2f9e8f, sleeve: 0x2f9e8f, legs: 0x5b6b7c, shoes: 0xe9e4da, parts: ['clipboard'] },
  { title: 'Councillor', top: 0x2d3e63, sleeve: 0x2d3e63, legs: 0x3a3f4a, shoes: 0x2a211b, parts: ['shirt'], cuff: true },
  { title: 'Mayor', top: 0x3a3d45, sleeve: 0x3a3d45, legs: 0x3a3d45, shoes: 0x1d1a18, parts: ['shirt', 'tie', 'chain'], cuff: true },
  { title: 'Governor', top: 0x23262d, sleeve: 0x23262d, legs: 0x23262d, shoes: 0x141210, parts: ['shirt', 'tie', 'briefcase'], cuff: true },
  { title: 'President', top: 0x1f2a44, sleeve: 0x1f2a44, legs: 0x1f2a44, shoes: 0x141210, parts: ['shirt', 'tie', 'pin'], cuff: true },
];
const rankOf = r => Math.max(0, Math.min(OUTFITS.length - 1, Math.round(Number(r) || 0)));
export const outfitOf = av => OUTFITS[rankOf(av?.rank)];
const pick = (list, v, key = 'id') => (Number.isInteger(v) && list[v] !== undefined ? list[v] : list.find(x => (key ? x[key] : x) === v) ?? list[0]);
// setAvatar input → what the figure wears. skin: an index or a colour; hair and face: an id or an index
export function normalise(av = {}) {
  const skin = Number.isInteger(av.skin) && av.skin >= 0 && av.skin < SKINS.length ? SKINS[av.skin] : av.skin ?? SKINS[1];
  return { skin: typeof skin === 'number' ? skin : new THREE.Color(skin).getHex(), hair: pick(HAIRS, av.hair).id, face: pick(FACES, av.face, null),
    rank: rankOf(av.rank), extra: EXTRAS.includes(av.extra) ? av.extra : null };
}

/* ---------- geometry helpers ---------- */
const sph = (r, ws = 12, hs = 8, t0 = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, t0, tl);
const P = L.piece;
const deco = L.toon({ vertexColors: true });
const bakeMesh = (pieces, node) => { const m = new THREE.Mesh(L.bake(pieces, false), deco); node.add(m); return m; };

const HIP = 0.8; // hips height (m); the figure is about 2 m tall with a big head, Hay Day proportions

/* ---------- clips: tracks on node names, like a glTF character's bones ---------- */
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
const rot = (node, times, e) => new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, e.flatMap(a => Q(...a)));
const lift = (times, ys) => new THREE.VectorKeyframeTrack('hips.position', times, ys.flatMap(y => [0, HIP + y, 0]));
const T3 = [0, 0.35, 0.7];
const CLIPS = [
  new THREE.AnimationClip('idle', 2.4, [
    lift([0, 1.2, 2.4], [0, -0.015, 0]),
    rot('spine', [0, 1.2, 2.4], [[0, 0, 0], [0.04, 0, 0], [0, 0, 0]]),
    rot('armL', [0, 1.2, 2.4], [[0, 0, 0.1], [0, 0, 0.15], [0, 0, 0.1]]),
    rot('armR', [0, 1.2, 2.4], [[0, 0, -0.1], [0, 0, -0.15], [0, 0, -0.1]]),
    rot('head', [0, 1.2, 2.4], [[0, 0, 0], [0, 0.12, 0.03], [0, 0, 0]]),
  ]),
  new THREE.AnimationClip('walk', 0.7, [
    rot('legL', T3, [[0.6, 0, 0], [-0.6, 0, 0], [0.6, 0, 0]]),
    rot('legR', T3, [[-0.6, 0, 0], [0.6, 0, 0], [-0.6, 0, 0]]),
    rot('armL', T3, [[-0.5, 0, 0.1], [0.5, 0, 0.1], [-0.5, 0, 0.1]]),
    rot('armR', T3, [[0.5, 0, -0.1], [-0.5, 0, -0.1], [0.5, 0, -0.1]]),
    lift([0, 0.175, 0.35, 0.525, 0.7], [0, 0.05, 0, 0.05, 0]),
  ]),
  new THREE.AnimationClip('wave', 1.6, [
    rot('armR', [0, 0.25, 0.5, 0.75, 1, 1.25, 1.6], [[0, 0, -0.1], [0, 0, -2.6], [0, 0, -2.95], [0, 0, -2.5], [0, 0, -2.95], [0, 0, -2.6], [0, 0, -0.1]]),
    rot('head', [0, 0.4, 1.6], [[0, 0, 0], [0, 0, -0.12], [0, 0, 0]]),
  ]),
  new THREE.AnimationClip('cheer', 1, [
    rot('armL', [0, 0.2, 0.8, 1], [[0, 0, 0.1], [0, 0, 2.7], [0, 0, 2.7], [0, 0, 0.1]]),
    rot('armR', [0, 0.2, 0.8, 1], [[0, 0, -0.1], [0, 0, -2.7], [0, 0, -2.7], [0, 0, -0.1]]),
    lift([0, 0.15, 0.4, 0.65, 1], [0, -0.06, 0.35, 0, 0]),
  ]),
];
const ONCE = { wave: 1, cheer: 2 }; // plays this many times, then back to idle (or walk)

export function createAvatar(scene) {
  const M = { skin: L.toon(), hair: L.toon(), top: L.toon(), sleeve: L.toon(), legs: L.toon(), shoes: L.toon() };
  const node = (name, parent, x = 0, y = 0, z = 0) => { const n = new THREE.Group(); n.name = name; n.position.set(x, y, z); parent.add(n); return n; };
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

  // the figure faces +z; its left is +x
  const root = new THREE.Group();
  root.name = 'avatar';
  const hips = node('hips', root, 0, HIP, 0);
  const spine = node('spine', hips, 0, 0.05, 0);
  const head = node('head', spine, 0, 0.95, 0);
  mesh(new THREE.CapsuleGeometry(0.27, 0.35, 4, 10), M.top, spine, 0, 0.3, 0);
  mesh(sph(0.3, 14, 10), M.skin, head);
  const legs = {}, arms = {};
  for (const [s, x] of [['L', 1], ['R', -1]]) {
    const leg = legs[s] = node(`leg${s}`, hips, 0.13 * x, 0, 0);
    mesh(new THREE.CapsuleGeometry(0.1, 0.42, 3, 8), M.legs, leg, 0, -0.32, 0);
    mesh(new THREE.BoxGeometry(0.2, 0.13, 0.32), M.shoes, leg, 0, -0.68, 0.05);
    const arm = arms[s] = node(`arm${s}`, spine, 0.33 * x, 0.62, 0);
    mesh(new THREE.CapsuleGeometry(0.085, 0.36, 3, 8), M.sleeve, arm, 0, -0.26, 0);
    mesh(sph(0.1, 8, 6), M.skin, arm, 0, -0.52, 0);
  }
  const handR = node('handR', arms.R, 0, -0.58, 0);

  // faces: two eyes, rosy cheeks and a mouth, baked into one mesh each
  const DARK = 0x2b1d16, CHEEK = 0xf29a8a;
  const face = {};
  const eyes = (round) => [-1, 1].map(x => (round ? P(sph(0.045, 8, 6), DARK, 0.1 * x, 0.03, 0.265) : P(new THREE.BoxGeometry(0.08, 0.02, 0.02), DARK, 0.1 * x, 0.03, 0.29)));
  const cheeks = () => [-1, 1].map(x => P(sph(0.05, 8, 4).scale(1, 0.6, 0.4), CHEEK, 0.17 * x, -0.06, 0.24));
  const mouth = (r, arc) => P(new THREE.TorusGeometry(r, 0.018, 4, 10, arc).rotateZ(Math.PI + (Math.PI - arc) / 2), DARK, 0, -0.08, 0.285);
  face.smile = bakeMesh([...eyes(true), ...cheeks(), mouth(0.07, Math.PI)], head);
  face.grin = bakeMesh([...eyes(false), ...cheeks(), mouth(0.1, Math.PI), P(new THREE.BoxGeometry(0.14, 0.04, 0.01), 0xffffff, 0, -0.1, 0.29)], head);
  face.calm = bakeMesh([...eyes(true), ...cheeks(), P(new THREE.BoxGeometry(0.1, 0.02, 0.02), DARK, 0, -0.1, 0.29)], head);

  // hair styles share one material (the hair colour)
  const cap = r => sph(r, 14, 6, 0, Math.PI * 0.5);
  const hairs = {
    short: mesh(cap(0.315).rotateX(-0.25), M.hair, head, 0, 0.02, -0.01),
    long: mesh(L.bake([P(cap(0.32).rotateX(-0.2), 0xffffff, 0, 0.02, 0), P(new THREE.BoxGeometry(0.52, 0.5, 0.14), 0xffffff, 0, -0.14, -0.22)], false), M.hair, head),
    bun: mesh(L.bake([P(cap(0.315).rotateX(-0.25), 0xffffff, 0, 0.02, -0.01), P(sph(0.12, 8, 6), 0xffffff, 0, 0.3, -0.12)], false), M.hair, head),
    curly: mesh(L.bake([[0, 0.24, 0], [0.16, 0.18, 0.1], [-0.16, 0.18, 0.1], [0.2, 0.14, -0.1], [-0.2, 0.14, -0.1], [0, 0.18, -0.2], [0.1, 0.26, -0.1], [-0.1, 0.26, 0.08]]
      .map(([x, y, z]) => P(sph(0.13, 8, 6), 0xffffff, x, y, z)), false), M.hair, head),
    buzz: mesh(cap(0.305).rotateX(-0.35), M.hair, head, 0, 0.01, 0),
  };

  // outfit parts and wardrobe extras (fixed colours, baked)
  const HIVIS = 0xff8a1f, SILVER = 0xe8eef2, GOLD = 0xe6b422, WHITE = 0xf7f4ee, BROWN = 0x6b4a2f, RED = 0xc8323c;
  const parts = {
    hardhat: bakeMesh([P(cap(0.34), 0xf5c518, 0, 0.1, 0), P(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 16), 0xf5c518, 0, 0.1, 0.03)], head),
    stripes: bakeMesh([0.12, 0.42].map(y => P(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14, 1, true), SILVER, 0, y, 0)), spine),
    belt: bakeMesh([P(new THREE.CylinderGeometry(0.285, 0.285, 0.09, 14), BROWN, 0, 0.0, 0), P(new THREE.BoxGeometry(0.14, 0.16, 0.1), 0x8a6a45, 0.2, -0.05, 0.18),
      P(new THREE.BoxGeometry(0.04, 0.22, 0.04), 0x9aa3ad, -0.24, -0.06, 0.14)], spine),
    tester: bakeMesh([P(new THREE.BoxGeometry(0.1, 0.18, 0.05), 0xf2c14e, 0, -0.08, 0.06), P(new THREE.BoxGeometry(0.07, 0.06, 0.055), 0x222222, 0, -0.04, 0.065),
      P(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), RED, 0.03, -0.22, 0.06)], handR),
    clipboard: bakeMesh([P(new THREE.BoxGeometry(0.24, 0.32, 0.02), 0x8a5a33, 0, -0.12, 0.1), P(new THREE.BoxGeometry(0.2, 0.26, 0.022), WHITE, 0, -0.14, 0.101),
      P(new THREE.BoxGeometry(0.08, 0.03, 0.03), 0x9aa3ad, 0, 0.03, 0.1)], handR),
    shirt: bakeMesh([P(new THREE.BoxGeometry(0.16, 0.3, 0.04), WHITE, 0, 0.5, 0.265)], spine),
    tie: bakeMesh([P(new THREE.BoxGeometry(0.06, 0.24, 0.02), RED, 0, 0.47, 0.292), P(new THREE.BoxGeometry(0.07, 0.05, 0.03), RED, 0, 0.61, 0.292)], spine),
    chain: bakeMesh([P(new THREE.TorusGeometry(0.22, 0.025, 5, 18).rotateX(Math.PI / 2 - 0.5), GOLD, 0, 0.64, 0.06), P(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12).rotateX(Math.PI / 2), GOLD, 0, 0.44, 0.29)], spine),
    briefcase: bakeMesh([P(new THREE.BoxGeometry(0.4, 0.28, 0.1), 0x4a2f1c, 0, -0.2, 0), P(new THREE.BoxGeometry(0.12, 0.04, 0.03), GOLD, 0, -0.05, 0)], handR),
    pin: bakeMesh([P(new THREE.BoxGeometry(0.07, 0.045, 0.02), RED, 0.13, 0.55, 0.26), P(new THREE.BoxGeometry(0.07, 0.015, 0.022), GOLD, 0.13, 0.55, 0.262)], spine),
    cuffs: [arms.L, arms.R].map(a => bakeMesh([P(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), WHITE, 0, -0.44, 0)], a)),
  };
  const extras = {
    cap: bakeMesh([P(cap(0.325), RED, 0, 0.06, 0), P(new THREE.BoxGeometry(0.3, 0.025, 0.2), RED, 0, 0.08, 0.3)], head),
    scarf: bakeMesh([P(new THREE.TorusGeometry(0.2, 0.07, 6, 14).rotateX(Math.PI / 2), 0x3f7fbf, 0, 0.72, 0), P(new THREE.BoxGeometry(0.1, 0.3, 0.05), 0x3f7fbf, 0.1, 0.55, 0.26)], spine),
    sunglasses: bakeMesh([P(new THREE.BoxGeometry(0.44, 0.09, 0.04), 0x15171a, 0, 0.04, 0.28)], head),
    flowers: bakeMesh([0xf28cb1, 0xf2c14e, 0xffffff, 0xf28cb1, 0xb58cf2, 0xf2c14e, 0xffffff].map((c, i) => {
      const a = (i / 7) * Math.PI * 2; return P(sph(0.07, 6, 4), c, Math.sin(a) * 0.29, 0.16, Math.cos(a) * 0.29);
    }), head),
    bowtie: bakeMesh([-1, 1].map(x => P(new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(x * Math.PI / 2), RED, 0.05 * x, 0.66, 0.26)), spine),
    headphones: bakeMesh([P(new THREE.TorusGeometry(0.31, 0.025, 4, 14, Math.PI), 0x2b2f36, 0, 0.02, 0), ...[-1, 1].map(x => P(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10).rotateZ(Math.PI / 2), RED, 0.31 * x, 0.02, 0))], head),
  };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(root);

  /* ---------- the look: material swaps and part visibility ---------- */
  let look = normalise();
  function set(av) {
    look = normalise({ ...look, ...av });
    const o = OUTFITS[look.rank], h = pick(HAIRS, look.hair);
    M.skin.color.setHex(look.skin); M.hair.color.setHex(h.color);
    M.top.color.setHex(o.top); M.sleeve.color.setHex(o.sleeve); M.legs.color.setHex(o.legs); M.shoes.color.setHex(o.shoes);
    for (const [k, m] of Object.entries(face)) m.visible = k === look.face;
    const hat = o.parts.includes('hardhat');
    for (const [k, m] of Object.entries(hairs)) m.visible = k === h.style && !hat;
    for (const [k, m] of Object.entries(parts)) for (const x of [m].flat()) x.visible = k === 'cuffs' ? !!o.cuff : o.parts.includes(k);
    // a work helmet wins over a hat from the wardrobe: the rank shows first
    for (const [k, m] of Object.entries(extras)) m.visible = k === look.extra && !(hat && ['cap', 'flowers', 'headphones'].includes(k));
    return look;
  }
  set({});

  /* ---------- animation ---------- */
  const mixer = new THREE.AnimationMixer(root);
  const act = Object.fromEntries(CLIPS.map(c => [c.name, mixer.clipAction(c)]));
  for (const [k, n] of Object.entries(ONCE)) act[k].setLoop(THREE.LoopRepeat, n);
  let clip = 'idle';
  act.idle.play();
  function play(name) {
    if (name === clip && !ONCE[name]) return;
    act[name].reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (name !== clip) act[clip].fadeOut(0.2);
    clip = name;
  }
  mixer.addEventListener('finished', e => { if (e.action === act[clip]) play(walk ? 'walk' : 'idle'); });

  /* ---------- walking along a path (world.walkTo): ≤ 3 s, skippable ---------- */
  let walk = null, skips = 0;
  function walkPath(pts, faceTo = null) {
    skip();
    const len = pathLength(pts), speed = walkSpeed(len);
    return new Promise(resolve => {
      walk = { pts, len, s: 0, speed, face: faceTo, resolve };
      act.walk.setEffectiveTimeScale(Math.min(3, speed / 1.8));
      play('walk');
      if (len < 0.05) arrive();
    });
  }
  function arrive(skipped = false) {
    const w = walk;
    if (!w) return;
    walk = null;
    const end = w.pts[w.pts.length - 1];
    root.position.set(end[0], 0, end[1]);
    if (w.face) root.rotation.y = Math.atan2(w.face[0] - end[0], w.face[1] - end[1]);
    if (clip === 'walk') play('idle');
    if (skipped) skips++;
    w.resolve(true); // the avatar is there either way: a skip only jumps to the end
  }
  function skip() { if (walk) arrive(true); }
  function place(x, z, ry = root.rotation.y) { skip(); root.position.set(x, 0, z); root.rotation.y = ry; }

  function update(dt) {
    if (walk) {
      walk.s += walk.speed * dt;
      if (walk.s >= walk.len) arrive();
      else {
        const p = pointAt(walk.pts, walk.s);
        root.position.set(p.x, 0, p.z);
        const d = Math.atan2(Math.sin(p.dir - root.rotation.y), Math.cos(p.dir - root.rotation.y));
        root.rotation.y += d * Math.min(1, dt * 14);
      }
    }
    mixer.update(dt);
  }

  const info = () => ({ ...look, x: root.position.x, z: root.position.z, walking: !!walk, skips, clip, title: OUTFITS[look.rank].title,
    top: M.top.color.getHex(), parts: Object.entries({ ...parts, ...extras }).filter(([, m]) => [m].flat()[0].visible).map(([k]) => k) });
  return { root, set, play, walkPath, skip, place, update, info, get look() { return look; }, get walking() { return !!walk; } };
}
