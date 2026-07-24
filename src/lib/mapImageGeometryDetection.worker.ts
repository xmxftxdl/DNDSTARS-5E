/// <reference lib="webworker" />

import { detectWallCandidatesFromRgba } from '../../shared/map-geometry-kernel.mjs'

self.onmessage = (event: MessageEvent<{
  data: Uint8ClampedArray
  width: number
  height: number
  sampleStride: number
  darknessThreshold: number
  edgeThreshold: number
  edgePercentile: number
  minimumRun: number
  region?: { x: number; y: number; width: number; height: number }
}>) => {
  const candidates = detectWallCandidatesFromRgba(event.data)
  self.postMessage(candidates)
}

export {}
