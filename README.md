# AlephEfes

🄰🄰 **Hebrew Isopsephy** – reproducible code and data for numeric–semantic analysis of the Hebrew Bible.

This repository contains a React based calculator and notes around the "Aleph‑Code" (קוד‑אלף) hypothesis.  The project treats the biblical consonantal text as an engineered system where Hebrew letters are mapped to numeric values 0–21 and processed through a three layer algorithm (units, tens with Δ9 adjustment and hundreds).  The goal is to provide an open playground for testing the model, exploring its linguistic consequences and reproducing all calculations.

## Research backdrop

The current working model can be summarised in three intertwined pillars:

### 1. Engineered lexicon – the "atoms"
* Letter mapping א=0 … ת=21 keeps the digital root consistent across layers via Δ9 closure.
* Words with shared digital root form semantic clusters (e.g. DR 4 → יהוה, תורה, נפש, נשמה; DR 6 → אדם, דם, אמת, מת).
* Numeric values encode astronomical knowledge (שמש 52 ↔ weeks, ירח 116 ↔ lunar cycle, מלכות 365 ↔ solar year) and trace mythological transformations (סט→שת, בעל→בל, תחות׳→ירח).

### 2. Architectural layer – the "buildings"
* Passages often display symmetric or planned totals.  Examples include the seven‑root "menorah" of Genesis 1 and the S–T ladder (ש=110, ת=120) marking lifespans of key figures.
* Editing choices in spelling (e.g. בכר/בכור) appear to maintain numeric balance across verses, hinting at deliberate redaction.

### 3. Internal grammar – the ×10 series
* A non‑linear correspondence links simple letters with their ×10 counterparts, producing a foundational word list:
  - ג (2) + ל (20) → **גל**
  - ד (3) + מ (30) → **דם**
  - ה (4) + נ (40) → **הן**
  - …
  - מ (12) + ת (120) → **מת**
* This sequence sketches a miniature creation narrative from *גל* (primordial wave) through life (*דם*) to transformation (*מת*), embedding "grammar" directly in the alphabet.

Taken together the evidence supports a mindset in which the alphabet itself is a carrier of theological and cosmological design.  The aim of this repository is to document the phenomenon, provide transparent tools and invite replication rather than dogmatic acceptance.

## Running the calculator

```bash
npm install   # install dependencies (react, vite)
npm run dev   # start development server
```

The app is served via Vite on <http://localhost:5173>.  It loads TailwindCSS from a CDN and stores the last analysed text in `localStorage` for convenience.

## Structure

```
├── index.html        – Vite entry point
├── src/
│   ├── App.jsx       – main calculator component
│   └── main.jsx      – React DOM bootstrap
├── package.json      – project metadata and scripts
└── vite.config.js    – Vite + React configuration
```

## License

MIT
