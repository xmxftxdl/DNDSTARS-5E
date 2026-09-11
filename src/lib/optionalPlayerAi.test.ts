import { expect, it, vi } from 'vitest'
import { startOptionalPlayerAi } from '../../scripts/optional-player-ai.mjs'
it('disables only AI when saved configuration cannot be decrypted, without logging secrets', async () => {
  const warn = vi.fn()
  const result = await startOptionalPlayerAi({ load: async () => { throw new Error('secret-value-in-corrupt-config') }, warn })
  expect(result.service).toBeNull()
  expect(result.configurationError).toBe(true)
  expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-value')
})
it('preserves a working integration', async () => {
  const integration = { service: {}, files: { config: 'configured' } }
  expect(await startOptionalPlayerAi({ load: async () => integration })).toBe(integration)
})
