import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HistoryChart } from './HistoryChart'
import {
  history,
  loadRun,
  percent,
  rate,
  type FileResult,
  type FileStatus,
  type Issues,
  type Run,
  type Summary,
  type TestResult,
  type TestStatus,
} from './data'

const VITE_REPO = 'https://github.com/vitejs/vite'

const ISSUE_REPOS: Record<keyof Issues, string> = {
  vite: 'vitejs/vite',
  rolldown: 'rolldown/rolldown',
}

const issueList = (issues: Issues = {}) =>
  (Object.keys(ISSUE_REPOS) as (keyof Issues)[]).flatMap((repo) =>
    (issues[repo] ?? []).map((n) => ({
      label: `${repo}#${n}`,
      url: `https://github.com/${ISSUE_REPOS[repo]}/issues/${n}`,
    })),
  )

const FILE_STATUS: Record<FileStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  partial: { icon: '◐', label: 'Partial' },
  fail: { icon: '✕', label: 'Fail' },
  'not-counted': { icon: '·', label: 'Not counted' },
}

const TEST_STATUS: Record<TestStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  fail: { icon: '✕', label: 'Fail' },
  todo: { icon: '○', label: 'Todo' },
  'not-run': { icon: '–', label: 'Not run' },
  triage: { icon: '↷', label: 'Waiting for triage' },
  unsupported: { icon: '·', label: 'Unsupported, not counted' },
}

const GAP_STATUSES: TestStatus[] = ['fail', 'not-run', 'todo', 'triage']

// One square per test in the test grid, in this order.
const DOT_LEGEND: { status: TestStatus; label: string }[] = [
  { status: 'pass', label: 'Pass' },
  { status: 'fail', label: 'Fail' },
  { status: 'not-run', label: 'Not run' },
  { status: 'todo', label: 'Todo' },
  { status: 'triage', label: 'Waiting for triage' },
  { status: 'unsupported', label: 'Unsupported, not counted' },
]

type Filter = 'all' | 'failing' | FileStatus

interface Group {
  playground: string
  files: FileResult[]
  passed: number
  total: number
}

function groupStatus(g: { passed: number; total: number }): FileStatus {
  return g.total === 0 ? 'not-counted' : g.passed === g.total ? 'pass' : g.passed === 0 ? 'fail' : 'partial'
}

// SSR specs only: the difference between the two saved scopes.
const ssrOnly = (s: Record<'all' | 'noSsr', Summary>) => ({
  passed: s.all.passed - s.noSsr.passed,
  total: s.all.total - s.noSsr.total,
  statuses: Object.fromEntries(
    Object.keys(s.all.statuses).map((k) => [k, s.all.statuses[k as TestStatus] - s.noSsr.statuses[k as TestStatus]]),
  ) as Record<TestStatus, number>,
})

const NOT_KEPT = 'Only the summary of this run is kept. Test details are kept for the last 30 days.'

// "744/1057 tests passed, 34 todo, 279 waiting for triage" for the chart tooltip.
function tooltipDetail(s: Pick<Summary, 'passed' | 'total' | 'statuses'>) {
  const gaps = (['fail', 'not-run', 'todo', 'triage'] as const)
    .filter((k) => s.statuses[k] > 0)
    .map((k) => `${s.statuses[k]} ${TEST_STATUS[k].label.toLowerCase()}`)
  return [`${s.passed}/${s.total} tests passed`, ...gaps].join(', ')
}

const fileId = (file: string) => `file-${file.replace(/[^\w-]/g, '-')}`

export function App() {
  const latest = history.at(-1)
  const [selected, setSelected] = useState(latest?.date ?? '')
  // undefined while loading; null when the run's details were pruned.
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [filter, setFilter] = useState<Filter>('failing')
  const [query, setQuery] = useState('')
  const [showSsr, setShowSsr] = useState(false)
  const [reveal, setReveal] = useState<string | null>(null)
  const [gridScope, setGridScope] = useState<'all' | 'ssr'>('all')

  useEffect(() => {
    if (!selected) return
    let current = true
    setRun(undefined)
    loadRun(selected).then((r) => current && setRun(r))
    return () => {
      current = false
    }
  }, [selected])

  // Open and scroll to a file picked in the file grid, once its row is rendered.
  useEffect(() => {
    if (!reveal) return
    const el = document.getElementById(fileId(reveal))
    if (!el) return
    el.closest('.groups > li')?.querySelector('details')?.setAttribute('open', '')
    el.querySelector('details')?.setAttribute('open', '')
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setReveal(null)
  })

  const groups = useMemo(() => {
    if (!run) return []
    const q = query.trim().toLowerCase()
    const byPlayground = new Map<string, Group>()
    // Hidden SSR specs leave the totals too. Otherwise totals count every file of a playground,
    // and the status filter and search only pick which files are listed.
    for (const f of run.files) {
      if (f.ssr && !showSsr) continue
      const g = byPlayground.get(f.playground) ?? { playground: f.playground, files: [], passed: 0, total: 0 }
      g.passed += f.passed
      g.total += f.total
      byPlayground.set(f.playground, g)
      if (filter === 'failing' ? f.status === 'pass' || f.status === 'not-counted' : filter !== 'all' && f.status !== filter)
        continue
      if (q && !f.file.toLowerCase().includes(q) && !f.tests.some((t) => t.name.toLowerCase().includes(q)))
        continue
      g.files.push(f)
    }
    // Most failing tests first: that is where the work is.
    return [...byPlayground.values()].filter((g) => g.files.length > 0).sort(
      (a, b) => b.total - b.passed - (a.total - a.passed) || a.playground.localeCompare(b.playground),
    )
  }, [run, filter, query, showSsr])

  const allTests = useMemo(
    () => run?.files.flatMap((f) => f.tests.map((test) => ({ file: f.file, ssr: f.ssr, test }))),
    [run],
  )
  const ssrCount = useMemo(() => allTests?.filter((t) => t.ssr).length ?? 0, [allTests])
  const tests = useMemo(
    () => (gridScope === 'ssr' ? allTests?.filter((t) => t.ssr) : allTests),
    [allTests, gridScope],
  )
  const counts = useMemo(() => {
    const c = {} as Record<TestStatus, number>
    for (const { test } of tests ?? []) c[test.status] = (c[test.status] ?? 0) + 1
    return c
  }, [tests])

  if (!latest) return <main className="page">No results yet.</main>

  const info = run ?? history.find((h) => h.date === selected)!
  const index = history.findIndex((h) => h.date === selected)
  const previous = index > 0 ? history[index - 1] : undefined
  const all = info.summary.all
  const noSsr = info.summary.noSsr
  const since = (now: number, before?: number) =>
    before === undefined || now === before ? '' : ` · ${now > before ? '+' : ''}${now - before} since previous run`

  function showFile(file: string) {
    if (run?.files.find((f) => f.file === file)?.ssr) setShowSsr(true)
    setFilter('all')
    setQuery('')
    setReveal(file)
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Vite bundled dev compatibility</h1>
        <p className="lede">
          Results from Vite's playground tests, run with <code>vite --experimentalBundle</code>. Only tests that apply to
          bundled dev count. Each square below is one test case; the line chart tracks the pass rate across runs.
        </p>
        <p className="meta">
          {index === history.length - 1 ? 'Latest run' : 'Run'}:{' '}
          <strong>{new Date(info.date).toUTCString().replace(' GMT', ' UTC').replace(/:\d\d UTC/, ' UTC')}</strong>
          {info.viteCommit && (
            <>
              {' · '}Vite{' '}
              <a href={`${VITE_REPO}/commit/${info.viteCommit}`}>
                <code>{info.viteCommit.slice(0, 9)}</code>
              </a>
            </>
          )}
          {info.rolldownVersion && (
            <>
              {' · '}rolldown <code>{info.rolldownVersion}</code>
            </>
          )}
          {info.runUrl && (
            <>
              {' · '}
              <a href={info.runUrl}>View run</a>
            </>
          )}
        </p>
      </header>

      <section className="stats" aria-label="Summary">
        <Stat
          value={percent(rate(noSsr))}
          label="Pass rate"
          note={`${noSsr.passed} of ${noSsr.total} tests${since(noSsr.passed, previous?.summary.noSsr.passed)}`}
        />
        <Stat
          value={percent(rate(all))}
          label="Pass rate with SSR"
          note={`${all.passed} of ${all.total} tests${since(all.passed, previous?.summary.all.passed)}`}
        />
        <Stat
          value={
            <>
              {all.filesPassing}
              <small>/{all.files}</small>
            </>
          }
          label="Spec files fully passing"
          note={`${percent(all.filesPassing / all.files)} of spec files`}
        />
        <Stat value={String(all.total - all.passed)} label="Tests to fix" note="with SSR" />
      </section>

      <p className="not-counted">
        Not counted: {all.statuses.unsupported} unsupported ·{' '}
        {all.buildOnly} build-only · {all.everyMode} skipped in every mode · {all.ownServer} in non-SSR specs with their
        own server
      </p>

      <div className="section-head">
        <h2>Test cases and trend</h2>
        <span className="muted">
          {allTests ? `${allTests.length} test cases in this run · ` : ''}last {history.length}{' '}
          {history.length === 1 ? 'run' : 'runs'}
        </span>
      </div>
      <section className="card">
        {allTests && (
          <div className="segmented scope" role="tablist" aria-label="Test cases to show">
            {(
              [
                ['all', `All (${allTests.length})`],
                ['ssr', `SSR (${ssrCount})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                id={`grid-tab-${id}`}
                aria-selected={gridScope === id}
                aria-controls="grid-panel"
                onClick={() => setGridScope(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div id="grid-panel" role="tabpanel" aria-labelledby={`grid-tab-${gridScope}`}>
          <h3>Test cases</h3>
          {run === undefined ? (
            <p className="muted">Loading run…</p>
          ) : !tests ? (
            <p className="muted">{NOT_KEPT}</p>
          ) : (
            <>
              {/* One click handler for the whole grid keeps ~1000 squares out of the tab order. */}
              <div
                className="dots"
                role="img"
                aria-label={`${tests.length} test cases, ${counts.pass ?? 0} passing`}
                onClick={(e) => {
                  const i = (e.target as HTMLElement).dataset.i
                  if (i !== undefined) showFile(tests[Number(i)].file)
                }}
              >
                {tests.map(({ file, test }, i) => (
                  <span
                    key={i}
                    data-i={i}
                    className={`dot dot-${test.status}`}
                    title={`${file.replace(/^playground\//, '')}\n${test.name}\n${TEST_STATUS[test.status].label}${
                      test.reason ? `: ${test.reason}` : ''
                    }${issueList(test.issues).length ? `\n${issueList(test.issues).map((i) => i.label).join(', ')}` : ''}`}
                  />
                ))}
              </div>
              <div className="legend">
                {DOT_LEGEND.filter((l) => counts[l.status] > 0).map((l) => (
                  <span key={l.status}>
                    <span className={`dot dot-${l.status}`} aria-hidden="true" /> {l.label}{' '}
                    <span className="muted">{counts[l.status]}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <h3>Pass rate over time</h3>
          <HistoryChart
            dates={history.map((h) => h.date)}
            series={
              gridScope === 'ssr'
                ? [
                    {
                      label: 'SSR',
                      tipLabel: 'SSR',
                      className: 'series-all',
                      values: history.map((h) => rate(ssrOnly(h.summary))),
                      details: history.map((h) => tooltipDetail(ssrOnly(h.summary))),
                    },
                  ]
                : [
                    {
                      label: 'Pass rate',
                      tipLabel: 'pass rate',
                      className: 'series-no-ssr',
                      values: history.map((h) => rate(h.summary.noSsr)),
                      details: history.map((h) => tooltipDetail(h.summary.noSsr)),
                    },
                    {
                      label: 'Pass rate with SSR',
                      tipLabel: 'with SSR',
                      className: 'series-all',
                      values: history.map((h) => rate(h.summary.all)),
                      details: history.map((h) => tooltipDetail(h.summary.all)),
                    },
                  ]
            }
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      </section>

      <div className="section-head">
        <h2>Results by playground</h2>
      </div>
      <section className="card">
        <div className="toolbar">
          <div className="segmented" role="radiogroup" aria-label="Filter by status">
            {(['failing', 'fail', 'partial', 'pass', 'all'] as const).map((f) => (
              <button key={f} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}>
                {f === 'failing' ? 'Not passing' : f === 'all' ? 'All' : FILE_STATUS[f].label}
              </button>
            ))}
          </div>
          <input
            className="search"
            type="search"
            placeholder="Search files or tests"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="check">
            <input id="show-ssr" type="checkbox" checked={showSsr} onChange={(e) => setShowSsr(e.target.checked)} />
            Show SSR specs
          </label>
        </div>
        {run === undefined ? (
          <p className="muted">Loading run…</p>
        ) : run === null ? (
          <p className="muted">{NOT_KEPT}</p>
        ) : groups.length === 0 ? (
          <p className="muted">No files match.</p>
        ) : (
          <ul className="groups">
            {groups.map((g) => (
              <PlaygroundRow key={g.playground} group={g} />
            ))}
          </ul>
        )}
      </section>

      <details className="how-toggle">
        <summary className="section-head">
          <h2>How this works</h2>
          <span className="muted toggle-label" aria-hidden="true" />
        </summary>
        <section className="card how">
          <p>
            A GitHub Actions job runs every night. It checks out <a href={VITE_REPO}>vitejs/vite</a> main and runs the
            playground tests three times: in bundled dev, in plain dev and in build. The bundled-dev skips in Vite's tests
            stay as they are. Each test gets the result of the first rule that matches:
          </p>
          <ol className="rules">
            <li>
              Bundled dev passed it: <strong>pass</strong>.
            </li>
            <li>
              Bundled dev failed it, it is tagged <code>bundled-dev/todo</code>, or it was meant to run but has no result (a
              hook failed): <strong>gap</strong>.
            </li>
            <li>
              Tagged <code>bundled-dev/unsupported</code>: <strong>not counted</strong>, by design.
            </li>
            <li>
              Bundled dev skipped it without a tag, or its file is in <code>bundledDevExclude</code>, and plain dev runs it:{' '}
              <strong>gap</strong>. A skip without a tag is <em>waiting for triage</em>: it still needs a{' '}
              <code>bundled-dev/todo</code> or <code>bundled-dev/unsupported</code> tag. Some of these may turn out to be unsupported once they are tagged, so the rate can only
              be too low.
            </li>
            <li>
              Plain dev does not run it either (build-only, Windows-only, or <code>test.skip</code>):{' '}
              <strong>not counted</strong>.
            </li>
          </ol>
          <p>
            A spec whose own <code>serve.ts</code> never calls <code>startDefaultServe</code> does not turn on bundled dev:
            the bundled-dev run runs it in plain dev. In an SSR spec its tests are <em>waiting for triage</em>: they have no
            bundled-dev result yet, and an SSR app runs Vite inside its own server, so bundled dev has to work there. In any other spec the own server is only test setup,
            so its tests are not counted. The pass rate is pass / (pass + gap). "Without SSR" leaves out every spec whose
            path contains <code>ssr</code>.
          </p>
          {run && run.fixes.length > 0 && (
            <>
              <p>The three results put these tests in the wrong group, so they are set by hand:</p>
              <ul>
                {run.fixes.map((f) => (
                  <li key={f.file + f.name}>
                    <code>{f.file.replace(/^playground\//, '')}</code> › {f.name}:{' '}
                    {f.status === 'n/a' ? 'not counted' : TEST_STATUS[f.status].label.toLowerCase()}. {f.note}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </details>

      <footer className="footer">
        Built on the <a href="https://void.cloud/">Void</a> platform · Powered by{' '}
        <a href="https://vite.dev/">Vite</a>'s bundled-dev mode{' '}
        <span role="img" aria-label="love">
          ❤️
        </span>
      </footer>
    </main>
  )
}

function Stat({ value, label, note }: { value: ReactNode; label: string; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

function IssueLinks({ issues }: { issues: Issues }) {
  return (
    <span className="test-issues">
      {issueList(issues).map((i) => (
        <a key={i.label} href={i.url}>
          {i.label}
        </a>
      ))}
    </span>
  )
}

function StatusLabel({ status }: { status: FileStatus }) {
  const { icon, label } = FILE_STATUS[status]
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  )
}

function Meter({ passed, total }: { passed: number; total: number }) {
  return (
    <span className="meter" aria-hidden="true">
      <span style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
    </span>
  )
}

function PlaygroundRow({ group }: { group: Group }) {
  return (
    <li>
      <details>
        <summary className="row">
          <span className="name">{group.playground}</span>
          <StatusLabel status={groupStatus(group)} />
          <Meter passed={group.passed} total={group.total} />
          <span className="count">
            {group.passed}/{group.total}
          </span>
        </summary>
        <ul className="files">
          {group.files.map((f) => (
            <FileRow key={f.file} file={f} />
          ))}
        </ul>
      </details>
    </li>
  )
}

// Gaps first, then passes, then tests that do not count.
const order = (t: TestResult) => (GAP_STATUSES.includes(t.status) ? 0 : t.status === 'pass' ? 1 : 2)

function FileRow({ file }: { file: FileResult }) {
  return (
    <li id={fileId(file.file)}>
      <details>
        <summary className="row">
          <span className="name file">
            {file.file.replace(/^playground\//, '')}
            {file.ssr && <span className="badge">SSR</span>}
          </span>
          <StatusLabel status={file.status} />
          <Meter passed={file.passed} total={file.total} />
          <span className="count">
            {file.passed}/{file.total}
          </span>
        </summary>
        <a className="source" href={`${VITE_REPO}/blob/main/${file.file}`}>
          View test file
        </a>
        {file.error && <p className="error">{file.error}</p>}
        <ul className="tests">
          {file.tests
            .toSorted((a, b) => order(a) - order(b))
            .map((t, i) => (
              <li key={`${t.name}-${i}`} className={`test test-${t.status}`}>
                <span className="test-status" title={TEST_STATUS[t.status].label}>
                  <span aria-hidden="true">{TEST_STATUS[t.status].icon}</span>
                  <span className="sr-only">{TEST_STATUS[t.status].label}</span>
                </span>
                <span className="test-name">
                  {t.name}
                  {t.status !== 'pass' && t.status !== 'fail' && <em> · {TEST_STATUS[t.status].label.toLowerCase()}</em>}
                  {t.reason && <span className="test-note">{t.reason}</span>}
                  {t.issues && <IssueLinks issues={t.issues} />}
                  {t.note && <span className="test-note">{t.note}</span>}
                  {t.error && <code className="test-error">{t.error}</code>}
                </span>
              </li>
            ))}
        </ul>
      </details>
    </li>
  )
}
