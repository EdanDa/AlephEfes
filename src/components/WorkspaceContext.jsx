import React from 'react';
import { useAppState, useAppDispatch } from '../state/appStore';

export default function WorkspaceContext() {
    const state = useAppState();
    const dispatch = useAppDispatch();
    const labels = { U: 'יחידות', T: 'עשרות', H: 'מאות', Prime: 'ראשוניים בלבד' };
    return <section className="workspace-context" aria-label="הקשר הניתוח">
        <div className="workspace-context-source"><strong>{state.corpusSelection ? `${state.corpusSelection.bookName} · ${state.corpusSelection.scope === 'book' ? 'הספר כולו' : `פרשיות ${state.corpusSelection.startSectionOrdinal}–${state.corpusSelection.endSectionOrdinal}`}` : 'טקסט אישי'}</strong><span dir="ltr">{state.mode === 'aleph-zero' ? 'א=0' : 'א=1'}</span></div>
        <div className="workspace-chips">
            {Object.entries(labels).filter(([key]) => state.filters[key]).map(([key, label]) => <button key={key} aria-label={`הסר מסנן ${label}`} onClick={() => dispatch({ type: 'TOGGLE_FILTER', payload: key })}>{label} ×</button>)}
            {state.selectedDR !== null && <button onClick={() => dispatch({ type: 'SET_SELECTED_DR', payload: state.selectedDR })}>ש״ד {state.selectedDR} ×</button>}
            {state.searchTerm && <button onClick={() => dispatch({ type: 'SET_SEARCH_TERM', payload: '' })}>חיפוש: {state.searchTerm} ×</button>}
            <button onClick={() => dispatch({ type: 'RESET_FILTERS' })}>איפוס מסננים</button>
        </div>
    </section>;
}
