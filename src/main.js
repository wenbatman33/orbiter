// ORBITER 主程式：渲染、輸入、遊戲狀態機、主迴圈
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LAYOUTS, GAME, THEME } from './layout.js';
import { loadOverrides } from './overrides.js';
import { createWorld } from './world.js';
import { createShip } from './ship.js';
import { Particles } from './particles.js';
import { Entities } from './entities.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';

const hasOverrides = loadOverrides({ LAYOUTS, GAME, THEME });
if (hasOverrides) console.info('[ORBITER] 已套用 DEV 本機暫存數值（DEV 面板可清除）');

const KM_PER_RAD = 6371; // 地球半徑（km）：前進 1 弧度 ≈ 6371 km
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

// ── 渲染器 ─────────────────────────────────────────
const app = document.getElementById('app');
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 1, 14000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const world = createWorld(scene, THEME);
const ship = createShip(THEME);
scene.add(ship.group);
const particles = new Particles(scene);
const entities = new Entities(scene, particles, THEME);
const hud = new Hud();
const sfx = new Sfx();

// ── 狀態 ───────────────────────────────────────────
const S = {
  phase: 'title', // title | playing | dying | gameover
  mode: 'cruise', // cruise 巡航 | combat 戰鬥
  paused: false,
  timeScale: 1,
  god: false,
  layoutKey: 'pc',
  forcedLayout: null,
  omega: GAME.speedStart * 0.5,
  rot: 0,
  travel: 0,
  level: 1,
  laps: 0,
  energy: GAME.energyMax,
  kills: 0,
  shieldT: 0,
  invulnT: 0,
  flashT: 0,
  shake: 0,
  deathT: 0,
  cellT: 1,
  hazardT: 2.5,
  fireT: 0,
  firing: false,
  pending: [],
  trailAcc: 0,
  ship: { x: 0, alt: 100, tx: 0, ty: 100, vx: 0, vy: 0, kx: 0, ky: 0, spin: 0 },
  cam: { x: 0, y: 0 },
  view: { halfW: 200, halfH: 130, rightX: 200, leftX: -200 },
  pointer: { active: false, x: 0, y: 0, touch: false },
  keys: {},
  best: loadBest(),
  dev: null,
};
let L = LAYOUTS.pc;

function loadBest() {
  try {
    return { cruise: 0, combat: 0, ...JSON.parse(localStorage.getItem('orbiter.best') || '{}') };
  } catch {
    return { cruise: 0, combat: 0 };
  }
}
function saveBest() {
  try {
    localStorage.setItem('orbiter.best', JSON.stringify(S.best));
  } catch {
    // 略過
  }
}

const earthTop = () => L.earth.y + L.earth.radius;
const altMid = () => (L.ship.altMin + L.ship.altMax) / 2;

// ── 版面 ───────────────────────────────────────────
function pickLayoutKey(w, h) {
  if (S.forcedLayout) return S.forcedLayout;
  const a = w / h;
  return a < 0.62 ? 'mobile' : a < 1.2 ? 'tablet' : 'pc';
}

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  if (!w || !h) return; // 視窗隱藏時尺寸為 0，略過避免 framebuffer 錯誤
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  S.layoutKey = pickLayoutKey(w, h);
  L = LAYOUTS[S.layoutKey];
  applyLayout();
}

function applyLayout() {
  camera.fov = L.camera.fov;
  camera.updateProjectionMatrix();
  world.apply(L, THEME);
  entities.holder.position.set(L.earth.x, L.earth.y, 0);
  ship.group.scale.setScalar(L.ship.scale);
  bloom.strength = L.fx.bloomStrength;
  bloom.radius = L.fx.bloomRadius;
  bloom.threshold = L.fx.bloomThreshold;
  renderer.toneMappingExposure = L.fx.exposure;
  const ui = clamp(Math.min(app.clientWidth / L.ui.refW, app.clientHeight / L.ui.refH), L.ui.min, L.ui.max);
  hud.applyLayout(L.hud, ui);
  hud.setAccent(THEME.hudAccent, THEME.hudWarn);
  // 以 z=0 平面估算可視範圍（物件生成 / 回收用）
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * L.camera.z;
  S.view.halfH = halfH;
  S.view.halfW = halfH * camera.aspect;
  S.view.rightX = L.camera.x + S.view.halfW;
  S.view.leftX = L.camera.x - S.view.halfW;
}

function applyTheme() {
  world.applyTheme(THEME);
  ship.setColors(THEME);
  entities.setTheme(THEME);
  hud.setAccent(THEME.hudAccent, THEME.hudWarn);
}

// ── 座標換算 ────────────────────────────────────────
const _v = new THREE.Vector3();
function screenToWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  _v.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  const t = -camera.position.z / _v.z;
  return { x: camera.position.x + _v.x * t, y: camera.position.y + _v.y * t };
}
function worldToScreenPct(x, y) {
  _v.set(x, y, 0).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * 100, y: (-_v.y * 0.5 + 0.5) * 100 };
}

// ── 輸入 ───────────────────────────────────────────
const devBlocksInput = () => S.dev && S.dev.blocksInput();

canvas.addEventListener('pointermove', (e) => {
  S.pointer.x = e.clientX;
  S.pointer.y = e.clientY;
  S.pointer.active = true;
  S.pointer.touch = e.pointerType === 'touch';
});
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (devBlocksInput()) return;
  S.pointer.x = e.clientX;
  S.pointer.y = e.clientY;
  S.pointer.active = true;
  S.pointer.touch = e.pointerType === 'touch';
  if (!S.pointer.touch) S.firing = true;
});
window.addEventListener('pointerup', () => (S.firing = false));

const ARROWS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select, .lil-gui')) return;
  const k = e.key.toLowerCase();
  S.keys[k] = true;
  if (ARROWS.includes(k)) e.preventDefault();
  if (k === 'd' && !e.repeat) toggleDev();
  if ((k === 'p' || k === 'escape') && S.phase === 'playing') togglePause();
  if (k === ' ') {
    S.firing = true;
    e.preventDefault();
  }
  if (k === 'enter' && S.phase === 'gameover') startGame(S.mode);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  S.keys[k] = false;
  if (k === ' ') S.firing = false;
});
window.addEventListener('blur', () => {
  if (S.phase === 'playing' && !S.paused && !S.dev?.active) togglePause();
});
window.addEventListener('resize', () => {
  if (S.forcedLayout) emulateFrame(S.forcedLayout);
  resize();
});

document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => startGame(b.dataset.mode)));
document.getElementById('btn-retry').addEventListener('click', () => startGame(S.mode));
document.getElementById('btn-menu').addEventListener('click', () => toTitle());
document.getElementById('btn-pause').addEventListener('click', () => togglePause());
document.getElementById('screen-pause').addEventListener('click', () => togglePause());
const soundBtn = document.getElementById('btn-sound');
soundBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  soundBtn.classList.toggle('off', sfx.muted);
});

// ── 遊戲流程 ────────────────────────────────────────
function resetRun(mode) {
  Object.assign(S, {
    mode, omega: GAME.speedStart, travel: 0, level: 1, laps: 0, energy: GAME.energyMax, kills: 0,
    shieldT: 0, invulnT: 0, flashT: 0, deathT: 0, cellT: 0.8, hazardT: 2.5, fireT: 0, pending: [],
  });
  entities.clear();
  particles.clear();
  const sh = S.ship;
  sh.x = L.ship.x - L.ship.rangeX - S.view.halfW * 0.6; // 從左側飛入
  sh.alt = altMid();
  sh.tx = L.ship.x;
  sh.ty = altMid();
  sh.kx = sh.ky = sh.spin = 0;
  ship.group.visible = true;
  hud.setMode(mode);
}

function startGame(mode) {
  sfx.unlock();
  sfx.start();
  resetRun(mode);
  S.phase = 'playing';
  S.paused = false;
  S.pointer.active = false;
  hud.showPause(false);
  hud.showScreen(null);
  hud.showHud(true);
  hud.hint(
    mode === 'combat'
      ? '按住滑鼠 / 空白鍵發射雷射 擊碎隕石<br>收集 <b class="cyan">藍色能量晶體</b> 維持能量'
      : '收集 <b class="cyan">藍色能量晶體</b> 維持能量<br>閃避隕石與太空垃圾',
    GAME.hintTime,
  );
}

function toTitle() {
  S.phase = 'title';
  S.paused = false;
  entities.clear();
  hud.showPause(false);
  hud.showHud(false);
  hud.hint('', 0);
  hud.setBest(S.best);
  hud.showScreen('title');
  ship.group.visible = true;
  S.ship.spin = 0;
}

function die() {
  S.phase = 'dying';
  S.deathT = 0;
  S.ship.vy = Math.min(S.ship.vy, 0) - 20;
  S.ship.vx = 40;
  S.firing = false;
  sfx.gameOver();
}

function gameOver() {
  const sh = S.ship;
  const p = ship.group.position;
  particles.burst(p.x, p.y, 0, { color: THEME.accent, count: 20, speed: 120, size: 3, life: 1.2 });
  particles.burst(p.x, p.y, 0, { color: '#ffb36b', count: 40, speed: 200, size: 3, life: 0.8, glow: true });
  sfx.boom();
  ship.group.visible = false;
  sh.spin = 0;
  S.phase = 'gameover';
  const km = S.travel * KM_PER_RAD;
  const isBest = km > (S.best[S.mode] || 0);
  if (isBest) {
    S.best[S.mode] = km;
    saveBest();
  }
  hud.showHud(false);
  hud.showGameOver({ km, laps: S.travel / TAU, kills: S.kills, best: S.best[S.mode], isBest, mode: S.mode });
}

function togglePause() {
  if (S.phase !== 'playing') return;
  S.paused = !S.paused;
  hud.showPause(S.paused);
}

function hazardInterval() {
  let iv = GAME.hazardEvery * Math.pow(GAME.hazardRamp, S.level - 1);
  if (S.mode === 'combat') iv *= GAME.combatHazardMul;
  return Math.max(GAME.hazardMin, iv) * rand(0.7, 1.3);
}

function queueMeteor() {
  const alt = clamp(S.ship.alt + rand(-30, 30), L.ship.altMin, L.ship.altMax); // 瞄準玩家附近
  S.pending.push({ t: GAME.warnTime, alt });
  hud.warn(worldToScreenPct(S.view.rightX, earthTop() + alt).y, GAME.warnTime);
  sfx.warn();
}

function spawnHazard() {
  const r = Math.random();
  const combat = S.mode === 'combat';
  if (S.level >= GAME.meteorFromLevel && r < GAME.meteorChance) queueMeteor();
  else if (S.level >= GAME.debrisFromLevel && r < GAME.meteorChance + 0.25) entities.spawnDebris(combat);
  else entities.spawnAsteroids(S.level, combat, GAME.asteroidHp);
  if (S.shieldT <= 0 && Math.random() < GAME.shieldChance) entities.spawnShield();
}

function fire() {
  const p = ship.group.position;
  entities.fireBullet(p.x + 16 * L.ship.scale, p.y);
  sfx.laser();
}

function onHit(ev) {
  if (S.shieldT > 0) {
    sfx.boom();
    return;
  }
  sfx.hit();
  if (S.invulnT > 0) return;
  if (!S.god) S.energy -= GAME.hitDamage;
  S.invulnT = GAME.invulnTime;
  S.flashT = GAME.flashTime;
  S.shake = GAME.shake;
  S.ship.kx = -26;
  S.ship.ky = ev.y > ship.group.position.y ? -14 : 14;
  hud.flash();
}

function handleEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'collect':
        S.energy = Math.min(GAME.energyMax, S.energy + GAME.cellEnergy);
        sfx.collect();
        break;
      case 'shield':
        S.shieldT = GAME.shieldTime;
        sfx.shield();
        hud.banner('護盾啟動', 'SHIELD ON', 1.2);
        break;
      case 'hit':
        onHit(ev);
        break;
      case 'kill':
        S.kills += 1;
        sfx.boom();
        if (Math.random() < GAME.dropChance) entities.addCell(ev.angle, ev.radius);
        break;
      case 'ping':
        sfx.ping();
        break;
    }
  }
}

// ── 每幀更新 ────────────────────────────────────────
function updateProgress(dt) {
  S.travel += S.omega * dt;
  const laps = Math.floor(S.travel / TAU);
  const lvl = 1 + Math.floor(S.travel / GAME.levelEvery);
  const lapUp = laps > S.laps, lvlUp = lvl > S.level;
  if (lapUp) {
    S.laps = laps;
    S.energy = Math.min(GAME.energyMax, S.energy + GAME.lapBonus);
    hud.banner(`完成第 ${laps} 圈`, `ORBIT COMPLETE · 能量 +${GAME.lapBonus}`, GAME.bannerTime);
    sfx.lap();
  }
  if (lvlUp) {
    S.level = lvl;
    if (!lapUp) {
      hud.banner(`等級 ${String(lvl).padStart(2, '0')}`, 'LEVEL UP · 軌道速度提升', GAME.bannerTime);
      sfx.levelUp();
    }
  }

  S.energy -= (GAME.energyDrain + (S.level - 1) * GAME.drainPerLevel) * dt;
  if (S.god) S.energy = Math.max(S.energy, GAME.energyMax * 0.5);
  if (S.energy <= 0) {
    S.energy = 0;
    die();
    return;
  }

  S.cellT -= dt;
  if (S.cellT <= 0) {
    entities.spawnCells();
    S.cellT = GAME.cellEvery * rand(0.75, 1.25);
  }
  S.hazardT -= dt;
  if (S.hazardT <= 0) {
    spawnHazard();
    S.hazardT = hazardInterval();
  }
  for (const p of S.pending) {
    p.t -= dt;
    if (p.t <= 0) entities.spawnMeteor(p.alt, S.mode === 'combat');
  }
  S.pending = S.pending.filter((p) => p.t > 0);

  if (S.mode === 'combat' && (S.firing || S.pointer.touch) && !devBlocksInput()) {
    S.fireT -= dt;
    if (S.fireT <= 0) {
      fire();
      S.fireT = GAME.fireRate;
    }
  }
  S.shieldT = Math.max(0, S.shieldT - dt);
  S.invulnT = Math.max(0, S.invulnT - dt);
}

function updateShip(dt, t) {
  const sh = S.ship;
  const px = sh.x, pa = sh.alt;
  const follow = 1 - Math.exp(-GAME.shipFollow * dt);

  if (S.phase === 'playing') {
    if (S.pointer.active && !devBlocksInput()) {
      const p = screenToWorld(S.pointer.x, S.pointer.y - (S.pointer.touch ? L.ship.touchOffsetY : 0));
      sh.tx = p.x;
      sh.ty = p.y - earthTop();
    }
    const kx = (S.keys.arrowright ? 1 : 0) - (S.keys.arrowleft ? 1 : 0);
    const ky = (S.keys.arrowup ? 1 : 0) - (S.keys.arrowdown ? 1 : 0);
    if (kx || ky) {
      S.pointer.active = false;
      sh.tx += kx * 260 * dt;
      sh.ty += ky * 260 * dt;
    }
    sh.tx = clamp(sh.tx, L.ship.x - L.ship.rangeX, L.ship.x + L.ship.rangeX);
    sh.ty = clamp(sh.ty, L.ship.altMin, L.ship.altMax);
    sh.x += (sh.tx - sh.x) * follow;
    sh.alt += (sh.ty - sh.alt) * follow;
  } else if (S.phase === 'dying') {
    // 失去動力：旋轉墜向大氣層
    S.deathT += dt;
    sh.vy -= 90 * dt;
    sh.x += sh.vx * dt;
    sh.alt += sh.vy * dt;
    sh.spin += dt * 7;
    if (sh.alt < -5 || S.deathT > GAME.deathTime) gameOver();
  } else {
    // 標題 / 結算：在 titleX / titleAlt 附近自動巡航
    sh.tx = L.ship.titleX + Math.sin(t * 0.45) * L.ship.rangeX * 0.2;
    sh.ty = L.ship.titleAlt + Math.sin(t * 0.8) * (L.ship.altMax - L.ship.altMin) * 0.08;
    sh.x += (sh.tx - sh.x) * follow * 0.5;
    sh.alt += (sh.ty - sh.alt) * follow * 0.5;
  }

  if (S.phase !== 'dying' && dt > 0) {
    sh.vx = (sh.x - px) / dt;
    sh.vy = (sh.alt - pa) / dt;
  }
  const decay = Math.exp(-5 * dt);
  sh.kx *= decay;
  sh.ky *= decay;
  placeShip(t);

  // 姿態：爬升抬頭、左右移動翻滾
  const tilt = L.ship.tilt;
  const m = ship.model;
  if (S.phase === 'dying') {
    m.rotation.z -= dt * 2.2;
    m.rotation.x += dt * 9;
  } else {
    m.rotation.z += (clamp(sh.vy * 0.006 * tilt, -0.7, 0.7) - m.rotation.z) * Math.min(1, dt * 8);
    m.rotation.x += (clamp(-sh.vx * 0.004 * tilt, -0.6, 0.6) + Math.sin(t * 1.3) * 0.07 - m.rotation.x) * Math.min(1, dt * 6);
    m.position.y = Math.sin(t * 2.1) * 1.4;
  }

  S.flashT = Math.max(0, S.flashT - dt);
  const blink = S.invulnT > 0 && S.shieldT <= 0 ? (Math.sin(t * 40) > 0 ? 0.6 : 0) : 0;
  const shieldAlpha = S.shieldT > 0 ? (S.shieldT < 1.5 ? (Math.sin(t * 20) > 0 ? 1 : 0.3) : 1) : 0;
  ship.update(dt, t, { thrust: S.phase === 'dying' ? 0.3 : 1 + Math.max(0, sh.vx) * 0.004, flash: Math.max(S.flashT / GAME.flashTime, blink), shield: shieldAlpha });

  emitTrail(dt);
}

function placeShip() {
  const sh = S.ship;
  ship.group.position.set(sh.x + sh.kx, earthTop() + sh.alt + sh.ky, 0);
}

const _np = new THREE.Vector3();
function emitTrail(dt) {
  if (!ship.group.visible || dt <= 0) return;
  S.trailAcc += dt * 60;
  const n = Math.floor(S.trailAcc);
  S.trailAcc -= n;
  const dying = S.phase === 'dying';
  for (let i = 0; i < n; i++) {
    ship.nozzles.forEach((nz, idx) => {
      if (dying && idx > 0) return;
      nz.getWorldPosition(_np);
      const back = -70 - S.omega * L.earth.radius * 0.6;
      if (dying) {
        particles.emit(_np.x, _np.y, _np.z, back * 0.4 + rand(-15, 15), rand(-10, 25), rand(-10, 10), rand(3, 6), rand(0.4, 0.8), Math.random() < 0.5 ? '#ff7a2f' : '#ffd36b');
        if (Math.random() < 0.3) particles.emit(_np.x, _np.y, _np.z, back * 0.3, rand(5, 25), 0, rand(1.5, 3), 1.2, '#3a3d48', false, 1);
      } else {
        particles.emit(_np.x, _np.y + rand(-0.6, 0.6), _np.z, back + rand(-10, 10), rand(-6, 6), rand(-6, 6), (idx ? 1.3 : 2) * L.ship.scale, rand(0.22, 0.34), THEME.flame);
      }
    });
  }
}

function updateCamera(dt) {
  const c = L.camera, sh = S.ship;
  const tx = c.x + (sh.x - L.ship.x) * c.follow;
  const ty = c.y + (sh.alt - altMid()) * c.follow;
  const k = dt > 0 ? 1 - Math.exp(-4 * dt) : 1;
  S.cam.x += (tx - S.cam.x) * k;
  S.cam.y += (ty - S.cam.y) * k;
  S.shake *= Math.exp(-7 * dt);
  const sh2 = dt > 0 ? S.shake : 0; // 暫停時不晃
  const sx = (Math.random() - 0.5) * sh2, sy = (Math.random() - 0.5) * sh2;
  camera.position.set(S.cam.x + sx, S.cam.y + sy, c.z);
  camera.lookAt(c.lookX + (S.cam.x - c.x), c.lookY + (S.cam.y - c.y), 0);
}

function update(dt, t) {
  const playing = S.phase === 'playing';
  let targetOmega = GAME.speedStart * 0.5;
  if (playing) targetOmega = Math.min(GAME.speedMax, GAME.speedStart + (S.level - 1) * GAME.speedPerLevel);
  else if (S.phase === 'dying') targetOmega = GAME.speedStart * 0.3;
  S.omega += (targetOmega - S.omega) * Math.min(1, dt * 1.5);
  S.rot += S.omega * dt;
  entities.holder.rotation.z = S.rot;
  world.update(dt, S.omega);

  if (playing) updateProgress(dt);
  updateShip(dt, t);

  const c = entities.ctx;
  c.ex = L.earth.x;
  c.ey = L.earth.y;
  c.R = L.earth.radius;
  c.rot = S.rot;
  c.rightX = S.view.rightX;
  c.leftX = S.view.leftX;
  c.altMin = L.ship.altMin;
  c.altMax = L.ship.altMax;
  c.omega = S.omega;
  const p = ship.group.position;
  handleEvents(entities.update(dt, { active: S.phase === 'playing', sx: p.x, sy: p.y, sr: ship.hitRadius * L.ship.scale, bulletSpeed: GAME.bulletSpeed }));
  particles.update(dt);

  hud.setStats({ km: S.travel * KM_PER_RAD, laps: S.travel / TAU, level: S.level, kills: S.kills });
  hud.setEnergy(S.energy, GAME.energyMax);
  hud.setShield(S.shieldT);
  sfx.engine(S.phase === 'playing' && !S.paused ? 1 : 0.35, (S.omega - GAME.speedStart * 0.5) / (GAME.speedMax - GAME.speedStart * 0.5));
}

// ── DEV 微調工具（按 D 開啟，第一次才載入）────────────────
async function toggleDev() {
  if (!S.dev) {
    const m = await import('./devtools.js');
    S.dev = m.createDevTools(devApi);
  }
  S.dev.toggle();
}

function emulateFrame(key) {
  // 在桌機上模擬手機 / 平板的畫面比例
  const ratios = { mobile: 390 / 844, tablet: 820 / 1180 };
  const r = ratios[key];
  if (!r) {
    app.classList.remove('emulated');
    app.style.width = app.style.height = '';
  } else {
    const h = Math.min(window.innerHeight - 20, (window.innerWidth - 20) / r);
    app.classList.add('emulated');
    app.style.height = `${h}px`;
    app.style.width = `${h * r}px`;
  }
}

const devApi = {
  LAYOUTS, GAME, THEME, S, camera, canvas, app, world, ship, hasOverrides,
  current: () => L,
  getLayoutKey: () => S.layoutKey,
  setForcedLayout(key) {
    S.forcedLayout = key === 'auto' ? null : key;
    emulateFrame(S.forcedLayout);
    resize();
  },
  applyLayout,
  applyTheme,
  placeShip,
  earthTop,
  pickables: () => [
    { obj: ship.group, key: 'ship', label: '🚀 太空船（拖曳：基準位置 / 高度範圍｜滾輪：縮放）' },
    { obj: world.moon, key: 'moon', label: '🌙 月球（拖曳移動｜滾輪：大小）' },
    { obj: world.sun, key: 'sun', label: '☀️ 太陽（拖曳移動｜滾輪：光暈大小）' },
    { obj: world.earth, key: 'earth', label: '🌍 地球（拖曳移動｜滾輪：半徑）' },
  ],
  triggers: {
    title: () => toTitle(),
    cruise: () => startGame('cruise'),
    combat: () => startGame('combat'),
    levelUp: () => {
      if (S.phase !== 'playing') startGame(S.mode);
      S.travel = S.level * GAME.levelEvery + 0.0001;
    },
    lap: () => {
      if (S.phase !== 'playing') startGame(S.mode);
      S.travel = (S.laps + 1) * TAU + 0.0001;
    },
    hit: () => S.phase === 'playing' && onHit({ y: ship.group.position.y + 10 }),
    shield: () => {
      S.shieldT = GAME.shieldTime;
      sfx.shield();
    },
    cells: () => entities.spawnCells(),
    asteroids: () => entities.spawnAsteroids(S.level, S.mode === 'combat', GAME.asteroidHp),
    debris: () => entities.spawnDebris(S.mode === 'combat'),
    meteor: () => queueMeteor(),
    shieldItem: () => entities.spawnShield(),
    fillEnergy: () => (S.energy = GAME.energyMax),
    lowEnergy: () => (S.energy = GAME.energyMax * 0.15),
    die: () => S.phase === 'playing' && die(),
    gameOver: () => {
      if (S.phase !== 'playing' && S.phase !== 'dying') resetRun(S.mode);
      gameOver();
    },
  },
};

if (new URLSearchParams(location.search).has('dev')) {
  const gear = document.getElementById('dev-gear');
  gear.classList.remove('hidden');
  gear.addEventListener('click', () => toggleDev());
}

// ── 主迴圈 ─────────────────────────────────────────
const clock = new THREE.Clock();
let gameTime = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const frozen = S.paused || (S.dev && S.dev.isPaused());
  const sdt = frozen ? 0 : dt * S.timeScale;
  gameTime += sdt;
  if (sdt > 0) update(sdt, gameTime);
  else placeShip();
  updateCamera(sdt);
  composer.render();
  if (S.dev) S.dev.tick(dt);
}

resize();
applyTheme();
toTitle();
S.cam.x = L.camera.x;
S.cam.y = L.camera.y;
S.ship.x = L.ship.titleX;
S.ship.alt = L.ship.titleAlt;
frame();
