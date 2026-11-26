# Aleph Efes · א=0 / א=1

Aleph Efes is Edan-David Eyon’s calculator and research project on the consonantal text of the Hebrew Bible. Its starting question is simple enough to try by hand. If a Hebrew word has an alphabetic value of 51, what occupies word 51 in the passage where it occurs? The research follows such observations through the spelling, the boundaries of the passage, other books and, where possible, another textual witness.

## Open Aleph Efes

[עברית](https://aleph-efes.vercel.app/?lang=he) · [English](https://aleph-efes.vercel.app/?lang=en)

Paste Hebrew text or open a Tanakh book, section or range. Switch between `א=0` and `א=1` to compare the same text. **Details** shows each word in order and how its letters add up. **Inspect word** finds its occurrences. A **Research note** keeps the selected text, counts, positions and source together.

Choose **Songs, psalms and passages** in the reader and type a title or chapter number. The list includes the Psalms, the five chapters of Lamentations, and named passages such as the Song of Deborah and the twenty-eight times in Ecclesiastes 3:2–8. Psalm 119 opens with its 22 stanzas. Psalms 114–115 open together because they occupy one MAM section. Selecting **Analyze** opens the Lines view with one line for each original MAM section.

The **Research** tab offers 22 editable rules and a formula editor for defining your own. For example, `prevGap = nextGap` finds the middle occurrence of three consecutive appearances of one spelling at equal distances within a unit. Choose the current text, one book, or the entire corpus. Open a match to see the passage and export its formula and measurements. The independent corpus counts for both alphabet modes can be reproduced with `python scripts/audit-research-operators.py --check`.

Tanakh search shows exact written forms first. For a single word, expand the additional matches to see attested prefixes and spelling variants grouped by their MAM spelling. Occurrences share an annotated lexical entry, inflection (including suffixes), and a consonantal form compared with and without ו and י. An unpointed query can represent multiple readings. The optional index uses aligned written words from all 39 books. To reproduce it, run `python scripts/generate-tanakh-variants.py PATH_TO_MORPHHB --check` with the pinned source checkout. The derived annotations credit the [Open Scriptures Hebrew Bible v2.2](https://github.com/openscriptures/morphhb/tree/6a5db284c715c18b239422e57bb89684e6a19f00) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The web calculator runs in a browser on Windows, macOS, Linux, Android and iOS. If you have the local distribution, double-click **Aleph Efes.exe** on Windows or open **Aleph Efes.html** in a desktop browser on Windows, macOS or Linux. Both include the corpus. The 🌐 control switches between Hebrew and English. To use the local version on a phone, choose **Open on my Wi-Fi** in the Windows launcher and open the displayed address on the same network.

## What the alphabet fixes

The two mappings run from א to ת, starting at 0 or 1. For a letter of rank `u`, Units is `u`, Tens is `u + 9 × max(u − 10, 0)`, and Hundreds is `Tens + 90 × max(u − 19, 0)`. Add each column across the word. Final letters have the value of their ordinary forms. The corpus preserves their written spellings.

This explains several apparent coincidences in advance. Adding א leaves all three sums unchanged in the zero-based mapping. Moving to the one-based mapping raises the Units sum by exactly the word’s length. Rearranging the same letters preserves all six sums. Two words with different letters can also agree. שמש and תמר both give **52, 250, 430** at zero and **55, 280, 640** at one. Of 118,745 pairs of distinct attested spellings that share all six values, 82,457 have different letter multisets. A shared sum becomes more informative when the passage itself supplies a reason to compare those particular words. [Both value tables and all 39,650 spellings](public/corpus/aleph-efes-tanakh-corpus.json)

## Genesis and the two lights

The first seven Masoretic sections of Genesis contain **52, 38, 69, 69, 57, 149 and 35 words**. The first has ויהי אור, “and there was light,” at its center. The fourth describes the greater light governing the day and the lesser light governing the night. The unprefixed spellings שמש and ירח occur zero times in the seven sections. A reader supplies those names. Their Units values in `א=0`, 52 and 35, equal the lengths of the first and seventh sections. [Genesis text and section boundaries](public/corpus/books/genesis.json)

We applied that exact rule to all **3,899** runs of seven consecutive sections within a book. At zero, 18 runs have the specified first length, 24 have the specified seventh length, and **one has both**. At one, שמש and ירח give 55 and 38, and no run has both. Keeping only open and closed boundaries and book ends gives 3,558 runs. The same opening 469 words still supply the sole zero-based match. Genesis prompted the choice of nouns, spacing and direction, so the census measures recurrence of that reading. [Boundary definitions](public/corpus/provenance.json)

A Phoenician inscription adds a comparison that a numerical search cannot supply. Two copies at Karatepe end by likening the endurance of the royal name to that of the sun and moon. The actual spelling is שמש וירח. At zero, וירח gives 40. Reading 35 requires removing the conjunction. The inscription documents the literary pairing and makes that spelling decision visible. Whether a scribe used these exact numerical tables remains an open historical question. [Karatepe, copies A and C, lines 62 and 96](https://deaps.osu.edu/text_objects/11466)

## Isaac, Heth and the burial of Sarah

Three Genesis passages connect through the names and quantities in the narrative. The section containing Abram’s first לך לך call has **127 words**, the binding of Isaac has **307**, and Sarah’s burial has **275**. The burial account opens by giving Sarah’s age as 127 and ends with חת, Heth. At zero, חת gives **28, 127, 307** and עפרון, Ephron, gives **68, 275, 275**. Ten attested spellings share the Tens/Hundreds pair 127 and 307. The presence of Heth in this particular transaction gives a textual reason to pick that name from the ten. [Genesis, sections 42, 53 and 55](public/corpus/books/genesis.json)

Inside the binding, the exact name יצחק occurs at words **24, 51, 98, 110 and 154**. Its Units value is 51. Its Tens and Hundreds values are both 186, the position of ידך, “your hand,” in the command to stay Abraham’s hand. Both columns point to that one word because their weights agree for every letter in יצחק. The last Isaac is the middle word, 154 of 307.

How much of that pattern recurs? Take the middle word of every odd-length section. Ask whether its Units value points to a strictly earlier occurrence of the same spelling, and whether the central occurrence is its last. This rule selects the word before looking up its value.

| MAM comparison | Odd-length sections | Address before the middle | Same word at that address | Also its last occurrence at the middle |
|---|---:|---:|---:|---:|
| א=0 | 1,913 | 692 | 9 | 5 |
| א=1 | 1,913 | 629 | 9 | 2 |

The five at zero are יצחק, את, הפר, כלם and כי. At one they are לא and למו. The comparison picks out both names and grammatical words. The significance of ידך within the binding comes from reading the command addressed to Abraham in context.

A broader question gives a different perspective. Across all 305,437 tokens, a word occupies its own Units address 2,259 times at zero. If each section is read from every possible circular starting point, keeping its words and order, the exact average is 2,246.68. Generic self-addressing is common under that comparison. Isaac’s distinctive features are the repeated name, its last occurrence at the midpoint, and the wording at 186.

## Following a count into another book

| Passage | What can be checked | What changes the reading |
|---|---|---|
| Exodus | מועד gives 35, 98, 98 at zero. It occurs 35 times in Exodus and in 98 distinct sections across the Tanakh. | In 34 of the 35 Exodus occurrences the preceding word is אהל, באהל or לאהל. Repetition of “tent of meeting” helps explain why the book count is concentrated there. |
| Joshua | The final section has 90 words and ends with אפרים. The earlier אפרים ends at the 90th consonant. | Applying the same forward count everywhere gives 8 matches among 4,039 sections. The open/closed partition gives 6 among 3,696. |
| Daniel | Across the book’s 5,923 words, the middle word is להקמותה. Its two middle consonants lie ten words earlier in סרכיא. Both can be located at Daniel 6,4. | Counting the Aramaic span from the start of the Aramaic speech in Daniel 2,4 through Daniel 7,28 gives a different word center, לך. The counted extent is part of the finding. |
| Psalms | In the 49-word section at Psalms 67,2–67,8, עמים (“peoples”) occurs at 15, 18, 25, 32 and 35. Each position reflects onto another occurrence or itself about word 25. In the 45-word section at Psalms 93,1–93,5, נהרות (“rivers”) occurs at 20, 23 and 26. | Requiring at least three occurrences of one exact spelling and reflection of **every** occurrence yields 13 spelling–section pairs across all 4,039 sections. These are the two in Psalms. The rule depends only on word order and section boundaries. [Psalms text](public/corpus/books/psalms.json) |

The corpus comprises 305,437 word occurrences in 4,039 MAM sections. Calculations use written consonants (*ketiv*). Research positions start at 1 in either mapping. Chapter and verse numbers locate the text. [Exodus](public/corpus/books/exodus.json) · [Joshua](public/corpus/books/joshua.json) · [Daniel](public/corpus/books/daniel.json) · [Manifest](public/corpus/manifest.json)

<details>
<summary>Reproduce both Genesis comparisons from the public download</summary>

Run this Python 3 example from the repository root. It uses the ordered vocabulary indices and the two stored value tables. Each window stays within a storage book. For the midpoint test the address and middle are distinct one-based positions.

```python
import json
from collections import defaultdict
from pathlib import Path

data = json.loads(Path("public/corpus/aleph-efes-tanakh-corpus.json").read_bytes())
shared = data["analysisShared"]
vocabulary = [entry["word"] for entry in shared["words"]]
books = defaultdict(list)
for section in shared["sections"]:
    book, _ = section["sectionId"].rsplit("-", 1)
    books[book].append(section["wordIndices"])

for mode, table in data["analysisByMode"].items():
    units = [entry["units"] for entry in table["wordValues"]]
    sun, moon = (units[vocabulary.index(w)] for w in ("שמש", "ירח"))
    windows = centers = 0
    hits = []
    for book, sections in books.items():
        windows += sum(len(a) == sun and len(b) == moon
                       for a, b in zip(sections, sections[6:]))
        for ordinal, tokens in enumerate(sections, 1):
            if len(tokens) % 2 == 0:
                continue
            middle = len(tokens) // 2
            word = tokens[middle]
            address = units[word]
            if 1 <= address < middle + 1 and tokens[address - 1] == word:
                if word not in tokens[middle + 1:]:
                    centers += 1
                    hits.append((book, ordinal, vocabulary[word]))
    print(mode, windows, centers, hits)
```

The two match counts are **1 and 5** for `aleph-zero` and **0 and 2** for `aleph-one`. The IDs printed alongside the counts identify the other passages for inspection.

</details>

## Source and credits

With Node.js 24, use `npm ci` and `npm run dev` to run from source. Edan-David Eyon developed Aleph Efes. [Software license (MIT)](LICENSE)

The biblical text and its derivatives are credited to Seth (Avi) Kadish, Erel Segal-Halevi, Benjamin Denckla and Hebrew Wikisource contributors under CC BY-SA 4.0. [MAM edition](https://he.wikisource.org/wiki/מקרא_על_פי_המסורה) · [MAM-parsed](https://github.com/bdenckla/MAM-parsed) · [Corpus license](https://creativecommons.org/licenses/by-sa/4.0/)
