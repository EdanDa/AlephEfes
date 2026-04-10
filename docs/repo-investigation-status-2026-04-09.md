# Repo investigation execution status (2026-04-09)

This checklist tracks implementation status against the key actions from `docs/repo-investigation-2026-04-09.md` (excluding README work by request).

## 1) Remove duplicated analysis logic between `App.jsx` and `analysisCore.js`

**Status: Mostly done (core compute path + helpers centralized).**

- `App.jsx` now imports key analysis helpers directly from `src/core/analysisCore`.
- Worker/fallback orchestration was extracted and uses `computeCoreResults` from `analysisCore`.

Remaining follow-up:
- Additional decomposition work is still possible in `App.jsx` for state/UI concerns not in `analysisCore`.

## 2) Break up the ~3.5k-line `App.jsx`

**Status: Partially done.**

- Added `src/hooks/useCoreResultsEngine.js` and moved heavy compute orchestration out of `AppProvider`.
- `App.jsx` is still large and should continue to be split into feature modules/hooks.

## 3) Replace CDN Tailwind with build-time Tailwind pipeline

**Status: Not done yet.**

- `index.html` still uses `https://cdn.tailwindcss.com`.
- Build-time migration is blocked in this environment because package installation from npm registry returned HTTP 403 policy errors.
- Prep work completed: moved inline runtime Tailwind/theme bootstrap scripts into standalone files under `public/` to simplify eventual replacement with build-time assets.

## 4) Add lint/format/type-oriented quality gates (local + CI)

**Status: Done (with no-dependency gates).**

- Added scripts: `lint`, `typecheck`, `perf:check`, `check`.
- Added CI workflow that runs `npm run check` on push and pull request.

## 5) Add worker/fallback observability + perf regression checks

**Status: Done.**

- Hook now tracks worker availability, fallback count, worker success/error counts, and last duration.
- UI displays engine runtime stats.
- Added performance regression tests and a perf check script.
