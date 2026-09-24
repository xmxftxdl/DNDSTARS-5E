import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [react(), tailwindcss()], publicDir: false, build: { outDir: 'node_modules/.cache/map-voice-app', emptyOutDir: true, rolldownOptions: { input: 'e2e/fixtures/map-voice.html' } } })
