import { normalizeControlledFlameState } from '../../../shared/controlled-flame-state.mjs'
import { mapGeometryCanSeePoint, mapGeometryLineOfSightBlocked, mapGeometryLineOfEffectBlocked, mapGeometryTokenElevation, mapGeometryEntityBodyHeightFeet, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { changeDnd5eNonmagicalFlame, dismissDnd5eFlameAlteration, type Dnd5eFlameChange, type Dnd5ePhysicalFlame } from './controlledFlame'

/** Host scene adapter. IDs are selection requests, never physical/visibility facts. */
export function prepareDnd5eControlledFlameMapChange(input: {
  map: BattleMap
  /** Complete authoritative room geometry, so changing maps cannot reset the cap. */
  geometries: readonly MapGeometryState[]
  actorTokenId: string
  /** Stable Host character identity, or map-qualified identity for an unlinked creature. */
  casterId: string
  actionId: string
  worldMinute: number
  selection: { lightId: string; change: Dnd5eFlameChange } | { dismissEffectId: string }
}): { ok: true; geometries: MapGeometryState[] } | { ok: false; reason: string } {
  const fail = (reason: string) => ({ ok: false as const, reason })
  if (!input.casterId || !input.actionId || !Number.isFinite(input.worldMinute) || input.worldMinute < 0) return fail('invalid-flame-declaration')
  const actor = input.map.tokens.find(token => token.id === input.actorTokenId)
  const geometries = input.geometries.filter(geometry => geometry.mapId === input.map.id)
  if (!actor || geometries.length !== 1 || new Set(input.geometries.map(geometry => geometry.mapId)).size !== input.geometries.length) return fail('invalid-flame-scene')
  const geometry = geometries[0], scale = (input.map.feetPerCell ?? 5) / input.map.gridSize
  if (!Number.isFinite(scale) || scale <= 0 || ![actor.x, actor.y, actor.elevationFeet ?? 0].every(Number.isFinite)) return fail('invalid-flame-scene')
  const key = (mapId: string, lightId: string) => JSON.stringify([mapId, lightId])
  const flames: Dnd5ePhysicalFlame[] = []
  for (const scene of input.geometries) {
    if (new Set((scene.lights ?? []).map(light => light.id)).size !== (scene.lights ?? []).length) return fail('invalid-flame-scene')
    for (const light of scene.lights ?? []) {
      if (!light.controlledFlame) continue
      const flame = normalizeControlledFlameState(light.controlledFlame)
      if (!flame || flame.id !== light.id || light.points.length !== 1 ||
        ![light.points[0].x, light.points[0].y, light.elevationFeet ?? 0].every(Number.isFinite)) return fail('invalid-flame-scene')
      flames.push({ ...flame, id: key(scene.mapId, light.id),
        // Ignore saved coordinates: the live geometry is authoritative.
        ...(scene.mapId === input.map.id ? { positionFeet: {
          x: light.points[0].x * scale, y: light.points[0].y * scale, z: light.elevationFeet ?? 0,
        } } : {}) })
    }
  }
  let result: ReturnType<typeof changeDnd5eNonmagicalFlame>
  if ('dismissEffectId' in input.selection) {
    result = dismissDnd5eFlameAlteration(flames, input.casterId, input.selection.dismissEffectId, input.worldMinute)
  } else {
    const selection = input.selection
    const light = geometry.lights?.find(light => light.id === selection.lightId)
    if (!light?.controlledFlame || !light.enabled || light.points.length !== 1) return fail('invalid-nonmagical-flame')
    const point = { ...light.points[0], elevationFeet: light.elevationFeet ?? 0 }
    let distanceFeet = Math.hypot((point.x - actor.x) * scale, (point.y - actor.y) * scale,
      point.elevationFeet - (actor.elevationFeet ?? 0))
    let visible = mapGeometryCanSeePoint({ map: input.map, geometry, viewer: actor, point, worldMinute: input.worldMinute })
    if (selection.change.kind === 'ignite-touch') {
      const half = actor.size * input.map.gridSize / 2
      const base = mapGeometryTokenElevation(geometry, actor)
      const nearest = { x: Math.max(actor.x-half, Math.min(actor.x+half, point.x)),
        y: Math.max(actor.y-half, Math.min(actor.y+half, point.y)) }
      const elevation = Math.max(base, Math.min(base + (mapGeometryEntityBodyHeightFeet(actor) ?? 5), point.elevationFeet))
      distanceFeet = Math.hypot((point.x-nearest.x)*scale, (point.y-nearest.y)*scale, point.elevationFeet-elevation)
      // Touch requires an unobstructed physical path, even through transparent walls.
      visible = !mapGeometryLineOfEffectBlocked({ map: input.map, geometry, from: nearest, to: point,
        fromElevationFeet: elevation, toElevationFeet: point.elevationFeet })
    }
    const change = selection.change.kind === 'spread'
      ? { ...selection.change, destinationId: key(input.map.id, selection.change.destinationId) }
      : selection.change
    const destinationId = selection.change.kind === 'spread' ? selection.change.destinationId : undefined
    const destination = destinationId != null
      ? geometry.lights?.find(light => light.id === destinationId)
      : undefined
    const spreadPathClear = !!destination?.enabled && destination.points.length === 1 &&
      !mapGeometryLineOfEffectBlocked({ map: input.map, geometry, from: point, to: destination.points[0],
        fromElevationFeet: point.elevationFeet, toElevationFeet: destination.elevationFeet ?? 0 }) &&
      !mapGeometryLineOfSightBlocked({ map: input.map, geometry, from: point, to: destination.points[0],
        fromElevationFeet: point.elevationFeet, toElevationFeet: destination.elevationFeet ?? 0,
        fromEyeHeightFeet: 0, toEyeHeightFeet: 0 })
    result = changeDnd5eNonmagicalFlame({ flames, flameId: key(input.map.id, light.id), casterId: input.casterId,
      actionId: input.actionId, worldMinute: input.worldMinute, distanceFeet, visible, change, spreadPathClear })
  }
  if (!result.ok) return result
  if ('change' in input.selection && input.selection.change.kind === 'inspect') {
    return { ok: true, geometries: [...input.geometries] }
  }
  const byId = new Map(result.flames.map(flame => [flame.id, flame]))
  return { ok: true, geometries: input.geometries.map(scene => ({ ...scene,
    lights: (scene.lights ?? []).map(light => {
      const changed = byId.get(key(scene.mapId, light.id))
      return changed ? { ...light, controlledFlame: { ...changed, id: light.id } } : light
    }),
  })) }
}
