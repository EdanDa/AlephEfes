import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTextForClipboard, stripTrailingSpacesPerLine } from '../src/utils/exportFormatting.js';

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


test('formatTextForClipboard prepends legend header to copied text', () => {
    const output = formatTextForClipboard('מצב חישוב: א:0');
    assert.equal(output, "א'-אחדות ע'-עשרות מ'-מאות ♢-ראשוני\n---\n\nמצב חישוב: א:0");
});

test('formatTextForClipboard avoids duplicating legend if already present', () => {
    const input = "א'-אחדות ע'-עשרות מ'-מאות ♢-ראשוני\n---\n\nטקסט";
    assert.equal(formatTextForClipboard(input), input);
});
