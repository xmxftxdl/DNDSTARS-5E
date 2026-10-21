import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'

function fixture() {
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'oak', type: 'obstacle', label: 'Oak', x: 125, y: 125, size: 1, color: '', emoji: '', dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' } }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.environment = 'outdoors'
  geometry.obstacles.push({ id: 'house', kind: 'obstacle', label: 'House', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
    baseHeightFeet: 0, heightFeet: 10, blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [{ col: 1, row: 0 }], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: ['oak'] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: ['house'], treeTokenIds: ['oak'] } }
}

it('retains the outdoor portion of a cell even when its center is inside a building', () => {
  const input = fixture()
  input.geometry.obstacles[0].points = [{x:0,y:0},{x:85,y:0},{x:85,y:50},{x:0,y:50}]
  const result = prepareDnd5eDruidGroveMapPlacement(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.protectedCells).toContainEqual({col:1,row:0})
  expect(result.protectedCells).not.toContainEqual({col:0,row:0})
  expect(result.containsPoint({x:75,y:25,elevationFeet:0})).toBe(false)
  expect(result.containsPoint({x:90,y:25,elevationFeet:0})).toBe(true)
})

it('reads Host geometry, excludes the structure volume while retaining air above it, and bounds height', () => {
  const input = fixture(), original = JSON.stringify(input), result = prepareDnd5eDruidGroveMapPlacement(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.protectedCells).toHaveLength(35)
  expect(result.containsPoint({ x: 25, y: 25, elevationFeet: 5 })).toBe(false)
  expect(result.containsPoint({ x: 25, y: 25, elevationFeet: 10 })).toBe(true)
  expect(result.containsPoint({ x: 75, y: 25, elevationFeet: 29 })).toBe(true)
  expect(result.containsPoint({ x: 75, y: 25, elevationFeet: 30 })).toBe(false)
  expect(result.containsPoint({ x: 300, y: 25, elevationFeet: 5 })).toBe(false)
  expect(JSON.stringify(input)).toBe(original)
})

it.each(['unknown-environment', 'wrong-map', 'unknown-structure', 'dead-tree', 'unclassified-tree', 'tree-above', 'map-edge', 'negative-height', 'wrong-grid'] as const)('rejects invalid Host map binding: %s', scenario => {
  const input = fixture()
  if (scenario === 'unknown-environment') input.geometry.environment = 'normal'
  if (scenario === 'wrong-map') input.geometry.mapId = 'other'
  if (scenario === 'unknown-structure') input.qualifications.structureObstacleIds = ['missing']
  if (scenario === 'dead-tree') input.map.tokens[0].dnd5eObjectState!.vegetation = 'dead'
  if (scenario === 'unclassified-tree') input.map.tokens[0].dnd5eObjectState = undefined
  if (scenario === 'tree-above') input.map.tokens[0].elevationFeet = 40
  if (scenario === 'map-edge') input.placement.origin.col = 18
  if (scenario === 'negative-height') input.baseElevationFeet = -Infinity
  if (scenario === 'wrong-grid') input.map.feetPerCell = 10
  expect(prepareDnd5eDruidGroveMapPlacement(input).ok).toBe(false)
})

it('uses actual raised terrain to reject a fog cell outside the vertical cube', () => {
  const input = fixture()
  input.geometry.obstacles.push({ id: 'raised', kind: 'obstacle', label: 'Raised terrain', points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 35, blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, cover: 'none', createdAt: 1 })
  expect(prepareDnd5eDruidGroveMapPlacement(input)).toEqual({ ok: false, reason: 'invalid-subarea' })
})
