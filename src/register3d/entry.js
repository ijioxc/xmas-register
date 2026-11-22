// 報名網頁的 3D 入口（直幅、手機優先）
// 從 xmas-star-tree/src/startree3d/main.js (f98721a) 複製過來，只改：畫布改直幅 W×H、拿掉滑桿／輸出／滑鼠搖、
// 加「滑一下就自動播到棋盤定格」的時間軸。編輯 3D 請回 xmas-star-tree 改。
// ── 以下是原本的說明 ──
// 星星樹 3D — 視角 A（魔法視角）
// 2D 海報的每一層鑰匙孔，在 3D 裡是一片水平的薄紙板：
//   形狀 = 鑰匙孔 × σ，放在高度 h = H·(1−σ)，圓心在樹的軸上。
// 鏡頭在樹頂斜上方，偏離軸心 θ = asin(370/H)，用正交投影 → 投影結果跟 2D 一模一樣。
// 圓沿傾斜方向會被壓成 cosθ，所以紙板本身沿那個方向拉長 1/cosθ 抵消。
// 紙的顏色、陰影、光全部照 2D 公式，寫在「海報座標」裡（每片紙自己的座標），
// 換視角時顏色會黏在紙上走。
import * as THREE from 'three';
import { createViewD, TUNE_DEFAULTS } from '../startree3d/viewD.js?v=2';   // ?v= 改版就加 1，避免瀏覽器用舊快取
const tune = { ...TUNE_DEFAULTS };   // 用 3D 編輯頁定稿的滑桿預設值
// 對話框浮在上面 (預設) → 愛麗絲吊高、往右一點讓位；矮手機畫面上緣比較低，提少一點免得頭被切掉 (?ay= ?ax= 可調)
{ const qq = new URLSearchParams(location.search);
  if (qq.get('talk') !== 'bottom') {
    const tall = innerHeight / Math.min(innerWidth, innerHeight * 0.5) >= 2.1;
    tune.gY += +(qq.get('ay') ?? (tall ? 150 : 95)); tune.gX += +(qq.get('ax') ?? 90);
  } }

const q = new URLSearchParams(location.search);
const P = {
  aw: +q.get('aw') || 1400,      // 鑰匙孔畫面橫向看到多少海報單位 (越小鑰匙孔越大)
  ay: +q.get('ay') || 230,        // 鑰匙孔上下位置 (海報單位，正 = 往上)
  dz: +q.get('dz') || 0.9,       // 棋盤畫面橫向視野 (1 = 跟正方形版一樣寬，越小人物越大)
  n: +q.get('n') || 38,
  ratio: +q.get('ratio') || 0.92,
  height: 0.8,
  grain: 0.13,
  glow: +q.get('glow') || 0.9,
  H: +q.get('H') || 1000,        // 樹高 (海報單位)，底半徑 330
  thick: +q.get('thick') || 1.2, // 紙厚 (世界單位)
};

// ---- 色票 (照抄 2D) ----
const PAPER = ['#b7c6be', '#9bb7ac'];
const LIT = [[0, '#8e9b84'], [0.06, '#948a6a'], [0.15, '#8f7448'], [0.24, '#85622c'], [0.36, '#7a5620'], [0.55, '#64380a'], [0.72, '#5c1a05'], [0.86, '#781d03'], [1, '#c45a04']];
const DARK = [[0, '#1f3324'], [0.07, '#2e2c16'], [0.2, '#3a2410'], [0.5, '#2e1009'], [0.66, '#350d06'], [0.82, '#4f0601'], [0.94, '#8a2803'], [1, '#c45a04']];
const HOLE = '#020305';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
function ramp(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const u = (t - t0) / (t1 - t0), a = hex(c0), b = hex(c1);
      return a.map((v, j) => lerp(v, b[j], u) / 255);
    }
  }
  return hex(stops[stops.length - 1][1]).map((v) => v / 255);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---- 鑰匙孔 (海報單位，y 朝下，原點 = 圓心) ----
const KH = { R: 330, cy: -370, jx: 190, bx: 390, by: 680 };
const JY = Math.sqrt(KH.R ** 2 - KH.jx ** 2);           // 接點 y (相對圓心)
const BY = KH.by - KH.cy;                                // 底角 y (相對圓心)
const RB = Math.hypot(KH.bx, BY);
function keyholeShape() {
  const s = new THREE.Shape();
  const a = Math.atan2(JY, KH.jx), b = Math.atan2(BY, KH.bx);
  const N1 = 160, N2 = 40;
  for (let k = 0; k <= N1; k++) {               // 圓：右接點 → 上方 → 左接點
    const f = a - (Math.PI + 2 * a) * (k / N1);
    const x = KH.R * Math.cos(f), y = KH.R * Math.sin(f);
    k ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  for (let k = 0; k <= N2; k++) {               // 左底角 → 底弧 → 右底角
    const f = (Math.PI - b) - (Math.PI - 2 * b) * (k / N2);
    s.lineTo(RB * Math.cos(f), RB * Math.sin(f));
  }
  s.closePath();
  return s;
}

// ---- shader：每片紙 = 2D 的第 i 層紙 (形狀是第 i−1 層的孔) ----
const vert = /* glsl */`
  varying vec2 vQ;   // 鑰匙孔模板座標 (相對圓心，y 朝下)
  void main() {
    vQ = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const frag = /* glsl */`
  precision highp float;
  varying vec2 vQ;
  uniform float uSigma;   // 這片紙的形狀縮放 = 第 i−1 層孔
  uniform float uS;       // 第 i 層自己的縮放 (2D 的 k)
  uniform float uPx;      // 每海報單位多少 px (2D 的 k0)
  uniform vec3 uDark, uLit;
  uniform float uSa, uGa, uStrokeA, uStrokeW;
  uniform vec2 uShOff; uniform float uShSig, uShA;
  uniform float uGlobal, uGlow, uEdge;

  const float CY = -370.0;
  float sdQ(vec2 q) {                 // 鑰匙孔 SDF，模板單位，外正內負
    float c = length(q) - 330.0;
    vec2 a = vec2(abs(q.x), q.y);
    vec2 j = vec2(190.0, ${JY.toFixed(4)});
    vec2 n = normalize(vec2(${(BY - JY).toFixed(4)}, -200.0));
    float side = dot(a - j, n);
    float arc = length(q) - ${RB.toFixed(4)};
    float tail = max(max(side, arc), -q.y);
    return min(c, tail);
  }
  // 海報座標 p (原點 = 消失點 V) 上，縮放 sc 的鑰匙孔 SDF (海報單位)
  float sdHole(vec2 p, float sc) { return sc * sdQ(p / sc - vec2(0.0, CY)); }
  float lin(vec2 p, vec2 a, vec2 b) { vec2 d = b - a; return clamp(dot(p - a, d) / dot(d, d), 0.0, 1.0); }
  float conic(vec2 p, vec2 c0, vec2 c1, float r1) {   // canvas createRadialGradient(c0,0,c1,r1)
    // 以 r1 為單位計算 (數值小，避免精度問題)；r0 = 0 時取正根
    vec2 w = (p - c0) / r1, d = (c1 - c0) / r1;
    float A = 1.0 - dot(d, d), B = dot(w, d);
    return (B + sqrt(max(B * B + A * dot(w, w), 0.0))) / A;
  }
  float phi(float x) { return 1.0 / (1.0 + exp(-1.702 * x)); }

  void main() {
    vec2 p = uSigma * (vQ + vec2(0.0, CY));   // 海報座標
    float k = uS;
    // 底色：暗面 (左上) → 受光面 (右下)
    float u = lin(p, vec2(-380.0, -640.0) * k, vec2(330.0, 120.0) * k);
    vec3 c = mix(uDark, uLit, clamp((u - 0.2) / 0.36, 0.0, 1.0));
    // 左上深綠陰影
    float g = lin(p, vec2(-420.0, -760.0) * k, vec2(60.0, -120.0) * k);
    float ga = mix(mix(uSa, uSa * 0.5, clamp(g / 0.45, 0.0, 1.0)), 0.0, clamp((g - 0.45) / 0.55, 0.0, 1.0));
    c = mix(c, vec3(10.0, 22.0, 14.0) / 255.0, ga);
    // 深處暖光打在紙上
    {
      float t = conic(p, vec2(0.0, -10.0), vec2(0.0, 30.0), 340.0);
      vec4 s0 = vec4(229.0, 128.0, 7.0, 255.0 * uGa) / 255.0;
      vec4 s1 = vec4(162.0, 53.0, 2.0, 255.0 * uGa * 0.85) / 255.0;
      vec4 s2 = vec4(120.0, 29.0, 3.0, 255.0 * uGa * 0.4) / 255.0;
      vec4 s3 = vec4(120.0, 29.0, 3.0, 0.0) / 255.0;
      vec4 L = s0;   // 依序 mix = 分段線性 (避免巢狀三元在 WebKit 被編錯)
      L = mix(L, s1, clamp(t / 0.18, 0.0, 1.0));
      L = mix(L, s2, clamp((t - 0.18) / 0.32, 0.0, 1.0));
      L = mix(L, s3, clamp((t - 0.5) / 0.5, 0.0, 1.0));
      c = mix(c, L.rgb, L.a);
          }
    // 切邊亮線：沿著上一片 (第 i 層孔) 的邊
    {
      float d = sdHole(p + vec2(0.4) / uPx, uS);
      float line = clamp((uStrokeW * 0.5 - abs(d)) * uPx + 0.5, 0.0, 1.0);
      float out_ = clamp(sdHole(p, uS) * uPx + 0.5, 0.0, 1.0);
      c = mix(c, vec3(255.0, 236.0, 200.0) / 255.0, uStrokeA * line * out_);
    }
    // 前一層紙的落影 (2D 裡前一層紙往右下投影)
    float sh = phi(sdHole(p - uShOff, uSigma) / uShSig);
    c = mix(c, vec3(8.0, 6.0, 3.0) / 255.0, uShA * sh);
    // 最後疊上的深處光
    {
      float tg = conic(p, vec2(0.0, -25.0), vec2(0.0, -10.0), 520.0);
      float G = uGlow;
      vec4 g0 = vec4(229.0, 128.0, 7.0, 255.0 * G) / 255.0;
      vec4 g1 = vec4(214.0, 102.0, 2.0, 255.0 * G) / 255.0;
      vec4 g2 = vec4(162.0, 53.0, 2.0, 255.0 * G * 0.85) / 255.0;
      vec4 g3 = vec4(120.0, 29.0, 3.0, 255.0 * G * 0.55) / 255.0;
      vec4 g4 = vec4(79.0, 6.0, 1.0, 255.0 * G * 0.2) / 255.0;
      vec4 g5 = vec4(79.0, 6.0, 1.0, 0.0) / 255.0;
      vec4 LG = g0;
      LG = mix(LG, g1, clamp(tg / 0.06, 0.0, 1.0));
      LG = mix(LG, g2, clamp((tg - 0.06) / 0.1, 0.0, 1.0));
      LG = mix(LG, g3, clamp((tg - 0.16) / 0.18, 0.0, 1.0));
      LG = mix(LG, g4, clamp((tg - 0.34) / 0.31, 0.0, 1.0));
      LG = mix(LG, g5, clamp((tg - 0.65) / 0.35, 0.0, 1.0));
      c = mix(c, LG.rgb, LG.a * uGlobal);
    }
    // 紙的側面 (厚度)：偏亮的紙芯色
    c = mix(c, vec3(0.86, 0.80, 0.68), uEdge * 0.35);
    gl_FragColor = vec4(c, 1.0);
  }`;

// ---- 場景 ----
const TH = Math.asin(370 / P.H), CT = Math.cos(TH), ST = Math.sin(TH);
const scene = new THREE.Scene();
const shape = keyholeShape();
const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
const sheets = [];

function addSheet(sigma, mats) {
  const m = new THREE.Mesh(geo, mats);
  m.rotation.x = Math.PI / 2;                      // 形狀 y → 世界 z，厚度往下
  m.scale.set(sigma, sigma / CT, P.thick);         // 沿傾斜方向拉長 1/cosθ
  m.position.y = P.H * (1 - sigma);
  scene.add(m);
  return m;
}

const N = P.n;
for (let i = 1; i <= N; i++) {
  const sig = Math.pow(P.ratio, i - 1), s = Math.pow(P.ratio, i), t = i / N;
  const tp = (i - 1) / N;
  const uniforms = {
    uSigma: { value: sig }, uS: { value: s }, uPx: { value: 1 },
    uDark: { value: new THREE.Vector3(...ramp(DARK, t)) },
    uLit: { value: new THREE.Vector3(...ramp(LIT, t)) },
    uSa: { value: lerp(0.55, 0, smooth(0, 0.7, t)) },
    uGa: { value: smooth(0.2, 0.92, t) * 0.95 },
    uStrokeA: { value: lerp(0.16, 0.3, t) }, uStrokeW: { value: 1 },
    uShOff: { value: new THREE.Vector2() }, uShSig: { value: 1 },
    uShA: { value: lerp(0.72, 0.22, smooth(0.2, 1, tp)) },
    uGlobal: { value: i >= 2 ? 1 : 0 }, uGlow: { value: P.glow },
    uEdge: { value: 0 },
  };
  const cap = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
  const side = cap.clone(); side.uniforms = { ...uniforms, uEdge: { value: 1 } };
  sheets.push({ i, s, sigPrev: sig, s0: s, sp0: sig, shA0: uniforms.uShA.value, uniforms, mesh: addSheet(sig, [cap, side]) });
}
// 樹尖 = 黑色小鑰匙孔
const tip = addSheet(Math.pow(P.ratio, N), new THREE.MeshBasicMaterial({ color: new THREE.Color(...hex(HOLE).map((v) => v / 255)) }));

// ---- 掉進去：鏡頭往隧道裡前進 L 層 ----
// 2D 的縮放 s 等於透視的 1/深度。鏡頭往前走 Δ，每層變成 s' = 1/(1/s − Δ)；
// 1/s ≤ Δ 的那層已經被穿過 → 消失。L = 已經往裡掉了幾層。
const MAXS = 40;                                   // 夠大就蓋滿畫面
function fall(L) {
  const D = Math.pow(P.ratio, -L) - 1;
  const f = (x) => { const z = 1 / x - D; return z > 1e-6 ? 1 / z : Infinity; };
  const place = (m, sig) => { m.scale.set(sig, sig / CT, P.thick); m.position.y = P.H * (1 - sig); };
  for (const sh of sheets) {
    const s1 = f(sh.s0), sp = f(sh.sp0);
    sh.mesh.visible = isFinite(s1);                 // 這層紙自己被穿過了才消失
    if (!sh.mesh.visible) continue;
    const cap = MAXS * (1 - 0.002 * sh.i);          // 蓋滿畫面的大紙，越裡層放越上面，避免疊在同一高度
    sh.s = Math.min(s1, cap); sh.sigPrev = Math.min(sp, cap);
    const s1c = sh.s;
    sh.uniforms.uSigma.value = sh.sigPrev; sh.uniforms.uS.value = s1c;
    sh.uniforms.uShA.value = sp < cap ? sh.shA0 : 0; // 前一層已穿過 → 沒有落影
    place(sh.mesh, sh.sigPrev);
  }
  place(tip, Math.min(f(Math.pow(P.ratio, N)), MAXS * 0.9)); // 黑孔一直留著，最後蓋滿畫面 = 黑色空間
  bgVisible = D < 1;                               // 海報紙 (第 0 層) 也會被穿過
}
let bgVisible = true;

// ---- 鏡頭：樹頂斜上方，偏軸 θ，正交 ----
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
let ASPECT = 375 / 812;                           // 畫布 寬/高
const halfA = () => P.aw / 2;                     // 畫布半寬 (海報單位)
function placeCameraA(yaw = 0, pitch = 0) {
  const half = halfA(), halfH = half / ASPECT;
  // 畫布中心在 V 上方 10 單位 (再加 ay)
  camera.left = -half; camera.right = half; camera.top = halfH + 10 - P.ay; camera.bottom = -halfH + 10 - P.ay;
  camera.updateProjectionMatrix();
  // 滑鼠搖：繞樹頂轉，yaw 繞樹的軸，pitch 繞畫面水平軸
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
  const apex = new THREE.Vector3(0, P.H, 0);
  const back = new THREE.Vector3(0, CT, -ST).applyQuaternion(rot);
  camera.up.set(0, -ST, -CT).applyQuaternion(rot);
  camera.position.copy(apex).addScaledVector(back, 5000);
  camera.lookAt(apex);
  camera.far = 5000 + 40 * P.H + 2000;            // 掉進去時大片紙會在很下面
  camera.updateProjectionMatrix();
}
placeCameraA();

const glCanvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });   // 不支援 WebGL 會在這裡丟錯 → 外面接住改用 2D
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // 跟 canvas 一樣直接在 sRGB 數值上混色
renderer.setClearColor(0x000000, 0);

function setPx(S) {   // S = 畫布寬 (px)
  const k0 = S / (2 * halfA());
  for (const sh of sheets) {
    const u = sh.uniforms, sp = sh.sigPrev;           // 前一層 (落影來源) 的縮放
    u.uPx.value = k0;
    u.uStrokeW.value = Math.max(0.6, 0.0016 * S * sh.s) / k0;
    u.uShOff.value.set((0.006 * S * sp + 0.6) / k0, (0.009 * S * sp + 0.8) / k0);
    u.uShSig.value = Math.max(1.2, 0.011 * S * sp) / 2 / k0;
  }
}

function grainTile(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() + r() + r() - 1.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.18; g.lineWidth = 1;
  for (let i = 0; i < size / 3; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 4 + r() * 18;
    g.strokeStyle = r() < 0.5 ? '#000' : '#fff';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
}

// ---- 互動預覽：滾輪 = 往鑰匙孔裡掉，滑鼠 = 輕輕搖鏡頭 ----
const view = { u: 0, uT: 0, yaw: 0, pitch: 0, yawT: 0, pitchT: 0 };
const LMAX = N + 3;                               // 穿過最後的黑色鑰匙孔 → 整個畫面變成黑色空間

const grainCache = {};
function grain(S) { const k = Math.min(1024, Math.round(S / 2)); return grainCache[k] ||= grainTile(k); }

// 海報紙 (第 0 層) → 3D 紙層 → 紙紋 → 暗角
// ---- 進入視角 D：鏡頭從頭頂進來 (光一直是全亮，不從黑變亮) ----
// u 0–WIN0   掉落 (視角 A 不變)
// WIN0–1     樹尖黑孔變成窗：窗裡 = 正上方俯視的棋盤；0.95 左右窗蓋滿畫面
// WIN0–TURN1 一路往下降 (同一條曲線，中間不停)
// turn0–TURN1 邊降邊從俯 90° 轉成最後的俯角 (滑桿「鏡頭俯角」，預設 22°)，光束霧淡入 (turn0 = 滑桿「開始轉角度」，預設 1.0 = 窗蓋滿之後才轉，紙層不會破)
// TURN1–P1  第一段定格 (乾淨的立體棋盤)，滑鼠搖鏡頭淡入
// P1–UMAX   第二段：鏡頭不動，剪紙棋子出場 (節奏在 cutouts3d.js 的 ANIM_DEFAULTS)；UMAX 定格
const viewD = createViewD(renderer);

// ---- 掉落最後一段：樹尖黑孔平順放大 ----
// 原本 L = u·LMAX 等速穿過紙層，最後幾層 1/(1/s − D) 會爆增 → 黑孔 2 格內從小變滿版 (跳一下)。
// 改成：u ≥ A 之後，樹尖深度 z 用「對數二次曲線」縮小 (放大速度連續、逐漸加快)，u = B 時剛好蓋滿畫面。
const DIVE = { A: 0.7, B: 0.97, zEnd: 0.15, D0: 0.85 };   // D0 = 棋盤開始往下降
const fallL = (() => {
  const lr = -Math.log(P.ratio), A1 = Math.pow(P.ratio, -N) + 1, beta = LMAX * lr;   // z(u) = A1 − e^{βu}
  const za = A1 - Math.exp(beta * DIVE.A), ga = Math.log(za), ra = -beta * Math.exp(beta * DIVE.A) / za;
  const dx = DIVE.B - DIVE.A, c = (Math.log(DIVE.zEnd) - ga - ra * dx) / (dx * dx);
  return (u) => {
    u = Math.min(1, u);
    if (u <= DIVE.A) return u * LMAX;
    const x = u - DIVE.A, z = Math.exp(ga + ra * x + c * x * x);
    // 蓋滿之後 (B–1) 把剩下的最後一層紙也穿過去，u = 1 時跟原本一樣「全部掉過」，切到棋盤不會透出綠紙
    return lerp(Math.log(A1 - z) / lr, LMAX, smooth(DIVE.B, 1, u));
  };
})();
const PH = { WIN0: 0.8, TURN1: 1.55 };   // WIN0 = 開始往下降；窗什麼時候出現、多快變亮看滑桿 fade0 / fade1
const P1 = 1.6;     // 第一段 (乾淨的立體棋盤) 定格
const UMAX = 2.6;   // 第二段 (剪紙棋子出場) 定格
const dState = { on: false, win: false };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * t * (t * (6 * t - 15) + 10); };
function camD(u) {
  // 降落用「對數」插值 (畫面放大倍率等速感) ＋ 先快後慢：黑孔蓋滿畫面時棋盤正在快速靠近，不會停在一條小棋盤上
  const x = Math.min(1, Math.max(0, (u - DIVE.D0) / (PH.TURN1 - DIVE.D0)));
  const dist = tune.enterH * Math.pow(tune.dist / tune.enterH, 1 - (1 - x) ** 3);
  const k = sstep(tune.turn0, PH.TURN1, u);
  const fade = sstep(tune.fade0, tune.fade1, u);   // 棋盤從暗慢慢浮現
  // 視角 D 不跟滑鼠搖：鏡頭降到俯 22° 就停住，不會多出別的角度
  const sway = 0;
  return { u, k, dist, fade, haze: sstep(lerp(tune.turn0, PH.TURN1, 0.5), PH.TURN1, u), sway };
}
// 鑰匙孔窗遮罩：只畫看得到的樹尖 (前面的紙層擋住的地方不算)
const maskHide = new THREE.MeshBasicMaterial({ colorWrite: false });
const maskShow = new THREE.MeshBasicMaterial({ color: 0xffffff });
const winCanvas = document.createElement('canvas'), maskCanvas = document.createElement('canvas');
if (q.has("prof")) window.__win = { winCanvas, maskCanvas };
function renderWindow(S, SH, cam) {
  for (const c of [winCanvas, maskCanvas]) if (c.width !== S || c.height !== SH) { c.width = S; c.height = SH; }
  const w = winCanvas.getContext('2d'), m = maskCanvas.getContext('2d');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.render(viewD.scene, viewD.camera);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  w.globalCompositeOperation = 'copy'; w.drawImage(glCanvas, 0, 0);
  const saved = sheets.map((sh) => sh.mesh.material), tipMat = tip.material;
  // 已經大到蓋滿畫面的紙 (比樹尖還大) 不算遮擋：窗要蓋過它們，掉到底時整個畫面就是窗
  const vis = sheets.map((sh) => sh.mesh.visible);
  for (const sh of sheets) { sh.mesh.material = maskHide; if (sh.mesh.scale.x >= tip.scale.x) sh.mesh.visible = false; }
  tip.material = maskShow;
  renderer.render(scene, cam);
  sheets.forEach((sh, i) => { sh.mesh.material = saved[i]; sh.mesh.visible = vis[i]; }); tip.material = tipMat;
  m.globalCompositeOperation = 'copy'; m.drawImage(glCanvas, 0, 0);
  // 掉到底 (背景已經全黑) → 窗外被擋住的棋盤慢慢浮現，u = 1 切成直接畫棋盤時不會跳一下 (原本只剩一條細窗)
  const full = sstep(0.93, 0.99, view.u);
  if (full > 0) { m.globalCompositeOperation = 'source-over'; m.globalAlpha = full; m.fillStyle = '#fff'; m.fillRect(0, 0, S, SH); m.globalAlpha = 1; }
  w.globalCompositeOperation = 'destination-in'; w.drawImage(maskCanvas, 0, 0);
  w.globalCompositeOperation = 'source-over';
}

// ════════════════ 以下是報名網頁新加的 ════════════════
// 剪紙提早出場：鏡頭還在降最後一段，愛麗絲就開始掉 → 不會停在空棋盤上 (原本 gA 1.75 / hA 1.95 / rA 2.2)
Object.assign(tune, { gA: 1.28, gSnap: 1.68, gB: 1.90, hA: 1.60, hB: 2.10, rA: 1.95, rB: 2.45 });
viewD.tune(tune);

// 棋盤鏡頭配合直幅：橫向視野 = 原本正方形的 dz 倍，直向自動算
const FOV0 = THREE.MathUtils.degToRad(viewD.camera.fov);
function fitCamD() {
  const c = viewD.camera, tanH = Math.tan(FOV0 / 2) * P.dz;
  c.aspect = ASPECT;
  c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanH / ASPECT));
  c.updateProjectionMatrix();
}

function render(canvas, W, H) {
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  ASPECT = W / H;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, PAPER[0]); bg.addColorStop(1, PAPER[1]);
  ctx.fillStyle = bgVisible && !dState.on ? bg : HOLE; ctx.fillRect(0, 0, W, H);

  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  if (dState.on) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(viewD.scene, viewD.camera);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    ctx.drawImage(glCanvas, 0, 0);
    viewD.post(ctx, W, H);
    const f = camD(view.u).fade;
    if (f < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - f})`; ctx.fillRect(0, 0, W, H); }
  } else {
    setPx(W);
    if (dState.win) renderWindow(W, H, camera);
    renderer.render(scene, camera);
    ctx.drawImage(glCanvas, 0, 0);
    if (dState.win) { ctx.globalAlpha = camD(view.u).fade; ctx.drawImage(winCanvas, 0, 0); ctx.globalAlpha = 1; }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = P.grain;
  ctx.fillStyle = ctx.createPattern(grain(W), 'repeat'); ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,30,24,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function applyView() {
  placeCameraA(0, 0);
  fitCamD();
  fall(fallL(view.u));
  dState.on = view.u >= 1;
  dState.win = !dState.on && view.u > tune.fade0;
  if (dState.on || dState.win) {
    const c = camD(view.u);
    camera.updateMatrixWorld();
    c.align = new THREE.Vector3(0, P.H * (1 - Math.pow(P.ratio, N)), 0).project(camera);
    c.alignK = 1 - sstep(0.9, 1.0, view.u);
    viewD.set(1, 0, 0, c);
  }
}

// ---- 時間軸：秒 → u (u 0–1 掉進鑰匙孔，1–1.6 鏡頭降到棋盤，1.6–2.6 剪紙人物出場) ----
// 關鍵格 [秒, u]；中間速度接續，頭尾慢慢起步／停下。?dur= 改總長，?t=秒數 定格在那一秒
const DUR = +q.get('dur') || 6.4;
const KEYS = [[0, 0], [2.4, 1], [3.8, P1], [6.4, UMAX]].map(([t, u]) => [t * DUR / 6.4, u]);
function uAt(t) {
  if (t <= 0) return 0;
  if (t >= DUR) return UMAX;
  let i = 1; while (KEYS[i][0] < t) i++;
  const slope = (j) => (KEYS[j + 1][1] - KEYS[j][1]) / (KEYS[j + 1][0] - KEYS[j][0]);
  const m = (j) => (j === 0 || j === KEYS.length - 1 ? 0 : (slope(j - 1) + slope(j)) / 2);
  const [t0, u0] = KEYS[i - 1], [t1, u1] = KEYS[i], h = t1 - t0, s = (t - t0) / h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * u0 + (s3 - 2 * s2 + s) * h * m(i - 1) + (-2 * s3 + 3 * s2) * u1 + (s3 - s2) * h * m(i);
}

// ---- 畫布大小：跟著舞台 (直幅)，像素總數設上限，手機不會太重 ----
const canvas = document.getElementById('c');
const stage = document.getElementById('stage');
let MAXPX = +q.get('px') || 1.4e6;   // 會依手機速度自動往下調 (?px= 指定就不調)
let W = 0, H = 0;
function measure() {
  const r = stage.getBoundingClientRect();
  const k = Math.min(devicePixelRatio || 1, 2, Math.sqrt(MAXPX / (r.width * r.height)));
  W = Math.round(r.width * k); H = Math.round(r.height * k);
}
function draw() { applyView(); render(canvas, W, H); }

// ---- 播放 ----
const body = document.body;
let t0 = null, playing = false, done = false;
const PROF = q.has('prof') ? (window.__prof = []) : null;   // ?prof：記錄每一格 draw 花幾 ms
function tick(now) {
  if (t0 === null) t0 = now;
  const t = (now - t0) / 1000;
  view.u = uAt(t);
  const tp = performance.now(); draw();
  if (PROF) PROF.push([+view.u.toFixed(3), +(performance.now() - tp).toFixed(2)]);
  if (t < DUR) requestAnimationFrame(tick);
  else { playing = false; done = true; body.classList.add('landed'); dispatchEvent(new Event('entry:landed')); }
}
function start() {
  if (playing || done || !body.classList.contains('ready')) return;
  playing = true; body.classList.add('falling');
  t0 = null;   // 每次掉都從 0 秒開始 (倒帶回封面後再掉一次，不會直接跳到棋盤)
  requestAnimationFrame(tick);
}

// 滑一下 (往上滑 / 滾輪往下 / 點提示 / 方向鍵) = 開始；播放中所有滑動都擋掉，不會卡在半路
const lock = (e) => { if (!done) e.preventDefault(); };
addEventListener('wheel', (e) => { lock(e); if (e.deltaY > 4) start(); }, { passive: false });
let ty = null;
addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => { lock(e); if (ty !== null && ty - e.touches[0].clientY > 24) { ty = null; start(); } }, { passive: false });
addEventListener('keydown', (e) => { if (['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { lock(e); start(); } });
document.getElementById('go3d').addEventListener('click', start);

// 倒帶：第一題往下拉 → 時間軸倒著播回鑰匙孔封面 (比掉下去快)；之後再往上滑又可以重新掉一次
const REWIND = 0.5;   // 倒帶花的時間 = 掉落長度 × REWIND
function rewind() {
  if (playing || !done) return;
  playing = true; body.classList.remove('landed');
  const tStart = DUR;
  let s0 = null;
  function back(now) {
    if (s0 === null) s0 = now;
    const t = tStart - (now - s0) / 1000 / REWIND;
    view.u = uAt(Math.max(0, t)); draw();
    if (t > 0) requestAnimationFrame(back);
    else { playing = false; done = false; body.classList.remove('falling'); }
  }
  requestAnimationFrame(back);
}
addEventListener('entry:rewind', rewind);

addEventListener('resize', () => { measure(); if (!playing) draw(); });

// ---- 開場：等剪紙圖載好，先在背景把棋盤畫一次 (編譯 shader、量速度)，再顯示鑰匙孔 ----
measure();
await viewD.cutReady;
await document.fonts?.ready;   // 標題字型載好才量得準
fitCover();
const fixed = q.has('step') ? DUR : q.has('t') ? Math.max(0, +q.get('t')) : q.has('u') ? null : undefined;   // ?step= (看表單) 直接停在定格
view.u = 1.3; draw(); view.u = 0.92; draw();   // 第一次：編譯棋盤＋鑰匙孔窗 (不計時)
// 自動畫質：在載入動畫後面真的連播幾格 (掉到底的鑰匙孔窗 ↔ 棋盤定格輪流)，量實際每格間隔；
// 太慢 (< 約 38 fps) 就降低畫布像素再量，層數和效果都不減。只量一格會被 GPU 同步等待騙到，所以用連播。
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
async function bench(n = 12) {
  const ts = [];
  for (let i = 0; i < n; i++) { const t = await nextFrame(); view.u = i % 2 ? 2.6 : 0.92; draw(); ts.push(t); }
  const d = ts.slice(4).map((t, i) => t - ts[i + 3]).sort((a, b) => a - b);
  return d[d.length >> 1];   // 中位數，避開偶爾一格卡頓
}
const QBUDGET = +q.get('budget') || 26, MINPX = 0.45e6;
let ms = await bench();
const ms0 = ms, px0 = W * H;
for (let k = 0; k < 4 && !q.has('px') && ms > QBUDGET && MAXPX > MINPX; k++) {
  const prevPx = MAXPX, prevMs = ms;
  MAXPX = Math.max(MINPX, MAXPX * Math.min(0.7, (QBUDGET / ms) ** 1.5));
  measure(); ms = await bench();
  // 降了像素卻沒變快 → 是被限速 (iPhone 低耗電模式 / 分頁在背景 = 最多 30 fps)，不是手機跑不動：恢復上一級，停止降
  if (ms > prevMs * 0.85) { MAXPX = prevPx; measure(); ms = prevMs; break; }
}
window.__frameMs = ms;
window.__quality = { ms0: +ms0.toFixed(1), px0, ms: +ms.toFixed(1), px: W * H, W, H };
console.log(`[入口] 每格 ${ms0.toFixed(0)}→${ms.toFixed(0)} ms，畫布 ${W}×${H} (${(W * H / 1e6).toFixed(2)}M px)`);
if (ms > (+q.get('slow') || 90) && !q.has('force3d')) throw Object.assign(new Error('太慢'), { slow: true, ms });
if (fixed !== undefined) {                 // 檢查用定格：?t=秒數 或 ?u=
  view.u = fixed === null ? Math.min(UMAX, Math.max(0, +q.get('u'))) : uAt(fixed);
  done = true;
  body.classList.add('ready', 'falling'); if (view.u >= UMAX) { body.classList.add('landed'); dispatchEvent(new Event('entry:landed')); }
  if (view.u === 0) body.classList.remove('falling');
} else {
  view.u = 0;
  body.classList.add('ready');
}
draw();
// 封面「往上滑」箭頭放在鑰匙孔下緣：把第 0 層鑰匙孔最底點 (模板 (0, RB)) 投影到畫面，寫進 CSS 變數 --khb
// 封面版面：鑰匙孔放在「上緣 T」到「標題上方留給箭頭的位置 B」之間；矮螢幕自動縮小 (aw 變大)，高螢幕維持原本大小
function fitCover() {
  const AW0 = (P.aw0 ??= P.aw), AY0 = (P.ay0 ??= P.ay);   // 原始值 (函式在上面就會被呼叫，所以存在 P 裡)
  const bt = document.querySelector('.over .bottom');
  if (!bt) return;
  const sr = stage.getBoundingClientRect(), asp = sr.width / sr.height;
  const T = 0.115, B = Math.max(T + 0.3, (bt.getBoundingClientRect().top - sr.top - 14) / sr.height);   // 箭頭在鑰匙孔裡 → 底只留 14px
  P.aw = Math.max(AW0, 1450 * asp / (B - T));            // 鑰匙孔全高 = 330 + RB ≈ 1450 海報單位
  P.ay = AY0; ASPECT = asp; placeCameraA(0, 0); camera.updateMatrixWorld();
  const fy = (z) => (1 - new THREE.Vector3(0, 0, z).project(camera).y) / 2;
  // 高螢幕鑰匙孔不再放大 (會壓到日期) → 底部貼齊 B，箭頭緊接著標題；矮螢幕剛好塞滿 T–B
  P.ay = AY0 + (fy(RB / CT) - B) * P.aw / asp;            // 正 = 往上
}
function placeKeyholeCue() {
  placeCameraA(0, 0); camera.updateMatrixWorld();
  const p = new THREE.Vector3(0, 0, RB / CT).project(camera);
  stage.style.setProperty('--khb', ((1 - p.y) / 2 * 100).toFixed(2) + '%');
}
placeKeyholeCue();
addEventListener('resize', () => requestAnimationFrame(() => { if (!playing && !done) { fitCover(); draw(); } placeKeyholeCue(); }));
window.__ready = true;

// ---- 傳令兔對話框用：把兔子嘴巴、腳底投影到畫面 (0–1，未位移的畫布座標) ----
// 對話框的尾巴要指到兔子；鏡頭定格後才有意義
function heraldAnchor() {
  const c = viewD.camera; c.updateMatrixWorld();
  const x = tune.hX, y0 = 0.6 + tune.hY, z = tune.hZ, h = tune.hH;
  const pt = (yy, dx = 0) => { const p = new THREE.Vector3(x + dx, yy, z).project(c); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; };
  return { ear: pt(y0 + h * 1.0), mouth: pt(y0 + h * 0.66, h * 0.1), chest: pt(y0 + h * 0.45), feet: pt(y0), right: pt(y0 + h * 0.45, h * 0.32) };
}
window.__herald = heraldAnchor;
dispatchEvent(new Event('entry:herald'));
addEventListener('resize', () => dispatchEvent(new Event('entry:herald')));
