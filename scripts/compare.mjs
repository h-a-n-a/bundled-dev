// usage: node compare.mjs <plain.json> <bundled.json> <results dir>
// Inputs are reporter.mjs outputs of Vite's playground tests, run with `vite`
// (plain dev) and with `VITE_TEST_BUNDLED_DEV=1` after unskip.mjs.
// Run metadata comes from env: VITE_COMMIT, ROLLDOWN_VERSION, RUN_URL.
// Writes <results dir>/runs/<date>.json and adds the run's summary to
// <results dir>/history.json, which the dashboard loads up front.
//
// Only tests that pass in plain dev are compared. In bundled dev each one is:
//   pass     passes
//   fail     fails
//   not-run  meant to run but has no result (a hook failed or the file crashed)
//   n/a      a gate skips it in bundled dev, as in build (`runIf(!isBundled)`)
// The pass rate is pass / (pass + fail + not-run).
import fs from 'node:fs'
import path from 'node:path'

const [plainFile, bundledFile, resultsDir] = process.argv.slice(2)
if (!resultsDir) throw new Error('usage: node compare.mjs <plain.json> <bundled.json> <results dir>')

const load = (file) =>
  new Map(JSON.parse(fs.readFileSync(file, 'utf8')).files.map((f) => [f.file, f]))
const plain = load(plainFile)
const bundled = load(bundledFile)

function bundledStatus(t) {
  if (!t) return 'not-run'
  if (t.mode === 'skip' || t.mode === 'todo') return 'n/a'
  if (t.state === 'passed') return 'pass'
  if (t.state === 'failed') return 'fail'
  return 'not-run'
}

const files = []
for (const [file, p] of [...plain].sort(([a], [b]) => a.localeCompare(b))) {
  const b = bundled.get(file)
  const bundledTests = new Map(b?.tests.map((t) => [t.name, t]))
  const tests = p.tests
    .filter((t) => t.state === 'passed')
    .map((t) => {
      const bt = bundledTests.get(t.name)
      const status = bundledStatus(bt)
      return status === 'fail' ? { name: t.name, status, error: bt.error } : { name: t.name, status }
    })
  const counted = tests.filter((t) => t.status !== 'n/a')
  if (counted.length === 0) continue
  const passed = counted.filter((t) => t.status === 'pass').length
  files.push({
    file,
    playground: file.split('/')[1],
    total: counted.length,
    passed,
    status: passed === counted.length ? 'pass' : passed === 0 ? 'fail' : 'partial',
    ...(b?.error ? { error: b.error } : {}),
    tests,
  })
}

const total = files.reduce((n, f) => n + f.total, 0)
const passed = files.reduce((n, f) => n + f.passed, 0)
const date = new Date().toISOString()
const run = {
  date,
  viteCommit: process.env.VITE_COMMIT,
  rolldownVersion: process.env.ROLLDOWN_VERSION,
  runUrl: process.env.RUN_URL,
  summary: {
    total,
    passed,
    files: files.length,
    filesPassing: files.filter((f) => f.status === 'pass').length,
  },
}

const day = date.slice(0, 10)
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
fs.mkdirSync(path.join(resultsDir, 'runs'), { recursive: true })
writeJson(path.join(resultsDir, 'runs', `${day}.json`), { ...run, files })

// One entry per day; a second run on the same day replaces the first.
const historyFile = path.join(resultsDir, 'history.json')
const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : []
writeJson(historyFile, [...history.filter((h) => h.date.slice(0, 10) !== day), run])

console.log(
  `bundled dev: ${passed}/${total} tests (${((passed / total) * 100).toFixed(1)}%), ` +
    `${run.summary.filesPassing}/${run.summary.files} files fully passing`,
)
