"""bookscanner: find sandsynlige dubletter blandt fotograferede titelblade.

Kør med:  streamlit run app.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from bookscanner.io_utils import list_images, load_title_sheet
from bookscanner.matching import classify, find_best_matches
from bookscanner.ocr import PSM_OPTIONS, TesseractNotFoundError, extract_text

st.set_page_config(page_title="bookscanner - dubletcheck", layout="wide")

st.title("📚 bookscanner – dubletcheck af titelblade")
st.caption(
    "Fotograferede titelblade OCR-scannes og fuzzy-matches mod en eksisterende "
    "titelliste for at udpege sandsynlige dubletter. Ét foto per eksemplar."
)

with st.sidebar:
    st.header("Indstillinger")

    lang_options = {
        "Dansk + engelsk": "dan+eng",
        "Dansk": "dan",
        "Engelsk": "eng",
        "Tysk": "deu",
        "Fransk": "fra",
        "Latin": "lat",
    }
    lang_choice = st.selectbox(
        "OCR-sprog", list(lang_options.keys()), index=0,
        help="Sprogpakker skal være installeret i Tesseract - se README.",
    )
    lang = lang_options[lang_choice]

    psm_choice = st.selectbox(
        "Sidelayout", list(PSM_OPTIONS.keys()), index=0,
        help="Prøv 'Spredt tekst' hvis titelbladet har titel/forfatter/forlag spredt ud over siden.",
    )
    psm = PSM_OPTIONS[psm_choice]

    st.divider()
    st.subheader("Match-tærskler")
    high_threshold = st.slider("Sandsynlig dublet ved score ≥", 50, 100, 85)
    low_threshold = st.slider("Mulig dublet ved score ≥", 0, high_threshold, 65)
    top_n = st.number_input("Vis top-N matches per foto", 1, 10, 3)

st.subheader("1. Fotos af titelblade")
st.write(
    "Peg på den lokale mappe, hvor dine Google Drive- eller OneDrive-synkroniserede "
    "fotos ligger (én mappe med ét foto per eksemplar)."
)
folder_input = st.text_input("Sti til fotomappe", placeholder="/sti/til/fotos")

images: list[Path] = []
if folder_input:
    try:
        images = list_images(Path(folder_input).expanduser())
        st.success(f"Fandt {len(images)} billeder i mappen.")
    except ValueError as exc:
        st.error(str(exc))

st.subheader("2. Struktureret titelliste (Excel)")
titles_file = st.file_uploader("Upload titelliste (.xlsx)", type=["xlsx"])

titles_df: pd.DataFrame | None = None
title_col: str | None = None
id_col: str | None = None

if titles_file is not None:
    try:
        titles_df = load_title_sheet(titles_file)
    except Exception as exc:  # noqa: BLE001
        st.error(f"Kunne ikke læse Excel-filen: {exc}")

    if titles_df is not None:
        st.dataframe(titles_df.head(5), use_container_width=True)
        columns = list(titles_df.columns)
        default_title_idx = next(
            (i for i, c in enumerate(columns) if "titel" in str(c).lower() or "title" in str(c).lower()),
            0,
        )
        title_col = st.selectbox("Hvilken kolonne indeholder titlen?", columns, index=default_title_idx)
        id_col = st.selectbox(
            "Valgfri: kolonne med ID/signatur (vises i resultatet)",
            ["(ingen)"] + columns,
            index=0,
        )
        if id_col == "(ingen)":
            id_col = None

st.subheader("3. Kør batch-matching")
run = st.button(
    "Kør matching",
    type="primary",
    disabled=not (images and titles_df is not None and title_col),
)

if run and titles_df is not None and title_col:
    titles = titles_df[title_col].astype(str).tolist()
    results_rows = []
    progress = st.progress(0.0, text="Starter...")
    errors: list[str] = []

    for i, image_path in enumerate(images, start=1):
        progress.progress(i / len(images), text=f"OCR: {image_path.name} ({i}/{len(images)})")
        try:
            ocr_text = extract_text(image_path, lang=lang, psm=psm)
        except TesseractNotFoundError as exc:
            st.error(str(exc))
            st.stop()
        except ValueError as exc:
            errors.append(f"{image_path.name}: {exc}")
            continue

        matches = find_best_matches(ocr_text, titles, limit=int(top_n))
        if not matches:
            results_rows.append(
                {
                    "Foto": image_path.name,
                    "Status": "Ingen match",
                    "Bedste match": "",
                    "Score": 0.0,
                    "ID/signatur": "",
                    "OCR-tekst (uddrag)": ocr_text[:200],
                    "Alle top-matches": "",
                }
            )
            continue

        best = matches[0]
        status = classify(best.score, high=high_threshold, low=low_threshold)
        id_value = ""
        if id_col:
            id_value = str(titles_df.iloc[best.row_index][id_col])
        alt_matches = "; ".join(f"{m.title} ({m.score:.0f})" for m in matches[1:])

        results_rows.append(
            {
                "Foto": image_path.name,
                "Status": status,
                "Bedste match": best.title,
                "Score": round(best.score, 1),
                "ID/signatur": id_value,
                "OCR-tekst (uddrag)": ocr_text[:200],
                "Alle top-matches": alt_matches,
            }
        )

    progress.empty()

    if errors:
        with st.expander(f"⚠️ {len(errors)} billede(r) kunne ikke læses"):
            for e in errors:
                st.write(e)

    if results_rows:
        results_df = pd.DataFrame(results_rows)
        status_order = {"Sandsynlig dublet": 0, "Muligvis dublet – tjek manuelt": 1, "Ingen match": 2}
        results_df["_sort"] = results_df["Status"].map(status_order)
        results_df = results_df.sort_values(["_sort", "Score"], ascending=[True, False]).drop(columns="_sort")

        st.subheader("Resultater")
        n_dup = (results_df["Status"] == "Sandsynlig dublet").sum()
        n_maybe = (results_df["Status"] == "Muligvis dublet – tjek manuelt").sum()
        col1, col2, col3 = st.columns(3)
        col1.metric("Sandsynlige dubletter", n_dup)
        col2.metric("Mulige dubletter", n_maybe)
        col3.metric("Fotos i alt", len(results_df))

        st.dataframe(results_df, use_container_width=True, hide_index=True)

        csv = results_df.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            "⬇️ Download resultat som CSV",
            csv,
            file_name="dubletcheck_resultat.csv",
            mime="text/csv",
        )
