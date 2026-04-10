import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'tests', 'scripts'];
const ALLOWED_EXT = new Set(['.js', '.jsx', '.mjs']);

function collectFiles(dir, out) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, out);
      continue;
    }
    const dot = entry.lastIndexOf('.');
    const ext = dot === -1 ? '' : entry.slice(dot);
    if (ALLOWED_EXT.has(ext)) out.push(full);
  }
}

const files = [];
for (const root of ROOTS) collectFiles(root, files);

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');

  if (content.includes('console.log(') && !file.startsWith('scripts/')) {
    violations.push(`${file}: console.log is not allowed outside scripts/`);
  }
}

if (violations.length) {
  console.error('Lint violations found:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log(`lint passed for ${files.length} files`);
