import { describe, expect, it } from 'vitest'
import { dnd5eMonsterCoreSpellNeedsEffectRolls } from './monsterCoreSpellRolls'

describe('dnd5eMonsterCoreSpellNeedsEffectRolls', () => {
  it('omits the primary roll group for a non-damaging saving throw', () => {
    expect(dnd5eMonsterCoreSpellNeedsEffectRolls('saving-throw', 0)).toBe(false)
  })

  it('keeps effect rolls for damaging saving throws and healing', () => {
    expect(dnd5eMonsterCoreSpellNeedsEffectRolls('saving-throw', 4)).toBe(true)
    expect(dnd5eMonsterCoreSpellNeedsEffectRolls('healing', 1)).toBe(true)
  })
})
