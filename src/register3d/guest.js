// 隱藏金牌「其他系」(外系朋友)：傳令兔手上舉著的一張小金牌
// 跟剪紙角色同一套：米白紙邊＋紙紋，正面平塗金＋網點、白字「其他系」、四角茶杯 (不用漸層、不發光)。
// 掛在傳令兔的 pivot 底下 → 跟著兔子一起跳進來；畫面上的白色呼吸燈在 register3d.html (#guestBtn)。
import * as THREE from 'three';

// 單位 = 傳令兔身高 (1 = 整隻兔子)。x 右、y 上 (0 = 腳底)、size = 牌高、roll = 歪斜 (弧度)、lift = 選中時往上舉多少
// 預設：畫面左下、拿卷軸那隻手，牌橫著握 (跟卷軸同方向往右下斜)；選中時轉正舉起來
// 橫放、不歪 (roll = 90°)，下緣貼地、站在兔子前面 (z)；從鏡頭看剛好疊在拿卷軸那隻手上 → 像兔子拿著
// yaw = 左右轉 (負 = 左邊往後、右邊往前 → 透視上左高右低，跟傳令兔的手同方向；兔子本身 +0.15 已算進去)
export const GUEST = { x: -0.15, z: 0.12, size: 0.52, roll: 0, yaw: -0.6, lift: 0.2, glowPad: 0.07 };   // size = 牌的寬 (橫式)

const WHITE = '#fff8e6';
const CUP = new Path2D('M3 8h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z M17 9.5h1.5a3 3 0 0 1 0 6H16.6');
const CUP2 = new Path2D('M2 21h16 M8 2.5c-1 1.3 1 2 0 3.3M12 2.5c-1 1.3 1 2 0 3.3');

function paper(back) {
  const W = 420, H = 300, E = 14, c = document.createElement('canvas');   // 橫式牌
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  rr(0, 0, W, H, 28); g.fillStyle = '#efe6d2'; g.fill();                        // 米白紙邊 (跟剪紙一樣)
  rr(E, E, W - 2 * E, H - 2 * E, 18); g.fillStyle = back ? '#e4d8bd' : '#cf9d36'; g.fill();
  if (!back) {
    g.save(); g.clip();
    g.fillStyle = 'rgba(255, 236, 186, .25)';                                     // 網點
    for (let y = 0; y < H; y += 9) for (let x = (y / 9) % 2 ? 4.5 : 0; x < W; x += 9) { g.beginPath(); g.arc(x, y, 1.7, 0, 7); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(255, 248, 230, .8)'; g.lineWidth = 3;
    rr(E + 14, E + 14, W - 2 * E - 28, H - 2 * E - 28, 10); g.stroke();
    g.fillStyle = WHITE; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 70px "Noto Sans TC", sans-serif';
    g.shadowColor = 'rgba(80, 45, 0, .5)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
    g.font = '900 78px "Noto Sans TC", sans-serif';
    g.fillText('其他系', W / 2, H / 2 + 4);
    g.shadowColor = 'transparent';
    const cup = (x, y, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(1.6, 1.6); g.translate(-10, -12);
      g.strokeStyle = WHITE; g.lineWidth = 2.2; g.lineJoin = g.lineCap = 'round';
      g.stroke(CUP); g.lineWidth = 1.8; g.stroke(CUP2); g.restore();
    };
    cup(60, 62, 0); cup(W - 60, H - 62, Math.PI);
  }
  // 紙紋顆粒
  const im = g.getImageData(0, 0, W, H), p = im.data;
  let sd = back ? 5 : 3; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const n = (rnd() - 0.5) * 14; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// herald = 傳令兔的 pivot (cutouts3d.js items.h)；glow = 跟剪紙一樣的自發光 (tune.cutGlow)
export async function createGuest(herald, glow = 0.35) {
  try { await document.fonts.load('900 70px "Noto Sans TC"', '其他系'); } catch (e) { /* 字型沒載到就用系統字 */ }
  const G = GUEST, w = G.size, h = w * 300 / 420;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = (t) => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: glow, alphaTest: 0.5, roughness: 0.92 });
  const front = new THREE.Mesh(geo, mat(paper(false)));
  const back = new THREE.Mesh(geo, mat(paper(true))); back.rotation.y = Math.PI; back.position.z = -0.002;
  front.castShadow = true; front.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: front.material.map, alphaTest: 0.5 });
  // 外發光：牌後面一片比牌大一圈的柔光 (疊加)，貼著牌的形狀、跟著牌動；亮度由網頁那邊呼吸 (setGlow)
  const m = G.glowPad, gw = w + 2 * m, gh = h + 2 * m;
  const gc = document.createElement('canvas'); gc.width = 256; gc.height = Math.round(256 * gh / gw);
  { const g = gc.getContext('2d'), k = 256 / gw;
    g.shadowColor = 'rgba(255, 200, 110, 1)'; g.shadowBlur = m * k * 0.9; g.fillStyle = 'rgba(255, 246, 222, 1)';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(m * k, m * k, w * k, h * k, w * k * 0.09); g.fill(); } }
  const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), glowMat);
  glowMesh.position.z = -0.006; glowMesh.renderOrder = 3;
  const card = new THREE.Group(); card.add(glowMesh, front, back);
  herald.add(card);

  let sel = 0;   // 0–1：被選中 → 往上舉、轉正、變大一點
  function place() {
    card.position.set(G.x, h / 2 + G.lift * sel, G.z);   // 下緣貼地
    card.rotation.set(0, G.yaw * (1 - sel), G.roll * (1 - sel));
    card.scale.setScalar(1 + 0.25 * sel);
  }
  place();
  // 牌的三個角投影到畫面 (0–1 畫布座標)：左下、右下、左上 → 網頁算出中心、寬高、角度，讓外發光貼著牌
  const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  function rect(camera) {
    if (!herald.visible) return null;
    camera.updateMatrixWorld(); card.updateWorldMatrix(true, false);
    return corners.map((c) => { const p = c.clone().applyMatrix4(card.matrixWorld).project(camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; });
  }
  const setGlow = (k) => { glowMat.opacity = k * (1 - sel); glowMesh.visible = glowMat.opacity > 0.01; };
  return { place, rect, setGlow, set sel(v) { sel = v; place(); }, get sel() { return sel; } };
}
