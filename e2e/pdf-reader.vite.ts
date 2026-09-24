import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [react(), tailwindcss()], publicDir: false, build: { outDir: 'node_modules/.cache/pdf-reader-app', emptyOutDir: true, rolldownOptions: { input: 'e2e/fixtures/pdf-reader.html' } }, cacheDir: 'node_modules/.vite-pdf-reader-test', optimizeDeps: { entries: ['e2e/fixtures/pdf-reader.html'] } })
