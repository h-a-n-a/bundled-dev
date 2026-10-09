import { defineConfig } from 'void/config';

export default defineConfig({
  worker: {
    compatibility_date: '2026-02-24',
  },
  inference: {
    appType: 'spa',
    build: 'pnpm run build',
    outputDir: 'dist',
  },
});
