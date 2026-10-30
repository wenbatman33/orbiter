// 粒子系統：InstancedMesh 物件池（碎片 solid ＋ 發光 glow）
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

class Pool {
  constructor(scene, geo, mat, max, additive) {
    this.max = max;
    this.additive = additive;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.r = new Float32Array(max * 3);
    this.rv = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, _c.set(1, 1, 1));
    }
    scene.add(this.mesh);
  }

  spawn(x, y, z, vx, vy, vz, size, life, color, drag) {
    let i = this.cursor;
    for (let k = 0; k < this.max; k++) {
      const j = (this.cursor + k) % this.max;
      if (this.life[j] <= 0) {
        i = j;
        break;
      }
    }
    this.cursor = (i + 1) % this.max;
    const i3 = i * 3;
    this.p.set([x, y, z], i3);
    this.v.set([vx, vy, vz], i3);
    this.r.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i3);
    this.rv.set([(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10], i3);
    _c.set(color);
    this.col.set([_c.r, _c.g, _c.b], i3);
    if (!this.additive) this.mesh.setColorAt(i, _c);
    this.life[i] = this.maxLife[i] = life;
    this.size[i] = size;
    this.drag[i] = drag;
  }

  update(dt) {
    const { p, v, r, rv, life } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      for (let k = 0; k < 3; k++) {
        v[i3 + k] *= d;
        p[i3 + k] += v[i3 + k] * dt;
        r[i3 + k] += rv[i3 + k] * dt;
      }
      const k = life[i] / this.maxLife[i];
      const sc = this.size[i] * (this.additive ? k : Math.min(1, k * 2.5));
      _p.set(p[i3], p[i3 + 1], p[i3 + 2]);
      _q.setFromEuler(_e.set(r[i3], r[i3 + 1], r[i3 + 2]));
      _s.set(sc, sc, sc);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (this.additive) this.mesh.setColorAt(i, _c.setRGB(this.col[i3] * k, this.col[i3 + 1] * k, this.col[i3 + 2] * k));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.solid = new Pool(scene, new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), 400, false);
    this.glow = new Pool(scene, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 900, true);
  }

  // 爆散：vx / vy 為繼承速度（例如隨地球轉動的切線速度）
  burst(x, y, z, { color = '#ffffff', count = 12, speed = 80, size = 3, life = 0.8, glow = false, vx = 0, vy = 0, drag = 1.5 } = {}) {
    const pool = glow ? this.glow : this.solid;
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = speed * (0.35 + Math.random() * 0.65);
      pool.spawn(x, y, z, vx + Math.cos(a) * r * sp, vy + Math.sin(a) * r * sp, u * sp * 0.6, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), color, drag);
    }
  }

  emit(x, y, z, vx, vy, vz, size, life, color, glow = true, drag = 2) {
    (glow ? this.glow : this.solid).spawn(x, y, z, vx, vy, vz, size, life, color, drag);
  }

  update(dt) {
    this.solid.update(dt);
    this.glow.update(dt);
  }

  clear() {
    this.solid.clear();
    this.glow.clear();
  }
}
