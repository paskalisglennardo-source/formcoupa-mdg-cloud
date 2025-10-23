// == Apps Script: Data Exporter (doGet) ==
// Reads two spreadsheets and emits JSON in the structure expected by index.html.
// Fill these with your actual Spreadsheet IDs and tab names.
const CLASS_SHEET_ID = 'PUT_CLASS_SHEET_ID_HERE';
const CHAR_SHEET_ID  = 'PUT_CHARACTERISTIC_SHEET_ID_HERE';

const CLASS_CHAR_TAB = 'Class Def. - Characteristics';
const CLASS_KEY_TAB  = 'Class Def. - Desc and Keywords';
const CHAR_DESC_TAB  = 'Char Def. - Descriptions';
const CHAR_ATTR_TAB  = 'Char Def. - Attributes';
const CHAR_VAL_TAB   = 'Char Def. - CHAR Values';

function doGet() {
  const out = buildJson();
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin','*');
}

function buildJson() {
  const classes = readClassChar();
  const charDesc = readCharDesc();
  const charAttr = readCharAttr();
  const charValues = readCharValues();
  return { classes, char_desc: charDesc, char_attr: charAttr, char_values: charValues };
}

function readClassChar() {
  const sh = SpreadsheetApp.openById(CLASS_SHEET_ID).getSheetByName(CLASS_CHAR_TAB);
  const values = sh.getDataRange().getValues();
  // Find headers
  const hdrRow = values.findIndex(r => String(r).indexOf('Class Name*') !== -1);
  const hdr = values[hdrRow];
  const map = headerIndex(hdr, ['Class Name*','Item Number*','Characteristic Name*']);
  const rows = values.slice(hdrRow+3); // skip meta rows
  const out = {};
  rows.forEach(r => {
    const cls = String(r[map['Class Name*']]||'').trim();
    const seq = Number(r[map['Item Number*']]||0);
    const ch  = String(r[map['Characteristic Name*']]||'').trim();
    if (!cls || !ch) return;
    (out[cls] = out[cls] || []).push({
      sequence: seq, characteristic: ch
      // Case/Prefix/Suffix/WithoutSpace bisa Anda gabungkan dari Table 1 jika Anda taruh di sheet lain
    });
  });
  return out;
}

function readCharDesc() {
  const sh = SpreadsheetApp.openById(CHAR_SHEET_ID).getSheetByName(CHAR_DESC_TAB);
  const values = sh.getDataRange().getValues();
  const hdrRow = values.findIndex(r => String(r).indexOf('Characteristic Name*') !== -1);
  const hdr = values[hdrRow];
  const map = headerIndex(hdr, ['Characteristic Name*','Characteristic Description*']);
  const rows = values.slice(hdrRow+6);
  const out = {};
  rows.forEach(r => {
    const nm = String(r[map['Characteristic Name*']]||'').trim();
    const desc = String(r[map['Characteristic Description*']]||'').trim();
    if (!nm) return;
    if (!out[nm]) out[nm] = desc;
  });
  return out;
}

function readCharAttr() {
  const sh = SpreadsheetApp.openById(CHAR_SHEET_ID).getSheetByName(CHAR_ATTR_TAB);
  const values = sh.getDataRange().getValues();
  const hdrRow = values.findIndex(r => String(r).indexOf('Characteristic Name*') !== -1);
  const hdr = values[hdrRow];
  const map = headerIndex(hdr, ['Characteristic Name*','Indicator: Entry Required','Indicator: Additional Values']);
  const rows = values.slice(hdrRow+6);
  const out = {};
  rows.forEach(r => {
    const nm = String(r[map['Characteristic Name*']]||'').trim();
    if (!nm) return;
    const req = String(r[map['Indicator: Entry Required']]||'').trim() === 'X';
    const add = String(r[map['Indicator: Additional Values']]||'').trim() === 'X';
    out[nm] = { entry_required: req, additional_values: add };
  });
  return out;
}

function readCharValues() {
  const sh = SpreadsheetApp.openById(CHAR_SHEET_ID).getSheetByName(CHAR_VAL_TAB);
  const values = sh.getDataRange().getValues();
  const hdrRow = values.findIndex(r => String(r).indexOf('Characteristic Name*') !== -1);
  const hdr = values[hdrRow];
  const map = headerIndex(hdr, ['Characteristic Name*','Characteristic Value (Long)','Indicator: Default Value']);
  const rows = values.slice(hdrRow+5);
  const out = {};
  rows.forEach(r => {
    const nm = String(r[map['Characteristic Name*']]||'').trim();
    const val = String(r[map['Characteristic Value (Long)']]||'').trim();
    const dft = String(r[map['Indicator: Default Value']]||'').trim() === 'X';
    if (!nm || !val) return;
    (out[nm] = out[nm] || []).push({ value: val, default: dft });
  });
  return out;
}

// helper
function headerIndex(hdr, names) {
  const m = {};
  names.forEach(n => {
    m[n] = hdr.findIndex(x => String(x).trim() === n);
  });
  return m;
}
