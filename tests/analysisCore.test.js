import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildLetterTable,
    computeCoreResults,
    forceHebrewInput,
    getWordValues,
    isValueVisible,
    isWordVisible,
} from '../src/core/analysisCore.js';

test('buildLetterTable maps aleph correctly per mode', () => {
    const zero = buildLetterTable('aleph-zero');
    const one = buildLetterTable('aleph-one');

    assert.equal(zero.get('א').u, 0);
    assert.equal(one.get('א').u, 1);
    assert.deepEqual(zero.get('ך'), zero.get('כ'));
});

test('forceHebrewInput transliterates and normalizes spacing/punctuation', () => {
    const value = forceHebrewInput('abc,def---ghi');
    assert.equal(value, 'שנב גקכ עין');
});

test('computeCoreResults returns stable totals and distributions', () => {
    const results = computeCoreResults('אבג דה\nאבג', 'aleph-one');

    assert.equal(results.lines.length, 2);
    assert.equal(results.totalWordCount, 3);
    assert.equal(results.allWords.length, 2);

    const distributionTotal = results.drDistribution.reduce((sum, count) => sum + count, 0);
    assert.equal(distributionTotal, results.totalWordCount);

    assert.ok(results.grandTotals.units > 0);
    assert.ok(results.wordCounts.get('אבג') >= 2);
});

test('visibility helpers respect layer and prime toggles', () => {
    const wordData = {
        units: 11,
        tens: 20,
        hundreds: 200,
        isPrimeU: true,
        isPrimeT: false,
        isPrimeH: false,
    };

    const values = getWordValues(wordData);
    assert.equal(values.length, 3);

    const filtersAll = { U: true, T: true, H: true, Prime: false };
    const filtersPrimeOnly = { U: true, T: true, H: true, Prime: true };

    assert.equal(isValueVisible('U', true, filtersAll), true);
    assert.equal(isValueVisible('T', false, filtersPrimeOnly), false);
    assert.equal(isWordVisible(wordData, filtersPrimeOnly), true);
});
