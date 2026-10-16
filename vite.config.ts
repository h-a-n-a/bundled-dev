import { defineConfig } from 'vite-plus'

export default defineConfig({
  defaultPackage: './site',
  fmt: {
    semi: false,
    singleQuote: true,
    printWidth: 120,
    overrides: [{ files: ['tldraw/scripts/**'], options: { useTabs: true } }],
    ignorePatterns: ['results/**', 'tldraw/raw/**', 'tldraw/summary.json', 'vite/**'],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['vite/**'],
  },
})
