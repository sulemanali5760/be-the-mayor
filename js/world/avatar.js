// The player's avatar (build 02 §3.1-3.2): Lane A's character.gltf once it has loaded (useKit), and until then (or
// if it can't load) a code-built stand-in. Both have the kit's bones (hips, spine, head, armL/R, legL/R, handR), the
// four clips (idle, walk, wave, cheer) through an AnimationMixer, and outfit parts named like the kit's acc_* nodes.
// Time is only frame's dt (LESSONS T6).
import * as THREE from 'three';

const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const L = await import(`./look.js?v=${V}`);
const { pointAt, pathLength, walkSpeed } = await import(`./rules.js?v=${V}`);

// setAvatar's skin, hair and face are indices into manifest.character's skins, hairs and faces (Lane G's save and
// creator use that order). These copies serve the stand-in until the kit is in; after that the manifest's lists win.
export const SKINS = [0xf9dcc4, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21];
export const HAIRS = [
  { id: 'short', model: 'hair_short', color: 0x5b3a29 }, { id: 'long', model: 'hair_long', color: 0x2e2a28 },
  { id: 'bun', model: 'hair_bun', color: 0xc9a15b }, { id: 'curly', model: 'hair_curly', color: 0x3a2a22 }, { id: 'none', model: null, color: null },
];
export const FACES = ['smile', 'grin', 'calm'];
export const EXTRAS = ['cap', 'beanie', 'sunglasses', 'flower', 'scarf', 'bowtie']; // build 02 contract change 1
const HATS = ['cap', 'beanie']; // a work helmet wins over these: the rank shows first
// rank → the stand-in's colours and the parts it wears, named like the kit's acc_* nodes (the kit's own `show` wins)
export const OUTFITS = [
  { title: 'Labourer', top: 0xff8a1f, sleeve: 0x55708f, legs: 0x3d4f66, shoes: 0x7a5230, parts: ['vest', 'hardhat'] },
  { title: 'Skilled', top: 0x3e6fa8, sleeve: 0x3e6fa8, legs: 0x2f3b4a, shoes: 0x5a3a22, parts: ['toolbelt', 'tester'] },
  { title: 'Community helper', top: 0x2f9e8f, sleeve: 0x2f9e8f, legs: 0x5b6b7c, shoes: 0xe9e4da, parts: ['jacket', 'clipboard'] },
  { title: 'Councillor', top: 0x2d3e63, sleeve: 0x2d3e63, legs: 0x3a3f4a, shoes: 0x2a211b, parts: ['blazer'], cuff: true },
  { title: 'Mayor', top: 0x3a3d45, sleeve: 0x3a3d45, legs: 0x3a3d45, shoes: 0x1d1a18, parts: ['blazer', 'tie', 'chain'], cuff: true },
  { title: 'Governor', top: 0x23262d, sleeve: 0x23262d, legs: 0x23262d, shoes: 0x141210, parts: ['blazer', 'tie', 'briefcase'], cuff: true },
  { title: 'President', top: 0x1f2a44, sleeve: 0x1f2a44, legs: 0x1f2a44, shoes: 0x141210, parts: ['blazer', 'tie', 'flagpin'], cuff: true },
];
let KIT = null; // manifest.character, once the kit's character is in
const rankOf = r => Math.max(0, Math.min(OUTFITS.length - 1, Math.round(Number(r) || 0)));
const hex = c => new THREE.Color(c).getHex();
// the rank's outfit; `sleeve` is what the first-person arms wear (wall.js): the kit's once it's in
export function outfitOf(av) {
  const r = rankOf(av?.rank), k = KIT?.outfits?.[r];
  return { ...OUTFITS[r], ...(k?.sleeve && { sleeve: hex(k.sleeve) }) };
}
const at = (list, v) => (Number.isInteger(v) && v >= 0 && v < list.length ? list[v] : undefined);
const skins = () => (KIT?.skins?.length ? KIT.skins.map(hex) : SKINS);
const hairs = () => (KIT?.hairs?.length ? KIT.hairs.map(h => ({ id: h.id, model: h.model ?? null, color: h.color ? hex(h.color) : null })) : HAIRS);
const hairOf = id => hairs().find(h => h.id === id) ?? hairs()[0];
// setAvatar input → what the figure wears; a skin may also be a colour, a hair or face an id
export function normalise(av = {}) {
  const S = skins(), H = hairs();
  const skin = at(S, av.skin) ?? av.skin ?? S[1], hair = at(H, av.hair)?.id ?? av.hair, face = at(FACES, av.face) ?? av.face;
  return { skin: typeof skin === 'number' ? skin : hex(skin), hair: H.some(h => h.id === hair) ? hair : H[0].id,
    face: FACES.includes(face) ? face : FACES[0], rank: rankOf(av.rank), extra: EXTRAS.includes(av.extra) ? av.extra : null };
}
const wornExtra = (lk, hat) => (lk.extra && !(hat && HATS.includes(lk.extra)) ? lk.extra : null);

/* ---------- the stand-in: a code-built toon figure ---------- */
const sph = (r, ws = 12, hs = 8, t0 = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, t0, tl);
const P = L.piece;
export const deco = L.toon({ vertexColors: true }); // palette-coloured parts: the kit's accessories and faces too
const bakeMesh = (pieces, node) => { const m = new THREE.Mesh(L.bake(pieces, false), deco); node.add(m); return m; };
const HIP = 0.8; // hips height (m); about 2 m tall with a big head

// clips: tracks on bone names, like the kit's
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

function standIn() {
  const M = { skin: L.toon(), hair: L.toon(), top: L.toon(), sleeve: L.toon(), legs: L.toon(), shoes: L.toon() };
  const node = (name, parent, x = 0, y = 0, z = 0) => { const n = new THREE.Group(); n.name = name; n.position.set(x, y, z); parent.add(n); return n; };
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  // faces +z; its left is +x
  const obj = new THREE.Group();
  obj.scale.setScalar(1.2);
  const hips = node('hips', obj, 0, HIP, 0);
  const spine = node('spine', hips, 0, 0.05, 0);
  const head = node('head', spine, 0, 0.95, 0);
  mesh(new THREE.CapsuleGeometry(0.27, 0.35, 4, 10), M.top, spine, 0, 0.3, 0);
  mesh(sph(0.3, 14, 10), M.skin, head);
  const arms = {};
  for (const [s, x] of [['L', 1], ['R', -1]]) {
    const leg = node(`leg${s}`, hips, 0.13 * x, 0, 0);
    mesh(new THREE.CapsuleGeometry(0.1, 0.42, 3, 8), M.legs, leg, 0, -0.32, 0);
    mesh(new THREE.BoxGeometry(0.2, 0.13, 0.32), M.shoes, leg, 0, -0.68, 0.05);
    const arm = arms[s] = node(`arm${s}`, spine, 0.33 * x, 0.62, 0);
    mesh(new THREE.CapsuleGeometry(0.085, 0.36, 3, 8), M.sleeve, arm, 0, -0.26, 0);
    mesh(sph(0.1, 8, 6), M.skin, arm, 0, -0.52, 0);
  }
  const handR = node('handR', arms.R, 0, -0.58, 0);

  const DARK = 0x2b1d16, CHEEK = 0xf29a8a;
  const eyes = round => [-1, 1].map(x => (round ? P(sph(0.045, 8, 6), DARK, 0.1 * x, 0.03, 0.265) : P(new THREE.BoxGeometry(0.08, 0.02, 0.02), DARK, 0.1 * x, 0.03, 0.29)));
  const cheeks = () => [-1, 1].map(x => P(sph(0.05, 8, 4).scale(1, 0.6, 0.4), CHEEK, 0.17 * x, -0.06, 0.24));
  const mouth = (r, arc) => P(new THREE.TorusGeometry(r, 0.018, 4, 10, arc).rotateZ(Math.PI + (Math.PI - arc) / 2), DARK, 0, -0.08, 0.285);
  const face = {
    smile: bakeMesh([...eyes(true), ...cheeks(), mouth(0.07, Math.PI)], head),
    grin: bakeMesh([...eyes(false), ...cheeks(), mouth(0.1, Math.PI), P(new THREE.BoxGeometry(0.14, 0.04, 0.01), 0xffffff, 0, -0.1, 0.29)], head),
    calm: bakeMesh([...eyes(true), ...cheeks(), P(new THREE.BoxGeometry(0.1, 0.02, 0.02), DARK, 0, -0.1, 0.29)], head),
  };
  const cap = r => sph(r, 14, 6, 0, Math.PI * 0.5);
  const hairStyles = { // by the manifest's hair ids ('none': no mesh)
    short: mesh(cap(0.315).rotateX(-0.25), M.hair, head, 0, 0.02, -0.01),
    long: mesh(L.bake([P(cap(0.32).rotateX(-0.2), 0xffffff, 0, 0.02, 0), P(new THREE.BoxGeometry(0.52, 0.5, 0.14), 0xffffff, 0, -0.14, -0.22)], false), M.hair, head),
    bun: mesh(L.bake([P(cap(0.315).rotateX(-0.25), 0xffffff, 0, 0.02, -0.01), P(sph(0.12, 8, 6), 0xffffff, 0, 0.3, -0.12)], false), M.hair, head),
    curly: mesh(L.bake([[0, 0.24, 0], [0.16, 0.18, 0.1], [-0.16, 0.18, 0.1], [0.2, 0.14, -0.1], [-0.2, 0.14, -0.1], [0, 0.18, -0.2], [0.1, 0.26, -0.1], [-0.1, 0.26, 0.08]]
      .map(([x, y, z]) => P(sph(0.13, 8, 6), 0xffffff, x, y, z)), false), M.hair, head),
  };
  const SILVER = 0xe8eef2, GOLD = 0xe6b422, WHITE = 0xf7f4ee, BROWN = 0x6b4a2f, RED = 0xc8323c;
  const parts = {
    hardhat: bakeMesh([P(cap(0.34), 0xf5c518, 0, 0.1, 0), P(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 16), 0xf5c518, 0, 0.1, 0.03)], head),
    vest: bakeMesh([0.12, 0.42].map(y => P(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14, 1, true), SILVER, 0, y, 0)), spine),
    toolbelt: bakeMesh([P(new THREE.CylinderGeometry(0.285, 0.285, 0.09, 14), BROWN, 0, 0, 0), P(new THREE.BoxGeometry(0.14, 0.16, 0.1), 0x8a6a45, 0.2, -0.05, 0.18),
      P(new THREE.BoxGeometry(0.04, 0.22, 0.04), 0x9aa3ad, -0.24, -0.06, 0.14)], spine),
    tester: bakeMesh([P(new THREE.BoxGeometry(0.1, 0.18, 0.05), 0xf2c14e, 0, -0.08, 0.06), P(new THREE.BoxGeometry(0.07, 0.06, 0.055), 0x222222, 0, -0.04, 0.065),
      P(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), RED, 0.03, -0.22, 0.06)], handR),
    clipboard: bakeMesh([P(new THREE.BoxGeometry(0.24, 0.32, 0.02), 0x8a5a33, 0, -0.12, 0.1), P(new THREE.BoxGeometry(0.2, 0.26, 0.022), WHITE, 0, -0.14, 0.101),
      P(new THREE.BoxGeometry(0.08, 0.03, 0.03), 0x9aa3ad, 0, 0.03, 0.1)], handR),
    blazer: bakeMesh([P(new THREE.BoxGeometry(0.16, 0.3, 0.04), WHITE, 0, 0.5, 0.265)], spine), // the shirt front between the lapels
    tie: bakeMesh([P(new THREE.BoxGeometry(0.06, 0.24, 0.02), RED, 0, 0.47, 0.292), P(new THREE.BoxGeometry(0.07, 0.05, 0.03), RED, 0, 0.61, 0.292)], spine),
    chain: bakeMesh([P(new THREE.TorusGeometry(0.22, 0.025, 5, 18).rotateX(Math.PI / 2 - 0.5), GOLD, 0, 0.64, 0.06), P(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12).rotateX(Math.PI / 2), GOLD, 0, 0.44, 0.29)], spine),
    briefcase: bakeMesh([P(new THREE.BoxGeometry(0.4, 0.28, 0.1), 0x4a2f1c, 0, -0.2, 0), P(new THREE.BoxGeometry(0.12, 0.04, 0.03), GOLD, 0, -0.05, 0)], handR),
    flagpin: bakeMesh([P(new THREE.BoxGeometry(0.07, 0.045, 0.02), RED, 0.13, 0.55, 0.26), P(new THREE.BoxGeometry(0.07, 0.015, 0.022), GOLD, 0.13, 0.55, 0.262)], spine),
  };
  const cuffs = [arms.L, arms.R].map(a => bakeMesh([P(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), WHITE, 0, -0.44, 0)], a));
  const extras = {
    cap: bakeMesh([P(cap(0.325), RED, 0, 0.06, 0), P(new THREE.BoxGeometry(0.3, 0.025, 0.2), RED, 0, 0.08, 0.3)], head),
    beanie: bakeMesh([P(cap(0.33), 0x3f7fbf, 0, 0.05, 0), P(new THREE.TorusGeometry(0.32, 0.04, 5, 16).rotateX(Math.PI / 2), 0x2f5f9f, 0, 0.07, 0), P(sph(0.07, 6, 4), WHITE, 0, 0.4, 0)], head),
    sunglasses: bakeMesh([P(new THREE.BoxGeometry(0.44, 0.09, 0.04), 0x15171a, 0, 0.04, 0.28)], head),
    flower: bakeMesh([[0xf28cb1, 0, 0], [0xf2c14e, 0.04, 0.05], [0xf28cb1, -0.05, 0.03]].map(([c, y, z]) => P(sph(0.06, 6, 4), c, 0.28, 0.12 + y, z)), head), // in the hair
    scarf: bakeMesh([P(new THREE.TorusGeometry(0.2, 0.07, 6, 14).rotateX(Math.PI / 2), 0x3f7fbf, 0, 0.72, 0), P(new THREE.BoxGeometry(0.1, 0.3, 0.05), 0x3f7fbf, 0.1, 0.55, 0.26)], spine),
    bowtie: bakeMesh([-1, 1].map(x => P(new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(x * Math.PI / 2), RED, 0.05 * x, 0.66, 0.26)), spine),
  };
  obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const mixer = new THREE.AnimationMixer(obj);
  return {
    obj, mixer, clips: CLIPS, kit: false,
    dress(lk) {
      const o = OUTFITS[lk.rank], h = hairOf(lk.hair), hat = o.parts.includes('hardhat'), extra = wornExtra(lk, hat);
      M.skin.color.setHex(lk.skin); if (h.color !== null) M.hair.color.setHex(h.color);
      M.top.color.setHex(o.top); M.sleeve.color.setHex(o.sleeve); M.legs.color.setHex(o.legs); M.shoes.color.setHex(o.shoes);
      for (const [k, m] of Object.entries(face)) m.visible = k === lk.face;
      for (const [k, m] of Object.entries(hairStyles)) m.visible = k === h.id && !hat; // 'none': no hair
      for (const [k, m] of Object.entries(parts)) m.visible = o.parts.includes(k);
      for (const c of cuffs) c.visible = !!o.cuff;
      for (const [k, m] of Object.entries(extras)) m.visible = k === extra;
      return { parts: [...o.parts, ...(extra ? [extra] : [])], top: o.top, sig: JSON.stringify(o) };
    },
  };
}

/* ---------- the kit's character (manifest.character): every variant is its own skinned mesh ---------- */
function kitFigure(g, C) {
  const obj = g.scene, R = {};
  obj.traverse(o => {
    if (!o.isMesh) return;
    const n = o.material?.name;
    o.material = C.materials?.includes(n) ? (R[n] ??= L.toon({ name: n })) : o.geometry.attributes.color ? deco : L.toon({ color: o.material?.color });
    o.castShadow = true;
    o.frustumCulled = false; // skinned: the bind-pose bounds don't follow the clips
  });
  const variants = new Set([...(C.body ?? []), ...(C.hairs ?? []).map(h => h.model), ...(C.faces ?? []),
    ...(C.outfits ?? []).flatMap(o => o.show ?? []), ...(C.extras ?? []).map(e => e.model)].filter(Boolean));
  const strip = n => n.replace(/^(acc|extra)_/, '');
  return {
    obj, mixer: new THREE.AnimationMixer(obj), kit: true,
    clips: ['idle', 'walk', 'wave', 'cheer'].map(k => { const c = THREE.AnimationClip.findByName(g.animations, C.animations?.[k] ?? k); if (c) c.name = k; return c; }),
    dress(lk) {
      const o = C.outfits?.[lk.rank] ?? {}, show = o.show ?? [], hat = show.includes('acc_hardhat'), extra = wornExtra(lk, hat);
      const hair = hairOf(lk.hair);
      // hair goes under the work helmet, as in the stand-in: curly hair is bigger than the hard hat and swallowed it (0.2 play test)
      const on = new Set([...(C.body ?? []), hat ? null : hair.model, `face_${lk.face}`, ...show, C.extras?.find(e => e.id === extra)?.model].filter(Boolean));
      obj.traverse(x => { if (variants.has(x.name)) x.visible = on.has(x.name); });
      R.Skin?.color.setHex(lk.skin);
      if (hair.color !== null) R.Hair?.color.setHex(hair.color);
      for (const [n, c] of Object.entries(o.colors ?? {})) R[n]?.color.set(c);
      const top = o.colors?.Jacket ?? o.colors?.Shirt;
      return { parts: [...show.map(strip), ...(extra ? [extra] : [])], top: top ? hex(top) : 0, sig: JSON.stringify(o) };
    },
  };
}

export function createAvatar(scene) {
  const root = new THREE.Group();
  root.name = 'avatar';
  // "you": a hi-vis ring on the ground, so the avatar reads among the citizens even on a phone
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf5b400, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.position.y = 0.06;
  root.add(ring);
  scene.add(root);

  let fig = null, act = null, clip = 'idle', worn = null, walk = null, skips = 0;
  function mount(f) {
    if (fig) { fig.mixer.stopAllAction(); root.remove(fig.obj); }
    fig = f;
    root.add(fig.obj);
    act = Object.fromEntries(fig.clips.map(c => [c.name, fig.mixer.clipAction(c)]));
    for (const [k, n] of Object.entries(ONCE)) act[k].setLoop(THREE.LoopRepeat, n);
    fig.mixer.addEventListener('finished', e => { if (e.action === act[clip]) play(walk ? 'walk' : 'idle'); });
    act[clip].play();
    if (walk) act.walk.setEffectiveTimeScale(Math.min(3, walk.speed / 1.8));
    worn = fig.dress(look);
  }
  let asked = {}, look = normalise(); // asked: what setAvatar was given (indices), re-read once the kit's lists are in
  mount(standIn());

  function set(av = {}) {
    asked = { ...asked };
    for (const [k, v] of Object.entries(av || {})) if (v !== undefined) asked[k] = v; // a missing field keeps what's worn
    look = normalise(asked);
    worn = fig.dress(look);
    return look;
  }
  // the kit's character replaces the stand-in, wearing the same look (kept if a clip is missing)
  function useKit(g, C) {
    const f = kitFigure(g, C);
    if (f.clips.some(c => !c)) { console.warn('Kit character without all four clips; keeping the stand-in'); return false; }
    KIT = C;
    look = normalise(asked);
    mount(f);
    return true;
  }

  function play(name) {
    if (name === clip && !ONCE[name]) return;
    act[name].reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (name !== clip) act[clip].fadeOut(0.2);
    clip = name;
  }

  /* ---------- walking along a path (world.walkTo): ≤ 3 s, skippable ---------- */
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
    fig.mixer.update(dt);
  }

  const info = () => ({ ...look, x: root.position.x, z: root.position.z, walking: !!walk, skips, clip, kit: fig.kit,
    title: OUTFITS[look.rank].title, parts: worn.parts, top: worn.top, outfit: worn.sig });
  return { root, set, useKit, play, walkPath, skip, place, update, info, get look() { return look; }, get walking() { return !!walk; } };
}
