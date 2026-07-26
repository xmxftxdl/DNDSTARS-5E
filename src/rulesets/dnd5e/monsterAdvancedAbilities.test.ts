import { describe, expect, it } from 'vitest'
import {
  dnd5eMonsterCoreSpellCompatibility,
  dnd5eMonsterShapechangeFormIds,
  parseDnd5eLegendaryWingAttack,
} from './monsterAdvancedAbilities'
import { getDnd5eSrdCombatSpell } from './spells'

describe('advanced monster Headless declarations', () => {
  it('allows only the three structured vampire forms', () => {
    expect(dnd5eMonsterShapechangeFormIds('srd-5.1:vampire-vampire')).toEqual([
      'srd-5.1:vampire-bat',
      'srd-5.1:vampire-mist',
    ])
    expect(dnd5eMonsterShapechangeFormIds('srd-5.1:doppelganger')).toEqual([])
  })

  it('recognizes the structured SRD lycanthrope form families', () => {
    expect(dnd5eMonsterShapechangeFormIds('srd-5.1:werebear-human')).toEqual([
      'srd-5.1:werebear-hybrid',
      'srd-5.1:werebear-bear',
    ])
    expect(dnd5eMonsterShapechangeFormIds('srd-5.1:werewolf-wolf')).toEqual([
      'srd-5.1:werewolf-human',
      'srd-5.1:werewolf-hybrid',
    ])
  })

  it('parses the trusted SRD dragon wing attack declaration', () => {
    expect(parseDnd5eLegendaryWingAttack(
      'wing-attack-costs-2-actions',
      'Each creature within 15 ft. of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone.',
    )).toEqual({
      rangeFeet: 15,
      saveDc: 23,
      damage: { count: 2, sides: 6, bonus: 8 },
    })
  })

  it('reports only safely supported monster spell effects as fully automated', () => {
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('fire-bolt')!).automation).toBe('full')
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('fly')!)).toMatchObject({
      automation: 'manual',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('fireball')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('magic-missile')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('darkvision')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('see-invisibility')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('misty-step')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('magic-weapon')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('blight')!)).toMatchObject({
      automation: 'manual',
      reason: expect.stringContaining('亡灵'),
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('disintegrate')!)).toMatchObject({
      automation: 'manual',
      reason: expect.stringContaining('解离'),
    })
  })
})
