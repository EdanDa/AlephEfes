import { t } from '../i18n/locale.js';
import { useEffect, useMemo, useState } from 'react';
import ResearchDialog from './ResearchDialog';
import ResearchNotePreview from './ResearchNotePreview';
import { loadPassageUnits } from '../core/corpusResearch.js';
import { buildResearchNote } from '../core/researchNote.js';
import { researchUnitLabel } from '../core/researchModel.js';

async function copyNote(content) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); return; } } catch { /* Use the browser's selected-text fallback. */ }
    const previous = document.activeElement;
    const input = document.createElement('textarea'); input.value = content; input.readOnly = true;
    Object.assign(input.style, { position: 'fixed', opacity: '0', width: '1px', height: '1px' });
    // A textarea inside the topmost modal remains focusable during the fallback.
    (previous?.closest('dialog[open]') || document.body).appendChild(input);
    let copied;
    try { input.focus(); input.select(); copied = document.execCommand('copy'); }
    finally { input.remove(); previous?.focus({ preventScroll: true }); }
    if (!copied) throw new Error(t('ההעתקה אינה זמינה בדפדפן זה. אפשר להוריד את קובץ ה־Markdown.'));
}
export default function ResearchNote({ request, state, onClose }) {
    const evidence = request.operatorEvidence;
    const [units, setUnits] = useState(evidence ? [evidence.unit] : null), [unitId, setUnitId] = useState(evidence?.unit.id || request.focus?.unit.id || '');
    const [error, setError] = useState(null), [retry, setRetry] = useState(0), [status, setStatus] = useState('');
    useEffect(() => {
        if (evidence) return;
        let active = true; setError(null);
        loadPassageUnits(state.text, state.mode, state.corpusSelection).then((data) => {
            if (!active) return;
            const list = request.focus && !data.some((unit) => unit.id === request.focus.unit.id) ? [request.focus.unit, ...data] : data;
            setUnits(list);
            if (!request.focus) setUnitId(!state.corpusSelection && request.lineNumber ? data.find((unit) => unit.lineNumber === request.lineNumber)?.id || '' : data.length === 1 ? data[0].id : '');
        }).catch((failure) => { if (active) setError(failure.message); });
        return () => { active = false; };
    }, [state.text, state.mode, state.corpusSelection, request, retry, evidence]);
    const unit = units?.find((entry) => entry.id === unitId);
    const word = request.word || null, value = request.value ?? null;
    const focusMatches = Boolean(request.focus && unit && request.focus.unit.id === unit.id && request.focus.word === word);
    const label = unit && researchUnitLabel(unit);
    const content = useMemo(() => buildResearchNote({ unit, label, filters: state.filters, selectedDR: state.selectedDR, searchTerm: state.searchTerm, word, value,
        operatorEvidence: evidence,
        selectedPosition: evidence?.hit.position ?? (focusMatches ? request.focus.occurrence.position : null),
        corpusSearch: focusMatches && request.focus.scope === 'corpus' ? { word, totalOccurrences: request.focus.totalOccurrences, position: request.focus.occurrence.position, contentHash: request.focus.corpusHash } : null,
        passage: state.coreResults ? { wordCount: state.coreResults.totalWordCount, distinctWordCount: state.coreResults.allWords.length, selectedWordCount: state.coreResults.wordCounts.get(word) || 0 } : null,
    }), [unit, label, state.filters, state.selectedDR, state.searchTerm, state.coreResults, word, value, focusMatches, request.focus, evidence]);
    const download = () => {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `aleph-efes-${unit.id}-${unit.mode}.md`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return <ResearchDialog title={t("הערת מחקר")} onClose={onClose} wide>
        {!evidence && <p>{t("בחרו יחידה אחת. התצוגה המקדימה, ההעתקה וקובץ ה־Markdown מכילים את אותו תוכן.")}</p>}
        {!units && !error && <p role="status">{t("טוען את יחידות המקור…")}</p>}
        {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(retry + 1)}>{t("נסה שוב")}</button></div>}
        {units && !evidence && <label className="research-note-unit">{state.corpusSelection || request.focus?.unit.source ? t('יחידת MAM / שורה להערה') : t('שורה להערה')}<select aria-label={t("יחידה להערת המחקר")} value={unitId} onChange={(event) => { setUnitId(event.target.value); setStatus(''); }}><option value="">{t("בחרו יחידה להערה")}</option>{units.map((entry) => <option key={entry.id} value={entry.id}>{researchUnitLabel(entry)} · {entry.id}</option>)}</select></label>}
        {units && !unit && <p role="status">{t("יש לבחור פרשיה או שורה לפני יצירת ההערה.")}</p>}
        <div className="research-actions"><button disabled={!content} onClick={async () => { try { await copyNote(content); setStatus(t('ההערה הועתקה')); } catch (failure) { setStatus(failure.message); } }}>{t("העתק")}</button><button disabled={!content} onClick={download}>{t("הורד .md")}</button></div>
        {status && <p role="status">{status}</p>}
        {content && <ResearchNotePreview content={content} />}
    </ResearchDialog>;
}
