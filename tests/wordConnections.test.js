import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleValuesForWord, buildWordConnectionIndex, computeConnectedWordsSet } from '../src/core/wordConnections.js';

const wordA = {
    word: 'אב',
    units: 5,
    tens: 14,
    hundreds: 14,
    isPrimeU: true,
    isPrimeT: false,
    isPrimeH: false,
};

const wordB = {
    word: 'גד',
    units: 14,
    tens: 14,
    hundreds: 104,
    isPrimeU: false,
    isPrimeT: false,
    isPrimeH: true,
};

const wordC = {
    word: 'הו',
    units: 20,
    tens: 20,
    hundreds: 20,
    isPrimeU: true,
    isPrimeT: false,
    isPrimeH: false,
};

test('getVisibleValuesForWord respects layer and Prime filters', () => {
    assert.deepEqual(getVisibleValuesForWord(wordA, { U: true, T: true, H: true, Prime: false }), [14, 5]);
    assert.deepEqual(getVisibleValuesForWord(wordA, { U: true, T: true, H: true, Prime: true }), [5]);
    assert.deepEqual(getVisibleValuesForWord(wordB, { U: false, T: false, H: true, Prime: true }), [104]);
    assert.deepEqual(getVisibleValuesForWord(wordB, { U: false, T: true, H: false, Prime: false }), []);
});

test('buildWordConnectionIndex builds lookup maps for visible values', () => {
    const { wordsByVisibleValue, visibleValuesByWord } = buildWordConnectionIndex([wordA, wordB, wordC], { U: true, T: true, H: true, Prime: false });

    assert.deepEqual(visibleValuesByWord.get('אב'), [14, 5]);
    assert.deepEqual(visibleValuesByWord.get('גד'), [104, 14]);
    assert.deepEqual(visibleValuesByWord.get('הו'), [20]);

    assert.deepEqual(wordsByVisibleValue.get(14), ['אב', 'גד']);
    assert.deepEqual(wordsByVisibleValue.get(5), ['אב']);
});

test('computeConnectedWordsSet returns words sharing visible values with active word', () => {
    const { wordsByVisibleValue, visibleValuesByWord } = buildWordConnectionIndex([wordA, wordB, wordC], { U: true, T: true, H: true, Prime: false });
    const connected = computeConnectedWordsSet(wordA, visibleValuesByWord, wordsByVisibleValue);

    assert.equal(connected.has('גד'), true);
    assert.equal(connected.has('הו'), false);
    assert.equal(connected.has('אב'), false);
});
