import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from './mapGeometry'
import { detectWallCandidatesFromRgba } from '../../shared/map-geometry-kernel.mjs'
import {
  consolidateWallDetectionCandidates,
  removeLikelyGridLines,
  wallDetectionCandidatesToGeometry,
} from './mapImageGeometryDetection'

describe('map image wall candidate preparation', () => {
  it('consolidates adjacent parallel scan lines before DM confirmation', () => {
    const candidates = consolidateWallDetectionCandidates([
      { a: { x: 0, y: 10 }, b: { x: 100, y: 10 }, confidence: 0.5 },
      { a: { x: 0, y: 12 }, b: { x: 100, y: 12 }, confidence: 0.5 },
      { a: { x: 50, y: 50 }, b: { x: 50, y: 150 }, confidence: 0.5 },
    ], 4)
    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toMatchObject({ a: { x: 0, y: 11 }, b: { x: 100, y: 11 } })
  })

  it('only promotes confirmed candidates into authoritative Schema V3 walls', () => {
    const geometry = wallDetectionCandidatesToGeometry(createEmptyMapGeometry('map', 1), [{
      a: { x: 10, y: 20 },
      b: { x: 100, y: 20 },
      confidence: 0.5,
    }], 100)
    expect(geometry.walls[0]).toMatchObject({
      id: 'detected:wall:100:0',
      edgeIds: ['detected:edge:100:0'],
      points: [{ x: 10, y: 20 }, { x: 100, y: 20 }],
    })
  })

  it('detects diagonal dark wall runs in addition to horizontal and vertical lines', () => {
    const width = 32
    const data = new Uint8ClampedArray(width * width * 4).fill(255)
    for (let index = 2; index < 28; index += 1) {
      const offset = (index * width + index) * 4
      data[offset] = 0
      data[offset + 1] = 0
      data[offset + 2] = 0
      data[offset + 3] = 255
    }
    const candidates = detectWallCandidatesFromRgba({
      data, width, height: width, sampleStride: 1, minimumRun: 12,
    })
    expect(candidates.some((candidate) => {
      const dx = candidate.b.x - candidate.a.x
      const dy = candidate.b.y - candidate.a.y
      return Math.abs(Math.abs(dx) - Math.abs(dy)) < 1 && Math.hypot(dx, dy) >= 20
    })).toBe(true)
  })

  it('removes repeated full-map grid lines without removing shorter walls', () => {
    const grid = [0, 20, 40, 60, 80].map((y) => ({
      a: { x: 0, y }, b: { x: 100, y }, confidence: 0.5,
    }))
    const wall = { a: { x: 10, y: 15 }, b: { x: 70, y: 15 }, confidence: 0.5 }
    expect(removeLikelyGridLines([...grid, wall], 100, 100)).toEqual([wall])
  })
})
