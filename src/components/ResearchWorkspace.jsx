import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '../state/appStore';
import WordInspector from './WordInspector';

const ResearchContext = createContext(null);
export const useResearch = () => useContext(ResearchContext);
export function InspectWord({ word, lineIndex, wordPosition, compact = false }) {
    const { inspect } = useResearch();
    const { isAnalysisStale } = useAppState();
    return <button type="button" className={`research-inspect ${compact ? 'research-inspect-compact' : ''}`} disabled={isAnalysisStale} title={`בדוק מילה ${word}`} aria-label={`בדוק מילה ${word}`} onClick={(event) => { event.stopPropagation(); inspect(word, { lineIndex, wordPosition }); }}>{compact ? '⋯' : 'בדוק מילה'}</button>;
}
export default function ResearchWorkspace({ children }) {
    const state = useAppState(), dispatch = useAppDispatch();
    const [request, setRequest] = useState(null), [focus, setFocus] = useState(null);
    const inspect = useCallback((word, options = {}) => setRequest({ word, ...options }), []);
    const close = useCallback(() => setRequest(null), []);
    useEffect(() => { setRequest(null); setFocus(null); }, [state.text, state.mode]);
    const value = useMemo(() => ({ inspect, focus }), [inspect, focus]);
    return <ResearchContext.Provider value={value}>{children}
        {request && !state.isAnalysisStale && <WordInspector request={request} state={state} dispatch={dispatch} onClose={close} onFocus={setFocus} />}
    </ResearchContext.Provider>;
}
