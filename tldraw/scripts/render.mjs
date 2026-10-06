import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
// usage: TLDRAW_DIR=<tldraw checkout> node render.mjs <chart.html> <out.png>
// Playwright is loaded from the tldraw checkout.
if (!process.env.TLDRAW_DIR) throw new Error('Set TLDRAW_DIR to the tldraw checkout')
const { chromium } = createRequire(process.env.TLDRAW_DIR + '/apps/examples/package.json')('@playwright/test')
const [inp, out] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 })
await page.goto(pathToFileURL(path.resolve(inp)).href)
await page.locator('#root').screenshot({ path: out })
await browser.close()
