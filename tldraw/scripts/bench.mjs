// usage: TLDRAW_DIR=<tldraw checkout> node bench.mjs <plain|bundled> <cold|warm> <outJson>
//
// cold: delete apps/examples/node_modules/.vite, start server, measure first load only.
// warm: keep the Vite cache, then measure first load, 10 reloads, first visits to
//       other example pages, HMR (5 edits per file), and server memory.
// Every browser context is new, so there is never an HTTP cache from an earlier run.
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = process.env.TLDRAW_DIR
if (!ROOT) throw new Error('Set TLDRAW_DIR to the tldraw checkout')
const APP = path.join(ROOT, 'apps/examples')
const { chromium } = createRequire(path.join(APP, 'package.json'))('@playwright/test')

const [mode, temp, out] = process.argv.slice(2)
const PORT = 5440
const BASE = `http://localhost:${PORT}`
const OTHER_PAGES = ['xkcd-dependency', 'layer-panel', 'rich-text-font-extensions', 'cubic-bezier-shape']
const HMR_EDITS = 5

const FILES = {
	example: path.join(APP, 'src/examples/getting-started/basic/BasicExample.tsx'),
	toolbar: path.join(ROOT, 'packages/tldraw/src/lib/ui/components/Toolbar/DefaultToolbar.tsx'),
	editor: path.join(ROOT, 'packages/editor/src/lib/editor/Editor.ts'),
	css: path.join(APP, 'src/styles.css'),
}
const ORIGINAL = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, fs.readFileSync(f, 'utf8')]))
const restoreAll = () => {
	for (const [k, f] of Object.entries(FILES)) if (fs.readFileSync(f, 'utf8') !== ORIGINAL[k]) fs.writeFileSync(f, ORIGINAL[k])
}
process.on('exit', restoreAll)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now()
const result = { mode, temp, loadavgStart: os.loadavg()[0], errors: [], serverErrors: [] }
let phase = 'start'

if (temp === 'cold') fs.rmSync(path.join(APP, 'node_modules/.vite'), { recursive: true, force: true })

// ---- server
const t0 = now()
const args = ['exec', 'vite', '--port', String(PORT), '--strictPort']
if (mode === 'bundled') args.push('--experimentalBundle')
const server = spawn('pnpm', args, { cwd: APP, env: { ...process.env, FORCE_COLOR: '0' }, detached: true })
let serverOut = ''
const ready = new Promise((resolve) => {
	const on = (d) => {
		serverOut += d
		if (/ready in/.test(d)) resolve()
	}
	server.stdout.on('data', on)
	server.stderr.on('data', on)
})

function serverRssMb() {
	// sum RSS of the whole process group (pnpm + node vite + children)
	const pids = execSync(`pgrep -g ${server.pid}`, { encoding: 'utf8' }).trim().split('\n').join(',')
	const lines = execSync(`ps -o rss= -p ${pids}`, { encoding: 'utf8' }).trim().split('\n')
	return Math.round(lines.reduce((a, l) => a + Number(l.trim() || 0), 0) / 1024)
}

// ---- browser helpers
const browser = await chromium.launch({ channel: 'chrome' })
async function newPage() {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
	const page = await ctx.newPage()
	const cdp = await ctx.newCDPSession(page)
	await cdp.send('Network.enable')
	cdp.on('Network.responseReceived', (e) => e.response.status >= 400 && result.errors.push(`[${phase}] CDP ${e.response.status} ${e.type} ${e.response.url}`))
	const net = { requests: 0, bytes: 0 }
	page.on('request', () => net.requests++)
	page.on('requestfinished', async (req) => {
		const s = await req.sizes().catch(() => null)
		if (s) net.bytes += s.responseBodySize + s.responseHeadersSize
	})
	page.on('pageerror', (e) => result.errors.push(`[${phase}] pageerror: ` + String(e).slice(0, 300)))
	page.on('response', (r) => r.status() >= 400 && result.errors.push(`[${phase}] HTTP ${r.status()} ${r.url()}`))
	page.on('console', (m) => m.type() === 'error' && result.errors.push(`[${phase}] ` + m.text().replace(/\s+/g, ' ').slice(0, 300)))
	return { ctx, page, net }
}
// "ready" = the canvas and the main toolbar are both visible
const waitReady = (page, timeout = 120_000) =>
	Promise.all([
		page.waitForSelector('.tl-canvas', { state: 'visible', timeout }),
		page.waitForSelector('.tlui-main-toolbar', { state: 'visible', timeout }),
	])
const resetNet = (net) => ((net.requests = 0), (net.bytes = 0))

try {
	await ready
	result.serverReadyLogMs = Math.round(now() - t0)

	// ---- first load
	phase = 'first-load'
	const { page, net } = await newPage()
	await page.goto(`${BASE}/basic`, { timeout: 180_000 })
	await waitReady(page)
	result.firstReadyMs = Math.round(now() - t0)
	result.firstLoad = { requests: net.requests, kb: Math.round(net.bytes / 1024) }

	if (temp === 'warm') {
		// ---- reloads (same tab, HTTP cache from the first load)
		phase = 'reload'
		result.reloadMs = []
		for (let i = 0; i < 10; i++) {
			resetNet(net)
			const s = now()
			await page.reload()
			await waitReady(page)
			result.reloadMs.push(Math.round(now() - s))
			if (i === 0) result.reload = { requests: net.requests, kb: Math.round(net.bytes / 1024) }
		}

		// ---- first visit to other example pages (new tab each, server already warm)
		phase = 'other-pages'
		result.otherPages = {}
		for (const slug of OTHER_PAGES) {
			const p = await newPage()
			const s = now()
			await p.page.goto(`${BASE}/${slug}`, { timeout: 60_000 })
			await waitReady(p.page)
			result.otherPages[slug] = Math.round(now() - s)
			await p.ctx.close()
		}

		// ---- HMR
		async function drawRect() {
			await page.keyboard.press('Escape')
			await page.keyboard.press('r')
			await page.mouse.move(500, 300)
			await page.mouse.down()
			await page.mouse.move(650, 420, { steps: 5 })
			await page.mouse.up()
			await page.keyboard.press('Escape')
			await page.waitForFunction(() => document.querySelectorAll('.tl-shape').length > 0, null, { timeout: 5000 })
		}
		async function ensureShape() {
			if ((await shapeCount()) > 0) return true
			try {
				await drawRect()
				return true
			} catch {
				result.errors.push(`[${phase}] could not draw a shape; reloading the page to recover`)
				await page.reload()
				await waitReady(page, 30_000)
				try {
					await drawRect()
					return true
				} catch {
					return false
				}
			}
		}
		const shapeCount = () => page.evaluate(() => document.querySelectorAll('.tl-shape').length)

		const edits = {
			example: {
				edit: (src, v) => src.replace('<Tldraw />', `<Tldraw /><div id="hmr-probe">${v}</div>`),
				signal: (v) => page.waitForFunction((v) => document.getElementById('hmr-probe')?.textContent === v, v, { timeout: 15_000 }),
			},
			toolbar: {
				edit: (src, v) => src + `\nconsole.log('hmr-probe ${v}')\n`,
				signal: (v) => consoleSignal(`hmr-probe ${v}`),
			},
			editor: {
				edit: (src, v) => src + `\nconsole.log('hmr-probe ${v}')\n`,
				signal: (v) => consoleSignal(`hmr-probe ${v}`),
			},
			css: {
				edit: (src, v) => src + `\n#root { outline: 1px solid rgb(1, 2, ${v.split('-').pop()}); }\n`,
				signal: (v) =>
					page.waitForFunction(
						(n) => getComputedStyle(document.getElementById('root')).outlineColor === `rgb(1, 2, ${n})`,
						v.split('-').pop(),
						{ timeout: 15_000 }
					),
			},
		}
		function consoleSignal(text) {
			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => (page.off('console', h), reject(new Error('timeout'))), 15_000)
				const h = (m) => {
					if (m.text().includes(text)) {
						clearTimeout(timer)
						page.off('console', h)
						resolve()
					}
				}
				page.on('console', h)
			})
		}

		result.hmr = {}
		for (const [name, def] of Object.entries(edits)) {
			const rows = []
			for (let i = 1; i <= HMR_EDITS; i++) {
				phase = `hmr-${name}-${i}`
				const canDraw = await ensureShape()
				const before = await shapeCount()
				const token = `${name}-${Date.now()}-${i}`
				await page.evaluate((t) => (window.__hmrToken = t), token)
				const sig = def.signal(token).then(
					() => null,
					(e) => e
				)
				const s = now()
				fs.writeFileSync(FILES[name], def.edit(ORIGINAL[name], token))
				const err = await sig
				const ms = Math.round(now() - s)
				await sleep(400)
				const kept = await page.evaluate((t) => window.__hmrToken === t, token).catch(() => false)
				if (!kept) await waitReady(page, 30_000).catch(() => {})
				const after = await shapeCount().catch(() => -1)
				rows.push({ ms: err ? null : ms, failed: !!err, fullReload: !kept, shapeKept: canDraw ? after >= before && before > 0 : null })
				await sleep(800)
			}
			result.hmr[name] = rows
			fs.writeFileSync(FILES[name], ORIGINAL[name])
			await sleep(1500)
		}

		result.serverRssMb = serverRssMb()
	}
	await browser.close()
} catch (e) {
	result.fatal = String(e.stack || e).slice(0, 1000)
} finally {
	restoreAll()
	try {
		process.kill(-server.pid, 'SIGTERM')
	} catch {}
	result.loadavgEnd = os.loadavg()[0]
	result.serverErrors = serverOut.split('\n').filter((l) => /error/i.test(l)).slice(0, 20)
	result.viteVersionLine = (serverOut.match(/VITE\s+v[\d.]+/) || [])[0]
	result.serverHead = serverOut.slice(0, 600)
	fs.writeFileSync(out, JSON.stringify(result, null, 2))
	console.log(out, result.fatal ? 'FATAL ' + result.fatal.split('\n')[0] : 'ok')
	await sleep(1500)
	process.exit(0)
}
