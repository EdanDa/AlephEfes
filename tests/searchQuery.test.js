import assert from 'node:assert/strict';
import test from 'node:test';
import { groupMatchesWord, matchesSearchQuery, parseSearchGroups } from '../src/core/searchQuery.js';

const filtersAll = { U: true, T: true, H: true, Prime: false };
const filtersOnlyUnits = { U: true, T: false, H: false, Prime: false };

const sampleWord = {
    word: 'טסט',
    units: 59,
    tens: 365,
    hundreds: 430,
};

test('parseSearchGroups splits by space and plus', () => {
    assert.deepEqual(parseSearchGroups('59+365 52+430'), [['59', '365'], ['52', '430']]);
});

test('groupMatchesWord treats plus-separated numeric query as exact conjugation', () => {
    assert.equal(groupMatchesWord(sampleWord, ['59', '365'], filtersAll), false);
    assert.equal(groupMatchesWord(sampleWord, ['59', '365', '430'], filtersAll), true);
});

test('matchesSearchQuery uses OR across space-separated groups', () => {
    assert.equal(matchesSearchQuery(sampleWord, '52+430 59+365+430', filtersAll), true);
    assert.equal(matchesSearchQuery(sampleWord, '52+430 100+200', filtersAll), false);
});

test('numeric matching respects active layer filters', () => {
    assert.equal(matchesSearchQuery(sampleWord, '365', filtersOnlyUnits), false);
    assert.equal(matchesSearchQuery(sampleWord, '59', filtersOnlyUnits), true);
});
