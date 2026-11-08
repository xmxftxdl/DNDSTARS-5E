import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './e2e', testMatch: 'inventory-equip.spec.ts', timeout: 60_000,
  workers: 1, reporter: 'list', outputDir: '.inventory-equip-test-output', use: { browserName: 'chromium', viewport: { width: 1600, height: 1200 } } })
