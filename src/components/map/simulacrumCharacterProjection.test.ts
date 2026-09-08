import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { projectSimulacrumCharacterForMapDetail } from './simulacrumCharacterProjection'

describe('projectSimulacrumCharacterForMapDetail', () => {
  it('uses the token-owned half-HP snapshot, resources, and empty equipment instead of the live subject', () => {
    const subject = {
      id: 'wizard', name: '法师本体', level: 20,
      abilities: { str: 9, dex: 16, con: 19, int: 20, wis: 13, cha: 11 },
      currentHp: 135, maxHp: 162, tempHp: 1, ac: 13, speed: 30, saveDC: 19,
      classResources: { 'dnd5e-spell-slot-7': { current: 1, max: 2 } },
      equipment: { offhand: { id: 'arcane-focus' } },
      dnd5eInventory: { schemaVersion: 3, entries: [{ instanceId: 'ruby', templateId: 'ruby', quantity: 1 }] },
      concentrating: true,
      conditions: ['invisible'],
      dnd5eCombatState: { schemaVersion: 2, concentrationSpellId: 'silent-image' },
    } as unknown as Character
    const token = {
      id: 'activity-simulacrum:wizard-token', label: '法师本体·拟像', type: 'player',
      x: 0, y: 0, color: '#0f0', emoji: '🧝', size: 1, characterId: 'wizard', hp: 70, maxHp: 81,
      dnd5eSimulacrum: {
        schemaVersion: 1, sourceTokenId: 'wizard-token', subjectTokenId: 'wizard-token',
        sourceCharacterId: 'wizard', sourceActivityId: 'simulacrum', createdRound: 1,
        level: 20, proficiencyBonus: 6,
        abilities: { str: 9, dex: 16, con: 19, int: 20, wis: 13, cha: 11 },
        armorClass: 13, maximumHitPoints: 81, speed: 30, sizeRank: 0, saveDc: 19,
        classLevels: { wizard: 20 },
        classResources: { 'dnd5e-spell-slot-7': { current: 2, maximum: 2 } },
        cannotIncreaseLevel: true, cannotRegainSpellSlots: true, cannotRegainHitPoints: true,
      },
    } satisfies Token

    const projected = projectSimulacrumCharacterForMapDetail(token, subject)

    expect(projected).toMatchObject({
      name: '法师本体·拟像', currentHp: 70, maxHp: 81, tempHp: 0,
      classResources: { 'dnd5e-spell-slot-7': { current: 2, max: 2 } },
      concentrating: false, conditions: [],
    })
    expect(projected.equipment).toBeUndefined()
    expect(projected.dnd5eInventory?.entries).toEqual([])
    expect(projected.dnd5eCombatState).toBeUndefined()
    expect(subject.currentHp).toBe(135)
  })

  it('returns an ordinary linked character unchanged', () => {
    const subject = { id: 'hero' } as Character
    const token = { id: 'hero-token' } as Token
    expect(projectSimulacrumCharacterForMapDetail(token, subject)).toBe(subject)
  })
})
