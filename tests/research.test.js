import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeResearchUnit, manualResearchUnits, passageOccurrences, exactResearchWord, centerPositions, boundaryText } from '../src/core/researchModel.js';

for (const mode of ['aleph-zero', 'aleph-one']) {
    test(`research positions retain standalone letters, final forms and maqaf (${mode})`, () => {
        const unit = makeResearchUnit('אָב־אב ה מם ממ', mode);
        assert.deepEqual(unit.tokens.map((token) => [token.word, token.position, token.letterStart, token.letterEnd]), [
            ['אב', 1, 1, 2], ['אב', 2, 3, 4], ['ה', 3, 5, 5], ['מם', 4, 6, 7], ['ממ', 5, 8, 9],
        ]);
        assert.equal(unit.wordCount, 5); assert.equal(unit.distinctWordCount, 4); assert.equal(unit.letterCount, 9);
        assert.deepEqual(unit.wordCenter, [3]); assert.deepEqual(unit.letterCenter, [5]);
        assert.equal(unit.tokens[2].units, mode === 'aleph-zero' ? 4 : 5);
        assert.deepEqual(passageOccurrences([unit], 'אב').map((entry) => entry.position), [1, 2]);
        assert.deepEqual(passageOccurrences([unit], 'מם').map((entry) => entry.position), [4]);
    });
}
test('even centers are gaps and empty units have no center', () => {
    assert.deepEqual(centerPositions(0), []);
    const unit = makeResearchUnit('אב גד', 'aleph-zero');
    assert.deepEqual(unit.wordCenter, [1, 2]); assert.deepEqual(unit.letterCenter, [2, 3]);
});
test('exact queries reuse calculation normalization without spelling folding', () => {
    assert.equal(exactResearchWord('אָב'), 'אב'); assert.equal(exactResearchWord('ך'), 'ך');
    assert.equal(exactResearchWord('כ'), 'כ'); assert.equal(exactResearchWord('אב־אב'), '');
});
test('manual positions use original line numbers without assigning MAM metadata', () => {
    const units = manualResearchUnits('\nאב אב\n\nה', 'aleph-one');
    assert.deepEqual(units.map((unit) => [unit.id, unit.lineNumber, unit.source]), [['manual-line-2', 2, null], ['manual-line-4', 4, null]]);
    assert.equal(passageOccurrences(units, 'אב').length, 2);
});
test('genuine boundaries remain independent from verse locators', () => {
    const books = ['genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy'].map((slug) => JSON.parse(readFileSync(`public/corpus/books/${slug}.json`, 'utf8')));
    const section = books.flatMap((book) => book.sections).find((entry) => entry.boundaryAfter?.position !== 'before-verse' && entry.boundaryAfter);
    assert.ok(section);
    const unit = makeResearchUnit(section.calculationText, 'aleph-zero', { source: section });
    assert.equal(unit.source.boundaryAfter, section.boundaryAfter);
    assert.equal(unit.wordCount, section.wordCount);
    assert.match(boundaryText(section.boundaryAfter), new RegExp(section.boundaryAfter.upstreamMarker));
});
