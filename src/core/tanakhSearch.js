// The occurrence index stores one-based positions in the canonical ketiv text.
export function indexSectionWords({ sectionIds, occurrencesByWord }) {
    const sections = sectionIds.map(() => []);
    for (const [word, occurrences] of Object.entries(occurrencesByWord)) {
        for (const [section, position] of occurrences) sections[section][position - 1] = word;
    }
    return sections;
}

export function findSpellingMatches(index, sections, words) {
    const candidates = index.occurrencesByWord[words[0]] || [];
    if (words.length === 1) return candidates;
    return candidates.filter(([section, position]) =>
        words.every((word, offset) => sections[section][position - 1 + offset] === word));
}

// Locate the selected words without changing the source's niqqud, cantillation or maqaf.
export function sourceMatchRange(source, position, length) {
    let ordinal = 0, start = 0;
    for (const token of source.matchAll(/[א-ת][א-ת\p{M}]*/gu)) {
        ordinal++;
        if (ordinal === position) start = token.index;
        if (ordinal === position + length - 1) return [start, token.index + token[0].length];
    }
    return null;
}
