import { describe, expect, it } from 'vitest'
import {
  createEmptyMapFog,
  fogOperationForTool,
  normalizeFogShape,
  normalizeSharedMapFog,
} from './fogOfWar'

describe('static fog of war schema', () => {
  it('normalizes every V1 shape and preserves ordered cover/reveal operations', () => {
    const shared = normalizeSharedMapFog({
      schemaVersion: 1,
      updatedAt: 20,
      maps: [{
        ...createEmptyMapFog('map', 10),
        filled: true,
        shapes: [
          { id: 'a', kind: 'rect', operation: 'reveal', x: 1, y: 2, width: 30, height: 40, createdAt: 11 },
          { id: 'b', kind: 'circle', operation: 'cover', x: 20, y: 20, radius: 8, createdAt: 12 },
          { id: 'c', kind: 'polygon', operation: 'reveal', points: [0, 0, 10, 0, 5, 8], createdAt: 13 },
          { id: 'd', kind: 'brush', operation: 'cover', points: [0, 0, 4, 4], width: 12, createdAt: 14 },
        ],
      }],
    })
    expect(shared?.maps[0].shapes.map((shape) => shape.operation)).toEqual(['reveal', 'cover', 'reveal', 'cover'])
    expect(fogOperationForTool('reveal-polygon')).toBe('reveal')
  })

  it('fails closed for malformed or duplicate shapes', () => {
    expect(normalizeFogShape({ id: 'bad', kind: 'polygon', operation: 'reveal', points: [0, 0, 1, 1], createdAt: 1 })).toBeUndefined()
    expect(normalizeSharedMapFog({
      schemaVersion: 1,
      updatedAt: 2,
      maps: [{
        ...createEmptyMapFog('map', 1),
        shapes: [
          { id: 'same', kind: 'rect', operation: 'cover', x: 0, y: 0, width: 5, height: 5, createdAt: 1 },
          { id: 'same', kind: 'circle', operation: 'cover', x: 5, y: 5, radius: 2, createdAt: 1 },
        ],
      }],
    })).toBeUndefined()
  })
})
