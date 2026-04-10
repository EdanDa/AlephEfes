import { performance } from 'node:perf_hooks';
import { computeCoreResults } from '../src/core/analysisCore.js';

function makeHebrewText(word, wordsPerLine, lineCount) {
  const line = Array.from({ length: wordsPerLine }, () => word).join(' ');
  return Array.from({ length: lineCount }, () => line).join('\n');
}

const budgets = [
  { label: 'medium', text: makeHebrewText('בראשית', 80, 40), mode: 'aleph-zero', maxMs: 2500 },
  { label: 'large', text: makeHebrewText('אלהים', 120, 60), mode: 'aleph-one', maxMs: 5000 },
];

const failures = [];

for (const run of budgets) {
  const start = performance.now();
  const results = computeCoreResults(run.text, run.mode);
  const duration = performance.now() - start;
  const rounded = Math.round(duration * 100) / 100;
  console.log(`${run.label}: ${rounded}ms (${results.totalWordCount} words)`);

  if (duration > run.maxMs) {
    failures.push(`${run.label} exceeded ${run.maxMs}ms (actual ${rounded}ms)`);
  }
}

if (failures.length) {
  console.error('Performance regression check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Performance regression check passed');
