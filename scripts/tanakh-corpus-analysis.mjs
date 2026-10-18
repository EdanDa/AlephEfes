import { createHash } from 'node:crypto';

import { buildLetterTable, computeCoreResults } from '../src/core/analysisCore.js';

export const CORPUS_ANALYSIS_MODES = Object.freeze(['aleph-zero', 'aleph-one']);

export function createCorpusAnalyses(books) {
    const sections = books.flatMap((book) => book.sections);
    const text = sections.map((section) => section.calculationText).join('\n');
    let analysisShared = null;
    const analysisByMode = {};

    for (const mode of CORPUS_ANALYSIS_MODES) {
        const results = computeCoreResults(text, mode);
        if (results.lines.length !== sections.length) {
            throw new Error(`Corpus analytical lines do not match sections in ${mode}`);
        }
        const wordIndices = new Map(results.allWords.map((word, index) => [word.word, index]));
        const shared = {
            totalWordCount: results.totalWordCount,
            uniqueWordCount: results.allWords.length,
            words: results.allWords.map(({ word }) => ({ word, count: results.wordCounts.get(word) })),
            sections: results.lines.map((line, index) => ({
                sectionId: sections[index].id,
                wordIndices: line.words.map((word) => wordIndices.get(word.word)),
            })),
        };
        if (analysisShared && JSON.stringify(shared) !== JSON.stringify(analysisShared)) {
            throw new Error(`Corpus word identities or positions differ in ${mode}`);
        }
        analysisShared ||= shared;
        const drOccurrenceDistribution = Array(10).fill(0);
        results.allWords.forEach((word) => { drOccurrenceDistribution[word.dr] += results.wordCounts.get(word.word); });
        analysisByMode[mode] = {
            mode,
            letterValues: Object.fromEntries(buildLetterTable(mode)),
            grandTotals: results.grandTotals,
            drDistributionBasis: 'unique-word-forms',
            drDistribution: Array.from(results.drDistribution),
            drOccurrenceDistribution,
            wordValues: results.allWords.map(({ word: _word, ...values }) => values),
            sections: results.lines.map((line) => ({
                totals: line.totals,
                totalsDR: line.totalsDR,
                isPrimeTotals: line.isPrimeTotals,
            })),
        };
    }

    return {
        analysisSchemaVersion: '2.0.0',
        sharedAnalysisHash: createHash('sha256').update(JSON.stringify(analysisShared), 'utf8').digest('hex'),
        analysisHash: createHash('sha256').update(JSON.stringify({ analysisShared, analysisByMode }), 'utf8').digest('hex'),
        analysisShared,
        analysisByMode,
    };
}
