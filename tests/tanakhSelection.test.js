import assert from 'node:assert/strict';
import test from 'node:test';

import { createTanakhSelection, tanakhActionLabel, tanakhSelectionLabel } from '../src/core/tanakhSelection.js';

const sections = [1, 2, 3].map((ordinal) => ({
    ordinal,
    sourceText: `מקור ${ordinal}`,
    calculationText: `טקסט${ordinal}`,
    wordCount: ordinal * 10,
    locators: {
        start: { chapter: ordinal, verse: 1 },
        end: { chapter: ordinal, verse: 2 },
    },
    boundaryAfter: { upstreamMarker: ordinal === 3 ? null : 'פפ' },
}));

test('single Tanakh section selection remains one analytical line', () => {
    const selection = createTanakhSelection(sections, 'section', 2, 3);
    assert.equal(selection.startOrdinal, 2);
    assert.equal(selection.endOrdinal, 2);
    assert.equal(selection.calculationText, 'טקסט2');
    assert.equal(tanakhSelectionLabel(selection), 'פרשיה 2');
    assert.equal(tanakhActionLabel(selection), 'נתח את הפרשיה');
});

test('Tanakh range preserves each section as a separate analytical line', () => {
    const selection = createTanakhSelection(sections, 'range', 1, 2);
    assert.equal(selection.sectionCount, 2);
    assert.equal(selection.calculationText, 'טקסט1\nטקסט2');
    assert.equal(selection.sourceText, 'מקור 1\n\nמקור 2');
    assert.equal(selection.wordCount, 30);
    assert.deepEqual(selection.locators, { start: sections[0].locators.start, end: sections[1].locators.end });
    assert.equal(tanakhSelectionLabel(selection), 'פרשיות 1–2');
    assert.equal(tanakhActionLabel(selection), 'נתח 2 פרשיות');
});

test('whole-book selection includes every section in order', () => {
    const selection = createTanakhSelection(sections, 'book', 2, 2);
    assert.equal(selection.startOrdinal, 1);
    assert.equal(selection.endOrdinal, 3);
    assert.equal(selection.sectionCount, 3);
    assert.equal(selection.calculationText, 'טקסט1\nטקסט2\nטקסט3');
    assert.equal(selection.wordCount, 60);
    assert.equal(tanakhSelectionLabel(selection), 'הספר כולו');
    assert.equal(tanakhActionLabel(selection), 'נתח את הספר כולו');
});
