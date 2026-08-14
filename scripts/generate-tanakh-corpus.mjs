import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeCoreResults, forceHebrewInput } from '../src/core/analysisCore.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, '..');

const SCHEMA_VERSION = '1.0.0';
const CONVERTER_VERSION = '1.0.0';
const MID_VERSE_ARGUMENT = 'פסקא באמצע פסוק';
const HEBREW_LETTER_RE = /[\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5]/u;
const PARASHAH_MARKERS = new Map([
    ['פפ', 'petuhah'],
    ['פפפ', 'petuhah'],
    ['סס', 'setumah'],
    ['ססס', 'setumah'],
    ['מ:ששש', 'shirah-setumah-like'],
]);
const POETIC_LAYOUT_MARKERS = new Set(['ר0', 'ר1', 'ר2', 'ר3', 'ר4']);

const BOOKS = Object.freeze([
    { file: 'A1-Genesis.json', slug: 'genesis', name: 'בראשית', division: 'torah' },
    { file: 'A2-Exodus.json', slug: 'exodus', name: 'שמות', division: 'torah' },
    { file: 'A3-Levit.json', slug: 'leviticus', name: 'ויקרא', division: 'torah' },
    { file: 'A4-Numbers.json', slug: 'numbers', name: 'במדבר', division: 'torah' },
    { file: 'A5-Deuter.json', slug: 'deuteronomy', name: 'דברים', division: 'torah' },
    { file: 'B1-Joshua.json', slug: 'joshua', name: 'יהושע', division: 'neviim' },
    { file: 'B2-Judges.json', slug: 'judges', name: 'שופטים', division: 'neviim' },
    { file: 'BA-Samuel.json', slug: 'samuel', name: 'שמואל', division: 'neviim' },
    { file: 'BC-Kings.json', slug: 'kings', name: 'מלכים', division: 'neviim' },
    { file: 'C1-Isaiah.json', slug: 'isaiah', name: 'ישעיהו', division: 'neviim' },
    { file: 'C2-Jeremiah.json', slug: 'jeremiah', name: 'ירמיהו', division: 'neviim' },
    { file: 'C3-Ezekiel.json', slug: 'ezekiel', name: 'יחזקאל', division: 'neviim' },
    { file: 'CA-The-12-Minor-Prophets.json', slug: 'twelve', name: 'תרי עשר', division: 'neviim' },
    { file: 'D1-Psalms.json', slug: 'psalms', name: 'תהלים', division: 'ketuvim' },
    { file: 'D2-Proverbs.json', slug: 'proverbs', name: 'משלי', division: 'ketuvim' },
    { file: 'D3-Job.json', slug: 'job', name: 'איוב', division: 'ketuvim' },
    { file: 'E1-Song of Songs.json', slug: 'song-of-songs', name: 'שיר השירים', division: 'ketuvim' },
    { file: 'E2-Ruth.json', slug: 'ruth', name: 'רות', division: 'ketuvim' },
    { file: 'E3-Lamentations.json', slug: 'lamentations', name: 'איכה', division: 'ketuvim' },
    { file: 'E4-Ecclesiastes.json', slug: 'ecclesiastes', name: 'קהלת', division: 'ketuvim' },
    { file: 'E5-Esther.json', slug: 'esther', name: 'אסתר', division: 'ketuvim' },
    { file: 'F1-Daniel.json', slug: 'daniel', name: 'דניאל', division: 'ketuvim' },
    { file: 'FA-Ezra-Nexemiah.json', slug: 'ezra-nehemiah', name: 'עזרא ונחמיה', division: 'ketuvim' },
    { file: 'FC-Chronicles.json', slug: 'chronicles', name: 'דברי הימים', division: 'ketuvim' },
]);

const DIVISIONS = Object.freeze([
    { id: 'torah', name: 'תורה' },
    { id: 'neviim', name: 'נביאים' },
    { id: 'ketuvim', name: 'כתובים' },
]);

function sha256(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function increment(record, key, amount = 1) {
    record[key] = (record[key] || 0) + amount;
}

function revisionOf(repositoryPath) {
    if (!fs.existsSync(path.join(repositoryPath, '.git'))) return null;
    try {
        return execFileSync('git', ['-C', repositoryPath, 'rev-parse', 'HEAD'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    } catch (_error) {
        return null;
    }
}

function allStrings(node, output = []) {
    if (typeof node === 'string') output.push(node);
    else if (Array.isArray(node)) node.forEach((child) => allStrings(child, output));
    else if (node && typeof node === 'object') Object.values(node).forEach((child) => allStrings(child, output));
    return output;
}

function singleTemplateName(node) {
    if (Array.isArray(node)) {
        const meaningful = node.filter((child) => !(typeof child === 'string' && child.trim() === ''));
        return meaningful.length === 1 ? singleTemplateName(meaningful[0]) : null;
    }
    if (!node || typeof node !== 'object') return null;
    return typeof node.tmpl_name === 'string' ? node.tmpl_name : null;
}

function poeticBoundaryFromDocumentation(target, documentation) {
    const marker = singleTemplateName(target);
    if (!['ר1', 'ר3', 'ר4'].includes(marker)) return null;
    const note = allStrings(documentation).join(' ');
    if (marker === 'ר1' && note.includes('פרשה סתומה')) return { marker, normalizedType: 'setumah', note };
    if ((marker === 'ר3' || marker === 'ר4') && note.includes('פרשה פתוחה')) {
        return { marker, normalizedType: 'petuhah', note };
    }
    return null;
}

function sourceLocation(context) {
    return {
        book24: context.book24,
        subBook: context.subBook,
        chapter: context.chapter,
        verse: context.verse,
    };
}

function isNumbersInvertedNunNeighbor(context, marker) {
    return marker === 'ססס'
        && context.book.file === 'A4-Numbers.json'
        && context.chapter === 10
        && (context.verse === 35 || context.verse === 36);
}

function renderSequence(node, context, output = []) {
    if (typeof node === 'string') {
        if (context.column === 'E') output.push({ type: 'text', source: node, calculation: node });
        return output;
    }
    if (Array.isArray(node)) {
        node.forEach((child, index) => renderSequence(child, { ...context, path: `${context.path}/${index}` }, output));
        return output;
    }
    if (!node || typeof node !== 'object' || typeof node.tmpl_name !== 'string') {
        throw new Error(`Unknown MAM node at ${context.book.file} ${context.chapter}:${context.verse} ${context.path}`);
    }

    const marker = node.tmpl_name;
    const params = node.tmpl_params || {};
    increment(context.stats.activeTemplates, marker);

    if (PARASHAH_MARKERS.has(marker)) {
        if (isNumbersInvertedNunNeighbor(context, marker)) {
            increment(context.stats.structuralExceptions, 'numbers-10-inverted-nun-neighbor');
            output.push({ type: 'text', source: ' ', calculation: ' ' });
            return output;
        }
        output.push({
            type: 'boundary',
            upstreamMarker: marker,
            normalizedType: PARASHAH_MARKERS.get(marker),
            location: sourceLocation(context),
            column: context.column,
            sourcePath: context.path,
            position: context.column === 'E' || params['1'] === MID_VERSE_ARGUMENT ? 'inside-verse' : 'before-verse',
            argument: params['1'] || null,
            documentedBy: null,
        });
        return output;
    }

    if (marker === 'נוסח') {
        const poeticBoundary = poeticBoundaryFromDocumentation(params['1'], params['2']);
        if (poeticBoundary) {
            output.push({
                type: 'boundary',
                upstreamMarker: poeticBoundary.marker,
                normalizedType: poeticBoundary.normalizedType,
                location: sourceLocation(context),
                column: context.column,
                sourcePath: `${context.path}/נוסח:1`,
                position: context.column === 'E' ? 'inside-verse' : 'before-verse',
                argument: null,
                documentedBy: { template: 'נוסח', note: poeticBoundary.note },
            });
            increment(context.stats.poeticDocumentedBoundaries, poeticBoundary.marker);
            return output;
        }
        return renderSequence(params['1'], { ...context, path: `${context.path}/נוסח:1` }, output);
    }

    if (marker === 'מ:הערה-2') {
        increment(context.stats.specialConstructs, 'targeted-editorial-notes');
        return renderSequence(params['1'], { ...context, path: `${context.path}/מ:הערה-2:1` }, output);
    }

    if (marker === 'כו״ק' || marker === 'קו״כ' || marker === 'מ:כו״ק מיוחד') {
        increment(context.stats.ketivQere, marker);
        return renderSequence(params['1'], { ...context, path: `${context.path}/${marker}:1` }, output);
    }

    if (marker === 'מ:קו״כ-אם-2') {
        increment(context.stats.ketivQere, marker);
        const sourceEvents = renderSequence(params['1'], { ...context, path: `${context.path}/${marker}:1` }, []);
        const calculationEvents = renderSequence(params['2'], { ...context, path: `${context.path}/${marker}:2` }, []);
        const source = sourceEvents.filter((event) => event.type === 'text').map((event) => event.source).join('');
        const calculation = calculationEvents.filter((event) => event.type === 'text').map((event) => event.calculation).join('');
        if (!source || !calculation || sourceEvents.some((event) => event.type !== 'text') || calculationEvents.some((event) => event.type !== 'text')) {
            throw new Error(`Unexpected trivial ketiv/qere shape at ${context.book.file} ${context.chapter}:${context.verse}`);
        }
        output.push({ type: 'text', source, calculation });
        return output;
    }

    if (marker === 'כתיב ולא קרי') {
        increment(context.stats.ketivQere, marker);
        renderSequence(params['2'], { ...context, path: `${context.path}/${marker}:2` }, output);
        if (params['3'] !== undefined) renderSequence(params['3'], { ...context, path: `${context.path}/${marker}:3` }, output);
        return output;
    }

    if (marker === 'קרי ולא כתיב') {
        increment(context.stats.ketivQere, marker);
        return output;
    }

    if (marker === 'מ:אות-מיוחדת-במילה') {
        increment(context.stats.specialConstructs, 'special-letter-words');
        return renderSequence(params['2'], { ...context, path: `${context.path}/${marker}:2` }, output);
    }

    if (marker === 'מ:אות-ג' || marker === 'מ:אות-ק' || marker === 'מ:אות תלויה') {
        increment(context.stats.specialConstructs, marker);
        return renderSequence(params['1'], { ...context, path: `${context.path}/${marker}:1` }, output);
    }

    if (marker === 'מ:דחי' || marker === 'מ:צינור') {
        return renderSequence(params['1'], { ...context, path: `${context.path}/${marker}:1` }, output);
    }

    if (marker === 'מ:קמץ') {
        return renderSequence(params['ד'], { ...context, path: `${context.path}/${marker}:ד` }, output);
    }

    if (marker === 'מ:כפול') {
        increment(context.stats.specialConstructs, 'dual-cantillation');
        return renderSequence(params['כפול'], { ...context, path: `${context.path}/${marker}:כפול` }, output);
    }

    if (marker === 'מ:לגרמיה-2' || marker === 'מ:פסק') {
        output.push({ type: 'text', source: ' ׀ ', calculation: ' ' });
        return output;
    }

    if (marker === 'מ:מקף אפור') {
        output.push({ type: 'text', source: '־', calculation: '־' });
        return output;
    }

    if (marker === 'מ:נו״ן הפוכה') {
        increment(context.stats.specialConstructs, 'inverted-nun');
        return output;
    }

    if (POETIC_LAYOUT_MARKERS.has(marker)) {
        increment(context.stats.poeticLayout, marker);
        if (context.column === 'E') output.push({ type: 'text', source: ' ', calculation: ' ' });
        return output;
    }

    if (marker === 'מודגש') {
        return renderSequence(params['1'], { ...context, path: `${context.path}/${marker}:1` }, output);
    }

    const ignoredColumnCTemplates = new Set([
        'מ:ספר חדש',
        'מ:רווח בתרי עשר בפסוק הראשון',
        'מ:רווח לספר בתהלים בפסוק הראשון',
        'מ:אין פרשה בתחילת פרק',
        'מ:אין פרשה בתחילת פרק בספרי אמ״ת',
        'מ:אין רווח של פרשה בתחילת פרשת השבוע',
    ]);
    if (context.column === 'C' && ignoredColumnCTemplates.has(marker)) return output;

    throw new Error(`Unhandled MAM template ${marker} at ${context.book.file} ${context.chapter}:${context.verse} ${context.path}`);
}

function normalizeJoinedSourceWhitespace(text) {
    return text.replace(/[\t\r\n ]+/g, ' ').trim();
}

function deriveCalculationText(text) {
    return forceHebrewInput(text).replace(/\s+/g, ' ').trim();
}

function emptyStats() {
    return {
        activeTemplates: {},
        boundaryExact: {},
        boundaryNormalized: {},
        ketivQere: {},
        poeticDocumentedBoundaries: {},
        poeticLayout: {},
        specialConstructs: {},
        structuralExceptions: {},
    };
}

function convertBook(book, data, globalStats) {
    const sections = [];
    const sourceParts = [];
    const calculationParts = [];
    let firstLocator = null;
    let lastLocator = null;
    let locatorCount = 0;
    let lastLocatorKey = null;

    function touchLocator(location) {
        const key = `${location.book24}|${location.subBook || ''}|${location.chapter}|${location.verse}`;
        if (key !== lastLocatorKey) {
            locatorCount += 1;
            lastLocatorKey = key;
        }
        if (!firstLocator) firstLocator = location;
        lastLocator = location;
    }

    function finishSection(boundaryAfter = null) {
        const sourceText = normalizeJoinedSourceWhitespace(sourceParts.join(''));
        const calculationBasis = normalizeJoinedSourceWhitespace(calculationParts.join(''));
        const calculationText = deriveCalculationText(calculationBasis);
        sourceParts.length = 0;
        calculationParts.length = 0;

        if (!calculationText) {
            if (boundaryAfter) throw new Error(`Boundary ${boundaryAfter.upstreamMarker} created an empty section in ${book.file}`);
            return;
        }

        const canonicalResults = computeCoreResults(calculationText, 'aleph-zero');
        const record = {
            id: `${book.slug}-${String(sections.length + 1).padStart(4, '0')}`,
            ordinal: sections.length + 1,
            sourceText,
            calculationText,
            wordCount: canonicalResults.totalWordCount,
            sourceHash: sha256(sourceText),
            calculationHash: sha256(calculationText),
            locators: {
                start: firstLocator,
                end: lastLocator,
                verseCount: locatorCount,
            },
            boundaryAfter,
        };
        sections.push(record);
        globalStats.words += record.wordCount;
        firstLocator = null;
        lastLocator = null;
        locatorCount = 0;
        lastLocatorKey = null;
    }

    for (const sourceBook of data.book39s) {
        globalStats.book39s += 1;
        const chapterEntries = Object.entries(sourceBook.chapters).sort((a, b) => Number(a[0]) - Number(b[0]));
        globalStats.chapters += chapterEntries.length;
        for (const [chapterKey, verses] of chapterEntries) {
            const chapter = Number(chapterKey);
            const verseEntries = Object.entries(verses).sort((a, b) => Number(a[0]) - Number(b[0]));
            for (const [verseKey, columns] of verseEntries) {
                const verse = Number(verseKey);
                globalStats.verses += 1;
                if (!Array.isArray(columns) || columns.length !== 3) {
                    throw new Error(`Expected [C,D,E] at ${book.file} ${chapter}:${verse}`);
                }
                const baseContext = {
                    book,
                    book24: sourceBook.book24_name,
                    subBook: sourceBook.sub_book_name,
                    chapter,
                    verse,
                    stats: globalStats,
                };

                const cEvents = renderSequence(columns[0], { ...baseContext, column: 'C', path: 'C' });
                const eEvents = renderSequence(columns[2], { ...baseContext, column: 'E', path: 'E' });
                for (const event of [...cEvents, ...eEvents]) {
                    if (event.type === 'boundary') {
                        finishSection({
                            upstreamMarker: event.upstreamMarker,
                            normalizedType: event.normalizedType,
                            location: event.location,
                            column: event.column,
                            sourcePath: event.sourcePath,
                            position: event.position,
                            argument: event.argument,
                            documentedBy: event.documentedBy,
                        });
                        increment(globalStats.boundaryExact, event.upstreamMarker);
                        increment(globalStats.boundaryNormalized, event.normalizedType);
                        globalStats.boundaries += 1;
                    } else {
                        if ((event.source && HEBREW_LETTER_RE.test(event.source)) || (event.calculation && HEBREW_LETTER_RE.test(event.calculation))) {
                            touchLocator(sourceLocation(baseContext));
                        }
                        sourceParts.push(event.source);
                        calculationParts.push(event.calculation);
                    }
                }
                sourceParts.push(' ');
                calculationParts.push(' ');
            }
        }
    }
    finishSection();

    globalStats.sections += sections.length;
    return {
        schemaVersion: SCHEMA_VERSION,
        book: { slug: book.slug, name: book.name, division: book.division },
        sourceFile: `plus/${book.file}`,
        sourceBookNames: data.book39s.map((sourceBook) => ({
            book24: sourceBook.book24_name,
            subBook: sourceBook.sub_book_name,
        })),
        statistics: {
            sections: sections.length,
            words: sections.reduce((sum, section) => sum + section.wordCount, 0),
        },
        sections,
    };
}

function stableJson(value, pretty = false) {
    return `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
}

function readArguments(argv) {
    const options = {
        sourcePath: path.resolve(process.env.MAM_PARSED_PATH || path.join(WORKSPACE_ROOT, 'MAM-parsed')),
        basicsPath: path.resolve(process.env.MAM_BASICS_PATH || path.join(WORKSPACE_ROOT, 'MAM-basics')),
        outputPath: path.join(REPO_ROOT, 'public', 'corpus'),
        check: false,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--check') options.check = true;
        else if (argument === '--source') options.sourcePath = path.resolve(argv[++index]);
        else if (argument === '--basics') options.basicsPath = path.resolve(argv[++index]);
        else if (argument === '--output') options.outputPath = path.resolve(argv[++index]);
        else throw new Error(`Unknown argument: ${argument}`);
    }
    return options;
}

function expectedOutput(options) {
    const plusPath = path.join(options.sourcePath, 'plus');
    if (!fs.existsSync(plusPath)) throw new Error(`MAM-parsed plus corpus not found: ${plusPath}`);
    if (!fs.existsSync(options.basicsPath)) throw new Error(`MAM-basics not found: ${options.basicsPath}`);

    const stats = {
        ...emptyStats(),
        sourceFiles: 0,
        book39s: 0,
        chapters: 0,
        verses: 0,
        sections: 0,
        boundaries: 0,
        words: 0,
    };
    const files = new Map();
    const bookPayloads = [];

    for (const book of BOOKS) {
        const sourceFile = path.join(plusPath, book.file);
        if (!fs.existsSync(sourceFile)) throw new Error(`Missing source book: ${sourceFile}`);
        const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
        stats.sourceFiles += 1;
        const payload = convertBook(book, data, stats);
        const contents = stableJson(payload);
        const relativeFile = `books/${book.slug}.json`;
        files.set(relativeFile, contents);
        bookPayloads.push({ book, payload, contents, relativeFile });
    }

    const contentHash = sha256(bookPayloads.map(({ contents }) => contents).join(''));
    const provenance = {
        schemaVersion: SCHEMA_VERSION,
        converterVersion: CONVERTER_VERSION,
        corpusId: 'mam-parsed-plus-ketiv-sections',
        source: {
            name: 'MAM-parsed',
            revision: revisionOf(options.sourcePath),
            format: 'MAM-parsed/plus JSON [C,D,E] verse tuples',
            files: BOOKS.map((book) => `plus/${book.file}`),
        },
        semanticsReference: {
            name: 'MAM-basics',
            revision: revisionOf(options.basicsPath),
            reusePolicy: 'Semantics were independently implemented; GPL source code was not copied.',
        },
        transformation: {
            textPolicy: 'ketiv-only',
            qerePolicy: 'omitted, including qere-without-ketiv; ketiv-without-qere retained',
            sourceText: 'Selected upstream Hebrew spans preserve code-point order; only inter-span ASCII whitespace is joined.',
            calculationText: 'Derived with AlephEfes forceHebrewInput; Hebrew marks, MAM ordering controls (U+034F), and U+FB1E are removed, and maqaf is resolved by the canonical tokenizer.',
            verseAndChapterRole: 'locator metadata only; never analytical boundaries',
            bookRole: 'storage/navigation partition and initial stream boundary only',
            dualCantillation: 'מ:כפול selects only the כפול (combined/codex) branch',
            documentation: 'נוסח and מ:הערה-2 contribute only their target parameter; notes are excluded',
            repeatedEditorialMaterial: 'good_ending_plus is excluded',
            structuralInterpretation: [
                'פפ/פפפ normalize to petuhah; סס/ססס normalize to setumah.',
                'מ:ששש is retained as a distinct shirah setumah-like section divider.',
                'Documented נוסח targets ר1/ר3/ר4 become setumah/petuhah only when the note explicitly identifies that parashah; other ר0–ר4 are layout.',
                'The two ססס adjacent to inverted nuns at Numbers 10:35–36 are spacing, not boundaries.',
            ],
        },
        statistics: stats,
        contentHash,
        ambiguousCases: [
            {
                marker: 'מ:ששש',
                occurrences: stats.boundaryExact['מ:ששש'],
                resolution: 'retained as the distinct analytical type shirah-setumah-like',
                evidenceConflict: [
                    'MAM authoring semantics describe it as a setumah-like section divider.',
                    'MAM renderers emit shirah spacing and the sampe distributor does not classify it with פ/ס.',
                ],
                rationale: 'Retaining the exact marker as a separate type preserves its divider semantics without claiming that it is an ordinary petuhah or setumah.',
            },
        ],
        exceptionalCases: [
            { type: 'non-boundary', marker: 'ססס', locations: ['Numbers 10:35', 'Numbers 10:36'], reason: 'inverted-nun-neighbor spacing' },
            { type: 'contextual-boundary', markers: ['ר1', 'ר3', 'ר4'], count: Object.values(stats.poeticDocumentedBoundaries).reduce((sum, count) => sum + count, 0) },
            { type: 'dual-cantillation', passages: ['Genesis 35:22', 'Exodus 20', 'Deuteronomy 5'], selectedBranch: 'כפול' },
        ],
        license: {
            corpus: 'CC-BY-SA-4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            attributionEnglish: 'Hebrew Wikisource',
            attributionHebrew: 'ויקיטקסט',
            sourcePageEnglish: 'https://en.wikisource.org/wiki/User:Dovi/Miqra_according_to_the_Masorah#beginning',
            sourcePageHebrew: 'https://he.wikisource.org/wiki/מקרא_על_פי_המסורה#ראש',
            credits: ['Seth (Avi) Kadish', 'Erel Segal-Halevi', 'Benjamin Denckla'],
        },
    };

    const manifest = {
        schemaVersion: SCHEMA_VERSION,
        corpusId: provenance.corpusId,
        language: 'he',
        direction: 'rtl',
        provenance: 'provenance.json',
        contentHash,
        statistics: {
            books: BOOKS.length,
            sections: stats.sections,
            boundaries: stats.boundaries,
            words: stats.words,
        },
        divisions: DIVISIONS.map((division) => ({
            ...division,
            books: bookPayloads
                .filter(({ book }) => book.division === division.id)
                .map(({ book, payload, relativeFile }) => ({
                    slug: book.slug,
                    name: book.name,
                    file: relativeFile,
                    sections: payload.statistics.sections,
                    words: payload.statistics.words,
                })),
        })),
    };

    files.set('provenance.json', stableJson(provenance, true));
    files.set('manifest.json', stableJson(manifest, true));
    return { files, manifest, provenance };
}

function writeOrCheck(options, generated) {
    const expectedNames = new Set(generated.files.keys());
    const mismatches = [];
    for (const [relativeFile, contents] of generated.files.entries()) {
        const outputFile = path.join(options.outputPath, relativeFile);
        if (options.check) {
            if (!fs.existsSync(outputFile) || fs.readFileSync(outputFile, 'utf8') !== contents) mismatches.push(relativeFile);
            continue;
        }
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        if (!fs.existsSync(outputFile) || fs.readFileSync(outputFile, 'utf8') !== contents) fs.writeFileSync(outputFile, contents, 'utf8');
    }

    if (fs.existsSync(options.outputPath)) {
        const existingBookPath = path.join(options.outputPath, 'books');
        if (fs.existsSync(existingBookPath)) {
            for (const name of fs.readdirSync(existingBookPath)) {
                const relativeName = `books/${name}`;
                if (name.endsWith('.json') && !expectedNames.has(relativeName)) {
                    if (options.check) mismatches.push(relativeName);
                    else fs.rmSync(path.join(existingBookPath, name));
                }
            }
        }
    }
    if (mismatches.length) throw new Error(`Generated corpus differs: ${mismatches.sort().join(', ')}`);
}

function generateCorpus(options) {
    const generated = expectedOutput(options);
    writeOrCheck(options, generated);
    return generated;
}

function isMainModule() {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
    const options = readArguments(process.argv.slice(2));
    const generated = generateCorpus(options);
    const statistics = generated.provenance.statistics;
    process.stdout.write(`${options.check ? 'Verified' : 'Generated'} ${statistics.sections} sections, ${statistics.boundaries} boundaries, ${statistics.words} words.\n`);
}

export {
    BOOKS,
    CONVERTER_VERSION,
    DIVISIONS,
    SCHEMA_VERSION,
    deriveCalculationText,
    expectedOutput,
    generateCorpus,
    poeticBoundaryFromDocumentation,
    readArguments,
    renderSequence,
};
