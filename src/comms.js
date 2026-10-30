// 地面通訊：依遊戲事件播放休士頓與飛行員的無線電對話，並顯示字幕
// 規則：同一時間只有一個人說話。新台詞一律排隊，只有迫降指令會中斷（先淡出、留空檔再開口）
import { GAME } from './layout.js';
import { LINES, CALLSIGN } from './commsLines.js';

// 事件對應的台詞（隨機挑一句，避開上一次）
const EVENTS = {
  start: ['start1', 'start2'],
  combat: ['start_combat'],
  low: ['low1', 'low2'],
  crit: ['crit'],
  hit: ['hit1', 'hit2', 'hit3'],
  level: ['level1', 'level2'],
  lap: ['lap1', 'lap2'],
  record: ['record'],
  meteor: ['meteor1', 'meteor2'],
  debris: ['debris'],
  shield: ['shield'],
  kill: ['kill1', 'kill2'],
  idle: ['idle1', 'idle2', 'idle3', 'idle4'],
  abort: ['abort'],
  chute: ['chute'],
  touchdown: ['touchdown'],
  splashdown: ['splashdown'],
};

// 4：迫降流程，可中斷；3：緊急，排最前面且不等休息；2：一般；1：閒聊，有人排隊就不講
const PRIORITY = { abort: 4, chute: 4, touchdown: 4, splashdown: 4, meteor: 3, crit: 3, idle: 1 };
const COOLDOWN = { hit: 25, low: 30, kill: 20, level: 25, shield: 15 }; // 秒，避免同類台詞太密集
const EXPIRES = { meteor: 3, crit: 5, hit: 5, shield: 4 }; // 秒，排隊太久就過時了，直接丟掉
const DEFAULT_EXPIRES = 8;

const now = () => performance.now() / 1000;
const rand = (a, b) => a + Math.random() * (b - a);

export class Comms {
  constructor(sfx, hud) {
    this.sfx = sfx;
    this.hud = hud;
    this.buffers = {};
    this.queue = [];
    this.delayed = [];
    this.cool = {};
    this.last = {};
    this.current = null;
    this.source = null;
    this.timer = 0;
    this.token = 0;
    this.blackout = false;
    this.quietUntil = 0;
    this.idleT = 30;
  }

  get busy() {
    return Boolean(this.current);
  }

  // 解碼語音檔，失敗回傳 null（只顯示字幕，不影響遊戲）
  _buffer(id) {
    if (!this.sfx.ctx) return Promise.resolve(null);
    if (!this.buffers[id]) {
      this.buffers[id] = fetch(`assets/voice/${id}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => (b ? this.sfx.ctx.decodeAudioData(b) : null))
        .catch(() => null);
    }
    return this.buffers[id];
  }

  // 預先載入語音，避免第一次播放時延遲
  async preload() {
    if (this.preloaded || !this.sfx.ctx) return;
    this.preloaded = true;
    const ids = Object.keys(LINES);
    const worker = async () => {
      while (ids.length) await this._buffer(ids.shift());
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  schedule(delay, name) {
    this.delayed.push({ t: delay, name });
  }

  event(name) {
    if (this.blackout) return;
    const t = now();
    if (this.cool[name] > t) return;
    if (COOLDOWN[name]) this.cool[name] = t + COOLDOWN[name];

    const pool = EVENTS[name];
    const options = pool.length > 1 ? pool.filter((id) => id !== this.last[name]) : pool;
    const id = options[Math.floor(Math.random() * options.length)];
    this.last[name] = id;

    const priority = PRIORITY[name] ?? 2;
    if (priority >= 4) {
      this._interrupt(id);
      return;
    }
    if (priority === 1 && (this.current || this.queue.length)) return;
    // 同等級以上已在排隊就不再加，隊伍最多一句，講話才不會一直接不完
    const waiting = this.queue[0];
    if (waiting && waiting.priority >= priority) return;
    this.queue = [{ id, priority, expires: t + (EXPIRES[name] ?? DEFAULT_EXPIRES) }];
  }

  // 迫降指令：淡出正在講的話，留一段空檔再開口，不會兩句疊在一起
  _interrupt(id) {
    const talking = Boolean(this.source);
    this.stop();
    this.current = id;
    if (talking) this.timer = setTimeout(() => this.play(id), 600);
    else this.play(id);
  }

  async play(id) {
    const line = LINES[id];
    if (!line) return;
    const token = ++this.token;
    const ground = line.who === 'houston';
    this.current = id;
    this.hud.comms(CALLSIGN[line.who], line.zh, line.en, ground);
    this.sfx.setRadio({ low: GAME.radioLow, high: GAME.radioHigh, drive: GAME.radioDrive, volume: GAME.commsVolume });
    this.sfx.radioStatic(GAME.radioNoise);
    if (ground) this.sfx.quindar(2525, GAME.quindarVolume); // 地面發話開始的提示音

    const buffer = await this._buffer(id);
    if (token !== this.token) return;
    const begin = () => {
      if (token !== this.token) return;
      if (buffer && this.sfx.ctx) {
        this.source = this.sfx.playRadio(buffer, () => this._finish(id, token));
      } else {
        this.timer = setTimeout(() => this._finish(id, token), line.en.length * 70); // 沒有音訊時依字數估時間
      }
    };
    this.timer = setTimeout(begin, ground ? 280 : 120);
  }

  _finish(id, token) {
    if (token !== this.token) return;
    const line = LINES[id];
    this.source = null;
    if (line.who === 'houston') this.sfx.quindar(2475, GAME.quindarVolume); // 地面發話結束的提示音
    this.sfx.radioStatic(0);
    this.hud.commsHide(1.2);

    // 緊急台詞優先於飛行員回覆；其餘先讓飛行員回完
    const urgent = this._pending(3);
    const next = urgent || line.reply;
    if (next) {
      this.current = next;
      this.timer = setTimeout(() => this.play(next), GAME.commsGap * 1000);
    } else {
      this.current = null;
      this.quietUntil = now() + GAME.commsRest; // 一段對話結束後先安靜一下
    }
  }

  // 取出還沒過時、等級足夠的排隊台詞
  _pending(minPriority) {
    const t = now();
    this.queue = this.queue.filter((q) => q.expires > t);
    const q = this.queue[0];
    if (!q || q.priority < minPriority) return null;
    this.queue.length = 0;
    return q.id;
  }

  stop() {
    this.token += 1;
    clearTimeout(this.timer);
    if (this.source) {
      this.sfx.stopRadio(this.source);
      this.source = null;
    }
    this.current = null;
    this.queue.length = 0;
    this.sfx.radioStatic(0);
    this.hud.commsHide(0);
  }

  // 重返大氣層的通訊黑障：切斷對話，只剩雜訊
  setBlackout(on) {
    if (on === this.blackout) return;
    if (on) {
      this.stop();
      this.sfx.setRadio({ low: GAME.radioLow, high: GAME.radioHigh, drive: GAME.radioDrive, volume: GAME.commsVolume });
      this.sfx.radioStatic(GAME.radioNoise * 3);
      this.hud.comms('RADIO BLACKOUT', '重返大氣層，通訊中斷…', 'Signal lost during re-entry', false);
    } else {
      this.sfx.radioStatic(0);
      this.hud.commsHide(0);
    }
    this.blackout = on;
  }

  reset() {
    this.stop();
    this.setBlackout(false);
    this.delayed.length = 0;
    this.cool = {};
    this.quietUntil = 0;
    this.idleT = rand(GAME.commsIdleMin, GAME.commsIdleMax);
  }

  // active：遊戲進行中才會有閒聊
  update(dt, active) {
    for (const d of this.delayed) d.t -= dt;
    const due = this.delayed.filter((d) => d.t <= 0);
    this.delayed = this.delayed.filter((d) => d.t > 0);
    due.forEach((d) => this.event(d.name));

    if (active) {
      this.idleT -= dt;
      if (this.idleT <= 0) {
        this.idleT = rand(GAME.commsIdleMin, GAME.commsIdleMax);
        this.event('idle');
      }
    }

    // 沒人說話時才從隊伍取下一句；緊急台詞不用等休息時間
    if (this.current || this.blackout) return;
    const id = this._pending(now() >= this.quietUntil ? 1 : 3);
    if (id) this.play(id);
  }
}

export const COMMS_LINE_IDS = Object.keys(LINES);
