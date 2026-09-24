import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { canAdjustPlayerFlightElevation } from './playerFlightElevation'

function creature() {
  return createDnd5eCombatant({ id: 'unit', name: 'unit', controller: 'player', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false })
}
describe('player height permissions', () => {
  it.each(['restrained', 'grappled', 'paralyzed', 'stunned', 'unconscious', 'petrified'])('locks a flying player with %s', condition => {
    const unit = creature()
    unit.movementSpeeds = { walk: 30, fly: 60 }
    unit.conditions = [condition]
    expect(canAdjustPlayerFlightElevation(unit)).toBe(false)
  })
  it('requires flight rather than magical support, and unlocks after restraint ends', () => {
    const unit = creature()
    unit.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'reverse-gravity', label: '反重力',
      targetId: 'unit', source: { kind: 'spell', magical: true }, modifiers: { magicallyHeldAloft: true } })]
    expect(canAdjustPlayerFlightElevation(unit)).toBe(false)
    unit.movementSpeeds = { walk: 30, fly: 60 }
    expect(canAdjustPlayerFlightElevation(unit)).toBe(true)
    unit.conditions = ['restrained']
    expect(canAdjustPlayerFlightElevation(unit)).toBe(false)
    unit.conditions = []
    expect(canAdjustPlayerFlightElevation(unit)).toBe(true)
  })
})

describe('authoritative airborne movement validation', () => {
  it.each(['walk', 'fly', 'fall'] as const)('rejects unsupported %s in magical suspension', traversalMode => {
    const unit = creature()
    unit.elevationFeet = 100
    unit.groundElevationFeet = 0
    unit.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'reverse-gravity', label: '反重力',
      targetId: 'unit', source: { kind: 'spell', magical: true }, modifiers: { magicallyHeldAloft: true } })]
    const state = startDnd5eHeadlessCombat('test', [unit])
    expect(resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'unit', to: { x: 5, y: 0 },
      distance: 5, movementCost: 5, traversalMode, toElevationFeet: 100 }).ok).toBe(false)
  })
  it('rejects a forged height-only movement while restrained even with flight', () => {
    const unit = creature()
    unit.movementSpeeds = { walk: 30, fly: 60 }
    unit.conditions = ['restrained']
    const state = startDnd5eHeadlessCombat('test', [unit])
    expect(resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'unit', to: { x: 0, y: 0 },
      distance: 0, movementCost: 5, traversalMode: 'fly', toElevationFeet: 5 }).ok).toBe(false)
  })
})
