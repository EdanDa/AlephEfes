const CHUNK_ERROR_PATTERNS = [
    /Failed to fetch dynamically imported module/iu,
    /Importing a module script failed/iu,
    /error loading dynamically imported module/iu,
    /Failed to load module script/iu,
    /Loading chunk [\d]+ failed/iu,
    /ChunkLoadError/iu,
];

const RETRY_STORAGE_KEY = 'alephEfes:chunk-retry';
const RETRY_HISTORY_KEY = '__alephEfesChunkRetry';

function errorMessage(error) {
    if (typeof error === 'string') return error;
    if (error && typeof error.message === 'string') return error.message;
    return '';
}

function isChunkLoadError(error) {
    const message = errorMessage(error);
    return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function chunkErrorSignature(error) {
    const message = errorMessage(error).trim();
    const moduleUrl = message.match(/https?:\/\/[^\s`"']+\.js(?:\?[^\s`"']*)?/iu)?.[0];
    return `v1:${moduleUrl || message.slice(0, 500)}`;
}

function reloadForChunkError(error, browserWindow = globalThis.window) {
    if (!isChunkLoadError(error) || !browserWindow?.location?.reload) return false;

    const signature = chunkErrorSignature(error);
    let storage = null;
    let previousStorageSignature = null;
    try {
        storage = browserWindow.sessionStorage;
        previousStorageSignature = storage?.getItem(RETRY_STORAGE_KEY) || null;
    } catch (_storageError) {
        storage = null;
    }

    let previousHistorySignature = null;
    try {
        previousHistorySignature = browserWindow.history?.state?.[RETRY_HISTORY_KEY] || null;
    } catch (_historyError) {
        previousHistorySignature = null;
    }

    if (previousStorageSignature === signature || previousHistorySignature === signature) return false;

    let retryRecorded = false;
    try {
        storage?.setItem(RETRY_STORAGE_KEY, signature);
        retryRecorded = Boolean(storage);
    } catch (_storageError) {
        retryRecorded = false;
    }

    try {
        const historyState = browserWindow.history?.state && typeof browserWindow.history.state === 'object'
            ? browserWindow.history.state
            : {};
        browserWindow.history?.replaceState(
            { ...historyState, [RETRY_HISTORY_KEY]: signature },
            browserWindow.document?.title || '',
        );
        retryRecorded = Boolean(browserWindow.history?.replaceState) || retryRecorded;
    } catch (_historyError) {
        // sessionStorage is the primary guard; history state is a fallback.
    }

    if (!retryRecorded) return false;
    browserWindow.location.reload();
    return true;
}

export {
    RETRY_HISTORY_KEY,
    RETRY_STORAGE_KEY,
    chunkErrorSignature,
    isChunkLoadError,
    reloadForChunkError,
};
