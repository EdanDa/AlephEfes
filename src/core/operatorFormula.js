import { t } from '../i18n/locale.js';

// Identifiers are stable across interface languages and in exported notes.
export const wordMeasures = {
    U: 'ערך היחידות', T: 'ערך העשרות', H: 'ערך המאות', DR: 'שורש דיגיטלי',
    pos: 'מיקום המילה מ־1', len: 'אורך המילה באותיות', start: 'מיקום אות הפתיחה', end: 'מיקום אות הסיום',
    freq: 'מספר מופעי הכתיב ביחידה', occ: 'מספר המופע של הכתיב', form: 'כתיב המילה',
    prevGap: 'מרחק מהמופע הקודם של אותו כתיב', nextGap: 'מרחק למופע הבא של אותו כתיב',
    prefixU: 'יחידות מתחילת היחידה עד המילה', prefixT: 'עשרות מתחילת היחידה עד המילה', prefixH: 'מאות מתחילת היחידה עד המילה',
    suffixU: 'יחידות מהמילה עד סוף היחידה', suffixT: 'עשרות מהמילה עד סוף היחידה', suffixH: 'מאות מהמילה עד סוף היחידה',
};
export const unitMeasures = { W: 'מספר מילים ביחידה', L: 'מספר אותיות ביחידה', forms: 'מספר כתיבים שונים', section: 'מספר הפרשיה בספר',
    sumU: 'סכום היחידות בפרשיה או בשורה', sumT: 'סכום העשרות בפרשיה או בשורה', sumH: 'סכום המאות בפרשיה או בשורה' };
export const pairMeasures = { gap: 'הפרש מיקומי המילים' };
export const domains = { word: 'מילה בודדת', adjacent: 'זוג מילים סמוכות', repeat: 'זוג מופעים של אותו כתיב', mirror: 'זוג מקומות סימטריים', unit: 'יחידה שלמה' };
const operations = {
    or: [1, 'boolean', (a, b) => a || b], and: [2, 'boolean', (a, b) => a && b],
    '=': [3, 'compare', (a, b) => a === b], '!=': [3, 'compare', (a, b) => a !== b],
    '<': [3, 'order', (a, b) => a < b], '<=': [3, 'order', (a, b) => a <= b],
    '>': [3, 'order', (a, b) => a > b], '>=': [3, 'order', (a, b) => a >= b],
    '+': [4, 'number', (a, b) => a + b], '-': [4, 'number', (a, b) => a - b],
    '*': [5, 'number', (a, b) => a * b], '/': [5, 'number', (a, b) => a / b],
    '%': [5, 'number', (a, b) => a % b],
};

// Parse the whole expression once. Only our published fields and operations are executable.
export function compileFormula(source, domain = 'word') {
    if (source.length > 512) throw new Error(t('אורך הנוסחה המרבי הוא 512 תווים.'));
    const pattern = /\s+|\d+(?:\.\d+)?|"[א-ת]+"|'[א-ת]+'|(?:b\.)?[A-Za-z]+|!=|<=|>=|[()=<>+*/%-]/gy;
    const tokens = [];
    const fields = new Set();
    const aggregates = [];
    let insideCount = false;
    const paired = domain === 'adjacent' || domain === 'repeat' || domain === 'mirror';
    let index = 0;
    const invalid = (at) => new Error(t`בדקו את הנוסחה בתו ${at + 1}.`);
    for (let at = 0; at < source.length;) {
        pattern.lastIndex = at;
        const match = pattern.exec(source);
        if (!match) throw invalid(at);
        if (match[0].trim()) tokens.push({ text: match[0], at });
        at = pattern.lastIndex;
    }
    function atom() {
        const token = tokens[index++];
        if (!token) throw invalid(source.length);
        const key = token.text;
        if (key === 'count') {
            if (domain !== 'unit' || insideCount || tokens[index++]?.text !== '(') throw invalid(token.at);
            insideCount = true;
            const predicate = expression(1);
            insideCount = false;
            const end = tokens[index++];
            if (predicate.type !== 'boolean' || end?.text !== ')') throw invalid(end?.at ?? source.length);
            const slot = aggregates.length;
            aggregates.push({ label: source.slice(token.at, end.at + 1), matches: predicate.read });
            return { type: 'number', read: ctx => ctx.counts[slot] };
        }
        if (key === '(') {
            const node = expression(1);
            if (tokens[index++]?.text !== ')') throw invalid(tokens[index - 1]?.at ?? source.length);
            return node;
        }
        if (key === '-') {
            const child = atom();
            if (child.type !== 'number') throw invalid(token.at);
            return { type: 'number', read: ctx => -child.read(ctx) };
        }
        if (/^\d/.test(key)) return { type: 'number', read: () => Number(key) };
        if (/^['"]/.test(key)) return { type: 'text', read: () => key.slice(1, -1) };
        const second = key.startsWith('b.');
        const name = second ? key.slice(2) : key;
        const perUnit = Object.hasOwn(unitMeasures, name);
        if (key === 'gap' && paired) {
            fields.add(key);
            return { type: 'number', read: ctx => ctx.b.pos - ctx.a.pos };
        }
        if ((!perUnit && !Object.hasOwn(wordMeasures, name)) || (second && (!paired || perUnit)) ||
            (domain === 'unit' && !perUnit && !insideCount)) throw invalid(token.at);
        fields.add(key);
        const part = perUnit ? 'unit' : second ? 'b' : 'a';
        return { type: name === 'form' ? 'text' : 'number', read: ctx => ctx[part][name] };
    }
    function expression(minimum) {
        let node = atom();
        while (index < tokens.length) {
            const token = tokens[index];
            if (!Object.hasOwn(operations, token.text)) break;
            const [priority, kind, calculate] = operations[token.text];
            if (priority < minimum) break;
            index++;
            const left = node, right = expression(priority + 1);
            const valid = kind === 'compare' ? left.type === right.type && left.type !== 'boolean'
                : left.type === (kind === 'boolean' ? 'boolean' : 'number') && left.type === right.type;
            if (!valid) throw invalid(token.at);
            node = { type: kind === 'number' ? 'number' : 'boolean', read: ctx => {
                const a = left.read(ctx), b = right.read(ctx);
                if (left.type === 'number' && (!Number.isFinite(a) || !Number.isFinite(b))) return kind === 'number' ? NaN : false;
                return calculate(a, b);
            } };
        }
        return node;
    }
    const root = expression(1);
    if (index !== tokens.length) throw invalid(tokens[index].at);
    if (root.type !== 'boolean') throw new Error(t('השלימו השוואה בין שני ביטויים.'));
    const names = [...fields];
    const positionsDependent = names.filter(key => /^(?:pos|start|end|occ|gap|prevGap|nextGap|(?:prefix|suffix)[UTH])$/.test(key.replace(/^b\./, '')));
    const shuffle = (domain === 'word' && positionsDependent.includes('pos') && positionsDependent.every(key => key === 'pos')) ||
        (domain === 'repeat' && positionsDependent.includes('gap') && positionsDependent.every(key => key === 'gap'));
    return { matches: root.read, fields: names, aggregates, shuffle };
}

export function evaluateFormula(unit, query, compiled, { limit = Infinity, compareOrder = false } = {}) {
    const counts = new Map(), positions = new Map();
    for (const token of unit.tokens) {
        if (!positions.has(token.word)) positions.set(token.word, []);
        positions.get(token.word).push(token.position);
    }
    const words = unit.tokens.map(token => {
        const occ = (counts.get(token.word) || 0) + 1;
        counts.set(token.word, occ);
        return { U: token.units, T: token.tens, H: token.hundreds, DR: token.dr, pos: token.position,
            len: token.word.length, start: token.letterStart, end: token.letterEnd, freq: positions.get(token.word).length, occ, form: token.word };
    });
    const measures = { W: words.length, L: unit.letterCount, forms: unit.distinctWordCount, section: unit.source?.ordinal ?? NaN,
        sumU: unit.totals.units, sumT: unit.totals.tens, sumH: unit.totals.hundreds };
    if (compiled.fields.some(key => /(?:prevGap|nextGap)$/.test(key))) {
        for (const word of words) {
            const occurrences = positions.get(word.form);
            word.prevGap = word.pos - occurrences[word.occ - 2];
            word.nextGap = occurrences[word.occ] - word.pos;
        }
    }
    if (compiled.fields.some(key => /(?:prefix|suffix)[UTH]$/.test(key))) {
        const prior = { U: 0, T: 0, H: 0 };
        for (const word of words) {
            for (const layer of ['U', 'T', 'H']) {
                word['suffix' + layer] = measures['sum' + layer] - prior[layer];
                prior[layer] += word[layer];
                word['prefix' + layer] = prior[layer];
            }
        }
    }
    if (query.domain === 'unit') {
        const positions = new Set();
        const counts = compiled.aggregates.map(aggregate => {
            let total = 0;
            for (const word of words) {
                if (aggregate.matches({ a: word, unit: measures })) {
                    total++;
                    if (limit === Infinity) positions.add(word.pos);
                }
            }
            return total;
        });
        const matched = compiled.matches({ unit: measures, counts });
        const values = compiled.fields.filter(key => Object.hasOwn(measures, key)).map(key => [key, measures[key]]);
        compiled.aggregates.forEach(({ label }, i) => values.push([label, counts[i]]));
        return { eligible: 1, cases: Number(matched), expected: null,
            hits: matched && limit > 0 ? [{ domain: 'unit', values, positions: [...positions] }] : [] };
    }
    let eligible = 0, cases = 0, expected = 0;
    const hits = [];
    function visit(a, b = null) {
        eligible++;
        if (!compiled.matches({ a, b, unit: measures })) return;
        cases++;
        if (hits.length >= limit) return;
        const values = compiled.fields.map(key => [key, key === 'gap' ? b.pos - a.pos : key.startsWith('b.') ? b[key.slice(2)] : a[key] ?? measures[key]]);
        hits.push({ word: a.form, position: a.pos, endPosition: b?.pos, values });
    }
    for (const a of words) {
        if (query.word && query.word !== a.form) continue;
        if (query.domain === 'word') visit(a);
        else if (query.domain === 'adjacent' && a.pos < words.length) visit(a, words[a.pos]);
        else if (query.domain === 'mirror' && a.pos <= words.length / 2) visit(a, words[words.length - a.pos]);
        else if (query.domain === 'repeat') {
            const indices = positions.get(a.form);
            for (let k = a.occ; k < indices.length; k++) visit(a, words[indices[k] - 1]);
        }
    }
    if (compiled.shuffle && compareOrder) {
        // Each spelling is placed uniformly among positions, preserving its multiplicity.
        for (const [form, indices] of positions) {
            if (query.word && query.word !== form) continue;
            const n = words.length, m = indices.length;
            const a = { ...words[indices[0] - 1] }, b = { ...a };
            if (query.domain === 'word') {
                for (let p = 1; p <= n; p++) {
                    a.pos = p;
                    if (compiled.matches({ a, b: null, unit: measures })) expected += m / n;
                }
            } else if (m > 1) {
                a.pos = 1;
                for (let gap = 1; gap < n; gap++) {
                    b.pos = 1 + gap;
                    if (compiled.matches({ a, b, unit: measures })) expected += (n - gap) * m * (m - 1) / (n * (n - 1));
                }
            }
        }
    }
    return { hits, cases, eligible, expected: compiled.shuffle && compareOrder ? expected : null };
}
