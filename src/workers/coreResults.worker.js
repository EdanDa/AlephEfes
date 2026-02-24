import { computeCoreResults } from '../core/analysisCore';

self.onmessage = (event) => {
    const { requestId, text, mode } = event.data || {};
    if (typeof text !== 'string' || (mode !== 'aleph-zero' && mode !== 'aleph-one')) return;

    try {
        const results = computeCoreResults(text, mode);
        self.postMessage({ requestId, results });
    } catch (error) {
        self.postMessage({
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
