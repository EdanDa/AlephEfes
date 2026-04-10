import { useEffect, useRef, useState, useTransition } from 'react';
import { computeCoreResults } from '../core/analysisCore';

const requestIdle = (cb) => {
  const scheduler = globalThis.requestIdleCallback;
  return scheduler ? scheduler(cb) : setTimeout(cb, 1);
};

const cancelIdle = (id) => {
  const scheduler = globalThis.cancelIdleCallback;
  if (scheduler) {
    scheduler(id);
    return;
  }
  clearTimeout(id);
};

export function useCoreResultsEngine({ deferredText, mode, onResults }) {
  const [isPending, startTransition] = useTransition();
  const [engineStats, setEngineStats] = useState({
    workerAvailable: false,
    fallbackCount: 0,
    workerSuccessCount: 0,
    workerErrorCount: 0,
    lastDurationMs: 0,
  });

  const versionRef = useRef(0);
  const workerRef = useRef(null);

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../workers/coreResults.worker.js', import.meta.url), { type: 'module' });
      setEngineStats((prev) => ({ ...prev, workerAvailable: true }));
    } catch {
      workerRef.current = null;
      setEngineStats((prev) => ({ ...prev, workerAvailable: false }));
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!deferredText) {
      onResults(null);
      return;
    }

    versionRef.current += 1;
    const currentVersion = versionRef.current;
    const worker = workerRef.current;
    const delay = Math.min(800, Math.max(120, deferredText.length * 0.4));
    let workerListener = null;
    let idleId = null;

    const timerId = setTimeout(() => {
      const startedAt = performance.now();
      if (worker) {
        workerListener = (event) => {
          const { requestId, results, error } = event.data || {};
          if (requestId !== currentVersion) return;
          worker.removeEventListener('message', workerListener);
          workerListener = null;

          const endedAt = performance.now();
          setEngineStats((prev) => ({
            ...prev,
            lastDurationMs: Math.round((endedAt - startedAt) * 100) / 100,
            workerErrorCount: error ? prev.workerErrorCount + 1 : prev.workerErrorCount,
            workerSuccessCount: error ? prev.workerSuccessCount : prev.workerSuccessCount + 1,
          }));

          if (error) {
            return;
          }

          startTransition(() => {
            if (versionRef.current === currentVersion) {
              onResults(results);
            }
          });
        };

        worker.addEventListener('message', workerListener);
        worker.postMessage({ requestId: currentVersion, text: deferredText, mode });
        return;
      }

      idleId = requestIdle(() => {
        startTransition(() => {
          const results = computeCoreResults(deferredText, mode);
          const endedAt = performance.now();
          setEngineStats((prev) => ({
            ...prev,
            fallbackCount: prev.fallbackCount + 1,
            lastDurationMs: Math.round((endedAt - startedAt) * 100) / 100,
          }));

          if (versionRef.current === currentVersion) {
            onResults(results);
          }
        });
      });
    }, delay);

    return () => {
      clearTimeout(timerId);
      if (idleId) cancelIdle(idleId);
      if (worker && workerListener) {
        worker.removeEventListener('message', workerListener);
      }
    };
  }, [deferredText, mode, onResults, startTransition]);

  return { isPending, engineStats };
}
