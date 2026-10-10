import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  build: {
    rolldownOptions: {
      // Bundled dev only calls plugins' `hotUpdate` hook with this on. Without it,
      // a run file added to results/runs/ never reaches `import.meta.glob`.
      // `vite build` rejects any `devMode` option, so set it only when serving.
      experimental: command === 'serve' ? { devMode: { hotUpdate: true } } : {},
    },
  },
}))
