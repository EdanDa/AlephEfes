import { t } from '../i18n/locale.js';
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
    return text.split('\n').flatMap((line, index) => line.trim() ? [makeResearchUnit(line, mode, { id: `manual-line-${index + 1}`, lineNumber: index + 1, label: t`שורה ${index + 1}`, source: null })] : []);
}

export function researchUnitLabel(unit) {
    if (unit.source?.ordinal && unit.source.bookName) return t`${t(unit.source.bookName)} · פרשיה ${unit.source.ordinal}`;
    if (unit.lineNumber) return t`שורה ${unit.lineNumber}`;
    return unit.label;
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
    if (!locator) return '';
    const book = locator.subBook || (locator.book24 || '').replace(/^(ספר|מגילת)\s+/u, '');
    return `${t(book)} ${locator.chapter}:${locator.verse}`;
}

export const boundaryTypeNames = {
    petuhah: 'פתוחה',
    setumah: 'סתומה',
    'shirah-setumah-like': 'גבול שירה דמוי סתומה',
    'masoretic-book-part-spacing': 'ריווח חלק ספר',
};

export function boundaryText(boundary, initial = false) {
    if (!boundary) return initial ? t('תחילת הספר') : t('סוף הספר');
    return `${t(boundaryTypeNames[boundary.normalizedType] || boundary.normalizedType)} · ${boundary.upstreamMarker || ''} · ${locatorText(boundary.location)} · ${['inside-verse', 'within-verse'].includes(boundary.position) ? t('בתוך פסוק') : boundary.position === 'before-verse' ? t('לפני פסוק') : boundary.position || ''}`;
}
