import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from './mapGeometry'
import { detectWallCandidatesFromRgba } from '../../shared/map-geometry-kernel.mjs'
import {
  consolidateWallDetectionCandidates,
  filterToDominantCandidateCluster,
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

  it('detects light walls on a dark background without a polarity setting', () => {
    const width = 48
    const data = new Uint8ClampedArray(width * width * 4)
    for (let pixel = 0; pixel < width * width; pixel += 1) data[pixel * 4 + 3] = 255
    for (let x = 6; x < 42; x += 1) {
      const offset = (24 * width + x) * 4
      data[offset] = 255
      data[offset + 1] = 255
      data[offset + 2] = 255
    }
    const candidates = detectWallCandidatesFromRgba({
      data, width, height: width, sampleStride: 1, minimumRun: 16,
    })
    expect(candidates.some((candidate) =>
      Math.abs(candidate.a.y - candidate.b.y) < 1 &&
      Math.abs(candidate.b.x - candidate.a.x) >= 28,
    )).toBe(true)
  })

  it('limits edge analysis to an explicit region of interest', () => {
    const width = 80
    const data = new Uint8ClampedArray(width * width * 4).fill(255)
    for (const y of [16, 60]) {
      for (let x = 8; x < 72; x += 1) {
        const offset = (y * width + x) * 4
        data[offset] = 0
        data[offset + 1] = 0
        data[offset + 2] = 0
      }
    }
    const candidates = detectWallCandidatesFromRgba({
      data,
      width,
      height: width,
      sampleStride: 1,
      minimumRun: 20,
      region: { x: 0, y: 40, width, height: 40 },
    })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((candidate) => candidate.a.y >= 39 && candidate.b.y >= 39)).toBe(true)
  })

  it('removes repeated full-map grid lines without removing shorter walls', () => {
    const grid = [0, 20, 40, 60, 80].map((y) => ({
      a: { x: 0, y }, b: { x: 100, y }, confidence: 0.5,
    }))
    const wall = { a: { x: 10, y: 15 }, b: { x: 70, y: 15 }, confidence: 0.5 }
    expect(removeLikelyGridLines([...grid, wall], 100, 100)).toEqual([wall])
  })

  it('can focus a busy landscape image on its central subject band', () => {
    const main = Array.from({ length: 8 }, (_, index) => ({
      a: { x: 100 + index * 10, y: 100 },
      b: { x: 108 + index * 10, y: 115 },
      confidence: 0.8,
    }))
    const remote = Array.from({ length: 3 }, (_, index) => ({
      a: { x: 800 + index * 10, y: 750 },
      b: { x: 808 + index * 10, y: 765 },
      confidence: 0.8,
    }))
    expect(filterToDominantCandidateCluster([...main, ...remote], 1_000, 800)).toEqual(main)
  })
})
