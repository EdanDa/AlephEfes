import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldUseDitto } from '../src/utils/valueDisplay.js';

test('shouldUseDitto collapses any repeated visible layer value', () => {
    for (const value of [0, 7, 42, 256, 9999]) {
        assert.equal(shouldUseDitto(value, value, true), true, `expected a ditto for repeated value ${value}`);
    }
});

test('shouldUseDitto keeps an explicit value when the previous layer differs or is hidden', () => {
    assert.equal(shouldUseDitto(42, 7, true), false);
    assert.equal(shouldUseDitto(42, 42, false), false);
});
