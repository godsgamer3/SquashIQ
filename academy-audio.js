// Procedural mono samples, rendered at the device rate when a court event occurs.
const AcademyAudio = (() => {
  let context;
  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) context = new Audio();
    if (context.state !== 'running') context.resume().catch(()=>{});
  }

  function swing(samples, rate, force) {
    let low = 0, broad = 0;
    for (let i=0; i<samples.length; i++) {
      const u=i/samples.length;
      // Broad rushing air swells before contact, brightens, then falls away.
      const arc=Math.sin(Math.PI*u)**1.5;
      const cutoff=1050+(1700+2000*force)*arc;
      const noise=Math.random()*2-1;
      broad+=(1-Math.exp(-2*Math.PI*cutoff/rate))*(noise-broad);
      low+=(1-Math.exp(-2*Math.PI*450/rate))*(noise-low);
      samples[i]=(broad-low)*arc*(.034+.096*force);
    }
  }

  // String-bed snap over a compressed rubber pulse. The fast pitch fall
  // gives the impact weight while the short midrange burst cuts through.
  function racketPop(samples,rate,force) {
    const level=.24+.70*force;
    let phase=0, noise=0;
    for(let i=0;i<samples.length;i++){
      const t=i/rate;
      phase+=2*Math.PI*(175+55*force+(300+90*force)*Math.exp(-t/.008))/rate;
      noise+=(1-Math.exp(-2*Math.PI*5200/rate))*(Math.random()*2-1-noise);
      const body=Math.sin(phase)*Math.exp(-t/.026);
      const strings=(.38*Math.sin(phase*2.73)+.23*Math.sin(phase*4.41))*Math.exp(-t/.017);
      const snap=noise*(.60+.42*force)*Math.exp(-t/.009);
      const attack=1-Math.exp(-t/.00055);
      samples[i]=level*Math.tanh(1.55*attack*(body+strings+snap));
    }
  }

  // Short pressure pulses and filtered noise give each contact a soft-edged
  // thump. Only the front wall gets distinct early court reflections.
  const contacts={
    front: {cutoff:2000, body:128, decay:.016, snap:.74, reflection:.24},
    floor: {cutoff:1350, body:154, decay:.012, snap:.59, reflection:0}
  };
  function impact(samples, rate, force, surface) {
    const {cutoff,body,decay,snap,reflection}=surface;
    let filtered=0;
    const level=.18+.69*force;
    const delay=Math.round(.022*rate);
    for (let i=0;i<samples.length;i++) {
      const t=i/rate;
      const edge=1-Math.exp(-t/.0008);
      const band=cutoff*(.7+.4*force)*Math.exp(-t/.021)+240;
      filtered+=(1-Math.exp(-2*Math.PI*band/rate))*((Math.random()*2-1)-filtered);
      const pulse=Math.sin(2*Math.PI*body*t)*Math.exp(-t/decay);
      samples[i]=level*edge*(.63*pulse+snap*filtered*Math.exp(-t/.011));
      if(reflection && i>=delay) samples[i]+=reflection*samples[i-delay];
    }
  }

  // 성공은 밝게 올라가고, 재시도는 부드러운 두 음으로 다음 공을 유도합니다.
  const cues={
    success:[[0,880,.16],[.085,1318.5,.26]],
    retry:[[0,587.3,.12],[.09,659.3,.16]],
    clear:[[0,659.3,.20],[.12,830.6,.20],[.24,987.8,.24],[.38,1318.5,.43]]
  };
  function chime(samples,rate,notes) {
    for(const [start,frequency,length] of notes){
      const offset=Math.round(start*rate);
      for(let i=0;i<length*rate && offset+i<samples.length;i++){
        const t=i/rate,phase=2*Math.PI*frequency*t;
        const envelope=(1-Math.exp(-t/.004))*Math.exp(-t/(length*.24));
        samples[offset+i]+=.22*envelope*(Math.sin(phase)+.24*Math.sin(phase*2));
      }
    }
  }
  function play(kind,strength=1) {
    if (!context || context.state==='closed') return;
    const force=Math.min(1,Math.max(0,strength));
    const isSwing=kind==='swing';
    if (!isSwing && kind!=='hit' && !contacts[kind] && !cues[kind]) return;
    const duration=cues[kind] ? 1 : isSwing ? .125+.045*force : .14;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
    const samples=buffer.getChannelData(0);
    if(cues[kind]) chime(samples,context.sampleRate,cues[kind]);
    else if (isSwing) swing(samples,context.sampleRate,force);
    else if (kind==='hit') racketPop(samples,context.sampleRate,force);
    else impact(samples,context.sampleRate,force,contacts[kind]);
    const source=context.createBufferSource();
    source.buffer=buffer;
    const gain=context.createGain();
    gain.gain.value=AcademyBalance.volume[kind];
    source.connect(gain); gain.connect(context.destination);
    source.onended=()=>{source.disconnect(); gain.disconnect();};
    source.start();
  }
  return {unlock,play};
})();
