/**
 * 덕영 공간 배치 시뮬레이터 — 온라인 저장소 (Google Apps Script 웹 앱)
 *
 * 이 스크립트가 붙은 구글 시트의 'data' 시트에 공동 편집 배치·온라인 저장 배치·의견을 보관함.
 *   A열 컬렉션 | B열 문서 id | C열 내용(JSON) | D열 고친 시각(ms) | E열 삭제 표시
 *
 * GET  ?t=<ms>                     → t 이후에 바뀐 문서 목록 { now, docs:[{c,id,d,u}] } (d가 null이면 삭제됨)
 * POST {"c":컬렉션,"id":문서,"d":내용} → 저장 (d가 null이면 삭제) → { ok, u }
 */
var SHEET_NAME = 'data';
var COLLECTIONS = { live: true, layouts: true, notes: true };
var MAX_CELL = 49000;   // 시트 한 칸에 들어가는 글자 수 한도(5만)보다 조금 작게

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange('A:E').setNumberFormat('@');   // id·숫자가 날짜/숫자로 바뀌지 않게 글자로 보관
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var t = Number((e && e.parameter && e.parameter.t) || 0);
  var now = Date.now();
  var sh = sheet_();
  var docs = [];
  if (sh.getLastRow() > 0) {
    var rows = sh.getRange(1, 1, sh.getLastRow(), 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var u = Number(r[3]);
      if (!r[0] || !(u > t)) continue;
      var d = null;
      if (!r[4]) { try { d = JSON.parse(r[2]); } catch (err) { continue; } }
      docs.push({ c: String(r[0]), id: String(r[1]), d: d, u: u });
    }
  }
  return json_({ now: now, docs: docs });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  var c = String(body.c || ''), id = String(body.id || '');
  if (!COLLECTIONS[c] || !/^[A-Za-z0-9_\-]{1,80}$/.test(id)) return json_({ ok: false, error: 'bad_target' });
  var text = body.d === null || body.d === undefined ? '' : JSON.stringify(body.d);
  if (text.length > MAX_CELL) return json_({ ok: false, error: 'too_large' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    var u = Date.now();
    var row = 0;
    if (sh.getLastRow() > 0) {
      var keys = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === c && String(keys[i][1]) === id) { row = i + 1; break; }
      }
    }
    var values = [[c, id, text, String(u), text ? '' : '1']];
    if (row) sh.getRange(row, 1, 1, 5).setValues(values);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues(values);
    SpreadsheetApp.flush();
    return json_({ ok: true, u: u });
  } finally {
    lock.releaseLock();
  }
}
