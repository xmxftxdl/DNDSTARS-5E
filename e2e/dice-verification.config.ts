import { defineConfig, devices } from '@playwright/test'

// Isolated fixtures, without shared servers or real campaign writes.
process.env.STARS_E2E_PORT_BASE = '6373'
export default defineConfig({
  testDir: '.',
  testMatch: ['reverse-gravity.spec.ts', 'concurrent-checks.spec.ts', 'large-dice.spec.ts', 'dice-pair.spec.ts', 'dm-dice-correction.spec.ts', 'dice-tray-persistence.spec.ts', 'room-dice.spec.ts', 'player-roll-prompt.spec.ts'],
  timeout: 60_000, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'docs/verification/2026-09-09/dice-browser.json' }]],
  outputDir: 'test-results/dice-verification',
  use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { cwd: process.cwd(), command: 'npx vite preview --config e2e/dice-verification.vite.ts --host 127.0.0.1 --port 6373 --strictPort', url: 'http://127.0.0.1:6373/e2e/fixtures/dice-queue.html', timeout: 90_000 },
})


