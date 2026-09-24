import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '.codex-temp/dice-verification-build',
    rollupOptions: { input: ['e2e/fixtures/reverse-gravity.html', 'e2e/fixtures/concurrent-checks.html', 'dice-box-frame.html', 'e2e/fixtures/large-dice.html', 'e2e/fixtures/dice-queue.html', 'e2e/fixtures/physical-dice-tray.html', 'e2e/fixtures/dm-dice-correction.html', 'e2e/fixtures/room-dice.html', 'e2e/fixtures/player-roll-prompt.html', 'e2e/fixtures/player-damage.html'].map(file => path.resolve(file)) },
  },
})


