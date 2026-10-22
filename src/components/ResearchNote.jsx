import React, { useEffect, useMemo, useState } from 'react';
import ResearchDialog from './ResearchDialog';
import ResearchNotePreview from './ResearchNotePreview';
import { loadPassageUnits } from '../core/corpusResearch.js';
import { buildResearchNote } from '../core/researchNote.js';

async function copyNote(content) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); return; } } catch { /* Use the browser's selected-text fallback. */ }
    const previous = document.activeElement;
    const input = document.createElement('textarea'); input.value = content; input.readOnly = true;
    Object.assign(input.style, { position: 'fixed', opacity: '0', width: '1px', height: '1px' });
    // A textarea inside the topmost modal remains focusable during the fallback.
    (document.querySelector('dialog[aria-label="הערת מחקר"]') || document.body).appendChild(input);
    let copied = false;
    try { input.focus(); input.select(); copied = document.execCommand('copy'); }
    finally { input.remove(); previous?.focus({ preventScroll: true }); }
    if (!copied) throw new Error('ההעתקה אינה זמינה בדפדפן זה. אפשר להוריד את קובץ ה־Markdown.');
}
export default function ResearchNote({ request, state, onClose }) {
    const [units, setUnits] = useState(null), [unitId, setUnitId] = useState(request.focus?.unit.id || '');
    const [error, setError] = useState(null), [retry, setRetry] = useState(0), [status, setStatus] = useState('');
    useEffect(() => {
        let active = true; setError(null);
        loadPassageUnits(state.text, state.mode, state.corpusSelection).then((data) => {
            if (!active) return;
            const list = request.focus && !data.some((unit) => unit.id === request.focus.unit.id) ? [request.focus.unit, ...data] : data;
            setUnits(list);
            if (!request.focus) setUnitId(!state.corpusSelection && request.lineNumber ? data.find((unit) => unit.lineNumber === request.lineNumber)?.id || '' : data.length === 1 ? data[0].id : '');
        }).catch((failure) => { if (active) setError(failure.message); });
        return () => { active = false; };
    }, [state.text, state.mode, state.corpusSelection, request, retry]);
    const unit = units?.find((entry) => entry.id === unitId);
    const word = request.word || null, value = request.value ?? null;
    const focusMatches = Boolean(request.focus && unit && request.focus.unit.id === unit.id && request.focus.word === word);
    const content = useMemo(() => buildResearchNote({ unit, filters: state.filters, selectedDR: state.selectedDR, searchTerm: state.searchTerm, word, value,
        selectedPosition: focusMatches ? request.focus.occurrence.position : null,
        corpusSearch: focusMatches && request.focus.scope === 'corpus' ? { word, totalOccurrences: request.focus.totalOccurrences, position: request.focus.occurrence.position, contentHash: request.focus.corpusHash } : null,
        passage: state.coreResults ? { wordCount: state.coreResults.totalWordCount, distinctWordCount: state.coreResults.allWords.length, selectedWordCount: state.coreResults.wordCounts.get(word) || 0 } : null,
    }), [unit, state.filters, state.selectedDR, state.searchTerm, state.coreResults, word, value, focusMatches, request.focus]);
    const download = () => {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `aleph-efes-${unit.id}-${state.mode}.md`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return <ResearchDialog title="הערת מחקר" onClose={onClose} wide>
        <p>בחרו יחידה אחת. התצוגה המקדימה, ההעתקה וקובץ ה־Markdown מכילים את אותו תוכן.</p>
        {!units && !error && <p role="status">טוען את יחידות המקור…</p>}
        {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(retry + 1)}>נסה שוב</button></div>}
        {units && <label className="research-note-unit">{state.corpusSelection || request.focus?.unit.source ? 'יחידת MAM / שורה להערה' : 'שורה להערה'}<select aria-label="יחידה להערת המחקר" value={unitId} onChange={(event) => { setUnitId(event.target.value); setStatus(''); }}><option value="">בחרו יחידה להערה</option>{units.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {entry.id}</option>)}</select></label>}
        {units && !unit && <p role="status">יש לבחור פרשיה או שורה לפני יצירת ההערה.</p>}
        <div className="research-actions"><button disabled={!content} onClick={async () => { try { await copyNote(content); setStatus('ההערה הועתקה'); } catch (failure) { setStatus(failure.message); } }}>העתק</button><button disabled={!content} onClick={download}>הורד .md</button></div>
        {status && <p role="status">{status}</p>}
        {content && <ResearchNotePreview content={content} />}
    </ResearchDialog>;
}
