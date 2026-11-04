const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COURT, BALL_TIME_SCALE, CHARACTERS, canHit, strike, stepBall, nextBounce } = require('../practice-physics.js');
const ball = changes => ({ x: 3.2, y: 5, z: 1, vx: 0, vy: 0, vz: 0, bounces: 0, ...changes });
test('front wall reverses depth velocity while preserving lateral direction', () => {
  const b = ball({ y: .045, vx: 3, vy: -10 });
  assert(stepBall(b, 1 / 240).includes('front'));
  assert.equal(b.vx, 3); assert(Math.abs(b.vy - 9.4) < 1e-10); assert(b.y >= COURT.radius);
});
test('both side walls and back wall reflect inward', () => {
  for (const [setup, event, axis, sign] of [
    [{ x: .045, vx: -10 }, 'left', 'vx', 1],
    [{ x: 6.355, vx: 10 }, 'right', 'vx', -1],
    [{ y: 9.705, vy: 10 }, 'back', 'vy', -1]
  ]) { const b = ball(setup); assert(stepBall(b, 1 / 240).includes(event)); assert(b[axis] * sign > 0); }
});
test('floor bounce loses energy, increments bounce count and retains horizontal direction', () => {
  const b = ball({ z: .045, vz: -5, vx: 4 });
  assert(stepBall(b, 1 / 240).includes('floor')); assert.equal(b.bounces, 1);
  assert(b.vz > 0 && b.vz < 5); assert(b.vx > 0 && b.vx < 4);
});
test('hand, distance and height constrain contact', () => {
  const p = { x: 3.2, y: 5 }, b = ball({ x: 2.5 });
  assert(canHit(p, b, 'backhand', 1)); assert(!canHit(p, b, 'forehand', 1));
  assert(!canHit(p, { ...b, z: 2 }, 'backhand', 1));
  assert(!canHit(p, { ...b, x: 1 }, 'backhand', 1));
  assert(canHit(p, ball(), 'forehand', 1)); assert(canHit(p, ball(), 'backhand', 1));
});
test('identical shots have identical trajectories and greater charge increases speed', () => {
  const a = ball(), b = ball(), weak = ball();
  strike(a, { x: 0, y: 0 }, .7, CHARACTERS[0]);
  strike(b, { x: 0, y: 0 }, .7, CHARACTERS[0]);
  strike(weak, { x: 0, y: 0 }, .1, CHARACTERS[0]);
  assert(Math.hypot(a.vx, a.vy) > Math.hypot(weak.vx, weak.vy));
  for (let i = 0; i < 720; i++) { stepBall(a, 1 / 240); stepBall(b, 1 / 240); assert.deepEqual(a, b); }
});
test('side-first shot can continue to front wall without a preset path', () => {
  const b = ball({ x: 1, y: 6, z: 1.2 }); const events = [];
  strike(b, { x: 0, y: 3 }, .8, CHARACTERS[0]);
  for (let i = 0; i < 240; i++) events.push(...stepBall(b, 1 / 240));
  assert(events.indexOf('left') >= 0); assert(events.indexOf('front') > events.indexOf('left'));
});
test('character power changes launch speed, never wall restitution', () => {
  const a = ball(), e = ball();
  strike(a, { x: 3.2, y: 0 }, .5, CHARACTERS[0]);
  strike(e, { x: 3.2, y: 0 }, .5, CHARACTERS[4]);
  assert(Math.abs(e.vy) > Math.abs(a.vy));
});
test('bounce preview matches simulation without mutating the live ball', () => {
  const b = ball({ x: 3.85, y: 6.4, z: .8 });
  strike(b, { x: 3.85, y: 0 }, .6, CHARACTERS[0]);
  const original = { ...b }, prediction = nextBounce(b);
  assert.deepEqual(b, original);
  let elapsed = 0;
  while (b.bounces === 0 && elapsed < 10) { stepBall(b, 1 / 240); elapsed += 1 / 240; }
  assert(Math.abs(prediction.x - b.x) < 1e-9);
  assert(Math.abs(prediction.y - b.y) < 1e-9);
  assert(Math.abs(prediction.time - elapsed) < 1e-9);
});
test('solo tempo extends preparation time and a representative drive is reachable', () => {
  assert.equal(BALL_TIME_SCALE, .6);
  for (const power of [.2, .6, 1]) {
    const b = ball({ x: 3.85, y: 6.4, z: .8 });
    strike(b, { x: 3.85, y: 0 }, power, CHARACTERS[0]);
    const landing = nextBounce(b);
    const travel = Math.hypot(landing.x - 3.2, landing.y - 6.4);
    assert(landing.time > 1.4);
    assert(travel / CHARACTERS[0].speed < landing.time);
    // Normal tempo follows the same path in 60% of the real time.
    const normal = { ...b };
    for (let i = 0; i < 120; i++) stepBall(normal, 1 / 240 / BALL_TIME_SCALE);
    for (let i = 0; i < 200; i++) stepBall(b, 1 / 240);
    assert(Math.abs(normal.y - b.y) < .03);
  }
});
test('preview suppresses an invalid low front wall shot', () => {
  assert.equal(nextBounce(ball({ y: .1, z: .2, vy: -8 })), null);
});
test('a normal drive stays below 35cm after its first floor bounce', () => {
  const b = ball({ x: 3.85, y: 6.4, z: .8 });
  strike(b, { x: 3.85, y: 0 }, .6, CHARACTERS[0]);
  let peak = 0, first = false;
  for (let i = 0; i < 2400 && b.bounces < 2; i++) {
    stepBall(b, 1 / 240);
    if (b.bounces === 1) { first = true; peak = Math.max(peak, b.z); }
  }
  assert(first); assert(peak > .2 && peak < .35, `rebound apex ${peak}m`);
});
test('a resting ball does not produce phantom floor bounces', () => {
  const b = ball({ z: COURT.radius, vz: 0 });
  for (let i = 0; i < 240; i++) assert(!stepBall(b, 1 / 240).includes('floor'));
  assert.equal(b.bounces, 0); assert.equal(b.z, COURT.radius);
});
