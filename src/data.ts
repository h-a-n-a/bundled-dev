// Shapes written by scripts/compare.mjs.
import historyJson from '../results/history.json'

export type TestStatus = 'pass' | 'fail' | 'not-run' | 'n/a'
export type FileStatus = 'pass' | 'partial' | 'fail'

export interface Summary {
  total: number
  passed: number
  files: number
  filesPassing: number
}

export interface RunInfo {
  date: string
  viteCommit?: string
  rolldownVersion?: string
  runUrl?: string
  summary: Summary
}

export interface TestResult {
  name: string
  status: TestStatus
  error?: string
}

export interface FileResult {
  file: string
  playground: string
  total: number
  passed: number
  status: FileStatus
  error?: string
  tests: TestResult[]
}

export interface Run extends RunInfo {
  files: FileResult[]
}

export const history: RunInfo[] = (historyJson as RunInfo[]).toSorted((a, b) =>
  a.date.localeCompare(b.date),
)

// Full runs are large, so each one is its own chunk, loaded when selected.
const runs = import.meta.glob<Run>('../results/runs/*.json', { import: 'default' })

export function loadRun(date: string): Promise<Run> {
  return runs[`../results/runs/${date.slice(0, 10)}.json`]()
}

export const rate = (s: { passed: number; total: number }) => (s.total ? s.passed / s.total : 0)

export const percent = (value: number) => `${(value * 100).toFixed(1)}%`
