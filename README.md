# AlephEfes

🄰🄰 Hebrew Isopsephy – reproducible code and data for numeric-semantic analysis of the Hebrew Bible (isopsephy, digital-root tools, null-model tests).

## Overview

AlephEfes provides tools for exploring **Aleph-Code** (קוד-אלף), a numerological framework where Hebrew letters map to values 0–21. The system implements a three-layer calculation (units, tens and hundreds) using Δ9 digital-root closure. This approach keeps the digital root constant across layers, enabling systematic analysis of Hebrew texts.

The repository includes an interactive calculator demonstrating the method, as well as code and data for further experiments.

### Key Features

- **Zero-based letter mapping** – א=0, ב=1, ג=2 … ת=21
- **Multi-layer sums** – units, tens (Δ9 adjustment) and hundreds with special multipliers for ש and ת
- **Digital root computation** – consistent across layers via Δ9 closure
- **Prime detection** – primes highlighted in green with a diamond marker
- **Line and text summaries** – breakdown by line with cumulative totals
- **Prime summary table** – lists all prime totals encountered
- **Detailed letter breakdown** for each word

- **Multi-layer sums** – units, tens (Δ9 adjustment) and hundreds (with special multipliers for ש and ת)
- **Digital root computation** – consistent across layers via Δ9 closure
- **Prime detection** – primes highlighted in word and line totals
- **Line and text summaries** – breakdown by line with cumulative totals


## Aleph Code Calculator

A browser-based React application lives in `index.html`. It can be opened directly in any modern browser or served locally.

### Running Locally

1. Ensure you have Python installed.
2. Start a small HTTP server from the repository directory:

```bash
python3 -m http.server
```

3. Open [http://localhost:8000/index.html](http://localhost:8000/index.html) in your browser.

The application loads React, ReactDOM, Babel and TailwindCSS from public CDNs, so an internet connection is required when first opening the page.
