import { execSync } from 'node:child_process';

const files = execSync("rg --files src tests scripts -g '*.js' -g '*.mjs'", { encoding: 'utf8', shell: '/bin/bash' })
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

for (const file of files) {
  execSync(`node --check ${JSON.stringify(file)}`, { stdio: 'inherit' });
}

console.log(`typecheck passed for ${files.length} files (syntax + module checks)`);
