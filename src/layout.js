// 版面與遊戲參數（DEV 微調工具可匯出 JSON，或透過 server.mjs 直接寫回此檔）
// LAYOUTS：各裝置版面（pc / tablet / mobile）——相機、場景物件位置、HUD
// GAME：玩法參數（速度、能量、生成頻率、動畫時間）
// THEME：配色與星球外觀

export const LAYOUTS = {
  pc: {
    ui: { refW: 1280, refH: 800, min: 0.3, max: 1.6 },
    camera: { fov: 52, x: 0, y: 112, z: 270, lookX: 0, lookY: 100, follow: 0.12 },
    earth: { x: 0, y: -600, radius: 600, cloudAlt: 12, atmoScale: 1.12, atmoIntensity: 1.3, hazeIntensity: 0.9 },
    ship: { x: -60, altMin: 35, altMax: 190, rangeX: 95, scale: 1, tilt: 1, touchOffsetY: 0, titleX: -130, titleAlt: 45, landX: -10 },
    sun: { x: 1150, y: 720, z: -1900, size: 760, intensity: 2.4 },
    moon: { x: -760, y: 430, z: -1500, radius: 70 },
    space: { starSize: 1.8, starOpacity: 0.9, nebulaOpacity: 0.6, ambient: 0.55 },
    fx: { bloomStrength: 0.8, bloomRadius: 0.5, bloomThreshold: 0.7, exposure: 1.05 },
    hud: {
      stats: { x: 3, y: 4, ax: 0, ay: 0, scale: 1, fontSize: 16, color: '#eaf6ff', opacity: 1 },
      energy: { x: 97, y: 4, ax: 1, ay: 0, scale: 1, fontSize: 14, color: '#eaf6ff', opacity: 1 },
      controls: { x: 97, y: 95, ax: 1, ay: 1, scale: 1, fontSize: 16, color: '#eaf6ff', opacity: 0.85 },
      hint: { x: 50, y: 20, ax: 0.5, ay: 0.5, scale: 1, fontSize: 18, color: '#eaf6ff', opacity: 1 },
      banner: { x: 50, y: 33, ax: 0.5, ay: 0.5, scale: 1, fontSize: 18, color: '#ffffff', opacity: 1 },
      title: { x: 50, y: 40, ax: 0.5, ay: 0.5, scale: 1, fontSize: 16, color: '#ffffff', opacity: 1 },
      gameover: { x: 50, y: 42, ax: 0.5, ay: 0.5, scale: 1, fontSize: 16, color: '#ffffff', opacity: 1 },
      comms: { x: 3, y: 94, ax: 0, ay: 1, scale: 1, fontSize: 15, color: '#eaf6ff', opacity: 1 },
    },
  },
  tablet: {
    ui: { refW: 820, refH: 1180, min: 0.3, max: 1.6 },
    camera: { fov: 55, x: 0, y: 135, z: 420, lookX: 0, lookY: 125, follow: 0.12 },
    earth: { x: 0, y: -600, radius: 600, cloudAlt: 12, atmoScale: 1.12, atmoIntensity: 1.3, hazeIntensity: 0.9 },
    ship: { x: -45, altMin: 35, altMax: 230, rangeX: 70, scale: 1.15, tilt: 1, touchOffsetY: 60, titleX: -60, titleAlt: 60, landX: -10 },
    sun: { x: 900, y: 900, z: -1900, size: 760, intensity: 2.4 },
    moon: { x: -520, y: 600, z: -1500, radius: 70 },
    space: { starSize: 1.8, starOpacity: 0.9, nebulaOpacity: 0.6, ambient: 0.55 },
    fx: { bloomStrength: 0.8, bloomRadius: 0.5, bloomThreshold: 0.7, exposure: 1.05 },
    hud: {
      stats: { x: 4, y: 3, ax: 0, ay: 0, scale: 1, fontSize: 15, color: '#eaf6ff', opacity: 1 },
      energy: { x: 96, y: 3, ax: 1, ay: 0, scale: 1, fontSize: 13, color: '#eaf6ff', opacity: 1 },
      controls: { x: 96, y: 97, ax: 1, ay: 1, scale: 1, fontSize: 16, color: '#eaf6ff', opacity: 0.85 },
      hint: { x: 50, y: 18, ax: 0.5, ay: 0.5, scale: 1, fontSize: 17, color: '#eaf6ff', opacity: 1 },
      banner: { x: 50, y: 30, ax: 0.5, ay: 0.5, scale: 1, fontSize: 17, color: '#ffffff', opacity: 1 },
      title: { x: 50, y: 36, ax: 0.5, ay: 0.5, scale: 1, fontSize: 15, color: '#ffffff', opacity: 1 },
      gameover: { x: 50, y: 38, ax: 0.5, ay: 0.5, scale: 1, fontSize: 15, color: '#ffffff', opacity: 1 },
      comms: { x: 4, y: 96, ax: 0, ay: 1, scale: 1, fontSize: 15, color: '#eaf6ff', opacity: 1 },
    },
  },
  mobile: {
    ui: { refW: 390, refH: 844, min: 0.3, max: 1.6 },
    camera: { fov: 58, x: 0, y: 165, z: 560, lookX: 0, lookY: 150, follow: 0.1 },
    earth: { x: 0, y: -600, radius: 600, cloudAlt: 12, atmoScale: 1.12, atmoIntensity: 1.3, hazeIntensity: 0.9 },
    ship: { x: -40, altMin: 40, altMax: 290, rangeX: 50, scale: 1.4, tilt: 1, touchOffsetY: 80, titleX: -30, titleAlt: 70, landX: 0 },
    sun: { x: 700, y: 1100, z: -1900, size: 760, intensity: 2.4 },
    moon: { x: -380, y: 760, z: -1500, radius: 70 },
    space: { starSize: 1.6, starOpacity: 0.9, nebulaOpacity: 0.6, ambient: 0.55 },
    fx: { bloomStrength: 0.75, bloomRadius: 0.5, bloomThreshold: 0.7, exposure: 1.05 },
    hud: {
      stats: { x: 5, y: 3, ax: 0, ay: 0, scale: 1, fontSize: 12, color: '#eaf6ff', opacity: 1 },
      energy: { x: 5, y: 10, ax: 0, ay: 0, scale: 1, fontSize: 11, color: '#eaf6ff', opacity: 1 },
      controls: { x: 95, y: 10, ax: 1, ay: 0, scale: 1, fontSize: 14, color: '#eaf6ff', opacity: 0.85 },
      hint: { x: 50, y: 22, ax: 0.5, ay: 0.5, scale: 1, fontSize: 14, color: '#eaf6ff', opacity: 1 },
      banner: { x: 50, y: 32, ax: 0.5, ay: 0.5, scale: 1, fontSize: 13, color: '#ffffff', opacity: 1 },
      title: { x: 50, y: 34, ax: 0.5, ay: 0.5, scale: 1, fontSize: 12, color: '#ffffff', opacity: 1 },
      gameover: { x: 50, y: 36, ax: 0.5, ay: 0.5, scale: 1, fontSize: 12, color: '#ffffff', opacity: 1 },
      comms: { x: 50, y: 96, ax: 0.5, ay: 1, scale: 1, fontSize: 13, color: '#eaf6ff', opacity: 1 },
    },
  },
};

export const GAME = {
  // 速度（地球繞行角速度，rad/s）
  speedStart: 0.09, speedPerLevel: 0.012, speedMax: 0.24,
  levelEvery: 1.5708, // 每前進多少弧度升一級（π/2 = 四分之一圈）
  // 能量
  energyMax: 100, energyDrain: 2, drainPerLevel: 0.3,
  cellEnergy: 1.6, lapBonus: 15, hitDamage: 15,
  // 生成
  cellEvery: 2.4, hazardEvery: 1.8, hazardRamp: 0.9, hazardMin: 0.5, combatHazardMul: 0.7,
  debrisFromLevel: 2, meteorFromLevel: 3, meteorChance: 0.3, shieldChance: 0.07, shieldTime: 6,
  // 戰鬥模式
  fireRate: 0.13, bulletSpeed: 700, asteroidHp: 2, dropChance: 0.35,
  // 操控 / 動畫時間
  shipFollow: 5, invulnTime: 1, bannerTime: 1.8, hintTime: 4.5,
  flashTime: 0.25, shake: 7, warnTime: 0.9,
  // 緊急迫降（reentryAt / chuteAt 為佔 landingTime 的比例）
  landingTime: 14, reentryAt: 0.42, chuteAt: 0.72, landedDelay: 1.8,
  // 地面通訊
  commsVolume: 0.03, commsGap: 0.4, commsRest: 6, commsIdleMin: 45, commsIdleMax: 80,
  radioLow: 320, radioHigh: 2900, radioDrive: 4, radioNoise: 0.05, quindarVolume: 0.008,
};

export const THEME = {
  // 太空
  bgColor: '#03040b', ambientColor: '#8ea6ff', sunColor: '#fff1d6', atmoColor: '#59b2ff', moonColor: '#c9ced8',
  // 地球（seaLevel / earthSeed 變更會重建地形）
  earthSeed: 3, seaLevel: 0.565,
  deepOcean: '#123d78', ocean: '#1f63b0', shallow: '#3b93d6', sand: '#e3d08f',
  grass: '#5aa64f', forest: '#2f6e3d', rock: '#8a7458', snow: '#f4f8ff', cloud: '#ffffff',
  // 太空船
  hull: '#eef2f7', accent: '#ff7a3d', glass: '#5fd7ff', flame: '#6fe6ff',
  // 物件
  cell: '#45f0ff', asteroid: '#8b7d70', debris: '#d9a441', panel: '#2b5fd9',
  meteor: '#ff7a2f', shield: '#7dffb2', laser: '#ff4fd8',
  // HUD
  hudAccent: '#4ff3ff', hudWarn: '#ff6a4d',
};
