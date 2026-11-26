import { Fragment, useEffect, useMemo, useState } from 'react';
import { loadCorpusManifest, loadVerifiedCorpusFile } from '../core/corpusData.js';
import { normalizeTanakhSearchInput, normalizeTypedTanakhSearchInput } from '../core/searchInput.js';
import { buildSpellingIndex, findSpellingMatches, matchesSectionFilter } from '../core/tanakhSearch.js';
import { boundaryTypeNames } from '../core/researchModel.js';
import TanakhBoundary from './TanakhBoundary.jsx';
import useLanguage, { BilingualLabel } from '../i18n/LanguageContext.jsx';
import { t } from '../i18n/locale.js';

const PAGE_SIZE = 8;

async function loadSearchData() {
    const manifest = await loadCorpusManifest();
    const index = await loadVerifiedCorpusFile(manifest.downloads.wordOccurrencesJson);
    if (index.contentHash !== manifest.contentHash) throw new Error('Corpus index version mismatch');
    const books = new Map(manifest.divisions.flatMap(division => division.books.map(book => [book.slug, book])));
    return { index: buildSpellingIndex(index), books };
}

function SpellingResult({ data, hit, onOpen }) {
    const { tokens, offsets, bookOffsets, sectionIds, boundariesAfter } = data.index;
    const { start, end, section, endSection, position, endPosition } = hit;
    const sectionId = sectionIds[section];
    const split = sectionId.lastIndexOf('-');
    const book = data.books.get(sectionId.slice(0, split));
    const ordinal = Number(sectionId.slice(split + 1));
    const endOrdinal = ordinal + endSection - section;
    const contextStart = Math.max(start - 4, offsets[section], bookOffsets[hit.book]);
    const contextEnd = Math.min(end + 4, offsets[endSection + 1], bookOffsets[hit.book + 1]);
    const label = section === endSection ? t`${t(book.name)} · פרשיה ${ordinal}`
        : t`${t(book.name)} · פרשיות ${ordinal}–${endOrdinal}`;
    const parts = [];
    for (let i = section; i <= endSection; i++) {
        parts.push(<Fragment key={i}>
            {i > section && <> <TanakhBoundary boundary={boundariesAfter[i - 1]} /> </>}
            <mark>{tokens.slice(Math.max(start, offsets[i]), Math.min(end, offsets[i + 1])).join(' ')}</mark>
        </Fragment>);
    }
    return <li><button type="button" onClick={() => onOpen({ bookSlug: book.slug, ordinal, endOrdinal, sectionId, position, endPosition })}>
        <span>{label} · {section === endSection ? t`מילה ${position}` : t`ממילה ${position} עד מילה ${endPosition}`}</span>
        <span className="tanakh-search-excerpt" dir="rtl" lang="he">
            {contextStart > Math.max(offsets[section], bookOffsets[hit.book]) && '… '}
            {tokens.slice(contextStart, start).join(' ')} {parts} {tokens.slice(end, contextEnd).join(' ')}
            {contextEnd < Math.min(offsets[endSection + 1], bookOffsets[hit.book + 1]) && ' …'}
        </span>
    </button></li>;
}

export default function TanakhSearch({ onOpen }) {
    const language = useLanguage();
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState('all');
    const spelling = query.trim();
    const searching = Boolean(spelling);

    useEffect(() => {
        if (!searching || data) return;
        let active = true;
        setFailed(false);
        loadSearchData().then(result => {
            if (active) setData(result);
        }).catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [searching, data, attempt]);

    const words = useMemo(() => spelling.split(' '), [spelling]);
    const allMatches = useMemo(() => data && searching ? findSpellingMatches(data.index, words) : [],
        [data, searching, words]);
    const matches = useMemo(() => filter === 'all' ? allMatches : allMatches.filter(hit => matchesSectionFilter(data.index, hit, filter)),
        [data, allMatches, filter]);
    const counts = useMemo(() => [...new Set(allMatches.map(hit => hit.endSection - hit.section))].filter(Boolean).sort((a, b) => a - b), [allMatches]);
    const first = page * PAGE_SIZE;
    const end = Math.min(first + PAGE_SIZE, matches.length);

    const updateInput = (input, raw, caret, normalize) => {
        const cleaned = normalize(raw);
        if (cleaned !== input.value) {
            input.value = cleaned;
            const position = normalize(raw.slice(0, caret)).length;
            input.setSelectionRange(position, position);
        }
        setQuery(cleaned);
        setPage(0);
        setFilter('all');
    };

    return (
        <div className="tanakh-search" role="search" aria-labelledby="tanakh-search-label">
            <label id="tanakh-search-label" htmlFor="tanakh-search"><BilingualLabel message="חיפוש בתנ״ך" /></label>
            <input id="tanakh-search" className="workspace-search-field" type="search" dir="rtl" lang={query ? 'he' : language} autoComplete="off" spellCheck={false}
                placeholder={t('חפש מילה או צירוף')} value={query}
                onChange={({ currentTarget: input }) => updateInput(input, input.value, input.selectionStart, normalizeTypedTanakhSearchInput)}
                onPaste={event => {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const prefix = input.value.slice(0, input.selectionStart) + event.clipboardData.getData('text/plain');
                    updateInput(input, prefix + input.value.slice(input.selectionEnd), prefix.length, normalizeTanakhSearchInput);
                }} />
            {searching && <>
                {allMatches.length > 0 && <label className="tanakh-match-filter">
                    {t('סינון לפי פרשיות')}
                    <select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>
                        <option value="all">{t('כל המופעים')}</option>
                        <option value="within">{t('בתוך פרשיה אחת')}</option>
                        <option value="whole">{t('פרשיה שלמה')}</option>
                        <option value="across">{t('חוצה גבול פרשיה')}</option>
                        {counts.length > 0 && <optgroup label={t('מספר הגבולות שנחצו')}>
                            {counts.map(count => <option key={count} value={`count:${count}`}>{count}</option>)}
                        </optgroup>}
                        {counts.length > 0 && <optgroup label={t('סוג הגבול שנחצה')}>
                            {Object.entries(boundaryTypeNames).map(([type, name]) => <option key={type} value={type}>{t(name)}</option>)}
                        </optgroup>}
                    </select>
                </label>}
                <p role="status">{failed ? t('טעינת מפתח החיפוש נכשלה.') : !data ? t('טוען את מפתח החיפוש…')
                    : !allMatches.length ? t('לא נמצאו מופעים בכתיב הזה.')
                    : !matches.length ? t('אין מופעים התואמים לסינון.')
                    : t`מופעים ${first + 1}–${end} מתוך ${matches.length}`}</p>
                {failed && <button type="button" onClick={() => setAttempt(n => n + 1)}>{t('נסה שוב')}</button>}
                {matches.length > 0 && <>
                    <ul className="tanakh-search-results">
                        {matches.slice(first, end).map(hit => <SpellingResult key={hit.start} data={data} hit={hit} onOpen={onOpen} />)}
                    </ul>
                    {matches.length > PAGE_SIZE && <div className="tanakh-search-pages">
                        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('תוצאות קודמות')}</button>
                        <button type="button" disabled={end === matches.length} onClick={() => setPage(page + 1)}>{t('תוצאות נוספות')}</button>
                    </div>}
                </>}
            </>}
        </div>
    );
}
