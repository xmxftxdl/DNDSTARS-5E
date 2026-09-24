import { mapGeometryTerrainElevationAtPoint, type MapGeometryState } from './mapGeometry'
import type { BattleMap, Token } from '../store/maps'

type Point = { x: number; y: number }

/** A climber must stay in contact with a mapped surface, never a free flight plane. */
export function mapClimbSupported(
  geometry: MapGeometryState | undefined, map: BattleMap, token: Token,
  from: Point, to: Point, fromHeight: number, toHeight: number,
): boolean {
  const groundFrom = mapGeometryTerrainElevationAtPoint(geometry, from)
  const groundTo = mapGeometryTerrainElevationAtPoint(geometry, to)
  if (fromHeight < groundFrom || toHeight < groundTo) return false
  // Adjacent terrain cells represent the two sides of a cliff.
  if (fromHeight === groundFrom && toHeight === groundTo) return true
  const reach = map.gridSize * Math.max(1, token.size) / 2 + 0.01
  const near = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= reach
  }
  const surfaces = [
    ...(geometry?.walls ?? []).filter(w => w.blocksMovement).map(w => ({
      points: w.points, closed: false, bottom: w.baseHeightFeet, top: w.baseHeightFeet + w.heightFeet,
    })),
    ...(geometry?.obstacles ?? []).filter(o => o.blocksMovement || o.terrainElevationFeet != null).map(o => ({
      points: o.points, closed: true, bottom: Math.min(o.baseHeightFeet, groundFrom, groundTo),
      top: Math.max(o.terrainElevationFeet ?? -Infinity, o.baseHeightFeet + o.heightFeet),
    })),
  ]
  return surfaces.some(surface => {
    if (Math.min(fromHeight, toHeight) < surface.bottom || Math.max(fromHeight, toHeight) > surface.top) return false
    return surface.points.some((a, i) => {
      const b = surface.points[i + 1] ?? (surface.closed ? surface.points[0] : undefined)
      return b != null && near(from, a, b) && near(to, a, b)
    })
  })
}
