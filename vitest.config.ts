import { defineConfig } from 'vitest/config'

// Minimal vitest setup (T-P2-397). The only suite so far — diceNotation — is
// pure and DOM-free, so the default 'node' environment is enough; no jsdom and
// no DiceBox engine are pulled in.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
