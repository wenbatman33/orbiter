// 排行榜前端：開局取得憑證、結算上傳成績、顯示榜單
// 所有連線失敗都只影響排行榜，遊戲本身照常進行
const NAME_KEY = 'orbiter.pilotName';
const LIST_SIZE = 10;

const ERRORS = {
  rate_limited: '上傳太頻繁，請稍後再試',
  duplicate: '這局已經上傳過了',
  impossible_score: '成績驗證失敗，無法上傳',
  bad_time: '成績驗證失敗，無法上傳',
  bad_score: '成績驗證失敗，無法上傳',
  bad_token: '這局的憑證已失效，無法上傳',
};
const UNAVAILABLE = '排行榜暫時無法使用';

const $ = (id) => document.getElementById(id);
const fmt = (km) => Math.floor(km).toLocaleString('en-US');

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}
function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // 無痕模式等情況寫不進去就略過
  }
}

export class Leaderboard {
  constructor() {
    this.token = null;
    this.run = 0;
    this.offer = null;
    this.mode = 'cruise';
    this.highlight = null;
    this.loadId = 0;

    $('btn-board').addEventListener('click', () => this.open());
    $('btn-board-over').addEventListener('click', () => this.open());
    $('board-close').addEventListener('click', () => this.close());
    document.querySelectorAll('.board-tab').forEach((t) => t.addEventListener('click', () => this.open(t.dataset.mode)));
    $('score-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  // 開局向伺服器領憑證；拿不到就只是這局不能上傳
  async startRun(mode) {
    const run = ++this.run;
    this.token = null;
    this.mode = mode;
    this.clearOffer();
    try {
      const res = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ mode }) });
      if (res.ok && run === this.run) this.token = (await res.json()).token;
    } catch {
      // 離線時略過
    }
  }

  clearOffer() {
    this.offer = null;
    $('score-form').classList.add('hidden');
    $('score-status').textContent = '';
  }

  // 結算時顯示上傳表單
  offerSubmit({ km, kills }) {
    this.offer = { km: Math.floor(km), kills };
    if (!this.token) {
      $('score-status').textContent = `${UNAVAILABLE}，這局成績不會上傳`;
      return;
    }
    $('score-name').value = loadName();
    $('score-submit').disabled = false;
    $('score-form').classList.remove('hidden');
  }

  async submit() {
    if (!this.offer || !this.token) return;
    const name = $('score-name').value;
    const button = $('score-submit');
    const status = $('score-status');
    button.disabled = true;
    status.textContent = '上傳中…';
    try {
      const res = await fetch('/api/scores', { method: 'POST', body: JSON.stringify({ token: this.token, name, ...this.offer }) });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = ERRORS[data.error] || UNAVAILABLE;
        button.disabled = data.error !== 'rate_limited' && data.error !== 'unavailable';
        return;
      }
      saveName(data.name);
      this.highlight = { name: data.name, km: this.offer.km };
      this.token = null;
      $('score-form').classList.add('hidden');
      status.textContent = data.rank ? `上傳成功！目前第 ${data.rank} 名` : '上傳成功！';
      this.open(this.mode, data.scores);
    } catch {
      status.textContent = UNAVAILABLE;
      button.disabled = false;
    }
  }

  // scores：已有資料時直接顯示，不必再查詢一次
  async open(mode = this.mode, scores = null) {
    this.mode = mode;
    $('app').classList.add('board-open');
    $('screen-board').classList.remove('hidden');
    document.querySelectorAll('.board-tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === mode));
    if (scores) {
      this._render(scores);
      return;
    }
    const id = ++this.loadId;
    this._message('讀取中…');
    try {
      const res = await fetch(`/api/scores?mode=${mode}&limit=${LIST_SIZE}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (id === this.loadId) this._render(data.scores);
    } catch {
      if (id === this.loadId) this._message(UNAVAILABLE);
    }
  }

  close() {
    $('app').classList.remove('board-open');
    $('screen-board').classList.add('hidden');
  }

  _message(text) {
    $('board-list').replaceChildren();
    $('board-status').textContent = text;
  }

  _render(scores) {
    if (!scores.length) {
      this._message('還沒有紀錄，來當第一名吧');
      return;
    }
    $('board-status').textContent = '';
    const rows = scores.map((s, i) => {
      const li = document.createElement('li');
      const add = (cls, text) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text; // 名字一律當純文字，避免被插入語法
        li.appendChild(span);
      };
      add('b-rank', String(i + 1));
      add('b-name', s.name);
      add('b-km', `${fmt(s.km)} km`);
      if (i < 3) li.classList.add('top');
      if (this.highlight && s.name === this.highlight.name && s.km === this.highlight.km) li.classList.add('me');
      return li;
    });
    $('board-list').replaceChildren(...rows);
  }
}
