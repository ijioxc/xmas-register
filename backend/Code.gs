/**
 * 愛理不理 聖誕有你｜報名收件程式（Google Apps Script）
 *
 * 用法：在 Google 試算表 → 擴充功能 → Apps Script，把這整份貼進 Code.gs。
 * 步驟見 backend/README.md。
 *
 * 報名頁會 POST 一包 JSON：{ dept, member, sid, name, diet, website }
 * 這裡檢查資料、擋重複學號、寫進「報名」分頁，回傳 { ok, no } 或 { ok:false, error }。
 *
 * v9：名單「自動」依系所排列 (系所照報名頁順序：國企、車輛…電子、其他系；同系所再照序號)
 *  - 每收到一筆報名就重排一次；打開試算表時也會排一次 → 以前的資料不用手動處理。
 *  - 排序靠最右邊一欄隱藏的「系所順序」(數字)，用試算表內建排序整列一起搬，勾選框、備註都跟著走。
 *  - 選單「報名工具 → 依系所重新排列」還在，想手動排也可以。
 *  - 「飲食」在第 8 欄 (姓名後面)；舊表會自動插入這一欄。
 *
 * v48：新增兩題
 *  - 交換禮物「天堂交換／地獄交換」→ 報名分頁第 12 欄「交換禮物」(第 11 欄是隱藏的系所順序)
 *  - 活動許願 (4 選 1) → 報名分頁第 13 欄「許願」(只有你自己的試算表看得到)
 *    另外記到「許願池」分頁：只有「願望｜票數」，沒有姓名學號 → 後台只看這裡 (匿名)
 *  兩個分頁、欄位都會自動建立，不用手動加。
 */

// ───── 設定：要改的都在這裡 ─────
var SHEET_NAME = '報名';
var DEADLINE = new Date('2026-12-14T23:59:59+08:00');   // 過了這個時間就不收
var DEPTS = ['國企系', '車輛系', '財稅系', '土木系', '觀光系', '機械系', '能源系', '金資系', '資工系', '電子系', '其他系'];   // 排列順序也照這個
var FEES = { '系會員': 150, '非系會員': 250 };            // 金額以這裡為準，不信任網頁傳來的數字
var DIETS = ['葷食', '素食', '有忌口'];
var GIFTS = ['天堂交換', '地獄交換'];
var WISHES = ['抽大獎', '看表演', '玩遊戲', '吃好料'];
var WISH_SHEET = '許願池';
var SID_RE = /^[A-Z0-9]{8,12}$/;
var HEADERS = ['序號', '報名時間', '系所', '身分', '應繳', '學號', '姓名', '飲食', '已繳費', '備註'];
var COL = { no: 1, dept: 3, sid: 6, name: 7, diet: 8, paid: 9, note: 10, rank: 11, gift: 12, wish: 13 };   // rank = 隱藏的「系所順序」欄

// ───── 後台（admin.html）登入名單 ─────
// 學號 → 可以管理的系所（'*' = 全部系所；或寫成 ['機械系'] 只看自己系）
// 只用學號登入（不需密碼）
var ADMINS = {
  'C112142235': '*'
};
var TOKEN_HOURS = 6;   // 登入後幾小時要重新登入

/** 打開試算表時：上方多一個「報名工具」選單，並自動依系所排一次 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('報名工具')
    .addItem('依系所重新排列', 'sortByDept')
    .addToUi();
  try { sortByDept(); } catch (err) { /* 排不了也不影響打開 */ }
}

/** 舊表 (沒有「飲食」欄) → 在「姓名」後面插一欄 */
function ensureCols(sh) {
  if (String(sh.getRange(1, COL.diet).getValue()) === '飲食') return;
  sh.insertColumnBefore(COL.diet);
  sh.getRange(1, COL.diet).setValue('飲食').setFontWeight('bold').setBackground('#9bb7ac');
  sh.setColumnWidth(COL.diet, 160);
}

/** 第 12、13 欄標題「交換禮物」「許願」，沒有就補上 */
function ensureExtraCols(sh) {
  [[COL.gift, '交換禮物'], [COL.wish, '許願']].forEach(function (c) {
    const h = sh.getRange(1, c[0]);
    if (String(h.getValue()) !== c[1]) h.setValue(c[1]).setFontWeight('bold').setBackground('#9bb7ac');
  });
}

/** 許願池：匿名，只記「願望｜票數」 */
function addWish(wish) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ws = ss.getSheetByName(WISH_SHEET);
  if (!ws) {
    ws = ss.insertSheet(WISH_SHEET);
    ws.getRange(1, 1, 1, 2).setValues([['願望', '票數']]).setFontWeight('bold').setBackground('#9bb7ac');
    ws.getRange(2, 1, WISHES.length, 2).setValues(WISHES.map(function (w) { return [w, 0]; }));
  }
  const n = Math.max(ws.getLastRow() - 1, 0);
  const rows = n ? ws.getRange(2, 1, n, 2).getValues() : [];
  const i = rows.findIndex(function (r) { return String(r[0]) === wish; });
  if (i >= 0) ws.getRange(i + 2, 2).setValue((Number(rows[i][1]) || 0) + 1);
  else ws.appendRow([wish, 1]);
}

/** 讀許願池 → [{ wish, count }] */
function readWishes() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WISH_SHEET);
  const n = ws ? Math.max(ws.getLastRow() - 1, 0) : 0;
  const rows = n ? ws.getRange(2, 1, n, 2).getValues() : [];
  return WISHES.map(function (w) {
    const r = rows.find(function (x) { return String(x[0]) === w; });
    return { wish: w, count: r ? Number(r[1]) || 0 : 0 };
  });
}

/** 有資料的最後一列 (只看「學號」欄；空白列、勾選框都不算) */
function lastDataRow(sh) {
  const n = Math.max(sh.getLastRow() - 1, 0);
  if (!n) return 1;
  const sids = sh.getRange(2, COL.sid, n, 1).getValues();
  for (let i = n - 1; i >= 0; i--) if (String(sids[i][0]).trim()) return i + 2;
  return 1;
}

const deptRank = (d) => { const i = DEPTS.indexOf(String(d)); return i < 0 ? DEPTS.length : i; };

/** 依系所排列 (要在鎖裡面呼叫)：補上每列的系所順序數字，再用內建排序整列搬 → 勾選框、備註一起走 */
function sortRows(sh) {
  ensureCols(sh);
  const head = sh.getRange(1, COL.rank);
  if (String(head.getValue()) !== '系所順序') { head.setValue('系所順序'); sh.hideColumns(COL.rank); }
  const last = lastDataRow(sh);
  if (last < 2) return;
  const n = last - 1;
  const depts = sh.getRange(2, COL.dept, n, 1).getValues();
  sh.getRange(2, COL.rank, n, 1).setValues(depts.map((r) => [deptRank(r[0])]));
  if (n > 1) sh.getRange(2, 1, n, Math.max(COL.wish, sh.getLastColumn())).sort([{ column: COL.rank, ascending: true }, { column: COL.no, ascending: true }]);
}

/** 選單：依系所重新排列 */
function sortByDept() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sortRows(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME));
  } finally {
    lock.releaseLock();
  }
}

/** 報名頁送出時會呼叫這裡 */
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return reply({ ok: false, error: 'bad' }); }

  if (d.action) return reply(admin(d));
  if (d.website) return reply({ ok: true, no: 100 + Math.floor(Math.random() * 200) });   // 機器人填了隱藏欄位：假裝成功，不寫入
  if (new Date() > DEADLINE) return reply({ ok: false, error: 'closed' });

  const dept = String(d.dept || '');
  const member = dept === '其他系' ? '非系會員' : String(d.member || '');   // 外系朋友一律非系會員
  const sid = String(d.sid || '').trim().toUpperCase().replace(/\s/g, '');
  const name = String(d.name || '').trim().slice(0, 20);
  // 飲食：「葷食」「素食」「有忌口」，後面可接「：說明」；舊版報名頁沒傳就留空
  const diet = String(d.diet || '').trim().slice(0, 60);
  const dietOk = !diet || DIETS.indexOf(diet.split('：')[0]) >= 0;
  // 交換禮物、許願：舊版報名頁沒傳就留空；有傳就要是選項之一
  const gift = String(d.gift || '');
  const wish = String(d.wish || '');
  if (gift && GIFTS.indexOf(gift) < 0) return reply({ ok: false, error: 'bad' });
  if (wish && WISHES.indexOf(wish) < 0) return reply({ ok: false, error: 'bad' });
  if (DEPTS.indexOf(dept) < 0 || !(member in FEES) || !SID_RE.test(sid) || !name || !dietOk) {
    return reply({ ok: false, error: 'bad' });
  }

  // 鎖住，避免兩個人同時送出拿到同一個序號
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    ensureCols(sh);
    const last = lastDataRow(sh);
    const data = last > 1 ? sh.getRange(2, 1, last - 1, COL.diet).getValues() : [];   // 序號…飲食
    // 序號 = 目前最大序號 + 1 (第一位是 0 號)；名單依系所排列後列號跟序號不同，所以看「序號」欄
    let max = -1;
    for (let i = 0; i < data.length; i++) {
      const s = String(data[i][COL.sid - 1]).trim().toUpperCase();
      if (!s) continue;
      if (s === sid) {
        const old = data[i];
        // 學號＋姓名都對 = 本人又填一次：把原本那張票再給他一次
        if (String(old[COL.name - 1]).trim() === name) {
          return reply({ ok: true, again: true, no: old[0], dept: old[2], member: old[3], fee: old[4], name: old[6], sid: s, diet: old[7] });
        }
        // 學號對、姓名不對：不洩漏別人的資料，只說已報名
        return reply({ ok: false, error: 'dup' });
      }
      const n = Number(data[i][0]);
      if (isFinite(n) && n > max) max = n;
    }
    const no = max + 1;
    const r = last + 1;   // 先寫在最後面，下面再整份依系所排
    sh.getRange(r, 1, 1, HEADERS.length).setValues([[no, new Date(), dept, member, FEES[member], sid, name, diet, false, '']]);
    sh.getRange(r, COL.sid).setNumberFormat('@').setValue(sid);   // 學號當文字，開頭的 0 不會被吃掉
    sh.getRange(r, COL.paid).insertCheckboxes();
    ensureExtraCols(sh);
    sh.getRange(r, COL.gift, 1, 2).setValues([[gift, wish]]);
    if (wish) addWish(wish);
    sortRows(sh);
    return reply({ ok: true, no: no, dept: dept, member: member, fee: FEES[member], name: name, sid: sid, diet: diet });
  } finally {
    lock.releaseLock();
  }
}

// ───── 後台 API：{ action:'login'|'list'|'paid', ... } ─────
function admin(d) {
  if (d.action === 'login') {
    const sid = String(d.sid || '').trim().toUpperCase();
    if (!ADMINS[sid]) { Utilities.sleep(800); return { ok: false, error: 'login' }; }
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('adm_' + token, sid, TOKEN_HOURS * 3600);
    return { ok: true, token: token, sid: sid, depts: ADMINS[sid] === '*' ? DEPTS : ADMINS[sid] };
  }
  const who = CacheService.getScriptCache().get('adm_' + String(d.token || ''));
  if (!who || !ADMINS[who]) return { ok: false, error: 'auth' };
  const scope = ADMINS[who] === '*' ? DEPTS : ADMINS[who];
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const last = lastDataRow(sh);
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, COL.gift).getValues() : [];

  if (d.action === 'list') {
    const people = rows.filter((r) => String(r[COL.sid - 1]).trim() && scope.indexOf(String(r[COL.dept - 1])) >= 0).map((r) => ({
      no: r[0], time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), dept: r[2], member: r[3] === '系會員',
      fee: Number(r[4]) || 0, sid: String(r[5]).trim(), name: r[6], diet: r[7], paid: r[8] === true, note: r[9], gift: String(r[COL.gift - 1] || '')
    }));
    // 許願只回傳匿名票數 (不跟名單綁在一起)
    return { ok: true, people: people, wishes: readWishes(), at: new Date().toISOString() };
  }

  if (d.action === 'paid') {
    const sid = String(d.sid || '').trim().toUpperCase();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // 重新讀一次（排序可能讓列號變了），用學號找列
      const fresh = last > 1 ? sh.getRange(2, COL.sid, lastDataRow(sh) - 1, 1).getValues() : [];
      const i = fresh.findIndex((r) => String(r[0]).trim().toUpperCase() === sid);
      if (i < 0) return { ok: false, error: 'missing' };
      const dept = String(sh.getRange(i + 2, COL.dept).getValue());
      if (scope.indexOf(dept) < 0) return { ok: false, error: 'auth' };
      sh.getRange(i + 2, COL.paid).setValue(d.paid === true);
      return { ok: true, sid: sid, paid: d.paid === true, by: who };
    } finally {
      lock.releaseLock();
    }
  }
  return { ok: false, error: 'bad' };
}

/** 用瀏覽器打開網址時看到這個，代表部署成功 */
function doGet() {
  return reply({ ok: true, msg: '報名收件程式運作中', v: 48 });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
