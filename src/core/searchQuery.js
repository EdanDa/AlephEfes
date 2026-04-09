function getVisibleNumericValues(wordData, filters) {
    const values = [];

    if (filters.U) values.push(wordData.units);
    if (filters.T && wordData.tens !== wordData.units) values.push(wordData.tens);
    if (filters.H && wordData.hundreds !== wordData.tens) values.push(wordData.hundreds);

    return values;
}

function parseSearchGroups(searchTerm = '') {
    return searchTerm
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((group) => group.split('+').map((part) => part.trim()).filter(Boolean));
}

function groupMatchesWord(wordData, groupTerms, filters) {
    if (groupTerms.length === 0) return true;

    const visibleValues = getVisibleNumericValues(wordData, filters);
    const visibleValueSet = new Set(visibleValues);

    const allPartsMatch = groupTerms.every((term) => {
        if (/^\d+$/.test(term)) {
            return visibleValueSet.has(Number.parseInt(term, 10));
        }

        return wordData.word === term;
    });

    return allPartsMatch;
}

function matchesSearchQuery(wordData, searchTerm, filters) {
    const groups = parseSearchGroups(searchTerm);
    if (groups.length === 0) return true;

    return groups.some((groupTerms) => groupMatchesWord(wordData, groupTerms, filters));
}

export { getVisibleNumericValues, parseSearchGroups, groupMatchesWord, matchesSearchQuery };
