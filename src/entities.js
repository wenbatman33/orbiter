// 軌道上的物件：能量晶體、隕石、太空垃圾、流星、護盾、雷射
// 物件掛在 holder（位於地球中心、跟著地球轉）底下，以極座標 (angle, radius) 定位
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const rand = (a, b) => a + Math.random() * (b - a);
const HAZARDS = new Set(['asteroid', 'debris', 'meteor']);

// 隕石幾何：共用頂點用同一個位移量，避免裂縫
function rockGeometry(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const rnd = mulberry32(seed);
  const map = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!map.has(key)) map.set(key, 0.72 + rnd() * 0.5);
    v.multiplyScalar(map.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const colors = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count; f += 3) {
    const g = 0.7 + rnd() * 0.4;
    for (let k = 0; k < 3; k++) colors.set([g, g, g], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export class Entities {
  constructor(scene, particles, theme) {
    this.scene = scene;
    this.particles = particles;
    this.holder = new THREE.Group();
    scene.add(this.holder);
    this.list = [];
    this.bullets = [];
    // 每幀由 main 更新的環境資訊
    this.ctx = { ex: 0, ey: 0, R: 600, rot: 0, rightX: 300, leftX: -300, altMin: 30, altMax: 180, omega: 0.1 };

    this.geos = {
      cell: new THREE.OctahedronGeometry(4, 0),
      rocks: [1, 2, 3, 4, 5].map(rockGeometry),
      body: new THREE.BoxGeometry(6, 6, 8),
      panel: new THREE.BoxGeometry(0.4, 5, 12),
      dish: new THREE.ConeGeometry(3, 2, 8, 1, true),
      shieldCore: new THREE.IcosahedronGeometry(3.5, 0),
      shieldCage: new THREE.IcosahedronGeometry(7, 1),
      bullet: new THREE.BoxGeometry(16, 1.3, 1.3),
    };
    this.mats = {
      cell: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.2, metalness: 0.1, emissiveIntensity: 1.5 }),
      rock: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
      debris: new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.7, roughness: 0.35 }),
      panel: new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.4, roughness: 0.3, emissiveIntensity: 0.15 }),
      meteor: new THREE.MeshStandardMaterial({ color: '#3a2a22', flatShading: true, roughness: 0.8, emissiveIntensity: 1.3 }),
      shieldCore: new THREE.MeshStandardMaterial({ flatShading: true, emissiveIntensity: 1.4 }),
      shieldCage: new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
      bullet: new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    this.setTheme(theme);
  }

  setTheme(th) {
    this.theme = th;
    const m = this.mats;
    m.cell.color.set(th.cell);
    m.cell.emissive.set(th.cell);
    m.rock.color.set(th.asteroid);
    m.debris.color.set(th.debris);
    m.panel.color.set(th.panel);
    m.panel.emissive.set(th.panel);
    m.meteor.emissive.set(th.meteor);
    m.shieldCore.color.set(th.shield);
    m.shieldCore.emissive.set(th.shield);
    m.shieldCage.color.set(th.shield);
    m.bullet.color.set(th.laser);
  }

  // 讓物件出現在畫面右側外面的局部角度
  spawnAngle(radius) {
    const c = this.ctx;
    const cosT = THREE.MathUtils.clamp((c.rightX + 70 - c.ex) / radius, -1, 0.999);
    return Math.acos(cosT) - c.rot;
  }

  randomAlt(pad = 0) {
    const c = this.ctx;
    return rand(c.altMin + pad, c.altMax - pad);
  }

  _add(type, mesh, angle, radius, props = {}) {
    this.holder.add(mesh);
    const e = {
      type, mesh, angle, radius, alive: true, size: 1, hitR: 8, hp: 1, va: 0, vr: 0, bump: 0, t: 0,
      spin: new THREE.Vector3(rand(-1.5, 1.5), rand(-1.5, 1.5), rand(-1.5, 1.5)),
      ...props,
    };
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    mesh.scale.setScalar(e.size);
    this.list.push(e);
    return e;
  }

  addCell(angle, radius) {
    return this._add('cell', new THREE.Mesh(this.geos.cell, this.mats.cell), angle, radius, { hitR: 10, spin: new THREE.Vector3(0, 2.5, 0.6) });
  }

  // 能量晶體串：沿軌道排成波浪
  spawnCells() {
    const c = this.ctx;
    const n = 5 + Math.floor(Math.random() * 5);
    const base = this.randomAlt(12);
    const amp = rand(0, (c.altMax - c.altMin) * 0.28);
    const phase = rand(0, Math.PI * 2);
    const a0 = this.spawnAngle(c.R + base + amp);
    for (let i = 0; i < n; i++) {
      const alt = THREE.MathUtils.clamp(base + amp * Math.sin(phase + i * 0.7), c.altMin, c.altMax);
      const r = c.R + alt;
      this.addCell(a0 - (i * 17) / r, r);
    }
  }

  spawnAsteroids(level, combat, baseHp = 2) {
    const c = this.ctx;
    const n = 1 + Math.floor(Math.random() * (level > 1 ? 3 : 2));
    for (let i = 0; i < n; i++) {
      const size = rand(7, 11 + Math.min(level, 6));
      const r = c.R + this.randomAlt(size * 0.5);
      const geo = this.geos.rocks[Math.floor(Math.random() * this.geos.rocks.length)];
      this._add('asteroid', new THREE.Mesh(geo, this.mats.rock), this.spawnAngle(r) - (i * rand(25, 55)) / r, r, {
        size, hitR: size * 0.85, hp: combat ? baseHp + Math.floor(size / 12) : 1,
      });
    }
  }

  spawnDebris(combat) {
    const c = this.ctx;
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geos.body, this.mats.debris);
    const p1 = new THREE.Mesh(this.geos.panel, this.mats.panel);
    p1.position.z = 11;
    const p2 = new THREE.Mesh(this.geos.panel, this.mats.panel);
    p2.position.z = -11;
    p2.rotation.x = 0.7; // 斷掉歪一邊的太陽能板
    const dish = new THREE.Mesh(this.geos.dish, this.mats.debris);
    dish.position.y = 4.5;
    dish.rotation.x = Math.PI;
    g.add(body, p1, p2, dish);
    const r = c.R + this.randomAlt(12);
    this._add('debris', g, this.spawnAngle(r), r, {
      size: 1.1, hitR: 13, hp: combat ? 3 : 1,
      spin: new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2.5, 2.5)),
    });
  }

  spawnMeteor(alt, combat) {
    const c = this.ctx;
    const r = c.R + alt;
    const geo = this.geos.rocks[Math.floor(Math.random() * this.geos.rocks.length)];
    this._add('meteor', new THREE.Mesh(geo, this.mats.meteor), this.spawnAngle(r), r, {
      size: 9, hitR: 9, hp: combat ? 2 : 1, va: c.omega * 1.8 + 0.12, vr: -6,
      spin: new THREE.Vector3(4, 3, 5),
    });
  }

  spawnShield() {
    const c = this.ctx;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.geos.shieldCore, this.mats.shieldCore), new THREE.Mesh(this.geos.shieldCage, this.mats.shieldCage));
    const r = c.R + this.randomAlt(15);
    this._add('shield', g, this.spawnAngle(r), r, { hitR: 12, spin: new THREE.Vector3(0.8, 1.6, 0.4) });
  }

  fireBullet(x, y) {
    const mesh = new THREE.Mesh(this.geos.bullet, this.mats.bullet);
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);
    this.bullets.push({ mesh, x, y, life: 1.4, alive: true });
    this.particles.emit(x, y, 0, 40, 0, 0, 3, 0.12, this.theme.laser);
  }

  // 物件爆散特效
  explode(e, big = true) {
    const c = this.ctx;
    const wa = e.angle + c.rot;
    const vx = -Math.sin(wa) * c.omega * e.radius, vy = Math.cos(wa) * c.omega * e.radius;
    const color = e.type === 'debris' ? this.theme.debris : e.type === 'meteor' ? this.theme.meteor : this.theme.asteroid;
    this.particles.burst(e.wx, e.wy, 0, { color, count: big ? 14 : 6, speed: 95, size: Math.max(1.5, e.size * 0.32), life: 1, vx, vy });
    this.particles.burst(e.wx, e.wy, 0, { color: '#ffcf8a', count: big ? 18 : 6, speed: 150, size: 2.2, life: 0.5, glow: true, vx, vy });
  }

  _remove(e) {
    e.alive = false;
    this.holder.remove(e.mesh);
  }

  // info：{ active, sx, sy, sr }；回傳事件陣列交給 main 處理
  update(dt, info) {
    const c = this.ctx;
    const events = [];

    for (const b of this.bullets) {
      b.x += info.bulletSpeed * dt;
      b.life -= dt;
      b.mesh.position.x = b.x;
      if (b.life <= 0 || b.x > c.rightX + 120) b.alive = false;
    }

    for (const e of this.list) {
      if (!e.alive) continue;
      e.t += dt;
      e.angle += e.va * dt;
      e.radius += e.vr * dt;
      e.mesh.position.set(Math.cos(e.angle) * e.radius, Math.sin(e.angle) * e.radius, 0);
      e.mesh.rotation.x += e.spin.x * dt;
      e.mesh.rotation.y += e.spin.y * dt;
      e.mesh.rotation.z += e.spin.z * dt;
      e.bump = Math.max(0, e.bump - dt * 6);
      const pulse = e.type === 'cell' || e.type === 'shield' ? 1 + Math.sin(e.t * 6) * 0.08 : 1;
      e.mesh.scale.setScalar(e.size * pulse * (1 + e.bump * 0.35));

      const wa = e.angle + c.rot;
      e.wx = c.ex + Math.cos(wa) * e.radius;
      e.wy = c.ey + Math.sin(wa) * e.radius;
      if (e.wx < c.leftX - 120 || e.radius < c.R - 10) {
        this._remove(e);
        continue;
      }

      if (e.type === 'meteor') {
        for (let k = 0; k < 2; k++) {
          this.particles.emit(e.wx + rand(-3, 3), e.wy + rand(-3, 3), rand(-3, 3), rand(20, 60), rand(-10, 10), 0, rand(2, 4.5), rand(0.3, 0.6), k ? '#ffd27a' : this.theme.meteor);
        }
      }

      if (!info.active) continue;

      // 與太空船碰撞
      if (Math.hypot(e.wx - info.sx, e.wy - info.sy) < e.hitR + info.sr) {
        if (e.type === 'cell') {
          events.push({ type: 'collect', x: e.wx, y: e.wy });
          this.particles.burst(e.wx, e.wy, 0, { color: this.theme.cell, count: 8, speed: 70, size: 1.8, life: 0.45, glow: true });
        } else if (e.type === 'shield') {
          events.push({ type: 'shield', x: e.wx, y: e.wy });
          this.particles.burst(e.wx, e.wy, 0, { color: this.theme.shield, count: 20, speed: 110, size: 2.2, life: 0.6, glow: true });
        } else {
          events.push({ type: 'hit', x: e.wx, y: e.wy });
          this.explode(e);
        }
        this._remove(e);
        continue;
      }

      // 與雷射碰撞
      if (HAZARDS.has(e.type)) {
        for (const b of this.bullets) {
          if (!b.alive || Math.abs(b.x - e.wx) > e.hitR + 8 || Math.abs(b.y - e.wy) > e.hitR + 2) continue;
          b.alive = false;
          e.hp -= 1;
          e.bump = 1;
          this.particles.burst(b.x + 6, b.y, 0, { color: this.theme.laser, count: 5, speed: 80, size: 1.6, life: 0.3, glow: true });
          if (e.hp <= 0) {
            events.push({ type: 'kill', x: e.wx, y: e.wy, kind: e.type, angle: e.angle, radius: e.radius });
            this.explode(e);
            this._remove(e);
            break;
          }
          events.push({ type: 'ping' });
        }
      }
    }

    for (const b of this.bullets) if (!b.alive) this.scene.remove(b.mesh);
    this.bullets = this.bullets.filter((b) => b.alive);
    this.list = this.list.filter((e) => e.alive);
    return events;
  }

  clear() {
    for (const e of this.list) this.holder.remove(e.mesh);
    for (const b of this.bullets) this.scene.remove(b.mesh);
    this.list = [];
    this.bullets = [];
  }
}
