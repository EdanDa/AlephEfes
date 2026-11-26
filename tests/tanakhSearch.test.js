import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTanakhSearchInput, normalizeTypedTanakhSearchInput } from '../src/core/searchInput.js';
import { buildSpellingIndex, findSpellingMatches, matchesSectionFilter, sourceMatchRange } from '../src/core/tanakhSearch.js';

const corpus = buildSpellingIndex(JSON.parse(readFileSync(new URL('../public/corpus/aleph-efes-tanakh-word-occurrences.json', import.meta.url), 'utf8')));

test('Tanakh search keeps only Hebrew letters and spaces, including final forms', () => {
    assert.equal(normalizeTanakhSearchInput(' בְּרֵאשִׁ֖ית\nעַל־פְּנֵ֣י ךםןףץ  '), 'בראשית על פני ךםןףץ ');
    assert.equal(normalizeTanakhSearchInput('123+ABC🙂'), '');
    assert.equal(normalizeTanakhSearchInput('שָׁלוֹם!'), 'שלום');
});

test('English-layout typing uses Hebrew key positions, including the final-letter keys', () => {
    assert.equal(normalizeTypedTanakhSearchInput('crtah, crt'), 'בראשית ברא');
    assert.equal(normalizeTypedTanakhSearchInput('l oi;. 123+'), 'ך םןףץ ');
    assert.equal(normalizeTypedTanakhSearchInput('שָׁלוֹם'), 'שלום');
});

test('exact phrases include overlapping occurrences on both sides of a divider', () => {
    const index = buildSpellingIndex({ sectionIds: ['a-0001', 'a-0002'], bookStarts: [[0, 1]], occurrencesByWord: {
        שם: [[0, 1], [0, 2], [0, 3], [1, 1]], ושם: [[1, 2]], שמ: [[1, 3]],
    } });
    const positions = words => findSpellingMatches(index, words).map(hit => [hit.section, hit.position, hit.endSection, hit.endPosition]);
    assert.deepEqual(positions(['שם', 'שם']), [[0, 1, 0, 2], [0, 2, 0, 3], [0, 3, 1, 1]]);
    assert.deepEqual(positions(['שמ']), [[1, 3, 1, 3]]);
    assert.deepEqual(positions(['ש']), []);
    const source = 'שָׁם שָׁ֖ם־שָֽׁם׃';
    assert.equal(source.slice(...sourceMatchRange(source, 2, 2)), 'שָׁ֖ם־שָֽׁם');
});

test('all seven Genesis transitions each match exactly once in Genesis', () => {
    const phrases = ['יום אחד ויאמר אלהים', 'יום שני ויאמר אלהים', 'יום שלישי ויאמר אלהים', 'יום רביעי ויאמר אלהים',
        'יום חמישי ויאמר אלהים', 'יום הששי ויכלו השמים', 'אלהים לעשות אלה תולדות'];
    phrases.forEach((phrase, section) => {
        const hits = findSpellingMatches(corpus, phrase.split(' ')).filter(hit => corpus.sectionIds[hit.section].startsWith('genesis-'));
        assert.deepEqual(hits.map(hit => [hit.section, hit.endSection, hit.endPosition]), [[section, section + 1, 2]], phrase);
        assert.ok(matchesSectionFilter(corpus, hits[0], 'petuhah'));
        assert.ok(!matchesSectionFilter(corpus, hits[0], 'within'));
    });
});

test('the Song of the Sea can match a whole unit or span several setumah-like dividers', () => {
    const firstLine = 'מי כמכה באלם יהוה';
    const [line] = findSpellingMatches(corpus, firstLine.split(' '));
    assert.ok(matchesSectionFilter(corpus, line, 'whole'));
    const [hit] = findSpellingMatches(corpus, (firstLine + ' מי כמכה נאדר בקדש נורא תהלת עשה פלא').split(' '));
    assert.deepEqual([corpus.sectionIds[hit.section], hit.position, corpus.sectionIds[hit.endSection], hit.endPosition],
        ['exodus-0064', 1, 'exodus-0066', 4]);
    for (const filter of ['across', 'count:2', 'shirah-setumah-like']) assert.ok(matchesSectionFilter(corpus, hit, filter));
    for (const filter of ['within', 'whole', 'count:1', 'setumah']) assert.ok(!matchesSectionFilter(corpus, hit, filter));
});

test('a phrase stops at every individual book boundary, including the break inside Kings section 121', () => {
    assert.equal(corpus.bookOffsets.length - 1, 39);
    const kings = corpus.sectionIds.indexOf('kings-0121');
    assert.ok(corpus.bookOffsets.some(start => start > corpus.offsets[kings] && start < corpus.offsets[kings + 1]));
    for (const start of corpus.bookOffsets.slice(1, -1)) {
        const words = corpus.tokens.slice(start - 2, start + 2);
        assert.ok(!findSpellingMatches(corpus, words).some(hit => hit.start === start - 2), words.join(' '));
        assert.ok(findSpellingMatches(corpus, words.slice(0, 2)).some(hit => hit.end === start));
        assert.ok(findSpellingMatches(corpus, words.slice(2)).some(hit => hit.start === start));
    }
});

test('Psalms book-part spacing remains searchable inside the book of Psalms', () => {
    const section = corpus.boundariesAfter.findIndex((boundary, i) => corpus.sectionIds[i].startsWith('psalms-') &&
        boundary?.normalizedType === 'masoretic-book-part-spacing');
    assert.ok(section >= 0);
    const divider = corpus.offsets[section + 1];
    const hit = findSpellingMatches(corpus, corpus.tokens.slice(divider - 2, divider + 2)).find(match => match.endSection === section + 1 && match.endPosition === 2);
    assert.ok(hit && matchesSectionFilter(corpus, hit, 'masoretic-book-part-spacing'));
});
