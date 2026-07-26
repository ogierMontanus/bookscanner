"""OCR extraction for photographed title pages."""
from __future__ import annotations

from pathlib import Path

import pytesseract
from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".heic", ".heif"}

# Uniform block of text works well for a single title page; sparse text
# suits pages where title/author/publisher are scattered across the page.
PSM_OPTIONS = {
    "Auto": "3",
    "Samlet tekstblok (anbefalet)": "6",
    "Spredt tekst": "11",
}


class TesseractNotFoundError(RuntimeError):
    pass


def preprocess(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image) or image
    image = image.convert("L")
    image = ImageOps.autocontrast(image)

    longest_side = max(image.size)
    if longest_side < 1500:
        scale = 1500 / longest_side
        image = image.resize(
            (int(image.width * scale), int(image.height * scale)), Image.LANCZOS
        )
    elif longest_side > 3500:
        scale = 3500 / longest_side
        image = image.resize(
            (int(image.width * scale), int(image.height * scale)), Image.LANCZOS
        )
    return image


def extract_text(image_path: Path, lang: str = "dan+eng", psm: str = "3") -> str:
    try:
        image = Image.open(image_path)
    except Exception as exc:  # noqa: BLE001 - surfaced to the user as-is
        raise ValueError(f"Kunne ikke åbne billedet: {exc}") from exc

    image = preprocess(image)
    config = f"--psm {psm}"
    try:
        text = pytesseract.image_to_string(image, lang=lang, config=config)
    except pytesseract.TesseractNotFoundError as exc:
        raise TesseractNotFoundError(
            "Tesseract OCR-programmet blev ikke fundet. Det skal installeres "
            "separat fra Python-pakkerne - se README.md for instruktioner."
        ) from exc
    return text.strip()
