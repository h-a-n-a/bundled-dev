# bundled-dev

Performance of Vite bundled dev (`vite --experimentalBundle`) compared with Vite dev (`vite`) on real open-source apps.

| App | Folder | Vite | rolldown |
|---|---|---|---|
| tldraw `apps/examples` | [`tldraw/`](tldraw/README.md) | 8.3.3 | `c532f8106` (1.2.12 + #11127 + #11126) |

## Test compatibility dashboard

The site in this repo shows how many of Vite's playground tests that pass in plain dev also pass in bundled dev. It is a Vite + React app, developed with bundled dev itself:

```sh
pnpm install
pnpm dev        # vite --experimentalBundle
pnpm dev:plain  # vite
```

The `Vite Tests` workflow (`.github/workflows/vite-tests.yml`) runs every night:

1. Checks out `vitejs/vite` main into `vite/` and builds it.
2. `scripts/unskip.mjs` turns off the bundled-dev skips in Vite's tests, so every test gets a real result.
3. Runs the playground tests in plain dev and in bundled dev. `scripts/reporter.mjs` records each test's result.
4. `scripts/compare.mjs` writes `results/runs/<date>.json` and adds a summary row to `results/history.json`.
5. Commits `results/` and deploys the site to Void.

To run it locally against a Vite checkout:

```sh
node scripts/unskip.mjs ../vite
cd ../vite
RESULTS_FILE=$PWD/plain.json pnpm exec vitest run -c vitest.config.e2e.ts --reporter=../bundled-dev/scripts/reporter.mjs
VITE_TEST_BUNDLED_DEV=1 RESULTS_FILE=$PWD/bundled.json pnpm exec vitest run -c vitest.config.e2e.ts --reporter=../bundled-dev/scripts/reporter.mjs
cd ../bundled-dev
node scripts/compare.mjs ../vite/plain.json ../vite/bundled.json results
```

`unskip.mjs` changes files in the Vite checkout, so use a checkout without your own changes.
