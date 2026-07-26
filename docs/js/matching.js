// Fuzzy matching of OCR'ed title-page text against a structured title list.
// Client-side port of bookscanner/matching.py - keep both in sync if either
// changes. See that file for the rationale behind each step.

(function (global) {
  "use strict";

  function normalizeText(text) {
    if (!text) return "";
    text = text.normalize("NFKC").toLowerCase();
    text = text.replace(/[^\p{L}\p{N}\s]/gu, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function tokensOf(text) {
    return text.length ? text.split(" ") : [];
  }

  // Longest common subsequence length via a space-optimized DP.
  function lcsLength(a, b) {
    if (a.length === 0 || b.length === 0) return 0;
    if (a.length < b.length) {
      const tmp = a;
      a = b;
      b = tmp;
    }
    let prev = new Array(b.length + 1).fill(0);
    let curr = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          curr[j] = prev[j - 1] + 1;
        } else {
          curr[j] = Math.max(prev[j], curr[j - 1]);
        }
      }
      [prev, curr] = [curr, prev];
    }
    return prev[b.length];
  }

  // Indel-distance-based similarity ratio (0-100), equivalent in spirit to
  // rapidfuzz's fuzz.ratio(): 2 * LCS(a, b) / (len(a) + len(b)).
  function ratio(a, b) {
    const totalLen = a.length + b.length;
    if (totalLen === 0) return 100;
    const lcs = lcsLength(a, b);
    return (2 * lcs / totalLen) * 100;
  }

  // token_set_ratio: tolerant of extra/noisy words on either side by
  // comparing the shared vocabulary against each side's leftover words.
  function tokenSetRatio(query, choice) {
    const t1 = new Set(tokensOf(query));
    const t2 = new Set(tokensOf(choice));
    const intersection = [...t1].filter((w) => t2.has(w)).sort();
    const diff1 = [...t1].filter((w) => !t2.has(w)).sort();
    const diff2 = [...t2].filter((w) => !t1.has(w)).sort();

    const sortedSect = intersection.join(" ");
    const sorted1to2 = [sortedSect, diff1.join(" ")].filter(Boolean).join(" ").trim();
    const sorted2to1 = [sortedSect, diff2.join(" ")].filter(Boolean).join(" ").trim();

    return Math.max(
      ratio(sortedSect, sorted1to2),
      ratio(sortedSect, sorted2to1),
      ratio(sorted1to2, sorted2to1)
    );
  }

  // Down-weight catalog entries that are only 1-2 words long so a generic
  // stub entry (e.g. "Eventyr" or "Andersen" in an Andersen-only catalog)
  // can't outscore the actual full title just because its few words happen
  // to appear in the noisy OCR text. Independent of query length, so a
  // genuinely short but correct title (>=3 words) is never penalised just
  // because the photo also captured ordinary publisher/edition text.
  function specificityFactor(choice, floorTokens) {
    floorTokens = floorTokens || 3;
    const choiceLen = tokensOf(choice).length;
    return Math.min(1, choiceLen / floorTokens);
  }

  function findBestMatches(ocrText, titles, limit) {
    limit = limit || 3;
    const query = normalizeText(ocrText);
    if (!query) return [];

    const scored = [];
    for (let i = 0; i < titles.length; i++) {
      const choice = normalizeText(String(titles[i]));
      if (!choice) continue;
      const rawScore = tokenSetRatio(query, choice);
      const score = rawScore * specificityFactor(choice);
      scored.push({ rowIndex: i, title: titles[i], score: score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  function classify(score, high, low) {
    if (score >= high) return "Sandsynlig dublet";
    if (score >= low) return "Muligvis dublet – tjek manuelt";
    return "Ingen match";
  }

  global.bookscannerMatching = {
    normalizeText,
    tokenSetRatio,
    specificityFactor,
    findBestMatches,
    classify,
  };
})(typeof window !== "undefined" ? window : globalThis);
