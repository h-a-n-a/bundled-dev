# bundled-dev

Performance of Vite bundled dev (`vite --experimentalBundle`) compared with Vite dev (`vite`) on real open-source apps.

| App | Folder | Vite | rolldown |
|---|---|---|---|
| tldraw `apps/examples` | [`tldraw/`](tldraw/README.md) | 8.3.3 | `c532f8106` (1.2.12 + #11127 + #11126) |

## Test compatibility dashboard

The site in this repo shows how many of Vite's playground tests that apply to bundled dev pass in bundled dev, with and without SSR specs. It is a Vite + React app, developed with bundled dev itself:

```sh
pnpm install
pnpm dev        # vite --experimentalBundle
pnpm dev:plain  # vite
```

The `Vite Tests` workflow (`.github/workflows/vite-tests.yml`) runs every night:

1. Checks out `vitejs/vite` main into `vite/` and builds it.
2. Runs the playground tests three times: in bundled dev, in plain dev and in build. The bundled-dev skips in Vite's tests stay as they are. `scripts/reporter.mjs` records each test's result and mode, and for a `bundled-dev/*` tag also its `meta.reason` and `meta.issues`.
3. `scripts/compare.mjs` writes `results/runs/<date>.json` and adds a summary row to `results/history.json`. The trend only needs the summary rows, which are kept forever. Full runs older than 30 days are deleted (`KEEP_RUN_DAYS`).
4. Commits `results/` and deploys the site to Void.

To run it locally against a Vite checkout:

```sh
cd ../vite
VITE_TEST_BUNDLED_DEV=1 RESULTS_FILE=$PWD/bundled.json pnpm exec vitest run -c vitest.config.e2e.ts --reporter=../bundled-dev/scripts/reporter.mjs
RESULTS_FILE=$PWD/plain.json pnpm exec vitest run -c vitest.config.e2e.ts --reporter=../bundled-dev/scripts/reporter.mjs
VITE_TEST_BUILD=1 RESULTS_FILE=$PWD/build.json pnpm exec vitest run -c vitest.config.e2e.ts --reporter=../bundled-dev/scripts/reporter.mjs
cd ../bundled-dev
node scripts/compare.mjs ../vite/bundled.json ../vite/plain.json ../vite/build.json results
```

### Pass rate

Tests are matched across the three runs by spec file and full test name. Each test gets the status of the first rule that matches:

| # | Rule | Status | In the rate |
|---|---|---|---|
| 1 | Bundled dev passed it | pass | yes, as a pass |
| 2 | Bundled dev failed it | fail | yes, as a gap |
| 3 | Tagged `bundled-dev/todo` | todo | yes, as a gap |
| 4 | Bundled dev meant to run it but has no result (a hook failed) | not run | yes, as a gap |
| 5 | Tagged `bundled-dev/unsupported` | unsupported | no, by design |
| 6 | Bundled dev skipped it without a tag, and plain dev runs it | waiting for triage (`todo` or `unsupported`?) | yes, as a gap |
| 7 | Not in the bundled-dev run (its spec file is in `bundledDevExclude`), and plain dev runs it | waiting for triage | yes, as a gap |
| 8 | Plain dev does not run it either, and build runs it | build-only | no |
| 9 | No run runs it | skipped in every mode | no |
| – | Its spec has its own `serve.ts` that does not call `startDefaultServe`, and the spec is an SSR spec (applied after rules 1–9, except to `unsupported`) | waiting for triage | yes, as a gap |
| – | The same, in a spec that is not an SSR spec | – | no |

An own-server spec never turns on bundled dev: the bundled-dev run runs it in plain dev. In an SSR spec, its tests are waiting for triage, a gap: they have no bundled-dev result yet, and an SSR app runs Vite inside its own server, so bundled dev has to work there. The first step is to turn on bundled dev in that spec's server. In any other spec (`cli`, `proxy-hmr`, `lib`, …), the own server is only test setup, so its tests do not count.

- `FIXES` in `compare.mjs` sets the status of tests that the rules put in the wrong group. An example is a bundled-dev test hidden by `test.skip`. Fix each one in Vite (a tag or a rename), then remove it from the list.

The pass rate is pass / (pass + gap). The page shows two pass rates: with SSR (every spec) and without SSR (every spec whose path does not contain `ssr`).

Rules 6 and 7 count an untagged skip as a gap, even when it may be by design. So the rate can only be too low. Tagging the skips in Vite (`bundledDevTodo` / `bundledDevUnsupported`) makes it exact. The build run never changes the rate: it only tells rules 8 and 9 apart.
