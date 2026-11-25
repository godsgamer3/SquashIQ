/* Browser-native WebGL. All geometry is procedural; no external assets. */
(function(root){
  'use strict';
  const Motion=typeof module!=='undefined'?require('./academy-animation.js'):root.SquashMotion;
  const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  const translation=(x,y,z)=>{const m=I();m[12]=x;m[13]=y;m[14]=z;return m;};
  const scale=(x,y,z)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
  const ry=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];};
  const transform=(m,p)=>[0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*(p[3]??1));
  function inverse(m){
    const rows=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>+(r===c))]);
    for(let c=0;c<4;c++){
      let best=c;for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[best][c]))best=r;
      [rows[c],rows[best]]=[rows[best],rows[c]];const n=rows[c][c];if(Math.abs(n)<1e-12)throw Error('Singular camera');
      rows[c]=rows[c].map(v=>v/n);for(let r=0;r<4;r++)if(r!==c){const f=rows[r][c];rows[r]=rows[r].map((v,i)=>v-f*rows[c][i]);}
    }
    return Array.from({length:16},(_,i)=>rows[i%4][4+Math.floor(i/4)]);
  }
  const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const BALL_RADIUS=.035;
  function look(eye,target){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
  function perspective(aspect){const f=1/Math.tan(38*Math.PI/360),n=.1,far=80;return[f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0];}
  const world=(x,y,z)=>[x-3.2,z,y-4.875];
  function aimAt(vp,u,v){
    const inv=inverse(vp),unproject=z=>{const p=transform(inv,[u*2-1,1-v*2,z,1]);return p.slice(0,3).map(x=>x/p[3]);};
    const a=unproject(-1),b=unproject(1),t=(-4.875-a[2])/(b[2]-a[2]);
    return{x:Math.max(.15,Math.min(6.25,a[0]+t*(b[0]-a[0])+3.2)),y:0,z:Math.max(.5,Math.min(4.3,a[1]+t*(b[1]-a[1])))};
  }
  function geometry(kind){
    const out=[];
    function tri(a,b,c){const n=norm(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));for(const p of[a,b,c])out.push(...p,...n);}
    // Elliptical cross sections share their seam at the slanted jersey stripe.
    const hem=[.736,.217,.145,0], chest=[1.13,.249,.155,.065];
    const stripe=[1.20,.251,.157,.065], shoulder=[1.28,.244,.15,.012];
    const rings={
      jersey:[hem,[.88,.207,.14,0],chest], sash:[chest,stripe],
      yoke:[stripe,shoulder,[1.34,.108,.095,0]]
    }[kind];
    if(rings){
      const vertex=([y,w,d,tilt],angle)=>[w*Math.cos(angle),y+tilt*Math.cos(angle),d*Math.sin(angle)];
      for(let row=1;row<rings.length;row++)for(let i=0;i<20;i++){
        const a=i*Math.PI/10,b=(i+1)*Math.PI/10;
        const lo=rings[row-1],hi=rings[row];
        tri(vertex(lo,a),vertex(hi,a),vertex(hi,b));
        tri(vertex(lo,a),vertex(hi,b),vertex(lo,b));
      }
    }else if(kind==='box'){
      const p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
      for(const[a,b,c,d]of[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){tri(p[a],p[b],p[c]);tri(p[a],p[c],p[d]);}
    }else if(kind==='racket'){
      // Open teardrop rim; the court remains visible through the string bed.
      const point=(i,inside,z)=>{const a=i/48*Math.PI*2,k=inside?.84:1;return[Math.sin(a)*(.125+.025*Math.cos(a))*k,.43+.21*Math.cos(a)*k,z];};
      for(let i=0;i<48;i++){
        for(const z of[-.009,.009]){const a=point(i,false,z),b=point(i+1,false,z),c=point(i+1,true,z),d=point(i,true,z);tri(a,b,c);tri(a,c,d);}
        for(const inside of[false,true]){const a=point(i,inside,-.009),b=point(i+1,inside,-.009),c=point(i+1,inside,.009),d=point(i,inside,.009);tri(a,b,c);tri(a,c,d);}
      }
    }else{
      const sphere=kind==='sphere',rows=sphere?10:1,cols=16;
      const point=(i,j)=>{const a=j/cols*Math.PI*2,h=i/rows,r=sphere?Math.sin(h*Math.PI):1;return[Math.cos(a)*r,sphere?Math.cos(h*Math.PI):h-.5,Math.sin(a)*r];};
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){tri(point(i,j),point(i+1,j),point(i+1,j+1));tri(point(i,j),point(i+1,j+1),point(i,j+1));}
      if(!sphere)for(let j=0;j<cols;j++){tri([0,-.5,0],point(0,j+1),point(0,j));tri([0,.5,0],point(1,j),point(1,j+1));}
    }
    return new Float32Array(out);
  }
  function create(canvas,view={}){
    const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
    if(!gl)throw Error('WebGL을 사용할 수 없습니다. 하드웨어 가속을 지원하는 데스크톱 브라우저에서 열어 주세요.');
    function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec3 n; uniform mat4 m; uniform mat4 vp; varying float light; void main(){ vec3 normal=normalize(mat3(m)*n); light=.66+.34*max(0.0,dot(normal,normalize(vec3(-.4,1.0,.6)))); gl_Position=vp*m*vec4(p,1.0); }'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; uniform vec3 color; varying float light; void main(){gl_FragColor=vec4(color*light,1.0);}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const pos=gl.getAttribLocation(program,'p'),normal=gl.getAttribLocation(program,'n'),model=gl.getUniformLocation(program,'m'),camera=gl.getUniformLocation(program,'vp'),color=gl.getUniformLocation(program,'color');
    const meshes={};for(const kind of['box','sphere','cylinder','racket','jersey','sash','yoke']){const data=geometry(kind),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);meshes[kind]={buffer,count:data.length/6};}
    const colors={wood:[.72,.57,.38],plank:[.77,.63,.44],wall:[.86,.91,.88],red:[.75,.22,.19],mint:[.23,.76,.65],dark:[.08,.16,.18],shirt:[.08,.77,.80],coral:[1,.37,.24],lime:[.83,.97,.40],gold:[1,.80,.30],navy:[.10,.18,.33],hair:[.17,.11,.10],gum:[.78,.54,.32],skin:[.87,.65,.45],white:[.95,.97,.92],ball:[.87,1,.18],shadow:[.30,.34,.29],target:[.38,.66,.49]};
    let vp;
    function draw(kind,m,c){const mesh=meshes[kind];gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);gl.uniformMatrix4fv(model,false,new Float32Array(m));gl.uniform3fv(color,colors[c]||c);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
    const shape=(kind,parent,p,size,c)=>draw(kind,mul(mul(parent,translation(...p)),scale(...size)),c);
    const box=(x,y,z,w,h,d,c)=>shape('box',I(),[x,y,z],[w,h,d],c);
    function segment(parent,a,b,r,c){
      const delta=b.map((v,i)=>v-a[i]),y=norm(delta),x=norm(cross(y,Math.abs(y[2])>.95?[1,0,0]:[0,0,1])),z=cross(x,y),p=mix(a,b,.5);
      const basis=[...x,0,...y,0,...z,0,...p,1];
      draw('cylinder',mul(mul(parent,basis),scale(r,Math.hypot(...delta),r)),c);
    }
    function racket(parent){
      draw('racket',parent,'mint');
      segment(parent,[0,-.045,0],[0,.11,0],.018,'dark');
      segment(parent,[0,.11,0],[0,.22,0],.011,'white');
      segment(parent,[0,.15,0],[-.06,.26,0],.009,'mint');
      segment(parent,[0,.15,0],[.06,.26,0],.009,'mint');
      // Crossed strings lie inside the open frame, not on a solid oval face.
      const halfWidth=y=>Math.sqrt(Math.max(0,1-((y-.43)/.176)**2))*(.105+.021*(y-.43)/.176);
      for(let y=.29;y<=.57;y+=.04){const w=halfWidth(y);segment(parent,[-w,y,0],[w,y,0],.0025,'white');}
      for(let x=-.075;x<=.076;x+=.03){
        const ys=[];for(let y=.255;y<=.605;y+=.003)if(Math.abs(x)<=halfWidth(y))ys.push(y);
        if(ys.length)segment(parent,[x,ys[0],0],[x,ys[ys.length-1],0],.0025,'white');
      }
    }
    function render(s,animation){
      const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.6),w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}if(!w||!h)return;
      gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.clearColor(.055,.095,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      // Live gameplay keeps its fixed rear camera; pose review may use a close view.
      vp=mul(perspective(w/h),look(view.eye||[0,8.4,13.8],view.target||[0,1,-.3]));gl.uniformMatrix4fv(camera,false,new Float32Array(vp));
      box(0,-.12,0,6.6,.24,9.95,'wood');for(let x=-3;x<3.2;x+=.4)box(x,.002,0,.015,.006,9.75,'plank');
      box(0,2.3,-4.96,6.6,4.6,.15,'wall');
      // Cutaway side walls preserve visibility; sloping out lines show full bounds.
      box(-3.28,.65,0,.15,1.3,9.75,'wall');box(3.28,.65,0,.15,1.3,9.75,'wall');
      for(const y of[.48,1.78,4.6])box(0,y,-4.87,6.4,.035,.025,'red');
      box(0,.018,.585,6.4,.025,.04,'red');box(0,.018,2.73,.04,.025,4.29,'red');
      for(const x of[-2.4,2.4]){box(x,.02,1.385,1.6,.025,.04,'red');box(Math.sign(x)*1.6,.02,1.385,.04,.025,1.6,'red');}
      const lesson=SquashAcademy.stage(s),wt=lesson.wall,l=lesson.landing;
      box((wt.x0+wt.x1)/2-3.2,(wt.z0+wt.z1)/2,-4.855,wt.x1-wt.x0,wt.z1-wt.z0,.018,'mint');
      box((l.x0+l.x1)/2-3.2,.009,(l.y0+l.y1)/2-4.875,l.x1-l.x0,.008,l.y1-l.y0,'target');
      box(0,.028,.585,.55,.02,.08,'white');box(0,.028,.77,.08,.02,.38,'white');
      for(const x of[-3.22,3.22])for(let i=0;i<20;i++){const z=-4.875+i*9.75/19,ht=4.6-i*2.47/19;box(x,ht,z,.035,.035,.51,'red');}
      const aim=world(s.aim.x,0,s.aim.z);box(aim[0],aim[1],aim[2]+.035,.35,.025,.025,'dark');box(aim[0],aim[1],aim[2]+.035,.025,.35,.025,'dark');
      const b=world(s.ball.x,s.ball.y,s.ball.z);shape('sphere',I(),[b[0],.015,b[2]],[.065,.008,.065],'shadow');shape('sphere',I(),b,[BALL_RADIUS,BALL_RADIUS,BALL_RADIUS],'ball');
      character(SquashAcademy.coachState(s), null, 'coral');
      character(s, animation.gait, 'shirt');
    }
    function character(s, gait, shirt){
      // Hierarchical torso > shoulder > elbow > wrist pivots support later gestures.
      const pose = Motion.pose(s, gait);
      const f=pose.facing,yaw=Math.atan2(-f[0],-f[1]),p=world(s.player.x,s.player.y,0),rig=mul(translation(...p),ry(yaw));
      const torso=mul(rig,pose.body);
      const accent=shirt==='shirt'?'lime':'gold';
      draw('jersey',torso,shirt);draw('sash',torso,accent);draw('yoke',torso,'navy');
      shape('sphere',mul(rig,pose.pelvis),[0,.69,0],[.231,.12,.16],'navy');
      shape('sphere',torso,[0,1.37,0],[.087,.105,.083],'skin');
      shape('sphere',torso,[0,1.59,0],[.18,.222,.17],'skin');
      shape('sphere',torso,[0,1.72,.018],[.185,.138,.174],'hair');
      shape('cylinder',torso,[0,1.698,.009],[.182,.036,.172],accent);
      shape('sphere',torso,[-.072,1.739,-.101],[.108,.065,.088],'hair');
      for(const side of [-1,1]){
        shape('sphere',torso,[side*.174,1.59,.002],[.032,.047,.029],'skin');
        shape('sphere',torso,[side*.069,1.615,-.152],[.027,.027,.015],'white');
        shape('sphere',torso,[side*.067,1.614,-.164],[.014,.021,.009],'dark');
        segment(torso,[side*.044,1.655,-.155],[side*.091,1.659,-.143],.009,'hair');
        segment(torso,[0,1.505,-.157],[side*.036,1.513,-.156],.006,'hair');
      }
      shape('sphere',torso,[0,1.565,-.169],[.029,.033,.029],'skin');
      for(const arm of [pose,pose.left]){
        shape('sphere',rig,arm.shoulder,[.081,.082,.082],'navy');
        segment(rig,arm.shoulder,mix(arm.shoulder,arm.elbow,.39),.082,shirt);
        segment(rig,mix(arm.shoulder,arm.elbow,.39),mix(arm.shoulder,arm.elbow,.47),.081,accent);
      }
      for(const leg of pose.legs){
        segment(rig,leg.hip,leg.knee,.077,'skin');shape('sphere',rig,leg.knee,[.08,.08,.08],'skin');
        segment(rig,leg.knee,leg.ankle,.065,'skin');
        segment(rig,leg.hip,mix(leg.hip,leg.knee,.60),.10,'navy');
        segment(rig,mix(leg.knee,leg.ankle,.67),leg.ankle,.068,'white');
        const foot=mul(mul(rig,translation(...leg.ankle)),ry(leg.footTurn));
        shape('sphere',foot,[0,-.078,-.055],[.096,.019,.161],'gum');
        shape('sphere',foot,[0,-.056,-.085],[.096,.038,.132],'white');
        shape('sphere',foot,[0,-.033,.021],[.075,.058,.080],shirt);
        shape('sphere',foot,[0,-.018,-.053],[.067,.035,.077],shirt);
        for(const z of [-.071,-.043])segment(foot,[-.043,.001,z],[.043,.001,z-.012],.007,'white');
      }
      segment(rig,pose.shoulder,pose.elbow,.075,'skin');
      shape('sphere',rig,pose.elbow,[.078,.078,.078],'skin');
      segment(rig,pose.elbow,pose.hand,.055,'skin');
      shape('sphere',rig,pose.hand,[.06,.065,.055],'skin');
      racket(mul(rig,pose.racket));
      segment(rig,pose.left.shoulder,pose.left.elbow,.07,'skin');
      segment(rig,pose.left.elbow,pose.left.hand,.055,'skin');
    }
    function screenPoint(x,y,z){
      if (!vp) return null;
      const [cx,cy,,w]=transform(vp,[...world(x,y,z),1]);
      return {x:(1+cx/w)/2,y:(1-cy/w)/2};
    }
    return{render,screenPoint,aim:(u,v)=>vp?aimAt(vp,u,v):null};
  }
  const api={create,world,aimAt,mul,inverse,transform,look,perspective,BALL_RADIUS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AcademyRenderer=api;
})(globalThis);
