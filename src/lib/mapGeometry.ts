import { gasExcludedAt, gasExclusionVisionSegments } from '../rulesets/dnd5e/gasExclusion'
import {normalizeHeightPlane,planeHeight} from './heightPlane'
import { rectangularLightOrigin, rectangularLightCandidateOrigins, refineRectangularLightOrigin } from './rectangularLightOrigin'
import { MAP_SURFACE_MATERIALS, type MapSurfaceMaterial } from './mapSurfaceMaterials'
import { normalizeControlledWaterState } from '../../shared/controlled-water-state.mjs'
import { normalizeStructureStairPath, structureStairRayHit, structureStairBodyHit, type StructureStairPath } from '../../shared/structure-stair-path.mjs'
import { structureSolidBodyHit } from '../../shared/structure-solid-collision.mjs'
import {normalizeStructureLifetimes,type StructureLifetime} from '../../shared/structure-lifetime.mjs'
import {normalizeStructureCastingHistory,type StructureCastingHistory} from '../../shared/structure-casting-history.mjs'
import { dnd5eInitialSpaceAllowsPerception, clipDnd5eInitialSpaceVision } from '../rulesets/dnd5e/initialSpacePerception'
import { normalizeMagicDetectionBarrier } from './magicDetectionBarrier'
import { normalizeControlledFlameState, projectControlledFlameLight } from '../../shared/controlled-flame-state.mjs'
import { persistentAreaBlocksRay as sharedPersistentAreaBlocksRay } from '../../shared/persistent-area-ray.mjs'
import { persistentAreaHeightSlices } from '../../shared/persistent-area-columns.mjs'
import { groveVolumeOverlaps, groveCellVisionSegments, groveAreaFootprintOverlaps } from '../../shared/grove-volume.mjs'
import { normalizeGeometryDurability, geometryEntityDestroyed, type GeometryDurability } from '../../shared/map-geometry-durability.mjs'
import { isFlameLight, flameLightConcealed, type FlameLight, type FlameLightPoint } from '../../shared/flame-light-concealment.mjs'
import { stoneWallIntersects } from './stoneWallGeometry'
import { pillarBlocksMovement } from '../../shared/pillar-movement.mjs'
import { forceShellCrosses } from './forceShellGeometry'
import { forceShellOverlapsBody, forceShellSweptBoxOverlaps } from '../../shared/force-shell-geometry.mjs'
import type { BattleMap, Dnd5ePluginArea, Token } from '../store/maps'
import { fogCoversPoint, normalizeMapFog, type MapFogState } from './fogOfWar'
import { campaignLightIsActive, type CampaignLightSourceKind } from './campaignTime'
import type {
  Dnd5eMapEnvironment,
  Dnd5eMapWeather,
  Dnd5eOverheadSpace,
} from '../rulesets/dnd5e/environmentRules'
import {
  normalizeDnd5eArcaneLockStateV1,
  type Dnd5eArcaneLockStateV1,
} from '../rulesets/dnd5e/mapObjectState'
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
import { tokenOccupiedCellsAt, tokenCenterForAnchorCell, tokenFootprintCells } from './gridCombat'
import { dnd5eCombatTokenSide } from './opportunityAttacks'

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
  magicDetectionBarrier?: import('./magicDetectionBarrier').MagicDetectionBarrier
  /** DM-authored durability for this complete geometry entity; absent means unknown. */
  dnd5eDurability?: GeometryDurability
  blocksVision: boolean
  blocksMovement: boolean
  blocksLineOfEffect: boolean
}

export type MapGeometryWallMaterial = 'stone' | 'brick' | 'wood' | 'metal' | 'natural' | 'earth'

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
  /** True when magic, rather than mundane construction alone, conceals this secret door. */
  magicallyHidden?: boolean
  hinge?: MapGeometryDoorHinge
  swing?: MapGeometryDoorSwing
  interaction?: MapGeometryDoorInteraction
  /** Smallest physical gap through the closed opening, used by form-specific traversal. */
  passageGapInches?: number
  /** Room member ids that may receive this secret door in their geometry projection. */
  revealedToMemberIds?: string[]
  /** Host-owned magical lock state. Ordinary editor lockState remains the physical lock. */
  dnd5eArcaneLock?: Dnd5eArcaneLockStateV1
  createdAt: number
}

/**
 * Legacy and imported doors predate explicit physical-gap metadata. Treat an
 * unspecified ordinary door as having a narrow crack; DM-authored airtight
 * barriers persist an explicit zero instead.
 */
export const MAP_GEOMETRY_DEFAULT_DOOR_PASSAGE_GAP_INCHES = 1

export function mapGeometryDoorPassageGapInches(
  door: Pick<MapGeometryDoor, 'passageGapInches'>,
): number {
  return door.passageGapInches ?? MAP_GEOMETRY_DEFAULT_DOOR_PASSAGE_GAP_INCHES
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
  /** Smallest physical gap through bars/shutters/glass, used by form-specific traversal. */
  passageGapInches?: number
  createdAt: number
}

export type MapGeometryCover = 'none' | 'half' | 'three-quarters' | 'total'

export type MapGeometrySurfaceMaterial = MapSurfaceMaterial

export interface MapGeometryObstacle extends MapGeometryHeight, MapGeometryBlocking {
  /** Non-solid deposited material over an inclined surface; box heights bound it. */
  materialLayer?: {basePlane:import('./heightPlane').HeightPlane;depthFeet:number}
  controlledWater?: import('../rulesets/dnd5e/controlledWater').Dnd5eControlledWater
  stairPath?: StructureStairPath
  id: string
  kind: 'obstacle'
  label: string
  points: MapGeometryPoint[]
  cover: MapGeometryCover
  terrainCostMultiplier?: number
  /** Explicitly authored ground surface; absence never implies loose debris. */
  surfaceMaterial?: MapGeometrySurfaceMaterial
  /** Explicit Host classification; absence is unknown, not nonmagical. */
  materialMagic?: 'nonmagical' | 'magical'
  traversal?: 'ground' | 'climb' | 'swim'
  /** 多边形区域内可站立地面的绝对标高；与障碍物阻挡体积的底高分开。 */
  terrainElevationFeet?: number
  /** 由 DM 高度画笔创建的纯地形标高区域；不充当障碍物或掩护。 */
  terrainRegion?: boolean
  /** Host-authored local sky exposure, used only on non-solid terrain regions. */
  skyExposure?: 'open' | 'covered'
  /** 多边形内部压制非魔法光源；普通黑暗视觉无法看穿。 */
  magicalDarkness?: boolean
  darknessSpellLevel?: number
  createdAt: number
}

export interface MapGeometryLight {
  /** Original physical fire and temporary alterations; radii remain recoverable after reload. */
  controlledFlame?: import('../rulesets/dnd5e/controlledFlame').Dnd5ePhysicalFlame
  flame?: boolean
  flameProtected?: boolean
  flameSize?: 'torch-or-smaller' | 'larger'
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
export type MapGeometryTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'obstacle'
  | 'magical-darkness'
  | 'difficult-terrain'
  | 'elevation'
  | 'light'
  | 'delete'
export type MapGeometryEntityPatch = Partial<MapGeometryHeight & MapGeometryBlocking> & {
  controlledWater?: import('../rulesets/dnd5e/controlledWater').Dnd5eControlledWater
  controlledFlame?: import('../rulesets/dnd5e/controlledFlame').Dnd5ePhysicalFlame
  flame?: boolean
  flameProtected?: boolean
  flameSize?: 'torch-or-smaller' | 'larger'
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
  magicallyHidden?: boolean
  hinge?: MapGeometryDoorHinge
  swing?: MapGeometryDoorSwing
  interaction?: MapGeometryDoorInteraction
  passageGapInches?: number
  revealedToMemberIds?: string[]
  dnd5eArcaneLock?: Dnd5eArcaneLockStateV1
  cover?: MapGeometryCover
  terrainCostMultiplier?: number
  surfaceMaterial?: MapGeometrySurfaceMaterial
  materialMagic?: 'nonmagical' | 'magical'
  traversal?: 'ground' | 'climb' | 'swim'
  terrainElevationFeet?: number
  terrainRegion?: boolean
  skyExposure?: 'open' | 'covered'
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
  structureLifetimes?: StructureLifetime[]
  structureCastingHistory?: StructureCastingHistory[]
  /** Scene magical darkness uses the same ordered cover/reveal strokes as fog. */
  darknessFog?: MapFogState
  mapId: string
  walls: MapGeometryWall[]
  doors: MapGeometryDoor[]
  windows?: MapGeometryWindow[]
  obstacles: MapGeometryObstacle[]
  lights?: MapGeometryLight[]
  vision: MapGeometryVisionSettings
  environment?: Dnd5eMapEnvironment
  /** Defaults to ordinary weather; storm powers Call Lightning's printed bonus die. */
  weather?: Dnd5eMapWeather
  /** Defaults to open/unmarked; confined means no visible volume can hold a Call Lightning cloud. */
  overheadSpace?: Dnd5eOverheadSpace
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

/** The physical leaf shown on the map, shared by rendering and interaction reach. */
export function mapGeometryDoorLeafPoints(door: MapGeometryDoor): [MapGeometryPoint, MapGeometryPoint] {
  const hingeIndex = door.hinge === 'end' ? 1 : 0
  const hinge = door.points[hingeIndex]
  const end = door.points[hingeIndex === 0 ? 1 : 0]
  const sign = door.swing === 'counterclockwise' ? -1 : 1
  return [hinge, mapGeometryDoorOpenState(door) === 'open'
    ? { x: hinge.x - (end.y - hinge.y) * sign, y: hinge.y + (end.x - hinge.x) * sign }
    : end]
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
  if (raw.flame != null && typeof raw.flame !== 'boolean') return false
  if (raw.flameProtected != null && typeof raw.flameProtected !== 'boolean') return false
  if (raw.flameSize != null && !['torch-or-smaller', 'larger'].includes(raw.flameSize as string)) return false
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
  const magicDetectionBarrier = normalizeMagicDetectionBarrier(raw.magicDetectionBarrier)
  if (raw.magicDetectionBarrier != null && !magicDetectionBarrier) return undefined
  const durability = normalizeGeometryDurability(raw.dnd5eDurability)
  if (raw.dnd5eDurability != null && !durability) return undefined
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
    ...(durability ? { dnd5eDurability: durability } : {}),
    ...(magicDetectionBarrier ? { magicDetectionBarrier } : {}),
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
    const controlledFlame = normalizeControlledFlameState(raw.controlledFlame)
    if (raw.controlledFlame != null && (!controlledFlame || controlledFlame.id !== raw.id)) return undefined
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
      controlledFlame,
      brightRadiusFeet: raw.brightRadiusFeet, dimRadiusFeet: raw.dimRadiusFeet,
      color: raw.color.toLowerCase(), elevationFeet: raw.elevationFeet, createdAt: raw.createdAt,
      flame: typeof raw.flame === 'boolean' ? raw.flame : undefined,
      flameProtected: typeof raw.flameProtected === 'boolean' ? raw.flameProtected : undefined,
      flameSize: raw.flameSize === 'torch-or-smaller' || raw.flameSize === 'larger' ? raw.flameSize : undefined,
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
      (raw.material != null && !['stone', 'brick', 'wood', 'metal', 'natural', 'earth'].includes(String(raw.material))) ||
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
      (raw.magicallyHidden != null && typeof raw.magicallyHidden !== 'boolean') ||
      (raw.hinge != null && !['start', 'end'].includes(String(raw.hinge))) ||
      (raw.swing != null && !['clockwise', 'counterclockwise'].includes(String(raw.swing)))
      || (raw.passageGapInches != null && !finite(raw.passageGapInches, 0, 120))
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
    const dnd5eArcaneLock = normalizeDnd5eArcaneLockStateV1(raw.dnd5eArcaneLock)
    if (raw.dnd5eArcaneLock != null && !dnd5eArcaneLock) return undefined
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
      ...(raw.magicallyHidden === true ? { magicallyHidden: true } : {}),
      hinge: (raw.hinge as MapGeometryDoorHinge | undefined) ?? 'start',
      swing: (raw.swing as MapGeometryDoorSwing | undefined) ?? 'clockwise',
      ...attachment,
      ...(interaction ? { interaction } : {}),
      ...(raw.passageGapInches != null ? { passageGapInches: raw.passageGapInches as number } : {}),
      ...(Array.isArray(raw.revealedToMemberIds)
        ? { revealedToMemberIds: [...new Set(raw.revealedToMemberIds as string[])] }
        : {}),
      ...(dnd5eArcaneLock ? { dnd5eArcaneLock } : {}),
    }
  }
  if (raw.kind === 'window') {
    const points = normalizePoints(raw.points, 2, 2)
    const attachment = normalizeWallAttachment(raw)
    if (
      !points || !attachment || !['glass', 'bars', 'shutters', 'opening'].includes(String(raw.windowType)) ||
      (raw.windowState != null && !['closed', 'open', 'broken'].includes(String(raw.windowState))) ||
      (raw.cover != null && !['none', 'half', 'three-quarters', 'total'].includes(String(raw.cover))) ||
      (raw.passageGapInches != null && !finite(raw.passageGapInches, 0, 120))
    ) return undefined
    return {
      ...common,
      ...attachment,
      kind: 'window',
      points: [points[0], points[1]],
      windowType: raw.windowType as MapGeometryWindowType,
      windowState: (raw.windowState as MapGeometryWindowState | undefined) ?? 'closed',
      cover: (raw.cover as MapGeometryCover | undefined) ?? (raw.blocksLineOfEffect ? 'total' : 'half'),
      ...(raw.passageGapInches != null ? { passageGapInches: raw.passageGapInches as number } : {}),
    }
  }
  if (raw.kind === 'obstacle') {
    const controlledWater = raw.controlledWater == null ? undefined : normalizeControlledWaterState(raw.controlledWater)
    if (raw.controlledWater != null && (!controlledWater || controlledWater.id !== raw.id)) return undefined
    const points = normalizePoints(raw.points, 3)
    const stairPath = raw.stairPath == null ? undefined : normalizeStructureStairPath(raw.stairPath)
    if (raw.stairPath != null && !stairPath) return undefined
    let materialLayer:MapGeometryObstacle['materialLayer']
    if(raw.materialLayer!=null){
      const layer=raw.materialLayer as Record<string,unknown>,basePlane=normalizeHeightPlane(layer?.basePlane)
      if(!basePlane||!finite(layer.depthFeet,0.000001,40)||!points||raw.surfaceMaterial!=='mud'||raw.materialMagic!=='magical'||
        raw.blocksMovement||raw.blocksVision||raw.blocksLineOfEffect||raw.stairPath!=null||raw.terrainElevationFeet!=null||
        Object.keys(layer).some(key=>!['basePlane','depthFeet'].includes(key)))return undefined
      const heights=points.map(point=>planeHeight(basePlane,point)),min=Math.min(...heights),max=Math.max(...heights)
      if(min< -1000||max+Number(layer.depthFeet)>10000||Math.abs(common.baseHeightFeet-min)>1e-6||
        Math.abs(common.heightFeet-(max-min+Number(layer.depthFeet)))>1e-6)return undefined
      materialLayer={basePlane,depthFeet:Number(layer.depthFeet)}
    }
    if (!points || !['none', 'half', 'three-quarters', 'total'].includes(String(raw.cover)) ||
      (raw.surfaceMaterial != null && !(MAP_SURFACE_MATERIALS as readonly string[]).includes(String(raw.surfaceMaterial))) ||
      (raw.materialMagic != null && (typeof raw.materialMagic !== 'string' || !['nonmagical', 'magical'].includes(raw.materialMagic))) ||
      (raw.terrainCostMultiplier != null && !finite(raw.terrainCostMultiplier, 1, 10)) ||
      (raw.traversal != null && !['ground', 'climb', 'swim'].includes(String(raw.traversal))) ||
      (raw.terrainElevationFeet != null && !finite(raw.terrainElevationFeet, -1_000, 10_000)) ||
      (raw.terrainRegion != null && typeof raw.terrainRegion !== 'boolean') ||
      (raw.skyExposure != null && (raw.terrainRegion !== true || !['open', 'covered'].includes(String(raw.skyExposure)))) ||
      (raw.magicalDarkness != null && typeof raw.magicalDarkness !== 'boolean') ||
      (raw.darknessSpellLevel != null && !finite(raw.darknessSpellLevel, 0, 9))) return undefined
    return {
      ...common, kind: 'obstacle', points, cover: raw.cover as MapGeometryCover,
      ...(controlledWater ? { controlledWater } : {}),
      ...(stairPath ? { stairPath } : {}),
      ...(materialLayer ? {materialLayer} : {}),
      ...(raw.surfaceMaterial != null ? { surfaceMaterial: raw.surfaceMaterial as MapGeometrySurfaceMaterial } : {}),
      ...(raw.materialMagic != null ? { materialMagic: raw.materialMagic as 'nonmagical' | 'magical' } : {}),
      ...(raw.terrainCostMultiplier != null ? { terrainCostMultiplier: raw.terrainCostMultiplier as number } : {}),
      ...(raw.traversal != null ? { traversal: raw.traversal as MapGeometryObstacle['traversal'] } : {}),
      ...(raw.terrainElevationFeet != null ? { terrainElevationFeet: raw.terrainElevationFeet as number } : {}),
      ...(raw.terrainRegion === true ? { terrainRegion: true } : {}),
      ...(raw.skyExposure != null ? { skyExposure: raw.skyExposure as 'open' | 'covered' } : {}),
      ...(raw.magicalDarkness === true ? { magicalDarkness: true } : {}),
      ...(raw.darknessSpellLevel != null ? { darknessSpellLevel: raw.darknessSpellLevel as number } : {}),
    }
  }
  return undefined
}

export function normalizeMapGeometry(value: unknown): MapGeometryState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.darknessFog != null && (!normalizeMapFog(raw.darknessFog) || (raw.darknessFog as MapFogState).mapId !== raw.mapId)) return undefined
  const structureLifetimes=raw.structureLifetimes==null?undefined:normalizeStructureLifetimes(raw.structureLifetimes)
  if(raw.structureLifetimes!=null&&!structureLifetimes)return undefined
  const structureCastingHistory=raw.structureCastingHistory==null?undefined:normalizeStructureCastingHistory(raw.structureCastingHistory)
  if(raw.structureCastingHistory!=null&&!structureCastingHistory)return undefined
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
    ...(structureLifetimes?{structureLifetimes}:{}),
    ...(structureCastingHistory?{structureCastingHistory}:{}),
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
    environment: ['normal', 'outdoors', 'indoors', 'underground', 'underwater'].includes(String(raw.environment))
      ? raw.environment as Dnd5eMapEnvironment
      : 'normal',
    weather: raw.weather === 'storm' ? 'storm' : 'normal',
    ...(raw.darknessFog != null ? { darknessFog: normalizeMapFog(raw.darknessFog) } : {}),
    overheadSpace: raw.overheadSpace === 'confined' ? 'confined' : 'open',
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

/**
 * A zero-height, ground traversal cost region is painted onto the terrain
 * surface. It must not become a competing terrain-height region: legacy maps
 * saved the sampled height in `terrainElevationFeet`, which flattened a single
 * difficult-terrain polygon when it crossed platforms at different heights.
 */
export function mapGeometryObstacleIsGroundSurfaceOverlay(obstacle: MapGeometryObstacle): boolean {
  return obstacle.terrainRegion !== true &&
    obstacle.traversal === 'ground' &&
    (obstacle.terrainCostMultiplier ?? 1) > 1 &&
    obstacle.heightFeet <= 0
}

/** 后绘制的区域覆盖先绘制的区域，便于 DM 用较小多边形修正局部标高。 */
export function mapGeometryTerrainElevationAtPoint(
  geometry: MapGeometryState | undefined,
  point: MapGeometryPoint,
  fallbackElevationFeet = 0,
): number {
  let elevation = fallbackElevationFeet
  for (const obstacle of geometry?.obstacles ?? []) {
    if (geometryEntityDestroyed(obstacle)) continue
    if (mapGeometryObstacleIsGroundSurfaceOverlay(obstacle)) continue
    if (obstacle.terrainElevationFeet == null || !mapGeometryPointInPolygon(point, obstacle.points)) continue
    elevation = obstacle.terrainElevationFeet
  }
  return elevation
}

/** Last explicitly painted surface at the current terrain elevation wins. */
export function mapGeometrySurfaceMaterialAtPoint(geometry: MapGeometryState | undefined, point: MapGeometryPoint): MapGeometrySurfaceMaterial | undefined {
  return mapGeometryGroundMaterialRegionAt(geometry, point)?.surfaceMaterial
}

function mapGeometryGroundMaterialRegionAt(geometry: MapGeometryState | undefined, point: MapGeometryPoint): MapGeometryObstacle | undefined {
  const ground = mapGeometryTerrainElevationAtPoint(geometry, point)
  for (let index = (geometry?.obstacles.length ?? 0) - 1; index >= 0; index -= 1) {
    const region = geometry!.obstacles[index]
    if (!region.surfaceMaterial || geometryEntityDestroyed(region) || !mapGeometryPointInPolygon(point, region.points)) continue
    const elevation = mapGeometryObstacleIsGroundSurfaceOverlay(region) ? ground : region.terrainElevationFeet ?? 0
    if (Math.abs(elevation - ground) > 1e-7) continue
    return region
  }
  return undefined
}

/** Horizontal exposed material at an explicitly chosen height, including solid tops. */
export function mapGeometrySurfaceMaterialAtElevation(geometry: MapGeometryState | undefined, point: MapGeometryPoint, elevationFeet: number): MapGeometrySurfaceMaterial | undefined {
  if(!Number.isFinite(elevationFeet))return undefined
  if(elevationFeet<mapGeometryTerrainElevationAtPoint(geometry,point)-1e-4)return undefined
  const solids=(geometry?.obstacles??[]).filter(region=>!geometryEntityDestroyed(region)&&region.terrainRegion!==true&&
    region.heightFeet>0&&mapGeometryPointInPolygon(point,region.points))
  const base=(region:MapGeometryObstacle)=>region.materialLayer?planeHeight(region.materialLayer.basePlane,point):region.baseHeightFeet
  const topAt=(region:MapGeometryObstacle)=>base(region)+(region.materialLayer?.depthFeet??region.heightFeet)
  if(solids.some(region=>elevationFeet>=base(region)-1e-4&&elevationFeet<topAt(region)-1e-4))return undefined
  const top=[...solids].reverse().find(region=>Math.abs(topAt(region)-elevationFeet)<=1e-4)
  if(top)return top.surfaceMaterial
  return Math.abs(mapGeometryTerrainElevationAtPoint(geometry,point)-elevationFeet)<=1e-4
    ? mapGeometrySurfaceMaterialAtPoint(geometry,point) : undefined
}

/** Split a travel segment at authored boundaries so even thin surface strips are visited. */
export function mapGeometryPathTouchesSurface(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  materials: readonly MapGeometrySurfaceMaterial[]
  /** Omit both elevations for a path following the ground; provide both for airborne travel. */
  fromElevationFeet?: number
  toElevationFeet?: number
}): boolean {
  const airborne = input.fromElevationFeet != null || input.toElevationFeet != null
  if (airborne && (!Number.isFinite(input.fromElevationFeet) || !Number.isFinite(input.toElevationFeet))) return false
  if (![input.from.x, input.from.y, input.to.x, input.to.y].every(Number.isFinite)) return false
  const pointAt = (t: number) => ({x: input.from.x + (input.to.x-input.from.x)*t, y: input.from.y + (input.to.y-input.from.y)*t})
  const cuts = new Set([0,1])
  for (const region of input.geometry?.obstacles ?? []) {
    if (geometryEntityDestroyed(region)) continue
    if (!region.surfaceMaterial && region.terrainElevationFeet == null) continue
    for (let i=0;i<region.points.length;i++) {
      const t=intersectionParameter(input.from,input.to,region.points[i],region.points[(i+1)%region.points.length])
      if(t != null && t>0 && t<1) cuts.add(t)
    }
  }
  const ordered=[...cuts].sort((a,b)=>a-b)
  for(let i=1;i<ordered.length;i++) {
    const lower=ordered[i-1],upper=ordered[i],sample=pointAt((lower+upper)/2)
    const material=mapGeometrySurfaceMaterialAtPoint(input.geometry,sample)
    if(!material || !input.materials.includes(material)) continue
    if(!airborne) return true
    const ground=mapGeometryTerrainElevationAtPoint(input.geometry,sample)
    const dz=input.toElevationFeet!-input.fromElevationFeet!
    const start=input.fromElevationFeet!+dz*lower,end=input.fromElevationFeet!+dz*upper
    if(Math.min(start,end)<=ground+1e-7 && Math.max(start,end)>=ground-1e-7) return true
  }
  return false
}

/** Full square footprint swept along a straight path, respecting layered surface paint. */
export function mapGeometryFootprintTouchesSurface(input: Parameters<typeof mapGeometryPathTouchesSurface>[0] & {
  halfSizePixels: number
}): boolean {
  const {from, to, halfSizePixels: half} = input
  if (![from.x, from.y, to.x, to.y, half].every(Number.isFinite) || half <= 0) return false
  const airborne = input.fromElevationFeet != null || input.toElevationFeet != null
  if (airborne && (!Number.isFinite(input.fromElevationFeet) || !Number.isFinite(input.toElevationFeet))) return false
  const regions = (input.geometry?.obstacles ?? []).filter(region => !geometryEntityDestroyed(region) &&
    (region.surfaceMaterial != null || region.terrainElevationFeet != null))
  if (!regions.some(region => region.surfaceMaterial && input.materials.includes(region.surfaceMaterial))) return false
  const rectangle = (t: number): MapGeometryPoint[] => {
    const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t
    return [{x:x-half,y:y-half},{x:x+half,y:y-half},{x:x+half,y:y+half},{x:x-half,y:y+half}]
  }
  const hull = (points: MapGeometryPoint[]): MapGeometryPoint[] => {
    const sorted = points.sort((a,b) => a.x-b.x || a.y-b.y)
    const side = (list: MapGeometryPoint[]) => {
      const result: MapGeometryPoint[] = []
      for (const point of list) {
        while (result.length > 1 && cross(subtract(result[result.length-1],result[result.length-2]), subtract(point,result[result.length-1])) <= 0) result.pop()
        result.push(point)
      }
      return result.slice(0,-1)
    }
    return [...side(sorted), ...side([...sorted].reverse())]
  }
  // A changing base height touches each piecewise-flat ground height at one instant.
  // A level path instead sweeps the convex hull of its start/end squares.
  const dz = airborne ? input.toElevationFeet! - input.fromElevationFeet! : 0
  const surfaces: {polygon: MapGeometryPoint[]; elevation?: number}[] = []
  if (airborne && Math.abs(dz) > 1e-9) {
    for (const elevation of new Set([0, ...regions.flatMap(region => region.terrainElevationFeet == null ? [] : [region.terrainElevationFeet])])) {
      const t = (elevation - input.fromElevationFeet!) / dz
      if (t >= 0 && t <= 1) surfaces.push({polygon:rectangle(t),elevation})
    }
  } else surfaces.push({polygon:hull([...rectangle(0),...rectangle(1)]),elevation:airborne ? input.fromElevationFeet : undefined})

  for (const {polygon, elevation} of surfaces) {
    const minX = Math.min(...polygon.map(p=>p.x)), maxX = Math.max(...polygon.map(p=>p.x))
    const minY = Math.min(...polygon.map(p=>p.y)), maxY = Math.max(...polygon.map(p=>p.y))
    const edges = [polygon,...regions.map(region=>region.points)].flatMap(points => points.map((a,i) => ({a,b:points[(i+1)%points.length]})))
      .filter(({a,b}) => Math.max(a.x,b.x)>=minX && Math.min(a.x,b.x)<=maxX && Math.max(a.y,b.y)>=minY && Math.min(a.y,b.y)<=maxY)
    // Vertical decomposition of all polygon boundaries preserves tiny patches and
    // paint intersections without a sampling grid or a bounding-box approximation.
    const cuts = new Set([minX,maxX])
    for (const {a,b} of edges) for (const p of [a,b]) if (p.x>minX && p.x<maxX) cuts.add(p.x)
    for (let i=0;i<edges.length;i++) for (let j=i+1;j<edges.length;j++) {
      const first=edges[i], second=edges[j]
      const t=intersectionParameter(first.a,first.b,second.a,second.b)
      if (t == null) continue
      const x=first.a.x+(first.b.x-first.a.x)*t
      if(x>minX && x<maxX) cuts.add(x)
    }
    const xs=[...cuts].sort((a,b)=>a-b)
    for(let i=1;i<xs.length;i++) {
      const x=(xs[i-1]+xs[i])/2, ys=new Set([minY,maxY])
      for(const {a,b} of edges) {
        if(x<=Math.min(a.x,b.x) || x>=Math.max(a.x,b.x)) continue
        const y=a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)
        if(y>minY && y<maxY) ys.add(y)
      }
      const ordered=[...ys].sort((a,b)=>a-b)
      for(let j=1;j<ordered.length;j++) {
        const point={x,y:(ordered[j-1]+ordered[j])/2}
        if(!mapGeometryPointInPolygon(point,polygon)) continue
        if(elevation != null && Math.abs(mapGeometryTerrainElevationAtPoint(input.geometry,point)-elevation)>1e-7) continue
        const material=mapGeometrySurfaceMaterialAtPoint(input.geometry,point)
        if(material && input.materials.includes(material)) return true
      }
    }
  }
  return false
}

/** Samples every authored terrain partition inside a square token footprint. */
export function mapGeometryFootprintTerrainSamples(input: {
  geometry?: MapGeometryState; at: MapGeometryPoint; halfSizePixels: number
  /** Optional exact footprint, for rotated or clipped physical volumes. */
  footprint?: readonly MapGeometryPoint[]
  surfaceElevationFeet?: number
  /** Opt-in ground-material provenance; unknown remains unknown. */
  includeMaterialMagic?: true
}): Array<{ elevationFeet: number; material?: MapGeometrySurfaceMaterial; materialMagic?: MapGeometryObstacle['materialMagic'] }> {
  const { at, halfSizePixels: half } = input
  if (![at.x, at.y, half].every(Number.isFinite) || half <= 0) return []
  const footprint = input.footprint
  if (footprint && (footprint.length < 3 || footprint.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)))) return []
  const minX = footprint ? Math.min(...footprint.map(p=>p.x)) : at.x-half
  const maxX = footprint ? Math.max(...footprint.map(p=>p.x)) : at.x+half
  const minY = footprint ? Math.min(...footprint.map(p=>p.y)) : at.y-half
  const maxY = footprint ? Math.max(...footprint.map(p=>p.y)) : at.y+half
  const regions = (input.geometry?.obstacles ?? []).filter(region => !geometryEntityDestroyed(region) &&
    (region.surfaceMaterial != null || region.terrainElevationFeet != null || (input.surfaceElevationFeet!=null&&region.heightFeet>0)))
  const polygons = [...regions.map(region=>region.points), ...(footprint ? [footprint] : [])]
  const edges = polygons.flatMap(points => points.map((a, index) => ({ a, b: points[(index + 1) % points.length] })))
    .filter(({ a, b }) => Math.max(a.x, b.x) >= minX && Math.min(a.x, b.x) <= maxX &&
      Math.max(a.y, b.y) >= minY && Math.min(a.y, b.y) <= maxY)
  const cuts = new Set([minX, maxX])
  for (const { a, b } of edges) {
    for (const point of [a, b]) if (point.x > minX && point.x < maxX) cuts.add(point.x)
    for (const y of [minY, maxY]) if (a.y !== b.y) {
      const t = (y - a.y) / (b.y - a.y), x = a.x + (b.x - a.x) * t
      if (t > 0 && t < 1 && x > minX && x < maxX) cuts.add(x)
    }
  }
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const first = edges[i], second = edges[j]
    const t = intersectionParameter(first.a, first.b, second.a, second.b)
    if (t == null) continue
    const x = first.a.x + (first.b.x - first.a.x) * t
    if (x > minX && x < maxX) cuts.add(x)
  }
  const xs = [...cuts].sort((a, b) => a - b)
  const samples = new Map<string, { elevationFeet: number; material?: MapGeometrySurfaceMaterial; materialMagic?: MapGeometryObstacle['materialMagic'] }>()
  for (let i = 1; i < xs.length; i++) {
    const x = (xs[i - 1] + xs[i]) / 2, ys = new Set([minY, maxY])
    for (const { a, b } of edges) {
      if (x <= Math.min(a.x, b.x) || x >= Math.max(a.x, b.x)) continue
      const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)
      if (y > minY && y < maxY) ys.add(y)
    }
    const ordered = [...ys].sort((a, b) => a - b)
    for (let j = 1; j < ordered.length; j++) {
      const point = { x, y: (ordered[j - 1] + ordered[j]) / 2 }
      if (footprint && !mapGeometryPointInPolygon(point, footprint)) continue
      const elevationFeet = input.surfaceElevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, point)
      const material = input.surfaceElevationFeet==null ? mapGeometrySurfaceMaterialAtPoint(input.geometry, point)
        : mapGeometrySurfaceMaterialAtElevation(input.geometry,point,input.surfaceElevationFeet)
      const materialMagic = input.includeMaterialMagic && input.surfaceElevationFeet == null
        ? mapGeometryGroundMaterialRegionAt(input.geometry,point)?.materialMagic : undefined
      samples.set(`${elevationFeet}:${material ?? ''}:${materialMagic ?? ''}`, { elevationFeet, material,
        ...(materialMagic ? {materialMagic} : {}) })
    }
  }
  return [...samples.values()]
}

/** Exact first contact with the authored, piecewise-flat ground along a 3D ray. */
export function mapGeometryTerrainPathBands(input:{geometry?:MapGeometryState;from:MapGeometryPoint;to:MapGeometryPoint}):Array<{fromT:number;toT:number;elevationFeet:number}>{
  const cuts=new Set([0,1])
  for(const region of input.geometry?.obstacles??[]){
    if(region.terrainElevationFeet==null||geometryEntityDestroyed(region)||mapGeometryObstacleIsGroundSurfaceOverlay(region))continue
    for(let i=0;i<region.points.length;i++){
      const t=intersectionParameter(input.from,input.to,region.points[i],region.points[(i+1)%region.points.length])
      if(t!=null&&t>0&&t<1)cuts.add(t)
    }
  }
  const ordered=[...cuts].sort((a,b)=>a-b)
  return ordered.slice(1).map((toT,i)=>{
    const fromT=ordered[i],t=(fromT+toT)/2
    return {fromT,toT,elevationFeet:mapGeometryTerrainElevationAtPoint(input.geometry,{x:input.from.x+(input.to.x-input.from.x)*t,y:input.from.y+(input.to.y-input.from.y)*t})}
  })
}

/** Exact first contact with the authored, piecewise-flat ground along a 3D ray. */
export function mapGeometryTerrainRayImpact(input: {
  geometry?: MapGeometryState; from: MapGeometryPoint; to: MapGeometryPoint
  fromElevationFeet: number; toElevationFeet: number
}): { t: number; elevationFeet: number; entityId?: string } | undefined {
  const regions = (input.geometry?.obstacles ?? []).filter(region =>
    region.terrainElevationFeet != null && !geometryEntityDestroyed(region) && !mapGeometryObstacleIsGroundSurfaceOverlay(region))
  const pointAt = (t: number) => ({ x: input.from.x + (input.to.x - input.from.x) * t, y: input.from.y + (input.to.y - input.from.y) * t })
  const dz = input.toElevationFeet - input.fromElevationFeet
  const cuts = new Set([0, 1])
  for (const region of regions) for (let index = 0; index < region.points.length; index++) {
    const t = intersectionParameter(input.from, input.to, region.points[index], region.points[(index + 1) % region.points.length])
    if (t != null && t > 0 && t < 1) cuts.add(t)
  }
  const ordered = [...cuts].sort((a, b) => a - b)
  for (let index = 1; index < ordered.length; index++) {
    const lower = ordered[index - 1], upper = ordered[index], sample = pointAt((lower + upper) / 2)
    const region = [...regions].reverse().find(candidate => mapGeometryPointInPolygon(sample, candidate.points))
    const ground = region?.terrainElevationFeet ?? 0
    const startHeight = input.fromElevationFeet + dz * lower
    if (startHeight < ground - 1e-9 || (dz < 0 && startHeight <= ground)) return { t: lower, elevationFeet: ground, entityId: region?.id }
    if (dz < 0) {
      const t = (ground - input.fromElevationFeet) / dz
      if (t >= lower && t <= upper) return { t, elevationFeet: ground, entityId: region?.id }
    }
  }
  const ground = mapGeometryTerrainElevationAtPoint(input.geometry, input.to)
  if (input.toElevationFeet < ground - 1e-9) {
    const region = [...regions].reverse().find(candidate => mapGeometryPointInPolygon(input.to, candidate.points))
    return { t: 1, elevationFeet: ground, entityId: region?.id }
  }
  return undefined
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

function persistentAreaOverlapsHeight(
  geometry: MapGeometryState | undefined,
  map: Pick<BattleMap, 'tokens'>,
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number],
  elevationFeet: number,
  entityHeightFeet: number,
): boolean {
  if (!area.vertical || area.vertical.mode === 'ground') return true
  const anchorToken = area.anchorMode === 'source-token' || area.anchorMode === 'target-token' || area.anchorMode === 'effect-token'
    ? map.tokens.find((token) => token.id === (area.anchorTokenId ?? area.sourceTokenId))
    : undefined
  const base = anchorToken && Number.isFinite(area.vertical.anchorOffsetFeet)
    ? mapGeometryTokenElevation(geometry, anchorToken) + Number(area.vertical.anchorOffsetFeet)
    : area.vertical.baseElevationFeet
  return overlapsHeight(base, area.vertical.heightFeet, elevationFeet, entityHeightFeet)
}

function canonicalPersistentAreaCreatureType(value: string): string {
  const type = value.trim().toLowerCase()
  if (type === 'construct' || type.includes('构装')) return 'construct'
  if (type === 'undead' || type.includes('亡灵') || type.includes('不死')) return 'undead'
  if (type === 'aberration' || type.includes('异怪')) return 'aberration'
  if (type === 'celestial' || type.includes('天界')) return 'celestial'
  if (type === 'elemental' || type.includes('元素')) return 'elemental'
  if (type === 'fey' || type.includes('精类') || type.includes('妖精')) return 'fey'
  if (type === 'fiend' || type.includes('邪魔')) return 'fiend'
  if (type === 'humanoid' || type.includes('类人生物')) return 'humanoid'
  return type
}

function hallowAdditionalEffectAffectsToken(
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number],
  token: Token,
  map: BattleMap,
): boolean {
  const hallow = area.hallow
  if (!hallow) return false
  if (hallow.effectScope === 'all') return true
  const source = map.tokens.find((candidate) => candidate.id === area.sourceTokenId)
  if (!source) return false
  if (hallow.effectScope === 'allies') {
    return dnd5eCombatTokenSide(source) === dnd5eCombatTokenSide(token)
  }
  if (hallow.effectScope === 'enemies') {
    const sourceSide = dnd5eCombatTokenSide(source)
    const targetSide = dnd5eCombatTokenSide(token)
    return !!sourceSide && !!targetSide && sourceSide !== targetSide
  }
  const tokenTypes = new Set([
    ...(token.creatureTypes ?? []).map(canonicalPersistentAreaCreatureType),
    ...(token.type === 'player' ? ['humanoid'] : []),
  ])
  return !!hallow.affectedCreatureType && tokenTypes.has(hallow.affectedCreatureType)
}

function persistentAreaEffectiveBlocking(
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number],
) {
  if (area.blocking) return area.blocking
  // Wind Wall gained movement blocking after persistent spell areas had
  // already shipped. Treat an older in-memory or saved area as the current
  // declaration immediately instead of waiting for a later reconciliation
  // pass to copy the new field onto the area.
  if (area.windBarrier || (area.sourceKind === 'core-spell' && area.coreSpellId === 'wind-wall')) {
    return { movement: true, movementMode: 'boundary' as const }
  }
  return undefined
}

function persistentAreaBlockingAffectsToken(
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number],
  token: Token,
  context?: {
    geometry?: MapGeometryState
    elevationFeet?: number
  },
): boolean {
  const blocking = persistentAreaEffectiveBlocking(area)
  if (!blocking || (blocking.excludeSourceToken && token.id === area.sourceTokenId)) return false
  if(blocking.restrictedTokenIds && !blocking.restrictedTokenIds.includes(token.id))return false
  if (area.windBarrier || (area.sourceKind === 'core-spell' && area.coreSpellId === 'wind-wall')) {
    if (area.excludedTargetIds?.includes(token.id)) return false
    const isGaseous = token.dnd5eCombatState?.activeEffects?.some((effect) =>
      !(effect.suspendedBy?.length) &&
      (
        effect.source.rulesId === 'gaseous-form' ||
        effect.definitionId === 'gaseous-form' ||
        effect.definitionId.endsWith(':gaseous-form')
      )) === true
    const sizeRank = ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[
      token.creatureSize ?? '中型'
    ]
    const elevationFeet = context?.elevationFeet ?? token.elevationFeet ?? 0
    const groundElevationFeet = mapGeometryTerrainElevationAtPoint(context?.geometry, token)
    const isSmallAirborne = sizeRank <= 1 && elevationFeet > groundElevationFeet + 1e-4
    if (!isGaseous && !isSmallAirborne) return false
  }
  if (
    blocking.entryPermission === 'occupants-at-creation' &&
    blocking.authorizedTokenIds?.includes(token.id)
  ) return false
  const tokenTypes = new Set([
    ...(token.creatureTypes ?? []).map((type) => canonicalPersistentAreaCreatureType(type)),
    ...(token.type === 'player' ? ['humanoid'] : []),
  ])
  const included = blocking.includedCreatureTypes?.map(canonicalPersistentAreaCreatureType)
  if (included?.length && !included.some((type) => tokenTypes.has(type))) return false
  const excluded = blocking.excludedCreatureTypes?.map(canonicalPersistentAreaCreatureType)
  if (excluded?.some((type) => tokenTypes.has(type))) return false
  return true
}

function persistentAreaSuppressesMappedBarrierAt(input: {
  geometry?: MapGeometryState
  map: Pick<BattleMap, 'gridSize' | 'tokens'> &
    Partial<Pick<BattleMap, 'gridOffsetX' | 'gridOffsetY' | 'dnd5ePluginAreas'>>
  point: MapGeometryPoint
  elevationFeet: number
  entityHeightFeet: number
  requireFullHeight?: boolean
}): boolean {
  const gridSize = Math.max(1, input.map.gridSize)
  const offsetX = input.map.gridOffsetX ?? 0
  const offsetY = input.map.gridOffsetY ?? 0
  const key = `${Math.floor((input.point.x - offsetX) / gridSize)}:${Math.floor((input.point.y - offsetY) / gridSize)}`
  return (input.map.dnd5ePluginAreas ?? []).some((area) =>
    area.blocking?.suppressesMappedBarriers === true &&
    area.cells.some((cell) => `${cell.col}:${cell.row}` === key) &&
    (input.requireFullHeight === true
      ? persistentAreaOverlapsHeight(input.geometry,input.map,area,input.elevationFeet+1e-6,0) &&
        persistentAreaOverlapsHeight(input.geometry,input.map,area,input.elevationFeet+input.entityHeightFeet-1e-6,0)
      : persistentAreaOverlapsHeight(
      input.geometry, input.map, area, input.elevationFeet, input.entityHeightFeet,
    )))
}

function tokenOverlapsPersistentAreaCellsAt(input: {
  map: BattleMap
  token: Token
  at: MapGeometryPoint
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number]
  elevationFeet?: number
  geometry?: MapGeometryState
}): boolean {
  if (input.area.groveVolume) {
    const bottom = input.elevationFeet ?? mapGeometryTokenElevation(input.geometry, { ...input.token, ...input.at })
    const height = Math.max(5, Math.max(1, input.token.size) * 5)
    const vertical = input.area.vertical
    const base = vertical?.mode === 'volume' ? Math.max(bottom, vertical.baseElevationFeet) : bottom
    const top = vertical?.mode === 'volume' ? Math.min(bottom + height, vertical.baseElevationFeet + vertical.heightFeet) : bottom + height
    if (top <= base) return false
    return groveAreaFootprintOverlaps(input.area.groveVolume, input.area.cells, input.map, input.at,
      tokenFootprintCells(input.token) * input.map.gridSize / 2, base, top - base)
  }
  const cells = new Set(input.area.cells.map((cell) => `${cell.col}:${cell.row}`))
  return tokenOccupiedCellsAt(input.token, input.map, input.at)
    .some((cell) => cells.has(`${cell.col}:${cell.row}`))
}

function persistentAreaFullyContainsToken(input: {
  geometry?: MapGeometryState; map: BattleMap; token: Token; at: MapGeometryPoint;
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number]; elevation: number; height: number
}): boolean {
  const cells = new Set(input.area.cells.map(cell => `${cell.col}:${cell.row}`))
  return tokenOccupiedCellsAt(input.token, input.map, input.at).every(cell => cells.has(`${cell.col}:${cell.row}`)) &&
    persistentAreaOverlapsHeight(input.geometry, input.map, input.area, input.elevation, 1e-5) &&
    persistentAreaOverlapsHeight(input.geometry, input.map, input.area, input.elevation + input.height - 1e-5, 1e-5)
}

function tokenOverlapsPersistentAreaAnchorTokenAt(input: {
  map: BattleMap
  token: Token
  at: MapGeometryPoint
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number]
}): boolean {
  if (!input.area.anchorTokenId) return false
  const anchor = input.map.tokens.find((candidate) => candidate.id === input.area.anchorTokenId)
  if (!anchor) return false
  const anchorCells = new Set(tokenOccupiedCellsAt(anchor, input.map, anchor)
    .map((cell) => `${cell.col}:${cell.row}`))
  return tokenOccupiedCellsAt(input.token, input.map, input.at)
    .some((cell) => anchorCells.has(`${cell.col}:${cell.row}`))
}

function persistentAreaBlocksTokenAt(input: {
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  at: MapGeometryPoint
  elevationFeet: number
}): string | undefined {
  const creatureHeight = Math.max(5, Math.max(1, input.token.size) * 5)
  const occupied = tokenOccupiedCellsAt(input.token, input.map, input.at)
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (area.forceShell) {
      if (forceShellOverlapsBody(area,input.map,input.at,input.elevationFeet,
        (input.map.feetPerCell??5)*Math.max(1,input.token.size)*.42,creatureHeight)) return area.id
      continue
    }
    if (area.stoneWall || area.forceWall) {
      if (stoneWallIntersects(area, input.map, input.at, input.at, input.elevationFeet, input.elevationFeet,
        (input.map.feetPerCell ?? 5) * Math.max(1, input.token.size) * .42, creatureHeight)) return area.id
      continue
    }
    if (
      area.interposition?.mode === 'blocked' &&
      area.interposition.targetTokenId === input.token.id &&
      tokenOverlapsPersistentAreaAnchorTokenAt({
        map: input.map, token: input.token, at: input.at, area,
      }) &&
      persistentAreaOverlapsHeight(input.geometry, input.map, area, input.elevationFeet, creatureHeight)
    ) return area.id
    const blocking = persistentAreaEffectiveBlocking(area)
    if (blocking?.movement !== true ||
      (blocking.movementMode ?? 'occupancy') !== 'occupancy' ||
      !persistentAreaBlockingAffectsToken(area, input.token, {
        geometry: input.geometry, elevationFeet: input.elevationFeet,
      }) ||
      !persistentAreaOverlapsHeight(input.geometry, input.map, area, input.elevationFeet, creatureHeight)) continue
    if (area.circularGeometry) {
      const anchor = area.anchorCell ?? area.cells[0]
      if (!anchor) continue
      const center = tokenCenterForAnchorCell(anchor, { size: 1 }, input.map)
      const feetPerPixel = (input.map.feetPerCell ?? 5) / input.map.gridSize
      const radius = area.circularGeometry.radiusFeet + input.token.size * (input.map.feetPerCell ?? 5) / 2
      if (Math.hypot(input.at.x - center.x, input.at.y - center.y) * feetPerPixel < radius - 1e-4) return area.id
      continue
    }
    const cells = new Set(area.cells.map((cell) => `${cell.col}:${cell.row}`))
    if (occupied.some((cell) => cells.has(`${cell.col}:${cell.row}`))) return area.id
  }
  return undefined
}

function persistentAreaDirectionalMovementBlocker(input: {
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  from: MapGeometryPoint
  to: MapGeometryPoint
  fromElevationFeet: number
  toElevationFeet: number
}): string | undefined {
  const creatureHeight = Math.max(5, Math.max(1, input.token.size) * 5)
  const gridSize = Math.max(1, input.map.gridSize)
  const distance = Math.hypot(input.to.x - input.from.x, input.to.y - input.from.y)
  const steps = Math.max(2, Math.ceil(distance / Math.max(1, gridSize / 4)))
  for (const area of (input.map.dnd5ePluginAreas ?? []).flatMap(persistentAreaHeightSlices)) {
    if (pillarBlocksMovement(area, input.map, input.token, input.from, input.to,
      input.fromElevationFeet, input.toElevationFeet)) return area.id
    if (area.stoneWall || area.forceWall) {
      if (stoneWallIntersects(area, input.map, input.from, input.to, input.fromElevationFeet, input.toElevationFeet,
        (input.map.feetPerCell ?? 5) * Math.max(1, input.token.size) * .42, creatureHeight)) return area.id
      continue
    }
    if (area.forceShell) {
      // Check feet, torso and head so changing altitude cannot pass through the roof.
      if ([0, creatureHeight / 2, creatureHeight].some(height => forceShellCrosses(area, input.map,
        input.from, input.to, input.fromElevationFeet + height, input.toElevationFeet + height))) return area.id
      continue
    }
    const blocking = persistentAreaEffectiveBlocking(area)
    const mode = blocking?.movementMode ?? 'occupancy'
    if (
      blocking?.movement !== true || mode === 'occupancy' ||
      !persistentAreaBlockingAffectsToken(area, input.token, {
        geometry: input.geometry, elevationFeet: input.fromElevationFeet,
      })
    ) continue
    const fromInside = tokenOverlapsPersistentAreaCellsAt({
      map: input.map, token: input.token, at: input.from, area, geometry: input.geometry, elevationFeet: input.fromElevationFeet,
    }) && persistentAreaOverlapsHeight(
      input.geometry, input.map, area, input.fromElevationFeet, creatureHeight,
    )
    const toInside = tokenOverlapsPersistentAreaCellsAt({
      map: input.map, token: input.token, at: input.to, area, geometry: input.geometry, elevationFeet: input.toElevationFeet,
    }) && persistentAreaOverlapsHeight(
      input.geometry, input.map, area, input.toElevationFeet, creatureHeight,
    )
    let crossesInterior = false
    if (fromInside && blocking.containEntireTokenOnExit && (mode === 'exit' || mode === 'boundary')) {
      for (let index = 1; index <= steps; index += 1) {
        const ratio = index / steps
        if (!persistentAreaFullyContainsToken({ geometry: input.geometry, map: input.map, token: input.token, area,
          at: { x: input.from.x + (input.to.x - input.from.x) * ratio, y: input.from.y + (input.to.y - input.from.y) * ratio },
          elevation: input.fromElevationFeet + (input.toElevationFeet - input.fromElevationFeet) * ratio,
          height: creatureHeight })) return area.id
      }
    }
    if (!fromInside && !toInside && (mode === 'enter' || mode === 'boundary')) {
      for (let index = 1; index < steps; index += 1) {
        const ratio = index / steps
        const at = {
          x: input.from.x + (input.to.x - input.from.x) * ratio,
          y: input.from.y + (input.to.y - input.from.y) * ratio,
        }
        const elevation = input.fromElevationFeet +
          (input.toElevationFeet - input.fromElevationFeet) * ratio
        if (
          tokenOverlapsPersistentAreaCellsAt({ map: input.map, token: input.token, at, area, geometry: input.geometry, elevationFeet: elevation }) &&
          persistentAreaOverlapsHeight(input.geometry, input.map, area, elevation, creatureHeight)
        ) {
          crossesInterior = true
          break
        }
      }
    }
    if (
      (mode === 'enter' && !fromInside && (toInside || crossesInterior)) ||
      (mode === 'exit' && fromInside && !toInside) ||
      (mode === 'boundary' && (fromInside !== toInside || crossesInterior))
    ) return area.id
  }
  return undefined
}

/**
 * Resolves teleport wards from authoritative origin/destination geometry.
 * Teleportation has no traversed path: only crossing from outside to inside or
 * inside to outside is relevant.
 */
export interface Dnd5ePersistentAreaTeleportationBoundary {
  areaId: string
  areaLabel: string
  savingThrow?: { ability: import('./dnd').AbilityKey; dc: number }
}

export function dnd5ePersistentAreaTeleportationBoundary(input: {
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  from: MapGeometryPoint
  to: MapGeometryPoint
  fromElevationFeet?: number
  toElevationFeet?: number
}): Dnd5ePersistentAreaTeleportationBoundary | undefined {
  const creatureHeight = Math.max(5, Math.max(1, input.token.size) * 5)
  const fromElevationFeet = input.fromElevationFeet ?? mapGeometryTokenElevation(input.geometry, input.token)
  const toElevationFeet = input.toElevationFeet ?? fromElevationFeet
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    const blocking = area.blocking
    const hallowInterference = area.hallow?.additionalEffect === 'extradimensional-interference' &&
      hallowAdditionalEffectAffectsToken(area, input.token, input.map)
    if (
      (!blocking && !hallowInterference) ||
      (blocking?.blocksTeleportationEntry !== true && blocking?.blocksTeleportationExit !== true &&
        !hallowInterference) ||
      (blocking != null && !hallowInterference && !persistentAreaBlockingAffectsToken(area, input.token, {
        geometry: input.geometry, elevationFeet: fromElevationFeet,
      }))
    ) continue
    const fromInside = tokenOverlapsPersistentAreaCellsAt({
      map: input.map, token: input.token, at: input.from, area,
    }) && persistentAreaOverlapsHeight(
      input.geometry, input.map, area, fromElevationFeet, creatureHeight,
    )
    const toInside = tokenOverlapsPersistentAreaCellsAt({
      map: input.map, token: input.token, at: input.to, area,
    }) && persistentAreaOverlapsHeight(
      input.geometry, input.map, area, toElevationFeet, creatureHeight,
    )
    if ((blocking?.blocksTeleportationEntry === true || hallowInterference) && !fromInside && toInside) {
      return { areaId: area.id, areaLabel: area.label }
    }
    if ((blocking?.blocksTeleportationExit === true || hallowInterference) && fromInside && !toInside) {
      return {
        areaId: area.id,
        areaLabel: area.label,
        savingThrow: blocking?.teleportationExitSavingThrow
          ? { ...blocking.teleportationExitSavingThrow }
          : undefined,
      }
    }
    if (blocking?.blocksTeleportationExit && blocking.containEntireTokenOnExit && fromInside &&
      !persistentAreaFullyContainsToken({ geometry: input.geometry, map: input.map, token: input.token, area,
        at: input.to, elevation: toElevationFeet, height: creatureHeight })) return { areaId: area.id, areaLabel: area.label,
          savingThrow: blocking.teleportationExitSavingThrow ? { ...blocking.teleportationExitSavingThrow } : undefined }
  }
  return undefined
}

export function dnd5ePersistentAreaTeleportationBlocker(
  input: Parameters<typeof dnd5ePersistentAreaTeleportationBoundary>[0],
): string | undefined {
  return dnd5ePersistentAreaTeleportationBoundary(input)?.areaId
}

function persistentAreaVisionSegments(
  map: BattleMap,
  geometry?: MapGeometryState,
  viewer?: Token,
): MapGeometrySegment[] {
  const gridSize = Math.max(1, map.gridSize)
  const offsetX = map.gridOffsetX ?? 0
  const offsetY = map.gridOffsetY ?? 0
  return (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    const blocksByObscuration = area.obscuration?.kind === 'heavy' &&
      area.obscuration.scope !== 'source-token' &&
      !(viewer && area.obscurationExcludedTokenIds?.includes(viewer.id)) &&
      !(area.obscuration.sourceCanSeeThrough && area.sourceTokenId === viewer?.id)
    if (area.blocking?.vision !== true && !blocksByObscuration) return []
    const eyeElevation = viewer ? mapGeometryTokenElevation(geometry,viewer)+(mapGeometryEntityBodyHeightFeet(viewer)??5)/2 : 0
    const cells = new Set(area.cells.map((cell) => `${cell.col}:${cell.row}`))
    const anchorToken = area.anchorMode === 'source-token' || area.anchorMode === 'target-token' || area.anchorMode === 'effect-token'
      ? map.tokens.find((token) => token.id === (area.anchorTokenId ?? area.sourceTokenId))
      : undefined
    const baseHeightFeet = area.vertical?.mode === 'volume'
      ? anchorToken && Number.isFinite(area.vertical.anchorOffsetFeet)
        ? mapGeometryTokenElevation(geometry, anchorToken) + Number(area.vertical.anchorOffsetFeet)
        : area.vertical.baseElevationFeet
      : -1_000
    const heightFeet = area.vertical?.mode === 'volume' ? area.vertical.heightFeet : 11_000
    const gasEdges = gasExclusionVisionSegments(map,area,eyeElevation)
    if (gasEdges) return gasEdges.map((segment,index)=>({...segment,baseHeightFeet,heightFeet,
        entityId:`${area.id}:gas-edge:${index}`,entityKind:'wall' as const,
        blocksVision:true,blocksMovement:false,blocksLineOfEffect:false}))
    if (area.groveVolume) return area.cells.flatMap(cell =>
      groveCellVisionSegments(area.groveVolume!, {x:offsetX+cell.col*gridSize,y:offsetY+cell.row*gridSize,size:gridSize},baseHeightFeet,heightFeet)
        .map((segment,index)=>({...segment,entityId:`${area.id}:grove-edge:${cell.col}:${cell.row}:${index}`,
          entityKind:'wall' as const,blocksVision:true,blocksMovement:false,blocksLineOfEffect:false})))
    const directions = [
      { dc: 0, dr: -1, a: [0, 0], b: [1, 0] },
      { dc: 1, dr: 0, a: [1, 0], b: [1, 1] },
      { dc: 0, dr: 1, a: [1, 1], b: [0, 1] },
      { dc: -1, dr: 0, a: [0, 1], b: [0, 0] },
    ] as const
    return area.cells.flatMap((cell) => directions.flatMap((direction, edgeIndex) => {
      if (cells.has(`${cell.col + direction.dc}:${cell.row + direction.dr}`)) return []
      return [{
        entityId: `${area.id}:vision-edge:${cell.col}:${cell.row}:${edgeIndex}`,
        entityKind: 'wall' as const,
        a: {
          x: offsetX + (cell.col + direction.a[0]) * gridSize,
          y: offsetY + (cell.row + direction.a[1]) * gridSize,
        },
        b: {
          x: offsetX + (cell.col + direction.b[0]) * gridSize,
          y: offsetY + (cell.row + direction.b[1]) * gridSize,
        },
        blocksVision: true,
        blocksMovement: false,
        blocksLineOfEffect: false,
        baseHeightFeet,
        heightFeet,
      }]
    }))
  })
}

type PersistentAreaRayMap = Pick<BattleMap, 'gridSize' | 'tokens'> &
  Partial<Pick<BattleMap, 'gridOffsetX' | 'gridOffsetY' | 'dnd5ePluginAreas' | 'feetPerCell'>>

function persistentAreaBlocksRay(input: {
  geometry?: MapGeometryState
  map: PersistentAreaRayMap
  from: MapGeometryPoint
  to: MapGeometryPoint
  fromElevationFeet: number
  toElevationFeet: number
  fromEyeHeightFeet: number
  toEyeHeightFeet: number
  purpose: 'opaque-cover' | 'vision' | 'line-of-effect' | 'movement' | 'ordinary-projectile' | 'ranged-weapon-disadvantage' | 'damage-attenuation'
  damageType?: import('../rulesets/dnd5e/damageTypes').Dnd5eDamageType
  exactCellIntersection?: true
}): string | undefined {
  return sharedPersistentAreaBlocksRay({ ...input, overlapsHeight: (area, elevation, height) =>
    persistentAreaOverlapsHeight(input.geometry, input.map, area, elevation, height) })
}

/** True when an ordinary arrow, bolt, sling stone, or similar projectile crosses a live Wind Wall. */
export function mapGeometryOrdinaryProjectileBlocked(input: {
  geometry?: MapGeometryState
  map: PersistentAreaRayMap
  from: Token
  to: Token
  fromHeightFeet?: number
  toHeightFeet?: number
}): boolean {
  return mapGeometryWeaponRayIntersects(input, 'ordinary-projectile')
}

/** Host and preview use the same current area volume; spell attacks are excluded by callers. */
export function mapGeometryRangedWeaponAttackDisadvantage(input: Parameters<typeof mapGeometryOrdinaryProjectileBlocked>[0]): boolean {
  return mapGeometryWeaponRayIntersects(input, 'ranged-weapon-disadvantage')
}

/** The Host supplies the actual effect origin, which need not be the caster. */
export function mapGeometryDamagePathHalved(input: {
  map: PersistentAreaRayMap; geometry?: MapGeometryState
  from: MapGeometryPoint; to: MapGeometryPoint
  fromElevationFeet: number; toElevationFeet: number
  damageType: import('../rulesets/dnd5e/damageTypes').Dnd5eDamageType
}): boolean {
  if (Math.hypot(input.from.x-input.to.x,input.from.y-input.to.y,input.fromElevationFeet-input.toElevationFeet)<1e-9)return false
  return persistentAreaBlocksRay({...input,fromEyeHeightFeet:0,toEyeHeightFeet:0,purpose:'damage-attenuation'})!=null
}

function mapGeometryWeaponRayIntersects(input: Parameters<typeof mapGeometryOrdinaryProjectileBlocked>[0],
  purpose: 'ordinary-projectile' | 'ranged-weapon-disadvantage'): boolean {
  const fromHeightFeet = Math.max(
    0.1,
    input.fromHeightFeet ?? mapGeometryEntityBodyHeightFeet(input.from) ?? 5,
  )
  const toHeightFeet = Math.max(
    0.1,
    input.toHeightFeet ?? mapGeometryEntityBodyHeightFeet(input.to) ?? 5,
  )
  return persistentAreaBlocksRay({
    geometry: input.geometry,
    map: input.map,
    from: input.from,
    to: input.to,
    fromElevationFeet: mapGeometryTokenElevation(input.geometry, input.from),
    toElevationFeet: mapGeometryTokenElevation(input.geometry, input.to),
    fromEyeHeightFeet: fromHeightFeet / 2,
    toEyeHeightFeet: toHeightFeet / 2,
    purpose,
  }) != null
}

/** Subtract authored passage cells/heights from a mapped segment before sweeping an effect volume. */
function mappedSegmentOutsidePassages(segment:MapGeometrySegment,map:BattleMap,geometry:MapGeometryState):MapGeometrySegment[] {
  const openings=(map.dnd5ePluginAreas??[]).flatMap(persistentAreaHeightSlices).filter(area=>area.blocking?.suppressesMappedBarriers===true)
  if(!openings.length || segment.heightFeet<=0)return [segment]
  const cuts=new Set([0,1]),grid=Math.max(1,map.gridSize),ox=map.gridOffsetX??0,oy=map.gridOffsetY??0
  for(const area of openings)for(const cell of area.cells){
    const x=ox+cell.col*grid,y=oy+cell.row*grid
    const points=[{x,y},{x:x+grid,y},{x:x+grid,y:y+grid},{x,y:y+grid}]
    for(let i=0;i<4;i++){
      const t=intersectionParameter(segment.a,segment.b,points[i],points[(i+1)%4])
      if(t!=null&&t>0&&t<1)cuts.add(t)
    }
  }
  const point=(t:number)=>({x:segment.a.x+(segment.b.x-segment.a.x)*t,y:segment.a.y+(segment.b.y-segment.a.y)*t})
  const ordered=[...cuts].sort((a,b)=>a-b),result:MapGeometrySegment[]=[]
  for(let i=1;i<ordered.length;i++){
    const at=point((ordered[i-1]+ordered[i])/2),col=Math.floor((at.x-ox)/grid),row=Math.floor((at.y-oy)/grid)
    let heights:[number,number][]=[[segment.baseHeightFeet,segment.baseHeightFeet+segment.heightFeet]]
    for(const area of openings){
      if(!area.cells.some(cell=>cell.col===col&&cell.row===row))continue
      if(!area.vertical||area.vertical.mode==='ground'){heights=[];break}
      const anchor=area.anchorMode==='source-token'||area.anchorMode==='target-token'||area.anchorMode==='effect-token'
        ?map.tokens.find(token=>token.id===(area.anchorTokenId??area.sourceTokenId)):undefined
      const low=anchor&&Number.isFinite(area.vertical.anchorOffsetFeet)?mapGeometryTokenElevation(geometry,anchor)+Number(area.vertical.anchorOffsetFeet):area.vertical.baseElevationFeet
      const high=low+area.vertical.heightFeet
      heights=heights.flatMap(([a,b]):[number,number][]=>{
        if(high<=a||low>=b)return [[a,b]]
        return [...(low>a?[[a,low] as [number,number]]:[]),...(high<b?[[high,b] as [number,number]]:[])]
      })
    }
    for(const [low,high] of heights)result.push({...segment,a:point(ordered[i-1]),b:point(ordered[i]),baseHeightFeet:low,heightFeet:high-low})
  }
  return result
}

/** Continuous axis-aligned effect-volume sweep; creature/token collision keeps its own rules. */
let geometryWorldMinuteReader: () => number | undefined = () => undefined
export function setMapGeometryWorldMinuteReader(reader: () => number | undefined): void {
  geometryWorldMinuteReader = reader
}

/** Transient physical projection only; never persist frozen flags into base water. */
function geometryWithFrozenWater(geometry: MapGeometryState | undefined, worldMinute?: number): MapGeometryState | undefined {
  if (!geometry) return geometry
  const minute = worldMinute ?? geometryWorldMinuteReader()
  let changed = false
  const obstacles = geometry.obstacles.map(body => {
    if (!body.controlledWater?.alterations.some(effect => effect.kind === 'freeze' &&
      (minute == null || (effect.appliedAtWorldMinute <= minute && effect.expiresAtWorldMinute > minute)))) return body
    changed = true
    return {...body,blocksMovement:true,terrainRegion:false}
  })
  return changed ? {...geometry,obstacles} : geometry
}

export function mapGeometryVolumeMovementBlocked(input: {
  worldMinute?: number
  /** Convex world-space footprint at `from`; omitted for ordinary square bodies. */
  footprint?: readonly MapGeometryPoint[]
  geometry?: MapGeometryState; map: BattleMap; from: MapGeometryPoint; to: MapGeometryPoint
  fromElevationFeet: number; toElevationFeet: number; halfSizePixels: number; heightFeet: number
}): {blocked: boolean; entityId?: string} {
  input = {...input,geometry:geometryWithFrozenWater(input.geometry,input.worldMinute)}
  const {geometry,map,from,to,halfSizePixels:half,heightFeet:height}=input
  const footprint=input.footprint
  if(footprint&&(footprint.length<3||footprint.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))return {blocked:true}
  if(![from.x,from.y,to.x,to.y,input.fromElevationFeet,input.toElevationFeet,half,height].every(Number.isFinite) || half<=0 || height<=0) return {blocked:true}
  for(const area of map.dnd5ePluginAreas??[])if(area.forceShell && forceShellSweptBoxOverlaps(area,map,from,to,input.fromElevationFeet,input.toElevationFeet,half,height))return {blocked:true,entityId:area.id}
  if(!geometry) return {blocked:false}
  const velocity={x:to.x-from.x,y:to.y-from.y},dz=input.toElevationFeet-input.fromElevationFeet
  const clip=(interval:[number,number],start:number,delta:number,low:number,high:number):boolean=>{
    if(Math.abs(delta)<1e-12) return start>=low && start<=high
    const a=(low-start)/delta,b=(high-start)/delta
    interval[0]=Math.max(interval[0],Math.min(a,b));interval[1]=Math.min(interval[1],Math.max(a,b))
    return interval[0]<=interval[1]
  }
  const heightInterval=(base:number,thickness:number):[number,number]|undefined=>{
    const interval:[number,number]=[0,1]
    return clip(interval,input.fromElevationFeet,dz,base-height+1e-7,base+thickness-1e-7)?interval:undefined
  }
  const suppressed=(t:number,base:number,thickness:number)=>{
    const low=Math.max(input.fromElevationFeet+dz*t,base),high=Math.min(input.fromElevationFeet+dz*t+height,base+thickness)
    return persistentAreaSuppressesMappedBarrierAt({geometry,map,
      point:{x:from.x+velocity.x*t,y:from.y+velocity.y*t},elevationFeet:low,entityHeightFeet:Math.max(0,high-low),requireFullHeight:true})
  }
  const candidates=querySegmentSpatialIndexBounds(runtimeCompiledGeometry(geometry).index,{
    minX:Math.min(from.x,to.x)-half,maxX:Math.max(from.x,to.x)+half,
    minY:Math.min(from.y,to.y)-half,maxY:Math.max(from.y,to.y)+half,
  }) as MapGeometrySegment[]
  for(const segment of candidates.flatMap(segment=>mappedSegmentOutsidePassages(segment,map,geometry))) {
    if(!segment.blocksMovement)continue
    const interval=heightInterval(segment.baseHeightFeet,segment.heightFeet)
    if(!interval)continue
    // Sweep the actual convex water fragment, rather than its bounding square.
    const axes=[...(footprint?footprint.map((p,i)=>{const q=footprint[(i+1)%footprint.length];return {x:q.y-p.y,y:p.x-q.x}}):[{x:1,y:0},{x:0,y:1}]),{x:segment.b.y-segment.a.y,y:segment.a.x-segment.b.x}]
    const touches=axes.every(axis=>{
      const a=segment.a.x*axis.x+segment.a.y*axis.y,b=segment.b.x*axis.x+segment.b.y*axis.y
      if(footprint){
        const projected=footprint.map(p=>p.x*axis.x+p.y*axis.y)
        const epsilon=1e-7*Math.hypot(axis.x,axis.y)
        return clip(interval,0,velocity.x*axis.x+velocity.y*axis.y,Math.min(a,b)-Math.max(...projected)+epsilon,Math.max(a,b)-Math.min(...projected)-epsilon)
      }
      const radius=Math.max(0,half-1e-7)*(Math.abs(axis.x)+Math.abs(axis.y))
      return clip(interval,from.x*axis.x+from.y*axis.y,velocity.x*axis.x+velocity.y*axis.y,Math.min(a,b)-radius,Math.max(a,b)+radius)
    })
    if(touches)return {blocked:true,entityId:segment.entityId}
  }
  // A vertical sweep may remain wholly inside a slab polygon, crossing no edge.
  for(const obstacle of geometry.obstacles) {
    if(!obstacle.blocksMovement || geometryEntityDestroyed(obstacle))continue
    const interval=heightInterval(obstacle.baseHeightFeet,obstacle.heightFeet)
    if(!interval)continue
    const t=(interval[0]+interval[1])/2,x=from.x+velocity.x*t,y=from.y+velocity.y*t
    if((footprint?footprint.map(p=>({x:p.x+velocity.x*t,y:p.y+velocity.y*t})):[{x,y},{x:x-half,y:y-half},{x:x+half,y:y-half},{x:x+half,y:y+half},{x:x-half,y:y+half}])
      .some(point=>mapGeometryPointInPolygon(point,obstacle.points)) && !suppressed(t,obstacle.baseHeightFeet,obstacle.heightFeet))return {blocked:true,entityId:obstacle.id}
  }
  return {blocked:false}
}

export function mapGeometryMovementBlocked(input: {
  worldMinute?: number
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  to: MapGeometryPoint
  fromElevationFeet?: number
  toElevationFeet?: number
  /** Creature can traverse a door/window only when its declared physical gap meets this size. */
  minimumPassageGapInches?: number
}): { blocked: boolean; entityId?: string } {
  input = {...input,geometry:geometryWithFrozenWater(input.geometry,input.worldMinute)}
  const { geometry, token, to } = input
  const from = { x: token.x, y: token.y }
  const fromElevation = input.fromElevationFeet ?? mapGeometryTokenElevation(geometry, token)
  const toElevation = input.toElevationFeet ?? fromElevation
  const directionalAreaBlocker = persistentAreaDirectionalMovementBlocker({
    geometry,
    map: input.map,
    token,
    from,
    to,
    fromElevationFeet: fromElevation,
    toElevationFeet: toElevation,
  })
  if (directionalAreaBlocker) return { blocked: true, entityId: directionalAreaBlocker }
  const areaPlacementBlocker = persistentAreaBlocksTokenAt({
    geometry,
    map: input.map,
    token,
    at: to,
    elevationFeet: toElevation,
  })
  if (areaPlacementBlocker) return { blocked: true, entityId: areaPlacementBlocker }
  const areaCrossingBlocker = persistentAreaBlocksRay({
    geometry,
    map: input.map,
    from,
    to,
    fromElevationFeet: fromElevation,
    toElevationFeet: toElevation,
    fromEyeHeightFeet: 0.1,
    toEyeHeightFeet: 0.1,
    purpose: 'movement',
  })
  if (areaCrossingBlocker) return { blocked: true, entityId: areaCrossingBlocker }
  if (!geometry) return { blocked: false }
  const radius = Math.max(0, input.map.gridSize * Math.max(1, token.size) * 0.42)
  const offsets = radius > 0
    ? [{ x: 0, y: 0 }, { x: radius, y: 0 }, { x: -radius, y: 0 }, { x: 0, y: radius }, { x: 0, y: -radius }]
    : [{ x: 0, y: 0 }]
  const creatureHeight = Math.max(5, Math.max(1, token.size) * 5)
  for (const obstacle of geometry.obstacles) {
    if (geometryEntityDestroyed(obstacle)) continue
    if(obstacle.blocksMovement && !obstacle.stairPath){
      const t=structureSolidBodyHit(obstacle,{...from,elevationFeet:fromElevation},{...to,elevationFeet:toElevation},input.map.gridSize*token.size/2,creatureHeight)
      if(t!=null && !persistentAreaSuppressesMappedBarrierAt({geometry,map:input.map,
        point:{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},elevationFeet:fromElevation+(toElevation-fromElevation)*t,entityHeightFeet:creatureHeight}))return {blocked:true,entityId:obstacle.id}
    }
    if(obstacle.blocksMovement && obstacle.stairPath){
      const t=structureStairBodyHit(obstacle.stairPath,input.map.gridSize/(input.map.feetPerCell??5),
        {...from,elevationFeet:fromElevation},{...to,elevationFeet:toElevation},input.map.gridSize*token.size/2,creatureHeight)
      if(t!=null && !persistentAreaSuppressesMappedBarrierAt({geometry,map:input.map,
        point:{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},elevationFeet:fromElevation+(toElevation-fromElevation)*t,entityHeightFeet:creatureHeight}))return {blocked:true,entityId:obstacle.id}
    }
    if (
      obstacle.blocksMovement && overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, toElevation, creatureHeight) &&
      mapGeometryPointInPolygon(to, obstacle.points) &&
      !persistentAreaSuppressesMappedBarrierAt({
        geometry, map: input.map, point: to, elevationFeet: toElevation, entityHeightFeet: creatureHeight,
      })
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
      const passageGapInches = segment.entityKind === 'door'
        ? (() => {
            const door = geometry.doors.find((candidate) => candidate.id === segment.entityId)
            return door ? mapGeometryDoorPassageGapInches(door) : undefined
          })()
        : segment.entityKind === 'window'
          ? (geometry.windows ?? []).find((window) => window.id === segment.entityId)?.passageGapInches
          : undefined
      if (
        input.minimumPassageGapInches != null &&
        passageGapInches != null &&
        passageGapInches >= input.minimumPassageGapInches
      ) continue
      const t = intersectionParameter(
        rayFrom,
        rayTo,
        segment.a,
        segment.b,
      )
      if (t == null || t <= 1e-5) continue
      const elevation = fromElevation + (toElevation - fromElevation) * t
      const intersection = {
        x: rayFrom.x + (rayTo.x - rayFrom.x) * t,
        y: rayFrom.y + (rayTo.y - rayFrom.y) * t,
      }
      if (persistentAreaSuppressesMappedBarrierAt({
        geometry, map: input.map, point: intersection,
        elevationFeet: elevation, entityHeightFeet: creatureHeight,
      })) continue
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
  worldMinute?: number
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  at: MapGeometryPoint
  elevationFeet?: number
  /** Host geometry probe; zero tests a physical surface rather than a creature body. */
  mappedBodyHeightFeet?: number
  /** Creature can overlap a door/window only when its declared physical gap meets this size. */
  minimumPassageGapInches?: number
}): { blocked: boolean; entityId?: string } {
  input = {...input,geometry:geometryWithFrozenWater(input.geometry,input.worldMinute)}
  const { geometry, token, at } = input
  const elevation = input.elevationFeet ?? mapGeometryTokenElevation(geometry, token)
  const areaBlocker = persistentAreaBlocksTokenAt({
    geometry,
    map: input.map,
    token,
    at,
    elevationFeet: elevation,
  })
  if (areaBlocker) return { blocked: true, entityId: areaBlocker }
  if (!geometry) return { blocked: false }
  const radius = Math.max(1, input.map.gridSize * Math.max(1, token.size) * 0.42)
  const creatureHeight = input.mappedBodyHeightFeet != null && Number.isFinite(input.mappedBodyHeightFeet) && input.mappedBodyHeightFeet >= 0
    ? input.mappedBodyHeightFeet : Math.max(5, Math.max(1, token.size) * 5)
  const candidates = querySegmentSpatialIndexBounds(runtimeCompiledGeometry(geometry).index, {
    minX: at.x - radius,
    minY: at.y - radius,
    maxX: at.x + radius,
    maxY: at.y + radius,
  }) as MapGeometrySegment[]
  for (const segment of candidates) {
    const passageGapInches = segment.entityKind === 'door'
      ? (() => {
          const door = geometry.doors.find((candidate) => candidate.id === segment.entityId)
          return door ? mapGeometryDoorPassageGapInches(door) : undefined
        })()
      : segment.entityKind === 'window'
        ? (geometry.windows ?? []).find((window) => window.id === segment.entityId)?.passageGapInches
        : undefined
    if (
      input.minimumPassageGapInches != null &&
      passageGapInches != null &&
      passageGapInches >= input.minimumPassageGapInches
    ) continue
    if (
      segment.blocksMovement && overlapsHeight(segment.baseHeightFeet, segment.heightFeet, elevation, creatureHeight) &&
      pointToSegmentDistance(at, segment.a, segment.b) <= radius &&
      !persistentAreaSuppressesMappedBarrierAt({
        geometry, map: input.map, point: at, elevationFeet: elevation, entityHeightFeet: creatureHeight,
      })
    ) return { blocked: true, entityId: segment.entityId }
  }
  for (const obstacle of geometry.obstacles) {
    if (geometryEntityDestroyed(obstacle)) continue
    if(obstacle.blocksMovement && !obstacle.stairPath && structureSolidBodyHit(obstacle,
      {...at,elevationFeet:elevation},{...at,elevationFeet:elevation},input.map.gridSize*token.size/2,creatureHeight)!=null &&
      !persistentAreaSuppressesMappedBarrierAt({geometry,map:input.map,point:at,elevationFeet:elevation,entityHeightFeet:creatureHeight}))return {blocked:true,entityId:obstacle.id}
    if(obstacle.blocksMovement && obstacle.stairPath && structureStairBodyHit(obstacle.stairPath,input.map.gridSize/(input.map.feetPerCell??5),
      {...at,elevationFeet:elevation},{...at,elevationFeet:elevation},input.map.gridSize*token.size/2,creatureHeight)!=null &&
      !persistentAreaSuppressesMappedBarrierAt({geometry,map:input.map,point:at,elevationFeet:elevation,entityHeightFeet:creatureHeight}))return {blocked:true,entityId:obstacle.id}
    if (
      obstacle.blocksMovement && overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, elevation, creatureHeight) &&
      mapGeometryPointInPolygon(at, obstacle.points) &&
      !persistentAreaSuppressesMappedBarrierAt({
        geometry, map: input.map, point: at, elevationFeet: elevation, entityHeightFeet: creatureHeight,
      })
    ) return { blocked: true, entityId: obstacle.id }
  }
  return { blocked: false }
}

/** First physical barrier along a point projectile, without creature movement padding. */
export function mapGeometryPhysicalProjectileImpact(input: {
  geometry?: MapGeometryState
  map: PersistentAreaRayMap
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet: number
  toElevationFeet?: number
}): { entityId: string; t: number } | undefined {
  const interpolate = (t: number) => ({
    x: input.from.x + (input.to.x - input.from.x) * t,
    y: input.from.y + (input.to.y - input.from.y) * t,
  })
  const endElevation = input.toElevationFeet ?? input.elevationFeet
  const elevationAt = (t: number) => input.elevationFeet + (endElevation - input.elevationFeet) * t
  const hit = raycastGeometry({
    compiled: runtimeCompiledGeometry(input.geometry), from: input.from, to: input.to,
    purpose: 'movement', fromElevationFeet: input.elevationFeet, toElevationFeet: endElevation,
    fromEyeHeightFeet: 0, toEyeHeightFeet: 0, ignoreStart: false,
    ignoreSegment: (_segment, t, height) => persistentAreaSuppressesMappedBarrierAt({
      geometry: input.geometry, map: input.map, point: interpolate(t), elevationFeet: height, entityHeightFeet: 0.1,
    }),
  })
  let nearest = hit ? { entityId: hit.segment.entityId, t: hit.t } : undefined
  for(const obstacle of input.geometry?.obstacles??[]){
    if(!obstacle.blocksMovement || !obstacle.stairPath || geometryEntityDestroyed(obstacle))continue
    const t=structureStairRayHit(obstacle.stairPath,input.map.gridSize/(input.map.feetPerCell??5),
      {...input.from,elevationFeet:input.elevationFeet},{...input.to,elevationFeet:endElevation})
    if(t!=null && (!nearest||t<nearest.t) && !persistentAreaSuppressesMappedBarrierAt({geometry:input.geometry,map:input.map,
      point:interpolate(t),elevationFeet:elevationAt(t),entityHeightFeet:0.1}))nearest={entityId:obstacle.id,t}
  }
  // A rising/falling ray may enter an obstacle through its horizontal face
  // without crossing any XY edge (for example a thin ceiling directly above).
  for (const obstacle of input.geometry?.obstacles ?? []) {
    if (!obstacle.blocksMovement || obstacle.heightFeet <= 0 || geometryEntityDestroyed(obstacle)) continue
    const cuts = new Set([0, 1])
    for (let index = 0; index < obstacle.points.length; index++) {
      const t = intersectionParameter(input.from, input.to, obstacle.points[index], obstacle.points[(index + 1) % obstacle.points.length])
      if (t != null && t > 0 && t < 1) cuts.add(t)
    }
    const sorted = [...cuts].sort((left, right) => left - right)
    for (let index = 1; index < sorted.length; index++) {
      let lower = sorted[index - 1], upper = sorted[index]
      if (!mapGeometryPointInPolygon(interpolate((lower + upper) / 2), obstacle.points)) continue
      const dz = endElevation - input.elevationFeet
      const bottom = obstacle.baseHeightFeet, top = bottom + obstacle.heightFeet
      if (Math.abs(dz) < 1e-12) {
        if (input.elevationFeet < bottom || input.elevationFeet >= top) continue
      } else {
        const first = (bottom - input.elevationFeet) / dz, second = (top - input.elevationFeet) / dz
        lower = Math.max(lower, Math.min(first, second)); upper = Math.min(upper, Math.max(first, second))
        if (lower > upper) continue
      }
      if (nearest && lower > nearest.t) continue
      if (persistentAreaSuppressesMappedBarrierAt({ geometry: input.geometry, map: input.map,
        point: interpolate(lower), elevationFeet: elevationAt(lower), entityHeightFeet: 0.1 })) continue
      nearest = { entityId: obstacle.id, t: lower }
    }
  }
  const areaAt = (t: number) => persistentAreaBlocksRay({
    ...input, to: interpolate(t), fromElevationFeet: input.elevationFeet, toElevationFeet: elevationAt(t),
    fromEyeHeightFeet: 0, toEyeHeightFeet: 0, purpose: 'movement', exactCellIntersection: true,
  })
  if (areaAt(nearest?.t ?? 1)) {
    let low = 0, high = nearest?.t ?? 1
    // The shared persistent-wall query returns an id; locate its first crossing
    // using prefixes of the same ray, retaining circular and panel geometry.
    for (let iteration = 0; iteration < 40; iteration++) {
      const middle = (low + high) / 2
      if (areaAt(middle)) high = middle
      else low = middle
    }
    const entityId = areaAt(high)
    if (entityId) nearest = { entityId, t: high }
  }
  return nearest
}

function rayBlocked(input: {
  geometry?: MapGeometryState
  map?: PersistentAreaRayMap
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
  fromEyeHeightFeet?: number
  toEyeHeightFeet?: number
  purpose: 'opaque-cover' | 'vision' | 'line-of-effect'
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
    ignoreSegment: input.map
      ? (_segment, t, height) =>
          persistentAreaSuppressesMappedBarrierAt({
            geometry: input.geometry,
            map: input.map!,
            point: {
              x: input.from.x + (input.to.x - input.from.x) * t,
              y: input.from.y + (input.to.y - input.from.y) * t,
            },
            elevationFeet: height,
            entityHeightFeet: 0.1,
          })
      : undefined,
  })?.segment.entityId
}

export function mapGeometryEntityBodyHeightFeet(entity: MapGeometryPoint): number | undefined {
  const size = (entity as Partial<Pick<Token, 'size'>>).size
  return Number.isFinite(size)
    ? Math.max(5, Math.max(1, size!) * 5)
    : undefined
}

export function mapGeometryCoverFromPoint(input: {
  geometry?: MapGeometryState
  map?: PersistentAreaRayMap
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
  fromEyeHeightFeet?: number
  toEyeHeightFeet?: number
}): MapGeometryCoverResult {
  const geometry = input.geometry
  if (!geometry) return { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
  const { from, to } = input
  const fromElevation = input.fromElevationFeet ?? input.elevationFeet ?? 0
  const toElevation = input.toElevationFeet ?? input.elevationFeet ?? fromElevation
  const fromEyeHeight = input.fromEyeHeightFeet ?? 2.5
  const toEyeHeight = input.toEyeHeightFeet ?? 2.5
  const lineBlocker = rayBlocked({
    geometry, from, to, fromElevationFeet: fromElevation, toElevationFeet: toElevation,
    map: input.map,
    fromEyeHeightFeet: fromEyeHeight, toEyeHeightFeet: toEyeHeight,
    purpose: 'line-of-effect',
  })
  if (lineBlocker) return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true, sourceEntityId: lineBlocker }
  const rank: Record<MapGeometryCover, number> = { none: 0, half: 1, 'three-quarters': 2, total: 3 }
  let cover: MapGeometryCover = 'none'
  let sourceEntityId: string | undefined
  for (const obstacle of geometry.obstacles) {
    if (geometryEntityDestroyed(obstacle)) continue
    if (obstacle.cover === 'none') continue
    const intersects = entitySegments(obstacle).some((segment) => {
      const t = intersectionParameter(from, to, segment.a, segment.b)
      if (t == null || t <= 1e-5) return false
      const fromSampleElevation = fromElevation + fromEyeHeight
      const toSampleElevation = toElevation + toEyeHeight
      const rayHeight = fromSampleElevation + (toSampleElevation - fromSampleElevation) * t
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
    const fromSampleElevation = fromElevation + fromEyeHeight
    const toSampleElevation = toElevation + toEyeHeight
    const rayHeight = fromSampleElevation + (toSampleElevation - fromSampleElevation) * t
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
  map?: PersistentAreaRayMap,
  entityHeights?: {
    attackerHeightFeet?: number
    targetHeightFeet?: number
  },
): MapGeometryCoverResult {
  const radius = Math.max(1, (map?.gridSize ?? 50) * Math.max(1, target.size) * 0.4)
  const attackerHeightFeet = Math.max(
    0.1,
    entityHeights?.attackerHeightFeet ?? mapGeometryEntityBodyHeightFeet(attacker) ?? 5,
  )
  const targetHeightFeet = Math.max(
    0.1,
    entityHeights?.targetHeightFeet ?? mapGeometryEntityBodyHeightFeet(target) ?? 5,
  )
  const attackerEyeHeightFeet = attackerHeightFeet / 2
  const targetEyeHeightFeet = targetHeightFeet / 2
  const samples = [
    { x: target.x - radius, y: target.y - radius },
    { x: target.x + radius, y: target.y - radius },
    { x: target.x + radius, y: target.y + radius },
    { x: target.x - radius, y: target.y + radius },
  ].map((to) => {
    const geometryCover = mapGeometryCoverFromPoint({
      geometry,
      map,
      from: attacker,
      to,
      fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
      toElevationFeet: mapGeometryTokenElevation(geometry, target),
      fromEyeHeightFeet: attackerEyeHeightFeet,
      toEyeHeightFeet: targetEyeHeightFeet,
    })
    if (geometryCover.cover !== 'none') return geometryCover
    const areaBlocker = map && persistentAreaBlocksRay({
      geometry,
      map,
      from: attacker,
      to,
      fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
      toElevationFeet: mapGeometryTokenElevation(geometry, target),
      fromEyeHeightFeet: attackerEyeHeightFeet,
      toEyeHeightFeet: targetEyeHeightFeet,
      purpose: 'line-of-effect',
    })
    if (areaBlocker) {
      return {
        cover: 'total' as const,
        armorClassBonus: 0 as const,
        blocksLineOfEffect: true,
        sourceEntityId: areaBlocker,
      }
    }
    const creature = map?.tokens.find((candidate) =>
      candidate.id !== attacker.id && candidate.id !== target.id && candidate.type !== 'obstacle' &&
      creatureIntersectsCoverRay(
        geometry,
        attacker,
        to,
        candidate,
        map.gridSize,
        mapGeometryTokenElevation(geometry, target),
        attackerEyeHeightFeet,
        targetEyeHeightFeet,
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
  fromEyeHeightFeet: number,
  toEyeHeightFeet: number,
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
  const fromSampleElevation = fromElevationFeet + fromEyeHeightFeet
  const toSampleElevation = targetElevationFeet + toEyeHeightFeet
  const rayHeight = fromSampleElevation + (toSampleElevation - fromSampleElevation) * projection
  const creatureBase = mapGeometryTokenElevation(geometry, creature)
  const creatureHeight = Math.max(5, Math.max(1, creature.size) * 5)
  return rayHeight >= creatureBase && rayHeight < creatureBase + creatureHeight
}

/** A single opaque physical barrier must block the ray; fog and glass cannot combine into cover. */
export function mapGeometryOpaqueCoverBlocked(input: Parameters<typeof mapGeometryLineOfEffectBlocked>[0]): boolean {
  if (rayBlocked({ ...input, purpose: 'opaque-cover' }) != null) return true
  return input.map ? persistentAreaBlocksRay({
    ...input, map: input.map,
    fromElevationFeet: input.fromElevationFeet ?? input.elevationFeet ?? 0,
    toElevationFeet: input.toElevationFeet ?? input.elevationFeet ?? input.fromElevationFeet ?? 0,
    fromEyeHeightFeet: input.fromEyeHeightFeet ?? 2.5,
    toEyeHeightFeet: input.toEyeHeightFeet ?? 2.5,
    purpose: 'opaque-cover',
  }) != null : false
}

export function mapGeometryLineOfEffectBlocked(input: {
  geometry?: MapGeometryState
  map?: PersistentAreaRayMap
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
  fromEyeHeightFeet?: number
  toEyeHeightFeet?: number
}): boolean {
  if (mapGeometryCoverFromPoint(input).blocksLineOfEffect) return true
  return input.map ? persistentAreaBlocksRay({
    geometry: input.geometry,
    map: input.map,
    from: input.from,
    to: input.to,
    fromElevationFeet: input.fromElevationFeet ?? input.elevationFeet ?? 0,
    toElevationFeet: input.toElevationFeet ?? input.elevationFeet ?? input.fromElevationFeet ?? 0,
    fromEyeHeightFeet: input.fromEyeHeightFeet ?? 2.5,
    toEyeHeightFeet: input.toEyeHeightFeet ?? 2.5,
    purpose: 'line-of-effect',
  }) != null : false
}

/** Geometry-only line-of-sight check. Unlike dynamic vision, this always respects vision-blocking walls and doors. */
export function mapGeometryLineOfSightBlocked(input: {
  geometry?: MapGeometryState
  map?: PersistentAreaRayMap
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
  fromEyeHeightFeet?: number
  toEyeHeightFeet?: number
}): boolean {
  const inferredFromHeightFeet = mapGeometryEntityBodyHeightFeet(input.from)
  const inferredToHeightFeet = mapGeometryEntityBodyHeightFeet(input.to)
  const fromEyeHeightFeet = input.fromEyeHeightFeet ??
    (inferredFromHeightFeet == null ? undefined : inferredFromHeightFeet / 2)
  const toEyeHeightFeet = input.toEyeHeightFeet ??
    (inferredToHeightFeet == null ? undefined : inferredToHeightFeet / 2)
  if (rayBlocked({
    ...input,
    fromEyeHeightFeet,
    toEyeHeightFeet,
    purpose: 'vision',
  }) != null) return true
  return input.map ? persistentAreaBlocksRay({
    geometry: input.geometry,
    map: input.map,
    from: input.from,
    to: input.to,
    fromElevationFeet: input.fromElevationFeet ?? input.elevationFeet ?? 0,
    toElevationFeet: input.toElevationFeet ?? input.elevationFeet ?? input.fromElevationFeet ?? 0,
    fromEyeHeightFeet: fromEyeHeightFeet ?? 2.5,
    toEyeHeightFeet: toEyeHeightFeet ?? 2.5,
    purpose: 'vision',
  }) != null : false
}

/**
 * Dynamic vision always traces ordinary line of sight to the map boundary.
 * Illumination and special-sense checks decide what can actually be seen along
 * those rays; darkness must not impose an arbitrary maximum distance on a
 * distant light source.
 */
function mapGeometryAmbientSightRangeFeet(
  map: Pick<BattleMap, 'width' | 'height' | 'gridSize' | 'feetPerCell'>,
  geometry?: MapGeometryState,
  forceEnabled = false,
): number {
  // Spell obstructions can require sight checks while dynamic vision is off.
  // They must not also impose the dormant default range on illuminated terrain.
  if (geometry?.vision.enabled !== true && !forceEnabled) return 0
  const gridSize = Math.max(1, map.gridSize)
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  return Math.hypot(Math.max(1, map.width), Math.max(1, map.height)) / gridSize * feetPerCell
}

function tokenIntersectsPersistentArea(
  map: BattleMap,
  geometry: MapGeometryState | undefined,
  token: Token,
  area: NonNullable<BattleMap['dnd5ePluginAreas']>[number],
  pointTarget = false,
): boolean {
  const col = Math.floor((token.x - map.gridOffsetX) / Math.max(1, map.gridSize))
  const row = Math.floor((token.y - map.gridOffsetY) / Math.max(1, map.gridSize))
  if (!area.cells.some((cell) => cell.col === col && cell.row === row)) return false
  const gasBottom=mapGeometryTokenElevation(geometry,token)
  if(gasExcludedAt(map,area,token,gasBottom,pointTarget?gasBottom:gasBottom+(mapGeometryEntityBodyHeightFeet(token)??5),pointTarget?0:Math.max(1,token.size)*map.gridSize/2))return false
  if (area.vertical?.mode !== 'volume') return true
  const tokenBase = mapGeometryTokenElevation(geometry, token)
  const tokenTop = tokenBase + Math.max(0.1, mapGeometryEntityBodyHeightFeet(token) ?? 5)
  const areaBase = area.vertical.baseElevationFeet
  const areaTop = areaBase + area.vertical.heightFeet
  const overlapBase = Math.max(tokenBase, areaBase)
  if (!groveVolumeOverlaps(area.groveVolume, token, pointTarget ? tokenBase : overlapBase,
    pointTarget ? 0 : Math.max(0, Math.min(tokenTop, areaTop) - overlapBase))) return false
  if (pointTarget) return tokenBase >= areaBase - 1e-4 && tokenBase < areaTop - 1e-4
  return tokenTop > areaBase + 1e-4 && tokenBase < areaTop - 1e-4
}

function persistentHeavyObscurationBlocksSight(input: {
  map: BattleMap
  geometry?: MapGeometryState
  viewer: Token
  target: Token
  distanceFeet: number
  blindsightRangeFeet: number
  pointTarget?: boolean
}): boolean {
  if (input.distanceFeet <= input.blindsightRangeFeet) return false
  const gridSize = Math.max(1, input.map.gridSize)
  const offsetX = input.map.gridOffsetX ?? 0
  const offsetY = input.map.gridOffsetY ?? 0
  const viewerElevation = mapGeometryTokenElevation(input.geometry, input.viewer)
  const targetElevation = mapGeometryTokenElevation(input.geometry, input.target)
  const viewerEyeHeight = (mapGeometryEntityBodyHeightFeet(input.viewer) ?? 5) / 2
  const targetEyeHeight = input.pointTarget ? 0 : (mapGeometryEntityBodyHeightFeet(input.target) ?? 5) / 2
  const distance = Math.hypot(input.target.x - input.viewer.x, input.target.y - input.viewer.y)
  const steps = Math.max(2, Math.ceil(distance / Math.max(1, gridSize / 4)))
  return (input.map.dnd5ePluginAreas ?? []).some((area) => {
    if (area.obscuration?.kind !== 'heavy') return false
    if (area.obscuration.scope === 'source-token') {
      return !input.pointTarget && input.target.id === area.sourceTokenId && input.viewer.id !== area.sourceTokenId
    }
    if (area.obscurationExcludedTokenIds?.includes(input.viewer.id)) return false
    if (area.obscuration.sourceCanSeeThrough && area.sourceTokenId === input.viewer.id) return false
    const endpointInside = tokenIntersectsPersistentArea(input.map, input.geometry, input.viewer, area) ||
      tokenIntersectsPersistentArea(input.map, input.geometry, input.target, area, input.pointTarget)
    if (endpointInside) return true
    const cells = new Set(area.cells.map((cell) => `${cell.col}:${cell.row}`))
    for (let index = 1; index < steps; index += 1) {
      const ratio = index / steps
      const point = {
        x: input.viewer.x + (input.target.x - input.viewer.x) * ratio,
        y: input.viewer.y + (input.target.y - input.viewer.y) * ratio,
      }
      const key = `${Math.floor((point.x - offsetX) / gridSize)}:${Math.floor((point.y - offsetY) / gridSize)}`
      if (!cells.has(key)) continue
      const rayHeight = viewerElevation + viewerEyeHeight +
        ((targetElevation + targetEyeHeight) - (viewerElevation + viewerEyeHeight)) * ratio
      if (!gasExcludedAt(input.map, area, point, rayHeight) && groveVolumeOverlaps(area.groveVolume, point, rayHeight) &&
        persistentAreaOverlapsHeight(input.geometry, input.map, area, rayHeight, 0.1)) return true
    }
    return false
  })
}

function mapGeometryCanSeeTarget(input: {
  geometry?: MapGeometryState
  map: BattleMap
  viewer: Token
  target: Token
  forceEnabled?: boolean
  fallbackRangeFeet?: number
  worldMinute?: number
  viewerHeightFeet?: number
  targetHeightFeet?: number
  pointTarget?: boolean
  character?: unknown
  monster?: unknown
  viewerBlinded?: boolean
}): boolean {
  const geometry = input.geometry
  if (!dnd5eInitialSpaceAllowsPerception(input.viewer.dnd5eCombatState?.activeEffects, {
    mapId: input.map.id, x: input.target.x, y: input.target.y,
    elevationFeet: mapGeometryTokenElevation(geometry, input.target),
  })) return false
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const profile = compileDnd5eEffectiveVisionProfile({
    token: input.viewer,
    character: input.character,
    monster: input.monster,
    fallbackRangeFeet: input.fallbackRangeFeet ??
      geometry?.vision.defaultRangeFeet ??
      DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  })
  if (profile.sightRangeLimitFeet == null && !profile.blindBeyondBlindsight && !geometry?.vision.enabled && !input.forceEnabled &&
    !(geometry?.darknessFog && fogCoversPoint(geometry.darknessFog, input.target.x, input.target.y))) return true
  const carriedLightRangeFeet = campaignLightIsActive(input.viewer.lightSource, input.worldMinute ?? 0)
    ? (input.viewer.lightSource?.brightRadiusFeet ?? 0) + (input.viewer.lightSource?.dimRadiusFeet ?? 0)
    : 0
  const rangeFeet = Math.max(
    mapGeometryAmbientSightRangeFeet(input.map, geometry, input.forceEnabled),
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
  const targetRadiusPx = input.pointTarget ? 0 : gridSize * Math.max(1, input.target.size) * 0.4
  const distancePx = Math.max(
    0,
    Math.hypot(input.target.x - input.viewer.x, input.target.y - input.viewer.y) - targetRadiusPx,
  )
  if (distancePx > rangePx) return false
  const illumination = mapGeometryIlluminationAtPoint({
    geometry,
    map: input.map,
    tokens: input.map.tokens,
    viewer: input.viewer,
    point: input.target,
    elevationFeet: mapGeometryTokenElevation(geometry, input.target),
    worldMinute: input.worldMinute,
  })
  const distanceFeet = distancePx / Math.max(1, input.map.gridSize) * feetPerCell
  if (profile.sightRangeLimitFeet != null && distanceFeet > Math.max(profile.sightRangeLimitFeet, profile.blindsightRangeFeet)) return false
  if (profile.blindBeyondBlindsight && distanceFeet > Math.max(profile.blindsightRangeFeet, profile.truesightRangeFeet)) return false
  if ((input.viewerBlinded || input.viewer.dnd5eSourceSightDisabled) && (profile.blindsightRangeFeet <= 0 || distanceFeet > profile.blindsightRangeFeet)) return false
  if (persistentHeavyObscurationBlocksSight({
    map: input.map,
    geometry,
    viewer: input.viewer,
    target: input.target,
    distanceFeet,
    blindsightRangeFeet: profile.blindsightRangeFeet,
    pointTarget: input.pointTarget,
  })) return false
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
  const viewerHeightFeet = Math.max(
    0.1,
    input.viewerHeightFeet ?? mapGeometryEntityBodyHeightFeet(input.viewer) ?? 5,
  )
  const targetHeightFeet = input.pointTarget ? 0 : Math.max(
    0.1,
    input.targetHeightFeet ?? mapGeometryEntityBodyHeightFeet(input.target) ?? 5,
  )
  return targetSamples.some((sample) => {
    const fromElevationFeet = mapGeometryTokenElevation(geometry, input.viewer)
    const toElevationFeet = mapGeometryTokenElevation(geometry, input.target)
    if (rayBlocked({
      geometry,
      map: input.map,
      from: input.viewer,
      to: sample,
      fromElevationFeet,
      toElevationFeet,
      fromEyeHeightFeet: viewerHeightFeet / 2,
      toEyeHeightFeet: targetHeightFeet / 2,
      purpose: 'vision',
    })) return false
    return !persistentAreaBlocksRay({
      geometry,
      map: input.map,
      from: input.viewer,
      to: sample,
      fromElevationFeet,
      toElevationFeet,
      fromEyeHeightFeet: viewerHeightFeet / 2,
      toEyeHeightFeet: targetHeightFeet / 2,
      purpose: 'vision',
    })
  })
}

export function mapGeometryCanSeeToken(input: Omit<Parameters<typeof mapGeometryCanSeeTarget>[0], 'pointTarget'>): boolean {
  return mapGeometryCanSeeTarget(input)
}

/** Exact point: no creature footprint padding or raised target eye samples. */
export function mapGeometryCanSeePoint(input: Omit<Parameters<typeof mapGeometryCanSeeTarget>[0], 'target' | 'pointTarget' | 'targetHeightFeet'> & {
  point: MapGeometryPoint & { elevationFeet?: number }
}): boolean {
  if (![input.point.x, input.point.y, input.point.elevationFeet ?? 0].every(Number.isFinite)) return false
  return mapGeometryCanSeeTarget({ ...input, forceEnabled: true, pointTarget: true,
    target: { id: 'visibility-point', type: 'obstacle', label: '', emoji: '', color: '', size: 1, ...input.point },
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
      sunlight?: true
      areaOnly?: true
      emissionArea?: Dnd5ePluginArea
      /** Uniform illumination inside a structure, rather than a radial lamp. */
      structureVolume?: { points: MapGeometryPoint[]; bottomFeet: number; topFeet: number; illumination: 'dim' | 'bright' }
      brightRadiusFeet: number
      dimRadiusFeet: number
      suppressesMagicalDarknessThroughLevel?: number
    }
  | {
      kind: 'magical-darkness'
      radiusFeet: number
      suppressesMagicalLightThroughLevel?: number
      lightSuppressionScope?: 'within-area'
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
  const extended = left.kind === 'light' && left.emissionArea ? left : right.kind === 'light' && right.emissionArea ? right : undefined
  if (extended?.kind === 'light' && extended.emissionArea) {
    const other = extended === left ? right : left
    const nearest = rectangularLightOrigin(map, extended.emissionArea, { ...other.point, elevationFeet: other.elevationFeet })!
    const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize)
    return Math.hypot((nearest.x-other.point.x)*scale, (nearest.y-other.point.y)*scale,
      nearest.elevationFeet-other.elevationFeet) <= spellLightingRadius(left)+spellLightingRadius(right)
  }
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
    if (lighting?.kind === 'light' && lighting.emission === 'rectangle-volume' &&
      !rectangularLightOrigin(map, area, { x: 0, y: 0, elevationFeet: 0 })) return []
    const anchors = area.lightingAnchorCells?.length ? area.lightingAnchorCells : [area.anchorCell ?? area.cells[0]].filter(Boolean)
    if (!lighting || lighting.kind === 'reduce-light' || anchors.length === 0) return []
    const anchorToken = area.anchorTokenId
      ? map.tokens.find((token) => token.id === area.anchorTokenId)
      : undefined
    return anchors.flatMap((anchor, anchorIndex): MapGeometrySpellLightingSource[] => {
      if (!anchor) return []
      const point = anchorToken && area.vertical?.mode === 'volume' && area.vertical.shape === 'sphere'
        ? { x: anchorToken.x, y: anchorToken.y }
        : {
        x: map.gridOffsetX + (anchor.col + 0.5) * Math.max(1, map.gridSize),
        y: map.gridOffsetY + (anchor.row + 0.5) * Math.max(1, map.gridSize),
      }
      const elevationFeet = area.vertical?.mode === 'volume' && area.vertical.shape === 'sphere' && !anchorToken
        ? area.vertical.baseElevationFeet + area.vertical.heightFeet / 2
        : lighting.kind === 'light' && area.vertical?.mode === 'volume' && !anchorToken
        ? area.vertical.baseElevationFeet
        : anchorToken
        ? mapGeometryTokenElevation(geometry, anchorToken)
        : mapGeometryTerrainElevationAtPoint(geometry, point)
      return lighting.kind === 'light'
      ? [{
          id: `spell-light:${area.id}:${anchorIndex}`,
          areaId: area.id,
          point,
          elevationFeet,
          spellLevel: lighting.spellLevel,
          color: lighting.color,
          kind: 'light',
          sunlight: lighting.sunlight,
          areaOnly: lighting.areaOnly,
          emissionArea: lighting.emission === 'rectangle-volume' ? area : undefined,
          brightRadiusFeet: lighting.brightRadiusFeet,
          dimRadiusFeet: lighting.dimRadiusFeet,
          suppressesMagicalDarknessThroughLevel: lighting.suppressesMagicalDarknessThroughLevel,
        }]
      : [{
          id: `spell-darkness:${area.id}:${anchorIndex}`,
          areaId: area.id,
          point,
          elevationFeet,
          spellLevel: lighting.spellLevel,
          color: '#0f102a',
          kind: 'magical-darkness',
          radiusFeet: lighting.radiusFeet,
          suppressesMagicalLightThroughLevel: lighting.suppressesMagicalLightThroughLevel,
          lightSuppressionScope: lighting.lightSuppressionScope,
        }]
    })
  })
  for (const structure of geometry?.structureLifetimes ?? []) {
    const ward = structure.templeWard, volume = structure.objectBoundary
    if (!ward || ward.lighting === 'none' || !volume) continue
    const point = volume.points.reduce((sum, p) => ({ x: sum.x + p.x / volume.points.length, y: sum.y + p.y / volume.points.length }), { x: 0, y: 0 })
    const radius = Math.max(...volume.points.map(p => Math.hypot(p.x - point.x, p.y - point.y))) / Math.max(1, map.gridSize) * Math.max(1, map.feetPerCell ?? 5)
    candidates.push({ id: `structure-light:${structure.id}`, areaId: structure.id, point,
      elevationFeet: (volume.bottomFeet + volume.topFeet) / 2, spellLevel: 7, color: '#fff4d6', kind: 'light', areaOnly: true,
      structureVolume: { ...volume, illumination: ward.lighting },
      brightRadiusFeet: ward.lighting === 'bright' ? radius : 0, dimRadiusFeet: ward.lighting === 'dim' ? radius : 0 })
  }
  return candidates.filter((candidate) => !candidates.some((other) => {
    if (other.id === candidate.id || other.kind === candidate.kind || !spellLightingOverlaps(candidate, other, map)) {
      return false
    }
    return candidate.kind === 'magical-darkness'
      ? (other.kind === 'light' &&
          (other.suppressesMagicalDarknessThroughLevel ?? -1) >= candidate.spellLevel)
      : (other.kind === 'magical-darkness' &&
          other.lightSuppressionScope !== 'within-area' &&
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
  // Manually painted scene darkness has no spell level and is removed by the DM.
  if (input.obstacle.darknessSpellLevel == null) return false
  const darknessLevel = input.obstacle.darknessSpellLevel
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

/** A continuous wall emits through its own opaque volume, but not other areas. */
function continuousSpellLightBlocked(source: MapGeometrySpellLightingSource, map: BattleMap,
  geometry: MapGeometryState | undefined, from: MapGeometryPoint, fromElevationFeet: number,
  to: MapGeometryPoint, toElevationFeet: number): boolean {
  const ray = { geometry, map, from, to, fromElevationFeet, toElevationFeet, purpose: 'vision' as const }
  if (source.kind !== 'light' || !source.emissionArea) return !!rayBlocked(ray)
  const otherAreas = { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area => area.id !== source.areaId)
    .map(area => area.obscuration?.kind === 'heavy' && area.obscuration.scope !== 'source-token'
      ? { ...area, blocking: { ...area.blocking, vision: true } } : area) }
  const exactRay = { ...ray, map: otherAreas, fromEyeHeightFeet: 0, toEyeHeightFeet: 0 }
  return !!rayBlocked(exactRay) || !!persistentAreaBlocksRay(exactRay)
}

/** Resolve a continuous emitter at the point being illuminated. */
export function mapGeometrySpellLightAtPoint(source: MapGeometrySpellLightingSource, map: BattleMap,
  point: MapGeometryPoint, elevationFeet: number, geometry?: MapGeometryState): MapGeometrySpellLightingSource {
  if (source.kind !== 'light' || !source.emissionArea) return source
  const nearest = rectangularLightOrigin(map, source.emissionArea, {...point,elevationFeet})
  if (nearest && !continuousSpellLightBlocked(source,map,geometry,nearest,nearest.elevationFeet,point,elevationFeet)) {
    return {...source,point:{x:nearest.x,y:nearest.y},elevationFeet:nearest.elevationFeet}
  }
  const origins = rectangularLightCandidateOrigins(map, source.emissionArea, { ...point, elevationFeet },
    mapGeometrySegments(geometry).filter(segment => segment.blocksVision).flatMap(segment => [segment.a, segment.b]),
      mapGeometrySegments(geometry).filter(segment => segment.blocksVision))
  const visible = (candidate: {x:number;y:number;elevationFeet:number}) => !continuousSpellLightBlocked(source,map,geometry,candidate,candidate.elevationFeet,point,elevationFeet)
  const found = origins.find(visible)
  const origin = found ? refineRectangularLightOrigin(map,source.emissionArea,{...point,elevationFeet},found,visible) : origins[0]
  return origin ? { ...source, point: { x: origin.x, y: origin.y }, elevationFeet: origin.elevationFeet } : source
}

/** One source's contribution, shared by authority and light-mask generation.
 * Global darkness suppression and ambient composition belong to the caller. */
export function mapGeometrySpellLightContributionAtPoint(input: {
  source: MapGeometrySpellLightingSource
  map: BattleMap
  point: MapGeometryPoint
  geometry?: MapGeometryState
  elevationFeet?: number
}): 'bright' | 'dim' | 'darkness' {
  const elevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, input.point)
  const source = mapGeometrySpellLightAtPoint(input.source, input.map, input.point, elevation, input.geometry)
  return resolvedSpellLightContribution(source, input.map, input.point, elevation, input.geometry)
}

function resolvedSpellLightContribution(source: MapGeometrySpellLightingSource, map: BattleMap,
  point: MapGeometryPoint, elevationFeet: number, geometry?: MapGeometryState): 'bright' | 'dim' | 'darkness' {
  if (source.kind !== 'light' || !spellLightingAffectsPoint(source, point, map, elevationFeet)) return 'darkness'
  if (source.structureVolume) return source.structureVolume.illumination
  if (continuousSpellLightBlocked(source, map, geometry, source.point, source.elevationFeet, point, elevationFeet)) return 'darkness'
  const distanceFeet = Math.hypot(Math.hypot(point.x-source.point.x, point.y-source.point.y) /
    Math.max(1, map.gridSize) * Math.max(1, map.feetPerCell ?? 5), elevationFeet-source.elevationFeet)
  return source.areaOnly || distanceFeet <= source.brightRadiusFeet ? 'bright' : 'dim'
}

function spellLightingAffectsPoint(
  source: MapGeometrySpellLightingSource,
  point: MapGeometryPoint,
  map: BattleMap,
  elevationFeet = 0,
): boolean {
  if (source.kind === 'light' && source.structureVolume) {
    const volume = source.structureVolume
    return elevationFeet >= volume.bottomFeet && elevationFeet < volume.topFeet && mapGeometryPointInPolygon(point, volume.points)
  }
  if(source.kind==='light' && source.areaOnly){
    const area=map.dnd5ePluginAreas?.find(area=>area.id===source.areaId)
    if(!area)return false
    const col=Math.floor((point.x-map.gridOffsetX)/Math.max(1,map.gridSize)),row=Math.floor((point.y-map.gridOffsetY)/Math.max(1,map.gridSize))
    return area.cells.some(cell=>cell.col===col&&cell.row===row) &&
      (area.vertical?.mode!=='volume'||elevationFeet>=area.vertical.baseElevationFeet && elevationFeet<area.vertical.baseElevationFeet+area.vertical.heightFeet)
  }
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const horizontalDistanceFeet = Math.hypot(point.x - source.point.x, point.y - source.point.y) /
    Math.max(1, map.gridSize) * feetPerCell
  const distanceFeet = Math.hypot(
    horizontalDistanceFeet,
    elevationFeet - source.elevationFeet,
  )
  return distanceFeet <= spellLightingRadius(source)
}

/** Explicit persistent-area sunlight, independent of ordinary bright ambient light. */
export function mapGeometrySunlightAtPoint(input: Parameters<typeof mapGeometryIlluminationAtPoint>[0]): boolean {
  const elevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, input.point)
  if (mapGeometryIlluminationAtPoint(input) === 'magical-darkness') return false
  const sources = mapGeometrySpellLightingSources(input.map, input.geometry)
    .map(source => mapGeometrySpellLightAtPoint(source, input.map, input.point, elevation, input.geometry))
  const darkness = sources.filter(source => source.kind === 'magical-darkness' &&
    spellLightingAffectsPoint(source, input.point, input.map, elevation))
  return sources.some(source => source.kind === 'light' && source.sunlight &&
    darkness.every(dark => dark.kind === 'magical-darkness' && dark.lightSuppressionScope === 'within-area' &&
      source.spellLevel > (dark.suppressesMagicalLightThroughLevel ?? 9)) &&
    spellLightingAffectsPoint(source, input.point, input.map, elevation) &&
    !continuousSpellLightBlocked(source, input.map, input.geometry, source.point, source.elevationFeet, input.point, elevation))
}

export function mapGeometryFlameLightConcealed(input: {
  map: BattleMap; geometry?: MapGeometryState; light?: FlameLight; source: FlameLightPoint; observer: FlameLightPoint;
}): boolean {
  return flameLightConcealed({ ...input, areas: input.map.dnd5ePluginAreas, contains: (area, point) => {
    const grid = Math.max(1, input.map.gridSize)
    const col = Math.floor((point.x - input.map.gridOffsetX) / grid), row = Math.floor((point.y - input.map.gridOffsetY) / grid)
    const elevation = point.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, point)
    if (!area.cells.some(cell => cell.col === col && cell.row === row) ||
      !persistentAreaOverlapsHeight(input.geometry, input.map, area, elevation, 0.1)) return false
    if (!area.occupantModifiers?.requiresLineOfEffectFromAnchor) return true
    if (!area.anchorCell) return false
    const anchor = { x: input.map.gridOffsetX + (area.anchorCell.col + 0.5) * grid, y: input.map.gridOffsetY + (area.anchorCell.row + 0.5) * grid }
    return !mapGeometryLineOfEffectBlocked({ map: input.map, geometry: input.geometry, from: anchor, to: point,
      fromElevationFeet: area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : mapGeometryTerrainElevationAtPoint(input.geometry, anchor), toElevationFeet: elevation })
  } })
}

/** Clip the already wall-limited light polygon using the same point predicate as visibility. */
export function mapGeometryConcealedFlamePolygon(input: {
  map: BattleMap; geometry?: MapGeometryState; light?: FlameLight; source: FlameLightPoint;
  polygon: readonly MapGeometryPoint[]; viewers?: readonly Token[];
}): MapGeometryPoint[] {
  if (!isFlameLight(input.light) || !input.map.dnd5ePluginAreas?.some(area => area.concealsFlameLightFromOutside)) return [...input.polygon]
  if (input.viewers?.length && input.viewers.every(viewer => mapGeometryFlameLightConcealed({ ...input,
    observer: { ...viewer, elevationFeet: mapGeometryTokenElevation(input.geometry, viewer) } }))) return []
  return input.polygon.map(end => {
    const length = Math.hypot(end.x - input.source.x, end.y - input.source.y)
    const steps = Math.max(1, Math.ceil(length / Math.max(1, input.map.gridSize / 4)))
    const pointAt = (t: number) => ({ x: input.source.x + (end.x - input.source.x) * t, y: input.source.y + (end.y - input.source.y) * t })
    for (let step = 1; step <= steps; step++) {
      const hiPoint = pointAt(step / steps)
      if (!mapGeometryFlameLightConcealed({ ...input, observer: hiPoint })) continue
      let lo = (step - 1) / steps, hi = step / steps
      for (let iteration = 0; iteration < 16; iteration++) {
        const mid = (lo + hi) / 2
        if (mapGeometryFlameLightConcealed({ ...input, observer: pointAt(mid) })) hi = mid
        else lo = mid
      }
      return pointAt(lo)
    }
    return end
  })
}

export function mapGeometryIlluminationAtPoint(input: Parameters<typeof mapGeometryBaseIlluminationAtPoint>[0]): MapGeometryIllumination {
  const illumination = mapGeometryBaseIlluminationAtPoint(input)
  if (illumination !== 'bright' && illumination !== 'dim') return illumination
  const elevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, input.point)
  const grid = Math.max(1, input.map.gridSize)
  const feet = Math.max(1, input.map.feetPerCell ?? 5)
  const reduced = (input.map.dnd5ePluginAreas ?? []).some(area => {
    if (area.lighting?.kind !== 'reduce-light') return false
    const anchorId = area.anchorTokenId ?? (area.anchorMode === 'source-token' ? area.sourceTokenId : undefined)
    const anchorToken = anchorId ? input.map.tokens.find(token => token.id === anchorId) : undefined
    // A missing bound source must not leave illumination at its stale stored cell.
    if (anchorId && !anchorToken) return false
    const cell = area.anchorCell ?? area.cells[0]
    const projectedOrigin = area.lightingOnly ? area.lightingOrigin : undefined
    if (!anchorToken && !cell && !projectedOrigin) return false
    const point = projectedOrigin ?? anchorToken ?? { x: input.map.gridOffsetX + (cell.col + 0.5) * grid,
      y: input.map.gridOffsetY + (cell.row + 0.5) * grid }
    const sourceElevation = projectedOrigin ? projectedOrigin.elevationFeet : anchorToken ? mapGeometryTokenElevation(input.geometry, anchorToken)
      : mapGeometryTerrainElevationAtPoint(input.geometry, point)
    if (Math.hypot(Math.hypot(point.x - input.point.x, point.y - input.point.y) / grid * feet,
      sourceElevation - elevation) > area.lighting.radiusFeet) return false
    return !rayBlocked({ geometry: input.geometry, map: input.map, from: point, to: input.point,
      fromElevationFeet: sourceElevation, toElevationFeet: elevation, purpose: 'vision' })
  })
  return reduced ? (illumination === 'bright' ? 'dim' : 'darkness') : illumination
}

function mapGeometryBaseIlluminationAtPoint(input: {
  geometry?: MapGeometryState
  map: BattleMap
  tokens?: readonly Token[]
  viewer?: Token
  point: MapGeometryPoint
  elevationFeet?: number
  worldMinute?: number
}): MapGeometryIllumination {
  const ambient = input.geometry?.vision.ambientLight ?? 'bright'
  const pointElevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, input.point)
  const spellLighting = mapGeometrySpellLightingSources(input.map, input.geometry)
    .map(source => mapGeometrySpellLightAtPoint(source, input.map, input.point, pointElevation, input.geometry))
  const localDarkness = spellLighting.filter((source) => source.kind === 'magical-darkness' &&
    spellLightingAffectsPoint(source, input.point, input.map, pointElevation))
  const penetratingLights = localDarkness.length === 0 ? [] : spellLighting.filter((light) => light.kind === 'light' &&
    localDarkness.every((dark) => dark.kind === 'magical-darkness' && dark.lightSuppressionScope === 'within-area' &&
      light.spellLevel > (dark.suppressesMagicalLightThroughLevel ?? 9)) &&
    spellLightingAffectsPoint(light, input.point, input.map, pointElevation) &&
    (light.structureVolume || !continuousSpellLightBlocked(light, input.map, input.geometry,
      light.point, light.elevationFeet, input.point, pointElevation)))
  if ((input.geometry?.darknessFog && fogCoversPoint(input.geometry.darknessFog, input.point.x, input.point.y)) || input.geometry?.obstacles.some((obstacle) =>
    obstacle.magicalDarkness === true && mapGeometryPointInPolygon(input.point, obstacle.points) &&
      mapGeometryObstacleAffectsElevation(obstacle, pointElevation) &&
      !mapGeometryMagicalDarknessObstacleIsSuppressed({
        obstacle, map: input.map, geometry: input.geometry, spellLighting,
      }),
  ) || (localDarkness.length > 0 && penetratingLights.length === 0)) return 'magical-darkness'
  if (localDarkness.length > 0) {
    // Ambient daylight and mundane lamps cannot brighten the surviving darkness.
    return penetratingLights.some(light => light.kind === 'light' && (light.structureVolume ? light.structureVolume.illumination === 'bright' : (light.areaOnly || Math.hypot(
      Math.hypot(light.point.x - input.point.x, light.point.y - input.point.y) /
        Math.max(1, input.map.gridSize) * Math.max(1, input.map.feetPerCell ?? 5),
      light.elevationFeet - pointElevation,
    ) <= light.brightRadiusFeet))) ? 'bright' : 'dim'
  }
  const gridSize = Math.max(1, input.map.gridSize)
  const areaCell = {
    col: Math.floor((input.point.x - input.map.gridOffsetX) / gridSize),
    row: Math.floor((input.point.y - input.map.gridOffsetY) / gridSize),
  }
  const illuminationOverrides = (input.map.dnd5ePluginAreas ?? [])
    .filter((area) => area.illuminationOverride &&
      area.cells.some((cell) => cell.col === areaCell.col && cell.row === areaCell.row) &&
      persistentAreaOverlapsHeight(input.geometry, input.map, area, pointElevation, 0.1))
    .map((area) => area.illuminationOverride!)
  if (illuminationOverrides.includes('darkness')) return 'darkness'
  if (illuminationOverrides.includes('dim')) return 'dim'
  if (ambient === 'bright') return 'bright'
  let result: MapGeometryIllumination = ambient
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  for (const source of input.tokens ?? input.map.tokens) {
    const light = source.lightSource
    const sourcePoint = { ...source, elevationFeet: mapGeometryTokenElevation(input.geometry, source) }
    if ([{ ...input.point, elevationFeet: pointElevation }, ...(input.viewer ? [{ ...input.viewer, elevationFeet: mapGeometryTokenElevation(input.geometry, input.viewer) }] : [])].some(observer =>
      mapGeometryFlameLightConcealed({ ...input, light, source: sourcePoint, observer }))) continue
    if (!campaignLightIsActive(light, input.worldMinute ?? 0)) continue
    const distanceFeet = Math.hypot(input.point.x - source.x, input.point.y - source.y) / gridSize * feetPerCell
    const brightRadius = Math.max(0, light?.brightRadiusFeet ?? 0)
    const dimRadius = brightRadius + Math.max(0, light?.dimRadiusFeet ?? 0)
    if (distanceFeet > dimRadius) continue
    if (rayBlocked({
      geometry: input.geometry,
      map: input.map,
      from: source,
      to: input.point,
      fromElevationFeet: mapGeometryTokenElevation(input.geometry, source),
      toElevationFeet: pointElevation,
      purpose: 'vision',
    })) continue
    if (distanceFeet <= brightRadius) return 'bright'
    result = 'dim'
  }
  for (const rawSource of input.geometry?.lights ?? []) {
    const source = projectControlledFlameLight(rawSource, input.worldMinute ?? 0)
    if (!campaignLightIsActive(source, input.worldMinute ?? 0)) continue
    const point = source.points[0]
    const sourcePoint = { ...point, elevationFeet: mapGeometryAbsoluteElevationAtPoint(input.geometry, point, source.elevationFeet) }
    if ([{ ...input.point, elevationFeet: pointElevation }, ...(input.viewer ? [{ ...input.viewer, elevationFeet: mapGeometryTokenElevation(input.geometry, input.viewer) }] : [])].some(observer =>
      mapGeometryFlameLightConcealed({ ...input, light: source, source: sourcePoint, observer }))) continue
    const distanceFeet = Math.hypot(input.point.x - point.x, input.point.y - point.y) / gridSize * feetPerCell
    const dimRadius = source.brightRadiusFeet + source.dimRadiusFeet
    if (distanceFeet > dimRadius) continue
    if (rayBlocked({
      geometry: input.geometry,
      map: input.map,
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
    const contribution = resolvedSpellLightContribution(source, input.map, input.point, pointElevation, input.geometry)
    if (contribution === 'bright') return 'bright'
    if (contribution === 'dim') result = 'dim'
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
  purpose?: 'vision' | 'line-of-effect'
  targetElevationFeet?: number
}): MapGeometryPoint[] {
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const radius = Math.max(0, input.radiusFeet) / feetPerCell * Math.max(1, input.map.gridSize)
  if (radius <= 0) return []
  const elevation = input.elevationFeet ?? 0
  const blockers = mapGeometrySegments(input.geometry)
    .filter(segment => input.purpose === 'line-of-effect' ? segment.blocksLineOfEffect : segment.blocksVision)
    .map(segment => input.purpose === 'line-of-effect' ? { ...segment, blocksVision: true } : segment)
  const angles = new Set<number>()
  const samples = input.purpose === 'line-of-effect' ? 256 : 96
  for (let index = 0; index < samples; index += 1) angles.add(index / samples * Math.PI * 2)
  for (const segment of blockers) {
    for (const point of [segment.a, segment.b]) {
      if (Math.hypot(point.x - input.source.x, point.y - input.source.y) > radius + 1) continue
      const angle = Math.atan2(point.y - input.source.y, point.x - input.source.x)
      angles.add(angle - 1e-5)
      angles.add(angle)
      angles.add(angle + 1e-5)
    }
  }
  // atan2 returns negative angles, while circular samples use [0, 2π).
  // Normalize before sorting so the boundary winds once without crossing itself.
  return [...new Set([...angles].map(angle => (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)))]
    .sort((left, right) => left - right)
    .map((angle) => {
      const far = { x: input.source.x + Math.cos(angle) * radius, y: input.source.y + Math.sin(angle) * radius }
      return nearestRayPoint(
        input.source,
        angle,
        radius,
        blockers,
        elevation,
        input.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(input.geometry, far),
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
  const origin = { x: input.viewer.x, y: input.viewer.y }
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const profile = compileDnd5eEffectiveVisionProfile({
    token: input.viewer,
    fallbackRangeFeet: input.fallbackRangeFeet ??
      geometry?.vision.defaultRangeFeet ??
      DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  })
  if (!geometry?.vision.enabled && !input.forceEnabled && profile.sightRangeLimitFeet == null) return []
  const lightRangeFeet = campaignLightIsActive(input.viewer.lightSource, input.worldMinute ?? 0)
    ? (input.viewer.lightSource?.brightRadiusFeet ?? 0) + (input.viewer.lightSource?.dimRadiusFeet ?? 0)
    : 0
  // 明亮或微光环境中的普通视野延伸到地图边界；黑暗、特殊感官和场景
  // 光源仍由 LightingLayer 与服务端可见性投影共同约束。
  // 服务端仍会单独过滤未被照亮的生物，因此不会因地形可见而泄露隐藏 Token。
  let rangeFeet = profile.blindBeyondBlindsight
    ? Math.min(Math.max(profile.blindsightRangeFeet, profile.truesightRangeFeet), Number.isFinite(input.rangeOverrideFeet) ? Math.max(0, input.rangeOverrideFeet!) : Infinity)
    : input.viewer.dnd5eSourceSightDisabled
    ? Math.min(profile.blindsightRangeFeet, Number.isFinite(input.rangeOverrideFeet) ? Math.max(0, input.rangeOverrideFeet!) : profile.blindsightRangeFeet)
    : Number.isFinite(input.rangeOverrideFeet)
    ? Math.max(0, input.rangeOverrideFeet!)
    : Math.max(
        mapGeometryAmbientSightRangeFeet(input.map, geometry),
        profile.normalRangeFeet,
        profile.darkvisionRangeFeet,
        profile.darknessSightRangeFeet,
        profile.magicalDarknessSightRangeFeet,
        profile.blindsightRangeFeet,
        profile.truesightRangeFeet,
        lightRangeFeet,
      )
  if (profile.sightRangeLimitFeet != null) rangeFeet = Math.min(rangeFeet, Math.max(profile.sightRangeLimitFeet, profile.blindsightRangeFeet))
  if (rangeFeet <= 0) return []
  const radius = Math.max(1, rangeFeet / feetPerCell * Math.max(1, input.map.gridSize))
  const elevation = mapGeometryTokenElevation(geometry, input.viewer)
  const blockers = [
    ...(geometry ? mapGeometrySegments(geometry) : []).filter((segment) => segment.blocksVision),
    ...persistentAreaVisionSegments(input.map, geometry, input.viewer),
  ]
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
  // atan2 returns negative angles, while circular samples use [0, 2π).
  // Normalize before sorting so the boundary winds once without crossing itself.
  const polygon = [...new Set([...angles].map(angle => (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)))]
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
  return clipDnd5eInitialSpaceVision(polygon, input.viewer.dnd5eCombatState?.activeEffects, input.map.id)
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
