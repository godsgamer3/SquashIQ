/* Deterministic court simulation. Coordinates are metres; y=0 is the front wall. */
(function (root) {
  'use strict';
  const COURT = Object.freeze({ width: 6.4, length: 9.75, height: 4.6, radius: 0.04 });
  // Slow only the ball's clock, preserving trajectories and reflection angles.
  // Movement and mouse charging continue at normal speed.
  const BALL_TIME_SCALE = 0.6;
  // Tuned low-bounce prototype, not a calibrated competition-ball model.
  const FLOOR_RESTITUTION = 0.45;
  const CHARACTERS = Object.freeze([
    { id: 'A', name: '정석형', theme: '스트레이트', color: '#d9ff43', speed: 4.6, charge: 0.85, reach: 1.05, power: 1, note: '천천히 충전되어 파워를 맞추기 편합니다.' },
    { id: 'B', name: '섬세형', theme: '드롭', color: '#7ee5d2', speed: 4.5, charge: 0.72, reach: 1.1, power: 0.94, note: '충전이 가장 느립니다. 드롭 전용 조작은 추후 추가합니다.' },
    { id: 'C', name: '각도형', theme: '보스트', color: '#ffa879', speed: 4.6, charge: 1, reach: 1.22, power: 0.98, note: '타격 범위가 넓습니다. 옆벽을 조준해 보스트를 연습하세요.' },
    { id: 'D', name: '기동형', theme: '스피드', color: '#b5a1ff', speed: 5.4, charge: 1, reach: 1.0, power: 0.96, note: '이동 속도가 빠릅니다. 체력 시스템은 아직 없습니다.' },
    { id: 'E', name: '장타형', theme: '로브', color: '#89c8ff', speed: 4.4, charge: 0.95, reach: 1.08, power: 1.12, note: '같은 충전량에서 공이 더 빠릅니다. 로브 조작은 추후 추가합니다.' }
  ]);
  function canHit(player, ball, hand, reach) {
    const dx = ball.x - player.x;
    return Math.hypot(dx, ball.y - player.y) <= reach && ball.z <= 1.75 &&
      (hand === 'backhand' ? dx <= 0.22 : dx >= -0.22);
  }
  function strike(ball, aim, power, character) {
    const dx = aim.x - ball.x, dy = aim.y - ball.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.05) return false;
    const speed = (7 + Math.max(0, Math.min(1, power)) * 9) * character.power;
    ball.vx = dx / length * speed;
    ball.vy = dy / length * speed;
    // Beginner drive: an assisted launch height; power does not select a drop/lob.
    ball.vz = 3.5;
    ball.bounces = 0;
    return true;
  }
  function stepBall(ball, dt) {
    dt *= BALL_TIME_SCALE;
    const events = [];
    const r = COURT.radius;
    const resting = ball.z <= r + 0.00001 && Math.abs(ball.vz) < 0.45;
    if (resting) { ball.z = r; ball.vz = 0; }
    else ball.vz -= 9.81 * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
    const reflect = (axis, velocity, low, high, loss, labels) => {
      if (ball[axis] < low) {
        ball[axis] = low + (low - ball[axis]); ball[velocity] = Math.abs(ball[velocity]) * loss;
        events.push(labels[0]);
      } else if (ball[axis] > high) {
        ball[axis] = high - (ball[axis] - high); ball[velocity] = -Math.abs(ball[velocity]) * loss;
        events.push(labels[1]);
      }
    };
    reflect('x', 'vx', r, COURT.width - r, 0.94, ['left', 'right']);
    reflect('y', 'vy', r, COURT.length - r, 0.94, ['front', 'back']);
    if (!resting && ball.z < r) {
      // Resolve at the floor rather than mirroring penetration upwards, which
      // adds visible height to shallow bounces.
      ball.z = r;
      ball.vz = Math.abs(ball.vz) * FLOOR_RESTITUTION;
      ball.vx *= 0.90; ball.vy *= 0.90;
      ball.bounces++;
      events.push('floor');
      if (ball.vz < 0.45) { ball.z = r; ball.vz = 0; }
    }
    if (ball.z > COURT.height) events.push('out');
    return events;
  }
  function nextBounce(ball) {
    const preview = { ...ball };
    const dt = 1 / 240;
    for (let i = 1; i <= 2400; i++) {
      const events = stepBall(preview, dt);
      if (events.includes('out') || (events.includes('front') && preview.z < 0.48)) return null;
      if (events.includes('floor')) return { x: preview.x, y: preview.y, time: i * dt };
    }
    return null;
  }
  const api = { COURT, BALL_TIME_SCALE, FLOOR_RESTITUTION, CHARACTERS, canHit, strike, stepBall, nextBounce };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SquashPhysics = api;
})(globalThis);
