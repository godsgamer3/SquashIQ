/* One-point CPU rally using the same ball simulation as solo practice. */
(function (root) {
  'use strict';
  const { COURT, BALL_TIME_SCALE, canHit, strike, stepBall } =
    typeof module !== 'undefined' ? require('./practice-physics.js') : root.SquashPhysics;
  const STEP = 1 / 240;
  const T = { x: 3.2, y: 5.46 };
  const CPU_SPEED = 2.85;
  const REACTION = 0.32;
  const CPU = { power: 1, reach: 0.82 };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function launch(ball, aim, power, character, maxLift = Infinity) {
    const shot = { ...ball };
    if (!strike(shot, aim, power, character)) return false;
    if (aim.z !== undefined) {
      const flight = (ball.y - COURT.radius) / -shot.vy;
      if (Number.isFinite(flight) && flight > 0) {
        // Choose the vertical launch needed to meet the selected front-wall height.
        shot.vz = Math.min(maxLift, (aim.z - ball.z) / flight + 4.905 * (flight + STEP * BALL_TIME_SCALE));
      }
    }
    Object.assign(ball, shot);
    return true;
  }

  function fault(ball, events, front) {
    if (events.includes('out')) return 'out';
    if (events.includes('front') && ball.z <= 0.48) return 'tin';
    if (events.includes('floor') && !front) return 'short';
    if (ball.bounces >= 2 || (ball.bounces && ball.vz === 0 && ball.z === COURT.radius)) return 'double';
    return null;
  }

  function contactSpot(ball) {
    const offset = ball.x < T.x ? 0.48 : -0.48;
    return { x: clamp(ball.x + offset, 0.3, 6.1), y: clamp(ball.y, 0.5, 9.4) };
  }

  function planReturn(ball, cpu) {
    const preview = { ...ball };
    let front = false, fallback = null, reachable = null;
    for (let i = 1; i <= 4 / STEP; i++) {
      const events = stepBall(preview, STEP);
      front ||= events.includes('front');
      if (fault(preview, events, front)) break;
      const time = i * STEP;
      if (!front || preview.y < 0.45 || preview.z > 1.75 || preview.z < 0.12 || time <= REACTION) continue;
      const spot = contactSpot(preview);
      fallback = { spot, time, reachable: false };
      if (time < 0.58 || distance(cpu, spot) > (time - REACTION) * CPU_SPEED) continue;
      reachable ||= { spot, time, reachable: true };
      // Let a deep drive pass the T. For a short ball, take it after the bounce.
      if (preview.y >= T.y + 0.55 || preview.bounces) return { spot, time, reachable: true };
    }
    return reachable ?? fallback;
  }

  function start() {
    const cpu = { x: 1.25, y: 4.25, dx: 0, dy: 0 };
    const ball = { x: 0.75, y: 4.25, z: 0.85, vx: 0, vy: 0, vz: 0, bounces: 0 };
    return { cpu, ball, hitter: null, front: false, time: 0, plan: null, result: null };
  }

  function beginShot(rally, hitter) {
    rally.hitter = hitter;
    rally.front = false;
    rally.time = 0;
    rally.plan = hitter === 'player' ? planReturn(rally.ball, rally.cpu) : null;
  }

  function playerCanHit(rally) {
    return !rally.result && rally.hitter === 'cpu' && rally.front;
  }

  function playerReturn(rally, player, aim, hand, power, character) {
    if (!playerCanHit(rally) || !canHit(player, rally.ball, hand, character.reach)) return false;
    if (!launch(rally.ball, aim, power, character)) return false;
    beginShot(rally, 'player');
    return true;
  }

  function moveCPU(cpu, target, speed, dt) {
    const length = distance(cpu, target);
    const fraction = length ? Math.min(1, speed * dt / length) : 0;
    cpu.dx = (target.x - cpu.x) * fraction;
    cpu.dy = (target.y - cpu.y) * fraction;
    cpu.x += cpu.dx;
    cpu.y += cpu.dy;
  }

  function update(rally, player, dt) {
    const { cpu, ball } = rally;
    rally.time += dt;
    if (!rally.hitter) {
      if (rally.time < 0.65) return {};
      launch(ball, { x: 0.65, y: 0, z: 1.35 }, 0.96, CPU);
      beginShot(rally, 'cpu');
      return { stroke: 'backhand' };
    }

    const events = stepBall(ball, dt);
    rally.front ||= events.includes('front');
    const reason = fault(ball, events, rally.front);
    if (reason) {
      const winner = reason === 'double'
        ? rally.hitter
        : rally.hitter === 'cpu' ? 'player' : 'cpu';
      rally.result = { reason, winner };
      return { events };
    }

    if (rally.hitter === 'cpu') {
      const recovery = { x: ball.x < T.x ? 3.75 : 2.65, y: T.y - 0.65 };
      moveCPU(cpu, recovery, 2.35, dt);
    } else if (rally.plan && rally.time >= REACTION) {
      moveCPU(cpu, rally.plan.spot, CPU_SPEED, dt);
      const hand = ball.x < cpu.x ? 'backhand' : 'forehand';
      if (rally.plan.reachable && rally.time >= rally.plan.time &&
          rally.front && canHit(cpu, ball, hand, CPU.reach)) {
        const opposite = player.x < T.x ? 5.8 : 0.6;
        const lateral = ball.y * 1.15;
        const x = clamp(opposite, ball.x - lateral, ball.x + lateral);
        const nearT = distance(player, T) < 1.25;
        const short = ball.y < 2 || (cpu.y < 4.6 && player.y > 6.4);
        launch(ball, { x, y: 0, z: short ? 0.76 : 1.42 }, short ? 0.16 : nearT ? 0.65 : 0.86, CPU, 7);
        beginShot(rally, 'cpu');
        return { events, stroke: hand };
      }
    } else {
      cpu.dx = cpu.dy = 0;
    }
    return { events };
  }

  const api = { T, start, update, playerCanHit, playerReturn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SquashRally = api;
})(globalThis);
