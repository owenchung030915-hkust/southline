export function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master;
  let sfx;
  let music;
  let noiseBuf = null;
  let engine = null;
  let engineGain = null;
  let engineFilter = null;
  let nextNote = 0;
  let step = 0;
  const scale = [55, 65.41, 73.42, 82.41, 98, 73.42, 65.41, 82.41];
  const pattern = [0, 0, 3, 4, 0, 5, 3, 2];

  function ensure() {
    if (ctx) return true;
    if (!Ctx) return false;
    ctx = new Ctx();
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 48;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 180;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(sfx);
    engine.start();
    return true;
  }

  function envGain(target, peak, attack, hold, release) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(target);
    return g;
  }

  function tone(freq, dur, type, peak, dest = sfx, slide = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    const g = envGain(dest, peak, 0.01, dur * 0.35, dur * 0.65);
    o.connect(g);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noiseHit(dur, peak, freq, q, dest = sfx) {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = envGain(dest, peak, 0.005, dur * 0.2, dur * 0.8);
    src.connect(filter);
    filter.connect(g);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    resume() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    apply(audio, duck = 1) {
      if (!ensure()) return;
      const m = audio.mute ? 0 : audio.master;
      master.gain.value = m;
      sfx.gain.value = audio.sfx;
      music.gain.value = audio.music * duck;
    },
    swing() {
      noiseHit(0.12, 0.18, 900, 0.7);
    },
    hit(heavy) {
      noiseHit(heavy ? 0.22 : 0.14, heavy ? 0.45 : 0.32, heavy ? 180 : 240, 0.8);
      tone(heavy ? 90 : 140, heavy ? 0.18 : 0.1, 'sine', heavy ? 0.28 : 0.16, sfx, heavy ? -50 : -70);
    },
    block() {
      tone(420, 0.08, 'square', 0.08);
      noiseHit(0.08, 0.2, 1400, 2);
    },
    hurt() {
      tone(110, 0.2, 'sawtooth', 0.12, sfx, -60);
    },
    foot() {
      noiseHit(0.05, 0.08, 180, 0.6);
    },
    dodge() {
      noiseHit(0.16, 0.16, 600, 0.5);
    },
    ko() {
      tone(70, 0.4, 'sine', 0.3, sfx, -40);
      noiseHit(0.25, 0.3, 120, 0.5);
    },
    heal() {
      tone(520, 0.12, 'sine', 0.1);
      tone(780, 0.16, 'sine', 0.08);
    },
    honk() {
      tone(340, 0.18, 'square', 0.08);
      tone(220, 0.22, 'square', 0.06);
    },
    ui() {
      tone(660, 0.06, 'sine', 0.06);
    },
    wasted() {
      tone(90, 0.6, 'sawtooth', 0.12, sfx, -70);
    },
    engine(speed) {
      if (!engine) return;
      const s = Math.abs(speed);
      engineGain.gain.value = Math.min(0.18, s * 0.012);
      engine.frequency.value = 42 + s * 7;
      engineFilter.frequency.value = 160 + s * 40;
    },
    engineOff() {
      if (engineGain) engineGain.gain.value = 0;
    },
    music(heat, enabled) {
      if (!ctx || !enabled) return;
      const now = ctx.currentTime;
      if (now < nextNote) return;
      const interval = heat >= 3 ? 0.3 : 0.42;
      const n = pattern[step % pattern.length];
      const freq = scale[n] * (heat >= 4 && step % 4 === 0 ? 2 : 1);
      const o = ctx.createOscillator();
      o.type = heat >= 2 ? 'triangle' : 'sine';
      o.frequency.value = freq;
      const g = envGain(music, heat >= 3 ? 0.22 : 0.14, 0.02, interval * 0.45, interval * 0.5);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420 + heat * 80;
      o.connect(f);
      f.connect(g);
      o.start();
      o.stop(now + interval + 0.05);
      if (heat >= 2 && step % 2 === 0) noiseHit(0.04, 0.05, 2400, 0.6, music);
      step += 1;
      nextNote = now + interval;
    },
  };
}
