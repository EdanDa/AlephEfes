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
            if (record.version === 1 && typeof record.text === 'string' && ['aleph-zero', 'aleph-one'].includes(record.mode)) {
                return { ...defaults, text: record.text, mode: record.mode, corpusSelection: validSelection(record.corpusSelection) };
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
            version: 1,
            text: state.text,
            mode: state.mode,
            corpusSelection: state.corpusSelection,
        }));
        target?.removeItem?.('alephCodeText');
    } catch {
        // Storage can be blocked or full; calculations remain usable in memory.
    }
}
