import test from 'node:test';
import assert from 'node:assert/strict';
import { appReducer, initialState } from '../src/state/appReducer.js';
import { restoreSession, saveSession, SESSION_KEY } from '../src/state/sessionStorage.js';
import { computeCoreResults } from '../src/core/analysisCore.js';
import { buildWordConnectionIndex } from '../src/core/networkLayout.js';

test('version one sessions migrate and workspace preferences are validated without retaining temporary selections', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
    storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, text: 'אב', mode: 'aleph-one' }));
    assert.equal(restoreSession(initialState, storage).view, 'clusters');
    const state = { ...initialState, text: 'אב', view: 'network', isEditorCollapsed: true, textSize: 'lg', filters: { U: true, T: false, H: false, Prime: true }, pinnedWord: { word: 'אב' } };
    saveSession(state, storage);
    const restored = restoreSession(initialState, storage);
    for (const key of ['text', 'view', 'isEditorCollapsed', 'textSize', 'filters']) assert.deepEqual(restored[key], state[key]);
    assert.equal(restored.pinnedWord, null);
    storage.setItem(SESSION_KEY, JSON.stringify({ version: 2, text: 'אב', mode: 'aleph-zero', preferences: { view: 'invalid', textSize: 'giant', filters: { U: 'true' } } }));
    assert.equal(restoreSession(initialState, storage).view, 'clusters');
    assert.deepEqual(restoreSession(initialState, storage).filters, initialState.filters);
});

test('resetting filters restores the full scope and clears obsolete selections', () => {
    const state = appReducer({ ...initialState, searchTerm: 'אב', selectedDR: 3, selectedHotValue: 12, filters: { U: false, T: false, H: false, Prime: true } }, { type: 'RESET_FILTERS' });
    assert.deepEqual(state.filters, initialState.filters);
    assert.equal(state.searchTerm, ''); assert.equal(state.selectedDR, null); assert.equal(state.selectedHotValue, null);
});

test('network topology retains every visible word/value relationship independently of the layout', () => {
    const core = computeCoreResults('אב אב בא גד', 'aleph-zero');
    const graph = buildWordConnectionIndex(core, initialState.filters, null);
    assert.equal(graph.nodes.filter((node) => node.type === 'word').length, 3);
    assert.equal(graph.links.length, 9);
    const filtered = buildWordConnectionIndex(core, { U: true, T: false, H: false, Prime: false }, null);
    assert.equal(filtered.links.length, 3);
});
