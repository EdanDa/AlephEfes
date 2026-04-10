# Run this from repo root on a machine that has npm registry access.
# Example: powershell -ExecutionPolicy Bypass -File .\scripts\complete-tailwind-migration.ps1

$ErrorActionPreference = "Stop"

Write-Host "[1/7] Installing Tailwind build dependencies..."
npm install -D tailwindcss postcss autoprefixer

Write-Host "[2/7] Writing tailwind.config.js..."
@'
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
'@ | Set-Content -Encoding UTF8 tailwind.config.js

Write-Host "[3/7] Writing postcss.config.js..."
@'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
'@ | Set-Content -Encoding UTF8 postcss.config.js

Write-Host "[4/7] Creating src/styles/tailwind.css..."
New-Item -ItemType Directory -Force -Path src/styles | Out-Null
@'
@tailwind base;
@tailwind components;
@tailwind utilities;
'@ | Set-Content -Encoding UTF8 src/styles/tailwind.css

Write-Host "[5/7] Ensuring src/main.jsx imports Tailwind css..."
$mainPath = 'src/main.jsx'
$main = Get-Content $mainPath -Raw
if ($main -notmatch "./styles/tailwind.css") {
  $main = $main -replace "import App from './App';", "import App from './App';`nimport './styles/tailwind.css';"
  Set-Content -Encoding UTF8 $mainPath $main
}

Write-Host "[6/7] Removing runtime CDN/config script refs from index.html..."
$indexPath = 'index.html'
$index = Get-Content $indexPath -Raw
$index = $index -replace "(?m)^\s*<script src=\"/tailwind-runtime-config\.js\"></script>\r?\n", ""
$index = $index -replace "(?m)^\s*<script src=\"https://cdn\.tailwindcss\.com\"></script>\r?\n", ""
Set-Content -Encoding UTF8 $indexPath $index

Write-Host "[7/7] Running validation..."
npm run check

Write-Host "Tailwind build-time migration steps completed."
Write-Host "Next: delete public/tailwind-runtime-config.js if no longer needed, then commit changes."
