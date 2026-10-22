export const SESSION_KEY = 'alephEfes:session';

function validSelection(selection) {
    if (!selection || typeof selection.bookSlug !== 'string' || typeof selection.bookName !== 'string') return null;
    if (!['book', 'range', 'section'].includes(selection.scope)) return null;
    const { startSectionOrdinal: start, endSectionOrdinal: end, sectionCount } = selection;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || sectionCount !== end - start + 1) return null;
    return selection;
}

export function restoreSession(defaults, storage) {
    try {
        const source = storage ?? globalThis.localStorage;
        const saved = source?.getItem(SESSION_KEY);
        if (saved) {
            const record = JSON.parse(saved);
            if ([1, 2].includes(record.version) && typeof record.text === 'string' && ['aleph-zero', 'aleph-one'].includes(record.mode)) {
                return { ...defaults, ...restorePreferences(record), text: record.text, mode: record.mode, corpusSelection: validSelection(record.corpusSelection) };
            }
        }
    } catch {
        // A malformed or inaccessible session must not prevent the app from opening.
    }
    try {
        const text = (storage ?? globalThis.localStorage)?.getItem('alephCodeText');
        return typeof text === 'string' ? { ...defaults, text } : defaults;
    } catch {
        return defaults;
    }
}

export function saveSession(state, storage) {
    try {
        const target = storage ?? globalThis.localStorage;
        target?.setItem(SESSION_KEY, JSON.stringify({
            version: 2,
            preferences: restorePreferences({ preferences: state }),
            text: state.text,
            mode: state.mode,
            corpusSelection: state.corpusSelection,
        }));
        target?.removeItem?.('alephCodeText');
    } catch {
        // Storage can be blocked or full; calculations remain usable in memory.
    }
}

function restorePreferences(record) {
    const p = record.preferences || {};
    const result = {};
    if (['clusters', 'lines', 'hot-words', 'graph', 'network'].includes(p.view)) result.view = p.view;
    if (['sm', 'md', 'lg'].includes(p.textSize)) result.textSize = p.textSize;
    if (p.filters && ['U', 'T', 'H', 'Prime'].every((key) => typeof p.filters[key] === 'boolean')) result.filters = Object.fromEntries(['U', 'T', 'H', 'Prime'].map((key) => [key, p.filters[key]]));
    return result;
}
