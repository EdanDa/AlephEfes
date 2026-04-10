import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

console.log('[1/7] Installing Tailwind build dependencies...');
run('npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer');

console.log('[2/7] Writing tailwind.config.js...');
writeFileSync(
  'tailwind.config.js',
  `/** @type {import('tailwindcss').Config} */\nexport default {\n  darkMode: 'class',\n  content: [\n    './index.html',\n    './src/**/*.{js,jsx}',\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n`,
  'utf8'
);

console.log('[3/7] Writing postcss.config.js...');
writeFileSync(
  'postcss.config.js',
  `export default {\n  plugins: {\n    '@tailwindcss/postcss': {},\n    autoprefixer: {},\n  },\n};\n`,
  'utf8'
);

console.log('[4/7] Creating src/styles/tailwind.css...');
if (!existsSync('src/styles')) mkdirSync('src/styles', { recursive: true });
writeFileSync('src/styles/tailwind.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n', 'utf8');

console.log('[5/7] Ensuring src/main.jsx imports Tailwind css...');
const mainPath = 'src/main.jsx';
let main = readFileSync(mainPath, 'utf8');
if (!main.includes("./styles/tailwind.css")) {
  main = main.replace("import App from './App';", "import App from './App';\nimport './styles/tailwind.css';");
  writeFileSync(mainPath, main, 'utf8');
}

console.log('[6/7] Removing runtime CDN/config script refs from index.html...');
const indexPath = 'index.html';
let index = readFileSync(indexPath, 'utf8');
index = index.replace('<script src="/tailwind-runtime-config.js"></script>\n', '');
index = index.replace('<script src="/tailwind-runtime-config.js"></script>\r\n', '');
index = index.replace('<script src="https://cdn.tailwindcss.com"></script>\n', '');
index = index.replace('<script src="https://cdn.tailwindcss.com"></script>\r\n', '');
writeFileSync(indexPath, index, 'utf8');

console.log('[7/7] Running validation...');
run('npm run check');

console.log('Tailwind build-time migration steps completed.');
console.log('Next: delete public/tailwind-runtime-config.js if no longer needed, then commit changes.');
