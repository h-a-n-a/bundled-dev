// usage: node unskip.mjs <vite checkout>
// Turns off the bundled-dev skip markers in Vite's playground tests, so every
// test that runs in plain dev also runs in bundled dev and gets a real result.
// Mode-specific assertions (`if (isBundledDev) ...`) and bundled-only tests
// (`runIf(isBundledDev)`) stay as they are.
import fs from 'node:fs'
import path from 'node:path'

const viteDir = path.resolve(process.argv[2] ?? '.')

function patch(file, edit) {
  const before = fs.readFileSync(file, 'utf8')
  const after = edit(before)
  if (after !== before) {
    fs.writeFileSync(file, after)
    return true
  }
  return false
}

const configFile = path.join(viteDir, 'vitest.config.e2e.ts')
patch(configFile, (s) => s.replace('isBundledDev ? bundledDevExclude : []', '[]'))
if (fs.readFileSync(configFile, 'utf8').includes('...(isBundledDev ? bundledDevExclude')) {
  throw new Error(`bundledDevExclude not found in ${configFile}; update unskip.mjs`)
}

// `.skipIf(... isBundledDev ...)` -> isBundledDev is false
// `.runIf(... !isBundledDev ...)` -> !isBundledDev is true
const gate = /\.(skipIf|runIf)\(([^()]*)\)/g
function unskip(src) {
  return src.replace(gate, (call, fn, cond) => {
    if (fn === 'skipIf') return `.skipIf(${cond.replace(/(?<!!)\bisBundledDev\b/g, 'false')})`
    return `.runIf(${cond.replace(/!isBundledDev\b/g, 'true')})`
  })
}

let count = 0
for (const file of fs.globSync('playground/**/*.{ts,js}', {
  cwd: viteDir,
  exclude: (f) => f.includes('node_modules'),
})) {
  const full = path.join(viteDir, file)
  if (fs.statSync(full).isFile() && patch(full, unskip)) count++
}
console.log(`unskip: patched vitest.config.e2e.ts and ${count} test files`)
