import { t } from '../i18n/locale.js';
import { loadCorpusManifest, loadVerifiedCorpusFile } from './corpusData.js';
import { makeResearchUnit, manualResearchUnits } from './researchModel.js';
export async function loadResearchBook(slug) {
    const manifest = await loadCorpusManifest();
    const book = manifest.divisions.flatMap((division) => division.books).find((entry) => entry.slug === slug);
    if (!book) throw new Error(t('ספר לא מוכר'));
    const [data, provenance] = await Promise.all([loadVerifiedCorpusFile(book.file), loadVerifiedCorpusFile(manifest.provenance)]);
    return { book, data, corpus: { corpusId: manifest.corpusId, contentHash: manifest.contentHash, schemaVersion: manifest.schemaVersion, converterVersion: provenance.converterVersion, sourceRevision: provenance.source.revision, license: provenance.license } };
}
export function sectionResearchUnit(loaded, ordinal, mode) {
    const section = loaded.data.sections[ordinal - 1];
    if (!section || section.ordinal !== ordinal) throw new Error(t('פרשיה לא מוכרת'));
    return makeResearchUnit(section.calculationText, mode, { id: section.id, label: t`${t(loaded.book.name)} · פרשיה ${ordinal}`,
        source: { ...section, sourceFile: loaded.data.sourceFile, bookSlug: loaded.book.slug, bookName: loaded.book.name, boundaryBefore: loaded.data.sections[ordinal - 2]?.boundaryAfter || null, corpus: loaded.corpus } });
}
export async function loadPassageUnits(text, mode, selection) {
    if (!selection) return manualResearchUnits(text, mode);
    const loaded = await loadResearchBook(selection.bookSlug);
    const sections = loaded.data.sections.slice(selection.startSectionOrdinal - 1, selection.endSectionOrdinal);
    if (sections.length !== selection.sectionCount || sections.map((section) => section.calculationText).join('\n') !== text) throw new Error(t('הטקסט אינו תואם לפרשיות המקור השמורות. בחרו את המקור מחדש.'));
    return sections.map((section) => sectionResearchUnit(loaded, section.ordinal, mode));
}
export async function findCorpusOccurrences(word) {
    const manifest = await loadCorpusManifest();
    const index = await loadVerifiedCorpusFile(manifest.downloads.wordOccurrencesJson);
    if (index.contentHash !== manifest.contentHash) throw new Error(t('מפתח המופעים שייך לגרסת מקרא אחרת'));
    const books = manifest.divisions.flatMap((division) => division.books);
    const occurrences = (index.occurrencesByWord[word] || []).map(([sectionIndex, position]) => {
        const sectionId = index.sectionIds[sectionIndex];
        const slug = sectionId.replace(/-\d+$/, '');
        const book = books.find((entry) => entry.slug === slug);
        if (!book || !Number.isInteger(position) || position < 1) throw new Error(t('מופע לא תקין במפתח המקרא'));
        return { sectionId, position, bookSlug: slug, bookName: book.name, ordinal: Number(sectionId.match(/\d+$/)[0]) };
    });
    return { occurrences, corpus: { corpusId: manifest.corpusId, contentHash: manifest.contentHash } };
}

export { verifyCorpusText, loadResearchManifest } from './corpusData.js';
