import React, { useEffect, useMemo, useRef, useState } from 'react';
import ResearchDialog from './ResearchDialog';
import { exactResearchWord, passageOccurrences, boundaryText, locatorText } from '../core/researchModel.js';
import { findCorpusOccurrences, loadPassageUnits, loadResearchBook, sectionResearchUnit } from '../core/corpusResearch.js';

const centerLabel = (positions) => positions.length === 2 ? `בין ${positions[0]} ל־${positions[1]}` : positions[0] || 'אין';

export function UnitPassage({ unit, position, word, showWords, showLetters, showCenters }) {
    const selected = useRef(null);
    const previous = useRef(null);
    useEffect(() => { if (previous.current) selected.current?.scrollIntoView({ block: 'nearest' }); previous.current = { id: unit.id, position }; }, [unit.id, position]);
    return <div className="research-passage" aria-label="טקסט היחידה ומיקומים">
        {unit.tokens.map((token) => <React.Fragment key={token.position}>
            <span ref={token.position === position ? selected : undefined} data-word-position={token.position} className={`research-token ${token.word === word ? 'research-match' : ''} ${token.position === position ? 'research-current' : ''} ${showCenters && unit.wordCenter.length === 1 && unit.wordCenter[0] === token.position ? 'research-center' : ''}`}>
                {showWords && <small className="research-word-number" dir="ltr">{token.position}</small>}
                {showLetters || showCenters ? <span className="research-letters">{[...token.word].map((letter, index) => {
                    const number = token.letterStart + index;
                    return <React.Fragment key={number}><span data-letter-position={number} className={`research-letter ${showCenters && unit.letterCenter.includes(number) ? 'research-center' : ''}`}>{showLetters && <small dir="ltr">{number}</small>}{letter}</span>{showCenters && unit.letterCenter.length === 2 && number === unit.letterCenter[0] && <span className="research-center-divider" aria-label="מרכז בין אותיות">│</span>}</React.Fragment>;
                })}</span> : token.word}
            </span>{showCenters && unit.wordCenter.length === 2 && token.position === unit.wordCenter[0] && <span className="research-center-divider" aria-label="מרכז בין מילים">│</span>}{' '}
        </React.Fragment>)}
    </div>;
}

export function UnitSource({ unit }) {
    const source = unit.source;
    return <div className="research-unit-source">
        <h3>{unit.label}</h3><p dir="ltr">{unit.id}</p>
        {source ? <>
            <p>{locatorText(source.locators.start)} – {locatorText(source.locators.end)} · מראי מקום בלבד</p>
            <p>גבול לפני: {boundaryText(source.boundaryBefore, true)}</p><p>גבול אחרי: {boundaryText(source.boundaryAfter)}</p>
            <details><summary>גרסת המקרא ואימות</summary><p>{source.corpus.corpusId} · גרסת המרה {source.corpus.converterVersion}</p><p dir="ltr" className="research-hash">SHA-256: {source.corpus.contentHash}</p><p dir="ltr" className="research-hash">Section: {source.calculationHash}</p></details>
        </> : <p>טקסט אישי · המיקומים יחסיים לשורה {unit.lineNumber}. אין שיוך ליחידת MAM.</p>}
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
            if (next.tokens[occurrence.position - 1]?.word !== word) throw new Error('מיקום המופע אינו תואם לטקסט המקרא');
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
    return <ResearchDialog title={`בדיקת מילה · ${word}`} onClose={onClose}>
        <p className="research-scope">היקף החיפוש: <strong>{scope === 'passage' ? 'הקטע הנוכחי' : 'כל המקרא'}</strong> · התאמה מדויקת לכתיב מנורמל</p>
        <p>המופעים נספרים ללא מסנני התצוגה. אותיות סופיות אינן מאוחדות עם הכתיב הרגיל.</p>
        <div className="research-actions"><button onClick={search} disabled={searching}>{searching ? 'מחפש במקרא…' : 'חפש בכל המקרא'}</button>{scope === 'corpus' && <button onClick={() => { setScope('passage'); setIndex(0); setError(null); }}>חזור לקטע הנוכחי</button>}</div>
        {error && <div role="alert"><p>{error.message}</p><button onClick={() => error.at === 'search' ? search() : error.at === 'passage' ? setPassageRetry((value) => value + 1) : setRetry((value) => value + 1)}>נסה שוב</button></div>}
        {(loading || searching) && <p role="status">טוען נתוני מחקר…</p>}
        <p className="research-count">{occurrences.length} מופעים {scope === 'corpus' ? 'בכל המקרא' : 'בקטע הנוכחי'}</p>
        {scope === 'corpus' && currentBook && <div className="research-jump">
            <label>ספר <select aria-label="ספר" value={occurrence.bookSlug} onChange={(event) => setIndex(bookGroups.get(event.target.value).first)}>{[...bookGroups].map(([slug, book]) => <option key={slug} value={slug}>{book.name} · {book.count} מופעים</option>)}</select></label>
            <label>יחידת MAM <select aria-label="יחידת MAM" value={occurrence.sectionId} onChange={(event) => setIndex(currentBook.sections.get(event.target.value).first)}>{[...currentBook.sections].map(([id, group]) => <option key={id} value={id}>{id} · {group.count} מופעים</option>)}</select></label>
        </div>}
        {occurrences.length > 0 && <nav className="research-actions" aria-label="ניווט מופעים"><button disabled={index === 0 || loading} onClick={() => setIndex(index - 1)}>המופע הקודם</button><span aria-live="polite">{index + 1} מתוך {occurrences.length}</span><button disabled={index === occurrences.length - 1 || loading} onClick={() => setIndex(index + 1)}>המופע הבא</button></nav>}
        {unit && token && <>
            <section className="research-values" aria-label="ערכי המילה"><strong>{word}</strong><span dir="ltr">U={token.units} · T={token.tens} · H={token.hundreds}</span><span>מצב {state.mode === 'aleph-zero' ? 'א=0' : 'א=1'}</span></section>
            <UnitSource unit={unit} />
            <p className="research-position">מילה {token.position} מתוך {unit.wordCount} · אותיות {token.letterStart}–{token.letterEnd} מתוך {unit.letterCount}</p>
            <p>{unitMatches.length} מופעים של {word} ביחידה · {unit.wordCount} מופעי מילים · {unit.distinctWordCount} צורות מילים שונות</p>
            <fieldset className="research-numbering"><legend>מיקומים ביחידה</legend><label><input type="checkbox" checked={showWords} onChange={(event) => setShowWords(event.target.checked)} /> מספור מילים</label><label><input type="checkbox" checked={showLetters} onChange={(event) => setShowLetters(event.target.checked)} /> מספור אותיות</label><label><input type="checkbox" checked={showCenters} onChange={(event) => setShowCenters(event.target.checked)} /> סמני מרכז</label></fieldset>
            {showCenters && <p>מרכז המילים: {centerLabel(unit.wordCenter)} · מרכז האותיות: {centerLabel(unit.letterCenter)}</p>}
            <p className="research-definition">המיקומים מתחילים ב־1. נספרות רק אותיות החישוב העבריות; ניקוד, טעמים, רווחים ומקף אינם אותיות. ביחידה זוגית המרכז נמצא בין שני האיברים המרכזיים.</p>
            <UnitPassage unit={unit} word={word} position={token.position} showWords={showWords} showLetters={showLetters} showCenters={showCenters} />
            <button className="research-load" onClick={() => onNote({ word, focus: { unit, word, occurrence, scope, totalOccurrences: occurrences.length, corpusHash: corpus?.corpus.contentHash } })}>הערת מחקר</button>
            {scope === 'corpus' && <button className="research-load" onClick={loadIntoAnalysis}>טען פרשיה זו לניתוח הראשי</button>}
        </>}
    </ResearchDialog>;
}
