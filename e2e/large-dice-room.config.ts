import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

process.env.STARS_E2E_PORT_BASE = '6573'
export default defineConfig({
  testDir: '.', testMatch: 'large-dice-room.spec.ts', workers: 1,
  reporter: [['list']], outputDir: 'test-results/large-dice-room',
  use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    cwd: process.cwd(), command: 'node scripts/static-server.mjs --host 127.0.0.1 --port 6573 --root .codex-temp/large-dice-app --art-asset-root public',
    url: 'http://127.0.0.1:6573', timeout: 60000,
    env: { STARS_SHARED_ROOT: path.join(os.tmpdir(), `stars-large-dice-room-${Date.now()}`) },
  },
})
