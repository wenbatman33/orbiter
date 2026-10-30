// 音效：全部用 WebAudio 即時合成，不需要音檔
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // 需在使用者互動後呼叫（瀏覽器自動播放限制）
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._startEngine();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  _startEngine() {
    const c = this.ctx;
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 220;
    this.engFilter.Q.value = 3;
    this.engOsc = [46, 46.8].map((f) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(this.engFilter);
      o.start();
      return o;
    });
    this.engFilter.connect(this.engGain).connect(this.master);
  }

  // 無線電鏈路：語音 → 高通 → 低通 → 中頻峰值 → 削波 → 輸出，並混入靜電雜訊
  _radio() {
    if (this.rf) return this.rf;
    const c = this.ctx;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.Q.value = 0.7;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    const peak = c.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1700;
    peak.Q.value = 1;
    peak.gain.value = 6;
    const shaper = c.createWaveShaper();
    const out = c.createGain();
    hp.connect(lp).connect(peak).connect(shaper).connect(out).connect(this.master);

    const noise = c.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.loop = true;
    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.6;
    const noiseGain = c.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(out);
    noise.start();

    this.rf = { hp, lp, shaper, out, noiseGain, drive: null };
    return this.rf;
  }

  setRadio({ low, high, drive, volume }) {
    if (!this.ctx) return;
    const rf = this._radio();
    rf.hp.frequency.value = low;
    rf.lp.frequency.value = high;
    rf.out.gain.value = volume;
    if (rf.drive === drive) return;
    rf.drive = drive;
    const curve = new Float32Array(1024);
    const k = 1 + drive;
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * k) / Math.tanh(k);
    }
    rf.shaper.curve = curve;
  }

  playRadio(buffer, onEnded) {
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buffer;
    src.connect(gain).connect(this._radio().hp);
    src.onended = onEnded;
    src.start();
    return { src, gain };
  }

  // 中斷語音時快速淡出，避免爆音
  stopRadio({ src, gain }) {
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);
    try {
      src.stop(t + 0.14);
    } catch {
      // 已經播完
    }
  }

  radioStatic(level) {
    if (!this.ctx) return;
    this._radio().noiseGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.04);
  }

  // Quindar 提示音：Apollo 時代地面發話前後的短音（2525 / 2475 Hz）
  quindar(freq, vol) {
    if (!this.ctx || vol <= 0) return;
    const c = this.ctx, t = c.currentTime, dur = 0.25;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + dur - 0.005);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }


  // level：音量 0~1；pitch：速度 0~1
  engine(level, pitch) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(level * 0.08, t, 0.25);
    this.engFilter.frequency.setTargetAtTime(160 + pitch * 520, t, 0.3);
    this.engOsc.forEach((o, i) => o.frequency.setTargetAtTime(40 + pitch * 30 + i * 0.8, t, 0.3));
  }

  _tone({ f0, f1, dur, type = 'sine', vol = 0.2, delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise({ dur, vol = 0.3, freq = 1000, f1, type = 'lowpass', q = 0.8, delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  collect() {
    const p = 1 + Math.random() * 0.12;
    this._tone({ f0: 880 * p, f1: 1760 * p, dur: 0.12, vol: 0.16 });
    this._tone({ f0: 1320 * p, f1: 2200 * p, dur: 0.1, type: 'triangle', vol: 0.07, delay: 0.04 });
  }

  hit() {
    this._noise({ dur: 0.45, vol: 0.5, freq: 1400, f1: 180 });
    this._tone({ f0: 160, f1: 40, dur: 0.35, type: 'square', vol: 0.12 });
  }

  laser() {
    this._tone({ f0: 1700, f1: 360, dur: 0.09, type: 'square', vol: 0.04 });
  }

  ping() {
    this._tone({ f0: 2400, f1: 1600, dur: 0.05, type: 'triangle', vol: 0.06 });
  }

  boom() {
    this._noise({ dur: 0.7, vol: 0.45, freq: 1000, f1: 110 });
    this._tone({ f0: 95, f1: 30, dur: 0.5, vol: 0.28 });
  }

  shield() {
    this._tone({ f0: 300, f1: 1200, dur: 0.45, vol: 0.14 });
    this._tone({ f0: 450, f1: 1800, dur: 0.45, type: 'triangle', vol: 0.06, delay: 0.05 });
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone({ f0: f, dur: 0.2, type: 'triangle', vol: 0.11, delay: i * 0.08 }));
  }

  lap() {
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this._tone({ f0: f, dur: 0.26, type: 'triangle', vol: 0.11, delay: i * 0.07 }));
  }

  warn() {
    this._tone({ f0: 880, dur: 0.09, type: 'square', vol: 0.06 });
    this._tone({ f0: 880, dur: 0.09, type: 'square', vol: 0.06, delay: 0.16 });
  }

  start() {
    this._noise({ dur: 0.8, vol: 0.25, freq: 300, f1: 3000, type: 'bandpass', q: 2 });
  }

  // 重返大氣層的低頻風切聲（持續 dur 秒，可用 stopRoar 提早結束）
  reentry(dur) {
    if (!this.ctx) return;
    this.stopRoar();
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf;
    src.loop = true;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(260, t);
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.6);
    f.frequency.linearRampToValueAtTime(420, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + dur * 0.4);
    g.gain.setValueAtTime(0.13, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
    src.onended = () => {
      if (this.roar === src) this.roar = null;
    };
    this.roar = src;
  }

  stopRoar() {
    if (!this.roar) return;
    try {
      this.roar.stop();
    } catch {
      // 已經停止
    }
    this.roar = null;
  }

  chute() {
    this._noise({ dur: 0.5, vol: 0.11, freq: 500, f1: 2000, type: 'bandpass', q: 1 });
    this._tone({ f0: 180, f1: 90, dur: 0.25, type: 'triangle', vol: 0.05 });
  }

  touchdown(ocean) {
    if (ocean) {
      this._noise({ dur: 1.5, vol: 0.14, freq: 2400, f1: 380 });
    } else {
      this._noise({ dur: 0.55, vol: 0.13, freq: 900, f1: 120 });
      this._tone({ f0: 110, f1: 38, dur: 0.4, vol: 0.1 });
    }
  }

  click() {
    this._tone({ f0: 1200, f1: 900, dur: 0.05, type: 'triangle', vol: 0.06 });
  }
}
