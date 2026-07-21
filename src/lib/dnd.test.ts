import { describe, expect, it } from 'vitest'
import { abilityMod, proficiencyBonus } from './dnd'
import { dndAbility, getEnemyStatBlock } from './enemyStatBlocks'

describe('D&D 5e shared ability helpers', () => {
  it('uses the 2014 ability modifier and proficiency progressions', () => {
    expect([1, 8, 10, 11, 14, 20, 30].map(abilityMod)).toEqual([-5, -1, 0, 0, 2, 5, 10])
    expect([1, 5, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([2, 3, 4, 5, 6, 6])
  })

  it('keeps SRD and compatibility monster abilities on the same standard scale', () => {
    expect(dndAbility(14)).toBe(14)
    expect(getEnemyStatBlock('srd-5.1:goblin')?.abilities.dex).toBe(14)
    expect(abilityMod(getEnemyStatBlock('srd-5.1:goblin')!.abilities.dex)).toBe(2)
    expect(getEnemyStatBlock('goblin')?.abilities.dex).toBe(14)
    expect(abilityMod(getEnemyStatBlock('goblin')!.abilities.dex)).toBe(2)
  })
})
