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
const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head>
<body><canvas id="view"></canvas><script type="module">
const { createWorld } = await import('./js/world/world.js?v=smoke');
const w = createWorld(document.getElementById('view'), {});
w.showTown({ town: ${JSON.stringify(town)} });
window.picks = [];
w.onPick(p => picks.push(p.id));
window.step = (n = 1, dt = 0.1) => { for (let i = 0; i < n; i++) w.frame(dt); };
window.run = (kind, params) => { window.res = null; w.playTask(kind, params).then(r => { window.res = r; }, e => { window.res = { error: String(e) }; }); };
step(1);
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text() + m.location().url)) errors.push(m.text()); });
await page.route(/\/__smoke\.html(\?|$)/, r => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`${base}__smoke.html?q=low`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 }).catch(e => { console.log('page errors:', errors); throw e; });
const W = (fn, arg) => page.evaluate(fn, arg);
const step = (n, dt = 0.1) => W(([n, dt]) => step(n, dt), [n, dt]);
const check = (name, fn) => fn().then(() => console.log(`ok   ${name}`), e => { console.log(`FAIL ${name}: ${e.message}`); process.exitCode = 1; });

await check('showTown builds every building, anchors are finite', async () => {
  assert.equal((await W(() => __btmWorld.stats())).buildings, town.length);
  const a = await W(() => __btmWorld.world.anchors());
  assert.equal(a.length, town.length);
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

await check('wall (twist rain): tapping lays and levels bricks; it always ends by 90 s with a star', async () => {
  await W(() => run('wall', { twist: 'Rain' }));
  await until(() => __btmWorld.task(), 100);
  const info = await W(() => __btmWorld.task());
  assert.equal(info.kind, 'wall'); assert.equal(info.twist, 'rain'); assert.ok(info.total >= 8 && info.total <= 12);
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

await check('a phone-sized resize keeps the camera finite', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await step(2);
  const v = await W(() => __btmWorld.view), a = await W(() => __btmWorld.world.anchors());
  assert.ok(Number.isFinite(v.d) && a.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

await check('no page errors', async () => assert.deepEqual(errors, []));
await page.screenshot({ path: 'smoke-town.png' });
await browser.close();
