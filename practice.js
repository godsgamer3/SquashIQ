/* Shared court controls for solo practice and the live CPU rally. */
(() => {
  'use strict';
  const { COURT, BALL_TIME_SCALE, CHARACTERS, canHit, strike, stepBall, nextBounce } = SquashPhysics;
  const { athlete, enableSound, impact } = SquashPresentation;
  const page = document.querySelector('#page-practice');
  const legacy = document.querySelector('#cpuPractice');
  const hub = document.createElement('div');
  hub.className = 'shell game-shell';
  hub.innerHTML = `
    <div id="practiceMenu">
      <div class="practice-heading"><div><span class="eyebrow">PLAY SQUASH</span><h1>스쿼시 체험하기</h1><p>내 플레이 스타일을 고르고, 코트에서 직접 경험하세요.</p></div></div>
      <div class="mode-grid">
        <button class="mode-card rally-card" data-mode="rally"><span class="eyebrow">CPU · 한 점 승부</span><h2>CPU와 랠리</h2><p>깊은 첫 공을 받아치고 T로 돌아오세요.<br>상대를 움직여 빈 공간을 만드세요.</p><b>캐릭터 선택 →</b></button>
        <button class="mode-card" data-mode="solo"><span class="eyebrow">SOLO</span><h2>혼자 연습</h2><p>마우스로 조준하고 직접 스윙하세요.<br>공의 속도와 벽 반사를 자유롭게 익힙니다.</p><b>캐릭터 선택 →</b></button>
      </div>
      <button class="secondary" data-mode="cpu">기존 키보드 샷 연습</button>
      <p class="solo-help">키보드와 마우스로 플레이할 수 있습니다.</p>
    </div>
    <div id="characterPicker" hidden>
      <div class="practice-heading"><div><span class="eyebrow" id="selectedMode"></span><h1>누구의 스타일로 칠까요?</h1><p>A~E는 임시 캐릭터입니다. 수치는 체험용이며 추후 조정됩니다.</p></div><button class="secondary" id="pickerBack">모드 선택</button></div>
      <div class="character-grid">${CHARACTERS.map(c => `<button class="character-card" data-character="${c.id}" aria-pressed="false" style="--character:${c.color}"><span class="character-avatar">${c.id}</span><strong>${c.name} · ${c.theme}</strong><p>${c.note}</p><small>이동 ${c.speed.toFixed(1)} m/s<br>타격 범위 ${c.reach.toFixed(2)} m<br>충전 속도 ×${c.charge}<br>타구 속도 ×${c.power}</small></button>`).join('')}</div>
      <p id="characterSummary" class="solo-help"></p><button class="primary" id="enterCourt">선택한 캐릭터로 입장</button>
    </div>
    <div id="soloPractice" hidden>
      <div class="practice-heading"><div><span class="eyebrow" id="courtLabel"></span><h1 id="courtTitle"></h1><p id="soloCharacter"></p></div><button class="secondary" id="soloBack">캐릭터 변경 / 나가기</button></div>
      <div class="solo-layout">
        <canvas class="solo-canvas" id="soloCanvas" width="760" height="900" tabindex="0" aria-label="혼자 연습 코트. WASD 이동, 왼쪽 마우스 백핸드, 오른쪽 마우스 포핸드"></canvas>
        <aside class="solo-panel">
          <article><h3 id="soloHand">타격을 준비하세요</h3><p id="soloStatus" class="solo-status" role="status"></p></article>
          <article><h3>오른손잡이 조작</h3><p>WASD · 이동<br>마우스 · 조준<br>왼쪽 버튼 · 백핸드 (몸 왼쪽)<br>오른쪽 버튼 · 포핸드 (몸 오른쪽)</p><p>버튼을 누르고 있다가 공이 몸 옆 타격 범위에 들어오면 떼세요.</p><div class="practice-actions"><button class="secondary" id="feedBall">새 공</button><button class="secondary" id="pauseSolo">일시정지</button></div></article>
          <article id="rallyGuide" hidden><h3>코트에서 해보기</h3><p>같은 쪽 옆벽에 가까운 앞벽을 조준해 강하게 쳐보세요. 앞쪽에서 약하게 칠 때는 틴 바로 위를 노려 짧게 떨어뜨릴 수 있습니다. 친 다음엔 T 근처로 돌아오세요.</p><p>R · 같은 첫 공부터 다시</p></article>
          <article id="soloGuide"><h3>공의 움직임 읽기</h3><p>높이 눈금과 ↑↓는 공의 높이와 상승·하강을 나타냅니다. 초록 → 주황 잔상은 느린 공 → 빠른 공입니다. 바닥의 원은 다음 바운드 위치입니다.</p><p>입문용 공 속도 60% · 선수 이동은 그대로입니다. 두 번째 바닥 바운드·틴·아웃 이후 R로 새 공을 준비하세요.</p><p id="soloStats">타격 0 · 바닥 바운드 0</p></article>
        </aside>
      </div>
    </div>`;
  page.prepend(hub);
  const $ = id => document.getElementById(id);
  const canvas = $('soloCanvas'), ctx = canvas.getContext('2d');
  const menu = $('practiceMenu'), picker = $('characterPicker'), solo = $('soloPractice');
  let mode = 'solo', character = CHARACTERS[0], active = false, paused = false;
  let player, ball, aim = { x: 3.2, y: 0 }, ready = true, ended = false, hits = 0;
  let charge = null, power = 0, trail = [], accumulator = 0, last = 0, trailClock = 0;
  let bouncePreview = null, previewClock = 0;
  let lastStroke = null;
  let rally, rallyStatus, playerSwing, cpuSwing, flash;
  let cpuStride = 0;
  let activeHand = 'forehand';
  const keys = new Set(), STEP = 1 / 240;
  const status = text => { $('soloStatus').textContent = text; };
  function cancelInput() { keys.clear(); charge = null; power = 0; }
  function setPaused(value) {
    paused = value; cancelInput(); accumulator = 0;
    $('pauseSolo').textContent = paused ? '계속하기' : '일시정지';
    if (paused) status('일시정지 중입니다. 계속하기를 누르면 이어집니다.');
    else if (rally) status(rallyStatus);
    else status(ready ? '마우스로 앞벽을 조준하고, 버튼을 눌렀다 떼어 첫 공을 치세요.' : '공의 그림자를 읽고 타격 위치로 이동하세요.');
  }
  function showPicker() {
    active = false; cancelInput(); legacy.hidden = true; solo.hidden = true; menu.hidden = true; picker.hidden = false;
    window.dispatchEvent(new Event('practice-stop-cpu'));
    $('selectedMode').textContent = { solo: '혼자 연습', rally: 'CPU와 랠리', cpu: '기존 키보드 샷 연습' }[mode];
    selectCharacter(character.id);
  }
  function selectCharacter(id) {
    character = CHARACTERS.find(c => c.id === id);
    hub.querySelectorAll('[data-character]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.character === id)));
    $('characterSummary').textContent = `${character.id} · ${character.name} 선택됨. ${mode === 'cpu' ? 'CPU 버전에서는 이동 속도 차이만 반영됩니다. 조작: WASD, 7/8/9/0, Q/E, SPACE.' : character.note}`;
  }
  hub.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => { mode = el.dataset.mode; showPicker(); }));
  hub.querySelectorAll('[data-character]').forEach(el => el.addEventListener('click', () => selectCharacter(el.dataset.character)));
  $('pickerBack').onclick = () => { picker.hidden = true; menu.hidden = false; };
  $('soloBack').onclick = showPicker;
  $('enterCourt').onclick = () => {
    picker.hidden = true;
    if (mode === 'cpu') {
      hub.hidden = true; legacy.hidden = false;
      $('cpuCharacter').textContent = `${character.id} · ${character.name} 선택됨 — 기존 CPU 버전에서는 이동 속도만 반영됩니다.`;
      window.dispatchEvent(new CustomEvent('practice-start-cpu', { detail: character }));
      return;
    }
    solo.hidden = false; active = true; hits = 0;
    player = { x: 3.2, y: 6.4 };
    rally = null;
    aim = { x: 3.2, y: 0 };
    solo.classList.toggle('rally-view', mode === 'rally');
    $('courtTitle').textContent = mode === 'rally' ? 'CPU와 랠리' : '혼자 연습';
    $('courtLabel').textContent = mode === 'rally' ? '한 점 승부' : 'SOLO COURT';
    $('feedBall').textContent = mode === 'rally' ? '다시 랠리' : '새 공';
    $('soloGuide').hidden = mode === 'rally';
    $('rallyGuide').hidden = mode !== 'rally';
    canvas.setAttribute('aria-label', `${$('courtTitle').textContent} 코트. WASD 이동, 왼쪽 마우스 백핸드, 오른쪽 마우스 포핸드`);
    if (mode === 'rally') enableSound();
    $('soloCharacter').textContent = `${character.id} · ${character.name} — ${character.note}`;
    feed(); setPaused(false); canvas.focus(); draw();
  };
  $('cpuBack').onclick = () => { hub.hidden = false; mode = 'cpu'; showPicker(); };
  $('pauseSolo').onclick = () => {
    if (rally) enableSound();
    setPaused(!paused);
    if (!paused) canvas.focus();
  };
  function coach(message) {
    rallyStatus = message;
    if (!paused) status(message);
  }
  function feed() {
    cancelInput(); ready = true; ended = false; trail = []; accumulator = 0; bouncePreview = null; lastStroke = null;
    if (mode === 'rally') {
      rally = SquashRally.start();
      ball = rally.ball;
      player = { ...SquashRally.T, dx: 0, dy: 0, stride: 0 };
      cpuStride = 0;
      playerSwing = cpuSwing = flash = null;
      ready = false; hits = 0;
      aim = { x: 0.65, y: 0, z: 1.35 };
      coach('CPU의 첫 공은 왼쪽으로 깊게 옵니다. 공을 따라 이동하세요.');
      return;
    }
    ball = { x: player.x + 0.65, y: player.y, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0 };
    status('새 공 준비. 누르는 버튼에 맞춰 몸 왼쪽 또는 오른쪽에서 첫 공을 칩니다.');
  }
  function restart() {
    feed();
    if (rally && paused) setPaused(false);
    canvas.focus();
  }
  $('feedBall').onclick = restart;
  function isVisible() { return active && page.classList.contains('active') && !document.hidden; }
  window.addEventListener('practice-page-change', () => { if (active) setPaused(true); cancelInput(); });
  window.addEventListener('blur', () => { if (active) setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) setPaused(true); });
  window.addEventListener('keydown', e => {
    if (!isVisible() || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if ('wasd'.includes(key) && key.length === 1) { e.preventDefault(); if (!paused) keys.add(key); }
    if (key === 'r' && !e.repeat) restart();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  // Inverse of the floor projection keeps aim consistent under CSS scaling.
  function pointerAim(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * canvas.width / rect.width;
    const sy = (e.clientY - rect.top) * canvas.height / rect.height;
    const y = Math.max(0, Math.min(COURT.length, (sy - 330) / 520 * COURT.length));
    const depth = y / COURT.length, left = 115 - 70 * depth, width = 530 + 140 * depth;
    aim = { x: Math.max(0, Math.min(COURT.width, (sx - left) / width * COURT.width)), y };
    if (rally && sy <= 330) aim.z = Math.min(COURT.height, (330 - sy) / 60);
  }
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointermove', pointerAim);
  canvas.addEventListener('pointerdown', e => {
    if (!isVisible() || paused || ended || charge || ![0, 2].includes(e.button)) return;
    if (rally) enableSound();
    e.preventDefault(); canvas.focus(); pointerAim(e);
    charge = { hand: e.button === 0 ? 'backhand' : 'forehand', button: e.button, pointer: e.pointerId };
    activeHand = charge.hand;
    power = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', e => {
    if (!charge || charge.pointer !== e.pointerId || charge.button !== e.button) return;
    pointerAim(e);
    const hand = charge.hand; charge = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!isVisible() || paused) return;
    if (rally) {
      playerSwing = { hand, time: 0 };
      if (SquashRally.playerReturn(rally, player, aim, hand, power, character)) {
        hits++;
        flash = { ...project(ball.x, ball.y, ball.z), time: 0 };
        impact('racket');
        trail = [];
        coach('받아쳤습니다. CPU가 공을 쫓는 동안 T 쪽으로 돌아오세요.');
      } else if (SquashRally.playerCanHit(rally)) {
        coach('헛스윙. 공이 몸 옆에 들어온 순간에 버튼을 떼세요.');
      }
      power = 0;
      return;
    }
    if (ready) { ball.x = Math.max(0.04, Math.min(6.36, player.x + (hand === 'backhand' ? -0.65 : 0.65))); ball.y = player.y; }
    if (!canHit(player, ball, hand, character.reach)) status('헛스윙! 공의 높이와 몸 좌우 위치를 확인하세요.');
    else if (strike(ball, aim, power, character)) {
      ready = false; hits++; trail = [];
      lastStroke = { hand, power, remaining: 0.8 };
      previewClock = 0; bouncePreview = nextBounce(ball);
      status(`${hand === 'backhand' ? '백핸드' : '포핸드'} 타격 · 파워 ${Math.round(power * 100)}%. 벽 반사를 읽고 다음 타구를 준비하세요.`);
    } else status('선수에서 떨어진 위치를 조준하세요.');
    power = 0;
  });
  canvas.addEventListener('pointercancel', cancelInput);
  canvas.addEventListener('lostpointercapture', cancelInput);
  function finish(text) { ended = true; bouncePreview = null; cancelInput(); status(`${text} R 또는 새 공 버튼으로 다시 연습하세요.`); }
  const rallyResultText = {
    out: '공이 아웃 높이를 넘었습니다.',
    tin: '공이 앞벽의 틴에 맞았습니다.',
    short: '공이 앞벽에 닿기 전에 바닥에 떨어졌습니다.',
    double: '리턴 전에 공이 두 번 바운드했습니다.'
  };
  function updateRally(dt) {
    if (playerSwing) { playerSwing.time += dt; if (playerSwing.time > 0.27) playerSwing = null; }
    if (cpuSwing) { cpuSwing.time += dt; if (cpuSwing.time > 0.27) cpuSwing = null; }
    if (flash) { flash.time += dt; if (flash.time > 0.24) flash = null; }
    if (ended) return;
    const { events = [], stroke } = SquashRally.update(rally, player, dt);
    cpuStride += Math.hypot(rally.cpu.dx, rally.cpu.dy) * 14;
    for (const event of events) {
      if (event === 'out') continue;
      impact(event === 'floor' ? 'floor' : event === 'front' && rally.result?.reason === 'tin' ? 'tin' : 'wall');
      flash = { ...project(ball.x, ball.y, ball.z), time: 0 };
    }
    if (stroke) {
      cpuSwing = { hand: stroke, time: 0 };
      flash = { ...project(ball.x, ball.y, ball.z), time: 0 };
      trail = [];
      impact('racket');
      if (hits) coach('CPU가 받아쳤습니다. 반사된 공을 읽고 타점을 잡으세요.');
    }
    if (rally.result) {
      ended = true;
      player.dx = player.dy = rally.cpu.dx = rally.cpu.dy = 0;
      cancelInput();
      const point = rally.result.winner === 'player' ? '내 득점.' : 'CPU 득점.';
      coach(`${point} ${rallyResultText[rally.result.reason]} R로 다시 시작하세요.`);
    }
    trailClock += dt;
    if (rally.hitter && !ended && trailClock >= 1 / 50) {
      trailClock = 0;
      trail.push({ ...ball });
      if (trail.length > 7) trail.shift();
    }
  }
  function update(dt) {
    if (lastStroke) lastStroke.remaining -= dt;
    if (rally && ended) { updateRally(dt); return; }
    const dx = Number(keys.has('d')) - Number(keys.has('a'));
    const dy = Number(keys.has('s')) - Number(keys.has('w'));
    const len = Math.hypot(dx, dy) || 1;
    player.x = Math.max(0.3, Math.min(6.1, player.x + dx / len * character.speed * dt));
    player.y = Math.max(0.5, Math.min(9.4, player.y + dy / len * character.speed * dt));
    if (charge) power = Math.min(1, power + dt * character.charge);
    if (rally) {
      player.dx = dx;
      player.dy = dy;
      if (dx || dy) player.stride += dt * character.speed * 4;
      updateRally(dt);
      return;
    }
    if (ready) {
      const side = charge?.hand === 'backhand' ? -1 : 1;
      ball.x = Math.max(0.04, Math.min(6.36, player.x + side * 0.65)); ball.y = player.y;
    } else if (!ended) {
      const events = stepBall(ball, dt);
      if (events.includes('out')) finish('공이 아웃 높이를 넘었습니다.');
      else if (events.includes('front') && ball.z < 0.48) finish('틴! 앞벽의 너무 낮은 곳에 맞았습니다.');
      else if (ball.bounces >= 2) finish('두 번째 바닥 바운드입니다.');
      previewClock += dt;
      if (!ended && (previewClock >= 0.1 || events.includes('floor'))) {
        previewClock = 0; bouncePreview = nextBounce(ball);
      }
      trailClock += dt;
      if (trailClock >= 1 / 30) { trailClock = 0; trail.push({ x: ball.x, y: ball.y, z: ball.z }); if (trail.length > 45) trail.shift(); }
    }
  }
  function project(x, y, z = 0) {
    const depth = y / COURT.length;
    return { x: 115 - 70 * depth + x / COURT.width * (530 + 140 * depth), y: 330 + depth * 520 - z * (60 + depth * 10) };
  }
  function line(points, color, width = 2) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function polygon(points, color) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  function dot(p, r, color) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  function drawChargeGauge(p) {
    const stroke = charge ? { hand: charge.hand, power } : lastStroke?.remaining > 0 ? lastStroke : { hand: activeHand, power: 0 };
    const side = stroke.hand === 'backhand' ? -1 : 1;
    const x = p.x + (side < 0 ? -43 : 33), y = p.y - 42, h = 56, w = 10;
    ctx.fillStyle = '#11251eee'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#405149'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = stroke.power > 0.8 ? '#ffb15f' : '#d9ff43';
    ctx.fillRect(x, y + h * (1 - stroke.power), w, h * stroke.power);
    for (let i = 1; i < 4; i++) line([{ x, y: y + h * i / 4 }, { x: x + w, y: y + h * i / 4 }], '#11251e88', 1);
    ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#142d20';
    ctx.fillText(`${Math.round(stroke.power * 100)}%`, x + w / 2, y - 9);
  }
  function drawRally() {
    const { cpu, result } = rally;
    const target = project(aim.x, aim.y, aim.z);
    const t = project(SquashRally.T.x, SquashRally.T.y);
    const nearT = Math.hypot(player.x - SquashRally.T.x, player.y - SquashRally.T.y) < 1.25;
    ctx.strokeStyle = nearT ? '#335f4e' : '#a67b54';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, 36, 21, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (!result) {
      ctx.strokeStyle = '#255e51';
      ctx.beginPath();
      ctx.arc(target.x, target.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      line([{ x: target.x - 14, y: target.y }, { x: target.x - 6, y: target.y }], '#255e51');
      line([{ x: target.x + 6, y: target.y }, { x: target.x + 14, y: target.y }], '#255e51');
    }

    const playerFoot = project(player.x, player.y);
    if (SquashRally.playerCanHit(rally)) {
      for (const hand of ['backhand', 'forehand']) {
        if (!canHit(player, ball, hand, character.reach)) continue;
        const side = hand === 'backhand' ? -1 : 1;
        ctx.fillStyle = '#3a794154';
        ctx.beginPath();
        ctx.ellipse(playerFoot.x + side * 30, playerFoot.y, 25, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const shadow = project(ball.x, ball.y);
    ctx.fillStyle = '#2c231967';
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    trail.forEach((point, i) => {
      ctx.globalAlpha = (i + 1) / trail.length * 0.3;
      dot(project(point.x, point.y, point.z), 2 + i * 0.4, '#355a50');
    });
    ctx.globalAlpha = 1;

    const bodies = [
      { depth: player.y, draw: () => athlete(ctx, playerFoot, 0.85 + player.y / 35, character.color, { ...player, charge, swing: playerSwing }) },
      { depth: cpu.y, draw: () => athlete(ctx, project(cpu.x, cpu.y), 0.85 + cpu.y / 35, '#ea7255', {
        dx: Math.sign(cpu.dx), dy: Math.sign(cpu.dy), stride: cpuStride, swing: cpuSwing,
        charge: !rally.hitter ? { hand: 'backhand' } : null
      }) },
      { depth: ball.y, draw: () => {
        const p = project(ball.x, ball.y, ball.z);
        dot(p, 6, '#fff5d9');
        dot(p, 4.5, '#192d2b');
      } }
    ];
    bodies.sort((a, b) => a.depth - b.depth).forEach(item => item.draw());
    if (charge && !ended) drawChargeGauge(playerFoot);
    if (flash) {
      const progress = flash.time / 0.24;
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#fff8cb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, 6 + progress * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (result && !paused) {
      ctx.fillStyle = '#132523f2';
      ctx.fillRect(105, 130, 550, 130);
      ctx.textAlign = 'center';
      ctx.fillStyle = result.winner === 'player' ? '#d9ff43' : '#ffad9b';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText(result.winner === 'player' ? '내 득점' : 'CPU 득점', 380, 179);
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#fff9ef';
      ctx.fillText(`${rallyResultText[result.reason]} · R 다시 랠리`, 380, 223);
    }
  }
  function draw() {
    if (!player) return;
    ctx.clearRect(0, 0, 760, 900); ctx.fillStyle = '#0b1411'; ctx.fillRect(0, 0, 760, 900);
    polygon([project(0, 0), project(0, 0, 4.6), project(6.4, 0, 4.6), project(6.4, 0)], rally ? '#f3eee0' : '#c7d3c9');
    polygon([project(0, 0), project(6.4, 0), project(6.4, 9.75), project(0, 9.75)], rally ? '#dab18a' : '#dce4d8');
    if (rally) {
      for (let x = 0; x < COURT.width; x += 0.4) {
        line([project(x, 0), project(x, COURT.length)], '#9a5d4033', 1);
      }
    }
    for (const side of [0, 6.4]) {
      polygon([project(side, 0), project(side, 0, 4.6), project(side, 9.75, 2.1), project(side, 9.75)], '#a9bfb71f');
      line([project(side, 0, 4.6), project(side, 9.75, 2.1)], '#78938b');
      line([project(side, 0), project(side, 9.75)], '#758b7e', 4);
    }
    polygon([project(0, 0), project(0, 0, 0.48), project(6.4, 0, 0.48), project(6.4, 0)], '#9aa99e');
    line([project(0, 0, 0.48), project(6.4, 0, 0.48)], '#cb655b', 3);
    line([project(0, 0, 1.78), project(6.4, 0, 1.78)], '#9a655e');
    line([project(0, 5.46), project(6.4, 5.46)], '#9b6a60');
    line([project(3.2, 5.46), project(3.2, 9.75)], '#9b6a60');
    for (const x of [0, 4.8]) line([project(x, 7.9), project(x + 1.6, 7.9), project(x + 1.6, 9.75)], '#9b6a60');
    ctx.textAlign = 'center'; ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#40564c'; ctx.fillText('FRONT WALL', 380, 98);
    ctx.fillText('TIN', 380, 322);
    const t = project(3.2, 5.46); ctx.fillText('T', t.x, t.y - 10);
    if (rally) {
      drawRally();
      drawPause();
      $('soloHand').textContent = charge ? `${charge.hand === 'backhand' ? '백핸드' : '포핸드'} · ${Math.round(power * 100)}%`
        : rally.result ? (rally.result.winner === 'player' ? '내 득점' : 'CPU 득점')
        : !rally.hitter ? 'CPU 준비 중' : rally.hitter === 'cpu' ? '받아칠 차례' : 'T로 복귀';
      return;
    }
    if (trail.length > 1) line(trail.map(p => project(p.x, p.y, p.z)), '#698b82', 2);
    if (bouncePreview && !ended) {
      const landing = project(bouncePreview.x, bouncePreview.y);
      ctx.strokeStyle = '#8e5a20'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(landing.x, landing.y, 24, 13, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      line([{ x: landing.x - 8, y: landing.y }, { x: landing.x + 8, y: landing.y }], '#8e5a20');
      ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#71471d';
      ctx.fillText(`다음 바운드 · ${bouncePreview.time.toFixed(1)}초`, Math.max(90, Math.min(670, landing.x)), landing.y + 30);
    }
    const p = project(player.x, player.y), target = project(aim.x, aim.y);
    ctx.setLineDash([6, 6]); line([p, target], '#476748'); ctx.setLineDash([]);
    ctx.strokeStyle = '#55773f'; ctx.beginPath(); ctx.arc(target.x, target.y, 9, 0, Math.PI * 2); ctx.stroke();
    for (const hand of ['backhand', 'forehand']) {
      const side = hand === 'backhand' ? -1 : 1;
      const spot = project(player.x + side * character.reach * 0.65, player.y);
      const valid = canHit(player, ball, hand, character.reach);
      ctx.beginPath(); ctx.ellipse(spot.x, spot.y, character.reach * 38, 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = valid ? '#8aa62755' : '#6c837b24'; ctx.fill();
      ctx.font = '12px Arial'; ctx.fillStyle = '#334b3c'; ctx.fillText(hand === 'backhand' ? '좌 · 백핸드' : '우 · 포핸드', spot.x, spot.y + 38);
    }
    dot({ x: p.x + 3, y: p.y + 10 }, 19, '#22382e33'); dot(p, 19, character.color);
    ctx.fillStyle = '#13271b'; ctx.font = 'bold 14px Arial'; ctx.fillText(character.id, p.x, p.y + 5);
    const shownHand = charge?.hand ?? activeHand;
    const handSide = shownHand === 'backhand' ? -1 : 1;
    line([p, { x: p.x + handSide * 33, y: p.y - 13 }], '#294237', 5);
    drawChargeGauge(p);
    const speed = Math.hypot(ball.vx, ball.vy, ball.vz) * BALL_TIME_SCALE;
    const heat = Math.max(0, Math.min(1, (speed - 3) / 7));
    const ballColor = `hsl(${95 - heat * 65} 95% 58%)`;
    // A short, speed-coloured tail separates current motion from the history line.
    if (!ready && !ended) {
      const tail = trail.slice(-5);
      tail.forEach((point, i) => { ctx.globalAlpha = (i + 1) / (tail.length + 1) * 0.65; dot(project(point.x, point.y, point.z), 3 + i * 0.6, ballColor); });
      ctx.globalAlpha = 1;
    }
    const shadow = project(ball.x, ball.y);
    const shadowSize = 11 / (1 + ball.z * 0.25);
    ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y + 3, shadowSize, shadowSize * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(19,43,33,${0.6 / (1 + ball.z * 0.5)})`; ctx.fill();
    const bp = project(ball.x, ball.y, ball.z);
    ctx.setLineDash([3, 4]); line([shadow, bp], '#365f47aa', 1.5); ctx.setLineDash([]);
    for (let z = 0.5; z < ball.z; z += 0.5) {
      const tick = project(ball.x, ball.y, z);
      line([{ x: tick.x - 4, y: tick.y }, { x: tick.x + 4, y: tick.y }], '#365f47aa', 1);
    }
    dot(bp, 9, '#173723'); dot(bp, 6.5, ballColor); dot({ x: bp.x - 2, y: bp.y - 2 }, 2, '#ffffff');
    const labelX = Math.max(4, Math.min(654, bp.x + 15)), labelY = Math.max(4, bp.y - 34);
    ctx.fillStyle = '#10251ee8'; ctx.fillRect(labelX, labelY, 102, 33);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f3ffe9'; ctx.font = 'bold 12px Arial';
    const vertical = ready || ended ? '·' : ball.vz > 0.2 ? '↑' : ball.vz < -0.2 ? '↓' : '→';
    ctx.fillText(`${vertical} ${ball.z.toFixed(1)}m`, labelX + 7, labelY + 13);
    ctx.fillStyle = ballColor; ctx.fillText(`${speed.toFixed(1)} m/s`, labelX + 7, labelY + 27); ctx.textAlign = 'center';
    drawPause();
    $('soloHand').textContent = charge ? `${charge.hand === 'backhand' ? '백핸드' : '포핸드'} · ${Math.round(power * 100)}%` : '누르고 충전 → 떼고 타격';
    $('soloStats').textContent = `타격 ${hits} · 바닥 바운드 ${ball.bounces} · 공 높이 ${ball.z.toFixed(1)}m`;
  }
  function drawPause() {
    if (!paused) return;
    ctx.fillStyle = '#07150da8';
    ctx.fillRect(0, 0, 760, 900);
    ctx.fillStyle = '#e5f1df';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('일시정지 · 계속하기 버튼을 누르세요', 380, 430);
  }
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (isVisible()) {
      if (!paused) { accumulator += dt; while (accumulator >= STEP) { update(STEP); accumulator -= STEP; } }
      draw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
