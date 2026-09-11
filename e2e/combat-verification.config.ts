import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

process.env.STARS_E2E_PORT_BASE = '6473'
const sharedRoot = path.join(os.tmpdir(), `stars-combat-verification-${Date.now()}`)
export default defineConfig({
  testDir: '.', testMatch: ['large-dice-room.spec.ts', 'combat-authoritative-recovery.spec.ts', 'combat-settlement-modes.spec.ts', 'combat-scenario-replay.spec.ts'],
  workers: 1, timeout: 120_000,
  reporter: [['list']],
  outputDir: 'test-results/combat-verification',
  use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [6473, 6474].map((port, index) => ({
    reuseExistingServer: true, cwd: process.cwd(), command: `node scripts/vite-server.mjs --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`, timeout: 120_000,
    env: { NODE_OPTIONS: '--max-old-space-size=8192', STARS_SHARED_ROOT: sharedRoot, VITE_APP_MODE: index ? 'player' : 'dm', VITE_BYPASS_ROOM_LOBBY: '1', VITE_SHARED_API_BASES: 'http://127.0.0.1:6473/api,http://127.0.0.1:6474/api' },
  })),
})
