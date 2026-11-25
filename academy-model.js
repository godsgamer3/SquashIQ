/* Stage logic shares the legacy metre-based physics, without a renderer dependency. */
(function (root) {
  'use strict';
  const P = typeof module !== 'undefined' ? require('./practice-physics.js') : root.SquashPhysics;
  const Motion = typeof module !== 'undefined' ? require('./academy-animation.js') : root.SquashMotion;
  const {shot,bounce,feed:coach,lesson:rules}=typeof module !== 'undefined' ? require('./academy-balance.js') : root.AcademyBalance;
  const STEP = 1 / 240;
  // Readable tutorial tuning, separate from the legacy low-bounce court.
  const BALL_PROFILE = Object.freeze({ timeScale: P.BALL_TIME_SCALE * 1.2, radius: .025, floorRestitution: bounce.floor,
    frontRestitution: bounce.front, sideRestitution: bounce.side, backRestitution: bounce.back,
    backTangentialRetention: .55, rollingDrag: 2.4 });
  // Preserve supply/charge timing; a struck ball alone is 20% faster.
  const FEED_PROFILE=Object.freeze({...BALL_PROFILE,timeScale:P.BALL_TIME_SCALE});
  // Keep the same simulated rebound distance in the faster observation window.
  const RESULT_OBSERVE=2*P.BALL_TIME_SCALE/BALL_PROFILE.timeScale;
  const STAGE = Object.freeze({
    id: 1, hand: 'forehand', button: 0, title: '포핸드 스트레이트',
    player: { x: 3.2, y: 5.46 },
    required: rules.repetitions,
    wall: { x0: 4.8, x1: 6.1, z0: .65, z1: 2.15 },
    landing: { x0: 4.7, x1: 6.2, y0: 3, y1: 8.7 },
    feed: { x: 5.35, y: 8.45, z: 1 }
  });
  const backhand = Object.freeze({
    id: 2, hand: 'backhand', button: 2, title: '백핸드 스트레이트', required: rules.repetitions,
    player: { x: 3.2, y: 5.46 }, feed: { x: 1.05, y: 8.45, z: 1 },
    wall: { x0: .30, x1: 1.60, z0: .65, z1: 2.15 },
    landing: { x0: .20, x1: 1.70, y0: 3, y1: 8.7 }
  });
  const straight=[STAGE,backhand];
  const volleys=straight.map((lesson,i)=>({...lesson,id:3+i,volley:true,title:lesson.title.replace('스트레이트','발리')}));
  const crosses=straight.map((lesson,i)=>({...lesson,id:5+i,cross:true,title:lesson.title.replace('스트레이트','크로스'),
    feed:{x:i===0?1.8:4.6,y:6.2,z:1}, wall:{x0:2.45,x1:3.95,z0:.65,z1:2.15},
    landing:{...straight[1-i].landing,x0:i===0?.25:3.8,x1:i===0?2.6:6.15}}));
  const STAGES=Object.freeze([...straight,...volleys,...crosses]);
  const stage = s => STAGES.find(item => item.id === s.stageId) || STAGE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function start(id=1) {
    const s = { completed: STAGES.map(()=>false) };
    if(!selectStage(s,id))throw new RangeError('Unknown academy stage');
    return s;
  }
  function selectStage(s,id){
    const lesson=STAGES.find(item=>item.id===id);if(!lesson)return false;
    s.phase='ready';s.stageId=id;s.hand=lesson.hand;s.player={...lesson.player};
    s.aim={x:lesson.cross?3.2:lesson.feed.x,y:0,z:1.3};s.successes=0;s.attempts=0;
    feed(s);return true;
  }
  function nextStage(s){return s.phase==='complete'&&selectStage(s,s.stageId+1);}
  function atT(s) {
    const t=stage(s).player;
    return Math.hypot(s.player.x-t.x,s.player.y-t.y)<=rules.tRadius;
  }
  function feed(s) {
    const lesson=stage(s),back=lesson.hand==='backhand';
    if (s.phase==='recover' || s.successes >= lesson.required) return false;
    s.ball = { ...lesson.feed, vx: 0, vy: 0, vz: 0, bounces: 0 };
    s.phase = atT(s) ? 'ready' : 'regroup'; s.time = 0; s.charging = false; s.power = 0;
    s.feedFront=false; s.front = false; s.wallHit = false; s.side = false;
    s.stroke = null;
    s.coachTime = 0;
    s.flightTempo = 1;
    s.message = !atT(s) ? '다음 공을 받으려면 흰색 T로 돌아오세요.' : lesson.cross?'T에서 기다리세요. 코치가 옆벽을 이용해 보스트를 보냅니다.': (back?'왼쪽':'오른쪽') + ' 뒤쪽 코치가 앞벽으로 스트레이트를 칩니다. T에서 기다렸다가 코치가 치면 출발하세요.';
    return true;
  }
  const COACH_PREP = coach.wait;
  function coachState(s) {
    const lesson = stage(s), point = lesson.feed;
    const hand=lesson.cross ? (lesson.hand==='forehand'?'backhand':'forehand') : lesson.hand;
    const side = hand === 'forehand' ? 1 : -1;
    const x = point.x - side * (hand === 'forehand' ? .70 : .56);
    const coach = {player:{x,y:point.y+.18}, aim:{x}, ball:point, hand, charging:true, power:.55};
    const swingTime = s.coachTime - COACH_PREP + Motion.CONTACT_TIME;
    if (swingTime >= 0) {
      coach.stroke = {time:swingTime, point, facing:[0,-1], hand:coach.hand, power:coach.power,
        from:Motion.pose(coach).racketHead};
      coach.charging = false;
    }
    return coach;
  }
  function begin(s,hand=s.hand) {
    if (!['ready','feed'].includes(s.phase)||s.charging||hand!==stage(s).hand) return false;
    if (s.stroke?.miss && s.stroke.time < Motion.END_TIME) return false;
    s.stroke=null; s.power=0;
    s.charging = true;
    s.message = stage(s).volley?'앞벽에서 돌아오는 공을 바닥에 닿기 전에 치세요.':'공을 따라가며 앞벽을 조준하고, 첫 바운드 뒤 타격 범위에서 버튼을 놓으세요.';
    return true;
  }
  function cancelCharge(s) {
    if (!s.charging) return false;
    s.charging=false;
    s.power=0;
    s.message='충전을 취소했어요. 공이 타격 범위에 있으면 다시 준비하세요.';
    return true;
  }
  function facing(s) {
    const dx = s.aim.x - s.player.x, dy = -s.player.y;
    const n = Math.hypot(dx, dy) || 1;
    return { x: dx / n, y: dy / n };
  }
  function nearSideWall(ball) {
    return Math.min(ball.x,P.COURT.width-ball.x)<rules.tightDistance;
  }
  function contact(s) {
    const f = facing(s), dx = s.ball.x - s.player.x, dy = s.ball.y - s.player.y;
    const tight=nearSideWall(s.ball);
    const insideGap=dx*(s.hand==='forehand'?1:-1);
    if(tight && (insideGap<rules.gapMin || insideGap>rules.gapMax))return false;
    // Convert to the body's right/forward basis before using legacy hand/reach checks.
    return s.ball.z >= .12 && P.canHit({ x: 0, y: 0 },
      { x: dx * -f.y + dy * f.x, y: dx * f.x + dy * f.y, z: s.ball.z }, stage(s).hand, tight ? rules.tightReach : rules.reach);
  }
  function finish(s, ok, message) {
    s.charging = false;
    s.resultTime = 0;
    if (ok) s.successes++;
    const lesson=stage(s);
    s.phase = s.successes >= lesson.required ? 'complete' : 'result';
    if(s.phase==='complete')s.completed[lesson.id-1]=true;
    s.message = s.phase === 'complete' ? `Stage ${lesson.id} 완료! ${lesson.title}를 익혔습니다. ${lesson.id<STAGES.length?'다음 레슨으로 넘어가세요.':'모든 레슨을 연습했습니다.'}` : message;
  }
  function release(s) {
    if (!s.charging) return false;
    if (!['ready','feed'].includes(s.phase)) return false;
    const from=Motion.pose(s).racketHead;
    s.charging = false; s.attempts++;
    const preview={...s.ball};
    for(let i=0;i<Math.round(Motion.CONTACT_TIME/STEP);i++)P.stepBall(preview,STEP,FEED_PROFILE);
    const f=facing(s);
    s.stroke={time:0,from,hand:s.hand,power:s.power,aim:{...s.aim},point:{x:preview.x,y:preview.y,z:preview.z},facing:[f.x,f.y],hit:false};
    if (s.phase==='ready' || (stage(s).volley ? !s.feedFront || preview.bounces!==0 : preview.bounces!==1) || !contact({...s,ball:preview})) {
      miss(s,f);
      return true;
    }
    s.phase='windup';s.message=chargePercent(s.power)<=shot.dropEnd?'짧게 앞으로 밀어 칩니다.':'무릎을 낮추고 몸통과 함께 스윙합니다.';
    return true;
  }
  function miss(s,f) {
    const side=s.hand==='forehand' ? .60 : -.48;
    s.stroke.miss=true;
    s.stroke.point={x:s.player.x-f.y*side+f.x*.23,y:s.player.y+f.x*side+f.y*.23,z:.83};
    if (s.phase==='windup') s.phase='feed';
    s.message=nearSideWall(s.ball)?'벽에 붙은 공이에요. 몸은 코트 안쪽에 두고 벽을 따라 앞으로 치세요.':'헛스윙! 공이 살아 있으면 다시 눌러 스윙하세요.';
  }
  function chargePercent(power) {
    return Math.ceil(power * 100 - 1e-8) || 0;
  }
  function shotProfile(power, aim, random = Math.random) {
    const pct = chargePercent(power);
    const target = {...aim};
    const driveLoad=clamp((100*power-shot.boostStart)/(shot.fullDepthAt-shot.boostStart),0,1);
    let speedScale = 1+shot.depthBoost*driveLoad*driveLoad*(3-2*driveLoad), label = '스트레이트';
    if (pct <= shot.dropEnd) {
      speedScale = shot.dropSpeed + power * .55;
      target.z = Math.min(aim.z, .58 + power * .55);
      label = '약한 샷';
    } else if (pct > shot.driftAfter) {
      const wide = pct > 100 || (pct > shot.mishitAfter && random() < shot.mishitChance);
      const extra = clamp((100*power-shot.overloadAfter)/(100-shot.overloadAfter),0,1);
      speedScale += shot.extraSpeed * extra;
      const spread = wide ? shot.mishitMin + random() * shot.mishitRange : .08 + .75*extra + random()*(.35+.65*extra);
      target.x += (random() < .5 ? -1 : 1) * spread;
      label = wide ? '빗맞음' : '강타';
    }
    return {target, speedScale, label};
  }
  function impact(s) {
    const stroke=s.stroke;
    const point={x:s.ball.x,y:s.ball.y,z:s.ball.z};
    const pose=Motion.pose({...s,stroke:{...stroke,point,time:Motion.CONTACT_TIME}});
    if(s.ball.bounces !== (stage(s).volley?0:1) || !contact({...s,aim:stroke.aim})||pose.contactError>.035){
      miss(s,{x:stroke.facing[0],y:stroke.facing[1]});return false;
    }
    stroke.point=point;
    // Mid-court lesson uses a softer speed range than the full-court solo drive.
    const strike = shotProfile(stroke.power, stroke.aim);
    const wall=stage(s).wall;
    const onTarget=strike.target.x>=wall.x0 && strike.target.x<=wall.x1 &&
      strike.target.z>=wall.z0 && strike.target.z<=wall.z1;
    // Accelerate the ball clock on clean drives, retaining their landing depth.
    s.flightTempo=onTarget && strike.label!=='빗맞음'
      ? 1+(shot.cleanTempo-1)*clamp((100*stroke.power-shot.boostStart)/(shot.fullTempoAt-shot.boostStart),0,1) : 1;
    P.strike(s.ball, strike.target, Math.min(1, stroke.power) * .65, { power: 1 });
    s.ball.vx *= strike.speedScale;
    s.ball.vy *= strike.speedScale;
    // Assisted elevation only: keep horizontal direction and charge from the shared strike.
    const flight = (s.ball.y - BALL_PROFILE.radius) / -s.ball.vy;
    s.ball.vz = (strike.target.z - s.ball.z) / flight + 4.905 * (flight + STEP * BALL_PROFILE.timeScale * s.flightTempo);
    s.hitInFront=!atT(s) && s.player.y < stage(s).player.y;
    stroke.hit=true;
    s.phase = 'flight'; s.time = 0;
    s.message = strike.label + '! WASD로 흰색 T에 복귀하세요.';
    return true;
  }
  function update(s, dt, movement = { x: 0, y: 0 }) {
    const n = Math.max(1, Math.hypot(movement.x, movement.y));
    if (s.phase !== 'ready') {
      s.player.x = clamp(s.player.x + movement.x / n * rules.moveSpeed * dt, .35, 6.05);
      s.player.y = clamp(s.player.y + movement.y / n * rules.moveSpeed * dt, .6, 9.25);
    }
    // A missed stroke plays its full follow-through and recovery in 0.34 seconds.
    if(s.stroke)s.stroke.time+=dt*(s.stroke.miss ? Motion.END_TIME/rules.missRecovery : 1);
    if (s.phase==='regroup') {
      if(atT(s))feed(s);
      return [];
    }
    s.coachTime += dt;
    if (s.charging) s.power = s.power + dt / shot.chargeSeconds;
    if (s.phase === 'ready') {
      if (s.coachTime + 1e-9 >= COACH_PREP) {
        s.phase = 'feed';
        s.message='코치가 쳤어요! 앞으로 달려가 첫 바운드 뒤에 받아치세요.';
        const tight=Math.random()<coach.tightChance;
        const width=Math.random()-.5;
        const side=s.hand==='forehand'?1:-1;
        s.ball.vx=side*(tight ? coach.tightSide+coach.tightSpread*width : coach.sideSpread*width);
        s.ball.vy=-coach.forward+(Math.random()-.5)*coach.forwardSpread;
        s.ball.vz=coach.lift+(Math.random()-.5)*coach.liftSpread;
        if(tight)s.message='옆벽 쪽으로 갑니다! 몸은 공보다 코트 안쪽에 두고 벽을 따라 치세요.';
        if(stage(s).volley){
          s.ball.vz+=1.55;
          s.message='앞벽에서 돌아오는 공을 바닥에 닿기 전에 발리하세요.';
        }
        if(stage(s).cross){
          s.ball.vx=-side*(7+(Math.random()-.5)*.34);
          s.ball.vy=-10;
          s.ball.vz=4.3;
          s.message='보스트입니다! T 앞으로 나가 한 번 튄 공을 코치 쪽으로 크로스하세요.';
        }
        return ['hit'];
      }
      const swingStart=COACH_PREP-Motion.CONTACT_TIME;
      if(s.coachTime>=swingStart && s.coachTime-dt<swingStart)return ['swing'];
      return [];
    }
    if(s.phase==='windup'){
      const events=P.stepBall(s.ball,dt,FEED_PROFILE);
      if(stage(s).volley && events.includes('floor')){finish(s,false,'발리 전에 공이 바닥에 닿았어요.');return events;}
      if(s.stroke.time+1e-9>=Motion.CONTACT_TIME){if(impact(s))events.push('hit');}
      return events;
    }
    if (s.phase==='recover' && atT(s)) {
      finish(s,true,'T 복귀 성공! 코치가 다음 공을 준비합니다.');
      return [];
    }
    // Keep the first floor rebound visible after evaluation, without scoring twice.
    if (['result', 'complete', 'recover'].includes(s.phase) && s.resultTime < RESULT_OBSERVE) {
      s.resultTime += dt;
      return P.stepBall(s.ball, dt*s.flightTempo, BALL_PROFILE);
    }
    if (s.phase === 'result') feed(s);
    if (!['feed', 'flight'].includes(s.phase)) return [];
    s.time += dt;
    const events = P.stepBall(s.ball, dt*s.flightTempo, s.phase==='feed'?FEED_PROFILE:BALL_PROFILE);
    const lesson=stage(s),b = s.ball, w = lesson.wall, l = lesson.landing;
    if (s.phase === 'feed') {
      if(events.includes('front'))s.feedFront=true;
      if(lesson.volley && b.bounces)finish(s,false,'공이 바닥에 닿았어요. 다음에는 조금 더 일찍 발리하세요.');
      else if (b.bounces >= 2 || s.time > 4) finish(s, false, '공이 두 번 튀었어요. 다음 공은 첫 바운드 뒤에 쳐 보세요.');
      return events;
    }
    if (events.includes('left') || events.includes('right')) s.side = true;
    if (events.includes('out') || (events.includes('front') && b.z <= .48)) {
      finish(s, false, '틴 또는 아웃 높이입니다. 앞벽의 민트색 사각형 안을 조준해 보세요.');
    } else if (events.includes('front')) {
      s.front = true;
      s.wallHit = !s.side && b.x >= w.x0 && b.x <= w.x1 && b.z >= w.z0 && b.z <= w.z1;
      s.message = s.wallHit ? '앞벽 목표 통과! 흰색 T로 돌아오세요.' : '앞벽에는 맞았어요. 다음에는 민트색 목표로 방향을 맞춰 보세요.';
    } else if (events.includes('floor')) {
      const ok = s.front && s.wallHit && !s.side && b.x >= l.x0 && b.x <= l.x1 && b.y >= l.y0 && b.y <= l.y1;
      if (!ok) finish(s,false,'목표 구역 밖입니다. 민트색 앞벽 목표를 조준해 보세요.');
      else if (!s.hitInFront) finish(s,false,'코치가 친 뒤 T에서 앞으로 나가 받아치세요.');
      else if (atT(s)) finish(s,true,'타격과 T 복귀 성공!');
      else {
        s.phase='recover'; s.resultTime=0;
        s.message='목표 명중! 흰색 T로 돌아오면 1회로 기록됩니다.';
      }
    } else if (s.time > 10) finish(s, false, '새 공으로 다시 시도해 보세요.');
    return events;
  }
  function clearance(player) {
    // Conservative teaching envelope, not mesh collision or a safety certification.
    return Math.min(player.x, P.COURT.width - player.x, player.y, P.COURT.length - player.y) >= .8;
  }
  const api = { chargePercent, shotProfile, STEP, BALL_PROFILE, FEED_PROFILE, STAGE, STAGES, stage, coachState, start, selectStage, nextStage, feed, begin, cancelCharge, facing, contact, release, update, clearance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SquashAcademy = api;
})(globalThis);
