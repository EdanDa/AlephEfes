import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResearchMarkdown } from '../src/core/researchMarkdown.js';
import { makeResearchUnit } from '../src/core/researchModel.js';
import { buildResearchNote } from '../src/core/researchNote.js';

test('note preview parses complete occurrence tables and preserves exact passage text', () => {
    const unit = makeResearchUnit('אב אב ה', 'aleph-zero', { id: 'manual-line-1', lineNumber: 1, label: 'שורה 1' });
    const content = buildResearchNote({ unit, filters: { U: true, T: true, H: true, Prime: false }, word: 'אב' });
    const blocks = parseResearchMarkdown(content);
    assert.equal(blocks.find((block) => block.type === 'passage').text, 'אב אב ה');
    const table = blocks.find((block) => block.type === 'table');
    assert.equal(table.headers.length, 8);
    assert.deepEqual(table.rows.map((row) => row.slice(0, 4)), [['אב', '1', '1', '2'], ['אב', '2', '3', '4']]);
});
test('literal text inside code fences is never interpreted as headings, tables or HTML', () => {
    const blocks = parseResearchMarkdown('## כותרת\n\n```text\n# אב\n| א | ב |\n<img src=x>\n```\n\n- סוף');
    assert.deepEqual(blocks.map((block) => block.type), ['heading', 'passage', 'list']);
    assert.equal(blocks[1].text, '# אב\n| א | ב |\n<img src=x>');
});
