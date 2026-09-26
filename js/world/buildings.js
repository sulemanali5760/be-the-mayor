// Code-built low-poly town buildings: no model files, so createWorld stays synchronous and the town
// costs a few thousand triangles (budget in docs/ASSETS.md). Each building is centred on its footprint,
// front towards +z; b.rot (degrees) turns it. Broken = grey with rubble, ok = colour (+ its label).
import * as THREE from 'three';

const PAL = {
  wall: 0xf1e3c8, plaster: 0xe8b98a, hall: 0xeadcb8, school: 0xe39f6a, cafe: 0xd9785b, shop: 0x7fb2a8,
  roof: 0xb5483b, roof2: 0x4f6d8a, dark: 0x3b4650, wood: 0x8a5a33, stone: 0xa9a49b, white: 0xf7f4ee,
  glass: 0x8fc9e0, grass: 0x79b653, leaf: 0x3f8f45, trunk: 0x6b4a2f, metal: 0x5d6770, water: 0x4a90c2,
  brick: 0xb5563a, path: 0xd8c9a8, sand: 0xe6d29a, yellow: 0xf2c14e, red: 0xd9453b, lamp: 0xfff2b0,
};
const cache = new Map();
// broken buildings get the grey twin of every colour: same lightness, no hue, a little darker
export function mat(name, grey = false) {
  const key = name + (grey ? ':grey' : '');
  if (!cache.has(key)) {
    const c = new THREE.Color(PAL[name]);
    if (grey) { const l = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * 0.8 + 0.02; c.setRGB(l, l, l * 1.04); }
    const lit = name === 'lamp' && !grey;
    cache.set(key, new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: lit ? 0xffd27a : 0x000000, emissiveIntensity: lit ? 0.8 : 0 }));
  }
  return cache.get(key);
}

function add(g, geo, m, x, y, z, ry = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.rotation.y = ry;
  g.add(o);
  return o;
}
// a box standing on y
const box = (g, m, w, h, d, x = 0, y = 0, z = 0, ry = 0) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, ry);
const cyl = (g, m, r, h, x = 0, y = 0, z = 0, seg = 6) => add(g, new THREE.CylinderGeometry(r, r, h, seg), m, x, y + h / 2, z);
// gable roof: ridge along x, eaves at y
function gable(g, m, w, h, d, y, x = 0, z = 0) {
  const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(Math.PI / 2);
  return add(g, geo, m, x, y, z);
}
function tree(g, m, x, z, s = 1) {
  cyl(g, m('trunk'), 0.25 * s, 1.6 * s, x, 0, z, 5);
  add(g, new THREE.IcosahedronGeometry(1.4 * s, 0), m('leaf'), x, 2.4 * s, z);
}
// a row of windows on the front face (z = d / 2)
function windows(g, m, xs, y, d, w = 1, h = 1) { for (const x of xs) box(g, m('glass'), w, h, 0.12, x, y, d / 2); }

function store(body, awning) {
  return (g, m) => {
    box(g, m(body), 7, 3.2, 5);
    box(g, m('stone'), 7.3, 0.3, 5.3, 0, 3.2);
    windows(g, m, [-1.8, 1.9], 0.8, 5, 2.4, 1.5);
    box(g, m('wood'), 1.1, 2.1, 0.12, 0.2, 0, 2.5);
    box(g, m(awning), 6.6, 0.12, 1.5, 0, 2.5, 3.2);
    box(g, m('white'), 3.4, 0.8, 0.15, 0, 3.4, 2.55);
    for (const x of [-2.2, 2.4]) { cyl(g, m('white'), 0.45, 0.75, x, 0, 4.3); cyl(g, m('metal'), 0.04, 1.9, x, 0.75, 4.3, 4); }
  };
}

// type id → footprint [w, d] (m), top height h, solid (a van can't drive through it), build(group, material, broken)
const TYPES = {
  house: { foot: [6, 5], h: 5.2, solid: true, build(g, m) {
    box(g, m('wall'), 6, 3, 5);
    gable(g, m('roof'), 6.6, 2, 5.8, 3);
    box(g, m('brick'), 0.6, 1.6, 0.6, 1.6, 3.6, -1);
    box(g, m('wood'), 1, 1.9, 0.12, 0, 0, 2.5);
    windows(g, m, [-1.8, 1.8], 1.3, 5);
  } },
  garden: { foot: [7, 5], h: 1.2, solid: false, build(g, m, broken) {
    box(g, m('grass'), 7, 0.08, 5);
    box(g, m('trunk'), 2.6, 0.18, 0.9, -1.6, 0, -1.6);
    for (const [x, c] of [[-2.5, 'red'], [-1.9, 'yellow'], [-1.3, 'red'], [-0.7, 'yellow']]) box(g, m(c), 0.3, 0.45, 0.3, x, 0.18, -1.6);
    for (const x of [-3.3, 3.3]) box(g, m('leaf'), 0.5, 0.9, 5, x);
    if (broken) for (const [x, z, r] of [[-1.5, 2.3, 0.3], [-0.6, 2.6, 1.2], [0.8, 2.2, 0.7], [1.6, 2.5, 2]]) box(g, m('brick'), 0.5, 0.2, 0.25, x, 0.08, z, r);
    else { box(g, m('brick'), 6, 0.6, 0.3, 0, 0, 2.3); box(g, m('stone'), 6.2, 0.08, 0.4, 0, 0.6, 2.3); } // the wall the player builds
  } },
  cafe: { foot: [7, 5], h: 4.2, solid: true, build: store('cafe', 'yellow') },
  shop: { foot: [7, 5], h: 4.2, solid: true, build: store('shop', 'red') },
  busstop: { foot: [3.6, 1.6], h: 2.8, solid: true, build(g, m, broken) {
    for (const x of [-1.6, 1.6]) cyl(g, m('metal'), 0.07, 2.4, x, 0, -0.6, 5);
    box(g, m('glass'), 3.2, 1.6, 0.06, 0, 0.5, -0.7);
    const roof = box(g, m('roof2'), 3.8, 0.14, 1.8, 0, 2.4, 0);
    if (broken) { roof.rotation.z = 0.22; roof.position.y += 0.3; } // the roof that leaks, again
    box(g, m('wood'), 2.6, 0.1, 0.45, 0, 0.45, -0.35);
    cyl(g, m('metal'), 0.05, 2.6, 2.3, 0, 0.4, 4);
    box(g, m('yellow'), 0.55, 0.55, 0.06, 2.3, 2.3, 0.4);
  } },
  bridge: { foot: [4, 12], h: 1.6, solid: false, build(g, m, broken) {
    box(g, m('water'), 36, 0.04, 7, 0, 0.01, 0); // the stream it crosses
    for (const z of [-3.9, 3.9]) box(g, m('grass'), 36, 0.1, 0.8, 0, 0, z);
    const deck = (z, len) => box(g, m('stone'), 4, 0.35, len, 0, 0.25, z);
    if (broken) { deck(-3.7, 4.6); deck(3.7, 4.6); box(g, m('wood'), 0.15, 0.9, 4.6, -1.9, 0.6, -3.7); }
    else { deck(0, 12); for (const x of [-1.9, 1.9]) box(g, m('wood'), 0.15, 0.9, 12, x, 0.6, 0); }
  } },
  townhall: { foot: [12, 8], h: 11, solid: true, build(g, m) {
    box(g, m('hall'), 12, 6, 8);
    box(g, m('stone'), 12.6, 0.4, 8.6, 0, 6);
    windows(g, m, [-4.5, -1.5, 1.5, 4.5], 3.8, 8, 1, 1.3);
    for (const x of [-3, -1, 1, 3]) cyl(g, m('white'), 0.3, 5, x, 0.3, 4.9, 8);
    box(g, m('white'), 8, 0.5, 1.8, 0, 5.3, 4.9);
    box(g, m('stone'), 8, 0.3, 2.2, 0, 0, 4.9);
    box(g, m('hall'), 3, 3, 3, 0, 6.4, -1);
    add(g, new THREE.ConeGeometry(2.4, 2.4, 4), m('roof2'), 0, 10.6, -1, Math.PI / 4);
    add(g, new THREE.CylinderGeometry(0.8, 0.8, 0.1, 12).rotateX(Math.PI / 2), m('white'), 0, 7.9, 0.55);
    cyl(g, m('metal'), 0.05, 2, 0, 11.8, -1, 4);
    box(g, m('red'), 1.1, 0.6, 0.04, 0.55, 13.2, -1);
  } },
  school: { foot: [12, 6], h: 8, solid: true, build(g, m) {
    box(g, m('school'), 12, 5.6, 6);
    gable(g, m('roof2'), 12.6, 2.3, 6.8, 5.6);
    windows(g, m, [-4.5, -2.5, 2.5, 4.5], 1.1, 6, 1.3, 1.2);
    windows(g, m, [-4.5, -2.5, 0, 2.5, 4.5], 3.6, 6, 1.3, 1.2);
    box(g, m('wood'), 1.6, 2.3, 0.12, 0, 0, 3);
    box(g, m('white'), 2.6, 0.5, 0.1, 0, 2.6, 3.05);
  } },
  park: { foot: [12, 10], h: 3.5, solid: false, build(g, m, broken) {
    box(g, m('grass'), 12, 0.06, 10);
    box(g, m('path'), 12, 0.08, 1.4); box(g, m('path'), 1.4, 0.08, 10);
    for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) tree(g, m, x, z);
    cyl(g, m('stone'), 1.3, 0.5, 0, 0, 0, 10);
    if (!broken) cyl(g, m('water'), 1.05, 0.52, 0, 0, 0, 10); // the fountain runs again once fixed
    box(g, m('wood'), 1.8, 0.45, 0.5, 2.4, 0, 1.4);
  } },
  playground: { foot: [8, 8], h: 3, solid: false, build(g, m, broken) {
    box(g, m('sand'), 8, 0.06, 8);
    box(g, m('red'), 1.2, 2, 1.2, -2, 0, -1.5);
    const slide = box(g, m('yellow'), 0.8, 0.1, 3, -2, 1, 0.4);
    slide.rotation.x = broken ? 0.35 : 0.55;
    for (const x of [1.2, 3.4]) for (const z of [-0.6, 0.6]) { const leg = cyl(g, m('metal'), 0.07, 2.6, x, 0, z, 4); leg.rotation.x = z * 0.3; }
    box(g, m('metal'), 2.4, 0.12, 0.12, 2.3, 2.5, 0);
    if (!broken) for (const x of [1.8, 2.8]) box(g, m('wood'), 0.5, 0.06, 0.3, x, 0.5, 0);
  } },
  streetlight: { foot: [0.6, 0.6], h: 4.8, solid: false, build(g, m) {
    cyl(g, m('metal'), 0.09, 4.5, 0, 0, 0, 5);
    box(g, m('metal'), 0.9, 0.08, 0.08, 0.4, 4.4, 0);
    box(g, m('lamp'), 0.45, 0.2, 0.3, 0.8, 4.2, 0);
  } },
  tree: { foot: [2, 2], h: 3.8, solid: false, build(g, m) { tree(g, m, 0, 0, 1.1); } },
};
const ALIAS = { hall: 'townhall', cityhall: 'townhall', stop: 'busstop', store: 'shop', lamp: 'streetlight', light: 'streetlight', wall: 'garden', gardenwall: 'garden', fountain: 'park' };
// 'bus_stop', 'Bus-Stop' and 'busStop' all mean busstop; unknown types fall back to a house
export function typeOf(t) {
  const k = String(t ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const id = ALIAS[k] ?? k;
  return TYPES[id] ? id : 'house';
}
export const TYPE_IDS = Object.keys(TYPES);

// a flat name tag that always faces the camera; its texture is owned (disposed with the building)
export function label(text, y) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), font = '600 40px system-ui, sans-serif';
  x.font = font;
  c.width = Math.ceil(x.measureText(text).width) + 44; c.height = 64;
  x.font = font;
  x.fillStyle = 'rgba(255,255,255,0.92)';
  x.beginPath(); x.roundRect(0, 0, c.width, c.height, 18); x.fill();
  x.fillStyle = '#1e2226'; x.textBaseline = 'middle';
  x.fillText(text, 22, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(1.7 * c.width / c.height, 1.7, 1);
  s.position.y = y; s.renderOrder = 10; s.userData.own = true;
  return s;
}

export function makeBuilding(b) {
  const type = typeOf(b.type), T = TYPES[type], broken = b.state === 'broken';
  const g = new THREE.Group(), m = name => mat(name, broken);
  T.build(g, m, broken);
  if (broken) for (const [x, z, s] of [[0, 0.5, 0.6], [0.8, 0.9, 0.4], [1.4, 0.3, 0.5]]) box(g, m('stone'), s, s * 0.6, s, T.foot[0] / 2 - 1.2 + x, 0, T.foot[1] / 2 + z, x + z);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  if (!broken && b.label) g.add(label(b.label, T.h + 2));
  g.position.set(b.x, 0, b.z);
  g.rotation.y = THREE.MathUtils.degToRad(b.rot || 0);
  g.userData = { id: b.id, type, h: T.h, foot: T.foot, solid: T.solid };
  return g;
}
