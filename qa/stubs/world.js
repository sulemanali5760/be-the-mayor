// CI-only stand-in for Lane W's js/world/world.js (contract §3.3), copied in by qa.yml only while the real
// file is missing. Draws nothing; tasks end through window.__btmWorld.finish(stars).
export function createWorld(canvas) {
  let task = null, pickFn = () => {};
  window.__btmWorld = {
    finish(stars = 3) { if (task) { const t = task; task = null; t.resolve({ stars, seconds: +t.sec.toFixed(2) }); } },
    tap(id) { pickFn({ id }); },
  };
  return {
    showTown() {},
    anchors: () => [{ id: 'busstop', x: canvas.clientWidth / 2, y: canvas.clientHeight / 2, visible: true }],
    onPick(fn) { pickFn = fn; },
    focus() {},
    playTask: () => new Promise(resolve => { task = { resolve, sec: 0 }; }),
    frame(dt) { if (task) task.sec += dt; },
  };
}
