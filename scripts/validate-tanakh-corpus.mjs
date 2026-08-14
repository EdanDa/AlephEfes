import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { computeCoreResults } from '../src/core/analysisCore.js';
import { createTanakhSelection } from '../src/core/tanakhSelection.js';
import { expectedOutput } from './generate-tanakh-corpus.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, '..');
const CORPUS_ROOT = path.join(REPO_ROOT, 'public', 'corpus');
const MAM_PARSED_ROOT = path.resolve(process.env.MAM_PARSED_PATH || path.join(WORKSPACE_ROOT, 'MAM-parsed'));
const MAM_BASICS_ROOT = path.resolve(process.env.MAM_BASICS_PATH || path.join(WORKSPACE_ROOT, 'MAM-basics'));

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(CORPUS_ROOT, relativePath), 'utf8'));
}

function sha256(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function allSections() {
    const manifest = readJson('manifest.json');
    return manifest.divisions.flatMap((division) => division.books.flatMap((book) => {
        const payload = readJson(book.file);
        return payload.sections.map((section) => ({ book, section }));
    }));
}

test('generated corpus is byte-for-byte deterministic from local siblings', () => {
    const generated = expectedOutput({
        sourcePath: MAM_PARSED_ROOT,
        basicsPath: MAM_BASICS_ROOT,
        outputPath: CORPUS_ROOT,
    });
    for (const [relativePath, expected] of generated.files.entries()) {
        assert.equal(fs.readFileSync(path.join(CORPUS_ROOT, relativePath), 'utf8'), expected, relativePath);
    }
});

test('complete source traversal and discovered boundary taxonomy are stable', () => {
    const provenance = readJson('provenance.json');
    assert.equal(provenance.statistics.sourceFiles, 24);
    assert.equal(provenance.statistics.book39s, 39);
    assert.equal(provenance.statistics.chapters, 929);
    assert.equal(provenance.statistics.verses, 23_202);
    assert.deepEqual(provenance.statistics.boundaryExact, {
        'פפ': 1553,
        'סס': 1554,
        'מ:ששש': 328,
        'ססס': 428,
        'פפפ': 18,
        'ר1': 34,
        'ר3': 47,
        'ר4': 38,
    });
    assert.deepEqual(provenance.statistics.boundaryNormalized, {
        petuhah: 1656,
        setumah: 2016,
        'shirah-setumah-like': 328,
    });
    assert.equal(provenance.statistics.structuralExceptions['numbers-10-inverted-nun-neighbor'], 2);
    assert.equal(provenance.ambiguousCases.length, 1);
    assert.equal(provenance.ambiguousCases[0].marker, 'מ:ששש');
    assert.equal(provenance.ambiguousCases[0].occurrences, 328);
    assert.match(provenance.ambiguousCases[0].resolution, /shirah-setumah-like/u);
});

test('sections cross locator boundaries but split at genuine mid-verse boundaries', () => {
    const sections = allSections();
    assert.ok(sections.some(({ section }) => section.locators.start.chapter !== section.locators.end.chapter));
    assert.ok(sections.some(({ section }) => section.locators.start.subBook !== section.locators.end.subBook));
    assert.ok(sections.some(({ section }) => section.boundaryAfter?.position === 'inside-verse'));

    const genesis = readJson('books/genesis.json');
    const genMidVerse = genesis.sections.find((section) => section.boundaryAfter?.location.chapter === 35 && section.boundaryAfter?.location.verse === 22);
    assert.equal(genMidVerse.boundaryAfter.upstreamMarker, 'פפ');
    assert.equal(genMidVerse.boundaryAfter.position, 'inside-verse');
});

test('ketiv-only policy handles every active K/Q construct and keeps editorial notes out', () => {
    const provenance = readJson('provenance.json');
    assert.deepEqual(provenance.statistics.ketivQere, {
        'כו״ק': 884,
        'מ:קו״כ-אם-2': 148,
        'מ:כו״ק מיוחד': 37,
        'קו״כ': 126,
        'קרי ולא כתיב': 9,
        'כתיב ולא קרי': 8,
    });
    assert.equal(provenance.statistics.specialConstructs['targeted-editorial-notes'], 31);
    assert.equal(provenance.statistics.specialConstructs['special-letter-words'], 52);

    for (const { section } of allSections()) {
        assert.doesNotMatch(section.sourceText, /מקורות=|הערות דותן|מ"ש ובדפוסים/u);
        assert.match(section.calculationText, /^[\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5 ]+$/u);
    }
});

test('Genesis creation-day regression agrees with the canonical calculation engine', () => {
    const genesis = readJson('books/genesis.json');
    const firstSeven = genesis.sections.slice(0, 7);
    assert.deepEqual(firstSeven.map((section) => section.wordCount), [52, 38, 69, 69, 57, 149, 35]);
    for (const section of firstSeven) {
        assert.equal(computeCoreResults(section.calculationText, 'aleph-zero').totalWordCount, section.wordCount);
    }
});

test('every stored section word count agrees with the canonical AlephEfes engine', () => {
    for (const { book, section } of allSections()) {
        const results = computeCoreResults(section.calculationText, 'aleph-zero');
        assert.equal(results.totalWordCount, section.wordCount, `${book.name} section ${section.ordinal}`);
        assert.equal(results.lines.length, 1, `${book.name} section ${section.ordinal} must remain one analytical line`);
    }
});

test('all 24 lazy-loaded book payloads preserve ordered, traceable section text', () => {
    const manifest = readJson('manifest.json');
    const books = manifest.divisions.flatMap((division) => division.books);
    let sectionTotal = 0;
    let boundaryTotal = 0;
    let wordTotal = 0;

    assert.equal(books.length, 24);
    for (const book of books) {
        const payload = readJson(book.file);
        assert.equal(payload.book.slug, book.slug);
        assert.equal(payload.sections.length, book.sections);
        assert.equal(payload.statistics.sections, book.sections);

        for (const [index, section] of payload.sections.entries()) {
            const ordinal = index + 1;
            assert.equal(section.ordinal, ordinal, `${book.slug} ordinal ${ordinal}`);
            assert.equal(section.id, `${book.slug}-${String(ordinal).padStart(4, '0')}`);
            assert.ok(section.sourceText.length > 0, `${section.id} source text`);
            assert.ok(section.calculationText.length > 0, `${section.id} calculation text`);
            assert.doesNotMatch(section.sourceText, /\uFFFD|[\r\n]/u, `${section.id} source encoding`);
            assert.doesNotMatch(section.calculationText, /[\r\n]/u, `${section.id} analytical continuity`);
            assert.equal(sha256(section.sourceText), section.sourceHash, `${section.id} source hash`);
            assert.equal(sha256(section.calculationText), section.calculationHash, `${section.id} calculation hash`);
            assert.ok(section.locators?.start && section.locators?.end, `${section.id} locators`);
            assert.equal(Boolean(section.boundaryAfter), ordinal < payload.sections.length, `${section.id} terminal boundary`);
            if (section.boundaryAfter) boundaryTotal += 1;
            wordTotal += section.wordCount;
        }

        const wholeBook = createTanakhSelection(payload.sections, 'book');
        const recomputed = computeCoreResults(wholeBook.calculationText, 'aleph-zero');
        assert.equal(wholeBook.sectionCount, payload.sections.length, `${book.slug} joined sections`);
        assert.equal(recomputed.lines.length, payload.sections.length, `${book.slug} joined analytical lines`);
        assert.equal(recomputed.totalWordCount, payload.statistics.words, `${book.slug} joined words`);
        sectionTotal += payload.sections.length;
    }

    assert.deepEqual(
        { sections: sectionTotal, boundaries: boundaryTotal, words: wordTotal },
        {
            sections: manifest.statistics.sections,
            boundaries: manifest.statistics.boundaries,
            words: manifest.statistics.words,
        },
    );
});
