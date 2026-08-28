import assert from 'node:assert/strict';
import test from 'node:test';

import {
    RETRY_HISTORY_KEY,
    RETRY_STORAGE_KEY,
    chunkErrorSignature,
    isChunkLoadError,
    reloadForChunkError,
} from '../src/core/chunkRecovery.js';

function createBrowserWindow() {
    const entries = new Map();
    let reloads = 0;
    const history = {
        state: null,
        replaceState(nextState) {
            this.state = nextState;
        },
    };

    return {
        document: { title: 'AlephEfes' },
        history,
        location: { reload: () => { reloads += 1; } },
        sessionStorage: {
            getItem: (key) => entries.get(key) || null,
            setItem: (key, value) => entries.set(key, value),
        },
        reloadCount: () => reloads,
        storedRetry: () => entries.get(RETRY_STORAGE_KEY),
    };
}

test('recognizes Vite and browser dynamic-import failures', () => {
    assert.equal(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/Tanakh.js')), true);
    assert.equal(isChunkLoadError(new Error('Importing a module script failed.')), true);
    assert.equal(isChunkLoadError(new Error('Regular render failure')), false);
});

test('reloads only once for the same stale chunk', () => {
    const browserWindow = createBrowserWindow();
    const error = new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/Tanakh-OLD.js');
    const signature = chunkErrorSignature(error);

    assert.equal(reloadForChunkError(error, browserWindow), true);
    assert.equal(browserWindow.reloadCount(), 1);
    assert.equal(browserWindow.storedRetry(), signature);
    assert.equal(browserWindow.history.state[RETRY_HISTORY_KEY], signature);

    assert.equal(reloadForChunkError(error, browserWindow), false);
    assert.equal(browserWindow.reloadCount(), 1);
});

test('allows one recovery attempt for a different deployed chunk', () => {
    const browserWindow = createBrowserWindow();
    const first = new Error('Loading chunk 4 failed: https://example.test/assets/First-OLD.js');
    const second = new Error('Loading chunk 9 failed: https://example.test/assets/Second-OLD.js');

    assert.equal(reloadForChunkError(first, browserWindow), true);
    assert.equal(reloadForChunkError(second, browserWindow), true);
    assert.equal(browserWindow.reloadCount(), 2);
});

test('does not risk a reload loop when no retry marker can be stored', () => {
    const browserWindow = createBrowserWindow();
    browserWindow.sessionStorage = {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
    };
    browserWindow.history.replaceState = () => { throw new Error('blocked'); };

    assert.equal(reloadForChunkError(new Error('ChunkLoadError'), browserWindow), false);
    assert.equal(browserWindow.reloadCount(), 0);
});
