// usage: node summarize2.cjs <dir>
const fs = require('fs')
const path = require('path')
const dir = process.argv[2]
const load = (m, t) =>
	fs
		.readdirSync(dir)
		.filter((f) => f.startsWith(`${m}-${t}-`))
		.sort()
		.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
const sorted = (a) => [...a].filter((x) => x != null).sort((x, y) => x - y)
const q = (a, p) => {
	const s = sorted(a)
	return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null
}
const med = (a) => q(a, 0.5)
const rng = (a) => {
	const s = sorted(a)
	return s.length ? `${s[0]}–${s[s.length - 1]}` : '-'
}
const fmt = (a) => `${med(a)} (${rng(a)})`

const out = {}
for (const m of ['plain', 'bundled']) {
	const cold = load(m, 'cold')
	const warm = load(m, 'warm')
	const all = [...cold, ...warm]
	const o = (out[m] = {})
	o.runs = `${cold.length} cold, ${warm.length} warm, fatal: ${all.filter((r) => r.fatal).length}`
	o.loadavg = rng(all.flatMap((r) => [r.loadavgStart, r.loadavgEnd]).map((x) => Math.round(x * 10) / 10))
	o.serverReadyLogCold = fmt(cold.map((r) => r.serverReadyLogMs))
	o.serverReadyLogWarm = fmt(warm.map((r) => r.serverReadyLogMs))
	o.firstReadyCold = fmt(cold.map((r) => r.firstReadyMs))
	o.firstReadyWarm = fmt(warm.map((r) => r.firstReadyMs))
	o.firstLoadRequests = fmt(warm.map((r) => r.firstLoad?.requests))
	o.firstLoadKB = fmt(warm.map((r) => r.firstLoad?.kb))
	o.reloadRequests = fmt(warm.map((r) => r.reload?.requests))
	o.reloadKB = fmt(warm.map((r) => r.reload?.kb))
	o.reload1st = fmt(warm.map((r) => r.reloadMs?.[0]))
	const later = warm.flatMap((r) => r.reloadMs?.slice(1) ?? [])
	o.reload2to10 = `median ${med(later)}, p90 ${q(later, 0.9)}, n=${later.length}`
	o.otherPages = {}
	for (const slug of Object.keys(warm[0]?.otherPages ?? {})) o.otherPages[slug] = fmt(warm.map((r) => r.otherPages?.[slug]))
	o.hmr = {}
	for (const name of Object.keys(warm[0]?.hmr ?? {})) {
		const rows = warm.flatMap((r) => r.hmr?.[name] ?? [])
		o.hmr[name] = {
			ms: `median ${med(rows.map((x) => x.ms))}, p90 ${q(rows.map((x) => x.ms), 0.9)}`,
			edits: rows.length,
			failed: rows.filter((x) => x.failed).length,
			fullReload: rows.filter((x) => x.fullReload).length,
			shapeLost: rows.filter((x) => x.shapeKept === false).length,
			couldNotDraw: rows.filter((x) => x.shapeKept === null).length,
		}
	}
	o.serverRssMb = fmt(warm.map((r) => r.serverRssMb))
	const errs = {}
	for (const r of all)
		for (const e of r.errors) {
			const k = e
				.replace(/\[hmr-(\w+)-\d+\]/, '[hmr-$1]')
				.replace(/\?t=\d+/g, '')
				.replace(/:\d+:\d+/g, '')
				.replace(/clientId=[\w-]+/g, '')
				.slice(0, 220)
			errs[k] = (errs[k] || 0) + 1
		}
	o.errors = errs
	o.serverErrors = [...new Set(all.flatMap((r) => r.serverErrors).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\S+ \S+ /, '').slice(0, 160)))].slice(0, 8)
}
console.log(JSON.stringify(out, null, 2))
