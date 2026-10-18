import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import { buildLetterTable, computeCoreResults } from '../src/core/analysisCore.js';

const corpus = JSON.parse(fs.readFileSync(new URL('../public/corpus/aleph-efes-tanakh-corpus.json', import.meta.url), 'utf8'));
const sections = corpus.books.flatMap((book) => book.sections);
const shared = corpus.analysisShared;

test('full-corpus analysis checksum covers both populated modes', () => {
    assert.equal(corpus.analysisSchemaVersion, '2.0.0');
    assert.deepEqual(Object.keys(corpus.analysisByMode), ['aleph-zero', 'aleph-one']);
    assert.equal(corpus.sharedAnalysisHash, createHash('sha256').update(JSON.stringify(shared), 'utf8').digest('hex'));
    assert.equal(corpus.analysisHash, createHash('sha256').update(JSON.stringify({ analysisShared: shared, analysisByMode: corpus.analysisByMode }), 'utf8').digest('hex'));
});

for (const mode of ['aleph-zero', 'aleph-one']) {
    test(`${mode} covers every ordered occurrence and section with correct numeric values`, () => {
        const analysis = corpus.analysisByMode[mode];
        const letterTable = buildLetterTable(mode);
        const counts = new Uint32Array(shared.words.length);
        const corpusTotals = { units: 0, tens: 0, hundreds: 0 };
        assert.equal(analysis.mode, mode);
        assert.equal(shared.totalWordCount, corpus.manifest.statistics.words);
        assert.equal(shared.uniqueWordCount, shared.words.length);
        assert.equal(analysis.wordValues.length, shared.words.length);
        assert.equal(Object.hasOwn(analysis, 'words'), false, 'Word spellings and counts belong only to shared data');
        assert.equal(analysis.sections.length, sections.length);
        assert.deepEqual(analysis.letterValues, Object.fromEntries(letterTable));

        for (const [index, { word }] of shared.words.entries()) {
            const stored = analysis.wordValues[index];
            assert.equal(Object.hasOwn(stored, 'word'), false);
            assert.equal(Object.hasOwn(stored, 'count'), false);
            const values = { units: 0, tens: 0, hundreds: 0 };
            for (const letter of word) {
                const { u, t, h } = letterTable.get(letter);
                values.units += u;
                values.tens += t;
                values.hundreds += h;
            }
            for (const layer of Object.keys(values)) assert.equal(stored[layer], values[layer], `${mode} ${word} ${layer}`);
            assert.equal(stored.dr, values.units === 0 ? 0 : 1 + ((values.units - 1) % 9));
        }

        for (const [index, section] of sections.entries()) {
            const stored = analysis.sections[index];
            const sharedSection = shared.sections[index];
            assert.equal(sharedSection.sectionId, section.id);
            assert.equal(sharedSection.wordIndices.length, section.wordCount, section.id);
            assert.equal(Object.hasOwn(stored, 'wordIndices'), false, 'Ordered occurrences belong only to shared data');
            const totals = { units: 0, tens: 0, hundreds: 0 };
            const words = sharedSection.wordIndices.map((wordIndex) => {
                assert.ok(Number.isInteger(wordIndex) && wordIndex >= 0 && wordIndex < shared.words.length, section.id);
                counts[wordIndex] += 1;
                const values = analysis.wordValues[wordIndex];
                for (const layer of Object.keys(totals)) totals[layer] += values[layer];
                return shared.words[wordIndex].word;
            });
            assert.equal(words.join(' '), section.calculationText.replace(/[־\-]/gu, ' '), `${mode} ${section.id} word order`);
            assert.deepEqual(stored.totals, totals, section.id);
            assert.equal(stored.totalsDR, totals.units === 0 ? 0 : 1 + ((totals.units - 1) % 9));
            for (const layer of Object.keys(totals)) corpusTotals[layer] += totals[layer];
        }

        assert.equal(counts.reduce((sum, count) => sum + count, 0), corpus.manifest.statistics.words);
        shared.words.forEach((word, index) => assert.equal(word.count, counts[index], `${mode} ${word.word} frequency`));
        for (const layer of Object.keys(corpusTotals)) assert.equal(analysis.grandTotals[layer], corpusTotals[layer]);
        const recalculated = computeCoreResults(sections.map((section) => section.calculationText).join('\n'), mode);
        assert.deepEqual(analysis.grandTotals, recalculated.grandTotals);
        assert.deepEqual(analysis.drDistribution, Array.from(recalculated.drDistribution));
        assert.equal(analysis.drDistributionBasis, 'unique-word-forms');
        assert.equal(analysis.drDistribution.reduce((sum, count) => sum + count, 0), 39650);
        const weighted = Array(10).fill(0);
        analysis.wordValues.forEach((word, index) => { weighted[word.dr] += shared.words[index].count; });
        assert.deepEqual(analysis.drOccurrenceDistribution, weighted);
        assert.equal(weighted.reduce((sum, count) => sum + count, 0), 305437);
        analysis.sections.forEach((section, index) => assert.deepEqual(section.isPrimeTotals, recalculated.lines[index].isPrimeTotals));
        const bereshit = analysis.wordValues[shared.words.findIndex((word) => word.word === 'בראשית')];
        assert.equal(bereshit.units, mode === 'aleph-one' ? 76 : 70);
        assert.equal(bereshit.hundreds, mode === 'aleph-one' ? 913 : 610);
    });
}
