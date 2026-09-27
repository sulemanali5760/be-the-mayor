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
// move at most maxDist from p towards q; when blocked, slide along the blocking box's own sides (its local x,
// then z; world x then z for a box that isn't turned) so the van doesn't stick to walls, turned ones included
export function drive(p, q, obstacles, maxDist, step = DELIVERY.step) {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (d < 1e-6) return p;
  const k = Math.min(1, maxDist / d), goal = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  let at = walk(p, goal, obstacles, step);
  const left = () => [goal[0] - at[0], goal[1] - at[1]];
  const [lx, lz] = left(), n = Math.hypot(lx, lz);
  if (n > 1e-6) {
    const probe = [at[0] + lx / n * step, at[1] + lz / n * step];
    const rot = obstacles.find(o => inBox(probe, o))?.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
    for (const [ax, az] of [[c, -s], [s, c]]) {
      const [rx, rz] = left(), along = rx * ax + rz * az;
      at = walk(at, [at[0] + ax * along, at[1] + az * along], obstacles, step);
    }
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

/* ---------- walking: A* on a 1 m grid; roads and paths are cheap, grass costs more, solid buildings are walls ---------- */
export const NAV = { cell: 1, road: 1, grass: 3 };
export const WALK = { speed: 3.2, max: 3 }; // the avatar jogs, but a walk never takes more than 3 s (build 02 §3.3)
export const walkSpeed = len => Math.max(WALK.speed, len / WALK.max);

function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const k = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dz * k);
}
// bounds [x0, x1, z0, z1]; walls: boxes (see box()); lanes: [{ pts: [[x, z], ...], w }] polylines w metres wide
export function navGrid(bounds, walls, lanes = [], cell = NAV.cell) {
  const [x0, x1, z0, z1] = bounds, nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell));
  const cost = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const p = [x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell];
    cost[j * nx + i] = walls.some(o => inBox(p, o)) ? Infinity
      : lanes.some(l => l.pts.some((a, k) => k > 0 && segDist(p, l.pts[k - 1], a) <= l.w / 2)) ? NAV.road : NAV.grass;
  }
  return { x0, z0, nx, nz, cell, cost };
}

// cheapest route from → to as corner points (8 neighbours, no cutting past a wall's corner). A start or goal inside
// a wall moves to the nearest free cell; null when the goal can't be reached.
export function findPath(g, from, to) {
  const { nx, nz, cell, cost } = g, n = nx * nz;
  const cellOf = ([x, z]) => Math.min(nz - 1, Math.max(0, Math.floor((z - g.z0) / cell))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - g.x0) / cell)));
  const near = k => { // breadth-first to the nearest walkable cell
    const seen = new Uint8Array(n), q = [k];
    seen[k] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = c % nx, j = (c - i) / nx;
      if (cost[c] < Infinity) return c;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (a >= 0 && b >= 0 && a < nx && b < nz && !seen[b * nx + a]) { seen[b * nx + a] = 1; q.push(b * nx + a); }
    }
    return -1;
  };
  const s = near(cellOf(from)), e = near(cellOf(to));
  if (s < 0 || e < 0) return null;
  const ei = e % nx, ej = (e - ei) / nx;
  const h = k => { const dx = Math.abs(k % nx - ei), dz = Math.abs(Math.floor(k / nx) - ej); return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * NAV.road; };
  const gs = new Float64Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), done = new Uint8Array(n), heap = [];
  const push = (f, k) => {
    heap.push([f, k]);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top[1];
  };
  gs[s] = 0; push(h(s), s);
  while (heap.length) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === e) break;
    const i = k % nx, j = (k - i) / nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj, m = b * nx + a;
      if ((!di && !dj) || a < 0 || b < 0 || a >= nx || b >= nz || done[m] || cost[m] === Infinity) continue;
      if (di && dj && (cost[j * nx + a] === Infinity || cost[b * nx + i] === Infinity)) continue;
      const ng = gs[k] + (di && dj ? Math.SQRT2 : 1) * (cost[k] + cost[m]) / 2;
      if (ng < gs[m]) { gs[m] = ng; came[m] = k; push(ng + h(m), m); }
    }
  }
  if (!done[e]) return null;
  const cells = [];
  for (let k = e; k !== -1; k = came[k]) cells.unshift(k);
  const centre = k => [g.x0 + (k % nx + 0.5) * cell, g.z0 + (Math.floor(k / nx) + 0.5) * cell];
  const pts = [from];
  for (let q = 1; q < cells.length - 1; q++) { // keep only the cells where the direction changes
    const [a, b, c] = [cells[q - 1], cells[q], cells[q + 1]];
    if (b - a !== c - b) pts.push(centre(b));
  }
  pts.push(to);
  return pts;
}

export const pathLength = pts => pts.reduce((l, p, i) => (i ? l + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
// the point s metres along a path, and the heading there (radians, three.js rotation.y: 0 faces +z)
export function pointAt(pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= l || i === pts.length - 1) {
      const k = l ? Math.max(0, Math.min(1, s / l)) : 1;
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, dir: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    s -= l;
  }
  return { x: pts[0][0], z: pts[0][1], dir: 0 };
}
