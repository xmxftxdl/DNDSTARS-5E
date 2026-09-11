import { defineConfig, devices } from '@playwright/test'

// Component fixture only; no shared server, credentials or real room writes.
export default defineConfig({
  testDir: '.', testMatch: 'room-dice.spec.ts', timeout: 60_000,
  use: { ...devices['Desktop Chrome'] },
  webServer: { command: 'npx vite --config e2e/room-dice.vite.ts --host 127.0.0.1 --port 6373 --strictPort', cwd: process.cwd(), url: 'http://127.0.0.1:6373', timeout: 60_000 },
})
