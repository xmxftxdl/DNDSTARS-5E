import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { createEmptyMapGeometry } from './mapGeometry'
import {
  mapExplorationPolygonFitsVisionRange,
  mapExplorationPolygonsForTokenPath,
  normalizeSharedMapExploration,
} from './mapExploration'

describe('map exploration resource', () => {
  it('accepts bounded per-member polygons and rejects malformed points', () => {
    const value = {
      schemaVersion: 1,
      maps: [{
        mapId: 'map',
        byMemberId: {
          alice: { polygons: [[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }]], updatedAt: 1 },
        },
        updatedAt: 1,
      }],
      updatedAt: 1,
    }
    expect(normalizeSharedMapExploration(value)?.maps[0].byMemberId.alice.polygons).toHaveLength(1)
    expect(normalizeSharedMapExploration({
      ...value,
      maps: [{ ...value.maps[0], byMemberId: { alice: { polygons: [[{ x: Number.NaN, y: 0 }]], updatedAt: 1 } } }],
    })).toBeUndefined()
  })

  it('records visibility at every point crossed by a movement path', () => {
    const token: Token = {
      id: 'hero', label: '英雄', type: 'player', characterId: 'character',
      x: 25, y: 25, size: 1, color: '#fff', emoji: '勇',
    }
    const map: BattleMap = {
      id: 'map', name: '地图', width: 500, height: 200, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [token],
    }
    const geometry = createEmptyMapGeometry(map.id, 1)
    const polygons = mapExplorationPolygonsForTokenPath({
      map,
      geometry,
      token,
      path: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 125, y: 25 }],
      forceEnabled: true,
      fallbackRangeFeet: 30,
    })

    expect(polygons).toHaveLength(3)
    expect(Math.min(...polygons[0].map((point) => point.x))).toBeLessThan(25)
    expect(Math.max(...polygons[2].map((point) => point.x))).toBeGreaterThan(125)
    expect(mapExplorationPolygonFitsVisionRange({ polygon: polygons[2], map, rangeFeet: 30 })).toBe(true)
    expect(mapExplorationPolygonFitsVisionRange({
      polygon: [{ x: 0, y: 0 }, { x: 499, y: 0 }, { x: 499, y: 199 }, { x: 0, y: 199 }],
      map,
      rangeFeet: 5,
    })).toBe(false)
  })
})
