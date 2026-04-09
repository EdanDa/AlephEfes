import assert from 'node:assert/strict';
import test from 'node:test';
import { groupMatchesWord, matchesSearchQuery, parseSearchGroups } from '../src/core/searchQuery.js';
import { normalizeSearchInput } from '../src/core/searchInput.js';

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

test('groupMatchesWord treats plus-separated numeric query as contains-all-values match', () => {
    assert.equal(groupMatchesWord(sampleWord, ['59', '365'], filtersAll), true);
    assert.equal(groupMatchesWord(sampleWord, ['59', '365', '430'], filtersAll), true);
    assert.equal(groupMatchesWord(sampleWord, ['59', '999'], filtersAll), false);
});

test('matchesSearchQuery uses OR across space-separated groups', () => {
    assert.equal(matchesSearchQuery(sampleWord, '52+430 59+365+430', filtersAll), true);
    assert.equal(matchesSearchQuery(sampleWord, '52+430 100+200', filtersAll), false);
});


test('matchesSearchQuery does not match incomplete plus groups', () => {
    assert.equal(matchesSearchQuery(sampleWord, '59+', filtersAll), false);
    assert.equal(matchesSearchQuery(sampleWord, '59+ 999', filtersAll), false);
});

test('numeric matching respects active layer filters', () => {
    assert.equal(matchesSearchQuery(sampleWord, '365', filtersOnlyUnits), false);
    assert.equal(matchesSearchQuery(sampleWord, '59', filtersOnlyUnits), true);
    assert.equal(matchesSearchQuery(sampleWord, '59+365', filtersOnlyUnits), false);
});

test('string matching is exact and does not return partial matches', () => {
    const israel = { word: 'ישראל', units: 1, tens: 2, hundreds: 3 };
    const prefixed = { word: 'וישראל', units: 1, tens: 2, hundreds: 3 };

    assert.equal(matchesSearchQuery(israel, 'ישראל', filtersAll), true);
    assert.equal(matchesSearchQuery(prefixed, 'ישראל', filtersAll), false);
    assert.equal(matchesSearchQuery({ word: 'דבשת', units: 4, tens: 5, hundreds: 6 }, 'שת', filtersAll), false);
    assert.equal(matchesSearchQuery({ word: 'שת', units: 4, tens: 5, hundreds: 6 }, 'שת', filtersAll), true);
});

test('normalizeSearchInput keeps plus groups numeric-only', () => {
    assert.equal(normalizeSearchInput('20+11'), '20+11');
    assert.equal(normalizeSearchInput('20+אש'), '20');
    assert.equal(normalizeSearchInput('20++11'), '20+11');
    assert.equal(normalizeSearchInput('אש+20'), 'אש');
});
