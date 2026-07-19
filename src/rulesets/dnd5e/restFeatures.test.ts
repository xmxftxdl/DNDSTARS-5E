import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  applyDnd5eDivineInterventionLongRest,
  applyDnd5eEldritchMaster,
  applyDnd5eSpellSlotRecovery,
  dnd5eSpellSlotRecoveryFeature,
  dnd5eSpellSlotRecoveryLimit,
} from './restFeatures'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '法师', level: 5,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6', ac: 12, speed: 30, initiativeBonus: 2,
    saveDC: 15, passivePerception: 11, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    classResources: {
      'dnd5e-arcane-recovery': { current: 1, max: 1 },
      'dnd5e-spell-slot-1': { current: 2, max: 4 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
      'dnd5e-spell-slot-3': { current: 0, max: 2 },
    },
    ...patch,
  }
}

describe('SRD 5.1 rest class features', () => {
  it('recovers a legal mix of Wizard spell slots and consumes Arcane Recovery', () => {
    const wizard = character()
    expect(dnd5eSpellSlotRecoveryFeature(wizard)).toBe('arcane-recovery')
    expect(dnd5eSpellSlotRecoveryLimit(wizard)).toBe(3)
    const result = applyDnd5eSpellSlotRecovery(wizard, [{ level: 1, amount: 1 }, { level: 2, amount: 1 }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.classResources).toMatchObject({
      'dnd5e-arcane-recovery': { current: 0, max: 1 },
      'dnd5e-spell-slot-1': { current: 3, max: 4 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    })
    expect(result.levelsRecovered).toBe(3)
  })

  it('rejects recovery above the level budget or of a sixth-level slot', () => {
    const wizard = character()
    expect(applyDnd5eSpellSlotRecovery(wizard, [{ level: 2, amount: 2 }])).toEqual({
      ok: false, reason: 'recovery-limit-exceeded',
    })
    expect(applyDnd5eSpellSlotRecovery(wizard, [{ level: 6, amount: 1 }])).toEqual({
      ok: false, reason: 'invalid-allocation',
    })
  })

  it('supports Natural Recovery only for a Circle of the Land Druid', () => {
    const druid = character({
      charClass: '德鲁伊', level: 6,
      dnd5eClassChoices: { classes: { druid: { subclass: 'land', selections: {} } } },
      classResources: {
        'dnd5e-natural-recovery': { current: 1, max: 1 },
        'dnd5e-spell-slot-3': { current: 1, max: 3 },
      },
    })
    expect(dnd5eSpellSlotRecoveryFeature(druid)).toBe('natural-recovery')
    const result = applyDnd5eSpellSlotRecovery(druid, [{ level: 3, amount: 1 }])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.character.classResources?.['dnd5e-spell-slot-3'].current).toBe(2)
    expect(dnd5eSpellSlotRecoveryFeature({ ...druid, dnd5eClassChoices: { classes: { druid: {} } } })).toBeUndefined()
  })

  it('restores every Pact Magic slot with Eldritch Master and consumes its daily use', () => {
    const warlock = character({
      charClass: '邪术师', level: 20,
      classResources: {
        'dnd5e-pact-slot': { current: 1, max: 4 },
        'dnd5e-eldritch-master': { current: 1, max: 1 },
      },
    })
    const result = applyDnd5eEldritchMaster(warlock)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.classResources).toMatchObject({
      'dnd5e-pact-slot': { current: 4, max: 4 },
      'dnd5e-eldritch-master': { current: 0, max: 1 },
    })
    expect(result.recovered).toBe(3)
  })

  it('keeps Divine Intervention unavailable until seven long rests have elapsed', () => {
    let cleric = character({
      charClass: '牧师', level: 10,
      dnd5eCombatState: { divineInterventionCooldownDays: 7 },
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    for (let day = 6; day > 0; day -= 1) {
      cleric = applyDnd5eDivineInterventionLongRest(cleric)
      expect(cleric.dnd5eCombatState?.divineInterventionCooldownDays).toBe(day)
      expect(cleric.classResources?.['dnd5e-divine-intervention'].current).toBe(0)
      cleric = {
        ...cleric,
        classResources: {
          ...cleric.classResources,
          'dnd5e-divine-intervention': { current: 1, max: 1 },
        },
      }
    }
    cleric = applyDnd5eDivineInterventionLongRest(cleric)
    expect(cleric.dnd5eCombatState?.divineInterventionCooldownDays).toBeUndefined()
    expect(cleric.classResources?.['dnd5e-divine-intervention'].current).toBe(1)
  })
})
