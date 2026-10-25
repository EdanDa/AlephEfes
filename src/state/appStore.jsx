import React, { createContext, useContext, useDeferredValue, useEffect, useMemo, useReducer, useCallback } from 'react';
import { appReducer, initialState } from './appReducer.js';
import { restoreSession, saveSession } from './sessionStorage.js';
import { getConnectionValues } from '../core/wordConnections.js';
import { useCoreResultsEngine } from '../hooks/useCoreResultsEngine.js';

const AppContext = createContext(null);
const AppDispatchContext = createContext(null);

// Backward-compatible hook aliases for older/local bundles that referenced previous names.
function useAppCoreState() {
    return useContext(AppContext);
}

function useAppCoreDispatch() {
    return useContext(AppDispatchContext);
}


function useAppState() {
    return useContext(AppContext);
}

function useAppDispatch() {
    return useContext(AppDispatchContext);
}

function useAppFilters() {
    const state = useAppState();
    return useMemo(() => ({
        filters: state?.filters,
        primeColor: state?.primeColor,
    }), [state?.filters, state?.primeColor]);
}

function useAppClipboard() {
    const state = useAppState();
    return useMemo(() => ({
        copiedId: state?.copiedId,
    }), [state?.copiedId]);
}

function useAppStats() {
    const state = useAppState();
    return useMemo(() => ({
        stats: state?.stats,
        isStatsCollapsed: state?.isStatsCollapsed,
        isDarkMode: state?.isDarkMode,
        connectionValues: state?.connectionValues,
        corpusSelection: state?.corpusSelection,
    }), [state?.stats, state?.isStatsCollapsed, state?.isDarkMode, state?.connectionValues, state?.corpusSelection]);
}

function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState, (defaults) => restoreSession({ ...defaults, isDarkMode: document.documentElement.classList.contains('dark') }));
    const deferredText = useDeferredValue(state.text);
    const commitCoreResults = useCallback((results) => {
        dispatch({ type: 'SET_CORE_RESULTS', payload: results });
    }, []);
    const { isPending: enginePending, engineStats, error: analysisError, retry: retryAnalysis } = useCoreResultsEngine({
        deferredText,
        mode: state.mode,
        onResults: commitCoreResults,
    });

    const isPending = state.isInputDirty || state.text !== deferredText || enginePending;
    const isAnalysisStale = isPending || Boolean(analysisError);
    const { text, mode, corpusSelection, view, filters, textSize, wordNumberingStart } = state;
    useEffect(() => saveSession({ text, mode, corpusSelection, view, filters, textSize, wordNumberingStart }), [text, mode, corpusSelection, view, filters, textSize, wordNumberingStart]);

    const stats = useMemo(() => {
        if (!state.coreResults) return null;
        const primeLineCount = new Set(state.coreResults.primeSummary.map(p => p.line)).size;
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
        state.coreResults.allWords.forEach(wd => {
            const uniqueValues = new Set([wd.units, wd.tens, wd.hundreds]);
            uniqueValues.forEach(v => {
                if (!map.has(v)) map.set(v, []);
                map.get(v).push(wd);
            });
        });
        return map;
    }, [state.coreResults]);

    const connectionValues = useMemo(() => {
         if (!state.coreResults) return new Set();
         return getConnectionValues(state.coreResults.allWords, state.filters);
    }, [state.coreResults, state.filters]);

    const contextValue = useMemo(() => ({
        ...state,
        stats,
        valueToWordsMap,
        connectionValues,
        isPending,
        engineStats,
        isAnalysisStale,
        analysisError,
        retryAnalysis,
    }), [state, stats, valueToWordsMap, connectionValues, isPending, engineStats, isAnalysisStale, analysisError, retryAnalysis]);

    return (
        <AppContext.Provider value={contextValue}>
            <AppDispatchContext.Provider value={dispatch}>
                {children}
            </AppDispatchContext.Provider>
        </AppContext.Provider>
    );
}


export { AppProvider, useAppState, useAppCoreState, useAppCoreDispatch, useAppDispatch, useAppFilters, useAppClipboard, useAppStats };
