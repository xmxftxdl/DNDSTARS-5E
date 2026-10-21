import { prepareStructureRemoval } from '../../../shared/structure-expiry.mjs'
import { mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, mapGeometryPointInPolygon,
  mapGeometryLineOfEffectBlocked, mapGeometryLineOfSightBlocked, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eActivityPointVisible } from './activityPointVisibility'

/** Validates an explicitly picked surface against the Host's current geometry.
 * Casting eligibility, spell modifiers and costs belong to the casting authority. */
export function prepareDnd5eTempleDisintegrationTarget(input: Parameters<typeof prepareDnd5eTempleDisintegration>[0] & {
  actorTokenId: string
  targetPosition: { x: number; y: number }
  targetElevationFeet: number
  rangeFeet: number
  characters?: readonly Character[]
}) {
  const projection = prepareDnd5eTempleDisintegration(input)
  if (!projection.ok) return projection
  const actor = input.map.tokens.find(token => token.id === input.actorTokenId &&
    token.type !== 'obstacle' && !token.dnd5eSpellEffect)
  const target = [...input.geometry.walls, ...input.geometry.doors, ...input.geometry.obstacles,
    ...input.geometry.windows ?? []].find(entity => entity.id === input.targetEntityId)!
  const point = input.targetPosition
  if (!actor || ![point.x, point.y, input.targetElevationFeet, input.rangeFeet].every(Number.isFinite) || input.rangeFeet <= 0 ||
    point.x < 0 || point.y < 0 || point.x > input.map.width || point.y > input.map.height ||
    input.targetElevationFeet < target.baseHeightFeet - 1e-6 ||
    input.targetElevationFeet > target.baseHeightFeet + target.heightFeet + 1e-6) {
    return { ok: false as const, reason: 'temple-disintegration-invalid-target' }
  }
  const edgeDistance = Math.min(...target.points.map((a, index) => {
    const b = target.points[(index + 1) % target.points.length]
    const dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy || 1)))
    return Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy)
  }))
  const onHorizontalFace = target.points.length > 2 && mapGeometryPointInPolygon(point, target.points) &&
    (Math.abs(input.targetElevationFeet-target.baseHeightFeet) < 1e-6 ||
      Math.abs(input.targetElevationFeet-target.baseHeightFeet-target.heightFeet) < 1e-6)
  if (edgeDistance > 1e-5 && !onHorizontalFace) return { ok: false as const, reason: 'temple-disintegration-invalid-target' }
  const fromElevationFeet = mapGeometryTokenElevation(input.geometry, actor)
  const scale = (input.map.feetPerCell ?? 5) / input.map.gridSize
  if (!Number.isFinite(scale) || scale <= 0 || Math.hypot((point.x-actor.x)*scale, (point.y-actor.y)*scale,
    input.targetElevationFeet-fromElevationFeet-2.5) > input.rangeFeet + 1e-6) {
    return { ok: false as const, reason: 'temple-disintegration-out-of-range' }
  }
  // The struck entity is the ray endpoint, not an intervening obstruction.
  // Retain every other wall of this same temple, so its far side cannot be picked through its near wall.
  const geometry = { ...input.geometry,
    walls: input.geometry.walls.filter(entity => entity.id !== target.id),
    doors: input.geometry.doors.filter(entity => entity.id !== target.id),
    obstacles: input.geometry.obstacles.filter(entity => entity.id !== target.id),
    windows: input.geometry.windows?.filter(entity => entity.id !== target.id) }
  const ray = { geometry, map: input.map, from: actor, to: point, fromElevationFeet,
    toElevationFeet: input.targetElevationFeet, fromEyeHeightFeet: 2.5, toEyeHeightFeet: 0 }
  if (mapGeometryLineOfSightBlocked(ray) || mapGeometryLineOfEffectBlocked(ray)) {
    return { ok: false as const, reason: 'temple-disintegration-obstructed' }
  }
  if (!dnd5eActivityPointVisible({ map: input.map, geometry, viewer: actor, characters: input.characters,
    point: { ...point, elevationFeet: input.targetElevationFeet }, worldMinute: input.worldMinute })) {
    return { ok: false as const, reason: 'temple-disintegration-not-visible' }
  }
  return projection
}

/** Geometry projection only. The casting authority must validate targeting and commit spell costs
 * together with this plan; this function does not authorize a cast or apply damage to occupants. */
export function prepareDnd5eTempleDisintegration(input: {
  map: BattleMap
  geometry: MapGeometryState
  targetEntityId: string
  worldMinute: number
}) {
  if (input.map.id !== input.geometry.mapId || !Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0) {
    return { ok: false as const, reason: 'temple-disintegration-invalid' }
  }
  const record = input.geometry.structureLifetimes?.find(record => record.templeWard &&
    record.replacementGroup === 'temple-of-the-gods' && record.entityIds.includes(input.targetEntityId))
  const entities = [...input.geometry.walls, ...input.geometry.doors, ...input.geometry.obstacles, ...input.geometry.windows ?? []]
  if (!record || !entities.some(entity => entity.id === input.targetEntityId) ||
    record.createdWorldMinute > input.worldMinute ||
    record.expiresWorldMinute != null && record.expiresWorldMinute <= input.worldMinute) {
    return { ok: false as const, reason: 'temple-disintegration-target-missing' }
  }
  try {
    const plan = prepareStructureRemoval(input.map, input.geometry, [record.id], mapGeometryTerrainElevationAtPoint)
    const unsupportedTokenIds = plan.map.tokens.filter(token => {
      const original = input.map.tokens.find(candidate => candidate.id === token.id)
      return original && token.elevationFeet !== original.elevationFeet
    }).map(token => token.id)
    // Unlike Mighty Fortress expiry, Temple of the Gods grants no harmless
    // descent. Preserve altitude for the ordinary fall/reaction settlement.
    return { ok: true as const, ...plan, map: structuredClone(input.map), unsupportedTokenIds, structureId: record.id }
  } catch {
    return { ok: false as const, reason: 'temple-disintegration-invalid' }
  }
}
