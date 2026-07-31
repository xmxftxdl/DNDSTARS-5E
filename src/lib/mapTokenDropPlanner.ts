import {
  resolveFreeDropCell,
  resolveTokenDropPosition,
  shouldSnapTokenOnDrop,
} from './gridCombat'
import {
  mapGeometryMovementBlocked,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  type MapGeometryState,
} from './mapGeometry'
import type { BattleMap, Token } from '../store/maps'

export type MapTokenDropPlan =
  | {
      status: 'allowed'
      position: { x: number; y: number }
      elevationFeet: number
    }
  | {
      status: 'blocked'
      entityId?: string
    }

/**
 * Produces the complete drop decision without mutating React state or the map.
 * Authority may skip the local blocker check, but snapping, occupancy and
 * terrain-relative elevation remain identical for every caller.
 */
export function planMapTokenDrop(input: {
  token: Token
  map: BattleMap
  geometry?: MapGeometryState
  x: number
  y: number
  validateMovementLocally: boolean
}): MapTokenDropPlan {
  const { token, map, geometry } = input
  const snapped = resolveTokenDropPosition(input.x, input.y, token, map)
  const position = shouldSnapTokenOnDrop(token, map)
    ? resolveFreeDropCell(snapped.x, snapped.y, token.id, map)
    : snapped
  const fromTerrainElevation = mapGeometryTerrainElevationAtPoint(geometry, token)
  const toTerrainElevation = mapGeometryTerrainElevationAtPoint(geometry, position)
  const heightAboveGround = Math.max(
    0,
    mapGeometryTokenElevation(geometry, token) - fromTerrainElevation,
  )
  const elevationFeet = toTerrainElevation + heightAboveGround

  if (input.validateMovementLocally) {
    const blocker = mapGeometryMovementBlocked({
      geometry,
      map,
      token,
      to: position,
      fromElevationFeet: mapGeometryTokenElevation(geometry, token),
      toElevationFeet: elevationFeet,
    })
    if (blocker.blocked) {
      return { status: 'blocked', entityId: blocker.entityId }
    }
  }

  return { status: 'allowed', position, elevationFeet }
}
