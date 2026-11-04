/* New solo experience; the original CPU prototype remains independently available. */
(() => {
  'use strict';
  const { COURT, BALL_TIME_SCALE, CHARACTERS, canHit, strike, stepBall, nextBounce } = SquashPhysics;
  const page = document.querySelector('#page-practice');
  const legacy = document.querySelector('#cpuPractice');
  const hub = document.createElement('div');
  hub.className = 'shell game-shell';
  hub.innerHTML = `
    <div id="practiceMenu">
      <div class="practice-heading"><div><span class="eyebrow">PLAY SQUASH</span><h1>스쿼시 체험하기</h1><p>내 플레이 스타일을 고르고, 코트에서 직접 경험하세요.</p></div></div>
      <div class="mode-grid">
        <button class="mode-card" data-mode="solo"><span class="eyebrow">01 · SOLO</span><h2>혼자 연습</h2><p>마우스로 조준하고 직접 스윙하세요.<br>공의 속도와 벽 반사를 자유롭게 익힙니다.</p><b>캐릭터 선택 →</b></button>
        <button class="mode-card" data-mode="cpu"><span class="eyebrow">02 · CPU</span><h2>CPU와 대전</h2><p>상대 타구를 읽고 T로 돌아오는 연습.<br>현재는 기존 키보드 연습 버전으로 제공됩니다.</p><b>캐릭터 선택 →</b></button>
      </div>
      <p class="solo-help">온라인 대전은 추후 별도 메뉴로 제공할 예정입니다. 현재 체험은 키보드와 마우스가 필요합니다.</p>
    </div>
    <div id="characterPicker" hidden>
      <div class="practice-heading"><div><span class="eyebrow" id="selectedMode"></span><h1>누구의 스타일로 칠까요?</h1><p>A~E는 임시 캐릭터입니다. 수치는 체험용이며 추후 조정됩니다.</p></div><button class="secondary" id="pickerBack">모드 선택</button></div>
      <div class="character-grid">${CHARACTERS.map(c => `<button class="character-card" data-character="${c.id}" aria-pressed="false" style="--character:${c.color}"><span class="character-avatar">${c.id}</span><strong>${c.name} · ${c.theme}</strong><p>${c.note}</p><small>이동 ${c.speed.toFixed(1)} m/s<br>타격 범위 ${c.reach.toFixed(2)} m<br>충전 속도 ×${c.charge}<br>타구 속도 ×${c.power}</small></button>`).join('')}</div>
      <p id="characterSummary" class="solo-help"></p><button class="primary" id="enterCourt">선택한 캐릭터로 입장</button>
    </div>
    <div id="soloPractice" hidden>
      <div class="practice-heading"><div><span class="eyebrow">SOLO COURT</span><h1>혼자 연습</h1><p id="soloCharacter"></p></div><button class="secondary" id="soloBack">캐릭터 변경 / 나가기</button></div>
      <div class="solo-layout">
        <canvas class="solo-canvas" id="soloCanvas" width="760" height="900" tabindex="0" aria-label="혼자 연습 코트. WASD 이동, 왼쪽 마우스 백핸드, 오른쪽 마우스 포핸드"></canvas>
        <aside class="solo-panel">
          <article><span class="panel-label">NEXT SHOT</span><h3 id="soloHand">타격을 준비하세요</h3><p>버튼을 누르면 캐릭터 옆 세로바가 충전되고, 떼면 스윙합니다. 좌측은 백핸드, 우측은 포핸드입니다.</p><p id="soloStatus" class="solo-status" role="status"></p></article>
          <article><h3>오른손잡이 조작</h3><p>WASD · 이동<br>마우스 위치 · 조준<br>좌클릭 · 백핸드 (몸 왼쪽)<br>우클릭 · 포핸드 (몸 오른쪽)<br>R · 새 공 준비</p><p>공이 몸 옆 타격 영역에 들어왔을 때 스윙하세요. 몸 가까이에서는 양쪽 스윙이 가능합니다.</p><div class="practice-actions"><button class="secondary" id="feedBall">새 공</button><button class="secondary" id="pauseSolo">일시정지</button></div></article>
          <article><h3>공의 움직임 읽기</h3><p>높이 눈금과 ↑↓는 공의 높이와 상승·하강을 나타냅니다. 초록 → 주황 잔상은 느린 공 → 빠른 공입니다. 바닥의 원은 다음 바운드 위치입니다.</p><p>입문용 공 속도 60% · 선수 이동은 그대로입니다. 현재는 기본 드라이브 연습입니다. 두 번째 바닥 바운드·틴·아웃 이후 새 공을 준비하세요.</p><p id="soloStats">타격 0 · 바닥 바운드 0</p></article>
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
  let activeHand = 'forehand';
  const keys = new Set(), STEP = 1 / 240;
  const status = text => { $('soloStatus').textContent = text; };
  function cancelInput() { keys.clear(); charge = null; power = 0; }
  function setPaused(value) {
    paused = value; cancelInput(); accumulator = 0;
    $('pauseSolo').textContent = paused ? '계속하기' : '일시정지';
    if (paused) status('일시정지 중입니다. 계속하기를 누르면 이어집니다.');
    else status(ready ? '마우스로 앞벽을 조준하고, 버튼을 눌렀다 떼어 첫 공을 치세요.' : '공의 그림자를 읽고 타격 위치로 이동하세요.');
  }
  function showPicker() {
    active = false; cancelInput(); legacy.hidden = true; solo.hidden = true; menu.hidden = true; picker.hidden = false;
    window.dispatchEvent(new Event('practice-stop-cpu'));
    $('selectedMode').textContent = mode === 'solo' ? '혼자 연습 · 캐릭터 선택' : 'CPU와 대전 · 기존 연습 버전';
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
    aim = { x: 3.2, y: 0 };
    $('soloCharacter').textContent = `${character.id} · ${character.name} — ${character.note}`;
    feed(); setPaused(false); canvas.focus(); draw();
  };
  $('cpuBack').onclick = () => { hub.hidden = false; mode = 'cpu'; showPicker(); };
  $('pauseSolo').onclick = () => { setPaused(!paused); if (!paused) canvas.focus(); };
  function feed() {
    cancelInput(); ready = true; ended = false; trail = []; accumulator = 0; bouncePreview = null; lastStroke = null;
    ball = { x: player.x + 0.65, y: player.y, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0 };
    status('새 공 준비. 누르는 버튼에 맞춰 몸 왼쪽 또는 오른쪽에서 첫 공을 칩니다.');
  }
  $('feedBall').onclick = () => { feed(); canvas.focus(); };
  function isVisible() { return active && page.classList.contains('active') && !document.hidden; }
  window.addEventListener('practice-page-change', () => { if (active) setPaused(true); cancelInput(); });
  window.addEventListener('blur', () => { if (active) setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) setPaused(true); });
  window.addEventListener('keydown', e => {
    if (!isVisible() || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if ('wasd'.includes(key) && key.length === 1) { e.preventDefault(); if (!paused) keys.add(key); }
    if (key === 'r' && !e.repeat) feed();
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
  }
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointermove', pointerAim);
  canvas.addEventListener('pointerdown', e => {
    if (!isVisible() || paused || ended || charge || ![0, 2].includes(e.button)) return;
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
  function update(dt) {
    if (lastStroke) lastStroke.remaining -= dt;
    let dx = Number(keys.has('d')) - Number(keys.has('a'));
    let dy = Number(keys.has('s')) - Number(keys.has('w'));
    const len = Math.hypot(dx, dy) || 1;
    player.x = Math.max(0.3, Math.min(6.1, player.x + dx / len * character.speed * dt));
    player.y = Math.max(0.5, Math.min(9.4, player.y + dy / len * character.speed * dt));
    if (charge) power = Math.min(1, power + dt * character.charge);
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
  function draw() {
    if (!player) return;
    ctx.clearRect(0, 0, 760, 900); ctx.fillStyle = '#0b1411'; ctx.fillRect(0, 0, 760, 900);
    polygon([project(0, 0), project(0, 0, 4.6), project(6.4, 0, 4.6), project(6.4, 0)], '#c7d3c9');
    polygon([project(0, 0), project(6.4, 0), project(6.4, 9.75), project(0, 9.75)], '#dce4d8');
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
    if (paused) { ctx.fillStyle = '#07150da8'; ctx.fillRect(0, 0, 760, 900); ctx.fillStyle = '#e5f1df'; ctx.font = 'bold 28px Arial'; ctx.fillText('일시정지 · 계속하기 버튼을 누르세요', 380, 430); }
    $('soloHand').textContent = charge ? `${charge.hand === 'backhand' ? '백핸드' : '포핸드'} · ${Math.round(power * 100)}%` : '누르고 충전 → 떼고 타격';
    $('soloStats').textContent = `타격 ${hits} · 바닥 바운드 ${ball.bounces} · 공 높이 ${ball.z.toFixed(1)}m`;
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
