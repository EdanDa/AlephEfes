import integrity from './corpusIntegrity.json';
import { makeResearchUnit, manualResearchUnits } from './researchModel.js';

const cache = new Map();
export async function verifyCorpusText(text, expectedHash) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expectedHash) throw new Error('קובץ המקרא אינו תואם לגרסה המאומתת. נסו לטעון שוב או לרענן את האפליקציה.');
}
function load(file) {
    if (!integrity.files[file]) return Promise.reject(new Error('קובץ מקרא לא מוכר'));
    if (!cache.has(file)) cache.set(file, (async () => {
        const response = await fetch(`${import.meta.env.BASE_URL}corpus/${file}`, { cache: 'no-cache' });
        if (!response.ok) throw new Error('טעינת המקרא נכשלה. בדקו את החיבור ונסו שוב.');
        const text = await response.text();
        await verifyCorpusText(text, integrity.files[file]);
        return JSON.parse(text);
    })().catch((error) => { cache.delete(file); throw error; }));
    return cache.get(file);
}
export async function loadResearchManifest() {
    const manifest = await load('manifest.json');
    if (manifest.contentHash !== integrity.contentHash) throw new Error('גרסאות המקרא אינן תואמות');
    return manifest;
}
export async function loadResearchBook(slug) {
    const manifest = await loadResearchManifest();
    const book = manifest.divisions.flatMap((division) => division.books).find((entry) => entry.slug === slug);
    if (!book) throw new Error('ספר לא מוכר');
    const [data, provenance] = await Promise.all([load(book.file), load('provenance.json')]);
    return { book, data, corpus: { corpusId: manifest.corpusId, contentHash: manifest.contentHash, schemaVersion: manifest.schemaVersion, converterVersion: provenance.converterVersion, sourceRevision: provenance.source.revision, license: provenance.license } };
}
export function sectionResearchUnit(loaded, ordinal, mode) {
    const section = loaded.data.sections[ordinal - 1];
    if (!section || section.ordinal !== ordinal) throw new Error('פרשיה לא מוכרת');
    return makeResearchUnit(section.calculationText, mode, { id: section.id, label: `${loaded.book.name} · פרשיה ${ordinal}`,
        source: { ...section, sourceFile: loaded.data.sourceFile, bookSlug: loaded.book.slug, bookName: loaded.book.name, boundaryBefore: loaded.data.sections[ordinal - 2]?.boundaryAfter || null, corpus: loaded.corpus } });
}
export async function loadPassageUnits(text, mode, selection) {
    if (!selection) return manualResearchUnits(text, mode);
    const loaded = await loadResearchBook(selection.bookSlug);
    const sections = loaded.data.sections.slice(selection.startSectionOrdinal - 1, selection.endSectionOrdinal);
    if (sections.length !== selection.sectionCount || sections.map((section) => section.calculationText).join('\n') !== text) throw new Error('הטקסט אינו תואם לפרשיות המקור השמורות. בחרו את המקור מחדש.');
    return sections.map((section) => sectionResearchUnit(loaded, section.ordinal, mode));
}
export async function findCorpusOccurrences(word) {
    const manifest = await loadResearchManifest();
    const index = await load(manifest.downloads.wordOccurrencesJson);
    if (index.contentHash !== manifest.contentHash) throw new Error('מפתח המופעים שייך לגרסת מקרא אחרת');
    const books = manifest.divisions.flatMap((division) => division.books);
    const occurrences = (index.occurrencesByWord[word] || []).map(([sectionIndex, position]) => {
        const sectionId = index.sectionIds[sectionIndex];
        const slug = sectionId.replace(/-\d+$/, '');
        const book = books.find((entry) => entry.slug === slug);
        if (!book || !Number.isInteger(position) || position < 1) throw new Error('מופע לא תקין במפתח המקרא');
        return { sectionId, position, bookSlug: slug, bookName: book.name, ordinal: Number(sectionId.match(/\d+$/)[0]) };
    });
    return { occurrences, corpus: { corpusId: manifest.corpusId, contentHash: manifest.contentHash } };
}
