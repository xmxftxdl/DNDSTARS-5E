import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5eActionAllowedWhileSurprised, dnd5eCombatantIsSurprised, resolveDnd5eSurpriseForCombatant } from './surprise'

const requiredCombatantFields = {
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  concentrating: false,
  temporaryHp: 0,
  proficiencyBonus: 2,
  position: { x: 0, y: 0 },
}

describe('D&D 5e surprise', () => {
  it('blocks actions and reactions until the surprised creature finishes its first turn', () => {
    const combatant = createDnd5eCombatant({
      ...requiredCombatantFields,
      id: 'hero', name: '英雄', controller: 'player', initiative: 10,
      armorClass: 15, currentHp: 10, maxHp: 10, speed: 30,
      classState: { surprisedCombatId: 'combat' },
    })
    expect(dnd5eCombatantIsSurprised(combatant, 'combat')).toBe(true)
    expect(dnd5eActionAllowedWhileSurprised(combatant, 'combat', { type: 'dash', actorId: 'hero' })).toBe(false)
    expect(dnd5eActionAllowedWhileSurprised(combatant, 'combat', { type: 'end-turn', actorId: 'hero' })).toBe(true)
    expect(dnd5eActionAllowedWhileSurprised(combatant, 'combat', {
      type: 'sorcerer-draconic-presence-save', actorId: 'hero', sourceId: 'sorcerer', d20: 10,
    })).toBe(true)
    expect(dnd5eActionAllowedWhileSurprised(combatant, 'combat', {
      type: 'death-save', actorId: 'hero', d20: 10,
    })).toBe(true)
    expect(dnd5eActionAllowedWhileSurprised(combatant, 'combat', {
      type: 'monster-on-hit-save', actorId: 'hero', sourceId: 'enemy', actionId: 'bite', d20: 10,
    })).toBe(true)
    expect(dnd5eCombatantIsSurprised(resolveDnd5eSurpriseForCombatant(combatant, 'combat'), 'combat')).toBe(false)
  })

  it('lets a 7th-level barbarian use rage before acting through Feral Instinct', () => {
    const combatant = createDnd5eCombatant({
      ...requiredCombatantFields,
      id: 'barbarian', name: '野蛮人', controller: 'player', initiative: 10, level: 7,
      classId: 'barbarian', armorClass: 15, currentHp: 50, maxHp: 50, speed: 30,
      classState: { surprisedCombatId: 'combat' },
    })
    expect(dnd5eActionAllowedWhileSurprised(combatant, 'combat', { type: 'barbarian-rage', actorId: 'barbarian' })).toBe(true)
  })

  it('enforces surprise inside the authoritative Headless action loop', () => {
    const surprised = createDnd5eCombatant({
      ...requiredCombatantFields,
      id: 'surprised', name: '被突袭者', controller: 'player', initiative: 20,
      armorClass: 15, currentHp: 10, maxHp: 10, speed: 30,
      classState: { surprisedCombatId: 'combat' },
    })
    const enemy = createDnd5eCombatant({
      ...requiredCombatantFields,
      id: 'enemy', name: '伏击者', controller: 'dm', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30,
    })
    const state = startDnd5eHeadlessCombat('combat', [surprised, enemy])
    expect(resolveDnd5eHeadlessAction(state, { type: 'dash', actorId: surprised.id })).toMatchObject({ ok: false })
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: surprised.id })
    expect(ended.ok).toBe(true)
    if (ended.ok) expect(dnd5eCombatantIsSurprised(ended.state.combatants[surprised.id], 'combat')).toBe(false)
  })
})
