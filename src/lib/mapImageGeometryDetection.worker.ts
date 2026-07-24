/// <reference lib="webworker" />

import { detectWallCandidatesFromRgba } from '../../shared/map-geometry-kernel.mjs'

self.onmessage = (event: MessageEvent<{
  data: Uint8ClampedArray
  width: number
  height: number
  sampleStride: number
  darknessThreshold: number
  minimumRun: number
}>) => {
  const candidates = detectWallCandidatesFromRgba(event.data)
  self.postMessage(candidates)
}

export {}
