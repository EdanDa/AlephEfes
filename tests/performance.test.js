import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoreResults } from '../src/core/analysisCore.js';

function makeHebrewText(word, wordsPerLine, lineCount) {
  const line = Array.from({ length: wordsPerLine }, () => word).join(' ');
  return Array.from({ length: lineCount }, () => line).join('\n');
}

test('computeCoreResults stays within regression budget on medium corpus', () => {
  const sample = makeHebrewText('בראשית', 80, 40); // 3,200 words
  const start = performance.now();
  const results = computeCoreResults(sample, 'aleph-zero');
  const duration = performance.now() - start;

  assert.equal(results.totalWordCount, 3200);
  assert.ok(duration < 2500, `Expected compute under 2500ms, got ${duration.toFixed(2)}ms`);
});

test('computeCoreResults scales for larger corpus without timing out', () => {
  const sample = makeHebrewText('אלהים', 120, 60); // 7,200 words
  const start = performance.now();
  const results = computeCoreResults(sample, 'aleph-one');
  const duration = performance.now() - start;

  assert.equal(results.totalWordCount, 7200);
  assert.ok(duration < 5000, `Expected compute under 5000ms, got ${duration.toFixed(2)}ms`);
});
