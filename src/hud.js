// HUD：DOM 介面（數值、能量條、提示、橫幅、標題 / 結算畫面）
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.app = $('app');
    this.hud = $('hud');
    this.els = {
      stats: $('hud-stats'),
      energy: $('hud-energy'),
      controls: $('hud-controls'),
      hint: $('hud-hint'),
      banner: $('hud-banner'),
      title: $('screen-title'),
      gameover: $('screen-over'),
    };
    this.cache = {};
    this.timers = {};
  }

  // 依版面設定擺放每個 HUD 元件（x / y 為百分比，ax / ay 為錨點）
  // ui：依畫面尺寸算出的整體縮放（見 layout 的 ui.refW / refH）
  applyLayout(hudL, ui = 1) {
    this.app.style.setProperty('--ui', ui);
    for (const [key, c] of Object.entries(hudL)) {
      const el = this.els[key];
      if (!el) continue;
      el.style.left = `${c.x}%`;
      el.style.top = `${c.y}%`;
      el.style.transformOrigin = `${c.ax * 100}% ${c.ay * 100}%`;
      el.style.transform = `translate(${-c.ax * 100}%, ${-c.ay * 100}%) scale(${c.scale * ui})`;
      el.style.fontSize = `${c.fontSize}px`;
      el.style.color = c.color;
      el.style.opacity = c.opacity;
    }
  }

  setAccent(accent, warn) {
    this.app.style.setProperty('--accent', accent);
    this.app.style.setProperty('--warn', warn);
  }

  _text(id, value) {
    if (this.cache[id] === value) return;
    this.cache[id] = value;
    $(id).textContent = value;
  }

  // 數字逐字放進等寬格：Orbitron 的數字寬度不一（1 不到 0 的一半），直接寫字整排會跟著跳
  _digits(id, value) {
    if (this.cache[id] === value) return;
    this.cache[id] = value;
    const el = $(id);
    if (!el.firstElementChild) el.textContent = '';
    const chars = [...value];
    while (el.children.length > chars.length) el.lastElementChild.remove();
    while (el.children.length < chars.length) el.appendChild(document.createElement('span'));
    chars.forEach((ch, i) => {
      const cell = el.children[i];
      if (cell.textContent === ch) return;
      cell.textContent = ch;
      cell.className = ch >= '0' && ch <= '9' ? 'dg' : 'dp';
    });
  }

  setStats({ km, laps, level, kills }) {
    this._digits('distance', Math.floor(km).toLocaleString('en-US'));
    this._digits('laps', laps.toFixed(2));
    this._digits('level', String(level).padStart(2, '0'));
    this._digits('kills', String(kills));
  }

  setEnergy(v, max) {
    const pct = Math.max(0, Math.min(1, v / max));
    const w = `${(pct * 100).toFixed(1)}%`;
    if (this.cache.energyW !== w) {
      this.cache.energyW = w;
      $('energy-fill').style.width = w;
    }
    this._digits('energy-num', String(Math.ceil(pct * 100)));
    this.els.energy.classList.toggle('energy-low', pct < 0.25);
  }

  setShield(t) {
    this._text('shield-timer', t > 0 ? `SHIELD 護盾 ${t.toFixed(1)}s` : '');
  }

  setMode(mode) {
    this.app.classList.toggle('mode-combat', mode === 'combat');
  }

  showHud(on) {
    this.hud.classList.toggle('hidden', !on);
    $('btn-pause').classList.toggle('hidden', !on);
  }

  showScreen(name) {
    this.els.title.classList.toggle('hidden', name !== 'title');
    this.els.gameover.classList.toggle('hidden', name !== 'gameover');
  }

  _fade(key, inner, dur) {
    clearTimeout(this.timers[key]);
    inner.classList.add('show');
    if (dur > 0) this.timers[key] = setTimeout(() => inner.classList.remove('show'), dur * 1000);
  }

  hint(html, dur) {
    const inner = this.els.hint.firstElementChild;
    if (!html) {
      inner.classList.remove('show');
      return;
    }
    inner.innerHTML = html;
    this._fade('hint', inner, dur);
  }

  banner(main, sub, dur) {
    $('banner-main').textContent = main;
    $('banner-sub').textContent = sub;
    const inner = this.els.banner.firstElementChild;
    inner.classList.remove('show');
    void inner.offsetWidth; // 重新觸發動畫
    this._fade('banner', inner, dur);
  }

  flash() {
    const el = $('flash');
    el.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on')));
  }

  // 流星預警：畫面右緣，y 為 0~100%
  warn(yPct, dur) {
    const el = document.createElement('div');
    el.className = 'warn';
    el.textContent = '⚠ 流星';
    el.style.top = `${Math.max(6, Math.min(94, yPct))}%`;
    this.app.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000);
  }

  setBest(best) {
    const fmt = (v) => (v > 0 ? `最佳 ${Math.floor(v).toLocaleString('en-US')} km` : '');
    $('best-cruise').textContent = fmt(best.cruise);
    $('best-combat').textContent = fmt(best.combat);
  }

  showGameOver({ km, laps, kills, best, isBest, mode }) {
    $('over-km').textContent = Math.floor(km).toLocaleString('en-US');
    $('over-laps').textContent = laps.toFixed(2);
    $('over-kills').textContent = String(kills);
    $('over-best').textContent = Math.floor(best).toLocaleString('en-US');
    $('over-kills-wrap').classList.toggle('hidden', mode !== 'combat');
    $('over-kicker').textContent = isBest ? 'NEW RECORD · 新紀錄' : 'SIGNAL LOST · 訊號中斷';
    $('over-main').textContent = isBest ? '刷新最佳航程！' : '墜入大氣層';
    this.els.gameover.classList.toggle('is-best', isBest);
    this.showScreen('gameover');
  }

  showPause(on) {
    $('screen-pause').classList.toggle('hidden', !on);
  }
}
