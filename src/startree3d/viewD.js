// 星星樹 3D — 視角 D：掉進鑰匙孔之後
// 頭頂上就是我們掉下來的鑰匙孔，光從那裡斜照進來（偏 22°，跟視角 A 一樣），
// 在棋盤上照出一塊鑰匙孔形的光斑。棋盤 = 8×8 片獨立紙格；棋子 = 有白紙邊的立牌。
// 光斑公式：任何一點 P 先沿著「光源 → P」投影到地面，再看它在不在地面的鑰匙孔裡，
// 所以棋盤、棋子、影子都吃同一個光斑。
import * as THREE from 'three';
import { buildPieces, MATS, PIECE_DEFAULTS } from './pieces3d.js';
import { buildCutouts, CUT_DEFAULTS, ANIM_DEFAULTS } from './cutouts3d.js';
// 滑桿面板調的全部參數 (棋子形狀＋材質＋剪紙棋子＋光＋鏡頭)
export const TUNE_DEFAULTS = { ...PIECE_DEFAULTS, ...CUT_DEFAULTS, ...ANIM_DEFAULTS, pitch: 22, light: 1, haze: 1, dist: 1150, enterH: 6000, amb: 1, fade0: 0.6, fade1: 1.1, turn0: 1.0 };

const q = new URLSearchParams(location.search);
const D = {
  tilt: THREE.MathUtils.degToRad(+q.get('tilt') || 22),   // 光偏離垂直
  az: THREE.MathUtils.degToRad(+q.get('az') || 230),      // 光從哪個方向來 (0 = +x，90 = 鏡頭那側；230 = 左後方，光束才會在畫面裡)
  dist: +q.get('ddist') || 860,
  fov: +q.get('dfov') || 30,
  K: 0.55,                 // 地面光斑 = 鑰匙孔模板 × K (圓半徑 330K ≈ 1.8 格)
  C: new THREE.Vector2(0, -200), // 光斑圓心 (x, z)
  lightDist: 1500,
  haze: q.has('nohaze') ? 0 : 1,
  piece: q.get('piece') || '3d',       // 3d = 立體棋子；card = 紙片立牌
  mat: q.get('mat') || 'wood',         // wood / glass / marble
};
const SHADOW = matchMedia('(pointer: coarse)').matches ? 2048 : 4096;   // 手機影子貼圖小一點
const SQ = 100;            // 一格
const GAP = 1.5;
const EDGE = '#f3ecdc';    // 白紙邊

// 鑰匙孔模板 (跟 main.js 同一組數字)
const KH = { R: 330, cy: -370, jx: 190, bx: 390, by: 680 };
const JY = Math.sqrt(KH.R ** 2 - KH.jx ** 2);
const BY = KH.by - KH.cy;
const RB = Math.hypot(KH.bx, BY);

function sdQjs(x, y) {
  const c = Math.hypot(x, y) - 330, ax = Math.abs(x);
  const nl = Math.hypot(BY - JY, 200), nx = (BY - JY) / nl, ny = -200 / nl;
  const side = (ax - 190) * nx + (y - JY) * ny, arc = Math.hypot(x, y) - RB;
  return Math.min(c, Math.max(side, arc, -y));
}
const lightDir = new THREE.Vector3(Math.cos(D.az) * Math.sin(D.tilt), Math.cos(D.tilt), Math.sin(D.az) * Math.sin(D.tilt));
const C3 = new THREE.Vector3(D.C.x, 0, D.C.y);
const LS = C3.clone().addScaledVector(lightDir, D.lightDist);   // 光源 (鑰匙孔上方)

const common = /* glsl */`
  uniform vec3 uLS; uniform vec2 uC; uniform float uK, uRad, uI;
  float sdQ(vec2 q) {
    float c = length(q) - 330.0;
    vec2 a = vec2(abs(q.x), q.y);
    vec2 j = vec2(190.0, ${JY.toFixed(4)});
    vec2 n = normalize(vec2(${(BY - JY).toFixed(4)}, -200.0));
    float side = dot(a - j, n);
    float arc = length(q) - ${RB.toFixed(4)};
    float tail = max(max(side, arc), -q.y);
    return min(c, tail);
  }
  // 回傳光斑強度；h = 離光斑圓心多近 (越近越熱)
  float pool(vec3 P, out float h) {
    vec3 g = uLS + (P - uLS) * (uLS.y / max(uLS.y - P.y, 1.0));
    float d = sdQ((g.xz - uC) / uK) * uK;
    float m = 1.0 - smoothstep(-5.0, 5.0, d);
    float r = length(g.xz - uC);
    m *= 1.0 - smoothstep(uRad - 120.0, uRad, r);
    h = clamp(1.0 - r / (330.0 * uK * 2.2), 0.0, 1.0);
    return m * uI;
  }`;

function lightUniforms() {
  return {
    uLS: { value: LS.clone() }, uC: { value: D.C.clone() }, uK: { value: D.K },
    uRad: { value: 0 }, uI: { value: 0 },
  };
}

// ---- 棋盤：每格一片紙 ----
const tileVert = /* glsl */`
  varying vec3 vW;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const tileFrag = /* glsl */`
  precision highp float;
  varying vec3 vW;
  uniform float uCream, uVar, uEdge, uAmb; uniform vec2 uTC;
  ${common}
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  vec3 h3(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
  void main() {
    float h; float m = pool(vW, h);
    vec3 inCream = mix(h3(150.0, 66.0, 24.0), h3(246.0, 186.0, 96.0), h * h * (3.0 - 2.0 * h));
    vec3 inGreen = mix(h3(30.0, 30.0, 14.0), h3(70.0, 72.0, 34.0), h);
    vec3 inC = mix(inGreen, inCream, uCream);
    float r = length(vW.xz - uC);
    vec3 outC = mix(h3(10.0, 17.0, 12.0), h3(38.0, 38.0, 30.0), uCream) * exp(-r / 380.0) * uI;
    outC += mix(h3(14.0, 24.0, 17.0), h3(46.0, 42.0, 33.0), uCream) * uAmb * exp(-r / 900.0);   // 光斑外的棋格也看得到一點
    vec3 c = mix(outC, inC, m) * uVar;
    // 紙纖維：一個方向拉長的雜訊 + 細顆粒
    float fib = vnoise(vW.xz * vec2(0.08, 0.6) + uTC) * 0.6 + vnoise(vW.xz * 0.9) * 0.4;
    c *= 0.93 + 0.12 * fib;
    // 切邊亮線：紙格上緣在光裡會反一道亮邊
    vec2 e = ${((SQ - GAP) / 2).toFixed(2)} - abs(vW.xz - uTC);
    float rim = 1.0 - smoothstep(0.0, 1.6, min(e.x, e.y));
    c = mix(c, vec3(1.0, 0.86, 0.62), rim * m * 0.45 * (1.0 - uEdge));
    c = mix(c, c * 1.35 + 0.03 * m, uEdge * 0.6);   // 紙的切邊 (側面) 偏亮
    gl_FragColor = vec4(c, 1.0);
  }`;

// ---- 棋子立牌 ----
const cardVert = /* glsl */`
  varying vec2 vUv; varying vec3 vW;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const cardFrag = /* glsl */`
  precision highp float;
  varying vec2 vUv; varying vec3 vW;
  uniform sampler2D uTex;
  ${common}
  void main() {
    vec4 t = texture2D(uTex, vUv);
    if (t.a < 0.01) discard;
    float h; float m = pool(vW, h);
    vec3 L = mix(vec3(1.0, 0.55, 0.26), vec3(1.3, 1.02, 0.72), h);
    float bounce = 0.10 * (1.0 - vUv.y) * uI;   // 腳邊吃一點棋盤反光
    vec3 amb = vec3(0.05, 0.07, 0.06) * uI + vec3(0.9, 0.45, 0.15) * bounce;
    gl_FragColor = vec4(t.rgb * (amb + L * m), t.a);   // 預乘 alpha
  }`;
const shadowVert = /* glsl */`
  uniform vec3 uLS; uniform float uGy;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 P = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 g = uLS + (P - uLS) * ((uLS.y - uGy) / max(uLS.y - P.y, 1.0));
    g.y = uGy;
    gl_Position = projectionMatrix * viewMatrix * vec4(g, 1.0);
  }`;
const shadowFrag = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex; uniform float uA;
  void main() {
    float a = texture2D(uTex, vUv, 1.5 + 4.0 * vUv.y).a;   // 越高的地方影子越糊 (半影)
    gl_FragColor = vec4(0.015, 0.01, 0.005, a * uA * (1.0 - 0.45 * vUv.y));
  }`;

// ---- 剪紙畫法 ----
function catmull(pts, n = 10) {   // pts: [x,y]，回傳平滑後的點
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function profile(g, cx, prof) {    // prof: [半寬, y] 由下往上，左右對稱
  const R = catmull(prof.map(([w, y]) => [cx + w, y]));
  const L = catmull(prof.map(([w, y]) => [cx - w, y])).reverse();
  g.moveTo(...R[0]); for (const p of R) g.lineTo(...p); for (const p of L) g.lineTo(...p); g.closePath();
}
// 一層紙：先描白紙邊 (帶一點落影)，再填色
function layer(g, path, fill, { edge = 22, shadow = true } = {}) {
  g.save();
  g.beginPath(); path(g);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (shadow) { g.shadowColor = 'rgba(25,8,2,0.55)'; g.shadowBlur = 26; g.shadowOffsetX = 8; g.shadowOffsetY = 14; }
  g.lineWidth = edge * 2; g.strokeStyle = EDGE; g.stroke();
  g.fillStyle = EDGE; g.fill();
  g.restore();
  g.beginPath(); path(g); g.fillStyle = fill; g.fill();
  // 紙面上一點點色差，像手裁的色紙
  g.save(); g.beginPath(); path(g); g.clip();
  const gr = g.createLinearGradient(0, 0, 1024, 2048);
  gr.addColorStop(0, 'rgba(255,240,210,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 2048); g.restore();
}
const rr = (x, y, w, h, r) => (g) => g.roundRect(x, y, w, h, r);
const circle = (x, y, r) => (g) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); };

function queenCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 2048;
  const g = c.getContext('2d'), X = 512, OUT = 46;
  // 整體剪影先墊一張白紙 (外圈粗白邊)
  const body = (g) => profile(g, X, [[330, 1935], [300, 1880], [240, 1840], [175, 1700], [122, 1450], [105, 1250], [120, 1140], [140, 1000], [200, 880], [258, 790]]);
  const xs = [-262, -131, 0, 131, 262];
  const crown = (g) => {
    g.moveTo(X - 275, 822); g.lineTo(X - 290, 560);
    xs.forEach((o, i) => { g.lineTo(X + o * 1.1, 520); if (i < 4) g.lineTo(X + o + 65, 690); });
    g.lineTo(X + 290, 560); g.lineTo(X + 275, 822); g.closePath();
    for (const o of xs) circle(X + o * 1.1, 500, 34)(g);
  };
  const band = rr(X - 285, 735, 570, 70, 20);
  // 帽子小一號，往左歪著坐在冠頂中間，帽尖往右垂到冠外
  const hat = (g) => { g.moveTo(X - 150, 520); g.bezierCurveTo(X - 140, 380, X - 50, 250, X + 60, 240); g.bezierCurveTo(X + 200, 235, X + 300, 330, X + 330, 450); g.bezierCurveTo(X + 270, 390, X + 200, 380, X + 170, 420); g.lineTo(X + 150, 520); g.closePath(); };
  const brim = rr(X - 180, 480, 360, 82, 41), pom = circle(X + 335, 470, 66);
  const all = [rr(X - 380, 1925, 760, 105, 34), body, rr(X - 205, 1098, 410, 66, 32), crown, band, hat, brim, pom];
  g.save(); g.lineJoin = 'round'; g.lineWidth = OUT * 2; g.strokeStyle = g.fillStyle = EDGE;
  for (const p of all) { g.beginPath(); p(g); g.stroke(); g.fill(); }
  g.restore();
  layer(g, all[0], '#4e100b', { shadow: false });
  layer(g, body, '#7a1a12');
  layer(g, (g) => profile(g, X, [[150, 1600], [118, 1450], [104, 1250], [116, 1170]]), '#651510', { edge: 10 });   // 腰身上的暗紙條
  layer(g, all[2], '#e6dcc4');
  layer(g, crown, '#d9a441');
  layer(g, band, '#b8822c', { edge: 12 });
  for (const o of [-170, 0, 170]) layer(g, circle(X + o, 770, 20), '#a8261b', { edge: 8 });   // 冠上的紅寶石紙片
  layer(g, hat, '#a8261b');
  layer(g, brim, '#ece3cf');
  layer(g, pom, '#ece3cf');
  return c;
}

function treeCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 2048;
  const g = c.getContext('2d'), X = 512, OUT = 46;
  const tier = (bot, half, top, n) => (g) => {
    g.moveTo(X, top); g.lineTo(X - half, bot);
    const w = (2 * half) / n;
    for (let k = 0; k < n; k++) { const x0 = X - half + k * w; g.quadraticCurveTo(x0 + w / 2, bot + 70, x0 + w, bot); }
    g.closePath();
  };
  const star = (g) => {
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 52 : 125;
      g[k ? 'lineTo' : 'moveTo'](X + r * Math.cos(a), 420 + r * Math.sin(a));
    }
    g.closePath();
  };
  const base = rr(X - 340, 1935, 680, 95, 32);
  const foot = (g) => profile(g, X, [[290, 1945], [262, 1890], [200, 1862], [125, 1790], [100, 1710], [112, 1650]]);
  const collar = rr(X - 175, 1598, 350, 58, 28);
  const trunk = rr(X - 55, 1460, 110, 150, 10);
  const t1 = tier(1500, 400, 1010, 5), t2 = tier(1185, 322, 740, 4), t3 = tier(890, 235, 480, 3);
  const all = [base, foot, collar, trunk, t1, t2, t3, star];
  g.save(); g.lineJoin = 'round'; g.lineWidth = OUT * 2; g.strokeStyle = g.fillStyle = EDGE;
  for (const p of all) { g.beginPath(); p(g); g.stroke(); g.fill(); }
  g.restore();
  layer(g, base, '#22341f', { shadow: false });
  layer(g, foot, '#2f4a2c');
  layer(g, collar, '#e6dcc4');
  layer(g, trunk, '#5a3a1c');
  layer(g, t1, '#3f5a3a');
  layer(g, t2, '#4a6a42');
  layer(g, t3, '#567a4b');
  for (const [x, y, col] of [[-180, 1380, '#a8261b'], [150, 1300, '#d9a441'], [-60, 1080, '#d9a441'], [120, 960, '#a8261b'], [-90, 760, '#a8261b']]) layer(g, circle(X + x, y, 26), col, { edge: 9 });
  layer(g, star, '#e5a040');
  return c;
}

function cardTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.premultiplyAlpha = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
  return t;
}

// 聚光燈的 cookie：每個貼圖像素沿光線打到地面，看落在地面鑰匙孔的哪裡 → 跟棋盤上的光斑完全重合
function keyholeCookie(spot, N = 1024) {
  spot.updateMatrixWorld(); spot.target.updateMatrixWorld(); spot.shadow.updateMatrices(spot);
  const cam = spot.shadow.camera, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const v = new THREE.Vector3(), o = cam.position;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, w = 1 - (j + 0.5) / N;           // flipY：第 0 行 = v=1
    v.set(u * 2 - 1, w * 2 - 1, 0.5).unproject(cam).sub(o);
    const t = -o.y / v.y, gx = o.x + v.x * t, gz = o.z + v.z * t;
    const dd = sdQjs((gx - D.C.x) / D.K, (gz - D.C.y) / D.K) * D.K;
    const m = 1 - Math.min(1, Math.max(0, (dd + 5) / 10));
    const h = Math.min(1, Math.max(0, 1 - Math.hypot(gx - D.C.x, gz - D.C.y) / (330 * D.K * 2.2)));
    const k = (i + j * N) * 4;
    d[k] = 255 * m * (0.77 + 0.23 * h); d[k + 1] = 255 * m * (0.42 + 0.36 * h); d[k + 2] = 255 * m * (0.2 + 0.35 * h); d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

// 環境反射：一片黑，頭頂斜上方一塊暖光 (鑰匙孔)，腳下一圈被照亮的棋盤反光
function makeEnv(renderer) {
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ color: 0x020202, side: THREE.BackSide })));
  const key = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.4, 1.4), side: THREE.DoubleSide }));
  key.position.copy(lightDir).multiplyScalar(80); key.lookAt(0, 0, 0); es.add(key);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.26, 0.08) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -40; es.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(es, 0.02).texture; pm.dispose();
  return env;
}

export function createViewD(renderer) {
  const scene = new THREE.Scene();
  const mats = [];
  const reg = (m) => (mats.push(m), m);
  const rnd = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(11);

  // 棋盤
  const tileGeo = new THREE.BoxGeometry(SQ - GAP, 2, SQ - GAP);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const cream = (i + j) % 2 === 0 ? 1 : 0;
    const tc = new THREE.Vector2((i - 3.5) * SQ, (j - 3.5) * SQ);
    const base = { ...lightUniforms(), uCream: { value: cream }, uVar: { value: 0.94 + 0.1 * rnd() }, uEdge: { value: 0 }, uAmb: { value: 1 }, uTC: { value: tc } };
    const top = reg(new THREE.ShaderMaterial({ uniforms: base, vertexShader: tileVert, fragmentShader: tileFrag }));
    const side = reg(new THREE.ShaderMaterial({ uniforms: { ...base, uEdge: { value: 1 } }, vertexShader: tileVert, fragmentShader: tileFrag }));
    const m = new THREE.Mesh(tileGeo, [side, side, top, side, side, side]);
    m.position.set((i - 3.5) * SQ, -1 + rnd() * 0.5, (j - 3.5) * SQ);
    m.rotation.set((rnd() - 0.5) * 0.004, 0, (rnd() - 0.5) * 0.004);
    scene.add(m);
  }

  // ---- 立體棋子：聚光燈 (鑰匙孔 cookie) + 真影子 ----
  let pieces3d = null, spot = null, bounce = null, ambL = null, env = null, T = { ...TUNE_DEFAULTS, mat: D.mat };
  if (D.piece !== 'card') {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    spot = new THREE.SpotLight(0xffffff, 3, 0, 0.42, 0, 0);
    spot.position.copy(LS); spot.target.position.copy(C3);
    spot.castShadow = true; spot.shadow.mapSize.set(SHADOW, SHADOW); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.4;
    spot.shadow.camera.near = 900; spot.shadow.camera.far = 2400;
    scene.add(spot, spot.target);
    spot.map = keyholeCookie(spot);
    bounce = new THREE.PointLight(0xc4601c, 0.35, 0, 0); bounce.position.set(0, 6, -60); scene.add(bounce);
    ambL = new THREE.HemisphereLight(0xffe2c0, 0x1a2a1e, 0); scene.add(ambL);
    env = makeEnv(renderer);
    pieces3d = buildPieces(env, T);
    scene.add(pieces3d.group);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShadowMaterial({ color: 0x050302, opacity: 0.78 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.9; catcher.receiveShadow = true;
    scene.add(catcher);
  }
  // 剪紙棋子 (圖載完才加進場景)
  // 剪紙棋子 (第二段才出場：u 1.6 → 2.6)
  let cutouts = null, lastU = 99;
  const cutReady = D.piece === 'card' ? Promise.resolve() : buildCutouts().then((c) => { cutouts = c; c.place(T, lastU); scene.add(c.group); }).catch((e) => console.warn('剪紙棋子載入失敗', e));

  // 棋子：x, z 是格子中心
  const pieces = D.piece !== 'card' ? [] : [
    { canvas: queenCanvas(), h: 200, x: -50, z: -150, yaw: 0.2 },
    { canvas: treeCanvas(), h: 165, x: 50, z: -250, yaw: -0.25 },
  ];
  for (const p of pieces) {
    const tex = cardTexture(p.canvas);
    const geo = new THREE.PlaneGeometry(p.h / 2, p.h); geo.translate(0, p.h / 2, 0);
    const card = new THREE.Mesh(geo, reg(new THREE.ShaderMaterial({
      uniforms: { ...lightUniforms(), uTex: { value: tex } }, vertexShader: cardVert, fragmentShader: cardFrag,
      transparent: true, premultipliedAlpha: true, side: THREE.DoubleSide,
    })));
    card.position.set(p.x, 0.6, p.z); card.rotation.y = p.yaw;
    const shadow = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uLS: { value: LS.clone() }, uGy: { value: 1.2 }, uTex: { value: tex }, uA: { value: 0.75 } },
      vertexShader: shadowVert, fragmentShader: shadowFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    shadow.position.copy(card.position); shadow.rotation.copy(card.rotation);
    shadow.renderOrder = 1; card.renderOrder = 2;
    p.shadow = shadow;
    scene.add(shadow, card);
  }

  const camera = new THREE.PerspectiveCamera(D.fov, 1, 10, 20000);
  const target = new THREE.Vector3(0, 85, -175);
  const TARGET_TOP = new THREE.Vector3(D.C.x, 0, D.C.y);   // 正上方俯視時看光斑中心
  let reveal = 1, hazeK = 1;
  // cam (進場用，可省略)：{ k: 0 = 正上方俯視 → 1 = 3/4 視角, dist: 鏡頭距離, haze: 光束霧 0–1 }
  function set(r, yaw = 0, pitch = 0, cam = null) {
    reveal = r;
    const e = r * r * (3 - 2 * r);
    for (const m of mats) { m.uniforms.uI.value = Math.min(1, r * 1.4); m.uniforms.uRad.value = 60 + 1100 * e; }
    for (const p of pieces) p.shadow.material.uniforms.uA.value = 0.75 * e;
    if (spot) { spot.intensity = 3.2 * T.light * Math.min(1, r * 1.4) * e; bounce.intensity = 0.35 * e; ambL.intensity = 0.12 * T.amb; }
    for (const m of mats) if (m.uniforms.uAmb) m.uniforms.uAmb.value = T.amb;
    const k = cam ? cam.k : 1;
    hazeK = cam ? cam.haze : 1;
    // 進場從正上方一路降到最後的角度 (俯 T.pitch)，之後鏡頭不再動；剪紙在同一個角度出場
    lastU = cam && cam.u !== undefined ? cam.u : 99;
    const dist = cam ? cam.dist : T.dist;
    const pitchEnd = THREE.MathUtils.degToRad(+q.get('dpitch') || T.pitch);
    if (cutouts) cutouts.place(T, lastU);
    const tg = TARGET_TOP.clone().lerp(target, k);
    const ph = THREE.MathUtils.lerp(Math.PI / 2, pitchEnd, k) + pitch * 0.6;
    const Y = new THREE.Vector3(0, 1, 0);
    const off = new THREE.Vector3(0, Math.sin(ph), Math.cos(ph)).multiplyScalar(dist).applyAxisAngle(Y, yaw);
    camera.up.set(0, Math.cos(ph), -Math.sin(ph)).applyAxisAngle(Y, yaw);   // 正上方時畫面上方 = 棋盤遠端 → 光斑鑰匙孔正立
    camera.position.copy(tg).add(off);
    camera.lookAt(tg);
    camera.clearViewOffset();
    // 對齊：把光斑圓心推到畫面上的 align 點 (NDC)，alignK 0–1 控制推多少 → 跟樹尖鑰匙孔窗疊在一起
    if (cam && cam.align && cam.alignK > 0) {
      camera.updateMatrixWorld();
      const p = C3.clone().project(camera);
      const sx = (cam.align.x - p.x) * cam.alignK, sy = (cam.align.y - p.y) * cam.alignK;
      // setViewOffset 會把 aspect 改成 fullWidth/fullHeight → 寬用 2·aspect，直幅畫面才不會被擠窄 (正方形時跟原本一樣)
      const a = camera.aspect;
      camera.setViewOffset(2 * a, 2, -sx * a, sy, 2 * a, 2);
    }
  }
  set(1);

  // 2D：從鑰匙孔灑下來的光束＋灰塵 (screen 疊加)
  function post(ctx, S, SH = S) {   // S = 畫布寬，SH = 畫布高 (直幅用)
    if (!D.haze || reveal <= 0 || hazeK <= 0) return;
    const toPx = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * S, (1 - p.y) / 2 * SH]; };
    const a = toPx(C3.clone().addScaledVector(lightDir, 1300));
    const b = toPx(C3.clone().add(new THREE.Vector3(0, 0, 60)));
    const rPx = Math.abs(toPx(C3.clone().add(new THREE.Vector3(330 * D.K, 0, 0)))[0] - toPx(C3)[0]);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const e = reveal * reveal * (3 - 2 * reveal) * hazeK;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 6; k++) {
      const w1 = rPx * (1.15 - k * 0.15), w0 = w1 * 0.3;
      const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      const al = 0.07 * e * T.haze;
      gr.addColorStop(0, `rgba(229,128,7,${al * 0.3})`); gr.addColorStop(0.55, `rgba(229,128,7,${al})`); gr.addColorStop(1, `rgba(196,90,4,${al * 0.4})`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(a[0] + nx * w0, a[1] + ny * w0); ctx.lineTo(b[0] + nx * w1, b[1] + ny * w1);
      ctx.lineTo(b[0] - nx * w1, b[1] - ny * w1); ctx.lineTo(a[0] - nx * w0, a[1] - ny * w0);
      ctx.closePath(); ctx.fill();
    }
    const r = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(5);
    for (let k = 0; k < 140; k++) {
      const t = 0.15 + 0.8 * r(), w = rPx * (0.3 + 0.85 * t) * (r() * 2 - 1) * 0.8;
      const x = a[0] + dx * t + nx * w, y = a[1] + dy * t + ny * w, s = (0.5 + 1.8 * r() ** 2) * S / 1200;
      ctx.fillStyle = `rgba(255,${190 + 50 * r()},140,${(0.15 + 0.5 * r()) * e * Math.min(1, T.haze)})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const setMat = (m) => pieces3d && pieces3d.setMat(m);
  // 套用滑桿：形狀參數變了才重建棋子
  const SHAPE = Object.keys(PIECE_DEFAULTS).filter((k) => k !== 'mat');
  function tune(t) {
    const rebuild = pieces3d && SHAPE.some((k) => t[k] !== T[k]);
    T = { ...T, ...t };
    if (cutouts) cutouts.place(T, lastU);
    if (!pieces3d) return;
    if (rebuild) {
      scene.remove(pieces3d.group);
      pieces3d.group.traverse((o) => o.geometry && o.geometry.dispose());
      pieces3d = buildPieces(env, T);
      scene.add(pieces3d.group);
    }
    pieces3d.setMat(T.mat);
  }
  const nextMat = () => pieces3d && pieces3d.setMat(MATS[(MATS.indexOf(pieces3d.mat) + 1) % MATS.length]);
  return { scene, camera, set, post, setMat, nextMat, tune, cutReady, get mat() { return pieces3d ? pieces3d.mat : 'card'; } };
}
