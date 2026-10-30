// 太空船模型（原創低多邊形造型）：機頭朝 +x，機翼往 ±z 延伸
import * as THREE from 'three';

export function createShip(theme) {
  const group = new THREE.Group(); // 世界位置
  const model = new THREE.Group(); // 姿態動畫（俯仰、翻滾、晃動）
  group.add(model);

  const hullMat = new THREE.MeshStandardMaterial({ color: theme.hull, flatShading: true, roughness: 0.45, metalness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({ color: theme.accent, flatShading: true, roughness: 0.5, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2a3140', flatShading: true, roughness: 0.6, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: theme.glass, emissive: theme.glass, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.6, flatShading: true });
  const flameMat = new THREE.MeshBasicMaterial({ color: theme.flame, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });

  // 機身：旋轉體，沿 y 建模後轉成沿 +x
  const profile = [[0, -13], [4, -12.5], [6.2, -9], [7, -3], [6.4, 4], [4.2, 9.5], [1.6, 13.5], [0, 14.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 10);
  bodyGeo.rotateZ(-Math.PI / 2);
  model.add(new THREE.Mesh(bodyGeo, hullMat));

  // 機身色帶
  const bandGeo = new THREE.CylinderGeometry(7.15, 6.95, 3, 10, 1, true);
  bandGeo.rotateZ(-Math.PI / 2);
  const band = new THREE.Mesh(bandGeo, accentMat);
  band.position.x = -2.5;
  model.add(band);

  // 座艙罩
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  cockpit.scale.set(1.6, 1, 1);
  cockpit.position.set(4, 4.4, 0);
  model.add(cockpit);

  // 機翼（後掠三角翼）
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-9, 0);
  wingShape.lineTo(5, 0);
  wingShape.lineTo(-5, 17);
  wingShape.lineTo(-11, 17);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 1.6, bevelEnabled: false });
  wingGeo.translate(0, 0, -0.8);
  const wingNear = new THREE.Mesh(wingGeo.clone().rotateX(Math.PI / 2), accentMat);
  const wingFar = new THREE.Mesh(wingGeo.clone().rotateX(-Math.PI / 2), accentMat);
  wingNear.position.y = wingFar.position.y = -1.5;
  model.add(wingNear, wingFar);

  // 垂直尾翼
  const finShape = new THREE.Shape();
  finShape.moveTo(-13, 3);
  finShape.lineTo(-5, 3);
  finShape.lineTo(-11, 13);
  finShape.lineTo(-14.5, 13);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 1.2, bevelEnabled: false });
  finGeo.translate(0, 0, -0.6);
  model.add(new THREE.Mesh(finGeo, accentMat));

  // 翼端引擎艙
  const podGeo = new THREE.CylinderGeometry(2.2, 2.7, 10, 8);
  podGeo.rotateZ(-Math.PI / 2);
  for (const z of [11, -11]) {
    const pod = new THREE.Mesh(podGeo, darkMat);
    pod.position.set(-6, -1.5, z);
    model.add(pod);
  }

  // 天線與閃爍燈
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 5), darkMat);
  antenna.position.set(-1, 8.5, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lampMat);
  lamp.position.set(-1, 10.8, 0);
  model.add(antenna, lamp);

  // 尾焰：底在原點、尖端朝 -x 的單位圓錐
  const flameGeo = new THREE.ConeGeometry(1, 1, 10);
  flameGeo.rotateZ(Math.PI / 2);
  flameGeo.translate(-0.5, 0, 0);
  const flames = [];
  const addFlame = (x, y, z, s) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const outer = new THREE.Mesh(flameGeo, flameMat);
    const inner = new THREE.Mesh(flameGeo, coreMat);
    g.add(outer, inner);
    model.add(g);
    flames.push({ g, outer, inner, s });
  };
  addFlame(-12.6, 0, 0, 1.25);
  addFlame(-11, -1.5, 11, 0.8);
  addFlame(-11, -1.5, -11, 0.8);

  // 護盾泡泡
  const shieldMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(theme.shield) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float bands = 0.5 + 0.5 * sin(vP.y * 0.7 + uTime * 5.0);
        gl_FragColor = vec4(uColor, (f * 0.9 + 0.06 + bands * 0.06) * uAlpha);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(24, 3), shieldMat);
  shield.visible = false;
  group.add(shield);

  const red = new THREE.Color('#ff2a2a');
  const black = new THREE.Color(0, 0, 0);

  return {
    group,
    model,
    nozzles: flames.map((f) => f.g),
    hitRadius: 12,
    setColors(th) {
      hullMat.color.set(th.hull);
      accentMat.color.set(th.accent);
      glassMat.color.set(th.glass);
      glassMat.emissive.set(th.glass);
      flameMat.color.set(th.flame);
      shieldMat.uniforms.uColor.value.set(th.shield);
    },
    // thrust：尾焰強度；flash：受擊閃紅 0~1；shield：護盾透明度 0~1
    update(dt, t, { thrust = 1, flash = 0, shield: sh = 0 } = {}) {
      for (const f of flames) {
        const flick = 0.8 + Math.random() * 0.4;
        f.outer.scale.set(9 * f.s * thrust * flick, 2.4 * f.s, 2.4 * f.s);
        f.inner.scale.set(5 * f.s * thrust * flick, 1.2 * f.s, 1.2 * f.s);
      }
      lamp.visible = t % 1.2 < 0.15;
      hullMat.emissive.copy(black).lerp(red, flash);
      accentMat.emissive.copy(black).lerp(red, flash * 0.6);
      shield.visible = sh > 0.001;
      shieldMat.uniforms.uAlpha.value = sh;
      shieldMat.uniforms.uTime.value = t;
    },
  };
}
