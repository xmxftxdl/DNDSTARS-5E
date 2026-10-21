import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, type Dnd5eActionResult } from './headlessCombatEngine'
import { settleDnd5eEtherealReturns } from './etherealReturnSettlement'
import { resolveDnd5eActionWithEscapeEjection } from './persistentAreaEscapeEjection'

function fixture() {
  const actor = createDnd5eCombatant({ id: 'returner', name: 'Returner', initiative: 10, controller: 'player',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 125, y: 125 }, concentrating: false })
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({
    definitionId: 'return-test', label: 'Ethereal', targetId: actor.id,
    source: { kind: 'spell', actorId: actor.id, rulesId: 'etherealness', magical: true },
    duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
    modifiers: { planarPhase: { plane: 'ethereal', ignoresMaterialCollision: true,
      suppressCrossPlaneEffects: true, unrestrictedVerticalMovement: true } },
  })]
  const before = startDnd5eHeadlessCombat('return', [actor])
  const state = structuredClone(before)
  state.combatants.returner.classState.activeEffects = []
  const result: Dnd5eActionResult = { ok: true, state, events: [] }
  const map: BattleMap = { id: 'return', name: 'Return', width: 250, height: 250, gridSize: 50,
    feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: actor.id, type: 'player', label: actor.name, x: 125, y: 125, size: 1, color: '', emoji: '' }] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.obstacles = [{ id: 'solid', kind: 'obstacle', label: 'Solid',
    points: [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }],
    surfaceMaterial: 'solid', blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, cover: 'total', createdAt: 1 }]
  return { before, result, map, geometry }
}

it('stages effect removal, forced displacement and force damage without mutating either input snapshot', () => {
  const input = fixture(), original = structuredClone(input)
  const result = settleDnd5eEtherealReturns(input)
  expect(result.ok).toBe(true)
  expect(result.state.combatants.returner).toMatchObject({ position: { x: 75, y: 75 }, currentHp: 20,
    airborne: false, classState: { activeEffects: [] } })
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'moved', movementKind: 'forced', distance: 5 }))
  expect(input).toEqual(original)
  // A later action on an already-material actor must not inflict the return a second time.
  expect(settleDnd5eEtherealReturns({ ...input, before: result.state, result })).toBe(result)
})

it('does not return while another ethereal effect remains', () => {
  const input = fixture()
  input.result.state.combatants.returner.classState.activeEffects = structuredClone(input.before.combatants.returner.classState.activeEffects)
  expect(settleDnd5eEtherealReturns(input)).toBe(input.result)
})

it('rolls back the originating action when there is no legal destination', () => {
  const input = fixture()
  input.geometry.obstacles[0].points = [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 250 }, { x: 0, y: 250 }]
  input.geometry.obstacles[0].heightFeet = 20000
  const result = settleDnd5eEtherealReturns(input)
  expect(result).toEqual({ ok: false, state: input.before, events: [], reason: 'invalid-target' })
  expect(result.state.combatants.returner.currentHp).toBe(30)
  expect(result.state.combatants.returner.classState.activeEffects).toHaveLength(1)
})

it('marks an unobstructed airborne return for downstream falling without ejection damage', () => {
  const input = fixture()
  input.geometry.obstacles = []
  input.result.state.combatants.returner.elevationFeet = 20
  const result = settleDnd5eEtherealReturns(input)
  expect(result.ok).toBe(true)
  expect(result.state.combatants.returner).toMatchObject({ currentHp: 30, elevationFeet: 20, airborne: true })
  expect(result.events).toEqual([])
})

it.each([false, true])('settles voluntary dismissal through the basic-action hook, airborne=%s', airborne => {
  const input = fixture()
  const effect = input.before.combatants.returner.classState.activeEffects![0]
  effect.removal = { action: { label: 'End etherealness', economy: 'action', maxDistanceFeet: 0 } }
  // A material creature at the same location is enough to require ejection.
  input.map.tokens.push({ ...input.map.tokens[0], id: 'occupant' })
  const other = structuredClone(input.before.combatants.returner)
  other.id = 'occupant'; other.controller = 'dm'; other.initiative = 0
  other.classState.activeEffects = []
  const before = startDnd5eHeadlessCombat('return', [input.before.combatants.returner, other])
  if (airborne) {
    before.combatants.returner.elevationFeet = 20
    before.combatants.returner.groundElevationFeet = 0
    before.combatants.returner.airborne = true
    input.map.tokens[0].elevationFeet = 20
    before.combatants.occupant.position = { x: 225, y: 225 }
    input.map.tokens[1].x = 225
    input.map.tokens[1].y = 225
  }
  const effectId = before.combatants.returner.classState.activeEffects![0].id
  const original = structuredClone(before)
  const resolved = resolveDnd5eActionWithEscapeEjection({
    before, map: input.map, characters: [], characterIdByCombatantId: {},
    action: { type: 'remove-active-effect', actorId: 'returner', targetId: 'returner', effectId,
      ...(airborne ? { airborneFallDamageRollsByCombatantId: { returner: [4, 4] } } : {}) },
  })
  expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
  expect(resolved.result.state.combatants.returner).toMatchObject({
    currentHp: airborne ? 22 : 20, position: airborne ? { x: 125, y: 125 } : { x: 75, y: 75 },
    turn: { actionAvailable: false },
  })
  if (airborne) expect(resolved.result.state.combatants.returner).toMatchObject({ elevationFeet: 0, airborne: false })
  expect(resolved.result.state.combatants.returner.classState.activeEffects?.some(active => active.id === effectId) ?? false).toBe(false)
  expect(before).toEqual(original)
})
