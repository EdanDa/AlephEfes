import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState, useAppDispatch } from '../state/appStore';
import WordInspector from './WordInspector';
import ResearchNote from './ResearchNote';

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
    const [noteRequest, setNoteRequest] = useState(null), selectedLine = useRef(null);
    const inspect = useCallback((word, options = {}) => setRequest({ word, ...options }), []);
    const close = useCallback(() => setRequest(null), []);
    useEffect(() => { setRequest(null); setFocus(null); setNoteRequest(null); }, [state.text, state.mode]);
    useEffect(() => {
        const remember = () => { const element = document.activeElement; if (element?.matches('textarea.app-textarea')) selectedLine.current = (element.value.slice(0, element.selectionStart).match(/\n/g)?.length || 0) + 1; };
        document.addEventListener('selectionchange', remember);
        return () => document.removeEventListener('selectionchange', remember);
    }, []);
    const openNote = useCallback((options = {}) => setNoteRequest({ focus: options.focus || focus, lineNumber: selectedLine.current,
        word: options.word !== undefined ? options.word : options.value !== undefined ? null : state.pinnedWord?.word || focus?.word || null,
        value: options.value !== undefined ? options.value : options.word ? null : state.selectedHotValue,
    }), [focus, state.pinnedWord, state.selectedHotValue]);
    const value = useMemo(() => ({ inspect, focus, openNote }), [inspect, focus, openNote]);
    return <ResearchContext.Provider value={value}>{children}
        {request && !state.isAnalysisStale && <WordInspector request={request} state={state} dispatch={dispatch} onClose={close} onFocus={setFocus} onNote={openNote} />}
        {noteRequest && !state.isAnalysisStale && <ResearchNote request={noteRequest} state={state} onClose={() => setNoteRequest(null)} />}
    </ResearchContext.Provider>;
}
