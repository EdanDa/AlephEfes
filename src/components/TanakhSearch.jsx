import { useEffect, useMemo, useState } from 'react';
import { loadCorpusManifest, loadVerifiedCorpusFile } from '../core/corpusData.js';
import { normalizeTanakhSearchInput, normalizeTypedTanakhSearchInput } from '../core/searchInput.js';
import { findSpellingMatches, indexSectionWords } from '../core/tanakhSearch.js';
import useLanguage, { BilingualLabel } from '../i18n/LanguageContext.jsx';
import { t } from '../i18n/locale.js';

const PAGE_SIZE = 8;

async function loadSearchData() {
    const manifest = await loadCorpusManifest();
    const index = await loadVerifiedCorpusFile(manifest.downloads.wordOccurrencesJson);
    if (index.contentHash !== manifest.contentHash) throw new Error('Corpus index version mismatch');
    const books = new Map(manifest.divisions.flatMap(division => division.books.map(book => [book.slug, book])));
    return { index, sections: indexSectionWords(index), books };
}

export default function TanakhSearch({ onOpen }) {
    const language = useLanguage();
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [page, setPage] = useState(0);
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
    const matches = useMemo(() => data && searching ? findSpellingMatches(data.index, data.sections, words) : [],
        [data, searching, words]);
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
                <p role="status">{failed ? t('טעינת מפתח החיפוש נכשלה.') : !data ? t('טוען את מפתח החיפוש…')
                    : !matches.length ? t('לא נמצאו מופעים בכתיב הזה.')
                    : t`מופעים ${first + 1}–${end} מתוך ${matches.length}`}</p>
                {failed && <button type="button" onClick={() => setAttempt(n => n + 1)}>{t('נסה שוב')}</button>}
                {matches.length > 0 && <>
                    <ul className="tanakh-search-results">
                        {matches.slice(first, end).map(([section, position]) => {
                            const sectionId = data.index.sectionIds[section];
                            const split = sectionId.lastIndexOf('-');
                            const book = data.books.get(sectionId.slice(0, split));
                            const ordinal = Number(sectionId.slice(split + 1));
                            const tokens = data.sections[section];
                            const start = position - 1, stop = start + words.length;
                            return <li key={sectionId + '/' + position}>
                                <button type="button" onClick={() => onOpen({ bookSlug: book.slug, ordinal, sectionId, position, length: words.length })}>
                                    <span>{t`${t(book.name)} · פרשיה ${ordinal}`} · {t`מילה ${position}`}</span>
                                    <span className="tanakh-search-excerpt" dir="rtl" lang="he">
                                        {start > 4 && '… '}{tokens.slice(Math.max(0, start - 4), start).join(' ')}{' '}
                                        <mark>{spelling}</mark>{' '}{tokens.slice(stop, stop + 4).join(' ')}{stop + 4 < tokens.length && ' …'}
                                    </span>
                                </button>
                            </li>;
                        })}
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
