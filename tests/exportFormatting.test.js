import assert from 'node:assert/strict';
import test from 'node:test';
import { stripTrailingSpacesPerLine } from '../src/utils/exportFormatting.js';

test('stripTrailingSpacesPerLine removes trailing single spaces and tabs per line', () => {
    const input = 'first line \nsecond\t\nthird   ';
    const output = stripTrailingSpacesPerLine(input);
    assert.equal(output, 'first line\nsecond\nthird');
});

test('stripTrailingSpacesPerLine keeps internal spaces and line breaks', () => {
    const input = 'one  two\n\nthree four ';
    const output = stripTrailingSpacesPerLine(input);
    assert.equal(output, 'one  two\n\nthree four');
});

test('stripTrailingSpacesPerLine handles non-string inputs safely', () => {
    assert.equal(stripTrailingSpacesPerLine(null), '');
    assert.equal(stripTrailingSpacesPerLine(undefined), '');
});
