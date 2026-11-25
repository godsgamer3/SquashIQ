const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CHARACTERS } = require('../practice-physics.js');
const { T, start, update, playerCanHit, playerReturn } = require('../practice-rally.js');

const STEP = 1 / 240;
const character = CHARACTERS[0];

function runUntil(rally, player, done, target = player) {
  for (let i = 0; i < 8 / STEP; i++) {
    const distance = Math.hypot(target.x - player.x, target.y - player.y);
    const fraction = distance ? Math.min(1, character.speed * STEP / distance) : 0;
    player.x += (target.x - player.x) * fraction;
    player.y += (target.y - player.y) * fraction;
    const frame = update(rally, player, STEP);
    if (done(frame)) return;
    assert.equal(rally.result, null);
  }
  assert.fail('Rally did not reach the expected state');
}

test('opening drive reaches the back left and awards CPU the point if missed', () => {
  const rally = start();
  const player = { ...T };
  assert.equal(playerCanHit(rally), false);
  runUntil(rally, player, frame => frame.events?.includes('floor'));
  assert(rally.ball.x < 1 && rally.ball.y > 8);
  assert(playerCanHit(rally));
  runUntil(rally, player, () => rally.result);
  assert.deepEqual(rally.result, { reason: 'double', winner: 'cpu' });
});

test('player can reach the first drive from the T and CPU moves back to return a deep reply', () => {
  const rally = start();
  const player = { ...T };
  runUntil(rally, player, () => playerCanHit(rally) && rally.ball.y >= 7.6, { x: 1, y: 7.6 });
  assert(playerReturn(rally, player, { x: 0.55, y: 0, z: 1.65 }, 'backhand', 0.9, character));
  assert.equal(playerCanHit(rally), false);
  runUntil(rally, player, frame => frame.stroke, T);
  assert(rally.cpu.y >= T.y + 0.5);
  assert.equal(rally.hitter, 'cpu');
  assert.equal(playerCanHit(rally), false);
  runUntil(rally, player, frame => frame.events?.includes('front'));
  assert(playerCanHit(rally));
});

test('a front-wall shot below the tin gives CPU the point', () => {
  const rally = start();
  const player = { ...T };
  runUntil(rally, player, () => playerCanHit(rally) && rally.ball.y >= 6, { x: 1, y: 6 });
  assert(playerReturn(rally, player, { x: 0.55, y: 0, z: 0.35 }, 'backhand', 0.6, character));
  runUntil(rally, player, () => rally.result);
  assert.deepEqual(rally.result, { reason: 'tin', winner: 'cpu' });
});

test('a reachable short reply draws CPU forward and its lift stays below out height', () => {
  const rally = start();
  const player = { ...T };
  runUntil(rally, player, () => playerCanHit(rally) && rally.ball.y >= 7.6, { x: 1, y: 7.6 });
  assert(playerReturn(rally, player, { x: 5.8, y: 0, z: 0.64 }, 'backhand', 0.1, character));
  runUntil(rally, player, frame => frame.stroke, T);
  assert(rally.cpu.y < 2);
  runUntil(rally, player, () => rally.result);
  assert.deepEqual(rally.result, { reason: 'double', winner: 'cpu' });
});
