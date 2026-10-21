import { mapGeometryPhysicalProjectileImpact, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'

type Point = { x: number; y: number; elevationFeet: number }

/** Host geometry determines the first surface; requested destinations remain range-checked by the caller. */
export function resolveDnd5ePointProjectileImpact(input: {
  map: BattleMap
  geometry?: MapGeometryState
  from: Point
  to: Point
}): { point: Point; effectOrigin: Point; entityId?: string } {
  const impact = mapGeometryPhysicalProjectileImpact({
    map: input.map, geometry: input.geometry, from: input.from, to: input.to,
    elevationFeet: input.from.elevationFeet, toElevationFeet: input.to.elevationFeet,
  })
  const interpolate = (t: number): Point => ({
    x: input.from.x + (input.to.x - input.from.x) * t,
    y: input.from.y + (input.to.y - input.from.y) * t,
    elevationFeet: input.from.elevationFeet + (input.to.elevationFeet - input.from.elevationFeet) * t,
  })
  if (!impact) return { point: { ...input.to }, effectOrigin: { ...input.to } }
  const point = interpolate(impact.t)
  // Sample propagation immediately before contact, so a zero-width wall cannot
  // leak the explosion through its far side. The rendered center stays exact.
  const length = Math.hypot(input.to.x - input.from.x, input.to.y - input.from.y,
    (input.to.elevationFeet - input.from.elevationFeet) * input.map.gridSize / (input.map.feetPerCell ?? 5))
  const effectOrigin = interpolate(Math.max(0, impact.t - Math.min(1e-5, 1e-4 / Math.max(length, 1e-4))))
  return { point, effectOrigin, entityId: impact.entityId }
}
