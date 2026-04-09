import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync("rg --files src tests scripts -g '*.js' -g '*.jsx' -g '*.mjs'", { encoding: 'utf8', shell: '/bin/bash' })
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

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
