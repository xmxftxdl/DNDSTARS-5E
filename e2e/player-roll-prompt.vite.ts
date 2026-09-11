import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [react(), tailwindcss()], publicDir: false, build: { outDir: 'node_modules/.cache/player-roll-prompt-app', emptyOutDir: true, rolldownOptions: { input: ['e2e/fixtures/player-roll-prompt.html', 'dice-box-frame.html', 'e2e/fixtures/player-damage.html', 'e2e/fixtures/dice-queue.html'] } } })
