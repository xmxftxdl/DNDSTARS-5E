import type { BattleMap, Token } from '../store/maps'
import { campaignLightIsActive, type CampaignLightSourceKind } from './campaignTime'
import type { Dnd5eMapEnvironment } from '../rulesets/dnd5e/environmentRules'

export const MAP_GEOMETRY_RESOURCE = 'map-geometry'
export const MAP_GEOMETRY_SCHEMA_VERSION = 2
export const MAP_GEOMETRY_LEGACY_SCHEMA_VERSION = 1
export const MAP_GEOMETRY_MAX_ENTITIES = 4_096

export interface MapGeometryPoint {
  x: number
  y: number
}

export interface MapGeometryHeight {
  baseHeightFeet: number
  heightFeet: number
}

export interface MapGeometryBlocking {
  blocksVision: boolean
  blocksMovement: boolean
  blocksLineOfEffect: boolean
}

export type MapGeometryWallMaterial = 'stone' | 'brick' | 'wood' | 'metal' | 'natural'

export interface MapGeometryWallAttachment {
  parentWallId?: string
  parentWallSegmentIndex?: number
}

export interface MapGeometryWall extends MapGeometryHeight, MapGeometryBlocking {
  id: string
  kind: 'wall'
  label: string
  points: MapGeometryPoint[]
  material?: MapGeometryWallMaterial
  createdAt: number
}

export type MapGeometryDoorState = 'open' | 'closed' | 'locked'
export type MapGeometryDoorHinge = 'start' | 'end'
export type MapGeometryDoorSwing = 'clockwise' | 'counterclockwise'

export interface MapGeometryDoorInteraction {
  lockPickDc: number
  breakDc: number
  secretDc: number
  keyItemId?: string
  requiresThievesTools: boolean
}

export interface MapGeometryDoor extends MapGeometryHeight, MapGeometryBlocking, MapGeometryWallAttachment {
  id: string
  kind: 'door'
  label: string
  points: [MapGeometryPoint, MapGeometryPoint]
  state: MapGeometryDoorState
  secret: boolean
  hinge?: MapGeometryDoorHinge
  swing?: MapGeometryDoorSwing
  interaction?: MapGeometryDoorInteraction
  /** Room member ids that may receive this secret door in their geometry projection. */
  revealedToMemberIds?: string[]
  createdAt: number
}

export type MapGeometryWindowType = 'glass' | 'bars' | 'shutters' | 'opening'
export type MapGeometryWindowState = 'closed' | 'open' | 'broken'

export interface MapGeometryWindow extends MapGeometryHeight, MapGeometryBlocking, MapGeometryWallAttachment {
  id: string
  kind: 'window'
  label: string
  points: [MapGeometryPoint, MapGeometryPoint]
  windowType: MapGeometryWindowType
  windowState?: MapGeometryWindowState
  cover?: MapGeometryCover
  createdAt: number
}

export type MapGeometryCover = 'none' | 'half' | 'three-quarters' | 'total'

export interface MapGeometryObstacle extends MapGeometryHeight, MapGeometryBlocking {
  id: string
  kind: 'obstacle'
  label: string
  points: MapGeometryPoint[]
  cover: MapGeometryCover
  terrainCostMultiplier?: number
  traversal?: 'ground' | 'climb' | 'swim'
  /** 多边形区域内可站立地面的绝对标高；与障碍物阻挡体积的底高分开。 */
  terrainElevationFeet?: number
  /** 多边形内部压制非魔法光源；普通黑暗视觉无法看穿。 */
  magicalDarkness?: boolean
  darknessSpellLevel?: number
  createdAt: number
}

export interface MapGeometryLight {
  id: string
  kind: 'light'
  label: string
  points: [MapGeometryPoint]
  enabled: boolean
  brightRadiusFeet: number
  dimRadiusFeet: number
  color: string
  elevationFeet: number
  createdAt: number
  sourceKind?: CampaignLightSourceKind
  startedAtWorldMinute?: number
  durationMinutes?: number
  expiresAtWorldMinute?: number
}

export type MapGeometryEntity = MapGeometryWall | MapGeometryDoor | MapGeometryWindow | MapGeometryObstacle | MapGeometryLight
export type MapGeometryTool = 'select' | 'wall' | 'door' | 'window' | 'obstacle' | 'light' | 'delete'
export type MapGeometryEntityPatch = Partial<MapGeometryHeight & MapGeometryBlocking> & {
  label?: string
  points?: MapGeometryPoint[]
  material?: MapGeometryWallMaterial
  parentWallId?: string
  parentWallSegmentIndex?: number
  state?: MapGeometryDoorState
  secret?: boolean
  hinge?: MapGeometryDoorHinge
  swing?: MapGeometryDoorSwing
  interaction?: MapGeometryDoorInteraction
  revealedToMemberIds?: string[]
  cover?: MapGeometryCover
  terrainCostMultiplier?: number
  traversal?: 'ground' | 'climb' | 'swim'
  terrainElevationFeet?: number
  magicalDarkness?: boolean
  darknessSpellLevel?: number
  enabled?: boolean
  brightRadiusFeet?: number
  dimRadiusFeet?: number
  color?: string
  elevationFeet?: number
  sourceKind?: CampaignLightSourceKind
  startedAtWorldMinute?: number
  durationMinutes?: number
  expiresAtWorldMinute?: number
  windowType?: MapGeometryWindowType
  windowState?: MapGeometryWindowState
}

export interface MapGeometryVisionSettings {
  enabled: boolean
  defaultRangeFeet: number
  sharePartyVision: boolean
  ambientLight: 'bright' | 'dim' | 'darkness'
}

export interface MapGeometryState {
  mapId: string
  walls: MapGeometryWall[]
  doors: MapGeometryDoor[]
  windows?: MapGeometryWindow[]
  obstacles: MapGeometryObstacle[]
  lights?: MapGeometryLight[]
  vision: MapGeometryVisionSettings
  environment?: Dnd5eMapEnvironment
  updatedAt: number
}

export interface SharedMapGeometryState {
  schemaVersion: typeof MAP_GEOMETRY_SCHEMA_VERSION
  maps: MapGeometryState[]
  updatedAt: number
}

export interface MapGeometrySegment extends MapGeometryHeight, MapGeometryBlocking {
  entityId: string
  entityKind: MapGeometryEntity['kind']
  a: MapGeometryPoint
  b: MapGeometryPoint
  cover?: MapGeometryCover
}

export interface MapGeometryCoverResult {
  cover: MapGeometryCover
  armorClassBonus: 0 | 2 | 5
  blocksLineOfEffect: boolean
  sourceEntityId?: string
}

export const MAP_GEOMETRY_CREATURE_COVER_PREFIX = 'creature:'

export const DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET = 30

const DEFAULT_VISION: MapGeometryVisionSettings = {
  enabled: false,
  defaultRangeFeet: DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  sharePartyVision: true,
  ambientLight: 'bright',
}

export function createEmptyMapGeometry(mapId: string, now = Date.now()): MapGeometryState {
  return { mapId, walls: [], doors: [], windows: [], obstacles: [], lights: [], vision: { ...DEFAULT_VISION }, updatedAt: now }
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validLightTiming(raw: Record<string, unknown>): boolean {
  if (raw.sourceKind != null && !['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(String(raw.sourceKind))) return false
  const timing = [raw.startedAtWorldMinute, raw.durationMinutes, raw.expiresAtWorldMinute]
  const hasTiming = timing.some((value) => value != null)
  if (!hasTiming) return !['torch', 'candle', 'lamp', 'hooded-lantern'].includes(String(raw.sourceKind))
  return timing.every((value) => Number.isSafeInteger(value) && Number(value) >= 0) &&
    Number(raw.durationMinutes) > 0 && Number(raw.durationMinutes) <= 365 * 24 * 60 &&
    Number(raw.expiresAtWorldMinute) === Number(raw.startedAtWorldMinute) + Number(raw.durationMinutes)
}

function normalizePoint(value: unknown): MapGeometryPoint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  return finite(raw.x, -1_000_000, 1_000_000) && finite(raw.y, -1_000_000, 1_000_000)
    ? { x: raw.x, y: raw.y }
    : undefined
}

function normalizePoints(value: unknown, minimum: number, maximum = 2_048): MapGeometryPoint[] | undefined {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return undefined
  const points = value.map(normalizePoint)
  return points.some((point) => !point) ? undefined : points as MapGeometryPoint[]
}

function normalizeCommon(raw: Record<string, unknown>) {
  if (
    typeof raw.id !== 'string' || !raw.id || raw.id.length > 160 ||
    typeof raw.label !== 'string' || raw.label.length > 120 ||
    typeof raw.blocksVision !== 'boolean' || typeof raw.blocksMovement !== 'boolean' ||
    typeof raw.blocksLineOfEffect !== 'boolean' ||
    !finite(raw.baseHeightFeet, -1_000, 10_000) || !finite(raw.heightFeet, 0, 10_000) ||
    !finite(raw.createdAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  return {
    id: raw.id,
    label: raw.label,
    blocksVision: raw.blocksVision,
    blocksMovement: raw.blocksMovement,
    blocksLineOfEffect: raw.blocksLineOfEffect,
    baseHeightFeet: raw.baseHeightFeet,
    heightFeet: raw.heightFeet,
    createdAt: raw.createdAt,
  }
}

function normalizeWallAttachment(raw: Record<string, unknown>): MapGeometryWallAttachment | undefined {
  if (raw.parentWallId == null && raw.parentWallSegmentIndex == null) return {}
  if (
    typeof raw.parentWallId !== 'string' || !raw.parentWallId || raw.parentWallId.length > 160 ||
    !Number.isInteger(raw.parentWallSegmentIndex) || !finite(raw.parentWallSegmentIndex, 0, 2_047)
  ) return undefined
  return { parentWallId: raw.parentWallId, parentWallSegmentIndex: raw.parentWallSegmentIndex as number }
}

export function normalizeMapGeometryEntity(value: unknown): MapGeometryEntity | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.kind === 'light') {
    const points = normalizePoints(raw.points, 1, 1)
    if (
      !points || typeof raw.id !== 'string' || !raw.id || raw.id.length > 160 ||
      typeof raw.label !== 'string' || raw.label.length > 120 || typeof raw.enabled !== 'boolean' ||
      !finite(raw.brightRadiusFeet, 0, 10_000) || !finite(raw.dimRadiusFeet, 0, 10_000) ||
      typeof raw.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(raw.color) ||
      !finite(raw.elevationFeet, -1_000, 10_000) || !finite(raw.createdAt, 0, Number.MAX_SAFE_INTEGER) ||
      !validLightTiming(raw)
    ) return undefined
    return {
      id: raw.id, kind: 'light', label: raw.label, points: [points[0]], enabled: raw.enabled,
      brightRadiusFeet: raw.brightRadiusFeet, dimRadiusFeet: raw.dimRadiusFeet,
      color: raw.color.toLowerCase(), elevationFeet: raw.elevationFeet, createdAt: raw.createdAt,
      sourceKind: ['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(String(raw.sourceKind))
        ? raw.sourceKind as CampaignLightSourceKind
        : undefined,
      startedAtWorldMinute: finite(raw.startedAtWorldMinute, 0, Number.MAX_SAFE_INTEGER)
        ? raw.startedAtWorldMinute as number
        : undefined,
      durationMinutes: finite(raw.durationMinutes, 1, 365 * 24 * 60)
        ? raw.durationMinutes as number
        : undefined,
      expiresAtWorldMinute: finite(raw.expiresAtWorldMinute, 0, Number.MAX_SAFE_INTEGER)
        ? raw.expiresAtWorldMinute as number
        : undefined,
    }
  }
  const common = normalizeCommon(raw)
  if (!common) return undefined
  if (raw.kind === 'wall') {
    const points = normalizePoints(raw.points, 2)
    if (!points || (raw.material != null && !['stone', 'brick', 'wood', 'metal', 'natural'].includes(String(raw.material)))) {
      return undefined
    }
    return {
      ...common,
      kind: 'wall',
      points,
      material: (raw.material as MapGeometryWallMaterial | undefined) ?? 'stone',
    }
  }
  if (raw.kind === 'door') {
    const points = normalizePoints(raw.points, 2, 2)
    const attachment = normalizeWallAttachment(raw)
    if (
      !points || !attachment || !['open', 'closed', 'locked'].includes(String(raw.state)) || typeof raw.secret !== 'boolean' ||
      (raw.hinge != null && !['start', 'end'].includes(String(raw.hinge))) ||
      (raw.swing != null && !['clockwise', 'counterclockwise'].includes(String(raw.swing)))
    ) return undefined
    const interactionRaw = raw.interaction
    let interaction: MapGeometryDoorInteraction | undefined
    if (interactionRaw != null) {
      if (!interactionRaw || typeof interactionRaw !== 'object' || Array.isArray(interactionRaw)) return undefined
      const config = interactionRaw as Record<string, unknown>
      if (
        !finite(config.lockPickDc, 0, 100) || !finite(config.breakDc, 0, 100) ||
        !finite(config.secretDc, 0, 100) || typeof config.requiresThievesTools !== 'boolean' ||
        (config.keyItemId != null && (typeof config.keyItemId !== 'string' || config.keyItemId.length > 160))
      ) return undefined
      interaction = {
        lockPickDc: config.lockPickDc,
        breakDc: config.breakDc,
        secretDc: config.secretDc,
        requiresThievesTools: config.requiresThievesTools,
        ...(config.keyItemId ? { keyItemId: config.keyItemId } : {}),
      }
    }
    if (
      raw.revealedToMemberIds != null &&
      (!Array.isArray(raw.revealedToMemberIds) || raw.revealedToMemberIds.length > 64 ||
        raw.revealedToMemberIds.some((id) => typeof id !== 'string' || !id || id.length > 160))
    ) return undefined
    return {
      ...common,
      kind: 'door',
      points: [points[0], points[1]],
      state: raw.state as MapGeometryDoorState,
      secret: raw.secret,
      hinge: (raw.hinge as MapGeometryDoorHinge | undefined) ?? 'start',
      swing: (raw.swing as MapGeometryDoorSwing | undefined) ?? 'clockwise',
      ...attachment,
      ...(interaction ? { interaction } : {}),
      ...(Array.isArray(raw.revealedToMemberIds)
        ? { revealedToMemberIds: [...new Set(raw.revealedToMemberIds as string[])] }
        : {}),
    }
  }
  if (raw.kind === 'window') {
    const points = normalizePoints(raw.points, 2, 2)
    const attachment = normalizeWallAttachment(raw)
    if (
      !points || !attachment || !['glass', 'bars', 'shutters', 'opening'].includes(String(raw.windowType)) ||
      (raw.windowState != null && !['closed', 'open', 'broken'].includes(String(raw.windowState))) ||
      (raw.cover != null && !['none', 'half', 'three-quarters', 'total'].includes(String(raw.cover)))
    ) return undefined
    return {
      ...common,
      ...attachment,
      kind: 'window',
      points: [points[0], points[1]],
      windowType: raw.windowType as MapGeometryWindowType,
      windowState: (raw.windowState as MapGeometryWindowState | undefined) ?? 'closed',
      cover: (raw.cover as MapGeometryCover | undefined) ?? (raw.blocksLineOfEffect ? 'total' : 'half'),
    }
  }
  if (raw.kind === 'obstacle') {
    const points = normalizePoints(raw.points, 3)
    if (!points || !['none', 'half', 'three-quarters', 'total'].includes(String(raw.cover)) ||
      (raw.terrainCostMultiplier != null && !finite(raw.terrainCostMultiplier, 1, 10)) ||
      (raw.traversal != null && !['ground', 'climb', 'swim'].includes(String(raw.traversal))) ||
      (raw.terrainElevationFeet != null && !finite(raw.terrainElevationFeet, -1_000, 10_000)) ||
      (raw.magicalDarkness != null && typeof raw.magicalDarkness !== 'boolean') ||
      (raw.darknessSpellLevel != null && !finite(raw.darknessSpellLevel, 0, 9))) return undefined
    return {
      ...common, kind: 'obstacle', points, cover: raw.cover as MapGeometryCover,
      ...(raw.terrainCostMultiplier != null ? { terrainCostMultiplier: raw.terrainCostMultiplier as number } : {}),
      ...(raw.traversal != null ? { traversal: raw.traversal as MapGeometryObstacle['traversal'] } : {}),
      ...(raw.terrainElevationFeet != null ? { terrainElevationFeet: raw.terrainElevationFeet as number } : {}),
      ...(raw.magicalDarkness === true ? { magicalDarkness: true } : {}),
      ...(raw.darknessSpellLevel != null ? { darknessSpellLevel: raw.darknessSpellLevel as number } : {}),
    }
  }
  return undefined
}

export function normalizeMapGeometry(value: unknown): MapGeometryState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    typeof raw.mapId !== 'string' || !raw.mapId || raw.mapId.length > 160 ||
    !Array.isArray(raw.walls) || !Array.isArray(raw.doors) || !Array.isArray(raw.obstacles) ||
    (raw.windows != null && !Array.isArray(raw.windows)) ||
    (raw.lights != null && !Array.isArray(raw.lights)) ||
    raw.walls.length + raw.doors.length + raw.obstacles.length +
      (Array.isArray(raw.windows) ? raw.windows.length : 0) +
      (Array.isArray(raw.lights) ? raw.lights.length : 0) > MAP_GEOMETRY_MAX_ENTITIES ||
    !raw.vision || typeof raw.vision !== 'object' || Array.isArray(raw.vision) ||
    !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const vision = raw.vision as Record<string, unknown>
  if (
    typeof vision.enabled !== 'boolean' || typeof vision.sharePartyVision !== 'boolean' ||
    (vision.ambientLight != null && !['bright', 'dim', 'darkness'].includes(String(vision.ambientLight))) ||
    !finite(vision.defaultRangeFeet, 0, 10_000)
  ) return undefined
  const walls = raw.walls.map(normalizeMapGeometryEntity)
  const doors = raw.doors.map(normalizeMapGeometryEntity)
  const windows = (Array.isArray(raw.windows) ? raw.windows : []).map(normalizeMapGeometryEntity)
  const obstacles = raw.obstacles.map(normalizeMapGeometryEntity)
  const lights = (Array.isArray(raw.lights) ? raw.lights : []).map(normalizeMapGeometryEntity)
  if (
    walls.some((entity) => entity?.kind !== 'wall') || doors.some((entity) => entity?.kind !== 'door') ||
    windows.some((entity) => entity?.kind !== 'window') ||
    obstacles.some((entity) => entity?.kind !== 'obstacle') || lights.some((entity) => entity?.kind !== 'light')
  ) return undefined
  const entities = [...walls, ...doors, ...windows, ...obstacles, ...lights] as MapGeometryEntity[]
  if (new Set(entities.map((entity) => entity.id)).size !== entities.length) return undefined
  return {
    mapId: raw.mapId,
    walls: walls as MapGeometryWall[],
    doors: doors as MapGeometryDoor[],
    windows: windows as MapGeometryWindow[],
    obstacles: obstacles as MapGeometryObstacle[],
    lights: lights as MapGeometryLight[],
    vision: {
      enabled: vision.enabled,
      defaultRangeFeet: vision.defaultRangeFeet,
      sharePartyVision: vision.sharePartyVision,
      ambientLight: (vision.ambientLight as MapGeometryVisionSettings['ambientLight'] | undefined) ?? 'bright',
    },
    environment: raw.environment === 'underwater' ? 'underwater' : 'normal',
    updatedAt: raw.updatedAt,
  }
}

export function normalizeSharedMapGeometry(value: unknown): SharedMapGeometryState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    (raw.schemaVersion !== MAP_GEOMETRY_LEGACY_SCHEMA_VERSION && raw.schemaVersion !== MAP_GEOMETRY_SCHEMA_VERSION) ||
    !Array.isArray(raw.maps) ||
    !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const maps = raw.maps.map(normalizeMapGeometry)
  if (maps.some((map) => !map)) return undefined
  const normalized = (maps as MapGeometryState[]).map((map) => (
    raw.schemaVersion === MAP_GEOMETRY_LEGACY_SCHEMA_VERSION ? migrateMapGeometryV1(map) : map
  ))
  if (new Set(normalized.map((map) => map.mapId)).size !== normalized.length) return undefined
  return { schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION, maps: normalized, updatedAt: raw.updatedAt }
}

/** Convert the original free-standing wall openings to explicit V2 wall attachments when possible. */
export function migrateMapGeometryV1(geometry: MapGeometryState): MapGeometryState {
  const attach = <T extends MapGeometryDoor | MapGeometryWindow>(opening: T): T => {
    if (opening.parentWallId != null) return opening
    const attachment = mapGeometryAttachOpeningToWall(geometry, opening.points[0], opening.points[1], 2)
    return attachment ? { ...opening, ...attachment } : opening
  }
  return {
    ...geometry,
    walls: geometry.walls.map((wall) => ({ ...wall, material: wall.material ?? 'stone' })),
    doors: geometry.doors.map(attach),
    windows: (geometry.windows ?? []).map(attach),
    lights: geometry.lights ?? [],
  }
}

function entitySegments(entity: MapGeometryObstacle): MapGeometrySegment[] {
  const pairs = entity.points.map((point, index) => [point, entity.points[(index + 1) % entity.points.length]] as const)
  return pairs.map(([a, b]) => ({
    entityId: entity.id,
    entityKind: entity.kind,
    a,
    b,
    blocksVision: entity.blocksVision,
    blocksMovement: entity.blocksMovement,
    blocksLineOfEffect: entity.blocksLineOfEffect,
    baseHeightFeet: entity.baseHeightFeet,
    heightFeet: entity.heightFeet,
  }))
}

function interpolatePoint(a: MapGeometryPoint, b: MapGeometryPoint, t: number): MapGeometryPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function projectPointToSegment(point: MapGeometryPoint, a: MapGeometryPoint, b: MapGeometryPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
    : 0
  const projected = interpolatePoint(a, b, t)
  return { t, point: projected, distance: Math.hypot(point.x - projected.x, point.y - projected.y) }
}

export interface MapGeometryWallOpeningAttachment {
  parentWallId: string
  parentWallSegmentIndex: number
  points: [MapGeometryPoint, MapGeometryPoint]
}

export function mapGeometryAttachOpeningToWall(
  geometry: MapGeometryState | undefined,
  start: MapGeometryPoint,
  end: MapGeometryPoint,
  maxDistance = 24,
): MapGeometryWallOpeningAttachment | undefined {
  let best: (MapGeometryWallOpeningAttachment & { score: number }) | undefined
  for (const wall of geometry?.walls ?? []) {
    for (let segmentIndex = 0; segmentIndex < wall.points.length - 1; segmentIndex += 1) {
      const a = wall.points[segmentIndex]
      const b = wall.points[segmentIndex + 1]
      const projectedStart = projectPointToSegment(start, a, b)
      const projectedEnd = projectPointToSegment(end, a, b)
      if (projectedStart.distance > maxDistance || projectedEnd.distance > maxDistance) continue
      const score = projectedStart.distance + projectedEnd.distance
      if (best && best.score <= score) continue
      best = {
        parentWallId: wall.id,
        parentWallSegmentIndex: segmentIndex,
        points: [projectedStart.point, projectedEnd.point],
        score,
      }
    }
  }
  if (!best) return undefined
  return {
    parentWallId: best.parentWallId,
    parentWallSegmentIndex: best.parentWallSegmentIndex,
    points: best.points,
  }
}

export interface MapGeometryWallRenderSegment {
  wallId: string
  wallSegmentIndex: number
  a: MapGeometryPoint
  b: MapGeometryPoint
}

function openingIntervalOnWallSegment(
  opening: MapGeometryDoor | MapGeometryWindow,
  wall: MapGeometryWall,
  wallSegmentIndex: number,
): [number, number] | undefined {
  const a = wall.points[wallSegmentIndex]
  const b = wall.points[wallSegmentIndex + 1]
  const projectedA = projectPointToSegment(opening.points[0], a, b)
  const projectedB = projectPointToSegment(opening.points[1], a, b)
  const explicitlyAttached = opening.parentWallId === wall.id && opening.parentWallSegmentIndex === wallSegmentIndex
  if (!explicitlyAttached && (opening.parentWallId != null || projectedA.distance > 2 || projectedB.distance > 2)) return undefined
  const start = Math.min(projectedA.t, projectedB.t)
  const end = Math.max(projectedA.t, projectedB.t)
  return end - start > 0.0001 ? [start, end] : undefined
}

export function mapGeometryOpeningOverlaps(
  geometry: MapGeometryState | undefined,
  opening: MapGeometryDoor | MapGeometryWindow,
  ignoreEntityId?: string,
  clearance = 0.002,
): boolean {
  if (opening.parentWallId == null || opening.parentWallSegmentIndex == null) return false
  const wall = geometry?.walls.find((candidate) => candidate.id === opening.parentWallId)
  if (!wall) return false
  const interval = openingIntervalOnWallSegment(opening, wall, opening.parentWallSegmentIndex)
  if (!interval) return true
  return [...(geometry?.doors ?? []), ...(geometry?.windows ?? [])].some((candidate) => {
    if (candidate.id === (ignoreEntityId ?? opening.id)) return false
    if (
      candidate.parentWallId !== opening.parentWallId ||
      candidate.parentWallSegmentIndex !== opening.parentWallSegmentIndex
    ) return false
    const candidateInterval = openingIntervalOnWallSegment(candidate, wall, opening.parentWallSegmentIndex!)
    return !!candidateInterval && interval[0] < candidateInterval[1] + clearance && interval[1] > candidateInterval[0] - clearance
  })
}

export function mapGeometryReprojectWallAttachments(
  geometry: MapGeometryState,
  wallId: string,
  points: MapGeometryPoint[],
): MapGeometryState | undefined {
  const previousWall = geometry.walls.find((wall) => wall.id === wallId)
  if (!previousWall || points.length < 2) return undefined
  const nextWall = { ...previousWall, points }
  const reproject = <T extends MapGeometryDoor | MapGeometryWindow>(opening: T): T | undefined => {
    if (opening.parentWallId !== wallId || opening.parentWallSegmentIndex == null) return opening
    const segmentIndex = opening.parentWallSegmentIndex
    const oldA = previousWall.points[segmentIndex]
    const oldB = previousWall.points[segmentIndex + 1]
    const nextA = points[segmentIndex]
    const nextB = points[segmentIndex + 1]
    if (!oldA || !oldB || !nextA || !nextB) return undefined
    const projected = opening.points.map((point) => interpolatePoint(nextA, nextB, projectPointToSegment(point, oldA, oldB).t)) as [MapGeometryPoint, MapGeometryPoint]
    return { ...opening, points: projected }
  }
  const doors = geometry.doors.map(reproject).filter((opening): opening is MapGeometryDoor => !!opening)
  const windows = (geometry.windows ?? []).map(reproject).filter((opening): opening is MapGeometryWindow => !!opening)
  const next = { ...geometry, walls: geometry.walls.map((wall) => wall.id === wallId ? nextWall : wall), doors, windows }
  if ([...doors, ...windows].some((opening) => mapGeometryOpeningOverlaps(next, opening))) return undefined
  return next
}

export function mapGeometryMoveOpening(
  geometry: MapGeometryState,
  entityId: string,
  points: [MapGeometryPoint, MapGeometryPoint],
  maxDistance = 24,
): MapGeometryState | undefined {
  if (Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) < 4) return undefined
  const opening = [...geometry.doors, ...(geometry.windows ?? [])].find((candidate) => candidate.id === entityId)
  if (!opening) return undefined
  const attachment = mapGeometryAttachOpeningToWall(geometry, points[0], points[1], maxDistance)
  if (!attachment) return undefined
  const nextOpening = { ...opening, ...attachment }
  if (mapGeometryOpeningOverlaps(geometry, nextOpening, entityId)) return undefined
  return opening.kind === 'door'
    ? { ...geometry, doors: geometry.doors.map((door) => door.id === entityId ? nextOpening as MapGeometryDoor : door) }
    : { ...geometry, windows: (geometry.windows ?? []).map((window) => window.id === entityId ? nextOpening as MapGeometryWindow : window) }
}

export function mapGeometryWallRenderSegments(
  geometry: MapGeometryState | undefined,
  wall: MapGeometryWall,
): MapGeometryWallRenderSegment[] {
  const openings = [...(geometry?.doors ?? []), ...(geometry?.windows ?? [])]
  return wall.points.slice(0, -1).flatMap((a, wallSegmentIndex) => {
    const b = wall.points[wallSegmentIndex + 1]
    const intervals = openings
      .map((opening) => openingIntervalOnWallSegment(opening, wall, wallSegmentIndex))
      .filter((interval): interval is [number, number] => !!interval)
      .sort((left, right) => left[0] - right[0])
    const merged: [number, number][] = []
    for (const interval of intervals) {
      const previous = merged.at(-1)
      if (previous && interval[0] <= previous[1] + 0.0001) previous[1] = Math.max(previous[1], interval[1])
      else merged.push([...interval])
    }
    const segments: MapGeometryWallRenderSegment[] = []
    let cursor = 0
    for (const [start, end] of merged) {
      if (start > cursor + 0.0001) {
        segments.push({ wallId: wall.id, wallSegmentIndex, a: interpolatePoint(a, b, cursor), b: interpolatePoint(a, b, start) })
      }
      cursor = Math.max(cursor, end)
    }
    if (cursor < 1 - 0.0001) {
      segments.push({ wallId: wall.id, wallSegmentIndex, a: interpolatePoint(a, b, cursor), b })
    }
    return segments
  })
}

export function mapGeometrySegments(geometry: MapGeometryState | undefined): MapGeometrySegment[] {
  if (!geometry) return []
  return [
    ...geometry.walls.flatMap((wall) => mapGeometryWallRenderSegments(geometry, wall).map((segment) => ({
      entityId: wall.id,
      entityKind: wall.kind,
      a: segment.a,
      b: segment.b,
      blocksVision: wall.blocksVision,
      blocksMovement: wall.blocksMovement,
      blocksLineOfEffect: wall.blocksLineOfEffect,
      baseHeightFeet: wall.baseHeightFeet,
      heightFeet: wall.heightFeet,
    }))),
    ...geometry.doors.flatMap((door) => door.state === 'open' ? [] : [{
      entityId: door.id,
      entityKind: door.kind,
      a: door.points[0],
      b: door.points[1],
      blocksVision: door.blocksVision,
      blocksMovement: door.blocksMovement,
      blocksLineOfEffect: door.blocksLineOfEffect,
      baseHeightFeet: door.baseHeightFeet,
      heightFeet: door.heightFeet,
    }]),
    ...(geometry.windows ?? []).map((window) => ({
      entityId: window.id,
      entityKind: window.kind,
      a: window.points[0],
      b: window.points[1],
      blocksVision: window.windowState === 'open' || window.windowState === 'broken' ? false : window.blocksVision,
      blocksMovement: window.blocksMovement,
      blocksLineOfEffect: window.windowState === 'open' || window.windowState === 'broken' ? false : window.blocksLineOfEffect,
      cover: window.cover,
      baseHeightFeet: window.baseHeightFeet,
      heightFeet: window.heightFeet,
    })),
    ...geometry.obstacles.flatMap(entitySegments),
  ]
}

function cross(a: MapGeometryPoint, b: MapGeometryPoint): number {
  return a.x * b.y - a.y * b.x
}

function subtract(a: MapGeometryPoint, b: MapGeometryPoint): MapGeometryPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

function intersectionParameter(
  from: MapGeometryPoint,
  to: MapGeometryPoint,
  a: MapGeometryPoint,
  b: MapGeometryPoint,
): number | undefined {
  const r = subtract(to, from)
  const s = subtract(b, a)
  const denominator = cross(r, s)
  if (Math.abs(denominator) < 1e-8) return undefined
  const delta = subtract(a, from)
  const t = cross(delta, s) / denominator
  const u = cross(delta, r) / denominator
  return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? t : undefined
}

export function mapGeometrySegmentsIntersect(
  from: MapGeometryPoint,
  to: MapGeometryPoint,
  a: MapGeometryPoint,
  b: MapGeometryPoint,
  ignoreStart = false,
): boolean {
  const t = intersectionParameter(from, to, a, b)
  return t != null && (!ignoreStart || t > 1e-5)
}

export function mapGeometryPointInPolygon(point: MapGeometryPoint, polygon: readonly MapGeometryPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < (pj.x - pi.x) * (point.y - pi.y) / ((pj.y - pi.y) || 1e-9) + pi.x
    ) inside = !inside
  }
  return inside
}

function overlapsHeight(baseHeightFeet: number, heightFeet: number, elevationFeet: number, creatureHeightFeet = 5): boolean {
  const top = baseHeightFeet + heightFeet
  return elevationFeet < top - 1e-7 && elevationFeet + creatureHeightFeet > baseHeightFeet + 1e-7
}

function tokenElevation(token: Token): number {
  return Number.isFinite(token.elevationFeet) ? Math.max(-1_000, token.elevationFeet!) : 0
}

/** 后绘制的区域覆盖先绘制的区域，便于 DM 用较小多边形修正局部标高。 */
export function mapGeometryTerrainElevationAtPoint(
  geometry: MapGeometryState | undefined,
  point: MapGeometryPoint,
  fallbackElevationFeet = 0,
): number {
  let elevation = fallbackElevationFeet
  for (const obstacle of geometry?.obstacles ?? []) {
    if (obstacle.terrainElevationFeet == null || !mapGeometryPointInPolygon(point, obstacle.points)) continue
    elevation = obstacle.terrainElevationFeet
  }
  return elevation
}

export function mapGeometryObstacleAffectsElevation(
  obstacle: MapGeometryObstacle,
  elevationFeet: number,
  creatureHeightFeet = 5,
): boolean {
  if (obstacle.heightFeet > 0) {
    return overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, elevationFeet, creatureHeightFeet)
  }
  const surfaceElevation = obstacle.terrainElevationFeet ?? obstacle.baseHeightFeet
  return Math.abs(elevationFeet - surfaceElevation) <= 1e-4
}

export function mapGeometryMovementBlocked(input: {
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  to: MapGeometryPoint
  fromElevationFeet?: number
  toElevationFeet?: number
}): { blocked: boolean; entityId?: string } {
  const { geometry, token, to } = input
  if (!geometry) return { blocked: false }
  const from = { x: token.x, y: token.y }
  const radius = Math.max(0, input.map.gridSize * Math.max(1, token.size) * 0.42)
  const offsets = radius > 0
    ? [{ x: 0, y: 0 }, { x: radius, y: 0 }, { x: -radius, y: 0 }, { x: 0, y: radius }, { x: 0, y: -radius }]
    : [{ x: 0, y: 0 }]
  const fromElevation = input.fromElevationFeet ?? tokenElevation(token)
  const toElevation = input.toElevationFeet ?? fromElevation
  const creatureHeight = Math.max(5, Math.max(1, token.size) * 5)
  for (const obstacle of geometry.obstacles) {
    if (
      obstacle.blocksMovement && overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, toElevation, creatureHeight) &&
      mapGeometryPointInPolygon(to, obstacle.points)
    ) return { blocked: true, entityId: obstacle.id }
  }
  for (const segment of mapGeometrySegments(geometry)) {
    if (!segment.blocksMovement) continue
    const blocked = offsets.some((offset) => {
      const t = intersectionParameter(
        { x: from.x + offset.x, y: from.y + offset.y },
        { x: to.x + offset.x, y: to.y + offset.y },
        segment.a,
        segment.b,
      )
      if (t == null || t <= 1e-5) return false
      const elevation = fromElevation + (toElevation - fromElevation) * t
      return overlapsHeight(segment.baseHeightFeet, segment.heightFeet, elevation, creatureHeight)
    })
    if (blocked) return { blocked: true, entityId: segment.entityId }
  }
  return { blocked: false }
}

function pointToSegmentDistance(point: MapGeometryPoint, a: MapGeometryPoint, b: MapGeometryPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-8) return Math.hypot(point.x - a.x, point.y - a.y)
  const projection = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (a.x + projection * dx), point.y - (a.y + projection * dy))
}

/** 检查 Token 的完整占位圆是否与阻挡移动的墙、门、窗或障碍物相交。 */
export function mapGeometryPlacementBlocked(input: {
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  at: MapGeometryPoint
  elevationFeet?: number
}): { blocked: boolean; entityId?: string } {
  const { geometry, token, at } = input
  if (!geometry) return { blocked: false }
  const radius = Math.max(1, input.map.gridSize * Math.max(1, token.size) * 0.42)
  const elevation = input.elevationFeet ?? tokenElevation(token)
  const creatureHeight = Math.max(5, Math.max(1, token.size) * 5)
  for (const segment of mapGeometrySegments(geometry)) {
    if (
      segment.blocksMovement && overlapsHeight(segment.baseHeightFeet, segment.heightFeet, elevation, creatureHeight) &&
      pointToSegmentDistance(at, segment.a, segment.b) <= radius
    ) return { blocked: true, entityId: segment.entityId }
  }
  for (const obstacle of geometry.obstacles) {
    if (
      obstacle.blocksMovement && overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, elevation, creatureHeight) &&
      mapGeometryPointInPolygon(at, obstacle.points)
    ) return { blocked: true, entityId: obstacle.id }
  }
  return { blocked: false }
}

function rayBlocked(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
  purpose: 'vision' | 'line-of-effect'
}): string | undefined {
  for (const segment of mapGeometrySegments(input.geometry)) {
    const blocks = input.purpose === 'vision' ? segment.blocksVision : segment.blocksLineOfEffect
    if (!blocks) continue
    const t = intersectionParameter(input.from, input.to, segment.a, segment.b)
    if (t == null || t <= 1e-5) continue
    const fromElevation = input.fromElevationFeet ?? input.elevationFeet ?? 0
    const toElevation = input.toElevationFeet ?? input.elevationFeet ?? fromElevation
    const rayHeight = fromElevation + 2.5 + (toElevation - fromElevation) * t
    if (rayHeight >= segment.baseHeightFeet && rayHeight < segment.baseHeightFeet + segment.heightFeet) {
      return segment.entityId
    }
  }
  return undefined
}

export function mapGeometryCoverFromPoint(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
}): MapGeometryCoverResult {
  const geometry = input.geometry
  if (!geometry) return { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
  const { from, to } = input
  const fromElevation = input.fromElevationFeet ?? input.elevationFeet ?? 0
  const toElevation = input.toElevationFeet ?? input.elevationFeet ?? fromElevation
  const lineBlocker = rayBlocked({
    geometry, from, to, fromElevationFeet: fromElevation, toElevationFeet: toElevation,
    purpose: 'line-of-effect',
  })
  if (lineBlocker) return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true, sourceEntityId: lineBlocker }
  const rank: Record<MapGeometryCover, number> = { none: 0, half: 1, 'three-quarters': 2, total: 3 }
  let cover: MapGeometryCover = 'none'
  let sourceEntityId: string | undefined
  for (const obstacle of geometry.obstacles) {
    if (obstacle.cover === 'none') continue
    const intersects = entitySegments(obstacle).some((segment) => {
      const t = intersectionParameter(from, to, segment.a, segment.b)
      if (t == null || t <= 1e-5) return false
      const rayHeight = fromElevation + 2.5 + (toElevation - fromElevation) * t
      return rayHeight >= obstacle.baseHeightFeet && rayHeight < obstacle.baseHeightFeet + obstacle.heightFeet
    })
    if (intersects && rank[obstacle.cover] > rank[cover]) {
      cover = obstacle.cover
      sourceEntityId = obstacle.id
    }
  }
  for (const window of geometry.windows ?? []) {
    const windowCover = window.windowState === 'broken'
      ? 'half'
      : window.windowState === 'open'
        ? (window.cover === 'total' ? 'half' : window.cover ?? 'half')
        : window.cover ?? (window.blocksLineOfEffect ? 'total' : 'half')
    if (windowCover === 'none') continue
    const t = intersectionParameter(from, to, window.points[0], window.points[1])
    if (t == null || t <= 1e-5) continue
    const rayHeight = fromElevation + 2.5 + (toElevation - fromElevation) * t
    if (
      rayHeight >= window.baseHeightFeet && rayHeight < window.baseHeightFeet + window.heightFeet &&
      rank[windowCover] > rank[cover]
    ) {
      cover = windowCover
      sourceEntityId = window.id
    }
  }
  return {
    cover,
    armorClassBonus: cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0,
    blocksLineOfEffect: cover === 'total',
    sourceEntityId,
  }
}

export function mapGeometryCoverBetween(
  geometry: MapGeometryState | undefined,
  attacker: Token,
  target: Token,
  map?: Pick<BattleMap, 'gridSize' | 'tokens'>,
): MapGeometryCoverResult {
  const radius = Math.max(1, (map?.gridSize ?? 50) * Math.max(1, target.size) * 0.4)
  const samples = [
    { x: target.x - radius, y: target.y - radius },
    { x: target.x + radius, y: target.y - radius },
    { x: target.x + radius, y: target.y + radius },
    { x: target.x - radius, y: target.y + radius },
  ].map((to) => {
    const geometryCover = mapGeometryCoverFromPoint({
      geometry,
      from: attacker,
      to,
      fromElevationFeet: tokenElevation(attacker),
      toElevationFeet: tokenElevation(target),
    })
    if (geometryCover.cover !== 'none') return geometryCover
    const creature = map?.tokens.find((candidate) =>
      candidate.id !== attacker.id && candidate.id !== target.id && candidate.type !== 'obstacle' &&
      creatureIntersectsCoverRay(attacker, to, candidate, map.gridSize, tokenElevation(target)),
    )
    return creature
      ? {
          cover: 'half' as const,
          armorClassBonus: 2 as const,
          blocksLineOfEffect: false,
          sourceEntityId: `${MAP_GEOMETRY_CREATURE_COVER_PREFIX}${creature.id}`,
        }
      : geometryCover
  })
  const totalCount = samples.filter((sample) => sample.blocksLineOfEffect || sample.cover === 'total').length
  const threeQuarterCount = samples.filter((sample) => sample.cover === 'three-quarters').length
  const affectedCount = samples.filter((sample) => sample.cover !== 'none').length
  if (totalCount === samples.length) {
    const sourceEntityId = samples.find((sample) => sample.cover === 'total' && sample.sourceEntityId)?.sourceEntityId
    return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true, sourceEntityId }
  }
  if (totalCount + threeQuarterCount >= 3) {
    const sourceEntityId = samples.find((sample) =>
      (sample.cover === 'total' || sample.cover === 'three-quarters') && sample.sourceEntityId,
    )?.sourceEntityId
    return { cover: 'three-quarters', armorClassBonus: 5, blocksLineOfEffect: false, sourceEntityId }
  }
  if (affectedCount > 0) {
    const sourceEntityId = samples.find((sample) => sample.sourceEntityId)?.sourceEntityId
    return { cover: 'half', armorClassBonus: 2, blocksLineOfEffect: false, sourceEntityId }
  }
  return { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
}

function creatureIntersectsCoverRay(
  from: Token,
  to: MapGeometryPoint,
  creature: Token,
  gridSize: number,
  targetElevationFeet: number,
): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-6) return false
  const projection = ((creature.x - from.x) * dx + (creature.y - from.y) * dy) / lengthSquared
  // 只允许严格位于攻击者与目标采样点之间的生物提供掩护。
  if (projection <= 1e-4 || projection >= 1 - 1e-4) return false
  const closestX = from.x + dx * projection
  const closestY = from.y + dy * projection
  const footprintRadius = Math.max(1, gridSize * Math.max(1, creature.size) * 0.42)
  if (Math.hypot(creature.x - closestX, creature.y - closestY) > footprintRadius) return false

  const fromElevationFeet = tokenElevation(from)
  const rayHeight = fromElevationFeet + 2.5 + (targetElevationFeet - fromElevationFeet) * projection
  const creatureBase = tokenElevation(creature)
  const creatureHeight = Math.max(5, Math.max(1, creature.size) * 5)
  return rayHeight >= creatureBase && rayHeight < creatureBase + creatureHeight
}

export function mapGeometryLineOfEffectBlocked(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
}): boolean {
  return mapGeometryCoverFromPoint(input).blocksLineOfEffect
}

/** Geometry-only line-of-sight check. Unlike dynamic vision, this always respects vision-blocking walls and doors. */
export function mapGeometryLineOfSightBlocked(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
}): boolean {
  return rayBlocked({ ...input, purpose: 'vision' }) != null
}

export function mapGeometryCanSeeToken(input: {
  geometry?: MapGeometryState
  map: BattleMap
  viewer: Token
  target: Token
  forceEnabled?: boolean
  fallbackRangeFeet?: number
  worldMinute?: number
}): boolean {
  const geometry = input.geometry
  if (!geometry?.vision.enabled && !input.forceEnabled) return true
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const normalRangeFeet = Number.isFinite(input.viewer.visionRangeFeet)
    ? Math.max(0, input.viewer.visionRangeFeet!)
    : input.fallbackRangeFeet ?? geometry?.vision.defaultRangeFeet ?? DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET
  const darkvisionRangeFeet = Number.isFinite(input.viewer.darkvisionRangeFeet)
    ? Math.max(0, input.viewer.darkvisionRangeFeet!)
    : 0
  const blindsightRangeFeet = Number.isFinite(input.viewer.blindsightRangeFeet)
    ? Math.max(0, input.viewer.blindsightRangeFeet!)
    : 0
  const truesightRangeFeet = Number.isFinite(input.viewer.truesightRangeFeet)
    ? Math.max(0, input.viewer.truesightRangeFeet!)
    : 0
  const carriedLightRangeFeet = campaignLightIsActive(input.viewer.lightSource, input.worldMinute ?? 0)
    ? (input.viewer.lightSource?.brightRadiusFeet ?? 0) + (input.viewer.lightSource?.dimRadiusFeet ?? 0)
    : 0
  const rangeFeet = Math.max(normalRangeFeet, darkvisionRangeFeet, blindsightRangeFeet, truesightRangeFeet, carriedLightRangeFeet)
  const rangePx = rangeFeet / feetPerCell * Math.max(1, input.map.gridSize)
  const distancePx = Math.hypot(input.target.x - input.viewer.x, input.target.y - input.viewer.y)
  if (distancePx > rangePx) return false
  const illumination = mapGeometryIlluminationAtPoint({
    geometry,
    map: input.map,
    tokens: input.map.tokens,
    point: input.target,
    elevationFeet: tokenElevation(input.target),
    worldMinute: input.worldMinute,
  })
  const distanceFeet = distancePx / Math.max(1, input.map.gridSize) * feetPerCell
  if (illumination === 'magical-darkness') {
    const magicalRange = input.viewer.canSeeMagicalDarkness ? normalRangeFeet : 0
    if (distanceFeet > Math.max(magicalRange, blindsightRangeFeet, truesightRangeFeet)) return false
  } else if (illumination === 'darkness' && distanceFeet > Math.max(darkvisionRangeFeet, blindsightRangeFeet, truesightRangeFeet)) return false
  return !rayBlocked({
    geometry,
    from: input.viewer,
    to: input.target,
    fromElevationFeet: tokenElevation(input.viewer),
    toElevationFeet: tokenElevation(input.target),
    purpose: 'vision',
  })
}

export function mapGeometryVisibleTargets(input: {
  geometry?: MapGeometryState
  map: BattleMap
  viewers: readonly Token[]
  forceEnabled?: boolean
  fallbackRangeFeet?: number
  worldMinute?: number
}): Token[] {
  return input.map.tokens.filter((target) => {
    if (target.visibilityMode === 'dm-only' || target.perceptionVisibility === 'detected-unseen') return false
    if (target.visibilityMode === 'always') return true
    return input.viewers.some((viewer) => mapGeometryCanSeeToken({
      geometry: input.geometry,
      map: input.map,
      viewer,
      target,
      forceEnabled: input.forceEnabled,
      fallbackRangeFeet: input.fallbackRangeFeet,
      worldMinute: input.worldMinute,
    }))
  })
}

export type MapGeometryIllumination = 'bright' | 'dim' | 'darkness' | 'magical-darkness'

export function mapGeometryIlluminationAtPoint(input: {
  geometry?: MapGeometryState
  map: BattleMap
  tokens?: readonly Token[]
  point: MapGeometryPoint
  elevationFeet?: number
  worldMinute?: number
}): MapGeometryIllumination {
  const ambient = input.geometry?.vision.ambientLight ?? 'bright'
  const pointElevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, input.point)
  if (input.geometry?.obstacles.some((obstacle) =>
    obstacle.magicalDarkness === true && mapGeometryPointInPolygon(input.point, obstacle.points) &&
      mapGeometryObstacleAffectsElevation(obstacle, pointElevation),
  )) return 'magical-darkness'
  if (ambient === 'bright') return 'bright'
  let result: MapGeometryIllumination = ambient
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  for (const source of input.tokens ?? input.map.tokens) {
    const light = source.lightSource
    if (!campaignLightIsActive(light, input.worldMinute ?? 0)) continue
    const distanceFeet = Math.hypot(input.point.x - source.x, input.point.y - source.y) / gridSize * feetPerCell
    const brightRadius = Math.max(0, light?.brightRadiusFeet ?? 0)
    const dimRadius = brightRadius + Math.max(0, light?.dimRadiusFeet ?? 0)
    if (distanceFeet > dimRadius) continue
    if (rayBlocked({
      geometry: input.geometry,
      from: source,
      to: input.point,
      fromElevationFeet: tokenElevation(source),
      toElevationFeet: pointElevation,
      purpose: 'vision',
    })) continue
    if (distanceFeet <= brightRadius) return 'bright'
    result = 'dim'
  }
  for (const source of input.geometry?.lights ?? []) {
    if (!campaignLightIsActive(source, input.worldMinute ?? 0)) continue
    const point = source.points[0]
    const distanceFeet = Math.hypot(input.point.x - point.x, input.point.y - point.y) / gridSize * feetPerCell
    const dimRadius = source.brightRadiusFeet + source.dimRadiusFeet
    if (distanceFeet > dimRadius) continue
    if (rayBlocked({
      geometry: input.geometry,
      from: point,
      to: input.point,
      fromElevationFeet: source.elevationFeet,
      toElevationFeet: pointElevation,
      purpose: 'vision',
    })) continue
    if (distanceFeet <= source.brightRadiusFeet) return 'bright'
    result = 'dim'
  }
  return result
}

function nearestRayPoint(
  origin: MapGeometryPoint,
  angle: number,
  radius: number,
  segments: readonly MapGeometrySegment[],
  fromElevationFeet: number,
  toElevationFeet: number,
): MapGeometryPoint {
  const far = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius }
  let nearestT = 1
  for (const segment of segments) {
    if (!segment.blocksVision) continue
    const t = intersectionParameter(origin, far, segment.a, segment.b)
    if (t == null || t <= 1e-5 || t >= nearestT) continue
    const rayHeight = fromElevationFeet + 2.5 + (toElevationFeet - fromElevationFeet) * t
    if (rayHeight >= segment.baseHeightFeet && rayHeight < segment.baseHeightFeet + segment.heightFeet) {
      nearestT = t
    }
  }
  return { x: origin.x + (far.x - origin.x) * nearestT, y: origin.y + (far.y - origin.y) * nearestT }
}

export function mapGeometryLightPolygon(input: {
  geometry?: MapGeometryState
  map: Pick<BattleMap, 'width' | 'height' | 'gridSize' | 'feetPerCell'>
  source: MapGeometryPoint
  radiusFeet: number
  elevationFeet?: number
}): MapGeometryPoint[] {
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const radius = Math.max(0, input.radiusFeet) / feetPerCell * Math.max(1, input.map.gridSize)
  if (radius <= 0) return []
  const elevation = input.elevationFeet ?? 0
  const blockers = mapGeometrySegments(input.geometry).filter((segment) => segment.blocksVision)
  const angles = new Set<number>()
  for (let index = 0; index < 96; index += 1) angles.add(index / 96 * Math.PI * 2)
  for (const segment of blockers) {
    for (const point of [segment.a, segment.b]) {
      if (Math.hypot(point.x - input.source.x, point.y - input.source.y) > radius + 1) continue
      const angle = Math.atan2(point.y - input.source.y, point.x - input.source.x)
      angles.add(angle - 1e-5)
      angles.add(angle)
      angles.add(angle + 1e-5)
    }
  }
  return [...angles]
    .sort((left, right) => left - right)
    .map((angle) => {
      const far = { x: input.source.x + Math.cos(angle) * radius, y: input.source.y + Math.sin(angle) * radius }
      return nearestRayPoint(
        input.source,
        angle,
        radius,
        blockers,
        elevation,
        mapGeometryTerrainElevationAtPoint(input.geometry, far),
      )
    })
    .map((point) => ({
      x: Math.max(0, Math.min(input.map.width, point.x)),
      y: Math.max(0, Math.min(input.map.height, point.y)),
    }))
}

export function mapGeometryVisibilityPolygon(input: {
  geometry?: MapGeometryState
  map: BattleMap
  viewer: Token
  /** 战争迷雾可独立启用玩家视野，不要求 DM 另行打开动态视野开关。 */
  forceEnabled?: boolean
  /** 强制启用视野时使用的基础距离；Token 的明确视野值仍优先。 */
  fallbackRangeFeet?: number
  worldMinute?: number
}): MapGeometryPoint[] {
  const geometry = input.geometry
  if (!geometry?.vision.enabled && !input.forceEnabled) return []
  const origin = { x: input.viewer.x, y: input.viewer.y }
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const normalRangeFeet = Number.isFinite(input.viewer.visionRangeFeet)
    ? Math.max(0, input.viewer.visionRangeFeet!)
    : input.fallbackRangeFeet ?? geometry?.vision.defaultRangeFeet ?? DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET
  const darkvisionRangeFeet = Number.isFinite(input.viewer.darkvisionRangeFeet)
    ? Math.max(0, input.viewer.darkvisionRangeFeet!)
    : 0
  const blindsightRangeFeet = Number.isFinite(input.viewer.blindsightRangeFeet)
    ? Math.max(0, input.viewer.blindsightRangeFeet!)
    : 0
  const truesightRangeFeet = Number.isFinite(input.viewer.truesightRangeFeet)
    ? Math.max(0, input.viewer.truesightRangeFeet!)
    : 0
  const lightRangeFeet = campaignLightIsActive(input.viewer.lightSource, input.worldMinute ?? 0)
    ? (input.viewer.lightSource?.brightRadiusFeet ?? 0) + (input.viewer.lightSource?.dimRadiusFeet ?? 0)
    : 0
  // 地形遮罩使用正常视距；暗光、黑暗和场景光源在 LightingLayer 内表现。
  // 服务端仍会单独过滤未被照亮的生物，因此不会因地形可见而泄露隐藏 Token。
  const rangeFeet = Math.max(normalRangeFeet, darkvisionRangeFeet, blindsightRangeFeet, truesightRangeFeet, lightRangeFeet)
  if (rangeFeet <= 0) return []
  const radius = Math.max(1, rangeFeet / feetPerCell * Math.max(1, input.map.gridSize))
  const elevation = tokenElevation(input.viewer)
  const blockers = (geometry ? mapGeometrySegments(geometry) : []).filter((segment) => segment.blocksVision)
  const bounds: MapGeometrySegment[] = [
    [{ x: 0, y: 0 }, { x: input.map.width, y: 0 }],
    [{ x: input.map.width, y: 0 }, { x: input.map.width, y: input.map.height }],
    [{ x: input.map.width, y: input.map.height }, { x: 0, y: input.map.height }],
    [{ x: 0, y: input.map.height }, { x: 0, y: 0 }],
  ].map(([a, b], index) => ({
    entityId: `map-boundary-${index}`, entityKind: 'wall', a, b,
    blocksVision: true, blocksMovement: false, blocksLineOfEffect: false,
    baseHeightFeet: -1_000, heightFeet: 11_000,
  }))
  const angles = new Set<number>()
  for (let index = 0; index < 96; index += 1) angles.add(index / 96 * Math.PI * 2)
  for (const segment of blockers) {
    for (const point of [segment.a, segment.b]) {
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x)
      angles.add(angle - 1e-5)
      angles.add(angle)
      angles.add(angle + 1e-5)
    }
  }
  return [...angles]
    .sort((left, right) => left - right)
    .map((angle) => {
      const far = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius }
      return nearestRayPoint(
        origin,
        angle,
        radius,
        [...blockers, ...bounds],
        elevation,
        mapGeometryTerrainElevationAtPoint(geometry, far),
      )
    })
}

let runtimeGeometryByMapId = new Map<string, MapGeometryState>()

export function setMapGeometryRuntime(maps: readonly MapGeometryState[]): void {
  runtimeGeometryByMapId = new Map(maps.map((map) => [map.mapId, map]))
}

export function mapGeometryRuntimeForMap(mapId: string): MapGeometryState | undefined {
  return runtimeGeometryByMapId.get(mapId)
}
