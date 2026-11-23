import test from 'node:test';
import assert from 'node:assert/strict';
import { appReducer, initialState } from '../src/state/appReducer.js';
import { restoreSession, saveSession, SESSION_KEY } from '../src/state/sessionStorage.js';
test('version one sessions migrate and workspace preferences are validated without retaining temporary selections', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
    storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, text: 'אב', mode: 'aleph-one' }));
    assert.equal(restoreSession(initialState, storage).view, 'clusters');
    assert.equal(restoreSession(initialState, storage).wordNumberingStart, 1);
    const state = { ...initialState, text: 'אב', view: 'lines', isEditorCollapsed: true, textSize: 'lg', wordNumberingStart: 0, filters: { U: true, T: false, H: false, Prime: true }, pinnedWord: { word: 'אב' } };
    saveSession(state, storage);
    const restored = restoreSession(initialState, storage);
    for (const key of ['text', 'view', 'textSize', 'wordNumberingStart', 'filters']) assert.deepEqual(restored[key], state[key]);
    assert.equal(restored.isEditorCollapsed, undefined);
    assert.equal(restored.pinnedWord, null);
    storage.setItem(SESSION_KEY, JSON.stringify({ version: 2, text: 'אב', mode: 'aleph-zero', preferences: { view: 'invalid', textSize: 'giant', wordNumberingStart: '0', filters: { U: 'true' } } }));
    assert.equal(restoreSession(initialState, storage).view, 'clusters');
    assert.equal(restoreSession(initialState, storage).wordNumberingStart, 1);
    assert.deepEqual(restoreSession(initialState, storage).filters, initialState.filters);
});

test('resetting filters restores the full scope and clears obsolete selections', () => {
    const state = appReducer({ ...initialState, searchTerm: 'אב', selectedDR: 3, selectedHotValue: 12, filters: { U: false, T: false, H: false, Prime: true } }, { type: 'RESET_FILTERS' });
    assert.deepEqual(state.filters, initialState.filters);
    assert.equal(state.searchTerm, ''); assert.equal(state.selectedDR, null); assert.equal(state.selectedHotValue, null);
});

for (const [previous, current] of [['network', 'clusters'], ['graph', 'hot-words']]) {
    test(`saved ${previous} sessions reopen in ${current} with the passage and preferences`, () => {
        const record = { version: 2, text: 'אב בא', mode: 'aleph-one', preferences: { view: previous, textSize: 'lg' } };
        const restored = restoreSession(initialState, { getItem: () => JSON.stringify(record) });
        assert.equal(restored.view, current);
        assert.equal(restored.text, record.text);
        assert.equal(restored.mode, record.mode);
        assert.equal(restored.textSize, 'lg');
    });
}
