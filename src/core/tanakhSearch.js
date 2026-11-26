// The occurrence index stores one-based positions in the canonical ketiv text.
export function buildSpellingIndex({ sectionIds, occurrencesByWord, bookStarts, boundariesAfter }) {
    const sections = sectionIds.map(() => []);
    for (const [word, occurrences] of Object.entries(occurrencesByWord)) {
        for (const [section, position] of occurrences) sections[section][position - 1] = word;
    }
    const offsets = [0];
    for (const section of sections) offsets.push(offsets.at(-1) + section.length);
    const bookOffsets = bookStarts.map(([section, position]) => offsets[section] + position - 1);
    bookOffsets.push(offsets.at(-1));
    return { occurrencesByWord, tokens: sections.flat(), offsets, bookOffsets, sectionIds, boundariesAfter };
}

// Both offset tables end with the exclusive end of the corpus.
function containingInterval(offsets, position) {
    let low = 0, high = offsets.length - 1;
    while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2);
        if (offsets[mid] <= position) low = mid;
        else high = mid;
    }
    return low;
}

export function findSpellingMatches({ occurrencesByWord, tokens, offsets, bookOffsets }, words) {
    const hits = [];
    for (const [section, position] of occurrencesByWord[words[0]] || []) {
        const start = offsets[section] + position - 1;
        const end = start + words.length;
        const book = containingInterval(bookOffsets, start);
        if (end > bookOffsets[book + 1] || !words.every((word, i) => tokens[start + i] === word)) continue;
        const endSection = end <= offsets[section + 1] ? section : containingInterval(offsets, end - 1);
        hits.push({ section, endSection, position, endPosition: end - offsets[endSection], start, end, book });
    }
    return hits;
}

export function matchesSectionFilter(index, hit, filter) {
    const crossed = hit.endSection - hit.section;
    switch (filter) {
        case 'all': return true;
        case 'within': return crossed === 0;
        case 'whole': return crossed === 0 && hit.position === 1 && hit.end === index.offsets[hit.section + 1];
        case 'across': return crossed > 0;
        default:
            if (filter.startsWith('count:')) return crossed === Number(filter.slice(6));
            return index.boundariesAfter.slice(hit.section, hit.endSection).some(boundary => boundary.normalizedType === filter);
    }
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
