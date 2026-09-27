// The cozy toon look (build 02 §3.2): gradient-ramp toon materials, a warm key light with one phone-sized shadow
// map, a hemisphere fill, fog and sky colour by time of day, ACES, and soft outlines from a depth-edge pass.
// ?q=low (CI's software GL, weak phones) renders straight to the screen: no outlines, no shadows.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- materials ---------- */
const ramp = new THREE.DataTexture(new Uint8Array([110, 170, 225, 255]), 4, 1, THREE.RedFormat); // 4 bands of light
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
export const toon = (o = {}) => new THREE.MeshToonMaterial({ gradientMap: ramp, ...o });

// shared uniforms: grey zones (x, z, full-grey radius, amount) over broken areas, game time (wind), night (glow)
export const GREY_N = 16; // ponytail: at most 16 broken areas are greyed at once; a texture of zones if towns grow
export const U = { uGrey: { value: Array.from({ length: GREY_N }, () => new THREE.Vector4()) }, uTime: { value: 0 }, uNight: { value: 0 } };
function inject(sh) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec2 vGreyW;
#ifdef GLOW
attribute float glow;
varying float vGlow;
#endif`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef WIND
{ vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  o = instanceMatrix * o;
#endif
  float k = max(0.0, transformed.y - 1.2);
  transformed.x += sin(uTime * 1.7 + o.x * 0.37 + o.z * 0.23) * 0.06 * k;
  transformed.z += sin(uTime * 1.3 + o.x * 0.19) * 0.04 * k; }
#endif`)
    .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 w = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  w = instanceMatrix * w;
#endif
  vGreyW = (modelMatrix * w).xz; }
#ifdef GLOW
vGlow = glow;
#endif`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
uniform vec4 uGrey[${GREY_N}];
uniform float uNight;
varying vec2 vGreyW;
#ifdef GLOW
varying float vGlow;
#endif`)
    .replace('#include <color_fragment>', `#include <color_fragment>
{ float g = 0.0;
  for (int i = 0; i < ${GREY_N}; i++) { vec4 z = uGrey[i]; g = max(g, z.w * (1.0 - smoothstep(z.z, z.z + 3.0, distance(vGreyW, z.xy)))); }
  float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l * 0.86, l * 0.87, l * 0.92), g * 0.88); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef GLOW
totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * vGlow * uNight * 1.6;
#endif`);
}
// a toon material that greys inside broken areas; wind sways it (trees), glow lights its windows and lamps at night
export function town(o = {}, { wind = false, glow = false } = {}) {
  const m = toon(o);
  m.defines = { ...m.defines, ...(wind && { WIND: '' }), ...(glow && { GLOW: '' }) };
  m.onBeforeCompile = inject;
  return m;
}
export const townMat = town({ vertexColors: true }, { glow: true }); // buildings and props: baked vertex colours

// merge coloured pieces [{ geo, color, glow }] into one geometry (position, normal, color[, glow]) for one draw
// call. The pieces' geometries are consumed (disposed).
export function bake(pieces, withGlow = true) {
  const parts = pieces.map(({ geo, color, glow = 0 }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new THREE.Color(color), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (withGlow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
    return g;
  });
  const out = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return out;
}
// a piece for bake(): a geometry moved to (x, y, z) and turned ry about y
export const piece = (geo, color, x = 0, y = 0, z = 0, ry = 0, glow = 0) => ({ geo: geo.rotateY(ry).translate(x, y, z), color, glow });

/* ---------- time of day: 0 morning, 0.35 noon, 0.7 evening, 1 night ---------- */
// t, sun elevation and azimuth (degrees), sun colour and intensity, hemisphere sky, ground and intensity, sky/fog, night
const KEYS = [
  [0, 24, 115, 0xffd6a8, 2.0, 0xd4e6ff, 0x86985c, 1.15, 0xf2dfc8, 0],
  [0.35, 58, 160, 0xfff4e2, 2.4, 0xd9ecff, 0x7c9a57, 1.3, 0xbfe0f4, 0],
  [0.7, 14, 240, 0xffa564, 1.9, 0xf0c8b4, 0x6e5f4d, 1.05, 0xf0b890, 0.35],
  [1, 42, 300, 0xa9b9ff, 0.55, 0x3d5287, 0x1c2338, 0.7, 0x1d2946, 1],
];
function paramsAt(t) {
  t = Math.max(0, Math.min(1, t));
  let i = 1;
  while (i < KEYS.length - 1 && t > KEYS[i][0]) i++;
  const a = KEYS[i - 1], b = KEYS[i], k = (t - a[0]) / (b[0] - a[0] || 1);
  const num = j => a[j] + (b[j] - a[j]) * k, col = j => new THREE.Color(a[j]).lerp(new THREE.Color(b[j]), k);
  const el = THREE.MathUtils.degToRad(num(1)), az = THREE.MathUtils.degToRad(num(2));
  return { dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)),
    sun: col(3), sunI: num(4), sky: col(5), ground: col(6), hemiI: num(7), fog: col(8), night: num(9) };
}
function mix(a, b, e) {
  return { dir: a.dir.clone().lerp(b.dir, e).normalize(), sun: a.sun.clone().lerp(b.sun, e), sunI: a.sunI + (b.sunI - a.sunI) * e,
    sky: a.sky.clone().lerp(b.sky, e), ground: a.ground.clone().lerp(b.ground, e), hemiI: a.hemiI + (b.hemiI - a.hemiI) * e,
    fog: a.fog.clone().lerp(b.fog, e), night: a.night + (b.night - a.night) * e };
}

export function createLook(renderer, scene, LOW) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !LOW;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // world.frame resets it once a frame, so stats cover every pass

  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, 260, 520);
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = !LOW;
  sun.shadow.mapSize.set(1024, 1024); // one map, sized for phones
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);

  let cur = paramsAt(0), tw = null, target = 0;
  function apply(p) {
    cur = p;
    sun.color.copy(p.sun); sun.intensity = p.sunI;
    sun.position.copy(sun.target.position).addScaledVector(p.dir, 90);
    hemi.color.copy(p.sky); hemi.groundColor.copy(p.ground); hemi.intensity = p.hemiI;
    scene.fog.color.copy(p.fog); scene.background.copy(p.fog);
    U.uNight.value = p.night;
  }
  apply(cur);
  // eases from wherever it is now over 1.5 s of game time, so night → morning doesn't rewind through the day
  function setTime(t) {
    target = Math.max(0, Math.min(1, Number(t) || 0));
    tw = { from: cur, to: paramsAt(target), k: 0 };
  }
  function update(dt) {
    U.uTime.value += dt;
    if (!tw) return;
    tw.k = Math.min(1, tw.k + dt / 1.5);
    apply(mix(tw.from, tw.to, tw.k * tw.k * (3 - 2 * tw.k)));
    if (tw.k >= 1) tw = null;
  }
  // centre the key light and its shadow on the town (radius R)
  function fit(cx, cz, R) {
    sun.target.position.set(cx, 0, cz);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 220 });
    sun.shadow.camera.updateProjectionMatrix();
    apply(cur);
  }

  /* ---------- outlines: the scene into a multisampled target, then one full-screen pass darkens depth edges ---------- */
  let post = null;
  if (!LOW) {
    const ext = renderer.extensions;
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthTexture: new THREE.DepthTexture(1, 1),
      type: ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType });
    const mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uPx: { value: new THREE.Vector2() }, uNear: { value: 1 }, uFar: { value: 900 } },
      vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uPx;
uniform float uNear, uFar;
varying vec2 vUv;
float dist(vec2 uv) { return uNear * uFar / (uFar - (uFar - uNear) * texture2D(tDepth, uv).x); }
void main() {
  vec4 c = texture2D(tColor, vUv);
  float d = dist(vUv), e = 0.0;
  e = max(e, dist(vUv + vec2(uPx.x, 0.0)) - d);
  e = max(e, dist(vUv - vec2(uPx.x, 0.0)) - d);
  e = max(e, dist(vUv + vec2(0.0, uPx.y)) - d);
  e = max(e, dist(vUv - vec2(0.0, uPx.y)) - d);
  gl_FragColor = vec4(c.rgb * (1.0 - 0.55 * smoothstep(0.025, 0.07, e / d)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const qs = new THREE.Scene();
    qs.add(quad);
    post = { rt, mat, qs, qc: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }
  const buf = new THREE.Vector2();
  function setSize() {
    if (!post) return;
    renderer.getDrawingBufferSize(buf);
    if (!buf.x || !buf.y) return; // resize guard (LESSONS T5)
    post.rt.setSize(buf.x, buf.y);
    const w = Math.max(1, Math.round(renderer.getPixelRatio())); // outlines about 1 css px wide
    post.mat.uniforms.uPx.value.set(w / buf.x, w / buf.y);
  }
  function render(cam) {
    if (!post) { renderer.render(scene, cam); return; }
    renderer.setRenderTarget(post.rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    post.mat.uniforms.uNear.value = cam.near; post.mat.uniforms.uFar.value = cam.far;
    renderer.render(post.qs, post.qc);
  }

  return { sun, hemi, setTime, update, fit, setSize, render,
    info: () => ({ target, t: tw ? tw.k : 1, sun: +sun.intensity.toFixed(3), night: +cur.night.toFixed(3), outlines: !!post, shadows: sun.castShadow }) };
}
