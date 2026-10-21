import { expect, it, vi } from 'vitest'
import { settleAttackTeleportBoundary } from './attackTeleportBoundary'
import { createEmptyMapGeometry, normalizeMapGeometry } from '../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import type { BattleMap } from '../../store/maps'

function fixture() {
  const map: BattleMap = { id: 'boundary', name: '', width: 500, height: 500, gridSize: 50,
    feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [{
      id: 'imp', poolId: 'srd-5.1:imp', type: 'enemy', label: 'Imp', x: 75, y: 125,
      size: 1, emoji: '', color: '', hp: 10, maxHp: 10,
    }] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.lights = [{ id: 'temple-light', kind: 'light', label: '', points: [{ x: 150, y: 150 }],
    enabled: false, brightRadiusFeet: 0, dimRadiusFeet: 0, color: '#ffffff',
    elevationFeet: 0, createdAt: 0 }]
  geometry.structureLifetimes = [{ id: 'temple', casterId: 'builder', createdWorldMinute: 0,
    expiresWorldMinute: 1440, entityIds: ['temple-light'], replacementGroup: 'temple-of-the-gods', siteKey: 'boundary-site',
    objectBoundary: { points: [{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}], bottomFeet: 0, topFeet: 20 },
    templeWard: { hostileCreatureTypes: ['fiend'], saveDc: 18, healingBonus: 5, lighting: 'none' } }]
  // Exercise the same persisted geometry validation as room hydration.
  const persistedGeometry = normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))
  expect(persistedGeometry?.structureLifetimes).toHaveLength(1)
  const originalState = createDnd5eMapCombatSnapshot({ map, geometry: persistedGeometry, characters: [],
    combatId: map.id, worldMinute: 100,
    initiativeOrder: [{tokenId:'imp',roll:20,label:'Imp',emoji:'',color:''}] }).state
  originalState.active = false
  const state = structuredClone(originalState)
  state.combatants.imp.position = { x: 125, y: 125 }
  state.combatants.imp.elevationFeet = 10
  return { state, originalState, map, actorId: 'imp', distanceFeet: 10 }
}

it.each([true, false])('checks the ward before falling and preserves accepted/denied state (%s)', async allowed => {
  const input = fixture(), before = structuredClone(input)
  const result = await settleAttackTeleportBoundary({ ...input, isCurrent: () => true,
    roll: async () => ({ d20: allowed ? 20 : 1, d20Second: allowed ? 20 : 1 }) })
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.allowed).toBe(allowed)
  expect(result.state.combatants.imp.position.x).toBe(allowed ? 125 : 75)
  expect(result.state.combatants.imp.elevationFeet ?? 0).toBe(allowed ? 10 : 0)
  expect(result.state.combatants.imp.currentHp).toBe(10)
  expect(result.events).not.toContainEqual(expect.objectContaining({ type: 'moved' }))
  expect(result.events).not.toContainEqual(expect.objectContaining({ type: 'teleported' }))
  expect(input).toEqual(before)
  if (!allowed) {
    expect(result.state.combatants.imp.classState.activeEffects?.some(
      effect => effect.definitionId === 'temple-of-the-gods:entry-denied')).toBe(true)
    const retryState = structuredClone(result.state)
    retryState.combatants.imp.position = { x: 125, y: 125 }
    retryState.combatants.imp.elevationFeet = 10
    const retryRoll = vi.fn(async () => ({ d20: 20 }))
    const retry = await settleAttackTeleportBoundary({ ...input, originalState: result.state,
      state: retryState, isCurrent: () => true, roll: retryRoll })
    expect(retry.ok && retry.allowed).toBe(false)
    expect(retryRoll).not.toHaveBeenCalled()
  }
})

it('discards a save when authority changes while dice are pending', async () => {
  const input = fixture(), before = structuredClone(input)
  let current = true
  const result = await settleAttackTeleportBoundary({ ...input, isCurrent: () => current,
    roll: async () => { current = false; return { d20: 20, d20Second: 20 } } })
  expect(result).toEqual({ ok: false, reason: 'temple-entry-authority-changed' })
  expect(input).toEqual(before)
})

it('rejects stale authority without asking for dice or publishing movement', async () => {
  const roll = vi.fn()
  const result = await settleAttackTeleportBoundary({ ...fixture(), isCurrent: () => false, roll })
  expect(result).toEqual({ ok: false, reason: 'temple-entry-authority-changed' })
  expect(roll).not.toHaveBeenCalled()
})

