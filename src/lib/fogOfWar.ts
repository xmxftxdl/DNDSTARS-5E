export const MAP_FOG_RESOURCE = 'map-fog'
export const MAP_FOG_SCHEMA_VERSION = 1
export const MAP_FOG_MAX_SHAPES = 2_048

export type FogOperation = 'cover' | 'reveal'
export type FogTool =
  | 'pan'
  | 'cover-rect'
  | 'reveal-rect'
  | 'cover-circle'
  | 'reveal-circle'
  | 'cover-polygon'
  | 'reveal-polygon'
  | 'cover-brush'
  | 'reveal-brush'

interface FogShapeBase {
  id: string
  operation: FogOperation
  createdAt: number
}

export type FogShape =
  | (FogShapeBase & { kind: 'rect'; x: number; y: number; width: number; height: number })
  | (FogShapeBase & { kind: 'circle'; x: number; y: number; radius: number })
  | (FogShapeBase & { kind: 'polygon'; points: number[] })
  | (FogShapeBase & { kind: 'brush'; points: number[]; width: number })

export interface MapFogState {
  mapId: string
  filled: boolean
  color: string
  opacity: number
  shapes: FogShape[]
  updatedAt: number
}

export interface SharedMapFogState {
  schemaVersion: typeof MAP_FOG_SCHEMA_VERSION
  maps: MapFogState[]
  updatedAt: number
}

export function fogOperationForTool(tool: FogTool): FogOperation {
  return tool.startsWith('reveal-') ? 'reveal' : 'cover'
}

export function fogShapeKindForTool(tool: FogTool): FogShape['kind'] {
  return tool.endsWith('-circle')
    ? 'circle'
    : tool.endsWith('-polygon')
      ? 'polygon'
      : tool.endsWith('-brush')
        ? 'brush'
        : 'rect'
}

export function createEmptyMapFog(mapId: string, now = Date.now()): MapFogState {
  return {
    mapId,
    filled: false,
    color: '#05070f',
    opacity: 0.98,
    shapes: [],
    updatedAt: now,
  }
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function normalizePoints(value: unknown, minimumPairs: number): number[] | undefined {
  if (!Array.isArray(value) || value.length < minimumPairs * 2 || value.length > 16_384 || value.length % 2 !== 0) return undefined
  if (value.some((entry) => !finite(entry, -1_000_000, 1_000_000))) return undefined
  return value.map(Number)
}

export function normalizeFogShape(value: unknown): FogShape | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    typeof raw.id !== 'string' || !raw.id || raw.id.length > 160 ||
    (raw.operation !== 'cover' && raw.operation !== 'reveal') ||
    !finite(raw.createdAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const base = { id: raw.id, operation: raw.operation as FogOperation, createdAt: raw.createdAt }
  if (raw.kind === 'rect') {
    if (!finite(raw.x, -1_000_000, 1_000_000) || !finite(raw.y, -1_000_000, 1_000_000) ||
      !finite(raw.width, 1, 1_000_000) || !finite(raw.height, 1, 1_000_000)) return undefined
    return { ...base, kind: 'rect', x: raw.x, y: raw.y, width: raw.width, height: raw.height }
  }
  if (raw.kind === 'circle') {
    if (!finite(raw.x, -1_000_000, 1_000_000) || !finite(raw.y, -1_000_000, 1_000_000) ||
      !finite(raw.radius, 1, 1_000_000)) return undefined
    return { ...base, kind: 'circle', x: raw.x, y: raw.y, radius: raw.radius }
  }
  if (raw.kind === 'polygon') {
    const points = normalizePoints(raw.points, 3)
    return points ? { ...base, kind: 'polygon', points } : undefined
  }
  if (raw.kind === 'brush') {
    const points = normalizePoints(raw.points, 2)
    if (!points || !finite(raw.width, 1, 10_000)) return undefined
    return { ...base, kind: 'brush', points, width: raw.width }
  }
  return undefined
}

export function normalizeMapFog(value: unknown): MapFogState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    typeof raw.mapId !== 'string' || !raw.mapId || raw.mapId.length > 160 ||
    typeof raw.filled !== 'boolean' || typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color) ||
    !finite(raw.opacity, 0.1, 1) || !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(raw.shapes) || raw.shapes.length > MAP_FOG_MAX_SHAPES
  ) return undefined
  const shapes = raw.shapes.map(normalizeFogShape)
  if (shapes.some((shape) => !shape)) return undefined
  const ids = new Set(shapes.map((shape) => shape!.id))
  if (ids.size !== shapes.length) return undefined
  return {
    mapId: raw.mapId,
    filled: raw.filled,
    color: raw.color,
    opacity: raw.opacity,
    shapes: shapes as FogShape[],
    updatedAt: raw.updatedAt,
  }
}

export type FogPointState = 'covered' | 'revealed' | 'neutral'

function pointInPolygon(points: readonly number[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i]
    const yi = points[i + 1]
    const xj = points[j]
    const yj = points[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function pointNearPolyline(points: readonly number[], x: number, y: number, radius: number): boolean {
  const radiusSquared = radius * radius
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i]
    const ay = points[i + 1]
    const bx = points[i + 2]
    const by = points[i + 3]
    const dx = bx - ax
    const dy = by - ay
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0
    const px = ax + dx * t - x
    const py = ay + dy * t - y
    if (px * px + py * py <= radiusSquared) return true
  }
  if (points.length === 2) {
    const px = points[0] - x
    const py = points[1] - y
    return px * px + py * py <= radiusSquared
  }
  return false
}

export function fogShapeContainsPoint(shape: FogShape, x: number, y: number): boolean {
  if (shape.kind === 'rect') {
    return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height
  }
  if (shape.kind === 'circle') {
    const dx = x - shape.x
    const dy = y - shape.y
    return dx * dx + dy * dy <= shape.radius * shape.radius
  }
  if (shape.kind === 'polygon') {
    return pointInPolygon(shape.points, x, y)
  }
  return pointNearPolyline(shape.points, x, y, shape.width / 2)
}

/**
 * Evaluates cover/reveal shapes in paint order (later shapes win), matching
 * how the DM fog editor composites them. 'neutral' means the point is outside
 * all shapes on an unfilled map.
 */
export function fogPointState(fog: Pick<MapFogState, 'filled' | 'shapes'>, x: number, y: number): FogPointState {
  let state: FogPointState = fog.filled ? 'covered' : 'neutral'
  for (const shape of fog.shapes) {
    if (fogShapeContainsPoint(shape, x, y)) state = shape.operation === 'cover' ? 'covered' : 'revealed'
  }
  return state
}

export function fogCoversPoint(fog: Pick<MapFogState, 'filled' | 'shapes'>, x: number, y: number): boolean {
  return fogPointState(fog, x, y) === 'covered'
}

export function normalizeSharedMapFog(value: unknown): SharedMapFogState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    raw.schemaVersion !== MAP_FOG_SCHEMA_VERSION || !Array.isArray(raw.maps) ||
    !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const maps = raw.maps.map(normalizeMapFog)
  if (maps.some((map) => !map)) return undefined
  const mapIds = new Set(maps.map((map) => map!.mapId))
  if (mapIds.size !== maps.length) return undefined
  return { schemaVersion: MAP_FOG_SCHEMA_VERSION, maps: maps as MapFogState[], updatedAt: raw.updatedAt }
}
