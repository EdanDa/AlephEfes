import { useEffect, useMemo, useState } from 'react';
import { loadVerifiedCorpusFile } from '../core/corpusData.js';
import { normalizeTanakhSearchInput } from '../core/searchInput.js';
import { findSpellingMatches, indexSectionWords } from '../core/tanakhSearch.js';
import useLanguage, { BilingualLabel } from '../i18n/LanguageContext.jsx';
import { t } from '../i18n/locale.js';

const PAGE_SIZE = 8;

export default function TanakhSearch({ manifest, onOpen }) {
    useLanguage();
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
        loadVerifiedCorpusFile(manifest.downloads.wordOccurrencesJson).then(index => {
            if (!active) return;
            if (index.contentHash !== manifest.contentHash) throw new Error('Corpus index version mismatch');
            setData({ index, sections: indexSectionWords(index) });
        }).catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [searching, manifest, data, attempt]);

    const books = useMemo(() => new Map(manifest.divisions.flatMap(division =>
        division.books.map(book => [book.slug, { book, divisionId: division.id }]))), [manifest]);
    const words = useMemo(() => spelling.split(' '), [spelling]);
    const matches = useMemo(() => data && searching ? findSpellingMatches(data.index, data.sections, words) : [],
        [data, searching, words]);
    const first = page * PAGE_SIZE;
    const end = Math.min(first + PAGE_SIZE, matches.length);

    const updateInput = (input, raw, caret) => {
        const cleaned = normalizeTanakhSearchInput(raw);
        if (cleaned !== input.value) {
            input.value = cleaned;
            const position = normalizeTanakhSearchInput(raw.slice(0, caret)).length;
            input.setSelectionRange(position, position);
        }
        setQuery(cleaned);
        setPage(0);
    };

    return (
        <div className="tanakh-search" role="search" aria-labelledby="tanakh-search-label">
            <label id="tanakh-search-label" htmlFor="tanakh-search"><BilingualLabel message="חיפוש בתנ״ך" /></label>
            <input id="tanakh-search" type="search" dir="rtl" lang="he" autoComplete="off" spellCheck={false}
                placeholder="בראשית ברא" value={query}
                onChange={({ currentTarget: input }) => updateInput(input, input.value, input.selectionStart)}
                onPaste={event => {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const prefix = input.value.slice(0, input.selectionStart) + event.clipboardData.getData('text/plain');
                    updateInput(input, prefix + input.value.slice(input.selectionEnd), prefix.length);
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
                            const entry = books.get(sectionId.slice(0, split));
                            const ordinal = Number(sectionId.slice(split + 1));
                            const tokens = data.sections[section];
                            const start = position - 1, stop = start + words.length;
                            return <li key={sectionId + '/' + position}>
                                <button type="button" onClick={() => onOpen({ ...entry, ordinal, sectionId, position, length: words.length })}>
                                    <span>{t`${t(entry.book.name)} · פרשיה ${ordinal}`} · {t`מילה ${position}`}</span>
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
