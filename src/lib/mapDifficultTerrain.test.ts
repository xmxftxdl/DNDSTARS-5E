import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { MapGeometryObstacle, MapGeometryState } from './mapGeometry'
import { collectMapDifficultTerrainCells } from './mapDifficultTerrain'

const map = (overrides: Partial<BattleMap> = {}): BattleMap => ({
  id: 'map',
  name: 'Map',
  width: 200,
  height: 150,
  gridSize: 50,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  tokens: [],
  ...overrides,
})

function obstacle(overrides: Partial<MapGeometryObstacle> = {}): MapGeometryObstacle {
  return {
    id: 'terrain',
    kind: 'obstacle',
    label: 'Difficult terrain',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    cover: 'none',
    terrainCostMultiplier: 2,
    terrainRegion: true,
    baseHeightFeet: 0,
    heightFeet: 5,
    blocksMovement: false,
    blocksVision: false,
    blocksLineOfEffect: false,
    createdAt: 1,
    ...overrides,
  }
}

function geometry(obstacles: MapGeometryObstacle[]): Pick<MapGeometryState, 'obstacles'> {
  return { obstacles }
}

describe('map difficult terrain projection', () => {
  it('rasterizes geometry polygons by grid-cell center with grid offsets', () => {
    const offsetMap = map({
      width: 210,
      height: 170,
      gridOffsetX: 10,
      gridOffsetY: 20,
    })
    const terrain = obstacle({
      points: [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
        { x: 110, y: 120 },
        { x: 10, y: 120 },
      ],
    })

    expect(collectMapDifficultTerrainCells({
      map: offsetMap,
      geometry: geometry([terrain]),
    })).toEqual([
      { col: 0, row: 0, multiplier: 2 },
      { col: 1, row: 0, multiplier: 2 },
      { col: 0, row: 1, multiplier: 2 },
      { col: 1, row: 1, multiplier: 2 },
    ])
  })

  it('keeps the final pathfinding cell when the grid has a non-zero offset', () => {
    const offsetMap = map({
      width: 200,
      height: 150,
      gridOffsetX: 10,
      gridOffsetY: 20,
    })
    const edgeTerrain = obstacle({
      points: [
        { x: 160, y: 120 },
        { x: 200, y: 120 },
        { x: 200, y: 150 },
        { x: 160, y: 150 },
      ],
    })

    expect(collectMapDifficultTerrainCells({
      map: offsetMap,
      geometry: geometry([edgeTerrain]),
    })).toEqual([
      { col: 3, row: 2, multiplier: 2 },
    ])
  })

  it('includes plugin difficult terrain but excludes Spirit Guardians', () => {
    const battleMap = map({
      dnd5ePluginAreas: [
        {
          id: 'grease', pluginId: 'srd', featureId: 'grease', label: 'Grease', color: '#d6a84b',
          sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 2, row: 1 }],
          createdRound: 1, expiresAfterRound: 10, movementCostMultiplier: 2,
        },
        {
          id: 'guardians', pluginId: 'srd', featureId: 'spirit-guardians', coreSpellId: 'spirit-guardians',
          label: 'Spirit Guardians', color: '#fef3c7', sourceCharacterId: 'cleric', sourceTokenId: 'cleric-token',
          cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 10,
          movementCostMultiplier: 2,
        },
        {
          id: 'normal', pluginId: 'custom', featureId: 'normal', label: 'Normal', color: '#ffffff',
          sourceCharacterId: 'actor', sourceTokenId: 'actor-token', cells: [{ col: 3, row: 1 }],
          createdRound: 1, expiresAfterRound: 10, movementCostMultiplier: 1,
        },
      ],
    })

    expect(collectMapDifficultTerrainCells({ map: battleMap })).toEqual([
      { col: 2, row: 1, multiplier: 2 },
    ])
  })

  it('takes the greatest overlap multiplier and returns row/column stable order', () => {
    const battleMap = map({
      dnd5ePluginAreas: [{
        id: 'area', pluginId: 'custom', featureId: 'area', label: 'Area', color: '#a855f7',
        sourceCharacterId: 'actor', sourceTokenId: 'actor-token',
        cells: [{ col: 2, row: 1 }, { col: 1, row: 0 }, { col: 0, row: 1 }],
        createdRound: 1, expiresAfterRound: 10, movementCostMultiplier: 3,
      }],
    })
    const overlappingGeometry = obstacle({
      terrainCostMultiplier: 2,
      points: [
        { x: 50, y: 0 },
        { x: 150, y: 0 },
        { x: 150, y: 100 },
        { x: 50, y: 100 },
      ],
    })

    expect(collectMapDifficultTerrainCells({
      map: battleMap,
      geometry: geometry([overlappingGeometry]),
    })).toEqual([
      { col: 1, row: 0, multiplier: 3 },
      { col: 2, row: 0, multiplier: 2 },
      { col: 0, row: 1, multiplier: 3 },
      { col: 1, row: 1, multiplier: 2 },
      { col: 2, row: 1, multiplier: 3 },
    ])
  })
})
