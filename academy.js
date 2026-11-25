(() => {
  'use strict';
  const A = SquashAcademy, page = document.getElementById('page-academy');
  const canvas = document.getElementById('academyCanvas');
  const $ = id => document.getElementById(id);
  let state = A.start(), renderer, error = false, paused = false, accumulator = 0, last = 0;
  let pointer = null, held = null, heldButton = null, lastMessage = '';
  const gait = { phase: 0, x: 0, y: 0, weight: 0 };
  const keys = new Set();
  const visible = () => page.classList.contains('active') && !document.hidden;
  function clearInput() {
    keys.clear();
    if (held !== null && canvas.hasPointerCapture(held)) canvas.releasePointerCapture(held);
    held = null; heldButton=null;
    if (state.charging || state.phase==='windup') { state.charging = false; state.stroke=null; state.resultTime=0; state.phase = 'result'; state.message = '준비가 취소됐어요. 코치가 다음 공을 준비합니다.'; }
    accumulator = 0;
  }
  function syncLesson() {
    const lesson=A.stage(state),back=lesson.hand==='backhand',hand=back?'백핸드':'포핸드',button=back?'오른쪽':'왼쪽';
    $('academyLessonCopy').textContent='Stage '+lesson.id+' · '+lesson.title+'. 몸 '+(back?'왼쪽':'오른쪽')+'의 공을 민트색 앞벽 목표로 보내세요.';
    $('academyStrokeLabel').textContent=(back?'BACKHAND':'FOREHAND')+' / '+(lesson.volley?'VOLLEY':lesson.cross?'CROSS':'STRAIGHT');
    const shot=AcademyBalance.shot;
    $('academyChargeGuide').textContent=`${shot.dropEnd}%까지는 약한 샷, ${shot.dropEnd+1}~${shot.driftAfter}%는 스트레이트입니다. 이후부터 방향이 흔들리고, ${shot.overloadAfter}%를 넘기면 스윙과 오차가 커집니다. ${shot.mishitAfter}% 초과는 빗맞기 쉽고 100% 초과는 항상 빗맞습니다.`;
    for(const key of ['dropEnd','driftAfter','mishitAfter']){
      $('academyGauge').style.setProperty('--'+key,shot[key]+'%');
    }
    $('academyChargeTitle').textContent=hand+' 충전';
    $('academyControlsCopy').textContent='코트를 클릭한 뒤 WASD 이동 · 마우스로 앞벽 조준 · '+button+' 버튼 누름/놓음: '+hand+' · 반대 버튼: 충전 취소 · R: 새 공';
    $('academyPositionCopy').textContent=(lesson.volley?'앞벽에 맞고 돌아오는 공을 바닥에 닿기 전에 치세요.':lesson.cross?'코치의 보스트를 따라 앞으로 나가 한 번 튄 공을 반대쪽 바닥 목표로 보내세요.':'앞벽에서 돌아와 한 번 튄 공을 받아치세요.')+' 공의 '+(back?'오른쪽':'왼쪽')+'에 서세요. '+(back?'오른손 라켓을 왼쪽 어깨에 준비하고 몸통을 풀며 치세요.':'오른쪽 어깨와 팔꿈치를 뒤로 준비하고 몸통을 풀며 치세요.')+' 코치가 칠 때까지 T에서 기다리고, 받아친 뒤 WASD로 흰색 T에 복귀하세요.';
    canvas.setAttribute('aria-label','3D 스쿼시 코트. WASD 이동, 마우스로 앞벽 조준, '+button+' 버튼 누름/놓음: '+hand+'. R 새 공.');
    $('academyProgressBar').setAttribute('aria-label','Stage '+lesson.id+' 성공 횟수');
    document.querySelectorAll('[data-academy-stage]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.academyStage)===lesson.id)));
  }
  function chooseStage(id){clearInput();if(!A.selectStage(state,id))return;pointer=null;gait.phase=0;gait.weight=0;paused=false;syncLesson();hud();canvas.focus({preventScroll:true});}
  document.querySelectorAll('[data-academy-stage]').forEach(el=>el.onclick=()=>chooseStage(Number(el.dataset.academyStage)));
  $('academyNext').onclick=()=>{if(state.phase==='complete')chooseStage(A.STAGES[state.stageId]?.id ?? state.stageId);};
  function hud() {
    const lesson=A.stage(state),back=lesson.hand==='backhand';
    $('academyProgress').textContent = `${state.successes} / ${lesson.required}`;
    $('academyProgressBar').max = lesson.required;
    $('academyProgressBar').value = state.successes;
    const gauge = $('academyGauge');
    const anchor = renderer?.screenPoint(state.player.x, state.player.y, .9);
    gauge.hidden = !anchor || !(state.charging || (state.stroke && state.stroke.time < .65));
    if (!gauge.hidden) {
      const pct = A.chargePercent(state.power);
      gauge.style.left = `clamp(25px, calc(${anchor.x*100}% + ${back?-34:34}px), calc(100% - 25px))`;
      gauge.style.top = `${anchor.y*100}%`;
      gauge.style.setProperty('--level', Math.min(100,pct)+'%');
      gauge.classList.toggle('overcharged', pct>100);
      $('academyPowerText').textContent = pct+'%';
    }
    $('academyPhase').textContent = paused ? '일시정지' : ({ready:'T에서 대기',recover:'T 복귀 · 성공 대기',regroup:'다음 공 · T 복귀',feed:'코치 피드 · 공 따라가기',windup:'스윙 · 임팩트 준비',flight:'공의 경로 관찰',result:'다시 연습',complete:'Stage '+lesson.id+' 완료'})[state.phase];
    const message = paused ? '일시정지 중입니다. 계속하기를 누르면 이어집니다.' : state.message;
    if (lastMessage !== message) { $('academyFeedback').textContent = message; lastMessage = message; }
    $('academyFeed').disabled = error || ['complete','recover'].includes(state.phase);
    $('academyPause').textContent = paused ? '계속하기' : '일시정지';
    $('academyContact').textContent = ['flight','recover','regroup','result'].includes(state.phase) ? 'WASD로 흰색 T에 복귀하세요' : state.phase==='ready' ? '코치가 치면 출발하세요' : A.contact(state) ? '공이 '+(back?'백핸드':'포핸드')+' 타격 범위에 있어요' : 'WASD로 공의 '+(back?'오른쪽':'왼쪽')+' 가까이에 서세요';
    $('academyCompleteTitle').textContent='Stage '+lesson.id+' 완료';
    $('academyCompleteCopy').textContent=lesson.title+' · T 복귀까지 '+lesson.required+'회 성공!';
    $('academyNext').textContent=A.STAGES[lesson.id] ? 'Stage '+(lesson.id+1)+' · '+A.STAGES[lesson.id].title+' 시작하기' : '마지막 레슨 다시 연습하기';
    const opening=state.phase==='complete' && $('academyComplete').hidden;
    $('academyComplete').hidden = state.phase !== 'complete';
    canvas.inert=state.phase==='complete';
    if(opening){keys.clear();$('academyNext').focus({preventScroll:true});}
  }
  function feed() { if(state.phase==='recover')return; clearInput(); A.feed(state); paused = false; hud(); canvas.focus({preventScroll:true}); }
  $('academyFeed').onclick = feed;
  $('academyRestart').onclick = () => chooseStage(state.stageId);
  $('academyPause').onclick = () => { clearInput(); paused = !paused; hud(); if (!paused) canvas.focus({preventScroll:true}); };
  function cancelChord(e) {
    if (held !== e.pointerId || (e.buttons & 3) !== 3) return false;
    if (!A.cancelCharge(state)) return false;
    held=null; heldButton=null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    hud();
    return true;
  }
  // A mouse reports the second button in a chord as pointermove.
  canvas.addEventListener('pointermove', e => { if (cancelChord(e)) return; const r = canvas.getBoundingClientRect(); pointer = {u:(e.clientX-r.left)/r.width,v:(e.clientY-r.top)/r.height}; });
  canvas.addEventListener('pointerdown', e => {
    if (!visible() || error || e.pointerType === 'touch') return;
    AcademyAudio.unlock();
    if (cancelChord(e)) return;
    if (![0,2].includes(e.button) || held !== null) return;
    if(e.button!==A.stage(state).button){e.preventDefault();state.message='이 레슨은 '+(state.hand==='backhand'?'오른쪽 버튼 백핸드':'왼쪽 버튼 포핸드')+'로 연습하세요.';hud();return;}
    e.preventDefault(); canvas.focus({preventScroll:true});
    if (paused) return;
    const r = canvas.getBoundingClientRect(); pointer = {u:(e.clientX-r.left)/r.width,v:(e.clientY-r.top)/r.height};
    const aim = renderer.aim(pointer.u,pointer.v); if (aim) state.aim = aim;
    if (A.begin(state)) { held = e.pointerId; heldButton=e.button; canvas.setPointerCapture(held); hud(); }
  });
  canvas.addEventListener('pointerup', e => {
    if (e.pointerId !== held || e.button !== heldButton) return;
    held = null; heldButton=null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!paused && visible()) {
      if (A.release(state)) AcademyAudio.play('swing',state.power);
      hud();
    }
  });
  canvas.addEventListener('pointercancel', clearInput);
  canvas.addEventListener('lostpointercapture', () => { if (held !== null) clearInput(); });
  canvas.addEventListener('contextmenu', e => { if (visible()) e.preventDefault(); });
  canvas.addEventListener('blur', () => { clearInput(); hud(); });
  window.addEventListener('keydown', e => {
    if (!visible() || paused || error || document.activeElement !== canvas || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.code;
    if (['KeyW','KeyA','KeyS','KeyD'].includes(k)) { keys.add(k); e.preventDefault(); }
    if (k === 'KeyR' && !e.repeat) { e.preventDefault(); feed(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { if (visible()) { clearInput(); paused = true; hud(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); paused = true; hud(); } });
  window.addEventListener('practice-page-change', e => {
    clearInput();
    if (e.detail === 'academy') {
      AcademyAudio.unlock();
      if (!renderer && !error) {
        try { renderer = AcademyRenderer.create(canvas); }
        catch (err) { error = true; $('academyUnavailable').hidden = false; $('academyUnavailable').textContent = err.message; canvas.hidden = true; }
      }
      paused = false; last = performance.now(); hud();
      if (renderer) canvas.focus({preventScroll:true});
    }
  });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); error = true; clearInput(); $('academyUnavailable').hidden = false; $('academyUnavailable').textContent = '3D 그래픽 연결이 끊겼습니다. 페이지를 새로고침해 주세요.'; hud(); });
  function frame(now) {
    const dt = Math.min(.05,(now-last)/1000 || 0); last = now;
    if (visible() && renderer && !error) {
      if (!paused) {
        if (pointer) { const aim = renderer.aim(pointer.u,pointer.v); if (aim) state.aim = aim; }
        const movement = {x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y:Number(keys.has('KeyS'))-Number(keys.has('KeyW'))};
        const before = {...state.player};
        accumulator += dt;
        while (accumulator >= A.STEP) {
          const {vx,vy,vz}=state.ball;
          const previousPhase=state.phase, previousSuccesses=state.successes;
          const events=A.update(state,A.STEP,movement);
          if(state.phase==='complete' && previousPhase!=='complete')AcademyAudio.play('clear');
          else if(state.successes>previousSuccesses)AcademyAudio.play('success');
          else if(state.phase==='result' && previousPhase!=='result')AcademyAudio.play('retry');
          for(const event of events){
            if(event==='swing') AcademyAudio.play('swing',.55);
            if(event==='hit') AcademyAudio.play('hit',Math.hypot(state.ball.vx,state.ball.vy,state.ball.vz)/15);
            if(event==='front' || event==='back') AcademyAudio.play('front',Math.abs(vy)/14);
            if(event==='left' || event==='right') AcademyAudio.play('front',Math.abs(vx)/14);
            if(event==='floor') AcademyAudio.play('floor',Math.abs(vz)/7);
          }
          accumulator -= A.STEP;
        }
        const dx = state.player.x - before.x, dy = state.player.y - before.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0) {
          gait.phase = (gait.phase + distance / .88) % 1;
          gait.x = dx / distance;
          gait.y = dy / distance;
          gait.weight = Math.min(1, gait.weight + dt * 12);
        } else if (dt >= A.STEP || !(movement.x || movement.y)) {
          gait.weight = Math.max(0, gait.weight - dt * 9);
        }
        renderer.render(state, {gait});
      } else renderer.render(state,{gait});
      hud();
    }
    requestAnimationFrame(frame);
  }
  syncLesson(); hud(); requestAnimationFrame(frame);
})();
