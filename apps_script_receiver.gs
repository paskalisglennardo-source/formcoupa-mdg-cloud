// == Apps Script: Receiver (doPost) ==
// Receives submissions and appends to a Google Sheet.
const RESP_SHEET_ID = 'PUT_RESPONSE_SHEET_ID_HERE';
const RESP_TAB_NAME = 'Form_Data'; // adjust to your sheet name

function doPost(e) {
  try {
    const out = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
    out.setHeader('Access-Control-Allow-Origin','*')
       .setHeader('Access-Control-Allow-Methods','POST,OPTIONS')
       .setHeader('Access-Control-Allow-Headers','Content-Type');

    const raw = e?.postData?.contents || '{}';
    const p = JSON.parse(raw);

    const ss = SpreadsheetApp.openById(RESP_SHEET_ID);
    let sh = ss.getSheetByName(RESP_TAB_NAME);
    if (!sh) sh = ss.insertSheet(RESP_TAB_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Timestamp','Class','Server','MID','Company','Mat Desc','Values(JSON)']);
    }
    sh.appendRow([ new Date(), p.className||'', p.server||'', p.mid||'', p.company||'', p.matDesc||'', JSON.stringify(p.values||[]) ]);
    out.setContent(JSON.stringify({ok:true}));
    return out;
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin','*');
  }
}
