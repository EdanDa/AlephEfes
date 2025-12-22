import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, useTransition, useLayoutEffect, useReducer, useContext, createContext, memo } from 'react';

// --- Constants & Configuration ---
const BASE_LETTER_VALUES = {
	'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
	'כ': 11, 'ל': 12, 'מ': 13, 'נ': 14, 'ס': 15, 'ע': 16, 'פ': 17, 'צ': 18, 'ק': 19,
	'ר': 20, 'ש': 21, 'ת': 22,
};
const HEB_FINALS = { 'ך':'כ', 'ם':'מ', 'ן':'נ', 'ף':'פ', 'ץ':'צ' };
const HYPHEN_RE = /[־–—\-]/g;
const LAYER_COLORS = {
	U: { light: 'hsl(210, 80%, 95%)', dark: 'hsl(210, 30%, 25%)', dot: 'hsl(210, 85%, 55%)' }, // blue
	T: { light: 'hsl(140, 70%, 94%)', dark: 'hsl(140, 30%, 22%)', dot: 'hsl(140, 65%, 45%)' }, // green
	H: { light: 'hsl(280, 75%, 95%)', dark: 'hsl(280, 25%, 28%)', dot: 'hsl(280, 70%, 60%)' }, // violet
};
const LAYER_PRIORITY = ['H','T','U'];
const COLOR_PALETTE = {
    red:    { light: 'text-red-500',    dark: 'dark:text-red-400',    name: 'אדום',   bg: 'bg-red-500',    swatch: '#ef4444' },
    yellow: { light: 'text-yellow-400', dark: 'dark:text-yellow-300', name: 'צהוב',   bg: 'bg-yellow-400', swatch: '#facc15' },
    green:  { light: 'text-green-500',  dark: 'dark:text-green-400',  name: 'ירוק',   bg: 'bg-green-500',  swatch: '#22c55e' },
    blue:   { light: 'text-blue-500',   dark: 'dark:text-blue-400',   name: 'כחול',   bg: 'bg-blue-500',   swatch: '#3b82f6' },
    pink:   { light: 'text-pink-500',   dark: 'dark:text-pink-400',   name: 'ורוד',   bg: 'bg-pink-500',   swatch: '#ec4899' },
    purple: { light: 'text-purple-500', dark: 'dark:text-purple-400', name: 'סגול',   bg: 'bg-purple-500', swatch: '#a855f7' },
    orange: { light: 'text-orange-500', dark: 'dark:text-orange-400', name: 'כתום',   bg: 'bg-orange-500', swatch: '#f97316' },
};
const DEFAULT_DR_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// --- Prime Number Logic ---
const MAX_SIEVE_SIZE = 20_000_000;
let sieveArr = new Uint8Array(256);
sieveArr[0] = 0; sieveArr[1] = 0;
for(let i=2; i<256; i++) sieveArr[i]=1;
for(let p=2; p*p<256; p++) { if(sieveArr[p]) { for(let i=p*p; i<256; i+=p) sieveArr[i]=0; } }

function growSieveTo(limit) {
    if (limit < sieveArr.length) return;
    if (limit > MAX_SIEVE_SIZE) return; 
    const target = Math.min(Math.max(limit, (sieveArr.length - 1) * 2), MAX_SIEVE_SIZE);
    
    const oldLen = sieveArr.length;
    const next = new Uint8Array(target + 1);
    next.set(sieveArr);
    next.fill(1, Math.max(2, oldLen));
    
    const sqrtTarget = Math.sqrt(target);
    for (let p = 2; p <= sqrtTarget; p++) {
        if (next[p] === 0) continue;
        let start = p * p;
        if (start < oldLen) start = Math.ceil(oldLen / p) * p;
        for (let i = start; i <= target; i += p) next[i] = 0;
    }
    sieveArr = next;
}

const isPrimeExpand = (num) => {
	if (num < 2) return false;
    if (num > MAX_SIEVE_SIZE) {
        if (num % 2 === 0) return false;
        const sqrt = Math.sqrt(num);
        for(let i = 3; i <= sqrt; i+=2) if (num % i === 0) return false;
        return true;
    }
	if (num >= sieveArr.length) growSieveTo(num);
	return sieveArr[num] === 1;
};

const getDigitalRoot = (n) => n === 0 ? 0 : 1 + ((n - 1) % 9);

// --- Logic Helpers ---
const layersMatching = (hovered, current) => {
	if (!hovered || !current) return [];
	const matches = new Set();
	if (hovered.units === current.units) matches.add('U');
	if (hovered.tens === current.tens) matches.add('T');
	if (hovered.hundreds === current.hundreds) matches.add('H');
	if (hovered.units === current.tens) matches.add('T');
	if (hovered.units === current.hundreds) matches.add('H');
	if (hovered.tens === current.units) matches.add('U');
	if (hovered.tens === current.hundreds) matches.add('H');
	if (hovered.hundreds === current.units) matches.add('U');
	if (hovered.hundreds === current.tens) matches.add('T');
	return Array.from(matches);
}

const strongestLayer = (matchLayers) => LAYER_PRIORITY.find(L => matchLayers.includes(L)) || null;

const LAYERS_U = Object.freeze(['U']);
const LAYERS_UT = Object.freeze(['U','T']);
const LAYERS_UTH = Object.freeze(['U','T','H']);
const availableLayers = (w) => {
	if (w.tens === w.units) return LAYERS_U;
	if (w.hundreds === w.tens) return LAYERS_UT;
	return LAYERS_UTH;
};

const topConnectionLayer = (source, target) => {
	if (!source || !target) return null;
	const hits = layersMatching(source, target);
	if (!hits.length) return null;
	const sourceLayers = [];
	if (source.units === target.units || source.units === target.tens || source.units === target.hundreds) sourceLayers.push('U');
	if (source.tens === target.units || source.tens === target.tens || source.tens === target.hundreds) sourceLayers.push('T');
	if (source.hundreds === target.units || source.hundreds === target.tens || source.hundreds === target.hundreds) sourceLayers.push('H');
	return strongestLayer(sourceLayers);
};

const buildLetterTable = (mode) => {
	const table = new Map();
	const letters = Object.keys(BASE_LETTER_VALUES);
	for (const ch of letters) {
		const m = BASE_LETTER_VALUES[ch]; 
		const n = m - 1; 
		let u, t, h;
		if (mode === 'aleph-zero') {
			u = n;
			t = n <= 9 ? n : 10 * (n - 9);
			if (n <= 10) h = n;
			else if (n <= 19) h = 10 * (n - 9);
			else h = 100 * (n - 18);
		} else { 
			u = m;
			if (m <= 10) { t = m; h = m; } 
			else {
				t = (m - 9) * 10;
				h = m <= 19 ? t : (m - 18) * 100;
			}
		}
		table.set(ch, { u, t, h });
	}
	for (const [f, baseCh] of Object.entries(HEB_FINALS)) {
		const r = table.get(baseCh);
		if (r) table.set(f, { ...r });
	}
	return table;
};

const letterDetailsCache = new Map();
const getLetterDetails = (word, letterTable) => {
	const modeKey = letterTable.get('א')?.u === 0 ? '0' : '1';
	const key = modeKey + '|' + word;
	const hit = letterDetailsCache.get(key);
	if (hit) return hit;
	const details = [];
	for (const ch of word) {
		const rec = letterTable.get(ch);
		if (rec) details.push({ char: ch, value: rec.u });
	}
	letterDetailsCache.set(key, details);
	return details;
};

const makeWordComputer = (letterTable) => {
	const cache = new Map();
    const computer = (rawWord) => {
		if (cache.has(rawWord)) return cache.get(rawWord);
		let u = 0, t = 0, h = 0;
		let builtWord = "";
        let maxU = -Infinity;

        const it = rawWord.normalize ? rawWord.normalize('NFKD') : rawWord;

		for (const ch of it) {
			const rec = letterTable.get(ch);
			if (!rec) continue; 
			builtWord += ch;
			u += rec.u; t += rec.t; h += rec.h;
            if (rec.u > maxU) maxU = rec.u;
		}

		if (builtWord.length === 0) { cache.set(rawWord, null); return null; }
		
        const dr = getDigitalRoot(u);
        const maxLayer = (maxU > 19) ? 'H' : (maxU > 10) ? 'T' : 'U';

		const res = {
			word: builtWord, 
			units: u, tens: t, hundreds: h, dr,
			isPrimeU: isPrimeExpand(u),
			isPrimeT: t !== u && isPrimeExpand(t),
			isPrimeH: h !== t && isPrimeExpand(h),
			maxLayer
		};
		cache.set(rawWord, res);
		return res;
	};
    computer.clear = () => cache.clear();
    return computer;
};

const memoizedComputers = {
	'aleph-zero': makeWordComputer(buildLetterTable('aleph-zero')),
	'aleph-one': makeWordComputer(buildLetterTable('aleph-one')),
};

function computeCoreResults(text, mode) {
    letterDetailsCache.clear();
    memoizedComputers[mode].clear();

	const lines = text.split('\n').filter(l => l.trim().length);
	const computeWord = memoizedComputers[mode];
	const allWordsMap = new Map();
	const primeSummary = [];
	const calculatedLines = [];
	const wordCounts = new Map();
	const drDistribution = new Uint32Array(10);
	
	let grandU = 0, grandT = 0, grandH = 0;
	let totalWordCount = 0;

	for (let li = 0; li < lines.length; li++) {
		const lineWithSpacesForHyphens = lines[li].replace(HYPHEN_RE, ' ');
		const words = lineWithSpacesForHyphens.split(/\s+/).filter(Boolean);
		let lineU = 0, lineT = 0, lineH = 0;
		const calcWords = [];
		let lineMaxLayer = 'U';

		for (const raw of words) {
			const wd = computeWord(raw);
			if (!wd) continue;
			totalWordCount++;
			calcWords.push(wd);
			lineU += wd.units; lineT += wd.tens; lineH += wd.hundreds;
			if (wd.maxLayer === 'H') lineMaxLayer = 'H';
			else if (wd.maxLayer === 'T' && lineMaxLayer !== 'H') lineMaxLayer = 'T';

			if (!allWordsMap.has(wd.word)) allWordsMap.set(wd.word, wd);
			drDistribution[wd.dr]++;
			wordCounts.set(wd.word, (wordCounts.get(wd.word) || 0) + 1);
		}
		grandU += lineU; grandT += lineT; grandH += lineH;
		
		growSieveTo(Math.max(lineU, lineT, lineH));
		const isPrimeLineU = isPrimeExpand(lineU);
		const isPrimeLineT = lineT !== lineU && isPrimeExpand(lineT);
		const isPrimeLineH = lineH !== lineT && isPrimeExpand(lineH);
		const linePrimes = {};
		if (isPrimeLineU) { if (!linePrimes[lineU]) linePrimes[lineU] = []; linePrimes[lineU].push('אחדות'); }
		if (isPrimeLineT) { if (!linePrimes[lineT]) linePrimes[lineT] = []; linePrimes[lineT].push('עשרות'); }
		if (isPrimeLineH) { if (!linePrimes[lineH]) linePrimes[lineH] = []; linePrimes[lineH].push('מאות'); }
		for (const [value, layers] of Object.entries(linePrimes)) {
				primeSummary.push({ line: li + 1, value: parseInt(value), layers });
		}

		calculatedLines.push({
			lineText: lines[li],
			words: calcWords,
			totals: { units: lineU, tens: lineT, hundreds: lineH },
			totalsDR: getDigitalRoot(lineU),
			isPrimeTotals: { U: isPrimeLineU, T: isPrimeLineT, H: isPrimeLineH },
			lineMaxLayer
		});
	}
	growSieveTo(Math.max(grandU, grandT, grandH));
	const grandTotals = {
		units: grandU, tens: grandT, hundreds: grandH,
		dr: getDigitalRoot(grandU),
		isPrime: { U: isPrimeExpand(grandU), T: isPrimeExpand(grandT), H: isPrimeExpand(grandH) },
	};
	return {
		lines: calculatedLines, grandTotals, primeSummary,
		allWords: Array.from(allWordsMap.values()),
        wordDataMap: allWordsMap,
		drDistribution, totalWordCount, wordCounts
	};
}

// --- Helper for Filtering ---
const isValueVisible = (layer, isPrime, filters) => {
    // 1. Is the layer enabled?
    if (!filters[layer]) return false;
    // 2. If "Prime Only" is on, is it prime?
    if (filters.Prime && !isPrime) return false;
    return true;
};

const getWordValues = ({ hundreds, tens, units, isPrimeH, isPrimeT, isPrimeU }) => {
    const out = [];
    if (hundreds !== tens) out.push({ value: hundreds, isPrime: isPrimeH, layer: 'H' });
    if (tens !== units)       out.push({ value: tens,      isPrime: isPrimeT, layer: 'T' });
    out.push({ value: units, isPrime: isPrimeU, layer: 'U' });
    return out;
};

// Returns true if the word has AT LEAST ONE value visible under current filters
const isWordVisible = (word, filters) => {
    const values = getWordValues(word);
    return values.some(v => isValueVisible(v.layer, v.isPrime, filters));
};

// --- Application State ---
const AppContext = createContext(null);
const AppDispatchContext = createContext(null);

const initialState = {
	text: "",
	coreResults: null,
	selectedDR: null,
	isDarkMode: false,
	searchTerm: '',
	isValueTableOpen: false,
	isValueTablePinned: false,
	mode: 'aleph-zero',
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
		case 'SET_TEXT': return { ...state, text: action.payload, pinnedWord: null, selectedDR: null };
		case 'SET_CORE_RESULTS': return { ...state, coreResults: action.payload };
		case 'SET_DARK_MODE': return { ...state, isDarkMode: action.payload };
		case 'SET_VIEW': return { ...state, view: action.payload, pinnedWord: null, hoveredWord: null, searchTerm: '', selectedDR: null, selectedHotValue: null, hotWordsList: [], isPrimesCollapsed: true, copiedId: null, isValueTableOpen: false };
		case 'SET_MODE': return { ...state, mode: action.payload, pinnedWord: null, coreResults: null, selectedDR: null, searchTerm: '' };
		case 'SET_SEARCH_TERM': return { ...state, searchTerm: action.payload, pinnedWord: null, selectedDR: null };
		case 'SET_HOVERED_WORD': return { ...state, hoveredWord: action.payload };
		case 'SET_PINNED_WORD': return { ...state, pinnedWord: state.pinnedWord && state.pinnedWord.word === action.payload.word ? null : action.payload };
		case 'UNPIN_WORD': return { ...state, pinnedWord: null, hoveredWord: null };
		case 'SET_SELECTED_DR': return { ...state, selectedDR: state.selectedDR === action.payload ? null : action.payload, pinnedWord: null, searchTerm: '' };
		case 'SET_COPIED_ID': return { ...state, copiedId: action.payload };
		case 'TOGGLE_VALUE_TABLE': return { ...state, isValueTableOpen: !state.isValueTableOpen };
		case 'TOGGLE_VALUE_TABLE_PIN': return { ...state, isValueTablePinned: !state.isValueTablePinned, isValueTableOpen: true };
		case 'SET_VALUE_TABLE_OPEN': return { ...state, isValueTableOpen: action.payload };
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
			const allExpanded = {}; state.coreResults.lines.forEach((_, index) => { allExpanded[index] = true; });
			return { ...state, expandedRows: allExpanded };
		case 'SET_PRIME_COLOR': return { ...state, primeColor: action.payload };
		case 'SET_SELECTED_HOT_VALUE': return { ...state, selectedHotValue: action.payload.value, hotWordsList: action.payload.list };
		case 'CLEAR_SELECTED_HOT_VALUE': return { ...state, selectedHotValue: null, hotWordsList: [] };
        case 'TOGGLE_FILTER':
            return { ...state, filters: { ...state.filters, [action.payload]: !state.filters[action.payload] } };
		default: throw new Error(`Unhandled action type: ${action.type}`);
	}
}

// --- Icons & Graphics ---
const ICONS = {
		sun: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
		moon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
		hash: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>,
		copy: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
		check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
		grid: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>,
		network: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>,
		'chevron-down': <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
		'bar-chart': <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>,
		'arrow-up': <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
};
const Icon = React.memo(({ name, className }) => <div className={className}>{ICONS[name]}</div>);

const Legend = React.memo(() => {
    const { primeColor, filters } = useContext(AppContext);
    const dispatch = useContext(AppDispatchContext);
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
        dispatch({ type: 'TOGGLE_FILTER', payload: filterKey });
    };

    const primeColorClasses = COLOR_PALETTE[primeColor];
    
    const getFilterStyle = (key, baseClass = "") => {
        const isActive = filters[key];
        const activeClass = "bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-500 shadow-inner text-gray-900 dark:text-white";
        const inactiveClass = "opacity-80 text-gray-700 dark:text-gray-200 hover:opacity-100";
        return `cursor-pointer transition-all duration-200 border-2 border-transparent rounded-full px-2 py-0.5 select-none ${isActive ? activeClass : inactiveClass} ${baseClass}`;
    };

    return (
        <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <div className="flex items-center gap-2 text-base text-gray-900 dark:text-gray-50 bg-white/90 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-full shadow-md backdrop-blur">
                 <button onClick={() => toggleFilter('Prime')} className={getFilterStyle('Prime', 'flex items-center gap-2')}>
                    <span className={`text-lg font-bold ${primeColorClasses.light} ${primeColorClasses.dark}`}>♢</span>
                    <span>ראשוני</span>
                 </button>
                 <div className="w-px h-4 bg-gray-400 mx-1"></div>
                 <button onClick={() => toggleFilter('U')} className={getFilterStyle('U', 'flex items-center gap-2')}>
                    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3"><path d="M7 1L1 11H13L7 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
                    <span>אחדות</span>
                 </button>
                 <button onClick={() => toggleFilter('T')} className={getFilterStyle('T', 'flex items-center gap-2')}>
                    <div className="w-3 h-3 border-2 border-current"></div>
                    <span>עשרות</span>
                 </button>
                 <button onClick={() => toggleFilter('H')} className={getFilterStyle('H', 'flex items-center gap-2')}>
                    <div className="w-3 h-3 rounded-full border-2 border-current"></div>
                    <span>מאות</span>
                 </button>
            </div>
            {isColorPickerOpen && (
                <div className="absolute top-1/2 left-full -translate-y-1/2 ml-4 z-20 pointer-events-auto">
                    <div className="relative w-28 h-28">
                        {(() => {
                            const centralColorKey = 'yellow';
                            const circularColors = Object.entries(COLOR_PALETTE).filter(([key]) => key !== centralColorKey);
                            const centralColor = COLOR_PALETTE[centralColorKey];
                            const radius = 36; const angleStep = (2 * Math.PI) / circularColors.length;
                            return (
                                <>
                                    <button
                                        key={centralColorKey}
                                        onClick={() => handleColorSelection(centralColorKey)}
                                        className={`absolute w-8 h-8 rounded-full transition-transform hover:scale-125 focus:outline-none shadow-lg ring-2 ring-white dark:ring-gray-800`}
                                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: centralColor.swatch }}
                                        aria-label={`Select ${centralColorKey} color`}
                                    />
                                    {circularColors.map(([key, { bg }], index) => {
                                        const angle = angleStep * index - (Math.PI / 2);
                                        const x = radius * Math.cos(angle); const y = radius * Math.sin(angle);
                                        const color = COLOR_PALETTE[key];
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => handleColorSelection(key)}
                                                className="absolute w-7 h-7 rounded-full transition-transform hover:scale-125 focus:outline-none shadow-lg ring-2 ring-white dark:ring-gray-800"
                                                style={{ top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: 'translate(-50%, -50%)', backgroundColor: color.swatch }}
                                                aria-label={`Select ${key} color`}
                                            />
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
});

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
	`}</style>
);

const VirtualizedList = React.memo(({ items, itemHeight, listHeight, renderItem, getKey }) => {
	const [scrollTop, setScrollTop] = useState(0);
	const rafId = useRef(null);
	const handleScroll = (e) => {
		const y = e.currentTarget.scrollTop;
		if (rafId.current) cancelAnimationFrame(rafId.current);
		rafId.current = requestAnimationFrame(() => setScrollTop(y));
	};
	useEffect(() => () => { if (rafId.current) cancelAnimationFrame(rafId.current); }, []);
	const startIndex = Math.floor(scrollTop / itemHeight);
	const visibleCount = Math.ceil(listHeight / itemHeight) + 2;
	const endIndex = Math.min(startIndex + visibleCount, items.length);
	const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);
	const totalHeight = items.length * itemHeight;
	const offsetY = startIndex * itemHeight;
	return (
		<div onScroll={handleScroll} style={{ height: listHeight, overflowY: 'auto', position: 'relative' }}>
			<div style={{ height: totalHeight }}>
				<div style={{ transform: `translateY(${offsetY}px)` }}>
					{visibleItems.map((item, idx) => (
						<div key={getKey ? getKey(item) : (item?.value ?? item?.word ?? (startIndex + idx))}>
							{renderItem(item)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
});

const ValueCell = memo(({ value, isPrimeFlag, previousValue, layer, isApplicable = true, primeColor, filters }) => {
    // If column should not be shown, logic handled by parent (table structure)
    // But for safety/reuse:
    const isVisible = isValueVisible(layer, isPrimeFlag, filters);
    
    const primeColorClasses = COLOR_PALETTE[primeColor];
    const className = `px-4 py-3 text-center tabular-nums ${isPrimeFlag ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-700 dark:text-gray-300'}`;
    
    if (!isApplicable) return <td className={className}>-</td>;
    // If not visible due to filters, we render nothing or empty cell if parent insists on rendering
    if (!isVisible) return <td className={className}></td>; 
    
    if (value === previousValue) return <td className={className}>〃</td>;
    return <td className={className}>{value} {isPrimeFlag && <span className="mr-1" title="ראשוני">♢</span>}</td>;
});

const TotalNumberDisplay = memo(({ value, isPrimeFlag, primeColor, layer, filters }) => {
    const isVisible = isValueVisible(layer, isPrimeFlag, filters);
    const primeColorClasses = COLOR_PALETTE[primeColor];
    
    if (!isVisible) {
         return <p className="text-3xl font-bold text-gray-300 dark:text-gray-600">-</p>;
    }
    return <p className={`text-3xl font-bold ${isPrimeFlag ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-800 dark:text-gray-200'}`}>{value} {isPrimeFlag && <span className="mr-2 text-xl">♢</span>}</p>;
});

const WordValuesDisplay = memo(({ wordData, isDarkMode, matches, connectionValues, hoveredWord, primeColor }) => {
    const { filters } = useContext(AppContext);
    const primeColorClasses = COLOR_PALETTE[primeColor];
    const values = getWordValues(wordData);
    const baseBorder = isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(31,41,55,0.60)';
    
    return (
        <div className={`grid grid-flow-col auto-cols-max gap-x-2 text-xs font-mono tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {values.map((v, i) => {
                const L = v.layer;
                const isVisible = isValueVisible(L, v.isPrime, filters);
                if (!isVisible) return null;

                const isHit = hoveredWord && connectionValues.has(v.value) && matches.includes(L);
                let dotColor = null;
                if (isHit) {
                    const sourceMatchingLayers = [];
                    if (hoveredWord.units === v.value) sourceMatchingLayers.push('U');
                    if (hoveredWord.tens === v.value) sourceMatchingLayers.push('T');
                    if (hoveredWord.hundreds === v.value) sourceMatchingLayers.push('H');
                    const topSourceLayer = strongestLayer(sourceMatchingLayers);
                    if (topSourceLayer) dotColor = LAYER_COLORS[topSourceLayer].dot;
                }
                let symbol;
                if (L === 'U') symbol = <svg width="14" height="12" viewBox="0 0 14 12" fill={dotColor || 'transparent'} xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3"><path d="M7 1L1 11H13L7 1Z" stroke={dotColor || baseBorder} strokeWidth="2" strokeLinejoin="round"/></svg>;
                else if (L === 'T') symbol = <div className="w-3 h-3 border-2" style={{ borderColor: dotColor || baseBorder, background: dotColor || 'transparent' }}></div>;
                else symbol = <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: dotColor || baseBorder, background: dotColor || 'transparent' }}></div>;

                return (
                    <div key={i} className="flex flex-col items-center">
                        <span className={v.isPrime ? `${primeColorClasses.light} ${primeColorClasses.dark}` : ''}>{v.value}{v.isPrime && '♢'}</span>
                        <div className="mt-0.5 flex items-center justify-center h-3 w-3.5">{symbol}</div>
                    </div>
                );
            })}
        </div>
    );
});

const CopyButton = ({ getData, id, label = "העתק" }) => {
    const { copiedId } = useContext(AppContext);
    const dispatch = useContext(AppDispatchContext);
    const [isCopying, setIsCopying] = useState(false);

    const handleCopy = async () => {
        setIsCopying(true);
        await new Promise(resolve => setTimeout(resolve, 10)); 

        try {
            const text = getData();
            if (!text || text.trim().length === 0) throw new Error("No visible text generated based on current filters");
            let success = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try { await navigator.clipboard.writeText(text); success = true; } catch (err) { console.warn("Clipboard API failed", err); }
            }
            if (!success) {
                const ta = document.createElement("textarea");
                ta.value = text;
                Object.assign(ta.style, { position: 'fixed', left: '-9999px', top: '0' });
                document.body.appendChild(ta);
                ta.focus(); ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                success = true;
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

    return (
        <button 
            onClick={handleCopy} 
            disabled={isCopying}
            className={`bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${isCopying ? 'opacity-50 cursor-wait' : ''}`}
        >
            {copiedId === id ? <Icon name="check" className="w-4 h-4" /> : <Icon name="copy" className="w-4 h-4" />}
            {isCopying ? "מעתיק..." : label}
        </button>
    );
};

const StatsPanel = memo(() => {
    const { stats, isStatsCollapsed, isDarkMode, connectionValues } = useContext(AppContext);
    const dispatch = useContext(AppDispatchContext);
    if (!stats) return null;

    const colorClasses = {
        blue:	{ boxLight: 'bg-blue-50 border-blue-200', text: 'text-blue-800', boxDark: 'bg-gray-700/50 border-blue-800' },
        indigo: { boxLight: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', boxDark: 'bg-gray-700/50 border-indigo-800' },
        purple: { boxLight: 'bg-purple-50 border-purple-200', text: 'text-purple-800', boxDark: 'bg-gray-700/50 border-purple-800' },
        emerald:{ boxLight: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', boxDark: 'bg-gray-700/50 border-emerald-800' },
        pink:	{ boxLight: 'bg-pink-50 border-pink-200', text: 'text-pink-800', boxDark: 'bg-gray-700/50 border-pink-800' },
    };

    return (
        <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
            <button onClick={() => dispatch({ type: 'TOGGLE_STATS_COLLAPSED' })} className="w-full flex justify-between items-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                <div className="flex-1"></div>
                <span className="text-center flex-grow">ניתוח סטטיסטי</span>
                <div className="flex-1 flex justify-end"><Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isStatsCollapsed ? '' : 'rotate-180'}`} /></div>
            </button>
            {!isStatsCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center my-6">
                    {[{label: 'סה"כ שורות', value: stats.totalLines, color: 'blue'}, {label: 'סה"כ מילים', value: stats.totalWords, color: 'indigo'}, {label: 'מילים ייחודיות', value: stats.uniqueWords, color: 'purple'}, {label: 'שורות ראשוניות', value: stats.primeLineTotals, color: 'emerald'}, {label: 'קבוצות קשרים', value: connectionValues.size, color: 'pink'}].map(item => {
                        const cls = colorClasses[item.color];
                        return (
                            <div key={item.label} className={`p-4 rounded-lg border ${isDarkMode ? cls.boxDark : cls.boxLight}`}>
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

const WordCard = memo(({ wordData, activeWord, isDarkMode, primeColor, connectionValues, dispatch }) => {
    const isSelf = activeWord && activeWord.word === wordData.word;
    const topLayer = activeWord ? topConnectionLayer(activeWord, wordData) : null;
    const matches = activeWord ? layersMatching(activeWord, wordData).filter(L => availableLayers(wordData).includes(L)) : [];
    
    const baseBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const tint = !isSelf && topLayer ? (isDarkMode ? LAYER_COLORS[topLayer].dark : LAYER_COLORS[topLayer].light) : baseBg;
    
    const cardStyle = {
        background: tint,
        opacity: activeWord && !topLayer && !isSelf ? 0.35 : 1,
        border: isSelf ? `2px solid ${LAYER_COLORS['H'].dot}` : '2px solid transparent',
        cursor: 'pointer'
    };

    const handleClick = (e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_PINNED_WORD', payload: wordData });
    };

    const handleMouseEnter = () => dispatch({ type: 'SET_HOVERED_WORD', payload: wordData });
    const handleMouseLeave = () => dispatch({ type: 'SET_HOVERED_WORD', payload: null });

    return (
        <div
            className="p-2 rounded-lg text-center transition-all duration-200"
            style={cardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            role="button"
            tabIndex={0}
        >
            <div className={`font-bold text-xl break-all ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{wordData.word}</div>
            <WordValuesDisplay wordData={wordData} isDarkMode={isDarkMode} matches={matches} connectionValues={connectionValues} hoveredWord={activeWord} primeColor={primeColor}/>
        </div>
    );
}, (prev, next) => {
    if (prev.wordData !== next.wordData) return false;
    if (prev.isDarkMode !== next.isDarkMode) return false;
    if (prev.primeColor !== next.primeColor) return false;
    const prevActive = prev.activeWord;
    const nextActive = next.activeWord;
    if (prevActive === nextActive) return true;
    if (!prevActive && !nextActive) return true;
    if (!prevActive || !nextActive) return false;
    return prevActive.word === nextActive.word;
});

const ClusterView = memo(({ clusterRefs, unpinOnBackgroundClick, filteredWordsInView, pinnedWord, hoveredWord, isDarkMode, primeColor, connectionValues, dispatch, copySummaryToClipboard, copiedId, searchTerm }) => {
    const activeWord = pinnedWord || hoveredWord;
    
    return (
        <div className={`p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`} onClick={unpinOnBackgroundClick}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex-1 flex justify-start">
                    <CopyButton getData={copySummaryToClipboard} id='summary' />
                </div>
                <div className="relative group text-center flex-grow">
                    <h2 className="text-2xl font-bold inline-block">קבוצות לפי שורש דיגיטלי (ש"ד)</h2>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        שורש דיגיטלי של מספר הוא הספרה הבודדת שמתקבלת כשמחברים שוב ושוב את ספרותיו עד שנותרת ספרה אחת.
                    </div>
                </div>
                 <div className="flex-1"></div>
            </div>
            <div className="mb-4">
                <input dir="rtl" type="text" placeholder="חפש מילה או מספר..." value={searchTerm} onChange={(e) => dispatch({ type: 'SET_SEARCH_TERM', payload: e.target.value })} className={`w-full p-2 border rounded-md text-right ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
            </div>
            <div className="space-y-6">
                {filteredWordsInView.map(({ dr, words }) => (
                    <div
                        key={dr}
                        ref={el => (clusterRefs.current[dr] = el)}
                        className={`p-4 rounded-lg border transition-shadow ${isDarkMode ? 'bg-gray-800/50 border-purple-800' : 'bg-white'}`}
                        onClick={unpinOnBackgroundClick}
                    >
                        <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3 text-center">ש"ד {dr} ({words.length} מילים)</h3>
                        <div className="flex flex-wrap justify-start gap-2" onClick={unpinOnBackgroundClick}>
                            {words.map((wordData, index) => (
                                <WordCard 
                                    key={wordData.word}
                                    wordData={wordData}
                                    activeWord={activeWord}
                                    isDarkMode={isDarkMode}
                                    primeColor={primeColor}
                                    connectionValues={connectionValues}
                                    dispatch={dispatch}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

// --- Main App ---

const App = () => {
    const state = useContext(AppContext);
    const dispatch = useContext(AppDispatchContext);
    const {
        text, coreResults, selectedDR, isDarkMode, searchTerm, isValueTableOpen, isValueTablePinned,
        mode, copiedId, view, hoveredWord, isPrimesCollapsed, pinnedWord, selectedHotValue,
        hotWordsList, isStatsCollapsed, showScrollTop, hotView, detailsView, hotSort,
        expandedRows, primeColor,
        stats, connectionValues, valueToWordsMap, filters,
        isPending 
    } = state;

    const clusterRefs = useRef({});
    const valueTableRef = useRef(null);
    const valueTableButtonRef = useRef(null);
    
    const letterTable = useMemo(() => buildLetterTable(mode), [mode]);

    useLayoutEffect(() => {
        if (view !== 'clusters' || !selectedDR) return;
        const el = clusterRefs.current[selectedDR];
        if (!el) return;
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }, [selectedDR, view]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (isValueTableOpen) {
                if (valueTableButtonRef.current && valueTableButtonRef.current.contains(event.target)) return;
                if (valueTableRef.current && !valueTableRef.current.contains(event.target)) {
                    dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: false });
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isValueTableOpen, dispatch]);

    useEffect(() => {
        const checkScrollTop = () => {
            const shouldShow = window.pageYOffset > 300;
            if (showScrollTop !== shouldShow) dispatch({ type: 'SET_SHOW_SCROLL_TOP', payload: shouldShow });
        };
        window.addEventListener('scroll', checkScrollTop);
        return () => window.removeEventListener('scroll', checkScrollTop);
    }, [showScrollTop, dispatch]);

    useEffect(() => {
        const savedText = localStorage.getItem('alephCodeText');
        if (savedText) dispatch({ type: 'SET_TEXT', payload: savedText });
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) dispatch({ type: 'SET_DARK_MODE', payload: true });
    }, [dispatch]);
    
    useEffect(() => { localStorage.setItem('alephCodeText', text); }, [text]);
    useEffect(() => { document.body.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

    const drClusters = useMemo(() => {
        if (!coreResults || view !== 'clusters') return {};
        const clusters = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, []]));
        coreResults.allWords.forEach(wd => {
            if (wd.dr > 0) clusters[wd.dr].push(wd);
        });
        for (const k in clusters) {
            clusters[k].sort((a, b) => {
                if (a.units !== b.units) return a.units - b.units;
                if (a.tens !== b.tens) return a.tens - b.tens;
                return a.hundreds - b.hundreds;
            });
        }
        return clusters;
    }, [coreResults, view]);

    const hotValuesList = useMemo(() => {
        if (!valueToWordsMap) return [];
        const arr = [];
        for (const [value, words] of valueToWordsMap.entries()) {
            // Apply filtering here too? The user asked for lists to filter out bad words.
            const visibleWords = words.filter(w => isWordVisible(w, filters));
            if (visibleWords.length > 0) {
                 const uniqueWordsCount = new Set(visibleWords.map(w => w.word)).size;
                 arr.push({ value, count: uniqueWordsCount });
            }
        }
        return arr;
    }, [valueToWordsMap, filters]);

    const sortedWordCounts = useMemo(() => {
        if (!coreResults || !coreResults.wordCounts) return [];
        // Only include words that are visible
        // Optimized O(1) lookup
        const wordMap = coreResults.wordDataMap;
        return Array.from(coreResults.wordCounts.entries())
            .filter(([word]) => {
                 const wordData = wordMap.get(word);
                 return wordData && isWordVisible(wordData, filters);
            })
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count);
    }, [coreResults, filters]);

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

    const filteredWordsInView = useMemo(() => {
        if (view !== 'clusters' || !drClusters) return [];
        const allWordsInClusters = Object.entries(drClusters)
            .filter(([dr]) => selectedDR === null || selectedDR === parseInt(dr))
            .flatMap(([, words]) => words);

        let filteredWords = allWordsInClusters;

        // Apply Search
        if (searchTerm.trim()) {
            const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t);
            filteredWords = filteredWords.filter(w => {
                return searchTerms.some(term => {
                    const isNumericTerm = /^\d+$/.test(term);
                    if (isNumericTerm) {
                        const num = parseInt(term, 10);
                        return w.units === num || w.tens === num || w.hundreds === num;
                    } else return w.word.toLowerCase().includes(term);
                });
            });
        }
        
        // Apply Visibility Filter
        filteredWords = filteredWords.filter(w => isWordVisible(w, filters));

        const regrouped = {};
        filteredWords.forEach(word => {
            if (!regrouped[word.dr]) regrouped[word.dr] = [];
            regrouped[word.dr].push(word);
        });
        return Object.entries(regrouped).map(([dr, words]) => ({ dr, words }));
    }, [drClusters, view, searchTerm, selectedDR, filters]);

    const getPinnedRelevantWords = useCallback(() => {
            if (!pinnedWord || view !== 'clusters' || !drClusters) return null;
            const relevantWords = [pinnedWord];
            // Filter global list for relevancy
            Object.values(drClusters).flat().forEach(wordData => {
                 if (wordData.word !== pinnedWord.word && topConnectionLayer(pinnedWord, wordData)) {
                     // Check if this connected word is visible
                     if (isWordVisible(wordData, filters)) relevantWords.push(wordData);
                 }
            });
            return relevantWords;
    }, [pinnedWord, view, drClusters, filters]);
    
    // --- Data Preparation for Clipboard ---
    const prepareAllDetailsText = useCallback(() => {
        if (!coreResults || !stats) return "";
        const primeMarker = (isPrime) => isPrime ? " ♢" : "";
        const modeText = `מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}`;
        const lines = [
            `${modeText}\n===================\n`,
            "ניתוח סטטיסטי\n-------------------\n",
            `סה"כ שורות: ${stats.totalLines}`,
            `סה"כ מילים: ${stats.totalWords}`,
            `מילים ייחודיות: ${stats.uniqueWords}`,
            `שורות ראשוניות: ${stats.primeLineTotals}`,
            `קבוצות קשרים: ${connectionValues.size || 0}\n`,
            "סיכום כללי (מסונן לפי מקרא)\n-------------------\n"
        ];
        
        if (isValueVisible('U', coreResults.grandTotals.isPrime.U, filters)) lines.push(`סה"כ אחדות: ${coreResults.grandTotals.units}${primeMarker(coreResults.grandTotals.isPrime.U)}`);
        if (coreResults.grandTotals.tens !== coreResults.grandTotals.units && isValueVisible('T', coreResults.grandTotals.isPrime.T, filters)) lines.push(`סה"כ עשרות: ${coreResults.grandTotals.tens}${primeMarker(coreResults.grandTotals.isPrime.T)}`);
        if (coreResults.grandTotals.hundreds !== coreResults.grandTotals.tens && isValueVisible('H', coreResults.grandTotals.isPrime.H, filters)) lines.push(`סה"כ מאות: ${coreResults.grandTotals.hundreds}${primeMarker(coreResults.grandTotals.isPrime.H)}`);
        
        lines.push(`ש"ד כללי: ${coreResults.grandTotals.dr}\n`);
        lines.push("פירוט שורות\n-------------------\n");

        coreResults.lines.forEach((line, index) => {
            // Check if any word in this line is visible
            const visibleWords = line.words.filter(w => isWordVisible(w, filters));
            
            // If no words are visible, maybe skip line or show empty? 
            // Usually skip if strictly filtering.
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
            
            const lineValues = [];
            if (isValueVisible('U', line.isPrimeTotals.U, filters)) lineValues.push(`אחדות=${line.totals.units}${primeMarker(line.isPrimeTotals.U)}`);
            if (line.lineMaxLayer !== 'U' && line.totals.tens !== line.totals.units && isValueVisible('T', line.isPrimeTotals.T, filters)) lineValues.push(`עשרות=${line.totals.tens}${primeMarker(line.isPrimeTotals.T)}`);
            if (line.lineMaxLayer === 'H' && line.totals.hundreds !== line.totals.tens && isValueVisible('H', line.isPrimeTotals.H, filters)) lineValues.push(`מאות=${line.totals.hundreds}${primeMarker(line.isPrimeTotals.H)}`);
            
            lineValues.push(`ש"ד=${line.totalsDR}`);
            lines.push(`  סה"כ שורה: ${lineValues.join(', ')}`);
        });

        if (coreResults.primeSummary.length > 0) {
            lines.push(`\n\nסיכום ראשוניים מסכומי השורות\n---------------------------\n`);
            coreResults.primeSummary.forEach(p => {
                 const layers = p.layers.map(l => l === 'אחדות' ? 'U' : l === 'עשרות' ? 'T' : 'H');
                 if (layers.some(l => filters[l])) {
                     lines.push(`שורה ${p.line}: ${p.value} (שכבת ${p.layers.join(', ')})`);
                 }
            });
        }
        return lines.filter(Boolean).join('\n');
    }, [coreResults, stats, mode, connectionValues, letterTable, filters]);

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
            if (selectedDR) lines.push(`סיכום קיבוץ שורש דיגיטלי ${selectedDR}\n==============================\n`);
            else if (searchTerm) lines.push(`סיכום תוצאות חיפוש "${searchTerm}"\n==============================\n`);
            else lines.push(`סיכום כללי - קיבוץ לפי שורש דיגיטלי\n==============================\n`);
            
            filteredWordsInView.forEach(({ dr, words }) => {
                const visibleWords = words.map(formatWord).filter(Boolean);
                if (visibleWords.length > 0) {
                    if (!selectedDR) lines.push(`\nש"ד ${dr} (${visibleWords.length} מילים)\n---------------------------\n`);
                    visibleWords.forEach(line => lines.push(line));
                }
            });
        }
        return lines.join('\n');
    }, [coreResults, mode, view, pinnedWord, getPinnedRelevantWords, selectedDR, searchTerm, filteredWordsInView, filters]);

    const prepareHotWordsText = useCallback(() => {
        if (!coreResults || selectedHotValue === null) return "";
        const primeU = (w) => w.isPrimeU ? " ♢" : "";
        const lines = [
            `מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}\n===================\n`,
            `מילים עם הערך ${selectedHotValue}\n-------------------\n`
        ];
        
        // Filter hot words list by visibility
        const visibleHotWords = hotWordsList.filter(w => isWordVisible(w, filters));
        
        visibleHotWords.forEach(w => {
            let parts = [];
            if(isValueVisible('U', w.isPrimeU, filters)) parts.push(`אחדות: ${w.units}${primeU(w)}`);
            if (w.tens !== w.units && isValueVisible('T', w.isPrimeT, filters)) parts.push(`עשרות: ${w.tens}${w.isPrimeT ? " ♢" : ""}`);
            if (w.hundreds !== w.tens && isValueVisible('H', w.isPrimeH, filters)) parts.push(`מאות: ${w.hundreds}${w.isPrimeH ? " ♢" : ""}`);
            const valuesString = parts.join(' | ');
            
            lines.push(`${w.word} | ${valuesString} | ש"ד: ${w.dr}`);
        });
        return lines.join('\n');
    }, [coreResults, selectedHotValue, mode, hotWordsList, filters]);

    const prepareFrequenciesText = useCallback(() => {
        if (!coreResults) return "";
        const lines = [`מצב חישוב: ${mode === 'aleph-zero' ? 'א:0' : 'א:1'}\n===================\n`];
        if (hotView === 'values') {
            lines.push("סיכום שכיחות ערכים\n-------------------\n");
            const sortedValues = Array.from(valueToWordsMap.keys()).sort((a, b) => a - b);
            sortedValues.forEach(value => {
                const words = [...new Set((valueToWordsMap.get(value) || []).filter(w => isWordVisible(w, filters)).map(w => w.word))].join(', ');
                if (words.length > 0) lines.push(`ערך: ${value}\nמילים: ${words}\n`);
            });
        } else {
            lines.push("סיכום שכיחות מילים\n-------------------\n");
            sortedWordCounts.forEach(({ word, count }) => lines.push(`מילה: ${word}, שכיחות: ${count}`));
        }
        return lines.join('\n');
    }, [coreResults, mode, hotView, valueToWordsMap, sortedWordCounts, filters]);

    // --- Event Handlers ---
    const handleTableIconEnter = () => dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: true });
    const handleTableIconLeave = () => !isValueTablePinned && dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: false });
    const handleTableIconClick = () => dispatch({ type: 'TOGGLE_VALUE_TABLE_PIN' });
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const handleModeChange = (newMode) => dispatch({ type: 'SET_MODE', payload: newMode });
    
    // Updated Drill Down Handler with Toggle Logic
    const handleDrillDown = useCallback((dr) => {
        if (view !== 'clusters') {
            dispatch({ type: 'SET_VIEW', payload: 'clusters' });
        }
        dispatch({ type: 'SET_SELECTED_DR', payload: dr });
    }, [dispatch, view]);

    const handleWordClick = useCallback((wordData) => dispatch({ type: 'SET_PINNED_WORD', payload: wordData }), [dispatch]);
    const handleViewChange = useCallback((newView) => dispatch({ type: 'SET_VIEW', payload: newView }), [dispatch]);
    const unpinOnBackgroundClick = useCallback((e) => { if (e.target === e.currentTarget) { e.stopPropagation(); dispatch({ type: 'UNPIN_WORD' }); } }, [dispatch]);

    return (
        <div dir="rtl" className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-gray-50 to-blue-50 text-gray-800'}`}>
            <GlobalStyles />
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div className="text-right">
                        <h1 className="text-5xl font-bold bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{mode === 'aleph-zero' ? 'מצב א:0' : 'מצב א:1'}</h1>
                        <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Aleph Code Calculator</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Legend />
                        <div className="relative" onMouseEnter={handleTableIconEnter} onMouseLeave={handleTableIconLeave}>
                            <button ref={valueTableButtonRef} onClick={handleTableIconClick} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" aria-label="הצג טבלת ערכי אותיות">
                                <Icon name="hash" className="w-5 h-5 text-purple-600"/>
                            </button>
                        </div>
                        <button onClick={() => dispatch({ type: 'SET_DARK_MODE', payload: !isDarkMode })} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            {isDarkMode ? <Icon name="sun" className="w-5 h-5 text-yellow-400"/> : <Icon name="moon" className="w-5 h-5 text-blue-600"/>}
                        </button>
                    </div>
                </header>

                {isValueTableOpen && (
                    <div ref={valueTableRef} className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h2 className="text-2xl font-bold mb-4 text-center">טבלת ערכי אותיות ({mode === 'aleph-zero' ? 'א:0' : 'א:1'})</h2>
                        <div className="flex justify-center gap-8">
                            { [0, 11].map(offset => (
                                <table key={offset} className="text-center w-full max-w-xs"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                                    <tr>{['אות', 'אחדות', 'עשרות', 'מאות'].map(header => <th key={header} className="p-2 font-semibold">{header}</th>)}</tr>
                                </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {Object.keys(BASE_LETTER_VALUES).slice(offset, offset + 11).map(letter => {
                                        const rec = letterTable.get(letter);
                                        const finalForm = Object.keys(HEB_FINALS).find(key => HEB_FINALS[key] === letter);
                                        if (!rec) return null;
                                        return (
                                        <tr key={letter} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
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

                    <div className={`p-6 rounded-xl border mb-8 transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                                <button onClick={() => handleModeChange('aleph-zero')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${mode === 'aleph-zero' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>א:0</button>
                                <button onClick={() => handleModeChange('aleph-one')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${mode === 'aleph-one' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>א:1</button>
                            </div>
                        </div>
                        <textarea dir="rtl" id="text-input" className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-blue-500 transition duration-150 text-lg leading-7 text-right ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'}`} rows="5" value={text} onChange={(e) => dispatch({ type: 'SET_TEXT', payload: e.target.value })} placeholder="הזן טקסט לניתוח"></textarea>
                        <div className="mt-4 flex justify-center items-center gap-4 h-5">
                            {isPending && <span className="text-sm text-gray-500 dark:text-gray-400">מחשב...</span>}
                        </div>
                    </div>

                    <div className="flex justify-center my-8">
                        <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                            <button onClick={() => handleViewChange('lines')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-200 ${view === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}><Icon name="grid" className="w-4 h-4" />פירוט</button>
                            <button onClick={() => handleViewChange('clusters')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-200 ${view === 'clusters' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}><Icon name="network" className="w-4 h-4" />קבוצות</button>
                            <button onClick={() => handleViewChange('hot-words')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-200 ${view === 'hot-words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}><Icon name="bar-chart" className="w-4 h-4" />שכיחות</button>
                        </div>
                    </div>

                    {stats && (
                        <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex-1"></div>
                                <h3 className="text-2xl font-bold text-center flex-grow">התפלגות שורשים דיגיטליים (ש"ד)</h3>
                                <div className="flex-1 flex justify-end"></div>
                            </div>
                            <div className={`flex justify-around items-center p-2 rounded-lg h-28 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                {DEFAULT_DR_ORDER.map((dr) => {
                                    const count = stats.drDistribution[dr] || 0;
                                    const maxCount = Math.max(...stats.drDistribution.slice(1));
                                    const hasWords = count > 0;
                                    const isPrimeDR = [2,3,5,7].includes(dr);
                                    const primeColorClasses = COLOR_PALETTE[primeColor];
                                    const indicatorSize = hasWords ? 22 + (12 * (hasWords && maxCount > 0 ? Math.pow(count / maxCount, 0.75) : 0)) : 0;
                                    
                                    return (
                                        <div key={dr} className="flex flex-col items-center w-1/12 h-full justify-center group">
                                            <div className={`flex flex-col items-center w-full h-full justify-center group rounded-md p-1 transition-all cursor-pointer ${selectedDR === dr ? 'border-2 border-purple-500 dark:border-purple-400' : 'border-2 border-transparent'}`} onClick={() => handleDrillDown(dr)}>
                                                <div className="h-8 flex items-center justify-center mb-1">
                                                    {hasWords && <div className="rounded-full flex items-center justify-center bg-blue-300 dark:bg-blue-700 text-xs font-bold text-white dark:text-gray-100" style={{ width: `${indicatorSize}px`, height: `${indicatorSize}px` }}>{count}</div>}
                                                </div>
                                                <div className={`font-bold text-lg mt-1 ${selectedDR === dr ? 'text-purple-700 dark:text-purple-300' : isPrimeDR ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-500 dark:text-gray-400'}`}>ש"ד {dr}</div>
                                            </div>
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
                                        <div className={`p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex-1 flex justify-start"><CopyButton getData={prepareAllDetailsText} id='all-details' /></div>
                                                <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center">סיכום כללי</h2></div>
                                                <div className="flex-1 flex justify-end">
                                                    <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                                                        <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'lines' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>שורות</button>
                                                        <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-flow-col md:auto-cols-fr gap-4 text-center">
                                                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50"> <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-semibold">Σ-אחדות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.units} isPrimeFlag={coreResults.grandTotals.isPrime.U} primeColor={primeColor} layer="U" filters={filters}/> </div>
                                                {coreResults.grandTotals.tens !== coreResults.grandTotals.units && <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50"> <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-semibold">Σ-עשרות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.tens} isPrimeFlag={coreResults.grandTotals.isPrime.T} primeColor={primeColor} layer="T" filters={filters}/> </div>}
                                                {coreResults.grandTotals.hundreds !== coreResults.grandTotals.tens && <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50"> <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-semibold">Σ-מאות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.hundreds} isPrimeFlag={coreResults.grandTotals.isPrime.H} primeColor={primeColor} layer="H" filters={filters}/> </div>}
                                                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50"> <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-semibold">ש"ד (סה"כ)</p> <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{coreResults.grandTotals.dr}</p> </div>
                                            </div>
                                        </div>
                                    )}
                                    {coreResults && (
                                        <div className={`p-4 sm:p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                                            <button onClick={() => dispatch({ type: 'TOGGLE_PRIMES_COLLAPSED' })} className="w-full flex justify-between items-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                                                <span className="text-center flex-grow">סיכום ראשוניים מסכומי השורות</span>
                                                <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isPrimesCollapsed ? '' : 'rotate-180'}`} />
                                            </button>
                                            {!isPrimesCollapsed && (
                                                <div className="mt-4">
                                                    <p className={`text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {coreResults.primeSummary.length > 0
                                                            ? (<>
                                                                בסך הכל נמצאו <span className="font-bold text-emerald-600">{stats.primeLineTotals}</span> שורות עם ערכים ראשוניים.
                                                              </>)
                                                            : 'לא נמצאו ערכים ראשוניים מסכומי השורות.'}
                                                    </p>
                                                    {coreResults.primeSummary.length > 0 && (
                                                        <div className="overflow-x-auto max-w-lg mx-auto">
                                                            <table className="min-w-full"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-emerald-100'}>
                                                                <tr><th className="px-4 py-3 text-center">שורה</th><th className="px-4 py-3 text-center">ערך ראשוני</th><th className="px-4 py-3 text-center">שכבה</th></tr>
                                                            </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                                {coreResults.primeSummary.map((primeInfo, index) => {
                                                                    // Filter prime summary based on active layers
                                                                    const layers = primeInfo.layers.map(l => l === 'אחדות' ? 'U' : l === 'עשרות' ? 'T' : 'H');
                                                                    if (!layers.some(l => filters[l])) return null;

                                                                    return (
                                                                    <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-emerald-50'}`}><td className="px-4 py-3 text-center">{primeInfo.line}</td><td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{primeInfo.value}</td><td className="px-4 py-3 text-center">{primeInfo.layers.join(', ')}</td></tr>
                                                                )})}
                                                            </tbody></table>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex justify-end mb-4"><button onClick={() => dispatch({ type: 'TOGGLE_ALL_ROWS' })} className="bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">{coreResults && Object.keys(expandedRows).length === coreResults.lines.length && Object.values(expandedRows).every(v => v) ? 'קפל הכל' : 'פתח הכל'}</button></div>
                                    {coreResults.lines.map((lineResult, lineIndex) => {
                                        const isExpanded = !!expandedRows[lineIndex];
                                        const visibleWords = lineResult.words.filter(w => isWordVisible(w, filters));
                                        // If no visible words, hide the line card entirely? 
                                        // User requested: "Words which don't have a selected value should be hidden". 
                                        // If all words are hidden, showing an empty card is useless.
                                        if (visibleWords.length === 0) return null;

                                        return (
                                            <div key={lineIndex} className={`p-4 sm:p-6 rounded-xl border mb-8 transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'}`}>
                                                <div className="cursor-pointer" onClick={() => dispatch({ type: 'TOGGLE_ROW_EXPAND', payload: lineIndex })}>
                                                    <div className="flex justify-between items-center"><h2 className="text-2xl font-bold mb-1 text-center flex-grow">תוצאות עבור שורה {lineIndex + 1}</h2><Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} /></div>
                                                    <p className={`text-center mb-6 italic text-lg break-all ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>"{lineResult.lineText}"</p>
                                                    {!isExpanded && <div className={`font-bold text-sm text-center p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>סה"כ שורה: 
                                                        {isValueVisible('U', lineResult.isPrimeTotals.U, filters) && <span className={`mx-2 ${lineResult.isPrimeTotals.U ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>אחדות={lineResult.totals.units}{lineResult.isPrimeTotals.U && '♢'}</span>}
                                                        {lineResult.totals.tens !== lineResult.totals.units && isValueVisible('T', lineResult.isPrimeTotals.T, filters) && <span className={`mx-2 ${lineResult.isPrimeTotals.T ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>עשרות={lineResult.totals.tens}{lineResult.isPrimeTotals.T && '♢'}</span>}
                                                        {lineResult.totals.hundreds !== lineResult.totals.tens && isValueVisible('H', lineResult.isPrimeTotals.H, filters) && <span className={`mx-2 ${lineResult.isPrimeTotals.H ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>מאות={lineResult.totals.hundreds}{lineResult.isPrimeTotals.H && '♢'}</span>}
                                                        <span className="mx-2">ש"ד={lineResult.totalsDR}</span>
                                                    </div>}
                                                </div>
                                                {isExpanded && (
                                                    <div className="overflow-x-auto mt-4">
                                                        <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}>
                                                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-blue-100'}>
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
                                                                <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-blue-50'}`}>
                                                                    <td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td>
                                                                    <td className="px-4 py-3 text-sm text-right font-mono" style={{ direction: 'ltr', textAlign: 'right' }}>{getLetterDetails(res.word, letterTable).map(l => l.value).join('+')}</td>
                                                                    {filters.U && <ValueCell value={res.units} isPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="U" filters={filters} />}
                                                                    {filters.T && <ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} primeColor={primeColor} layer="T" filters={filters} />}
                                                                    {filters.H && <ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} primeColor={primeColor} layer="H" filters={filters} />}
                                                                    <td className="px-4 py-3 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td>
                                                                </tr>
                                                            ))}</tbody>
                                                            {lineResult.words.length > 1 && <tfoot className={`font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-200 to-blue-200'}`}>
                                                                <tr>
                                                                    <td colSpan="2" className="px-4 py-4 text-right text-lg rounded-r-lg">סה"כ שורה:</td>
                                                                    {filters.U && <ValueCell value={lineResult.totals.units} isPrimeFlag={lineResult.isPrimeTotals.U} primeColor={primeColor} layer="U" filters={filters} />}
                                                                    {filters.T && <ValueCell value={lineResult.totals.tens} isPrimeFlag={lineResult.isPrimeTotals.T} previousValue={lineResult.totals.units} primeColor={primeColor} layer="T" filters={filters} />}
                                                                    {filters.H && <ValueCell value={lineResult.totals.hundreds} isPrimeFlag={lineResult.isPrimeTotals.H} previousValue={lineResult.totals.tens} primeColor={primeColor} layer="H" filters={filters} />}
                                                                    <td className="px-4 py-4 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{lineResult.totalsDR}</td>
                                                                </tr>
                                                            </tfoot>}
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className={`p-4 sm:p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex-1 flex justify-start"><CopyButton getData={prepareAllDetailsText} id='all-details' /></div>
                                        <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center">סיכום מילים ייחודיות ({coreResults.allWords.length} מילים)</h2></div>
                                        <div className="flex-1 flex justify-end">
                                            <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                                                <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'lines' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>שורות</button>
                                                <button onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-separate" style={{borderSpacing: "0 0.5rem"}}>
                                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-gray-100 to-blue-100'}>
                                                <tr>
                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th>
                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th>
                                                    {filters.U && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-אחדות</th>}
                                                    {filters.T && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th>}
                                                    {filters.H && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th>}
                                                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th>
                                                </tr>
                                            </thead>
                                            <tbody>{coreResults.allWords.filter(w => isWordVisible(w, filters)).map((res, index) => (
                                                <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-blue-50'}`}>
                                                    <td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right">{res.word}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-mono" style={{ direction: 'ltr', textAlign: 'right' }}>{getLetterDetails(res.word, letterTable).map(l => l.value).join('+')}</td>
                                                    {filters.U && <ValueCell value={res.units} isPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="U" filters={filters} />}
                                                    {filters.T && <ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} primeColor={primeColor} layer="T" filters={filters} />}
                                                    {filters.H && <ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} primeColor={primeColor} layer="H" filters={filters} />}
                                                    <td className="px-4 py-3 text-center font-semibold text-purple-700 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td>
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
                            copiedId={copiedId}
                            searchTerm={searchTerm}
                        />
                    )}

                    {view === 'hot-words' && coreResults && (
                        <div className={`p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-lg'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex-1 flex justify-start"><CopyButton getData={selectedHotValue !== null ? prepareHotWordsText : prepareFrequenciesText} id='hot-words' /></div>
                                <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center">ניתוח שכיחויות</h2></div>
                                <div className="flex-1 flex justify-end">
                                    <div className="flex items-center p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                                        <button onClick={() => dispatch({ type: 'SET_HOT_VIEW', payload: 'values' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${hotView === 'values' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>ערכים</button>
                                        <button onClick={() => dispatch({ type: 'SET_HOT_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${hotView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                    </div>
                                </div>
                            </div>
                            {hotView === 'values' && (
                                <div>
                                    {selectedHotValue === null ? (
                                        <div>
                                            <div className="flex text-right sticky top-0 bg-white dark:bg-gray-800 p-2 font-semibold border-b border-gray-200 dark:border-gray-700">
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
                                                    <div className="flex items-center text-right hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-200 dark:border-gray-700/50" style={{ height: 40 }} onClick={() => dispatch({ type: 'SET_SELECTED_HOT_VALUE', payload: { value, list: valueToWordsMap.get(value) || [] } })}>
                                                        <div className="w-1/4 p-2 font-bold text-lg text-blue-700 dark:text-blue-300">{value}</div>
                                                        <div className="w-1/4 p-2 text-center">{count}</div>
                                                        <div className="w-1/2 p-2 text-sm text-gray-600 dark:text-gray-400 truncate">{[...new Set((valueToWordsMap.get(value) || []).filter(w => isWordVisible(w, filters)).map(w => w.word))].join(', ')}</div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-xl font-bold">מילים עם הערך {selectedHotValue}</h3>
                                                <button onClick={() => dispatch({ type: 'CLEAR_SELECTED_HOT_VALUE' })} className="bg-gray-200 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-base font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">חזור לרשימה</button>
                                            </div>
                                            <div className="flex flex-wrap justify-start gap-2" onClick={unpinOnBackgroundClick}>
                                                {hotWordsList.filter(w => isWordVisible(w, filters)).map((wordData, index) => (
                                                    <WordCard 
                                                        key={wordData.word}
                                                        wordData={wordData}
                                                        activeWord={pinnedWord || hoveredWord}
                                                        isDarkMode={isDarkMode}
                                                        primeColor={primeColor}
                                                        connectionValues={connectionValues}
                                                        dispatch={dispatch}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {hotView === 'words' && (
                                <div>
                                    <div className="flex text-right sticky top-0 bg-white dark:bg-gray-800 p-2 font-semibold border-b border-gray-200 dark:border-gray-700">
                                        <div className="w-3/4">מילה</div>
                                        <div className="w-1/4 text-center cursor-pointer" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'count' })}>כמות {hotSort.key === 'count' && (hotSort.order === 'desc' ? '↓' : '↑')}</div>
                                    </div>
                                    <VirtualizedList items={sortedHotViewList} itemHeight={40} listHeight={384} getKey={(item) => item.word} renderItem={({ word, count }) => (
                                        <div className="flex items-center text-right hover:bg-gray-100 dark:hover:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700/50" style={{ height: 40 }}>
                                            <div className="w-3/4 p-2 font-bold text-lg text-blue-700 dark:text-blue-300">{word}</div>
                                            <div className="w-1/4 p-2 text-center font-mono">{count}</div>
                                        </div>
                                    )} />
                                </div>
                            )}
                        </div>
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

const AppProvider = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isPending, startTransition] = useTransition();
    const deferredText = useDeferredValue(state.text);
    const versionRef = useRef(0);

    useEffect(() => {
        if (!deferredText) { dispatch({ type: 'SET_CORE_RESULTS', payload: null }); return; }
        
        versionRef.current += 1;
        const currentVersion = versionRef.current;
        
        const requestIdle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1));
        const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
        let timeoutId;
        
        const handler = () => {
            timeoutId = requestIdle(() => {
                startTransition(() => {
                    const results = computeCoreResults(deferredText, state.mode);
                    if (versionRef.current === currentVersion) {
                        dispatch({ type: 'SET_CORE_RESULTS', payload: results });
                    }
                });
            });
        };
        const delay = Math.min(800, Math.max(120, deferredText.length * 0.4));
        const initialTimeout = setTimeout(handler, delay);
        return () => { clearTimeout(initialTimeout); if (timeoutId) cancelIdle(timeoutId); };
    }, [deferredText, state.mode]);

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
        if (!valueToWordsMap) return new Set();
        const s = new Set();
        for (const [value, arr] of valueToWordsMap.entries()) {
            if (new Set(arr.map(w => w.word)).size > 1) s.add(value);
        }
        return s;
    }, [valueToWordsMap]);

    const contextValue = useMemo(() => ({ 
        ...state, 
        stats, 
        valueToWordsMap, 
        connectionValues,
        isPending
    }), [state, stats, valueToWordsMap, connectionValues, isPending]);

    return (
        <AppContext.Provider value={contextValue}>
            <AppDispatchContext.Provider value={dispatch}>
                {children}
            </AppDispatchContext.Provider>
        </AppContext.Provider>
    );
};

const WrappedApp = () => (
	<AppProvider>
		<App />
	</AppProvider>
);

export default WrappedApp;
