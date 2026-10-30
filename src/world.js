// 場景：低多邊形地球、雲層、大氣光暈、星空、星雲、太陽、月球、燈光
import * as THREE from 'three';
import { fbm3, noise3, mulberry32 } from './noise.js';

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function nebulaTexture() {
  const w = 1024, h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  const rnd = mulberry32(11);
  const palette = ['110,60,200', '40,90,220', '190,60,150', '30,150,200'];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w, y = h * (0.15 + rnd() * 0.7), r = 50 + rnd() * 200;
    const col = palette[Math.floor(rnd() * palette.length)];
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${col},${0.08 + rnd() * 0.1})`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 地球幾何：單位球，陸地依雜訊外推；每個面記錄平均高度供上色
function buildEarthGeometry(theme) {
  const geo = new THREE.IcosahedronGeometry(1, 36);
  const pos = geo.attributes.position;
  const n = pos.count;
  const elev = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const e = fbm3(v.x * 1.7 + 3.1, v.y * 1.7 - 1.3, v.z * 1.7 + 7.7, 5, theme.earthSeed);
    elev[i] = e;
    v.multiplyScalar(1 + Math.max(0, e - theme.seaLevel) * 0.09);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.computeVertexNormals();
  geo.userData = { elev, seed: theme.earthSeed, sea: theme.seaLevel };
  return geo;
}

function paintEarth(geo, theme) {
  const { elev } = geo.userData;
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  const sea = theme.seaLevel;
  const C = (k) => new THREE.Color(theme[k]);
  const deep = C('deepOcean'), ocean = C('ocean'), shallow = C('shallow'), sand = C('sand');
  const grass = C('grass'), forest = C('forest'), rock = C('rock'), snow = C('snow');
  const tmp = new THREE.Color();
  const v = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    const e = (elev[f] + elev[f + 1] + elev[f + 2]) / 3;
    v.set(pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2), pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2), pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)).normalize();
    // 自轉軸為 z（兩極正對鏡頭下方），不做極冠以免畫面下方出現不動的白斑
    if (e < sea - 0.12) tmp.copy(deep);
    else if (e < sea - 0.04) tmp.lerpColors(deep, ocean, (e - (sea - 0.12)) / 0.08);
    else if (e < sea) tmp.lerpColors(ocean, shallow, (e - (sea - 0.04)) / 0.04);
    else if (e < sea + 0.015) tmp.copy(sand);
    else if (e < sea + 0.08) tmp.copy(grass);
    else if (e < sea + 0.15) tmp.copy(forest);
    else if (e < sea + 0.2) tmp.copy(rock);
    else tmp.copy(snow);
    tmp.offsetHSL(0, 0, (noise3(v.x * 40, v.y * 40, v.z * 40, 9) - 0.5) * 0.06);
    for (let k = 0; k < 3; k++) col.setXYZ(f + k, tmp.r, tmp.g, tmp.b);
  }
  col.needsUpdate = true;
}

// 低多邊形雲：一團團扁平的二十面體，集中在可見的赤道帶
function buildClouds(material, R, alt) {
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const clusters = 120, per = 5;
  const mesh = new THREE.InstancedMesh(puff, material, clusters * per);
  const rnd = mulberry32(42);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const dir = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let idx = 0;
  for (let c = 0; c < clusters; c++) {
    const a = rnd() * Math.PI * 2;
    const z = (rnd() * 2 - 1) * 0.55;
    const rxy = Math.sqrt(1 - z * z);
    dir.set(Math.cos(a) * rxy, Math.sin(a) * rxy, z);
    t1.set(-dir.y, dir.x, 0).normalize();
    t2.crossVectors(dir, t1);
    q.setFromUnitVectors(up, dir);
    const size = 7 + rnd() * 9;
    for (let k = 0; k < per; k++) {
      const mid = Math.abs(k - (per - 1) / 2);
      const off = (k - (per - 1) / 2) * size * 0.9 + (rnd() - 0.5) * size * 0.5;
      const sc = size * (0.6 + rnd() * 0.6) * (1 - mid * 0.18);
      p.copy(dir).multiplyScalar(R + alt + rnd() * 4).addScaledVector(t1, off).addScaledVector(t2, (rnd() - 0.5) * size * 0.8);
      s.set(sc, sc * 0.55, sc * 0.8);
      m.compose(p, q, s);
      mesh.setMatrixAt(idx++, m);
    }
  }
  return mesh;
}

function buildMoonGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = noise3(v.x * 3.2 + 5, v.y * 3.2, v.z * 3.2, 21);
    v.multiplyScalar(1 - Math.max(0, n - 0.62) * 0.35); // 坑洞
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const colors = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count; f += 3) {
    v.fromBufferAttribute(pos, f);
    const g = 0.62 + fbm3(v.x * 2.5, v.y * 2.5, v.z * 2.5, 3, 4) * 0.5;
    for (let k = 0; k < 3; k++) colors.set([g, g, g], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildStars(count = 2600) {
  const rnd = mulberry32(7);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * r * 5200, Math.sin(a) * r * 5200, u * 5200], i * 3);
    const t = rnd();
    c.set(t < 0.1 ? '#9fc4ff' : t < 0.18 ? '#ffd9a0' : '#ffffff').multiplyScalar(0.45 + rnd() * 0.75);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']], 64);
  const mat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(geo, mat);
}

const fresnelVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export function createWorld(scene, theme) {
  const W = {};

  // 背景星空與星雲
  W.stars = buildStars();
  scene.add(W.stars);
  W.nebula = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 6000),
    new THREE.MeshBasicMaterial({ map: nebulaTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  W.nebula.position.set(0, 600, -4300);
  scene.add(W.nebula);

  // 太陽（Sprite 光暈 + 平行光）
  W.sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture([[0, 'rgba(255,255,255,1)'], [0.07, 'rgba(255,250,235,1)'], [0.18, 'rgba(255,225,170,0.55)'], [0.42, 'rgba(255,170,90,0.14)'], [1, 'rgba(255,140,60,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(W.sun);
  W.sunLight = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(W.sunLight, W.sunLight.target);
  W.ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(W.ambient);

  // 月球
  W.moonMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  W.moon = new THREE.Mesh(buildMoonGeometry(), W.moonMat);
  scene.add(W.moon);

  // 地球群組（位置 = 地球中心）
  W.earthGroup = new THREE.Group();
  scene.add(W.earthGroup);
  W.earthMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
  W.earth = new THREE.Mesh(buildEarthGeometry(theme), W.earthMat);
  W.earthGroup.add(W.earth);

  W.cloudMat = new THREE.MeshStandardMaterial({ color: theme.cloud, flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
  W.cloudGroup = new THREE.Group();
  W.earthGroup.add(W.cloudGroup);
  W.cloudKey = '';

  // 大氣：外圈背面光暈（越靠近地平線越亮）
  W.atmoMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 1 }, uLimb: { value: 0.45 } },
    vertexShader: fresnelVert,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity; uniform float uLimb;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float d = clamp(-dot(normalize(vN), normalize(vV)) / uLimb, 0.0, 1.0);
        gl_FragColor = vec4(uColor, pow(d, 2.2) * uIntensity);
      }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  W.atmo = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), W.atmoMat);
  W.earthGroup.add(W.atmo);

  // 大氣：地表邊緣的菲涅耳薄霧
  W.hazeMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 1 } },
    vertexShader: fresnelVert,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0);
        gl_FragColor = vec4(uColor, f * uIntensity);
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  W.haze = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), W.hazeMat);
  W.earthGroup.add(W.haze);

  W.apply = (L, th) => {
    const R = L.earth.radius;
    W.earthGroup.position.set(L.earth.x, L.earth.y, 0);
    W.earth.scale.setScalar(R);
    const s = L.earth.atmoScale;
    W.atmo.scale.setScalar(R * s);
    W.atmoMat.uniforms.uLimb.value = Math.sqrt(Math.max(0.0001, 1 - 1 / (s * s)));
    W.atmoMat.uniforms.uIntensity.value = L.earth.atmoIntensity;
    W.haze.scale.setScalar(R * 1.015);
    W.hazeMat.uniforms.uIntensity.value = L.earth.hazeIntensity;

    // 雲層半徑 / 高度改變才重建
    const key = `${R}|${L.earth.cloudAlt}`;
    if (key !== W.cloudKey) {
      W.cloudKey = key;
      W.cloudGroup.children.forEach((c) => {
        c.geometry.dispose();
        c.dispose();
      });
      W.cloudGroup.clear();
      W.cloudGroup.add(buildClouds(W.cloudMat, R, L.earth.cloudAlt));
    }

    W.sun.position.set(L.sun.x, L.sun.y, L.sun.z);
    W.sun.scale.setScalar(L.sun.size);
    W.sunLight.position.set(L.sun.x, L.sun.y, L.sun.z);
    W.sunLight.target.position.set(L.earth.x, L.earth.y, 0);
    W.sunLight.intensity = L.sun.intensity;

    W.moon.position.set(L.moon.x, L.moon.y, L.moon.z);
    W.moon.scale.setScalar(L.moon.radius);

    W.stars.material.size = L.space.starSize;
    W.stars.material.opacity = L.space.starOpacity;
    W.nebula.material.opacity = L.space.nebulaOpacity;
    W.ambient.intensity = L.space.ambient;
  };

  W.applyTheme = (th) => {
    const g = W.earth.geometry;
    if (g.userData.seed !== th.earthSeed || g.userData.sea !== th.seaLevel) {
      g.dispose();
      W.earth.geometry = buildEarthGeometry(th);
    }
    paintEarth(W.earth.geometry, th);
    W.cloudMat.color.set(th.cloud);
    W.moonMat.color.set(th.moonColor);
    W.atmoMat.uniforms.uColor.value.set(th.atmoColor);
    W.hazeMat.uniforms.uColor.value.set(th.atmoColor);
    W.sun.material.color.set(th.sunColor);
    W.sunLight.color.set(th.sunColor);
    W.ambient.color.set(th.ambientColor);
    scene.background = new THREE.Color(th.bgColor);
  };

  W.update = (dt, omega) => {
    W.earth.rotation.z += omega * dt;
    W.cloudGroup.rotation.z += omega * dt * 1.12; // 雲比地表快一點，增加層次
    W.moon.rotation.y += dt * 0.03;
    W.stars.rotation.z += omega * dt * 0.02;
  };

  return W;
}
