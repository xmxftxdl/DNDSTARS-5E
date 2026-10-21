import type { BattleMap, Token } from '../../store/maps'
import { mapGeometryPlacementBlocked, type MapGeometryState } from '../../lib/mapGeometry'

export function dnd5eMappedUpwardClearance(input: {
  map: BattleMap; geometry?: MapGeometryState; token: Token; elevationFeet: number
}): number {
  const result = dnd5eMappedVerticalDisplacement({ ...input, fromFeet: input.elevationFeet, toFeet: 10000 })
  return Math.max(0, result.elevationFeet - input.elevationFeet)
}

/** First mapped solid met by a vertical body sweep, including thin overhead slabs. */
export function dnd5eMappedVerticalDisplacement(input: {
  map: BattleMap; geometry?: MapGeometryState; token: Token; fromFeet: number; toFeet: number
  bodyHeightFeet?: number
}): { elevationFeet: number; blocked: boolean; entityId?: string } {
  const { map, geometry, token, fromFeet, toFeet } = input
  if (![fromFeet, toFeet].every(Number.isFinite)) return { elevationFeet: fromFeet, blocked: true }
  const direction = Math.sign(toFeet - fromFeet)
  if (!direction) return { elevationFeet: fromFeet, blocked: false }
  const bodyHeight = input.bodyHeightFeet ?? Math.max(5, Math.max(1, token.size) * 5)
  const low = Math.min(fromFeet, toFeet), high = Math.max(fromFeet, toFeet)
  const boundaries = new Set([fromFeet, toFeet])
  for (const entity of [...(geometry?.walls ?? []), ...(geometry?.doors ?? []),
    ...(geometry?.windows ?? []), ...(geometry?.obstacles ?? [])]) {
    for (const height of [entity.baseHeightFeet - bodyHeight, entity.baseHeightFeet + entity.heightFeet]) {
      if (Number.isFinite(height) && height > low && height < high) boundaries.add(height)
    }
  }
  const levels = [...boundaries].sort((a, b) => direction * (a - b))
  // Persistent areas retain their dedicated volume movement checks. This sweep
  // resolves mapped solids without treating the newly created lifting entity
  // itself as an overhead obstacle.
  const geometryMap = { ...map, dnd5ePluginAreas: [] }
  for (let index = 1; index < levels.length; index++) {
    const previous = levels[index - 1], next = levels[index]
    const collision = mapGeometryPlacementBlocked({ geometry, map: geometryMap, token, at: token,
      elevationFeet: (previous + next) / 2, mappedBodyHeightFeet: bodyHeight })
    if (collision.blocked) return { elevationFeet: previous, blocked: true, entityId: collision.entityId }
  }
  const endpoint = mapGeometryPlacementBlocked({ geometry, map: geometryMap, token, at: token, elevationFeet: toFeet, mappedBodyHeightFeet: bodyHeight })
  return { elevationFeet: toFeet, blocked: endpoint.blocked, entityId: endpoint.entityId }
}
