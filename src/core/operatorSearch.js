import { loadCorpusManifest } from './corpusData.js';
import { loadPassageUnits, loadResearchBook, sectionResearchUnit } from './corpusResearch.js';
import { compileFormula, evaluateFormula } from './operatorFormula.js';

export async function searchOperators(query, text, selection, signal) {
    const compiled = compileFormula(query.formula, query.domain);
    const result = { query, units: 0, words: 0, cases: 0, eligible: 0, groups: [], expected: compiled.shuffle ? 0 : null };
    let lastYield = performance.now();
    function checkCancelled() {
        if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
    }
    async function visit(unit, getUnit) {
        if (performance.now() - lastYield > 20) {
            await new Promise((resolve) => setTimeout(resolve, 0));
            lastYield = performance.now();
        }
        checkCancelled();
        const { hits, cases, expected, eligible } = evaluateFormula(unit, query, compiled, { limit: 1, compareOrder: true });
        result.eligible += eligible;
        result.units += 1;
        result.words += unit.wordCount;
        if (expected !== null) result.expected += expected;
        if (hits.length) {
            result.groups.push({ id: unit.id, source: unit.source, lineNumber: unit.lineNumber, hits, cases, getUnit });
            result.cases += cases;
        }
    }
    if (query.scope === 'passage') {
        const units = await loadPassageUnits(text, query.mode, selection);
        for (const unit of units) await visit(unit, () => unit);
    } else {
        const manifest = await loadCorpusManifest();
        const books = manifest.divisions.flatMap((division) => division.books);
        for (const { slug } of books) {
            if (query.scope !== 'corpus' && slug !== query.scope) continue;
            checkCancelled();
            const book = await loadResearchBook(slug);
            for (const { ordinal } of book.data.sections) {
                const getUnit = () => sectionResearchUnit(book, ordinal, query.mode);
                await visit(getUnit(), getUnit);
            }
        }
    }
    return result;
}
