// 服裝指引：剪紙紙娃娃 (K = 西裝版、Q = 洋裝版，兩版共用同一個沒有臉的紙人)
// 每一件衣服是一片獨立的紙：米白紙邊 → 底色 → 網點陰影 → 抖動墨線，最後加紙紋與落影。
// 外套是「可選」，掛在旁邊的衣架上，不穿在身上。
// 形狀全部用「左半邊的點」描，右半邊鏡像，再用 Catmull-Rom 轉成平滑曲線。

export const DRESS = {
  ink: '#151311', paper: '#f6f1e7', body: '#ddd3bf',
  shirt: '#fbf8f0', tie: '#9e1b22', frock: '#8e1a20', frockDk: '#5e0f14', pants: '#24221f', jacket: '#1b1a18', lining: '#5a1a1e',
  edge: 11,      // 紙邊寬 (viewBox 單位)
  shadow: 0.42,  // 落影濃度
};

const f = (n) => +n.toFixed(1);
// 左半邊點 → 整圈 (右半邊鏡像，跳過 x=0 的中線點避免重複)
function mirror(pts) {
  const right = pts.slice().reverse().filter(([x]) => x !== 0).map(([x, y]) => [-x, y]);
  return pts.concat(right);
}
// 平滑封閉路徑 (Catmull-Rom → 三次貝茲)；sharp = 要保留尖角的點索引
function smooth(pts, closed = true, t = 0.5, sharp = new Set()) {
  const n = pts.length, P = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k1 = sharp.has(i % n) ? 0 : t / 3, k2 = sharp.has((i + 1) % n) ? 0 : t / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}
const poly = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + 'Z';
const line = (pts) => smooth(pts, false);
const both = (pts) => [pts, pts.map(([x, y]) => [-x, y])];   // 左右各一條

// ───── 形狀 (以娃娃中線 x=0 為準，腳底約 y=745) ─────
const BODY = mirror([
  [-15, 98], [-17, 126], [-44, 135], [-80, 145], [-99, 160], [-106, 190], [-110, 250], [-115, 320], [-118, 388],
  [-118, 420], [-114, 438], [-104, 444], [-96, 432], [-95, 400], [-93, 330], [-89, 262], [-85, 226], [-82, 226],
  [-78, 262], [-75, 330], [-74, 372], [-80, 420], [-78, 482], [-70, 562], [-62, 642], [-56, 702], [-60, 724],
  [-68, 738], [-52, 746], [-24, 744], [-22, 720], [-24, 680], [-20, 600], [-14, 520], [-6, 462], [0, 455],
]);
const SHIRT = mirror([
  [0, 158], [-16, 112], [-44, 132], [-82, 142], [-103, 158], [-110, 190], [-114, 250], [-120, 330], [-124, 394],
  [-91, 398], [-90, 330], [-86, 264], [-83, 228], [-80, 264], [-78, 330], [-78, 376], [0, 377],
]);
const SHIRT_SHARP = new Set([0, 1, 8, 9, 13, 16, 17, 21, 25, 26, 32]);
const PANTS = mirror([
  [0, 372], [-80, 370], [-82, 392], [-85, 430], [-81, 500], [-75, 580], [-69, 660], [-67, 730],
  [-23, 730], [-22, 660], [-18, 560], [-10, 482], [0, 462],
]);
const PANTS_SHARP = new Set([0, 1, 7, 8, 12, 16, 17, 23]);
// 洋裝：圓領、七分袖、收腰、A 字裙到膝蓋下 (膝蓋約 y=600)
const FROCK = mirror([
  [0, 150], [-22, 142], [-32, 120], [-70, 136], [-101, 152], [-109, 182], [-113, 240], [-119, 318],
  [-91, 322], [-88, 262], [-84, 228], [-78, 262], [-72, 330], [-70, 370], [-86, 440], [-106, 540], [-122, 622],
  [-64, 632], [0, 634],
]);
const FROCK_SHARP = new Set([2, 7, 8, 16, 17, 19, 20, 28, 29, 34]);

// 外套 (掛在衣架上，自己的座標)
const JACKET = mirror([
  [0, 196], [-20, 112], [-48, 124], [-88, 136], [-112, 154], [-118, 188], [-124, 260], [-128, 340], [-131, 404],
  [-101, 408], [-97, 340], [-93, 272], [-91, 238], [-92, 310], [-94, 390], [-96, 456], [-40, 462], [-10, 440], [0, 420],
]);

// ───── SVG 零件 ─────
// 一片紙：紙邊 + 底色 + (網點陰影) + 墨線
function piece({ d, fill, shade = '', lines = '', inkOn = DRESS.ink, lw = 2.4, extra = '' }) {
  return `<g class="pc-paper" filter="url(#dPaper)">
    <path d="${d}" fill="${DRESS.paper}" stroke="${DRESS.paper}" stroke-width="${DRESS.edge * 2}" stroke-linejoin="round"/>
    <path d="${d}" fill="${fill}"/>
    ${shade}
    ${extra}
    <g filter="url(#dWob)" fill="none" stroke="${inkOn}" stroke-linecap="round" stroke-linejoin="round">
      <path d="${d}" stroke-width="${lw}"/>${lines}
    </g></g>`;
}
const dots = (d, id = 'dDotInk', op = 0.55) => `<path d="${d}" fill="url(#${id})" opacity="${op}"/>`;
const ln = (d, w = 1.5, extra = '') => `<path d="${d}" stroke-width="${w}" ${extra}/>`;

function defs() {
  return `<defs>
    <filter id="dWob" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/>
      <feDisplacementMap in="SourceGraphic" scale="2.6"/>
    </filter>
    <filter id="dPaper" x="-10%" y="-10%" width="125%" height="125%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0 0.32  0 0 0 0.55 -0.12" result="g"/>
      <feComposite in="g" in2="SourceAlpha" operator="in" result="g2"/>
      <feBlend in="SourceGraphic" in2="g2" mode="multiply" result="p"/>
      <feDropShadow in="p" dx="3" dy="6" stdDeviation="5" flood-color="#000" flood-opacity="${DRESS.shadow}"/>
    </filter>
    <pattern id="dDotInk" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx="2.5" cy="2.5" r="1.25" fill="${DRESS.ink}"/></pattern>
    <pattern id="dDotLite" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx="2.5" cy="2.5" r="1.1" fill="${DRESS.paper}"/></pattern>
    <pattern id="dTieStripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
      <rect width="12" height="12" fill="${DRESS.tie}"/><rect y="0" width="12" height="2.2" fill="#6e1016"/><rect y="5" width="12" height="1" fill="#c9877a" opacity=".55"/></pattern>
  </defs>`;
}

// 紙娃娃本體 (底紙)：沒有臉，腳下一條往後摺的紙腳
function doll() {
  const shade = dots(smooth([[-82, 230], [-76, 330], [-74, 372], [-62, 372], [-70, 300]]), 'dDotInk', 0.25)
    + dots(smooth([[-6, 462], [-14, 520], [-20, 600], [-8, 600], [0, 520]]), 'dDotInk', 0.25);
  const stand = `<path d="M-74 742 L74 742 L84 772 L-84 772Z" fill="${DRESS.body}" stroke="${DRESS.paper}" stroke-width="14" stroke-linejoin="round" paint-order="stroke"/>
    <path d="M-74 742 L74 742 L84 772 L-84 772Z" fill="${DRESS.body}"/>
    <g filter="url(#dWob)" fill="none" stroke="${DRESS.ink}" stroke-width="1.6"><path d="M-74 742 L74 742 L84 772 L-84 772Z"/><path d="M-70 744 L70 744" stroke-dasharray="6 5" opacity=".6"/></g>`;
  return `<g class="doll-body">${stand}
    ${piece({ d: smooth(BODY), fill: DRESS.body, shade, lw: 2.2 })}
    ${piece({ d: `M0 16 C24 16 36 38 36 62 C36 90 22 108 0 108 C-22 108 -36 90 -36 62 C-36 38 -24 16 0 16Z`, fill: DRESS.body, lw: 2.2,
      shade: dots('M-30 70 C-26 92 -12 104 4 106 C-14 96 -22 84 -24 64Z', 'dDotInk', 0.3) })}
  </g>`;
}

function pants() {
  const crease = both([[-47, 396], [-46, 520], [-45, 640], [-45, 726]]).map((p) => ln(line(p), 1.2, 'opacity=".55"')).join('');
  const lines = ln('M-82 398 L82 398', 1.4) + crease
    + ln(line([[-78, 398], [-70, 418], [-60, 446]]), 1.4) + ln(line([[78, 398], [70, 418], [60, 446]]), 1.4)
    + ln(line([[3, 393], [5, 430], [-2, 456]]), 1.3);
    
  const shade = dots(smooth([[-10, 478], [-18, 560], [-22, 660], [-23, 728], [-34, 728], [-30, 600], [-20, 500]]), 'dDotLite', 0.32)
    + dots(smooth([[10, 478], [18, 560], [22, 660], [23, 728], [34, 728], [30, 600], [20, 500]]), 'dDotLite', 0.22)
    + dots(smooth([[-82, 400], [-84, 440], [-78, 520], [-70, 520], [-72, 440]]), 'dDotLite', 0.3);
  // 紙娃娃的反摺小紙片 (掛在腰兩側)
  const tabs = [-1, 1].map((s) => `<path d="M${s * 80} 376 L${s * 98} 368 L${s * 100} 384 L${s * 84} 392Z" fill="${DRESS.paper}" stroke="${DRESS.ink}" stroke-width="1.3" stroke-dasharray="${s > 0 ? '0' : '0'}"/>`).join('');
  return `<g class="cloth pants">${piece({ d: smooth(PANTS, true, 0.5, PANTS_SHARP), fill: DRESS.pants, shade, lines, inkOn: '#efe6d2', lw: 2 })}</g>`;
}

function shirt() {
  const collar = [-1, 1].map((s) => `<path d="${poly([[s * 2, 158], [s * 17, 110], [s * 30, 122], [s * 34, 150]])}" fill="${DRESS.shirt}"/>`).join('');
  const collarInk = [-1, 1].map((s) => ln(poly([[s * 2, 158], [s * 17, 110], [s * 30, 122], [s * 34, 150]]), 1.8)).join('');
  const buttons = [176, 214, 252, 290, 328, 366].map((y) => `<circle cx="4" cy="${y}" r="3" fill="none" stroke="${DRESS.ink}" stroke-width="1.2"/>`).join('');
  const lines = collarInk + ln('M0 158 L0 388', 1.3) + ln('M8 160 L8 388', 1) + buttons
    + both([[-122, 374], [-106, 376], [-92, 378]]).map((p) => ln(line(p), 1.5)).join('')   // 袖口
    + both([[-84, 232], [-96, 262], [-100, 300]]).map((p) => ln(line(p), 1.1, 'opacity=".6"')).join('')   // 腋下皺褶
    + both([[-40, 368], [-36, 388]]).map((p) => ln(line(p), 1, 'opacity=".5"')).join('')
    + both([[-60, 360], [-52, 388]]).map((p) => ln(line(p), 1, 'opacity=".5"')).join('');
  const shade = dots(smooth([[-83, 232], [-78, 330], [-78, 386], [-64, 386], [-68, 300]]), 'dDotInk', 0.35)
    + dots(smooth([[83, 232], [78, 330], [78, 386], [66, 386], [70, 300]]), 'dDotInk', 0.22)
    + dots(smooth([[-42, 134], [-20, 150], [-2, 162], [-24, 162], [-46, 150]]), 'dDotInk', 0.3)
    + dots(smooth([[-112, 200], [-118, 300], [-122, 372], [-110, 372], [-104, 280]]), 'dDotInk', 0.3);
  const tabs = [-1, 1].map((s) => `<path d="M${s * 52} 132 L${s * 56} 112 L${s * 76} 112 L${s * 80} 140Z" fill="${DRESS.paper}"/>
    <path d="M${s * 52} 132 L${s * 56} 112 L${s * 76} 112 L${s * 80} 140" fill="none" stroke="${DRESS.ink}" stroke-width="1.3"/>
    <path d="M${s * 52} 132 L${s * 80} 140" fill="none" stroke="${DRESS.ink}" stroke-width="1.1" stroke-dasharray="4 3"/>`).join('');
  return `<g class="cloth shirt">
    ${piece({ d: smooth(SHIRT, true, 0.5, SHIRT_SHARP), fill: DRESS.shirt, shade, lines, extra: collar })}</g>`;
}

function belt() {
  const d = 'M-81 378 C-40 381 40 381 81 378 L82 396 C40 399 -40 399 -82 396Z';
  return `<g class="cloth belt"><path d="${d}" fill="#0e0d0c" stroke="${DRESS.paper}" stroke-width="8" stroke-linejoin="round" paint-order="stroke"/>
    <rect x="-11" y="377" width="22" height="22" rx="2" fill="#0e0d0c" stroke="#c9a45c" stroke-width="2.6"/><path d="M0 382 L0 394" stroke="#c9a45c" stroke-width="2.2"/></g>`;
}

function tie() {
  const knot = poly([[-11, 150], [11, 150], [7, 170], [-7, 170]]);
  const blade = poly([[-7, 170], [7, 170], [17, 300], [0, 322], [-17, 300]]);
  const lines = ln(knot, 1.8) + ln(line([[-3, 174], [-6, 240], [-9, 296]]), 1, 'opacity=".45"');
  const shade = dots(poly([[-7, 170], [-1, 170], [-6, 300], [-17, 300]]), 'dDotInk', 0.35);
  return `<g class="cloth tie">${piece({ d: blade, fill: 'url(#dTieStripe)', shade, lines, extra: `<path d="${knot}" fill="${DRESS.tie}"/>`, lw: 2 })}</g>`;
}

function frock() {
  const pleats = [[-22, 380, -34, 628], [-48, 378, -80, 626], [-66, 400, -108, 612]]
    .flatMap(([a, b, c, d]) => [[[a, b], [(a + c) / 2, (b + d) / 2 + 4], [c, d]], [[-a, b], [-(a + c) / 2, (b + d) / 2 + 4], [-c, d]]])
    .map((p) => ln(line(p), 1.2, 'opacity=".55"')).join('');
  const lines = pleats
    + both([[-118, 304], [-104, 306], [-92, 308]]).map((p) => ln(line(p), 1.4)).join('')          // 袖口
    + ln(line([[-22, 142], [-10, 149], [0, 150], [10, 149], [22, 142]]), 1.4)                  // 領口
    + both([[-84, 232], [-96, 258], [-100, 292]]).map((p) => ln(line(p), 1.1, 'opacity=".6"')).join('');
  const shade = dots(smooth([[-84, 232], [-72, 330], [-70, 370], [-58, 370], [-64, 300]]), 'dDotInk', 0.4)
    + dots(smooth([[-70, 380], [-86, 450], [-106, 540], [-120, 618], [-96, 622], [-78, 500]]), 'dDotInk', 0.38)
    + dots(smooth([[70, 380], [86, 450], [106, 540], [120, 618], [104, 622], [84, 500]]), 'dDotInk', 0.22)
    + dots(smooth([[-112, 200], [-116, 260], [-118, 302], [-106, 304], [-104, 250]]), 'dDotInk', 0.3);
  const sheen = dots(smooth([[22, 170], [40, 240], [44, 330], [30, 330], [24, 250]]), 'dDotLite', 0.18);
  // 細腰帶 + 小蝴蝶結
  const bow = `<path d="M-70 364 C-30 368 30 368 70 364 L71 378 C30 382 -30 382 -71 378Z" fill="#141210"/>
    <path d="M0 371 C-14 358 -30 360 -28 372 C-30 384 -14 386 0 371Z M0 371 C14 358 30 360 28 372 C30 384 14 386 0 371Z" fill="#141210" stroke="#efe6d2" stroke-width="1"/>
    <path d="M-3 373 L-12 398 M3 373 L12 398" stroke="#141210" stroke-width="4" stroke-linecap="round"/>`;
  return `<g class="cloth frock">${piece({ d: smooth(FROCK, true, 0.5, FROCK_SHARP), fill: DRESS.frock, shade: shade + sheen, lines, extra: bow, inkOn: '#f3e2d6', lw: 2.2 })}</g>`;
}

// 外套掛在衣架上 (可選)：衣架、外套、紙牌「外套 可選」
function jacket() {
  const hanger = `<g filter="url(#dWob)" fill="none" stroke="${DRESS.ink}" stroke-linecap="round">
      <path d="M0 112 L0 84 C0 66 18 62 22 72 C26 82 14 90 8 82" stroke-width="3"/>
      <path d="M-104 150 C-60 124 -20 110 0 108 C20 110 60 124 104 150" stroke="#8a6238" stroke-width="7"/>
      <path d="M-104 150 C-60 124 -20 110 0 108 C20 110 60 124 104 150" stroke="${DRESS.ink}" stroke-width="1.4" transform="translate(0 4)" opacity=".5"/></g>`;
  const lapel = (s) => poly([[s * 20, 112], [s * 6, 196], [s * 2, 300], [s * 30, 210], [s * 50, 186], [s * 38, 168], [s * 34, 124]]);
  const opening = `<path d="${poly([[-20, 112], [20, 112], [6, 196], [2, 300], [0, 310], [-2, 300], [-6, 196]])}" fill="${DRESS.lining}"/>`;
  const lap = [-1, 1].map((s) => `<path d="${lapel(s)}" fill="#252321"/>`).join('');
  const lines = [-1, 1].map((s) => ln(lapel(s), 1.4)).join('')
    + ln('M0 300 L0 420', 1.3)
    + [330, 376].map((y) => `<circle cx="-8" cy="${y}" r="4.2" fill="#3a3632" stroke="#efe6d2" stroke-width="1.2"/>`).join('')
    + ln('M-84 372 L-38 374', 1.5) + ln('M84 372 L38 374', 1.5) + ln('M-74 232 L-46 228', 1.4)
    + both([[-128, 384], [-114, 386], [-100, 388]]).map((p) => ln(line(p), 1.2, 'opacity=".7"')).join('');
  const shade = dots(smooth([[-91, 240], [-92, 310], [-94, 390], [-96, 452], [-82, 452], [-80, 330]]), 'dDotLite', 0.25)
    + dots(smooth([[-116, 196], [-124, 300], [-130, 396], [-118, 396], [-110, 290]]), 'dDotLite', 0.22);
  const tag = `<g class="tag-opt" transform="translate(70 40) rotate(9)">
      <path d="M-2 0 C-30 -10 -56 30 -70 60" fill="none" stroke="${DRESS.ink}" stroke-width="1.4" transform="translate(-14 4)"/>
      <g filter="url(#dPaper)"><path d="M0 -14 L74 -14 L74 34 L0 34 L-14 10Z" fill="${DRESS.paper}" stroke="${DRESS.ink}" stroke-width="1.6"/></g>
      <circle cx="-2" cy="10" r="3.2" fill="none" stroke="${DRESS.ink}" stroke-width="1.4"/>
      <text x="38" y="9" text-anchor="middle" font-size="17" font-weight="900" fill="${DRESS.ink}">外套</text>
      <text x="38" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="${DRESS.tie}" letter-spacing="2">可選</text></g>`;
  return `<g class="cloth jacket">${hanger}
    ${piece({ d: smooth(JACKET, true, 0.5, new Set([0, 1, 8, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 28, 29, 36])), fill: DRESS.jacket, shade, lines, extra: opening + lap, inkOn: '#efe6d2', lw: 2 })}
    ${tag}</g>`;
}

const wide = (g) => g.replace(/width="76"/g, 'width="90"').replace(/x="-38"/g, 'x="-45"');
// 小紙牌標籤：標出每一件 (線拉到衣服上)
function label(x, y, text, to, rot = 0) {
  return `<g class="lbl" transform="translate(${x} ${y}) rotate(${rot})">
    <g transform="rotate(${-rot})"><path d="M0 0 L${to[0] - x} ${to[1] - y}" stroke="${DRESS.paper}" stroke-width="4" stroke-linecap="round"/>
    <path d="M0 0 L${to[0] - x} ${to[1] - y}" stroke="${DRESS.ink}" stroke-width="1.6" stroke-dasharray="4 4"/>
    <circle cx="${to[0] - x}" cy="${to[1] - y}" r="4.5" fill="${DRESS.ink}" stroke="${DRESS.paper}" stroke-width="2"/></g>
    <g filter="url(#dPaper)"><rect x="-38" y="-17" width="76" height="34" rx="4" fill="${DRESS.paper}"/></g>
    <rect x="-38" y="-17" width="76" height="34" rx="4" fill="none" stroke="${DRESS.ink}" stroke-width="1.4"/>
    <text x="0" y="7" text-anchor="middle" font-size="18" font-weight="900" fill="${DRESS.ink}" letter-spacing="1">${text}</text></g>`;
}

// 定格 (全部穿好)：kind 'm' = K 西裝版、'f' = Q 洋裝版
export const SAY_DRESS = {
  m: ['正式服裝，這樣穿！', '襯衫＋領帶＋西裝褲，外套看場合。'],
  f: ['正式服裝，這樣穿！', '洋裝要蓋過膝蓋；或襯衫配西裝褲／裙子。外套看場合。'],
};
export function dollSVG(kind = 'm') {
  const isF = kind === 'f';
  const DX = 196, JX = 488;   // 娃娃與衣架的中線
  return `<svg class="doll-svg" viewBox="20 -10 600 800" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans TC', sans-serif" aria-hidden="true">
    ${defs()}
    <defs><filter id="dBlur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="7"/></filter></defs>
    <ellipse cx="${DX}" cy="778" rx="130" ry="13" fill="#000" opacity=".55" filter="url(#dBlur)"/>
    <g transform="translate(${DX} 0)">
      ${doll()}${isF ? frock() : pants() + shirt() + belt() + tie()}
    </g>
    <g transform="translate(${JX} 60) rotate(5) scale(.8)">${jacket()}</g>
    ${isF ? label(62, 250, '洋裝', [DX - 50, 270], -6) + wide(label(62, 640, '過膝', [DX - 118, 622], -3))
        : label(70, 300, '襯衫', [DX - 60, 300], -6) + label(70, 200, '領帶', [DX - 2, 222], 4) + wide(label(76, 560, '西裝褲', [DX - 48, 560], -3))}
  </svg>`;
}
