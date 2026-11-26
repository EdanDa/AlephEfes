import { useEffect, useMemo, useState } from 'react';
import { loadVerifiedCorpusFile } from '../core/corpusData.js';
import { hitAtWord, variantSpellings } from '../core/tanakhSearch.js';
import { t } from '../i18n/locale.js';
import SpellingResult from './SpellingResult.jsx';

const PAGE_SIZE = 8;

function segmentedForm(word, base) {
    return word === base ? base : `${word.slice(0, word.length - base.length)} + ${base}`;
}

export default function RelatedSpellings({ data, query, onOpen }) {
    const [index, setIndex] = useState(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState('');
    const [page, setPage] = useState(0);
    useEffect(() => {
        let active = true;
        loadVerifiedCorpusFile('spelling-variants.json').then(variants => {
            if (variants.contentHash !== data.contentHash) throw new Error('Corpus variant index version mismatch');
            if (active) setIndex(variants);
        }).catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [data, attempt]);
    const groups = useMemo(() => index ? variantSpellings(index.families, query) : [], [index, query]);
    if (failed) return <p>{t('טעינת הכתיבים הנוספים נכשלה.')} <button type="button" onClick={() => {
        setFailed(false); setAttempt(n => n + 1);
    }}>{t('נסה שוב')}</button></p>;
    if (!groups.length) return null;
    const total = groups.reduce((sum, group) => sum + group.positions.length, 0);
    const { spelling, positions, readings } = groups.find(group => group.spelling === selected) || groups[0];
    const start = page * PAGE_SIZE;
    const annotated = Object.values(index.coverage).reduce((sum, book) => sum + book.annotated, 0);
    return <div className="tanakh-variants">
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {t`מופעים נוספים עם תחיליות או בכתיב חלופי (${total})`}
        </button>
        {expanded && <>
            <label>{t('כתיב במקרא')} <select value={spelling} onChange={event => { setSelected(event.target.value); setPage(0); }}>
                {groups.map(group => <option key={group.spelling} value={group.spelling}>{group.spelling} ({group.positions.length})</option>)}
            </select></label>
            {readings.map(reading => <small className="tanakh-variant-reading" key={[reading.lemma, reading.morph, reading.base, reading.queryBase].join('/')}>
                {t('בחיפוש')} <bdi dir="rtl">{segmentedForm(query, reading.queryBase)}</bdi> · {t('במקרא')} <bdi dir="rtl">{segmentedForm(spelling, reading.base)}</bdi>
                {' · '}<bdi dir="ltr">OSHB {reading.lemma} ({reading.morph})</bdi>
            </small>)}
            <ul className="tanakh-search-results">{positions.slice(start, start + PAGE_SIZE).map(offset =>
                <SpellingResult key={offset} data={data} hit={hitAtWord(data.index, offset)} onOpen={onOpen} />
            )}</ul>
            {positions.length > PAGE_SIZE && <div className="tanakh-search-pages">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('תוצאות קודמות')}</button>
                <span>{start + 1}–{Math.min(start + PAGE_SIZE, positions.length)} / {positions.length}</span>
                <button type="button" disabled={start + PAGE_SIZE >= positions.length} onClick={() => setPage(page + 1)}>{t('תוצאות נוספות')}</button>
            </div>}
            <small>{t('ההתאמות מבוססות על ערך מילוני ונטייה דקדוקית.')} {t`תויגו ${annotated.toLocaleString('en-US')} מתוך ${data.index.tokens.length.toLocaleString('en-US')} מילים.`} <a href="https://github.com/openscriptures/morphhb/releases/tag/v.2.2">Open Scriptures Hebrew Bible</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></small>
        </>}
    </div>;
}
