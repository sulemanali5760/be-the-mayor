// Pure task rules for js/world: no DOM, no Three.js. Tested by rules.test.mjs in the assets workflow.
// Lengths in metres, brick heights in mm above the string line, time in seconds of game time (LESSONS T6).

/* ---------- wall: Brick by Brick's levelling mechanic, cut to one short garden wall ---------- */
export const WALL = {
  brick: [0.24, 0.115, 0.071], half: 0.115, headJoint: 0.01, bedJoint: 0.0123, // NF brick, as in Brick by Brick
  bricks: 5, courses: 2, // stretcher bond: 5 full + (half, 4 full, half) = 11 pieces
  mm: { placeOffset: [3, 8], tilt: [0.8, 2.6], tap: [0.6, 1.0], knock: [2, 5], knockPerSec: 6, lockAt: 1, perfect: 1, sunk: -2 },
  holdForKnock: 0.22,
  open: { normal: 30, rain: 12 }, // seconds the mortar stays workable under a brick
  limit: 90, // the foreman lays whatever is left at 90 s, so the job always gets done
  star3: { normal: 45, hurry: 35 }, // 3 stars also need this pace
};

// one slot per brick: course, kind, length, centre x along the wall, bottom y above the footing
export function wallSlots(w = WALL) {
  const [L, , H] = w.brick, slots = [];
  for (let c = 0; c < w.courses; c++) {
    const kinds = c % 2 ? ['half', ...Array(w.bricks - 1).fill('full'), 'half'] : Array(w.bricks).fill('full');
    let a = 0;
    kinds.forEach((kind, k) => {
      const len = kind === 'half' ? w.half : L;
      slots.push({ course: c, kind, len, x: a + len / 2, y: w.bedJoint + c * (H + w.bedJoint), joint: k > 0, last: k === kinds.length - 1 });
      a += len + w.headJoint;
    });
  }
  return slots;
}

// twist: 'rain' (mortar goes off in 12 s), 'cracked' (one brick comes off the pallet cracked), 'hurry' (3 stars need 35 s)
export function createWall(twist = null, rand = Math.random, w = WALL) {
  const slots = wallSlots(w), mm = w.mm;
  const between = ([a, b]) => a + (b - a) * rand();
  const open = twist === 'rain' ? w.open.rain : w.open.normal;
  const fulls = slots.map((_, i) => i).filter(i => i >= 2 && slots[i].kind === 'full');
  const crackedAt = twist === 'cracked' ? fulls[Math.floor(rand() * fulls.length)] : -1;
  const s = { cur: 0, hand: 'good', setting: null, results: [], done: false, seconds: null };
  const fail = msg => ({ ok: false, msg });
  const next = () => (s.done ? 'done' : s.setting ? 'level' : 'lay');
  // a brick lands proud of the line and tilted: one end higher than the other
  const landing = () => { const base = between(mm.placeOffset), tilt = between(mm.tilt) * (rand() < 0.5 ? -1 : 1); return [base - tilt / 2, base + tilt / 2]; };

  function lay(now) {
    if (s.done) return fail('The wall is finished.');
    if (s.setting) return fail('Level this brick first.');
    const [a, b] = landing();
    s.setting = { a, b, at: now, cracked: s.hand === 'cracked', relaid: false };
    return { ok: true, event: 'placed', slot: s.cur, a, b, cracked: s.setting.cracked };
  }

  function swap() {
    if (s.setting || s.hand !== 'cracked') return fail('That brick is fine.');
    s.hand = 'good';
    return { ok: true, event: 'swapped' };
  }

  // hold = seconds pressed (a long press is a knock, harder the longer you hold);
  // u = where along the brick you strike, 0 = left end (a), 1 = right end (b). The struck end sinks most.
  function hit(hold, u, now) {
    if (!s.setting) return fail('Lay a brick first.');
    const knock = hold >= w.holdForKnock;
    const d = knock ? Math.min(mm.knock[1], mm.knock[0] + (hold - w.holdForKnock) * mm.knockPerSec) * between([0.9, 1.1]) : between(mm.tap);
    u = Math.max(0, Math.min(1, u));
    const st = s.setting, base = { ok: true, knock, slot: s.cur };
    st.a -= d * (0.25 + 0.75 * (1 - u));
    st.b -= d * (0.25 + 0.75 * u);
    if (Math.min(st.a, st.b) < mm.sunk) {
      // too low: lift it and bed it again. Costs time, never the job (first try must be nearly impossible to fail)
      [st.a, st.b] = landing(); st.relaid = true; st.at = now;
      return { ...base, event: 'sunk', a: st.a, b: st.b };
    }
    if (Math.max(st.a, st.b) > mm.lockAt) return { ...base, event: 'hit', a: st.a, b: st.b };
    const worst = Math.max(Math.abs(st.a), Math.abs(st.b));
    return settle(now, st.cracked ? 'cracked' : worst <= mm.perfect && !st.relaid ? 'perfect' : 'good', base);
  }

  function settle(now, grade, base) {
    const st = s.setting, slot = s.cur;
    s.results.push({ slot, grade });
    s.setting = null; s.cur++;
    const ev = { ...base, event: 'set', slot, a: st.a, b: st.b, grade, course: slots[slot].last ? slots[slot].course : undefined };
    if (s.cur >= slots.length) { s.done = true; s.seconds = now; ev.done = true; } else s.hand = s.cur === crackedAt ? 'cracked' : 'good';
    return ev;
  }

  // every frame: mortar that goes off under a proud brick sets it where it is; at the limit the foreman finishes
  function tick(now) {
    const out = [];
    if (s.setting && now - s.setting.at > open) out.push(settle(now, s.setting.cracked ? 'cracked' : 'rough', { ok: true, knock: false, slot: s.cur, proud: true }));
    if (!s.done && now >= w.limit) {
      const from = s.cur;
      s.setting = null;
      for (; s.cur < slots.length; s.cur++) s.results.push({ slot: s.cur, grade: 'foreman' });
      s.done = true; s.seconds = w.limit;
      out.push({ ok: true, event: 'timeout', from, done: true });
    }
    return out;
  }

  const mortarLeft = now => (s.setting ? Math.max(0, open - (now - s.setting.at)) : null);
  const stars = () => wallStars(s.results, s.seconds ?? 0, twist, w);
  return { state: s, slots, open, crackedAt, next, lay, swap, hit, tick, mortarLeft, stars };
}

// 1 star for any finished wall; 2 for a tidy one; 3 for tidy and quick. A cracked brick left in caps it at 2.
export function wallStars(results, seconds, twist, w = WALL) {
  if (!results.length || results.some(r => r.grade === 'foreman')) return 1;
  const pts = { perfect: 3, good: 2, rough: 1, cracked: 1 };
  const avg = results.reduce((acc, r) => acc + pts[r.grade], 0) / results.length;
  const quick = seconds <= (twist === 'hurry' ? w.star3.hurry : w.star3.normal);
  const stars = avg >= 2.5 && quick ? 3 : avg >= 1.8 ? 2 : 1;
  return results.some(r => r.grade === 'cracked') ? Math.min(2, stars) : stars;
}

/* ---------- delivery: drive a van through 3-4 stops on the town map ---------- */
export const DELIVERY = { limit: 45, reach: 2.5, speed: 14, step: 0.25, margin: 1 };

// an oriented rectangle on the ground: centre, half sizes, rotation about y in radians (three.js rotation.y)
export const box = (cx, cz, hw, hd, rot = 0) => ({ cx, cz, hw, hd, rot });
function local(p, o) {
  const dx = p[0] - o.cx, dz = p[1] - o.cz, c = Math.cos(o.rot), s = Math.sin(o.rot);
  return [c * dx - s * dz, s * dx + c * dz];
}
export const inBox = (p, o) => { const [x, z] = local(p, o); return Math.abs(x) < o.hw && Math.abs(z) < o.hd; };
export const distToBox = (p, o) => { const [x, z] = local(p, o); return Math.hypot(Math.max(0, Math.abs(x) - o.hw), Math.max(0, Math.abs(z) - o.hd)); };

// straight from p towards q in small steps, stopping before the first obstacle
function walk(p, q, obstacles, step) {
  const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step);
  let at = p;
  for (let i = 1; i <= n; i++) {
    const c = [p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n];
    if (obstacles.some(o => inBox(c, o))) break;
    at = c;
  }
  return at;
}
// move at most maxDist from p towards q; when blocked, slide along x then z so the van doesn't stick to walls
export function drive(p, q, obstacles, maxDist, step = DELIVERY.step) {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (d < 1e-6) return p;
  const k = Math.min(1, maxDist / d), goal = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  let at = walk(p, goal, obstacles, step);
  if (Math.hypot(goal[0] - at[0], goal[1] - at[1]) > 1e-6) {
    at = walk(at, [goal[0], at[1]], obstacles, step);
    at = walk(at, [at[0], goal[1]], obstacles, step);
  }
  return at;
}

// shortest straight-line route from start through every stop, any order (at most 4 stops, so brute force)
export function bestTour(start, stops) {
  let best = Infinity;
  const go = (at, left, len) => {
    if (len >= best) return;
    if (!left.length) { best = len; return; }
    left.forEach((p, i) => go(p, left.filter((_, j) => j !== i), len + Math.hypot(p[0] - at[0], p[1] - at[1])));
  };
  go(start, stops, 0);
  return best;
}

// 0 if fewer than half the stops; 1 for some; all stops: 1-3 by how direct the route was and how quick
export function deliveryStars({ delivered, total, pathLen, best, seconds, limit = DELIVERY.limit }) {
  if (delivered < total) return delivered * 2 >= total ? 1 : 0;
  const ratio = pathLen / Math.max(1, best);
  return ratio <= 1.4 && seconds <= limit * 0.6 ? 3 : ratio <= 2 ? 2 : 1;
}
