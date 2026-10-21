import {pixelToCell} from '../../lib/gridCombat'
import { findHomingProjectileVolumePath, type HomingVolumeResult } from './homingProjectileVolumePath'
import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eWeaponRangeFeet, type Dnd5eWeaponAttackProfile } from './equipment'
import type {BattleMap, Token} from '../../store/maps'
import {mapGeometryLineOfEffectBlocked, mapGeometryOrdinaryProjectileBlocked, type MapGeometryState} from '../../lib/mapGeometry'
import {findMapGeometryPath, type MapPathResult} from '../../lib/mapPathfinding'

/** Host-side grid route for a projectile that can turn corners. Does not reveal or qualify a target. */
function searchHomingProjectilePath(input: {
  map: BattleMap
  geometry?: MapGeometryState
  origin: Token
  target: Token
  maximumFeet: number
}): HomingVolumeResult {
  if (!Number.isFinite(input.maximumFeet) || input.maximumFeet <= 0 || input.origin.id === input.target.id) return { status: 'incomplete' }
  // Retain the cheap planar route when available, then search altitude as well.
  const elevation = input.origin.elevationFeet ?? 0
  if (!Number.isFinite(elevation)) return { status: 'incomplete' }
  if (elevation !== (input.target.elevationFeet ?? 0)) return findHomingProjectileVolumePath(input)
  const startCell = pixelToCell(input.origin.x, input.origin.y, input.map)
  const endCell = pixelToCell(input.target.x, input.target.y, input.map)
  if (startCell.col === endCell.col && startCell.row === endCell.row) return findHomingProjectileVolumePath(input)
  const projectile: Token = {...input.origin, size:1, elevationFeet:elevation}
  const path = findMapGeometryPath({
    map:input.map, geometry:input.geometry, token:projectile, to:input.target,
    ignoreGeometryCollision:true, ignoreTokens:true, allowOccupiedDestination:true,
    ignoreDifficultTerrain:true, canFly:true, targetElevationFeet:elevation,
    canTraverseEdge:(from,to) => !mapGeometryLineOfEffectBlocked({
      map:input.map,geometry:input.geometry,from,to,elevationFeet:elevation,
    }) && !mapGeometryOrdinaryProjectileBlocked({
      map:input.map,geometry:input.geometry,from:{...projectile,...from},to:{...projectile,...to},
    }),
  })
  return path && path.distanceFeet <= input.maximumFeet ? { status: 'reached', path } : findHomingProjectileVolumePath(input)
}

export function dnd5eHomingProjectilePath(input: Parameters<typeof searchHomingProjectilePath>[0]): MapPathResult | undefined {
  const result = searchHomingProjectilePath(input)
  return result.status === 'reached' ? result.path : undefined
}

/** Undefined means unsupported/missing evidence; false means a verified vanished projectile. */
export function dnd5eEquipmentHomingProjectileReached(input: {
  state: Dnd5eHeadlessCombatState; actorId: string; targetIds: readonly string[];
  profile?: Dnd5eWeaponAttackProfile;
}): boolean | undefined {
  const scene = input.state.companionScene
  const source = scene?.map.tokens.find(token => token.id === input.actorId)
  const destination = scene?.map.tokens.find(token => token.id === input.targetIds[0])
  if (!scene || scene.map.id !== input.state.mapId || !source || !destination || !input.profile ||
    input.profile.mode !== 'ranged' || input.targetIds.length !== 1 || source.id === destination.id) return undefined
  const result = searchHomingProjectilePath({ map: scene.map, geometry: scene.geometry ?? undefined,
    origin: source, target: destination, maximumFeet: dnd5eWeaponRangeFeet(input.profile) })
  return result.status === 'incomplete' ? undefined : result.status === 'reached'
}
