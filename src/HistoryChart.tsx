import { useLayoutEffect, useRef, useState } from 'react'
import { percent } from './data'

const HEIGHT = 260
const PAD = { top: 12, right: 16, bottom: 28, left: 44 }

const formatDay = (date: string) =>
  new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// The first and last dates sit on the plot edges; centering them would cut
// them off at the chart's sides.
const tickAnchor = (n: number, count: number) =>
  count === 1 ? 'middle' : n === 0 ? 'start' : n === count - 1 ? 'end' : 'middle'

const formatTime = (date: string) =>
  `${new Date(date).toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`

export interface Series {
  // Legend text, and the shorter text after the percentage in the tooltip.
  label: string
  tipLabel: string
  className: string
  values: number[]
  // One line per run under the percentage, e.g. "744/1057 tests passed, 34 todo".
  details: string[]
}

export function HistoryChart({
  dates,
  series,
  selected,
  onSelect,
}: {
  dates: string[]
  series: Series[]
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

  const all = series.flatMap((s) => s.values)
  // Round the y range out to 10% steps so the lines keep some room.
  const yMin = Math.max(0, Math.floor((Math.min(...all) - 0.05) * 10) / 10)
  const yMax = 1
  const times = dates.map((d) => Date.parse(d))
  const tMin = Math.min(...times)
  const tMax = Math.max(...times)

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += yMax - yMin > 0.5 ? 0.2 : 0.1) yTicks.push(v)

  const xTickCount = Math.min(dates.length, Math.max(2, Math.floor(plotW / 90)))
  const xTicks =
    dates.length === 1
      ? [0]
      : Array.from({ length: xTickCount }, (_, i) => Math.round((i * (dates.length - 1)) / (xTickCount - 1)))

  const xs = times.map(x)

  function nearest(clientX: number) {
    const px = clientX - ref.current!.getBoundingClientRect().left
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i
    return best
  }

  const active = hover ?? dates.indexOf(selected)

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Bundled dev pass rate over ${dates.length} runs`}
          onPointerMove={(e) => setHover(nearest(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelect(dates[nearest(e.clientX)])}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {xTicks.map((i, n) => (
            <text key={i} className="axis" x={xs[i]} y={HEIGHT - 8} textAnchor={tickAnchor(n, xTicks.length)}>
              {formatDay(dates[i])}
            </text>
          ))}
          {hover !== null && (
            <line className="crosshair" x1={xs[hover]} x2={xs[hover]} y1={PAD.top} y2={PAD.top + plotH} />
          )}
          {series.map((s) => (
            <g key={s.label} className={s.className}>
              <path className="line" d={s.values.map((v, i) => `${i ? 'L' : 'M'}${xs[i]},${y(v)}`).join('')} />
              {s.values.map((v, i) => (
                <circle key={i} className={i === active ? 'marker active' : 'marker'} cx={xs[i]} cy={y(v)} r={i === active ? 5 : 3} />
              ))}
            </g>
          ))}
        </svg>
      )}
      {hover !== null && (
        <div className="tooltip" style={{ left: Math.max(0, Math.min(xs[hover] + 12, width - 420)), top: PAD.top + 8 }}>
          {series.map((s) => (
            <div key={s.label} className="tip-series">
              <strong>
                <span className={`swatch ${s.className}`} aria-hidden="true" />
                {percent(s.values[hover])} {s.tipLabel}
              </strong>
              <span className="muted">{s.details[hover]}</span>
            </div>
          ))}
          <span className="muted">{formatTime(dates[hover])}</span>
        </div>
      )}
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <span className={`swatch ${s.className}`} aria-hidden="true" /> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
