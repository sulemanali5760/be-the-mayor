// Test helpers (Node only): load data/*.json from disk and a seeded random for deterministic runs.
import { readFileSync } from 'node:fs';
import { CONTENT } from './life.js';

export const loadContent = () => Object.fromEntries(CONTENT.map(n =>
  [n, JSON.parse(readFileSync(new URL(`../../data/${n}.json`, import.meta.url), 'utf8'))]));

// mulberry32
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
