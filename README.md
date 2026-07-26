# bookscanner

Enkel app til at finde **sandsynlige dubletter** blandt fotograferede
titelblade. Appen OCR-scanner et foto af hvert eksemplars titelblad og
fuzzy-matcher teksten mod en eksisterende, struktureret titelliste (Excel).
Da matchingen er fuzzy, behøver OCR'en ikke være perfekt – det er typisk
tilstrækkeligt for antikva-skrifttyper.

Tænkt til lejlighedsvis brug (batch-kørsler), ikke som en løbende driftsapp.

## Sådan virker det

1. Du peger på en lokal mappe med ét foto per eksemplar (titelbladet).
2. Du uploader en Excel-fil med den strukturerede titelliste og vælger,
   hvilken kolonne der indeholder titlen.
3. Appen kører OCR på alle fotos i mappen og fuzzy-matcher hver OCR-tekst
   mod alle titler i listen (`rapidfuzz`, `token_set_ratio`), så ekstra tekst
   på titelbladet (forlag, år, udgave osv.) og OCR-støj ikke ødelægger
   matchet.
4. Resultatet vises som en tabel med status **Sandsynlig dublet**, **Muligvis
   dublet – tjek manuelt** eller **Ingen match**, og kan downloades som CSV.

Matchning sker udelukkende på titel (ikke forfatter/år/forlag), for at være
så robust som muligt over for ufuldstændig OCR.

## Fotos fra Google Drive eller OneDrive

Appen læser fotos fra en almindelig lokal mappe. Nemmeste løsning:

- Synkroniser den relevante Drive- eller OneDrive-mappe til din computer med
  deres almindelige desktop-app (Google Drev / OneDrive).
- Peg appen på den lokale sti til den synkroniserede mappe.

Der er ingen direkte API-integration – det er bevidst fravalgt, da det ville
kræve OAuth-opsætning og vedligehold for noget, der kun bruges få gange.

## Installation

Appen er skrevet i Python og kører OS-agnostisk (Windows, macOS, Linux).
Den eneste ikke-Python-afhængighed er selve Tesseract OCR-programmet, som
skal installeres separat.

### 1. Installer Tesseract OCR

- **Windows**: Download og installer fra
  [UB-Mannheim Tesseract-builds](https://github.com/UB-Mannheim/tesseract/wiki).
  Husk at tilføje installationsmappen til PATH, eller sæt
  `pytesseract.pytesseract.tesseract_cmd` i koden hvis nødvendigt.
- **macOS**: `brew install tesseract tesseract-lang`
- **Linux (Debian/Ubuntu)**: `sudo apt install tesseract-ocr tesseract-ocr-dan`

Tilføj evt. flere sprogpakker (`tesseract-ocr-deu`, `tesseract-ocr-fra`,
`tesseract-ocr-lat` osv.), hvis titelbladene kan være på andre sprog end
dansk/engelsk.

### 2. Installer Python-afhængigheder

```bash
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Kør appen

```bash
streamlit run app.py
```

Appen åbner i din browser (typisk `http://localhost:8501`).

## Brug

1. **Fotos**: Indsæt stien til den lokale (synkroniserede) fotomappe.
   Understøtter JPG, PNG, TIFF, BMP og HEIC (iPhone-fotos).
2. **Titelliste**: Upload en `.xlsx`-fil og vælg titel-kolonnen. Du kan
   valgfrit også vælge en ID/signatur-kolonne, så resultatet viser, hvilket
   eksemplar i listen et foto matcher.
3. **Indstillinger** (i sidepanelet):
   - OCR-sprog (default dansk + engelsk)
   - Sidelayout – prøv "Spredt tekst" hvis titel/forfatter/forlag er spredt
     ud over siden i stedet for samlet i en blok
   - Tærskler for "sandsynlig dublet" og "mulig dublet"
   - Hvor mange alternative matches der vises per foto
4. Klik **Kør matching** og gennemgå resultattabellen. Download som CSV til
   videre brug, fx til krydstjek eller kassation af dubletter.

## Tips til bedre OCR-resultater

- God, jævn belysning uden skygger eller reflekser.
- Fotografér så retvinklet på siden som muligt.
- Brug en rimelig opløsning (appen skalerer selv billeder op/ned til en
  fornuftig størrelse).
- Ved dårlige resultater: prøv en anden sidelayout-indstilling, eller tjek
  "OCR-tekst (uddrag)" i resultattabellen for at se, hvad OCR'en faktisk
  læste.

## Begrænsninger

- Værktøjet **udpeger sandsynlige dubletter** – det er beregnet til manuel
  gennemgang, ikke automatisk kassation.
- Matcher kun på titeltekst, ikke forfatter, år eller forlag.
- Kvaliteten afhænger af foto- og OCR-kvalitet; meget dårlige fotos giver
  dårligere matches.
