const getInitialDarkMode = () => {
    if (typeof window === 'undefined') return false;

    const storedTheme = window.localStorage.getItem('alephTheme');
    if (storedTheme === 'dark') return true;
    if (storedTheme === 'light') return false;

    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

const initialState = {
    text: '',
    coreResults: null,
    selectedDR: null,
    isDarkMode: getInitialDarkMode(),
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
    filters: { U: true, T: true, H: true, Prime: false },
};

function appReducer(state, action) {
    switch (action.type) {
        case 'SET_TEXT':
            if (action.payload === state.text) return state;
            return {
                ...state,
                text: action.payload,
                coreResults: null,
                pinnedWord: null,
                selectedDR: null,
                selectedHotValue: null,
                hotWordsList: [],
            };
        case 'SET_CORE_RESULTS':
            return { ...state, coreResults: action.payload };
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
            return { ...state, mode: action.payload, pinnedWord: null, coreResults: null, selectedDR: null, searchTerm: '' };
        case 'SET_SEARCH_TERM':
            return { ...state, searchTerm: action.payload, pinnedWord: null, selectedDR: null };
        case 'SET_HOVERED_WORD':
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
            state.coreResults.lines.forEach((_, index) => {
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
        case 'TOGGLE_FILTER':
            return { ...state, filters: { ...state.filters, [action.payload]: !state.filters[action.payload] } };
        default:
            throw new Error(`Unhandled action type: ${action.type}`);
    }
}

export { appReducer, initialState };
