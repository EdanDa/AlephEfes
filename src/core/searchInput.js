const SEARCH_ALLOWED_CHARS_RE = /[^\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E50-9 +]+/g;
const HEBREW_SEARCH_CHAR_RE = /^[א-תךםןףץ]$/;
const DIGIT_RE = /^\d$/;

const EN_TO_HE_LETTER_MAP = Object.freeze({
    e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ',
    a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך',
    z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ',
});

const EN_TO_HE_PUNCT_LETTER_MAP = Object.freeze({ ';': 'ף', ',': 'ת', '.': 'ץ' });
const EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP = Object.freeze({ ':': 'ף', '<': 'ת', '>': 'ץ' });

const KEYBOARD_CODE_TO_HE_LETTER_MAP = Object.freeze({
    KeyE: 'ק', KeyR: 'ר', KeyT: 'א', KeyY: 'ט', KeyU: 'ו', KeyI: 'ן', KeyO: 'ם', KeyP: 'פ',
    KeyA: 'ש', KeyS: 'ד', KeyD: 'ג', KeyF: 'כ', KeyG: 'ע', KeyH: 'י', KeyJ: 'ח', KeyK: 'ל', KeyL: 'ך',
    KeyZ: 'ז', KeyX: 'ס', KeyC: 'ב', KeyV: 'ה', KeyB: 'נ', KeyN: 'מ', KeyM: 'צ',
    Semicolon: 'ף', Comma: 'ת', Period: 'ץ',
});

const mapCharToHebrewForSearch = (ch) => {
    if (/^[א-תךםןףץ0-9 +]$/.test(ch)) return ch;
    const lower = ch.toLowerCase();
    return EN_TO_HE_LETTER_MAP[lower]
        || EN_TO_HE_PUNCT_LETTER_MAP[ch]
        || EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[ch]
        || '';
};

function normalizeSearchToken(token = '') {
    let normalized = '';
    let mode = null;

    for (const ch of token) {
        if (DIGIT_RE.test(ch)) {
            if (mode === 'hebrew') continue;
            normalized += ch;
            mode = 'numeric';
            continue;
        }

        if (ch === '+') {
            if (mode !== 'numeric') continue;
            if (!/\d$/.test(normalized)) continue;
            if (normalized.endsWith('+')) continue;
            normalized += ch;
            continue;
        }

        if (HEBREW_SEARCH_CHAR_RE.test(ch)) {
            if (mode === 'numeric') {
                if (normalized.endsWith('+')) {
                    normalized = normalized.slice(0, -1);
                }
                continue;
            }
            normalized += ch;
            mode = 'hebrew';
        }
    }

    return normalized;
}

function normalizeSearchInput(value = '') {
    const mappedValue = Array.from(value)
        .map(mapCharToHebrewForSearch)
        .join('')
        .replace(SEARCH_ALLOWED_CHARS_RE, '');

    return mappedValue
        .split(/\s+/)
        .map(normalizeSearchToken)
        .filter(Boolean)
        .join(' ');
}

export {
    EN_TO_HE_LETTER_MAP,
    EN_TO_HE_PUNCT_LETTER_MAP,
    EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
    KEYBOARD_CODE_TO_HE_LETTER_MAP,
    normalizeSearchInput,
};
