import assert from 'node:assert/strict';
import { TowerGame, validSeed } from './engine.mjs';

assert.equal(validSeed('mallow-20260922'), true);
assert.equal(validSeed('../bad'), false);

const a = new TowerGame('mallow-deterministic');
const b = new TowerGame('mallow-deterministic');
a.start(); b.start();
for (let i = 0; i < 900; i++) {
  if (i === 140 || i === 320 || i === 540) { a.place(); b.place(); }
  a.advance(1 / 60); b.advance(1 / 60);
}
assert.deepEqual(a.snapshot(), b.snapshot(), 'same seed and taps must produce the same tower');

const guided = new TowerGame('mallow-guided');
guided.start();
for (let i = 0; i < 60 * 150 && guided.state === 'playing' && guided.level < 30; i++) {
  const snap = guided.snapshot();
  if (Math.abs(snap.mover.x - snap.idealX) < .035) guided.place();
  guided.advance(1 / 60);
}
assert.equal(guided.level, 30, 'a precise player must be able to build a long tower');
assert.equal(guided.state, 'playing');
assert.equal(guided.perfects, 30);
assert.ok(guided.maxLoad >= .2, 'even a precise player must see compensation load from the changing ground');
assert.ok(guided.snapshot().mover.speed >= 5, 'high floors must reach the intended speed tier');
assert.ok(guided.snapshot().mover.width <= 1.35, 'high floors must use the narrow tier');

const hazardGame = new TowerGame('mallow-hazards');
hazardGame.start();
const hazardEvents = [];
for (let i = 0; i < 60 * 35 && hazardGame.state === 'playing' && hazardGame.level < 5; i++) {
  const snap = hazardGame.snapshot();
  if (Math.abs(snap.mover.x - snap.idealX) < .035) hazardEvents.push(...hazardGame.place());
  hazardEvents.push(...hazardGame.advance(1 / 60));
}
assert.ok(hazardEvents.some(event => event.type === 'hazardWarning'), 'hazards must be telegraphed before they act');
assert.ok(hazardEvents.some(event => event.type === 'hazardStart'), 'the first slope event must become active');

const rescue = new TowerGame('mallow-rescue-window');
rescue.start();
rescue.load = .9;
rescue.lean = .24;
rescue.targetLean = .24;
rescue.strain = .8;
rescue.blocks.push({ x: 2, width: 2, hue: 0 });
const rescueEvents = [];
for (let i = 0; i < 55 && rescue.state === 'playing'; i++) rescueEvents.push(...rescue.advance(1 / 60));
assert.equal(rescue.state, 'playing', 'high load must leave a playable rescue window');
assert.ok(rescue.snapshot().dangerActive, 'rescue countdown must become visible during sustained overload');
assert.ok(rescueEvents.some(event => event.type === 'rescueStart'));

const recovering = new TowerGame('mallow-recovery');
recovering.start();
const recoveryEvents = [];
for (let i = 0; i < 60 * 100 && recovering.state === 'playing' && recovering.level < 18; i++) {
  const snap = recovering.snapshot();
  const target = recovering.level < 4 ? snap.blocks.at(-1).x + .4 : snap.idealX;
  if (Math.abs(snap.mover.x - target) < .035) recoveryEvents.push(...recovering.place());
  recoveryEvents.push(...recovering.advance(1 / 60));
}
assert.ok(recovering.maxLoad > .5, 'crooked stacking must create visible compensation load');
assert.ok(recoveryEvents.some(event => event.type === 'recovery'), 'counter-stacking must trigger a recovery');

const missed = new TowerGame('mallow-miss');
missed.start();
while (Math.abs(missed.snapshot().mover.x) < 3.35) missed.advance(1 / 60);
const endEvents = missed.place();
assert.equal(missed.reason, 'miss');
assert.ok(endEvents.some(event => event.type === 'end'));

console.log('mallow-tower engine tests passed', guided.snapshot().score);
