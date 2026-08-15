# AlephEfes - reproducible code and data for zero-indexed Hebrew lexiometry and compositional analysis

This repository contains the **AlephEfes** calculator, a built-in Tanakh corpus, tests, corpus-generation tools, and research documentation around the **א=0** system.

AlephEfes maps the traditional 22-letter Hebrew order to positions **0-21**, normalizes final letter forms to their base letters, and extends the sequence through three additive decimal layers: **Units, Tens, and Hundreds**.

The project began from a minimal indexing shift:

```text
If ב is counted as 1,
the preceding coordinate is א=0.
```

That gives:

```text
א=0, ב=1, ג=2, ... ת=21
```

The mapping was fixed before the textual structures described in the research were found.

At the current stage of the project, recurring structures across independently bounded biblical units support the identification of a **selectively deployed compositional mechanism consistent with the א=0 table**. Lexical values repeatedly function not only as word values but as textual measures: section lengths, local positions, centers, boundaries, repetition counts, occurrence addresses, and transition points.

The open historical questions concern **where the technology originated, how it was calibrated and transmitted, which scribes or institutions knew it, and where in the corpus it was or was not used**.

The calculator interface is currently in **Hebrew**. An English interface is planned.

> You can use the app directly here:
> https://aleph-efes.vercel.app/

---

![App screenshot](docs/demo.png)

---

## What you can do with the calculator

AlephEfes provides five main analysis workspaces:

* **Lines (פירוט)**
  Line-by-line and word-by-word analysis, including U/T/H values, line totals, grand totals, digital roots, exact word positions, and unique-word presentation.

* **Clusters (קבוצות)**
  Digital-root neighborhoods with search, interactive cards, and relation highlighting.

* **Hot Words (שכיחות)**
  Frequency analysis by values or exact word forms, with sortable tables and value → word drill-down.

* **Value Map (מפת ערכים)**
  Quantitative visualization of value frequency, unique-word coverage, and cross-layer bridges.

* **Connection Network (רשת קשרים)**
  Interactive force-directed graph connecting words to their visible U/T/H values.

Additional capabilities include:

* **א=0 / א=1 comparison modes**
* **U / T / H layer filtering**
* **digital-root grouping**
* **prime-value highlighting and filtering**
* **full Tanakh navigation**
* **Masoretic-section selection and ranges**
* **persistent input through `localStorage`**
* **dark mode and text-size controls**
* **virtualized long lists**
* **Web Worker-backed computation with main-thread fallback**

---

## Running the calculator

Requires Node.js 18+ and npm.

### First-time setup

```bash
git clone https://github.com/EdanDa/AlephEfes.git
cd AlephEfes
npm install
npm run dev -- --host
```

### Subsequent updates

```bash
cd AlephEfes
git pull
npm install
npm run dev -- --host
```

### Alternative start commands

```bash
git clone https://github.com/EdanDa/AlephEfes.git
cd AlephEfes
npm install

# Option 1:
npm start

# Option 2:
npm run dev
```

By default:

```text
npm run dev → http://localhost:5173
npm start   → http://localhost:4173
```

The app stores the last analyzed text locally for convenience.

---

## Structure

```text
├── index.html
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── TanakhNavigator.jsx
│   │   └── VirtualizedList.jsx
│   ├── core/
│   │   └── analysisCore.js
│   ├── state/
│   │   ├── appReducer.js
│   │   └── appStore.jsx
│   └── workers/
│       └── coreResults.worker.js
├── tests/
│   ├── analysisCore.test.js
│   ├── appReducer.test.js
│   └── tanakhCorpus.test.js
├── scripts/
│   ├── check-corpus-bundle.mjs
│   ├── generate-tanakh-corpus.mjs
│   └── validate-tanakh-corpus.mjs
├── public/corpus/
│   ├── manifest.json
│   ├── provenance.json
│   └── books/*.json
├── docs/
│   └── demo.png
├── package.json
└── vite.config.js
```

---

## Built-in Tanakh corpus

AlephEfes includes a generated, read-only Tanakh corpus derived from the local `MAM-parsed/plus` source.

Open **פתח תנ״ך** to select:

```text
תורה
נביאים
כתובים
```

and then load:

* a complete book;
* one ordered Masoretic section;
* or a continuous range of sections.

Selections enter the same calculation engine as manually pasted text.

For multi-section input, each genuine Masoretic section remains a separate analytical line.

### Text and structure policy

The corpus follows a strict textual policy:

* **Ketiv only.**
* Qere readings without written Ketiv contribute no calculation text.
* Written Ketiv remains even when it is not read.
* Cantillation and vocalization do not affect the consonantal calculation stream.
* Punctuation and maqaf do not create numerical content.
* Final letter forms are preserved in source representation but normalized mathematically to their base letters.
* Chapter and verse references are retained as locators only.
* Analytical divisions follow genuine Masoretic section boundaries rather than chapter or verse divisions.
* A genuine section boundary inside a verse remains a boundary.
* Poetic spacing is distinguished from section structure rather than inferred mechanically from every layout marker.
* Ambiguous or special upstream boundary types remain explicitly recorded rather than silently collapsed into ordinary open or closed sections.

Exact provenance, source-marker interpretation, and boundary taxonomy are recorded in:

```text
public/corpus/provenance.json
```

### Source, attribution, and license

The biblical corpus is based on **MAM - Mikra According to the Masorah**, via **MAM-parsed**:

* [Mikra According to the Masorah - Hebrew Wikisource](https://he.wikisource.org/wiki/מקרא_על_פי_המסורה)
* [MAM-parsed](https://github.com/bdenckla/MAM-parsed)

The corpus is provided under **CC BY-SA 4.0**.

Credit:

* Seth (Avi) Kadish
* Erel Segal-Halevi
* Benjamin Denckla
* Hebrew Wikisource contributors

MAM documentation was consulted to interpret nontrivial source constructs. Its code was not copied into AlephEfes.

---

# Research framework

## 1) The fixed א=0 system

Let the 22 Hebrew base letters occupy the traditional Northwest-Semitic order:

```text
א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת
```

with zero-based positions:

```text
א=0, ב=1, ג=2, ... ת=21
```

Final forms normalize to their base letters:

```text
ך → כ
ם → מ
ן → נ
ף → פ
ץ → צ
```

Three additive layers are used.

### U / Units

The raw zero-based alphabetic index:

```text
א=0
ב=1
ג=2
ד=3
ה=4
ו=5
ז=6
ח=7
ט=8
י=9
כ=10
ל=11
מ=12
נ=13
ס=14
ע=15
פ=16
צ=17
ק=18
ר=19
ש=20
ת=21
```

### T / Tens

The same order expanded at the decimal threshold:

```text
א=0 ... י=9
כ=10
ל=20
מ=30
נ=40
ס=50
ע=60
פ=70
צ=80
ק=90
ר=100
ש=110
ת=120
```

### H / Hundreds

The upper decimal threshold is expanded again:

```text
א=0 ... י=9
כ=10 ... ר=100
ש=200
ת=300
```

For concatenated strings `x` and `y`:

```text
U(xy) = U(x) + U(y)
T(xy) = T(x) + T(y)
H(xy) = H(x) + H(y)
```

and:

```text
U(w) ≡ T(w) ≡ H(w) mod 9
```

Digital-root conservation across U/T/H is therefore a **formal property of the system**.

---

## 2) Algebraic formulation

Let:

```text
Σ = the 27 modern Hebrew surface letter forms
Γ = the 22 normalized base letters
```

and let:

```text
ν : Σ → Γ
```

normalize final forms.

Extending by concatenation gives:

```text
ν* : Σ* → Γ*
```

For each mode `j ∈ {0,1}`, the three letter-value rows define an additive map into:

```text
ℕ₀³
```

and therefore a unique monoid homomorphism:

```text
Φ_j : Σ* → ℕ₀³
```

with canonical factorization:

```text
Σ*
 ↓ ν*
Γ*
 ↓ Parikh
ℕ₀^Γ
 ↓ V_j
ℕ₀³
```

Thus the numerical triple depends on normalized letter multiplicities.

For א=0:

```text
Φ₀(א) = (0,0,0)
```

so Aleph is orthographically present but arithmetically null.

This is a modern mathematical description of the system. The corresponding historical technology requires only:

```text
ordered alphabet
+ zero-based first coordinate
+ units / tens / hundreds
+ additive word values
+ counting of textual positions and units
```

---

## 3) Aleph as a null generator

Under א=0:

```text
U(א)=T(א)=H(א)=0
```

so:

```text
Φ₀(xאy)=Φ₀(xy)
```

for any surrounding strings `x,y`.

This produces lexical equivalences such as:

```text
דם / אדם
מת / אמת
בריה / בריאה
מלך / מלאך
מלכה / מלאכה
שרה / אשרה
בן / אבן
אלהים / מילה
```

---

## 4) Orthography as a measurable variable

Biblical Hebrew preserves genuine orthographic variation:

```text
defective / plene spelling
matres lectionis
variant foreign-name spellings
competing inherited forms
```

Under א=0, these changes have predictable numerical effects.

For common matres:

```text
א → +0
ה → +4
ו → +5
י → +9
```

### Aleph

Aleph can change the visible form without changing the numerical coordinate:

```text
שרה ↔ אשרה
```

### Yod

Yod shifts all three layers by 9 while preserving residue mod 9.

For example:

```text
ירושלם
→
ירושלים
```

changes:

```text
H=364
→
H=373
```

while preserving the digital-root class.

### Waw

Waw shifts the exact value by 5 and also changes the mod-9 class.

For historically variable spellings such as:

```text
מרדך
מרדוך
```

the alternative orthography supplies a genuine counterfactual.

This creates a direct historical test:

> **When scribes had multiple legitimate spellings available, do canonical choices systematically create, preserve, or avoid specific numerical coordinates?**

---

# Evidence and methodology

The fixed mapping produces lexical and textual coordinates such as:

```text
יהוה     = 22 / 22 / 22
שמש      = 52 in U
לבנה     = 29 in U
ירושלם   = 364 in H
מלאכתו   = 365 in H
```

Some of these align with independently meaningful quantities:

```text
52  ↔ whole weeks in a solar year
29  ↔ whole days in a synodic month
354 ↔ lunar-year scale
364 ↔ 52×7 week-year
365 ↔ solar/civil-year scale
110 ↔ Egyptian ideal completion age
120 ↔ Mesopotamian and biblical human-life limit
```

The strongest evidence occurs when a fixed value also becomes part of the measurable construction of a relevant textual unit:

```text
value ↔ section length
value ↔ local position
value ↔ center
value ↔ boundary
value ↔ repetition count
value ↔ occurrence index
value ↔ orthographic transition
value ↔ relation between adjacent units
```

The evidential target is a multi-channel assembly in which independently meaningful textual or external features converge, especially:

```text
fixed textual boundary
+
lexical value
+
exact length or position
+
center, boundary, or transition
+
local semantic relevance
```

Formal consequences such as Aleph-nullity, anagram equality, cross-layer mod-9 conservation, and digital-root preservation are not independent evidence of historical use by themselves.

---

# Representative textual assemblies

## Genesis 1:1–2:3

The seven inherited daily units contain:

```text
52, 38, 69, 69, 57, 149, 35 words
```

with:

```text
U(שמש)=52
U(ירח)=35
```

so the first and seventh daily units occupy the solar and lunar values.

Day 1 is centered on:

```text
ויהי | אור
```

Day 4, the central luminary unit, activates the same 35 and 52 coordinates internally and contains additional calendrical relations.

Through the end of the seven creation units:

```text
אלהים occurs 35 times
```

while:

```text
U(אלהים)=36
```

and its 36th occurrence is the first immediately beyond the creation boundary, inside:

```text
יהוה אלהים
```

The resulting assembly combines:

```text
fixed section boundaries
+ solar/lunar values
+ exact centers
+ local positions
+ divine-name counts
+ calendrical vocabulary
```

### Randomization test

A broad Monte Carlo test preserved:

```text
the Hebrew text
the seven fixed units
the 22 zero-based slots
the U/T/H construction
the relevant external constants
```

while randomly reassigning Hebrew letters to the 22 positions.

The canonical mapping scored:

```text
9 / 9
```

Across:

```text
200,000,000
```

random mappings:

```text
maximum random score = 5 / 9
```

and no random mapping reached 6/9.

With the standard Monte Carlo +1 correction:

```text
p_MC = 1 / 200,000,001
     ≈ 5.0 × 10^-9
```

The tested feature families were developed during the research rather than preregistered, so this is not a universal probability for the historical hypothesis.

It establishes a narrower result:

> under the defined randomization null, the observed creation architecture depends very strongly on the canonical assignment of Hebrew letters to the zero-based coordinates.

The individual conditions are often not especially rare. What random mappings failed to reproduce was the **combined assembly**.

---

## Babel

Genesis 11:1–9 contains:

```text
121 = 11² words
```

and is centered exactly on:

```text
האדם
```

giving:

```text
60 | האדם | 60
```

The YHWH descent verse contains 11 words, places יהוה at word 52, and ends at the central `האדם`.

There are also 11 words with digital root 4 before `האדם` and 11 after it, for a total of 22. Both `יהוה` and `בבל` belong to the same digital-root class.

Because the unit concerns:

```text
language
shared speech
collective coordination
and linguistic fragmentation
```

its alphabetic and positional architecture is directly relevant to its subject.

---

## Abraham, Isaac, Sarah, Heth, and Ephron

Several independently bounded units form a connected numerical assembly.

```text
חת = 28 / 127 / 307
```

while:

```text
Sarah's age             = 127
first לך לך unit length = 127
Aqedah unit length      = 307
```

The Aqedah contains:

```text
יצחק = 51 / 186 / 186
```

with:

```text
word 51  = יצחק
word 186 = ידך
```

inside:

```text
אל תשלח ידך אל הנער
```

The final explicit occurrence of `יצחק` is also the exact center of the 307-word unit.

Genesis 23 contains:

```text
275 words
```

while:

```text
עפרון = 68 / 275 / 275
```

and the same unit links Sarah's 127 years, Heth, Ephron, the transfer of the burial property, and the preceding Aqedah.

This is a compact example of numerical value functioning as **measure, address, and compositional relation** rather than merely lexical total.

---

## Cross-book replication

The same operational grammar appears outside Genesis.

### Exodus

```text
אהיה = 17 / 17 / 17
```

and the formula:

```text
אני יהוה
```

occurs 17 times.

The first exact `יהוה` in the burning-bush unit occurs at local word:

```text
22
```

while:

```text
יהוה = 22 / 22 / 22
```

Other Exodus units coordinate divine identity, departure, Sabbath, sanctuary, and transition through exact lengths, counts, positions, and centers.

### Joshua

Under א=0:

```text
U₀(יהושע)=53
```

The exact form `יהושע` occurs:

```text
159 = 3×53
```

times in the book.

The opening Masoretic unit also contains:

```text
159 words
```

and is centered on:

```text
אהיה עמך
```

This creates an independently bounded assembly:

```text
protagonist value
↔ protagonist count
↔ section length
↔ semantic center
```

### Daniel

Daniel demonstrates that the mechanism can survive Hebrew/Aramaic transition.

In Daniel 7:

```text
H₀(עשר)=360
```

at the exact center of one vision unit.

A following interpretive unit is centered on `עתיק` and contains:

```text
H₀(מלכותא)=365
```

while null final Aleph gives:

```text
Φ₀(מלכותא)=Φ₀(מלכות)
```

The local architecture links 360/364/365 to explicit language of time and kingship.

### Lamentations 2

Lamentations 2 contains 22 alphabetic units.

The first 21 contain:

```text
364 words
```

so the Tav unit begins at:

```text
word 365
```

with the local boundary containing:

```text
360 → ביום
364 → final word before Tav
365 → opening of Tav
```

while:

```text
H₀(ירושלם)=364
T₀(אשמרות)=365
```

inside a poem concerned with Jerusalem, day, night, appointed time, Sabbath, and festival.

Across different books, genres, and languages, the recurrent operation is:

```text
lexical value
→ textual measure or address
→ locally relevant structure
```

---

# Self-indexing and occurrence addresses

A word reaching its own numerical occurrence number is not evidence by itself.

In a sufficiently large corpus, any frequent word can eventually reach:

```text
occurrence_V(w)
```

The occurrence number is therefore treated as an **address** whose evidential value depends on what occurs there.

Structurally relevant activations include:

```text
first or last orthographic form
change of naming regime
section boundary
center
semantic realization
narrative operation
```

Thus:

```text
value
→ address
→ independently meaningful textual event
```

is stronger than self-indexing alone.

---

# Historical context and calibration hypothesis

The relevant scribal ecology connected Egypt, the Levant, Syria, and Mesopotamia and made available the operations required by the reconstructed system: alphabetic ordering, additive numeration, textual counting, orthographic variation, divine-name equivalence, and cross-script recoding.

The historical problem is how these operations were combined, calibrated, and transmitted.

---

## Ugarit: five writing systems, eight languages

Ugarit is especially important because an unusual concentration of relevant scribal technologies is documented in one Late Bronze Age center.

Its archives preserve **eight languages written through five graphic systems**:

```text
1. Sumero-Akkadian cuneiform
2. Ugaritic alphabetic cuneiform
3. Hittite hieroglyphs
4. Egyptian hieroglyphs
5. Cypro-Minoan
```

Ugaritic scribes worked with:

```text
alphabetic texts
syllabic cuneiform
lexical lists
god lists
administrative records
diplomatic correspondence
ritual and mythological texts
multiple sign inventories
and cross-cultural equivalence traditions
```

The Ugaritic Abgad belongs to the same Northwest-Semitic alphabetic order continued by Phoenician and Hebrew.

Alongside the standard expanded Ugaritic alphabet, evidence also survives for a shorter **22-sign alphabetic tradition**.

Seven-day sequences recur as compositional units in Ugaritic mythological literature.

The concentration in one scribal environment of fixed alphabetic order, alternative inventories, five writing systems, eight languages, Mesopotamian scholarship, god-name equivalence, numerical traditions, and structured literary composition makes Ugarit especially relevant to the history of calibration.

---

## Additive decimal numeration

Egyptian hieratic numeration was decimal and additive, using distinct signs for:

```text
1–9
10–90
100–...
```

rather than positional place value.

Israelite and Judahite scribes demonstrably used hieratic numerical traditions alongside Hebrew writing.

The operation:

```text
ordered signs
+
units
+
tens
+
hundreds
+
addition
```

was therefore historically available in the relevant scribal world.

Later Greek alphabetic numerals independently demonstrate that alphabetic order and additive decimal valuation can be combined directly.

---

## Divine numbers and the calibration hypothesis

Mesopotamian scholarly traditions assigned conventional numbers to major deities, including:

```text
Adad      → 6
Shamash   → 20
Sin/Nanna → 30
Ea/Enki   → 40
Anu       → 60
```

Under the canonical Northwest-Semitic order indexed from zero:

```text
אדד  → U₀=6
ננה  → U₀=30
אנקי → U₀=40
```

and:

```text
T₀(אן)=H₀(אן)=40
```

so:

```text
U₀(אנקי)=T₀/H₀(אן)=40
```

These correspondences arise under one fixed alphabetic order and one fixed valuation rule.

Together with the wider Ugaritic environment, they motivate a specific historical hypothesis:

> **Numerical calibration may have participated in the stabilization, selection, or recoding of the alphabetic system itself, rather than being applied only after the alphabet had already assumed its canonical form.**

The hypothesis can be tested against larger predefined sets of:

```text
historically attested divine names
available spellings
known divine numbers
alternative transliterations
and alternative alphabetic assignments
```

The relevant object is the **combined concentration of independently inherited correspondences**, not any isolated divine-name equality.

The absence of a surviving instruction explicitly defining א=0 is not evidence against calibration; the hypothesis should be judged against contradictory evidence and competing models capable of explaining the same convergence.

---

## Scribal recoding

Ancient Near Eastern writing repeatedly separates:

```text
graphic presence
phonetic realization
lexical identity
categorical function
numerical function
```

The cuneiform sign:

```text
𒀭 / AN / DINGIR
```

can participate in several roles involving heaven, deity, divine classification, non-pronounced written marking, and the numerical tradition associated with Anu.

The comparison with Aleph is functional rather than genealogical. It demonstrates that ancient scribal systems could assign graphic, phonetic, categorical, and numerical functions to the same sign without requiring them to coincide one-to-one.

Multilingual scribal environments likewise show systematic recoding of names, gods, concepts, and written forms across representational systems, providing a historical setting in which number could function as one constraint among others on written representation.

---

# א=1 as a comparison mode

The one-based system remains analytically useful:

```text
א=1, ב=2, ... ת=22
```

For any word:

```text
U₁(w)=U₀(w)+L(w)
```

where `L(w)` is normalized letter length.

Comparison distinguishes:

```text
patterns specific to zero indexing
patterns specific to one-based counting
patterns shared by both
```

The two modes therefore function as comparative systems rather than interchangeable explanations.

---

# Research status and falsifiability

AlephEfes is a naturalistic historical research project.

The Hebrew Bible is treated as a composite human corpus produced and transmitted through:

```text
multiple authors
multiple editors
competing traditions
textual variants
orthographic change
later intervention
and long transmission histories
```

A historical א=0 technology therefore need not be uniformly present or equally understood throughout the text. Its transmission could involve designers, trained or partial users, conservative copyists, later editors, and writers unaware of the system.

The next stage of research is distributional:

```text
Where is the mechanism active?
Which operations recur?
Where is it absent?
Which variants preserve or disrupt it?
Which historical environments best explain its calibration and transmission?
```

Historical reconstructions involving specific population identities, precise transmission routes, foreign-name recodings, pantheon transformations, and the exact origin of calibration remain distinct from the measurable textual architecture.

The project is best approached as a **system-identification problem**:

```text
fixed mapping
→ formal outputs
→ textual geometry
→ external calibration
→ repeated compositional activation
→ historical reconstruction
```

The first stages are mathematical and reproducible; historical attribution is abductive.

The historical importance of the biblical corpus is independent of AlephEfes. If a previously unidentified alphabetic-number technology participated in the composition or editing of parts of it, its significance lies in what it reveals about **how one of history's most consequential textual corpora was constructed**.

The project remains open to replication, criticism, counter-models, falsification, revision, and replacement by a stronger explanation.

The central task is not to accumulate numerical coincidences. It is to identify — or successfully disprove — the recurrent compositional mechanism.

---

## License

MIT

---

## Author

Developed by **Edan-David Eyon**
Independent researcher, Israel

I have pursued independent study across philosophy, linguistics, history, mathematics, cognition, and related fields since 2011.
