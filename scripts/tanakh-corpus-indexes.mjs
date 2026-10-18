export const WORD_OCCURRENCES_FILE = 'aleph-efes-tanakh-word-occurrences.json';
export const TOKEN_LOCATIONS_FILE = 'aleph-efes-tanakh-token-locations.json';

export function createCorpusIndexes(corpus, sectionVerseMappings) {
    const { analysisShared, sharedAnalysisHash, contentHash, corpusId } = corpus;
    const header = { schemaVersion: '1.0.0', corpusId, contentHash, sharedAnalysisHash, provenance: corpus.provenance };
    const sectionIds = analysisShared.sections.map((section) => section.sectionId);
    const occurrencesByWord = Object.fromEntries(analysisShared.words.map(({ word }) => [word, []]));
    analysisShared.sections.forEach((section, sectionIndex) => {
        section.wordIndices.forEach((wordIndex, index) => {
            occurrencesByWord[analysisShared.words[wordIndex].word].push([sectionIndex, index + 1]);
        });
    });

    if (sectionVerseMappings.length !== sectionIds.length) throw new Error('Token locator sections are incomplete');
    const verseLocators = [];
    const verseIndices = new Map();
    const sections = sectionVerseMappings.map((section, index) => {
        if (section.sectionId !== sectionIds[index]) throw new Error(`Token locator section order differs at ${index}`);
        let nextWordPosition = 1;
        const verseSpans = section.verseSpans.map((span) => {
            if (span.startWordPosition !== nextWordPosition || span.wordCount <= 0) {
                throw new Error(`Token locator coverage is discontinuous in ${section.sectionId}`);
            }
            nextWordPosition += span.wordCount;
            const key = JSON.stringify(span.locator);
            if (!verseIndices.has(key)) {
                verseIndices.set(key, verseLocators.length);
                verseLocators.push(span.locator);
            }
            return [span.startWordPosition, span.wordCount, verseIndices.get(key), span.verseStartWordPosition];
        });
        if (nextWordPosition - 1 !== analysisShared.sections[index].wordIndices.length) {
            throw new Error(`Token locator word count differs in ${section.sectionId}`);
        }
        return { sectionId: section.sectionId, verseSpans };
    });

    return {
        wordOccurrences: {
            ...header,
            occurrenceFields: ['sectionIndex', 'wordPosition'],
            positionConventions: { sectionIndex: 'zero-based index into sectionIds and analysisShared.sections', wordPosition: 'one-based position within the MAM section' },
            sectionIds,
            occurrencesByWord,
        },
        tokenLocations: {
            ...header,
            verseSpanFields: ['startWordPosition', 'wordCount', 'verseIndex', 'verseStartWordPosition'],
            positionConventions: { startWordPosition: 'one-based within the MAM section', verseIndex: 'zero-based index into verseLocators', verseStartWordPosition: 'one-based within the ketiv-only calculation stream of the verse, continuing across MAM section boundaries' },
            statistics: { sections: sectionIds.length, words: analysisShared.totalWordCount, versesWithTokens: verseLocators.length },
            verseLocators,
            sections,
        },
    };
}
