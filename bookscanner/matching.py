"""Fuzzy matching of OCR'ed title-page text against a structured title list."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from rapidfuzz import fuzz


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


@dataclass
class MatchResult:
    row_index: int
    title: str
    score: float


def _specificity_factor(choice: str, floor_tokens: int = 3) -> float:
    """Down-weight catalog entries that are only 1-2 words long.

    token_set_ratio alone gives a near-perfect score to any short catalog
    title whose words are simply a subset of a longer, noisy OCR blob - e.g.
    a generic stub entry like "Eventyr" or "Andersen" inside a catalog of
    H.C. Andersen books would score 100 against almost every photo in that
    collection. Real, specific titles are essentially never just 1-2 words,
    so this only discounts those trivial stubs; it is independent of the
    query length, so it never penalises a genuinely correct short title (e.g.
    "Om Sindets Lidenskaber", 3 words) just because the photo also captured
    some ordinary surrounding publisher/edition text.
    """
    choice_len = len(choice.split())
    return min(1.0, choice_len / floor_tokens)


def find_best_matches(
    ocr_text: str, titles: list[str], limit: int = 3
) -> list[MatchResult]:
    """Match noisy OCR text against a list of catalog titles.

    Uses token_set_ratio so that a short catalog title matching a subset of
    words within a longer, noisy OCR blob still scores highly - this is what
    makes the matching tolerant of imperfect OCR and extra text on the page
    (publisher, edition, subtitle, etc). The raw score is then scaled by a
    specificity factor (see `_specificity_factor`) so that trivially short,
    generic catalog entries don't outrank the actual best-matching title.
    """
    query = normalize_text(ocr_text)
    if not query:
        return []

    choices = {i: normalize_text(t) for i, t in enumerate(titles)}
    choices = {i: t for i, t in choices.items() if t}
    if not choices:
        return []

    scored = []
    for idx, choice in choices.items():
        raw_score = fuzz.token_set_ratio(query, choice)
        score = raw_score * _specificity_factor(choice)
        scored.append((score, idx))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [
        MatchResult(row_index=idx, title=titles[idx], score=score)
        for score, idx in scored[:limit]
    ]


def classify(score: float, high: float, low: float) -> str:
    if score >= high:
        return "Sandsynlig dublet"
    if score >= low:
        return "Muligvis dublet – tjek manuelt"
    return "Ingen match"
