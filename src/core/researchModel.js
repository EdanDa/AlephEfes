import { computeCoreResults } from './analysisCore.js';

export function centerPositions(length) {
    if (!length) return [];
    return length % 2 ? [(length + 1) / 2] : [length / 2, length / 2 + 1];
}

export function makeResearchUnit(text, mode, metadata = {}) {
    const result = computeCoreResults(text, mode);
    let letterPosition = 0;
    const tokens = result.lines.flatMap((line) => line.words).map((word, index) => {
        const letterStart = letterPosition + 1;
        letterPosition += [...word.word].length;
        return { ...word, position: index + 1, letterStart, letterEnd: letterPosition };
    });
    return { ...metadata, text, mode, tokens, wordCount: tokens.length, distinctWordCount: result.allWords.length, letterCount: letterPosition,
        wordCenter: centerPositions(tokens.length), letterCenter: centerPositions(letterPosition), totals: result.grandTotals };
}

export function manualResearchUnits(text, mode) {
    return text.split('\n').flatMap((line, index) => line.trim() ? [makeResearchUnit(line, mode, { id: `manual-line-${index + 1}`, lineNumber: index + 1, label: `שורה ${index + 1}`, source: null })] : []);
}

// Use the same tokenizer as analysis. A query must be exactly one word.
export function exactResearchWord(raw) {
    const words = computeCoreResults(raw, 'aleph-zero').lines.flatMap((line) => line.words);
    return words.length === 1 ? words[0].word : '';
}

export function passageOccurrences(units, word) {
    return units.flatMap((unit, unitIndex) => unit.tokens.filter((token) => token.word === word).map((token) => ({ unitIndex, sectionId: unit.id, position: token.position })));
}

export function locatorText(locator) {
    return locator ? `${locator.subBook || locator.book24 || ''} ${locator.chapter}:${locator.verse}` : '';
}

export function boundaryText(boundary, initial = false) {
    if (!boundary) return initial ? 'תחילת הספר' : 'סוף הספר';
    const types = { petuhah: 'פתוחה', setumah: 'סתומה', 'shirah-setumah': 'גבול שירה', 'masoretic-book-part-spacing': 'ריווח חלק ספר' };
    return `${types[boundary.normalizedType] || boundary.normalizedType} · ${boundary.upstreamMarker || ''} · ${locatorText(boundary.location)} · ${['inside-verse', 'within-verse'].includes(boundary.position) ? 'בתוך פסוק' : boundary.position === 'before-verse' ? 'לפני פסוק' : boundary.position || ''}`;
}
