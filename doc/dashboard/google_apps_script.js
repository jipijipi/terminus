// Deploy as Web App: Execute as Me, Anyone can access.
// Returns sheet data as JSON: { rows: [{ "Head 1": ..., "Head 2": ... }, ...] }
// Note: HtmlService is used instead of ContentService to avoid Google's double redirect.
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
  return HtmlService
    .createHtmlOutput(JSON.stringify({ rows }))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
