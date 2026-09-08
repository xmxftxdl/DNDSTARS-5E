import { useEffect, useMemo, useRef, useState } from 'react'
import type { CameraState, MapAssetManifest, MobileRenderQuality } from '../../../../packages/mobile-protocol/src'
import { TileDiskCache } from './TileDiskCache'
import { visibleTileKeys, type TileKey } from './tileMath'

export interface ReadyTile extends TileKey {
  localUri: string
}

const QUALITY_BUDGETS: Record<MobileRenderQuality, { prefetchRings: number; gpuBytes: number; diskBytes: number }> = {
  lite: { prefetchRings: 0, gpuBytes: 48 * 1024 * 1024, diskBytes: 48 * 1024 * 1024 },
  standard: { prefetchRings: 1, gpuBytes: 96 * 1024 * 1024, diskBytes: 96 * 1024 * 1024 },
  high: { prefetchRings: 2, gpuBytes: 160 * 1024 * 1024, diskBytes: 160 * 1024 * 1024 },
}

export function useTileScheduler(
  manifest: MapAssetManifest,
  camera: CameraState,
  viewport: { width: number; height: number },
  pixelRatio: number,
  quality: MobileRenderQuality,
) {
  const [ready, setReady] = useState<ReadyTile[]>([])
  const [scheduledCamera, setScheduledCamera] = useState(camera)
  const [loading, setLoading] = useState(0)
  const [failures, setFailures] = useState(0)
  const budget = QUALITY_BUDGETS[quality]
  const cacheRef = useRef<{ assetHash: string; diskBytes: number; cache: TileDiskCache } | null>(null)
  if (!cacheRef.current || cacheRef.current.assetHash !== manifest.assetHash || cacheRef.current.diskBytes !== budget.diskBytes) {
    cacheRef.current = {
      assetHash: manifest.assetHash,
      diskBytes: budget.diskBytes,
      cache: new TileDiskCache(manifest.assetHash, budget.diskBytes),
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => setScheduledCamera(camera), 120)
    return () => clearTimeout(timer)
  }, [camera])
  const requested = useMemo(() => manifest.delivery === 'single-image' ? [] : visibleTileKeys(
    manifest, scheduledCamera, viewport, pixelRatio, budget.prefetchRings,
  ), [budget.prefetchRings, manifest, pixelRatio, scheduledCamera, viewport])

  useEffect(() => {
    const controller = new AbortController()
    const cache = cacheRef.current?.cache
    if (!cache) return
    const tileBytes = manifest.tileSize * manifest.tileSize * 4
    const maxTextures = Math.max(1, Math.floor(budget.gpuBytes / tileBytes))
    const queue = requested.slice(0, maxTextures)
    const requestedKeys = new Set(queue.map((tile) => `${tile.level}/${tile.x}/${tile.y}`))
    setReady((current) => current.filter((tile) => (
      tile.assetHash === manifest.assetHash
      && requestedKeys.has(`${tile.level}/${tile.x}/${tile.y}`)
    )))
    setLoading(queue.length)
    setFailures(0)
    let cursor = 0
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (!controller.signal.aborted && cursor < queue.length) {
        const tile = queue[cursor]
        cursor += 1
        try {
          const localUri = await cache.resolve(tile, controller.signal)
          if (!controller.signal.aborted) {
            setReady((current) => [
              ...current.filter((candidate) => !(candidate.level === tile.level && candidate.x === tile.x && candidate.y === tile.y)),
              { ...tile, localUri },
            ])
          }
        } catch (cause) {
          if (!controller.signal.aborted && !(cause instanceof Error && cause.name === 'AbortError')) {
            setFailures((value) => value + 1)
          }
        } finally {
          if (!controller.signal.aborted) setLoading((value) => Math.max(0, value - 1))
        }
      }
    })
    void Promise.all(workers)
    return () => controller.abort()
  }, [budget.gpuBytes, manifest.assetHash, manifest.tileSize, requested])

  return {
    tiles: ready,
    loading,
    failures,
    diskBytes: cacheRef.current.cache.sizeBytes(),
    estimatedGpuBytes: ready.length * manifest.tileSize * manifest.tileSize * 4,
    clearCache: () => {
      cacheRef.current?.cache.clear()
      setReady([])
    },
  }
}
