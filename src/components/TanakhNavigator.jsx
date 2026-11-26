import { t } from '../i18n/locale.js';
import useLanguage, { BilingualLabel } from '../i18n/LanguageContext.jsx';
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';

import { corpusUrl, loadCorpusManifest, loadVerifiedCorpusFile } from '../core/corpusData.js';
import { createTanakhSelection, tanakhActionLabel, tanakhSelectionLabel } from '../core/tanakhSelection.js';
import { sourceMatchRange } from '../core/tanakhSearch.js';
import TanakhBoundary from './TanakhBoundary.jsx';
import { songs, songNumbers } from '../core/tanakhSongs.js';
import SongLabel from './SongLabel.jsx';
import { locatorText } from '../core/researchModel.js';

const SELECTION_SCOPES = Object.freeze([
    { id: 'book', label: 'כל הספר' },
    { id: 'range', label: 'טווח פרשיות' },
    { id: 'section', label: 'פרשיה אחת' },
]);

function locatorRangeLabel(locators) {
    if (!locators) return '';
    const start = locatorText(locators.start);
    const end = locatorText(locators.end);
    return start === end ? start : `${start}–${end}`;
}

function sectionOptionLabel(section) {
    return t`פרשיה ${section.ordinal} · ${locatorRangeLabel(section.locators)}`;
}

const TanakhNavigator = memo(({ currentSelection, initialHit, isDarkMode, onSelect, onOpen }) => {
    useLanguage();
    const [manifest, setManifest] = useState(null);
    const [selectedDivision, setSelectedDivision] = useState('torah');
    const [selectedBook, setSelectedBook] = useState(null);
    const [loadedBook, setLoadedBook] = useState(null);
    const bookData = loadedBook?.file === selectedBook?.file ? loadedBook?.data : null;
    const [selectionScope, setSelectionScope] = useState('book');
    const [rangeStart, setRangeStart] = useState(1);
    const [rangeEnd, setRangeEnd] = useState(1);
    const [provenance, setProvenance] = useState(null);
    const [provenanceError, setProvenanceError] = useState(null);
    const [status, setStatus] = useState('manifest');
    const [error, setError] = useState(null);
    const [manifestAttempt, setManifestAttempt] = useState(0);
    const [bookAttempt, setBookAttempt] = useState(0);
    const pendingSelectionRef = useRef(initialHit ? {
        bookSlug: initialHit.bookSlug, scope: initialHit.ordinal === initialHit.endOrdinal ? 'section' : 'range',
        startSectionOrdinal: initialHit.ordinal, endSectionOrdinal: initialHit.endOrdinal,
    } : currentSelection);
    const [searchHit, setSearchHit] = useState(initialHit?.sectionId ? initialHit : null);
    const matchRef = useRef(null);
    const songHeading = useRef(null);

    useEffect(() => {
        let active = true;
        setStatus('manifest');
        setError(null);
        loadCorpusManifest()
            .then((data) => {
                if (!active) return;
                setManifest(data);
                const selectedBookFromManifest = pendingSelectionRef.current
                    ? data.divisions.flatMap((item) => item.books).find((book) => book.slug === pendingSelectionRef.current.bookSlug)
                    : null;
                const division = data.divisions.find((item) => (
                    selectedBookFromManifest ? item.books.includes(selectedBookFromManifest) : item.id === 'torah'
                )) || data.divisions[0];
                setSelectedDivision(division.id);
                setSelectedBook(selectedBookFromManifest || division.books[0] || null);
                setStatus(null);
            })
            .catch((fetchError) => {
                if (active) {
                    setError({ message: fetchError.message });
                    setStatus(null);
                }
            });
        return () => { active = false; };
    }, [manifestAttempt]);

    useEffect(() => {
        if (!selectedBook) return undefined;
        let active = true;
        setLoadedBook(null);
        setSelectionScope('book');
        setRangeStart(1);
        setRangeEnd(1);
        setStatus('book');
        setError(null);
        loadVerifiedCorpusFile(selectedBook.file)
            .then((data) => {
                if (!active) return;
                const saved = pendingSelectionRef.current;
                const restored = saved?.bookSlug === selectedBook.slug
                    ? createTanakhSelection(data.sections, saved.scope, saved.startSectionOrdinal, saved.endSectionOrdinal)
                    : null;
                setSelectionScope(restored?.scope || 'book');
                setRangeStart(restored?.startOrdinal || 1);
                setRangeEnd(restored?.endOrdinal || 1);
                setLoadedBook({ file: selectedBook.file, data });
                pendingSelectionRef.current = null;
                setStatus(null);
            })
            .catch((fetchError) => {
                if (active) {
                    setError({ book: selectedBook.name, message: fetchError.message });
                    setStatus(null);
                }
            });
        return () => { active = false; };
    }, [selectedBook, bookAttempt]);

    const activeDivision = useMemo(
        () => manifest?.divisions.find((division) => division.id === selectedDivision) || null,
        [manifest, selectedDivision],
    );
    const activeSelection = useMemo(
        () => createTanakhSelection(bookData?.sections, selectionScope, rangeStart, rangeEnd),
        [bookData, rangeEnd, rangeStart, selectionScope],
    );

    const matchParts = useMemo(() => {
        if (!searchHit || activeSelection?.sections[0].id !== searchHit.sectionId || activeSelection.endOrdinal !== searchHit.endOrdinal) return null;
        return activeSelection.sections.map((section, index) => {
            const first = index === 0 ? searchHit.position : 1;
            const last = section.ordinal === searchHit.endOrdinal ? searchHit.endPosition : section.wordCount;
            const [start, end] = sourceMatchRange(section.sourceText, first, last - first + 1);
            return <Fragment key={section.id}>
                {index > 0 && <>{'\n'}<TanakhBoundary boundary={activeSelection.sections[index - 1].boundaryAfter} />{'\n'}</>}
                {section.sourceText.slice(0, start)}
                <mark tabIndex={index === 0 ? -1 : undefined} ref={index === 0 ? matchRef : undefined}>{section.sourceText.slice(start, end)}</mark>
                {section.sourceText.slice(end)}
            </Fragment>;
        });
    }, [activeSelection, searchHit]);

    useEffect(() => {
        if (!matchParts) return;
        const frame = requestAnimationFrame(() => {
            const match = matchRef.current;
            if (!match) return;
            match.focus({ preventScroll: true });
            const block = match.offsetHeight >= match.closest('.tanakh-preview').clientHeight ? 'start' : 'center';
            match.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
        });
        return () => cancelAnimationFrame(frame);
    }, [matchParts]);

    const containingSong = activeSelection && songs.find(song => song.bookSlug === selectedBook?.slug &&
        song.ordinal <= activeSelection.startOrdinal && song.endOrdinal >= activeSelection.endOrdinal);
    const fullSong = containingSong && containingSong.ordinal === activeSelection.startOrdinal &&
        containingSong.endOrdinal === activeSelection.endOrdinal ? containingSong : null;
    useEffect(() => {
        if (!fullSong || initialHit?.id !== fullSong.id) return;
        const frame = requestAnimationFrame(() => {
            songHeading.current?.focus({ preventScroll: true });
            songHeading.current?.scrollIntoView({ block: 'start' });
        });
        return () => cancelAnimationFrame(frame);
    }, [fullSong, initialHit]);

    const chooseBook = (book) => {
        pendingSelectionRef.current = null;
        setSearchHit(null);
        setSelectedBook(book);
    };

    const chooseDivision = (division) => {
        setSelectedDivision(division.id);
        chooseBook(division.books[0] || null);
    };

    const chooseScope = (scope) => {
        setSearchHit(null);
        setSelectionScope(scope);
        if (scope === 'section') setRangeEnd(rangeStart);
        if (scope === 'range') setRangeEnd((currentEnd) => Math.max(currentEnd, rangeStart));
    };

    const chooseStart = (ordinal) => {
        setSearchHit(null);
        setRangeStart(ordinal);
        setRangeEnd((currentEnd) => selectionScope === 'section' ? ordinal : Math.max(currentEnd, ordinal));
    };

    const moveSingleSection = (delta) => {
        if (!bookData) return;
        const ordinal = Math.min(Math.max(rangeStart + delta, 1), bookData.sections.length);
        chooseStart(ordinal);
    };

    const loadProvenance = () => {
        if (provenance || !manifest) return;
        setProvenanceError(null);
        loadVerifiedCorpusFile(manifest.provenance)
            .then(setProvenance)
            .catch((fetchError) => setProvenanceError(t`לא ניתן לטעון את פרטי המקור: ${fetchError.message}`));
    };

    return (
        <section className={`app-corpus-panel rounded-xl border mb-8 overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`} aria-label={t("בחירת טקסט מן התנ״ך")}>
            <div className={`tanakh-header p-5 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-slate-200 bg-white/70'}`}>
                <div className="tanakh-header-row flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold"><BilingualLabel message="מקרא על פי המסורה" /></h2>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}><BilingualLabel message="כתיב בלבד · פרשיות מסורה רציפות · פרקים ופסוקים לאיתור בלבד" /></p>
                    </div>
                    {manifest && (
                        <div className="tanakh-meta-actions flex flex-col items-end gap-2">
                            <span className={`text-xs rounded-full px-3 py-1 ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'}`}>
                                {manifest.statistics.sections.toLocaleString('he-IL')}{t(" פרשיות")}</span>
                            {manifest.downloads?.fullCorpusJson && (
                                <a
                                    href={corpusUrl(manifest.downloads.fullCorpusJson)}
                                    download="aleph-efes-tanakh-corpus.json"
                                    className="tanakh-download inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                                ><BilingualLabel message="הורד קורפוס מלא · א=0 / א=1 · JSON" /></a>
                            )}
                            <div className="flex flex-wrap justify-end gap-3 text-xs">
                                {manifest.downloads?.wordOccurrencesJson && (
                                    <a className="text-blue-600 dark:text-blue-400 underline" href={corpusUrl(manifest.downloads.wordOccurrencesJson)} download={manifest.downloads.wordOccurrencesJson}><BilingualLabel message="אינדקס מופעים · JSON" /></a>
                                )}
                                {manifest.downloads?.tokenLocationsJson && (
                                    <a className="text-blue-600 dark:text-blue-400 underline" href={corpusUrl(manifest.downloads.tokenLocationsJson)} download={manifest.downloads.tokenLocationsJson}><BilingualLabel message="מיקומי פסוקים · JSON" /></a>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {manifest && (
                    <div className={`tanakh-division-tabs inline-flex mt-4 p-1 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
                        {manifest.divisions.map((division) => (
                            <button
                                key={division.id}
                                type="button"
                                onClick={() => chooseDivision(division)}
                                aria-pressed={selectedDivision === division.id}
                                className={`px-5 py-1.5 rounded-full font-semibold transition-colors ${selectedDivision === division.id ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-700 shadow') : ''}`}
                            >
                                {t(division.name)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="tanakh-content p-5">
                <label className="tanakh-song-picker">{t('שירות מקראיות')}
                    <select value={fullSong?.id || ''} onChange={event => {
                        const song = songs.find(item => item.id === event.target.value);
                        if (song) onOpen(song);
                    }}>
                        <option value="">{t('בחר שירה')}</option>
                        {songs.map(song => <option key={song.id} value={song.id}>{t(song.title)} · {t(song.book)} {songNumbers(song)}</option>)}
                    </select>
                </label>
                {activeDivision && (
                    <div className="tanakh-books flex flex-wrap gap-2 mb-5" aria-label={t("ספרים")}>
                        {activeDivision.books.map((book) => (
                            <button
                                key={book.slug}
                                type="button"
                                onClick={() => chooseBook(book)}
                                aria-pressed={selectedBook?.slug === book.slug}
                                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${selectedBook?.slug === book.slug ? 'bg-blue-600 border-blue-600 text-white' : (isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-slate-300 bg-white hover:bg-slate-100')}`}
                            >
                                {t(book.name)}
                                <span className="opacity-70 mr-1">({book.sections})</span>
                            </button>
                        ))}
                    </div>
                )}

                {status && <p className="text-center py-10 text-gray-500" role="status">{status === 'manifest' ? t('טוען מפתח ספרים…') : t`טוען ${t(selectedBook.name)}…`}</p>}
                {error && (
                    <div className="rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 mb-4">
                        <p role="alert">{error.book ? t`לא ניתן לטעון את ${t(error.book)}: ${error.message}` : t`לא ניתן לטעון את מפתח המקרא: ${error.message}`}</p>
                        <button type="button" className="underline" onClick={() => {
                            if (manifest) setBookAttempt((attempt) => attempt + 1);
                            else setManifestAttempt((attempt) => attempt + 1);
                        }}>{t("נסה שוב")}</button>
                    </div>
                )}

                {bookData && activeSelection && (
                    <div className="tanakh-workspace">
                        <div className={`tanakh-controls rounded-xl p-4 ${isDarkMode ? 'bg-gray-700/60' : 'bg-slate-100'}`}>
                            <div className={`tanakh-scope-tabs grid grid-cols-3 gap-1 p-1 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-200'}`} aria-label={t("היקף הבחירה")}>
                                {SELECTION_SCOPES.map((scope) => (
                                    <button
                                        key={scope.id}
                                        type="button"
                                        onClick={() => chooseScope(scope.id)}
                                        aria-pressed={selectionScope === scope.id}
                                        className={`rounded-md px-2 py-2 text-sm font-semibold transition-colors ${selectionScope === scope.id ? (isDarkMode ? 'bg-blue-500 text-white' : 'bg-white text-blue-700 shadow-sm') : ''}`}
                                    >
                                        <BilingualLabel message={scope.label} />
                                    </button>
                                ))}
                            </div>

                            {selectionScope === 'range' ? (
                                <div className="tanakh-range-fields grid grid-cols-2 gap-2">
                                    <label className="block text-sm font-bold" htmlFor="tanakh-range-start">{t("התחלה")}<select
                                            id="tanakh-range-start"
                                            value={rangeStart}
                                            onChange={(event) => chooseStart(Number(event.target.value))}
                                            className={`mt-2 w-full rounded-lg border px-2 py-2 font-normal ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                                        >
                                            {bookData.sections.map((section) => <option key={section.id} value={section.ordinal}>{section.ordinal} · {locatorRangeLabel(section.locators)}</option>)}
                                        </select>
                                    </label>
                                    <label className="block text-sm font-bold" htmlFor="tanakh-range-end">{t("סיום")}<select
                                            id="tanakh-range-end"
                                            value={rangeEnd}
                                            onChange={(event) => { setSearchHit(null); setRangeEnd(Number(event.target.value)); }}
                                            className={`mt-2 w-full rounded-lg border px-2 py-2 font-normal ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                                        >
                                            {bookData.sections.slice(rangeStart - 1).map((section) => <option key={section.id} value={section.ordinal}>{section.ordinal} · {locatorRangeLabel(section.locators)}</option>)}
                                        </select>
                                    </label>
                                </div>
                            ) : selectionScope === 'section' ? (
                                <>
                                    <label className="block text-sm font-bold mb-2" htmlFor="tanakh-section">{t("פרשיה בספר ")}{t(selectedBook.name)}</label>
                                    <select
                                        id="tanakh-section"
                                        value={rangeStart}
                                        onChange={(event) => chooseStart(Number(event.target.value))}
                                        className={`w-full rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                                    >
                                        {bookData.sections.map((section) => <option key={section.id} value={section.ordinal}>{sectionOptionLabel(section)}</option>)}
                                    </select>
                                    <div className="tanakh-section-navigation grid grid-cols-2 gap-2 mt-3" dir="rtl">
                                        <button type="button" disabled={rangeStart <= 1} onClick={() => moveSingleSection(-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t("הקודמת")}</button>
                                        <button type="button" disabled={rangeStart >= bookData.sections.length} onClick={() => moveSingleSection(1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t("הבאה")}</button>
                                    </div>
                                </>
                            ) : null}

                            <dl className={`mt-4 text-sm space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                                <div className="flex justify-between gap-3"><dt>{t("בחירה")}</dt><dd className="font-semibold text-left">{tanakhSelectionLabel(activeSelection)}</dd></div>
                                <div className="tanakh-location flex justify-between gap-3"><dt>{t("איתור")}</dt><dd className="font-semibold text-left">{locatorRangeLabel(activeSelection.locators)}</dd></div>
                                <div className="flex justify-between"><dt>{t("פרשיות")}</dt><dd className="font-semibold">{activeSelection.sectionCount.toLocaleString('he-IL')}</dd></div>
                                <div className="flex justify-between"><dt>{t("מילים")}</dt><dd className="font-semibold">{activeSelection.wordCount.toLocaleString('he-IL')}</dd></div>
                                <div className="tanakh-letter-count flex justify-between" title={t("אותיות החישוב בלבד; ללא ניקוד, טעמים, רווחים וסימני פיסוק.")}><dt>{t("אותיות")}</dt><dd className="font-semibold">{activeSelection.letterCount.toLocaleString('he-IL')}</dd></div>
                                <div className="flex justify-between"><dt>{t("גבול אחרון")}</dt><dd className="font-semibold">{activeSelection.boundaryAfter?.upstreamMarker || t('סוף הספר')}</dd></div>
                            </dl>
                        </div>

                        <div>
                            {fullSong && <h3 ref={songHeading} tabIndex={-1} className="tanakh-song-heading"><SongLabel song={fullSong} /></h3>}
                            <div className={`tanakh-preview rounded-xl border ${isDarkMode ? 'border-gray-700 bg-gray-900/35' : 'border-slate-200 bg-white'}`} dir="rtl" lang="he">
                                {matchParts || (fullSong ? activeSelection.sections.map(section =>
                                    <div className="tanakh-song-unit" key={section.id}>{section.sourceText}</div>
                                ) : activeSelection.sourceText)}
                            </div>
                            <div className="tanakh-actions mt-4 flex justify-end">
                                {containingSong && !fullSong && <button type="button" onClick={() => onOpen(containingSong)}>
                                    {t('פתח את השירה המלאה')} · <SongLabel song={containingSong} />
                                </button>}
                                <button
                                    type="button"
                                    onClick={() => onSelect(activeSelection.calculationText, activeSelection, selectedBook)}
                                    className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                                >
                                    {fullSong ? t('נתח את השירה') : tanakhActionLabel(activeSelection)}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <details className={`mt-5 pt-4 border-t text-sm ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-slate-200 text-slate-600'}`} onToggle={(event) => {
                    if (event.currentTarget.open) loadProvenance();
                }}>
                    <summary className="cursor-pointer font-semibold">{t("על הטקסט")}</summary>
                    <div className="mt-3 space-y-2 leading-6">
                        <p><a className="text-blue-600 dark:text-blue-400 underline" href="https://he.wikisource.org/wiki/מקרא_על_פי_המסורה#ראש" target="_blank" rel="noreferrer">{t("מקרא על פי המסורה (MAM), ויקיטקסט")}</a>{t(" · כתיב בלבד · ")}<a className="text-blue-600 dark:text-blue-400 underline" href="https://creativecommons.org/licenses/by-sa/4.0/deed.he" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.</p>
                        {provenanceError && <div><p role="alert">{provenanceError}</p><button type="button" className="underline" onClick={loadProvenance}>{t("נסה שוב")}</button></div>}
                        {provenance && (
                            <details className={`rounded-lg border px-3 py-2 ${isDarkMode ? 'border-gray-700 bg-gray-900/25' : 'border-slate-200 bg-white/70'}`}>
                                <summary className="cursor-pointer text-xs font-semibold">{t("פרטי גרסאות טכניים")}</summary>
                                <div className="mt-2 space-y-1 text-xs font-mono break-all" dir="ltr">
                                    <p>MAM-parsed: {provenance.source.revision || 'revision unavailable'}</p>
                                    <p>MAM-basics: {provenance.semanticsReference.revision || 'revision unavailable'}</p>
                                </div>
                            </details>
                        )}
                    </div>
                </details>
            </div>
        </section>
    );
});

TanakhNavigator.displayName = 'TanakhNavigator';

export default TanakhNavigator;
