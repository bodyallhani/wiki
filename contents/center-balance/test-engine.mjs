import assert from 'node:assert/strict';
import { TowerGame, validSeed } from './engine.mjs';

assert.equal(validSeed('mallow-20260924'), true);
assert.equal(validSeed('../bad'), false);

function settle(game, seconds = .72, events = []) {
  for (let i = 0; i < seconds * 60 && game.state === 'playing'; i++) events.push(...game.advance(1 / 60));
  return events;
}
function placeAt(game, x, events = []) {
  game.mover.x = x;
  events.push(...game.place());
  settle(game, .72, events);
  return events;
}

const a = new TowerGame('mallow-deterministic-v4');
const b = new TowerGame('mallow-deterministic-v4');
a.start(); b.start();
for (let level = 0; level < 12; level++) {
  const offset = level < 4 ? .27 : 0;
  const ax = a.snapshot().idealX + offset;
  const bx = b.snapshot().idealX + offset;
  placeAt(a, ax); placeAt(b, bx);
}
assert.deepEqual(a.snapshot(), b.snapshot(), 'same seed and placements must produce the same physical tower');

const guided = new TowerGame('mallow-guided-v4');
guided.start();
for (let level = 0; level < 30 && guided.state === 'playing'; level++) {
  placeAt(guided, guided.snapshot().idealX);
}
assert.equal(guided.level, 30, 'a precise player must be able to build a long tower');
assert.equal(guided.state, 'playing');
assert.ok(guided.snapshot().mover.speed >= 4.7, 'high floors must reach the intended speed tier');
assert.ok(guided.snapshot().mover.width <= 1.3, 'high floors must use the narrow tier');

const physical = new TowerGame('mallow-contact-physics');
physical.start();
const physicalEvents = [];
for (let i = 0; i < 4; i++) {
  const support = physical.snapshot().blocks.at(-1);
  placeAt(physical, support.x + .34, physicalEvents);
}
const crooked = physical.snapshot();
assert.ok(Math.abs(crooked.surfaceAngle) > .035, 'off-center mass must visibly tilt the top surface');
assert.ok(crooked.load > .25, 'the character load must be derived from the visible tilt');
assert.ok(crooked.blocks.some(block => Math.abs(block.compressionLeft - block.compressionRight) > .025), 'off-center mass must visibly compress one side of a mallow');
assert.ok(crooked.leftLoad !== crooked.rightLoad, 'left and right spinal muscle load must differ');

for (let i = 0; i < 7 && physical.state === 'playing'; i++) {
  placeAt(physical, physical.snapshot().idealX, physicalEvents);
}
assert.ok(Math.abs(physical.snapshot().surfaceAngle) < Math.abs(crooked.surfaceAngle), 'counter-stacking must mechanically level the support');
assert.ok(physicalEvents.some(event => event.type === 'recovery'), 'mechanical leveling must trigger a recovery event');
assert.ok(!physicalEvents.some(event => event.type.startsWith('hazard')), 'V4 must not create unexplained hazards');

const missed = new TowerGame('mallow-miss-v4');
missed.start();
missed.mover.x = 3.46;
const endEvents = missed.place();
assert.equal(missed.reason, 'miss');
assert.ok(endEvents.some(event => event.type === 'end'));

console.log('mallow-tower V4 contact physics tests passed', guided.snapshot().score);

