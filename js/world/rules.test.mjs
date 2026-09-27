// node --test js/world/  (runs in the assets workflow on GitHub, never on the dev laptop: LESSONS T1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WALL, wallSlots, createWall, wallStars, DELIVERY, box, inBox, distToBox, drive, bestTour, deliveryStars,
  navGrid, findPath, pathLength, pointAt, walkSpeed, WALK } from './rules.js';

const seeded = (n = 1) => () => (n = (n * 16807) % 2147483647) / 2147483647;

test('the wall is 8-12 bricks of stretcher bond, both courses the same length', () => {
  const s = wallSlots();
  assert.ok(s.length >= 8 && s.length <= 12, `${s.length} bricks`);
  const end = c => Math.max(...s.filter(x => x.course === c).map(x => x.x + x.len / 2));
  assert.ok(Math.abs(end(0) - end(1)) < 1e-9);
  assert.equal(s.filter(x => x.last).length, WALL.courses);
  assert.deepEqual(s.filter(x => x.course === 1).map(x => x.kind).filter((k, i, a) => i === 0 || i === a.length - 1), ['half', 'half']);
});

// a bot plays the wall: pick(setting) → [hold, u]; gap = seconds per tap
function play(twist, rand, pick, gap = 0.7, onCracked = g => g.lay) {
  const g = createWall(twist, rand);
  let now = 0;
  for (let i = 0; i < 1000 && g.next() !== 'done'; i++) {
    if (g.next() === 'lay') {
      if (g.state.hand === 'cracked' && onCracked(g) === g.swap) g.swap(); else g.lay(now);
    } else if (pick) { const [hold, u] = pick(g.state.setting); g.hit(hold, u, now); }
    now += gap;
    g.tick(now);
  }
  return g;
}
const careful = st => [Math.max(st.a, st.b) > 4 ? 0.4 : 0.05, st.a > st.b ? 0.1 : 0.9];
const middle = () => [0.05, 0.5];

test('a quick, careful player (0.4 s per tap) finishes inside the 3-star pace with 3 stars', () => {
  let three = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = play(null, seeded(seed), careful, 0.4);
    assert.equal(g.state.done, true);
    assert.ok(g.state.seconds <= WALL.star3.normal, `seed ${seed}: ${g.state.seconds.toFixed(1)} s`);
    if (g.stars() === 3) three++;
  }
  assert.ok(three >= 18, `${three} of 20 runs got 3 stars`);
});

test('nearly impossible to fail: tapping only the middle still finishes with a star', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = play(null, seeded(seed), middle);
    assert.equal(g.state.done, true);
    assert.ok(g.state.seconds <= WALL.limit);
    assert.ok(g.stars() >= 1);
  }
});

test('never levelling: the mortar sets bricks proud, the foreman finishes at 90 s, still 1 star', () => {
  const g = play(null, seeded(3), null, 1);
  assert.equal(g.state.done, true);
  assert.equal(g.state.seconds, WALL.limit);
  assert.ok(g.state.results.some(r => r.grade === 'rough'));
  assert.ok(g.state.results.some(r => r.grade === 'foreman'));
  assert.equal(g.stars(), 1);
});

test('knocking too hard sinks the brick: it is re-bedded, never lost', () => {
  const g = createWall(null, seeded(5));
  g.lay(0);
  let ev;
  for (let i = 0; i < 20 && (!ev || ev.event === 'hit'); i++) ev = g.hit(2, 0, 1); // hard knocks on the left end
  assert.equal(ev.event, 'sunk');
  assert.equal(g.next(), 'level');
  assert.ok(ev.a > 0 && ev.b > 0);
});

test('rain: the mortar goes off sooner', () => {
  assert.ok(createWall('rain').open < createWall(null).open);
  const g = createWall('rain', seeded(2));
  g.lay(0);
  const [ev] = g.tick(WALL.open.rain + 0.1);
  assert.equal(ev.grade, 'rough');
  assert.equal(ev.proud, true);
});

test('cracked: laying the cracked brick caps the wall at 2 stars; swapping it keeps 3 in reach', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const laid = play('cracked', seeded(seed), careful, 0.4);
    assert.ok(laid.state.results.some(r => r.grade === 'cracked'));
    assert.ok(laid.stars() <= 2);
    const swapped = play('cracked', seeded(seed), careful, 0.4, g => g.swap);
    assert.ok(!swapped.state.results.some(r => r.grade === 'cracked'));
    assert.ok(swapped.stars() >= 2, `seed ${seed}`);
  }
});

test('hurry: the same wall needs a quicker pace for 3 stars', () => {
  const tidy = Array.from({ length: 11 }, (_, slot) => ({ slot, grade: 'perfect' }));
  assert.equal(wallStars(tidy, 40, null), 3);
  assert.equal(wallStars(tidy, 40, 'hurry'), 2);
});

test('boxes: rotation, containment, distance', () => {
  const b = box(10, 0, 3, 1, Math.PI / 2); // turned a quarter: 2 m along x, 6 m along z
  assert.ok(inBox([10, 2.5], b));
  assert.ok(!inBox([12.5, 0], b));
  assert.ok(Math.abs(distToBox([10, 5], b) - 2) < 1e-9);
});

test('drive: stops at a wall, slides along it, and never jumps a thin barrier', () => {
  const wall = box(5, 0, 0.3, 10); // a wall across x = 5
  const at = drive([0, 0], [10, 0], [wall], 100);
  assert.ok(at[0] < 4.7 && at[0] > 4.4, `stopped at ${at[0]}`);
  const slid = drive([4.6, 0], [4.9, 6], [wall], 100);
  assert.ok(slid[1] > 5.9, 'slides along the wall');
  const big = drive([0, 0], [10, 0], [wall], 100, 0.25);
  assert.ok(big[0] < 5);
  const turned = box(5, 0, 0.3, 10, 0.3); // the same wall turned 0.3 rad: the van slides along it, not stuck
  const along = drive([0, 0], [10, 0], [turned], 100);
  assert.ok(Math.abs(along[1]) > 1 && !inBox(along, turned), `slid to ${along}`);
  const capped = drive([0, 0], [100, 0], [], DELIVERY.speed * 0.5);
  assert.ok(Math.abs(capped[0] - 7) < 1e-9, 'speed limit per frame');
});

test('bestTour and delivery stars', () => {
  const tour = bestTour([0, 0], [[10, 0], [-5, 0], [20, 0]]);
  assert.equal(tour, 5 + 15 + 10); // -5 first, then 10, then 20
  assert.equal(deliveryStars({ delivered: 3, total: 3, pathLen: 45, best: 40, seconds: 20 }), 3);
  assert.equal(deliveryStars({ delivered: 3, total: 3, pathLen: 70, best: 40, seconds: 20 }), 2);
  assert.equal(deliveryStars({ delivered: 3, total: 3, pathLen: 45, best: 40, seconds: 40 }), 2);
  assert.equal(deliveryStars({ delivered: 3, total: 3, pathLen: 100, best: 40, seconds: 40 }), 1);
  assert.equal(deliveryStars({ delivered: 2, total: 4, pathLen: 10, best: 40, seconds: 45 }), 1);
  assert.equal(deliveryStars({ delivered: 1, total: 3, pathLen: 10, best: 40, seconds: 45 }), 0);
});

const B20 = [-10, 10, -10, 10];
const samples = (pts, step = 0.25) => Array.from({ length: Math.ceil(pathLength(pts) / step) + 1 }, (_, i) => pointAt(pts, i * step)).map(p => [p.x, p.z]);

test('walking: the route goes round a solid building, never through it', () => {
  const wall = box(0, 0, 1, 6); // 2 m thick, 12 m long, across the straight line
  const pts = findPath(navGrid(B20, [wall]), [-5, 0], [5, 0]);
  assert.ok(pts, 'a route exists');
  assert.deepEqual(pts[0], [-5, 0]); assert.deepEqual(pts[pts.length - 1], [5, 0]);
  assert.ok(samples(pts).every(p => !inBox(p, wall)), 'no point of the walk is inside the wall');
  assert.ok(pts.some(p => Math.abs(p[1]) > 6), 'it walks round the end of the wall');
  assert.ok(pathLength(pts) < 30);
});

test('walking: roads and paths are preferred over grass', () => {
  const road = { pts: [[-10, 6], [10, 6]], w: 2 };
  const onRoad = findPath(navGrid(B20, [], [road]), [-8, 2], [8, 2]);
  assert.ok(Math.max(...onRoad.map(p => p[1])) >= 5, `uses the road: ${JSON.stringify(onRoad)}`);
  const plain = findPath(navGrid(B20, []), [-8, 2], [8, 2]);
  assert.ok(Math.abs(pathLength(plain) - 16) < 1e-9, 'without a road it walks straight');
});

test('walking: a start inside a wall steps out; a walled-in goal is unreachable', () => {
  const wall = box(0, 0, 1, 6);
  const out = findPath(navGrid(B20, [wall]), [0, 0], [6, 0]);
  assert.ok(out && out[out.length - 1][0] === 6);
  const ring = [box(5, 2.5, 3, 0.6), box(5, 7.5, 3, 0.6), box(2.5, 5, 0.6, 3), box(7.5, 5, 0.6, 3)];
  assert.equal(findPath(navGrid(B20, ring), [-5, -5], [5, 5]), null);
});

test('walking: path length, points along it, and the 3-second cap', () => {
  const pts = [[0, 0], [3, 4], [3, 10]];
  assert.equal(pathLength(pts), 11);
  const a = pointAt(pts, 2.5), b = pointAt(pts, 8), c = pointAt(pts, 100);
  assert.ok(Math.abs(a.x - 1.5) < 1e-9 && Math.abs(a.z - 2) < 1e-9 && Math.abs(a.dir - Math.atan2(3, 4)) < 1e-9);
  assert.ok(Math.abs(b.x - 3) < 1e-9 && Math.abs(b.z - 7) < 1e-9 && b.dir === 0, 'faces +z on the second leg');
  assert.deepEqual([c.x, c.z], [3, 10]);
  assert.equal(walkSpeed(3), WALK.speed);
  for (const len of [10, 60, 150]) assert.ok(len / walkSpeed(len) <= WALK.max + 1e-9, `${len} m in ≤ 3 s`);
});
