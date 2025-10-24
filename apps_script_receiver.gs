/**
 * Google Apps Script that receives form submissions via HTTP POST and
 * appends them to a Google Sheet. To use this script you need to:
 *  1. Create a new Google Spreadsheet and note its ID (the long string
 *     between `/d/` and `/edit` in the URL).
 *  2. Paste this code into the Apps Script editor (`Extensions → Apps Script`).
 *  3. Replace the `SPREADSHEET_ID` constant below with your spreadsheet ID.
 *  4. Save, then deploy as a web app (`Deploy → New deployment`). Choose
 *     “Web app”, set “Execute as” to “Me” and “Who has access” to “Anyone”.
 *  5. Copy the deployment URL and paste it into the `SUBMIT_URL` constant
 *     in `index.html`. When users submit the form, data will be written
 *     to your sheet automatically.
 */

const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SPREADSHEET_ID';

/**
 * Accepts POST requests from the form. The payload is expected to be
 * JSON with fields timestamp, className, server, mid, company, matDesc
 * and values (an array of characteristic objects).
 * @param {GoogleAppsScript.Events.DoPost} e The POST event
 */
function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // Use or create a sheet named “Form Data”
  let sheet = ss.getSheetByName('Form Data');
  if (!sheet) {
    sheet = ss.insertSheet('Form Data');
    // Write header row
    sheet.appendRow([
      'Timestamp',
      'Class',
      'Server',
      'MID',
      'Company',
      'Material Description',
      'Characteristics JSON'
    ]);
  }
  try {
    const data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      new Date(),
      data.className,
      data.server,
      data.mid,
      data.company,
      data.matDesc,
      JSON.stringify(data.values)
    ]);
    return ContentService.createTextOutput(JSON.stringify({status: 'OK'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'ERROR', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}