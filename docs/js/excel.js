// Title-list loading from an .xlsx file, client-side via SheetJS.
// Mirrors bookscanner/io_utils.py.

(function (global) {
  "use strict";

  async function readWorkbook(file) {
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: "array" });
  }

  async function readWorkbookFromUrl(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    return XLSX.read(buffer, { type: "array" });
  }

  function sheetToRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  function listSheetNames(workbook) {
    return workbook.SheetNames;
  }

  // sheetName === null combines all sheets, tagging each row with "Ark".
  function loadTitleRows(workbook, sheetName) {
    if (sheetName) {
      return sheetToRows(workbook, sheetName);
    }
    const rows = [];
    for (const name of workbook.SheetNames) {
      for (const row of sheetToRows(workbook, name)) {
        rows.push(Object.assign({ Ark: name }, row));
      }
    }
    return rows;
  }

  function detectColumn(columns, keywords) {
    const lower = columns.map((c) => String(c).toLowerCase());
    for (let i = 0; i < lower.length; i++) {
      if (keywords.some((k) => lower[i].includes(k))) return columns[i];
    }
    return null;
  }

  global.bookscannerExcel = {
    readWorkbook,
    readWorkbookFromUrl,
    listSheetNames,
    loadTitleRows,
    detectColumn,
  };
})(typeof window !== "undefined" ? window : globalThis);
