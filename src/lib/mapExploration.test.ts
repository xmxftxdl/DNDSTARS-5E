import { describe, expect, it } from 'vitest'
import { normalizeSharedMapExploration } from './mapExploration'

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
})
