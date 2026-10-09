// usage: node compare.mjs <bundled.json> <plain.json> <build.json> <results dir>
// Inputs are reporter.mjs outputs of the same Vite playground tests, run with
// `VITE_TEST_BUNDLED_DEV=1`, with plain `vite`, and with `VITE_TEST_BUILD=1`.
// Run metadata comes from env: VITE_COMMIT, ROLLDOWN_VERSION, RUN_URL.
// Writes <results dir>/runs/<date>.json and adds the run's summary to
// <results dir>/history.json, which the dashboard loads up front.
//
// Each test gets the status of the first rule that matches:
//   pass         bundled dev passed it
//   fail         bundled dev failed it
//   todo         tagged `bundled-dev/todo`
//   not-run      bundled dev meant to run it but has no result (a hook failed or the file crashed)
//   unsupported  tagged `bundled-dev/unsupported`: does not apply, by design
//   triage       bundled dev skips it without a tag, or leaves out its whole spec file
//                (`bundledDevExclude`), and plain dev runs it: waiting for triage into
//                `bundled-dev/todo` or `bundled-dev/unsupported`
//   n/a          plain dev does not run it either: build-only, or skipped in every mode
// Then FIXES overrides single tests. A spec whose own `serve.ts` never turns
// on bundled dev runs in plain dev even in the bundled-dev run:
//   triage       in an SSR spec: it has no bundled-dev result yet, and an SSR app
//                runs Vite inside its own server, so bundled dev has to work there
//   (left out)   in any other spec: the own server is only test setup
// The pass rate is pass / (pass + fail + todo + not-run + triage).
// Each run has two scopes: every spec, and every spec except SSR specs.
import fs from 'node:fs'
import path from 'node:path'

const [bundledFile, plainFile, buildFile, resultsDir] = process.argv.slice(2)
if (!resultsDir) {
  throw new Error('usage: node compare.mjs <bundled.json> <plain.json> <build.json> <results dir>')
}

const COUNTED = ['pass', 'fail', 'todo', 'not-run', 'triage']

// The trend only needs the summary rows in history.json, which are kept
// forever. Full runs (every test) are kept this many days, so the repo and the
// site build do not grow without limit.
const KEEP_RUN_DAYS = 30

// Tests the three results put in the wrong group. Fix each one in Vite (a tag
// or a rename), then remove it here.
const FIXES = [
  {
    file: 'playground/hmr-full-bundle-mode/__tests__/hmr-full-bundle-mode.spec.ts',
    name: 'chained invalidate in an import cycle settles',
    status: 'todo',
    note: 'A bundled-dev test that test.skip hides in every mode (rolldown/rolldown#10340).',
  },
  {
    file: 'playground/assets-sanitize/__tests__/assets-sanitize.spec.ts',
    name: 'importing asset with special char in filename works in dev',
    status: 'n/a',
    note: 'The plain-dev copy of "…works in bundled dev".',
  },
]

// file -> test name -> tests with that name, in order
function load(file) {
  const files = new Map()
  for (const f of JSON.parse(fs.readFileSync(file, 'utf8')).files) {
    const tests = new Map()
    for (const t of f.tests) tests.set(t.name, [...(tests.get(t.name) ?? []), t])
    files.set(f.file, { ...f, tests })
  }
  return files
}
const bundled = load(bundledFile)
const plain = load(plainFile)
const build = load(buildFile)

const ran = (t) => t?.state === 'passed' || t?.state === 'failed'

function sort(b, p, u) {
  if (b?.state === 'passed') return 'pass'
  if (b?.state === 'failed') return 'fail'
  if (b?.mode === 'todo') return 'todo'
  if (b?.mode === 'run') return 'not-run'
  if (b?.tag === 'unsupported') return 'unsupported'
  if (ran(p)) return 'triage'
  return ran(u) ? 'build-only' : 'every-mode'
}

const fixes = new Map(FIXES.map((f) => [`${f.file}\0${f.name}`, f]))
const used = new Set()
const notCounted = []
const files = []
for (const file of [...new Set([...bundled.keys(), ...plain.keys(), ...build.keys()])].sort()) {
  const runs = [bundled, plain, build].map((r) => r.get(file))
  const ownServer = runs.some((f) => f?.ownServer)
  const names = new Set(runs.flatMap((f) => (f ? [...f.tests.keys()] : [])))
  const tests = []
  for (const name of names) {
    const [bs, ps, us] = runs.map((f) => f?.tests.get(name) ?? [])
    for (let i = 0; i < Math.max(bs.length, ps.length, us.length); i++) {
      const b = bs[i]
      let status = sort(b, ps[i], us[i])
      let note = status === 'triage' && !b ? 'Its spec file is in bundledDevExclude.' : undefined
      const fix = fixes.get(`${file}\0${name}`)
      if (fix) {
        used.add(fix)
        ;({ status, note } = fix)
      }
      if (status === 'n/a' || status === 'build-only' || status === 'every-mode') {
        notCounted.push({ file, status: status === 'n/a' ? 'every-mode' : status })
        continue
      }
      if (ownServer && status !== 'unsupported') {
        if (!isSsr(file)) {
          notCounted.push({ file, status: 'own-server' })
          continue
        }
        status = 'triage'
        note = 'Its spec starts its own server, which does not turn on bundled dev yet.'
      }
      tests.push({
        name,
        status,
        ...(note ? { note } : {}),
        ...(b?.tag ? { tag: b.tag, reason: b.reason, ...(b.issues ? { issues: b.issues } : {}) } : {}),
        ...(status === 'fail' ? { error: b.error } : {}),
      })
    }
  }
  if (tests.length === 0) continue
  const total = tests.filter((t) => COUNTED.includes(t.status)).length
  const passed = tests.filter((t) => t.status === 'pass').length
  const error = runs[0]?.error
  files.push({
    file,
    playground: file.split('/')[1],
    ssr: isSsr(file),
    total,
    passed,
    status: total === 0 ? 'not-counted' : passed === total ? 'pass' : passed === 0 ? 'fail' : 'partial',
    ...(error ? { error } : {}),
    tests,
  })
}
for (const fix of FIXES) {
  if (!used.has(fix)) console.warn(`compare: fix not used, remove it: ${fix.file} > ${fix.name}`)
}

function isSsr(file) {
  return file.toLowerCase().includes('ssr')
}

function summarize(keep) {
  const fs = files.filter((f) => keep(f.file))
  const tests = fs.flatMap((f) => f.tests)
  const count = (s) => tests.filter((t) => t.status === s).length
  const left = notCounted.filter((t) => keep(t.file))
  const counted = fs.filter((f) => f.total > 0)
  return {
    total: fs.reduce((n, f) => n + f.total, 0),
    passed: fs.reduce((n, f) => n + f.passed, 0),
    files: counted.length,
    filesPassing: counted.filter((f) => f.status === 'pass').length,
    statuses: Object.fromEntries(
      [...COUNTED, 'unsupported'].map((s) => [s, count(s)]),
    ),
    buildOnly: left.filter((t) => t.status === 'build-only').length,
    everyMode: left.filter((t) => t.status === 'every-mode').length,
    ownServer: left.filter((t) => t.status === 'own-server').length,
  }
}

const date = new Date().toISOString()
const run = {
  date,
  viteCommit: process.env.VITE_COMMIT,
  rolldownVersion: process.env.ROLLDOWN_VERSION,
  runUrl: process.env.RUN_URL,
  summary: {
    all: summarize(() => true),
    noSsr: summarize((file) => !isSsr(file)),
  },
}

const day = date.slice(0, 10)
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
const runsDir = path.join(resultsDir, 'runs')
fs.mkdirSync(runsDir, { recursive: true })
writeJson(path.join(runsDir, `${day}.json`), { ...run, fixes: FIXES, files })
const keepFrom = new Date(Date.parse(day) - KEEP_RUN_DAYS * 86_400_000).toISOString().slice(0, 10)
for (const name of fs.readdirSync(runsDir)) {
  if (name.slice(0, 10) < keepFrom) fs.rmSync(path.join(runsDir, name))
}

// One entry per day; a second run on the same day replaces the first.
const historyFile = path.join(resultsDir, 'history.json')
const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : []
writeJson(historyFile, [...history.filter((h) => h.date.slice(0, 10) !== day), run])

for (const [scope, s] of Object.entries(run.summary)) {
  console.log(
    `${scope === 'all' ? 'with SSR   ' : 'without SSR'}: ${s.passed}/${s.total} tests ` +
      `(${((s.passed / s.total) * 100).toFixed(1)}%), ${s.filesPassing}/${s.files} files fully passing`,
  )
}
