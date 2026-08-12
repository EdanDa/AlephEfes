const VALID_SCOPES = new Set(['section', 'range', 'book']);

function clampOrdinal(value, sectionCount) {
    const ordinal = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 1;
    return Math.min(Math.max(ordinal, 1), sectionCount);
}

export function createTanakhSelection(sections, requestedScope = 'section', requestedStart = 1, requestedEnd = requestedStart) {
    if (!Array.isArray(sections) || sections.length === 0) return null;

    const scope = VALID_SCOPES.has(requestedScope) ? requestedScope : 'section';
    const startOrdinal = scope === 'book' ? 1 : clampOrdinal(requestedStart, sections.length);
    const endOrdinal = scope === 'book'
        ? sections.length
        : scope === 'section'
            ? startOrdinal
            : Math.max(startOrdinal, clampOrdinal(requestedEnd, sections.length));
    const selectedSections = sections.slice(startOrdinal - 1, endOrdinal);
    const firstSection = selectedSections[0];
    const lastSection = selectedSections[selectedSections.length - 1];

    return {
        scope,
        startOrdinal,
        endOrdinal,
        sectionCount: selectedSections.length,
        sections: selectedSections,
        calculationText: selectedSections.map((section) => section.calculationText).join('\n'),
        sourceText: selectedSections.map((section) => section.sourceText).join('\n\n'),
        wordCount: selectedSections.reduce((sum, section) => sum + section.wordCount, 0),
        locators: {
            start: firstSection.locators.start,
            end: lastSection.locators.end,
        },
        boundaryAfter: lastSection.boundaryAfter,
    };
}

export function tanakhSelectionLabel(selection) {
    if (!selection) return '';
    if (selection.scope === 'book') return 'הספר כולו';
    if (selection.sectionCount === 1) return `פרשיה ${selection.startOrdinal}`;
    return `פרשיות ${selection.startOrdinal}–${selection.endOrdinal}`;
}

export function tanakhActionLabel(selection) {
    if (!selection) return '';
    if (selection.scope === 'book') return 'נתח את הספר כולו';
    if (selection.sectionCount === 1) return 'נתח את הפרשיה';
    return `נתח ${selection.sectionCount.toLocaleString('he-IL')} פרשיות`;
}
