import { describe, expect, it } from 'vitest'
import { dnd5eWeaponDamagePreviewTotal } from './combatMath'

describe('dnd5eWeaponDamagePreviewTotal', () => {
  it('keeps weapon damage at one while applying extra damage separately', () => {
    expect(dnd5eWeaponDamagePreviewTotal(3, [
      { source: 'reduce', operation: 'subtract-from-weapon', count: 1, sides: 4, type: 'slashing', doubleOnCritical: true },
      { source: 'sneak-attack', operation: 'add', count: 1, sides: 6, type: 'slashing', doubleOnCritical: true },
    ], [
      { source: 'reduce', rolls: [5] },
      { source: 'sneak-attack', rolls: [4] },
    ])).toBe(5)
  })
})
