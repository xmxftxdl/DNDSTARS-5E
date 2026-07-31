import type { BattleMap, Token } from '../store/maps'
import { campaignLightIsActive, type CampaignLightSourceKind } from './campaignTime'
import type { Dnd5eMapEnvironment } from '../rulesets/dnd5e/environmentRules'
import {
  compileGeometryCached,
  doorLockState as kernelDoorLockState,
  doorOpenState as kernelDoorOpenState,
  doorPhysicalState as kernelDoorPhysicalState,
  interpolatePoint as kernelInterpolatePoint,
  legacyDoorState as kernelLegacyDoorState,
  openingIntervalOnWallSegment as kernelOpeningIntervalOnWallSegment,
  projectPointToSegment as kernelProjectPointToSegment,
  querySegmentSpatialIndexBounds,
  raycastGeometry,
  validateGeometryRelationships,
  validateGeometryStructure,
  wallEdgeId,
  wallRenderSegments,
} from '../../shared/map-geometry-kernel.mjs'
import { compileDnd5eEffectiveVisionProfile } from '../../shared/dnd5e-vision-profile.mjs'

export const MAP_GEOMETRY_RESOURCE = 'map-geometry'
export const MAP_GEOMETRY_SCHEMA_VERSION = 3
export const MAP_GEOMETRY_LEGACY_SCHEMA_VERSION = 1
export const MAP_GEOMETRY_V2_SCHEMA_VERSION = 2
export const MAP_GEOMETRY_MAX_ENTITIES = 4_096

export interface MapGeometryPoint {
  x: number
  y: number
}

export interface MapGeometryGridCell {
  col: number
  row: number
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
  wallEdgeId?: string
  startT?: number
  endT?: number
}

export interface MapGeometryWall extends MapGeometryHeight, MapGeometryBlocking {
  id: string
  kind: 'wall'
  label: string
  points: MapGeometryPoint[]
  edgeIds?: string[]
  material?: MapGeometryWallMaterial
  createdAt: number
}

export type MapGeometryDoorState = 'open' | 'closed' | 'locked'
export type MapGeometryDoorOpenState = 'open' | 'closed'
export type MapGeometryDoorLockState = 'unlocked' | 'locked' | 'jammed'
export type MapGeometryDoorPhysicalState = 'intact' | 'broken' | 'destroyed'
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
  /** @deprecated Schema V3 writes this derived compatibility field for older clients. */
  state: MapGeometryDoorState
  openState?: MapGeometryDoorOpenState
  lockState?: MapGeometryDoorLockState
  physicalState?: MapGeometryDoorPhysicalState
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
  /** 由 DM 高度画笔创建的纯地形标高区域；不充当障碍物或掩护。 */
  terrainRegion?: boolean
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
export type MapGeometryTool = 'select' | 'wall' | 'door' | 'window' | 'obstacle' | 'elevation' | 'light' | 'delete'
export type MapGeometryEntityPatch = Partial<MapGeometryHeight & MapGeometryBlocking> & {
  label?: string
  points?: MapGeometryPoint[]
  material?: MapGeometryWallMaterial
  edgeIds?: string[]
  parentWallId?: string
  parentWallSegmentIndex?: number
  wallEdgeId?: string
  startT?: number
  endT?: number
  state?: MapGeometryDoorState
  openState?: MapGeometryDoorOpenState
  lockState?: MapGeometryDoorLockState
  physicalState?: MapGeometryDoorPhysicalState
  secret?: boolean
  hinge?: MapGeometryDoorHinge
  swing?: MapGeometryDoorSwing
  interaction?: MapGeometryDoorInteraction
  revealedToMemberIds?: string[]
  cover?: MapGeometryCover
  terrainCostMultiplier?: number
  traversal?: 'ground' | 'climb' | 'swim'
  terrainElevationFeet?: number
  terrainRegion?: boolean
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

export function mapGeometryRelationshipIssues(geometry: MapGeometryState) {
  return [...validateGeometryStructure(geometry), ...validateGeometryRelationships(geometry)]
}

export function mapGeometryDoorOpenState(door: MapGeometryDoor): MapGeometryDoorOpenState {
  return kernelDoorOpenState(door)
}

export function mapGeometryDoorLockState(door: MapGeometryDoor): MapGeometryDoorLockState {
  return kernelDoorLockState(door)
}

export function mapGeometryDoorPhysicalState(door: MapGeometryDoor): MapGeometryDoorPhysicalState {
  return kernelDoorPhysicalState(door)
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
  const hasStable = raw.wallEdgeId != null || raw.startT != null || raw.endT != null
  const hasLegacy = raw.parentWallId != null || raw.parentWallSegmentIndex != null
  if (!hasStable && !hasLegacy) return {}
  const attachment: MapGeometryWallAttachment = {}
  if (hasStable) {
    if (
      typeof raw.wallEdgeId !== 'string' || !raw.wallEdgeId || raw.wallEdgeId.length > 200 ||
      !finite(raw.startT, 0, 1) || !finite(raw.endT, 0, 1) ||
      Math.abs(raw.endT - raw.startT) <= 0.0001
    ) return undefined
    attachment.wallEdgeId = raw.wallEdgeId
    attachment.startT = Math.min(raw.startT, raw.endT)
    attachment.endT = Math.max(raw.startT, raw.endT)
  }
  if (hasLegacy) {
    if (
      typeof raw.parentWallId !== 'string' || !raw.parentWallId || raw.parentWallId.length > 160 ||
      !Number.isInteger(raw.parentWallSegmentIndex) || !finite(raw.parentWallSegmentIndex, 0, 2_047)
    ) return undefined
    attachment.parentWallId = raw.parentWallId
    attachment.parentWallSegmentIndex = raw.parentWallSegmentIndex as number
  }
  return attachment
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
    if (
      !points ||
      (raw.material != null && !['stone', 'brick', 'wood', 'metal', 'natural'].includes(String(raw.material))) ||
      (raw.edgeIds != null && (
        !Array.isArray(raw.edgeIds) ||
        raw.edgeIds.length !== points.length - 1 ||
        raw.edgeIds.some((id) => typeof id !== 'string' || !id || id.length > 200) ||
        new Set(raw.edgeIds).size !== raw.edgeIds.length
      ))
    ) {
      return undefined
    }
    return {
      ...common,
      kind: 'wall',
      points,
      ...(Array.isArray(raw.edgeIds) ? { edgeIds: [...raw.edgeIds] as string[] } : {}),
      material: (raw.material as MapGeometryWallMaterial | undefined) ?? 'stone',
    }
  }
  if (raw.kind === 'door') {
    const points = normalizePoints(raw.points, 2, 2)
    const attachment = normalizeWallAttachment(raw)
    if (
      !points || !attachment ||
      (raw.state != null && !['open', 'closed', 'locked'].includes(String(raw.state))) ||
      (raw.openState != null && !['open', 'closed'].includes(String(raw.openState))) ||
      (raw.lockState != null && !['unlocked', 'locked', 'jammed'].includes(String(raw.lockState))) ||
      (raw.physicalState != null && !['intact', 'broken', 'destroyed'].includes(String(raw.physicalState))) ||
      raw.state == null && raw.openState == null ||
      typeof raw.secret !== 'boolean' ||
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
      state: (raw.state as MapGeometryDoorState | undefined) ??
        (raw.openState === 'open' ? 'open' : raw.lockState === 'locked' ? 'locked' : 'closed'),
      openState: (raw.openState as MapGeometryDoorOpenState | undefined) ??
        (raw.state === 'open' ? 'open' : 'closed'),
      lockState: (raw.lockState as MapGeometryDoorLockState | undefined) ??
        (raw.state === 'locked' ? 'locked' : 'unlocked'),
      physicalState: (raw.physicalState as MapGeometryDoorPhysicalState | undefined) ?? 'intact',
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
      (raw.terrainRegion != null && typeof raw.terrainRegion !== 'boolean') ||
      (raw.magicalDarkness != null && typeof raw.magicalDarkness !== 'boolean') ||
      (raw.darknessSpellLevel != null && !finite(raw.darknessSpellLevel, 0, 9))) return undefined
    return {
      ...common, kind: 'obstacle', points, cover: raw.cover as MapGeometryCover,
      ...(raw.terrainCostMultiplier != null ? { terrainCostMultiplier: raw.terrainCostMultiplier as number } : {}),
      ...(raw.traversal != null ? { traversal: raw.traversal as MapGeometryObstacle['traversal'] } : {}),
      ...(raw.terrainElevationFeet != null ? { terrainElevationFeet: raw.terrainElevationFeet as number } : {}),
      ...(raw.terrainRegion === true ? { terrainRegion: true } : {}),
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
  return migrateMapGeometryV3({
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
  })
}

export function normalizeSharedMapGeometry(value: unknown): SharedMapGeometryState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    ![MAP_GEOMETRY_LEGACY_SCHEMA_VERSION, MAP_GEOMETRY_V2_SCHEMA_VERSION, MAP_GEOMETRY_SCHEMA_VERSION]
      .includes(raw.schemaVersion as number) ||
    !Array.isArray(raw.maps) ||
    !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const maps = raw.maps.map(normalizeMapGeometry)
  if (maps.some((map) => !map)) return undefined
  const normalized = (maps as MapGeometryState[]).map((map) =>
    migrateMapGeometryV3(
      raw.schemaVersion === MAP_GEOMETRY_LEGACY_SCHEMA_VERSION ? migrateMapGeometryV1(map) : map,
    ),
  )
  if (normalized.some((map) =>
    validateGeometryStructure(map).length > 0 || validateGeometryRelationships(map).length > 0,
  )) return undefined
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

/** Upgrade wall openings and door state into the stable Schema V3 representation. */
export function migrateMapGeometryV3(geometry: MapGeometryState): MapGeometryState {
  const walls = geometry.walls.map((wall) => ({
    ...wall,
    edgeIds: wall.points.slice(0, -1).map((_, index) => wall.edgeIds?.[index] ?? `edge:${wall.id}:${index}`),
  }))
  const withStableWalls = { ...geometry, walls }
  const migrateOpening = <T extends MapGeometryDoor | MapGeometryWindow>(opening: T): T => {
    if (
      opening.wallEdgeId != null &&
      Number.isFinite(opening.startT) &&
      Number.isFinite(opening.endT)
    ) return opening
    const attachment = mapGeometryAttachOpeningToWall(withStableWalls, opening.points[0], opening.points[1], 2)
    return attachment ? { ...opening, ...attachment } : opening
  }
  return {
    ...geometry,
    walls,
    doors: geometry.doors.map((door) => migrateOpening({
      ...door,
      openState: mapGeometryDoorOpenState(door),
      lockState: mapGeometryDoorLockState(door),
      physicalState: mapGeometryDoorPhysicalState(door),
      state: kernelLegacyDoorState(door),
    })),
    windows: (geometry.windows ?? []).map(migrateOpening),
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
  return kernelInterpolatePoint(a, b, t)
}

function projectPointToSegment(point: MapGeometryPoint, a: MapGeometryPoint, b: MapGeometryPoint) {
  return kernelProjectPointToSegment(point, a, b)
}

function pointSegmentDistanceSquared(
  point: MapGeometryPoint,
  start: MapGeometryPoint,
  end: MapGeometryPoint,
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2
  const t = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / (dx * dx + dy * dy)))
  const projectedX = start.x + dx * t
  const projectedY = start.y + dy * t
  return (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2
}

function simplifyPolyline(
  points: readonly MapGeometryPoint[],
  toleranceSquared: number,
): MapGeometryPoint[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }))
  let furthestIndex = -1
  let furthestDistanceSquared = toleranceSquared
  const first = points[0]
  const last = points[points.length - 1]
  for (let index = 1; index < points.length - 1; index += 1) {
    const distanceSquared = pointSegmentDistanceSquared(points[index], first, last)
    if (distanceSquared <= furthestDistanceSquared) continue
    furthestDistanceSquared = distanceSquared
    furthestIndex = index
  }
  if (furthestIndex < 0) return [{ ...first }, { ...last }]
  const left = simplifyPolyline(points.slice(0, furthestIndex + 1), toleranceSquared)
  const right = simplifyPolyline(points.slice(furthestIndex), toleranceSquared)
  return [...left.slice(0, -1), ...right]
}

/**
 * 将高度粗笔采样点压缩成可编辑的闭合区域轮廓。
 * 返回值不重复首点；调用方使用 closed polygon 渲染和碰撞。
 */
export function mapGeometrySimplifyTerrainRegionPoints(
  input: readonly MapGeometryPoint[],
  tolerance = 3,
  maximumPoints = 96,
): MapGeometryPoint[] {
  const finitePoints = input
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }))
  if (finitePoints.length < 3) return finitePoints

  const minimumDistance = Math.max(0.5, tolerance)
  const minimumDistanceSquared = minimumDistance ** 2
  const sampled = [finitePoints[0]]
  for (const point of finitePoints.slice(1)) {
    const previous = sampled[sampled.length - 1]
    if ((point.x - previous.x) ** 2 + (point.y - previous.y) ** 2 >= minimumDistanceSquared) {
      sampled.push(point)
    }
  }
  if (sampled.length < 3) return sampled
  const last = sampled[sampled.length - 1]
  const first = sampled[0]
  if ((last.x - first.x) ** 2 + (last.y - first.y) ** 2 < minimumDistanceSquared) sampled.pop()
  if (sampled.length < 3) return sampled

  const closed = [...sampled, sampled[0]]
  let simplified = simplifyPolyline(closed, minimumDistanceSquared)
  if (simplified.length > 1) simplified = simplified.slice(0, -1)
  if (simplified.length < 3) simplified = sampled

  const limit = Math.max(3, Math.floor(maximumPoints))
  if (simplified.length <= limit) return simplified
  const reduced: MapGeometryPoint[] = []
  for (let index = 0; index < limit; index += 1) {
    reduced.push({ ...simplified[Math.floor(index * simplified.length / limit)] })
  }
  return reduced
}

/**
 * 将一组地图格合并为一个外轮廓。相邻格子的共享边会被消除，因此渲染时只留下选区边界。
 * 新高度区使用该函数；旧存档中的自由多边形仍继续兼容。
 */
export function mapGeometryGridSelectionBoundary(
  input: readonly MapGeometryGridCell[],
  gridSize: number,
  gridOffsetX = 0,
  gridOffsetY = 0,
): MapGeometryPoint[] {
  const size = Math.max(1, gridSize)
  const cells = new Map<string, MapGeometryGridCell>()
  for (const cell of input) {
    if (!Number.isFinite(cell.col) || !Number.isFinite(cell.row)) continue
    const normalized = { col: Math.trunc(cell.col), row: Math.trunc(cell.row) }
    cells.set(`${normalized.col},${normalized.row}`, normalized)
  }
  if (cells.size === 0) return []

  type GridVertex = { x: number; y: number }
  type GridEdge = { start: GridVertex; end: GridVertex; used: boolean }
  const edges: GridEdge[] = []
  const has = (col: number, row: number) => cells.has(`${col},${row}`)
  for (const { col, row } of cells.values()) {
    if (!has(col, row - 1)) edges.push({ start: { x: col, y: row }, end: { x: col + 1, y: row }, used: false })
    if (!has(col + 1, row)) edges.push({ start: { x: col + 1, y: row }, end: { x: col + 1, y: row + 1 }, used: false })
    if (!has(col, row + 1)) edges.push({ start: { x: col + 1, y: row + 1 }, end: { x: col, y: row + 1 }, used: false })
    if (!has(col - 1, row)) edges.push({ start: { x: col, y: row + 1 }, end: { x: col, y: row }, used: false })
  }

  const vertexKey = (point: GridVertex) => `${point.x},${point.y}`
  const outgoing = new Map<string, GridEdge[]>()
  for (const edge of edges) {
    const key = vertexKey(edge.start)
    outgoing.set(key, [...(outgoing.get(key) ?? []), edge])
  }

  const loops: GridVertex[][] = []
  for (const firstEdge of edges) {
    if (firstEdge.used) continue
    const loop: GridVertex[] = [{ ...firstEdge.start }]
    firstEdge.used = true
    let cursor = firstEdge.end
    let guard = 0
    while (vertexKey(cursor) !== vertexKey(loop[0]) && guard <= edges.length) {
      loop.push({ ...cursor })
      const next = (outgoing.get(vertexKey(cursor)) ?? []).find((edge) => !edge.used)
      if (!next) break
      next.used = true
      cursor = next.end
      guard += 1
    }
    if (vertexKey(cursor) === vertexKey(loop[0]) && loop.length >= 4) loops.push(loop)
  }
  if (loops.length === 0) return []

  const signedArea = (points: readonly GridVertex[]) => points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]
    return area + point.x * next.y - next.x * point.y
  }, 0) / 2
  const outer = loops.reduce((largest, loop) =>
    Math.abs(signedArea(loop)) > Math.abs(signedArea(largest)) ? loop : largest,
  )
  const compact = outer.filter((point, index) => {
    const previous = outer[(index - 1 + outer.length) % outer.length]
    const next = outer[(index + 1) % outer.length]
    return (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x) !== 0
  })
  return compact.map((point) => ({
    x: gridOffsetX + point.x * size,
    y: gridOffsetY + point.y * size,
  }))
}

export interface MapGeometryWallOpeningAttachment {
  parentWallId: string
  parentWallSegmentIndex: number
  wallEdgeId: string
  startT: number
  endT: number
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
        wallEdgeId: wallEdgeId(wall, segmentIndex),
        startT: Math.min(projectedStart.t, projectedEnd.t),
        endT: Math.max(projectedStart.t, projectedEnd.t),
        points: [projectedStart.point, projectedEnd.point],
        score,
      }
    }
  }
  if (!best) return undefined
  return {
    parentWallId: best.parentWallId,
    parentWallSegmentIndex: best.parentWallSegmentIndex,
    wallEdgeId: best.wallEdgeId,
    startT: best.startT,
    endT: best.endT,
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
  return kernelOpeningIntervalOnWallSegment(opening, wall, wallSegmentIndex) ?? undefined
}

export function mapGeometryOpeningOverlaps(
  geometry: MapGeometryState | undefined,
  opening: MapGeometryDoor | MapGeometryWindow,
  ignoreEntityId?: string,
  clearance = 0.002,
): boolean {
  const wall = opening.wallEdgeId
    ? geometry?.walls.find((candidate) =>
        candidate.points.slice(0, -1).some((_, index) => wallEdgeId(candidate, index) === opening.wallEdgeId),
      )
    : geometry?.walls.find((candidate) => candidate.id === opening.parentWallId)
  if (!wall) return !!(opening.wallEdgeId || opening.parentWallId)
  const segmentIndex = opening.wallEdgeId
    ? wall.points.slice(0, -1).findIndex((_, index) => wallEdgeId(wall, index) === opening.wallEdgeId)
    : opening.parentWallSegmentIndex ?? -1
  if (segmentIndex < 0) return true
  const interval = openingIntervalOnWallSegment(opening, wall, segmentIndex)
  if (!interval) return true
  const openingEdgeId = opening.wallEdgeId ?? wallEdgeId(wall, segmentIndex)
  return [...(geometry?.doors ?? []), ...(geometry?.windows ?? [])].some((candidate) => {
    if (candidate.id === (ignoreEntityId ?? opening.id)) return false
    const candidateWall = candidate.wallEdgeId
      ? geometry?.walls.find((candidateWallEntry) =>
          candidateWallEntry.points.slice(0, -1).some(
            (_, index) => wallEdgeId(candidateWallEntry, index) === candidate.wallEdgeId,
          ),
        )
      : geometry?.walls.find((candidateWallEntry) => candidateWallEntry.id === candidate.parentWallId)
    if (!candidateWall) return false
    const candidateSegmentIndex = candidate.wallEdgeId
      ? candidateWall.points.slice(0, -1).findIndex(
          (_, index) => wallEdgeId(candidateWall, index) === candidate.wallEdgeId,
        )
      : candidate.parentWallSegmentIndex ?? -1
    if (
      candidateSegmentIndex < 0 ||
      (candidate.wallEdgeId ?? wallEdgeId(candidateWall, candidateSegmentIndex)) !== openingEdgeId
    ) return false
    const candidateInterval = openingIntervalOnWallSegment(candidate, candidateWall, candidateSegmentIndex)
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
  const nextWall = {
    ...previousWall,
    points,
    edgeIds: points.slice(0, -1).map((_, index) =>
      previousWall.edgeIds?.[index] ?? `edge:${previousWall.id}:${index}`,
    ),
  }
  const reproject = <T extends MapGeometryDoor | MapGeometryWindow>(opening: T): T | undefined => {
    if (opening.parentWallId !== wallId && !nextWall.edgeIds.includes(opening.wallEdgeId ?? '')) return opening
    const segmentIndex = opening.wallEdgeId
      ? nextWall.edgeIds.indexOf(opening.wallEdgeId)
      : opening.parentWallSegmentIndex ?? -1
    const oldA = previousWall.points[segmentIndex]
    const oldB = previousWall.points[segmentIndex + 1]
    const nextA = points[segmentIndex]
    const nextB = points[segmentIndex + 1]
    if (!oldA || !oldB || !nextA || !nextB) return undefined
    const startT = Number.isFinite(opening.startT)
      ? opening.startT!
      : projectPointToSegment(opening.points[0], oldA, oldB).t
    const endT = Number.isFinite(opening.endT)
      ? opening.endT!
      : projectPointToSegment(opening.points[1], oldA, oldB).t
    return {
      ...opening,
      parentWallId: wallId,
      parentWallSegmentIndex: segmentIndex,
      wallEdgeId: nextWall.edgeIds[segmentIndex],
      startT: Math.min(startT, endT),
      endT: Math.max(startT, endT),
      points: [
        interpolatePoint(nextA, nextB, startT),
        interpolatePoint(nextA, nextB, endT),
      ],
    }
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
  return wallRenderSegments(geometry, wall)
}

export function mapGeometrySegments(geometry: MapGeometryState | undefined): MapGeometrySegment[] {
  return runtimeCompiledGeometry(geometry).segments as MapGeometrySegment[]
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

export function mapGeometryAbsoluteElevationAtPoint(
  geometry: MapGeometryState | undefined,
  point: MapGeometryPoint,
  elevationFeet?: number,
): number {
  const terrainElevation = mapGeometryTerrainElevationAtPoint(geometry, point)
  if (!Number.isFinite(elevationFeet)) return terrainElevation
  return Math.max(terrainElevation, Math.max(-1_000, Math.min(10_000, elevationFeet!)))
}

/**
 * Returns a Token's absolute elevation.
 *
 * Old maps often omitted elevationFeet (or retained a stale value below a newly
 * painted terrain surface). Tokens cannot occupy space below the terrain, so the
 * terrain surface is the authoritative lower bound.
 */
export function mapGeometryTokenElevation(
  geometry: MapGeometryState | undefined,
  token: Pick<Token, 'x' | 'y' | 'elevationFeet'>,
): number {
  return mapGeometryAbsoluteElevationAtPoint(geometry, token, token.elevationFeet)
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
  const fromElevation = input.fromElevationFeet ?? mapGeometryTokenElevation(geometry, token)
  const toElevation = input.toElevationFeet ?? fromElevation
  const creatureHeight = Math.max(5, Math.max(1, token.size) * 5)
  for (const obstacle of geometry.obstacles) {
    if (
      obstacle.blocksMovement && overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, toElevation, creatureHeight) &&
      mapGeometryPointInPolygon(to, obstacle.points)
    ) return { blocked: true, entityId: obstacle.id }
  }
  const compiled = runtimeCompiledGeometry(geometry)
  for (const offset of offsets) {
    const rayFrom = { x: from.x + offset.x, y: from.y + offset.y }
    const rayTo = { x: to.x + offset.x, y: to.y + offset.y }
    const candidates = querySegmentSpatialIndexBounds(compiled.index, {
      minX: Math.min(rayFrom.x, rayTo.x),
      minY: Math.min(rayFrom.y, rayTo.y),
      maxX: Math.max(rayFrom.x, rayTo.x),
      maxY: Math.max(rayFrom.y, rayTo.y),
    }) as MapGeometrySegment[]
    for (const segment of candidates) {
      if (!segment.blocksMovement) continue
      const t = intersectionParameter(
        rayFrom,
        rayTo,
        segment.a,
        segment.b,
      )
      if (t == null || t <= 1e-5) continue
      const elevation = fromElevation + (toElevation - fromElevation) * t
      if (overlapsHeight(segment.baseHeightFeet, segment.heightFeet, elevation, creatureHeight)) {
        return { blocked: true, entityId: segment.entityId }
      }
    }
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
  const elevation = input.elevationFeet ?? mapGeometryTokenElevation(geometry, token)
  const creatureHeight = Math.max(5, Math.max(1, token.size) * 5)
  const candidates = querySegmentSpatialIndexBounds(runtimeCompiledGeometry(geometry).index, {
    minX: at.x - radius,
    minY: at.y - radius,
    maxX: at.x + radius,
    maxY: at.y + radius,
  }) as MapGeometrySegment[]
  for (const segment of candidates) {
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
  fromEyeHeightFeet?: number
  toEyeHeightFeet?: number
  purpose: 'vision' | 'line-of-effect'
}): string | undefined {
  const fromElevation = input.fromElevationFeet ?? input.elevationFeet ?? 0
  const toElevation = input.toElevationFeet ?? input.elevationFeet ?? fromElevation
  return raycastGeometry({
    compiled: runtimeCompiledGeometry(input.geometry),
    from: input.from,
    to: input.to,
    fromElevationFeet: fromElevation,
    toElevationFeet: toElevation,
    fromEyeHeightFeet: input.fromEyeHeightFeet ?? 2.5,
    toEyeHeightFeet: input.toEyeHeightFeet ?? 2.5,
    purpose: input.purpose,
    ignoreStart: true,
  })?.segment.entityId
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
      fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
      toElevationFeet: mapGeometryTokenElevation(geometry, target),
    })
    if (geometryCover.cover !== 'none') return geometryCover
    const creature = map?.tokens.find((candidate) =>
      candidate.id !== attacker.id && candidate.id !== target.id && candidate.type !== 'obstacle' &&
      creatureIntersectsCoverRay(
        geometry,
        attacker,
        to,
        candidate,
        map.gridSize,
        mapGeometryTokenElevation(geometry, target),
      ),
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
  geometry: MapGeometryState | undefined,
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

  const fromElevationFeet = mapGeometryTokenElevation(geometry, from)
  const rayHeight = fromElevationFeet + 2.5 + (targetElevationFeet - fromElevationFeet) * projection
  const creatureBase = mapGeometryTokenElevation(geometry, creature)
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
  const profile = compileDnd5eEffectiveVisionProfile({
    token: input.viewer,
    fallbackRangeFeet: input.fallbackRangeFeet ??
      geometry?.vision.defaultRangeFeet ??
      DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  })
  const carriedLightRangeFeet = campaignLightIsActive(input.viewer.lightSource, input.worldMinute ?? 0)
    ? (input.viewer.lightSource?.brightRadiusFeet ?? 0) + (input.viewer.lightSource?.dimRadiusFeet ?? 0)
    : 0
  const rangeFeet = Math.max(
    profile.normalRangeFeet,
    profile.darkvisionRangeFeet,
    profile.darknessSightRangeFeet,
    profile.magicalDarknessSightRangeFeet,
    profile.blindsightRangeFeet,
    profile.truesightRangeFeet,
    carriedLightRangeFeet,
  )
  const rangePx = rangeFeet / feetPerCell * Math.max(1, input.map.gridSize)
  const gridSize = Math.max(1, input.map.gridSize)
  const targetRadiusPx = gridSize * Math.max(1, input.target.size) * 0.4
  const distancePx = Math.max(
    0,
    Math.hypot(input.target.x - input.viewer.x, input.target.y - input.viewer.y) - targetRadiusPx,
  )
  if (distancePx > rangePx) return false
  const illumination = mapGeometryIlluminationAtPoint({
    geometry,
    map: input.map,
    tokens: input.map.tokens,
    point: input.target,
    elevationFeet: mapGeometryTokenElevation(geometry, input.target),
    worldMinute: input.worldMinute,
  })
  const distanceFeet = distancePx / Math.max(1, input.map.gridSize) * feetPerCell
  if (illumination === 'magical-darkness') {
    if (distanceFeet > Math.max(
      profile.magicalDarknessSightRangeFeet,
      profile.blindsightRangeFeet,
      profile.truesightRangeFeet,
    )) return false
  } else if (illumination === 'darkness' && distanceFeet > Math.max(
    profile.darkvisionRangeFeet,
    profile.darknessSightRangeFeet,
    profile.blindsightRangeFeet,
    profile.truesightRangeFeet,
  )) return false
  const targetSamples = [
    { x: input.target.x, y: input.target.y },
    { x: input.target.x - targetRadiusPx, y: input.target.y - targetRadiusPx },
    { x: input.target.x + targetRadiusPx, y: input.target.y - targetRadiusPx },
    { x: input.target.x + targetRadiusPx, y: input.target.y + targetRadiusPx },
    { x: input.target.x - targetRadiusPx, y: input.target.y + targetRadiusPx },
  ]
  const viewerHeightFeet = Math.max(5, Math.max(1, input.viewer.size) * 5)
  const targetHeightFeet = Math.max(5, Math.max(1, input.target.size) * 5)
  return targetSamples.some((sample) => !rayBlocked({
    geometry,
    from: input.viewer,
    to: sample,
    fromElevationFeet: mapGeometryTokenElevation(geometry, input.viewer),
    toElevationFeet: mapGeometryTokenElevation(geometry, input.target),
    fromEyeHeightFeet: viewerHeightFeet / 2,
    toEyeHeightFeet: targetHeightFeet / 2,
    purpose: 'vision',
  }))
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

export type MapGeometrySpellLightingSource = {
  id: string
  areaId: string
  point: MapGeometryPoint
  elevationFeet: number
  spellLevel: number
  color: string
} & (
  | {
      kind: 'light'
      brightRadiusFeet: number
      dimRadiusFeet: number
      suppressesMagicalDarknessThroughLevel?: number
    }
  | {
      kind: 'magical-darkness'
      radiusFeet: number
      suppressesMagicalLightThroughLevel?: number
    }
)

function spellLightingRadius(source: MapGeometrySpellLightingSource): number {
  return source.kind === 'light'
    ? source.brightRadiusFeet + source.dimRadiusFeet
    : source.radiusFeet
}

function spellLightingOverlaps(
  left: MapGeometrySpellLightingSource,
  right: MapGeometrySpellLightingSource,
  map: BattleMap,
): boolean {
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const distanceFeet = Math.hypot(left.point.x - right.point.x, left.point.y - right.point.y) /
    Math.max(1, map.gridSize) * feetPerCell
  return distanceFeet <= spellLightingRadius(left) + spellLightingRadius(right)
}

/**
 * 将法术持续区域投影为统一地图光源。这里同时处理 Darkness/Daylight 的
 * 环级压制，确保权威可见性和画布遮罩不会各算一套结果。
 */
export function mapGeometrySpellLightingSources(
  map: BattleMap,
  geometry?: MapGeometryState,
): MapGeometrySpellLightingSource[] {
  const candidates = (map.dnd5ePluginAreas ?? []).flatMap((area): MapGeometrySpellLightingSource[] => {
    const lighting = area.lighting
    const anchor = area.anchorCell ?? area.cells[0]
    if (!lighting || !anchor) return []
    const point = {
      x: map.gridOffsetX + (anchor.col + 0.5) * Math.max(1, map.gridSize),
      y: map.gridOffsetY + (anchor.row + 0.5) * Math.max(1, map.gridSize),
    }
    const anchorToken = area.anchorTokenId
      ? map.tokens.find((token) => token.id === area.anchorTokenId)
      : undefined
    const elevationFeet = anchorToken
      ? mapGeometryTokenElevation(geometry, anchorToken)
      : mapGeometryTerrainElevationAtPoint(geometry, point)
    return lighting.kind === 'light'
      ? [{
          id: `spell-light:${area.id}`,
          areaId: area.id,
          point,
          elevationFeet,
          spellLevel: lighting.spellLevel,
          color: lighting.color,
          kind: 'light',
          brightRadiusFeet: lighting.brightRadiusFeet,
          dimRadiusFeet: lighting.dimRadiusFeet,
          suppressesMagicalDarknessThroughLevel: lighting.suppressesMagicalDarknessThroughLevel,
        }]
      : [{
          id: `spell-darkness:${area.id}`,
          areaId: area.id,
          point,
          elevationFeet,
          spellLevel: lighting.spellLevel,
          color: '#0f102a',
          kind: 'magical-darkness',
          radiusFeet: lighting.radiusFeet,
          suppressesMagicalLightThroughLevel: lighting.suppressesMagicalLightThroughLevel,
        }]
  })
  return candidates.filter((candidate) => !candidates.some((other) => {
    if (other.id === candidate.id || other.kind === candidate.kind || !spellLightingOverlaps(candidate, other, map)) {
      return false
    }
    return candidate.kind === 'magical-darkness'
      ? (other.kind === 'light' &&
          (other.suppressesMagicalDarknessThroughLevel ?? -1) >= candidate.spellLevel)
      : (other.kind === 'magical-darkness' &&
          (other.suppressesMagicalLightThroughLevel ?? -1) >= candidate.spellLevel)
  }))
}

/** SRD 光照法术一旦与相应环级的魔法黑暗重叠，会解除整个黑暗来源。 */
export function mapGeometryMagicalDarknessObstacleIsSuppressed(input: {
  obstacle: MapGeometryObstacle
  map: BattleMap
  geometry?: MapGeometryState
  spellLighting?: readonly MapGeometrySpellLightingSource[]
}): boolean {
  const darknessLevel = input.obstacle.darknessSpellLevel ?? 2
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  return (input.spellLighting ?? mapGeometrySpellLightingSources(input.map, input.geometry)).some((source) => {
    if (source.kind !== 'light' ||
      (source.suppressesMagicalDarknessThroughLevel ?? -1) < darknessLevel) return false
    const radius = spellLightingRadius(source) / feetPerCell * gridSize
    if (mapGeometryPointInPolygon(source.point, input.obstacle.points)) return true
    return input.obstacle.points.some((point) => Math.hypot(point.x - source.point.x, point.y - source.point.y) <= radius) ||
      input.obstacle.points.some((point, index) => pointToSegmentDistance(
        source.point,
        point,
        input.obstacle.points[(index + 1) % input.obstacle.points.length],
      ) <= radius)
  })
}

function spellLightingAffectsPoint(
  source: MapGeometrySpellLightingSource,
  point: MapGeometryPoint,
  map: BattleMap,
  elevationFeet = 0,
): boolean {
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const horizontalDistanceFeet = Math.hypot(point.x - source.point.x, point.y - source.point.y) /
    Math.max(1, map.gridSize) * feetPerCell
  const distanceFeet = Math.hypot(
    horizontalDistanceFeet,
    elevationFeet - source.elevationFeet,
  )
  return distanceFeet <= spellLightingRadius(source)
}

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
  const spellLighting = mapGeometrySpellLightingSources(input.map, input.geometry)
  if (input.geometry?.obstacles.some((obstacle) =>
    obstacle.magicalDarkness === true && mapGeometryPointInPolygon(input.point, obstacle.points) &&
      mapGeometryObstacleAffectsElevation(obstacle, pointElevation) &&
      !mapGeometryMagicalDarknessObstacleIsSuppressed({
        obstacle, map: input.map, geometry: input.geometry, spellLighting,
      }),
  ) || spellLighting.some((source) =>
    source.kind === 'magical-darkness' &&
      spellLightingAffectsPoint(source, input.point, input.map, pointElevation),
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
      fromElevationFeet: mapGeometryTokenElevation(input.geometry, source),
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
      fromElevationFeet: mapGeometryAbsoluteElevationAtPoint(input.geometry, point, source.elevationFeet),
      toElevationFeet: pointElevation,
      purpose: 'vision',
    })) continue
    if (distanceFeet <= source.brightRadiusFeet) return 'bright'
    result = 'dim'
  }
  for (const source of spellLighting) {
    if (
      source.kind !== 'light' ||
      !spellLightingAffectsPoint(source, input.point, input.map, pointElevation)
    ) continue
    const distanceFeet = Math.hypot(input.point.x - source.point.x, input.point.y - source.point.y) /
      gridSize * feetPerCell
    if (rayBlocked({
      geometry: input.geometry,
      from: source.point,
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
  /** Rendering-only override used to draw a specific sense band with the same wall clipping. */
  rangeOverrideFeet?: number
  worldMinute?: number
}): MapGeometryPoint[] {
  const geometry = input.geometry
  if (!geometry?.vision.enabled && !input.forceEnabled) return []
  const origin = { x: input.viewer.x, y: input.viewer.y }
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const profile = compileDnd5eEffectiveVisionProfile({
    token: input.viewer,
    fallbackRangeFeet: input.fallbackRangeFeet ??
      geometry?.vision.defaultRangeFeet ??
      DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  })
  const lightRangeFeet = campaignLightIsActive(input.viewer.lightSource, input.worldMinute ?? 0)
    ? (input.viewer.lightSource?.brightRadiusFeet ?? 0) + (input.viewer.lightSource?.dimRadiusFeet ?? 0)
    : 0
  // 地形遮罩使用正常视距；暗光、黑暗和场景光源在 LightingLayer 内表现。
  // 服务端仍会单独过滤未被照亮的生物，因此不会因地形可见而泄露隐藏 Token。
  const rangeFeet = Number.isFinite(input.rangeOverrideFeet)
    ? Math.max(0, input.rangeOverrideFeet!)
    : Math.max(
        profile.normalRangeFeet,
        profile.darkvisionRangeFeet,
        profile.darknessSightRangeFeet,
        profile.magicalDarknessSightRangeFeet,
        profile.blindsightRangeFeet,
        profile.truesightRangeFeet,
        lightRangeFeet,
      )
  if (rangeFeet <= 0) return []
  const radius = Math.max(1, rangeFeet / feetPerCell * Math.max(1, input.map.gridSize))
  const elevation = mapGeometryTokenElevation(geometry, input.viewer)
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
let runtimeCompiledGeometryByMapId = new Map<
  string,
  {
    geometry: MapGeometryState
    compiled: ReturnType<typeof compileGeometryCached>
  }
>()

/**
 * Runtime maps are immutable snapshots. Their compiled segment/index data is
 * installed together with the snapshot so hot movement and ray queries avoid
 * rebuilding the full geometry signature on every call.
 */
function runtimeCompiledGeometry(
  geometry: MapGeometryState | undefined,
): ReturnType<typeof compileGeometryCached> {
  if (geometry) {
    const runtime = runtimeCompiledGeometryByMapId.get(geometry.mapId)
    if (runtime?.geometry === geometry) return runtime.compiled
  }
  return compileGeometryCached(geometry)
}

export function setMapGeometryRuntime(maps: readonly MapGeometryState[]): void {
  runtimeGeometryByMapId = new Map(maps.map((map) => [map.mapId, map]))
  runtimeCompiledGeometryByMapId = new Map(maps.map((map) => [
    map.mapId,
    {
      geometry: map,
      compiled: compileGeometryCached(map),
    },
  ]))
}

export function mapGeometryRuntimeForMap(mapId: string): MapGeometryState | undefined {
  return runtimeGeometryByMapId.get(mapId)
}
