import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCorpusManifest } from '../core/corpusData.js';
import { searchOperators } from '../core/operatorSearch.js';
import { candidateCount, describeHit, queryDescription, resultCounts, shuffleSummary } from '../core/researchOperators.js';
import { locatorText, researchUnitLabel } from '../core/researchModel.js';
import { normalizeTanakhSearchInput, normalizeTypedTanakhSearchInput } from '../core/searchInput.js';
import { t } from '../i18n/locale.js';
import { compileFormula, evaluateFormula } from '../core/operatorFormula.js';
import FormulaEditor from './FormulaEditor';
import ResearchNote from './ResearchNote';
import { UnitPassage } from './WordInspector';

const pageSize = 15;

function ResultUnit({ group, result, onBack, onNote }) {
    const unit = useMemo(() => group.getUnit(), [group]);
    const [index, setIndex] = useState(0);
    const hits = useMemo(() => evaluateFormula(unit, result.query, compileFormula(result.query.formula, result.query.domain)).hits, [unit, result.query]);
    const hit = hits[index];
    return <>
        <button type="button" onClick={onBack}>{t('חזרה לתוצאות')}</button>
        <h3>{researchUnitLabel(unit)}</h3>
        {unit.source && <p>{locatorText(unit.source.locators.start)} – {locatorText(unit.source.locators.end)}</p>}
        <p>{queryDescription(result.query)}</p>
        <p>{describeHit(hit)}</p>
        {hits.length > 1 && <div className="research-actions">
            <button disabled={!index} onClick={() => setIndex(index - 1)}>{t('הקודם')}</button>
            <span>{index + 1} / {hits.length}</span>
            <button disabled={index + 1 === hits.length} onClick={() => setIndex(index + 1)}>{t('הבא')}</button>
        </div>}
        <UnitPassage unit={unit} position={hit.position} endPosition={hit.endPosition} positions={hit.positions} showWords scrollOnOpen />
        <button type="button" onClick={() => onNote({ unit, hit, result })}>{t('הערת מחקר להתאמה זו')}</button>
    </>;
}

export default function OperatorExplorer({ open, state }) {
    const [query, setQuery] = useState(() => ({ formula: '', domain: 'word', scope: 'corpus', mode: state.mode, word: '' }));
    const [books, setBooks] = useState([]), [bookError, setBookError] = useState(false), [retry, setRetry] = useState(0);
    const [result, setResult] = useState(null), [group, setGroup] = useState(null), [page, setPage] = useState(0);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [evidence, setEvidence] = useState(null);
    const running = useRef(null);
    useEffect(() => {
        if (!open || books.length) return;
        let active = true;
        setBookError(false);
        loadCorpusManifest().then((manifest) => {
            if (active) setBooks(manifest.divisions.flatMap((division) => division.books));
        }).catch(() => { if (active) setBookError(true); });
        return () => { active = false; };
    }, [open, books.length, retry]);
    useEffect(() => () => running.current?.abort(), []);
    useEffect(() => {
        if (query.scope !== 'passage') return;
        running.current?.abort();
        setBusy(false); setResult(null); setGroup(null); setEvidence(null);
    }, [state.text, state.corpusSelection, query.scope]);

    function update(changes) {
        running.current?.abort();
        setQuery((current) => ({ ...current, ...changes }));
        setBusy(false); setResult(null); setError(''); setGroup(null); setPage(0);
    }
    function validate(checkSource = false) {
        try {
            const compiled = compileFormula(query.formula, query.domain);
            if (checkSource && compiled.fields.includes('section') && query.scope === 'passage' && !state.corpusSelection) {
                throw new Error(t('לבדיקה לפי מספר פרשיה בחרו מקור מקראי.'));
            }
            return true;
        } catch (failure) { setError(failure.message); return false; }
    }
    async function search(event) {
        event.preventDefault();
        if (!validate(true)) return;
        running.current?.abort();
        const controller = new AbortController();
        running.current = controller;
        setBusy(true); setResult(null); setError(''); setGroup(null); setPage(0);
        try {
            const request = { ...query, word: query.domain === 'unit' ? '' : query.word.trim(), bookName: books.find((book) => book.slug === query.scope)?.name };
            const found = await searchOperators(request, state.text, state.corpusSelection, controller.signal);
            if (!controller.signal.aborted) setResult(found);
        } catch (failure) {
            if (!controller.signal.aborted) setError(failure.message);
        } finally {
            if (!controller.signal.aborted) setBusy(false);
        }
    }
    if (!open) return null;
    return <>
        <section className="research-panel app-results-card" aria-label={t('מחקר')}>
            <h2>{t('כללי בדיקה')}</h2>
            {group ? <ResultUnit key={group.id} group={group} result={result} onBack={() => setGroup(null)} onNote={setEvidence} /> : <>
                <form className="operator-form" onSubmit={search}>
                    <FormulaEditor query={query} update={update} validate={validate} />
                    <label>{t('תחום החיפוש')}<select value={query.scope} onChange={(e) => update({ scope: e.target.value })}>
                        <option value="corpus">{t('כל המקרא')}</option>
                        <option value="passage">{t('הטקסט לניתוח')}</option>
                        <optgroup label={t('ספר')}>{books.map((book) => <option key={book.slug} value={book.slug}>{t(book.name)}</option>)}</optgroup>
                    </select></label>
                    <label>{t('מצב חישוב')}<select value={query.mode} onChange={e => update({ mode: e.target.value })}>
                        <option value="aleph-zero">א=0</option><option value="aleph-one">א=1</option>
                    </select></label>
                    {query.domain !== 'unit' && <label>{t('כתיב מדויק (רשות)')}<input dir="rtl" lang="he" value={query.word} pattern="[א-ת]+ *" autoComplete="off"
                        onChange={(e) => update({ word: normalizeTypedTanakhSearchInput(e.target.value) })}
                        onPaste={(event) => {
                            event.preventDefault();
                            const input = event.currentTarget;
                            update({ word: normalizeTanakhSearchInput(input.value.slice(0, input.selectionStart) + event.clipboardData.getData('text/plain') + input.value.slice(input.selectionEnd)) });
                        }} /></label>}
                    <button type="submit" disabled={!query.formula.trim() || busy || (query.scope === 'passage' && !state.text.trim())}>{t('חפש התאמות')}</button>
                </form>
                {bookError && <p role="alert">{t('טעינת רשימת הספרים נכשלה.')} <button onClick={() => setRetry(retry + 1)}>{t('נסה שוב')}</button></p>}
                {busy && <p role="status">{t('בודק את היחידות…')}</p>}
                {error && <p role="alert">{error}</p>}
                {result && <>
                    <h3>{t('תוצאות החיפוש')}</h3>
                    <p>{queryDescription(result.query)}</p>
                    <p role="status">{resultCounts(result)}</p>
                    <p>{candidateCount(result)}</p>
                    {result.expected !== null && <p>{shuffleSummary(result.expected)}</p>}
                    <ul className="operator-results">{result.groups.slice(page * pageSize, (page + 1) * pageSize).map((row) =>
                        <li key={row.id}><button type="button" onClick={() => setGroup(row)}>
                            <strong>{researchUnitLabel(row)}</strong>
                            <span>{row.source && <>{locatorText(row.source.locators.start)} · </>}{t`${row.cases} התאמות`}</span>
                            <span>{describeHit(row.hits[0])}</span>
                        </button></li>)}</ul>
                    {result.groups.length > pageSize && <div className="research-actions">
                        <button disabled={!page} onClick={() => setPage(page - 1)}>{t('הקודם')}</button>
                        <span>{page + 1} / {Math.ceil(result.groups.length / pageSize)}</span>
                        <button disabled={(page + 1) * pageSize >= result.groups.length} onClick={() => setPage(page + 1)}>{t('הבא')}</button>
                    </div>}
                </>}
            </>}
        </section>
        {evidence && <ResearchNote request={{ word: evidence.hit.word, operatorEvidence: evidence }} state={state} onClose={() => setEvidence(null)} />}
    </>;
}
