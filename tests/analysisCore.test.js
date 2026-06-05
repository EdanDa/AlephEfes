import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildLetterTable,
    computeCoreResults,
    forceHebrewInput,
    getGroupedWordValues,
    getWordValues,
    isValueVisible,
    isWordVisible,
    availableLayers,
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

test('forceHebrewInput converts slash and non-letter separators into spaces', () => {
    const value = forceHebrewInput('חודש/ירח — אחדות…איחוד');
    assert.equal(value, 'חודש ירח אחדות איחוד');
});

test('forceHebrewInput preserves Hebrew abbreviations joined by quotes', () => {
    const value = forceHebrewInput('שם / שת\nהם יחד בש״ד 5');
    assert.equal(value, 'שם שת\nהם יחד בשד ');
});

test('computeCoreResults returns stable totals and distributions', () => {
    const results = computeCoreResults('אבג דה\nאבג', 'aleph-one');

    assert.equal(results.lines.length, 2);
    assert.equal(results.totalWordCount, 3);
    assert.equal(results.allWords.length, 2);

    const distributionTotal = results.drDistribution.reduce((sum, count) => sum + count, 0);
    assert.equal(distributionTotal, results.allWords.length);

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


test('ditto-equivalent values remain available when the source layer is hidden', () => {
    const wordData = {
        units: 5,
        tens: 5,
        hundreds: 5,
        isPrimeU: true,
        isPrimeT: true,
        isPrimeH: true,
    };

    assert.deepEqual(availableLayers(wordData), ['U', 'T', 'H']);
    assert.deepEqual(getWordValues(wordData), [
        { value: 5, isPrime: true, layer: 'H' },
        { value: 5, isPrime: true, layer: 'T' },
        { value: 5, isPrime: true, layer: 'U' },
    ]);
    assert.equal(isWordVisible(wordData, { U: false, T: true, H: false, Prime: true }), true);
});


test('getGroupedWordValues collapses duplicate visible values while preserving layer symbols', () => {
    const wordData = {
        units: 37,
        tens: 145,
        hundreds: 145,
        isPrimeU: true,
        isPrimeT: false,
        isPrimeH: false,
    };

    assert.deepEqual(getGroupedWordValues(wordData, { U: true, T: true, H: true, Prime: false }), [
        { value: 145, isPrime: false, layers: [{ layer: 'H', isPrime: false }, { layer: 'T', isPrime: false }] },
        { value: 37, isPrime: true, layers: [{ layer: 'U', isPrime: true }] },
    ]);

    assert.deepEqual(getGroupedWordValues(wordData, { U: true, T: false, H: true, Prime: false }), [
        { value: 145, isPrime: false, layers: [{ layer: 'H', isPrime: false }] },
        { value: 37, isPrime: true, layers: [{ layer: 'U', isPrime: true }] },
    ]);
});
