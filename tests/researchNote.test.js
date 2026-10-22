import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeResearchUnit } from '../src/core/researchModel.js';
import { buildResearchNote, researchNoteRows } from '../src/core/researchNote.js';
const filters = { U: true, T: true, H: true, Prime: false };
for (const mode of ['aleph-zero', 'aleph-one']) test(`Markdown contains complete exact-word occurrences and canonical positions (${mode})`, () => {
    const unit = makeResearchUnit('אב־אב ה מם ממ', mode, { id: 'manual-line-2', label: 'שורה 2', lineNumber: 2 });
    const note = buildResearchNote({ unit, filters, word: 'אב', selectedPosition: 2, passage: { wordCount: 8, distinctWordCount: 6, selectedWordCount: 3 } });
    assert.ok(note.includes('```text\nאב־אב ה מם ממ\n```'));
    assert.ok(note.includes('5 מופעי מילים; 4 צורות מילים שונות; 9 אותיות'));
    assert.ok(note.includes('הרשימה מלאה עבור היחידה שנבחרה: 2 מופעים, 1 צורות מילים שונות'));
    assert.ok(note.includes(`| אב | 1 | 1 | 2 | ${mode === 'aleph-zero' ? 1 : 3} |`));
    assert.ok(note.includes('| אב | 2 | 3 | 4 |'));
    assert.ok(note.includes('בקטע הניתוח הראשי: 8 מופעי מילים'));
    assert.ok(note.includes('אין שיוך ל־MAM'));
    assert.ok(!note.includes('Corpus SHA-256'));
});
test('value occurrence lists respect active layers without duplicating equivalent values', () => {
    const unit = makeResearchUnit('אב אב בא גד', 'aleph-zero');
    const rows = researchNoteRows(unit, { value: 1, filters });
    assert.equal(rows.length, 3); assert.deepEqual(rows[0].matchingLayers, ['H', 'T', 'U']);
    assert.equal(researchNoteRows(unit, { value: 1, filters: { U: false, T: false, H: false, Prime: false } }).length, 0);
    assert.equal(researchNoteRows(unit, { word: 'אב', value: 1, filters: { U: false, T: false, H: false, Prime: false } }).length, 2);
});
test('corpus note names its one-unit excerpt, selected occurrence, version, hashes and attribution', () => {
    const book = JSON.parse(readFileSync('public/corpus/books/genesis.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('public/corpus/manifest.json', 'utf8'));
    const provenance = JSON.parse(readFileSync('public/corpus/provenance.json', 'utf8'));
    const section = book.sections[0];
    const unit = makeResearchUnit(section.calculationText, 'aleph-one', { id: section.id, label: 'בראשית · פרשיה 1', source: { ...section, bookName: 'בראשית', sourceFile: book.sourceFile, corpus: { ...manifest, converterVersion: provenance.converterVersion, sourceRevision: provenance.source.revision, license: provenance.license } } });
    const matches = unit.tokens.filter((token) => token.word === 'אלהים');
    const note = buildResearchNote({ unit, filters, word: 'אלהים', selectedPosition: matches[0].position, corpusSearch: { word: 'אלהים', totalOccurrences: 999, position: matches[0].position, contentHash: manifest.contentHash } });
    assert.ok(note.includes('999 מופעים')); assert.ok(note.includes('זו אינה רשימת כל המופעים במקרא'));
    assert.ok(note.includes(manifest.contentHash)); assert.ok(note.includes(section.calculationHash));
    assert.ok(note.includes('CC-BY-SA-4.0')); assert.ok(note.includes(provenance.source.revision));
    assert.equal(note.split('\n').filter((line) => line.startsWith('| אלהים |')).length, matches.length);
});
