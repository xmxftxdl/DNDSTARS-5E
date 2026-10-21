import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryMovementBlocked, dnd5ePersistentAreaTeleportationBlocker } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { prepareDnd5eDruidGroveGuardians } from './druidGroveGuardians'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eCombatantCanSpeakAudibly } from './headlessCombatEngine'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
function fixture() {
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'oak', type: 'obstacle', label: 'Oak', x: 125, y: 125, size: 1, color: '', emoji: '', dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' } }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.environment = 'outdoors'
  geometry.obstacles.push({ id: 'house', kind: 'obstacle', label: 'House', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
    baseHeightFeet: 0, heightFeet: 10, blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
  map.tokens.push({ id: 'caster', characterId: 'owner', type: 'player', label: 'Caster', x: 25, y: 275, size: 1, color: '', emoji: '' })
  return { source: { castId: 'cast', pluginId: 'grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100, map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [{ col: 1, row: 0 }], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: ['oak'] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: ['house'], treeTokenIds: ['oak'] } }
}


it('prepares real Awakened Tree stats, preserves the original and enforces silence after reload', () => {
  const input = fixture(), original = JSON.stringify(input)
  const result = prepareDnd5eDruidGroveGuardians(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.plans).toHaveLength(1)
  expect(result.plans[0].originalTree).toEqual(input.map.tokens[0])
  const guardian = result.plans[0].guardian
  expect(guardian).toMatchObject({ id: 'oak', hp: 59, maxHp: 59, type: 'enemy' })
  expect(guardian.dnd5eObjectState).toBeUndefined()
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, tokens: [guardian] }] }))).maps[0]
  const snapshot = createDnd5eMapCombatSnapshot({ map, characters: [], combatId: map.id, round: 1,
    initiativeOrder: [{ tokenId: 'oak', label: 'Oak', color: '', emoji: '', roll: 10 }] })
  expect(snapshot.state.combatants.oak.armorClass).toBe(13)
  expect(snapshot.state.combatants.oak.abilities.str).toBe(19)
  expect(dnd5eCombatantCanSpeakAudibly(snapshot.state.combatants.oak)).toBe(false)
  expect(dnd5eCombatantCanSpeakAudibly({ ...snapshot.state.combatants.oak, classState: {} })).toBe(true)
  expect(map.tokens[0].dnd5eGroveGuardian).toMatchObject({ castId: 'cast', sourceTokenId: 'caster',
    boundaryAreaId: 'cast:guardian-boundary', originalTree: { id: 'oak', type: 'obstacle', label: 'Oak',
      dnd5eObjectState: { vegetation: 'living' } } })
  result.plans[0].originalTree.label = 'changed'
  expect(JSON.stringify(input)).toBe(original)
})

it.each(['dead', 'edge', 'occupied'] as const)('rejects invalid guardian placement %s without replacing trees', mode => {
  const input = fixture()
  if (mode === 'dead') input.map.tokens[0].dnd5eObjectState!.vegetation = 'dead'
  if (mode === 'edge') input.map.tokens[0].x = 25
  if (mode === 'occupied') input.map.tokens[1] = { ...input.map.tokens[1], x: 125, y: 125 }
  const before = JSON.stringify(input)
  expect(prepareDnd5eDruidGroveGuardians(input).ok).toBe(false)
  expect(JSON.stringify(input)).toBe(before)
})

it('keeps restoration history Host-only in the actual player projection', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveGuardians(input)
  if (!result.ok) throw Error(result.reason)
  const guardian = { ...result.plans[0].guardian, visibilityMode: 'always' as const }
  const state = { maps: [{ ...input.map, tokens: [input.map.tokens[1], guardian] }], selectedId: input.map.id }
  const projected = projectMapsForPlayer(state, { maps: [] }, 'owner')
  const visible = projected.maps[0].tokens.find((token: { id: string }) => token.id === 'oak')
  expect(visible).toBeDefined()
  expect(visible?.dnd5eGroveGuardian).toBeUndefined()
  expect(guardian.dnd5eGroveGuardian?.originalTree.label).toBe('Oak')
})

it('rejects mismatched or nested restoration snapshots on reload', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveGuardians(input)
  if (!result.ok) throw Error(result.reason)
  for (const scenario of ['id', 'nested']) {
    const guardian = structuredClone(result.plans[0].guardian)
    if (scenario === 'id') guardian.dnd5eGroveGuardian!.originalTree.id = 'another-tree'
    else guardian.dnd5eGroveGuardian!.originalTree.dnd5eGroveGuardian = structuredClone(guardian.dnd5eGroveGuardian)
    const map = migrateMapsState({ maps: [{ ...input.map, tokens: [guardian] }] }).maps[0]
    expect(map.tokens[0].dnd5eGroveGuardian).toBeUndefined()
  }
})

it('contains the whole guardian during movement and teleportation after reload without restricting other creatures', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveGuardians(input)
  if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map,
    tokens: [result.plans[0].guardian], dnd5ePluginAreas: [result.boundary] }] }))).maps[0]
  const guardian = map.tokens[0]
  const move = (x: number, elevation = 0, id = guardian.id) => mapGeometryMovementBlocked({
    map, geometry: input.geometry, token: { ...guardian, id }, to: { x, y: 125 },
    fromElevationFeet: 0, toElevationFeet: elevation })
  expect(move(225).blocked).toBe(false)
  expect(move(275)).toMatchObject({ blocked: true, entityId: result.boundary!.id })
  expect(move(375).blocked).toBe(true)
  expect(move(125, 10).blocked).toBe(false)
  expect(move(125, 26).blocked).toBe(true)
  expect(move(375, 0, 'visitor').blocked).toBe(false)
  const teleport = (x: number, elevation = 0, id = guardian.id) => dnd5ePersistentAreaTeleportationBlocker({
    map, geometry: input.geometry, token: { ...guardian, id }, from: guardian, to: { x, y: 125 },
    fromElevationFeet: 0, toElevationFeet: elevation })
  expect(teleport(225)).toBeUndefined()
  expect(teleport(275)).toBe(result.boundary!.id)
  expect(teleport(125, 26)).toBe(result.boundary!.id)
  expect(teleport(375, 0, 'visitor')).toBeUndefined()
})
