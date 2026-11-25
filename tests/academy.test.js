const {test,beforeEach} = require('node:test');
// Use the central straight feed for the repeatable stroke fixtures.
beforeEach(t=>t.mock.method(Math,'random',()=>.5));
const assert = require('node:assert/strict');
const A = require('../academy-model.js');
const R = require('../academy-renderer.js');
const P = require('../practice-physics.js');
const M = require('../academy-animation.js');
const approaching=new WeakSet();
function moveToward(s,target){
  const dx=target.x-s.player.x,dy=target.y-s.player.y;
  const scale=Math.max(3.2*A.STEP,Math.hypot(dx,dy));
  A.update(s,A.STEP,{x:dx/scale,y:dy/scale});
}
function advance(s,seconds){
  for(let i=0;i<Math.round(seconds/A.STEP);i++){
    if(approaching.has(s) && ['ready','feed'].includes(s.phase)){
      moveToward(s,{x:s.hand==='forehand'?4.70:1.52,y:3.72});
    }else A.update(s,A.STEP);
  }
}
function approach(s,hold=.7){
  approaching.add(s);
  advance(s,2.54-hold);
}
function shot(s, hold=.7) {
  approach(s,hold);
  assert(A.begin(s)); advance(s,hold); const hit=A.release(s);
  for(let i=0;i<2400&&['windup','flight','recover'].includes(s.phase);i++){
    if(s.phase==='windup')A.update(s,A.STEP);
    else moveToward(s,A.stage(s).player);
  }
  return hit;
}

test('backhand stage accepts only its hand and completes ten left-side drives',()=>{
  for(const hold of [.5,.7,.8375]) {
    const s=A.start(2);
    assert.equal(A.begin(s,'forehand'),false);
    for(let n=1;n<=10;n++) {
      assert(shot(s,hold));assert.equal(s.successes,n);assert(s.wallHit);
      assert(s.ball.x>=A.stage(s).landing.x0&&s.ball.x<=A.stage(s).landing.x1);
      if(n<10)assert(A.feed(s));
    }
    assert.equal(s.phase,'complete');assert.equal(s.completed[1],true);
    assert(A.nextStage(s));assert.equal(s.stageId,3);
  }
});

test('stage selection cancels a stroke, resets the lesson and preserves completed lessons',()=>{
  const s=A.start();assert.equal(A.nextStage(s),false);
  for(let i=0;i<10;i++){shot(s);if(i<9)A.feed(s);}
  assert(A.nextStage(s));assert.equal(s.stageId,2);assert.equal(s.successes,0);
  assert.deepEqual(s.completed,[true,false,false,false,false,false]);
  approach(s);A.begin(s);advance(s,.7);A.release(s);assert(A.selectStage(s,1));
  assert.equal(s.stroke,null);assert.equal(s.phase,'ready');
  const snapshot=structuredClone(s);assert.equal(A.selectStage(s,7),false);assert.deepEqual(s,snapshot);
});

test('backhand uses the right arm across the chest and meets the real ball at impact',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  for(const hold of [1.08,1.14,1.2]) {
    const s=A.start(2);approach(s,hold);A.begin(s);advance(s,hold);
    const prep=M.pose(s),inv=R.inverse(prep.body);
    const hand=R.transform(inv,[...prep.hand,1]);
    assert(hand[0]<-.10);assert(hand[2]<-.10);
    assert(distance(prep.shoulder,R.transform(prep.body,[.29,1.28,0,1]))<1e-9);
    assert(A.release(s));
    for(let i=0;i<=100;i++) {
      s.stroke.time=i/100*M.END_TIME;const pose=M.pose(s);
      assert(Math.abs(distance(pose.shoulder,pose.elbow)-.34)<1e-9);
      assert(Math.abs(distance(pose.elbow,pose.hand)-.32)<1e-9);
      assert(pose.hand.every(Number.isFinite));
    }
    s.stroke.time=0;advance(s,M.CONTACT_TIME);
    assert.equal(s.phase,'flight');assert(M.pose(s).contactError<1e-9);
    assert(distance(M.pose(s).racketHead,M.localBall(s,s.ball))<1e-9);
  }
});

test('struck ball is 20 percent faster without changing supply tempo or physical path',()=>{
  assert.equal(A.BALL_PROFILE.timeScale,P.BALL_TIME_SCALE*1.2);
  assert.equal(A.FEED_PROFILE.timeScale,P.BALL_TIME_SCALE);
  const a={x:3,y:4,z:1,vx:1,vy:-8,vz:2,bounces:0},b={...a};
  for(let i=0;i<500;i++) {
    assert.deepEqual(P.stepBall(a,A.STEP,A.BALL_PROFILE),P.stepBall(b,A.STEP*1.2,A.FEED_PROFILE));
    for(const key of ['x','y','z','vx','vy','vz'])assert(Math.abs(a[key]-b[key])<1e-9);
  }
});
test('actual feeds, contact, front-wall reflection and first landing complete ten repetitions',()=>{
  const s=A.start();
  for(let n=1;n<=10;n++) {
    assert(shot(s)); assert.equal(s.successes,n); assert(s.front); assert(s.wallHit);
    assert.equal(s.ball.bounces,1); assert(s.ball.vy>0); assert(s.ball.vz>0);
    assert.equal(s.phase,n===10?'complete':'result');
    if(n<10)assert(A.feed(s));
  }
  advance(s,2); assert.equal(s.successes,10); assert.equal(A.feed(s),false);
  const restarted=A.start(); assert.equal(restarted.successes,0); assert.equal(restarted.phase,'ready');
});
test('recommended novice charge range can succeed deterministically',()=>{
  for(const hold of [.5,.7,.8375]) {const s=A.start();assert(shot(s,hold));assert.equal(s.successes,1,`hold ${hold}`);}
  const a=A.start(),b=A.start();shot(a);shot(b);assert.deepEqual(a,b);
});
test('wrong body side, excess distance and bad timing fail without fake contact',()=>{
  for(const p of [{x:6,y:3.8},{x:2,y:6}]) {const s=A.start();s.player=p;advance(s,1.84);A.begin(s);advance(s,.7);assert(A.release(s));assert(s.stroke.miss);advance(s,M.CONTACT_TIME);assert.equal(s.phase,'feed');assert.equal(s.successes,0);}
  const s=A.start(); A.begin(s); advance(s,4.1);assert.equal(s.phase,'result');assert.equal(A.release(s),false);assert.equal(s.successes,0);
});
test('off-target, tin, and side-wall routes do not score a straight',()=>{
  for(const aim of [{x:2,y:0,z:1.3},{x:5.35,y:0,z:.3},{x:6.4,y:0,z:1.3}]){
    const s=A.start();s.aim=aim;shot(s);assert.equal(s.successes,0);assert.equal(s.phase,'result');
  }
});
test('a floor before the front wall is a failure; result rebound cannot score again',()=>{
  const s=A.start();approach(s);A.begin(s);advance(s,.7);A.release(s);
  advance(s,M.CONTACT_TIME);
  s.ball.vy=0;s.ball.vz=-5;s.ball.z=A.BALL_PROFILE.radius+.005;A.update(s,A.STEP);
  assert.equal(s.phase,'result');assert.equal(s.successes,0);advance(s,2);assert.equal(s.successes,0);
});
test('new ball preserves progress and waits for player to return to the T, resets feed and bounces',()=>{
  const s=A.start();shot(s);s.player.x=4.4;assert(A.feed(s));assert.equal(s.successes,1);assert.equal(s.player.x,4.4);assert.equal(s.phase,'regroup');assert.deepEqual(s.ball,{...A.STAGE.feed,vx:0,vy:0,vz:0,bounces:0});
});
test('movement is normalized and constrained; clearance envelope is explicit',()=>{
  const s=A.start();advance(s,.85);A.update(s,2,{x:1,y:1});assert.equal(s.player.x,6.05);
  const t=A.start();advance(t,.85);t.player={x:2,y:3};A.update(t,.1,{x:1,y:1});assert(Math.abs(Math.hypot(t.player.x-2,t.player.y-3)-.32)<1e-10);
  A.update(s,100,{x:-1,y:-1});assert.equal(s.player.x,.35);assert.equal(s.player.y,.6);
  assert(!A.clearance({x:6,y:4}));assert(A.clearance({x:3.2,y:5.46}));
});
test('renderer coordinate conversion and perspective picking agree at multiple aspect ratios',()=>{
  assert.deepEqual(R.world(3.2,0,1.5),[0,1.5,-4.875]);
  for(const aspect of [1,4/3,16/9]){
    const vp=R.mul(R.perspective(aspect),R.look([0,8.4,13.8],[0,1,-.3]));
    for(const p of [{x:.6,y:0,z:.8},{x:5.35,y:0,z:1.3},{x:3.2,y:0,z:3}]){
      const clip=R.transform(vp,[...R.world(p.x,p.y,p.z),1]);
      const aim=R.aimAt(vp,(clip[0]/clip[3]+1)/2,(1-clip[1]/clip[3])/2);
      assert(Math.abs(aim.x-p.x)<1e-8);assert(Math.abs(aim.z-p.z)<1e-8);
    }
  }
});
test('tutorial uses shared dissipative physics at the original fixed timestep',()=>{
  assert.equal(A.STEP,1/240);
  const s=A.start();advance(s,.85);A.begin(s);const b={...s.ball};const expected=P.stepBall(b,A.STEP,A.FEED_PROFILE);assert.deepEqual(A.update(s,A.STEP),expected);assert.deepEqual(s.ball,b);
});
test('3D floor rebound is readable while wall and rear rebounds lose more speed than legacy',()=>{
  const bounce=profile=>{
    const radius=profile?.radius??P.COURT.radius;
    const b={x:3,y:5,z:radius+.001,vx:0,vy:0,vz:-5,bounces:0};
    P.stepBall(b,A.STEP,profile);let peak=b.z;
    for(let i=0;i<480&&b.bounces<2;i++){P.stepBall(b,A.STEP,profile);peak=Math.max(peak,b.z);}
    return peak;
  };
  const peak=bounce(A.BALL_PROFILE);
  assert(peak>.5&&peak<.6,`3D apex ${peak}`);assert(peak>bounce()*1.6);
  for(const [setup,axis,event,loss]of[
    [{y:.026,vy:-8},'vy','front',.78],
    [{y:9.724,vy:8},'vy','back',.25],
    [{x:.026,vx:-8},'vx','left',.76],
    [{x:6.374,vx:8},'vx','right',.76]
  ]){
    const b={x:3,y:5,z:1,vx:0,vy:0,vz:0,bounces:0,...setup};
    assert(P.stepBall(b,A.STEP,A.BALL_PROFILE).includes(event));assert(Math.abs(Math.abs(b[axis])-8*loss)<1e-10);
  }
});
test('full-body pose keeps limb lengths, feet grounded and the wrist within its loading range',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const s=A.start();approach(s);A.begin(s);advance(s,.7);A.release(s);
  for(let i=0;i<=100;i++){
    s.stroke.time=i/100*M.END_TIME;const pose=M.pose(s);
    assert(Math.abs(distance(pose.shoulder,pose.elbow)-.34)<1e-10);
    assert(Math.abs(distance(pose.elbow,pose.hand)-.32)<1e-10);
    assert(pose.elbow.every(Number.isFinite));
    const grip=pose.racket,gripAxis=[grip[4],grip[5],grip[6]];
    const forearm=pose.hand.map((v,i)=>(v-pose.elbow[i])/.32);
    const alignment=gripAxis.reduce((sum,v,i)=>sum+v*forearm[i],0);
    assert(alignment>.30); // Bent ready grip, then extension through impact.
    if(s.stroke.time>=M.CONTACT_TIME && s.stroke.time<=M.FOLLOW_TIME)assert(alignment>.78);
    assert.deepEqual(grip.slice(12,15),pose.hand);
    for(const [index,leg] of pose.legs.entries()){
      const hip=R.transform(pose.pelvis,[index===0?-.17:.17,.65,0,1]);
      assert(distance(leg.hip,hip.slice(0,3))<1e-10);
      assert(Math.abs(distance(leg.hip,leg.knee)-.34)<1e-10);
      assert(Math.abs(distance(leg.knee,leg.ankle)-.32)<1e-10);
      assert(Math.abs(leg.ankle[1]-.10)<1e-10);
      assert(distance(leg.ankle,leg.requestedAnkle)<1e-10);
    }
  }
  s.stroke.time=M.END_TIME-.00001;const end=M.pose(s);s.stroke=null;s.charging=false;const idle=M.pose(s);
  assert(distance(end.hand,idle.hand)<.001);
});
test('ball departs only when the swing reaches its contact time and string-bed centre',()=>{
  for(const hold of [.5,.7,.9]){
    const s=A.start();approach(s,hold);A.begin(s);advance(s,hold);assert(A.release(s));
    assert.equal(s.phase,'windup');assert(s.ball.vy>0);
    for(let i=0;i<Math.round(M.CONTACT_TIME/A.STEP)-1;i++){assert(!A.update(s,A.STEP).includes('hit'));assert(s.ball.vy>0);}
    assert(A.update(s,A.STEP).includes('hit'));assert.equal(s.phase,'flight');assert(s.ball.vy<0);
    const pose=M.pose(s),target=M.localBall(s,s.ball);
    const centre=R.transform(pose.racket,[0,M.HEAD_OFFSET,0,1]);
    assert(Math.hypot(...target.map((v,i)=>v-centre[i]))<1e-9);
    assert(pose.contactError<1e-9);
    const forearm=pose.hand.map((v,i)=>(v-pose.elbow[i])/.32);
    assert(forearm.reduce((sum,v,i)=>sum+v*pose.racket[4+i],0)>.9999);
    const vy=s.ball.vy;A.update(s,A.STEP);assert.equal(s.ball.vy,vy); // no second strike
  }
});
test('shoulder and elbow rotate before the forearm releases the loaded racket',()=>{
  const s=A.start();approach(s,.9);A.begin(s);advance(s,.9);A.release(s);
  const at=u=>{s.stroke.time=u*M.CONTACT_TIME;return M.pose(s);};
  const start=at(0),transition=at(.35),middle=at(.65),release=at(.8),hit=at(1);
  assert(transition.shoulderSweep>transition.forearmRelease+.4);
  assert(transition.wristShortening>start.wristShortening);
  assert(middle.elbow[2]<start.elbow[2]-.25);
  assert(middle.racketHead[2]>hit.racketHead[2]+.7);
  const direction=pose=>{
    const p=R.transform(R.inverse(pose.body),[...pose.elbow,1]);
    return p.slice(0,3).map((v,i)=>(v-[.29,1.28,0][i])/.34);
  };
  const a=direction(start),b=direction(release);
  assert(a.reduce((sum,v,i)=>sum+v*b[i],0)<.65); // Actual upper-arm rotation, not just endpoint translation.
  assert(hit.wristShortening<1e-9);assert.equal(hit.forearmRelease,1);
});
test('low contact lowers the pelvis and bends knees, followed by torso rotation and recovery',()=>{
  const s=A.start();approach(s);A.begin(s);advance(s,.7);A.release(s);
  s.stroke.time=M.CONTACT_TIME;s.stroke.point.z=1.4;const high=M.pose(s);
  s.stroke.point.z=.25;const low=M.pose(s);
  assert(low.drop>high.drop+.08);assert(low.legs[0].hip[1]<high.legs[0].hip[1]-.08);
  assert(low.legs[0].knee[2]<low.legs[0].hip[2]-.1);
  s.stroke.time=0;const prepared=M.pose(s);s.stroke.time=M.FOLLOW_TIME;const follow=M.pose(s);
  assert(follow.turn>prepared.turn+.7);assert(follow.racketHead[0]<0);
  assert(prepared.requestedHead[2]>low.requestedHead[2]+.1);
});
test('forehand coils waist and shoulders toward the right/rear, then unwinds hips first',()=>{
  const s=A.start();approach(s,1.2);A.begin(s);advance(s,1.2);
  const prepared=M.pose(s),f=prepared.facing;
  const worldForward=matrix=>{
    const x=-matrix[8],z=-matrix[10];
    return[-f[1]*x-f[0]*z,f[0]*x-f[1]*z];
  };
  for(const matrix of[prepared.body,prepared.pelvis]){
    const direction=worldForward(matrix);assert(direction[0]>.78);assert(direction[1]>0);
  }
  assert(prepared.turn<prepared.hipTurn-.2);assert(prepared.drop>.18);
  const waist=R.transform(prepared.pelvis,[0,.65,0,1]),torsoBase=R.transform(prepared.body,[0,.65,0,1]);
  assert(Math.hypot(...waist.slice(0,3).map((v,i)=>v-torsoBase[i]))<1e-10);
  A.release(s);s.stroke.time=M.CONTACT_TIME/2;const mid=M.pose(s);
  assert(mid.hipTurn>mid.turn+.4);
});
test('backswing moves the hand and racket behind the open shoulder without locking the elbow',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  for(const hold of[1.14,1.17,1.2]){
    const s=A.start();approach(s,hold);A.begin(s);advance(s,hold);const pose=M.pose(s);
    assert(pose.hand[2]-pose.shoulder[2]>.35);
    assert(pose.racketHead[2]-pose.shoulder[2]>.55);
    assert(pose.elbow[2]-pose.shoulder[2]>.20);
    assert(distance(pose.shoulder,pose.racketHead)<=.98+1e-9);
  }
});
test('the loaded elbow retracts toward the court back wall rather than diagonally toward the side wall',()=>{
  for(const aimX of[4.8,5.35,6]){
    const hold=1.2;
    const s=A.start();s.aim.x=aimX;approach(s,hold);A.begin(s);advance(s,hold);const p=M.pose(s),f=p.facing;
    const d=p.elbow.map((v,i)=>v-p.shoulder[i]);
    const side=-f[1]*d[0]-f[0]*d[2],rear=f[0]*d[0]-f[1]*d[2];
    assert(rear>.32);assert(Math.abs(side)<.03);assert(rear>Math.abs(side)*10);
    assert(d[1]<0&&d[1]>-.06);
  }
});
test('racket drops on a curved path and accelerates after the body starts to unwind',()=>{
  const s=A.start();approach(s,1.2);A.begin(s);advance(s,1.2);A.release(s);
  const at=u=>{s.stroke.time=u*M.CONTACT_TIME;return M.pose(s);};
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const start=at(0),early=at(.2),mid=at(.6),late=at(.8),near=at(1);
  assert(mid.racketHead[1]<start.racketHead[1]-.15);
  assert(mid.racketHead[2]>near.racketHead[2]+.6);
  assert(distance(late.racketHead,near.racketHead)>distance(start.racketHead,early.racketHead)*5);
  const chord=start.racketHead.map((v,i)=>(v+near.racketHead[i])/2);
  const halfway=at(.5);assert(distance(halfway.racketHead,chord)>.20);
  assert(mid.hipTurn>mid.turn); // The arm remains loaded after the pelvis begins opening.
});
test('back wall damps all velocity components without launching the ball upward',()=>{
  for(const vz of[-3,3]){
    const b={x:3,y:9.724,z:1,vx:2,vy:8,vz,bounces:0};
    assert(P.stepBall(b,A.STEP,A.BALL_PROFILE).includes('back'));
    assert.equal(b.vy,-2);assert.equal(b.vx,1.1);
    assert(Math.abs(b.vz-(vz-9.81*A.STEP*A.BALL_PROFILE.timeScale)*.55)<1e-10);
  }
});
test('a settled 3D ball loses floor speed instead of gliding endlessly',()=>{
  const b={x:3,y:5,z:A.BALL_PROFILE.radius,vx:0,vy:3,vz:0,bounces:1};
  for(let i=0;i<240;i++)P.stepBall(b,A.STEP,A.BALL_PROFILE);
  assert(b.vy<.72);assert.equal(b.vz,0);assert.equal(b.bounces,1);
});
test('a strong lesson drive returns less than two metres from the rear wall',t=>{
  t.mock.method(Math,'random',()=>.5);
  const s=A.start();approach(s,1.05);A.begin(s);advance(s,1.05);assert(A.release(s));
  let backY=null;
  let endY;
  for(let i=0;i<2000;i++){
    const incomingSpeed=Math.abs(s.ball.vy);
    const events=A.update(s,A.STEP);
    if(s.phase==='ready')break;
    endY=s.ball.y;
    if(events.includes('back')){assert.equal(backY,null);backY=s.ball.y;assert(Math.abs(s.ball.vy)<=incomingSpeed*.25+1e-9);}
  }
  assert(backY!==null);assert(backY-endY<2);
});

test('moving in a charged stance alternates support feet in either lesson',()=>{
  for(const stage of [1,2]){
    const s=A.start(stage);A.begin(s);advance(s,.8);
    const ready=M.pose(s);
    for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){
      for(const phase of [.25,.75]){
        const pose=M.pose(s,{phase,x,y,weight:1});
        const raised=phase===.25?1:0;
        assert(pose.legs[raised].ankle[1]>.20);
        assert(Math.abs(pose.legs[1-raised].ankle[1]-.10)<1e-8);
        assert.deepEqual(pose.racketHead,ready.racketHead);
      }
    }
  }
});

test('coach strikes from behind the short line and feeds a first bounce in front on each wing',()=>{
  for(const id of [1,2]){
    const s=A.start(id);
    while(s.phase==='ready') A.update(s,A.STEP);
    const coach=A.coachState(s);
    assert(coach.player.y>8);
    assert(M.pose(coach).contactError<.001);
    assert(s.ball.y>5.46 && s.ball.vy<0);
    const collisions=[];
    for(let i=0;i<4/A.STEP && !s.ball.bounces;i++){
      const events=A.update(s,A.STEP);
      collisions.push(...events);
      if(events.includes('front')){
        assert(s.ball.z>.48 && s.ball.z<4.6);
        assert(s.ball.vy>0);
      }
    }
    assert.deepEqual(collisions,['front','floor']);
    assert(s.ball.y<5.46);
    assert(id===1 ? s.ball.x>3.2 : s.ball.x<3.2);
    assert.equal(A.contact(s),false);
  }
});

test('coach automatically feeds again after success or miss and stops at completion',()=>{
  for(const id of [1,2]){
    const s=A.start(id);
    advance(s,4);
    assert.equal(s.phase,'result');
    while(s.phase==='result') A.update(s,A.STEP);
    assert.equal(s.phase,'ready');
    assert.equal(s.successes,0);
    for(let n=1;n<=10;n++){
      assert(shot(s));
      assert.equal(s.successes,n);
      if(n<10){
        assert.equal(s.phase,'result');
        while(s.phase==='result') A.update(s,A.STEP);
        assert.equal(s.phase,'ready');
      }
    }
    advance(s,4);
    assert.equal(s.phase,'complete');
  }
});

test('charge boundaries control the actual shot target and speed',()=>{
  const aim={x:5.35,y:0,z:1.3};
  const profile=(pct,roll=.5)=>A.shotProfile(pct/100,aim,()=>roll);
  for(const pct of [0,20]){
    assert(profile(pct).speedScale<.71);
    assert(profile(pct).target.z<aim.z);
  }
  for(const pct of [21,70]) assert.deepEqual(profile(pct).target,aim);
  for(const pct of [71,80]){
    const drift=profile(pct).target.x-aim.x;
    assert(drift>0 && drift<.45);
  }
  assert(profile(90).speedScale>profile(80).speedScale);
  assert(profile(90).target.x>profile(80).target.x);
  for(const pct of [91,100]){
    assert.equal(profile(pct,.79).label,'빗맞음');
    assert.equal(profile(pct,.8).label,'강타');
  }
  assert(Math.abs(profile(101,.99).target.x-aim.x)>1.5);
  const s=A.start();
  A.begin(s);
  advance(s,1.2);
  assert.equal(A.chargePercent(s.power),100);
  advance(s,A.STEP);
  assert.equal(A.chargePercent(s.power),101);
});

test('canceling charge leaves the same moving feed available for a fresh swing',()=>{
  for(const id of [1,2]){
    const s=A.start(id);
    approach(s);
    A.begin(s);advance(s,.25);
    const ball={...s.ball};
    assert(A.cancelCharge(s));
    assert.equal(s.power,0);
    assert.equal(s.charging,false);
    assert.equal(A.release(s),false);
    assert.deepEqual(s.ball,ball);
    assert.equal(s.attempts,0);
    assert(A.begin(s));advance(s,.45);
    assert(A.release(s));
    advance(s,M.CONTACT_TIME);
    assert.equal(s.phase,'flight');
  }
});
test('short push, progressive preparation and exaggerated finish use the released charge for both hands',()=>{
  for(const id of [1,2]){
    let previousTurn=-1;
    for(const power of [.1,.2,.4,.6,.8,1]){
      const s=A.start(id),hold=power*1.2;
      approach(s,hold);A.begin(s);advance(s,hold);
      const prep=M.pose(s);
      assert(Math.abs(prep.turn)>previousTurn);
      previousTurn=Math.abs(prep.turn);
      assert(A.release(s));
      advance(s,M.CONTACT_TIME);
      assert.equal(s.phase,'flight');
      assert(M.pose(s).contactError<.001);
      const contact=M.localBall(s,s.ball);
      s.stroke.time=M.FOLLOW_TIME;
      const finish=M.pose(s);
      if(power<=.2){
        assert(Math.abs(prep.turn)<.12);
        assert(Math.abs(finish.turn)<.07);
        assert(Math.hypot(...finish.racketHead.map((v,i)=>v-contact[i]))<.25);
      }
      if(power===1) assert(Math.abs(finish.turn)>.9);
    }
  }
});

test('ready grip rests in front with a lowered elbow and raised racket head',()=>{
  for(const id of [1,2]){
    const s=A.start(id),p=M.pose(s);
    assert(p.elbow[1]<p.shoulder[1]-.24);
    assert(p.hand[2]<p.elbow[2]-.18);
    assert(p.racketHead[1]>p.hand[1]+.30);
    A.begin(s);
    assert.deepEqual(M.pose(s).hand,p.hand);
  }
});
test('an air swing follows through without changing the feed and can be followed by a real return',()=>{
  for(const id of [1,2]){
    const s=A.start(id),reference=A.start(id);
    approach(s,1.1);approach(reference,1.1);
    A.begin(s);A.release(s);
    const start=M.pose(s).racketHead;
    assert(s.stroke.miss);
    advance(s,.10);advance(reference,.10);
    assert(Math.hypot(...M.pose(s).racketHead.map((v,i)=>v-start[i]))>.15);
    assert.equal(A.begin(s),false);
    advance(s,.25);advance(reference,.25);
    assert.deepEqual(s.ball,reference.ball);
    assert(A.begin(s));
    advance(s,.75);assert(A.release(s));
    advance(s,M.CONTACT_TIME);
    assert.equal(s.phase,'flight');
    assert.equal(s.attempts,2);
    const early=A.start(id);
    A.begin(early);assert(A.release(early));
    advance(early,.35);assert(A.begin(early));
    assert.equal(early.phase,'ready');
  }
});
test('both drives turn side-on at 45 percent and approach full racket preparation by 60 percent',()=>{
  for(const id of [1,2]){
    const s=A.start(id);
    A.begin(s);
    function poseAt(power){s.power=power;return M.pose(s);}
    const basic=poseAt(.45), loaded=poseAt(.60), full=poseAt(.70), strong=poseAt(.90);
    const degrees=basic.turn*(id===1?-1:1)*180/Math.PI;
    assert(degrees>75 && degrees<90);
    assert(loaded.racketHead[2]>basic.racketHead[2]+.10);
    assert(Math.hypot(...loaded.racketHead.map((v,i)=>v-full.racketHead[i]))<.06);
    assert(Math.abs(strong.turn)>Math.abs(full.turn)+.10);
  }
});

test('wait for coach impact, run forward and return manually to earn the last success',()=>{
  for(const id of [1,2]){
    const s=A.start(id),t=A.stage(s).player;
    s.successes=9;
    for(let i=0;i<204;i++){
      A.update(s,A.STEP,{x:1,y:-1});
      assert.deepEqual(s.player,t);
    }
    assert.equal(s.phase,'feed');
    for(let i=0;i<238;i++)moveToward(s,{x:id===1?4.70:1.52,y:3.72});
    A.begin(s);advance(s,.70);assert(A.release(s));
    advance(s,4);
    assert.equal(s.phase,'recover');
    assert.equal(s.successes,9);
    assert.equal(A.feed(s),false);
    for(let i=0;i<240 && s.phase==='recover';i++)moveToward(s,t);
    assert.equal(s.phase,'complete');
    advance(s,4);
    assert.equal(s.successes,10);
  }
});

test('tight coach feeds can be retrieved from inside and scored after T recovery on either wing',t=>{
  t.mock.method(Math,'random',()=>.1);
  for(const id of [1,2]){
    const s=A.start(id),target={x:id===1?5.67:.68,y:3.56};
    // The backhand strikes across the body, from inside the left wall.
    s.aim.x=id===1?5.85:.55;
    for(let i=0;i<610;i++){
      if(i===442)assert(A.begin(s));
      moveToward(s,target);
    }
    assert(Math.min(s.ball.x,6.4-s.ball.x)<.28);
    assert(!A.contact({...s,player:{x:s.ball.x,y:s.ball.y}}));
    assert(A.release(s));advance(s,M.CONTACT_TIME);
    assert.equal(s.phase,'flight');
    for(let i=0;i<1600&&s.phase!=='result';i++)moveToward(s,A.stage(s).player);
    assert.equal(s.successes,1);
  }
});

test('well-aimed 65 to 80 percent drives land progressively deeper inside the target',()=>{
  for(const id of [1,2]){
    let previous=6;
    for(const power of [.65,.70,.75,.80]){
      const s=A.start(id);
      // The fixed random roll adds a 0.255 m lateral offset above 70%.
      if(Math.round(1.2*power/A.STEP)*A.STEP/1.2>.70+1e-9)s.aim.x-=.255;
      assert(shot(s,1.2*power));
      assert.equal(s.successes,1);
      assert(s.ball.y>previous && s.ball.y<=A.stage(s).landing.y1);
      previous=s.ball.y;
    }
  }
});
