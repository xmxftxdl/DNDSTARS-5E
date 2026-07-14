import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function fighter(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
}

describe('D&D 5e 2014 headless combat engine', () => {
  it('spends movement independently from the action and supports Dash', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'a', to: { x: 20, y: 0 }, distance: 20 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.a.turn).toMatchObject({ actionAvailable: true, movementRemaining: 10 })
    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: 'a' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.a.turn).toMatchObject({ actionAvailable: false, movementRemaining: 40 })
  })

  it('uses an action for an attack and SRD critical damage dice', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 20, damage: { count: 1, sides: 8, bonus: 3, rolls: [6, 4] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.b.currentHp).toBe(7)
  })

  it('Dodge imposes disadvantage and opportunity attacks spend reactions', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('b', 20), fighter('a', 10)])
    const dodged = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'b' })
    expect(dodged.ok).toBe(true)
    if (!dodged.ok) return
    const ended = resolveDnd5eHeadlessAction(dodged.state, { type: 'end-turn', actorId: 'b' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const attack = resolveDnd5eHeadlessAction(ended.state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.b.currentHp).toBe(20)
    const reaction = resolveDnd5eHeadlessAction(attack.state, { type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 5, d20: 15, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(reaction.ok).toBe(true)
    if (!reaction.ok) return
    expect(reaction.state.combatants.b.turn.reactionAvailable).toBe(false)
  })

  it('settles death saves and concentration in the authoritative engine', () => {
    const dying = fighter('a', 20, { currentHp: 0, concentrating: true })
    const state = startDnd5eHeadlessCombat('combat', [dying, fighter('b', 10)])
    const deathSave = resolveDnd5eHeadlessAction(state, { type: 'death-save', actorId: 'a', d20: 20 })
    expect(deathSave.ok).toBe(true)
    if (!deathSave.ok) return
    expect(deathSave.state.combatants.a).toMatchObject({ currentHp: 1, deathSaves: { successes: 0, failures: 0 } })
    const concentrating = { ...deathSave.state, combatants: { ...deathSave.state.combatants, a: { ...deathSave.state.combatants.a, concentrating: true } } }
    const concentration = resolveDnd5eHeadlessAction(concentrating, { type: 'concentration-save', actorId: 'a', d20: 4, modifier: 2, dc: 10 })
    expect(concentration.ok).toBe(true)
    if (!concentration.ok) return
    expect(concentration.state.combatants.a.concentrating).toBe(false)
  })
})
