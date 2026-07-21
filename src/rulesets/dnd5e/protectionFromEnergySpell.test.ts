import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eEffectiveSpeed,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = { str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 16 } as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 3,
    armorClass: 16, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false, ...patch,
  })
}

describe('Protection from Energy Headless spell', () => {
  it('requires a legal damage choice and grants only that resistance while concentrating', () => {
    const wizard = combatant('wizard', 30, {
      classId: 'wizard', level: 5,
      classSelections: { 'spell-prepared': ['protection-from-energy'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const ally = combatant('ally', 10)
    const enemy = combatant('enemy', 20, {
      controller: 'dm', classId: 'sorcerer', level: 5,
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const initial = startDnd5eHeadlessCombat('protection-from-energy', [wizard, enemy, ally])

    const invalid = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'protection-from-energy',
      slotLevel: 3, effectRolls: [],
    })
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const protectedResult = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'protection-from-energy',
      slotLevel: 3, effectDamageType: 'fire', effectRolls: [],
    })
    expect(protectedResult.ok).toBe(true)
    if (!protectedResult.ok) return
    expect(protectedResult.state.combatants.wizard.classState.concentrationSpellId).toBe('protection-from-energy')
    expect(protectedResult.state.combatants.ally.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:protection-from-energy',
      modifiers: expect.objectContaining({ damageResistance: 'fire' }),
    }))

    const ended = resolveDnd5eHeadlessAction(protectedResult.state, { type: 'end-turn', actorId: 'wizard' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const burned = resolveDnd5eHeadlessAction(ended.state, {
      type: 'cast-spell', actorId: 'enemy', targetId: 'ally', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, effectRolls: [6, 4],
    })
    expect(burned.ok).toBe(true)
    if (!burned.ok) return
    expect(burned.state.combatants.ally.currentHp).toBe(15)
  })

  it('applies Longstrider speed and its higher-slot target count through ActiveEffect', () => {
    const wizard = combatant('wizard', 30, {
      classId: 'wizard', level: 5,
      classSelections: { 'spell-prepared': ['longstrider'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = combatant('ally', 10)
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('longstrider', [wizard, ally]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', targetIds: ['ally', 'wizard'],
      spellId: 'longstrider', slotLevel: 2, effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(dnd5eEffectiveSpeed(result.state.combatants.ally)).toBe(40)
    expect(dnd5eEffectiveSpeed(result.state.combatants.wizard)).toBe(40)
    expect(result.state.combatants.ally.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:longstrider',
      modifiers: expect.objectContaining({ speedBonusFeet: 10 }),
    }))
  })
})
