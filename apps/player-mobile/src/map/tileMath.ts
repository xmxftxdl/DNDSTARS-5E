import type { CameraState, MapAssetManifest } from '../../../../packages/mobile-protocol/src'

export interface TileKey {
  assetHash: string
  level: number
  x: number
  y: number
  priority: number
  url: string
  worldX: number
  worldY: number
  worldSize: number
}

export function selectZoomLevel(manifest: MapAssetManifest, cameraScale: number, pixelRatio: number) {
  const desired = cameraScale * Math.min(2, Math.max(1, pixelRatio))
  return [...manifest.zoomLevels].sort((a, b) => (
    Math.abs(Math.log2(Math.max(a.scale, 0.0001) / desired))
      - Math.abs(Math.log2(Math.max(b.scale, 0.0001) / desired))
  ))[0] ?? manifest.zoomLevels[0]
}

export function visibleTileKeys(
  manifest: MapAssetManifest,
  camera: CameraState,
  viewport: { width: number; height: number },
  pixelRatio: number,
  prefetchRings = 1,
): TileKey[] {
  const level = selectZoomLevel(manifest, camera.scale, pixelRatio)
  if (!level || viewport.width <= 0 || viewport.height <= 0) return []
  const worldSize = manifest.tileSize / level.scale
  const worldLeft = -camera.x / camera.scale
  const worldTop = -camera.y / camera.scale
  const worldRight = (viewport.width - camera.x) / camera.scale
  const worldBottom = (viewport.height - camera.y) / camera.scale
  const minX = Math.max(0, Math.floor(worldLeft / worldSize) - prefetchRings)
  const minY = Math.max(0, Math.floor(worldTop / worldSize) - prefetchRings)
  const maxX = Math.min(level.columns - 1, Math.floor(worldRight / worldSize) + prefetchRings)
  const maxY = Math.min(level.rows - 1, Math.floor(worldBottom / worldSize) + prefetchRings)
  const centerX = (worldLeft + worldRight) / (2 * worldSize)
  const centerY = (worldTop + worldBottom) / (2 * worldSize)
  const keys: TileKey[] = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      keys.push({
        assetHash: manifest.assetHash,
        level: level.level,
        x,
        y,
        priority: Math.hypot(x - centerX, y - centerY),
        url: manifest.tileUrlTemplate
          .replace('{z}', String(level.level))
          .replace('{x}', String(x))
          .replace('{y}', String(y)),
        worldX: x * worldSize,
        worldY: y * worldSize,
        worldSize,
      })
    }
  }
  return keys.sort((a, b) => a.priority - b.priority)
}

export function screenToWorld(camera: CameraState, point: { x: number; y: number }) {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }
}

export function clampCamera(
  camera: CameraState,
  viewport: { width: number; height: number },
  manifest: MapAssetManifest,
): CameraState {
  const scale = Math.max(0.035, Math.min(1.8, camera.scale))
  const margin = 120
  const mapWidth = manifest.worldWidth * scale
  const mapHeight = manifest.worldHeight * scale
  return {
    scale,
    x: Math.max(viewport.width - mapWidth - margin, Math.min(margin, camera.x)),
    y: Math.max(viewport.height - mapHeight - margin, Math.min(margin, camera.y)),
  }
}

