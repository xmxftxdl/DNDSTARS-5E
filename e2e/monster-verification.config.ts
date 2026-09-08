import { defineConfig } from '@playwright/test'
import path from 'node:path'

// Intentionally reuses only the two explicitly isolated verification services.
// No default/global setup and no existing table ports are started or reset.
export default defineConfig({
  testDir: '.',
  testMatch: process.env.STARS_MONSTER_UI_SPECIALS === '1' ? 'monster-special-verification.spec.ts' : 'monster-catalog-verification.spec.ts',
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  expect: { timeout: 15_000 },
  outputDir: path.resolve('.codex-temp/monster-verification-20260904/playwright'),
  reporter: [['line'], ['json', { outputFile: '.codex-temp/monster-verification-20260904/ui-tests.json' }]],
  use: { headless: false, viewport: { width: 1440, height: 1000 }, actionTimeout: 45_000 },
})
