import { expect, it } from 'vitest'
import { validateSharedStateShape } from '../../scripts/shared-server-core.mjs'

it('preserves valid Host traversal evidence through shared map validation and rejects corrupt evidence', () => {
  const saved = (mode: unknown) => JSON.parse(JSON.stringify({ maps: [{ id: 'traversal', tokens: [
    { id: 'dual-mode', type: 'player', elevationFeet: 20, dnd5eTraversalMode: mode },
  ] }] }))
  for (const mode of ['fly', 'climb', 'walk', 'fall', undefined]) {
    expect(validateSharedStateShape('maps', saved(mode))).toMatchObject({ ok: true })
  }
  for (const mode of ['flight', null, { mode: 'fly' }, 1]) {
    expect(validateSharedStateShape('maps', saved(mode))).toMatchObject({ ok: false, reason: 'invalid-dnd5e-token-traversal-mode' })
  }
})
