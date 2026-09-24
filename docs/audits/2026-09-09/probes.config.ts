import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['docs/audits/2026-09-09/probes.test.ts'], environment: 'node' } })
