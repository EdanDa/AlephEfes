# Tailwind build-time migration plan and blocker report

## Current blocker

Build-time Tailwind migration is blocked in this execution environment by network/security policy:

- `npm install -D tailwindcss postcss autoprefixer` returns HTTP 403.
- Direct binary download attempt from GitHub releases (`tailwindcss-linux-x64`) also returns HTTP 403 tunnel failure.

Because of this, adding official Tailwind/PostCSS packages (or standalone CLI) was not possible from this environment.

## What has already been done toward migration

- Runtime dark-mode and Tailwind config scripts were moved out of inline HTML into:
  - `public/theme-init.js`
  - `public/tailwind-runtime-config.js`
- `index.html` now references these files explicitly, reducing inline script coupling.

## Final steps to complete migration (when package access is available)

1. Install dependencies:
   - `tailwindcss`
   - `@tailwindcss/postcss`
   - `postcss`
   - `autoprefixer`
2. Create config files:
   - `tailwind.config.js` with `darkMode: 'class'` and `content` globs for `index.html`, `src/**/*.{js,jsx}`.
   - `postcss.config.js` using `@tailwindcss/postcss` + Autoprefixer.
3. Add source CSS file, e.g. `src/styles/tailwind.css`:
   - `@tailwind base;`
   - `@tailwind components;`
   - `@tailwind utilities;`
4. Import the generated stylesheet from `src/main.jsx`.
5. Remove runtime CDN script from `index.html`:
   - Remove `https://cdn.tailwindcss.com`
   - Remove `public/tailwind-runtime-config.js` reference.
6. Add build check to CI:
   - Optional: `npm run tailwind:build` or ensure Vite/PostCSS handles generation in `npm run build`.

## Acceptance criteria

- No `https://cdn.tailwindcss.com` reference remains.
- Styling remains visually equivalent in light and dark mode.
- `npm run check` continues to pass locally and in CI.
