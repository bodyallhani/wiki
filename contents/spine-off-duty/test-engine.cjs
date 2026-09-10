/* Run with node test-engine.cjs. No dependencies or browser required. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = __dirname;
const context = {}; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(base, 'engine.js'), 'utf8'), context);
const E = context.BodyallEngine;
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function advance(g, seconds, controller = () => {}, fps = 60) {
  for (let frame = 0; frame < seconds * fps && g.state === 'playing'; frame++) { controller(g); g.advance(1 / fps); }
  return g.snapshot();
}
function controller(g) {
  // A simple prospective player: choose a safe lane while seeking breaks.
  const choices = [44, 64, 108, 152, 196, 240, 284, 328, 372, 416, 436];
  const active = g.items.filter(i => !i.resolved && i.at < g.time + .4);
  let best = g.x, cost = Infinity;
  for (const x of choices) {
    let c = Math.abs(x - g.x) * .025;
    for (const i of active) {
      const until = (E.PLAYER_Y - i.y) / i.speed;
      if (until < -.1 || until > 1.6) continue;
      const d = Math.abs(i.x - x), soon = Math.max(.1, until);
      if (i.kind === 'work' && d < 65) c += (65 - d) * 8 / soon;
      if (i.kind === 'break') c += d * (g.fatigue > 55 ? .7 : .35) / Math.max(.6, soon);
    }
    if (c < cost) { cost = c; best = x; }
  }
  g.setTarget(best);
}
test('challenge codes reject malformed and unbounded input', () => {
  assert(E.validSeed('v1-hello')); assert(!E.validSeed('<script>')); assert(!E.validSeed('v1-' + 'a'.repeat(50)));
  assert(!E.validSeed('v2-hello')); assert.throws(() => new E.Game('bad'));
});
test('same challenge generates the exact same schedule', () => {
  assert.equal(JSON.stringify(E.schedule('v1-hello')), JSON.stringify(E.schedule('v1-hello')));
  assert.notEqual(JSON.stringify(E.schedule('v1-hello')), JSON.stringify(E.schedule('v1-world')));
  for (const item of E.schedule('v1-hello')) { assert(item.x >= 44 && item.x <= 436); assert(item.at < 60); }
});
test('frame rate does not affect a stationary replay', () => {
  const a = new E.Game('v1-stable'), b = new E.Game('v1-stable');
  advance(a, 9, () => {}, 30); advance(b, 9, () => {}, 120);
  assert.equal(JSON.stringify(a.snapshot()), JSON.stringify(b.snapshot()));
});
test('pause freezes score, position, time and fatigue', () => {
  const g = new E.Game('v1-paused'); advance(g, 3); g.pause(); const s = JSON.stringify(g.snapshot());
  g.advance(10); assert.equal(JSON.stringify(g.snapshot()), s); g.resume(); g.advance(.1); assert(g.time > 3);
});
test('target stays on screen and invalid input cannot poison physics', () => {
  const g = new E.Game('v1-bounds'); g.setTarget(-Infinity); assert.equal(g.target, 240);
  g.setTarget(-500); assert.equal(g.target, 44); g.setTarget(10000); assert.equal(g.target, 436);
  advance(g, 3); assert(g.x <= 436 && g.x >= 44); g.advance(NaN); assert(Number.isFinite(g.time));
});
test('hidden-tab-sized deltas do not fast-forward the game', () => {
  const g = new E.Game('v1-tab'); g.advance(999); assert(g.time <= .10001);
});
test('collecting a break lowers fatigue and rewards points', () => {
  const g = new E.Game('v1-break'); g.fatigue = 60;
  g.items = [{ id: 99, at: -(E.PLAYER_Y + 36) / 170, x: 240, kind: 'break', speed: 170, resolved: false }];
  const events = g.advance(1 / 60); assert.equal(g.breaks, 1); assert(g.fatigue < 36); assert(g.score >= 170); assert(events.some(e => e.type === 'break'));
});
test('simultaneous work hits consume one coffee during invulnerability', () => {
  const g = new E.Game('v1-hits');
  g.items = [1, 2].map(id => ({ id, at: -(E.PLAYER_Y + 36) / 170, x: 240, kind: 'work', speed: 170, label: '업무', resolved: false }));
  g.advance(1 / 60); assert.equal(g.cups, 2); assert.equal(g.hits, 1);
});
test('three hits or maximum fictional fatigue end a round', () => {
  const a = new E.Game('v1-coffee'); a.cups = 0; a.advance(1 / 60); assert.equal(a.reason, 'coffee');
  const b = new E.Game('v1-tired'); b.fatigue = 100; b.advance(1 / 60); assert.equal(b.reason, 'overload');
});
test('a full 60-second round earns a clear bonus once', () => {
  const g = new E.Game('v1-clear'); g.queue = []; g.time = 59.99; g.fatigue = 0; g.advance(.1);
  assert.equal(g.reason, 'clear'); assert.equal(g.time, 60); assert.equal(g.score, 1420);
  const s = JSON.stringify(g.snapshot()); g.advance(.1); assert.equal(JSON.stringify(g.snapshot()), s);
});
test('new folder contains every local runtime asset and referenced UI ID', () => {
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML ids');
  for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(id), `Missing UI id ${id}`);
  for (const [, asset] of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) assert(fs.existsSync(path.join(base, asset)), `Missing ${asset}`);
  assert(!html.includes('user-scalable=no')); assert(!app.includes('innerHTML')); assert(!app.includes('fetch('));
});
const samples = Array.from({ length: 30 }, (_, i) => {
  const g = new E.Game('v1-test' + i); return advance(g, 61, controller);
});
const clears = samples.filter(s => s.reason === 'clear').length;
test('prospective controller can finish at least 80% of 30 sampled patterns', () => {
  assert(clears >= 24, `${clears}/30 clears; difficulty or route issue`);
});
const idle = Array.from({ length: 20 }, (_, i) => advance(new E.Game('v1-idle' + i), 61));
console.log(JSON.stringify({ tests: count, simulatedPatterns: samples.length, controllerClears: clears, controllerMeanSeconds: +(samples.reduce((a, s) => a + s.seconds, 0) / samples.length).toFixed(1), idleMeanSeconds: +(idle.reduce((a, s) => a + s.seconds, 0) / idle.length).toFixed(1), idleClears: idle.filter(s => s.reason === 'clear').length }, null, 2));
