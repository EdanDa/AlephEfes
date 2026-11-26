"""Census of local word-value relations in the bundled MAM ketiv (standard library only)."""

import argparse
from collections import Counter, defaultdict
from functools import lru_cache
from hashlib import sha256
from itertools import accumulate, combinations
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "public/corpus"
SNAPSHOT = ROOT / "src/core/researchOperatorCensus.json"
ALPHABET = "אבגדהוזחטיכלמנסעפצקרשת"
FINALS = str.maketrans("ךםןףץ", "כמנפצ")
TENS = (*range(11), *range(20, 131, 10))
HUNDREDS = (*range(11), *range(20, 101, 10), 200, 300, 400)
RULES = ("wordCount", "letterCount", "wordPosition", "repeatDistance",
         "zeroAddress", "sectionOrdinal", "centerMeasuresWords", "bothDimensions",
         "letterStart", "letterEnd", "formOccurrence", "mirrorSpelling", "sameWordBothDimensions",
         "localFrequency", "middleSelfPosition", "doubleCenter", "centerSeam", "repeatLattice",
         "prefixMeasuresWords", "suffixMeasuresWords", "frameSpelling", "adjacentEquivalent")


@lru_cache(maxsize=None)
def values(word, origin):
    indices = [ALPHABET.index(ch) + origin for ch in word.translate(FINALS)]
    return (sum(indices), sum(TENS[i] for i in indices), sum(HUNDREDS[i] for i in indices))


def audit_unit(words, ordinal, origin, stats, expected):
    positions = defaultdict(list)
    for position, word in enumerate(words, 1):
        positions[word].append(position)
    size, letters = len(words), sum(map(len, words))
    boundaries = list(accumulate(map(len, words), initial=0))
    hits = {key: 0 for key in RULES}
    hits["mirrorSpelling"] = sum(words[i] == words[-1-i] for i in range(size // 2))
    hits["frameSpelling"] = int(size >= 2 and words[0] == words[-1])
    vectors = [values(word, origin) for word in words]
    hits["adjacentEquivalent"] = sum(a != b and va == vb for a, b, va, vb in zip(words, words[1:], vectors, vectors[1:]))
    for order, rule in [(vectors, "prefixMeasuresWords"), (reversed(vectors), "suffixMeasuresWords")]:
        totals = (0, 0, 0)
        for vector in order:
            totals = tuple(a + b for a, b in zip(vector, totals))
            hits[rule] += size in totals
    if size % 2:
        i = size // 2
        hits["middleSelfPosition"] = int(i + 1 in vectors[i])
        hits["doubleCenter"] = int(letters % 2 == 1 and boundaries[i] < (letters + 1) // 2 <= boundaries[i+1])
    elif size:
        hits["centerSeam"] = int(boundaries[size // 2] * 2 == letters)
    for word, places in positions.items():
        u, t, h = values(word, origin)
        distinct = {u, t, h}
        count = len(places)
        hits["localFrequency"] += count if count in distinct else 0
        hits["repeatLattice"] += sum(b - a == c - b for a, b, c in zip(places, places[1:], places[2:]))
        if size in distinct:
            hits["wordCount"] += count
            hits["centerMeasuresWords"] += int(size % 2 == 1 and (size + 1) // 2 in places)
            if letters in distinct:
                hits["sameWordBothDimensions"] += count
        if letters in distinct:
            hits["letterCount"] += count
        if ordinal in distinct:
            hits["sectionOrdinal"] += count
        hits["wordPosition"] += sum(p in distinct for p in places)
        hits["zeroAddress"] += sum(p - 1 in distinct for p in places)
        hits["letterStart"] += sum(boundaries[p - 1] + 1 in distinct for p in places)
        hits["letterEnd"] += sum(boundaries[p] in distinct for p in places)
        hits["formOccurrence"] += sum(1 <= v <= count for v in distinct)
        distances = Counter(b - a for a, b in combinations(places, 2))
        hits["repeatDistance"] += sum(distances[v] for v in distinct)
        for layer, value in zip(("U", "T", "H"), (u, t, h)):
            stats["wordCount"]["byLayer"][layer] += count if size == value else 0
            stats["letterCount"]["byLayer"][layer] += count if letters == value else 0
            stats["wordPosition"]["byLayer"][layer] += int(value in places)
            stats["repeatDistance"]["byLayer"][layer] += distances[value]
        # Exact expectations under a uniform shuffle of this unit's occurrences.
        expected["wordPosition"] += count * sum(1 <= v <= size for v in distinct) / size
        expected["zeroAddress"] += count * sum(0 <= v < size for v in distinct) / size
        if size > 1 and count > 1:
            slots = sum(size - v for v in distinct if 0 < v < size)
            expected["repeatDistance"] += slots * count * (count - 1) / (size * (size - 1))
    hits["bothDimensions"] = int(bool(hits["wordCount"] and hits["letterCount"]))
    for key, cases in hits.items():
        stats[key]["cases"] += cases
        stats[key]["units"] += int(cases > 0)


def census():
    manifest = json.loads((CORPUS / "manifest.json").read_text(encoding="utf-8"))
    checksum = sha256()
    sections = words_total = odd_units = repeated_pairs = units_with_repeats = 0
    modes = {mode: {key: {"units": 0, "cases": 0} for key in RULES}
             for mode in ("aleph-zero", "aleph-one")}
    expected = {mode: defaultdict(float) for mode in modes}
    for stats in modes.values():
        for rule in ("wordCount", "letterCount", "wordPosition", "repeatDistance"):
            stats[rule]["byLayer"] = dict.fromkeys(("U", "T", "H"), 0)
    for division in manifest["divisions"]:
        for book in division["books"]:
            contents = (CORPUS / book["file"]).read_text(encoding="utf-8")
            checksum.update(contents.encode())
            for section in json.loads(contents)["sections"]:
                words = section["calculationText"].split()
                sections += 1
                words_total += len(words)
                odd_units += len(words) % 2
                counts = defaultdict(int)
                for word in words:
                    repeated_pairs += counts[word]
                    counts[word] += 1
                units_with_repeats += int(len(counts) < len(words))
                for origin, (mode, stats) in enumerate(modes.items()):
                    audit_unit(words, section["ordinal"], origin, stats, expected[mode])
    if (checksum.hexdigest(), sections, words_total) != (
        manifest["contentHash"], manifest["statistics"]["sections"], manifest["statistics"]["words"]
    ):
        raise ValueError("Book contents or corpus counts disagree with the manifest")
    return {"corpusHash": checksum.hexdigest(), "units": sections, "words": words_total,
            "oddUnits": odd_units, "sameFormPairs": repeated_pairs,
            "unitsWithRepeats": units_with_repeats, "modes": modes,
            "shuffleExpectations": {mode: {key: round(x, 2) for key, x in rows.items()}
                                    for mode, rows in expected.items()}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    options = parser.add_mutually_exclusive_group()
    options.add_argument("--write", action="store_true", help="refresh the app's reference counts")
    options.add_argument("--check", action="store_true", help="verify the checked-in census")
    args = parser.parse_args()
    result = census()
    if args.check:
        if result != json.loads(SNAPSHOT.read_text(encoding="utf-8")):
            raise SystemExit("Reference counts differ from the corpus census")
        print(f"Verified {result['units']} units and {result['words']} words.")
    elif args.write:
        SNAPSHOT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(result, indent=2))
