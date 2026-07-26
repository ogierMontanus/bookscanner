# bookscanner
[https://ogiermontanus.github.io/bookscanner/](https://ogiermontanus.github.io/bookscanner/)
Enkel app til at finde **sandsynlige dubletter** blandt fotograferede
titelblade. Appen OCR-scanner et foto af hvert eksemplars titelblad og
fuzzy-matcher teksten mod en eksisterende, struktureret titelliste (Excel).
Da matchingen er fuzzy, behøver OCR'en ikke være perfekt – det er typisk
tilstrækkeligt for antikva-skrifttyper.

Tænkt til lejlighedsvis brug (batch-kørsler), ikke som en løbende driftsapp.

Der findes to udgaver med samme matching-logik:

- **Python/Streamlit** (`app.py`, denne fil) – kør lokalt, læser fotos fra en
  lokal (synkroniseret) mappe.
- **Browser/GitHub Pages** (`docs/`) – ingen installation, kører 100 % i
  browseren. Se [docs/README-browser](#browser-udgave-github-pages) nedenfor.

## Sådan virker det

1. Du peger på en lokal mappe med ét foto per eksemplar (titelbladet).
2. Titellisten indlæses automatisk fra en standard-Excel-fil i `src/holdings/`
   (Python) hhv. `docs/data/` (browser) – du behøver ikke uploade noget selv,
   men kan uploade en anden fil, hvis du vil bruge en anden liste.
3. Appen kører OCR på alle fotos i mappen og fuzzy-matcher hver OCR-tekst
   mod alle titler i listen (`rapidfuzz`, `token_set_ratio`), så ekstra tekst
   på titelbladet (forlag, år, udgave osv.) og OCR-støj ikke ødelægger
   matchet.
4. Resultatet vises som en tabel med status **Sandsynlig dublet**, **Muligvis
   dublet – tjek manuelt** eller **Ingen match**, og kan downloades som CSV.
   De fulde OCR-genkendte tekster (ikke afkortet) gemmes også i
   arbejdshukommelsen og kan downloades separat som CSV.

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
2. **Titelliste**: Ligger der en `.xlsx`-fil i `src/holdings/`, bruges den
   automatisk som standard-titelliste – du behøver ikke uploade noget selv.
   Upload en fil i uploadfeltet, hvis du vil bruge en anden liste. Vælg
   titel-kolonnen (gættes automatisk ud fra kolonnenavnet). Du kan valgfrit
   også vælge en ID/signatur-kolonne, så resultatet viser, hvilket eksemplar
   i listen et foto matcher.
3. **Indstillinger** (i sidepanelet):
   - OCR-sprog (default dansk + engelsk)
   - Sidelayout – prøv "Spredt tekst" hvis titel/forfatter/forlag er spredt
     ud over siden i stedet for samlet i en blok
   - Tærskler for "sandsynlig dublet" og "mulig dublet"
   - Hvor mange alternative matches der vises per foto
4. Klik **Kør matching** og gennemgå resultattabellen. Download som CSV til
   videre brug, fx til krydstjek eller kassation af dubletter. Der er også
   en separat download af **alle OCR-genkendte tekster** (den fulde,
   ikke-afkortede tekst per foto) til manuel gennemgang af OCR-kvaliteten,
   uafhængigt af matchresultatet.

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

## Browser-udgave (GitHub Pages)

`docs/` indeholder en selvstændig, statisk webudgave af appen med samme
matching-logik – ingen installation, ingen server, ingen data forlader
browseren.

### Arkitekturvurdering: er GitHub Pages nok?

GitHub Pages kan kun servere statiske filer – det kan ikke køre Python.
Den oprindelige pipeline (`bookscanner/*.py`) er derfor **ikke** i sig selv
kompatibel med GitHub Pages (den kræver den native Tesseract-binary via
`pytesseract`).

Løsningen her er **Option A: fuldt klient-side**. Genkendelseslogikken er
porteret 1:1 til JavaScript og kører i browseren via:

- **[tesseract.js](https://github.com/naptha/tesseract.js)** – WebAssembly-port
  af Tesseract OCR (samme motor som `pytesseract` bruger, bare i browseren).
- Håndskrevet JS-port af fuzzy-matchingen (`docs/js/matching.js`), verificeret
  til at give identiske scores som `bookscanner/matching.py` på de samme
  testcases.
- **[SheetJS](https://sheetjs.com)** til at parse `.xlsx`-filer i browseren.

Konsekvensen af det valg: der er **ingen backend at deploye eller drifte**
(Option B, en hostet REST-API, var alternativet – fravalgt for at undgå
løbende cloud-drift for noget der bruges få gange), men til gengæld skal
matching-logikken vedligeholdes to steder (Python og JS) hvis den ændres.
Hold `bookscanner/matching.py` og `docs/js/matching.js` i sync.

### Deployment

1. Gå til repoets **Settings → Pages**.
2. Under **Build and deployment → Source**, vælg **Deploy from a branch**.
3. Vælg branchen og mappen **`/docs`**.
4. Gem. Siden er herefter tilgængelig på
   `https://<bruger>.github.io/<repo>/` efter et par minutters deploy.

Der kræves ingen secrets, ingen build-step og ingen server-konfiguration.

### Konfiguration

- **Sprog**: Dansk og engelsk OCR-data ligger allerede i `docs/vendor/lang/`,
  så standardvalget "Dansk + engelsk" virker uden netværksadgang efter første
  sideindlæsning. Tysk/fransk/latin hentes on-demand fra tesseract.js'
  standard-CDN (jsdelivr) første gang de vælges, og caches derefter af
  browseren.
- **Tærskler/Top-N/sidelayout**: samme indstillinger som Python-udgaven,
  justeres direkte i UI'et (ingen konfigurationsfil).
- Vil du vendor'e flere sprog lokalt (undgå CDN-afhængighed helt): læg
  `<sprog>.traineddata.gz` i `docs/vendor/lang/` og tilføj sprogkoden til
  `VENDORED_LANGS` i `docs/js/ocr.js`.
- **Standard-titelliste**: `docs/data/Biblioteksliste_sorted.xlsx` indlæses
  automatisk ved sideindlæsning, så brugeren ikke behøver uploade noget selv.
  Upload en fil i UI'et for at bruge en anden liste i stedet. Denne fil er en
  kopi af `src/holdings/Biblioteksliste_sorted.xlsx` – GitHub Pages serverer
  kun `docs/`, så filen skal ligge (og opdateres manuelt) begge steder, hvis
  masterlisten ændres. Vil du bruge en anden standardfil, så erstat filen i
  `docs/data/` og opdatér `DEFAULT_TITLES_URL` i `docs/js/app.js`.

### "API-format"

Der er ingen backend-API – al kommunikation foregår internt i browseren
mellem JS-modulerne. De reelle integrationsgrænser er:

- `bookscannerExcel.loadTitleRows(workbook, sheetName)` → array af
  row-objekter (samme struktur som Excel-arkets kolonner).
- `bookscannerOcr.extractText(file, {lang, psm, onProgress})` → rå OCR-tekst
  (string).
- `bookscannerMatching.findBestMatches(ocrText, titles, limit)` → liste af
  `{ rowIndex, title, score }`, samme kontrakt som den Python-funktion med
  samme navn.

`docs/js/app.js` er det eneste sted, der rører DOM'en – al genkendelses- og
matchinglogik ligger i `matching.js`/`ocr.js`/`excel.js` og er UI-uafhængig
(samme adskillelse som `app.py` vs. `bookscanner/*.py` i Python-udgaven).

### Lokal test

Browseren blokerer `fetch()` af lokale filer via `file://`, så siden skal
serveres, ikke åbnes direkte:

```bash
cd docs
python3 -m http.server 8000
# eller: npx serve .
```

Åbn `http://localhost:8000`.

### Kendte forskelle fra Python-udgaven

- **HEIC-fotos** understøttes ikke i alle browsere (afhænger af OS'ets
  indbyggede afkoder) – konverter til JPEG/PNG hvis dit foto ikke kan
  forhåndsvises.
- OCR-teksten kan afvige lidt tegn-for-tegn fra `pytesseract`-udgaven (anden
  Tesseract-build/sprogdata-version), men det påvirker ikke fuzzy-matchingen
  nævneværdigt.
- Se `docs/THIRD_PARTY_NOTICES.md` for licenser på de bundtede biblioteker,
  inkl. en kendt (lav-risiko) sårbarhed i den vendor'ede xlsx-pakke.
