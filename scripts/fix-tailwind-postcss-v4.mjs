import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

console.log('[1/2] Installing Tailwind v4 PostCSS plugin...');
run('npm install -D @tailwindcss/postcss');

console.log('[2/2] Rewriting postcss.config.js for Tailwind v4...');
writeFileSync(
  'postcss.config.js',
  `export default {\n  plugins: {\n    '@tailwindcss/postcss': {},\n    autoprefixer: {},\n  },\n};\n`,
  'utf8'
);

console.log('Done. Restart dev server: npm run dev -- --host');
