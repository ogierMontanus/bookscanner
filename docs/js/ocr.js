// OCR extraction for photographed title pages, running entirely client-side
// via tesseract.js (WebAssembly port of Tesseract). Mirrors the
// preprocessing/PSM choices in bookscanner/ocr.py.

(function (global) {
  "use strict";

  const PSM_OPTIONS = {
    "Auto (standard)": "3",
    "Samlet tekstblok": "6",
    "Spredt tekst": "11",
  };

  // Languages whose traineddata is vendored locally (docs/vendor/lang/) so
  // the default OCR path works with no external network dependency at all.
  // Any other language falls back to tesseract.js's default CDN fetch.
  const VENDORED_LANGS = new Set(["dan", "eng"]);

  let worker = null;
  let workerLang = null;

  async function getWorker(lang, onProgress) {
    if (worker && workerLang === lang) return worker;
    if (worker) {
      await worker.terminate();
      worker = null;
    }
    const allVendored = lang.split("+").every((l) => VENDORED_LANGS.has(l));
    worker = await Tesseract.createWorker(lang, 1, {
      workerPath: "vendor/worker.min.js",
      corePath: "vendor/",
      // Only override langPath when every requested language is vendored
      // locally (dan/eng) - otherwise fall back to tesseract.js's default
      // CDN fetch (jsdelivr), cached by the browser after first use.
      ...(allVendored ? { langPath: "vendor/lang" } : {}),
      logger: (msg) => {
        if (onProgress) onProgress(msg);
      },
    });
    workerLang = lang;
    return worker;
  }

  // Grayscale + simple min/max contrast stretch + resize to a sane
  // resolution range, drawn onto a canvas. Equivalent in spirit to the
  // PIL preprocessing in ocr.py (autocontrast + up/downscale).
  async function preprocessToCanvas(file) {
    const imgBitmap = await createImageBitmap(file);

    let { width, height } = imgBitmap;
    const longestSide = Math.max(width, height);
    if (longestSide < 1500) {
      const scale = 1500 / longestSide;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    } else if (longestSide > 3500) {
      const scale = 3500 / longestSide;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgBitmap, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Grayscale (luminosity) pass, tracking min/max for contrast stretch.
    let min = 255;
    let max = 0;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }

    const range = max - min || 1;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const stretched = ((gray[p] - min) / range) * 255;
      data[i] = data[i + 1] = data[i + 2] = stretched;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  async function extractText(file, options) {
    options = options || {};
    const lang = options.lang || "dan+eng";
    const psm = options.psm || "3";
    const onProgress = options.onProgress;

    const canvas = await preprocessToCanvas(file);
    const w = await getWorker(lang, onProgress);
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await w.recognize(canvas);
    return (data.text || "").trim();
  }

  async function terminate() {
    if (worker) {
      await worker.terminate();
      worker = null;
      workerLang = null;
    }
  }

  global.bookscannerOcr = { PSM_OPTIONS, extractText, terminate };
})(typeof window !== "undefined" ? window : globalThis);
