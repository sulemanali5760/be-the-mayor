// CI only (assets workflow): load the real js/world in headless Chrome and drive it with pointer input.
// The page steps the game clock itself (fixed dt per frame, LESSONS T6), so software GL speed doesn't matter.
// Usage on the runner: python3 -m http.server 8080 & node tools/smoke_world.mjs http://localhost:8080/
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://localhost:8080/';
// a row of buildings facing +z, so a straight route along z ≈ 4.5 passes every front door
const town = [
  { id: 'cafe', type: 'cafe', x: -30, z: 0, rot: 0, state: 'ok', label: 'Café Lindner' },
  { id: 'house', type: 'house', x: -15, z: 0, rot: 0, state: 'broken' },
  { id: 'shop', type: 'shop', x: 0, z: 0, rot: 0, state: 'ok' },
  { id: 'school', type: 'school', x: 18, z: 0, rot: 0, state: 'ok' },
  { id: 'garden', type: 'garden', x: -15, z: -20, rot: 0, state: 'broken' },
  { id: 'hall', type: 'townhall', x: 10, z: -22, rot: 0, state: 'ok', label: 'Town hall' },
  { id: 'bus', type: 'bus_stop', x: 30, z: -14, rot: 90, state: 'broken' },
  { id: 'dump', type: 'dump_pile', x: -32, z: -18, rot: 0, state: 'broken' },
  { id: 'dump2', type: 'dump_pile', x: -32, z: -28, rot: 0, state: 'ok' },
  { id: 'yard', type: 'yard', x: 32, z: -28, rot: 180, state: 'ok', label: 'Brandt Bau yard' },
];
// the layout data/town.json carries in 0.2 (build 02 §3.3): roads, paths, props, homes and work
const content = {
  people: [{ id: 'ann', name: 'Ann', role: 'baker' }, { id: 'bo', name: 'Bo', role: 'teacher' }, { id: 'cy', name: 'Cy', role: 'pensioner' }, { id: 'rex', name: 'Rex', role: "Cy's dachshund" }],
  town: { buildings: town, roads: [[[-45, 8], [45, 8]], [[-45, -36], [45, -36]]], paths: [[[-15, 8], [-15, 3]]],
    props: [{ type: 'bench', x: -20, z: 5, rot: 0 }, { type: 'lamp', x: 8, z: 5.5 }, { type: 'tree', x: 50, z: 20 }],
    homes: { ann: 'house' }, work: { ann: 'shop' } },
};
const near = (a, b) => [16, 8, 0].every(s => Math.abs((a >> s & 255) - (b >> s & 255)) <= 1); // colours after an sRGB round trip
// the solid footprints of the front row [x, z, half w, half d]: a walk may never enter one
const SOLID = [[-30, 0, 3.5, 2.5], [-15, 0, 3, 2.5], [0, 0, 3.5, 2.5], [18, 0, 6, 3], [10, -22, 6, 4]];
const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head>
<body><canvas id="view"></canvas><script type="module">
const { createWorld } = await import('./js/world/world.js?v=smoke');
const w = createWorld(document.getElementById('view'), ${JSON.stringify(content)});
w.showTown({ town: ${JSON.stringify(town)} });
window.picks = [];
w.onPick(p => picks.push(p.id));
window.step = (n = 1, dt = 0.1) => { for (let i = 0; i < n; i++) w.frame(dt); };
window.run = (kind, params) => { window.res = null; w.playTask(kind, params).then(r => { window.res = r; }, e => { window.res = { error: String(e) }; }); };
window.walk = id => { window.walked = null; w.walkTo(id).then(r => { window.walked = r; }); };
step(1);
window.kitLoaded = await __btmWorld.loaded; // Lane A's models, fetched by the browser
step(1);
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function open(query) {
  const p = await browser.newPage({ viewport: { width: 960, height: 600 } });
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text() + m.location().url)) errors.push(m.text()); });
  await p.route(/\/__smoke\.html(\?|$)/, r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.goto(`${base}__smoke.html${query}`);
  await p.waitForFunction(() => window.ready, null, { timeout: 90000 }).catch(e => { console.log('page errors:', errors); throw e; });
  return p;
}
let page = await open('?q=low');
const W = (fn, arg) => page.evaluate(fn, arg);
const step = (n, dt = 0.1) => W(([n, dt]) => step(n, dt), [n, dt]);
const check = (name, fn) => fn().then(() => console.log(`ok   ${name}`), e => { console.log(`FAIL ${name}: ${e.message}`); process.exitCode = 1; });
const inside = ([x, z]) => SOLID.some(([cx, cz, hw, hd]) => Math.abs(x - cx) < hw && Math.abs(z - cz) < hd);
const sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b);
const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

await check('the kit: every building from the manifest (by id, then type), broken variants, rubble, the character', async () => {
  assert.equal(await W(() => window.kitLoaded), true);
  const k = await W(() => __btmWorld.kit());
  assert.ok(k.ready && k.character, JSON.stringify(k));
  const b = k.buildings;
  assert.deepEqual([b.cafe, b.shop, b.school, b.hall, b.yard, b.dump2], ['cafe', 'shop', 'school', 'townhall', 'yard', 'dump_pile']);
  assert.deepEqual([b.garden, b.bus, b.dump], ['garden_broken', 'busstop_broken', 'dump_pile_broken'], 'broken variants');
  assert.ok(['house', 'house_2', 'house_3'].includes(b.house), `a house: ${b.house}`);
  assert.equal(k.hands.length, 2, 'the town hall clock has two hands');
  const house = await W(() => __btmWorld.world.anchors().find(a => a.id === 'house'));
  assert.ok(Number.isFinite(house.y));
});

await check('showTown builds every building, anchors are finite', async () => {
  assert.equal((await W(() => __btmWorld.stats())).buildings, town.length);
  const a = await W(() => __btmWorld.world.anchors());
  assert.equal(a.filter(p => p.kind === 'building').length, town.length);
  assert.ok(a.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.ok(a.filter(p => p.visible).length >= 5, 'most of the town is on screen');
});

await check('a click on a building anchor picks it (screen space); tap(id) does too', async () => {
  const a = (await W(() => __btmWorld.world.anchors())).find(p => p.id === 'school');
  await page.mouse.click(a.x, a.y + 30); // a little below the anchor: on the building itself
  assert.deepEqual(await W(() => picks), ['school']);
  assert.equal(await W(() => __btmWorld.tap('cafe')), true);
  assert.equal(await W(() => __btmWorld.tap('nope')), false);
  assert.deepEqual(await W(() => picks), ['school', 'cafe']);
});

await check('drag pans, wheel zooms, pinch zooms, focus flies', async () => {
  const v0 = await W(() => __btmWorld.view);
  await page.mouse.move(480, 300); await page.mouse.down(); await page.mouse.move(380, 250, { steps: 5 }); await page.mouse.up();
  const v1 = await W(() => __btmWorld.view);
  assert.ok(Math.hypot(v1.x - v0.x, v1.z - v0.z) > 1, 'panned');
  assert.deepEqual(await W(() => picks), ['school', 'cafe'], 'a drag is not a tap');
  await page.mouse.wheel(0, 300); await step(1);
  const v2 = await W(() => __btmWorld.view);
  assert.ok(v2.d > v1.d, 'wheel down zooms out');
  await W(() => {
    const c = document.getElementById('view'), ev = (type, id, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: 300, bubbles: true }));
    ev('pointerdown', 1, 430); ev('pointerdown', 2, 530);
    for (let k = 1; k <= 5; k++) { ev('pointermove', 1, 430 - k * 20); ev('pointermove', 2, 530 + k * 20); }
    ev('pointerup', 1, 330); ev('pointerup', 2, 630);
  });
  const v3 = await W(() => __btmWorld.view);
  assert.ok(v3.d < v2.d, 'pinch out zooms in');
  await W(() => __btmWorld.world.focus('hall')); await step(12);
  const v4 = await W(() => __btmWorld.view);
  assert.ok(Math.hypot(v4.x - 10, v4.z + 22) < 0.5, `focused at ${v4.x}, ${v4.z}`);
});

// draw a route through ground points (x, z) with the mouse, as a player would
async function draw(points) {
  const s = await W(p => p.map(([x, z]) => __btmWorld.screen(x, z)), points);
  await page.mouse.move(...s[0]); await page.mouse.down();
  for (const p of s.slice(1)) await page.mouse.move(...p, { steps: 25 });
  await page.mouse.up();
}
const until = async (fn, max, dt = 0.1) => { for (let i = 0; i < max && !(await W(fn)); i++) await step(1, dt); };
const route = [[-30, 4.5], [-15, 4.5], [0, 4.5], [18, 4.5]];

await check('delivery: a drawn route through 3 stops gets 3 stars, and the town view comes back', async () => {
  const before = await W(() => __btmWorld.view);
  await W(() => run('delivery', { stops: ['house', 'shop', 'school'], from: 'cafe' }));
  await until(() => __btmWorld.task(), 20);
  const info = await W(() => __btmWorld.task());
  assert.equal(info.kind, 'delivery'); assert.equal(info.total, 3); assert.equal(info.barrier, null); assert.equal(info.limit, 45);
  assert.equal((await W(() => __btmWorld.avatar())).visible, false, 'you drive the van: the avatar steps out of the town');
  await draw(route);
  await until(() => window.res, 120);
  const res = await W(() => window.res);
  assert.equal(res.stars, 3, JSON.stringify(res));
  assert.ok(res.seconds > 2 && res.seconds < 10, `${res.seconds} s`);
  assert.deepEqual(await W(() => __btmWorld.view), before);
});

await check('delivery twist "rush": 10 s less; the first listed stop is the pickup (as in data/jobs.json)', async () => {
  await W(() => run('delivery', { stops: ['cafe', 'house', 'shop', 'school'], seconds: 45, twist: 'rush' }));
  await until(() => __btmWorld.task(), 20);
  const info = await W(() => __btmWorld.task());
  assert.equal(info.limit, 35);
  assert.deepEqual(info.stops.map(s => s.id), ['house', 'shop', 'school']);
  assert.ok(Math.abs(info.van[0] + 30) < 0.01, `starts at the café: ${info.van}`);
  await draw(route);
  await until(() => window.res, 120);
  assert.equal((await W(() => window.res)).stars, 3);
});

await check('delivery twist "closed road": the barrier blocks the direct leg; a detour gets round it', async () => {
  await W(() => run('delivery', { stops: 3, twist: 'Closed road' }));
  await until(() => __btmWorld.task(), 20);
  assert.equal((await W(() => __btmWorld.task())).total, 3, 'a count picks its own stops');
  await W(() => __btmWorld.finish(2));
  await until(() => window.res, 5);
  assert.equal((await W(() => window.res)).stars, 2, 'finish(stars) ends it');

  await W(() => run('delivery', { stops: ['house', 'shop', 'school'], from: 'cafe', twist: { id: 'closed_road', label: 'Road closed' } }));
  await until(() => __btmWorld.task(), 20);
  const b = (await W(() => __btmWorld.task())).barrier;
  assert.ok(b && Math.abs(b.x - 9) < 0.5, `barrier on the longest leg: ${JSON.stringify(b)}`);
  await draw(route);
  await step(60);
  let info = await W(() => __btmWorld.task());
  assert.equal(info.delivered, 2, 'the school is behind the barrier');
  assert.ok(info.van[0] < 9, `the van stopped at x = ${info.van[0]}`);
  await draw([info.van, [info.van[0], 14], [11, 14], [18, 4.5]]);
  await until(() => window.res, 120);
  const res = await W(() => window.res);
  assert.ok(res.stars >= 1 && res.seconds <= 45, JSON.stringify(res));
});

await check('wall (twist rain) in the Mayor\'s sleeves: tapping lays and levels bricks; it always ends by 90 s with a star', async () => {
  await W(() => run('wall', { twist: 'Rain', avatar: { rank: 4 } }));
  await until(() => __btmWorld.task(), 100);
  const info = await W(() => __btmWorld.task());
  assert.equal(info.kind, 'wall'); assert.equal(info.twist, 'rain'); assert.ok(info.total >= 8 && info.total <= 12);
  assert.ok(near(info.sleeve, 0x2f4a7a), `params.avatar rank 4: the manifest's Mayor sleeve, not ${info.sleeve.toString(16)}`);
  assert.equal(info.cuffs, 2);
  let laid = 0;
  for (let i = 0; i < 500 && !(await W(() => window.res)); i++) {
    const t = await W(() => __btmWorld.task());
    if (t && t.t < 89) laid = t.laid; // before the foreman steps in at 90 s
    await page.mouse.click(...(t?.aim ?? [480, 330])); // a quick tap in the middle of the brick
    await step(1, 0.2);
  }
  const res = await W(() => window.res);
  assert.ok(res && res.stars >= 1 && res.seconds <= 90, JSON.stringify(res));
  assert.ok(laid >= 8, `the bot laid ${laid} bricks itself`);
});

await check('life: named citizens walk, cars loop the roads, trees, birds, props wait for their area to be fixed', async () => {
  const li = await W(() => __btmWorld.life());
  assert.equal(li.people.length, 3, 'three people, the dachshund stays home');
  assert.equal(li.roads, 2); assert.equal(li.paths, 1); assert.equal(li.ring, false);
  assert.ok(li.trees >= 20, `${li.trees} trees`);
  assert.equal(li.cars.length, 3); assert.equal(li.birds, 5);
  assert.ok(li.props.shown > 0 && li.props.shown < li.props.total, `props ${JSON.stringify(li.props)}`);
  await step(10);
  const li2 = await W(() => __btmWorld.life());
  assert.ok(li2.cars.filter((c, i) => Math.hypot(c[0] - li.cars[i][0], c[1] - li.cars[i][1]) > 3).length >= 2, 'cars drive'); // one may be in a U-turn
  await until(() => __btmWorld.life().walking > 0, 80);
  assert.ok((await W(() => __btmWorld.life())).walking > 0, 'someone is walking');
  const persons = (await W(() => __btmWorld.world.anchors())).filter(a => a.kind === 'person');
  assert.equal(persons.length, (await W(() => __btmWorld.life())).citizens, 'people have anchors for bubbles');
});

await check('look: broken areas are grey on screen, fixed ones in colour', async () => {
  const g = await W(() => __btmWorld.grey());
  assert.deepEqual(g.map(z => z.id).sort(), ['bus', 'dump', 'garden', 'house']);
  assert.ok(g.every(z => z.a === 1 && z.to === 1));
  await W(() => __btmWorld.world.focus('garden')); await step(10);
  const s = async list => median(await Promise.all(list.map(p => W(([x, z]) => __btmWorld.sample(x, z), p).then(sat))));
  const grey = await s([[-15, -22.9], [-14, -23], [-16, -23]]), green = await s([[-5, -12], [-6, -12], [-5, -13]]);
  assert.ok(green > 0.25 && grey < green * 0.5, `saturation by the broken garden ${grey.toFixed(2)}, in the fixed street ${green.toFixed(2)}`);
});

await check('time of day eases over about 1.5 s: night, lamps and the town hall clock, then morning', async () => {
  let tod = await W(() => __btmWorld.tod());
  assert.ok(tod.night === 0 && tod.hours === 7, JSON.stringify(tod));
  const k0 = await W(() => __btmWorld.kit());
  assert.equal(k0.lampGlow, 0, 'lamps are off by day');
  await W(() => __btmWorld.world.setTimeOfDay(1)); await step(5);
  tod = await W(() => __btmWorld.tod());
  assert.ok(tod.t > 0.2 && tod.t < 0.5 && tod.night > 0 && tod.night < 1, `half way: ${JSON.stringify(tod)}`);
  await step(12);
  tod = await W(() => __btmWorld.tod());
  assert.ok(tod.t === 1 && tod.night === 1 && tod.sun < 1 && tod.hours === 23, `night: ${JSON.stringify(tod)}`);
  const k1 = await W(() => __btmWorld.kit());
  assert.ok(k1.lampGlow >= 2, 'lamps glow at night');
  assert.notDeepEqual(k1.hands, k0.hands, 'the clock hands turned');
  assert.equal((await W(() => __btmWorld.life())).birds, 0, 'birds sleep');
  await W(() => __btmWorld.world.setTimeOfDay(0.55)); await step(16);
  assert.equal((await W(() => __btmWorld.tod())).target, 0.55);
  await W(() => __btmWorld.world.setTimeOfDay(0)); await step(16);
  tod = await W(() => __btmWorld.tod());
  assert.ok(tod.night === 0 && tod.sun > 1.5 && tod.hours === 7, `morning: ${JSON.stringify(tod)}`);
  assert.deepEqual((await W(() => __btmWorld.kit())).hands, k0.hands, 'the clock runs on to 7:00 again');
});

await check('avatar: the kit character in town, and every rank wears a different outfit', async () => {
  await W(() => __btmWorld.world.focus('house')); await step(10);
  const a = await W(() => __btmWorld.avatar());
  assert.ok(a.visible, `on screen at ${a.x}, ${a.z}`);
  assert.equal(a.kit, true, 'character.gltf, not the stand-in');
  assert.equal(a.rank, 0); assert.equal(a.clip, 'idle');
  assert.deepEqual(a.parts.sort(), ['hardhat', 'vest'], 'Labourer: hard hat and hi-vis');
  const outfits = [];
  for (let r = 0; r <= 6; r++) outfits.push((await W(r => { __btmWorld.world.setAvatar({ rank: r }); return __btmWorld.avatar(); }, r)).outfit);
  assert.equal(new Set(outfits).size, 7);
  const set = await W(() => __btmWorld.world.setAvatar({ rank: 1, skin: 3, hair: 4, face: 1, extra: 'sunglasses' })); // indices, as saved
  assert.deepEqual(set, { skin: 0x9c6440, hair: 'blond', face: 'grin', rank: 1, extra: 'sunglasses' });
  const b = await W(() => __btmWorld.avatar());
  assert.equal(b.title, 'Skilled');
  assert.deepEqual(b.parts.sort(), ['sunglasses', 'tester', 'toolbelt']);
  assert.equal((await W(() => __btmWorld.world.setAvatar({ hair: 'bun', rank: undefined }))).hair, 'bun', 'a hair style id works too');
  assert.equal((await W(() => __btmWorld.avatar())).rank, 1, 'an undefined field keeps what is worn');
  assert.equal((await W(() => __btmWorld.world.setAvatar({ rank: 0, extra: 'cap' }))).extra, 'cap');
  assert.ok(!(await W(() => __btmWorld.avatar())).parts.includes('cap'), 'the hard hat wins over a cap');
  await W(() => __btmWorld.world.setAvatar({ rank: 0, extra: null }));
});

await check('walkTo: along the streets to the door in ≤ 3 s, never through a building', async () => {
  await W(() => walk('school'));
  const trail = [];
  for (let i = 0; i < 40 && (await W(() => window.walked)) === null; i++) { await step(1); trail.push(await W(() => { const a = __btmWorld.avatar(); return [a.x, a.z, a.clip]; })); }
  assert.equal(await W(() => window.walked), true);
  assert.ok(trail.length <= 31, `${trail.length} frames of 0.1 s`);
  assert.ok(trail.some(p => p[2] === 'walk'), 'the walk clip played');
  assert.ok(!trail.some(p => inside(p)), `through a building: ${JSON.stringify(trail.filter(p => inside(p)))}`);
  const a = await W(() => __btmWorld.avatar());
  assert.ok(Math.hypot(a.x - 18, a.z - 4.5) < 0.1 && a.clip === 'idle', `at the school door: ${a.x}, ${a.z}, ${a.clip}`);
  assert.equal(await W(() => __btmWorld.world.walkTo('nope')), false, 'an unknown id resolves false');
});

await check('walkTo is skippable: a tap on the town jumps to the end and picks nothing', async () => {
  const n = (await W(() => picks)).length;
  await W(() => walk('cafe')); await step(3);
  assert.equal((await W(() => __btmWorld.avatar())).walking, true);
  await page.mouse.click(60, 60);
  assert.equal(await W(() => window.walked), true);
  const a = await W(() => __btmWorld.avatar());
  assert.ok(!a.walking && Math.hypot(a.x + 30, a.z - 4) < 0.1, `at the café door: ${a.x}, ${a.z}`);
  assert.equal((await W(() => picks)).length, n, 'the tap only skipped the walk');
  await W(() => walk('hall')); await step(1);
  assert.equal(await W(() => __btmWorld.skipWalk()), true);
  const person = (await W(() => __btmWorld.life())).people.find(p => !p.inside);
  await W(id => walk(id), person.id);
  await until(() => window.walked !== null, 35);
  assert.equal(await W(() => window.walked), true, 'walks up to a person too');
});

await check('a fix brings the colour back; celebrate: confetti, a bounce, the avatar cheers', async () => {
  const before = (await W(() => __btmWorld.life())).props.shown;
  await W(t => __btmWorld.world.showTown({ town: t.map(b => (b.id === 'house' ? { ...b, state: 'ok' } : b)) }), town);
  assert.equal(await W(() => __btmWorld.lastFixed()), 'house');
  await W(() => __btmWorld.world.celebrate('fixed')); await step(1);
  assert.ok((await W(() => __btmWorld.life())).confetti > 50);
  assert.equal((await W(() => __btmWorld.avatar())).clip, 'cheer');
  await step(25);
  assert.ok(!(await W(() => __btmWorld.grey())).some(z => z.id === 'house'), 'the grey has faded');
  assert.ok((await W(() => __btmWorld.life())).props.shown > before, 'the bench by the house appears');
  await step(12);
  assert.equal((await W(() => __btmWorld.avatar())).clip, 'idle');
  assert.equal((await W(() => __btmWorld.life())).confetti, 0);
  await W(() => __btmWorld.world.celebrate('promotion')); await W(() => __btmWorld.world.celebrate('like')); await step(40);
});

await check('a visit to a town without roads: a ring road, the avatar by its house, lit and broken lamps, the kiosk by id; home again', async () => {
  await W(() => __btmWorld.world.showTown({ buildings: [
    { id: 'townhall', type: 'townhall', x: 0, z: 0, rot: 0, state: 'ok', label: 'Town hall' },
    { id: 'home', type: 'house', x: 14, z: 6, rot: 0, state: 'ok' }, { id: 'park', type: 'park', x: -14, z: -16, rot: 0, state: 'broken' },
    { id: 'kiosk', type: 'shop', x: 14, z: -10, rot: 0, state: 'ok' },
    { id: 'lamp_ok', type: 'streetlight', x: 7, z: 8, rot: 0, state: 'ok' }, { id: 'lamp_out', type: 'streetlight', x: -7, z: 8, rot: 0, state: 'broken' }] }));
  const li = await W(() => __btmWorld.life());
  assert.ok(li.ring && li.roads === 1 && li.cars.length === 3, JSON.stringify(li));
  const a = await W(() => __btmWorld.avatar()), k = Math.SQRT1_2 * (Math.hypot(6, 5) / 2 + 1.2);
  assert.ok(Math.hypot(a.x - 14 - k, a.z - 6 - k) < 0.1, `by the only house, on the camera's side: ${a.x}, ${a.z}`);
  assert.deepEqual((await W(() => __btmWorld.grey())).map(z => z.id).sort(), ['lamp_out', 'park']);
  const kit = await W(() => __btmWorld.kit());
  assert.equal(kit.buildings.kiosk, 'kiosk', 'a shop with the id kiosk gets its own model');
  assert.equal(kit.buildings.lamp_out, 'streetlight', 'no broken variant: the ok model, greyed, with rubble');
  assert.deepEqual(kit.lamps, [{ id: 'lamp_ok', lit: true }, { id: 'lamp_out', lit: false }]);
  await step(5);
  await W(t => __btmWorld.world.showTown({ town: t }), town);
  assert.equal((await W(() => __btmWorld.life())).ring, false);
});

const perf = async q => {
  await step(1);
  const s = await W(() => __btmWorld.stats());
  console.log(`perf q=${q}: ${s.calls} draw calls, ${s.triangles} triangles in one town frame (budget 150, 60000)`);
  assert.ok(s.calls <= 150 && s.triangles <= 60000, JSON.stringify(s));
};
await check('perf, q=low: within the phone budget', () => perf('low'));

await check('a phone-sized resize keeps the camera finite', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await step(2);
  const v = await W(() => __btmWorld.view), a = await W(() => __btmWorld.world.anchors());
  assert.ok(Number.isFinite(v.d) && a.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});
await page.screenshot({ path: 'smoke-town-low.png' });

// full quality: outlines (multisampled target + depth edges) and the shadow map, as on phones
page = await open('');
await check('perf, full quality: outlines and shadows on, within the phone budget', async () => {
  await step(3);
  const tod = await W(() => __btmWorld.tod());
  assert.ok(tod.outlines && tod.shadows, JSON.stringify(tod));
  await perf('high');
  await W(() => __btmWorld.world.setTimeOfDay(0.35)); await step(16);
});

await check('no page errors', async () => assert.deepEqual(errors, []));
await page.screenshot({ path: 'smoke-town.png' });
await browser.close();
