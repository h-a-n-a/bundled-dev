#!/usr/bin/env bash
# usage: run-tests.sh <mode name>, from the Vite checkout, with RESULTS_FILE set.
# Runs Vite's playground tests. When any test fails, the whole suite runs again,
# up to 3 more times, and RESULTS_FILE keeps the last run. The whole suite runs
# again, not only the failed test, because each spec file starts one server and
# its tests change files in order: a single retried test would see the state
# that the earlier tests left behind.
set -u

mode="$1"
reporter="$(cd "$(dirname "$0")" && pwd)/reporter.mjs"
max_reruns=3

for ((run = 1; run <= max_reruns + 1; run++)); do
  if pnpm exec vitest run -c vitest.config.e2e.ts --reporter="$reporter" --reporter=dot; then
    exit 0
  fi
  if ((run <= max_reruns)); then
    echo "::warning title=$mode::Tests failed in run $run. Running the suite again."
  fi
done

# Failing tests are the data, so they must not stop the job.
echo "::warning title=$mode::Tests still fail after $max_reruns reruns. The results keep the last run."
