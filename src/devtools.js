// DEV 微調工具：滑桿 / 顏色 / 直接拖曳 3D 物件與 HUD / 狀態觸發 / 匯出 JSON / 寫回 layout.js
import GUI from 'lil-gui';
import * as THREE from 'three';
import { saveOverrides, clearOverrides } from './overrides.js';

// 欄位中文名稱
const LABELS = {
  ui: '🔠 UI 縮放基準', refW: '基準寬 px', refH: '基準高 px', min: '最小縮放', max: '最大縮放',
  camera: '📷 相機', earth: '🌍 地球', ship: '🚀 太空船', sun: '☀️ 太陽', moon: '🌙 月球', space: '🌌 太空', fx: '✨ 後製特效', hud: '🖥 HUD',
  stats: '數值列 stats', energy: '能量條 energy', controls: '按鈕 controls', hint: '提示 hint', banner: '橫幅 banner', title: '標題畫面 title', gameover: '結算畫面 gameover', comms: '通訊字幕 comms', board: '排行榜 board',
  fov: '視角 FOV', lookX: '注視點 X', lookY: '注視點 Y', follow: '跟隨太空船比例',
  radius: '半徑', cloudAlt: '雲層高度', atmoScale: '大氣層厚度', atmoIntensity: '大氣光暈強度', hazeIntensity: '地表薄霧強度',
  altMin: '最低高度', altMax: '最高高度', rangeX: '左右活動範圍', scale: '縮放', tilt: '傾斜幅度', touchOffsetY: '觸控上移 px', titleX: '標題畫面 X', titleAlt: '標題畫面高度', landX: '迫降著陸點 X',
  size: '光暈大小', intensity: '光照強度', starSize: '星星大小', starOpacity: '星星亮度', nebulaOpacity: '星雲濃度', ambient: '環境光',
  bloomStrength: '泛光強度', bloomRadius: '泛光半徑', bloomThreshold: '泛光門檻', exposure: '曝光',
  ax: '錨點 X (0 左 / 1 右)', ay: '錨點 Y (0 上 / 1 下)', fontSize: '字級 px', color: '顏色', opacity: '透明度',
  speedStart: '起始角速度', speedPerLevel: '每級加速', speedMax: '最高角速度', levelEvery: '升級間隔（弧度）',
  energyMax: '能量上限', energyDrain: '每秒耗能', drainPerLevel: '每級加耗', cellEnergy: '晶體補能', lapBonus: '繞完一圈補能', hitDamage: '受擊扣能',
  cellEvery: '晶體串間隔 s', hazardEvery: '障礙間隔 s', hazardRamp: '障礙間隔遞減率', hazardMin: '障礙最短間隔', combatHazardMul: '戰鬥模式障礙倍率',
  debrisFromLevel: '太空垃圾出現等級', meteorFromLevel: '流星出現等級', meteorChance: '流星機率', shieldChance: '護盾機率', shieldTime: '護盾秒數',
  fireRate: '射擊間隔 s', bulletSpeed: '雷射速度', asteroidHp: '隕石耐久', dropChance: '擊碎掉落晶體機率',
  shipFollow: '操控跟手度', invulnTime: '受擊無敵秒數', bannerTime: '橫幅停留 s', hintTime: '提示停留 s',
  flashTime: '受擊閃紅 s', shake: '鏡頭震動', warnTime: '流星預警 s',
  landingTime: '迫降總時間 s', reentryAt: '重返大氣層時間點（比例）', chuteAt: '開傘時間點（比例）', landedDelay: '著陸後到結算 s',
  commsVolume: '通訊音量', commsGap: '對答間隔 s', commsRest: '對話後休息 s', commsIdleMin: '閒聊最短間隔 s', commsIdleMax: '閒聊最長間隔 s',
  radioLow: '無線電高通 Hz', radioHigh: '無線電低通 Hz', radioDrive: '無線電失真', radioNoise: '靜電雜訊', quindarVolume: '提示音音量',
  bgColor: '背景色', ambientColor: '環境光色', sunColor: '陽光色', atmoColor: '大氣色', moonColor: '月球色',
  earthSeed: '地形種子', seaLevel: '海平面', deepOcean: '深海', ocean: '海洋', shallow: '淺海', sand: '沙灘', grass: '草原', forest: '森林', rock: '岩地', snow: '冰雪', cloud: '雲',
  hull: '機身', accent: '機翼 / 色帶', glass: '座艙', flame: '尾焰', cell: '能量晶體', asteroid: '隕石', debris: '太空垃圾', panel: '太陽能板',
  meteor: '流星', shield: '護盾', laser: '雷射', hudAccent: 'HUD 主色', hudWarn: 'HUD 警示色',
};

// 依路徑決定滑桿範圍 [min, max, step]
const RANGES = {
  'ui.refW': [200, 3000, 1], 'ui.refH': [200, 3000, 1], 'ui.min': [0.1, 2, 0.01], 'ui.max': [0.5, 4, 0.01],
  'camera.fov': [20, 100, 0.5], 'camera.x': [-800, 800, 1], 'camera.y': [-400, 1000, 1], 'camera.z': [60, 2500, 1],
  'camera.lookX': [-800, 800, 1], 'camera.lookY': [-400, 1000, 1], 'camera.follow': [0, 0.6, 0.01],
  'earth.x': [-1500, 1500, 1], 'earth.y': [-3000, 300, 1], 'earth.radius': [150, 3000, 1], 'earth.cloudAlt': [0, 80, 0.5],
  'earth.atmoScale': [1.01, 1.5, 0.005], 'earth.atmoIntensity': [0, 4, 0.05], 'earth.hazeIntensity': [0, 3, 0.05],
  'ship.x': [-600, 600, 1], 'ship.altMin': [0, 500, 1], 'ship.altMax': [0, 900, 1], 'ship.rangeX': [0, 500, 1],
  'ship.scale': [0.2, 4, 0.01], 'ship.tilt': [0, 3, 0.05], 'ship.touchOffsetY': [0, 250, 1], 'ship.titleX': [-600, 600, 1], 'ship.titleAlt': [0, 900, 1], 'ship.landX': [-600, 600, 1],
  'sun.x': [-5000, 5000, 1], 'sun.y': [-3000, 5000, 1], 'sun.z': [-6000, 500, 1], 'sun.size': [0, 3000, 1], 'sun.intensity': [0, 8, 0.05],
  'moon.x': [-5000, 5000, 1], 'moon.y': [-3000, 5000, 1], 'moon.z': [-6000, 500, 1], 'moon.radius': [5, 500, 1],
  'space.starSize': [0.2, 6, 0.1], 'space.starOpacity': [0, 1, 0.01], 'space.nebulaOpacity': [0, 2, 0.01], 'space.ambient': [0, 3, 0.01],
  'fx.bloomStrength': [0, 3, 0.01], 'fx.bloomRadius': [0, 1.5, 0.01], 'fx.bloomThreshold': [0, 1.5, 0.01], 'fx.exposure': [0.2, 3, 0.01],
  x: [0, 100, 0.1], y: [0, 100, 0.1], ax: [0, 1, 0.5], ay: [0, 1, 0.5], scale: [0.3, 3, 0.01], fontSize: [6, 80, 1], opacity: [0, 1, 0.01],
  earthSeed: [0, 50, 1], seaLevel: [0.4, 0.65, 0.005],
  debrisFromLevel: [1, 20, 1], meteorFromLevel: [1, 20, 1], asteroidHp: [1, 10, 1], hazardRamp: [0.6, 1, 0.01],
  meteorChance: [0, 1, 0.01], shieldChance: [0, 1, 0.01], dropChance: [0, 1, 0.01], combatHazardMul: [0.2, 2, 0.01],
  landingTime: [4, 30, 0.5], reentryAt: [0, 1, 0.01], chuteAt: [0, 1, 0.01], landedDelay: [0, 6, 0.1],
  commsVolume: [0, 1, 0.005], commsGap: [0, 3, 0.05], commsRest: [0, 20, 0.5], commsIdleMin: [5, 120, 1], commsIdleMax: [5, 180, 1],
  radioLow: [100, 1000, 10], radioHigh: [1000, 8000, 50], radioDrive: [0, 20, 0.1], radioNoise: [0, 0.5, 0.005], quindarVolume: [0, 0.2, 0.002],
};

function rangeFor(path, key, val) {
  if (RANGES[path]) return RANGES[path];
  if (path.startsWith('hud.') && RANGES[key]) return RANGES[key];
  if (RANGES[key]) return RANGES[key];
  const max = Math.max(1, Math.abs(val) * 4);
  return [0, max, val < 1 ? 0.005 : val < 10 ? 0.05 : 1];
}

function addObject(folder, obj, path, onChange) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const p = path ? `${path}.${key}` : key;
    const name = LABELS[key] || key;
    if (val && typeof val === 'object') {
      const sub = folder.addFolder(name);
      addObject(sub, val, p, onChange);
      sub.close();
    } else if (typeof val === 'string' && val.startsWith('#')) {
      folder.addColor(obj, key).name(name).onChange(onChange);
    } else if (typeof val === 'number') {
      const [mn, mx, st] = rangeFor(p.replace(/^hud\.\w+\./, 'hud.'), key, val);
      const c = folder.add(obj, key, mn, mx, st).name(name);
      // 重建地形較耗時，放開滑桿才套用
      if (key === 'seaLevel' || key === 'earthSeed') c.onFinishChange(onChange);
      else c.onChange(onChange);
    } else if (typeof val === 'boolean') {
      folder.add(obj, key).name(name).onChange(onChange);
    }
  }
}

// 數字四捨五入到小數 3 位，匯出比較乾淨
const tidy = (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);

export function createDevTools(api) {
  const { LAYOUTS, GAME, THEME, S, camera, canvas, app } = api;
  let active = false;
  let saveTimer = 0;

  const ctrl = {
    editLayout: api.getLayoutKey(),
    preview: 'auto',
    pause: true,
    timeScale: 1,
    steer: false,
    god: false,
    showAllHud: false,
    status: '',
  };

  const gui = new GUI({ title: '🛠 DEV 微調工具（D 開關）', width: 330 });
  gui.hide();

  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveOverrides({ LAYOUTS, GAME, THEME }), 300);
  };
  const refresh = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());
  const onLayoutChange = () => {
    api.applyLayout();
    scheduleSave();
  };
  const onThemeChange = () => {
    api.applyTheme();
    scheduleSave();
  };

  // ── 頂部：狀態 / 版面切換 ──
  const statusCtrl = gui.add(ctrl, 'status').name('狀態').disable();
  gui.add(ctrl, 'preview', { '自動（依視窗比例）': 'auto', 'PC 桌機': 'pc', 'Tablet 平板': 'tablet', 'Mobile 手機': 'mobile' })
    .name('預覽裝置')
    .onChange((v) => {
      api.setForcedLayout(v);
      if (v !== 'auto') {
        ctrl.editLayout = v;
        buildLayoutFolder();
      }
      refresh();
    });
  gui.add(ctrl, 'editLayout', { PC: 'pc', Tablet: 'tablet', Mobile: 'mobile' }).name('編輯哪一組版面').onChange(() => buildLayoutFolder());

  // ── 控制 ──
  const fCtrl = gui.addFolder('⏯ 控制');
  fCtrl.add(ctrl, 'pause').name('暫停遊戲');
  fCtrl.add(ctrl, 'timeScale', 0, 3, 0.05).name('時間倍率').onChange((v) => (S.timeScale = v));
  fCtrl.add(ctrl, 'steer').name('滑鼠操控太空船');
  fCtrl.add(ctrl, 'god').name('無敵（不扣能量）').onChange((v) => (S.god = v));
  fCtrl.add(ctrl, 'showAllHud').name('顯示全部 HUD 元件').onChange((v) => document.body.classList.toggle('dev-show-all', v));

  // ── 狀態觸發 ──
  const T = api.triggers;
  const fTrig = gui.addFolder('⚡ 狀態觸發');
  const trig = {
    '▶ 開始巡航模式': T.cruise, '▶ 開始戰鬥模式': T.combat, '🏠 回標題畫面': T.title,
    '⬆ 升級（LEVEL UP）': T.levelUp, '🌍 完成一圈': T.lap, '💥 受擊': T.hit, '🛡 啟動護盾': T.shield,
    '💎 生成能量晶體串': T.cells, '🪨 生成隕石群': T.asteroids, '🛰 生成太空垃圾': T.debris, '☄️ 生成流星（含預警）': T.meteor, '🟢 生成護盾道具': T.shieldItem,
    '🔋 能量全滿': T.fillEnergy, '🪫 能量剩 15%': T.lowEnergy, '🪂 緊急迫降': T.landing, '🏁 直接結算畫面': T.gameOver, '🏆 開啟排行榜': T.board,
  };
  for (const name of Object.keys(trig)) fTrig.add(trig, name);
  fTrig.close();

  // ── 地面通訊 ──
  const fComms = gui.addFolder('📻 地面通訊');
  const commsCtrl = { line: api.commsLineIds[0], '▶ 播放這句（含回覆）': () => T.commsPlay(commsCtrl.line) };
  fComms.add(commsCtrl, 'line', api.commsLineIds).name('台詞');
  fComms.add(commsCtrl, '▶ 播放這句（含回覆）');
  fComms.close();

  // ── 版面（依編輯中的裝置重建）──
  let fLayout = null;
  function buildLayoutFolder() {
    if (fLayout) fLayout.destroy();
    const key = ctrl.editLayout;
    fLayout = gui.addFolder(`📐 版面 LAYOUT · ${key.toUpperCase()}`);
    const L = LAYOUTS[key];
    for (const section of Object.keys(L)) {
      const f = fLayout.addFolder(LABELS[section] || section);
      if (section === 'hud') {
        for (const el of Object.keys(L.hud)) {
          const fe = f.addFolder(LABELS[el] || el);
          addObject(fe, L.hud[el], 'hud.' + el, onLayoutChange);
          fe.close();
        }
      } else {
        addObject(f, L[section], section, onLayoutChange);
      }
      f.close();
    }
    // 讓版面資料夾排在 GAME / THEME / 匯出 之前
    for (const f of [fGame, fTheme, fExport]) if (f) gui.$children.appendChild(f.domElement);
  }

  const fGame = gui.addFolder('🎮 遊戲參數 GAME');
  addObject(fGame, GAME, '', scheduleSave);
  fGame.close();

  const fTheme = gui.addFolder('🎨 配色 THEME');
  addObject(fTheme, THEME, '', onThemeChange);
  fTheme.close();

  // ── 匯出 ──
  const fExport = gui.addFolder('💾 匯出 / 鎖定');
  const exp = {
    '💾 匯出 JSON（複製）': () => openExport(),
    '📝 直接寫入 src/layout.js': () => writeSource(),
    '↺ 全部還原為 layout.js 原值': () => {
      clearOverrides();
      location.reload();
    },
  };
  for (const name of Object.keys(exp)) fExport.add(exp, name);
  buildLayoutFolder();

  let stickyUntil = 0;
  function setStatus(msg, sticky = 5) {
    ctrl.status = msg;
    stickyUntil = performance.now() + sticky * 1000;
    statusCtrl.updateDisplay();
  }

  function exportJson() {
    return JSON.stringify({ LAYOUTS, GAME, THEME }, tidy, 2);
  }

  // 匯出視窗
  const modal = document.createElement('div');
  modal.className = 'dev-modal hidden';
  modal.innerHTML = `<div class="dev-modal-box">
      <b>💾 目前所有數值（LAYOUTS / GAME / THEME）</b>
      <div>複製後貼給 Claude，或按「寫入 layout.js」直接存回原始碼。</div>
      <textarea readonly></textarea>
      <div class="dev-modal-msg"></div>
      <button data-act="copy">📋 複製</button><button data-act="write">📝 寫入 src/layout.js</button><button data-act="close">關閉</button>
    </div>`;
  document.body.appendChild(modal);
  const ta = modal.querySelector('textarea');
  const msg = modal.querySelector('.dev-modal-msg');
  modal.addEventListener('click', async (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (act === 'close' || e.target === modal) modal.classList.add('hidden');
    if (act === 'copy') {
      try {
        await navigator.clipboard.writeText(ta.value);
        msg.textContent = '已複製到剪貼簿';
      } catch {
        ta.select();
        msg.textContent = '無法自動複製，已全選文字，請按 ⌘C / Ctrl+C';
      }
    }
    if (act === 'write') msg.textContent = await writeSource();
  });

  function openExport() {
    ta.value = exportJson();
    msg.textContent = '';
    modal.classList.remove('hidden');
    console.log('[DEV] 匯出數值：\n' + ta.value);
  }

  async function writeSource() {
    try {
      const res = await fetch('/__dev/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: exportJson() });
      if (!res.ok) throw new Error(String(res.status));
      clearOverrides(); // 已寫進原始碼，不再需要本機暫存
      const text = '✅ 已寫入 src/layout.js（舊檔備份為 src/layout.backup.js）';
      setStatus(text);
      return text;
    } catch {
      const text = '⚠ 目前伺服器不支援寫入（請用 node server.mjs 啟動），改用「匯出 JSON」';
      setStatus(text);
      return text;
    }
  }

  // ── 直接拖曳：3D 物件 ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hitP = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tip = document.createElement('div');
  tip.className = 'dev-tip hidden';
  document.body.appendChild(tip);
  let drag = null;

  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }

  function pick(e) {
    setRay(e);
    for (const p of api.pickables()) {
      const hits = raycaster.intersectObject(p.obj, true);
      if (hits.length) return { ...p, point: hits[0].point.clone() };
    }
    return null;
  }

  function showTip(e, text) {
    if (!text) {
      tip.classList.add('hidden');
      return;
    }
    tip.textContent = text;
    tip.style.left = `${e.clientX + 14}px`;
    tip.style.top = `${e.clientY + 14}px`;
    tip.classList.remove('hidden');
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!active || ctrl.steer) return;
    const p = pick(e);
    if (!p) return;
    e.stopImmediatePropagation();
    const L = api.current();
    p.obj.getWorldPosition(tmp);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), tmp);
    raycaster.ray.intersectPlane(plane, hitP);
    drag = {
      key: p.key, start: hitP.clone(), label: p.label,
      L: JSON.parse(JSON.stringify({ earth: L.earth, ship: L.ship, sun: L.sun, moon: L.moon })),
      ship: { x: S.ship.x, alt: S.ship.alt },
    };
    canvas.setPointerCapture(e.pointerId);
  }, true);

  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (!drag) {
      if (ctrl.steer) return;
      const p = pick(e);
      canvas.style.cursor = p ? 'grab' : '';
      showTip(e, p && p.label);
      return;
    }
    setRay(e);
    if (!raycaster.ray.intersectPlane(plane, hitP)) return;
    const dx = hitP.x - drag.start.x, dy = hitP.y - drag.start.y;
    const L = api.current(), o = drag.L;
    if (drag.key === 'earth') {
      L.earth.x = Math.round(o.earth.x + dx);
      L.earth.y = Math.round(o.earth.y + dy);
    } else if (drag.key === 'ship') {
      L.ship.x = Math.round(o.ship.x + dx);
      L.ship.altMin = Math.round(o.ship.altMin + dy);
      L.ship.altMax = Math.round(o.ship.altMax + dy);
      S.ship.x = S.ship.tx = drag.ship.x + dx;
      S.ship.alt = S.ship.ty = drag.ship.alt + dy;
    } else {
      L[drag.key].x = Math.round(o[drag.key].x + dx);
      L[drag.key].y = Math.round(o[drag.key].y + dy);
    }
    canvas.style.cursor = 'grabbing';
    showTip(e, drag.label);
    onLayoutChange();
    refresh();
  }, true);

  canvas.addEventListener('pointerup', (e) => {
    if (!drag) return;
    drag = null;
    canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = '';
  }, true);

  canvas.addEventListener('wheel', (e) => {
    if (!active) return;
    const p = pick(e);
    if (!p) return;
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.04 : 1 / 1.04;
    const L = api.current();
    if (p.key === 'earth') {
      // 縮放時保持地表頂端位置不動
      const top = L.earth.y + L.earth.radius;
      L.earth.radius = Math.round(L.earth.radius * f);
      L.earth.y = Math.round(top - L.earth.radius);
    } else if (p.key === 'ship') L.ship.scale = Math.round(L.ship.scale * f * 100) / 100;
    else if (p.key === 'sun') L.sun.size = Math.round(L.sun.size * f);
    else if (p.key === 'moon') L.moon.radius = Math.round(L.moon.radius * f);
    onLayoutChange();
    refresh();
  }, { passive: false });

  // ── 直接拖曳：HUD 元件（滾輪調字級、Shift+滾輪調縮放）──
  let hudDrag = null;
  let suppressClick = false;
  document.addEventListener('pointerdown', (e) => {
    if (!active) return;
    const el = e.target.closest && e.target.closest('.hud-el');
    if (!el || e.target.closest('.lil-gui')) return;
    const c = api.current().hud[el.dataset.key];
    if (!c) return;
    hudDrag = { c, sx: e.clientX, sy: e.clientY, x: c.x, y: c.y, moved: false };
    e.preventDefault();
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!hudDrag) return;
    const r = app.getBoundingClientRect();
    const dx = e.clientX - hudDrag.sx, dy = e.clientY - hudDrag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) hudDrag.moved = true;
    if (!hudDrag.moved) return;
    hudDrag.c.x = Math.round((hudDrag.x + (dx / r.width) * 100) * 10) / 10;
    hudDrag.c.y = Math.round((hudDrag.y + (dy / r.height) * 100) * 10) / 10;
    onLayoutChange();
    refresh();
  }, true);
  document.addEventListener('pointerup', () => {
    if (hudDrag && hudDrag.moved) suppressClick = true;
    hudDrag = null;
  }, true);
  document.addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  document.addEventListener('wheel', (e) => {
    if (!active) return;
    const el = e.target.closest && e.target.closest('.hud-el');
    if (!el) return;
    const c = api.current().hud[el.dataset.key];
    if (!c) return;
    e.preventDefault();
    if (e.shiftKey) c.scale = Math.max(0.3, Math.round((c.scale + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100);
    else c.fontSize = Math.max(6, c.fontSize + (e.deltaY < 0 ? 1 : -1));
    onLayoutChange();
    refresh();
  }, { passive: false, capture: true });

  let statusT = 0;
  return {
    get active() {
      return active;
    },
    toggle() {
      active = !active;
      gui.show(active);
      document.body.classList.toggle('dev-on', active);
      if (!active) {
        tip.classList.add('hidden');
        document.body.classList.remove('dev-show-all');
        ctrl.showAllHud = false;
        refresh();
      }
      if (active && api.hasOverrides) setStatus('已載入本機暫存數值');
    },
    isPaused: () => active && ctrl.pause,
    blocksInput: () => active && !ctrl.steer,
    tick(dt) {
      if (!active) return;
      statusT += dt;
      if (statusT > 0.5 && performance.now() > stickyUntil) {
        statusT = 0;
        setStatus(`${api.getLayoutKey().toUpperCase()} · ${app.clientWidth}×${app.clientHeight} · ${S.phase}`, 0);
      }
    },
  };
}
