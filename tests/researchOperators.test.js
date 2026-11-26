import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileFormula, evaluateFormula } from '../src/core/operatorFormula.js';
import { operatorCatalog } from '../src/core/operatorCatalog.js';
import { makeResearchUnit } from '../src/core/researchModel.js';
import { buildResearchNote } from '../src/core/researchNote.js';
import census from '../src/core/researchOperatorCensus.json' with { type: 'json' };

const corpus = file => JSON.parse(readFileSync(`public/corpus/${file}`, 'utf8'));
const filters = { U: false, T: false, H: false, Prime: true };
function run(unit, formula, domain = 'word', word = '', options = {}) {
    return evaluateFormula(unit, { domain, word }, compileFormula(formula, domain), options);
}

test('authored arithmetic, parentheses, comparisons, logic, spelling and independent operands', () => {
    const unit = makeResearchUnit('ג א ג', 'aleph-one');
    const positions = formula => run(unit, formula).hits.map(h => h.position);
    assert.deepEqual(positions('(U + 2 * pos) % 4 = 1 and pos > 2'), [3]);
    assert.deepEqual(positions('U - pos = 0 or (len + 1) * 3 <= W'), [3]);
    assert.deepEqual(positions('form = "ג" and freq = 2 and occ != 2'), [1]);
    assert.deepEqual(positions('sumU / 7 = 1 and -pos < -2'), [3]);
    assert.deepEqual(positions('U / 0 != W'), []);
    assert.deepEqual(positions('(U % 0 + 3) >= 0'), []);
    for (const source of ['U + W', 'missing = 3', 'b.pos = 1', 'U = "א"', '1 < pos < 3', 'U = W)', 'U +', 'U > 0 xyz', '1 === 1', 'constructor = U']) {
        assert.throws(() => compileFormula(source), undefined, source);
    }
});

test('pair measurements identify the two real words and exclude the odd middle self-pair', () => {
    const unit = makeResearchUnit('ג ב א ב ג', 'aleph-zero');
    const pairs = (formula, domain) => run(unit, formula, domain).hits.map(h => [h.position, h.endPosition]);
    assert.deepEqual(pairs('form = b.form and gap > 1', 'mirror'), [[1, 5], [2, 4]]);
    assert.deepEqual(pairs('U = b.U + 1', 'adjacent'), [[1, 2], [2, 3]]);
    assert.deepEqual(pairs('gap = 2 * U', 'repeat'), [[1, 5], [2, 4]]);
    assert.deepEqual(run(unit, 'form = b.form', 'repeat', 'ב').eligible, 1);
});

test('whole-unit rules count occurrences independently and retain their actual word positions', () => {
    const unit = makeResearchUnit('ב אב', 'aleph-one');
    const result = run(unit, 'count(U = W) = 1 and count(U = L) = 1', 'unit');
    assert.equal(result.eligible, 1);
    assert.equal(result.cases, 1);
    assert.deepEqual(result.hits[0].positions, [1, 2]);
    assert.equal(run(unit, 'U = W and U = L').cases, 0);
    assert.equal(run(unit, 'count(form = "ת") = 0', 'unit').cases, 1);
    for (const source of ['U = W', 'gap = W', 'count(U) > 0', 'count(count(U = W) > 0) > 0', 'count(b.U = W) > 0']) {
        assert.throws(() => compileFormula(source, 'unit'), undefined, source);
    }
    assert.throws(() => compileFormula('count(U = W) > 0', 'word'));
});

test('exact shuffled-order expectations agree with direct enumeration for custom formulas', () => {
    const units = ['ב ב א', 'ב א ב', 'א ב ב'].map(text => makeResearchUnit(text, 'aleph-one'));
    for (const [domain, formula] of [['word', 'U + pos > W and pos % 2 != 0'], ['repeat', 'gap * 2 = U']]) {
        const rows = units.map(u => run(u, formula, domain, 'ב', { limit: 1, compareOrder: true }));
        const mean = rows.reduce((n, row) => n + row.cases, 0) / rows.length;
        for (const row of rows) assert.ok(Math.abs(row.expected - mean) < 1e-10);
    }
});

test('Esther evidence records the user formula and witnesses only when requested', () => {
    const section = corpus('books/esther.json').sections[32];
    const unit = makeResearchUnit(section.calculationText, 'aleph-zero', { lineNumber: 1, id: 'manual-line-1' });
    const query = { formula: 'U = W and freq = 1', domain: 'word', scope: 'passage', mode: unit.mode, word: 'נפשם' };
    const { hits, cases, eligible } = run(unit, query.formula, query.domain, query.word);
    assert.equal(cases, 1); assert.equal(hits[0].position, 48);
    const plain = buildResearchNote({ unit, filters, word: 'אסתר' });
    assert.ok(!plain.includes(query.formula));
    const selected = buildResearchNote({ unit, filters, word: query.word, operatorEvidence: { hit: hits[0], result: {
        query, cases, eligible, units: 1, groups: [{}], words: 61,
    } } });
    assert.ok(selected.includes(query.formula)); assert.ok(selected.includes('מילה 48 · U=61 · W=61 · freq=1'));
});

test('every catalog formula reproduces the independent census in both alphabets', () => {
    const manifest = corpus('manifest.json');
    assert.equal(census.corpusHash, manifest.contentHash);
    for (const mode of Object.keys(census.modes)) {
        assert.deepEqual(operatorCatalog.map(rule => rule.id).sort(), Object.keys(census.modes[mode]).sort());
        const plans = operatorCatalog.map(({id, domain, formula}) => ({ id, domain, compiled: compileFormula(formula, domain), cases: 0, units: 0 }));
        let units = 0, words = 0;
        for (const { file } of manifest.divisions.flatMap(d => d.books)) {
            for (const source of corpus(file).sections) {
                const unit = makeResearchUnit(source.calculationText, mode, { source }); units++; words += unit.wordCount;
                for (const plan of plans) {
                    const row = evaluateFormula(unit, plan, plan.compiled, { limit: 0 });
                    plan.cases += row.cases;
                    if (row.cases) plan.units++;
                }
            }
        }
        assert.deepEqual([units, words], [census.units, census.words]);
        for (const plan of plans) {
            const reference = census.modes[mode][plan.id];
            assert.deepEqual([plan.cases, plan.units], [reference.cases, reference.units], plan.id);
        }
    }
});
