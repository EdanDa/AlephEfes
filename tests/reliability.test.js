import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoreResults } from '../src/core/analysisCore.js';
import { buildValueInsights } from '../src/core/valueInsights.js';
import { getPinnedClusters } from '../src/core/wordConnections.js';
import { appReducer, initialState } from '../src/state/appReducer.js';
import { restoreSession, saveSession, SESSION_KEY } from '../src/state/sessionStorage.js';
import { withCSVMetadata } from '../src/utils/exportMetadata.js';

const allLayers = { U: true, T: true, H: true, Prime: false };
const storage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('value insights count occurrences once per value, retaining every matching layer in both modes', () => {
    for (const mode of ['aleph-zero', 'aleph-one']) {
        const core = computeCoreResults('אב אב בא', mode);
        const [row] = buildValueInsights(core, allLayers);
        assert.equal(row.totalOccurrences, 3);
        assert.equal(row.uniqueWordCount, 2);
        assert.equal(row.avgOccurrences, 1.5);
        assert.equal(row.topWords[0].word, 'אב');
        assert.deepEqual(row.topWords[0].layers, ['H', 'T', 'U']);
        assert.equal(row.topWords.length, 2);
        assert.equal(buildValueInsights(core, { ...allLayers, T: false, H: false })[0].totalOccurrences, 3);
    }
});

test('insights respect prime and digital-root filters without changing occurrence weights', () => {
    const core = computeCoreResults('אב אב בא גד גד גד', 'aleph-zero');
    assert.deepEqual(buildValueInsights(core, { ...allLayers, Prime: true }).map((row) => [row.value, row.totalOccurrences]), [[5, 3]]);
    assert.equal(buildValueInsights(core, allLayers, 1)[0].totalOccurrences, 3);
});

test('a pinned summary excludes unrelated words and connections through hidden layers', () => {
    const core = computeCoreResults('אב בא גד ברא אל', 'aleph-zero');
    const clusters = [{ dr: 1, words: core.allWords }];
    const selected = getPinnedClusters(clusters, core.wordDataMap.get('אב'), allLayers);
    assert.deepEqual(selected.flatMap((group) => group.words.map((word) => word.word)), ['אב', 'בא']);
    const onlyUnits = getPinnedClusters(clusters, core.wordDataMap.get('ברא'), { ...allLayers, T: false, H: false });
    assert.deepEqual(onlyUnits.flatMap((group) => group.words.map((word) => word.word)), ['ברא']);
    assert.deepEqual(getPinnedClusters([{ dr: 1, words: [core.wordDataMap.get('אב')] }], core.wordDataMap.get('ברא'), allLayers), []);
});

test('changed text and modes clear obsolete drilldowns, hover and expansion state', () => {
    const dirty = { ...initialState, text: 'אב', hoveredWord: { word: 'אב' }, selectedHotValue: 1, hotWordsList: [{ word: 'אב' }], expandedRows: { 0: true }, corpusSelection: { bookSlug: 'genesis' }, isInputDirty: true };
    for (const action of [{ type: 'SET_TEXT', payload: 'גד' }, { type: 'SET_MODE', payload: 'aleph-one' }]) {
        const next = appReducer(dirty, action);
        assert.equal(next.selectedHotValue, null);
        assert.equal(next.hoveredWord, null);
        assert.deepEqual(next.expandedRows, {});
        assert.deepEqual(next.hotWordsList, []);
    }
    const edited = appReducer(dirty, { type: 'SET_TEXT', payload: 'גד' });
    assert.equal(edited.corpusSelection, null);
    assert.equal(edited.isInputDirty, false);
    assert.equal(appReducer({ ...dirty, coreResults: {} }, { type: 'SET_TEXT', payload: '' }).coreResults, null);
});

test('loading a corpus selection attaches its metadata through the live reducer', () => {
    const selection = { bookSlug: 'genesis', scope: 'section' };
    const next = appReducer(initialState, { type: 'LOAD_CORPUS_SELECTION', payload: { text: 'אב', selection } });
    assert.equal(next.text, 'אב');
    assert.equal(next.corpusSelection, selection);
    assert.equal(appReducer(next, { type: 'SET_TEXT', payload: 'אב' }).corpusSelection, selection);
    assert.equal(appReducer(next, { type: 'CLEAR_CORPUS_SELECTION' }).corpusSelection, null);
});

test('session restoration preserves text, mode and source atomically and migrates legacy text', () => {
    const local = storage();
    local.setItem('alephCodeText', 'ישן');
    assert.equal(restoreSession(initialState, local).text, 'ישן');
    const selection = { bookSlug: 'genesis', bookName: 'בראשית', scope: 'range', startSectionOrdinal: 3, endSectionOrdinal: 5, sectionCount: 3 };
    const session = { ...initialState, text: 'אב', mode: 'aleph-one', corpusSelection: selection };
    saveSession(session, local);
    const restored = restoreSession(initialState, local);
    assert.equal(restored.text, 'אב');
    assert.equal(restored.mode, 'aleph-one');
    assert.deepEqual(restored.corpusSelection, selection);
    assert.equal(JSON.parse(local.getItem(SESSION_KEY)).version, 1);
});

test('malformed, unavailable, and full storage cannot crash session handling', () => {
    const local = storage();
    local.setItem(SESSION_KEY, '{');
    local.setItem('alephCodeText', 'אב');
    assert.equal(restoreSession(initialState, local).text, 'אב');
    local.setItem(SESSION_KEY, JSON.stringify({ version: 1, text: 'גד', mode: 'aleph-one', corpusSelection: { startSectionOrdinal: -1 } }));
    assert.equal(restoreSession(initialState, local).corpusSelection, null);
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    assert.equal(restoreSession(initialState, blocked), initialState);
    assert.doesNotThrow(() => saveSession(initialState, blocked));
});

test('CSV metadata preserves quoted newlines, escaped quotes, zero values and source sections', () => {
    const csv = 'word,count\n"אב\n""בא""",0';
    const result = withCSVMetadata(csv, { mode: 'aleph-zero', filters: { ...allLayers, H: false }, corpusSelection: { bookSlug: 'genesis', startSectionOrdinal: 3, endSectionOrdinal: 5 } });
    assert.ok(result.startsWith('analysis_mode,filter_units,filter_tens,filter_hundreds,filter_prime,source_book,source_start_section,source_end_section,word,count\n'));
    assert.ok(result.endsWith('aleph-zero,true,true,false,false,genesis,3,5,"אב\n""בא""",0'));
});
