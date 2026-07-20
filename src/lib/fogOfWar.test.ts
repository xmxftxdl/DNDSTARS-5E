import { describe, expect, it } from 'vitest'
import {
  createEmptyMapFog,
  fogCoversPoint,
  fogOperationForTool,
  fogPointState,
  normalizeFogShape,
  normalizeSharedMapFog,
  type FogShape,
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

  it('evaluates cover and reveal shapes in paint order', () => {
    const rect = (id: string, operation: 'cover' | 'reveal', x: number, createdAt: number): FogShape =>
      ({ id, kind: 'rect', operation, x, y: 0, width: 100, height: 100, createdAt })

    expect(fogPointState({ filled: true, shapes: [] }, 50, 50)).toBe('covered')
    expect(fogPointState({ filled: false, shapes: [] }, 50, 50)).toBe('neutral')
    expect(fogPointState({ filled: true, shapes: [rect('a', 'reveal', 0, 1)] }, 50, 50)).toBe('revealed')
    expect(fogPointState({
      filled: true,
      shapes: [rect('a', 'reveal', 0, 1), rect('b', 'cover', 0, 2)],
    }, 50, 50)).toBe('covered')
    expect(fogPointState({
      filled: false,
      shapes: [rect('a', 'cover', 0, 1), rect('b', 'reveal', 0, 2)],
    }, 50, 50)).toBe('revealed')
    expect(fogCoversPoint({ filled: false, shapes: [rect('a', 'cover', 200, 1)] }, 50, 50)).toBe(false)
  })

  it('tests circle, polygon, and brush membership against real coordinates', () => {
    const circle: FogShape = { id: 'c', kind: 'circle', operation: 'cover', x: 100, y: 100, radius: 30, createdAt: 1 }
    expect(fogCoversPoint({ filled: false, shapes: [circle] }, 120, 100)).toBe(true)
    expect(fogCoversPoint({ filled: false, shapes: [circle] }, 140, 100)).toBe(false)

    const triangle: FogShape = { id: 'p', kind: 'polygon', operation: 'cover', points: [0, 0, 100, 0, 50, 90], createdAt: 1 }
    expect(fogCoversPoint({ filled: false, shapes: [triangle] }, 50, 30)).toBe(true)
    expect(fogCoversPoint({ filled: false, shapes: [triangle] }, 5, 80)).toBe(false)

    const brush: FogShape = { id: 'b', kind: 'brush', operation: 'cover', points: [0, 0, 100, 0], width: 20, createdAt: 1 }
    expect(fogCoversPoint({ filled: false, shapes: [brush] }, 50, 8)).toBe(true)
    expect(fogCoversPoint({ filled: false, shapes: [brush] }, 50, 15)).toBe(false)
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
