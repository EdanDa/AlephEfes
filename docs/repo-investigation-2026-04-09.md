# Repository investigation (2026-04-09)

## Executive summary

The repository is healthy in that tests and production build both pass, but it has medium-term maintainability and delivery risks that are fixable with incremental refactors.

Top priorities:
1. **Eliminate duplicated core-analysis logic between `App.jsx` and `analysisCore.js`.**
2. **Split the 3.5k-line `App.jsx` into focused modules/components.**
3. **Replace CDN Tailwind in `index.html` with a build-time Tailwind pipeline.**
4. **Add static quality gates (lint/format/type-check) to CI and local scripts.**
5. **Strengthen resilience around worker + fallback behavior and add perf regression checks.**

---

## What I reviewed

- Runtime/build metadata and scripts (`package.json`).
- App shell and styling bootstrap (`index.html`, `src/main.jsx`).
- Core numeric engine (`src/core/analysisCore.js`).
- UI/state implementation (`src/App.jsx`, `src/state/appReducer.js`, `src/components/VirtualizedList.jsx`).
- Worker offloading path (`src/workers/coreResults.worker.js`).
- Existing automated tests under `tests/`.

---

## Strengths observed

- **Fast feedback loop exists already**: unit tests (`node --test`) and production bundling (`vite build`) both pass.
- **Good separation intent** is visible (`core/`, `state/`, `workers/`, `components/`), even though not fully realized in the main app file yet.
- **Domain logic has direct tests** for core calculators, query semantics, reducer transitions, and formatting helpers.
- **Worker path exists** for heavy analysis and main-thread fallback is implemented.

---

## Key improvement opportunities

### 1) Remove duplicated analysis engine code (highest impact)

`src/App.jsx` duplicates large portions of the logic that also lives in `src/core/analysisCore.js` (prime sieve, layer matching, value tables, input normalization, word computation, and full `computeCoreResults`).

Why this matters:
- Bug fixes can silently diverge between two engines.
- Test coverage mostly targets `core/*` modules, so duplicated app-local logic can drift untested.
- It increases bundle size and cognitive load for contributors.

Suggested plan:
- Make `analysisCore.js` the **single source of truth**.
- In `App.jsx`, replace duplicated helpers with imports from `core/*`.
- Add one snapshot/contract test to ensure worker results and direct-call results stay identical for the same input/mode.

Effort: **M** (1-2 focused PRs)

---

### 2) Decompose `App.jsx` (3,531 LOC) into feature modules

Current file size makes safe change velocity hard.

Suggested split:
- `src/features/lines/*`
- `src/features/clusters/*`
- `src/features/hotWords/*`
- `src/hooks/useCoreResultsWorker.js`
- `src/hooks/useThemeSync.js`
- `src/lib/visibility.js` (layer/prime visibility rules)

Refactor strategy:
- Move pure helpers first (no behavior change).
- Extract presentational sections next.
- Keep reducer/actions stable while moving call sites.
- Add shallow render smoke tests for each extracted feature panel.

Effort: **L** (staged across several small PRs)

---

### 3) Move Tailwind from CDN to build-time pipeline

`index.html` currently loads Tailwind from CDN (`https://cdn.tailwindcss.com`).

Risks:
- Runtime dependency on external network/CDN availability.
- Less deterministic builds and harder CSP hardening.
- Missed benefits of purge/minification and class analysis.

Suggested plan:
- Add `tailwindcss`, `postcss`, `autoprefixer`.
- Generate `tailwind.config.js` and CSS entry.
- Keep dark-mode class strategy (`darkMode: 'class'`) as currently used.

Effort: **S/M**

---

### 4) Add quality gates beyond tests

Current scripts include `test`, `build`, and `check`, but no linting or formatting checks.

Suggested additions:
- `eslint` + `eslint-plugin-react` (+ hooks rules).
- `prettier` and optional `lint-staged` for pre-commit.
- Optional TypeScript migration plan (or `// @ts-check` + JSDoc as an intermediate step).

Minimum useful CI gate:
- `npm run lint`
- `npm test`
- `npm run build`

Effort: **S**

---

### 5) Improve worker/fallback observability and performance safety

The app correctly creates a worker and falls back to main-thread compute when unavailable, but there is no explicit telemetry/perf budget.

Suggested enhancements:
- Track analysis latency percentile (`p50/p95`) by text size bucket.
- Log worker failures and fallback rate (dev-only or optional diagnostics panel).
- Add a perf regression benchmark for representative inputs (small/medium/large corpora).

Effort: **S/M**

---

### 6) Documentation cleanup and contributor UX

README contains repeated run instructions and mixes product usage, long research narrative, and setup details.

Suggested cleanup:
- Keep README concise: purpose, install, run, test, architecture map.
- Move long-form research narrative to `docs/research/`.
- Add `CONTRIBUTING.md` (branching, commit style, test expectations).

Effort: **S**

---

## Prioritized roadmap (suggested)

### Phase 1 (quick wins, 1 week)
- Add lint/format scripts and CI check workflow.
- README simplification + CONTRIBUTING guide.
- Add one parity test: `App` path vs `analysisCore` results.

### Phase 2 (stability, 1-2 weeks)
- Consolidate all analysis helpers into `core/` modules.
- Remove duplicated logic from `App.jsx`.
- Add worker diagnostics and fallback counters.

### Phase 3 (maintainability/perf, 2-4 weeks)
- Break `App.jsx` into feature modules/hooks.
- Adopt build-time Tailwind pipeline.
- Introduce perf benchmark job and bundle-size budget tracking.

---

## Suggested first implementation PR

**Title**: "refactor: make `analysisCore` the single compute source"

Scope:
- Import and use `computeCoreResults` + normalization helpers from `src/core/analysisCore.js` in app runtime paths.
- Remove duplicated helper implementations from `App.jsx` where safe.
- Add parity tests for worker and direct compute consistency.
- No UI changes.

Success criteria:
- Existing tests pass.
- Build output remains healthy.
- Functional behavior unchanged for representative Hebrew inputs.

