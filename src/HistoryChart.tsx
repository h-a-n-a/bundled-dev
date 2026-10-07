import { useLayoutEffect, useRef, useState } from 'react'
import { percent, rate, type RunInfo } from './data'

const HEIGHT = 220
const PAD = { top: 12, right: 16, bottom: 28, left: 44 }

const formatDay = (date: string) =>
  new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function HistoryChart({
  history,
  selected,
  onSelect,
}: {
  history: RunInfo[]
  selected: string
  onSelect: (date: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current!
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const values = history.map((h) => rate(h.summary))
  // Round the y range out to 10% steps so the line keeps some room.
  const yMin = Math.max(0, Math.floor((Math.min(...values) - 0.05) * 10) / 10)
  const yMax = 1
  const times = history.map((h) => Date.parse(h.date))
  const tMin = Math.min(...times)
  const tMax = Math.max(...times)

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += yMax - yMin > 0.5 ? 0.2 : 0.1) yTicks.push(v)

  const xTickCount = Math.min(history.length, Math.max(2, Math.floor(plotW / 90)))
  const xTicks =
    history.length === 1
      ? [0]
      : Array.from({ length: xTickCount }, (_, i) =>
          Math.round((i * (history.length - 1)) / (xTickCount - 1)),
        )

  const points = times.map((t, i) => [x(t), y(values[i])] as const)
  const path = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join('')

  function nearest(clientX: number) {
    const left = ref.current!.getBoundingClientRect().left
    let best = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i][0] - (clientX - left)) < Math.abs(points[best][0] - (clientX - left))) best = i
    }
    return best
  }

  const active = hover ?? history.findIndex((h) => h.date === selected)
  const tip = hover === null ? null : history[hover]

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Bundled dev pass rate over ${history.length} runs`}
          onPointerMove={(e) => setHover(nearest(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelect(history[nearest(e.clientX)].date)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} className="axis" x={points[i][0]} y={HEIGHT - 8} textAnchor="middle">
              {formatDay(history[i].date)}
            </text>
          ))}
          {hover !== null && (
            <line className="crosshair" x1={points[hover][0]} x2={points[hover][0]} y1={PAD.top} y2={PAD.top + plotH} />
          )}
          <path className="line" d={path} />
          {active >= 0 && <circle className="marker" cx={points[active][0]} cy={points[active][1]} r={5} />}
        </svg>
      )}
      {tip && hover !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(points[hover][0], width - 180), top: points[hover][1] + 12 }}
        >
          <strong>{formatDay(tip.date)}</strong>
          <span>
            {percent(rate(tip.summary))} · {tip.summary.passed}/{tip.summary.total} tests
          </span>
          <span className="muted">click to open this run</span>
        </div>
      )}
    </div>
  )
}
