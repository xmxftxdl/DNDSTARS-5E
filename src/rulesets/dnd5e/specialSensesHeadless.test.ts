import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantCanDetect,
  dnd5eCombatantCanSee,
  dnd5eCombatantPairKey,
  dnd5eDirectedCombatantPairKey,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { createDnd5eConditionEffect } from './activeEffects'

function creature(id: string, specialSenses: Array<{ kind: 'blindsight' | 'tremorsense' | 'truesight'; rangeFeet: number }> = []) {
  return createDnd5eCombatant({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    concentrating: false, temporaryHp: 0, proficiencyBonus: 2,
    id, name: id, controller: id === 'viewer' ? 'player' : 'dm', initiative: id === 'viewer' ? 20 : 10,
    armorClass: 10, currentHp: 10, maxHp: 10, speed: 30, position: { x: 0, y: 0 }, specialSenses,
  })
}

describe('special senses in Headless visibility', () => {
  it('lets blindsight perceive an invisible creature in range, but not through a wall', () => {
    const viewer = creature('viewer', [{ kind: 'blindsight', rangeFeet: 30 }])
    const target = creature('target')
    target.classState.activeEffects = [createDnd5eConditionEffect({
      id: 'invisible', targetId: target.id, condition: 'invisible',
      source: { kind: 'dm', actorId: 'dm' }, duration: { type: 'permanent' },
    })]
    target.conditions = ['invisible']
    const state = startDnd5eHeadlessCombat('combat', [viewer, target])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(viewer.id, target.id)]: 20 }
    state.lineOfSightBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey(viewer.id, target.id)]: true }
    expect(dnd5eCombatantCanSee(state, viewer.id, target.id)).toBe(true)
    state.physicalLineOfSightBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey(viewer.id, target.id)]: true }
    expect(dnd5eCombatantCanSee(state, viewer.id, target.id)).toBe(false)
  })

  it('lets tremorsense detect but not see a grounded invisible creature', () => {
    const viewer = creature('viewer', [{ kind: 'tremorsense', rangeFeet: 30 }])
    const target = creature('target')
    target.conditions = ['invisible']
    const state = startDnd5eHeadlessCombat('combat', [viewer, target])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(viewer.id, target.id)]: 20 }
    expect(dnd5eCombatantCanSee(state, viewer.id, target.id)).toBe(false)
    expect(dnd5eCombatantCanDetect(state, viewer.id, target.id)).toBe(true)
    state.combatants.target.airborne = true
    expect(dnd5eCombatantCanDetect(state, viewer.id, target.id)).toBe(false)
  })
})
