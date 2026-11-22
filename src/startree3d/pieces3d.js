// 視角 D 的立體棋子：車床皇后（戴聖誕帽）＋ 三層圓錐聖誕樹
// 三種材質可以切換：wood（黃楊木／烏木）、glass（磨砂玻璃）、marble（大理石）
// 聖誕帽一律是紅色毛氈，星星一律是金箔；只換棋身。
import * as THREE from 'three';

export const MATS = ['wood', 'glass', 'marble'];
// 可以用滑桿調的形狀／材質參數 (1 = 原樣)
export const PIECE_DEFAULTS = {
  mat: 'wood',
  qH: 1, qWaist: 1.11, qBase: 1, crownPts: 8, crownH: 1, hatSize: 1, hatDroop: 0.61,
  tiers: 3, waves: 8, treeW: 1, treeH: 1.12,
  glassRough: 0.15, glassTint: 200,
};

function catmull(pts, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push(new THREE.Vector2(...[0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))));
    }
  }
  out.push(new THREE.Vector2(...pts[pts.length - 1]));
  return out;
}
const lathe = (pts, seg = 128, smooth = true) => new THREE.LatheGeometry(smooth ? catmull(pts) : pts.map((p) => new THREE.Vector2(...p)), seg);

// ---- 程序材質貼圖 ----
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
function woodTex(base, line, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  // 木纖維：順著棋子高度方向、慢慢擺動的線 (車床棋子的木紋是直的)
  for (let k = 0; k < 160; k++) {
    const x0 = r() * 1024, amp = 4 + r() * 22, f = 0.002 + r() * 0.006, ph = r() * 6.28;
    g.strokeStyle = line; g.globalAlpha = 0.05 + r() * 0.22; g.lineWidth = 0.6 + r() * (r() < 0.15 ? 7 : 2.5);
    g.beginPath();
    for (let y = 0; y <= 1024; y += 8) { const x = x0 + amp * Math.sin(y * f + ph); y ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  const img = g.getImageData(0, 0, 1024, 1024), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return c;
}
function marbleTex(base, vein, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  // 雲霧底
  for (let k = 0; k < 40; k++) {
    const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 220;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, vein.replace(')', ',0.07)').replace('rgb', 'rgba')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  }
  // 紋路：隨機走的折線，有粗有細，邊緣糊一點
  g.lineJoin = 'round';
  for (let k = 0; k < 26; k++) {
    let x = r() * 1024, y = r() * 1024, a = r() * 6.28;
    const w = r() < 0.25 ? 2.5 + r() * 3 : 0.6 + r() * 1.4;
    g.strokeStyle = vein; g.globalAlpha = 0.25 + r() * 0.5; g.lineWidth = w;
    g.shadowColor = vein; g.shadowBlur = w * 3;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 70; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
  return c;
}
const texCache = new Map();
const cached = (key, make) => texCache.get(key) || (texCache.set(key, make()), texCache.get(key));
function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function bodyMaterials(env, P) {
  const common = { envMap: env };
  return {
    wood: {
      queen: new THREE.MeshPhysicalMaterial({ ...common, map: cached('w1', () => tex(woodTex('#e2c497', '#8a5a2a', 3))), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, envMapIntensity: 0.6 }),
      tree: new THREE.MeshPhysicalMaterial({ ...common, map: cached('w2', () => tex(woodTex('#30462c', '#0e180c', 9))), roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.5 }),
    },
    glass: {
      queen: new THREE.MeshPhysicalMaterial({ ...common, color: '#fff4ee', transmission: 1, roughness: P.glassRough, thickness: 22, ior: 1.5, attenuationColor: new THREE.Color('#b8302a'), attenuationDistance: P.glassTint, envMapIntensity: 1.2, specularIntensity: 1 }),
      tree: new THREE.MeshPhysicalMaterial({ ...common, color: '#f2fff2', transmission: 1, roughness: P.glassRough, thickness: 20, ior: 1.5, attenuationColor: new THREE.Color('#3f8a4a'), attenuationDistance: P.glassTint * 0.9, envMapIntensity: 1.2 }),
    },
    marble: {
      queen: new THREE.MeshPhysicalMaterial({ ...common, map: cached('m1', () => tex(marbleTex('#ebe6dc', 'rgb(120,112,104)', 5))), roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.8 }),
      tree: new THREE.MeshPhysicalMaterial({ ...common, map: cached('m2', () => tex(marbleTex('#1f3a2a', 'rgb(200,214,196)', 13))), roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.8 }),
    },
  };
}

export function buildPieces(env, P0 = {}) {
  const P = { ...PIECE_DEFAULTS, ...P0 };
  const group = new THREE.Group();
  const M = bodyMaterials(env, P);
  const felt = new THREE.MeshPhysicalMaterial({ color: '#9e1f17', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ff9070'), sheenRoughness: 0.7, envMap: env, envMapIntensity: 0.2 });
  const fur = new THREE.MeshPhysicalMaterial({ color: '#efe6d2', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.9, envMap: env, envMapIntensity: 0.2 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#d9a441', metalness: 0.85, roughness: 0.38, envMap: env, envMapIntensity: 1.0 });
  const ruby = new THREE.MeshPhysicalMaterial({ color: '#8a0f0a', roughness: 0.15, clearcoat: 1, envMap: env, envMapIntensity: 1.0 });
  const bodies = { queen: [], tree: [] };
  const add = (parent, geo, mat, kind) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    if (kind) bodies[kind].push(m);
    parent.add(m); return m;
  };

  // ---- 皇后 (高約 1.75 格) ----
  const queen = new THREE.Group();
  add(queen, lathe([[0, 0], [37, 0], [38.5, 2.5], [37.5, 7], [33, 10], [31, 12.5], [28, 16], [22, 20], [17, 32], [12.5, 56], [10.5, 76], [12, 86], [19, 88.5], [21, 91.5], [19, 94.5], [13, 96], [14, 101], [19, 111], [24, 119], [25.5, 122], [0.1, 122.5]]
    .map(([r, y]) => [r * (y <= 20 ? P.qBase : y <= 96 ? P.qWaist : 1), y])), null, 'queen');
  // 皇冠：跟棋身同一塊木頭車出來的冠圈，上緣是一圈圓弧鋸齒 (傳統皇后棋的冠)
  {
    const cg = lathe([[23.5, 119], [26.5, 121], [28.5, 130], [30, 140], [28.4, 141], [26.2, 131], [24.5, 125], [0.1, 125]], 160, false);
    const p = cg.attributes.position, w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      w.fromBufferAttribute(p, i);
      if (w.y <= 128) continue;
      const a = Math.atan2(w.z, w.x);
      const wave = Math.pow(0.5 + 0.5 * Math.cos(a * P.crownPts), 0.7);   // 圓頭尖角、圓底凹谷
      const t = (w.y - 128) / 13;
      p.setY(i, 128 + t * 13 * P.crownH * (0.35 + 0.65 * wave) + 4 * (P.crownH - 1) * t);
    }
    cg.computeVertexNormals();
    add(queen, cg, null, 'queen');
  }
  // 聖誕帽：毛氈圓錐，坐在冠圈裡，帽尖往 +x 垂下
  const hatGeo = lathe([[17, 0], [15.5, 8], [11.5, 20], [7, 32], [3, 42], [0.2, 48]], 64);
  const pos = hatGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y / 48;
    v.x += 30 * P.hatDroop * Math.pow(t, 2.4);
    v.y -= 20 * P.hatDroop * Math.pow(t, 3.2);
    v.y += 0.8 * Math.sin(Math.atan2(v.z, v.x) * 7) * (1 - t);   // 毛氈的皺褶
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  hatGeo.computeVertexNormals();
  const hatG = new THREE.Group(); queen.add(hatG);
  add(hatG, hatGeo, felt);
  const brim = add(hatG, new THREE.TorusGeometry(17.5, 5.2, 20, 72), fur); brim.rotation.x = Math.PI / 2; brim.position.y = 1;
  const pom = add(hatG, new THREE.SphereGeometry(6.5, 24, 18), fur);
  pom.position.set(30 * P.hatDroop + 2, 48 - 20 * P.hatDroop - 3, 0);
  hatG.position.y = 130; hatG.rotation.z = 0.1; hatG.scale.setScalar(1.25 * P.hatSize);
  queen.position.set(-50, 0.6, -150); queen.rotation.y = -0.6; queen.scale.y = P.qH;
  group.add(queen);

  // ---- 聖誕樹棋 (高約 1.4 格) ----
  const tree = new THREE.Group();
  add(tree, lathe([[0, 0], [32, 0], [33.5, 2.5], [32, 7], [26, 10.5], [18, 14], [11.5, 20], [9, 28], [10, 32], [16.5, 33], [18, 35.5], [16, 38], [7, 39.5], [6, 48], [0.1, 48.5]]), null, 'tree');
  const tiers = [];
  for (let k = 0; k < P.tiers; k++) { const f = k / Math.max(1, P.tiers - 1); tiers.push([44 + f * 51, (38 - 15 * f) * P.treeW, 46 - 10 * f]); }
  for (const [yb, r, h] of tiers) {
    const g = lathe([[0.1, yb + 2], [r * 0.85, yb], [r, yb + 2.2], [r * 0.93, yb + 4.5], [r * 0.55, yb + h * 0.45], [r * 0.2, yb + h * 0.82], [0.1, yb + h]], 128);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {      // 下緣做成波浪 (枝條)
      v.fromBufferAttribute(p, i);
      const t = Math.min(1, Math.max(0, (v.y - yb) / h)), a = Math.atan2(v.z, v.x);
      const k = 1 + 0.07 * Math.cos(a * P.waves) * (1 - t) ** 2;
      p.setXYZ(i, v.x * k, v.y - 1.6 * (0.5 + 0.5 * Math.cos(a * P.waves)) * (1 - t) ** 4, v.z * k);
    }
    g.computeVertexNormals();
    add(tree, g, null, 'tree');
  }
  const star = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 4 : 10; k ? star.lineTo(r * Math.cos(a), r * Math.sin(a)) : star.moveTo(r * Math.cos(a), r * Math.sin(a)); }
  const sg = new THREE.ExtrudeGeometry(star, { depth: 2.5, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.9, bevelSegments: 2 }); sg.center();
  const st = add(tree, sg, gold); st.position.y = 138;
  tree.position.set(50, 0.6, -250); tree.rotation.y = 0.3; tree.scale.y = P.treeH;
  group.add(tree);

  let mat = P.mat;
  function setMat(m) {
    mat = MATS.includes(m) ? m : 'wood';
    for (const k of ['queen', 'tree']) for (const mesh of bodies[k]) mesh.material = M[mat][k];
  }
  return { group, queen, tree, setMat, get mat() { return mat; }, star: st };
}
