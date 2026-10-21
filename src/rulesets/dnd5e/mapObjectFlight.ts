import type { BattleMap, Token } from '../../store/maps'
import { mapGeometryPhysicalProjectileImpact, mapGeometryTokenElevation, mapGeometryEntityBodyHeightFeet, mapGeometryTerrainRayImpact,
  mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { tokenOccupiedCellsAt, type GridCell } from '../../lib/gridCombat'
import { stoneWallFirstIntersection } from '../../../shared/stone-wall-geometry.mjs'

export interface Dnd5eMapObjectFlightLimits {
  minimumWeightPounds: number
  maximumWeightPounds: number
  additionalWeightPoundsPerSlot: number
  baseSlotLevel: number
  distanceFeet: number
}
export interface Dnd5eMapObjectFlightPlan {
  objectId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  elevationFeet: number
  destinationElevationFeet: number
  /** Contacts are ordered by physical intersection, never by token-array or client order. */
  creatures: Array<{ tokenId: string; t: number; point: { x: number; y: number }; elevationFeet: number }>
  stop?: { kind: 'object' | 'geometry' | 'ground' | 'map-boundary'; id: string; t: number; panelId?: string }
}

/** Resting surface only. Does not invent a second spell hit or falling-object damage. */
export function planDnd5eMapObjectLanding(input: {
  map: BattleMap; geometry?: MapGeometryState; objectId: string
  point: { x: number; y: number }; elevationFeet: number
}): { elevationFeet: number; fallDistanceFeet: number; support: { kind: 'ground' | 'geometry' | 'object'; id: string; panelId?: string } } | undefined {
  const { map, geometry, point, elevationFeet } = input
  if (![point.x, point.y, elevationFeet].every(Number.isFinite) || point.x < 0 || point.y < 0 || point.x > map.width || point.y > map.height) return undefined
  const ground = mapGeometryTerrainElevationAtPoint(geometry, point)
  if (elevationFeet < ground - 1e-6) return undefined
  let restingHeight = ground, support: { kind: 'ground' | 'geometry' | 'object'; id: string; panelId?: string } = { kind: 'ground', id: map.id }
  const considerGeometry = (currentGeometry: MapGeometryState | undefined, areas: BattleMap['dnd5ePluginAreas']) => {
    if (elevationFeet - ground < 1e-6) return
    const start = elevationFeet + 1e-6
    const hit = mapGeometryPhysicalProjectileImpact({ geometry: currentGeometry, map: { ...map, dnd5ePluginAreas: areas },
      from: point, to: point, elevationFeet: start, toElevationFeet: ground })
    if (!hit || hit.t <= 1e-9) return // touching a vertical side is not a supporting floor
    const area = areas?.find(candidate => candidate.id === hit.entityId)
    const panel = area?.stoneWall || area?.forceWall
      ? stoneWallFirstIntersection(area, map, point, point, start, ground) : undefined
    const height = start + (ground - start) * (panel?.t ?? hit.t)
    if (height >= restingHeight && height <= elevationFeet + 1e-5) {
      restingHeight = Math.min(elevationFeet, height)
      support = { kind: 'geometry', id: hit.entityId, ...(panel?.panelId ? { panelId: panel.panelId } : {}) }
    }
  }
  if (geometry) {
    for (const obstacle of geometry.obstacles) considerGeometry({ ...geometry, walls: [], doors: [], windows: [], obstacles: [obstacle] }, [])
  }
  for (const area of map.dnd5ePluginAreas ?? []) considerGeometry(undefined, [area])
  for (const token of map.tokens) {
    if (token.id === input.objectId || token.type !== 'obstacle' || token.obstacleKind === 'marker' || (token.hp ?? token.maxHp ?? 1) <= 0) continue
    const half = Math.max(.1, token.size) * map.gridSize / 2
    if (point.x < token.x - half || point.x > token.x + half || point.y < token.y - half || point.y > token.y + half) continue
    const top = mapGeometryTokenElevation(geometry, token) + (mapGeometryEntityBodyHeightFeet(token) ?? 5)
    if (top > restingHeight && top <= elevationFeet + 1e-6) { restingHeight = top; support = { kind: 'object', id: token.id } }
  }
  return { elevationFeet: restingHeight, fallDistanceFeet: Math.max(0, elevationFeet - restingHeight), support }
}

export function planDnd5eMapObjectFlightAtAnchor(input: Omit<Parameters<typeof planDnd5eMapObjectFlight>[0], 'objectId'> & { anchorCell: GridCell }) {
  const candidates = input.map.tokens.filter(token => token.type === 'obstacle' && token.obstacleKind !== 'marker' &&
    tokenOccupiedCellsAt(token, input.map, token).some(cell => cell.col === input.anchorCell.col && cell.row === input.anchorCell.row))
  if (candidates.length !== 1) return { ok: false as const, reason: 'object-selection-ambiguous-or-missing' }
  return planDnd5eMapObjectFlight({ ...input, objectId: candidates[0].id })
}

/** Harmless displacement uses a Host-derived direction and never creates save/damage contacts. */
export function planDnd5eHarmlessObjectPushAtAnchor(input: {
  map: BattleMap; geometry?: MapGeometryState; anchorCell: GridCell; actorId: string
  limits: Dnd5eMapObjectFlightLimits; slotLevel: number
}) {
  const actor = input.map.tokens.find(token => token.id === input.actorId)
  const objects = input.map.tokens.filter(token => token.type === 'obstacle' && token.obstacleKind !== 'marker' &&
    tokenOccupiedCellsAt(token, input.map, token).some(cell => cell.col === input.anchorCell.col && cell.row === input.anchorCell.row))
  if (!actor || objects.length !== 1) return { ok: false as const, reason: 'object-selection-ambiguous-or-missing' }
  const object = objects[0], dx = object.x - actor.x, dy = object.y - actor.y
  if (Math.hypot(dx, dy) < 1e-6) return { ok: false as const, reason: 'object-push-direction-undefined' }
  const flight = planDnd5eMapObjectFlight({ ...input, objectId: object.id,
    angleDegrees: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, pitchDegrees: 0 })
  if (!flight.ok) return flight
  const contact = flight.plan.creatures[0]
  return { ok: true as const, plan: { ...flight.plan,
    ...(contact ? { to: contact.point, destinationElevationFeet: contact.elevationFeet } : {}), creatures: [],
  } }
}

function rectangleEntry(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, token: Token, gridSize: number, base: number, height: number): number | undefined {
  let low = 0, high = 1
  const half = Math.max(0.1, token.size) * gridSize / 2
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = to[axis] - from[axis], minimum = axis === 'z' ? base : token[axis] - half,
      maximum = axis === 'z' ? base + height - 1e-8 : token[axis] + half
    if (Math.abs(delta) < 1e-10) { if (from[axis] < minimum || from[axis] > maximum) return undefined; continue }
    const first = (minimum - from[axis]) / delta, second = (maximum - from[axis]) / delta
    low = Math.max(low, Math.min(first, second)); high = Math.min(high, Math.max(first, second))
    if (low > high) return undefined
  }
  return low >= 0 && low <= 1 ? low : undefined
}

/** Planning only: callers must commit resources, saves, damage and movement atomically. */
export function planDnd5eMapObjectFlight(input: {
  map: BattleMap; geometry?: MapGeometryState; objectId: string; angleDegrees: number
  pitchDegrees?: number
  slotLevel: number; limits: Dnd5eMapObjectFlightLimits
}): { ok: true; plan: Dnd5eMapObjectFlightPlan } | { ok: false; reason: string } {
  const { map, limits } = input
  const pitchDegrees = input.pitchDegrees ?? 0
  if (![limits.minimumWeightPounds, limits.maximumWeightPounds, limits.additionalWeightPoundsPerSlot, limits.distanceFeet,
    map.gridSize, map.feetPerCell ?? 5, map.width, map.height].every(Number.isFinite) ||
    limits.minimumWeightPounds < 0 || limits.maximumWeightPounds < limits.minimumWeightPounds ||
    limits.additionalWeightPoundsPerSlot < 0 || limits.distanceFeet <= 0 || map.gridSize <= 0 || (map.feetPerCell ?? 5) <= 0 ||
    map.width <= 0 || map.height <= 0 || !Number.isInteger(limits.baseSlotLevel) || limits.baseSlotLevel < 0 || limits.baseSlotLevel > 9 ||
    !Number.isInteger(input.slotLevel) || input.slotLevel < limits.baseSlotLevel || input.slotLevel > 9 ||
    !Number.isFinite(input.angleDegrees) || input.angleDegrees < 0 || input.angleDegrees >= 360 ||
    !Number.isFinite(pitchDegrees) || pitchDegrees < -90 || pitchDegrees > 90) return { ok: false, reason: 'invalid-flight-parameters' }
  const object = map.tokens.find(t => t.id === input.objectId)
  if (!object || object.type !== 'obstacle' || object.obstacleKind === 'marker' || !Number.isFinite(object.x) || !Number.isFinite(object.y) ||
    object.x < 0 || object.y < 0 || object.x > map.width || object.y > map.height || (object.hp ?? object.maxHp ?? 1) <= 0) return { ok: false, reason: 'invalid-flight-object' }
  const state = normalizeDnd5eMapObjectStateV1(object.dnd5eObjectState)
  if (!state || state.weightPounds == null) return { ok: false, reason: 'object-weight-unknown' }
  if (state.wornOrCarried) return { ok: false, reason: 'object-worn-or-carried' }
  const maximum = limits.maximumWeightPounds + (input.slotLevel - limits.baseSlotLevel) * limits.additionalWeightPoundsPerSlot
  if (state.weightPounds < limits.minimumWeightPounds || state.weightPounds > maximum) return { ok: false, reason: 'object-weight-out-of-range' }
  const from = { x: object.x, y: object.y }, radians = input.angleDegrees * Math.PI / 180
  const pitch = pitchDegrees * Math.PI / 180
  const pixels = limits.distanceFeet * Math.cos(pitch) / (map.feetPerCell ?? 5) * map.gridSize
  const far = { x: from.x + Math.cos(radians) * pixels, y: from.y + Math.sin(radians) * pixels }
  const point = (t: number) => ({ x: from.x + (far.x - from.x) * t, y: from.y + (far.y - from.y) * t })
  const elevationFeet = mapGeometryTokenElevation(input.geometry, object) + 0.1
  const endElevationFeet = elevationFeet + limits.distanceFeet * Math.sin(pitch)
  const elevationAt = (t: number) => elevationFeet + (endElevationFeet - elevationFeet) * t
  let end = 1, stop: Dnd5eMapObjectFlightPlan['stop']
  for (const [axis, maximum] of [['x',map.width],['y',map.height]] as const) {
    const delta = far[axis] - from[axis]
    const edge = far[axis] < 0 ? 0 : far[axis] > maximum ? maximum : undefined
    if (edge != null && delta !== 0) { const t = (edge - from[axis]) / delta; if (t < end) { end = t; stop = { kind: 'map-boundary', id: map.id, t } } }
  }
  const barrier = mapGeometryPhysicalProjectileImpact({ geometry: input.geometry, map, from, to: far, elevationFeet, toElevationFeet: endElevationFeet })
  if (barrier && barrier.t <= end) {
    const area = map.dnd5ePluginAreas?.find(candidate => candidate.id === barrier.entityId)
    const panel = area?.stoneWall ? stoneWallFirstIntersection(area, map, from, far, elevationFeet, endElevationFeet) : undefined
    end = panel?.t ?? barrier.t
    stop = { kind: 'geometry', id: barrier.entityId, t: end, ...(panel?.panelId ? { panelId: panel.panelId } : {}) }
  }
  const ground = mapGeometryTerrainRayImpact({ geometry: input.geometry, from, to: far,
    fromElevationFeet: elevationFeet, toElevationFeet: endElevationFeet })
  if (ground && (ground.t < end || (ground.t === end && !stop))) { end = ground.t; stop = { kind: 'ground', id: ground.entityId ?? map.id, t: end } }
  const contacts: Dnd5eMapObjectFlightPlan['creatures'] = []
  for (const token of map.tokens) {
    if (token.id === object.id) continue
    if (token.type === 'obstacle' && token.obstacleKind === 'marker') continue
    const base = mapGeometryTokenElevation(input.geometry, token)
    const height = mapGeometryEntityBodyHeightFeet(token) ?? Math.max(1, token.size) * 5
    const t = rectangleEntry({ ...from, z: elevationFeet }, { ...far, z: endElevationFeet }, token, map.gridSize, base, height)
    if (t == null || t > end) continue
    if (token.type === 'obstacle') {
      if ((token.hp ?? token.maxHp ?? 1) <= 0) continue
      end = t; stop = { kind: 'object', id: token.id, t }
    } else contacts.push({ tokenId: token.id, t, point: point(t), elevationFeet: elevationAt(t) - 0.1 })
  }
  return { ok: true, plan: { objectId: object.id, from, to: point(end), elevationFeet: elevationFeet - 0.1,
    destinationElevationFeet: stop?.kind === 'ground' ? ground!.elevationFeet : elevationAt(end) - 0.1,
    creatures: contacts.filter(c => stop ? c.t < end : c.t <= end).sort((a,b) => a.t - b.t || a.tokenId.localeCompare(b.tokenId)), stop } }
}
