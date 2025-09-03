# AlephEfes

🄰🄰 **Hebrew Isopsephy** – reproducible code and data for numeric–semantic analysis of the Hebrew Bible.

This repository contains a React-based calculator and research notes around the **Aleph-Code** (קוד-אלף) hypothesis.  
The project treats the biblical consonantal text as a deliberately engineered system where Hebrew letters are mapped to values **0–21** and processed through a **three-layer valuation** (Units, Tens with Δ9 adjustment, Hundreds).  
The aim is to provide an **open playground** for testing the model, exploring its linguistic consequences, and reproducing all calculations.

---

## Research backdrop

The current working model rests on three intertwined pillars:

1. **Zero-Indexed Valuation (ZIV)**  
   Hebrew letters are assigned values from א=0 through ת=21. Final forms share their base letter’s value.  
   From this assignment arise three additive homomorphisms:  
   - **U** (Units): the raw index sum.  
   - **T** (Tens): U plus a Δ9 shift for letters from כ onward.  
   - **H** (Hundreds): T plus fixed increments for ש and ת.  
   All three collapse to the same **digital root mod-9**, creating a stable invariant.

2. **Semantic alignment with calendrical constants**  
   Key words and names consistently resolve to values with strong cultural salience:  
   - יהוה → 22  
   - שמש → 52  
   - לבנה → 29  
   - ירח → 116 (=4×29)  
   - ישרון → 354  
   - ירושלם → 364 (=52×7)  
   - מלכות / שבתותי / תשמרו → 365 

   These are not isolated coincidences but clusters tied to lunar, solar, and ritual cycles.

3. **Cross-layer coherence**  
   Because U, T, and H are locked together by construction, alignments repeat across layers and create **semantic “nodes”** where related words converge (e.g. the “59-cluster” including ישראל, מלכות, עושר).  
   The result is a **self-referential network** that behaves less like numerology and more like a designed cryptographic system.

Taken together, the evidence supports the view that the **alphabet itself was used as a carrier of theological and cosmological design**.  
The goal of this repository is not dogma but documentation: to provide transparent tools, reproducible data, and a basis for scholarly replication or refutation.

---

## Running the calculator

```bash
npm install   # install dependencies (React, Vite)
npm run dev   # start development server
````

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
