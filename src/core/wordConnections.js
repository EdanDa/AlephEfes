const LAYER_FLAG = Object.freeze({ U: 1, T: 2, H: 4 });

function getWordLayerMasks(wordData) {
    let availableMask = LAYER_FLAG.U;
    let primeMask = wordData.isPrimeU ? LAYER_FLAG.U : 0;

    if (wordData.tens !== wordData.units) {
        availableMask |= LAYER_FLAG.T;
        if (wordData.isPrimeT) primeMask |= LAYER_FLAG.T;
    }

    if (wordData.hundreds !== wordData.tens) {
        availableMask |= LAYER_FLAG.H;
        if (wordData.isPrimeH) primeMask |= LAYER_FLAG.H;
    }

    return { availableMask, primeMask };
}

function getFilterMask(filters) {
    let mask = 0;
    if (filters.H) mask |= LAYER_FLAG.H;
    if (filters.T) mask |= LAYER_FLAG.T;
    if (filters.U) mask |= LAYER_FLAG.U;
    return mask;
}

export function getVisibleValuesForWord(wordData, filters) {
    const { availableMask, primeMask } = getWordLayerMasks(wordData);
    const filterMask = getFilterMask(filters);
    const visibleMask = filters.Prime ? (primeMask & filterMask) : (availableMask & filterMask);
    const out = [];

    if ((visibleMask & LAYER_FLAG.H) !== 0) out.push(wordData.hundreds);
    if ((visibleMask & LAYER_FLAG.T) !== 0) out.push(wordData.tens);
    if ((visibleMask & LAYER_FLAG.U) !== 0) out.push(wordData.units);

    return out;
}

export function buildWordConnectionIndex(words, filters) {
    const wordsByVisibleValue = new Map();
    const visibleValuesByWord = new Map();

    words.forEach((wordData) => {
        const visibleValues = getVisibleValuesForWord(wordData, filters);
        visibleValuesByWord.set(wordData.word, visibleValues);

        visibleValues.forEach((value) => {
            if (!wordsByVisibleValue.has(value)) wordsByVisibleValue.set(value, []);
            wordsByVisibleValue.get(value).push(wordData.word);
        });
    });

    return { wordsByVisibleValue, visibleValuesByWord };
}

export function computeConnectedWordsSet(activeWord, visibleValuesByWord, wordsByVisibleValue) {
    if (!activeWord?.word || !visibleValuesByWord.has(activeWord.word)) return new Set();

    const connected = new Set();
    const activeValues = visibleValuesByWord.get(activeWord.word) || [];

    activeValues.forEach((value) => {
        const hitList = wordsByVisibleValue.get(value);
        if (!hitList) return;
        hitList.forEach((word) => {
            if (word !== activeWord.word) connected.add(word);
        });
    });

    return connected;
}
