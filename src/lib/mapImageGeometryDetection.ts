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
  /** @deprecated Use edgeThreshold. Kept for saved UI settings from the dark-run detector. */
  darknessThreshold?: number
  edgeThreshold?: number
  edgePercentile?: number
  minimumRunRatio?: number
  maximumDimension?: number
  maximumCandidates?: number
  region?: { x: number; y: number; width: number; height: number }
  focusMode?: 'all' | 'dominant'
}

interface CachedImageAnalysis {
  data: Uint8ClampedArray
  width: number
  height: number
}

const imageAnalysisCache = new WeakMap<File, Map<number, Promise<CachedImageAnalysis>>>()

function cachedImageAnalysis(file: File, maximumDimension: number): Promise<CachedImageAnalysis> {
  let variants = imageAnalysisCache.get(file)
  if (!variants) {
    variants = new Map()
    imageAnalysisCache.set(file, variants)
  }
  const cached = variants.get(maximumDimension)
  if (cached) return cached
  const pending = createImageBitmap(file).then((bitmap) => {
    try {
      const analysisScale = Math.min(1, maximumDimension / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * analysisScale))
      const height = Math.max(1, Math.round(bitmap.height * analysisScale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('浏览器无法创建图像分析画布')
      context.drawImage(bitmap, 0, 0, width, height)
      return {
        data: context.getImageData(0, 0, width, height).data,
        width,
        height,
      }
    } finally {
      bitmap.close()
    }
  }).catch((error) => {
    variants?.delete(maximumDimension)
    throw error
  })
  variants.set(maximumDimension, pending)
  return pending
}

async function detectCandidatesInWorker(input: {
  data: Uint8ClampedArray
  width: number
  height: number
  sampleStride: number
  darknessThreshold: number
  edgeThreshold: number
  edgePercentile: number
  minimumRun: number
  region?: { x: number; y: number; width: number; height: number }
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
    if (input.data.buffer instanceof ArrayBuffer) {
      worker.postMessage(input, [input.data.buffer])
    } else {
      worker.postMessage(input)
    }
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
  type ProjectedCandidate = {
    candidate: WallDetectionCandidate
    angleKey: number
    ux: number
    uy: number
    nx: number
    ny: number
    rho: number
    start: number
    end: number
  }
  const projected = candidates.flatMap<ProjectedCandidate>((candidate) => {
    let dx = candidate.b.x - candidate.a.x
    let dy = candidate.b.y - candidate.a.y
    const length = Math.hypot(dx, dy)
    if (length < 1) return []
    dx /= length
    dy /= length
    if (dx < 0 || (Math.abs(dx) < 1e-6 && dy < 0)) {
      dx *= -1
      dy *= -1
    }
    const nx = -dy
    const ny = dx
    const angle = Math.atan2(dy, dx)
    const start = Math.min(candidate.a.x * dx + candidate.a.y * dy, candidate.b.x * dx + candidate.b.y * dy)
    const end = Math.max(candidate.a.x * dx + candidate.a.y * dy, candidate.b.x * dx + candidate.b.y * dy)
    return [{
      candidate: { ...candidate, a: { ...candidate.a }, b: { ...candidate.b } },
      angleKey: Math.round(angle / (Math.PI / 24)),
      ux: dx,
      uy: dy,
      nx,
      ny,
      rho: ((candidate.a.x + candidate.b.x) / 2) * nx + ((candidate.a.y + candidate.b.y) / 2) * ny,
      start,
      end,
    }]
  })
  const groups = new Map<number, ProjectedCandidate[]>()
  for (const entry of projected) {
    const group = groups.get(entry.angleKey)
    if (group) group.push(entry)
    else groups.set(entry.angleKey, [entry])
  }
  const result: WallDetectionCandidate[] = []
  for (const group of groups.values()) {
    const merged: ProjectedCandidate[] = []
    for (const entry of group.sort((left, right) => left.rho - right.rho || left.start - right.start)) {
      const match = merged.find((existing) =>
        Math.abs(existing.rho - entry.rho) <= tolerance &&
        entry.start <= existing.end + tolerance * 1.5 &&
        entry.end >= existing.start - tolerance * 1.5,
      )
      if (!match) {
        merged.push(entry)
        continue
      }
      const leftLength = match.end - match.start
      const rightLength = entry.end - entry.start
      const totalLength = Math.max(1, leftLength + rightLength)
      match.rho = (match.rho * leftLength + entry.rho * rightLength) / totalLength
      match.start = Math.min(match.start, entry.start)
      match.end = Math.max(match.end, entry.end)
      match.candidate.confidence = Math.max(match.candidate.confidence, entry.candidate.confidence)
      match.candidate.a = {
        x: match.ux * match.start + match.nx * match.rho,
        y: match.uy * match.start + match.ny * match.rho,
      }
      match.candidate.b = {
        x: match.ux * match.end + match.nx * match.rho,
        y: match.uy * match.end + match.ny * match.rho,
      }
    }
    result.push(...merged.map((entry) => entry.candidate))
  }
  return result
}

export function removeLikelyGridLines(
  candidates: WallDetectionCandidate[],
  width: number,
  height: number,
): WallDetectionCandidate[] {
  const regular = (
    entries: Array<{ candidate: WallDetectionCandidate; axis: number; start: number; end: number }>,
    span: number,
  ) => {
    const axisTolerance = Math.max(2, Math.min(width, height) * 0.0025)
    const clusters: Array<{
      axis: number
      candidates: WallDetectionCandidate[]
      intervals: Array<[number, number]>
    }> = []
    for (const entry of [...entries].sort((left, right) => left.axis - right.axis)) {
      const cluster = clusters.find((candidate) => Math.abs(candidate.axis - entry.axis) <= axisTolerance)
      if (cluster) {
        cluster.axis = (cluster.axis * cluster.candidates.length + entry.axis) / (cluster.candidates.length + 1)
        cluster.candidates.push(entry.candidate)
        cluster.intervals.push([entry.start, entry.end])
      } else {
        clusters.push({ axis: entry.axis, candidates: [entry.candidate], intervals: [[entry.start, entry.end]] })
      }
    }
    const coverage = (intervals: Array<[number, number]>) => {
      const sorted = intervals
        .map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as [number, number])
        .sort((left, right) => left[0] - right[0])
      let total = 0
      let current = sorted[0]
      if (!current) return 0
      for (const interval of sorted.slice(1)) {
        if (interval[0] <= current[1] + axisTolerance * 2) current[1] = Math.max(current[1], interval[1])
        else {
          total += current[1] - current[0]
          current = interval
        }
      }
      return total + current[1] - current[0]
    }
    const longClusters = clusters
      .filter((cluster) => coverage(cluster.intervals) >= span * 0.32)
      .sort((left, right) => left.axis - right.axis)
    if (longClusters.length < 4) return new Set<WallDetectionCandidate>()
    const axes = longClusters.map((cluster) => cluster.axis)
    let best: { spacing: number; offset: number; matches: number[] } | undefined
    for (let left = 0; left < axes.length; left += 1) {
      for (let right = left + 1; right < axes.length; right += 1) {
        const distance = axes[right] - axes[left]
        for (let divisor = 1; divisor <= 8; divisor += 1) {
          const spacing = distance / divisor
          if (spacing < 8 || spacing > span / 3) continue
          const tolerance = Math.max(2.5, spacing * 0.1)
          const offset = axes[left]
          const matches = axes.flatMap((axis, index) => {
            const lattice = Math.round((axis - offset) / spacing)
            return Math.abs(axis - (offset + lattice * spacing)) <= tolerance ? [index] : []
          })
          if (!best || matches.length > best.matches.length) best = { spacing, offset, matches }
        }
      }
    }
    if (!best || best.matches.length < 4) return new Set<WallDetectionCandidate>()
    return new Set(best.matches.flatMap((index) => longClusters[index].candidates))
  }
  const horizontalGrid = regular(candidates
    .filter(horizontal)
    .map((candidate) => ({
      candidate,
      axis: (candidate.a.y + candidate.b.y) / 2,
      start: candidate.a.x,
      end: candidate.b.x,
    })), width)
  const verticalGrid = regular(candidates
    .filter(vertical)
    .map((candidate) => ({
      candidate,
      axis: (candidate.a.x + candidate.b.x) / 2,
      start: candidate.a.y,
      end: candidate.b.y,
    })), height)
  return candidates.filter((candidate) => !horizontalGrid.has(candidate) && !verticalGrid.has(candidate))
}

export function rankWallDetectionCandidates(
  candidates: WallDetectionCandidate[],
  maximumCandidates = 1_200,
): WallDetectionCandidate[] {
  if (candidates.length <= maximumCandidates) return candidates
  return [...candidates]
    .sort((left, right) => {
      const leftLength = Math.hypot(left.b.x - left.a.x, left.b.y - left.a.y)
      const rightLength = Math.hypot(right.b.x - right.a.x, right.b.y - right.a.y)
      return right.confidence * Math.sqrt(rightLength) - left.confidence * Math.sqrt(leftLength)
    })
    .slice(0, maximumCandidates)
}

export function filterToDominantCandidateCluster(
  candidates: WallDetectionCandidate[],
  width: number,
  height: number,
): WallDetectionCandidate[] {
  if (candidates.length < 8) return candidates
  // A semantic "largest object" guess is unstable on illustrated maps: nearby
  // rigging or furniture can connect unrelated clusters. Use a deterministic
  // center band instead, and leave exact ROI selection to the explicit region option.
  const landscape = width >= height
  const horizontalMargin = landscape ? width * 0.01 : width * 0.14
  const verticalMargin = landscape ? height * 0.12 : height * 0.01
  const bounds = {
    left: horizontalMargin,
    right: width - horizontalMargin,
    top: verticalMargin,
    bottom: height - verticalMargin,
  }
  const focused = candidates.filter((candidate) => {
    const midpointX = (candidate.a.x + candidate.b.x) / 2
    const midpointY = (candidate.a.y + candidate.b.y) / 2
    return midpointX >= bounds.left && midpointX <= bounds.right &&
      midpointY >= bounds.top && midpointY <= bounds.bottom
  })
  return focused.length >= Math.min(8, candidates.length) ? focused : candidates
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
  const maximumDimension = Math.max(512, options.maximumDimension ?? 1_600)
  const analysis = await cachedImageAnalysis(file, maximumDimension)
  const { width, height } = analysis
  const raw = await detectCandidatesInWorker({
    // The cached raster remains reusable while this disposable copy is transferred.
    data: new Uint8ClampedArray(analysis.data),
    width,
    height,
    sampleStride: 2,
    darknessThreshold: Math.max(0, Math.min(255, options.darknessThreshold ?? 68)),
    edgeThreshold: Math.max(8, Math.min(120, options.edgeThreshold ?? 22)),
    edgePercentile: Math.max(0.78, Math.min(0.98, options.edgePercentile ?? 0.88)),
    minimumRun: Math.max(12, Math.round(Math.min(width, height) * (options.minimumRunRatio ?? 0.025))),
    region: options.region
      ? {
          x: options.region.x / target.width * width,
          y: options.region.y / target.height * height,
          width: options.region.width / target.width * width,
          height: options.region.height / target.height * height,
        }
      : undefined,
  })
  const scaleX = target.width / width
  const scaleY = target.height / height
  const consolidated = consolidateWallDetectionCandidates(raw.map((candidate) => ({
    a: { x: candidate.a.x * scaleX, y: candidate.a.y * scaleY },
    b: { x: candidate.b.x * scaleX, y: candidate.b.y * scaleY },
    confidence: candidate.confidence,
  })), Math.max(4, Math.min(scaleX, scaleY) * 6))
  const gridFiltered = removeLikelyGridLines(consolidated, target.width, target.height)
  const focused = options.focusMode === 'dominant'
    ? filterToDominantCandidateCluster(gridFiltered, target.width, target.height)
    : gridFiltered
  return rankWallDetectionCandidates(
    focused,
    Math.max(100, options.maximumCandidates ?? 1_200),
  )
}
