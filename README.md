# AlephEfes - reproducible code and data for numeric–semantic analysis of the Hebrew Bible

This repository contains a React-based calculator and research notes around the **א=0**  hypothesis.
The project treats the biblical consonantal text as a deliberately engineered system where Hebrew letters are mapped to values **0–21** and processed through a **three-layer valuation** (Units, Tens with Δ9 adjustment, Hundreds).
The aim is to provide an **open playground** for testing the model, exploring its linguistic consequences, and reproducing all calculations.
> **Note**: The calculator interface is in **Hebrew**. Enter Hebrew consonantal text directly into the input field.
> 
> Each word is analysed separately, and line totals are also reported separately.
> 
---

![App screenshot](docs/demo.png)

---

## Features
The calculator includes the following capabilities:
- **Dual Calculation Modes**
  Switch between Aleph-Zero (א:0) and Aleph-One (א:1) mappings. Both modes apply the same 3-layer valuation but with different base indexing.

- **Digital Root Clusters (ש״ד)**
  Words are grouped by digital root (1–9), with interactive drill-down, search, and re-ordering of clusters.

- **Prime Highlights**
  Prime totals are detected per word and per line. You can customize the highlight color in the legend.

- **Multiple Views**
  - *Lines*: see full breakdown with per-letter calculations, line totals, and prime markers.
  - *Clusters*: explore semantic networks grouped by digital root.
  - *Hot Words*: analyze frequency of values or words, with drill-down into specific value clusters.

- **Data Export**
  One-click copy for:
  - Full analysis (line by line)
  - Summary of clusters or pinned words
  - Unique word calculations
  - Frequency tables

- **Dark Mode**  
  Auto-detects system preference, toggleable at runtime.

- **Performance**
  Uses memoization and a virtualized list for handling large texts efficiently.

---

## Research backdrop

The current working model rests on three intertwined pillars:

1. **Zero-Indexed Valuation**
   Hebrew letters are assigned values from א=0 through ת=21. Final forms share their base letter’s value.
   From this assignment arise three additive homomorphisms:
   - **U** (Units): the raw index sum.
   - **T** (Tens): U plus a Δ9 shift for letters from כ onward.
   - **H** (Hundreds): T plus fixed increments for ש and ת.
   All three collapse to the same **digital root mod-9**, creating a stable invariant.

2. **Semantic alignment with calendrical constants**
   Key word consistently resolve to values with strong cultural salience:
   - יהוה → 22 
   - שמש → 52 
   - לבנה → 29 
    - ירח → 116 (29*4)
   - חדש → 30 
   - ישרון / זיתים → 354 
   - ירושלם → 364 
   - מלכות / סכות / תשמרו / שבתותי → 365 

   These are not isolated coincidences but clusters tied to lunar, solar, and ritual values. The name "יהוה" points to the number of letters in the Hebrew alphabet. "שמש" points towards the number of weeks in a tropical year. "חדש" and "לבנה" point towards the number of days in a lunar month. "ירושלם" points towards the Enoch calendar.

3. **Cross-layer coherence**
   Because U, T, and H are locked together by construction, alignments repeat across layers and create **semantic “nodes”** where related words converge (e.g. the “59-cluster” including ישראל, מלכות, עושר).
   The result is a **self-referential network** that behaves less like numerology and more like a designed cryptographic system.

Taken together, the evidence supports the view that the **alphabet itself was used as a carrier of theological and cosmological design**.
The goal of this repository is not dogma but documentation: to provide transparent tools, reproducible data, and a basis for scholarly replication or refutation.

---

## Running the calculator
Requires Node.js 18+ and npm.

```bash

git clone https://github.com/EdanDa/AlephEfes.git
cd AlephEfes
npm install
npm run dev

```

The app runs on [http://localhost:5173](http://localhost:5173), styled with TailwindCSS (loaded via CDN).
It stores the last analysed text in `localStorage` for convenience.

---

## Structure

```
├── index.html        – Vite entry point
├── src/
│   ├── App.jsx       – main calculator component
│   └── main.jsx      – React DOM bootstrap
├── package.json      – project metadata and scripts
└── vite.config.js    – Vite + React configuration
```

---

## License

MIT

## Author

Developed by **Edan-David Eyon**  
Independent researcher (Israel)  

I have been pursuing independent study across philosophy, linguistics, history, and mathematics and more since 2011.  
The AlephEfes repository documents and shares a reproducible numeric–semantic framework for the Hebrew Bible, based on zero-indexed valuation.
This repository is intended as an open, transparent resource for testing, replication, and dialogue.

