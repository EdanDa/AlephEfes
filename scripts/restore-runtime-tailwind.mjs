import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';

const indexPath = 'index.html';
const mainPath = 'src/main.jsx';

const runtimeHead = `<title>Aleph Code Calculator</title>
  <script>
    (() => {
      let stored = null;
      try {
        stored = localStorage.getItem('alephTheme');
      } catch (_err) {
        stored = null;
      }

      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = stored ? stored === 'dark' : prefersDark;

      document.documentElement.classList.toggle('dark', isDark);

      const applyBodyTheme = () => {
        if (document.body) document.body.classList.toggle('dark', isDark);
      };

      if (document.body) {
        applyBodyTheme();
      } else {
        document.addEventListener('DOMContentLoaded', applyBodyTheme, { once: true });
      }
    })();
  </script>
  <script>
    tailwind = { config: { darkMode: 'class' } };
  </script>
  <script src="https://cdn.tailwindcss.com"></script>`;

if (existsSync(indexPath)) {
  let index = readFileSync(indexPath, 'utf8');

  index = index
    .replace(/\s*<script src="\/theme-init\.js"><\/script>\n?/g, '\n')
    .replace(/\s*<script src="\/tailwind-runtime-config\.js"><\/script>\n?/g, '\n');

  if (!index.includes('https://cdn.tailwindcss.com')) {
    index = index.replace(/<title>Aleph Code Calculator<\/title>/, runtimeHead);
  }

  writeFileSync(indexPath, index, 'utf8');
}

if (existsSync(mainPath)) {
  let main = readFileSync(mainPath, 'utf8');
  main = main.replace("\nimport './styles/tailwind.css';", '');
  main = main.replace("import './styles/tailwind.css';\n", '');
  writeFileSync(mainPath, main, 'utf8');
}

if (existsSync('src/styles/tailwind.css')) rmSync('src/styles/tailwind.css');
if (existsSync('tailwind.config.js')) rmSync('tailwind.config.js');
if (existsSync('postcss.config.js')) rmSync('postcss.config.js');
if (existsSync('public/theme-init.js')) rmSync('public/theme-init.js');
if (existsSync('public/tailwind-runtime-config.js')) rmSync('public/tailwind-runtime-config.js');

console.log('Runtime Tailwind setup restored (inline scripts in index.html).');
console.log('Run: npm install && npm run dev -- --host');
