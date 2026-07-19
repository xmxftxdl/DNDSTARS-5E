import type { MapGeometryPoint } from './mapGeometry'

export const MAP_EXPLORATION_RESOURCE = 'map-exploration'
export const MAP_EXPLORATION_SCHEMA_VERSION = 1
export const MAP_EXPLORATION_MAX_POLYGONS_PER_MEMBER = 256

export interface MapExplorationMemberState {
  polygons: MapGeometryPoint[][]
  updatedAt: number
}

export interface MapExplorationMapState {
  mapId: string
  byMemberId: Record<string, MapExplorationMemberState>
  updatedAt: number
}

export interface SharedMapExplorationState {
  schemaVersion: typeof MAP_EXPLORATION_SCHEMA_VERSION
  maps: MapExplorationMapState[]
  updatedAt: number
}

function finitePoint(value: unknown): value is MapGeometryPoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const point = value as Record<string, unknown>
  return typeof point.x === 'number' && Number.isFinite(point.x) && Math.abs(point.x) <= 1_000_000 &&
    typeof point.y === 'number' && Number.isFinite(point.y) && Math.abs(point.y) <= 1_000_000
}

export function normalizeSharedMapExploration(value: unknown): SharedMapExplorationState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.maps) || !Number.isFinite(raw.updatedAt)) return undefined
  const maps: MapExplorationMapState[] = []
  for (const rawMap of raw.maps) {
    if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return undefined
    const map = rawMap as Record<string, unknown>
    if (typeof map.mapId !== 'string' || !map.mapId || !Number.isFinite(map.updatedAt) ||
      !map.byMemberId || typeof map.byMemberId !== 'object' || Array.isArray(map.byMemberId)) return undefined
    const byMemberId: Record<string, MapExplorationMemberState> = {}
    for (const [memberId, rawMember] of Object.entries(map.byMemberId as Record<string, unknown>)) {
      if (!memberId || memberId.length > 160 || !rawMember || typeof rawMember !== 'object' || Array.isArray(rawMember)) return undefined
      const member = rawMember as Record<string, unknown>
      if (!Array.isArray(member.polygons) || member.polygons.length > MAP_EXPLORATION_MAX_POLYGONS_PER_MEMBER ||
        !Number.isFinite(member.updatedAt)) return undefined
      const polygons: MapGeometryPoint[][] = []
      for (const polygon of member.polygons) {
        if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 512 || !polygon.every(finitePoint)) return undefined
        polygons.push(polygon.map((point) => ({ x: point.x, y: point.y })))
      }
      byMemberId[memberId] = { polygons, updatedAt: member.updatedAt as number }
    }
    maps.push({ mapId: map.mapId, byMemberId, updatedAt: map.updatedAt as number })
  }
  if (new Set(maps.map((map) => map.mapId)).size !== maps.length) return undefined
  return { schemaVersion: 1, maps, updatedAt: raw.updatedAt as number }
}

export function mapExplorationPolygonSignature(polygon: readonly MapGeometryPoint[]): string {
  return polygon.map((point) => `${Math.round(point.x / 10)},${Math.round(point.y / 10)}`).join(';')
}
