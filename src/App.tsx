import { useEffect, useMemo, useState } from 'react'
import { HistoryChart } from './HistoryChart'
import {
  history,
  loadRun,
  percent,
  rate,
  type FileResult,
  type FileStatus,
  type Run,
  type TestStatus,
} from './data'

const VITE_REPO = 'https://github.com/vitejs/vite'

const FILE_STATUS: Record<FileStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  partial: { icon: '◐', label: 'Partial' },
  fail: { icon: '✕', label: 'Fail' },
}

const TEST_STATUS: Record<TestStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  fail: { icon: '✕', label: 'Fail' },
  'not-run': { icon: '–', label: 'Not run' },
  'n/a': { icon: '·', label: 'Not applicable' },
}

type Filter = 'all' | 'failing' | FileStatus

interface Group {
  playground: string
  files: FileResult[]
  passed: number
  total: number
}

function groupStatus(g: { passed: number; total: number }): FileStatus {
  return g.passed === g.total ? 'pass' : g.passed === 0 ? 'fail' : 'partial'
}

export function App() {
  const latest = history.at(-1)
  const [selected, setSelected] = useState(latest?.date ?? '')
  const [run, setRun] = useState<Run | null>(null)
  const [filter, setFilter] = useState<Filter>('failing')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!selected) return
    let current = true
    loadRun(selected).then((r) => current && setRun(r))
    return () => {
      current = false
    }
  }, [selected])

  const groups = useMemo(() => {
    if (!run) return []
    const q = query.trim().toLowerCase()
    const byPlayground = new Map<string, Group>()
    // Totals count every file of a playground; the filters only pick which files are listed.
    for (const f of run.files) {
      const g = byPlayground.get(f.playground) ?? { playground: f.playground, files: [], passed: 0, total: 0 }
      g.passed += f.passed
      g.total += f.total
      byPlayground.set(f.playground, g)
      if (filter === 'failing' ? f.status === 'pass' : filter !== 'all' && f.status !== filter) continue
      if (q && !f.file.toLowerCase().includes(q) && !f.tests.some((t) => t.name.toLowerCase().includes(q)))
        continue
      g.files.push(f)
    }
    // Most failing tests first: that is where the work is.
    return [...byPlayground.values()].filter((g) => g.files.length > 0).sort(
      (a, b) => b.total - b.passed - (a.total - a.passed) || a.playground.localeCompare(b.playground),
    )
  }, [run, filter, query])

  if (!latest) return <main className="page">No results yet.</main>

  const info = run ?? history.find((h) => h.date === selected)!
  const index = history.findIndex((h) => h.date === selected)
  const previous = index > 0 ? history[index - 1] : undefined
  const s = info.summary
  const failing = s.total - s.passed
  const delta = previous ? s.passed - previous.summary.passed : undefined

  return (
    <main className="page">
      <header className="header">
        <h1>Vite bundled dev: test compatibility</h1>
        <p className="lede">
          How many of Vite's playground tests that pass with <code>vite</code> also pass with{' '}
          <code>vite --experimentalBundle</code>.
        </p>
      </header>

      <section className="tiles" aria-label="Summary">
        <div className="tile">
          <span className="tile-label">Pass rate</span>
          <span className="tile-value">{percent(rate(s))}</span>
          <span className="tile-note">
            {s.passed} of {s.total} tests
            {delta !== undefined && delta !== 0 && ` · ${delta > 0 ? '+' : ''}${delta} since previous run`}
          </span>
        </div>
        <div className="tile">
          <span className="tile-label">Files fully passing</span>
          <span className="tile-value">
            {s.filesPassing}
            <small>/{s.files}</small>
          </span>
          <span className="tile-note">{percent(s.filesPassing / s.files)} of test files</span>
        </div>
        <div className="tile">
          <span className="tile-label">Tests to fix</span>
          <span className="tile-value">{failing}</span>
          <span className="tile-note">fail or do not run in bundled dev</span>
        </div>
      </section>

      <section className="card">
        <h2>Pass rate over time</h2>
        <HistoryChart history={history} selected={selected} onSelect={setSelected} />
      </section>

      <section className="card">
        <div className="toolbar">
          <h2>Results by playground</h2>
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
        </div>
        {!run ? (
          <p className="muted">Loading run…</p>
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

      <section className="card how">
        <h2>How this works</h2>
        <ul>
          <li>
            A GitHub Actions job runs every night. It checks out <a href={VITE_REPO}>vitejs/vite</a> main
            and runs the playground tests twice: in plain dev and in bundled dev.
          </li>
          <li>
            Before the bundled run, it turns off the bundled-dev skips in Vite's tests
            (<code>skipIf(isBundledDev)</code> and the excluded spec files), so every test gets a real
            result.
          </li>
          <li>
            Only tests that pass in plain dev count. A test counts as not run when it was meant to run
            but has no result, for example because a hook failed.
          </li>
          <li>
            Tests that Vite skips for all bundled output on purpose (<code>runIf(!isBundled)</code>, also
            skipped in build) do not count.
          </li>
        </ul>
      </section>

      <footer className="footer">
        Run of {new Date(info.date).toUTCString().replace(' GMT', ' UTC')}
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
      </footer>
    </main>
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
      <span style={{ width: `${(passed / total) * 100}%` }} />
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

function FileRow({ file }: { file: FileResult }) {
  const shown = file.tests.filter((t) => t.status !== 'n/a')
  return (
    <li>
      <details>
        <summary className="row">
          <span className="name file">{file.file.replace(/^playground\//, '')}</span>
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
          {shown
            .toSorted((a, b) => Number(a.status === 'pass') - Number(b.status === 'pass'))
            .map((t) => (
              <li key={t.name} className={`test test-${t.status}`}>
                <span className="test-status" title={TEST_STATUS[t.status].label}>
                  <span aria-hidden="true">{TEST_STATUS[t.status].icon}</span>
                  <span className="sr-only">{TEST_STATUS[t.status].label}</span>
                </span>
                <span className="test-name">
                  {t.name}
                  {t.status === 'not-run' && <em> · not run</em>}
                  {t.error && <code className="test-error">{t.error}</code>}
                </span>
              </li>
            ))}
        </ul>
      </details>
    </li>
  )
}
