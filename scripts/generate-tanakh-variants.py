"""Build the optional spelling index: python scripts/generate-tanakh-variants.py PATH_TO_MORPHHB"""

import argparse
from collections import defaultdict
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET


CORPUS = Path(__file__).resolve().parents[1] / "public" / "corpus"
REVISION = "6a5db284c715c18b239422e57bb89684e6a19f00"
OSIS_BOOKS = {
    "genesis": "Gen", "exodus": "Exod", "leviticus": "Lev", "numbers": "Num", "deuteronomy": "Deut",
    "joshua": "Josh", "judges": "Judg", "samuel": "1Sam 2Sam", "kings": "1Kgs 2Kgs",
    "isaiah": "Isa", "jeremiah": "Jer", "ezekiel": "Ezek",
    "twelve": "Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal",
    "psalms": "Ps", "proverbs": "Prov", "job": "Job", "song-of-songs": "Song",
    "ruth": "Ruth", "lamentations": "Lam", "ecclesiastes": "Eccl", "esther": "Esth", "daniel": "Dan",
    "ezra-nehemiah": "Ezra Neh", "chronicles": "1Chr 2Chr",
}


def read_json(name):
    return json.loads((CORPUS / name).read_bytes())


def letters(text):
    return re.sub("[^א-ת]", "", text)


def analysis(word, text):
    # The lemma records proclitics before the numbered lexical entry. Keep the
    # full inflection of that entry, including any attached pronominal suffix.
    lemmas = word.get("lemma", "").split("/")
    morph = word.get("morph", "")
    parts = text.split("/")
    codes = morph[1:].split("/")
    prefix_count = len(lemmas) - 1
    if not re.fullmatch(r"(?:[0-9]+(?: [a-z])?\+?|[lbmki])", lemmas[-1]) or not morph or len(parts) != len(codes) or prefix_count >= len(parts):
        return None
    base = letters("".join(parts[prefix_count:]))
    if not base:
        return None
    skeleton = base.replace("ו", "").replace("י", "") or base
    return (lemmas[-1], morph[0] + "/".join(codes[prefix_count:]), skeleton), base


def aligned_pairs(mam, oshb):
    if mam == oshb:
        return enumerate(range(len(mam)))
    # At a textual disagreement accept only identical words paired in both directions.
    def pairs(left, right):
        return {(a + i, b + i) for a, b, size in SequenceMatcher(None, left, right, autojunk=False).get_matching_blocks()
                for i in range(size)}
    reverse = {(len(mam) - 1 - a, len(oshb) - 1 - b) for a, b in pairs(mam[::-1], oshb[::-1])}
    return sorted(pairs(mam, oshb) & reverse)


def align_book(mam, oshb):
    # Exact whole verses anchor the two editions. Between anchors the same words
    # can belong to differently numbered verses, especially in the Decalogue.
    left = [tuple(word for word, offset in verse) for verse in mam]
    right = [tuple(word for word, parsed in verse) for verse in oshb]
    previous_i = previous_j = 0
    for i, j in [*aligned_pairs(left, right), (len(left), len(right))]:
        if previous_i < i and previous_j < j:
            a = [item for verse in mam[previous_i:i] for item in verse]
            b = [item for verse in oshb[previous_j:j] for item in verse]
            for x, y in aligned_pairs([w for w, _ in a], [w for w, _ in b]):
                yield a[x], b[y][1]
        if i < len(left):
            for token, (_, parsed) in zip(mam[i], oshb[j], strict=True):
                yield token, parsed
        previous_i, previous_j = i + 1, j + 1


def generate(upstream):
    manifest = read_json("manifest.json")
    locations = read_json(manifest["downloads"]["tokenLocationsJson"])
    verses = defaultdict(list)
    section_index = position = 0
    for division in manifest["divisions"]:
        for book in division["books"]:
            data = read_json(book["file"])
            names = {s["subBook"] or s["book24"]: code for s, code in
                     zip(data["sourceBookNames"], OSIS_BOOKS[book["slug"]].split(), strict=True)}
            for section in data["sections"]:
                words = section["calculationText"].split()
                spans = locations["sections"][section_index]
                assert section["id"] == spans["sectionId"]
                for start, count, verse, verse_start in spans["verseSpans"]:
                    loc = locations["verseLocators"][verse]
                    ref = (names[loc["subBook"] or loc["book24"]], loc["chapter"], loc["verse"])
                    assert len(verses[ref]) == verse_start - 1
                    for i in range(start - 1, start - 1 + count):
                        verses[ref].append((words[i], position + i))
                position += len(words)
                section_index += 1
    groups = defaultdict(lambda: defaultdict(list))
    coverage = {}
    for code in " ".join(OSIS_BOOKS.values()).split():
        aligned = annotated = 0
        mam = [v for k, v in verses.items() if k[0] == code]
        oshb = []
        for verse in ET.parse(upstream / "wlc" / (code + ".xml")).iterfind(".//{*}verse"):
            # Direct verse children are the written text. Qere readings live in notes.
            row = []
            for w in verse.findall("{*}w"):
                surface = "".join(w.itertext())
                row.append((letters(surface), analysis(w, surface)))
            oshb.append(row)
        for (word, offset), parsed in align_book(mam, oshb):
            aligned += 1
            if parsed:
                key, base = parsed
                groups[key][word, base].append(offset)
                annotated += 1
        coverage[code] = {"words": sum(map(len, mam)),
                          "aligned": aligned, "annotated": annotated}
    assert sum(b["words"] for b in coverage.values()) == manifest["statistics"]["words"]
    return {"contentHash": manifest["contentHash"], "revision": REVISION,
            "source": "Open Scriptures Hebrew Bible v2.2 · https://github.com/openscriptures/morphhb",
            "license": "CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/",
            "adaptation": "Grouped aligned MAM ketiv occurrences by lexical entry, inflection and consonantal spelling.",
            "coverage": coverage,
            "families": [
                {"lemma": lemma, "morph": morph, "forms": [[word, base, offsets] for (word, base), offsets in sorted(forms.items())]}
                for (lemma, morph, skeleton), forms in sorted(groups.items())
                if len({form for pair in forms for form in pair}) > 1]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("upstream", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    revision = subprocess.check_output(["git", "-C", str(args.upstream), "rev-parse", "HEAD"], text=True).strip()
    if revision != REVISION:
        parser.error("Expected openscriptures/morphhb at " + REVISION)
    result = generate(args.upstream)
    payload = (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    path = CORPUS / "spelling-variants.json"
    if args.check:
        if path.read_bytes() != payload:
            raise SystemExit("Regenerate " + str(path))
    else:
        path.write_bytes(payload)
    print({key: sum(b[key] for b in result["coverage"].values()) for key in ("words", "aligned", "annotated")})
