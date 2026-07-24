import { detectWallCandidatesFromRgba } from '../../shared/map-geometry-kernel.mjs'
import {
  migrateMapGeometryV3,
  type MapGeometryPoint,
  type MapGeometryState,
  type MapGeometryWall,
} from './mapGeometry'

export interface WallDetectionCandidate {
  a: MapGeometryPoint
  b: MapGeometryPoint
  confidence: number
}

export interface WallDetectionOptions {
  darknessThreshold?: number
  minimumRunRatio?: number
  maximumDimension?: number
}

async function detectCandidatesInWorker(input: {
  data: Uint8ClampedArray
  width: number
  height: number
  sampleStride: number
  darknessThreshold: number
  minimumRun: number
}): Promise<WallDetectionCandidate[]> {
  if (typeof Worker === 'undefined') return detectWallCandidatesFromRgba(input)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mapImageGeometryDetection.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WallDetectionCandidate[]>) => {
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || '墙体识别后台任务失败'))
    }
    worker.postMessage(input)
  })
}

function horizontal(candidate: WallDetectionCandidate): boolean {
  return Math.abs(candidate.a.y - candidate.b.y) <= Math.abs(candidate.a.x - candidate.b.x) * 0.2
}

function vertical(candidate: WallDetectionCandidate): boolean {
  return Math.abs(candidate.a.x - candidate.b.x) <= Math.abs(candidate.a.y - candidate.b.y) * 0.2
}

export function consolidateWallDetectionCandidates(
  candidates: WallDetectionCandidate[],
  tolerance = 8,
): WallDetectionCandidate[] {
  const consolidate = (entries: WallDetectionCandidate[], isHorizontal: boolean) => {
    const result: WallDetectionCandidate[] = []
    const sorted = [...entries].sort((left, right) =>
      (isHorizontal ? left.a.y - right.a.y : left.a.x - right.a.x),
    )
    for (const candidate of sorted) {
      const axis = isHorizontal ? candidate.a.y : candidate.a.x
      const start = Math.min(
        isHorizontal ? candidate.a.x : candidate.a.y,
        isHorizontal ? candidate.b.x : candidate.b.y,
      )
      const end = Math.max(
        isHorizontal ? candidate.a.x : candidate.a.y,
        isHorizontal ? candidate.b.x : candidate.b.y,
      )
      const match = result.find((existing) => {
        const existingAxis = isHorizontal ? existing.a.y : existing.a.x
        const existingStart = Math.min(
          isHorizontal ? existing.a.x : existing.a.y,
          isHorizontal ? existing.b.x : existing.b.y,
        )
        const existingEnd = Math.max(
          isHorizontal ? existing.a.x : existing.a.y,
          isHorizontal ? existing.b.x : existing.b.y,
        )
        return Math.abs(existingAxis - axis) <= tolerance &&
          start <= existingEnd + tolerance && end >= existingStart - tolerance
      })
      if (!match) {
        result.push({ ...candidate, a: { ...candidate.a }, b: { ...candidate.b } })
        continue
      }
      const existingAxis = isHorizontal ? match.a.y : match.a.x
      const mergedAxis = (existingAxis + axis) / 2
      const existingStart = Math.min(
        isHorizontal ? match.a.x : match.a.y,
        isHorizontal ? match.b.x : match.b.y,
      )
      const existingEnd = Math.max(
        isHorizontal ? match.a.x : match.a.y,
        isHorizontal ? match.b.x : match.b.y,
      )
      const mergedStart = Math.min(existingStart, start)
      const mergedEnd = Math.max(existingEnd, end)
      match.a = isHorizontal ? { x: mergedStart, y: mergedAxis } : { x: mergedAxis, y: mergedStart }
      match.b = isHorizontal ? { x: mergedEnd, y: mergedAxis } : { x: mergedAxis, y: mergedEnd }
      match.confidence = Math.max(match.confidence, candidate.confidence)
    }
    return result
  }
  return [
    ...consolidate(candidates.filter(horizontal), true),
    ...consolidate(candidates.filter(vertical), false),
    ...candidates.filter((candidate) => !horizontal(candidate) && !vertical(candidate)),
  ]
}

export function removeLikelyGridLines(
  candidates: WallDetectionCandidate[],
  width: number,
  height: number,
): WallDetectionCandidate[] {
  const regular = (entries: Array<{ candidate: WallDetectionCandidate; axis: number }>) => {
    if (entries.length < 4) return new Set<WallDetectionCandidate>()
    const sorted = [...entries].sort((left, right) => left.axis - right.axis)
    const gaps = sorted.slice(1).map((entry, index) => entry.axis - sorted[index].axis)
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    if (median < 8 || gaps.some((gap) => Math.abs(gap - median) > Math.max(2, median * 0.12))) {
      return new Set<WallDetectionCandidate>()
    }
    return new Set(sorted.map((entry) => entry.candidate))
  }
  const horizontalGrid = regular(candidates
    .filter((candidate) => horizontal(candidate) && Math.abs(candidate.b.x - candidate.a.x) >= width * 0.88)
    .map((candidate) => ({ candidate, axis: (candidate.a.y + candidate.b.y) / 2 })))
  const verticalGrid = regular(candidates
    .filter((candidate) => vertical(candidate) && Math.abs(candidate.b.y - candidate.a.y) >= height * 0.88)
    .map((candidate) => ({ candidate, axis: (candidate.a.x + candidate.b.x) / 2 })))
  return candidates.filter((candidate) => !horizontalGrid.has(candidate) && !verticalGrid.has(candidate))
}

export function wallDetectionCandidatesToGeometry(
  geometry: MapGeometryState,
  candidates: WallDetectionCandidate[],
  now = Date.now(),
): MapGeometryState {
  const detected: MapGeometryWall[] = candidates.map((candidate, index) => ({
    id: `detected:wall:${now}:${index}`,
    kind: 'wall',
    label: `自动识别墙 ${index + 1}`,
    points: [candidate.a, candidate.b],
    edgeIds: [`detected:edge:${now}:${index}`],
    material: 'stone',
    blocksVision: true,
    blocksMovement: true,
    blocksLineOfEffect: true,
    baseHeightFeet: 0,
    heightFeet: 10,
    createdAt: now + index,
  }))
  return migrateMapGeometryV3({
    ...geometry,
    walls: [...geometry.walls, ...detected],
    updatedAt: now,
  })
}

export async function detectWallsFromImageFile(
  file: File,
  target: { width: number; height: number },
  options: WallDetectionOptions = {},
): Promise<WallDetectionCandidate[]> {
  const bitmap = await createImageBitmap(file)
  try {
    const maximumDimension = Math.max(512, options.maximumDimension ?? 1_600)
    const analysisScale = Math.min(1, maximumDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * analysisScale))
    const height = Math.max(1, Math.round(bitmap.height * analysisScale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('浏览器无法创建图像分析画布')
    context.drawImage(bitmap, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    const raw = await detectCandidatesInWorker({
      data: image.data,
      width,
      height,
      sampleStride: 2,
      darknessThreshold: Math.max(0, Math.min(255, options.darknessThreshold ?? 68)),
      minimumRun: Math.max(12, Math.round(Math.min(width, height) * (options.minimumRunRatio ?? 0.025))),
    })
    const scaleX = target.width / width
    const scaleY = target.height / height
    const consolidated = consolidateWallDetectionCandidates(raw.map((candidate) => ({
      a: { x: candidate.a.x * scaleX, y: candidate.a.y * scaleY },
      b: { x: candidate.b.x * scaleX, y: candidate.b.y * scaleY },
      confidence: candidate.confidence,
    })), Math.max(4, Math.min(scaleX, scaleY) * 6))
    return removeLikelyGridLines(consolidated, target.width, target.height)
  } finally {
    bitmap.close()
  }
}
