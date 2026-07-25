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


def list_sheet_names(file) -> list[str]:
    return pd.ExcelFile(file).sheet_names


def load_title_sheet(file, sheet_name: str | None = None) -> pd.DataFrame:
    """Load one sheet, or all sheets combined (with a 'Ark' column) if sheet_name is None."""
    if sheet_name is not None:
        df = pd.read_excel(file, sheet_name=sheet_name)
        return df.dropna(how="all")

    sheets = pd.read_excel(file, sheet_name=None)
    frames = []
    for name, sheet_df in sheets.items():
        sheet_df = sheet_df.dropna(how="all")
        sheet_df.insert(0, "Ark", name)
        frames.append(sheet_df)
    return pd.concat(frames, ignore_index=True)
