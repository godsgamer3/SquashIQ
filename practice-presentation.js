/* Canvas athletes and impact sounds for the live rally. */
(() => {
  'use strict';
  function athlete(ctx, foot, scale, kit, pose) {
    const { dx, dy, stride, charge, swing } = pose;
    const moving = dx !== 0 || dy !== 0;
    const step = moving ? Math.sin(stride) : 0;
    const side = (swing?.hand ?? charge?.hand) === 'backhand' ? -1 : 1;
    const progress = swing ? Math.min(1, swing.time / 0.24) : 0;
    const angle = swing ? -0.9 + progress * 2.6 : charge ? -1.12 : 0.25;
    const lean = moving ? dx * 5 : swing ? side * 5 * Math.sin(progress * Math.PI) : 0;
    const shoulder = { x: lean + side * 8, y: -33 + Math.abs(step) * 2 };
    const grip = { x: shoulder.x + side * (14 + Math.cos(angle) * 7), y: shoulder.y + Math.sin(angle) * 15 };
    const racket = { x: grip.x + side * 17 * Math.cos(angle), y: grip.y + 17 * Math.sin(angle) };
    ctx.save();
    ctx.translate(foot.x, foot.y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = (points, color, width) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    ctx.fillStyle = '#202a2b45';
    ctx.beginPath();
    ctx.ellipse(3, 2, 21, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const leg of [-1, 1]) {
      const x = leg * (8 + step * dx * leg * 5);
      const y = leg * step * (5 + Math.abs(dy) * 3);
      path([[leg * 5, -20], [x + leg * 2, -8 + y], [x, y]], '#263640', 7);
      path([[x, y], [x + leg * 5, y + 1]], '#fff7e9', 4);
    }
    path([[lean - side * 8, -33], [lean - side * 14, -23 - step * 4]], '#b97751', 6);
    path([[0, -20], [lean, shoulder.y]], '#263640', 20);
    path([[0, -22], [lean, shoulder.y]], kit, 16);
    path([[shoulder.x, shoulder.y], [shoulder.x + side * 5, shoulder.y + 7], [grip.x, grip.y]], '#c98a61', 6);
    ctx.fillStyle = '#583b31';
    ctx.beginPath();
    ctx.arc(lean, shoulder.y - 12, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = kit;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(lean, shoulder.y - 12, 7, 0.15, Math.PI - 0.15);
    ctx.stroke();
    path([[grip.x, grip.y], [racket.x, racket.y]], '#263640', 3);
    ctx.beginPath();
    ctx.ellipse(racket.x, racket.y, 10, 6, side * angle, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f4e88a';
    ctx.fill();
    ctx.strokeStyle = '#263640';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  let audio;
  function enableSound() {
    if (!window.AudioContext) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch {
      // The rally remains playable when audio is unavailable.
    }
  }

  const sounds = {
    racket: [580, 210, 0.065, 0.11, 'triangle'],
    wall: [220, 89, 0.1, 0.12, 'triangle'],
    floor: [125, 52, 0.07, 0.11, 'sine'],
    tin: [825, 370, 0.14, 0.085, 'square']
  };
  function impact(kind) {
    if (audio?.state !== 'running') return;
    const [high, low, duration, volume, wave] = sounds[kind];
    const now = audio.currentTime;
    const source = audio.createOscillator();
    const gain = audio.createGain();
    source.type = wave;
    source.frequency.setValueAtTime(high, now);
    source.frequency.exponentialRampToValueAtTime(low, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(gain);
    gain.connect(audio.destination);
    source.start(now);
    source.stop(now + duration);
  }

  window.SquashPresentation = { athlete, enableSound, impact };
})();
