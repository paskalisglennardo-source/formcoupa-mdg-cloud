/**
 * Google Apps Script to expose classification data as JSON.
 *
 * This script reads the "Class - Material" and "Characteristic - Material"
 * spreadsheets and returns a single JSON object with the same structure
 * expected by the front‑end.  Each time you call the web app it will
 * re‑read the latest data from the sheets, so updates to the
 * spreadsheets will be reflected immediately on page load.  To use:
 *
 *  1. Create a new Apps Script project attached to a spreadsheet or
 *     standalone.
 *  2. Copy this file's contents into the editor.  Replace the
 *     CLASS_SHEET_ID and CHAR_SHEET_ID constants with the IDs of your
 *     two Google Sheets.  If you have multiple tabs within a single
 *     spreadsheet you can instead use a single ID and different sheet
 *     names.
 *  3. Modify the sheet names (e.g. CLASS_DEF_SHEET) to match the tab
 *     names in your workbooks.  The parsing code below is just a
 *     starting point; you may need to adjust the indices/column
 *     positions to match your exact layout.
 *  4. Deploy the script as a Web App (Deploy → New deployment) and
 *     choose “Anyone” for access.  Copy the deployment URL and paste
 *     it into the DATA_URL constant in index_google.html.
 */

const CLASS_SHEET_ID = 'REPLACE_WITH_CLASS_SHEET_ID';
const CHAR_SHEET_ID = 'REPLACE_WITH_CHAR_SHEET_ID';

// Tab names within the spreadsheets.  Adjust these to match your
// workbook structure.
const CLASS_DEF_SHEET = 'Class Def. - Characteristics';
const CLASS_KEYWORDS_SHEET = 'Class Def. - Desc and Keywords';
const CHAR_DESC_SHEET = 'Char Def. - Descriptions';
const CHAR_ATTR_SHEET = 'Char Def. - Attributes';
const CHAR_VALUES_SHEET = 'Char Def. - CHAR Values';

function doGet() {
  // Load raw tables
  const classRows = getSheetData(CLASS_SHEET_ID, CLASS_DEF_SHEET);
  const keywordRows = getSheetData(CLASS_SHEET_ID, CLASS_KEYWORDS_SHEET);
  const descRows = getSheetData(CHAR_SHEET_ID, CHAR_DESC_SHEET);
  const attrRows = getSheetData(CHAR_SHEET_ID, CHAR_ATTR_SHEET);
  const valuesRows = getSheetData(CHAR_SHEET_ID, CHAR_VALUES_SHEET);

  // Build lookup maps
  const descriptions = {};
  descRows.forEach((row) => {
    const name = row[0];
    const desc = row[3];
    if (name) descriptions[name] = desc;
  });
  const attributes = {};
  attrRows.forEach((row) => {
    const name = row[0];
    const required = row[3] === 'X';
    const additional = row[5] === 'X';
    attributes[name] = { required, additional };
  });
  const valuesMap = {};
  valuesRows.forEach((row) => {
    const name = row[0];
    const item = row[1];
    const isDefault = row[2] === 'X';
    const longValue = row[3];
    if (!valuesMap[name]) valuesMap[name] = [];
    valuesMap[name].push({ value: longValue, default: isDefault });
  });
  // Build classes with characteristic definitions
  const classes = [];
  classRows.forEach((row) => {
    const className = row[0];
    const itemNum = row[2];
    const charName = row[3];
    if (!className || !charName) return;
    let cls = classes.find((c) => c.name === className);
    if (!cls) {
      cls = { name: className, keywords: [], characteristics: [] };
      classes.push(cls);
    }
    cls.characteristics.push({
      char_name: charName,
      sequence: parseInt(itemNum, 10),
      cross_status: row[4] || '*',
      mat_desc: row[5] || 'Y',
      case: row[6] || 'P',
      shorten: row[7],
      prefix: row[8],
      suffix: row[9],
      without_space: row[10],
      old_seq: row[11] || 0,
      old_mat_no: row[12],
      mid_component: row[13],
      qty_component: row[14],
    });
  });
  // Add keywords from keywords sheet
  keywordRows.forEach((row) => {
    const className = row[0];
    const keyword = row[1];
    const cls = classes.find((c) => c.name === className);
    if (cls && keyword) {
      if (!cls.keywords) cls.keywords = [];
      cls.keywords.push(keyword);
    }
  });
  const payload = { classes, descriptions, attributes, values: valuesMap };
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper to read all rows of a given sheet.  Returns an array of arrays.
 * Assumes the first row is a header and starts reading from the
 * second row.  Adjust as necessary to match your files.
 * @param {string} ssId Spreadsheet ID
 * @param {string} sheetName Tab name
 * @returns {Array<Array<string>>}
 */
function getSheetData(ssId, sheetName) {
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(sheetName);
  const range = sheet.getDataRange();
  const values = range.getValues();
  // Skip header row
  values.shift();
  return values;
}