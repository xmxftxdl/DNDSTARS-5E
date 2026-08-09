import {
  mapGeometryDoorOpenState,
  type MapGeometryPoint,
  type MapGeometryState,
} from './mapGeometry'

export interface UvttExportOptions {
  width: number
  height: number
  pixelsPerGrid: number
  feetPerCell?: number
  imageDataUrl?: string
}

export interface UvttExportPoint {
  x: number
  y: number
}

export interface UvttExportDocument {
  format: number
  resolution: {
    map_origin: UvttExportPoint
    map_size: UvttExportPoint
    pixels_per_grid: number
  }
  line_of_sight: UvttExportPoint[][]
  objects_line_of_sight: UvttExportPoint[][]
  portals: Array<{
    position: UvttExportPoint
    bounds: [UvttExportPoint, UvttExportPoint]
    rotation: number
    closed: boolean
    freestanding: boolean
  }>
  lights: Array<{
    position: UvttExportPoint
    range: number
    intensity: number
    color: string
    shadows: boolean
  }>
  image?: string
  environment?: {
    baked_lighting: boolean
    ambient_light: string
  }
  /** Lossless metadata for Astral Trace re-import; other UVTT readers ignore it. */
  astral_trace?: {
    schema_version: 1
    feet_per_cell: number
    windows: Array<{
      bounds: [UvttExportPoint, UvttExportPoint]
      state: string
      type: string
    }>
  }
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`UVTT ${label} 必须大于 0`)
  return value
}

function round(value: number): number {
  return Number(value.toFixed(5))
}

function embeddedImagePayload(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = /^data:image\/(?:png|jpeg|webp);base64,([a-zA-Z0-9+/=\s]+)$/s.exec(value.trim())
  if (!match) throw new Error('UVTT 嵌入图片必须是 PNG、JPEG 或 WebP data URL')
  return match[1].replace(/\s/g, '')
}

export function exportUvttGeometry(
  geometry: MapGeometryState,
  options: UvttExportOptions,
): UvttExportDocument {
  const width = positive(options.width, '地图宽度')
  const height = positive(options.height, '地图高度')
  const pixelsPerGrid = positive(options.pixelsPerGrid, '每格像素')
  const feetPerCell = positive(options.feetPerCell ?? 5, '每格尺数')
  const convert = (point: MapGeometryPoint): UvttExportPoint => ({
    x: round(point.x / pixelsPerGrid),
    y: round(point.y / pixelsPerGrid),
  })
  const convertBounds = (points: readonly MapGeometryPoint[]): [UvttExportPoint, UvttExportPoint] => {
    if (points.length !== 2) throw new Error('UVTT 门窗必须恰好包含两个端点')
    return [convert(points[0]), convert(points[1])]
  }
  const midpoint = (bounds: [UvttExportPoint, UvttExportPoint]): UvttExportPoint => ({
    x: round((bounds[0].x + bounds[1].x) / 2),
    y: round((bounds[0].y + bounds[1].y) / 2),
  })
  const rotation = (bounds: [UvttExportPoint, UvttExportPoint]): number => round(
    Math.atan2(bounds[1].y - bounds[0].y, bounds[1].x - bounds[0].x) * 180 / Math.PI,
  )

  const document: UvttExportDocument = {
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: round(width / pixelsPerGrid), y: round(height / pixelsPerGrid) },
      pixels_per_grid: pixelsPerGrid,
    },
    line_of_sight: geometry.walls
      .filter((wall) => wall.blocksVision && wall.points.length >= 2)
      .map((wall) => wall.points.map(convert)),
    objects_line_of_sight: geometry.obstacles
      .filter((obstacle) => obstacle.blocksVision && !obstacle.terrainRegion && obstacle.points.length >= 2)
      .map((obstacle) => {
        const points = obstacle.points.map(convert)
        const first = points[0]
        const last = points.at(-1)
        return first && last && (first.x !== last.x || first.y !== last.y) ? [...points, first] : points
      }),
    portals: geometry.doors.map((door) => {
      const bounds = convertBounds(door.points)
      return {
        position: midpoint(bounds),
        bounds,
        rotation: rotation(bounds),
        closed: mapGeometryDoorOpenState(door) !== 'open',
        freestanding: !door.wallEdgeId && !door.parentWallId,
      }
    }),
    lights: (geometry.lights ?? [])
      .filter((light) => light.enabled)
      .map((light) => ({
        position: convert(light.points[0]),
        range: round((light.brightRadiusFeet + light.dimRadiusFeet) / feetPerCell),
        intensity: round(light.brightRadiusFeet / Math.max(1, light.brightRadiusFeet + light.dimRadiusFeet)),
        color: light.color,
        shadows: true,
      })),
    environment: {
      baked_lighting: false,
      ambient_light: geometry.vision.ambientLight === 'bright'
        ? '#ffffff'
        : geometry.vision.ambientLight === 'dim' ? '#777777' : '#000000',
    },
  }
  const image = embeddedImagePayload(options.imageDataUrl)
  if (image) document.image = image
  const windows = geometry.windows ?? []
  if (windows.length > 0) {
    document.astral_trace = {
      schema_version: 1,
      feet_per_cell: feetPerCell,
      windows: windows.map((window) => ({
        bounds: convertBounds(window.points),
        state: window.windowState ?? 'closed',
        type: window.windowType,
      })),
    }
  }
  return document
}

export function uvttDownloadBlob(geometry: MapGeometryState, options: UvttExportOptions): Blob {
  return new Blob([JSON.stringify(exportUvttGeometry(geometry, options), null, 2)], {
    type: 'application/json',
  })
}
