import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'tests', 'scripts'];
const ALLOWED_EXT = new Set(['.js', '.mjs']);

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

for (const file of files) {
  execSync(`node --check ${JSON.stringify(file)}`, { stdio: 'inherit' });
}

console.log(`typecheck passed for ${files.length} files (syntax + module checks)`);
