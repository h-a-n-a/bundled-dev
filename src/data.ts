// Shapes written by scripts/compare.mjs.
import historyJson from '../results/history.json'

export type TestStatus =
  | 'pass'
  | 'fail'
  | 'todo'
  | 'not-run'
  | 'triage'
  | 'unsupported'
export type FileStatus = 'pass' | 'partial' | 'fail' | 'not-counted'
export type Scope = 'all' | 'noSsr'

export interface Summary {
  total: number
  passed: number
  files: number
  filesPassing: number
  statuses: Record<TestStatus, number>
  buildOnly: number
  everyMode: number
  // Tests in non-SSR specs with their own server, which are left out.
  ownServer: number
}

export interface RunInfo {
  date: string
  viteCommit?: string
  rolldownVersion?: string
  runUrl?: string
  summary: Record<Scope, Summary>
}

export interface Issues {
  vite?: number[]
  rolldown?: number[]
}

export interface TestResult {
  name: string
  status: TestStatus
  note?: string
  tag?: 'todo' | 'unsupported'
  reason?: string
  // Tracking issues from the tag's `meta.issues`.
  issues?: Issues
  error?: string
}

export interface FileResult {
  file: string
  playground: string
  ssr: boolean
  total: number
  passed: number
  status: FileStatus
  error?: string
  tests: TestResult[]
}

export interface Fix {
  file: string
  name: string
  status: TestStatus | 'n/a'
  note: string
}

export interface Run extends RunInfo {
  fixes: Fix[]
  files: FileResult[]
}

export const history: RunInfo[] = (historyJson as RunInfo[]).toSorted((a, b) =>
  a.date.localeCompare(b.date),
)

// Full runs are large, so each one is its own chunk, loaded when selected.
const runs = import.meta.glob<Run>('../results/runs/*.json', { import: 'default' })

// Resolves to null for a run older than KEEP_RUN_DAYS in compare.mjs: only its
// summary row in history.json is kept.
export function loadRun(date: string): Promise<Run | null> {
  return runs[`../results/runs/${date.slice(0, 10)}.json`]?.() ?? Promise.resolve(null)
}

export const rate = (s: { passed: number; total: number }) => (s.total ? s.passed / s.total : 0)

export const percent = (value: number) => `${(value * 100).toFixed(1)}%`
