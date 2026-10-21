import { afterEach, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { dnd5ePersistentAreaDirectionalMovementCostAt } from './persistentAreaGeometry'
import { normalizeDnd5eDirectionalMovementCost, normalizeDnd5eDirectionalMovementDeclaration } from './persistentAreaTypes'
import { createMapGeometryPathTree, findMapGeometryPath } from '../../lib/mapPathfinding'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'

afterEach(() => setMapGeometryRuntime([]))
const token: Token = { id: 'mover', label: 'Mover', x: 125, y: 25, color: '', emoji: '', size: 1, type: 'enemy' }
const area: Dnd5ePluginArea = { id: 'wind', pluginId: 'test.wind', featureId: 'zone', label: 'Wind', color: '#fff', sourceCharacterId: 'source', sourceTokenId: 'source',
  createdRound: 1, expiresAfterRound: 11, anchorMode: 'fixed', includeSelf: true, relation: 'any',
  cells: Array.from({ length: 5 }, (_, col) => ({ col, row: 0 })), vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
  directionalMovementCost: { direction: { dc: 1, dr: 0 }, additionalFeetPerFoot: 1 } }
const map: BattleMap = { id: 'wind', name: 'Wind', width: 250, height: 50, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [token], dnd5ePluginAreas: [area] }

it.each([{ to: { x: 25, y: 25 }, expected: 20 }, { to: { x: 225, y: 25 }, expected: 10 }, { to: { x: 125, y: 25 }, expected: 0 }])('charges only movement against the saved wind direction (%j)', ({ to, expected }) => {
  const options = { map, token, additionalMovementCostPerFoot: (mover: Token, from: Token | { x: number; y: number }, to: { x: number; y: number }) => dnd5ePersistentAreaDirectionalMovementCostAt({ map, token: mover, from, to }) }
  expect(findMapGeometryPath({ ...options, to })?.movementCostFeet).toBe(expected)
  expect(createMapGeometryPathTree(options).pathTo(to)?.movementCostFeet).toBe(expected)
})

it.each([{ terrain: 1, speed: 1, ignore: false, expected: 20 }, { terrain: 2, speed: 1, ignore: false, expected: 30 }, { terrain: 2, speed: 1, ignore: true, expected: 20 }, { terrain: 2, speed: 2, ignore: false, expected: 60 }])('adds environmental spending to terrain before speed reduction (%j)', ({ terrain, speed, ignore, expected }) => {
  const options = { map, token, ignoreDifficultTerrain: ignore, additionalDifficultTerrainMultiplier: () => terrain, additionalSpeedCostMultiplier: () => speed,
    additionalMovementCostPerFoot: (mover: Token, from: { x: number; y: number }, to: { x: number; y: number }) => dnd5ePersistentAreaDirectionalMovementCostAt({ map, token: mover, from, to }) }
  const to = { x: 25, y: 25 }
  expect(findMapGeometryPath({ ...options, to })?.movementCostFeet).toBe(expected)
  expect(createMapGeometryPathTree(options).pathTo(to)?.movementCostFeet).toBe(expected)
})

it('uses live altitude, perpendicular direction, occupancy, removal and source exclusion', () => {
  const cost = (current = map, mover = token, to = { x: 75, y: 25 }) => dnd5ePersistentAreaDirectionalMovementCostAt({ map: current, token: mover, from: mover, to })
  expect(cost()).toBe(1)
  expect(cost(map, { ...token, elevationFeet: 20 })).toBe(0)
  expect(cost(map, token, { x: 125, y: 75 })).toBe(0)
  expect(cost({ ...map, dnd5ePluginAreas: [] })).toBe(0)
  expect(cost({ ...map, dnd5ePluginAreas: [{ ...area, movementExcludesSource: true, sourceTokenId: token.id }] })).toBe(0)
  expect(cost({ ...map, dnd5ePluginAreas: [area, { ...area, id: 'other' }] })).toBe(1)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0]
  expect(saved.dnd5ePluginAreas![0].directionalMovementCost).toEqual(area.directionalMovementCost)
  expect(cost(saved)).toBe(1)
})

it('bounds declarative authoring and persisted Host vectors without guessing malformed rules', () => {
  expect(normalizeDnd5eDirectionalMovementDeclaration({ direction: 'area-orientation', additionalFeetPerFoot: 1 })).toBeDefined()
  for (const amount of [-1, 0, 11, Infinity, NaN, '1']) {
    expect(normalizeDnd5eDirectionalMovementDeclaration({ direction: 'area-orientation', additionalFeetPerFoot: amount })).toBeUndefined()
    expect(normalizeDnd5eDirectionalMovementCost({ direction: { dc: 1, dr: 0 }, additionalFeetPerFoot: amount })).toBeUndefined()
  }
  for (const direction of [{ dc: 0, dr: 0 }, { dc: 2, dr: 0 }, { dc: NaN, dr: 0 }, 'east']) expect(normalizeDnd5eDirectionalMovementCost({ direction, additionalFeetPerFoot: 1 })).toBeUndefined()
  expect(normalizeDnd5eDirectionalMovementDeclaration({ direction: 'area-orientation', additionalFeetPerFoot: 1, extra: true })).toBeUndefined()
})

it('keeps range previews within the actual wind-adjusted movement allowance', () => {
  const options = { map, token, maximumMovementCostFeet: 15,
    additionalMovementCostPerFoot: (mover: Token, from: { x: number; y: number }, to: { x: number; y: number }) => dnd5ePersistentAreaDirectionalMovementCostAt({ map, token: mover, from, to }) }
  const preview = createMapGeometryPathTree(options)
  expect(preview.pathTo({ x: 25, y: 25 })).toBeUndefined()
  expect(preview.pathTo({ x: 75, y: 25 })?.movementCostFeet).toBe(10)
  expect(preview.pathTo({ x: 225, y: 25 })?.movementCostFeet).toBe(10)
})
