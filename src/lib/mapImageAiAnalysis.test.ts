import { describe, expect, it } from 'vitest'
import { aiMapAnalysisWallCandidates, isAiMapAnalysisV1 } from './mapImageAiAnalysis'

describe('AI map analysis schema', () => {
  const valid = {
    schemaVersion: 1 as const,
    mapType: 'battlemap' as const,
    summary: '地牢',
    grid: { visible: true, estimatedPixelsPerGrid: 70, confidence: 0.8 },
    walls: [{ points: [{ x: 100, y: 200 }, { x: 900, y: 200 }, { x: 900, y: 700 }], confidence: 0.9 }],
    warnings: [],
  }

  it('validates bounded normalized geometry', () => {
    expect(isAiMapAnalysisV1(valid)).toBe(true)
    expect(isAiMapAnalysisV1({ ...valid, walls: [{ points: [{ x: -1, y: 0 }, { x: 1, y: 1 }], confidence: 1 }] })).toBe(false)
  })

  it('converts normalized polylines to pixel-space wall candidates', () => {
    expect(aiMapAnalysisWallCandidates(valid, 2_000, 1_000)).toEqual([
      { a: { x: 200, y: 200 }, b: { x: 1800, y: 200 }, confidence: 0.9 },
      { a: { x: 1800, y: 200 }, b: { x: 1800, y: 700 }, confidence: 0.9 },
    ])
  })
})
