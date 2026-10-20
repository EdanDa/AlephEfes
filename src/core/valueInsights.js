import { getWordValues, isValueVisible, isWordVisible } from './analysisCore.js';

export function buildValueInsights(coreResults, filters, selectedDR = null) {
    if (!coreResults) return [];
    const byValue = new Map();
    for (const word of coreResults.allWords) {
        if (!isWordVisible(word, filters) || (selectedDR !== null && word.dr !== selectedDR)) continue;
        const occurrences = coreResults.wordCounts.get(word.word) || 1;
        for (const entry of getWordValues(word)) {
            if (!isValueVisible(entry.layer, entry.isPrime, filters)) continue;
            if (!byValue.has(entry.value)) byValue.set(entry.value, { value: entry.value, isPrime: entry.isPrime, layers: new Set(), words: new Map() });
            const stat = byValue.get(entry.value);
            stat.layers.add(entry.layer);
            if (!stat.words.has(word.word)) stat.words.set(word.word, { word: word.word, occurrences, layers: [] });
            stat.words.get(word.word).layers.push(entry.layer);
        }
    }
    return Array.from(byValue.values(), (stat) => {
        const words = Array.from(stat.words.values());
        const totalOccurrences = words.reduce((sum, word) => sum + word.occurrences, 0);
        const layers = ['H', 'T', 'U'].filter((layer) => stat.layers.has(layer));
        return {
            value: stat.value,
            isPrime: stat.isPrime,
            layers,
            layerCount: layers.length,
            uniqueWordCount: words.length,
            totalOccurrences,
            avgOccurrences: totalOccurrences / words.length,
            bridgeScore: words.length * layers.length,
            topWords: words.sort((a, b) => b.occurrences - a.occurrences || a.word.localeCompare(b.word, 'he')).slice(0, 8),
        };
    }).sort((a, b) => b.bridgeScore - a.bridgeScore || b.totalOccurrences - a.totalOccurrences || a.value - b.value);
}
