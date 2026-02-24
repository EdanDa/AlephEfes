import React, {
    createContext,
    useContext,
    useDeferredValue,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useTransition,
} from 'react';
import { computeCoreResults, getWordValues, isValueVisible } from '../core/analysisCore';
import { appReducer, initialState } from './appReducer';

const AppCoreContext = createContext(null);
const AppFiltersContext = createContext(null);
const AppClipboardContext = createContext(null);
const AppStatsContext = createContext(null);
const AppDispatchContext = createContext(null);

function assertContext(contextValue, hookName) {
    if (contextValue !== null) return contextValue;
    throw new Error(`${hookName} must be used inside AppProvider`);
}

const useAppCoreState = () => assertContext(useContext(AppCoreContext), 'useAppCoreState');
const useAppFilters = () => assertContext(useContext(AppFiltersContext), 'useAppFilters');
const useAppClipboard = () => assertContext(useContext(AppClipboardContext), 'useAppClipboard');
const useAppStats = () => assertContext(useContext(AppStatsContext), 'useAppStats');
const useAppDispatch = () => assertContext(useContext(AppDispatchContext), 'useAppDispatch');

const AppProvider = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isPending, startTransition] = useTransition();
    const deferredText = useDeferredValue(state.text);
    const versionRef = useRef(0);
    const workerRef = useRef(null);
    const workerCrashedRef = useRef(false);

    useEffect(() => {
        if (typeof Worker === 'undefined') return undefined;

        const worker = new Worker(new URL('../workers/coreResults.worker.js', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        const handleMessage = (event) => {
            const { requestId, results, error } = event.data || {};
            if (requestId !== versionRef.current) return;
            if (error) {
                workerCrashedRef.current = true;
                console.error('coreResults worker failed:', error);
                return;
            }
            startTransition(() => {
                dispatch({ type: 'SET_CORE_RESULTS', payload: results });
            });
        };

        const handleError = (error) => {
            workerCrashedRef.current = true;
            console.error('coreResults worker error:', error);
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);

        return () => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
            worker.terminate();
            if (workerRef.current === worker) workerRef.current = null;
        };
    }, [startTransition]);

    useEffect(() => {
        if (!deferredText) {
            dispatch({ type: 'SET_CORE_RESULTS', payload: null });
            return;
        }

        versionRef.current += 1;
        const currentVersion = versionRef.current;

        if (workerRef.current && !workerCrashedRef.current) {
            workerRef.current.postMessage({
                requestId: currentVersion,
                text: deferredText,
                mode: state.mode,
            });
            return;
        }

        startTransition(() => {
            const results = computeCoreResults(deferredText, state.mode);
            if (versionRef.current === currentVersion) {
                dispatch({ type: 'SET_CORE_RESULTS', payload: results });
            }
        });
    }, [deferredText, state.mode, startTransition, dispatch]);

    const stats = useMemo(() => {
        if (!state.coreResults) return null;
        const primeLineCount = new Set(state.coreResults.primeSummary.map((p) => p.line)).size;
        return {
            totalLines: state.coreResults.lines.length,
            totalWords: state.coreResults.totalWordCount,
            uniqueWords: state.coreResults.allWords.length,
            primeLineTotals: primeLineCount,
            drDistribution: state.coreResults.drDistribution,
        };
    }, [state.coreResults]);

    const valueToWordsMap = useMemo(() => {
        if (!state.coreResults) return new Map();
        const map = new Map();
        state.coreResults.allWords.forEach((wd) => {
            const values = [wd.units];
            if (wd.tens !== wd.units) values.push(wd.tens);
            if (wd.hundreds !== wd.tens && wd.hundreds !== wd.units) values.push(wd.hundreds);

            values.forEach((value) => {
                if (!map.has(value)) map.set(value, []);
                map.get(value).push(wd);
            });
        });
        return map;
    }, [state.coreResults]);

    const connectionValues = useMemo(() => {
        if (!state.coreResults) return new Set();
        const visibleConnections = new Set();
        const valCounts = new Map();

        state.coreResults.allWords.forEach((wordData) => {
            const seenInWord = new Set();
            const values = getWordValues(wordData);
            values.forEach((valueData) => {
                if (!isValueVisible(valueData.layer, valueData.isPrime, state.filters)) return;
                if (seenInWord.has(valueData.value)) return;
                seenInWord.add(valueData.value);
                valCounts.set(valueData.value, (valCounts.get(valueData.value) || 0) + 1);
            });
        });

        for (const [value, count] of valCounts.entries()) {
            if (count > 1) visibleConnections.add(value);
        }

        return visibleConnections;
    }, [state.coreResults, state.filters]);

    const coreValue = useMemo(
        () => ({
            ...state,
            stats,
            valueToWordsMap,
            connectionValues,
            isPending,
        }),
        [state, stats, valueToWordsMap, connectionValues, isPending]
    );

    const filtersValue = useMemo(
        () => ({
            filters: state.filters,
            primeColor: state.primeColor,
        }),
        [state.filters, state.primeColor]
    );

    const clipboardValue = useMemo(() => ({ copiedId: state.copiedId }), [state.copiedId]);

    const statsValue = useMemo(
        () => ({
            stats,
            isStatsCollapsed: state.isStatsCollapsed,
            isDarkMode: state.isDarkMode,
            connectionValues,
        }),
        [stats, state.isStatsCollapsed, state.isDarkMode, connectionValues]
    );

    return (
        <AppDispatchContext.Provider value={dispatch}>
            <AppCoreContext.Provider value={coreValue}>
                <AppFiltersContext.Provider value={filtersValue}>
                    <AppClipboardContext.Provider value={clipboardValue}>
                        <AppStatsContext.Provider value={statsValue}>{children}</AppStatsContext.Provider>
                    </AppClipboardContext.Provider>
                </AppFiltersContext.Provider>
            </AppCoreContext.Provider>
        </AppDispatchContext.Provider>
    );
};

export { AppProvider, useAppClipboard, useAppCoreState, useAppDispatch, useAppFilters, useAppStats };
