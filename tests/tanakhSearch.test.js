import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTanakhSearchInput, normalizeTypedTanakhSearchInput } from '../src/core/searchInput.js';
import { findSpellingMatches, indexSectionWords, sourceMatchRange } from '../src/core/tanakhSearch.js';

test('Tanakh search keeps only Hebrew letters and spaces, including final forms', () => {
    assert.equal(normalizeTanakhSearchInput(' בְּרֵאשִׁ֖ית\nעַל־פְּנֵ֣י ךםןףץ  '), 'בראשית על פני ךםןףץ ');
    assert.equal(normalizeTanakhSearchInput('123+ABC🙂'), '');
    assert.equal(normalizeTanakhSearchInput('שָׁלוֹם!'), 'שלום');
});

test('English-layout typing uses Hebrew key positions, including the final-letter keys', () => {
    assert.equal(normalizeTypedTanakhSearchInput('crtah, crt'), 'בראשית ברא');
    assert.equal(normalizeTypedTanakhSearchInput('l oi;. 123+'), 'ך םןףץ ');
    assert.equal(normalizeTypedTanakhSearchInput('שָׁלוֹם'), 'שלום');
});

test('exact phrases include overlapping occurrences and stop at section boundaries', () => {
    const index = { sectionIds: ['a-0001', 'a-0002'], occurrencesByWord: {
        שם: [[0, 1], [0, 2], [0, 3], [1, 1]], ושם: [[1, 2]], שמ: [[1, 3]],
    } };
    const sections = indexSectionWords(index);
    assert.deepEqual(findSpellingMatches(index, sections, ['שם', 'שם']), [[0, 1], [0, 2]]);
    assert.deepEqual(findSpellingMatches(index, sections, ['שמ']), [[1, 3]]);
    assert.deepEqual(findSpellingMatches(index, sections, ['ש']), []);
    const source = 'שָׁם שָׁ֖ם־שָֽׁם׃';
    assert.equal(source.slice(...sourceMatchRange(source, 2, 2)), 'שָׁ֖ם־שָֽׁם');
});
