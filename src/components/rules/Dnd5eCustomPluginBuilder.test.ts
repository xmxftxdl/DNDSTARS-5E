import { describe, expect, it } from 'vitest'
import { restoreArrayBackedBuilderMetadata } from './customPluginBuilderDraftMigration'

const fallback = {
  id: 'local.default',
  name: 'Default draft',
  declaredCapabilities: [] as Array<'damage' | 'healing'>,
}
const allowed = ['damage', 'healing'] as const

describe('D&D 5e custom plugin builder draft migration', () => {
  it('restores missing and malformed declared capabilities from legacy drafts', () => {
    const missing = restoreArrayBackedBuilderMetadata({
      id: 'local.test',
      name: 'Legacy draft',
    }, fallback, allowed)
    expect(missing.declaredCapabilities.includes('damage')).toBe(false)

    const malformed = restoreArrayBackedBuilderMetadata({
      declaredCapabilities: undefined,
    }, fallback, allowed)
    expect(malformed.declaredCapabilities).toEqual([])

    const filtered = restoreArrayBackedBuilderMetadata({
      declaredCapabilities: ['damage', 'not-a-capability'],
    }, fallback, allowed)
    expect(filtered.declaredCapabilities).toEqual(['damage'])
  })
})
