# Aleph Efes · א=0 / א=1

Aleph Efes is Edan-David Eyon’s calculator for studying the written consonants of the Hebrew Bible. Choose a passage or paste Hebrew text to compare two ways of numbering the alphabet. Select a word to inspect its spelling, value and occurrences in the passage.

## Open Aleph Efes

The [web calculator](https://aleph-efes.vercel.app/) opens in a browser on Windows, macOS, Linux, Android and iOS.

If you have the local distribution, double-click **Aleph Efes.exe** on Windows, or open **Aleph Efes.html** in a desktop browser on macOS, Linux or Windows. Both include the complete corpus and work offline. To use the local version on a phone, choose **Open on my Wi-Fi** in the Windows launcher and open the displayed address on the same network. The centered 🌐 button switches the local interface between Hebrew and English. The text being analyzed stays in Hebrew.

## How the values work

The two modes give א a rank of 0 or 1 and continue in alphabetic order through ת. For each letter of rank `u`, Units equals `u`, Tens equals `u + 9 × max(u − 10, 0)`, and Hundreds equals `Tens + 90 × max(u − 19, 0)`. A word’s value is the sum of its letters in each column. Final letters keep their ordinary letter’s value.

## Findings you can check

- **One spelling across books.** In א=0, מועד has values **35, 98, 98**. Its exact spelling occurs 35 times in Exodus and appears in 98 distinct Masoretic sections across the Tanakh. In 34 of the 35 Exodus occurrences, the preceding word is אהל, באהל or לאהל, a form of “tent.”
- **Two spellings with the same values.** שמש and תמר give **52, 250, 430** in א=0 and **55, 280, 640** in א=1. Across 39,650 attested spellings, 118,745 unordered pairs share all six values. In 82,457 of those pairs the spellings have different letter multisets even after folding final forms. This gives a baseline for interpreting any one match.
- **A boundary-sensitive count in Joshua.** The book’s final Masoretic section has 90 words and ends with אפרים. The earlier אפרים ends at the section’s 90th consonant. Applying that same forward-reading rule to every section yields 8 matches in 4,039 sections. Keeping only open and closed boundaries and book ends yields 6 in 3,696.

These counts use the consonantal *ketiv* and the section boundaries of *Mikra According to the Masorah* (MAM). The public data include ordered word indices for each section and both value tables. [Corpus download](public/corpus/aleph-efes-tanakh-corpus.json) · [Text versions and boundaries](public/corpus/provenance.json)

## Source and credits

To run from source with Node.js 24, use `npm ci` and `npm run dev`. The software is distributed under the [MIT license](LICENSE).

The biblical text and its derivatives are credited to Seth (Avi) Kadish, Erel Segal-Halevi, Benjamin Denckla and Hebrew Wikisource contributors under CC BY-SA 4.0. [MAM edition](https://he.wikisource.org/wiki/מקרא_על_פי_המסורה) · [MAM-parsed](https://github.com/bdenckla/MAM-parsed) · [Corpus license](https://creativecommons.org/licenses/by-sa/4.0/)
