# Third-party notices

The `docs/vendor/` folder bundles the following open-source libraries so the
GitHub Pages app has no runtime dependency on an external CDN for its core
functionality. Both are permissively licensed (Apache-2.0), redistribution
with attribution is fine.

- **tesseract.js** v5.1.1 (`tesseract.min.js`, `worker.min.js`) — Apache-2.0.
  https://github.com/naptha/tesseract.js
- **tesseract.js-core** v5 (`tesseract-core*-lstm.wasm.js`) — Apache-2.0.
  https://github.com/naptha/tesseract.js-core
- **@tesseract.js-data/dan**, **@tesseract.js-data/eng** (`lang/*.traineddata.gz`)
  — trained OCR models from the Tesseract project, redistributed via the
  tesseract.js project. Apache-2.0.
- **SheetJS (xlsx)** v0.18.5 (`xlsx.full.min.js`) — Apache-2.0.
  https://github.com/SheetJS/sheetjs

Bundled sub-dependency licenses (MIT/BSD-3-Clause) are listed in
`tesseract.min.js.LICENSE.txt` and `worker.min.js.LICENSE.txt`.

## Known issue: xlsx package version

The npm-published `xlsx@0.18.5` package has two known, unpatched advisories
(prototype pollution, ReDoS - see `npm audit` in this repo). SheetJS stopped
publishing patched releases to the npm registry; fixed versions are only
distributed from `https://cdn.sheetjs.com`. That domain wasn't reachable from
the sandbox this app was built in, so 0.18.5 is what's vendored here.

Practical risk is low - this app only ever parses a title-list spreadsheet
the user themselves selects, not untrusted third-party input - but before a
production deployment, consider replacing `docs/vendor/xlsx.full.min.js`
with a current build from cdn.sheetjs.com.
