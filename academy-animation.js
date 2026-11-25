/* Procedural teaching pose in player-local X/right, Y/up, Z/rear coordinates. */
(function(root){
  'use strict';
  const {shot,swing}=typeof module !== 'undefined' ? require('./academy-balance.js') : root.AcademyBalance;
  const CONTACT_TIME=.125, FOLLOW_TIME=.38, END_TIME=.85;
  const UPPER=.34, FOREARM=.32, HEAD_OFFSET=.43;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const cubic=(a,b,c,d,t)=>a.map((v,i)=>(1-t)**3*v+3*(1-t)**2*t*b[i]+3*(1-t)*t*t*c[i]+t**3*d[i]);
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function facing(s){
    if(s.stroke&&s.stroke.time<END_TIME)return s.stroke.facing;
    return norm([s.aim.x-s.player.x,-s.player.y]);
  }
  function localBall(s,b){
    const f=facing(s),dx=b.x-s.player.x,dy=b.y-s.player.y;
    return[dx*-f[1]+dy*f[0],b.z,-(dx*f[0]+dy*f[1])];
  }
  function limb(a,target,upper,lower,pole,margin=.012){
    const delta=target.map((v,i)=>v-a[i]),actual=Math.hypot(...delta);
    const d=clamp(actual,Math.abs(upper-lower)+.008,upper+lower-margin),axis=norm(delta);
    const tip=a.map((v,i)=>v+axis[i]*d),along=dot(pole,axis);
    let bend=pole.map((v,i)=>v-axis[i]*along);
    if(Math.hypot(...bend)<.001)bend=cross(axis,[1,0,0]);
    bend=norm(bend);
    const x=(upper*upper-lower*lower+d*d)/(2*d),h=Math.sqrt(Math.max(0,upper*upper-x*x));
    return{joint:a.map((v,i)=>v+axis[i]*x+bend[i]*h),tip,error:Math.abs(actual-d)};
  }
  function matrixAt(p,y,roll=0){
    y=norm(y);const x=norm(cross(y,Math.abs(y[2])>.95?[1,0,0]:[0,0,1])),z=cross(x,y);
    const c=Math.cos(roll),s=Math.sin(roll);
    return[...x.map((v,i)=>v*c-z[i]*s),0,...y,0,...z.map((v,i)=>x[i]*s+v*c),0,...p,1];
  }
  function pose(s,gait=null){
    const stroke=s.stroke&&s.stroke.time<END_TIME?s.stroke:null;
    const back=(stroke?stroke.hand:s.hand)==='backhand';
    const t=stroke?stroke.time:0,power=stroke?stroke.power:s.power;
    const frame=facing(s);
    const contact=localBall(s,stroke?stroke.point:s.ball);
    const ready=[.48,1.29,-.52];
    // Turn side-on early, then let the racket finish travelling behind the shoulder.
    const touch=.06*clamp(100*power/shot.dropEnd,0,1);
    const armTravel=clamp((100*power-shot.dropEnd)/(swing.fullArmAt-shot.dropEnd),0,1);
    const extra=clamp((100*power-shot.overloadAfter)/(100-shot.overloadAfter),0,1);
    const prep=touch+.90*(1-(1-armTravel)**2)+.04*extra;
    const coil=touch+.80*smooth((100*power-shot.dropEnd)/(swing.fullTurnAt-shot.dropEnd))+.10*smooth(armTravel)+.17*extra;
    const chargeLoad=prep*.92;
    const preparedTurn=(back?1.75:-1.75)*coil,preparedHip=(back?1.45:-1.45)*coil;
    const hitTurn=back?.30:.20,hitHip=back?.15:.10;
    const followTurn=(back?-.85:.85)*coil,followHip=(back?-.55:.55)*coil;
    let load=s.charging?chargeLoad:0,turn=s.charging?preparedTurn:0,hipTurn=s.charging?preparedHip:0;
    if(stroke){
      if(t<=CONTACT_TIME){
        const u=clamp(t/CONTACT_TIME,0,1);
        load=chargeLoad+(1-chargeLoad)*smooth(u);
        // Hips open before shoulders, from each hand's own preparation side.
        hipTurn=preparedHip+(hitHip-preparedHip)*smooth(u);
        turn=preparedTurn+(hitTurn-preparedTurn)*u**1.7;
      }else{
        const u=smooth((t-CONTACT_TIME)/(FOLLOW_TIME-CONTACT_TIME));
        load=1-.35*u;turn=hitTurn+(followTurn-hitTurn)*u;hipTurn=hitHip+(followHip-hitHip)*u;
        if(t>FOLLOW_TIME){const recover=smooth((t-FOLLOW_TIME)/(END_TIME-FOLLOW_TIME));load=.65*(1-recover);turn=followTurn*(1-recover);hipTurn=followHip*(1-recover);}
      }
    }
    const low=clamp((1.05-contact[1])/.85,0,1);
    const drop=.06+load*(.16+.10*low);
    const hc=Math.cos(hipTurn),hs=Math.sin(hipTurn);
    const shift=back?-.08*load:-.06*load*hc-.07*load*hs,depth=back?-.07*load:.06*load*hs-.07*load*hc;
    const lean=-.04-.13*load,c=Math.cos(turn),sn=Math.sin(turn),cx=Math.cos(lean),sx=Math.sin(lean);
    const bodyPoint=p=>{
      const y=(p[1]-.65)*cx-p[2]*sx,z=(p[1]-.65)*sx+p[2]*cx;
      return[shift+p[0]*c+z*sn,.65+y-drop,depth-p[0]*sn+z*c];
    };
    const body=[c,0,-sn,0,sx*sn,cx,sx*c,0,cx*sn,-sx,cx*c,0,
      shift-.65*sx*sn,.65-drop-.65*cx,depth-.65*sx*c,1];
    const bodyVector=v=>{const p=bodyPoint([v[0],v[1]+.65,v[2]]),o=bodyPoint([0,.65,0]);return p.map((x,i)=>x-o[i]);};
    const pelvisPoint=p=>[shift+p[0]*hc+p[2]*hs,p[1]-drop,depth-p[0]*hs+p[2]*hc];
    const pelvis=[hc,0,-hs,0,0,1,0,0,hs,0,hc,0,shift,-drop,depth,1];
    const shoulder=bodyPoint([.29,1.28,0]);
    // Preparation has its own arm excursion, not a racket glued to the turning torso.
    // Keep a bent elbow by bounding the shoulder-to-head span below full extension.
    // Retraction is anchored to the court's back wall, not an outward 45-degree reach.
    // Build the loaded chain from an explicit rearward upper-arm direction first.
    // Backhand keeps the same RIGHT shoulder/hand, crossing in front of the chest.
    // Its elbow, forearm and racket preparation are independent of the forehand.
    const rearArm=back?norm(bodyVector([-.35,-.30,-.65])):norm([frame[0]+.04,-.12,-frame[1]]);
    const rearElbow=shoulder.map((v,i)=>v+rearArm[i]*UPPER);
    const backForearm=norm(bodyVector([-.9,.4,.1])),backShaft=norm(bodyVector([-.72,.30,.63]));
    const prepHand=rearElbow.map((v,i)=>v+backForearm[i]*FOREARM);
    const raisedRacket=norm([.04+frame[0]*.56,.66,-frame[1]*.56]);
    const desired=back?prepHand.map((v,i)=>v+backShaft[i]*HEAD_OFFSET):rearElbow.map((v,i)=>v+raisedRacket[i]*(FOREARM+HEAD_OFFSET-.025));
    const baseLag=back?FOREARM+HEAD_OFFSET-Math.hypot(...desired.map((v,i)=>v-rearElbow[i])):.025;
    const offset=desired.map((v,i)=>v-shoulder[i]),span=Math.hypot(...offset),reach=Math.min(1,.98/span);
    const prepared=shoulder.map((v,i)=>v+offset[i]*reach);
    let head=s.charging?cubic(ready,back?[-.55,1.78,-.25]:[ready[0]+.18,1.80,.12],
      [prepared[0]+(back?-.10:.10),prepared[1]+.10,prepared[2]-.25],prepared,prep):ready;
    let armLoad=s.charging?prep:0,roll=(back?.95:-.85)*armLoad;
    let shoulderSweep=0,forearmRelease=0,wristShortening=baseLag*armLoad;
    let readyGrip = s.charging ? 1-prep : 1;
    if(stroke){
      if(t<=CONTACT_TIME){
        const u=clamp(t/CONTACT_TIME,0,1);
        readyGrip=(1-prep)*(1-smooth(u));
        const q=u**(1+1.3*prep);
        const dropArc=[stroke.from[0]+(back?-.16:.10),Math.max(contact[1]+.12,stroke.from[1]-.28),stroke.from[2]+.10];
        const approach=[contact[0]+(back?-.14:.14),contact[1]+.04,contact[2]+.24];
        head=mix(mix(stroke.from,contact,smooth(u)),cubic(stroke.from,dropArc,approach,contact,q),prep);
        shoulderSweep=smooth(u/.72);
        forearmRelease=smooth((u-.25)/.75);
        armLoad=prep*(1-shoulderSweep);roll=(back?.95:-.85)*prep*(1-forearmRelease);
        // Keep the racket loaded while the upper arm/elbow turns first.
        wristShortening=prep*(baseLag*(1-smooth(u))+.018*Math.sin(Math.PI*u));
      }else{
        readyGrip=smooth((t-FOLLOW_TIME)/(END_TIME-FOLLOW_TIME));
        const push=[contact[0],contact[1]+.045,contact[2]-.16];
        const follow=mix(push,[back?.65:-.38,clamp(contact[1]+.60,1.05,1.65),-.48-.16*extra],prep);
        head=mix(contact,follow,smooth((t-CONTACT_TIME)/(FOLLOW_TIME-CONTACT_TIME)));
        armLoad=0;roll=0;shoulderSweep=1;forearmRelease=1;wristShortening=0;
        if(t>FOLLOW_TIME)head=mix(follow,ready,smooth((t-FOLLOW_TIME)/(END_TIME-FOLLOW_TIME)));
      }
    }
    // Shoulder swivel moves the elbow around the shoulder/head axis, independently
    // of the endpoint path. The wrist is a second joint, not a rigid extension.
    const orbit=(back?-2.10:2.10)*shoulderSweep,oc=Math.cos(orbit),os=Math.sin(orbit);
    const loadedPole=[rearArm[0]*oc+rearArm[2]*os,rearArm[1]-.40*shoulderSweep,-rearArm[0]*os+rearArm[2]*oc];
    const rotating=s.charging||stroke&&t<=CONTACT_TIME;
    const hitPole=back?[-.25,-1,-.35]:[0,-1,.15];
    let pole=rotating?mix(hitPole,loadedPole,prep):hitPole;
    if(stroke&&t<=CONTACT_TIME)pole=mix(pole,hitPole,smooth((forearmRelease-.55)/.45));
    const tool=FOREARM+HEAD_OFFSET-wristShortening-.14*readyGrip;
    const arm=limb(shoulder,head,UPPER,tool,pole);
    const wrist=limb(arm.joint,arm.tip,FOREARM,HEAD_OFFSET,mix(back?backForearm:[.15,.70,1],[0,-1,.2],readyGrip),0);
    const hand=wrist.joint,direction=norm(wrist.tip.map((v,i)=>v-hand[i]));
    const legs=[-1,1].map(side=>{
      const hip=pelvisPoint([side*.17,.65,0]);
      const leading=back?side>0:side<0;
      const ax=side*(.22+.035*load),az=(leading?-.32:.30)*load;
      const ankle=[ax*hc+az*hs,.10,-ax*hs+az*hc];
      if (gait && gait.weight > 0) {
        // The planted foot travels backwards relative to the moving player.
        const phase = (gait.phase + (side > 0 ? .5 : 0)) % 1;
        const swing = Math.max(0, (phase - .5) * 2);
        const stride = phase < .5 ? .22 - .88 * phase : -.22 + .44 * smooth(swing);
        const right = -frame[1] * gait.x + frame[0] * gait.y;
        const rear = -frame[0] * gait.x - frame[1] * gait.y;
        ankle[0] += right * stride * gait.weight;
        ankle[2] += rear * stride * gait.weight;
        ankle[1] += .12 * Math.sin(Math.PI * swing) ** 2 * gait.weight;
      }
      const leg=limb(hip,ankle,.34,.32,[-hs,0,-hc]);
      return{hip,knee:leg.joint,ankle:leg.tip,requestedAnkle:ankle,footTurn:hipTurn};
    });
    const leftShoulder=bodyPoint([-.29,1.27,0]),left=limb(leftShoulder,bodyPoint([-.40,.91,-.18]),.30,.28,[0,-1,0]);
    return{body,pelvis,drop,turn,hipTurn,load,legs,shoulder,elbow:arm.joint,hand,
      racket:matrixAt(hand,direction,roll),racketHead:wrist.tip,requestedHead:head,contactError:arm.error+wrist.error,
      shoulderSweep,forearmRelease,wristShortening,
      left:{shoulder:leftShoulder,elbow:left.joint,hand:left.tip},facing:facing(s)};
  }
  const api={CONTACT_TIME,FOLLOW_TIME,END_TIME,HEAD_OFFSET,pose,localBall,facing,limb};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SquashMotion=api;
})(globalThis);
