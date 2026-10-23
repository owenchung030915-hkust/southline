import * as THREE from 'three';
import { clamp } from './math.js';
import {
  CAR_PARK, CLINIC, LOOP, ROAD_HALF, ROAD_XS, ROAD_ZS, WATER_Z, WORLD, onRoad,
} from './layout.js';
import { createCarVisual } from './vehicle.js';

const SPAN = 160;
const ORIGIN = 80;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circleHits(x, z, r, b) {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

function pushOut(pos, radius, b) {
  const cx = clamp(pos.x, b.minX, b.maxX);
  const cz = clamp(pos.z, b.minZ, b.maxZ);
  let dx = pos.x - cx;
  let dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > 0.000001 && d2 < radius * radius) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    pos.x += dx * push;
    pos.z += dz * push;
    return true;
  }
  if (d2 <= 0.000001 && pos.x > b.minX && pos.x < b.maxX && pos.z > b.minZ && pos.z < b.maxZ) {
    const left = pos.x - b.minX;
    const right = b.maxX - pos.x;
    const back = pos.z - b.minZ;
    const fwd = b.maxZ - pos.z;
    const m = Math.min(left, right, back, fwd);
    if (m === left) pos.x = b.minX - radius;
    else if (m === right) pos.x = b.maxX + radius;
    else if (m === back) pos.z = b.minZ - radius;
    else pos.z = b.maxZ + radius;
    return true;
  }
  return false;
}

const TIMES = {
  day: {
    skyTop: '#8ec4ea', skyHorizon: '#d5e7f4', skyBottom: '#c5d0c2',
    fog: '#d5dde6', ambient: '#d0d8e4', ambientInt: 0.78,
    hemiSky: '#dbe7f5', hemiGround: '#6d7270', hemiInt: 0.55,
    sun: '#fff4dd', sunInt: 2.15, sunPos: [30, 70, 18], exposure: 1.05,
    window: 0.08, neon: 0.25, lamp: 0, head: 0.4,
  },
  dusk: {
    skyTop: '#1a1444', skyHorizon: '#e36a3c', skyBottom: '#2a1426',
    fog: '#3a2436', ambient: '#3c345c', ambientInt: 0.42,
    hemiSky: '#6a4a78', hemiGround: '#2a2018', hemiInt: 0.48,
    sun: '#ff9955', sunInt: 1.45, sunPos: [48, 16, -10], exposure: 1.02,
    window: 0.85, neon: 1.15, lamp: 2.4, head: 3.5,
  },
  night: {
    skyTop: '#05060e', skyHorizon: '#151a30', skyBottom: '#07060c',
    fog: '#0c1018', ambient: '#1a2244', ambientInt: 0.32,
    hemiSky: '#243056', hemiGround: '#121018', hemiInt: 0.4,
    sun: '#b9c6ff', sunInt: 0.28, sunPos: [-20, 36, 24], exposure: 0.95,
    window: 1.15, neon: 1.45, lamp: 3.4, head: 6,
  },
};

function makeSign(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = fg;
  g.font = '700 78px Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 84);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: fg,
    emissiveMap: tex,
    emissiveIntensity: 1,
    roughness: 0.45,
  });
  return mat;
}

function paintGround() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const px = (v) => ((v + ORIGIN) / SPAN) * S;
  g.fillStyle = '#2a2d34';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.14)';
    g.fillRect(Math.random() * S, Math.random() * S, 3, 2);
  }

  const sidewalk = (x, z, w, h) => {
    g.fillStyle = '#3c414b';
    g.fillRect(px(x), px(z), px(x + w) - px(x), px(z + h) - px(z));
  };
  for (const x of ROAD_XS) {
    sidewalk(x - 11, -58, 22, 132);
  }
  for (const z of ROAD_ZS) {
    sidewalk(-78, z - 11, 156, 22);
  }

  g.fillStyle = '#4a5148';
  g.fillRect(px(8), px(-28), px(28) - px(8), px(-8) - px(-28));
  g.strokeStyle = 'rgba(230,230,220,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const z = -26 + i * 4.2;
    g.beginPath();
    g.moveTo(px(11), px(z));
    g.lineTo(px(25), px(z));
    g.stroke();
  }

  g.fillStyle = '#8a6844';
  g.fillRect(px(-78), px(-58), px(78) - px(-78), px(-42) - px(-58));
  g.fillStyle = 'rgba(90,70,50,0.35)';
  for (let x = -70; x < 70; x += 4) {
    g.fillRect(px(x), px(-56), 2, px(-44) - px(-56));
  }

  const road = (x, z, w, h) => {
    g.fillStyle = '#17191e';
    g.fillRect(px(x), px(z), px(x + w) - px(x), px(z + h) - px(z));
  };
  for (const x of ROAD_XS) road(x - ROAD_HALF, -60, ROAD_HALF * 2, 136);
  for (const z of ROAD_ZS) road(-78, z - ROAD_HALF, 156, ROAD_HALF * 2);

  g.strokeStyle = 'rgba(230, 190, 70, 0.85)';
  g.lineWidth = 2;
  g.setLineDash([14, 16]);
  for (const x of ROAD_XS) {
    g.beginPath();
    g.moveTo(px(x), px(-58));
    g.lineTo(px(x), px(70));
    g.stroke();
  }
  for (const z of ROAD_ZS) {
    g.beginPath();
    g.moveTo(px(-74), px(z));
    g.lineTo(px(74), px(z));
    g.stroke();
  }
  g.setLineDash([]);

  g.fillStyle = '#f2f2ea';
  for (const x of ROAD_XS) {
    for (const z of ROAD_ZS) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(px(x - 6), px(z + i * 1.15 - 0.25), px(x - 2.2) - px(x - 6), 3);
        g.fillRect(px(x + 2.2), px(z + i * 1.15 - 0.25), px(x + 6) - px(x + 2.2), 3);
      }
    }
  }

  g.fillStyle = 'rgba(210, 200, 180, 0.18)';
  g.beginPath();
  g.arc(px(0), px(0), (8 / SPAN) * S, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.translate(px(0), px(-48));
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = '700 42px Oswald, Impact, sans-serif';
  g.textAlign = 'center';
  g.fillText('DOCKS', 0, 0);
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const skyVert = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFrag = `
  varying vec3 vPos;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  void main() {
    float h = normalize(vPos).y;
    vec3 col = mix(horizonColor, topColor, smoothstep(0.0, 0.65, h));
    col = mix(bottomColor, col, smoothstep(-0.35, 0.08, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;
const waterFrag = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    float w = sin(vUv.x * 28.0 + time) * sin(vUv.y * 18.0 - time * 0.8);
    vec3 deep = vec3(0.02, 0.07, 0.11);
    vec3 crest = vec3(0.18, 0.38, 0.42);
    vec3 col = mix(deep, crest, w * 0.5 + 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`;
const waterVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function createWorld(scene, renderer) {
  const rng = mulberry32(4096);
  const blocks = [];
  const neonMats = [];
  const signMats = [];

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      bottomColor: { value: new THREE.Color() },
    },
    vertexShader: skyVert,
    fragmentShader: skyFrag,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), skyMat);
  scene.add(sky);

  const groundTex = paintGround();
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.86, metalness: 0.04 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const waterUniforms = { time: { value: 0 } };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 36, 1, 1),
    new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: waterVert, fragmentShader: waterFrag }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.05, -67);
  scene.add(water);

  const hemi = new THREE.HemisphereLight('#8899bb', '#222026', 0.5);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffffff', 0.25);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff2d6', 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  const pmrem = new THREE.PMREMGenerator(renderer);
  importEnvironment(scene, renderer, pmrem);

  const windowGeo = new THREE.BoxGeometry(0.7, 0.95, 0.08);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#10151c', roughness: 0.15, metalness: 0.55,
  });
  const litMat = new THREE.MeshStandardMaterial({
    color: '#ffd2a2', emissive: '#ffb068', emissiveIntensity: 0.8, roughness: 0.4,
  });
  const darkWindows = [];
  const litWindows = [];

  function addBlock(cx, cz, w, d, h, minY = 0) {
    blocks.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
      minY, maxY: minY + h,
    });
  }

  const palette = ['#6e727c', '#7d6558', '#5c6470', '#8a705f', '#4e5966', '#6a5a68', '#7a7e86'];
  const signs = [
    ['RAMEN', '#ffb15a', '#1a0e08'],
    ['MOTEL', '#ff5d7a', '#180810'],
    ['PAWN', '#7dffa8', '#06140c'],
    ['BAR', '#8ec6ff', '#081018'],
    ['24HR', '#ffe38a', '#161208'],
    ['DOCKS', '#ffd0a8', '#140e0a'],
  ];

  function addBuilding(x0, x1, z0, z1) {
    const inset = 0.7;
    const w = x1 - x0 - inset * 2;
    const d = z1 - z0 - inset * 2;
    if (w < 5 || d < 5) return;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const tall = rng() > 0.72;
    const h = tall ? 18 + rng() * 16 : 7 + rng() * 9;
    const color = palette[Math.floor(rng() * palette.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.06 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addBlock(cx, cz, w, d, h);

    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
      new THREE.MeshStandardMaterial({ color: '#2c3038', roughness: 0.7 }),
    );
    ledge.position.set(cx, h + 0.15, cz);
    ledge.castShadow = true;
    scene.add(ledge);

    if (tall && rng() > 0.4) {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.8, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: '#3a4048', roughness: 0.6, metalness: 0.2 }),
      );
      tower.position.set(cx + w * 0.2, h + 1.4, cz);
      tower.castShadow = true;
      scene.add(tower);
    }

    const faces = [
      { axis: 'z', z: cz + d / 2 + 0.05, rot: 0, span: w, fixed: cx },
      { axis: 'z', z: cz - d / 2 - 0.05, rot: Math.PI, span: w, fixed: cx },
      { axis: 'x', x: cx + w / 2 + 0.05, rot: Math.PI / 2, span: d, fixed: cz },
      { axis: 'x', x: cx - w / 2 - 0.05, rot: -Math.PI / 2, span: d, fixed: cz },
    ];
    for (const face of faces) {
      const count = Math.max(1, Math.floor(face.span / 2.3));
      const rows = Math.max(1, Math.floor((h - 2) / 2.4));
      for (let col = 0; col < count; col++) {
        for (let row = 0; row < rows; row++) {
          const along = -face.span / 2 + (col + 0.5) * (face.span / count);
          const y = 1.6 + row * 2.3;
          const lit = rng() > 0.45;
          const win = new THREE.Mesh(windowGeo, lit ? litMat : glassMat);
          win.castShadow = false;
          if (face.axis === 'z') {
            win.position.set(face.fixed + along, y, face.z);
            win.rotation.y = face.rot;
          } else {
            win.position.set(face.x, y, face.fixed + along);
            win.rotation.y = face.rot;
          }
          scene.add(win);
          (lit ? litWindows : darkWindows).push(win);
        }
      }
    }

    if (h < 20 && rng() > 0.35) {
      const spec = signs[Math.floor(rng() * signs.length)];
      const matSign = makeSign(spec[0], spec[1], spec[2]);
      signMats.push(matSign);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.05), matSign);
      const face = faces[Math.floor(rng() * 2)];
      board.position.set(cx, Math.min(h - 0.4, 4.2), face.z > cz ? cz + d / 2 + 0.12 : cz - d / 2 - 0.12);
      board.rotation.y = face.z > cz ? 0 : Math.PI;
      scene.add(board);
    }
  }

  const xBands = [[-70, -45], [-27.5, -8.5], [8.5, 27.5], [45, 70]];
  const zBands = [[-27.5, -8.5], [8.5, 27.5], [45, 68]];
  for (let ix = 0; ix < xBands.length; ix++) {
    for (let iz = 0; iz < zBands.length; iz++) {
      const [x0, x1] = xBands[ix];
      const [z0, z1] = zBands[iz];
      if (ix === 2 && iz === 0) continue;
      const w = x1 - x0;
      if (w > 23) {
        const mid = (x0 + x1) / 2;
        addBuilding(x0, mid - 1.5, z0, z1);
        addBuilding(mid + 1.5, x1, z0, z1);
      } else addBuilding(x0, x1, z0, z1);
    }
  }

  addBlock(0, 0, 1.7, 1.7, 2.3);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1, 1.3, 8),
    new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.55, metalness: 0.15 }),
  );
  plinth.position.y = 0.65;
  plinth.castShadow = true;
  scene.add(plinth);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    new THREE.MeshStandardMaterial({ color: '#d7b15a', roughness: 0.35, metalness: 0.4, emissive: '#5a3d10', emissiveIntensity: 0.2 }),
  );
  orb.position.y = 1.7;
  orb.castShadow = true;
  scene.add(orb);

  const clinic = new THREE.Group();
  const booth = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.3, 2.2),
    new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.7 }),
  );
  booth.position.y = 1.15;
  booth.castShadow = true;
  clinic.add(booth);
  const crossMat = new THREE.MeshStandardMaterial({
    color: '#b7ffcf', emissive: '#39e58a', emissiveIntensity: 1.4, roughness: 0.4,
  });
  neonMats.push(crossMat);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.08), crossMat);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.08), crossMat);
  crossV.position.set(0, 2.6, 1.12);
  crossH.position.set(0, 2.6, 1.12);
  clinic.add(crossV, crossH);
  clinic.position.set(CLINIC.x, 0, CLINIC.z);
  scene.add(clinic);
  addBlock(CLINIC.x, CLINIC.z, 2.4, 2.2, 2.3);

  addBlock(0, WATER_Z + 2.2, 150, 0.8, 0.45);

  const parked = [];
  const parkedColors = ['#3d4a5c', '#6a624e', '#2f343c', '#5c3a3a'];
  const spots = [
    [CAR_PARK.x - 4, CAR_PARK.z - 3, 0.4],
    [CAR_PARK.x + 4.5, CAR_PARK.z + 2, -0.3],
    [CAR_PARK.x, CAR_PARK.z + 5, 1.4],
    [-16, 10, 0.2],
  ];
  for (let i = 0; i < spots.length; i++) {
    const car = createCarVisual(parkedColors[i]);
    car.root.position.set(spots[i][0], 0, spots[i][1]);
    car.root.rotation.y = spots[i][2];
    scene.add(car.root);
    parked.push({ x: spots[i][0], z: spots[i][1], yaw: spots[i][2], r: 1.45 });
  }

  function tryProp(x, z, mesh, w, d, h) {
    if (onRoad(x, z, 0.4)) return;
    if (blocks.some((b) => circleHits(x, z, 0.8, b))) return;
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    addBlock(x, z, w, d, h);
  }
  const dumpMat = new THREE.MeshStandardMaterial({ color: '#2f4a38', roughness: 0.7, metalness: 0.15 });
  for (const [x, z] of [[-30, 14], [30, -14], [-52, 16], [52, -8], [14, 14]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.9), dumpMat);
    mesh.castShadow = true;
    tryProp(x, z, mesh, 1.5, 0.9, 1.2);
  }

  for (const [x, z] of [[-48, -46], [40, -46]]) {
    const mast = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 14, 0.45),
      new THREE.MeshStandardMaterial({ color: '#c45a28', roughness: 0.55 }),
    );
    mast.position.set(x, 7, z);
    mast.castShadow = true;
    scene.add(mast);
    addBlock(x, z, 0.7, 0.7, 14);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.28, 0.28),
      new THREE.MeshStandardMaterial({ color: '#d0d4da', roughness: 0.4, metalness: 0.3 }),
    );
    arm.position.set(x + 2.5, 12.5, z);
    scene.add(arm);
  }

  const skylineMat = new THREE.MeshStandardMaterial({ color: '#232733', roughness: 0.9 });
  for (let i = 0; i < 16; i++) {
    const h = 10 + rng() * 28;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(6 + rng() * 6, h, 6 + rng() * 6), skylineMat);
    const side = i % 2 === 0 ? -1 : 1;
    mesh.position.set(side * (82 + rng() * 10), h / 2, -40 + rng() * 110);
    scene.add(mesh);
  }

  const poles = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.5, metalness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#fff1cc', emissive: '#ffc56a', emissiveIntensity: 1, roughness: 0.3,
  });
  neonMats.push(bulbMat);
  function addLamp(x, z) {
    if (blocks.some((b) => circleHits(x, z, 0.4, b))) return;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 6), poleMat);
    pole.position.y = 2.6;
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), poleMat);
    arm.position.set(0.35, 5.15, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bulbMat);
    bulb.position.set(0.75, 5.0, 0);
    g.add(pole, arm, bulb);
    g.position.set(x, 0, z);
    scene.add(g);
    poles.push({ x, z, y: 5 });
  }
  for (const x of ROAD_XS) {
    let side = 1;
    for (let z = -32; z <= 58; z += 24) {
      addLamp(x + side * 8.6, z);
      side *= -1;
    }
  }
  for (const z of ROAD_ZS) {
    let side = 1;
    for (let x = -58; x <= 58; x += 26) {
      if (Math.abs(x) < 10 || Math.abs(x - 36) < 8 || Math.abs(x + 36) < 8) continue;
      addLamp(x, z + side * 8.6);
      side *= -1;
    }
  }

  const lightPool = [];
  for (let i = 0; i < 6; i++) {
    const light = new THREE.PointLight('#ffc48a', 0, 16, 2);
    light.castShadow = false;
    scene.add(light);
    lightPool.push(light);
  }

  const state = { time: 'dusk', fog: 0.55, quality: 'high', shadows: true };

  function applyTime(timeName, fogAmount) {
    const t = TIMES[timeName] || TIMES.dusk;
    state.time = timeName;
    skyMat.uniforms.topColor.value.set(t.skyTop);
    skyMat.uniforms.horizonColor.value.set(t.skyHorizon);
    skyMat.uniforms.bottomColor.value.set(t.skyBottom);
    scene.fog = new THREE.FogExp2(t.fog, 0.004 + fogAmount * 0.02 + (timeName === 'night' ? 0.008 : 0));
    scene.background = null;
    hemi.color.set(t.hemiSky);
    hemi.groundColor.set(t.hemiGround);
    hemi.intensity = t.hemiInt;
    ambient.color.set(t.ambient);
    ambient.intensity = t.ambientInt;
    sun.color.set(t.sun);
    sun.intensity = t.sunInt;
    state.sunOffset = new THREE.Vector3(...t.sunPos);
    renderer.toneMappingExposure = t.exposure;
    litMat.emissiveIntensity = t.window;
    for (const m of signMats) m.emissiveIntensity = t.neon;
    for (const m of neonMats) m.emissiveIntensity = 0.4 + t.neon;
    bulbMat.emissiveIntensity = 0.2 + t.lamp;
    groundMat.roughness = timeName === 'day' ? 0.92 : 0.62;
    groundMat.metalness = timeName === 'day' ? 0.02 : 0.12;
    state.lamp = t.lamp;
    state.head = t.head;
  }

  function applyQuality(quality, shadowsOn) {
    state.quality = quality;
    state.shadows = shadowsOn;
    const size = !shadowsOn ? 0 : quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512;
    renderer.shadowMap.enabled = !!shadowsOn;
    const cap = quality === 'high' ? 1.75 : quality === 'medium' ? 1.25 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    if (shadowsOn) {
      sun.castShadow = true;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null;
        }
      }
      sun.shadow.radius = quality === 'low' ? 0 : 2;
    } else {
      sun.castShadow = false;
    }
    state.lightCount = quality === 'high' ? 6 : quality === 'medium' ? 4 : 2;
  }

  function update(dt, focus) {
    waterUniforms.time.value += dt;
    const count = state.lightCount || 4;
    const ranked = poles
      .map((p) => ({ p, d: (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < lightPool.length; i++) {
      const light = lightPool[i];
      if (i < count && state.lamp > 0) {
        const p = ranked[i % ranked.length].p;
        light.position.set(p.x, p.y, p.z);
        light.intensity = state.lamp * 8;
      } else light.intensity = 0;
    }
    if (state.sunOffset && focus) {
      sun.position.set(focus.x + state.sunOffset.x, state.sunOffset.y, focus.z + state.sunOffset.z);
      sun.target.position.set(focus.x, 0, focus.z);
      sun.target.updateMatrixWorld();
    }
  }

  function resolve(pos, vel, radius, height) {
    let grounded = pos.y <= 0.02 && vel.y <= 0;
    if (pos.y <= 0 && vel.y <= 0) {
      pos.y = 0;
      vel.y = 0;
      grounded = true;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (const b of blocks) {
        if (!circleHits(pos.x, pos.z, radius, b)) continue;
        const top = b.maxY;
        if (vel.y <= 0.01 && pos.y >= top - 0.28 && pos.y <= top + 0.4) {
          pos.y = top;
          vel.y = Math.max(0, vel.y);
          grounded = true;
          continue;
        }
        if (pos.y >= top - 0.02) continue;
        if (grounded && top - pos.y > 0 && top - pos.y <= 0.42) {
          pos.y = top;
          vel.y = 0;
          grounded = true;
          continue;
        }
        if (pos.y + height * 0.55 < b.minY) continue;
        if (pos.y > top - 0.05) continue;
        pushOut(pos, radius, b);
      }
    }
    pos.x = clamp(pos.x, WORLD.minX, WORLD.maxX);
    pos.z = clamp(pos.z, WORLD.minZ, WORLD.maxZ);
    return grounded;
  }

  function blocked(x, z, r = 0.4) {
    if (x < WORLD.minX || x > WORLD.maxX || z < WORLD.minZ || z > WORLD.maxZ) return true;
    return blocks.some((b) => b.maxY > 0.5 && circleHits(x, z, r, b));
  }

  function lineBlocked(x0, z0, x1, z1) {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(dist / 1.4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.3)) return true;
    }
    return false;
  }

  applyTime('dusk', 0.55);
  applyQuality('high', true);

  return {
    blocks,
    parked,
    poles,
    resolve,
    blocked,
    lineBlocked,
    update,
    applyTime,
    applyQuality,
    get headlight() { return state.head || 0; },
    drawMap(ctx, size, player, dots, rotate, colorblind) {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(10, 12, 16, 0.82)';
      ctx.fillRect(0, 0, size, size);
      const scale = size / 96;
      const project = (x, z) => {
        let dx = x - player.x;
        let dz = z - player.z;
        if (rotate) {
          const c = Math.cos(player.yaw);
          const s = Math.sin(player.yaw);
          const rx = dx * c - dz * s;
          const rz = dx * s + dz * c;
          dx = rx;
          dz = rz;
        }
        return [size / 2 + dx * scale, size / 2 - dz * scale];
      };
      ctx.strokeStyle = 'rgba(186, 196, 210, 0.55)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'square';
      const stroke = (x1, z1, x2, z2) => {
        const a = project(x1, z1);
        const b = project(x2, z2);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      };
      ctx.strokeStyle = 'rgba(70, 78, 92, 0.95)';
      for (const x of ROAD_XS) stroke(x, -50, x, 70);
      for (const z of ROAD_ZS) stroke(-72, z, 72, z);
      ctx.strokeStyle = 'rgba(40, 90, 110, 0.8)';
      ctx.lineWidth = 8;
      stroke(-70, -52, 70, -52);
      for (const d of dots) {
        const [px, py] = project(d.x, d.z);
        ctx.fillStyle = d.color;
        ctx.beginPath();
        if (d.shape === 'rect') {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rotate ? d.yaw - player.yaw : d.yaw);
          ctx.fillRect(-4, -2, 8, 4);
          ctx.restore();
        } else {
          ctx.arc(px, py, d.r || 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const clinicP = project(CLINIC.x, CLINIC.z);
      ctx.fillStyle = '#3ee08a';
      ctx.fillRect(clinicP[0] - 1, clinicP[1] - 4, 2, 8);
      ctx.fillRect(clinicP[0] - 4, clinicP[1] - 1, 8, 2);
      ctx.restore();
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(rotate ? 0 : player.yaw);
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(231, 195, 106, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
      ctx.stroke();
      void colorblind;
      void LOOP;
    },
  };
}

async function importEnvironment(scene, renderer, pmrem) {
  try {
    const mod = await import('three/examples/jsm/environments/RoomEnvironment.js');
    const env = new mod.RoomEnvironment();
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    env.dispose?.();
  } catch {
    /* metals stay a little flatter without an env map */
  }
}

export function pushCircles(pos, radius, circles) {
  for (const c of circles) {
    let dx = pos.x - c.x;
    let dz = pos.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = radius + c.r;
    if (d < min) {
      if (d < 0.0001) {
        pos.x += min;
      } else {
        const push = (min - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }
}

