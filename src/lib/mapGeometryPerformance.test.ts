import { describe, expect, it } from 'vitest'
import { compileGeometryCached, raycastGeometry } from '../../shared/map-geometry-kernel.mjs'
import {
  createEmptyMapGeometry,
  mapGeometryLineOfSightBlocked,
  setMapGeometryRuntime,
  type MapGeometryState,
} from './mapGeometry'

function largeGeometry(segmentCount: number): MapGeometryState {
  const geometry = createEmptyMapGeometry(`large-${segmentCount}`, 1)
  geometry.walls = Array.from({ length: segmentCount }, (_, index) => ({
    id: `wall-${index}`,
    kind: 'wall' as const,
    label: '',
    points: [
      { x: (index % 200) * 12, y: Math.floor(index / 200) * 12 },
      { x: (index % 200) * 12 + 10, y: Math.floor(index / 200) * 12 + (index % 3 === 0 ? 10 : 0) },
    ],
    edgeIds: [`edge-${index}`],
    material: 'stone' as const,
    blocksVision: true,
    blocksMovement: true,
    blocksLineOfEffect: true,
    baseHeightFeet: 0,
    heightFeet: 10,
    createdAt: index + 1,
  }))
  return geometry
}

describe('map geometry performance budgets', () => {
  it('compiles and queries 1k, 5k and 10k segments within desktop budgets', { timeout: 20_000 }, () => {
    for (const count of [1_000, 5_000, 10_000]) {
      const geometry = largeGeometry(count)
      const compileStarted = performance.now()
      const compiled = compileGeometryCached(geometry, { bucketSize: 128 })
      const compileMs = performance.now() - compileStarted
      expect(compiled.segments).toHaveLength(count)
      expect(compileMs).toBeLessThan(5_000)

      const queryStarted = performance.now()
      for (let index = 0; index < 500; index += 1) {
        raycastGeometry({
          compiled,
          from: { x: 0, y: index % 600 },
          to: { x: 2_400, y: index % 600 },
          purpose: 'movement',
          ignoreStart: true,
        })
      }
      expect(performance.now() - queryStarted).toBeLessThan(5_000)
    }
  })

  it('reuses the installed runtime index without rescanning a large geometry signature', () => {
    const geometry = largeGeometry(1_000)
    setMapGeometryRuntime([geometry])
    try {
      const queryStarted = performance.now()
      for (let index = 0; index < 5_000; index += 1) {
        mapGeometryLineOfSightBlocked({
          geometry,
          from: { x: 1, y: 600 + index % 20 },
          to: { x: 10, y: 600 + index % 20 },
        })
      }
      expect(performance.now() - queryStarted).toBeLessThan(1_500)
    } finally {
      setMapGeometryRuntime([])
    }
  })
})
