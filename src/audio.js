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

  gameOver() {
    this._tone({ f0: 440, f1: 55, dur: 1.4, type: 'sawtooth', vol: 0.1 });
    this._noise({ dur: 1.6, vol: 0.2, freq: 2400, f1: 200 });
  }

  click() {
    this._tone({ f0: 1200, f1: 900, dur: 0.05, type: 'triangle', vol: 0.06 });
  }
}
