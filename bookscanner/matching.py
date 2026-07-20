"""Fuzzy matching of OCR'ed title-page text against a structured title list."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from rapidfuzz import fuzz, process


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


def find_best_matches(
    ocr_text: str, titles: list[str], limit: int = 3
) -> list[MatchResult]:
    """Match noisy OCR text against a list of catalog titles.

    Uses token_set_ratio so that a short catalog title matching a subset of
    words within a longer, noisy OCR blob still scores highly - this is what
    makes the matching tolerant of imperfect OCR and extra text on the page
    (publisher, edition, subtitle, etc).
    """
    query = normalize_text(ocr_text)
    if not query:
        return []

    choices = {i: normalize_text(t) for i, t in enumerate(titles)}
    choices = {i: t for i, t in choices.items() if t}
    if not choices:
        return []

    matches = process.extract(
        query, choices, scorer=fuzz.token_set_ratio, limit=limit
    )
    return [
        MatchResult(row_index=idx, title=titles[idx], score=score)
        for _, score, idx in matches
    ]


def classify(score: float, high: float, low: float) -> str:
    if score >= high:
        return "Sandsynlig dublet"
    if score >= low:
        return "Muligvis dublet – tjek manuelt"
    return "Ingen match"
