import assert from 'node:assert/strict';
import test from 'node:test';
import { appReducer, initialState } from '../src/state/appReducer.js';

test('SET_PINNED_WORD toggles same word off', () => {
    const wordData = { word: 'אבג' };
    const afterPin = appReducer(initialState, { type: 'SET_PINNED_WORD', payload: wordData });
    assert.equal(afterPin.pinnedWord.word, 'אבג');

    const afterToggle = appReducer(afterPin, { type: 'SET_PINNED_WORD', payload: wordData });
    assert.equal(afterToggle.pinnedWord, null);
});

test('SET_VIEW clears transient state', () => {
    const dirty = {
        ...initialState,
        pinnedWord: { word: 'אבג' },
        hoveredWord: { word: 'דהו' },
        selectedDR: 7,
        selectedHotValue: 52,
        copiedId: 'abc',
        isValueTableOpen: true,
    };

    const next = appReducer(dirty, { type: 'SET_VIEW', payload: 'hot-words' });
    assert.equal(next.view, 'hot-words');
    assert.equal(next.pinnedWord, null);
    assert.equal(next.hoveredWord, null);
    assert.equal(next.selectedDR, null);
    assert.equal(next.selectedHotValue, null);
    assert.equal(next.copiedId, null);
    assert.equal(next.isValueTableOpen, false);
});

test('SET_SELECTED_DR toggles on same value', () => {
    const once = appReducer(initialState, { type: 'SET_SELECTED_DR', payload: 5 });
    assert.equal(once.selectedDR, 5);

    const twice = appReducer(once, { type: 'SET_SELECTED_DR', payload: 5 });
    assert.equal(twice.selectedDR, null);
});

test('TOGGLE_FILTER flips only selected filter key', () => {
    const next = appReducer(initialState, { type: 'TOGGLE_FILTER', payload: 'Prime' });
    assert.equal(next.filters.Prime, true);
    assert.equal(next.filters.U, true);
    assert.equal(next.filters.T, true);
    assert.equal(next.filters.H, true);
});

test('TOGGLE_ALL_ROWS expands then collapses', () => {
    const stateWithRows = {
        ...initialState,
        coreResults: { lines: [{}, {}, {}] },
        expandedRows: {},
    };

    const expanded = appReducer(stateWithRows, { type: 'TOGGLE_ALL_ROWS' });
    assert.deepEqual(expanded.expandedRows, { 0: true, 1: true, 2: true });

    const collapsed = appReducer(expanded, { type: 'TOGGLE_ALL_ROWS' });
    assert.deepEqual(collapsed.expandedRows, {});
});
