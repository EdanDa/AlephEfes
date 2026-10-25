import { normalizeSearchInput } from '../core/searchInput.js';

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
    text: '',
    coreResults: null,
    selectedDR: null,
    isDarkMode: false,
    hasExplicitThemeChoice: false,
    isInputDirty: false,
    corpusSelection: null,
    searchTerm: '',
    isValueTableOpen: false,
    isValueTablePinned: false,
    mode: 'aleph-zero',
    textSize: 'md',
    wordNumberingStart: 1,
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
    filters: { U: true, T: true, H: true, Prime: false },
};

function appReducer(state, action) {
    switch (action.type) {
        case 'SET_TEXT':
            if (action.payload === state.text) return state.isInputDirty ? { ...state, isInputDirty: false } : state;
            return {
                ...state,
                text: action.payload,
                isInputDirty: false,
                corpusSelection: null,
                expandedRows: {},
                copiedId: null,
                hoveredWord: null,
                coreResults: action.payload.trim() ? state.coreResults : null,
                pinnedWord: null,
                selectedDR: null,
                searchTerm: '',
                selectedHotValue: null,
                hotWordsList: [],
            };
        case 'SET_INPUT_DIRTY':
            return state.isInputDirty === action.payload ? state : { ...state, isInputDirty: action.payload };
        case 'LOAD_CORPUS_SELECTION': {
            const next = appReducer(state, { type: 'SET_TEXT', payload: action.payload.text });
            return { ...next, corpusSelection: action.payload.selection, isInputDirty: false };
        }
        case 'CLEAR_CORPUS_SELECTION':
            return state.corpusSelection ? { ...state, corpusSelection: null } : state;
        case 'SET_CORE_RESULTS':
            return { ...state, coreResults: normalizeCoreResults(action.payload) };
        case 'SET_EXPLICIT_THEME_CHOICE':
            return { ...state, hasExplicitThemeChoice: action.payload };
        case 'TOGGLE_THEME_MODE':
            return { ...state, isDarkMode: !state.isDarkMode, hasExplicitThemeChoice: true };
        case 'SET_DARK_MODE':
            return { ...state, isDarkMode: action.payload };
        case 'SET_VIEW':
            return {
                ...state,
                view: action.payload,
                pinnedWord: null,
                hoveredWord: null,
                searchTerm: '',
                selectedDR: null,
                selectedHotValue: null,
                hotWordsList: [],
                isPrimesCollapsed: true,
                copiedId: null,
                isValueTableOpen: false,
            };
        case 'SET_MODE':
            if (state.mode === action.payload) return state;
            return { ...state, mode: action.payload, pinnedWord: null, hoveredWord: null, coreResults: null, selectedDR: null, searchTerm: '', selectedHotValue: null, hotWordsList: [], expandedRows: {}, copiedId: null };
        case 'SET_TEXT_SIZE':
            return { ...state, textSize: action.payload };
        case 'SET_WORD_NUMBERING_START':
            return action.payload === 0 || action.payload === 1 ? { ...state, wordNumberingStart: action.payload } : state;
        case 'SET_SEARCH_TERM':
            return { ...state, searchTerm: normalizeSearchInput(action.payload), pinnedWord: null, selectedDR: null };
        case 'SET_HOVERED_WORD':
            if (state.hoveredWord?.word === action.payload?.word) return state;
            return { ...state, hoveredWord: action.payload };
        case 'SET_PINNED_WORD':
            return {
                ...state,
                pinnedWord: state.pinnedWord && state.pinnedWord.word === action.payload.word ? null : action.payload,
            };
        case 'UNPIN_WORD':
            return { ...state, pinnedWord: null, hoveredWord: null };
        case 'SET_SELECTED_DR': {
            const newSelectedDR = state.selectedDR === action.payload ? null : action.payload;
            return { ...state, selectedDR: newSelectedDR, pinnedWord: null, searchTerm: '' };
        }
        case 'SET_COPIED_ID':
            return { ...state, copiedId: action.payload };
        case 'TOGGLE_VALUE_TABLE':
            return { ...state, isValueTableOpen: !state.isValueTableOpen };
        case 'TOGGLE_VALUE_TABLE_PIN':
            return { ...state, isValueTablePinned: !state.isValueTablePinned, isValueTableOpen: true };
        case 'SET_VALUE_TABLE_OPEN':
            return { ...state, isValueTableOpen: action.payload };
        case 'CLOSE_VALUE_TABLE':
            return { ...state, isValueTableOpen: false, isValueTablePinned: false };
        case 'TOGGLE_PRIMES_COLLAPSED':
            return { ...state, isPrimesCollapsed: !state.isPrimesCollapsed };
        case 'TOGGLE_STATS_COLLAPSED':
            return { ...state, isStatsCollapsed: !state.isStatsCollapsed };
        case 'SET_SHOW_SCROLL_TOP':
            return { ...state, showScrollTop: action.payload };
        case 'SET_HOT_VIEW':
            return { ...state, hotView: action.payload };
        case 'SET_DETAILS_VIEW':
            return { ...state, detailsView: action.payload };
        case 'SET_HOT_SORT':
            return {
                ...state,
                hotSort:
                    state.hotSort.key === action.payload
                        ? { ...state.hotSort, order: state.hotSort.order === 'desc' ? 'asc' : 'desc' }
                        : { key: action.payload, order: 'desc' },
            };
        case 'TOGGLE_ROW_EXPAND':
            return { ...state, expandedRows: { ...state.expandedRows, [action.payload]: !state.expandedRows[action.payload] } };
        case 'TOGGLE_ALL_ROWS': {
            const areAllExpanded =
                state.coreResults &&
                Object.keys(state.expandedRows).length === state.coreResults.lines.length &&
                Object.values(state.expandedRows).every((v) => v);
            if (areAllExpanded) return { ...state, expandedRows: {} };

            const allExpanded = {};
            (state.coreResults?.lines || []).forEach((_, index) => {
                allExpanded[index] = true;
            });
            return { ...state, expandedRows: allExpanded };
        }
        case 'SET_PRIME_COLOR':
            return { ...state, primeColor: action.payload };
        case 'SET_SELECTED_HOT_VALUE':
            return { ...state, selectedHotValue: action.payload.value, hotWordsList: action.payload.list };
        case 'CLEAR_SELECTED_HOT_VALUE':
            return { ...state, selectedHotValue: null, hotWordsList: [] };
        case 'RESET_FILTERS':
            return { ...state, filters: { ...initialState.filters }, selectedDR: null, searchTerm: '', selectedHotValue: null, hotWordsList: [], pinnedWord: null };
        case 'TOGGLE_FILTER':
            return { ...state, filters: { ...state.filters, [action.payload]: !state.filters[action.payload] } };
        default:
            throw new Error(`Unhandled action type: ${action.type}`);
    }
}

export { appReducer, initialState };
