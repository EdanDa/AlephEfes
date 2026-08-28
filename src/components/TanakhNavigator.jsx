import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

import { createTanakhSelection, tanakhActionLabel, tanakhSelectionLabel } from '../core/tanakhSelection.js';

const corpusUrl = (relativePath) => `${import.meta.env.BASE_URL}corpus/${relativePath}`;
const SELECTION_SCOPES = Object.freeze([
    { id: 'book', label: 'כל הספר' },
    { id: 'range', label: 'טווח פרשיות' },
    { id: 'section', label: 'פרשיה אחת' },
]);

function locatorLabel(locator) {
    if (!locator) return '';
    const book = locator.subBook || locator.book24.replace(/^(ספר|מגילת)\s+/u, '');
    return `${book} ${locator.chapter}:${locator.verse}`;
}

function locatorRangeLabel(locators) {
    if (!locators) return '';
    const start = locatorLabel(locators.start);
    const end = locatorLabel(locators.end);
    return start === end ? start : `${start}–${end}`;
}

function sectionOptionLabel(section) {
    return `פרשיה ${section.ordinal} · ${locatorRangeLabel(section.locators)}`;
}

const TanakhNavigator = memo(({ currentSelection, isDarkMode, onSelect }) => {
    const [manifest, setManifest] = useState(null);
    const [selectedDivision, setSelectedDivision] = useState('torah');
    const [selectedBook, setSelectedBook] = useState(null);
    const [bookData, setBookData] = useState(null);
    const [selectionScope, setSelectionScope] = useState('book');
    const [rangeStart, setRangeStart] = useState(1);
    const [rangeEnd, setRangeEnd] = useState(1);
    const [provenance, setProvenance] = useState(null);
    const [status, setStatus] = useState('טוען מפתח ספרים…');
    const [error, setError] = useState(null);
    const initialSelectionRef = useRef(currentSelection);

    useEffect(() => {
        const controller = new AbortController();
        setStatus('טוען מפתח ספרים…');
        fetch(corpusUrl('manifest.json'), { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                setManifest(data);
                const selectedBookFromManifest = initialSelectionRef.current
                    ? data.divisions.flatMap((item) => item.books).find((book) => book.slug === initialSelectionRef.current.bookSlug)
                    : null;
                const division = data.divisions.find((item) => (
                    selectedBookFromManifest ? item.books.includes(selectedBookFromManifest) : item.id === 'torah'
                )) || data.divisions[0];
                setSelectedDivision(division.id);
                setSelectedBook(selectedBookFromManifest || division.books[0] || null);
                setStatus(null);
            })
            .catch((fetchError) => {
                if (fetchError.name !== 'AbortError') {
                    setError(`לא ניתן לטעון את מפתח המקרא: ${fetchError.message}`);
                    setStatus(null);
                }
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!selectedBook) return undefined;
        const controller = new AbortController();
        setBookData(null);
        setSelectionScope('book');
        setRangeStart(1);
        setRangeEnd(1);
        setStatus(`טוען ${selectedBook.name}…`);
        setError(null);
        fetch(corpusUrl(selectedBook.file), { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                setBookData(data);
                setSelectionScope('book');
                setRangeStart(1);
                setRangeEnd(1);
                setStatus(null);
            })
            .catch((fetchError) => {
                if (fetchError.name !== 'AbortError') {
                    setError(`לא ניתן לטעון את ${selectedBook.name}: ${fetchError.message}`);
                    setStatus(null);
                }
            });
        return () => controller.abort();
    }, [selectedBook]);

    const activeDivision = useMemo(
        () => manifest?.divisions.find((division) => division.id === selectedDivision) || null,
        [manifest, selectedDivision],
    );
    const activeSelection = useMemo(
        () => createTanakhSelection(bookData?.sections, selectionScope, rangeStart, rangeEnd),
        [bookData, rangeEnd, rangeStart, selectionScope],
    );

    const chooseDivision = (division) => {
        setSelectedDivision(division.id);
        setSelectedBook(division.books[0] || null);
    };

    const chooseScope = (scope) => {
        setSelectionScope(scope);
        if (scope === 'section') setRangeEnd(rangeStart);
        if (scope === 'range') setRangeEnd((currentEnd) => Math.max(currentEnd, rangeStart));
    };

    const chooseStart = (ordinal) => {
        setRangeStart(ordinal);
        setRangeEnd((currentEnd) => selectionScope === 'section' ? ordinal : Math.max(currentEnd, ordinal));
    };

    const moveSingleSection = (delta) => {
        if (!bookData) return;
        const ordinal = Math.min(Math.max(rangeStart + delta, 1), bookData.sections.length);
        setRangeStart(ordinal);
        setRangeEnd(ordinal);
    };

    const loadProvenance = (event) => {
        if (!event.currentTarget.open || provenance || !manifest) return;
        fetch(corpusUrl(manifest.provenance))
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(setProvenance)
            .catch((fetchError) => setError(`לא ניתן לטעון את פרטי המקור: ${fetchError.message}`));
    };

    return (
        <section className={`rounded-xl border mb-8 overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`} aria-label="בחירת טקסט מן התנ״ך">
            <div className={`tanakh-header p-5 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-slate-200 bg-white/70'}`}>
                <div className="tanakh-header-row flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold">מקרא על פי המסורה</h2>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>כתיב בלבד · פרשיות מסורה רציפות · פרקים ופסוקים לאיתור בלבד</p>
                    </div>
                    {manifest && (
                        <div className="tanakh-meta-actions flex flex-col items-end gap-2">
                            <span className={`text-xs rounded-full px-3 py-1 ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'}`}>
                                {manifest.statistics.sections.toLocaleString('he-IL')} פרשיות
                            </span>
                            {manifest.downloads?.fullCorpusJson && (
                                <a
                                    href={corpusUrl(manifest.downloads.fullCorpusJson)}
                                    download="aleph-efes-tanakh-corpus.json"
                                    className="tanakh-download inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                                >
                                    הורד קורפוס מלא · JSON
                                </a>
                            )}
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
                                {division.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="tanakh-content p-5">
                {activeDivision && (
                    <div className="tanakh-books flex flex-wrap gap-2 mb-5" aria-label="ספרים">
                        {activeDivision.books.map((book) => (
                            <button
                                key={book.slug}
                                type="button"
                                onClick={() => setSelectedBook(book)}
                                aria-pressed={selectedBook?.slug === book.slug}
                                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${selectedBook?.slug === book.slug ? 'bg-blue-600 border-blue-600 text-white' : (isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-slate-300 bg-white hover:bg-slate-100')}`}
                            >
                                {book.name}
                                <span className="opacity-70 mr-1">({book.sections})</span>
                            </button>
                        ))}
                    </div>
                )}

                {status && <p className="text-center py-10 text-gray-500" role="status">{status}</p>}
                {error && <p className="rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 mb-4" role="alert">{error}</p>}

                {bookData && activeSelection && (
                    <div className="tanakh-workspace grid lg:grid-cols-[19rem_1fr] gap-5">
                        <div className={`tanakh-controls rounded-xl p-4 ${isDarkMode ? 'bg-gray-700/60' : 'bg-slate-100'}`}>
                            <div className={`tanakh-scope-tabs grid grid-cols-3 gap-1 p-1 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-200'}`} aria-label="היקף הבחירה">
                                {SELECTION_SCOPES.map((scope) => (
                                    <button
                                        key={scope.id}
                                        type="button"
                                        onClick={() => chooseScope(scope.id)}
                                        aria-pressed={selectionScope === scope.id}
                                        className={`rounded-md px-2 py-2 text-sm font-semibold transition-colors ${selectionScope === scope.id ? (isDarkMode ? 'bg-blue-500 text-white' : 'bg-white text-blue-700 shadow-sm') : ''}`}
                                    >
                                        {scope.label}
                                    </button>
                                ))}
                            </div>

                            {selectionScope === 'range' ? (
                                <div className="tanakh-range-fields grid grid-cols-2 gap-2">
                                    <label className="block text-sm font-bold" htmlFor="tanakh-range-start">
                                        התחלה
                                        <select
                                            id="tanakh-range-start"
                                            value={rangeStart}
                                            onChange={(event) => chooseStart(Number(event.target.value))}
                                            className={`mt-2 w-full rounded-lg border px-2 py-2 font-normal ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                                        >
                                            {bookData.sections.map((section) => <option key={section.id} value={section.ordinal}>{section.ordinal} · {locatorRangeLabel(section.locators)}</option>)}
                                        </select>
                                    </label>
                                    <label className="block text-sm font-bold" htmlFor="tanakh-range-end">
                                        סיום
                                        <select
                                            id="tanakh-range-end"
                                            value={rangeEnd}
                                            onChange={(event) => setRangeEnd(Number(event.target.value))}
                                            className={`mt-2 w-full rounded-lg border px-2 py-2 font-normal ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                                        >
                                            {bookData.sections.slice(rangeStart - 1).map((section) => <option key={section.id} value={section.ordinal}>{section.ordinal} · {locatorRangeLabel(section.locators)}</option>)}
                                        </select>
                                    </label>
                                </div>
                            ) : selectionScope === 'section' ? (
                                <>
                                    <label className="block text-sm font-bold mb-2" htmlFor="tanakh-section">פרשיה בספר {selectedBook.name}</label>
                                    <select
                                        id="tanakh-section"
                                        value={rangeStart}
                                        onChange={(event) => chooseStart(Number(event.target.value))}
                                        className={`w-full rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-300'}`}
                                    >
                                        {bookData.sections.map((section) => <option key={section.id} value={section.ordinal}>{sectionOptionLabel(section)}</option>)}
                                    </select>
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        <button type="button" disabled={rangeStart <= 1} onClick={() => moveSingleSection(-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">הקודמת</button>
                                        <button type="button" disabled={rangeStart >= bookData.sections.length} onClick={() => moveSingleSection(1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">הבאה</button>
                                    </div>
                                </>
                            ) : null}

                            <dl className={`mt-4 text-sm space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                                <div className="flex justify-between gap-3"><dt>בחירה</dt><dd className="font-semibold text-left">{tanakhSelectionLabel(activeSelection)}</dd></div>
                                <div className="flex justify-between gap-3"><dt>איתור</dt><dd className="font-semibold text-left">{locatorRangeLabel(activeSelection.locators)}</dd></div>
                                <div className="flex justify-between"><dt>פרשיות</dt><dd className="font-semibold">{activeSelection.sectionCount.toLocaleString('he-IL')}</dd></div>
                                <div className="flex justify-between"><dt>מילים</dt><dd className="font-semibold">{activeSelection.wordCount.toLocaleString('he-IL')}</dd></div>
                                <div className="flex justify-between"><dt>גבול אחרון</dt><dd className="font-semibold">{activeSelection.boundaryAfter?.upstreamMarker || 'סוף הספר'}</dd></div>
                            </dl>
                        </div>

                        <div>
                            <div className={`tanakh-preview rounded-xl border p-5 max-h-96 overflow-y-auto whitespace-pre-wrap text-xl leading-9 ${isDarkMode ? 'border-gray-700 bg-gray-900/35' : 'border-slate-200 bg-white'}`} dir="rtl" lang="he">
                                {activeSelection.sourceText}
                            </div>
                            <div className="tanakh-actions mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => onSelect(activeSelection.calculationText, activeSelection, selectedBook)}
                                    className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                                >
                                    {tanakhActionLabel(activeSelection)}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <details className={`mt-5 pt-4 border-t text-sm ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-slate-200 text-slate-600'}`} onToggle={loadProvenance}>
                    <summary className="cursor-pointer font-semibold">על הטקסט</summary>
                    <div className="mt-3 space-y-2 leading-6">
                        <p><a className="text-blue-600 dark:text-blue-400 underline" href="https://he.wikisource.org/wiki/מקרא_על_פי_המסורה#ראש" target="_blank" rel="noreferrer">מקרא על פי המסורה (MAM), ויקיטקסט</a> · כתיב בלבד · <a className="text-blue-600 dark:text-blue-400 underline" href="https://creativecommons.org/licenses/by-sa/4.0/deed.he" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.</p>
                        {provenance && (
                            <details className={`rounded-lg border px-3 py-2 ${isDarkMode ? 'border-gray-700 bg-gray-900/25' : 'border-slate-200 bg-white/70'}`}>
                                <summary className="cursor-pointer text-xs font-semibold">פרטי גרסאות טכניים</summary>
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
