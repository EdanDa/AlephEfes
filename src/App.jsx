import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, useTransition, useLayoutEffect, useReducer, useContext, createContext, memo } from 'react';
import VirtualizedList from './components/VirtualizedList';
import EngineStatusBadge from './components/EngineStatusBadge';
import { stripTrailingSpacesPerLine } from './utils/exportFormatting';
import { matchesSearchQuery } from './core/searchQuery';
import {
    BASE_LETTER_VALUES,
    COLOR_PALETTE,
    DEFAULT_DR_ORDER,
    HEB_FINALS,
    LAYER_COLORS,
    PRIME_COLOR_HEX,
    availableLayers,
    buildLetterTable,
    forceHebrewInput,
    getLetterDetails,
    getWordValues,
    isValueVisible,
    isWordVisible,
    layersMatching,
    strongestLayer,
    topConnectionLayer,
} from './core/analysisCore';
import {
    EN_TO_HE_LETTER_MAP,
    EN_TO_HE_PUNCT_LETTER_MAP,
    EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
    KEYBOARD_CODE_TO_HE_LETTER_MAP,
    normalizeSearchInput,
} from './core/searchInput';
import { useCoreResultsEngine } from './hooks/useCoreResultsEngine';
import { useHebrewInputSanitizer } from './hooks/useHebrewInputSanitizer';

// -----------------------------------------------------------------------------
// 1. Context Definitions
// -----------------------------------------------------------------------------
const AppContext = createContext(null);
const AppDispatchContext = createContext(null);

// Backward-compatible hook aliases for older/local bundles that referenced previous names.
function useAppCoreState() {
    return useContext(AppContext);
}

function useAppCoreDispatch() {
    return useContext(AppDispatchContext);
}


function useAppState() {
    return useContext(AppContext);
}

function useAppDispatch() {
    return useContext(AppDispatchContext);
}

function useAppFilters() {
    const state = useAppState();
    return useMemo(() => ({
        filters: state?.filters,
        primeColor: state?.primeColor,
    }), [state?.filters, state?.primeColor]);
}

function useAppClipboard() {
    const state = useAppState();
    return useMemo(() => ({
        copiedId: state?.copiedId,
    }), [state?.copiedId]);
}

function useAppStats() {
    const state = useAppState();
    return useMemo(() => ({
        stats: state?.stats,
        isStatsCollapsed: state?.isStatsCollapsed,
        isDarkMode: state?.isDarkMode,
        connectionValues: state?.connectionValues,
    }), [state?.stats, state?.isStatsCollapsed, state?.isDarkMode, state?.connectionValues]);
}

// -----------------------------------------------------------------------------
// 2. Constants & Styles
// -----------------------------------------------------------------------------
const TEXT_SIZE_CLASSNAMES = Object.freeze({
    sm: 'text-base leading-6',
    md: 'text-lg leading-7',
    lg: 'text-xl leading-8',
});
const TEXT_SIZE_OPTIONS = Object.freeze([
    { value: 'sm', label: 'קטן' },
    { value: 'md', label: 'בינוני' },
    { value: 'lg', label: 'גדול' },
]);
const HEB_MARKS_RE = /[\u0591-\u05BD\u05BF-\u05C7]/g;
const INPUT_PUNCT_TO_SPACE_RE = /[^\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5\n ]+/g;
const INPUT_HEBREW_JOINERS_RE = /([\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5])["'׳״‘’“”]+(?=[\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5])/g;
const INPUT_MULTI_SPACE_RE = / {2,}/g;
const ALEPH_ZERO_DR_ORDER = [0, ...DEFAULT_DR_ORDER];
const LARGE_INPUT_SANITIZE_THRESHOLD = 80_000;
const MIN_INPUT_ROWS = 4;
const MAX_INPUT_ROWS = 18;
const SAFE_BASE_LETTER_VALUES = typeof BASE_LETTER_VALUES !== 'undefined' ? BASE_LETTER_VALUES : {};

const GlobalStyles = () => (
    <style>{`
        html { overflow-y: scroll; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .dark ::-webkit-scrollbar-track { background: #1f2937; }
        .dark ::-webkit-scrollbar-thumb { background: #4b5563; }
        .dark ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        body {
            -webkit-user-select: none;
            user-select: none;
        }
        input, textarea, .selectable, .selectable * {
            -webkit-user-select: text;
            user-select: text;
            cursor: auto;
        }
        input, textarea {
            direction: rtl;
            text-align: right;
        }
    `}</style>
);

// -----------------------------------------------------------------------------
// 3. Logic Helpers
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 4. Initial State & Reducer
// -----------------------------------------------------------------------------
const createFallbackGrandTotals = () => ({
    units: 0,
    tens: 0,
    hundreds: 0,
    dr: 0,
    isPrime: { U: false, T: false, H: false },
});

const normalizeCoreResults = (results) => {
    if (!results || typeof results !== 'object') return null;

    const allWords = Array.isArray(results.allWords) ? results.allWords : [];
    const primeSummary = Array.isArray(results.primeSummary) ? results.primeSummary : [];
    const lines = Array.isArray(results.lines)
        ? results.lines.map((line) => ({
            ...line,
            words: Array.isArray(line?.words) ? line.words : [],
        }))
        : [];

    return {
        ...results,
        allWords,
        primeSummary,
        lines,
        grandTotals: results.grandTotals && typeof results.grandTotals === 'object'
            ? results.grandTotals
            : createFallbackGrandTotals(),
        wordDataMap: results.wordDataMap instanceof Map
            ? results.wordDataMap
            : new Map(allWords.map((wordData) => [wordData.word, wordData])),
        wordCounts: results.wordCounts instanceof Map ? results.wordCounts : new Map(),
        drDistribution: results.drDistribution ?? new Uint32Array(10),
        totalWordCount: Number.isFinite(results.totalWordCount) ? results.totalWordCount : allWords.length,
    };
};

const initialState = {
	text: "",
	coreResults: null,
	selectedDR: null,
	isDarkMode: false,
	hasExplicitThemeChoice: false,
	searchTerm: '',
	isValueTableOpen: false,
	isValueTablePinned: false,
	mode: 'aleph-zero',
	textSize: 'md',
	copiedId: null,
	view: 'clusters',
	hoveredWord: null,
	isPrimesCollapsed: true,
	pinnedWord: null,
	selectedHotValue: null,
	hotWordsList: [],
	isStatsCollapsed: true,
	showScrollTop: false,
	hotView: 'values',
	detailsView: 'lines',
	hotSort: { key: 'count', order: 'desc' },
	expandedRows: {},
	primeColor: 'yellow',
    filters: { U: true, T: true, H: true, Prime: false }
};

function appReducer(state, action) {
	switch (action.type) {
		case 'SET_TEXT': return { ...state, text: action.payload, pinnedWord: null, selectedDR: null, searchTerm: '' };
		case 'SET_CORE_RESULTS': return { ...state, coreResults: normalizeCoreResults(action.payload) };
		case 'SET_DARK_MODE': return { ...state, isDarkMode: action.payload };
		case 'SET_EXPLICIT_THEME_CHOICE': return { ...state, hasExplicitThemeChoice: action.payload };
		case 'TOGGLE_THEME_MODE': return { ...state, isDarkMode: !state.isDarkMode, hasExplicitThemeChoice: true };
		case 'SET_VIEW': return { ...state, view: action.payload, pinnedWord: null, hoveredWord: null, searchTerm: '', selectedDR: null, selectedHotValue: null, hotWordsList: [], isPrimesCollapsed: true, copiedId: null, isValueTableOpen: false };
		case 'SET_MODE': return { ...state, mode: action.payload, pinnedWord: null, coreResults: null, selectedDR: null, searchTerm: '' };
		case 'SET_TEXT_SIZE': return { ...state, textSize: action.payload };
		case 'SET_SEARCH_TERM': return { ...state, searchTerm: normalizeSearchInput(action.payload), pinnedWord: null, selectedDR: null };
		case 'SET_HOVERED_WORD':
            if (state.hoveredWord?.word === action.payload?.word) return state;
            return { ...state, hoveredWord: action.payload };
		case 'SET_PINNED_WORD': return { ...state, pinnedWord: state.pinnedWord && state.pinnedWord.word === action.payload.word ? null : action.payload };
		case 'UNPIN_WORD': return { ...state, pinnedWord: null, hoveredWord: null };
		case 'SET_SELECTED_DR': 
            const newSelectedDR = state.selectedDR === action.payload ? null : action.payload;
            return { ...state, selectedDR: newSelectedDR, pinnedWord: null, searchTerm: '' };
		case 'SET_COPIED_ID': return { ...state, copiedId: action.payload };
		case 'TOGGLE_VALUE_TABLE': return { ...state, isValueTableOpen: !state.isValueTableOpen };
		case 'TOGGLE_VALUE_TABLE_PIN': return { ...state, isValueTablePinned: !state.isValueTablePinned, isValueTableOpen: true };
		case 'SET_VALUE_TABLE_OPEN': return { ...state, isValueTableOpen: action.payload };
        case 'CLOSE_VALUE_TABLE': return { ...state, isValueTableOpen: false, isValueTablePinned: false };
		case 'TOGGLE_PRIMES_COLLAPSED': return { ...state, isPrimesCollapsed: !state.isPrimesCollapsed };
		case 'TOGGLE_STATS_COLLAPSED': return { ...state, isStatsCollapsed: !state.isStatsCollapsed };
		case 'SET_SHOW_SCROLL_TOP': return { ...state, showScrollTop: action.payload };
		case 'SET_HOT_VIEW': return { ...state, hotView: action.payload };
		case 'SET_DETAILS_VIEW': return { ...state, detailsView: action.payload };
		case 'SET_HOT_SORT': return { ...state, hotSort: state.hotSort.key === action.payload ? { ...state.hotSort, order: state.hotSort.order === 'desc' ? 'asc' : 'desc' } : { key: action.payload, order: 'desc' } };
		case 'TOGGLE_ROW_EXPAND': return { ...state, expandedRows: { ...state.expandedRows, [action.payload]: !state.expandedRows[action.payload] } };
		case 'TOGGLE_ALL_ROWS':
			const areAllExpanded = state.coreResults && Object.keys(state.expandedRows).length === state.coreResults.lines.length && Object.values(state.expandedRows).every(v => v);
			if (areAllExpanded) return { ...state, expandedRows: {} };
			const allExpanded = {}; (state.coreResults?.lines || []).forEach((_, index) => { allExpanded[index] = true; });
			return { ...state, expandedRows: allExpanded };
		case 'SET_PRIME_COLOR': return { ...state, primeColor: action.payload };
		case 'SET_SELECTED_HOT_VALUE': return { ...state, selectedHotValue: action.payload.value, hotWordsList: action.payload.list };
		case 'CLEAR_SELECTED_HOT_VALUE': return { ...state, selectedHotValue: null, hotWordsList: [] };
        case 'TOGGLE_FILTER':
            return { ...state, filters: { ...state.filters, [action.payload]: !state.filters[action.payload] } };
		default: throw new Error(`Unhandled action type: ${action.type}`);
	}
}

// -----------------------------------------------------------------------------
// 5. Basic UI Components
// -----------------------------------------------------------------------------
const Icon = React.memo(({ name, className }) => {
    switch (name) {
        case 'sun': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>;
        case 'moon': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
        case 'hash': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>;
        case 'copy': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
        case 'check': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
        case 'grid': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>;
        case 'network': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>;
        case 'chevron-down': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
        case 'bar-chart': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>;
        case 'arrow-up': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>;
        case 'activity': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
        case 'share-2': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>;
        case 'download': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
        default: return null;
    }
});

const Legend = React.memo(() => {
    const { primeColor, filters } = useAppFilters();
    const dispatch = useAppDispatch();
    const [, startTransition] = useTransition();
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (colorPickerTimeoutRef.current) clearTimeout(colorPickerTimeoutRef.current);
        };
    }, []);

    const handleMouseEnter = () => {
        if (colorPickerTimeoutRef.current) clearTimeout(colorPickerTimeoutRef.current);
        setIsColorPickerOpen(true);
    };

    const handleMouseLeave = () => {
        colorPickerTimeoutRef.current = setTimeout(() => setIsColorPickerOpen(false), 300);
    };

    const handleColorSelection = (color) => {
        dispatch({ type: 'SET_PRIME_COLOR', payload: color });
        setIsColorPickerOpen(false);
        if (colorPickerTimeoutRef.current) clearTimeout(colorPickerTimeoutRef.current);
    };

    const toggleFilter = (filterKey) => {
        startTransition(() => {
            dispatch({ type: 'TOGGLE_FILTER', payload: filterKey });
        });
    };

    const primeColorClasses = COLOR_PALETTE[primeColor];
    const getFilterStyle = (key, baseClass = "") => {
        const isActive = filters[key];
        const activeClass = "bg-blue-600 dark:bg-blue-800 border-blue-600 dark:border-blue-400 shadow-inner text-white";
        const inactiveClass = "opacity-60 hover:opacity-100";
        return `cursor-pointer transition-all duration-200 border-2 border-transparent rounded-full px-2 py-0.5 select-none ${isActive ? activeClass : inactiveClass} ${baseClass}`;
    };

    return (
        <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <div className="flex items-center gap-2 text-base text-slate-700 dark:text-gray-300 bg-slate-100/70 dark:bg-gray-700/50 px-3 py-1.5 rounded-full noselect">
                 <button onClick={() => toggleFilter('Prime')} className={getFilterStyle('Prime', 'flex items-center gap-2')}>
                    <span className={`text-lg font-bold ${filters['Prime'] ? 'text-white' : `${primeColorClasses.light} ${primeColorClasses.dark}`}`}>♢</span>
                    <span>ראשוני</span>
                 </button>
                 <div className="w-px h-4 bg-gray-400 mx-1"></div>
                 {/* Icons now always colored, opacity handles inactive state */}
                 <button onClick={() => toggleFilter('U')} className={getFilterStyle('U', 'flex items-center gap-2')}>
                    <div className={filters['U'] ? "text-white" : "text-sky-600 dark:text-sky-400"}>
                        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3"><path d="M7 1L1 11H13L7 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
                    </div>
                    <span className={filters['U'] ? "text-white" : "text-sky-700 dark:text-sky-300"}>אחדות</span>
                 </button>
                 <button onClick={() => toggleFilter('T')} className={getFilterStyle('T', 'flex items-center gap-2')}>
                    <div className={filters['T'] ? "text-white" : "text-emerald-600 dark:text-emerald-400"}>
                        <div className="w-3 h-3 border-2 border-current"></div>
                    </div>
                    <span className={filters['T'] ? "text-white" : "text-emerald-700 dark:text-emerald-300"}>עשרות</span>
                 </button>
                 <button onClick={() => toggleFilter('H')} className={getFilterStyle('H', 'flex items-center gap-2')}>
                    <div className={filters['H'] ? "text-white" : "text-purple-600 dark:text-purple-400"}>
                        <div className="w-3 h-3 rounded-full border-2 border-current"></div>
                    </div>
                    <span className={filters['H'] ? "text-white" : "text-purple-700 dark:text-purple-300"}>מאות</span>
                 </button>
            </div>
            {isColorPickerOpen && (
                <div className="absolute top-1/2 left-full -translate-y-1/2 ml-4 z-20 pointer-events-auto">
                    <div className="relative w-28 h-28">
                        <button key="yellow" onClick={() => handleColorSelection("yellow")} className={`absolute w-8 h-8 rounded-full bg-yellow-400 transition-transform hover:scale-125 focus:outline-none shadow-lg ring-2 ring-white dark:ring-gray-800`} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} aria-label="Select yellow color"/>
                        {Object.entries(COLOR_PALETTE).filter(([k]) => k !== 'yellow').map(([key, { bg }], index, arr) => {
                            const angle = (2 * Math.PI / arr.length) * index - (Math.PI / 2);
                            const x = 36 * Math.cos(angle); const y = 36 * Math.sin(angle);
                            return <button key={key} onClick={() => handleColorSelection(key)} className={`absolute w-7 h-7 rounded-full ${bg} transition-transform hover:scale-125 focus:outline-none shadow-lg ring-2 ring-white dark:ring-gray-800`} style={{ top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: 'translate(-50%, -50%)' }} aria-label={`Select ${key} color`}/>;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

const ValueCell = memo(({ value, isPrimeFlag, previousValue, layer, isApplicable = true, primeColor, filters }) => {
    const isVisible = isValueVisible(layer, isPrimeFlag, filters);
    const primeColorClasses = COLOR_PALETTE[primeColor];
    // .selectable ensures numbers can be copied
    const className = `px-4 py-3 text-center tabular-nums selectable cursor-default ${isPrimeFlag ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-slate-700 dark:text-gray-300'}`;
    
    if (!isApplicable) return <td className={className}>-</td>;
    if (!isVisible) return <td className={className}></td>; 
    if (value === previousValue) return <td className={className}>〃</td>;
    return <td className={className}>{value} {isPrimeFlag && <span className="mr-1" title="ראשוני">♢</span>}</td>;
});

const TotalNumberDisplay = memo(({ value, isPrimeFlag, primeColor, layer, filters }) => {
    const isVisible = isValueVisible(layer, isPrimeFlag, filters);
    const primeColorClasses = COLOR_PALETTE[primeColor];
    
    if (!isVisible) {
         return <p className="text-3xl font-bold text-gray-500 dark:text-gray-500 noselect">-</p>;
    }
    // .selectable
    return <p className={`text-3xl font-bold selectable cursor-default ${isPrimeFlag ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-800 dark:text-gray-200'}`}>{value} {isPrimeFlag && <span className="mr-2 text-xl">♢</span>}</p>;
});

const WordValuesDisplay = memo(({ wordData, isDarkMode, matches, connectionValues, hoveredWord, primeColor, filters }) => {
    const primeColorClasses = COLOR_PALETTE[primeColor];
    const values = getWordValues(wordData);
    
    return (
        <div className={`grid grid-flow-col auto-cols-max gap-x-2 text-xs font-mono tracking-wider justify-center ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
            {values.map((v, i) => {
                const L = v.layer;
                const isVisible = isValueVisible(L, v.isPrime, filters);
                if (!isVisible) return null;

                // 'matches' contains layers from the TARGET word that match the ACTIVE word.
                const isHit = hoveredWord && connectionValues.has(v.value) && matches.includes(L);
                
                let dotColor = null;
                if (isHit) {
                    // Determine the Source Layer Color (the layer in the ACTIVE word that this value belongs to)
                    const getSourceLayer = (src, val) => {
                         const avail = availableLayers(src);
                         // Priority H > T > U to determine dominant color if value exists in multiple source layers
                         if (avail.includes('H') && src.hundreds === val) return 'H';
                         if (avail.includes('T') && src.tens === val) return 'T';
                         if (avail.includes('U') && src.units === val) return 'U';
                         return null;
                    };
                    const srcLayer = getSourceLayer(hoveredWord, v.value);
                    if (srcLayer) dotColor = LAYER_COLORS[srcLayer].dot;
                }
                
                let symbol;
                // Restored layer-colored icons logic for connections
                const iconStroke = dotColor || (isDarkMode ? '#ffffff60' : '#00000040');
                const iconFill = dotColor || 'transparent';

                if (L === 'U') symbol = <svg width="14" height="12" viewBox="0 0 14 12" fill={iconFill} xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3"><path d="M7 1L1 11H13L7 1Z" stroke={iconStroke} strokeWidth="2" strokeLinejoin="round"/></svg>;
                else if (L === 'T') symbol = <div className="w-3 h-3 border-2" style={{ borderColor: iconStroke, background: iconFill }}></div>;
                else symbol = <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: iconStroke, background: iconFill }}></div>;

                return (
                    <div key={i} className="flex flex-col items-center noselect">
                        <span className={v.isPrime ? `${primeColorClasses.light} ${primeColorClasses.dark}` : ''}>{v.value}{v.isPrime && '♢'}</span>
                        <div className="mt-0.5 flex items-center justify-center h-3 w-3.5">{symbol}</div>
                    </div>
                );
            })}
        </div>
    );
});

const ExportToolbar = ({ getText, getCSV, id, label = "העתק" }) => {
    const { copiedId } = useAppClipboard();
    const dispatch = useAppDispatch();
    const [isCopying, setIsCopying] = useState(false);

    const handleCopy = async () => {
        setIsCopying(true);
        await new Promise(resolve => setTimeout(resolve, 10)); 

        try {
            const text = stripTrailingSpacesPerLine(getText());
            if (!text || text.trim().length === 0) throw new Error("No visible text generated based on current filters");
            
            let success = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try { 
                    await navigator.clipboard.writeText(text); 
                    success = true; 
                } catch (err) { console.warn("Clipboard API failed", err); }
            }

            if (!success) {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.setAttribute("readonly", "");
                Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0", width: "1px", height: "1px" });
                document.body.appendChild(ta);
                try {
                    ta.focus({ preventScroll: true });
                    ta.select();
                    document.execCommand("copy");
                    success = true;
                } finally { ta.remove(); }
            }

            if (success) {
                dispatch({ type: 'SET_COPIED_ID', payload: id });
                setTimeout(() => dispatch({ type: 'SET_COPIED_ID', payload: null }), 2000);
            }
        } catch (e) {
            console.error("Copy failed", e);
            alert("שגיאה בהעתקה (או שלא נבחרו נתונים להצגה)");
        } finally { setIsCopying(false); }
    };

    const handleCSV = () => {
        try {
            const content = stripTrailingSpacesPerLine(getCSV());
            if (!content) return;
            // Add BOM for Excel Hebrew support
            const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `aleph-code-${id}-${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch(e) { console.error("CSV Export failed", e); }
    };

    return (
        <div className="flex gap-2">
            <button 
                onClick={handleCopy} 
                disabled={isCopying}
                className={`bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 noselect ${isCopying ? 'opacity-50 cursor-wait' : ''}`}
            >
                {copiedId === id ? <Icon name="check" className="w-4 h-4" /> : <Icon name="copy" className="w-4 h-4" />}
                {isCopying ? "מעתיק..." : label}
            </button>
            <button 
                onClick={handleCSV}
                className="bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 noselect"
            >
                <Icon name="download" className="w-4 h-4" />
                ייצא CSV
            </button>
        </div>
    );
};

const StatsPanel = memo(() => {
    const { stats, isStatsCollapsed, isDarkMode, connectionValues } = useAppStats();
    const dispatch = useAppDispatch();
    if (!stats) return null;

    const colorClasses = {
        blue:	{ boxLight: 'bg-blue-50 border-blue-200', text: 'text-blue-800', boxDark: 'bg-gray-700/50 border-blue-800' },
        indigo: { boxLight: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', boxDark: 'bg-gray-700/50 border-indigo-800' },
        purple: { boxLight: 'bg-purple-50 border-purple-200', text: 'text-purple-800', boxDark: 'bg-gray-700/50 border-purple-800' },
        emerald:{ boxLight: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', boxDark: 'bg-gray-700/50 border-emerald-800' },
        pink:	{ boxLight: 'bg-pink-50 border-pink-200', text: 'text-pink-800', boxDark: 'bg-gray-700/50 border-pink-800' },
    };

    return (
        <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
            <button onClick={() => dispatch({ type: 'TOGGLE_STATS_COLLAPSED' })} className="w-full flex justify-between items-center text-2xl font-bold text-gray-800 dark:text-gray-200 noselect">
                <div className="flex-1"></div>
                <span className="text-center flex-grow">ניתוח סטטיסטי</span>
                <div className="flex-1 flex justify-end"><Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isStatsCollapsed ? '' : 'rotate-180'}`} /></div>
            </button>
            {!isStatsCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center my-6">
                    {[{label: 'סה"כ שורות', value: stats.totalLines, color: 'blue'}, {label: 'סה"כ מילים', value: stats.totalWords, color: 'indigo'}, {label: 'מילים ייחודיות', value: stats.uniqueWords, color: 'purple'}, {label: 'שורות ראשוניות', value: stats.primeLineTotals, color: 'emerald'}, {label: 'קבוצות קשרים', value: connectionValues.size, color: 'pink'}].map(item => {
                        const cls = colorClasses[item.color];
                        return (
                            <div key={item.label} className={`p-4 rounded-lg border noselect cursor-default ${isDarkMode ? cls.boxDark : cls.boxLight}`}>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : cls.text} font-semibold`}>{item.label}</p>
                                <p className={`text-3xl font-bold ${isDarkMode ? 'text-gray-100' : cls.text}`}>{item.value}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

const WordCard = memo(({ wordData, activeWord, activeWordKey, isConnectedToActive, isDarkMode, primeColor, connectionValues, dispatch, filters }) => {
    const isSelf = activeWord && activeWord.word === wordData.word;
    
    // Background color determination (for connected words)
    let topLayer = null;
    if (activeWord && !isSelf && isConnectedToActive) {
        // Find the highest layer in activeWord that connects to a VISIBLE layer in wordData.
        // This ensures hidden layers don't trigger background colors.
        const sourceLayers = [];
        
        const isValueVisibleInTarget = (val) => {
             if (wordData.units === val && isValueVisible('U', wordData.isPrimeU, filters)) return true;
             if (wordData.tens === val && isValueVisible('T', wordData.isPrimeT, filters)) return true;
             if (wordData.hundreds === val && isValueVisible('H', wordData.isPrimeH, filters)) return true;
             return false;
        };

        const availSrc = availableLayers(activeWord);
        
        // Check Source H
        if (availSrc.includes('H') && isValueVisible('H', activeWord.isPrimeH, filters)) {
            if (isValueVisibleInTarget(activeWord.hundreds)) sourceLayers.push('H');
        }
        // Check Source T
        if (availSrc.includes('T') && isValueVisible('T', activeWord.isPrimeT, filters)) {
            if (isValueVisibleInTarget(activeWord.tens)) sourceLayers.push('T');
        }
        // Check Source U
        if (availSrc.includes('U') && isValueVisible('U', activeWord.isPrimeU, filters)) {
            if (isValueVisibleInTarget(activeWord.units)) sourceLayers.push('U');
        }

        topLayer = strongestLayer(sourceLayers);
    }
    
    // matches is used to determine WHICH icon to light up (target perspective)
    const matches = (activeWord && (isSelf || isConnectedToActive)) ? layersMatching(activeWord, wordData).filter(L => availableLayers(wordData).includes(L)) : [];
    
    // Reverted to pastel background logic
    const baseBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const tint = !isSelf && topLayer ? (isDarkMode ? LAYER_COLORS[topLayer].dark : LAYER_COLORS[topLayer].light) : baseBg;
    
    // Border color logic (for Self)
    let borderColor = 'transparent';
    if (isSelf) {
        const values = getWordValues(wordData);
        const connectedVisibleLayers = values
            .filter(v => isValueVisible(v.layer, v.isPrime, filters) && connectionValues.has(v.value))
            .map(v => v.layer);
        
        const bestLayer = strongestLayer(connectedVisibleLayers);
        if (bestLayer) {
            borderColor = LAYER_COLORS[bestLayer].dot;
        } else {
             borderColor = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        }
    }

    const cardStyle = {
        background: tint,
        opacity: (isSelf || isConnectedToActive) ? 1 : 0.75,
        border: `2px solid ${borderColor}`,
        cursor: 'pointer',
        contentVisibility: 'auto',
        containIntrinsicSize: '84px',
    };

    const handleClick = (e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_PINNED_WORD', payload: wordData });
    };

    const handleMouseEnter = () => dispatch({ type: 'SET_HOVERED_WORD', payload: wordData });
    const handleMouseLeave = () => dispatch({ type: 'SET_HOVERED_WORD', payload: null });

    return (
        <div
            className="p-2 rounded-lg text-center transition-all duration-200 noselect"
            style={cardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <div className={`font-bold text-xl break-all ${isDarkMode ? 'text-gray-100' : 'text-slate-900'}`}>{wordData.word}</div>
            <WordValuesDisplay wordData={wordData} isDarkMode={isDarkMode} matches={matches} connectionValues={connectionValues} hoveredWord={activeWord} primeColor={primeColor} filters={filters}/>
        </div>
    );
}, (prev, next) => {
    if (prev.wordData !== next.wordData) return false;
    if (prev.isDarkMode !== next.isDarkMode) return false;
    if (prev.primeColor !== next.primeColor) return false;
    if (prev.filters !== next.filters) return false;
    if (prev.connectionValues !== next.connectionValues) return false;
    if (prev.activeWordKey !== next.activeWordKey) {
        const wasAffected = prev.isConnectedToActive || (prev.wordData.word === prev.activeWordKey);
        const isAffected = next.isConnectedToActive || (next.wordData.word === next.activeWordKey);
        return !wasAffected && !isAffected;
    }
    if (prev.isConnectedToActive !== next.isConnectedToActive) return false;
    return true;
});

const computeConnectedWordsSet = (activeWord, wordsByVisibleValue, visibleValuesByWord, cacheRef) => {
    if (!activeWord) return new Set();

    const cache = cacheRef?.current;
    const cached = cache?.get(activeWord.word);
    if (cached) return cached;

    const connected = new Set();
    const activeValues = visibleValuesByWord.get(activeWord.word) || [];
    activeValues.forEach((value) => {
        const hitList = wordsByVisibleValue.get(value);
        if (!hitList) return;
        hitList.forEach((word) => {
            if (word !== activeWord.word) connected.add(word);
        });
    });

    cache?.set(activeWord.word, connected);
    return connected;
};

const ClusterView = memo(({ clusterRefs, unpinOnBackgroundClick, filteredWordsInView, pinnedWord, hoveredWord, isDarkMode, primeColor, connectionValues, dispatch, copySummaryToClipboard, prepareSummaryCSV, copiedId, searchTerm }) => {
    const { filters } = useAppFilters();
    const searchInputRef = useRef(null);
    const deferredHoveredWord = useDeferredValue(hoveredWord);
    const activeWord = pinnedWord || deferredHoveredWord;
    const activeWordKey = activeWord?.word || null;

    const connectedWordsCacheRef = useRef(new Map());
    useEffect(() => {
        connectedWordsCacheRef.current.clear();
    }, [filteredWordsInView, filters]);

    const connectedWordsSet = useMemo(() => {
        if (!activeWord) return new Set();

        const cached = connectedWordsCacheRef.current.get(activeWord.word);
        if (cached) return cached;

        const wordsByVisibleValue = new Map();
        const visibleValuesByWord = new Map();

        filteredWordsInView.forEach(({ words }) => {
            words.forEach((wordData) => {
                const visibleValues = getWordValues(wordData)
                    .filter((v) => isValueVisible(v.layer, v.isPrime, filters))
                    .map((v) => v.value);

                visibleValuesByWord.set(wordData.word, visibleValues);

                visibleValues.forEach((value) => {
                    if (!wordsByVisibleValue.has(value)) wordsByVisibleValue.set(value, []);
                    wordsByVisibleValue.get(value).push(wordData.word);
                });
            });
        });

        const connected = new Set();
        const activeValues = visibleValuesByWord.get(activeWord.word) || [];
        activeValues.forEach((value) => {
            const hitList = wordsByVisibleValue.get(value);
            if (!hitList) return;
            hitList.forEach((word) => {
                if (word !== activeWord.word) connected.add(word);
            });
        });

        connectedWordsCacheRef.current.set(activeWord.word, connected);
        return connected;
    }, [activeWord, filteredWordsInView, filters]);

    const handleSearchChange = useCallback((e) => {
        dispatch({ type: 'SET_SEARCH_TERM', payload: normalizeSearchInput(e.target.value) });
    }, [dispatch]);


    
    return (
        <div className={`p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`} onClick={unpinOnBackgroundClick}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex-1 flex justify-start">
                    <ExportToolbar getText={copySummaryToClipboard} getCSV={prepareSummaryCSV} id='summary' />
                </div>
                <div className="relative group text-center flex-grow">
                    <h2 className="text-2xl font-bold inline-block noselect">קבוצות לפי שורש דיגיטלי</h2>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none noselect">
                        שורש דיגיטלי של מספר הוא הספרה הבודדת שמתקבלת כשמחברים שוב ושוב את ספרותיו עד שנותרת ספרה אחת.
                    </div>
                </div>
                 <div className="flex-1"></div>
            </div>
            <div className="mb-4">
                <input dir="rtl" type="text" placeholder="חפש מילה, מספר או צירוף כמו 20+11..." value={searchTerm} onChange={handleSearchChange} className={`w-full p-2 border rounded-md text-right ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-slate-300'}`} />
            </div>
            <div className="space-y-6">
                {filteredWordsInView.map(({ dr, words }) => (
                    <div
                        key={dr}
                        ref={el => (clusterRefs.current[dr] = el)}
                        className={`p-4 rounded-lg border transition-shadow ${isDarkMode ? 'bg-gray-800/50 border-purple-800' : 'bg-white'}`}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '460px' }}
                        onClick={unpinOnBackgroundClick}
                    >
                        <h3 className="text-xl font-bold text-violet-900 dark:text-purple-300 mb-3 text-center noselect">ש"ד {dr} ({words.length} מילים)</h3>
                        <div className="flex flex-wrap justify-start gap-2" onClick={unpinOnBackgroundClick}>
                            {words.map((wordData, index) => (
                                <WordCard 
                                    key={wordData.word}
                                    wordData={wordData}
                                    activeWord={activeWord}
                                    activeWordKey={activeWordKey}
                                    isConnectedToActive={connectedWordsSet.has(wordData.word)}
                                    isDarkMode={isDarkMode}
                                    primeColor={primeColor}
                                    connectionValues={connectionValues}
                                    dispatch={dispatch}
                                    filters={filters}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

const BARNES_HUT_MAX_DEPTH = 12;
const BARNES_HUT_MIN_SIZE = 1e-3;

const createQuadNode = (x, y, size, depth) => ({
    x,
    y,
    size,
    depth,
    node: null,
    bucket: null,
    children: null,
    mass: 0,
    centerX: 0,
    centerY: 0,
});

const addMassToQuad = (quad, point) => {
    const nextMass = quad.mass + 1;
    quad.centerX = (quad.centerX * quad.mass + point.x) / nextMass;
    quad.centerY = (quad.centerY * quad.mass + point.y) / nextMass;
    quad.mass = nextMass;
};

const getQuadChildIndex = (quad, point) => {
    const midX = quad.x + quad.size / 2;
    const midY = quad.y + quad.size / 2;
    const isRight = point.x >= midX ? 1 : 0;
    const isBottom = point.y >= midY ? 1 : 0;
    return isRight + isBottom * 2;
};

const ensureQuadChildren = (quad) => {
    if (quad.children) return;
    const half = quad.size / 2;
    quad.children = [
        createQuadNode(quad.x, quad.y, half, quad.depth + 1),
        createQuadNode(quad.x + half, quad.y, half, quad.depth + 1),
        createQuadNode(quad.x, quad.y + half, half, quad.depth + 1),
        createQuadNode(quad.x + half, quad.y + half, half, quad.depth + 1),
    ];
};

const insertPointToQuad = (quad, point) => {
    addMassToQuad(quad, point);

    if (quad.children) {
        const idx = getQuadChildIndex(quad, point);
        insertPointToQuad(quad.children[idx], point);
        return;
    }

    if (!quad.node && !quad.bucket) {
        quad.node = point;
        return;
    }

    if (quad.depth >= BARNES_HUT_MAX_DEPTH || quad.size <= BARNES_HUT_MIN_SIZE) {
        if (!quad.bucket) {
            quad.bucket = [];
            if (quad.node) {
                quad.bucket.push(quad.node);
                quad.node = null;
            }
        }
        quad.bucket.push(point);
        return;
    }

    const existing = quad.node;
    quad.node = null;
    ensureQuadChildren(quad);
    if (existing) {
        const existingIdx = getQuadChildIndex(quad, existing);
        insertPointToQuad(quad.children[existingIdx], existing);
    }
    const idx = getQuadChildIndex(quad, point);
    insertPointToQuad(quad.children[idx], point);
};

const buildQuadTree = (points) => {
    if (!points.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
    }

    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const padding = span * 0.05 + 1;
    const root = createQuadNode(minX - padding, minY - padding, span + padding * 2, 0);

    for (const point of points) insertPointToQuad(root, point);
    return root;
};

const applyBarnesHutRepulsion = (point, quad, repulsion, alpha, thetaSq) => {
    if (!quad || quad.mass === 0) return;

    if (!quad.children) {
        if (quad.bucket) {
            for (const other of quad.bucket) {
                if (other !== point) {
                    const dx = point.x - other.x;
                    const dy = point.y - other.y;
                    const distSq = dx * dx + dy * dy + 1e-6;
                    const invDist = 1 / Math.sqrt(distSq);
                    const force = (repulsion * alpha) / distSq;
                    point.vx += dx * invDist * force;
                    point.vy += dy * invDist * force;
                }
            }
            return;
        }

        if (!quad.node || quad.node === point) return;
        const dx = point.x - quad.node.x;
        const dy = point.y - quad.node.y;
        const distSq = dx * dx + dy * dy + 1e-6;
        const invDist = 1 / Math.sqrt(distSq);
        const force = (repulsion * alpha) / distSq;
        point.vx += dx * invDist * force;
        point.vy += dy * invDist * force;
        return;
    }

    const dx = point.x - quad.centerX;
    const dy = point.y - quad.centerY;
    const distSq = dx * dx + dy * dy + 1e-6;
    const sizeSq = quad.size * quad.size;

    if (sizeSq / distSq < thetaSq) {
        const invDist = 1 / Math.sqrt(distSq);
        const force = (repulsion * quad.mass * alpha) / distSq;
        point.vx += dx * invDist * force;
        point.vy += dy * invDist * force;
        return;
    }

    for (const child of quad.children) {
        applyBarnesHutRepulsion(point, child, repulsion, alpha, thetaSq);
    }
};

const buildWordConnectionIndex = (coreResults, filters, selectedDR) => {
    if (!coreResults) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];
    const wordNodesMap = new Map();
    const valueNodesMap = new Map();

    const allWords = Array.isArray(coreResults.allWords) ? coreResults.allWords : [];

    allWords.forEach(wordData => {
        if (!isWordVisible(wordData, filters)) return;
        if (selectedDR !== null && wordData.dr !== selectedDR) return;

        if (!wordNodesMap.has(wordData.word)) {
            const node = { id: wordData.word, type: 'word', data: wordData, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0 };
            wordNodesMap.set(wordData.word, node);
            nodes.push(node);
        }

        const values = getWordValues(wordData);
        values.forEach(v => {
            if (!isValueVisible(v.layer, v.isPrime, filters)) return;

            const valKey = `val-${v.value}`;
            if (!valueNodesMap.has(valKey)) {
                const node = { id: valKey, type: 'value', value: v.value, isPrime: v.isPrime, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0 };
                valueNodesMap.set(valKey, node);
                nodes.push(node);
            }

            links.push({ source: wordData.word, target: valKey, layer: v.layer });
        });
    });

    return { nodes, links };
};

const NetworkView = memo(({ coreResults, filters, isDarkMode, primeColor, onWordClick, selectedDR }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const transformRef = useRef({ x: 0, y: 0, k: 1 });
    const draggingRef = useRef(null);
    const animationRef = useRef(null);
    const hoverIdRef = useRef(null);
    const selectedIdRef = useRef(null);
    const runningRef = useRef(false);
    const hoverInfoRef = useRef(null);
    const [hoverInfo, setHoverInfo] = useState(null);

    const setHoverInfoSafe = (info) => {
        hoverInfoRef.current = info;
        setHoverInfo(info);
    };

    const graphData = useMemo(() => buildWordConnectionIndex(coreResults, filters, selectedDR), [coreResults, filters, selectedDR]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        const nodes = graphData.nodes;
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        
        const links = graphData.links
          .map(l => ({
            ...l,
            sourceNode: nodeById.get(l.source),
            targetNode: nodeById.get(l.target),
          }))
          .filter(l => l.sourceNode && l.targetNode);

        const nodeCount = nodes.length;
        const isLargeGraph = nodeCount > 500;
        
        let alpha = 1;
        const alphaDecay = isLargeGraph ? 0.002 : 0.005; 
        const alphaMin = 0.001;
        
        let settleFrames = 0;
        const SETTLE_AFTER_DRAG = 60;
        const REHEAT_ON_RELEASE = 0.3;
        const LINK_DIST = isLargeGraph ? 90 : 120;
        const CENTER_PULL = 0.004;

        // Reset refs on regeneration
        hoverIdRef.current = null;
        selectedIdRef.current = null;
        setHoverInfoSafe(null);
        if (selectedIdRef.current && !nodeById.has(selectedIdRef.current)) {
            selectedIdRef.current = null;
        }

        const sizeRef = { width: container.clientWidth, height: 600, dpr: window.devicePixelRatio || 1 };

        const setCanvasSize = () => {
            const width = container.clientWidth;
            const height = 600;
            const dpr = window.devicePixelRatio || 1;
            sizeRef.width = width;
            sizeRef.height = height;
            sizeRef.dpr = dpr;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        };

        const ro = new ResizeObserver(() => {
            setCanvasSize();
            if (alpha <= alphaMin) requestAnimationFrame(render);
        });
        ro.observe(container);
        setCanvasSize();

        const findNearestNode = (worldX, worldY, r) => {
            const r2 = r * r;
            let best = null;
            let bestD2 = r2;

            for (const n of nodes) {
                const dx = n.x - worldX;
                const dy = n.y - worldY;
                const d2 = dx*dx + dy*dy;
                if (d2 < bestD2) {
                    bestD2 = d2;
                    best = n;
                }
            }
            return best;
        };
        
        const render = () => {
            const { width, height, dpr } = sizeRef;
            ctx.setTransform(1,0,0,1,0,0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.setTransform(dpr,0,0,dpr,0,0);
            ctx.save();
            
            const { x, y, k } = transformRef.current;
            ctx.translate(x, y);
            ctx.scale(k, k);

            const activeId = selectedIdRef.current || hoverIdRef.current;
            
            let highlightedNodes = new Set();
            let highlightedLinks = new Set();
            
            // Build highlighted set from Selection OR Hover
            const targets = [];
            if (selectedIdRef.current) targets.push(selectedIdRef.current);
            if (hoverIdRef.current && hoverIdRef.current !== selectedIdRef.current) targets.push(hoverIdRef.current);

            targets.forEach(tId => {
                highlightedNodes.add(tId);
                links.forEach(l => {
                    if (l.source === tId) {
                        highlightedNodes.add(l.target);
                        highlightedLinks.add(l);
                    } else if (l.target === tId) {
                        highlightedNodes.add(l.source);
                        highlightedLinks.add(l);
                    }
                });
            });

            const somethingHighlighted = highlightedNodes.size > 0;

            // Draw Links
            links.forEach(link => {
                const isHighlighted = highlightedLinks.has(link);
                const isFaint = somethingHighlighted && !isHighlighted;
                
                if (isFaint) {
                    ctx.globalAlpha = 0.05; 
                } else {
                    ctx.globalAlpha = 0.4;
                }
                
                if (!isFaint || k > 0.5) { 
                    // Use stroke colors from LAYER_COLORS
                    const stroke = isDarkMode ? LAYER_COLORS[link.layer].strokeDark : LAYER_COLORS[link.layer].strokeLight;
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = isHighlighted ? 2 / k : 1 / k; 
                    ctx.beginPath();
                    ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
                    ctx.lineTo(link.targetNode.x, link.targetNode.y);
                    ctx.stroke();
                }
            });
            ctx.globalAlpha = 1;

            // Draw Nodes
            nodes.forEach(node => {
                const isHighlighted = highlightedNodes.has(node.id);
                const isFaint = somethingHighlighted && !isHighlighted;
                const isSelected = selectedIdRef.current === node.id;

                if (isFaint) {
                    ctx.globalAlpha = 0.1;
                } else {
                    ctx.globalAlpha = 1;
                }

                ctx.beginPath();
                if (node.type === 'word') {
                    ctx.arc(node.x, node.y, isSelected ? 8 : 6, 0, 2 * Math.PI);
                    ctx.fillStyle = isDarkMode ? '#A78BFA' : '#7C3AED';
                    ctx.fill();
                    if (isSelected) {
                        ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
                        ctx.lineWidth = 2 / k;
                        ctx.stroke();
                    }

                    if (k > 0.6 || isHighlighted || isSelected) {
                        ctx.font = '10px sans-serif';
                        if (!isDarkMode) {
                            ctx.lineWidth = 3 / k;
                            ctx.strokeStyle = 'rgba(248,250,252,0.95)';
                            ctx.strokeText(node.id, node.x + 8, node.y + 3);
                        }
                        ctx.fillStyle = isDarkMode ? 'white' : '#0f172a';
                        ctx.fillText(node.id, node.x + 8, node.y + 3);
                    }
                } else {
                    ctx.arc(node.x, node.y, isSelected ? 6 : 4, 0, 2 * Math.PI);
                    const primeFill = PRIME_COLOR_HEX[primeColor] || '#EAB308';
                    ctx.fillStyle = node.isPrime ? primeFill : (isDarkMode ? '#9CA3AF' : '#4B5563');
                    ctx.fill();
                    if (isSelected) {
                        ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
                        ctx.lineWidth = 2 / k;
                        ctx.stroke();
                    }
                    if (k > 0.8 || isHighlighted || isSelected) {
                        ctx.font = 'bold 9px monospace';
                        if (!isDarkMode) {
                            ctx.lineWidth = 2.5 / k;
                            ctx.strokeStyle = 'rgba(248,250,252,0.95)';
                            ctx.strokeText(node.value, node.x - 6, node.y - 6);
                        }
                        ctx.fillStyle = isDarkMode ? '#D1D5DB' : '#111827';
                        ctx.fillText(node.value, node.x - 6, node.y - 6);
                    }
                }
            });
            ctx.restore();
        };

        const tick = () => {
            const { width, height } = sizeRef;
            if (alpha > alphaMin) {
                const useBarnesHut = nodes.length > 250;
                if (useBarnesHut) {
                    const repulsion = isLargeGraph ? 1000 : 2000;
                    const thetaSq = isLargeGraph ? 0.8 * 0.8 : 0.65 * 0.65;
                    const tree = buildQuadTree(nodes);
                    if (tree) {
                        for (const node of nodes) {
                            applyBarnesHutRepulsion(node, tree, repulsion, alpha, thetaSq);
                        }
                    }
                } else {
                    for (let i = 0; i < nodes.length; i += 1) {
                        const a = nodes[i];
                        for (let j = i + 1; j < nodes.length; j += 1) {
                            const b = nodes[j];
                            const dx = a.x - b.x;
                            const dy = a.y - b.y;
                            const distSq = dx * dx + dy * dy || 1;
                            if (distSq <= 250000) {
                                const invDist = 1 / Math.sqrt(distSq);
                                const force = ((isLargeGraph ? 1000 : 2000) * alpha) / distSq;
                                const fx = dx * invDist * force;
                                const fy = dy * invDist * force;
                                a.vx += fx;
                                a.vy += fy;
                                b.vx -= fx;
                                b.vy -= fy;
                            }
                        }
                    }
                }

                links.forEach(link => {
                    const a = link.sourceNode;
                    const b = link.targetNode;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (dist - LINK_DIST) * (isLargeGraph ? 0.08 : 0.05) * alpha;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    a.vx += fx; a.vy += fy;
                    b.vx -= fx; b.vy -= fy;
                });

                nodes.forEach(node => {
                    if (node === draggingRef.current?.node) return;
                    node.vx += (width / 2 - node.x) * CENTER_PULL * alpha;
                    node.vy += (height / 2 - node.y) * CENTER_PULL * alpha;
                    const vLimit = 10;
                    node.vx = Math.max(-vLimit, Math.min(vLimit, node.vx));
                    node.vy = Math.max(-vLimit, Math.min(vLimit, node.vy));
                    node.vx *= 0.9; 
                    node.vy *= 0.9;
                    node.x += node.vx;
                    node.y += node.vy;
                });

                // Keep simulation "heated" if dragging a node
                if (draggingRef.current && draggingRef.current.type !== 'pan') {
                    alpha = Math.max(alpha, 0.3); 
                } else {
                    alpha -= alphaDecay; 
                }
            }
            render();

            if (settleFrames > 0) settleFrames--;
            const shouldContinue = alpha > alphaMin || draggingRef.current || settleFrames > 0;

            if (shouldContinue) {
                animationRef.current = requestAnimationFrame(tick);
                runningRef.current = true;
            } else {
                runningRef.current = false;
            }
        };

        tick();

        const handleWheel = (e) => {
            e.preventDefault();
            const { x, y, k } = transformRef.current;
            const zoomSensitivity = 0.001;
            const newK = Math.max(0.1, Math.min(5, k - e.deltaY * zoomSensitivity));
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left);
            const mouseY = (e.clientY - rect.top);
            const newX = mouseX - (mouseX - x) * (newK / k);
            const newY = mouseY - (mouseY - y) * (newK / k);
            transformRef.current = { x: newX, y: newY, k: newK };
            if (alpha <= alphaMin) requestAnimationFrame(render);
        };

        const handleMouseDown = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const { x, y, k } = transformRef.current;
            const worldX = (mouseX - x) / k;
            const worldY = (mouseY - y) / k;
            
            // Increased hit radius for easier selection (20 -> 40)
            const hitRadius = 40 / k; 
            const clickedNode = findNearestNode(worldX, worldY, hitRadius);

            if (clickedNode) {
                draggingRef.current = { node: clickedNode, startSX: mouseX, startSY: mouseY, isClick: true, type: 'node' };
                alpha = Math.max(alpha, 0.3);
                if (!runningRef.current) {
                    animationRef.current = requestAnimationFrame(tick);
                    runningRef.current = true;
                }
            } else {
                draggingRef.current = { type: 'pan', lastX: mouseX, lastY: mouseY, startSX: mouseX, startSY: mouseY, isClick: true };
                if (alpha <= alphaMin) requestAnimationFrame(render);
            }
        };

        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Skip expensive hover/update logic during node drag
            if (draggingRef.current && draggingRef.current.type !== 'pan') {
                if (draggingRef.current.isClick) {
                    if (Math.hypot(mouseX - draggingRef.current.startSX, mouseY - draggingRef.current.startSY) > 3) {
                        draggingRef.current.isClick = false;
                    }
                }
                if (!draggingRef.current.isClick) {
                    const { x, y, k } = transformRef.current;
                    const worldXDrag = (mouseX - x) / k;
                    const worldYDrag = (mouseY - y) / k;
                    draggingRef.current.node.x = worldXDrag;
                    draggingRef.current.node.y = worldYDrag;
                    draggingRef.current.node.vx = 0; 
                    draggingRef.current.node.vy = 0;
                    
                    // Keep heating simulation during drag so neighbors react
                    alpha = Math.max(alpha, 0.1); 
                    if (!runningRef.current) {
                        animationRef.current = requestAnimationFrame(tick);
                        runningRef.current = true;
                    }
                }
                return; // Stop here
            }
            
            // Hover logic
            const { x, y, k } = transformRef.current;
            const worldX = (mouseX - x) / k;
            const worldY = (mouseY - y) / k;
            
            const hitRadius = 40 / k; // Larger hit area
            const hoveredNode = findNearestNode(worldX, worldY, hitRadius);

            if (hoveredNode) {
                const prev = hoverInfoRef.current;
                hoverIdRef.current = hoveredNode.id;

                if (!prev || prev.id !== hoveredNode.id || Math.hypot(prev.px - mouseX, prev.py - mouseY) > 2) {
                    setHoverInfoSafe({ ...hoveredNode, px: mouseX, py: mouseY });
                } else {
                    setHoverInfoSafe({ ...prev, px: mouseX, py: mouseY });
                }
                if (alpha <= alphaMin) requestAnimationFrame(render); 
            } else {
                hoverIdRef.current = null;
                if (hoverInfoRef.current) setHoverInfoSafe(null);
                if (alpha <= alphaMin) requestAnimationFrame(render);
            }

            if (!draggingRef.current) return;
            
            // Pan logic
            if (draggingRef.current.type === 'pan') {
                if (draggingRef.current.isClick) {
                    if (Math.hypot(mouseX - draggingRef.current.startSX, mouseY - draggingRef.current.startSY) > 3) {
                        draggingRef.current.isClick = false;
                    }
                }

                if (!draggingRef.current.isClick) {
                    const dx = mouseX - draggingRef.current.lastX;
                    const dy = mouseY - draggingRef.current.lastY;
                    transformRef.current.x += dx;
                    transformRef.current.y += dy;
                    draggingRef.current.lastX = mouseX;
                    draggingRef.current.lastY = mouseY;
                    if (alpha <= alphaMin) requestAnimationFrame(render);
                }
            } 
        };

        const handleMouseUp = () => {
            if (draggingRef.current) {
                if (draggingRef.current.isClick) {
                    if (draggingRef.current.type === 'node') {
                        const clickedNode = draggingRef.current.node;
                        const next = (selectedIdRef.current === clickedNode.id) ? null : clickedNode.id;
                        selectedIdRef.current = next;
                        if (clickedNode.type === 'word' && onWordClick) {
                            onWordClick(clickedNode.data);
                        }
                    } else if (draggingRef.current.type === 'pan') {
                         // Clicked background -> clear selection
                         selectedIdRef.current = null;
                    }
                    if (alpha <= alphaMin) requestAnimationFrame(render);
                }

                if (draggingRef.current.type !== 'pan') {
                    // Reheat + settle
                    alpha = Math.max(alpha, REHEAT_ON_RELEASE);
                    settleFrames = SETTLE_AFTER_DRAG;
                    
                    if (!runningRef.current) {
                        animationRef.current = requestAnimationFrame(tick);
                        runningRef.current = true;
                    }
                }
            }
            draggingRef.current = null;
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            cancelAnimationFrame(animationRef.current);
            runningRef.current = false;
            ro.disconnect();
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [graphData, isDarkMode, primeColor]);

    return (
        <div className={`p-4 rounded-xl border noselect ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
            <h2 className="text-2xl font-bold mb-4 text-center">מפת קשרים (רשת)</h2>
            <div ref={containerRef} className="relative w-full h-[600px] cursor-move overflow-hidden bg-slate-100 dark:bg-gray-900 rounded-lg border border-slate-200 dark:border-gray-700">
                <canvas ref={canvasRef} className="w-full h-full block" />
                <div className="absolute top-2 right-2 text-xs text-slate-700 dark:text-gray-200 bg-white/90 dark:bg-black/50 p-2 rounded pointer-events-none select-none border border-slate-200 dark:border-gray-700">
                    <div>גלגלת: זום</div>
                    <div>גרירה ברקע: הזזה</div>
                    <div>קליק: בחירה</div>
                </div>
                 {hoverInfo && (
                    <div 
                        className="absolute pointer-events-none p-2 rounded bg-black/80 text-white text-xs z-10 whitespace-nowrap transform -translate-x-1/2 -translate-y-full"
                        style={{ left: hoverInfo.px, top: hoverInfo.py - 10 }}
                    >
                        {hoverInfo.type === 'word' ? (
                            <div className="font-bold text-base">{hoverInfo.id}</div>
                        ) : (
                            <div>
                                <div className="font-mono font-bold flex items-center gap-1">{hoverInfo.value} {hoverInfo.isPrime && <span className="text-yellow-400 text-lg">♢</span>}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

const GraphView = memo(({ coreResults, filters, isDarkMode, primeColor, onWordClick, selectedDR }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const spatialRef = useRef({ cellSize: 24, grid: new Map() });
    const [hoverInfo, setHoverInfo] = useState(null);
    const [selectedValue, setSelectedValue] = useState(null);

    const valueInsights = useMemo(() => {
        if (!coreResults) return [];

        const statsByValue = new Map();
        const allWords = Array.isArray(coreResults.allWords) ? coreResults.allWords : [];

        allWords.forEach((wordData) => {
            if (!isWordVisible(wordData, filters)) return;
            if (selectedDR !== null && wordData.dr !== selectedDR) return;

            const occurrences = coreResults.wordCounts?.get(wordData.word) || 1;
            const visibleValues = getWordValues(wordData).filter((v) => isValueVisible(v.layer, v.isPrime, filters));

            visibleValues.forEach((v) => {
                if (!statsByValue.has(v.value)) {
                    statsByValue.set(v.value, {
                        value: v.value,
                        isPrime: v.isPrime,
                        layers: new Set(),
                        uniqueWords: new Set(),
                        words: [],
                        totalOccurrences: 0,
                    });
                }

                const stat = statsByValue.get(v.value);
                stat.isPrime = stat.isPrime || v.isPrime;
                stat.layers.add(v.layer);
                stat.uniqueWords.add(wordData.word);
                stat.totalOccurrences += occurrences;
                stat.words.push({ word: wordData.word, layer: v.layer, occurrences });
            });
        });

        return Array.from(statsByValue.values())
            .map((stat) => {
                const layers = ['H', 'T', 'U'].filter((layer) => stat.layers.has(layer));
                const uniqueWordCount = stat.uniqueWords.size;
                const avgOccurrences = uniqueWordCount > 0 ? stat.totalOccurrences / uniqueWordCount : 0;
                const bridgeScore = uniqueWordCount * layers.length;
                const topWords = [...stat.words]
                    .sort((a, b) => b.occurrences - a.occurrences || a.word.localeCompare(b.word, 'he'))
                    .slice(0, 8);

                return {
                    value: stat.value,
                    isPrime: stat.isPrime,
                    layers,
                    layerCount: layers.length,
                    uniqueWordCount,
                    totalOccurrences: stat.totalOccurrences,
                    avgOccurrences,
                    bridgeScore,
                    topWords,
                };
            })
            .sort((a, b) => b.bridgeScore - a.bridgeScore || b.totalOccurrences - a.totalOccurrences || a.value - b.value);
    }, [coreResults, filters, selectedDR]);

    const selectedInsight = useMemo(
        () => valueInsights.find((insight) => insight.value === selectedValue) || null,
        [valueInsights, selectedValue],
    );

    const preparedRows = useMemo(() => valueInsights.map((item, idx) => ({ ...item, rank: idx + 1 })), [valueInsights]);

    const prepareInsightText = useCallback(() => {
        if (!preparedRows.length) return 'אין נתונים להצגה.';

        const lines = [
            'מפת ערכים מרוכזת – ערכי מפתח לפי גישור בין שכבות',
            'דרוג | ערך | שכבות | מילים ייחודיות | מופעים בטקסט | מופעים/מילה | ציון גישור',
        ];

        preparedRows.forEach((row) => {
            lines.push(`${row.rank} | ${row.value}${row.isPrime ? '♢' : ''} | ${row.layers.join('/')} | ${row.uniqueWordCount} | ${row.totalOccurrences} | ${row.avgOccurrences.toFixed(2)} | ${row.bridgeScore}`);
        });

        if (selectedInsight) {
            lines.push('');
            lines.push(`פירוט ערך נבחר: ${selectedInsight.value}${selectedInsight.isPrime ? '♢' : ''}`);
            selectedInsight.topWords.forEach((entry) => {
                lines.push(`- ${entry.word} (${entry.layer}) ×${entry.occurrences}`);
            });
        }

        return lines.join('\n');
    }, [preparedRows, selectedInsight]);

    const prepareInsightCSV = useCallback(() => {
        if (!preparedRows.length) return 'rank,value,is_prime,layers,layer_count,unique_words,total_occurrences,avg_occurrences_per_word,bridge_score';

        const rows = ['rank,value,is_prime,layers,layer_count,unique_words,total_occurrences,avg_occurrences_per_word,bridge_score'];
        preparedRows.forEach((row) => {
            rows.push([
                row.rank,
                row.value,
                row.isPrime ? 1 : 0,
                `"${row.layers.join('/') }"`,
                row.layerCount,
                row.uniqueWordCount,
                row.totalOccurrences,
                row.avgOccurrences.toFixed(3),
                row.bridgeScore,
            ].join(','));
        });

        if (selectedInsight) {
            rows.push('');
            rows.push('selected_value,word,layer,occurrences');
            selectedInsight.topWords.forEach((entry) => {
                rows.push([selectedInsight.value, `"${entry.word}"`, entry.layer, entry.occurrences].join(','));
            });
        }

        return rows.join('\n');
    }, [preparedRows, selectedInsight]);

    useEffect(() => {
        if (selectedValue !== null && !valueInsights.some((insight) => insight.value === selectedValue)) {
            setSelectedValue(null);
        }
    }, [selectedValue, valueInsights]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || valueInsights.length === 0) return;

        const ctx = canvas.getContext('2d');
        const padding = { top: 20, right: 24, bottom: 40, left: 52 };
        const cellSize = 28;

        const render = () => {
            const width = container.clientWidth;
            const height = 430;
            const dpr = window.devicePixelRatio || 1;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            ctx.clearRect(0, 0, width, height);

            const graphWidth = width - padding.left - padding.right;
            const graphHeight = height - padding.top - padding.bottom;
            const maxX = Math.max(...valueInsights.map((v) => v.totalOccurrences), 1);
            const maxY = Math.max(...valueInsights.map((v) => v.uniqueWordCount), 1);

            const scaleX = (x) => padding.left + (x / maxX) * graphWidth;
            const scaleY = (y) => height - padding.bottom - (y / maxY) * graphHeight;

            ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
            ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
            ctx.font = '10px sans-serif';
            ctx.lineWidth = 1;

            for (let i = 0; i <= 5; i += 1) {
                const yValue = Math.round((maxY / 5) * i);
                const y = scaleY(yValue);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
                ctx.fillText(String(yValue), 8, y + 3);
            }

            ctx.save();
            ctx.translate(15, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('מילים ייחודיות לערך', 0, 0);
            ctx.restore();
            ctx.fillText('מופעים בטקסט', width / 2 - 30, height - 10);

            const grid = new Map();

            valueInsights.forEach((item) => {
                const px = scaleX(item.totalOccurrences);
                const py = scaleY(item.uniqueWordCount);
                const gx = Math.floor(px / cellSize);
                const gy = Math.floor(py / cellSize);
                const gridKey = `${gx}:${gy}`;
                if (!grid.has(gridKey)) grid.set(gridKey, []);

                const radius = 4 + item.layerCount * 2 + Math.min(10, Math.sqrt(item.bridgeScore));
                const color = item.layerCount === 3
                    ? (isDarkMode ? '#c084fc' : '#7c3aed')
                    : item.layerCount === 2
                        ? (isDarkMode ? '#34d399' : '#059669')
                        : (isDarkMode ? '#60a5fa' : '#2563eb');

                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.globalAlpha = selectedValue !== null && selectedValue !== item.value ? 0.2 : 0.82;
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fill();

                if (item.isPrime) {
                    ctx.strokeStyle = PRIME_COLOR_HEX[primeColor] || '#EAB308';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                if (selectedValue === item.value) {
                    ctx.strokeStyle = isDarkMode ? '#ffffff' : '#111827';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                ctx.globalAlpha = 1;
                grid.get(gridKey).push({ ...item, px, py, radius });
            });

            spatialRef.current = { cellSize, grid };
        };

        render();
        window.addEventListener('resize', render);
        return () => window.removeEventListener('resize', render);
    }, [isDarkMode, primeColor, selectedValue, valueInsights]);

    const handleInteraction = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas || valueInsights.length === 0) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const { cellSize, grid } = spatialRef.current;
        const gx = Math.floor(mouseX / cellSize);
        const gy = Math.floor(mouseY / cellSize);
        let nearest = null;
        let minDistSq = 26 * 26;

        for (let ix = gx - 1; ix <= gx + 1; ix += 1) {
            for (let iy = gy - 1; iy <= gy + 1; iy += 1) {
                const bucket = grid.get(`${ix}:${iy}`);
                if (!bucket) continue;
                bucket.forEach((point) => {
                    const dx = point.px - mouseX;
                    const dy = point.py - mouseY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= Math.max(minDistSq, point.radius * point.radius)) {
                        minDistSq = distSq;
                        nearest = point;
                    }
                });
            }
        }

        setHoverInfo(nearest);
        if (e.type === 'click') {
            setSelectedValue((prev) => (nearest ? (prev === nearest.value ? null : nearest.value) : null));
        }
    }, [valueInsights.length]);

    return (
        <div className={`p-4 rounded-xl border noselect ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-2xl font-bold text-center flex-1">מפת ערכים מרוכזת</h2>
                <ExportToolbar getText={prepareInsightText} getCSV={prepareInsightCSV} id='graph-insights' label='העתק' />
            </div>
            <div ref={containerRef} className="relative w-full h-[430px] cursor-crosshair">
                <canvas
                    ref={canvasRef}
                    onClick={handleInteraction}
                    onMouseMove={handleInteraction}
                    onMouseLeave={() => setHoverInfo(null)}
                    className="w-full h-full"
                />
                {hoverInfo && (
                    <div
                        className="absolute pointer-events-none p-3 rounded-lg bg-gray-900/90 text-white text-sm z-10 whitespace-nowrap transform -translate-y-full shadow-xl border border-gray-600 w-max max-w-[260px]"
                        style={{
                            left: hoverInfo.px,
                            top: hoverInfo.py - 10,
                            transform: hoverInfo.px > (containerRef.current?.clientWidth || 0) * 0.7
                                ? 'translate(-100%, -100%)'
                                : 'translate(0, -100%)'
                        }}
                    >
                        <div className="font-bold text-base mb-1">ערך {hoverInfo.value} {hoverInfo.isPrime && <span className="text-yellow-400">♢</span>}</div>
                        <div>שכבות: {hoverInfo.layers.join('/')}</div>
                        <div>מילים ייחודיות: {hoverInfo.uniqueWordCount}</div>
                        <div>מופעים בטקסט: {hoverInfo.totalOccurrences}</div>
                        <div>ציון גישור: {hoverInfo.bridgeScore}</div>
                    </div>
                )}
            </div>

            <div className="mt-3 text-sm text-center text-gray-500 dark:text-gray-300">
                ציר X: סך מופעים בטקסט | ציר Y: כמות מילים ייחודיות לערך | גודל נקודה: עוצמת גישור בין שכבות (H/T/U)
            </div>

            {selectedInsight && (
                <div className={`mt-4 p-3 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white/80 border-slate-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg">ערך נבחר: {selectedInsight.value}{selectedInsight.isPrime ? ' ♢' : ''}</h3>
                        <span className="text-sm text-gray-500">קליק נוסף על הנקודה לביטול בחירה</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">שכבות: <b>{selectedInsight.layers.join('/')}</b></div>
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">מילים ייחודיות: <b>{selectedInsight.uniqueWordCount}</b></div>
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">מופעים: <b>{selectedInsight.totalOccurrences}</b></div>
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">ציון גישור: <b>{selectedInsight.bridgeScore}</b></div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-right border-b border-gray-300 dark:border-gray-700">
                                    <th className="py-1">מילה</th>
                                    <th className="py-1">שכבה</th>
                                    <th className="py-1">מופעים</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedInsight.topWords.map((entry, idx) => (
                                    <tr
                                        key={`${entry.word}-${idx}`}
                                        className="border-b border-gray-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-gray-800/60 cursor-pointer"
                                        onClick={() => {
                                            const wordData = coreResults?.wordDataMap?.get(entry.word);
                                            if (wordData) onWordClick(wordData);
                                        }}
                                    >
                                        <td className="py-1 font-semibold text-blue-700 dark:text-blue-300">{entry.word}</td>
                                        <td className="py-1">{entry.layer}</td>
                                        <td className="py-1 font-mono">{entry.occurrences}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
});

const MainTextInput = memo(({ text, isDarkMode, textSize, onTextChange }) => {
    const textareaRef = useRef(null);
    const draftRef = useRef(text);
    const commitTimerRef = useRef(null);
    const [isDragActive, setIsDragActive] = useState(false);

    const { sanitizeHebrewInput, sanitizePastedHebrewInput } = useHebrewInputSanitizer({
        HEB_MARKS_RE,
        INPUT_HEBREW_JOINERS_RE,
        INPUT_PUNCT_TO_SPACE_RE,
        INPUT_MULTI_SPACE_RE,
        EN_TO_HE_LETTER_MAP,
        EN_TO_HE_PUNCT_LETTER_MAP,
        EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
    });

    const clearCommitTimer = useCallback(() => {
        if (commitTimerRef.current !== null) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
    }, []);

    const applyTextareaRowBounds = useCallback((target) => {
        const textarea = target || textareaRef.current;
        if (!textarea) return;

        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        const chromeHeight = paddingTop + paddingBottom + borderTop + borderBottom;
        const minHeight = (lineHeight * MIN_INPUT_ROWS) + chromeHeight;
        const maxHeight = (lineHeight * MAX_INPUT_ROWS) + chromeHeight;

        textarea.style.minHeight = `${minHeight}px`;
        textarea.style.maxHeight = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
    }, []);
    const adjustTextareaHeight = applyTextareaRowBounds;

    const commitChanges = useCallback(() => {
        clearCommitTimer();
        const committedValue = sanitizeHebrewInput(draftRef.current);
        draftRef.current = committedValue;
        onTextChange(committedValue);
    }, [clearCommitTimer, onTextChange, sanitizeHebrewInput]);

    useEffect(() => {
        const sanitized = sanitizeHebrewInput(text);
        draftRef.current = sanitized;

        const textarea = textareaRef.current;
        if (!textarea || textarea.value === sanitized) return;

        const isFocused = document.activeElement === textarea;
        const selectionStart = textarea.selectionStart ?? sanitized.length;
        const selectionEnd = textarea.selectionEnd ?? sanitized.length;

        textarea.value = sanitized;
        if (isFocused) {
            const nextStart = Math.min(selectionStart, sanitized.length);
            const nextEnd = Math.min(selectionEnd, sanitized.length);
            requestAnimationFrame(() => textarea.setSelectionRange(nextStart, nextEnd));
        }
    }, [adjustTextareaHeight, sanitizeHebrewInput, text]);

    useEffect(() => {
        adjustTextareaHeight();
    }, [adjustTextareaHeight, textSize]);

    useEffect(() => {
        applyTextareaRowBounds();
    }, [applyTextareaRowBounds, textSize]);

    useEffect(() => {
        adjustTextareaHeight();
    }, [adjustTextareaHeight, textSize]);

    useEffect(() => {
        applyTextareaRowBounds();
    }, [applyTextareaRowBounds, textSize]);

    useEffect(() => () => clearCommitTimer(), [clearCommitTimer]);

    const scheduleCommit = useCallback((nextValue) => {
        clearCommitTimer();
        let debounceMs = 180;
        if (nextValue.length === 0) debounceMs = 0;
        else if (nextValue.length > 120_000) debounceMs = 420;
        else if (nextValue.length > 40_000) debounceMs = 280;

        commitTimerRef.current = setTimeout(() => {
            commitTimerRef.current = null;
            const committedValue = sanitizeHebrewInput(draftRef.current);
            draftRef.current = committedValue;
            onTextChange(committedValue);
        }, debounceMs);
    }, [clearCommitTimer, onTextChange, sanitizeHebrewInput]);

    const handleChange = useCallback((e) => {
        const rawValue = e.target.value;
        const nativeInputEvent = e.nativeEvent;
        const inputType = nativeInputEvent?.inputType || '';
        const insertedData = nativeInputEvent?.data ?? null;
        const isDeleteInput = inputType.startsWith('delete');
        const isSimpleInsert = inputType === 'insertText' || inputType === 'insertLineBreak';
        const isLargeInput = rawValue.length > LARGE_INPUT_SANITIZE_THRESHOLD;
        const isAllowedInsertedData = insertedData === null || insertedData === '\n' || insertedData === ' ' || /^[א-ת]$/.test(insertedData);
        const canSkipFullSanitize = isLargeInput && (isDeleteInput || isSimpleInsert || isAllowedInsertedData);

        const nextValue = canSkipFullSanitize ? rawValue : sanitizeHebrewInput(rawValue);

        if (rawValue !== nextValue) {
            const cursorStart = e.target.selectionStart ?? rawValue.length;
            const nextCursor = sanitizeHebrewInput(rawValue.slice(0, cursorStart)).length;
            e.target.value = nextValue;
            requestAnimationFrame(() => e.target.setSelectionRange(nextCursor, nextCursor));
        }

        draftRef.current = nextValue;
        adjustTextareaHeight(e.target);
        scheduleCommit(nextValue);
    }, [adjustTextareaHeight, sanitizeHebrewInput, scheduleCommit]);

    const handleKeyDown = useCallback((e) => {
        const isMetaCombo = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        const isEnterKey = key === 'enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
        const isSpaceKey = key === ' ' || key === 'space' || key === 'spacebar' || e.code === 'Space';

        if (isMetaCombo && key === 'a') {
            e.preventDefault();
            e.stopPropagation();
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus();
            textarea.setSelectionRange(0, textarea.value.length);
            return;
        }

        if (isMetaCombo && isEnterKey) {
            e.preventDefault();
            commitChanges();
            return;
        }

        const textarea = textareaRef.current;
        const currentLength = textarea?.value.length ?? draftRef.current.length;
        if (currentLength > LARGE_INPUT_SANITIZE_THRESHOLD) {
            return;
        }

        if (isMetaCombo || e.altKey || key === 'shift' || key === 'alt' || key === 'control' || key === 'meta') {
            return;
        }

        if (isEnterKey || isSpaceKey) {
            return;
        }

        if (e.key.length !== 1) {
            return;
        }

        const mappedFromCode = KEYBOARD_CODE_TO_HE_LETTER_MAP[e.code];
        const mappedFromKey = (!e.code || e.code === 'Unidentified')
            ? (EN_TO_HE_LETTER_MAP[e.key.toLowerCase()]
                || EN_TO_HE_PUNCT_LETTER_MAP[e.key]
                || EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[e.key])
            : null;
        const mappedLetter = mappedFromCode || mappedFromKey;

        if (mappedLetter) {
            e.preventDefault();
            if (!textarea) return;

            const start = textarea.selectionStart ?? 0;
            const end = textarea.selectionEnd ?? 0;
            const current = textarea.value;
            const nextValue = current.slice(0, start) + mappedLetter + current.slice(end);

            textarea.value = nextValue;
            draftRef.current = nextValue;
            adjustTextareaHeight(textarea);
            scheduleCommit(nextValue);

            const nextPos = start + mappedLetter.length;
            requestAnimationFrame(() => textarea.setSelectionRange(nextPos, nextPos));
            return;
        }

        if (!/^[א-ת]$/i.test(e.key)) {
            e.preventDefault();
        }
    }, [adjustTextareaHeight, commitChanges, scheduleCommit]);

    const handlePaste = useCallback((e) => {
        const pasted = e.clipboardData?.getData('text') ?? '';
        const sanitized = sanitizePastedHebrewInput(pasted);

        e.preventDefault();

        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const current = textarea.value;
        const nextValue = current.slice(0, start) + sanitized + current.slice(end);

        textarea.value = nextValue;
        draftRef.current = nextValue;
        adjustTextareaHeight(textarea);
        scheduleCommit(nextValue);

        const nextPos = start + sanitized.length;
        requestAnimationFrame(() => textarea.setSelectionRange(nextPos, nextPos));
    }, [adjustTextareaHeight, sanitizePastedHebrewInput, scheduleCommit]);

    const insertTextAtCursor = useCallback((incomingText) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const sanitized = sanitizePastedHebrewInput(incomingText);
        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const current = textarea.value;
        const nextValue = current.slice(0, start) + sanitized + current.slice(end);

        textarea.value = nextValue;
        draftRef.current = nextValue;
        adjustTextareaHeight(textarea);
        scheduleCommit(nextValue);

        const nextPos = start + sanitized.length;
        requestAnimationFrame(() => textarea.setSelectionRange(nextPos, nextPos));
    }, [adjustTextareaHeight, sanitizePastedHebrewInput, scheduleCommit]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDragActive) setIsDragActive(true);
    }, [isDragActive]);

    const handleDragLeave = useCallback((e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragActive(false);
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        setIsDragActive(false);

        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;

        const file = files.find((candidate) => {
            const hasTextType = candidate.type?.startsWith('text/');
            const hasTextExt = /\.(txt|text|md|csv|log)$/i.test(candidate.name || '');
            return hasTextType || hasTextExt;
        });

        if (!file) return;

        const droppedText = await file.text();
        insertTextAtCursor(droppedText);
    }, [insertTextAtCursor]);

    return (
        <textarea
            ref={textareaRef}
            dir="rtl"
            id="text-input"
            className={`w-full resize-y p-4 border rounded-lg focus:ring-2 focus:border-blue-500 transition duration-150 text-right ${TEXT_SIZE_CLASSNAMES[textSize] || TEXT_SIZE_CLASSNAMES.md} ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'} ${isDragActive ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
            rows={MIN_INPUT_ROWS}
            defaultValue={text}
            onChange={handleChange}
            onBlur={commitChanges}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            placeholder="הזן טקסט לניתוח"
        />
    );
});

// -----------------------------------------------------------------------------
// 8. Main App Component
// -----------------------------------------------------------------------------
const App = () => {
    // ... Context and Effects ...
    const state = useAppCoreState();
    const dispatch = useAppDispatch();
    const {
        text, coreResults, selectedDR, isDarkMode, searchTerm, isValueTableOpen, isValueTablePinned,
        mode, textSize, copiedId, view, hoveredWord, isPrimesCollapsed, pinnedWord, selectedHotValue,
        hotWordsList, isStatsCollapsed, showScrollTop, hotView, detailsView, hotSort,
        expandedRows, primeColor,
        stats, connectionValues, valueToWordsMap, filters,
        hasExplicitThemeChoice, isPending, engineStats
    } = state;

    const clusterRefs = useRef({});
    const valueTableRef = useRef(null);
    const valueTableButtonRef = useRef(null);
    
    const letterTable = useMemo(() => buildLetterTable(mode), [mode]);

    useLayoutEffect(() => {
        if (view !== 'clusters' || selectedDR === null) return;
        const el = clusterRefs.current[selectedDR];
        if (!el) return;
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }, [selectedDR, view]);

    // Fixed: Properly close table when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (isValueTableOpen) {
                if (valueTableButtonRef.current && valueTableButtonRef.current.contains(event.target)) return;
                if (valueTableRef.current && !valueTableRef.current.contains(event.target)) {
                    // Explicitly unpin and close
                    dispatch({ type: 'CLOSE_VALUE_TABLE' });
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isValueTableOpen, dispatch]);

    // ... scroll effect, localstorage effect ...
    useEffect(() => {
        const checkScrollTop = () => {
            const shouldShow = window.pageYOffset > 300;
            if (showScrollTop !== shouldShow) dispatch({ type: 'SET_SHOW_SCROLL_TOP', payload: shouldShow });
        };
        window.addEventListener('scroll', checkScrollTop);
        return () => window.removeEventListener('scroll', checkScrollTop);
    }, [showScrollTop, dispatch]);

    useEffect(() => {
        let savedText = null;
        try {
            savedText = localStorage.getItem('alephCodeText');
        } catch (_err) {
            savedText = null;
        }
        if (savedText) dispatch({ type: 'SET_TEXT', payload: savedText });
    }, [dispatch]);

    useEffect(() => {
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem('alephThemeMode');
        } catch (_err) {
            savedTheme = null;
        }

        if (savedTheme === 'dark' || savedTheme === 'light') {
            dispatch({ type: 'SET_DARK_MODE', payload: savedTheme === 'dark' });
            dispatch({ type: 'SET_EXPLICIT_THEME_CHOICE', payload: true });
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        dispatch({ type: 'SET_DARK_MODE', payload: mediaQuery.matches });
        dispatch({ type: 'SET_EXPLICIT_THEME_CHOICE', payload: false });
    }, [dispatch]);
    
    useEffect(() => {
        if (!hasExplicitThemeChoice) return;
        try {
            localStorage.setItem('alephThemeMode', isDarkMode ? 'dark' : 'light');
        } catch (_err) {
            // Ignore storage write failures (private mode / blocked storage)
        }
    }, [hasExplicitThemeChoice, isDarkMode]);

    useEffect(() => {
        const requestIdle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1));
        const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
        let idleId = null;
        const timerId = setTimeout(() => {
            idleId = requestIdle(() => {
                try {
                    localStorage.setItem('alephCodeText', text);
                } catch (_err) {
                    // Ignore storage write failures (private mode / blocked storage)
                }
            });
        }, 450);

        return () => {
            clearTimeout(timerId);
            if (idleId) cancelIdle(idleId);
        };
    }, [text]);
    useEffect(() => { document.body.classList.toggle('dark', isDarkMode); }, [isDarkMode]);
    useEffect(() => {
        if (hasExplicitThemeChoice) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = (event) => dispatch({ type: 'SET_DARK_MODE', payload: event.matches });

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', applyTheme);
            return () => mediaQuery.removeEventListener('change', applyTheme);
        }

        mediaQuery.addListener(applyTheme);
        return () => mediaQuery.removeListener(applyTheme);
    }, [dispatch, hasExplicitThemeChoice]);


    // ... Memos for clusters, hot values, word counts ...
    const drClusters = useMemo(() => {
        if (!coreResults || (view !== 'clusters' && view !== 'network')) return {};
        const activeDrOrder = mode === 'aleph-zero' ? ALEPH_ZERO_DR_ORDER : DEFAULT_DR_ORDER;
        const clusters = Object.fromEntries(activeDrOrder.map((dr) => [dr, []]));
        coreResults.allWords.forEach((wd) => {
            if (Object.hasOwn(clusters, wd.dr)) clusters[wd.dr].push(wd);
        });
        for (const k in clusters) {
            clusters[k].sort((a, b) => {
                if (a.units !== b.units) return a.units - b.units;
                if (a.tens !== b.tens) return a.tens - b.tens;
                return a.hundreds - b.hundreds;
            });
        }
        return clusters;
    }, [coreResults, mode, view]);

    const deferredHoveredWord = useDeferredValue(hoveredWord);
    const deferredFilters = useDeferredValue(filters);
    const activeWord = pinnedWord || deferredHoveredWord;
    const activeWordKey = activeWord?.word || null;

    const isVisibleWord = useCallback(
        (wordData) => isWordVisible(wordData, deferredFilters) && (selectedDR === null || wordData.dr === selectedDR),
        [deferredFilters, selectedDR]
    );

    const visibleAllWords = useMemo(() => {
        if (!coreResults) return [];
        if (view !== 'lines' && view !== 'hot-words') return [];
        return coreResults.allWords.filter(isVisibleWord);
    }, [coreResults, isVisibleWord, view]);

    const visibleWordsByLine = useMemo(() => {
        if (!coreResults) return [];
        if (view !== 'lines') return [];
        return coreResults.lines.map((line) => line.words.filter(isVisibleWord));
    }, [coreResults, isVisibleWord, view]);

    const visibleHotWords = useMemo(() => hotWordsList.filter((wordData) => isWordVisible(wordData, deferredFilters)), [hotWordsList, deferredFilters]);

    const visibleValueToWordsMap = useMemo(() => {
        if (!valueToWordsMap) return new Map();
        if (view !== 'hot-words') return new Map();
        const map = new Map();
        for (const [value, words] of valueToWordsMap.entries()) {
            const visible = words.filter(isVisibleWord);
            if (visible.length > 0) map.set(value, visible);
        }
        return map;
    }, [valueToWordsMap, isVisibleWord, view]);

    const hotValuesList = useMemo(() => {
        if (!visibleValueToWordsMap) return [];
        const arr = [];
        for (const [value, visibleWords] of visibleValueToWordsMap.entries()) {
            const uniqueWordsCount = new Set(visibleWords.map((w) => w.word)).size;
            arr.push({ value, count: uniqueWordsCount });
        }
        return arr;
    }, [visibleValueToWordsMap]);

    const sortedWordCounts = useMemo(() => {
        if (!coreResults || !coreResults.wordCounts) return [];
        if (view !== 'hot-words' || hotView !== 'words') return [];
        const wordMap = coreResults.wordDataMap;
        return Array.from(coreResults.wordCounts.entries())
            .filter(([word]) => {
                 const wordData = wordMap.get(word);
                 return wordData && isVisibleWord(wordData);
            })
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count);
    }, [coreResults, isVisibleWord, view, hotView]);

    const sortedHotViewList = useMemo(() => {
        if (hotView === 'words') {
            const arr = [...sortedWordCounts];
            const { key, order } = hotSort;
            if (key === 'count') arr.sort((a, b) => order === 'asc' ? a.count - b.count : b.count - a.count);
            return arr;
        }
        const arr = [...hotValuesList];
        const { key, order } = hotSort;
        arr.sort((a, b) => {
            const valA = a[key]; const valB = b[key];
            return order === 'asc' ? valA - valB : valB - valA;
        });
        return arr;
    }, [hotView, sortedWordCounts, hotValuesList, hotSort]);

    const { wordsByVisibleValue: hotWordsByVisibleValue, visibleValuesByWord: hotVisibleValuesByWord } = useMemo(() => {
        if (view !== 'hot-words' || selectedHotValue === null) return { wordsByVisibleValue: new Map(), visibleValuesByWord: new Map() };
        return buildWordConnectionIndex(visibleHotWords, deferredFilters);
    }, [view, selectedHotValue, visibleHotWords, deferredFilters]);

    const hotConnectedWordsSet = useMemo(() => {
        if (view !== 'hot-words' || selectedHotValue === null) return new Set();
        return computeConnectedWordsSet(activeWord, hotVisibleValuesByWord, hotWordsByVisibleValue);
    }, [view, selectedHotValue, activeWord, hotVisibleValuesByWord, hotWordsByVisibleValue]);

    const filteredWordsInView = useMemo(() => {
        if (view !== 'clusters' || !drClusters) return [];
        const allWordsInClusters = Object.entries(drClusters)
            .filter(([dr]) => selectedDR === null || selectedDR === parseInt(dr))
            .flatMap(([, words]) => words);

        let filteredWords = allWordsInClusters;

        if (searchTerm.trim()) {
            const normalizedSearch = normalizeSearchInput(searchTerm);
            filteredWords = filteredWords.filter((wordData) => matchesSearchQuery(wordData, normalizedSearch, deferredFilters));
        }

        const regrouped = {};
        filteredWords.forEach((wordData) => {
            if (isVisibleWord(wordData)) {
                if (!regrouped[wordData.dr]) regrouped[wordData.dr] = [];
                regrouped[wordData.dr].push(wordData);
            }
        });

        const activeDrOrder = mode === 'aleph-zero' ? ALEPH_ZERO_DR_ORDER : DEFAULT_DR_ORDER;
        return activeDrOrder
            .map((dr) => ({ dr, words: regrouped[dr] || [] }))
            .filter(({ words }) => words.length > 0);
    }, [drClusters, mode, view, selectedDR, searchTerm, isVisibleWord, deferredFilters]);

    const getPinnedRelevantWords = useCallback(() => {
        if (!pinnedWord || view !== 'clusters' || !drClusters) return null;

        const relevantWords = [pinnedWord];
        const clusterWords = Object.values(drClusters).flat();

        for (const wordData of clusterWords) {
            const isDifferentWord = wordData.word !== pinnedWord.word;
            const isConnected = topConnectionLayer(pinnedWord, wordData);
            if (isDifferentWord && isConnected && isVisibleWord(wordData)) {
                relevantWords.push(wordData);
            }
        }

        return relevantWords;
    }, [pinnedWord, view, drClusters, isVisibleWord]);
    
    // --- Data Preparation for Export ---
    const prepareAllDetailsText = useCallback(() => {
        if (!coreResults || !stats) return "";
        const primeMarker = (isPrime) => isPrime ? " ♢" : "";
        const modeText = `מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}`;
        const filterText = selectedDR !== null ? ` | מסונן לפי ש"ד: ${selectedDR}` : "";
        const lines = [
            `${modeText}${filterText}\n===================\n`,
            "ניתוח סטטיסטי\n-------------------\n",
            `סה"כ שורות: ${stats.totalLines}`,
            `סה"כ מילים: ${stats.totalWords}`,
            `מילים ייחודיות: ${stats.uniqueWords}`,
            `שורות ראשוניות: ${stats.primeLineTotals}`,
            `קבוצות קשרים: ${connectionValues.size || 0}\n`,
            "סיכום כללי (מסונן לפי מקרא)\n-------------------\n"
        ];
        
        // ... Grand Totals logic remains same ...
        if (isValueVisible('U', coreResults.grandTotals.isPrime.U, filters)) lines.push(`סה"כ אחדות: ${coreResults.grandTotals.units}${primeMarker(coreResults.grandTotals.isPrime.U)}`);
        if (coreResults.grandTotals.tens !== coreResults.grandTotals.units && isValueVisible('T', coreResults.grandTotals.isPrime.T, filters)) lines.push(`סה"כ עשרות: ${coreResults.grandTotals.tens}${primeMarker(coreResults.grandTotals.isPrime.T)}`);
        if (coreResults.grandTotals.hundreds !== coreResults.grandTotals.tens && isValueVisible('H', coreResults.grandTotals.isPrime.H, filters)) lines.push(`סה"כ מאות: ${coreResults.grandTotals.hundreds}${primeMarker(coreResults.grandTotals.isPrime.H)}`);
        lines.push(`ש"ד כללי: ${coreResults.grandTotals.dr}\n`);

        if (detailsView === 'words') {
             lines.push("סיכום מילים ייחודיות\n-------------------\n");
             visibleAllWords.forEach(w => {
                const calc = getLetterDetails(w.word, letterTable).map(l => `${l.char}(${l.value})`).join('+');
                let valuesArr = [];
                if (isValueVisible('U', w.isPrimeU, filters)) valuesArr.push(`אחדות: ${w.units}${w.isPrimeU ? " ♢" : ""}`);
                if (w.tens !== w.units && isValueVisible('T', w.isPrimeT, filters)) valuesArr.push(`עשרות: ${w.tens}${w.isPrimeT ? " ♢" : ""}`);
                if (w.hundreds !== w.tens && isValueVisible('H', w.isPrimeH, filters)) valuesArr.push(`מאות: ${w.hundreds}${w.isPrimeH ? " ♢" : ""}`);
                lines.push(`- ${w.word}: ${calc} | ${valuesArr.join(' | ')} | ש"ד: ${w.dr}`);
             });
             return lines.join('\n');
        }

        lines.push("פירוט שורות\n-------------------\n");
        coreResults.lines.forEach((line, index) => {
            const visibleWords = visibleWordsByLine[index] || [];
            if (visibleWords.length === 0) return;

            lines.push(`\nשורה ${index + 1}: "${line.lineText}"`);
            visibleWords.forEach(wordData => {
                const calculation = getLetterDetails(wordData.word, letterTable).map(l => `${l.char}(${l.value})`).join(' + ');
                const primeU = wordData.isPrimeU ? " ♢" : "";
                
                let valuesArr = [];
                if (isValueVisible('U', wordData.isPrimeU, filters)) valuesArr.push(`אחדות: ${wordData.units}${primeU}`);
                if (wordData.tens !== wordData.units && isValueVisible('T', wordData.isPrimeT, filters)) valuesArr.push(`עשרות: ${wordData.tens}${wordData.isPrimeT ? " ♢" : ""}`);
                if (wordData.hundreds !== wordData.tens && isValueVisible('H', wordData.isPrimeH, filters)) valuesArr.push(`מאות: ${wordData.hundreds}${wordData.isPrimeH ? " ♢" : ""}`);
                
                const valuesString = valuesArr.join(' | ');
                lines.push(`  - ${wordData.word}: ${calculation} | ${valuesString} | ש"ד: ${wordData.dr}`);
            });
            // ... Line totals logic ...
            const lineValues = [];
            if (isValueVisible('U', line.isPrimeTotals.U, filters)) lineValues.push(`אחדות=${line.totals.units}${primeMarker(line.isPrimeTotals.U)}`);
            if (line.lineMaxLayer !== 'U' && line.totals.tens !== line.totals.units && isValueVisible('T', line.isPrimeTotals.T, filters)) lineValues.push(`עשרות=${line.totals.tens}${primeMarker(line.isPrimeTotals.T)}`);
            if (line.lineMaxLayer === 'H' && line.totals.hundreds !== line.totals.tens && isValueVisible('H', line.isPrimeTotals.H, filters)) lineValues.push(`מאות=${line.totals.hundreds}${primeMarker(line.isPrimeTotals.H)}`);
            const lineWordCount = line.words.length;
            const wordsSuffix = lineWordCount > 1 ? ` (${lineWordCount} מילים)` : '';
            lineValues.push(`ש"ד=${line.totalsDR}${wordsSuffix}`);
            lines.push(`  סה"כ שורה: ${lineValues.join(', ')}`);
        });
        
        // ... Prime Summary logic ...
        if (coreResults.primeSummary.length > 0) {
            lines.push(`\n\nסיכום ראשוניים מסכומי השורות\n---------------------------\n`);
            coreResults.primeSummary.forEach(p => {
                 const layers = p.layers.map(l => l === 'אחדות' ? 'U' : l === 'עשרות' ? 'T' : 'H');
                 if (layers.some(l => filters[l])) lines.push(`שורה ${p.line}: ${p.value} (שכבת ${p.layers.join(', ')})`);
            });
        }
        return lines.filter(Boolean).join('\n');
    }, [coreResults, stats, mode, connectionValues, letterTable, filters, selectedDR, detailsView, visibleAllWords, visibleWordsByLine]);

    const prepareAllDetailsCSV = useCallback(() => prepareAllDetailsText(), [prepareAllDetailsText]);

    const prepareSummaryText = useCallback(() => {
        if (!coreResults) return "";
        const primeMarker = (isPrime) => isPrime ? " ♢" : "";
        const modeText = `מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}`;
        const lines = [`${modeText}\n===================\n`];

        const formatWord = (wordData) => {
            const values = [];
            if (isValueVisible('U', wordData.isPrimeU, filters)) values.push(`אחדות: ${wordData.units}${primeMarker(wordData.isPrimeU)}`);
            if (wordData.maxLayer !== 'U' && wordData.tens !== wordData.units && isValueVisible('T', wordData.isPrimeT, filters)) values.push(`עשרות: ${wordData.tens}${primeMarker(wordData.isPrimeT)}`);
            if (wordData.maxLayer === 'H' && wordData.hundreds !== wordData.tens && isValueVisible('H', wordData.isPrimeH, filters)) values.push(`מאות: ${wordData.hundreds}${primeMarker(wordData.isPrimeH)}`);
            if (values.length === 0) return null; 
            return `- ${wordData.word} (${values.join(', ')})`;
        };

        if (view === 'clusters' && pinnedWord) {
            const relevantWords = getPinnedRelevantWords();
            lines.push(`סיכום מילים המקושרות ל"${pinnedWord.word}" (מסונן)\n==============================\n`);
            relevantWords.forEach(wordData => {
                const txt = formatWord(wordData);
                if (txt) lines.push(txt);
            });
        } else if (view === 'clusters') {
            const drHeader = selectedDR !== null ? `סיכום קיבוץ שורש דיגיטלי ${selectedDR}` : `סיכום כללי - קיבוץ לפי שורש דיגיטלי`;
            if (searchTerm) lines.push(`סיכום תוצאות חיפוש "${searchTerm}"\n==============================\n`);
            else lines.push(`${drHeader}\n==============================\n`);
            
            filteredWordsInView.forEach(({ dr, words }) => {
                const visibleWords = words.map(formatWord).filter(Boolean);
                if (visibleWords.length > 0) {
                    if (selectedDR === null) lines.push(`\nש"ד ${dr} (${visibleWords.length} מילים)\n---------------------------\n`);
                    visibleWords.forEach(line => lines.push(line));
                }
            });
        }
        return lines.join('\n');
    }, [coreResults, mode, view, pinnedWord, getPinnedRelevantWords, selectedDR, searchTerm, filteredWordsInView, filters]);

    const prepareSummaryCSV = useCallback(() => prepareSummaryText(), [prepareSummaryText]);

    const prepareHotWordsText = useCallback(() => {
        if (!coreResults || selectedHotValue === null) return "";
        const primeU = (w) => w.isPrimeU ? " ♢" : "";
        const lines = [`מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}\n===================\n`, `מילים עם הערך ${selectedHotValue}\n-------------------\n`];
        visibleHotWords.forEach(w => {
            let parts = [];
            if(isValueVisible('U', w.isPrimeU, filters)) parts.push(`אחדות: ${w.units}${primeU(w)}`);
            if (w.tens !== w.units && isValueVisible('T', w.isPrimeT, filters)) parts.push(`עשרות: ${w.tens}${w.isPrimeT ? " ♢" : ""}`);
            if (w.hundreds !== w.tens && isValueVisible('H', w.isPrimeH, filters)) parts.push(`מאות: ${w.hundreds}${w.isPrimeH ? " ♢" : ""}`);
            const valuesString = parts.join(' | ');
            lines.push(`${w.word} | ${valuesString} | ש"ד: ${w.dr}`);
        });
        return lines.join('\n');
    }, [coreResults, selectedHotValue, mode, visibleHotWords, filters]);

    const prepareHotWordsCSV = useCallback(() => prepareHotWordsText(), [prepareHotWordsText]);

    const prepareFrequenciesText = useCallback(() => {
        if (!coreResults) return "";
        const lines = [`מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}\n===================\n`];
        if (hotView === 'values') {
            lines.push("סיכום שכיחות ערכים\n-------------------\n");
            // USE SORTED LIST
            const arr = sortedHotViewList; 
            arr.forEach(({ value, count }) => {
                 const words = [...new Set((visibleValueToWordsMap.get(value) || []).map(w => w.word))].join(', ');
                 if(words) lines.push(`ערך: ${value} | כמות: ${count}\nמילים: ${words}\n`);
            });
        } else {
            lines.push("סיכום שכיחות מילים\n-------------------\n");
            // USE SORTED LIST
            sortedHotViewList.forEach(({ word, count }) => lines.push(`מילה: ${word}, שכיחות: ${count}`));
        }
        return lines.join('\n');
    }, [coreResults, mode, hotView, sortedHotViewList, visibleValueToWordsMap]);

    const prepareFrequenciesCSV = useCallback(() => prepareFrequenciesText(), [prepareFrequenciesText]);

    // --- Event Handlers ---
    const handleTableIconEnter = () => dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: true });
    const handleTableIconLeave = () => !isValueTablePinned && dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: false });
    const handleTableIconClick = () => dispatch({ type: 'TOGGLE_VALUE_TABLE_PIN' });
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const handleModeChange = (newMode) => dispatch({ type: 'SET_MODE', payload: newMode });
    const handleTextSizeChange = (e) => dispatch({ type: 'SET_TEXT_SIZE', payload: e.target.value });
    const handleClearText = useCallback(() => dispatch({ type: 'SET_TEXT', payload: '' }), [dispatch]);
    const drOrder = mode === 'aleph-zero' ? ALEPH_ZERO_DR_ORDER : DEFAULT_DR_ORDER;
    
    const handleDrillDown = useCallback((dr) => {
        if (!stats || (stats.drDistribution?.[dr] || 0) === 0) return;
        // Toggle selected DR instead of switching view
        dispatch({ type: 'SET_SELECTED_DR', payload: dr });
    }, [dispatch, stats]);

    useEffect(() => {
        if (selectedDR === null || !stats) return;
        if ((stats.drDistribution?.[selectedDR] || 0) === 0) {
            dispatch({ type: 'SET_SELECTED_DR', payload: null });
        }
    }, [dispatch, selectedDR, stats]);

    const handleWordClick = useCallback((wordData) => dispatch({ type: 'SET_PINNED_WORD', payload: wordData }), [dispatch]);
    const handleViewChange = useCallback((newView) => dispatch({ type: 'SET_VIEW', payload: newView }), [dispatch]);
    const unpinOnBackgroundClick = useCallback((e) => { if (e.target === e.currentTarget) { e.stopPropagation(); dispatch({ type: 'UNPIN_WORD' }); } }, [dispatch]);
    const handleTextChange = useCallback((nextText) => {
        dispatch({ type: 'SET_TEXT', payload: forceHebrewInput(nextText) });
    }, [dispatch]);
    const hasInput = text.trim().length > 0;

    return (
        <div dir="rtl" className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-slate-100 to-blue-100 text-gray-900'}`}>
            <GlobalStyles />
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div className="text-right">
                        <h1 className="text-5xl font-bold bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{mode === 'aleph-zero' ? 'מצב א:0' : 'מצב א:1'}</h1>
                        <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>כלי הצבה לקסיומטרי לטקסט עברי</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Legend />
                        <div className="relative" onMouseEnter={handleTableIconEnter} onMouseLeave={handleTableIconLeave}>
                            <button ref={valueTableButtonRef} onClick={handleTableIconClick} className={`p-2 rounded-full text-xl transition-colors noselect ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-100 hover:bg-slate-300'}`} aria-label="הצג טבלת ערכי אותיות">
                                <Icon name="hash" className="w-5 h-5 text-purple-600"/>
                            </button>
                        </div>
                        <button onClick={() => dispatch({ type: 'TOGGLE_THEME_MODE' })} className={`p-2 rounded-full text-xl transition-colors noselect ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
                            {isDarkMode ? <Icon name="sun" className="w-5 h-5 text-yellow-400"/> : <Icon name="moon" className="w-5 h-5 text-blue-600"/>}
                        </button>
                    </div>
                </header>

                {isValueTableOpen && (
                    <div ref={valueTableRef} className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">טבלת ערכי אותיות ({mode === 'aleph-zero' ? 'א:0' : 'א:1'})</h2>
                        <div className="flex justify-center gap-8">
                            { [0, 11].map(offset => (
                                <table key={offset} className="text-center w-full max-w-xs"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-indigo-100'}>
                                    <tr>{['אות', 'אחדות', 'עשרות', 'מאות'].map(header => <th key={header} className="p-2 font-semibold">{header}</th>)}</tr>
                                </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {Object.keys(SAFE_BASE_LETTER_VALUES).slice(offset, offset + 11).map(letter => {
                                        const rec = letterTable.get(letter);
                                        const finalForm = Object.keys(HEB_FINALS).find(key => HEB_FINALS[key] === letter);
                                        if (!rec) return null;
                                        return (
                                        <tr key={letter} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-100'}>
                                            <td className="p-2 font-bold text-xl flex items-center justify-center gap-2"><span>{letter}</span>{finalForm && <span className="text-gray-500 dark:text-gray-400">{finalForm}</span>}</td>
                                            <td className="p-2 font-mono">{rec.u}</td><td className="p-2 font-mono">{rec.t}</td><td className="p-2 font-mono">{rec.h}</td>
                                        </tr>);
                                    })}
                                </tbody></table>
                            ))}
                        </div>
                    </div>
                )}
                
                {!isValueTableOpen && (
                <>
                    <StatsPanel />

                    <div className={`p-6 rounded-xl border mb-8 transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)] hover:shadow-xl'}`}>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-2 gap-4">
                            <div className={`flex items-center p-1 rounded-full justify-self-start w-fit ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <button onClick={() => handleModeChange('aleph-zero')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors noselect ${mode === 'aleph-zero' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}>א:0</button>
                                <button onClick={() => handleModeChange('aleph-one')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors noselect ${mode === 'aleph-one' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}>א:1</button>
                            </div>
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleClearText}
                                    disabled={!text}
                                    className={`px-4 py-1 text-sm font-semibold rounded-md border transition-colors noselect ${!text ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 disabled:hover:bg-white'}`}
                                >
                                    אפס
                                </button>
                            </div>
                            <label className="flex items-center justify-self-end gap-2 text-sm font-semibold noselect">
                                <span>גופן</span>
                                <select
                                    dir="rtl"
                                    value={textSize}
                                    onChange={handleTextSizeChange}
                                    className={`px-3 py-1 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-300 text-gray-800'}`}
                                >
                                    {TEXT_SIZE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <MainTextInput
                            text={text}
                            isDarkMode={isDarkMode}
                            textSize={textSize}
                            onTextChange={handleTextChange}
                        />
                        <div className="mt-4 flex justify-center items-center gap-4 h-5">
                            {isPending && <span className="text-sm text-gray-500 dark:text-gray-400 noselect">מחשב...</span>}
                            <EngineStatusBadge engineStats={engineStats} />
                        </div>
                    </div>

                    {hasInput && (
                        <div className="flex justify-center my-8">
                            <div className={`flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <button onClick={() => handleViewChange('hot-words')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'hot-words' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="bar-chart" className="w-4 h-4" />שכיחות</button>
                                <button onClick={() => handleViewChange('lines')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'lines' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="grid" className="w-4 h-4" />פירוט</button>
                                <button onClick={() => handleViewChange('clusters')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'clusters' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="network" className="w-4 h-4" />קבוצות</button>
                                <button onClick={() => handleViewChange('graph')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'graph' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="activity" className="w-4 h-4" />גרף</button>
                                <button onClick={() => handleViewChange('network')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'network' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="share-2" className="w-4 h-4" />רשת</button>
                            </div>
                        </div>
                    )}

                    {stats && (
                        <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                            <div className="flex justify-between items-center mb-4 noselect">
                                <div className="flex-1"></div>
                                <h3 className="text-2xl font-bold text-center flex-grow">התפלגות שורשים דיגיטליים</h3>
                                <div className="flex-1 flex justify-end"></div>
                            </div>
                            <div className={`flex justify-around items-center p-2 rounded-lg h-28 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                {drOrder.map((dr) => {
                                    const count = stats.drDistribution[dr] || 0;
                                    const maxCount = Math.max(...stats.drDistribution.slice(1));
                                    const hasWords = count > 0;
                                    const isPrimeDR = [2,3,5,7].includes(dr);
                                    const primeColorClasses = COLOR_PALETTE[primeColor];
                                    const indicatorSize = hasWords ? 22 + (12 * (hasWords && maxCount > 0 ? Math.pow(count / maxCount, 0.75) : 0)) : 0;
                                    
                                    return (
                                        <div key={dr} className="flex flex-col items-center w-1/12 h-full justify-center group">
                                            <button
                                                type="button"
                                                disabled={!hasWords}
                                                className={`flex flex-col items-center w-full h-full justify-center group rounded-md p-1 transition-all ${hasWords ? 'cursor-pointer hover:bg-gray-200/80 dark:hover:bg-gray-600/40' : 'cursor-not-allowed opacity-45'} ${selectedDR === dr ? 'border-2 border-purple-500 dark:border-purple-400' : 'border-2 border-transparent'}`}
                                                onClick={() => handleDrillDown(dr)}
                                                aria-label={`ש"ד ${dr}${hasWords ? '' : ' (ללא תוצאות)'}`}
                                                title={hasWords ? `סינון לפי ש"ד ${dr}` : `ש"ד ${dr} - ללא מילים`}
                                            >
                                                <div className="h-8 flex items-center justify-center mb-1">
                                                    {hasWords && <div className="rounded-full flex items-center justify-center bg-blue-600 text-xs font-bold text-white shadow-md" style={{ width: `${indicatorSize}px`, height: `${indicatorSize}px` }}>{count}</div>}
                                                </div>
                                                <div className={`font-bold text-lg mt-1 ${selectedDR === dr ? 'text-purple-700 dark:text-purple-300' : isPrimeDR ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-600 dark:text-gray-400'}`}>ש"ד {dr}</div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {view === 'lines' && coreResults && (
                        <>
                            {detailsView === 'lines' ? (
                                <>
                                    {coreResults.grandTotals && (
                                        <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex-1 flex justify-start"><ExportToolbar getText={prepareAllDetailsText} getCSV={prepareAllDetailsCSV} id='all-details' /></div>
                                                <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center noselect">סיכום כללי</h2></div>
                                                <div className="flex-1 flex justify-end">
                                                    <div className={`flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                        <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'lines' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>שורות</button>
                                                        <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-flow-col md:auto-cols-fr gap-4 text-center">
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">Σ-אחדות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.units} isPrimeFlag={coreResults.grandTotals.isPrime.U} primeColor={primeColor} layer="U" filters={filters}/> </div>
                                                {coreResults.grandTotals.tens !== coreResults.grandTotals.units && <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">Σ-עשרות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.tens} isPrimeFlag={coreResults.grandTotals.isPrime.T} primeColor={primeColor} layer="T" filters={filters}/> </div>}
                                                {coreResults.grandTotals.hundreds !== coreResults.grandTotals.tens && <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">Σ-מאות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.hundreds} isPrimeFlag={coreResults.grandTotals.isPrime.H} primeColor={primeColor} layer="H" filters={filters}/> </div>}
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">ש"ד (סה"כ)</p> <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{coreResults.grandTotals.dr}</p> </div>
                                            </div>
                                        </div>
                                    )}
                                    {coreResults.primeSummary.length > 0 && (
                                        <div className={`p-4 sm:p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                                            <button onClick={() => dispatch({ type: 'TOGGLE_PRIMES_COLLAPSED' })} className="w-full flex justify-between items-center text-2xl font-bold text-gray-800 dark:text-gray-200 noselect">
                                                <span className="text-center flex-grow">סיכום ראשוניים מסכומי השורות</span>
                                                <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isPrimesCollapsed ? '' : 'rotate-180'}`} />
                                            </button>
                                            {!isPrimesCollapsed && (
                                                <div className="mt-4">
                                                    <p className={`text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>בסך הכל נמצאו <span className="font-bold text-emerald-600">{stats.primeLineTotals}</span> שורות עם ערכים ראשוניים.</p>
                                                    <div className="overflow-x-auto max-w-lg mx-auto">
                                                        <table className="min-w-full"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-emerald-100'}>
                                                            <tr><th className="px-4 py-3 text-center">שורה</th><th className="px-4 py-3 text-center">ערך ראשוני</th><th className="px-4 py-3 text-center">שכבה</th></tr>
                                                        </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                            {coreResults.primeSummary.map((primeInfo, index) => {
                                                                const layers = primeInfo.layers.map(l => l === 'אחדות' ? 'U' : l === 'עשרות' ? 'T' : 'H');
                                                                if (!layers.some(l => filters[l])) return null;

                                                                return (
                                                                <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-emerald-50'}`}><td className="px-4 py-3 text-center">{primeInfo.line}</td><td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{primeInfo.value}</td><td className="px-4 py-3 text-center">{primeInfo.layers.join(', ')}</td></tr>
                                                            )})}
                                                        </tbody></table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex justify-end mb-4"><button onClick={() => dispatch({ type: 'TOGGLE_ALL_ROWS' })} className="bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors noselect">{coreResults && Object.keys(expandedRows).length === coreResults.lines.length && Object.values(expandedRows).every(v => v) ? 'קפל הכל' : 'פתח הכל'}</button></div>
                                    {coreResults.lines.map((lineResult, lineIndex) => {
                                        const isExpanded = !!expandedRows[lineIndex];
                                        const visibleWords = visibleWordsByLine[lineIndex] || [];
                                        const showTotalsLine = !isExpanded || lineResult.words.length > 1;
                                        if (visibleWords.length === 0) return null;

                                        return (
                                            <div
                                                key={lineIndex}
                                                className={`p-4 sm:p-6 rounded-xl border mb-8 transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)] hover:shadow-xl'}`}
                                                style={{ contentVisibility: 'auto', containIntrinsicSize: '560px' }}
                                            >
                                                <div className="cursor-pointer" onClick={() => dispatch({ type: 'TOGGLE_ROW_EXPAND', payload: lineIndex })}>
                                                    <div className="flex justify-between items-center"><h2 className="text-2xl font-bold mb-1 text-center flex-grow">תוצאות עבור שורה {lineIndex + 1}</h2><Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} /></div>
                                                    <p className={`text-center mb-6 italic text-lg break-all ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>"{lineResult.lineText}"</p>
                                                    {showTotalsLine && <div className={`font-bold text-sm text-center p-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-slate-200 text-gray-900'}`}>סה"כ שורה: 
                                                        {lineResult.words.length > 1 && <span className="mx-2">({lineResult.words.length} מילים)</span>}
                                                        {isValueVisible('U', lineResult.isPrimeTotals.U, filters) && <span className={`mx-2 ${lineResult.isPrimeTotals.U ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>אחדות={lineResult.totals.units}{lineResult.isPrimeTotals.U && '♢'}</span>}
                                                        {lineResult.totals.tens !== lineResult.totals.units && isValueVisible('T', lineResult.isPrimeTotals.T, filters) && <span className={`mx-2 ${lineResult.isPrimeTotals.T ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>עשרות={lineResult.totals.tens}{lineResult.isPrimeTotals.T && '♢'}</span>}
                                                        {lineResult.totals.hundreds !== lineResult.totals.tens && isValueVisible('H', lineResult.isPrimeTotals.H, filters) && <span className={`mx-2 ${lineResult.isPrimeTotals.H ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>מאות={lineResult.totals.hundreds}{lineResult.isPrimeTotals.H && '♢'}</span>}
                                                        <span className="mx-2">ש"ד={lineResult.totalsDR}</span>
                                                    </div>}
                                                </div>
                                                {isExpanded && (
                                                    <div className="overflow-x-auto mt-4">
                                                        <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}>
                                                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-indigo-100'}>
                                                                <tr>
                                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th>
                                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th>
                                                                    {filters.U && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-אחדות</th>}
                                                                    {filters.T && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th>}
                                                                    {filters.H && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th>}
                                                                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>{visibleWords.map((res, index) => (
                                                                <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-slate-50 hover:bg-indigo-50'}`} style={{ contentVisibility: 'auto', containIntrinsicSize: '56px' }}>
                                                                    <td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td>
                                                                    <td className="px-4 py-3 text-sm text-right font-mono" style={{ direction: 'ltr', textAlign: 'right' }}>{getLetterDetails(res.word, letterTable).map(l => l.value).join('+')}</td>
                                                                    {filters.U && <ValueCell value={res.units} isPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="U" filters={filters} />}
                                                                    {filters.T && <ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} primeColor={primeColor} layer="T" filters={filters} />}
                                                                    {filters.H && <ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} primeColor={primeColor} layer="H" filters={filters} />}
                                                                    <td className="px-4 py-3 text-center font-semibold text-violet-900 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td>
                                                                </tr>
                                                            ))}</tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className={`p-4 sm:p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex-1 flex justify-start"><ExportToolbar getText={prepareAllDetailsText} getCSV={prepareAllDetailsCSV} id='all-details' /></div>
                                        <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center noselect">סיכום מילים ייחודיות ({coreResults.allWords.length} מילים)</h2></div>
                                        <div className="flex-1 flex justify-end">
                                            <div className={`flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'lines' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>שורות</button>
                                                <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}>
                                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-indigo-100'}>
                                                <tr>
                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th>
                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th>
                                                    {filters.U && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-אחדות</th>}
                                                    {filters.T && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th>}
                                                    {filters.H && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th>}
                                                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th>
                                                </tr>
                                            </thead>
                                            <tbody>{visibleAllWords.map((res, index) => (
                                                <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-slate-50 hover:bg-indigo-50'}`} style={{ contentVisibility: 'auto', containIntrinsicSize: '56px' }}>
                                                    <td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-mono" style={{ direction: 'ltr', textAlign: 'right' }}>{getLetterDetails(res.word, letterTable).map(l => l.value).join('+')}</td>
                                                    {filters.U && <ValueCell value={res.units} isPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="U" filters={filters} />}
                                                    {filters.T && <ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} primeColor={primeColor} layer="T" filters={filters} />}
                                                    {filters.H && <ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} primeColor={primeColor} layer="H" filters={filters} />}
                                                    <td className="px-4 py-3 text-center font-semibold text-violet-900 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    
                    {view === 'clusters' && coreResults && (
                        <ClusterView 
                            clusterRefs={clusterRefs}
                            unpinOnBackgroundClick={unpinOnBackgroundClick}
                            filteredWordsInView={filteredWordsInView}
                            pinnedWord={pinnedWord}
                            hoveredWord={hoveredWord}
                            isDarkMode={isDarkMode}
                            primeColor={primeColor}
                            connectionValues={connectionValues}
                            dispatch={dispatch}
                            copySummaryToClipboard={prepareSummaryText}
                            prepareSummaryCSV={prepareSummaryCSV}
                            copiedId={copiedId}
                            searchTerm={searchTerm}
                        />
                    )}

                    {view === 'hot-words' && coreResults && (
                        <div className={`p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex-1 flex justify-start"><ExportToolbar getText={selectedHotValue !== null ? prepareHotWordsText : prepareFrequenciesText} getCSV={selectedHotValue !== null ? prepareHotWordsCSV : prepareFrequenciesCSV} id='hot-words' /></div>
                                <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center noselect">ניתוח שכיחויות</h2></div>
                                <div className="flex-1 flex justify-end">
                                    <div className={`flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                        <button onClick={() => dispatch({ type: 'SET_HOT_VIEW', payload: 'values' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${hotView === 'values' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>ערכים</button>
                                        <button onClick={() => dispatch({ type: 'SET_HOT_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${hotView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                    </div>
                                </div>
                            </div>
                            {hotView === 'values' && (
                                <div>
                                    {selectedHotValue === null ? (
                                        <div>
                                            <div className={`flex text-right sticky top-0 p-2 font-semibold border-b noselect ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-slate-800 text-white border-slate-700'}`}>
                                                <div className="w-1/4 cursor-pointer" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'value' })}>ערך {hotSort.key === 'value' && (hotSort.order === 'desc' ? '↓' : '↑')}</div>
                                                <div className="w-1/4 text-center cursor-pointer" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'count' })}>כמות מילים {hotSort.key === 'count' && (hotSort.order === 'desc' ? '↓' : '↑')}</div>
                                                <div className="w-1/2">מילים</div>
                                            </div>
                                            <VirtualizedList
                                                items={sortedHotViewList}
                                                itemHeight={40}
                                                listHeight={384} 
                                                getKey={(item) => item.value}
                                                renderItem={({ value, count }) => (
                                                    <div className="flex items-center text-right hover:bg-gradient-to-l from-slate-100 to-indigo-100 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-200 dark:border-gray-700/50 noselect" style={{ height: 40 }} onClick={() => dispatch({ type: 'SET_SELECTED_HOT_VALUE', payload: { value, list: visibleValueToWordsMap.get(value) || [] } })}>
                                                        <div className="w-1/4 p-2 font-bold text-lg text-blue-700 dark:text-blue-300">{value}</div>
                                                        <div className="w-1/4 p-2 text-center text-gray-900 dark:text-gray-100">{count}</div>
                                                        <div className="w-1/2 p-2 text-sm text-gray-700 dark:text-gray-300 truncate">{[...new Set((visibleValueToWordsMap.get(value) || []).map(w => w.word))].join(', ')}</div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center mb-4 noselect gap-3 flex-wrap">
                                                <h3 className="text-xl font-bold">מילים עם הערך {selectedHotValue}</h3>
                                                <div className="flex items-center gap-2">
                                                    {pinnedWord && (
                                                        <div className={`text-sm px-3 py-1 rounded-full border ${isDarkMode ? 'bg-amber-900/40 border-amber-700 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                                                            מילה נעוצה: {pinnedWord.word}
                                                        </div>
                                                    )}
                                                    <button onClick={() => dispatch({ type: 'CLEAR_SELECTED_HOT_VALUE' })} className="bg-gray-200 dark:bg-gray-700/50 text-slate-700 dark:text-gray-300 px-4 py-2 rounded-lg text-base font-semibold hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors">חזור לרשימה</button>
                                                </div>
                                            </div>
                                            {visibleHotWords.length === 0 ? (
                                                <div className={`rounded-lg border p-4 text-sm ${isDarkMode ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
                                                    אין ערכים גלויים תחת הסינון הנוכחי. נסו להפעיל שכבות נוספות באגדת הסינון.
                                                </div>
                                            ) : (
                                            <div className="flex flex-wrap justify-start gap-2" onClick={unpinOnBackgroundClick}>
                                                {visibleHotWords.map((wordData, index) => (
                                                    <WordCard 
                                                        key={wordData.word}
                                                        wordData={wordData}
                                                        activeWord={activeWord}
                                                        activeWordKey={activeWordKey}
                                                        isConnectedToActive={hotConnectedWordsSet.has(wordData.word)}
                                                        isDarkMode={isDarkMode}
                                                        primeColor={primeColor}
                                                        connectionValues={connectionValues}
                                                        dispatch={dispatch}
                                                        filters={deferredFilters}
                                                    />
                                                ))}
                                            </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {hotView === 'words' && (
                                <div>
                                    <div className={`flex text-right sticky top-0 p-2 font-semibold border-b noselect ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-slate-800 text-white border-slate-700'}`}>
                                        <div className="w-3/4">מילה</div>
                                        <div className="w-1/4 text-center cursor-pointer" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'count' })}>כמות {hotSort.key === 'count' && (hotSort.order === 'desc' ? '↓' : '↑')}</div>
                                    </div>
                                    <VirtualizedList items={sortedHotViewList} itemHeight={40} listHeight={384} getKey={(item) => item.word} renderItem={({ word, count }) => (
                                        <div className="flex items-center text-right hover:bg-gradient-to-l from-slate-100 to-indigo-100 dark:hover:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700/50 noselect" style={{ height: 40 }}>
                                            <div className="w-3/4 p-2 font-bold text-lg text-blue-700 dark:text-blue-300">{word}</div>
                                            <div className="w-1/4 p-2 text-center font-mono text-gray-900 dark:text-gray-100">{count}</div>
                                        </div>
                                    )} />
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'graph' && coreResults && (
                        <GraphView 
                            coreResults={coreResults}
                            filters={deferredFilters}
                            isDarkMode={isDarkMode}
                            primeColor={primeColor}
                            onWordClick={handleWordClick}
                            selectedDR={selectedDR}
                        />
                    )}

                    {view === 'network' && coreResults && (
                        <NetworkView 
                            coreResults={coreResults}
                            filters={deferredFilters}
                            isDarkMode={isDarkMode}
                            primeColor={primeColor}
                            onWordClick={handleWordClick}
                            selectedDR={selectedDR}
                        />
                    )}
                </>
                )}
                {showScrollTop && (
                    <div className="relative group">
                        <button onClick={scrollToTop} className="fixed top-4 right-4 bg-gray-800/50 dark:bg-white/20 text-white p-2 rounded-full hover:bg-gray-800/70 dark:hover:bg-white/30 transition-opacity"><Icon name="arrow-up" className="w-6 h-6" /></button>
                        <div className="absolute top-4 right-16 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">לראש הדף</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// 9. App Provider & Wrapper
// -----------------------------------------------------------------------------
function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const deferredText = useDeferredValue(state.text);
    const commitCoreResults = useCallback((results) => {
        dispatch({ type: 'SET_CORE_RESULTS', payload: results });
    }, []);
    const { isPending, engineStats } = useCoreResultsEngine({
        deferredText,
        mode: state.mode,
        onResults: commitCoreResults,
    });

    const stats = useMemo(() => {
        if (!state.coreResults) return null;
        const primeLineCount = new Set(state.coreResults.primeSummary.map(p => p.line)).size;
        return {
            totalLines: state.coreResults.lines.length,
            totalWords: state.coreResults.totalWordCount,
            uniqueWords: state.coreResults.allWords.length,
            primeLineTotals: primeLineCount,
            drDistribution: state.coreResults.drDistribution,
        };
    }, [state.coreResults]);

    const valueToWordsMap = useMemo(() => {
        if (!state.coreResults) return new Map();
        const map = new Map();
        state.coreResults.allWords.forEach(wd => {
            const uniqueValues = new Set([wd.units, wd.tens, wd.hundreds]);
            uniqueValues.forEach(v => {
                if (!map.has(v)) map.set(v, []);
                map.get(v).push(wd);
            });
        });
        return map;
    }, [state.coreResults]);

    const connectionValues = useMemo(() => {
         if (!state.coreResults) return new Set();
         const visibleConnections = new Set();
         const valueCounts = new Map();

         state.coreResults.allWords.forEach((word) => {
             const visibleValues = [];

             if (word.hundreds !== word.tens && isValueVisible('H', word.isPrimeH, state.filters)) {
                 visibleValues.push(word.hundreds);
             }
             if (word.tens !== word.units && isValueVisible('T', word.isPrimeT, state.filters)) {
                 visibleValues.push(word.tens);
             }
             if (isValueVisible('U', word.isPrimeU, state.filters)) {
                 visibleValues.push(word.units);
             }

             if (visibleValues.length === 0) return;

             if (visibleValues.length > 1) {
                 visibleValues.sort((a, b) => a - b);
             }

             let prevValue;
             visibleValues.forEach((value) => {
                 if (value === prevValue) return;
                 const nextCount = (valueCounts.get(value) || 0) + 1;
                 valueCounts.set(value, nextCount);
                 if (nextCount > 1) visibleConnections.add(value);
                 prevValue = value;
             });
         });

         return visibleConnections;
    }, [state.coreResults, state.filters]);

    const contextValue = useMemo(() => ({
        ...state,
        stats,
        valueToWordsMap,
        connectionValues,
        isPending,
        engineStats,
    }), [state, stats, valueToWordsMap, connectionValues, isPending, engineStats]);

    return (
        <AppContext.Provider value={contextValue}>
            <AppDispatchContext.Provider value={dispatch}>
                {children}
            </AppDispatchContext.Provider>
        </AppContext.Provider>
    );
}

function WrappedApp() {
	return (
		<AppProvider>
			<App />
		</AppProvider>
	);
}

export default WrappedApp;
