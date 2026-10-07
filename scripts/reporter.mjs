// Vitest reporter: `--reporter=<path to this file>`, output path in RESULTS_FILE.
// Unlike the built-in JSON reporter, it records each test's `mode` next to its
// result. `mode: 'skip'` means a skipIf/runIf gate skipped the test on purpose.
// `state: 'skipped'` with `mode: 'run'` means it was meant to run but did not,
// for example because a hook failed.
import fs from 'node:fs'

export default class ResultsReporter {
  onTestRunEnd(testModules) {
    const files = testModules.map((m) => ({
      file: m.relativeModuleId,
      state: m.state(),
      error: firstLine(m.errors()[0]?.message),
      tests: [...m.children.allTests()].map((t) => {
        const result = t.result()
        return {
          name: t.fullName,
          mode: t.options.mode,
          state: result.state,
          ...(result.state === 'failed' ? { error: firstLine(result.errors?.[0]?.message) } : {}),
        }
      }),
    }))
    fs.writeFileSync(process.env.RESULTS_FILE, JSON.stringify({ files }))
  }
}

function firstLine(message) {
  return message?.split('\n')[0].slice(0, 300)
}
