const BASE_LETTER_VALUES = Object.freeze({
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 11, 'ל': 12, 'מ': 13, 'נ': 14, 'ס': 15, 'ע': 16, 'פ': 17, 'צ': 18, 'ק': 19,
    'ר': 20, 'ש': 21, 'ת': 22,
});

const HEB_FINALS = Object.freeze({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' });
const HYPHEN_RE = /[־–—\-]/g;
const HEB_LETTER_RE = /[\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5]/g;
const HEB_MARKS_RE = /[\u0591-\u05BD\u05BF-\u05C7]/g;
const INPUT_PUNCT_TO_SPACE_RE = /[^\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5\n ]+/g;
const INPUT_MULTI_SPACE_RE = / {2,}/g;

const EN_TO_HE_MAP = Object.freeze({
    q: '/', w: "'", e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ',
    '[': ']', ']': '[', a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך',
    z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ',
});

const LAYER_COLORS = Object.freeze({
    U: {
        light: 'hsl(210, 70%, 85%)',
        dark: 'hsl(210, 30%, 25%)',
        dot: 'hsl(210, 100%, 40%)',
        strokeLight: '#0284c7',
        strokeDark: '#38bdf8',
    },
    T: {
        light: 'hsl(140, 60%, 85%)',
        dark: 'hsl(140, 30%, 22%)',
        dot: 'hsl(140, 100%, 30%)',
        strokeLight: '#059669',
        strokeDark: '#34d399',
    },
    H: {
        light: 'hsl(280, 65%, 88%)',
        dark: 'hsl(280, 25%, 28%)',
        dot: 'hsl(280, 100%, 45%)',
        strokeLight: '#9333ea',
        strokeDark: '#c084fc',
    },
});

const LAYER_PRIORITY = Object.freeze(['H', 'T', 'U']);
const COLOR_PALETTE = Object.freeze({
    red: { light: 'text-red-600', dark: 'dark:text-red-400', name: 'אדום', bg: 'bg-red-500' },
    yellow: { light: 'text-yellow-600', dark: 'dark:text-yellow-300', name: 'צהוב', bg: 'bg-yellow-400' },
    emerald: { light: 'text-emerald-600', dark: 'dark:text-emerald-400', name: 'אזמרגד', bg: 'bg-emerald-500' },
    sky: { light: 'text-sky-600', dark: 'dark:text-sky-400', name: 'שמיים', bg: 'bg-sky-500' },
    pink: { light: 'text-pink-600', dark: 'dark:text-pink-400', name: 'ורוד', bg: 'bg-pink-500' },
    purple: { light: 'text-purple-600', dark: 'dark:text-purple-400', name: 'סגול', bg: 'bg-purple-500' },
    orange: { light: 'text-orange-600', dark: 'dark:text-orange-400', name: 'כתום', bg: 'bg-orange-500' },
});
const PRIME_COLOR_HEX = Object.freeze({
    yellow: '#EAB308',
    red: '#EF4444',
    emerald: '#10B981',
    sky: '#0EA5E9',
    pink: '#EC4899',
    purple: '#A855F7',
    orange: '#F97316',
});
const DEFAULT_DR_ORDER = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const MAX_WORD_CACHE_SIZE = 50_000;
const MAX_LETTER_DETAILS_CACHE_SIZE = 100_000;

const MAX_SIEVE_SIZE = 20_000_000;
let sieveArr = new Uint8Array(256);
sieveArr[0] = 0;
sieveArr[1] = 0;
for (let i = 2; i < 256; i += 1) sieveArr[i] = 1;
for (let p = 2; p * p < 256; p += 1) {
    if (!sieveArr[p]) continue;
    for (let i = p * p; i < 256; i += p) sieveArr[i] = 0;
}

function growSieveTo(limit) {
    if (limit < sieveArr.length) return;
    if (limit > MAX_SIEVE_SIZE) return;
    const target = Math.min(Math.max(limit, (sieveArr.length - 1) * 2), MAX_SIEVE_SIZE);
    const oldLen = sieveArr.length;
    const next = new Uint8Array(target + 1);
    next.set(sieveArr);
    next.fill(1, Math.max(2, oldLen));
    const sqrtTarget = Math.sqrt(target);
    for (let p = 2; p <= sqrtTarget; p += 1) {
        if (next[p] === 0) continue;
        let start = p * p;
        if (start < oldLen) start = Math.ceil(oldLen / p) * p;
        for (let i = start; i <= target; i += p) next[i] = 0;
    }
    sieveArr = next;
}

function isPrimeExpand(num) {
    if (num < 2) return false;
    if (num > MAX_SIEVE_SIZE) {
        if (num % 2 === 0) return false;
        const sqrt = Math.sqrt(num);
        for (let i = 3; i <= sqrt; i += 2) {
            if (num % i === 0) return false;
        }
        return true;
    }
    if (num >= sieveArr.length) growSieveTo(num);
    return sieveArr[num] === 1;
}

const getDigitalRoot = (n) => (n === 0 ? 0 : 1 + ((n - 1) % 9));

function layersMatching(hovered, current) {
    if (!hovered || !current) return [];
    const matches = [];

    const hU = hovered.units;
    const hT = hovered.tens;
    const hH = hovered.hundreds;
    const cU = current.units;
    const cT = current.tens;
    const cH = current.hundreds;

    if (cU === hU || cU === hT || cU === hH) matches.push('U');
    if (cT === hU || cT === hT || cT === hH) matches.push('T');
    if (cH === hU || cH === hT || cH === hH) matches.push('H');

    return matches;
}

const strongestLayer = (matchLayers) => LAYER_PRIORITY.find((layer) => matchLayers.includes(layer)) || null;

const LAYERS_U = Object.freeze(['U']);
const LAYERS_UT = Object.freeze(['U', 'T']);
const LAYERS_UTH = Object.freeze(['U', 'T', 'H']);

function availableLayers(wordData) {
    if (wordData.tens === wordData.units) return LAYERS_U;
    if (wordData.hundreds === wordData.tens) return LAYERS_UT;
    return LAYERS_UTH;
}

function topConnectionLayer(source, target) {
    if (!source || !target) return null;
    const hits = layersMatching(source, target);
    if (!hits.length) return null;

    const sU = source.units;
    const sT = source.tens;
    const sH = source.hundreds;
    const tU = target.units;
    const tT = target.tens;
    const tH = target.hundreds;

    const sourceLayers = [];
    if (sH === tU || sH === tT || sH === tH) sourceLayers.push('H');
    if (sT === tU || sT === tT || sT === tH) sourceLayers.push('T');
    if (sU === tU || sU === tT || sU === tH) sourceLayers.push('U');

    return strongestLayer(sourceLayers);
}

function buildLetterTable(mode) {
    const table = new Map();
    const letters = Object.keys(BASE_LETTER_VALUES);
    for (const ch of letters) {
        const m = BASE_LETTER_VALUES[ch];
        const n = m - 1;
        let u;
        let t;
        let h;
        if (mode === 'aleph-zero') {
            u = n;
            t = n <= 9 ? n : 10 * (n - 9);
            if (n <= 10) h = n;
            else if (n <= 19) h = 10 * (n - 9);
            else h = 100 * (n - 18);
        } else {
            u = m;
            if (m <= 10) {
                t = m;
                h = m;
            } else {
                t = (m - 9) * 10;
                h = m <= 19 ? t : (m - 18) * 100;
            }
        }
        table.set(ch, { u, t, h });
    }
    for (const [finalForm, baseCh] of Object.entries(HEB_FINALS)) {
        const rec = table.get(baseCh);
        if (rec) table.set(finalForm, { ...rec });
    }
    return table;
}

const letterDetailsCache = new Map();
function getLetterDetails(word, letterTable) {
    const modeKey = letterTable.get('א')?.u === 0 ? '0' : '1';
    const key = `${modeKey}|${word}`;
    const hit = letterDetailsCache.get(key);
    if (hit) return hit;

    const details = [];
    for (const ch of word) {
        const rec = letterTable.get(ch);
        if (rec) details.push({ char: ch, value: rec.u });
    }
    letterDetailsCache.set(key, details);
    if (letterDetailsCache.size > MAX_LETTER_DETAILS_CACHE_SIZE) {
        const oldestKey = letterDetailsCache.keys().next().value;
        if (oldestKey) letterDetailsCache.delete(oldestKey);
    }
    return details;
}

function cleanHebrewToken(raw) {
    const s = (raw.normalize ? raw.normalize('NFKD') : raw).replace(HEB_MARKS_RE, '');
    const letters = s.match(HEB_LETTER_RE);
    return letters ? letters.join('') : '';
}

function forceHebrewInput(raw) {
    const withoutMarks = (raw.normalize ? raw.normalize('NFKD') : raw).replace(HEB_MARKS_RE, '');
    const mapped = Array.from(withoutMarks)
        .map((ch) => {
            const mappedChar = EN_TO_HE_MAP[ch.toLowerCase()];
            return mappedChar || ch;
        })
        .join('');
    return mapped
        .replace(/\r/g, '')
        .replace(INPUT_PUNCT_TO_SPACE_RE, ' ')
        .replace(INPUT_MULTI_SPACE_RE, ' ')
        .replace(/\n[ ]+/g, '\n');
}

function makeWordComputer(letterTable) {
    const cache = new Map();
    const touchCacheEntry = (key, value) => {
        cache.delete(key);
        cache.set(key, value);
    };

    const pruneCacheIfNeeded = () => {
        if (cache.size <= MAX_WORD_CACHE_SIZE) return;
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
    };

    const computer = (rawWord) => {
        const cleaned = cleanHebrewToken(rawWord);
        if (!cleaned) return null;
        const cached = cache.get(cleaned);
        if (cached !== undefined) {
            touchCacheEntry(cleaned, cached);
            return cached;
        }

        let units = 0;
        let tens = 0;
        let hundreds = 0;
        let builtWord = '';
        let maxU = -Infinity;

        for (const ch of cleaned) {
            const rec = letterTable.get(ch);
            if (!rec) continue;
            builtWord += ch;
            units += rec.u;
            tens += rec.t;
            hundreds += rec.h;
            if (rec.u > maxU) maxU = rec.u;
        }

        if (builtWord.length === 0) {
            touchCacheEntry(cleaned, null);
            pruneCacheIfNeeded();
            return null;
        }

        const dr = getDigitalRoot(units);
        const maxLayer = maxU > 19 ? 'H' : maxU > 10 ? 'T' : 'U';
        const res = {
            word: builtWord,
            units,
            tens,
            hundreds,
            dr,
            isPrimeU: isPrimeExpand(units),
            isPrimeT: tens !== units && isPrimeExpand(tens),
            isPrimeH: hundreds !== tens && isPrimeExpand(hundreds),
            maxLayer,
        };
        touchCacheEntry(cleaned, res);
        pruneCacheIfNeeded();
        return res;
    };

    computer.clear = () => cache.clear();
    return computer;
}

const memoizedComputers = {
    'aleph-zero': makeWordComputer(buildLetterTable('aleph-zero')),
    'aleph-one': makeWordComputer(buildLetterTable('aleph-one')),
};

function computeCoreResults(text, mode) {
    letterDetailsCache.clear();

    const lines = text.split('\n').filter((line) => line.trim().length);
    const computeWord = memoizedComputers[mode];
    const allWordsMap = new Map();
    const primeSummary = [];
    const calculatedLines = [];
    const wordCounts = new Map();
    const drDistribution = new Uint32Array(10);

    let grandU = 0;
    let grandT = 0;
    let grandH = 0;
    let totalWordCount = 0;

    for (let li = 0; li < lines.length; li += 1) {
        const lineWithSpacesForHyphens = lines[li].replace(HYPHEN_RE, ' ');
        const words = lineWithSpacesForHyphens.split(/\s+/).filter(Boolean);
        let lineU = 0;
        let lineT = 0;
        let lineH = 0;
        const calcWords = [];
        let lineMaxLayer = 'U';

        for (const raw of words) {
            const wd = computeWord(raw);
            if (!wd) continue;

            totalWordCount += 1;
            calcWords.push(wd);
            lineU += wd.units;
            lineT += wd.tens;
            lineH += wd.hundreds;

            if (wd.maxLayer === 'H') lineMaxLayer = 'H';
            else if (wd.maxLayer === 'T' && lineMaxLayer !== 'H') lineMaxLayer = 'T';

            if (!allWordsMap.has(wd.word)) allWordsMap.set(wd.word, wd);
            drDistribution[wd.dr] += 1;
            wordCounts.set(wd.word, (wordCounts.get(wd.word) || 0) + 1);
        }

        grandU += lineU;
        grandT += lineT;
        grandH += lineH;
        growSieveTo(Math.max(lineU, lineT, lineH));

        const isPrimeLineU = isPrimeExpand(lineU);
        const isPrimeLineT = lineT !== lineU && isPrimeExpand(lineT);
        const isPrimeLineH = lineH !== lineT && isPrimeExpand(lineH);

        const linePrimes = {};
        if (isPrimeLineU) {
            if (!linePrimes[lineU]) linePrimes[lineU] = [];
            linePrimes[lineU].push('אחדות');
        }
        if (isPrimeLineT) {
            if (!linePrimes[lineT]) linePrimes[lineT] = [];
            linePrimes[lineT].push('עשרות');
        }
        if (isPrimeLineH) {
            if (!linePrimes[lineH]) linePrimes[lineH] = [];
            linePrimes[lineH].push('מאות');
        }

        for (const [value, layers] of Object.entries(linePrimes)) {
            primeSummary.push({ line: li + 1, value: Number.parseInt(value, 10), layers });
        }

        calculatedLines.push({
            lineText: lines[li],
            words: calcWords,
            totals: { units: lineU, tens: lineT, hundreds: lineH },
            totalsDR: getDigitalRoot(lineU),
            isPrimeTotals: { U: isPrimeLineU, T: isPrimeLineT, H: isPrimeLineH },
            lineMaxLayer,
        });
    }

    growSieveTo(Math.max(grandU, grandT, grandH));
    const grandTotals = {
        units: grandU,
        tens: grandT,
        hundreds: grandH,
        dr: getDigitalRoot(grandU),
        isPrime: {
            U: isPrimeExpand(grandU),
            T: isPrimeExpand(grandT),
            H: isPrimeExpand(grandH),
        },
    };

    return {
        lines: calculatedLines,
        grandTotals,
        primeSummary,
        allWords: Array.from(allWordsMap.values()),
        wordDataMap: allWordsMap,
        drDistribution,
        totalWordCount,
        wordCounts,
    };
}

function isValueVisible(layer, isPrime, filters) {
    if (!filters[layer]) return false;
    if (filters.Prime && !isPrime) return false;
    return true;
}

function getWordValues(wordData) {
    const { hundreds, tens, units, isPrimeH, isPrimeT, isPrimeU } = wordData;
    const out = [];
    if (hundreds !== tens) out.push({ value: hundreds, isPrime: isPrimeH, layer: 'H' });
    if (tens !== units) out.push({ value: tens, isPrime: isPrimeT, layer: 'T' });
    out.push({ value: units, isPrime: isPrimeU, layer: 'U' });
    return out;
}

function isWordVisible(word, filters) {
    const values = getWordValues(word);
    return values.some((v) => isValueVisible(v.layer, v.isPrime, filters));
}

export {
    BASE_LETTER_VALUES,
    COLOR_PALETTE,
    DEFAULT_DR_ORDER,
    HEB_FINALS,
    LAYER_COLORS,
    PRIME_COLOR_HEX,
    availableLayers,
    buildLetterTable,
    computeCoreResults,
    forceHebrewInput,
    getLetterDetails,
    getWordValues,
    isValueVisible,
    isWordVisible,
    layersMatching,
    strongestLayer,
    topConnectionLayer,
};
