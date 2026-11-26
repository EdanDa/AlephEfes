import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildSpellingIndex, hitAtWord, variantSpellings } from '../src/core/tanakhSearch.js';
import { findSongs, songs } from '../src/core/tanakhSongs.js';

const read = file => JSON.parse(readFileSync(new URL('../public/corpus/' + file, import.meta.url)));
const index = buildSpellingIndex(read('aleph-efes-tanakh-word-occurrences.json'));
const variants = read('spelling-variants.json');

test('every variant occurrence resolves to its actual MAM spelling and has exactly one annotated reading', () => {
    assert.equal(variants.contentHash, read('manifest.json').contentHash);
    const coverage = Object.values(variants.coverage);
    assert.equal(coverage.length, 39);
    assert.equal(coverage.reduce((total, book) => total + book.words, 0), index.tokens.length);
    assert.ok(coverage.every(book => book.annotated > 0 && book.annotated <= book.aligned && book.aligned <= book.words));
    const seen = new Set();
    for (const family of variants.families) {
        for (const [word, base, offsets] of family.forms) {
            assert.ok(word.endsWith(base));
            for (const i of offsets) {
                assert.equal(index.tokens[i], word);
                assert.ok(!seen.has(i));
                seen.add(i);
            }
        }
    }
});

test('variant groups preserve inflection and return annotated occurrences for the selected reading', () => {
    const groups = variantSpellings(variants.families, 'פילגשים');
    assert.deepEqual(Object.fromEntries(groups.map(g => [g.spelling, g.positions.length])), {
        ופילגשים: 2, ופלגשים: 1, הפילגשים: 2, פלגשים: 3,
    });
    const defective = groups.find(g => g.spelling === 'ופלגשים');
    assert.equal(defective.readings[0].base, 'פלגשים');
    assert.equal(defective.readings[0].queryBase, 'פילגשים');
    assert.match(index.sectionIds[hitAtWord(index, defective.positions[0]).section], /^kings-/);
    const kings = variantSpellings(variants.families, 'המלך');
    assert.ok(kings.some(g => g.spelling === 'והמלך'));
    assert.ok(!kings.some(g => g.spelling === 'מלכים'));
});

test('each named song covers exactly the advertised verse positions across all its MAM sections', () => {
    const locations = read('aleph-efes-tanakh-token-locations.json');
    for (const song of songs) {
        const expected = [];
        const inSong = [];
        for (const record of locations.sections.filter(r => r.sectionId.startsWith(song.bookSlug + '-'))) {
            const ordinal = Number(record.sectionId.split('-').at(-1));
            for (const [start, count, id] of record.verseSpans) {
                const v = locations.verseLocators[id];
                const span = [ordinal, start, count];
                if (v.chapter === song.chapter && v.verse >= song.firstVerse && v.verse <= song.lastVerse) expected.push(span);
                if (ordinal >= song.ordinal && ordinal <= song.endOrdinal) inSong.push(span);
            }
        }
        assert.ok(expected.length);
        assert.deepEqual(inSong, expected, song.title);
        assert.ok(findSongs(song.title).includes(song));
    }
    assert.equal(findSongs('שירת משה').length, 2);
});
