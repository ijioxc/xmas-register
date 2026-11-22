// 視角 D 的剪紙棋子：使用者自己在 Affinity 做的向量檔 (assets/cutouts/*.svg)
// SVG 裡已經有墨線、上色和米白紙邊，這裡只負責：裁掉空白、加紙紋顆粒、背面做成素米白紙。
// 兔子底下有一片往後摺的紙腳；女孩用白紙條吊著。
// 吃同一盞鑰匙孔聚光燈，影子用 customDepthMaterial + alphaTest 剪出剪影形狀。
import * as THREE from 'three';

// 可以用滑桿調的：x, z = 棋盤座標；y = 離地；h = 高度；yaw = 左右轉；tilt = 前後倒；roll = 紙面內歪
export const CUT_DEFAULTS = {
  hX: -150, hZ: -150, hY: 0, hH: 150, hYaw: 0.15, hTilt: 0, hRoll: 0,          // 傳令兔 c6
  rX: 230, rZ: -330, rY: 0, rH: 110, rYaw: -0.1, rTilt: 0, rRoll: -0.14,      // 奔跑兔 h8 角落，衝出棋盤
  gX: 30, gZ: -120, gY: 200, gH: 95, gYaw: 0, gTilt: 0, gRoll: 0,  // 女孩：吊在光柱裡，正面朝鏡頭
  cutGlow: 0.35,   // 紙片自己亮多少 (不靠聚光燈也看得到)
};
// 第二段動畫節奏 (u = 滾輪進度；兩顆棋子定格在 1.6，剪紙全部站好在 2.6；鏡頭兩段都一樣不動)
export const ANIM_DEFAULTS = {
  gA: 1.75, gSnap: 2.05, gB: 2.20, gDrop: 700, gSpin: 1, gBounce: 40,   // 愛麗絲：開始掉、紙條拉緊、停住；掉多高、轉幾圈、彈多大
  hA: 1.95, hB: 2.30, hFrom: -470, hHops: 3, hHopH: 20, hWob: 0.15,   // 傳令兔：正面朝鏡頭從 x hFrom 跳進來，跳幾下、多高、左右搖多少
  rA: 2.20, rB: 2.50, rFrom: -380, rUp: 0.12, rLean: 0.3, rHops: 7, rHopH: 28,   // 奔跑兔：從 x rFrom 立起來 (佔 rUp 的時間)，往右衝，衝刺時前傾、跳幾下、多高
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const prog = (a, b, u) => clamp01((u - a) / Math.max(1e-6, b - a));
const ss = (t) => t * t * (3 - 2 * t);
const LIST = [
  { key: 'h', src: 'assets/cutouts/herald.svg', foot: true },
  { key: 'r', src: 'assets/cutouts/runner.svg', foot: true, mirror: true },   // 原圖往左跑 → 鏡像成往右
  { key: 'g', src: 'assets/cutouts/falling.svg', string: true },
];

const loadImg = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });

// SVG → 剪紙貼圖 (front：原圖＋紙紋；back：同形狀的素米白紙)
function paper(img, mirror) {
  // 1) 以長邊 2048 畫出來，找出不透明的外框
  const MAX = 2048, s0 = MAX / Math.max(img.width, img.height);
  const W0 = Math.round(img.width * s0), H0 = Math.round(img.height * s0);
  const a = document.createElement('canvas'); a.width = W0; a.height = H0;
  const ga = a.getContext('2d');
  if (mirror) { ga.translate(W0, 0); ga.scale(-1, 1); }
  ga.drawImage(img, 0, 0, W0, H0);
  const d = ga.getImageData(0, 0, W0, H0).data;
  let x0 = W0, y0 = H0, x1 = 0, y1 = 0;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    if (d[(y * W0 + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // 2) 裁到外框 (留 2px 不讓 mipmap 糊到邊)
  const W = x1 - x0 + 5, H = y1 - y0 + 5;
  const f = document.createElement('canvas'); f.width = W; f.height = H;
  const g = f.getContext('2d');
  g.drawImage(a, x0 - 2, y0 - 2, W, H, 0, 0, W, H);
  // 3) 紙紋顆粒
  const im = g.getImageData(0, 0, W, H), p = im.data;
  let sd = 7; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const n = (rnd() - 0.5) * 14; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(im, 0, 0);
  // 背面：整片米白
  const b = document.createElement('canvas'); b.width = W; b.height = H;
  const gb = b.getContext('2d'); gb.drawImage(f, 0, 0); gb.globalCompositeOperation = 'source-in'; gb.fillStyle = '#e9e0cc'; gb.fillRect(0, 0, W, H);
  return { front: f, back: b, aspect: W / H, padY: 2 / H };
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export async function buildCutouts() {
  const group = new THREE.Group();
  const items = {};
  const imgs = await Promise.all(LIST.map((it) => loadImg(it.src)));
  LIST.forEach((it, n) => {
    const P = paper(imgs[n], it.mirror);
    const ft = tex(P.front), bt = tex(P.back);
    // 1 單位高的紙片，原點 = 剪影腳底中間 (扣掉白邊)
    const geo = new THREE.PlaneGeometry(P.aspect, 1); geo.translate(0, 0.5 - P.padY, 0);
    const piv = new THREE.Group(); piv.rotation.order = 'YXZ';
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ft, emissiveMap: ft, emissive: 0xffffff, alphaTest: 0.5, roughness: 0.92, side: THREE.FrontSide, shadowSide: THREE.DoubleSide }));
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffffff, alphaTest: 0.5, roughness: 0.95, side: THREE.FrontSide }));
    back.rotation.y = Math.PI; back.position.z = -0.002;
    front.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ft, alphaTest: 0.5, side: THREE.DoubleSide });
    front.castShadow = true; front.receiveShadow = back.receiveShadow = true;
    piv.add(front, back);
    const paperMat = new THREE.MeshStandardMaterial({ color: '#ece3cf', emissive: '#ece3cf', roughness: 0.95, side: THREE.DoubleSide });
    if (it.foot) {   // 往後摺的紙腳：平躺在地上
      const fw = P.aspect * 0.55, fd = 0.09;
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), paperMat);
      foot.rotation.x = -Math.PI / 2; foot.position.set(0, 0.004, -fd / 2);
      foot.receiveShadow = true; foot.castShadow = true;
      piv.add(foot); piv.userData.foot = foot;
    }
    if (it.string) {   // 立體書的白紙撐條，從頭頂往上吊
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 6), paperMat);
      st.position.set(0, 0.5 + 3, -0.003); st.castShadow = true;
      piv.add(st); piv.userData.string = st;
    }
    group.add(piv);
    items[it.key] = piv;
  });
  const glowMats = new Set();
  group.traverse((o) => o.material && o.material.emissive && glowMats.add(o.material));
  // 先放到最終位置，再依 u 套動畫 (u ≥ 2.6 = 最終位置；u 在角色出場前 = 看不到)
  function place(T, u = 99) {
    for (const m of glowMats) m.emissiveIntensity = T.cutGlow;
    for (const k of Object.keys(items)) {
      const o = items[k];
      o.position.set(T[k + 'X'], 0.6 + T[k + 'Y'], T[k + 'Z']);
      o.rotation.set(T[k + 'Tilt'], T[k + 'Yaw'], T[k + 'Roll']);
      o.scale.setScalar(T[k + 'H']);
      o.visible = true;
    }
    // 愛麗絲：越掉越快、邊掉邊轉 → 紙條啪一下拉緊 → 上下彈兩下停住
    {
      const o = items.g, st = o.userData.string;
      o.visible = u > T.gA;
      st.visible = u >= T.gSnap;
      if (u < T.gSnap) {
        const t = prog(T.gA, T.gSnap, u);
        o.position.y += T.gDrop * (1 - t * t);
        o.rotation.z -= T.gSpin * Math.PI * 2 * (1 - t);
      } else {
        const s = prog(T.gSnap, T.gB, u);
        o.position.y -= T.gBounce * Math.sin(Math.PI * 4 * s) * (1 - s) ** 2;
      }
    }
    // 傳令兔：一直正面朝鏡頭，左、右、左一跳一跳進來 (每跳往不同邊歪)，最後一跳落地壓扁一下
    {
      const o = items.h, t = prog(T.hA, T.hB, u);
      o.visible = u > T.hA;
      const t1 = clamp01(t / 0.85), t2 = clamp01((t - 0.85) / 0.15);
      o.position.x = T.hFrom + (T.hX - T.hFrom) * t1;
      o.position.y += T.hHopH * Math.abs(Math.sin(Math.PI * T.hHops * t1));
      o.rotation.z += T.hWob * Math.sin(Math.PI * T.hHops * t1);
      o.scale.y *= 1 - 0.1 * Math.sin(Math.PI * t2);
    }
    // 奔跑兔：平躺 → 立體書一樣啪地立起來 → 往右加速衝 → 急煞，身體往前傾再回正
    {
      const o = items.r, t = prog(T.rA, T.rB, u);
      o.visible = u > T.rA;
      const up = clamp01(t / T.rUp), s = clamp01((t - T.rUp) / (1 - T.rUp));
      o.rotation.x = -Math.PI / 2 + (T.rTilt + Math.PI / 2) * (1 - (1 - up) ** 3);
      o.userData.foot.visible = up > 0.6;
      o.position.x = T.rFrom + (T.rX - T.rFrom) * ss(s);
      o.position.y += T.rHopH * Math.abs(Math.sin(Math.PI * T.rHops * s)) * (1 - 0.6 * s);
      const brake = clamp01((s - 0.8) / 0.2);
      o.rotation.z -= T.rLean * Math.sin(Math.PI * s) - 0.5 * T.rLean * Math.sin(Math.PI * brake);
    }
  }
  return { group, place };
}
