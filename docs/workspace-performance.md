# Research workspace performance

Measured on 2026-10-21 using production builds, installed Chrome with Pixel 7
emulation at 390×844, no CPU throttling, and five fresh browser contexts per
version. Genesis contains 20,612 word occurrences. The groups and network were
scrolled into view before measurement. Network long tasks were observed for five
seconds after opening the view. No other browser suites ran concurrently.

| Median | Before (`e68535f`) | Workspace stage 1 |
|---|---:|---:|
| Analysis ready, ms | 2,191 | 1,541 |
| Mounted document elements in groups | 85,583 | 495 |
| Network main-thread long-task time, ms | 4,405 | 0 |
| Network long tasks | 50 | 0 |

All five updated network runs recorded zero tasks above the Long Tasks API's
50 ms threshold. This does not mean zero CPU usage: layout now runs in a worker,
canvas drawing remains on the main thread, and shorter tasks are not counted.
Results are local browser emulation, not a physical Android-device benchmark.

The groups regression test checks the bounded DOM and verifies that JSON still
contains every distinct word in the complete Genesis analysis. Existing export
and corpus tests continue to validate counts and definitions.

Reproduce with `scripts/browser-benchmark.mjs` against Vite production preview;
set `BENCHMARK_URL` and, if required, `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`.
Raw local reports are under `.cache/verification/workspace-*-visible.json`.

## Final workspace, inspector and notes

Repeated on 2026-10-22 after the interface revisions and research tools, using
the same conditions and five fresh contexts for each build. No other browser
tests ran during measurement.

| Median | Before (`e68535f`) | Final workspace |
|---|---:|---:|
| Analysis ready, ms | 2,051 | 1,450 |
| Mounted document elements in groups | 85,583 | 706 |
| Network main-thread long-task time, ms | 3,963 | 0 |
| Network long tasks | 71 | 0 |

The final groups view is below the 5,000-element limit, and network main-thread
long-task time is reduced by more than the required 50%. Every final network run
recorded zero tasks exceeding 50 ms. Complete exports and corpus counts remain
covered by the regression suite. Reports:
`.cache/verification/workspace-final-baseline.json` and
`.cache/verification/workspace-final.json`.
