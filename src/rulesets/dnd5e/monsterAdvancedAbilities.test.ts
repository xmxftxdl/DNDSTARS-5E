import { describe, expect, it } from 'vitest'
import {
  dnd5eMonsterCoreSpellCompatibility,
  dnd5eMonsterShapechangeFormIds,
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

  it('reports only safely supported monster spell effects as fully automated', () => {
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('fire-bolt')!).automation).toBe('full')
    for (const spellId of [
      'barkskin',
      'blur',
      'fly',
      'greater-invisibility',
      'invisibility',
      'longstrider',
      'mage-armor',
      'protection-from-poison',
    ]) {
      expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell(spellId)!)).toEqual({
        automation: 'full',
      })
    }
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('enlarge-reduce')!))
      .toMatchObject({ automation: 'manual' })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('shillelagh')!))
      .toMatchObject({ automation: 'manual' })
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
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('warding-bond')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('misty-step')!)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('magic-weapon')!)).toMatchObject({
      automation: 'full',
    })
    for (const spellId of [
      'banishment',
      'dispel-magic',
      'entangle',
      'hold-person',
      'lesser-restoration',
      'sleep',
      'thunderwave',
    ]) {
      expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell(spellId)!)).toEqual({
        automation: 'full',
      })
    }
    const sanctuary = getDnd5eSrdCombatSpell('sanctuary')!
    expect(dnd5eMonsterCoreSpellCompatibility(sanctuary)).toMatchObject({
      automation: 'full',
    })
    expect(dnd5eMonsterCoreSpellCompatibility({
      ...sanctuary,
      id: 'not-sanctuary',
    })).toMatchObject({
      automation: 'manual',
    })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('bless')!)).toMatchObject({
      automation: 'manual',
    })
    for (const spellId of ['counterspell', 'darkness', 'shield']) {
      expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell(spellId)!)).toMatchObject({
        automation: 'manual',
      })
    }
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
