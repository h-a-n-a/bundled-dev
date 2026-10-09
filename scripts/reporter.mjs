// Vitest reporter: `--reporter=<path to this file>`, output path in RESULTS_FILE.
// Unlike the built-in JSON reporter, it records each test's `mode` next to its
// result. `mode: 'skip'` means a gate or tag skipped the test on purpose.
// `state: 'skipped'` with `mode: 'run'` means it was meant to run but did not,
// for example because a hook failed.
import fs from 'node:fs'
import path from 'node:path'

const TAGS = ['bundled-dev/todo', 'bundled-dev/unsupported']

export default class ResultsReporter {
  onTestRunEnd(testModules) {
    const files = testModules.map((m) => ({
      file: m.relativeModuleId,
      state: m.state(),
      error: firstLine(m.errors()[0]?.message),
      ...(startsOwnServer(m.moduleId) ? { ownServer: true } : {}),
      tests: [...m.children.allTests()].map((t) => {
        const result = t.result()
        const tag = t.tags.find((name) => TAGS.includes(name))?.slice('bundled-dev/'.length)
        const { reason, issues } = t.meta()
        return {
          name: t.fullName,
          mode: t.options.mode,
          state: result.state,
          ...(tag ? { tag, reason, ...(issues ? { issues } : {}) } : {}),
          ...(result.state === 'failed' ? { error: firstLine(result.errors?.[0]?.message) } : {}),
        }
      }),
    }))
    fs.writeFileSync(process.env.RESULTS_FILE, JSON.stringify({ files }))
  }
}

// `playground/vitestSetup.ts` uses a `serve.ts`/`serve.js` next to the spec
// instead of its default server. Only the default server
// (`startDefaultServe`) turns on bundled dev, so the other ones run plain dev.
function startsOwnServer(specFile) {
  for (const name of ['serve.ts', 'serve.js']) {
    const file = path.join(path.dirname(specFile), name)
    if (fs.existsSync(file)) return !fs.readFileSync(file, 'utf8').includes('startDefaultServe')
  }
  return false
}

function firstLine(message) {
  return message?.split('\n')[0].slice(0, 300)
}
