import { createDnd5eCombatant } from '../../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { dmTokenElevationPermission, resolveDmTokenElevation } from './dmTokenElevation'

const token: Token = { id: 'air', label: 'air', type: 'player', size: 1, x: 25, y: 25, color: '', emoji: '', elevationFeet: 40 }
const map: BattleMap = { id: 'map', name: 'map', width: 1000, height: 1000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [token, { ...token, id: 'ground', elevationFeet: 0 }] }
describe('DM elevation adjustment', () => {
  it('allows stacking directly above another body', () => {
    expect(resolveDmTokenElevation(map, undefined, token, 5, { allowed: true, reason: '' })).toBe(5)
    expect(resolveDmTokenElevation(map, undefined, token, 60, { allowed: true, reason: '' })).toBe(60)
  })
  it('rejects landing inside another body', () => {
    expect(() => resolveDmTokenElevation(map, undefined, token, 0, { allowed: true, reason: '' })).toThrow('重叠')
    expect(() => resolveDmTokenElevation(map, undefined, token, 4, { allowed: true, reason: '' })).toThrow('重叠')
  })
  it('allows landing on an empty cell', () => {
    expect(resolveDmTokenElevation({ ...map, tokens: [token] }, undefined, token, 0, { allowed: true, reason: '' })).toBe(0)
  })
  it.each([NaN, Infinity, -5, 10001])('rejects invalid height %s', height => {
    expect(() => resolveDmTokenElevation(map, undefined, token, height, { allowed: true, reason: '' })).toThrow('有效')
  })
})


describe('DM height override', () => {
  it('allows arbitrary tokens without a character snapshot', () => {
    expect(dmTokenElevationPermission().allowed).toBe(true)
  })
  it.each([{}, { magicallyHeldAloft: true }, { flySpeedFeet: 60 }])('allows ground, supported and flying restrained creatures: %j', modifiers => {
    const unit = createDnd5eCombatant({ id: 'unit', name: 'unit', controller: 'dm', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    unit.conditions = ['restrained']
    unit.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'test', label: 'test', targetId: 'unit', source: { kind: 'spell', magical: true }, modifiers })]
    expect(resolveDmTokenElevation(map, undefined, token, 60, dmTokenElevationPermission(unit))).toBe(60)
  })
})
