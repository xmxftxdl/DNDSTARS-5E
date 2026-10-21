import { afterEach, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { collectDnd5ePersistentAreaTriggers, dnd5eFirstAreaMovementCheckpoint, dnd5eFailedAreaMovementCheckpoint, expireDnd5ePluginAreasAtWorldMinute, reconcileDnd5ePluginAreasAndConcentrationOnMap } from './pluginAreas'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange } from './headlessCombatEngine'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { reconcileDnd5eAreaCaptivesAcrossMaps } from './persistentAreaEnd'

afterEach(() => setMapGeometryRuntime([]))
function fixture() {
  const trigger = normalizeDnd5ePersistentAreaTriggerSnapshot({ id: 'snare', label: 'Synthetic snare', timing: 'on-enter',
    requiresTargetGrounded: true, condition: { condition: 'restrained', duration: { expiresAt: 'permanent' },
      endsWithArea: true, suspendAboveGroundFeet: 3 } })!
  const map: BattleMap = { id: 'suspend', name: 'Suspend', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'caster', label: 'Caster', type: 'enemy', size: 1, x: 25, y: 75, color: '', emoji: '', hp: 20, maxHp: 20 },
      { id: 'target', label: 'Target', type: 'enemy', size: 1, x: 75, y: 25, color: '', emoji: '', hp: 20, maxHp: 20 }],
    dnd5ePluginAreas: [{ id: 'trap', pluginId: 'test.suspend', featureId: 'trap', label: 'Trap',
      sourceCharacterId: 'caster', sourceTokenId: 'caster', cells: [{ col: 1, row: 0 }], color: '#fff',
      createdRound: 1, expiresAfterRound: 100, anchorMode: 'fixed', relation: 'any', includeSelf: false, triggers: [trigger] }],
  }
  const collect = () => collectDnd5ePersistentAreaTriggers({ map, round: 1, timing: 'on-enter',
    movement: { token: { ...map.tokens[1], x: 25 }, to: { x: 125, y: 25 } } })
  const prepare = () => prepareDnd5ePersistentAreaTrigger({ map, characters: [], combatId: 'suspend', round: 1,
    candidate: collect()[0], initiativeOrder: map.tokens.map(token => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 10 })) })
  return { map, collect, prepare }
}

it('suspends on capture, binds support to the area, and retains elevation after reload', () => {
  const f = fixture(), prepared = f.prepare()
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) return
  const result = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared })
  expect(result.result.ok).toBe(true)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.application!.map], selectedId: f.map.id }))).maps[0]
  const target = saved.tokens.find(token => token.id === 'target')!
  expect(target.elevationFeet).toBe(3)
  expect(target.dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({
    standardCondition: 'restrained', modifiers: expect.objectContaining({ magicallyHeldAloft: true }),
    areaLifetime: expect.objectContaining({ areaId: 'trap', mapId: f.map.id }),
  }))
  expect(dnd5eFirstAreaMovementCheckpoint({ map: f.map, token: f.map.tokens[1], candidates: f.collect() })?.position).toEqual({ x: 75, y: 25 })
  expect(dnd5eFailedAreaMovementCheckpoint({ map: f.map, token: f.map.tokens[1], candidates: f.collect(), events: result.result.events })?.position).toEqual({ x: 75, y: 25 })
  expect(dnd5eFailedAreaMovementCheckpoint({ map: f.map, token: f.map.tokens[1], candidates: f.collect(), events: result.result.events })?.elevationFeet).toBe(3)
})

it('does not trigger on an airborne creature passing through the same cells', () => {
  const f = fixture()
  f.map.tokens[1].elevationFeet = 3
  expect(f.collect()).toEqual([])
})

it('expires an eight-hour suspension and persists the environmental landing without damage', () => {
  const f = fixture(), prepared = f.prepare()
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) return
  const captured = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared })
  const map = captured.application!.map
  map.dnd5ePluginAreas![0].expiresAtWorldMinute = 580
  expect(expireDnd5ePluginAreasAtWorldMinute(map, 579).dnd5ePluginAreas).toHaveLength(1)
  const expired = reconcileDnd5ePluginAreasAndConcentrationOnMap(map, [], 1,
    expireDnd5ePluginAreasAtWorldMinute(map, 580), [map])
  expect(expired.map.dnd5ePluginAreas ?? []).toHaveLength(0)
  expect(expired.map.tokens[1].dnd5eCombatState?.activeEffects ?? []).toHaveLength(0)
  const input = { characters: [], combatId: 'expiry', round: 1,
    initiativeOrder: map.tokens.map(token => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 10 })) }
  const before = createDnd5eMapCombatSnapshot({ ...input, map })
  const after = createDnd5eMapCombatSnapshot({ ...input, map: expired.map })
  expect(expired.map.tokens[1]).toMatchObject({ elevationFeet: 0, hp: 20 })
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before.state, after.state)).toEqual([])
  const landing = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before.state, after.state, {})
  expect(landing.ok).toBe(true)
  const applied = planDnd5eMapResultApplication({ state: landing.state, map: expired.map, characters: [],
    characterIdByCombatantId: after.characterIdByCombatantId, events: [...landing.events] })
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [applied.map], selectedId: map.id }))).maps[0]
  expect(saved.tokens[1]).toMatchObject({ elevationFeet: 0, hp: 20 })
})

it('releases and lands a remote captive without an open map or a second UI settlement', () => {
  const f = fixture(), prepared = f.prepare()
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) return
  const captured = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared })
  const map = captured.application!.map
  const source = { ...map, tokens: [map.tokens[0]], dnd5ePluginAreas: [] }
  const remote = { ...map, id: 'remote', tokens: [map.tokens[1]], dnd5ePluginAreas: [] }
  const result = reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [source, remote], characters: [], round: 1 })
  expect(result.maps[1].tokens[0]).toMatchObject({ elevationFeet: 0, hp: 20 })
  expect(result.maps[1].tokens[0].dnd5eCombatState?.activeEffects ?? []).toHaveLength(0)
  expect(reconcileDnd5eAreaCaptivesAcrossMaps({ ...result, round: 1 }).events).toEqual([])
})

it('rejects a lift through an overhead solid without committing effects or receipts', () => {
  const f = fixture(), geometry = createEmptyMapGeometry(f.map.id)
  geometry.obstacles = [{ id: 'ceiling', kind: 'obstacle', label: 'Ceiling',
    points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
    baseHeightFeet: 6, heightFeet: 1, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, cover: 'total', createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  const prepared = f.prepare()
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) return
  const result = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared })
  expect(result.result.ok).toBe(false)
  expect(result.application).toBeUndefined()
  expect(result.result.state.combatants.target.conditions).not.toContain('restrained')
})
