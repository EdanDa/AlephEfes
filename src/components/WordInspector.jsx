import { t } from '../i18n/locale.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ResearchDialog from './ResearchDialog';
import { exactResearchWord, passageOccurrences, boundaryText, locatorText, researchUnitLabel } from '../core/researchModel.js';
import { findCorpusOccurrences, loadPassageUnits, loadResearchBook, sectionResearchUnit } from '../core/corpusResearch.js';

const centerLabel = (positions) => positions.length === 2 ? t`בין ${positions[0]} ל־${positions[1]}` : positions[0] || t('אין');

export function UnitPassage({ unit, position, word, showWords, showLetters, showCenters }) {
    const selected = useRef(null);
    const previous = useRef(null);
    useEffect(() => { if (previous.current) selected.current?.scrollIntoView({ block: 'nearest' }); previous.current = { id: unit.id, position }; }, [unit.id, position]);
    return <div dir="rtl" lang="he" className="research-passage" aria-label={t("טקסט היחידה ומיקומים")}>
        {unit.tokens.map((token) => <React.Fragment key={token.position}>
            <span ref={token.position === position ? selected : undefined} data-word-position={token.position} className={`research-token ${token.word === word ? 'research-match' : ''} ${token.position === position ? 'research-current' : ''} ${showCenters && unit.wordCenter.length === 1 && unit.wordCenter[0] === token.position ? 'research-center' : ''}`}>
                {showWords && <small className="research-word-number" dir="ltr">{token.position}</small>}
                {showLetters || showCenters ? <span className="research-letters">{[...token.word].map((letter, index) => {
                    const number = token.letterStart + index;
                    return <React.Fragment key={number}><span data-letter-position={number} className={`research-letter ${showCenters && unit.letterCenter.includes(number) ? 'research-center' : ''}`}>{showLetters && <small dir="ltr">{number}</small>}{letter}</span>{showCenters && unit.letterCenter.length === 2 && number === unit.letterCenter[0] && <span className="research-center-divider" aria-label={t("מרכז בין אותיות")}>│</span>}</React.Fragment>;
                })}</span> : token.word}
            </span>{showCenters && unit.wordCenter.length === 2 && token.position === unit.wordCenter[0] && <span className="research-center-divider" aria-label={t("מרכז בין מילים")}>│</span>}{' '}
        </React.Fragment>)}
    </div>;
}

export function UnitSource({ unit }) {
    const source = unit.source;
    return <div className="research-unit-source">
        <h3>{researchUnitLabel(unit)}</h3><p dir="ltr">{unit.id}</p>
        {source ? <>
            <p>{locatorText(source.locators.start)} – {locatorText(source.locators.end)}{t(" · מראי מקום בלבד")}</p>
            <p>{t("גבול לפני: ")}{boundaryText(source.boundaryBefore, true)}</p><p>{t("גבול אחרי: ")}{boundaryText(source.boundaryAfter)}</p>
            <details><summary>{t("גרסת המקרא ואימות")}</summary><p>{source.corpus.corpusId}{t(" · גרסת המרה ")}{source.corpus.converterVersion}</p><p dir="ltr" className="research-hash">SHA-256: {source.corpus.contentHash}</p><p dir="ltr" className="research-hash">Section: {source.calculationHash}</p></details>
        </> : <p>{t("טקסט אישי · המיקומים יחסיים לשורה ")}{unit.lineNumber}{t(". אין שיוך ליחידת MAM.")}</p>}
    </div>;
}

export default function WordInspector({ request, state, dispatch, onClose, onFocus, onNote }) {
    const word = exactResearchWord(request.word);
    const [units, setUnits] = useState(null), [scope, setScope] = useState('passage');
    const [index, setIndex] = useState(0), [corpus, setCorpus] = useState(null), [unit, setUnit] = useState(null);
    const [error, setError] = useState(null), [loading, setLoading] = useState(false), [searching, setSearching] = useState(false), [retry, setRetry] = useState(0), [passageRetry, setPassageRetry] = useState(0);
    const [showWords, setShowWords] = useState(false), [showLetters, setShowLetters] = useState(false), [showCenters, setShowCenters] = useState(false);
    const alive = useRef(true), searchId = useRef(0);
    useEffect(() => { alive.current = true; return () => { alive.current = false; searchId.current += 1; }; }, []);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(null);
        loadPassageUnits(state.text, state.mode, state.corpusSelection).then((data) => {
            if (!active) return;
            setUnits(data);
            const matches = passageOccurrences(data, word);
            const preferred = matches.findIndex((entry) => entry.unitIndex === request.lineIndex && (!request.wordPosition || entry.position === request.wordPosition));
            setIndex(Math.max(0, preferred)); setLoading(false);
        }).catch((failure) => { if (active) { setError({ at: 'passage', message: failure.message }); setLoading(false); } });
        return () => { active = false; };
    }, [state.text, state.mode, state.corpusSelection, word, request.lineIndex, request.wordPosition, passageRetry]);
    const passage = useMemo(() => units ? passageOccurrences(units, word) : [], [units, word]);
    const occurrences = scope === 'corpus' ? corpus?.occurrences || [] : passage;
    const occurrence = occurrences[index];
    useEffect(() => {
        let active = true;
        setUnit(null);
        if (!occurrence) return;
        if (scope === 'passage') { setUnit(units[occurrence.unitIndex]); return; }
        setLoading(true); setError(null);
        loadResearchBook(occurrence.bookSlug).then((loaded) => {
            const next = sectionResearchUnit(loaded, occurrence.ordinal, state.mode);
            if (next.tokens[occurrence.position - 1]?.word !== word) throw new Error(t('מיקום המופע אינו תואם לטקסט המקרא'));
            if (active) { setUnit(next); setLoading(false); }
        }).catch((failure) => { if (active) { setError({ at: 'unit', message: failure.message }); setLoading(false); } });
        return () => { active = false; };
    }, [scope, occurrence, units, state.mode, word, retry]);
    useEffect(() => { if (unit && occurrence) onFocus({ unit, word, occurrence, scope, totalOccurrences: occurrences.length, passageOccurrences: passage.length, corpusHash: corpus?.corpus.contentHash }); }, [unit, word, occurrence, scope, occurrences.length, passage.length, corpus, onFocus]);
    const search = async () => {
        const id = ++searchId.current;
        setSearching(true); setError(null); onFocus(null);
        try {
            const result = await findCorpusOccurrences(word);
            if (alive.current && id === searchId.current) { setCorpus(result); setScope('corpus'); setIndex(0); }
        } catch (failure) { if (alive.current && id === searchId.current) setError({ at: 'search', message: failure.message }); }
        finally { if (alive.current && id === searchId.current) setSearching(false); }
    };
    const bookGroups = useMemo(() => {
        const groups = new Map();
        (corpus?.occurrences || []).forEach((entry, entryIndex) => {
            if (!groups.has(entry.bookSlug)) groups.set(entry.bookSlug, { name: entry.bookName, first: entryIndex, count: 0, sections: new Map() });
            const book = groups.get(entry.bookSlug); book.count += 1;
            if (!book.sections.has(entry.sectionId)) book.sections.set(entry.sectionId, { first: entryIndex, count: 0 });
            book.sections.get(entry.sectionId).count += 1;
        });
        return groups;
    }, [corpus]);
    const currentBook = bookGroups.get(occurrence?.bookSlug);
    const unitMatches = unit ? unit.tokens.filter((token) => token.word === word) : [];
    const token = unit?.tokens[(occurrence?.position || 1) - 1];
    const loadIntoAnalysis = () => {
        const source = unit.source;
        dispatch({ type: 'LOAD_CORPUS_SELECTION', payload: { text: unit.text, selection: { bookSlug: source.bookSlug, bookName: source.bookName, scope: 'section', startSectionOrdinal: source.ordinal, endSectionOrdinal: source.ordinal, sectionCount: 1, locator: source.locators } } });
        onClose();
    };
    return <ResearchDialog title={t`בדיקת מילה · ${word}`} onClose={onClose}>
        <p className="research-scope">{t("היקף החיפוש: ")}<strong>{scope === 'passage' ? t('הקטע הנוכחי') : t('כל המקרא')}</strong>{t(" · התאמה מדויקת לכתיב מנורמל")}</p>
        <p>{t("המופעים נספרים ללא מסנני התצוגה. אותיות סופיות אינן מאוחדות עם הכתיב הרגיל.")}</p>
        <div className="research-actions"><button onClick={search} disabled={searching}>{searching ? t('מחפש במקרא…') : t('חפש בכל המקרא')}</button>{scope === 'corpus' && <button onClick={() => { setScope('passage'); setIndex(0); setError(null); }}>{t("חזור לקטע הנוכחי")}</button>}</div>
        {error && <div role="alert"><p>{error.message}</p><button onClick={() => error.at === 'search' ? search() : error.at === 'passage' ? setPassageRetry((value) => value + 1) : setRetry((value) => value + 1)}>{t("נסה שוב")}</button></div>}
        {(loading || searching) && <p role="status">{t("טוען נתוני מחקר…")}</p>}
        <p className="research-count">{occurrences.length === 1 ? t('מופע אחד') : <>{occurrences.length}{t(' מופעים ')}</>}{' '}{scope === 'corpus' ? t('בכל המקרא') : t('בקטע הנוכחי')}</p>
        {scope === 'corpus' && currentBook && <div className="research-jump">
            <label>{t("ספר ")}<select aria-label={t("ספר")} value={occurrence.bookSlug} onChange={(event) => setIndex(bookGroups.get(event.target.value).first)}>{[...bookGroups].map(([slug, book]) => <option key={slug} value={slug}>{t(book.name)} · {book.count}{t(" מופעים")}</option>)}</select></label>
            <label>{t("יחידת MAM ")}<select aria-label={t("יחידת MAM")} value={occurrence.sectionId} onChange={(event) => setIndex(currentBook.sections.get(event.target.value).first)}>{[...currentBook.sections].map(([id, group]) => <option key={id} value={id}>{id} · {group.count}{t(" מופעים")}</option>)}</select></label>
        </div>}
        {occurrences.length > 0 && <nav className="research-actions" aria-label={t("ניווט מופעים")}><button disabled={index === 0 || loading} onClick={() => setIndex(index - 1)}>{t("המופע הקודם")}</button><span aria-live="polite">{index + 1}{t(" מתוך ")}{occurrences.length}</span><button disabled={index === occurrences.length - 1 || loading} onClick={() => setIndex(index + 1)}>{t("המופע הבא")}</button></nav>}
        {unit && token && <>
            <section className="research-values" aria-label={t("ערכי המילה")}><strong>{word}</strong><span dir="ltr">U={token.units} · T={token.tens} · H={token.hundreds}</span><span>{t("מצב ")}{state.mode === 'aleph-zero' ? t('א=0') : t('א=1')}</span></section>
            <UnitSource unit={unit} />
            <p className="research-position">{t("מילה ")}{token.position}{t(" מתוך ")}{unit.wordCount}{t(" · אותיות ")}{token.letterStart}–{token.letterEnd}{t(" מתוך ")}{unit.letterCount}</p>
            <p>
                {unitMatches.length === 1 ? t("מופע אחד של ") : <>{unitMatches.length}{t(" מופעים של ")}</>}
                <bdi lang="he">{word}</bdi>{t(" ביחידה · ")}
                {unit.wordCount === 1 ? t("מילה אחת · ") : <>{unit.wordCount}{t(" מופעי מילים · ")}</>}
                {unit.distinctWordCount === 1 ? t("צורת מילה אחת") : <>{unit.distinctWordCount}{t(" צורות מילים שונות")}</>}
            </p>
            <fieldset className="research-numbering"><legend>{t("מיקומים ביחידה")}</legend><label><input type="checkbox" checked={showWords} onChange={(event) => setShowWords(event.target.checked)} />{t(" מספור מילים")}</label><label><input type="checkbox" checked={showLetters} onChange={(event) => setShowLetters(event.target.checked)} />{t(" מספור אותיות")}</label><label><input type="checkbox" checked={showCenters} onChange={(event) => setShowCenters(event.target.checked)} />{t(" סמני מרכז")}</label></fieldset>
            {showCenters && <p>{t("מרכז המילים: ")}{centerLabel(unit.wordCenter)}{t(" · מרכז האותיות: ")}{centerLabel(unit.letterCenter)}</p>}
            <p className="research-definition">{t("המיקומים מתחילים ב־1. נספרות רק אותיות החישוב העבריות; ניקוד, טעמים, רווחים ומקף אינם אותיות. ביחידה זוגית המרכז נמצא בין שני האיברים המרכזיים.")}</p>
            <UnitPassage unit={unit} word={word} position={token.position} showWords={showWords} showLetters={showLetters} showCenters={showCenters} />
            <button className="research-load" onClick={() => onNote({ word, focus: { unit, word, occurrence, scope, totalOccurrences: occurrences.length, corpusHash: corpus?.corpus.contentHash } })}>{t("הערת מחקר")}</button>
            {scope === 'corpus' && <button className="research-load" onClick={loadIntoAnalysis}>{t("טען פרשיה זו לניתוח הראשי")}</button>}
        </>}
    </ResearchDialog>;
}
