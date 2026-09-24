import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { DND5E_SRD_COMBAT_SPELLS } from './spells'

it('preserves all 123 core spell rules and display text from the pre-migration checkpoint', () => {
  const canonical = JSON.stringify(DND5E_SRD_COMBAT_SPELLS,(_key,v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)
  expect(DND5E_SRD_COMBAT_SPELLS).toHaveLength(123)
  // Snapshot of e6778051; changes require an intentional spell-rule review.
  expect(createHash('sha256').update(canonical).digest('hex')).toBe('aafc17bab3e9c4296b5d5bf7ae0ab81ca80a5a9aa2e83c4b8e82f536d828f9fa')
})
