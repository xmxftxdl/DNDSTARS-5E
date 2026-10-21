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
import { normalizeDnd5eSpecialSenses, type Dnd5eSpecialSense } from './specialSenses'

function creature(id: string, specialSenses: Dnd5eSpecialSense[] = []) {
  return createDnd5eCombatant({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    concentrating: false, temporaryHp: 0, proficiencyBonus: 2,
    id, name: id, controller: id === 'viewer' ? 'player' : 'dm', initiative: id === 'viewer' ? 20 : 10,
    armorClass: 10, currentHp: 10, maxHp: 10, speed: 30, position: { x: 0, y: 0 }, specialSenses,
  })
}

describe('special senses in Headless visibility', () => {
  it('enforces blindness beyond innate blindsight after serialization, even in bright light', () => {
    const senses = normalizeDnd5eSpecialSenses([{ name: '盲视', distanceFeet: 60, blindBeyond: true }])
    expect(senses).toEqual([{ kind: 'blindsight', rangeFeet: 60, blindBeyond: true }])
    const state = JSON.parse(JSON.stringify(startDnd5eHeadlessCombat('combat', [creature('viewer', senses), creature('target')])))
    const pair = dnd5eCombatantPairKey('viewer', 'target')
    const directed = dnd5eDirectedCombatantPairKey('viewer', 'target')
    state.distanceFeetByCombatantPair = { [pair]: 60 }
    expect(dnd5eCombatantCanSee(state, 'viewer', 'target')).toBe(true)
    state.distanceFeetByCombatantPair[pair] = 65
    state.combatants.viewer.darkvisionRangeFeet = 120
    expect(dnd5eCombatantCanSee(state, 'viewer', 'target')).toBe(false)
    state.distanceFeetByCombatantPair[pair] = 60
    state.magicalDarknessByCombatantPair = { [directed]: true }
    expect(dnd5eCombatantCanSee(state, 'viewer', 'target')).toBe(true)
    state.physicalLineOfSightBlockedByCombatantPair = { [directed]: true }
    expect(dnd5eCombatantCanSee(state, 'viewer', 'target')).toBe(false)
  })

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
