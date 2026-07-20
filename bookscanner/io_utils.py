"""File and spreadsheet loading helpers."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .ocr import IMAGE_EXTENSIONS


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        raise ValueError(f"Mappen findes ikke: {folder}")
    return sorted(
        p
        for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def load_title_sheet(file) -> pd.DataFrame:
    df = pd.read_excel(file)
    df = df.dropna(how="all")
    return df
