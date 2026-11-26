import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCorpusManifest, loadVerifiedCorpusFile } from '../core/corpusData.js';
import { normalizeTanakhSearchInput, normalizeTypedTanakhSearchInput } from '../core/searchInput.js';
import { buildSpellingIndex, findSpellingMatches, matchesSectionFilter } from '../core/tanakhSearch.js';
import { boundaryTypeNames } from '../core/researchModel.js';
import SpellingResult from './SpellingResult.jsx';
import RelatedSpellings from './RelatedSpellings.jsx';
import SongLabel from './SongLabel.jsx';
import { findSongs } from '../core/tanakhSongs.js';
import useLanguage, { BilingualLabel } from '../i18n/LanguageContext.jsx';
import { t } from '../i18n/locale.js';

const PAGE_SIZE = 8;

async function loadSearchData() {
    const manifest = await loadCorpusManifest();
    const index = await loadVerifiedCorpusFile(manifest.downloads.wordOccurrencesJson);
    if (index.contentHash !== manifest.contentHash) throw new Error('Corpus index version mismatch');
    const books = new Map(manifest.divisions.flatMap(division => division.books.map(book => [book.slug, book])));
    return { index: buildSpellingIndex(index), books, contentHash: manifest.contentHash };
}

export default function TanakhSearch({ onOpen }) {
    const language = useLanguage();
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState('all');
    const [collapsed, setCollapsed] = useState(false);
    const inputRef = useRef(null);
    const spelling = query.trim();
    const namedSongs = findSongs(spelling);
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
        setCollapsed(false);
    };
    function clearSearch() {
        setQuery('');
        setPage(0);
        setFilter('all');
        setCollapsed(false);
        inputRef.current.focus();
    }
    function handleKey(event) {
        if (event.key === 'Escape' && searching) {
            event.preventDefault();
            event.stopPropagation();
            setCollapsed(true);
            inputRef.current.focus();
        } else if (event.target === inputRef.current && event.key === 'ArrowDown' && collapsed) {
            event.preventDefault();
            setCollapsed(false);
        }
    }

    return (
        <div className="tanakh-search" role="search" aria-labelledby="tanakh-search-label" onKeyDown={handleKey}>
            <div className="tanakh-search-heading">
                <label id="tanakh-search-label" htmlFor="tanakh-search"><BilingualLabel message="חיפוש בתנ״ך" /></label>
                {query && <button type="button" onClick={clearSearch}>{t('נקה חיפוש')}</button>}
                {searching && <button type="button" aria-expanded={!collapsed} aria-controls="tanakh-matches" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? t('הצג תוצאות') : t('הסתר תוצאות')}
                </button>}
            </div>
            <input ref={inputRef} id="tanakh-search" className="workspace-search-field" type="search" dir="rtl" lang={query ? 'he' : language} autoComplete="off" spellCheck={false}
                placeholder={t('חפש מילה או צירוף')} value={query}
                onChange={({ currentTarget: input }) => updateInput(input, input.value, input.selectionStart, normalizeTypedTanakhSearchInput)}
                onPaste={event => {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const prefix = input.value.slice(0, input.selectionStart) + event.clipboardData.getData('text/plain');
                    updateInput(input, prefix + input.value.slice(input.selectionEnd), prefix.length, normalizeTanakhSearchInput);
                }} />
            {searching && <div id="tanakh-matches" hidden={collapsed}>
                {namedSongs.length > 0 && <div className="tanakh-named-songs" role="group" aria-label={t('שירות וקטעים')}>
                    {namedSongs.map(song => <button key={song.id} type="button" onClick={() => onOpen(song)}>
                        <SongLabel song={song} /> · {t(song.kind === 'passage' ? 'פתח את הקטע המלא' : 'פתח את השירה')}
                    </button>)}
                </div>}
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
                {data && words.length === 1 && <RelatedSpellings key={spelling} data={data} query={spelling} onOpen={onOpen} />}
            </div>}
        </div>
    );
}
