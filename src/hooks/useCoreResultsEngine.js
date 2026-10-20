import { useCallback, useEffect, useRef, useState } from 'react';
import { computeCoreResults } from '../core/analysisCore';

export function useCoreResultsEngine({ deferredText, mode, onResults }) {
    const [jobState, setJobState] = useState(null);
    const [attempt, setAttempt] = useState(0);
    const [engineStats, setEngineStats] = useState({
        workerAvailable: false, fallbackCount: 0, workerSuccessCount: 0,
        workerErrorCount: 0, lastDurationMs: 0,
    });
    const versionRef = useRef(0);
    const workerRef = useRef(null);
    const fallbackRef = useRef(null);
    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    useEffect(() => {
        let worker;
        const handleFailure = (event) => {
            event?.preventDefault?.();
            workerRef.current = null;
            worker?.terminate();
            setEngineStats((prev) => ({ ...prev, workerAvailable: false, workerErrorCount: prev.workerErrorCount + 1 }));
            fallbackRef.current?.();
        };
        try {
            worker = new Worker(new URL('../workers/coreResults.worker.js', import.meta.url), { type: 'module' });
            worker.addEventListener('error', handleFailure);
            worker.addEventListener('messageerror', handleFailure);
            workerRef.current = worker;
            setEngineStats((prev) => ({ ...prev, workerAvailable: true }));
        } catch {
            workerRef.current = null;
        }
        return () => {
            worker?.removeEventListener('error', handleFailure);
            worker?.removeEventListener('messageerror', handleFailure);
            worker?.terminate();
            workerRef.current = null;
        };
    }, [attempt]);

    useEffect(() => {
        const requestId = ++versionRef.current;
        let cancelled = false;
        let finished = false;
        let fallbackScheduled = false;
        let fallbackTimer;
        let worker;
        const startedAt = performance.now();
        const current = () => !cancelled && versionRef.current === requestId;
        const finish = (results, error = null) => {
            if (!current() || finished) return;
            finished = true;
            worker?.removeEventListener('message', handleMessage);
            if (!error) onResults(results);
            setJobState({ text: deferredText, mode, attempt, error });
            setEngineStats((prev) => ({ ...prev, lastDurationMs: Math.round(performance.now() - startedAt) }));
        };
        const fallback = () => {
            if (!current() || finished || fallbackScheduled) return;
            fallbackScheduled = true;
            worker?.removeEventListener('message', handleMessage);
            setEngineStats((prev) => ({ ...prev, fallbackCount: prev.fallbackCount + 1 }));
            // Paint the pending state before starting synchronous fallback work.
            fallbackTimer = setTimeout(() => {
                if (!current()) return;
                try {
                    finish(deferredText.trim() ? computeCoreResults(deferredText, mode) : null);
                } catch (error) {
                    finish(null, error instanceof Error ? error.message : String(error));
                }
            }, 0);
        };
        function handleMessage(event) {
            const message = event.data || {};
            if (message.requestId !== requestId || !current() || fallbackScheduled || finished) return;
            if (message.error || !Array.isArray(message.results?.allWords)) {
                setEngineStats((prev) => ({ ...prev, workerErrorCount: prev.workerErrorCount + 1 }));
                fallback();
                return;
            }
            setEngineStats((prev) => ({ ...prev, workerSuccessCount: prev.workerSuccessCount + 1 }));
            finish(message.results);
        }
        fallbackRef.current = fallback;
        const timer = setTimeout(() => {
            if (!current() || finished || fallbackScheduled) return;
            if (!deferredText.trim()) { finish(null); return; }
            worker = workerRef.current;
            if (!worker) { fallback(); return; }
            worker.addEventListener('message', handleMessage);
            try {
                worker.postMessage({ requestId, text: deferredText, mode });
            } catch {
                worker.terminate();
                workerRef.current = null;
                setEngineStats((prev) => ({ ...prev, workerAvailable: false, workerErrorCount: prev.workerErrorCount + 1 }));
                fallback();
            }
        }, deferredText.trim() ? Math.min(800, Math.max(120, deferredText.length * 0.4)) : 0);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            clearTimeout(fallbackTimer);
            worker?.removeEventListener('message', handleMessage);
            if (fallbackRef.current === fallback) fallbackRef.current = null;
        };
    }, [deferredText, mode, attempt, onResults]);

    const matches = jobState?.text === deferredText && jobState?.mode === mode && jobState?.attempt === attempt;
    return {
        isPending: !matches && Boolean(deferredText.trim()),
        error: matches ? jobState.error : null,
        retry,
        engineStats,
    };
}
