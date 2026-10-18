import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { convertBook, emptyStats } from '../scripts/generate-tanakh-corpus.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../public/corpus/${file}`, import.meta.url), 'utf8'));
const corpus = read('aleph-efes-tanakh-corpus.json');
const shared = corpus.analysisShared;
const occurrences = read(corpus.manifest.downloads.wordOccurrencesJson);
const locations = read(corpus.manifest.downloads.tokenLocationsJson);
const sections = corpus.books.flatMap((book) => book.sections);

test('separate research indexes identify the same corpus and carry its attribution', () => {
    for (const index of [occurrences, locations]) {
        assert.equal(index.contentHash, corpus.contentHash);
        assert.equal(index.sharedAnalysisHash, corpus.sharedAnalysisHash);
        assert.deepEqual(index.provenance, corpus.provenance);
    }
});

test('inverse word index covers each occurrence exactly once in its original MAM position', () => {
    assert.deepEqual(occurrences.sectionIds, shared.sections.map((section) => section.sectionId));
    assert.equal(Object.keys(occurrences.occurrencesByWord).length, shared.uniqueWordCount);
    const seen = new Uint8Array(shared.totalWordCount);
    const offsets = [];
    let total = 0;
    shared.sections.forEach((section) => { offsets.push(total); total += section.wordIndices.length; });
    for (const [wordIndex, { word, count }] of shared.words.entries()) {
        const entries = occurrences.occurrencesByWord[word];
        assert.equal(entries.length, count, word);
        let previousOffset = -1;
        for (const [sectionIndex, position] of entries) {
            assert.ok(Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < shared.sections.length);
            assert.ok(Number.isInteger(position) && position >= 1 && position <= shared.sections[sectionIndex].wordIndices.length);
            assert.equal(shared.sections[sectionIndex].wordIndices[position - 1], wordIndex, word);
            const offset = offsets[sectionIndex] + position - 1;
            assert.ok(offset > previousOffset, `${word} occurrence order`);
            assert.equal(seen[offset], 0, `${word} duplicate occurrence`);
            seen[offset] = 1;
            previousOffset = offset;
        }
    }
    assert.equal(seen.reduce((sum, value) => sum + value, 0), shared.totalWordCount);
});

test('verse spans map every token and continue verse positions across section boundaries', () => {
    assert.equal(locations.sections.length, sections.length);
    const verseWordCounts = new Uint32Array(locations.verseLocators.length);
    let total = 0;
    for (const [index, stored] of locations.sections.entries()) {
        const section = sections[index];
        assert.equal(stored.sectionId, section.id);
        let nextPosition = 1;
        for (const [start, count, verseIndex, verseStart] of stored.verseSpans) {
            assert.equal(start, nextPosition, section.id);
            assert.ok(Number.isInteger(count) && count > 0);
            assert.ok(Number.isInteger(verseIndex) && verseIndex >= 0 && verseIndex < locations.verseLocators.length);
            assert.equal(verseStart, verseWordCounts[verseIndex] + 1, section.id);
            verseWordCounts[verseIndex] += count;
            nextPosition += count;
        }
        assert.equal(nextPosition - 1, section.wordCount, section.id);
        assert.deepEqual(locations.verseLocators[stored.verseSpans[0][2]], section.locators.start);
        assert.deepEqual(locations.verseLocators[stored.verseSpans.at(-1)[2]], section.locators.end);
        total += nextPosition - 1;
    }
    assert.equal(total, shared.totalWordCount);
    assert.equal(locations.statistics.words, total);
    assert.ok(verseWordCounts.every((count) => count > 0));
    const split = sections.findIndex((section) => section.id.startsWith('genesis-') && section.boundaryAfter?.location.chapter === 35 && section.boundaryAfter?.location.verse === 22);
    const lastSpan = locations.sections[split].verseSpans.at(-1);
    const nextSpan = locations.sections[split + 1].verseSpans[0];
    assert.equal(lastSpan[2], nextSpan[2]);
    assert.equal(nextSpan[3], lastSpan[3] + lastSpan[1]);
});

test('source token mapping joins split spans, excludes qere, and retains mid-verse positions', () => {
    const book = { file: 'fixture.json', slug: 'fixture', name: 'בדיקה', division: 'torah' };
    const data = { book39s: [{ book24_name: 'בדיקה', sub_book_name: null, chapters: { 1: {
        1: [[], [], ['ברא ', { tmpl_name: 'כו״ק', tmpl_params: { '1': 'כתב', '2': 'קרי־' } }, 'הבא ', { tmpl_name: 'פפ' }, 'אל הארץ']],
        2: [[], [], ['ש', '״', 'ם ', { tmpl_name: 'קרי ולא כתיב', tmpl_params: { '1': 'קרי' } }, 'אחד']],
    } } }] };
    const mappings = [];
    const stats = { ...emptyStats(), sections: 0, words: 0, book39s: 0, chapters: 0, verses: 0, boundaries: 0 };
    const converted = convertBook(book, data, stats, mappings);
    assert.deepEqual(converted.sections.map((section) => section.calculationText), ['ברא כתב הבא', 'אל הארץ שם אחד']);
    assert.deepEqual(mappings.map((section) => section.verseSpans.map(({ startWordPosition, wordCount, verseStartWordPosition, locator }) => [startWordPosition, wordCount, locator.verse, verseStartWordPosition])), [
        [[1, 3, 1, 1]],
        [[1, 2, 1, 4], [3, 2, 2, 1]],
    ]);
});
