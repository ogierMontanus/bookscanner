// UI wiring only - all recognition/matching logic lives in matching.js,
// ocr.js and excel.js. This file just connects the DOM to those modules.

(function () {
  "use strict";

  const { findBestMatches, classify } = window.bookscannerMatching;
  const { extractText } = window.bookscannerOcr;
  const excel = window.bookscannerExcel;

  const el = (id) => document.getElementById(id);

  const DEFAULT_TITLES_URL = "data/Biblioteksliste_sorted.xlsx";

  const state = {
    workbook: null,
    rows: [],
    columns: [],
    photos: [], // { file, url }
    results: [], // for CSV export
    ocrTexts: [], // { foto, ocrText } - full, untruncated OCR text per photo
  };

  function updateRunButton() {
    const hasTitles = state.rows.length > 0 && el("title-col-select").value;
    const hasPhotos = state.photos.length > 0;
    el("run-button").disabled = !(hasTitles && hasPhotos);
  }

  // --- Excel handling -------------------------------------------------

  function populateSelect(select, options, selected) {
    select.innerHTML = "";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === selected) o.selected = true;
      select.appendChild(o);
    }
  }

  let currentSourceLabel = "";

  function loadRowsForSelection(sourceLabel) {
    if (sourceLabel !== undefined) currentSourceLabel = sourceLabel;

    const sheetSelect = el("sheet-select");
    const sheetChoice =
      sheetSelect.options.length && !el("sheet-picker-wrap").classList.contains("hidden")
        ? sheetSelect.value
        : null;
    const sheetName = sheetChoice && sheetChoice !== "(alle ark kombineret)" ? sheetChoice : null;

    state.rows = excel.loadTitleRows(state.workbook, sheetName);
    state.columns = state.rows.length ? Object.keys(state.rows[0]) : [];

    const titleCol = excel.detectColumn(state.columns, ["titel", "title"]) || state.columns[0];
    const idCol = excel.detectColumn(state.columns, ["opstilling", "signatur", "id"]);

    populateSelect(el("title-col-select"), state.columns, titleCol);
    populateSelect(el("id-col-select"), ["(ingen)"].concat(state.columns), idCol || "(ingen)");

    el("column-picker-wrap").classList.remove("hidden");
    el("titles-status").textContent = `${state.rows.length} titler indlæst. ${currentSourceLabel}`;
    updateRunButton();
  }

  function applyWorkbook(workbook, sourceLabel) {
    state.workbook = workbook;
    const sheetNames = excel.listSheetNames(state.workbook);

    if (sheetNames.length > 1) {
      populateSelect(el("sheet-select"), ["(alle ark kombineret)"].concat(sheetNames), "(alle ark kombineret)");
      el("sheet-picker-wrap").classList.remove("hidden");
    } else {
      el("sheet-picker-wrap").classList.add("hidden");
    }
    loadRowsForSelection(sourceLabel);
  }

  el("excel-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    el("titles-status").textContent = "Indlæser Excel-fil...";
    try {
      const workbook = await excel.readWorkbook(file);
      applyWorkbook(workbook, `Bruger-uploadet fil: ${file.name}`);
    } catch (err) {
      el("titles-status").textContent = `Kunne ikke læse Excel-filen: ${err.message}`;
    }
  });

  el("sheet-select").addEventListener("change", () => loadRowsForSelection());
  el("title-col-select").addEventListener("change", updateRunButton);

  async function loadDefaultTitlesFile() {
    el("titles-status").textContent = "Indlæser standard-titelliste...";
    try {
      const workbook = await excel.readWorkbookFromUrl(DEFAULT_TITLES_URL);
      applyWorkbook(workbook, `Standard-titelliste (${DEFAULT_TITLES_URL})`);
    } catch (err) {
      el("titles-status").textContent =
        "Ingen standard-titelliste fundet - upload en Excel-fil for at komme i gang.";
    }
  }

  // --- Photo handling ---------------------------------------------------

  function renderPhotoPreview() {
    const wrap = el("photo-preview");
    wrap.innerHTML = "";
    for (const photo of state.photos) {
      const div = document.createElement("div");
      div.className = "photo-thumb";
      const img = document.createElement("img");
      img.src = photo.url;
      const label = document.createElement("div");
      label.textContent = photo.file.name;
      div.appendChild(img);
      div.appendChild(label);
      wrap.appendChild(div);
    }
  }

  function addPhotos(fileList) {
    for (const file of fileList) {
      if (!file.type.startsWith("image/")) continue;
      state.photos.push({ file, url: URL.createObjectURL(file) });
    }
    renderPhotoPreview();
    updateRunButton();
  }

  el("photo-input").addEventListener("change", (e) => {
    addPhotos(e.target.files);
    e.target.value = "";
  });

  const dropzone = el("dropzone");
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    addPhotos(e.dataTransfer.files);
  });

  // --- Matching run -------------------------------------------------------

  function badgeFor(status) {
    if (status === "Sandsynlig dublet") return "badge-match";
    if (status.startsWith("Muligvis")) return "badge-maybe";
    return "badge-miss";
  }

  function appendResultRow(row) {
    const tbody = el("results-body");
    const tr = document.createElement("tr");

    const cells = [
      row.foto,
      null, // status badge, built separately
      row.bedsteMatch,
      row.score.toFixed(1),
      row.id,
      row.ocrExcerpt,
      row.alleMatches,
    ];

    cells.forEach((value, i) => {
      const td = document.createElement("td");
      if (i === 1) {
        const span = document.createElement("span");
        span.className = "badge " + badgeFor(row.status);
        span.textContent = row.status;
        td.appendChild(span);
      } else {
        td.textContent = value;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  function updateSummary() {
    const matchCount = state.results.filter((r) => r.status === "Sandsynlig dublet").length;
    const maybeCount = state.results.filter((r) => r.status.startsWith("Muligvis")).length;
    el("stat-match").textContent = matchCount;
    el("stat-maybe").textContent = maybeCount;
    el("stat-total").textContent = state.results.length;
    el("summary").classList.remove("hidden");
  }

  function setProgress(text, pct) {
    el("progress-wrap").classList.remove("hidden");
    el("progress-text").textContent = text;
    if (pct != null) el("progress-bar").value = pct;
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadCsv() {
    const headers = ["Foto", "Status", "Bedste match", "Score", "ID/signatur", "OCR-tekst (uddrag)", "Alle top-matches"];
    const lines = [headers.join(",")];
    for (const r of state.results) {
      lines.push(
        [r.foto, r.status, r.bedsteMatch, r.score.toFixed(1), r.id, r.ocrExcerpt, r.alleMatches]
          .map(csvEscape)
          .join(",")
      );
    }
    const csv = "﻿" + lines.join("\n"); // BOM for Excel/Danish chars
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dubletcheck_resultat.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  el("download-csv").addEventListener("click", downloadCsv);

  function downloadOcrCsv() {
    const headers = ["Foto", "OCR-tekst"];
    const lines = [headers.join(",")];
    for (const r of state.ocrTexts) {
      lines.push([r.foto, r.ocrText].map(csvEscape).join(","));
    }
    const csv = "﻿" + lines.join("\n"); // BOM for Excel/Danish chars
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr_tekster.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  el("download-ocr-csv").addEventListener("click", downloadOcrCsv);

  async function runMatching() {
    const runButton = el("run-button");
    runButton.disabled = true;
    el("results-body").innerHTML = "";
    state.results = [];
    state.ocrTexts = [];
    el("download-csv").classList.add("hidden");
    el("download-ocr-csv").classList.add("hidden");
    el("summary").classList.add("hidden");

    const lang = el("lang-select").value;
    const psm = el("psm-select").value;
    const high = Number(el("high-threshold").value);
    const low = Number(el("low-threshold").value);
    const topN = Number(el("top-n").value);

    const titleCol = el("title-col-select").value;
    const idColValue = el("id-col-select").value;
    const idCol = idColValue === "(ingen)" ? null : idColValue;
    const titles = state.rows.map((r) => String(r[titleCol] ?? ""));

    const total = state.photos.length;
    for (let i = 0; i < total; i++) {
      const photo = state.photos[i];
      setProgress(`OCR: ${photo.file.name} (${i + 1}/${total})`, (i / total) * 100);

      let ocrText;
      try {
        ocrText = await extractText(photo.file, {
          lang,
          psm,
          onProgress: (msg) => {
            if (msg.status === "recognizing text") {
              const pct = ((i + msg.progress) / total) * 100;
              setProgress(`OCR: ${photo.file.name} (${i + 1}/${total}) – ${Math.round(msg.progress * 100)}%`, pct);
            }
          },
        });
      } catch (err) {
        const errorText = `[OCR-fejl: ${err.message}]`;
        state.ocrTexts.push({ foto: photo.file.name, ocrText: errorText });
        appendResultRow({
          foto: photo.file.name,
          status: "Ingen match",
          bedsteMatch: "",
          score: 0,
          id: "",
          ocrExcerpt: errorText,
          alleMatches: "",
        });
        continue;
      }

      state.ocrTexts.push({ foto: photo.file.name, ocrText });

      const matches = findBestMatches(ocrText, titles, topN);
      let row;
      if (!matches.length) {
        row = {
          foto: photo.file.name,
          status: "Ingen match",
          bedsteMatch: "",
          score: 0,
          id: "",
          ocrExcerpt: ocrText.slice(0, 200),
          alleMatches: "",
        };
      } else {
        const best = matches[0];
        const status = classify(best.score, high, low);
        const idValue = idCol ? String(state.rows[best.rowIndex][idCol] ?? "") : "";
        const alleMatches = matches
          .slice(1)
          .map((m) => `${m.title} (${m.score.toFixed(0)})`)
          .join("; ");
        row = {
          foto: photo.file.name,
          status,
          bedsteMatch: best.title,
          score: best.score,
          id: idValue,
          ocrExcerpt: ocrText.slice(0, 200),
          alleMatches,
        };
      }
      state.results.push(row);
      appendResultRow(row);
      updateSummary();
    }

    el("progress-wrap").classList.add("hidden");
    if (state.results.length) el("download-csv").classList.remove("hidden");
    if (state.ocrTexts.length) el("download-ocr-csv").classList.remove("hidden");
    runButton.disabled = false;
  }

  el("run-button").addEventListener("click", () => {
    runMatching().catch((err) => {
      console.error(err);
      alert("Der opstod en fejl under matching: " + err.message);
      el("run-button").disabled = false;
      el("progress-wrap").classList.add("hidden");
    });
  });

  loadDefaultTitlesFile();
})();
