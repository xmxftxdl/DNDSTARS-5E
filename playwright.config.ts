import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

const e2ePortBase = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
const dmUrl = `http://127.0.0.1:${e2ePortBase}`
const playerUrl = `http://127.0.0.1:${e2ePortBase + 1}`
const player2Url = `http://127.0.0.1:${e2ePortBase + 2}`
const reviewUrl = `http://127.0.0.1:${e2ePortBase + 3}`
const sharedApiBases = `${dmUrl}/api,${playerUrl}/api,${player2Url}/api`
const e2eRootSuffix = process.env.STARS_E2E_PORT_BASE ? `-${e2ePortBase}` : ''
const sharedRoot = path.join(os.tmpdir(), `stars-app-e2e-shared${e2eRootSuffix}`)
const reviewRoot = path.join(os.tmpdir(), `stars-app-e2e-plugin-review${e2eRootSuffix}`)
const dmOnly = process.env.STARS_E2E_DM_ONLY === '1'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: `node scripts/vite-server.mjs --host 127.0.0.1 --port ${e2ePortBase} --strictPort`,
      url: dmUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        STARS_SHARED_ROOT: sharedRoot,
        VITE_APP_MODE: 'dm',
        VITE_BYPASS_ROOM_LOBBY: '1',
        VITE_SHARED_API_BASES: dmOnly ? `${dmUrl}/api` : sharedApiBases,
      },
    },
    ...(dmOnly
      ? []
      : [
          {
            command: `node scripts/vite-server.mjs --host 127.0.0.1 --port ${e2ePortBase + 1} --strictPort`,
            url: playerUrl,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              STARS_SHARED_ROOT: sharedRoot,
              VITE_APP_MODE: 'player',
              VITE_BYPASS_ROOM_LOBBY: '1',
              VITE_SHARED_API_BASES: sharedApiBases,
            },
          },
          {
            command: `node scripts/vite-server.mjs --host 127.0.0.1 --port ${e2ePortBase + 2} --strictPort`,
            url: player2Url,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              STARS_SHARED_ROOT: sharedRoot,
              VITE_APP_MODE: 'player',
              VITE_BYPASS_ROOM_LOBBY: '1',
              VITE_PLAYER_SLOT: 'player2',
              VITE_SHARED_API_BASES: sharedApiBases,
            },
          },
          {
            command: `node scripts/vite-server.mjs --host 127.0.0.1 --port ${e2ePortBase + 3} --strictPort`,
            url: reviewUrl,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              STARS_SHARED_ROOT: reviewRoot,
              STARS_PLUGIN_REVIEW_REQUIRED: 'true',
              STARS_PLUGIN_ADMIN_ACCOUNT_IDS: '*',
              VITE_APP_MODE: 'dm',
              VITE_SHARED_API_BASES: `${reviewUrl}/api`,
            },
          },
        ]),
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
