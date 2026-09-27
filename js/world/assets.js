// Lane A's kit (assets/manifest.json, docs/ASSETS.md): self-contained .gltf models decoded in memory (LESSONS H1),
// their one vertex-coloured `palette` material swapped for the toon ramp (still one draw call each).
// The browser fetches them; nobody opens them on the laptop (LESSONS A1).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const V = new URL(import.meta.url).searchParams.get('v') || 'dev';
const L = await import(`./look.js?v=${V}`);
const ROOT = new URL('../../', import.meta.url);

const loader = new GLTFLoader();
// the .gltf embeds its buffer as a data: URI, which a strict CSP can refuse to fetch; hand three.js a GLB instead
export async function loadGltf(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = await res.json();
  const bin = Uint8Array.from(atob(json.buffers[0].uri.split(',')[1]), c => c.charCodeAt(0));
  delete json.buffers[0].uri;
  const txt = new TextEncoder().encode(JSON.stringify(json));
  const jl = Math.ceil(txt.length / 4) * 4, bl = Math.ceil(bin.length / 4) * 4;
  const glb = new ArrayBuffer(28 + jl + bl), dv = new DataView(glb), u8 = new Uint8Array(glb);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.byteLength, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true); u8.fill(0x20, 20, 20 + jl); u8.set(txt, 20);
  dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004e4942, true); u8.set(bin, 28 + jl);
  return loader.parseAsync(glb, '');
}

let man = null;
export const manifest = () => (man ??= fetch(new URL(`assets/manifest.json?v=${V}`, ROOT)).then(r => r.json()));

export const kitMat = L.town({ vertexColors: true }); // kit buildings and props: greyed in broken areas
const cache = new Map();
// a manifest model's glTF, its palette meshes on `vc` (null: the character dresses its own); null if it can't load
export function model(id, vc = kitMat) {
  if (!cache.has(id)) {
    cache.set(id, manifest().then(async m => {
      const e = m.models?.[id];
      if (!e) return null;
      const g = await loadGltf(new URL(`${e.file}?v=${V}`, ROOT));
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.userData.kit = true; // shared geometry: never disposed with a building
        if (vc && o.geometry.attributes.color) o.material = vc;
        else if (vc) o.material = L.toon({ color: o.material.color });
        o.castShadow = o.receiveShadow = true;
      });
      return g;
    }).catch(err => { console.warn('Kit model not loaded:', id, err); return null; }));
  }
  return cache.get(id);
}

// a model's meshes as geometries in the model's own frame, for instancing; `lamp` marks the parts that glow
export function parts(scene) {
  scene.updateMatrixWorld(true);
  const inv = scene.matrixWorld.clone().invert(), out = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    let lamp = false;
    for (let p = o; p && !lamp; p = p.parent) lamp = p.name === 'lamp';
    out.push({ geo: o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)), mat: lamp ? L.lampMat : o.material, lamp });
  });
  return out;
}
