import {captureDnd5eAreaObjects} from '../persistentAreaObjectCapture'
import {dnd5eAnimatedObjectSnapshot} from '../animatedObjectSnapshot'
import { rectangularPrism, rectangularPrismCells } from '../../../../shared/rectangular-prism.mjs'
import { dnd5eTokenIntersectsPersistentAreaAt } from '../persistentAreaGeometry'
import { dnd5eMapTokenDistanceFeet } from '../verticalCombatGeometry'
import { isIndependentCorpseSummon, validDelayedSourceIdentity, type Dnd5eDelayedSourceIdentity } from './dnd5eIndependentCorpseSummon'
import { mapGeometrySurfaceMaterialAtElevation } from '../../../lib/mapGeometry'
import { selectVerticalMaterialSurface } from '../verticalMaterialSurface'
import {mapGeometryWithObjectSurfaces} from '../mapObjectSurfaceGeometry'
import {selectHorizontalMaterialSurface} from '../horizontalMaterialSurface'
import { verticalSurfaceCells } from '../verticalSurfaceCells'
import { dnd5eOwnsPersistentArea } from '../persistentAreaOwnership'
import { resolveRemoteAreaDismissal } from '../remoteAreaDismissal'
import {fortressAreaPlacement,structureAreaPlacement} from '../fortressAreaPlacement'
import {prepareDnd5eTempleStructure} from '../templeStructure'
import {dnd5eTempleWardAt} from '../templeWardGeometry'
import { terrainMultiplierAtPoint } from '../../../lib/mapPathfinding'
import {placeDnd5eFortressFurnishings} from '../fortressFurnishings'
import { dnd5eSpellMaterialConsumptionPlan } from '../spellMaterials'
import { dnd5eInventoryItemTemplate } from '../items'
import { dnd5eMapPhysicalItemTemplate } from '../mapInventoryItemAuthoring'
import { resolveDnd5ePointProjectileImpact } from '../pointProjectileImpact'
import { dnd5eActivityGroundWithinVerticalRange } from './dnd5eActivityTargetExclusions'
import { prepareDnd5eMapWeaponEnchantment } from '../mapInventoryWeaponEnchantment'
import { bindDnd5eResolvedGroundWeaponEffect } from './dnd5eGroundWeaponEffect'
import { droppedDnd5eCompanionObjects } from '../companionCarriedObjects'
import { mapGeometrySurfaceMaterialAtPoint, mapGeometryFootprintTerrainSamples } from '../../../lib/mapGeometry'
import { prepareLooseEarthTransfer } from '../looseEarthTransfer'
import { prepareDnd5eWaterAppearanceMapChange } from '../controlledWaterMap'
import {prepareMaterialVolumeTransformation,materialTransformationExecutionId} from '../materialVolumeTransformation'
import {prepareHostFallingMaterialTransformation} from '../fallingMaterialTransformation'
import { normalizeDnd5eGroveActivitySelection } from '../druidGroveActivityPlacement'
import { dnd5eGroveCastIdentity } from '../druidGroveCastIdentity'
import { prepareDnd5eDruidGroveAreaBundle } from '../druidGroveAreaBundle'
import {prepareDnd5eMightyFortressStructure,type Dnd5eFortressLayoutSelection} from '../mightyFortressStructure'
import {placeDnd5eMightyFortressServants} from '../mightyFortressServants'
import {prepareDnd5eStructureEmergence} from '../structureEmergence'
import { settleDnd5eMapItemConversion } from '../mapItemConversion'
import { dnd5eHasLivingSummonBond } from '../livingSummonBond'
import { igniteDnd5eWebAreasFromFire, extinguishDnd5eWebAreaCells } from '../webAreaRules'
import { dnd5eUndeadCreationIsProtected } from '../undeadCreationProtection'
import { changeDnd5ePersistentAreaMode, projectDnd5ePersistentAreaMode, resolveDnd5ePersistentAreaModeState } from '../persistentAreaModes'
import { planDnd5eMapObjectFlightAtAnchor, planDnd5eMapObjectLanding, planDnd5eHarmlessObjectPushAtAnchor } from '../mapObjectFlight'
import { captureDnd5eObjectFlightDeparture } from '../mapObjectFlightDeparture'
import { resolvePersistentAreaEntityImpact } from '../persistentAreaRemoval'
import { damageGeometryEntity } from '../../../../shared/map-geometry-durability.mjs'
import { dnd5eMappedVerticalDisplacement } from '../verticalDisplacement'
import { bindDnd5eAreaRestraints } from '../bindAreaRestraints'
import { dnd5ePersistentAreaDirectionalMovementCostAt, dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from '../persistentAreaGeometry'
import { activeRestAreaSession } from '../../../../shared/rest-bound-areas.mjs'
import { dnd5eInstantAoeAffectsTokenVertically, dnd5eTokenToPointDistanceFeet } from '../verticalCombatGeometry'
import { persistentAreaMovementScope } from '../persistentAreaMovementScope'
import { normalizeDnd5ePersistentAreaSourceLimit } from '../persistentAreaSourceLimit'
import { planDnd5ePersistentAreaCarry } from '../persistentAreaCarry'
import { resolveGroundedSphereElevation } from './groundedSphereElevation'
import type { SharedCampaignTimeState } from '../../../lib/campaignTime'
import { creatureSizeToFootprintCells } from '../../../lib/monsterTypes'
import { getDnd5eSrdMonster, getDnd5eSrdMonsterBySlug } from '../monsters'
import { normalizeDnd5ePersistentRectGeometry, type Dnd5ePersistentRectGeometry } from '../persistentAreaRectGeometry'
import { annularAreaOverlapsBox } from '../../../../shared/annular-area-geometry.mjs'
import { tokenFootprintCells } from '../../../lib/gridCombat'
import { resolveDnd5ePersistentAreaTriggerSourceDc, type Dnd5ePersistentAreaTriggerSnapshot } from '../persistentAreaTypes'
import type { Dnd5eActivityCapabilityProposal } from './dnd5eActivityExecutor'
import { dnd5ePluginSpellDefinition } from '../plugins/pluginContentCatalog'
import { detachDnd5eUncontrolledSummon } from '../summonedControl'
import { createTokenMovementAnimation } from '../../../lib/tokenMovementAnimation'
import type { InitiativeEntry } from '../../../components/map/InitiativeTracker'
import { resolveSpellAreaObstruction, spellAreaPointElevation, dnd5eAreaPlacementMatchesSurface } from '../spellAreaObstruction'
import { dnd5eActivityPointVisible } from '../activityPointVisibility'
import { dnd5eEntitySupportElevation } from '../entitySupport'
import { mapTokenBodyHeight } from '../../../lib/mapTokenOccupancy'
import { createDnd5eMapCombatSnapshot } from '../mapBridge'
import { dnd5eCombatantCanSee } from '../headlessCombatEngine'
import { prepareDnd5eControlledFlameMapChange } from '../controlledFlameMap'
import { extinguishDnd5eAreaFlames } from '../areaFlameExtinguishing'
import { freezeDnd5eWaterWallsFromArea } from '../waterWallFreezing'
import { prepareDnd5eAreaFlameReach } from '../areaFlameReach'
import { igniteUnattendedFuelInVolume } from '../areaFuelIgnition'
import {
  DND_FEET_PER_CELL,
  cellDistance,
  cellKey,
  cellToPixel,
  mapCellExtent,
  pixelToCell,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  tokenFootprintDistanceCells,
  type GridCell,
} from '../../../lib/gridCombat'
import {
  mapGeometryIlluminationAtPoint,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryLineOfSightBlocked,
  mapGeometryLineOfEffectBlocked,
  mapGeometryTokenElevation,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  type MapGeometryEntityPatch,
  type MapGeometryLight,
} from '../../../lib/mapGeometry'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../../../lib/opportunityAttacks'
import { findMapGeometryPath } from '../../../lib/mapPathfinding'
import {
  aoeOrientFromCell,
  canPlaceAoe,
  cellsForAoe,
  cellTouchesOrientedRect,
  gridAlignedRectBounds,
  tokensInCells,
  type SkillAoeTargeting,
  type SkillAoeDimensionSelection,
  resolveAoeDimensions,
} from '../../../lib/skillTargeting'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../../store/maps'
import { dnd5eInterpositionAnchorCell, moveDnd5eCoreSpellArea, reconcileDnd5ePersistentAreaAnchors } from '../coreSpellAreas'
import {
  dnd5eRestoredSummonedOriginalObject,
  planDnd5eSummonedCreature,
} from '../summonedCreatures'
import { normalizeDnd5eMapObjectStateV1, type Dnd5eArcaneLockStateV1 } from '../mapObjectState'
import type { Dnd5eActivityAuthorityHandoffs } from '../headlessCombatEngine'
import type {
  Dnd5eActivityAreaPlacementV1,
  Dnd5eActivityDefinitionV1,
} from './dnd5eActivityContracts'

export interface Dnd5eActivityAreaMapSelectionV1 {
  rectGeometry?: Dnd5ePersistentRectGeometry
  anchorCell: GridCell
  cells: readonly GridCell[]
  targetIds: readonly string[]
  areaPlacement: Dnd5eActivityAreaPlacementV1
  areaPlacementDistanceFeet: number
}

export interface Dnd5eActivityMapHandoffSelectionV1 {
  flamesByOperationId?: Readonly<Record<string, { lightId: string; mapId?: string; destinationId?: string; effectId?: string }>>
  watersByOperationId?: Readonly<Record<string,
    { waterId: string; region: { center: { x: number; y: number }; dimensionsFeet: { x: number; y: number; z: number }; baseElevationFeet: number } }
    | { dismissEffectId: string }>>
  summonCells?: readonly GridCell[]
  movementCellsByOperationId?: Readonly<Record<string, GridCell & { elevationFeet?: number }>>
  summonInitiativeD20s?: readonly number[]
}

export function dnd5eActivityMovementSelectionKeyV1(input: {
  operationId: string
  targetId: string
}): string {
  return `${input.operationId}:${input.targetId}`
}

export interface Dnd5eActivityMapHandoffResultV1 {
  ok: true
  /** Actual new map areas, including every independently created subarea. */
  createdAreaIds: readonly string[]
  persistentEntityResults?: readonly {
    operationId: string; areaId: string; label: string; damageImmune: boolean
    savingThrow?: import('../persistentAreaRemoval').DmPersistentAreaEntityImpactResolution['savingThrow']
    immuneConditions?: readonly string[]
  }[]
  /** Host budget after replacing reserved movement with actual path cost. */
  actorMovementRemainingFeet?: number
  map: BattleMap
  boundCharacters?: readonly import('../../../types/character').Character[]
  boundCharacterIds?: readonly string[]
  changedTokenIds: readonly string[]
  carriedTargetIds?: readonly string[]
  sphereSweeps?: readonly { areaId: string; startArea: Dnd5ePluginArea; path: readonly {x:number;y:number;elevationFeet:number}[] }[]
  /** Targets actually displaced by an accepted, declared harmful operation. */
  harmfulMovementTargetIds?: readonly string[]
  /** Summons replaced by this atomic map transaction; callers must prune their initiative slots. */
  removedTokenIds: readonly string[]
  initiativeEntries: readonly InitiativeEntry[]
  geometryDoorPatches: readonly {
    entityId: string
    patch: MapGeometryEntityPatch
  }[]
  geometryLightUpserts: readonly MapGeometryLight[]
  structureGeometry?: import('../../../lib/mapGeometry').MapGeometryState
  otherMapGeometryUpdates?: readonly import('../../../lib/mapGeometry').MapGeometryState[]
  otherMapLightUpserts?: readonly { mapId: string; light: MapGeometryLight }[]
  otherMapAreaDismissals?: readonly { mapId: string; area: NonNullable<BattleMap['dnd5ePluginAreas']>[number] }[]
  geometryEntityPatches?: readonly { entityId: string; patch: MapGeometryEntityPatch }[]
  movementPaths: readonly {
    operationId: string
    targetId: string
    path: readonly { x: number; y: number }[]
    to: { x: number; y: number }
    provokesOpportunityAttacks: boolean
  }[]
  /** Areas whose snapshotted `on-detonate` triggers must be settled, then removed. */
  endedAreaIds?: readonly string[]
  detonatedAreaIds: readonly string[]
}

export type Dnd5eActivityMapHandoffFailureV1 = {
  ok: false
  reason:
    | 'activity-area-required'
    | 'invalid-actor-token'
    | 'invalid-persistent-area'
    | 'invalid-summon-placement'
    | 'delayed-summon-placement-unsupported'
    | 'invalid-movement-placement'
    | 'invalid-map-object-selection'
}

function mapTokenSizeRank(token: Token): number {
  const rankBySize = {
    tiny: 0,
    small: 1,
    medium: 2,
    large: 3,
    huge: 4,
    gargantuan: 5,
  } as const
  if (token.creatureSize && token.creatureSize in rankBySize) {
    return rankBySize[token.creatureSize as keyof typeof rankBySize]
  }
  if (token.size >= 4) return 5
  if (token.size >= 3) return 4
  if (token.size >= 2) return 3
  return 2
}

function tokensOccupyingCells(
  map: BattleMap,
  cells: readonly GridCell[],
): Token[] {
  const keys = new Set(cells.map(cellKey))
  return map.tokens.filter((token) =>
    tokenOccupiedCellsAt(token, map, token).some((cell) => keys.has(cellKey(cell))),
  )
}

function activityAreaAnchorIsOccupied(
  map: BattleMap,
  anchorCell: GridCell,
  sizeFeet: number | undefined,
): boolean {
  if (sizeFeet == null || sizeFeet <= 0) return false
  const size = Math.max(1, Math.ceil(sizeFeet / Math.max(1, map.feetPerCell ?? 5)))
  const position = tokenCenterForAnchorCell(anchorCell, { size }, map)
  const footprintToken: Token = {
    id: 'activity-area-anchor-preview', label: '', color: '#000000', emoji: '',
    size, type: 'obstacle', ...position,
  }
  const footprint = new Set(tokenOccupiedCellsAt(footprintToken, map, footprintToken).map(cellKey))
  return map.tokens.some((token) =>
    tokenOccupiedCellsAt(token, map, token).some((cell) => footprint.has(cellKey(cell))),
  )
}

function isTruePolymorphObjectToCreatureHandoff(input: {
  activity: Dnd5eActivityDefinitionV1
  handoffs: Dnd5eActivityAuthorityHandoffs
}): boolean {
  return input.activity.id === 'spell:true-polymorph' &&
    input.handoffs.summons.length === 1 &&
    input.handoffs.summons[0]?.persistAfterConcentrationCompletes === true
}

/** Converts the closed Activity geometry vocabulary into the production map template. */
export function dnd5eActivityMapTemplateV1(
  activity: Dnd5eActivityDefinitionV1,
): SkillAoeTargeting | undefined {
  const target = activity.target
  if (target.kind !== 'area') return undefined
  if (target.shape === 'cone') return {
    shape: 'cone', origin: target.origin === 'point' ? 'point' : 'self', lengthFeet: target.lengthFeet ?? 5,
    placeRangeFeet: target.origin === 'point' ? target.placeRangeFeet : undefined,
    rotatable: target.origin === 'point' ? true : undefined,
    minimumLengthFeet: target.minimumLengthFeet,
    aimRangeFeet: target.placeRangeFeet,
  }
  if (target.shape === 'line') return {
    shape: 'line', origin: 'self', widthFeet: target.widthFeet ?? 5,
    lengthFeet: target.lengthFeet ?? 5, minimumWidthFeet: target.minimumWidthFeet,
    minimumLengthFeet: target.minimumLengthFeet, aimRangeFeet: target.placeRangeFeet,
  }
  if (target.shape === 'rect' || target.shape === 'cube') return {
    shape: 'rect', origin: 'point', widthFeet: target.widthFeet ?? target.radiusFeet ?? 5,
    heightFeet: target.lengthFeet ?? target.heightFeet ?? target.widthFeet ?? 5,
    volumeHeightFeet: target.heightFeet, minimumVolumeHeightFeet: target.minimumHeightFeet,
    gridAligned: target.gridAligned ?? (target.shape === 'cube' ? true : undefined),
    minimumWidthFeet: target.minimumWidthFeet,
    minimumHeightFeet: target.minimumLengthFeet ?? (target.lengthFeet == null ? target.minimumHeightFeet : undefined),
    placeRangeFeet: target.origin === 'self' ? 0 : target.placeRangeFeet,
    rotatable: target.rotatable,
  }
  return {
    volumeHeightFeet: target.shape === 'cylinder' ? target.heightFeet : undefined,
    minimumVolumeHeightFeet: target.shape === 'cylinder' ? target.minimumHeightFeet : undefined,
    shape: 'circle', origin: target.origin === 'event-target' ? 'point' : target.origin,
    radiusFeet: target.radiusFeet ?? target.widthFeet ?? 5,
    wallThicknessFeet: target.wallThicknessFeet,
    minimumRadiusFeet: target.minimumRadiusFeet,
    placeRangeFeet: target.origin === 'self' || target.origin === 'event-target' ? 0 : target.placeRangeFeet,
  }
}

/**
 * Host rebuilds affected cells and targets from the selected anchor. Client
 * supplied target ids are never accepted by this boundary.
 */
export function dnd5eActivityAreaRangeOriginCellV1(input: {
  activity: Dnd5eActivityDefinitionV1; map: BattleMap; actorToken: Token; grantingPersistentAreaId?: string
}): GridCell | undefined {
  if (input.activity.target.kind !== 'area' || input.activity.target.rangeOrigin !== 'granting-area') {
    return tokenAnchorCellFromPixel(input.actorToken.x, input.actorToken.y, input.actorToken, input.map)
  }
  const areas = (input.map.dnd5ePluginAreas ?? []).filter(area =>
    (!input.grantingPersistentAreaId || area.id === input.grantingPersistentAreaId) &&
    area.sourceTokenId === input.actorToken.id &&
    area.grantedActivities?.some(grant => grant.activityId === input.activity.id))
  return areas.length === 1 ? areas[0].anchorCell ?? areas[0].cells[0] : undefined
}

export function resolveDnd5eActivityAreaMapSelectionV1(input: {
  worldMinute?: number
  activity: Dnd5eActivityDefinitionV1
  map: BattleMap
  actorToken: Token
  characters?: readonly import('../../../types/character').Character[]
  grantingPersistentAreaId?: string
  anchorCell: GridCell
  rectRotation?: number
  rectAngleDegrees?: number
  rectPitchDegrees?: number
  rectRollDegrees?: number
  targetElevationFeet?: number
  verticalSurface?: Dnd5eActivityAreaPlacementV1['verticalSurface']
  dimensions?: SkillAoeDimensionSelection
}): Dnd5eActivityAreaMapSelectionV1 | undefined {
  const target = input.activity.target
  const declaredTemplate = dnd5eActivityMapTemplateV1(input.activity)
  const template = declaredTemplate ? resolveAoeDimensions(declaredTemplate, input.dimensions) : undefined
  if (target.kind !== 'area' || !template) return undefined
  const hasTilt = input.rectPitchDegrees != null || input.rectRollDegrees != null
  if (hasTilt && (!target.tiltable || template.shape !== 'rect' || template.gridAligned ||
    [input.rectPitchDegrees ?? 0,input.rectRollDegrees ?? 0].some(angle=>!Number.isFinite(angle)||angle < -180||angle > 180))) return undefined
  if (input.verticalSurface) {
    const geometry = mapGeometryWithObjectSurfaces(input.map,mapGeometryRuntimeForMap(input.map.id),input.characters)
    const operations = input.activity.outcomes.flatMap(outcome=>outcome.operations).filter(operation=>
      operation.kind==='create-persistent-area' && operation.surfaceAtPlacementElevation &&
      operation.requireAllSurfaceMaterials && operation.anchorMode==='fixed')
    const materials = operations.flatMap(operation=>operation.kind==='create-persistent-area'?operation.surfaceMaterials??[]:[])
    if(!geometry || target.origin!=='point' || target.placementSurface==='ground' ||
      (target.instanceCount??1)!==1 || template.shape!=='rect' || !materials.length)return undefined
    const surface = selectVerticalMaterialSurface({geometry,...input.verticalSurface,
      widthFeet:template.widthFeet,heightFeet:template.volumeHeightFeet??target.heightFeet!,
      baseElevationFeet:input.targetElevationFeet!,pixelsPerFoot:input.map.gridSize/(input.map.feetPerCell??5),
      maximumSideFeet:Math.min(target.widthFeet??0,target.heightFeet??0),materials})
    if(!surface)return undefined
    const center={x:(surface.a.x+surface.b.x)/2,y:(surface.a.y+surface.b.y)/2}
    const point={x:center.x+surface.outward.x*0.001,y:center.y+surface.outward.y*0.001,
      elevationFeet:surface.baseElevationFeet+surface.heightFeet/2}
    for(const fragment of surface.fragments??[]){
      const face=fragment.surface,fragmentPoint={x:(face.a.x+face.b.x)/2+face.outward.x*0.001,
        y:(face.a.y+face.b.y)/2+face.outward.y*0.001,elevationFeet:face.baseElevationFeet+face.heightFeet/2}
      const horizontalDistanceFeet=Math.max(Math.abs(input.actorToken.x-fragmentPoint.x),Math.abs(input.actorToken.y-fragmentPoint.y))/input.map.gridSize*(input.map.feetPerCell??5)
      if(dnd5eTokenToPointDistanceFeet({geometry,token:input.actorToken,pointElevationFeet:fragmentPoint.elevationFeet,horizontalDistanceFeet})>(target.placeRangeFeet??0)+1e-4 ||
        mapGeometryLineOfEffectBlocked({geometry,map:input.map,from:input.actorToken,to:fragmentPoint,fromElevationFeet:mapGeometryTokenElevation(geometry,input.actorToken),toElevationFeet:fragmentPoint.elevationFeet}) ||
        (target.requiresLineOfSight&&!dnd5eActivityPointVisible({map:input.map,viewer:input.actorToken,characters:input.characters,worldMinute:input.worldMinute,point:fragmentPoint})))return undefined
    }
    const horizontalDistanceFeet=Math.max(Math.abs(input.actorToken.x-center.x),Math.abs(input.actorToken.y-center.y))/input.map.gridSize*(input.map.feetPerCell??5)
    const distance=dnd5eTokenToPointDistanceFeet({geometry,token:input.actorToken,pointElevationFeet:point.elevationFeet,horizontalDistanceFeet})
    if(distance>(target.placeRangeFeet??0)+1e-4 ||
      mapGeometryLineOfEffectBlocked({geometry,map:input.map,from:input.actorToken,to:point,fromElevationFeet:mapGeometryTokenElevation(geometry,input.actorToken),toElevationFeet:point.elevationFeet}) ||
      (target.requiresLineOfSight && !dnd5eActivityPointVisible({map:input.map,viewer:input.actorToken,characters:input.characters,worldMinute:input.worldMinute,point})))return undefined
    const anchorCell=pixelToCell(point.x,point.y,input.map)
    const extent=mapCellExtent(input.map)
    if(anchorCell.col<0||anchorCell.row<0||anchorCell.col>=extent.cols||anchorCell.row>=extent.rows)return undefined
    const cells=verticalSurfaceCells(surface,input.map)
    if(!cells.length)return undefined
    return {anchorCell,cells,targetIds:[],areaPlacementDistanceFeet:distance,
      areaPlacement:{...center,verticalSurface:{...input.verticalSurface},elevationFeet:surface.baseElevationFeet,
        widthFeet:template.widthFeet,lengthFeet:template.heightFeet,heightFeet:surface.heightFeet}}
  }
  if (input.rectAngleDegrees != null && (
    !Number.isFinite(input.rectAngleDegrees) || input.rectAngleDegrees < 0 || input.rectAngleDegrees >= 360 ||
    (template.shape !== 'rect' && !(template.shape === 'cone' && template.origin === 'point')) || !template.rotatable
  )) return undefined
  const actorCell = tokenAnchorCellFromPixel(
    input.actorToken.x, input.actorToken.y, input.actorToken, input.map,
  )
  // A sphere/circle whose Activity origin is self has no selectable center.
  // Canonicalize at the Host boundary as well as in the UI so a stale or
  // malicious client anchor cannot move a self-centered persistent area.
  const anchorCell = target.origin === 'self' &&
      (target.shape === 'circle' || target.shape === 'sphere')
    ? actorCell
    : input.anchorCell
  const rangeOrigin = dnd5eActivityAreaRangeOriginCellV1(input)
  if (![actorCell.col, actorCell.row, anchorCell?.col, anchorCell?.row,
    rangeOrigin?.col, rangeOrigin?.row, input.rectRotation ?? 0].every(Number.isFinite)) return undefined
  if (!rangeOrigin || !canPlaceAoe(template, rangeOrigin, anchorCell, input.map.feetPerCell)) return undefined
  if (activityAreaAnchorIsOccupied(input.map, anchorCell, target.unoccupiedAnchorSizeFeet)) {
    return undefined
  }
  const orientFrom = aoeOrientFromCell(template, actorCell, anchorCell, {
    rectRotation: input.rectRotation ?? 0,
    rectAngleDegrees: input.rectAngleDegrees,
  })
  let rawCells = cellsForAoe(template, orientFrom, anchorCell, input.map.feetPerCell)
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  let aim = cellToPixel(anchorCell, input.map)
  if (input.targetElevationFeet != null && (!Number.isFinite(input.targetElevationFeet) ||
    input.targetElevationFeet < -1_000 || input.targetElevationFeet > 10_000)) return undefined
  let elevation = target.origin === 'self' ? mapGeometryTokenElevation(geometry, input.actorToken)
    : input.targetElevationFeet ?? spellAreaPointElevation(geometry, aim)
  if(target.maximumBottomHeightAboveGroundFeet!==undefined){
    const grounded=resolveGroundedSphereElevation(target,mapGeometryTerrainElevationAtPoint(geometry,aim),input.targetElevationFeet)
    if(grounded===undefined)return undefined
    elevation=grounded
  }
  if (!dnd5eAreaPlacementMatchesSurface({ target, geometry, point: aim, elevationFeet: elevation })) return undefined
  let propagationOrigin = aim
  if (target.projectileImpact === 'first-solid') {
    const requestedDistance = dnd5eTokenToPointDistanceFeet({ geometry, token: input.actorToken,
      pointElevationFeet: elevation,
      horizontalDistanceFeet: cellDistance(rangeOrigin, anchorCell) * (input.map.feetPerCell ?? 5) })
    if (requestedDistance > (target.placeRangeFeet ?? 0) + 1e-4) return undefined
    const impact = resolveDnd5ePointProjectileImpact({ map: input.map, geometry,
      from: { ...input.actorToken, elevationFeet: mapGeometryTokenElevation(geometry, input.actorToken) },
      to: { ...aim, elevationFeet: elevation } })
    aim = impact.point
    elevation = impact.point.elevationFeet
    propagationOrigin = impact.effectOrigin
    rawCells = cellsForAoe(template, orientFrom, {
      col: (aim.x - input.map.gridOffsetX) / input.map.gridSize - 0.5,
      row: (aim.y - input.map.gridOffsetY) / input.map.gridSize - 0.5,
    }, input.map.feetPerCell)
  }
  if (!target.projectileImpact && target.origin !== 'self' && target.requiresLineOfEffect !== false && mapGeometryLineOfEffectBlocked({ geometry, map: input.map, from: input.actorToken, to: aim, fromElevationFeet: mapGeometryTokenElevation(geometry, input.actorToken), toElevationFeet: elevation })) return undefined
  if (target.requiresLineOfSight && !dnd5eActivityPointVisible({ map: input.map, viewer: input.actorToken,
    worldMinute: input.worldMinute,
    characters: input.characters, point: { ...aim, elevationFeet: elevation } })) return undefined
  let tiltedArea: Dnd5ePluginArea | undefined
  let volumeBottom = elevation, volumeHeight = template.volumeHeightFeet
  if (hasTilt && template.shape === 'rect') {
    const dc=anchorCell.col-orientFrom.col,dr=anchorCell.row-orientFrom.row,magnitude=Math.hypot(dc,dr)
    tiltedArea={id:'placement-preview',pluginId:'placement-preview',featureId:input.activity.id,
      sourceTokenId:input.actorToken.id,sourceCharacterId:input.actorToken.characterId??input.actorToken.id,
      label:input.activity.name,color:'#fff',createdRound:0,expiresAfterRound:0,anchorCell,cells:[],
      rectGeometry:{lengthFeet:template.heightFeet,widthFeet:template.widthFeet,gridAligned:false,
        direction:magnitude?{dc:dc/magnitude,dr:dr/magnitude}:{dc:1,dr:0},
        pitchDegrees:input.rectPitchDegrees??0,rollDegrees:input.rectRollDegrees??0},
      vertical:{mode:'volume',baseElevationFeet:elevation,heightFeet:template.volumeHeightFeet??target.heightFeet!}}
    const projected=rectangularPrismCells(input.map,tiltedArea)
    if(!projected?.length)return undefined
    tiltedArea.cells=projected;rawCells=projected
    const prism=rectangularPrism(input.map,tiltedArea)!
    const halfHeight=prism.half.reduce((sum,n,i)=>sum+n*Math.abs(prism.axes[i][2]),0)
    volumeBottom=prism.center.elevationFeet-halfHeight;volumeHeight=halfHeight*2
  }
  const obstruction = resolveSpellAreaObstruction({
    spellId: input.activity.authorityBinding?.kind === 'core-spell-transaction' ? input.activity.authorityBinding.spellId : undefined,
    map: input.map, geometry, cells: rawCells, area: template,
    origin: template.origin === 'point' ? propagationOrigin : input.actorToken, elevationFeet: volumeBottom,
    heightFeet: volumeHeight, rectangularVolume: tiltedArea,
    ignoresWalls: target.requiresLineOfEffect === false,
    spreadsAroundCorners: target.spreadsAroundCorners,
    propagationCover: target.propagationCover,
  })
  // Grove authorizes the complete cube first. Its Host placement pass excludes
  // structures and samples ground height; a hill must not cut the cube into a
  // line-of-effect footprint that can no longer pass the volume handoff.
  const completeSiteVolume = input.activity.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'create-persistent-area' && (operation.utilityProjectionId === 'druid-grove' || operation.utilityProjectionId === 'mighty-fortress')))
  const cells = (completeSiteVolume ? rawCells : obstruction.cells).filter(cell =>
    dnd5eActivityGroundWithinVerticalRange(target, elevation, mapGeometryTerrainElevationAtPoint(geometry, cellToPixel(cell, input.map))))
  // Use the same perception rules as final Headless settlement, including
  // invisible targets and special senses. Point visibility alone is insufficient.
  const perception = target.requiresVisibleTargets ? createDnd5eMapCombatSnapshot({
    combatId: `area-perception:${input.map.id}`, map: input.map,
    characters: input.characters ?? [], worldMinute: input.worldMinute,
    initiativeOrder: input.map.tokens.filter(token => token.type !== 'obstacle').map(token => ({
      tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0,
    })),
  }).state : undefined
  const targetIds = tokensInCells(input.map, input.map.tokens, rawCells)
    .filter((token) => {
      if (target.wallThicknessFeet != null && template.shape === 'circle' &&
        !annularAreaOverlapsBox({anchorCell,circularGeometry:{radiusFeet:template.radiusFeet,innerRadiusFeet:template.radiusFeet-target.wallThicknessFeet}},
          input.map,token,tokenFootprintCells(token)*input.map.gridSize/2)) return false
      if (token.type === 'obstacle') return false
      if (!dnd5eActivityGroundWithinVerticalRange(target, elevation, mapGeometryTerrainElevationAtPoint(geometry, token))) return false
      if (target.requiresGroundContact && Math.abs(mapGeometryTokenElevation(geometry, token) - mapGeometryTerrainElevationAtPoint(geometry, token)) > 1e-4) return false
      if (perception && !dnd5eCombatantCanSee(perception, input.actorToken.id, token.id)) return false
      // A tilted persisted area already clips its cells and tests exact body
      // intersection below, just like its later trigger collector. A second
      // center ray would reject partially exposed bodies only in preview.
      if (!tiltedArea && !obstruction.affectsToken(token)) return false
      if (token.id === input.actorToken.id && target.includeSelf !== true) return false
      const opposed = areOpposedCombatTokens(input.actorToken, token)
      if (target.relation === 'ally' && opposed) return false
      if (target.relation === 'enemy' && !opposed) return false
      if (tiltedArea) return dnd5eTokenIntersectsPersistentAreaAt(token,input.map,tiltedArea,token,cells)
      return dnd5eInstantAoeAffectsTokenVertically({
        spellId: `plugin:${input.activity.id}`, area: template, map: input.map, geometry,
        sourceToken: input.actorToken, targetToken: token,
        effectOrigin: template.origin === 'point' ? aim : input.actorToken,
        effectOriginElevationFeet: elevation,
        effectHeightFeet: ['rect', 'cube', 'cylinder'].includes(target.shape) ? target.heightFeet : undefined,
        effectAim: template.shape === 'cone' && template.origin === 'point'
          ? cellToPixel({ col: 2 * anchorCell.col - orientFrom.col, row: 2 * anchorCell.row - orientFrom.row }, input.map) : aim,
        effectAimElevationFeet: elevation,
      })
    })
    .map((token) => token.id)
    .slice(0, target.selection === 'choose-any' ? undefined : target.maximumTargets)
  const anchor = target.projectileImpact ? aim : cellToPixel(anchorCell, input.map)
  const directionalAngleDegrees = template.shape === 'cone' && template.origin === 'point'
    ? input.rectAngleDegrees ?? ((input.rectRotation ?? 0) % 4) * 90
    : target.rotatable && (target.shape === 'line' || target.shape === 'cone')
      ? ((Math.atan2(anchorCell.row - actorCell.row, anchorCell.col - actorCell.col) * 180 / Math.PI) + 360) % 360
    : target.rotatable
      ? input.rectAngleDegrees ?? ((input.rectRotation ?? 0) % 4) * 90
      : undefined
  return {
    rectGeometry: tiltedArea?.rectGeometry ?? (template.shape === 'rect' ? {
      widthFeet: template.widthFeet,
      lengthFeet: template.heightFeet,
      gridAligned: template.gridAligned === true,
      direction: (() => {
        const dc = anchorCell.col - orientFrom.col, dr = anchorCell.row - orientFrom.row
        const magnitude = Math.hypot(dc, dr)
        return magnitude > 0 ? { dc: dc / magnitude, dr: dr / magnitude } : { dc: 1, dr: 0 }
      })(),
    } : undefined),
    anchorCell: { ...anchorCell },
    cells: cells.map((cell) => ({ ...cell })),
    targetIds,
    areaPlacementDistanceFeet: cellDistance(rangeOrigin, anchorCell) * Math.max(1, input.map.feetPerCell ?? 5),
    areaPlacement: {
      x: anchor.x,
      y: anchor.y,
      elevationFeet: elevation,
      angleDegrees: directionalAngleDegrees,
      ...(hasTilt ? {pitchDegrees:input.rectPitchDegrees??0,rollDegrees:input.rectRollDegrees??0} : {}),
      radiusFeet: 'radiusFeet' in template ? template.radiusFeet : undefined,
      lengthFeet: template.shape === 'rect' && target.lengthFeet != null ? template.heightFeet : 'lengthFeet' in template ? template.lengthFeet : target.lengthFeet,
      widthFeet: 'widthFeet' in template ? template.widthFeet : target.widthFeet,
      heightFeet: template.volumeHeightFeet ?? target.heightFeet,
    },
  }
}

/** Uses the complete declared volume, never the wall-clipped occupied cells. */
export function dnd5eActivityMovementOriginCellV1(input: {
  activity: Dnd5eActivityDefinitionV1
  map: BattleMap
  actorToken: Token
  directionOrigin?: 'actor' | 'area-center'
  areaSelection?: Pick<Dnd5eActivityAreaMapSelectionV1, 'anchorCell' | 'areaPlacement'>
  legacyOriginCell?: GridCell
}): GridCell | undefined {
  if (input.directionOrigin !== 'area-center') return input.directionOrigin === undefined && input.legacyOriginCell
    ? input.legacyOriginCell : tokenAnchorCellFromPixel(input.actorToken.x, input.actorToken.y, input.actorToken, input.map)
  const target = input.activity.target, selection = input.areaSelection
  if (target.kind !== 'area' || !selection || ['line', 'cone'].includes(target.shape)) return undefined
  const anchor = selection.anchorCell
  if (!Number.isFinite(anchor.col) || !Number.isFinite(anchor.row)) return undefined
  if ((target.shape === 'cube' || target.shape === 'rect') && (target.gridAligned ?? target.shape === 'cube')) {
    const width = selection.areaPlacement.widthFeet ?? target.widthFeet ?? target.radiusFeet ?? 5
    const length = selection.areaPlacement.lengthFeet ?? target.lengthFeet ?? target.heightFeet ?? width
    const bounds = gridAlignedRectBounds(anchor, width, length, input.map.feetPerCell)
    return { col: bounds.firstCol + (bounds.widthCells - 1) / 2, row: bounds.firstRow + (bounds.heightCells - 1) / 2 }
  }
  return { ...anchor }
}

export function validMovementDestination(input: {
  requiresDifferentDestination?: true
  destinationPolicy?: 'adjacent-space'
  map: BattleMap
  characters?: readonly import('../../../types/character').Character[]
  worldMinute?: number
  actorToken: Token
  targetToken: Token
  destination: GridCell & { elevationFeet?: number }
  mode: 'push' | 'pull' | 'forced' | 'voluntary' | 'teleport'
  distanceFeet: number
  maximumMovementCostFeet?: number
  verticalDestination?: 'area-top' | 'ground'
  maximumDistanceFromActorFeet?: number
  continuationTargetRadiusFeet?: number
  continuationTargetIds?: readonly string[]
  originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
  destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
  requiresLineOfSight?: boolean
  requiresVisibleDestination?: boolean
  usesTargetReactionIfAvailable?: boolean
  /** Directional push/pull origin supplied by a Host-owned area entity. */
  directionOriginCell?: GridCell
}): { position: { x: number; y: number; elevationFeet?: number }; path: readonly { x: number; y: number }[]; pathElevationsFeet?: readonly number[]; movementCostFeet: number } | undefined {
  // Map selectors may receive persisted/module data. NaN otherwise bypasses range and bounds comparisons.
  if (!Number.isFinite(input.destination?.col) || !Number.isFinite(input.destination?.row) ||
    !Number.isFinite(input.distanceFeet) || input.distanceFeet < 0 ||
    !Number.isFinite(input.actorToken.x) || !Number.isFinite(input.actorToken.y) ||
    !Number.isFinite(input.targetToken.x) || !Number.isFinite(input.targetToken.y) ||
    (input.directionOriginCell != null && (!Number.isFinite(input.directionOriginCell.col) || !Number.isFinite(input.directionOriginCell.row)))) return undefined
  const origin = tokenAnchorCellFromPixel(
    input.targetToken.x, input.targetToken.y, input.targetToken, input.map,
  )
  const actorCell = tokenAnchorCellFromPixel(
    input.actorToken.x, input.actorToken.y, input.actorToken, input.map,
  )
  const actor = input.directionOriginCell ?? actorCell
  const movementFeet = cellDistance(origin, input.destination) * Math.max(1, input.map.feetPerCell ?? 5)
  const distanceLimit = input.destinationPolicy === 'adjacent-space'
    ? Math.max(1, input.map.feetPerCell ?? 5) : input.distanceFeet
  if (input.destinationPolicy === 'adjacent-space' &&
      (!['forced', 'voluntary'].includes(input.mode) || cellDistance(origin, input.destination) !== 1)) return undefined
  if (!Number.isFinite(movementFeet) || movementFeet > distanceLimit) return undefined
  if (input.continuationTargetRadiusFeet != null) {
    const to = tokenCenterForAnchorCell(input.destination, input.targetToken, input.map)
    const geometry = mapGeometryRuntimeForMap(input.map.id)
    const elevation = input.targetToken.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, to)
    const adjacent = input.map.tokens.some(anchor => input.continuationTargetIds?.includes(anchor.id) &&
      Math.max(tokenFootprintDistanceCells({...input.targetToken,...to}, anchor, input.map) * Math.max(1,input.map.feetPerCell??5),
        Math.abs(elevation-(anchor.elevationFeet??mapGeometryTerrainElevationAtPoint(geometry,anchor)))) <= input.continuationTargetRadiusFeet!)
    if (!adjacent) return undefined
  }
  if (movementFeet === 0 && input.requiresDifferentDestination) return undefined
  if (movementFeet === 0 && input.verticalDestination !== 'ground') {
    return {
      position: { x: input.targetToken.x, y: input.targetToken.y },
      path: [{ x: input.targetToken.x, y: input.targetToken.y }],
      movementCostFeet: 0,
    }
  }
  const beforeActorDistance = cellDistance(actor, origin)
  const afterActorDistance = cellDistance(actor, input.destination)
  if (input.mode === 'push' && afterActorDistance <= beforeActorDistance) return undefined
  if (input.mode === 'pull' && afterActorDistance >= beforeActorDistance) return undefined
  const { cols, rows } = mapCellExtent(input.map)
  const destinationPoint = tokenCenterForAnchorCell(input.destination, input.targetToken, input.map)
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const terrainElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, destinationPoint)
  const selectedLanding = input.mode === 'teleport' && input.verticalDestination === 'ground'
    ? input.destination.elevationFeet ?? terrainElevationFeet : undefined
  if (selectedLanding != null && (!Number.isFinite(selectedLanding) || Math.abs(dnd5eEntitySupportElevation({
    map: input.map, geometry, token: { ...input.targetToken, ...destinationPoint },
    terrainElevationFeet, elevationFeet: selectedLanding,
  }) - selectedLanding) > 1e-4)) return undefined
  const to = input.mode === 'teleport' && input.verticalDestination === 'ground'
    ? { ...destinationPoint, elevationFeet: selectedLanding }
    : { ...destinationPoint, elevationFeet: input.targetToken.elevationFeet }
  const destinationToken = { ...input.targetToken, ...to }
  const footprint = tokenOccupiedCellsAt(input.targetToken, input.map, to)
  const occupied = new Set(input.map.tokens
    .filter((token) => token.id !== input.targetToken.id && (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
    .filter(token => {
      if (selectedLanding == null) return true
      const base = token.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, token)
      return selectedLanding < base + mapTokenBodyHeight(token) &&
        selectedLanding + mapTokenBodyHeight(input.targetToken) > base
    })
    .flatMap((token) => tokenOccupiedCellsAt(token, input.map, token))
    .map(cellKey))
  const actorElevation = input.actorToken.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, input.actorToken)
  const targetElevation = to.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, to)
  if (input.maximumDistanceFromActorFeet != null && Math.max(
    cellDistance(actorCell, input.destination) * Math.max(1, input.map.feetPerCell ?? 5),
    Math.abs(targetElevation - actorElevation),
  ) > input.maximumDistanceFromActorFeet) return undefined
  const originIllumination = mapGeometryIlluminationAtPoint({
    geometry, map: input.map, tokens: input.map.tokens,
    point: input.targetToken, elevationFeet: input.targetToken.elevationFeet,
  })
  const destinationIllumination = mapGeometryIlluminationAtPoint({
    geometry, map: input.map, tokens: input.map.tokens,
    point: to, elevationFeet: to.elevationFeet,
  })
  if (
    footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
    footprint.some((cell) => occupied.has(cellKey(cell))) ||
    mapGeometryPlacementBlocked({ geometry, map: input.map, token: destinationToken, at: to }).blocked ||
    (input.originIllumination != null && !input.originIllumination.some((value) => value === originIllumination)) ||
    (input.destinationIllumination != null && !input.destinationIllumination.some((value) => value === destinationIllumination)) ||
    (input.requiresVisibleDestination === true && !dnd5eActivityPointVisible({
      map: input.map, viewer: input.actorToken, characters: input.characters, worldMinute: input.worldMinute,
      point: to,
    })) ||
    (input.requiresLineOfSight === true && mapGeometryLineOfSightBlocked({
      geometry, map: input.map, from: input.targetToken, to,
      fromElevationFeet: input.targetToken.elevationFeet,
      toElevationFeet: to.elevationFeet,
    })) ||
    (input.mode !== 'teleport' && input.mode !== 'voluntary' && mapGeometryMovementBlocked({
      geometry, map: input.map, token: input.targetToken, to,
    }).blocked)
  ) return undefined
  let path: readonly { x: number; y: number }[] = [
    { x: input.targetToken.x, y: input.targetToken.y },
    to,
  ]
  let movementCostFeet = movementFeet
  let pathElevationsFeet: readonly number[] | undefined
  if (input.usesTargetReactionIfAvailable || input.mode === 'voluntary') {
    const legalPath = findMapGeometryPath({
      map: input.map,
      geometry,
      token: input.targetToken,
      to,
      additionalDifficultTerrainMultiplier: (token, position) => dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
      additionalSpeedCostMultiplier: (token, position) => dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
      additionalMovementCostPerFoot: (token, from, to) => dnd5ePersistentAreaDirectionalMovementCostAt({ map: input.map, token, from, to }),
    })
    const budget = input.maximumMovementCostFeet ?? input.distanceFeet
    if (!Number.isFinite(budget) || budget < 0 || !legalPath || legalPath.distanceFeet > distanceLimit || legalPath.movementCostFeet > budget) return undefined
    path = legalPath.points
    pathElevationsFeet = legalPath.elevationsFeet
    movementCostFeet = legalPath.movementCostFeet
  }
  return { position: to, path, movementCostFeet, ...(pathElevationsFeet ? {pathElevationsFeet} : {}) }
}

/**
 * Finds the farthest legal forced-movement destination without asking the DM
 * to hand-pick a square. Walls, token footprints and map bounds use the same
 * validator that will run again at final handoff commit.
 */
export function dnd5eActivityAutomaticDirectionalMovementCellV1(input: {
  map: BattleMap
  actorToken: Token
  targetToken: Token
  mode: 'push' | 'pull'
  distanceFeet: number
  directionOriginCell?: GridCell
}): GridCell {
  const targetOrigin = tokenAnchorCellFromPixel(
    input.targetToken.x,
    input.targetToken.y,
    input.targetToken,
    input.map,
  )
  const directionOrigin = input.directionOriginCell ?? tokenAnchorCellFromPixel(
    input.actorToken.x,
    input.actorToken.y,
    input.actorToken,
    input.map,
  )
  const maximumCells = Math.max(0, Math.floor(
    input.distanceFeet / Math.max(1, input.map.feetPerCell ?? 5),
  ))
  const candidates: Array<{
    cell: GridCell
    originDistance: number
    originManhattanDistance: number
    moved: number
  }> = []
  for (let rowOffset = -maximumCells; rowOffset <= maximumCells; rowOffset += 1) {
    for (let colOffset = -maximumCells; colOffset <= maximumCells; colOffset += 1) {
      const cell = { col: targetOrigin.col + colOffset, row: targetOrigin.row + rowOffset }
      const movement = validMovementDestination({
        map: input.map,
        actorToken: input.actorToken,
        targetToken: input.targetToken,
        destination: cell,
        mode: input.mode,
        distanceFeet: input.distanceFeet,
        directionOriginCell: directionOrigin,
      })
      if (!movement) continue
      candidates.push({
        cell,
        originDistance: cellDistance(directionOrigin, cell),
        originManhattanDistance:
          Math.abs(directionOrigin.col - cell.col) + Math.abs(directionOrigin.row - cell.row),
        moved: cellDistance(targetOrigin, cell),
      })
    }
  }
  candidates.sort((left, right) => {
    const directional = input.mode === 'pull'
      ? left.originDistance - right.originDistance
      : right.originDistance - left.originDistance
    return directional || left.originManhattanDistance - right.originManhattanDistance ||
      right.moved - left.moved ||
      left.cell.row - right.cell.row || left.cell.col - right.cell.col
  })
  return candidates[0]?.cell ?? targetOrigin
}

/** Nearest legal space outside an area. Stable ties; no teleporting through walls or occupied footprints. */
export function dnd5eNearestOutsideAreaMovementV1(input: {
  map: BattleMap
  area: Pick<Dnd5ePluginArea, 'cells'>
  targetTokenId: string
  maximumOutsideDistanceFeet?: number
}): { position: { x: number; y: number }; distanceFeet: number } | undefined {
  if (input.maximumOutsideDistanceFeet !== undefined && (!Number.isFinite(input.maximumOutsideDistanceFeet) ||
    input.maximumOutsideDistanceFeet <= 0)) return undefined
  const target = input.map.tokens.find(token => token.id === input.targetTokenId)
  if (!target || !input.area.cells.length) return undefined
  const covered = new Set(input.area.cells.map(cellKey))
  if (!tokenOccupiedCellsAt(target, input.map, target).some(cell => covered.has(cellKey(cell)))) {
    return { position: { x: target.x, y: target.y }, distanceFeet: 0 }
  }
  const origin = tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
  const extent = mapCellExtent(input.map)
  const candidates: Array<{ cell: GridCell; distance: number }> = []
  for (let row = 0; row < extent.rows; row++) for (let col = 0; col < extent.cols; col++) {
    const cell = { col, row }
    const position = tokenCenterForAnchorCell(cell, target, input.map)
    const footprint = tokenOccupiedCellsAt(target, input.map, position)
    if (footprint.some(cell => covered.has(cellKey(cell)))) continue
    if (input.maximumOutsideDistanceFeet !== undefined && !footprint.some(cell =>
      input.area.cells.some(areaCell => cellDistance(cell, areaCell) * Math.max(1, input.map.feetPerCell ?? 5) <=
        input.maximumOutsideDistanceFeet!))) continue
    candidates.push({ cell, distance: cellDistance(origin, cell) })
  }
  candidates.sort((a, b) => a.distance - b.distance || a.cell.row - b.cell.row || a.cell.col - b.cell.col)
  for (const candidate of candidates) {
    const distanceFeet = candidate.distance * Math.max(1, input.map.feetPerCell ?? 5)
    const movement = validMovementDestination({ map: input.map, actorToken: target, targetToken: target,
      destination: candidate.cell, mode: 'forced', distanceFeet, requiresDifferentDestination: true })
    if (movement) return { position: movement.position, distanceFeet }
  }
  return undefined
}

/** Plans a persistent-area push for atomic Headless/map settlement. A blocked displacement moves zero feet. */
export function dnd5ePersistentAreaPushMovementV1(input: {
  map: BattleMap
  sourceTokenId: string
  targetTokenId: string
  distanceFeet: number
  direction?: { dc: number; dr: number }
  /** Host-owned current area anchor, independent of the original caster position. */
  originCell?: GridCell
  mode?: 'push' | 'pull'
}): { position: { x: number; y: number }; distanceFeet: number } | undefined {
  const source = input.map.tokens.find((token) => token.id === input.sourceTokenId)
  const target = input.map.tokens.find((token) => token.id === input.targetTokenId)
  if (!source || !target || (!input.direction && !input.originCell && source.id === target.id) || !Number.isFinite(input.distanceFeet) || input.distanceFeet <= 0) return undefined
  if (input.originCell && (!Number.isSafeInteger(input.originCell.col) || !Number.isSafeInteger(input.originCell.row) || input.direction)) return undefined
  if (input.direction && (!Number.isFinite(input.direction.dc) || !Number.isFinite(input.direction.dr) ||
    Math.abs(Math.hypot(input.direction.dc, input.direction.dr) - 1) > 1e-6)) return undefined
  const targetCell = tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
  const directionOriginCell = input.originCell ?? (input.direction ? { col: targetCell.col - input.direction.dc, row: targetCell.row - input.direction.dr } : undefined)
  const destination = dnd5eActivityAutomaticDirectionalMovementCellV1({
    map: input.map,
    actorToken: source,
    targetToken: target,
    mode: input.mode ?? 'push',
    distanceFeet: input.distanceFeet,
    directionOriginCell,
  })
  const movement = validMovementDestination({
    map: input.map,
    actorToken: source,
    targetToken: target,
    destination,
    mode: input.mode ?? 'push',
    distanceFeet: input.distanceFeet,
    directionOriginCell,
  })
  if (!movement) return { position: { x: target.x, y: target.y }, distanceFeet: 0 }
  const origin = tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
  return { position: movement.position,
    distanceFeet: cellDistance(origin, destination) * Math.max(1, input.map.feetPerCell ?? 5) }
}

/** Compatibility map projection; authoritative area triggers use the shared transaction. */
export function applyDnd5ePersistentAreaForcedMovementV1(input: {
  map: BattleMap
  sourceTokenId: string
  targetTokenId: string
  distanceFeet: number
}): BattleMap | undefined {
  const movement = dnd5ePersistentAreaPushMovementV1(input)
  if (!movement) return undefined
  if (movement.distanceFeet === 0) return input.map
  return {
    ...input.map,
    tokens: input.map.tokens.map((token) => token.id === input.targetTokenId
      ? { ...token, ...movement.position }
      : token),
  }
}

function validSwapPositions(input: {
  map: BattleMap
  actorToken: Token
  targetToken: Token
  distanceFeet: number
}): { actor: { x: number; y: number }; target: { x: number; y: number } } | undefined {
  if (
    input.actorToken.id === input.targetToken.id ||
    areOpposedCombatTokens(input.actorToken, input.targetToken)
  ) return undefined
  const actorAnchor = tokenAnchorCellFromPixel(
    input.actorToken.x, input.actorToken.y, input.actorToken, input.map,
  )
  const targetAnchor = tokenAnchorCellFromPixel(
    input.targetToken.x, input.targetToken.y, input.targetToken, input.map,
  )
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  if (cellDistance(actorAnchor, targetAnchor) * feetPerCell > input.distanceFeet) return undefined
  const actorPosition = tokenCenterForAnchorCell(targetAnchor, input.actorToken, input.map)
  const targetPosition = tokenCenterForAnchorCell(actorAnchor, input.targetToken, input.map)
  const { cols, rows } = mapCellExtent(input.map)
  const occupied = new Set(input.map.tokens
    .filter((token) =>
      token.id !== input.actorToken.id && token.id !== input.targetToken.id &&
      (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
    .flatMap((token) => tokenOccupiedCellsAt(token, input.map, token))
    .map(cellKey))
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const validPlacement = (token: Token, position: { x: number; y: number }) => {
    const footprint = tokenOccupiedCellsAt(token, input.map, position)
    return !(
      footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
      footprint.some((cell) => occupied.has(cellKey(cell))) ||
      mapGeometryPlacementBlocked({ geometry, map: input.map, token, at: position }).blocked
    )
  }
  if (!validPlacement(input.actorToken, actorPosition) || !validPlacement(input.targetToken, targetPosition)) {
    return undefined
  }
  return { actor: actorPosition, target: targetPosition }
}

/** Reconstructs metadata from the authoritative resolved template, including legacy UI handoff shapes. */
function persistentRectGeometryForSelection(
  activity: Dnd5eActivityDefinitionV1, selection: Dnd5eActivityAreaMapSelectionV1 | undefined,
  actorToken: Token, map: BattleMap,
): Dnd5ePersistentRectGeometry | undefined {
  if (!selection || activity.target.kind !== 'area' || !['rect', 'cube'].includes(activity.target.shape)) return undefined
  if (selection.rectGeometry) return normalizeDnd5ePersistentRectGeometry(selection.rectGeometry)
  const placement = selection.areaPlacement
  const actorCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, map)
  // Omitted rotation uses the same zero-degree orientation as the Host cell selector.
  const angle = placement.angleDegrees ?? (activity.target.rotatable ? 0 : undefined)
  const dc = angle == null ? selection.anchorCell.col - actorCell.col : Math.cos((angle - 90) * Math.PI / 180)
  const dr = angle == null ? selection.anchorCell.row - actorCell.row : Math.sin((angle - 90) * Math.PI / 180)
  const magnitude = Math.hypot(dc, dr)
  return normalizeDnd5ePersistentRectGeometry({
    widthFeet: placement.widthFeet ?? activity.target.widthFeet ?? 5,
    lengthFeet: placement.lengthFeet ?? activity.target.lengthFeet ?? 5,
    direction: magnitude > 0 ? { dc: dc / magnitude, dr: dr / magnitude } : { dc: 1, dr: 0 },
    gridAligned: activity.target.gridAligned ?? activity.target.shape === 'cube',
    pitchDegrees: placement.pitchDegrees,
    rollDegrees: placement.rollDegrees,
  })
}

/** Applies map-owned handoffs only after every requested placement is present and valid. */
export function applyDnd5eActivityMapHandoffsV1(input: {
  map: BattleMap
  /** Untrusted placement selections, with separately collected Host classifications. */
  groveSelection?: unknown
  fortressSelection?: Dnd5eFortressLayoutSelection
  templeSelection?: {authorizedCreatureIds:readonly string[];hostileCreatureTypes:readonly import('../../../../shared/temple-ward.mjs').TempleHostileType[];lighting:'none'|'dim'|'bright';layout?:import('../templeLayout').TempleLayout}
  /** Host ability snapshot; never read from player layout selections. */
  sourceAbilityScores?: Partial<Record<import('../../../lib/dnd').AbilityKey,number>>
  fortressEmergencePlacements?: import('../structureEmergence').Dnd5eStructureEmergencePlacements
  fortressQualifications?: import('../mightyFortressPlacement').Dnd5eFortressSiteQualifications
  /** The Host caller must commit the returned geometry with map and resource changes. */
  supportsStructureCommit?: boolean
  /** Caller must commit every returned map replacement together with Activity costs. */
  supportsOtherMapGeometryCommit?: boolean
  /** Host initiative rolls for newly awakened trees during combat, in selected-tree order. */
  groveInitiativeD20s?: readonly number[]
  groveQualifications?: import('../druidGroveMapPlacement').Dnd5eDruidGroveMapQualifications
  /** Complete Host geometry snapshot, not a player selection payload. */
  flameGeometries?: readonly import('../../../lib/mapGeometry').MapGeometryState[]
  /** Frozen Host geometry for an object-flight replay; null explicitly means no geometry. */
  objectFlightGeometry?: import('../../../lib/mapGeometry').MapGeometryState | null
  /** Host remaining budget after the compiler reserved each movement's distance. */
  actorMovementRemainingFeet?: number
  characters?: readonly import('../../../types/character').Character[]
  /** Complete Host map snapshot, required for source-limited creation. Never client supplied. */
  sourceLimitMaps?: readonly BattleMap[]
  activity: Dnd5eActivityDefinitionV1
  packageId: string
  actionId: string
  actorId: string
  /** Host-derived at the combat boundary; only used to resolve `source-save-dc`. */
  sourceSaveDc?: number
  /** Optional outer spell concentration identity; features keep the Activity identity. */
  concentrationId?: string
  round: number
  /** Host's current initiative token; a reaction caster may be a different token. */
  turnTokenId?: string
  /** Campaign clock used for ten-minute Arcane Lock suppression outside combat. */
  worldMinute?: number
  worldSecondRemainder?: number
  /** Host clock and accepted rest trigger; never copied from an area proposal. */
  restAuthority?: { clock: SharedCampaignTimeState; eventId: string }
  /** Present only while combat is active; ten minutes is represented as 100 rounds. */
  combatId?: string
  /** Host action-economy turn identity, never taken from an Activity payload. */
  turnKey?: string
  /** Scope captured by Host preparation, for rejecting a clock change while rolling. */
  expectedMovementScope?: ReturnType<typeof persistentAreaMovementScope>
  /** Current initiative of the source; a simulacrum acts on this initiative instead of rolling. */
  sourceInitiative?: number
  /** Cast level that created the mapped Activity entity. Granted actions inherit it. */
  castLevel?: number
  handoffs: Dnd5eActivityAuthorityHandoffs
  areaSelection?: Dnd5eActivityAreaMapSelectionV1
  selection: Dnd5eActivityMapHandoffSelectionV1
  /** Area-granted Activities measure push/pull direction from this anchor. */
  movementOriginCell?: GridCell
  /** Host entitlement proving which persistent entity granted this Activity. */
  grantingPersistentAreaId?: string
  grantingPersistentAreaMapId?: string
  supportsRemoteAreaDismissal?: boolean
  /** Caller must settle every returned sphere sweep before publishing this map. */
  supportsSphereSweepSettlement?: boolean
  /** Explicit Host-validated selection height; omitted means retain height with terrain descent. */
  areaRelocationTargetElevationFeet?: number
  /** Host delayed receipt attribution; only independent corpse transformations may use it. */
  delayedSourceIdentity?: Dnd5eDelayedSourceIdentity
}): Dnd5eActivityMapHandoffResultV1 | Dnd5eActivityMapHandoffFailureV1 {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorId) ??
    (isIndependentCorpseSummon(input.handoffs) && validDelayedSourceIdentity(input.delayedSourceIdentity,input.actorId)
      ? { ...input.delayedSourceIdentity, x:0, y:0, size:1 } : undefined)
  let actorMovementRemainingFeet = input.actorMovementRemainingFeet
  if (!actorToken) return { ok: false, reason: 'invalid-actor-token' }
  if (input.activity.target.kind === 'creature' && input.handoffs.persistentAreas.some(area => area.effectToken?.followSelectedTarget)) {
    const [sensor] = input.handoffs.persistentAreas
    const targets = input.map.tokens.filter(token => token.id === sensor.sensorTargetId && token.type !== 'obstacle')
    if (input.activity.target.count !== 1 || input.handoffs.persistentAreas.length !== 1 ||
      !sensor.effectToken?.followSelectedTarget || !sensor.sensorTargetId || targets.length !== 1) {
      return { ok: false, reason: 'invalid-persistent-area' }
    }
    const target = targets[0]
    const mappedActivity: Dnd5eActivityDefinitionV1 = { ...input.activity, target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'circle', radiusFeet: 5,
      // The creature was already authorized by Headless. This internal geometry
      // projection must not introduce another player-controlled point or LOS gate.
      placeRangeFeet: Math.hypot(input.map.width, input.map.height) / Math.max(1, input.map.gridSize) * (input.map.feetPerCell ?? 5) + 20_000,
      requiresLineOfEffect: false, requiresLineOfSight: false,
    } }
    const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity: mappedActivity, map: input.map,
      actorToken, characters: input.characters, worldMinute: input.worldMinute,
      anchorCell: pixelToCell(target.x, target.y, input.map),
      targetElevationFeet: mapGeometryTokenElevation(mapGeometryRuntimeForMap(input.map.id), target) })
    if (!selection) return { ok: false, reason: 'invalid-persistent-area' }
    return applyDnd5eActivityMapHandoffsV1({ ...input, activity: mappedActivity,
      areaSelection: { ...selection, targetIds: [target.id] },
      handoffs: { ...input.handoffs, persistentAreas: [{ ...sensor,
        areaInstance: { ...selection.areaPlacement, origin: 'point', shape: 'circle' } }] } })
  }
  const truePolymorphObjectToCreature = isTruePolymorphObjectToCreatureHandoff(input)
  // Only typed consumables currently have an enabled object write path.
  // Other ordinary objects remain outside the automated tabletop model.
  // The spell transaction itself is already settled by the Host, while the
  // table handles any object result through its voice channel and the DM's
  // direct scene tools.  Keep this guard at the final map-write boundary so a
  // stale client or a future Activity cannot resurrect object automation.
  const hasDisabledObjectHandoff =
    truePolymorphObjectToCreature ||
    (input.handoffs.mapObjectLocks?.length ?? 0) > 0 ||
    (input.handoffs.mapObjectLights?.length ?? 0) > 0 ||
    input.handoffs.persistentAreas.some((area) =>
      area.mappedObjectEnchantment != null ||
      area.blocking?.suppressesMappedBarriers === true,
    )
  if (hasDisabledObjectHandoff) {
    // Omit only unsupported object writes. The remaining batch must still pass
    // placement, ownership and source-limit checks before anything is committed.
    return applyDnd5eActivityMapHandoffsV1({ ...input, handoffs: {
      ...input.handoffs,
      mapObjectLocks: [],
      mapObjectLights: [],
      persistentAreas: input.handoffs.persistentAreas.filter(area =>
        area.mappedObjectEnchantment == null && area.blocking?.suppressesMappedBarriers !== true),
      summons: truePolymorphObjectToCreature ? [] : input.handoffs.summons,
    } })
  }
  if (
    (
      input.handoffs.persistentAreas.length > 0 ||
      (input.handoffs.mapObjectLocks?.length ?? 0) > 0 ||
      (input.handoffs.mapObjectLights?.length ?? 0) > 0 ||
      (input.handoffs.mapItemConversions?.length ?? 0) > 0 ||
      (input.handoffs.mapObjectPurifications?.length ?? 0) > 0 ||
      (input.handoffs.mapObjectLaunches?.length ?? 0) > 0 ||
      (input.handoffs.looseEarthTransfers?.length ?? 0) > 0 ||
      (input.handoffs.persistentEntityImpacts?.length ?? 0) > 0 ||
      (input.handoffs.mapVegetationChanges?.length ?? 0) > 0 ||
      truePolymorphObjectToCreature
    ) &&
    !input.areaSelection
  ) {
    return { ok: false, reason: 'activity-area-required' }
  }
  const map: BattleMap = structuredClone(input.map)
  let boundCharacters = input.characters ?? []
  const boundCharacterIds: string[] = []
  const changedTokenIds: string[] = []
  const removedTokenIds: string[] = []
  const initiativeEntries: InitiativeEntry[] = []
  const movementPaths: Dnd5eActivityMapHandoffResultV1['movementPaths'][number][] = []
  const carriedTargetIds: string[] = []
  const sphereSweeps: NonNullable<Dnd5eActivityMapHandoffResultV1['sphereSweeps']>[number][] = []
  const harmfulMovementTargetIds = new Set<string>()
  const geometryDoorPatches: Dnd5eActivityMapHandoffResultV1['geometryDoorPatches'][number][] = []
  const geometryLightUpserts: MapGeometryLight[] = []
  const otherMapLightUpserts: { mapId: string; light: MapGeometryLight }[] = []
  const geometryEntityPatches: { entityId: string; patch: MapGeometryEntityPatch }[] = []
  let structureGeometry: import('../../../lib/mapGeometry').MapGeometryState|undefined
  for (const transfer of input.handoffs.looseEarthTransfers ?? []) {
    const area = input.areaSelection, geometry = mapGeometryRuntimeForMap(map.id)
    if (!input.supportsStructureCommit || structureGeometry || !area || !geometry ||
      !Number.isFinite(transfer.maximumSideFeet) || transfer.maximumSideFeet <= 0 || transfer.maximumSideFeet > 5 ||
      !Number.isFinite(transfer.distanceFeet) || transfer.distanceFeet <= 0 || transfer.distanceFeet > 5) return {ok:false,reason:'invalid-map-object-selection'}
    const selected = resolveDnd5eActivityAreaMapSelectionV1({ activity: input.activity, map, actorToken,
      anchorCell: area.anchorCell, targetElevationFeet: area.areaPlacement.elevationFeet,
      rectAngleDegrees: area.areaPlacement.angleDegrees,
      dimensions: {widthFeet:area.areaPlacement.widthFeet,heightFeet:area.areaPlacement.lengthFeet} })
    if (!selected) return {ok:false,reason:'invalid-map-object-selection'}
    structureGeometry = prepareLooseEarthTransfer({map,geometry,anchor:cellToPixel(selected.anchorCell,map),
      angleDegrees:(selected.areaPlacement.angleDegrees??0)-90,distanceFeet:transfer.distanceFeet,maximumSideFeet:transfer.maximumSideFeet,
      maximumDisplacementFeet:5,
      widthFeet:selected.areaPlacement.widthFeet,lengthFeet:selected.areaPlacement.lengthFeet,depthFeet:transfer.depthFeet,
      executionId:`${input.actionId}:${transfer.operationId}`,now:Date.now()})
    if (!structureGeometry) return {ok:false,reason:'invalid-map-object-selection'}
  }
  const detonatedAreaIds: string[] = []
  const endedAreaIds: string[] = []
  const persistentEntityResults: NonNullable<Dnd5eActivityMapHandoffResultV1['persistentEntityResults']>[number][] = []
  for (const impact of input.handoffs.persistentEntityImpacts ?? []) {
    const selected = input.areaSelection && resolveDnd5eActivityAreaMapSelectionV1({
      activity: input.activity, map, actorToken, characters: boundCharacters,
      worldMinute: input.worldMinute, grantingPersistentAreaId: input.grantingPersistentAreaId,
      anchorCell: input.areaSelection.anchorCell,
      targetElevationFeet: input.areaSelection.areaPlacement.elevationFeet,
    })
    if (!selected) return { ok: false, reason: 'invalid-map-object-selection' }
    const cell = selected.anchorCell
    const elevation = selected.areaPlacement.elevationFeet ?? 0
    const candidates = (map.dnd5ePluginAreas ?? []).filter(area => {
      const token = map.tokens.find(candidate => candidate.id === area.anchorTokenId)
      if (!token || (!area.projectionDefense && !area.entityProfile) || area.stoneWall) return false
      const base = (area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : undefined) ?? token.elevationFeet ??
        mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(map.id), token)
      const height = (area.vertical?.mode === 'volume' ? area.vertical.heightFeet : undefined) ?? token.size * (map.feetPerCell ?? 5)
      return elevation >= base && elevation < base + height &&
        tokenOccupiedCellsAt(token, map, token).some(occupied => occupied.col === cell.col && occupied.row === cell.row)
    })
    // Ambiguous overlap is never resolved by array order or an untrusted id.
    if (candidates.length !== 1) return { ok: false, reason: 'invalid-map-object-selection' }
    const area = candidates[0]
    const settled = resolvePersistentAreaEntityImpact({ map, characters: boundCharacters, areaId: area.id,
      panelId: 'entity', damage: impact.amount, damageType: impact.damageType, round: input.round,
      savingThrow: impact.savingThrow, conditions: impact.conditions })
    if (!settled) return { ok: false, reason: 'invalid-map-object-selection' }
    for (const token of map.tokens) if (!settled.map.tokens.some(after => after.id === token.id)) removedTokenIds.push(token.id)
    if (!settled.map.dnd5ePluginAreas?.some(after => after.id === area.id)) endedAreaIds.push(area.id)
    changedTokenIds.push(...settled.map.tokens.filter(token => token !== map.tokens.find(before => before.id === token.id)).map(token => token.id))
    Object.assign(map, settled.map)
    if (settled.characters) boundCharacters = settled.characters
    else if (settled.character) boundCharacters = boundCharacters.map(character => character.id === settled.character!.id ? settled.character! : character)
    if (settled.characters || settled.character) boundCharacterIds.push(...boundCharacters.map(character => character.id))
    persistentEntityResults.push({ operationId: impact.operationId, areaId: area.id, label: area.label,
      damageImmune: area.projectionDefense === 'untouchable-illusion',
      savingThrow: settled.savingThrow, immuneConditions: settled.immuneConditions })
  }
  const newlyCreatedSupportIds = new Set<string>()
  const launchGeometry = input.handoffs.mapObjectLaunches?.length
    ? structuredClone(input.objectFlightGeometry === undefined ? mapGeometryRuntimeForMap(map.id) : input.objectFlightGeometry ?? undefined) : undefined

  for (const launch of input.handoffs.mapObjectLaunches ?? []) {
    if (!input.areaSelection || !Number.isFinite(launch.amount) || launch.amount < 0) return { ok: false, reason: 'invalid-map-object-selection' }
    const flight = launch.harmlessPush ? planDnd5eHarmlessObjectPushAtAnchor({map, geometry: launchGeometry,
      anchorCell: input.areaSelection.anchorCell, actorId: input.actorId, slotLevel: launch.castLevel, limits: launch.limits}) : planDnd5eMapObjectFlightAtAnchor({ map, geometry: launchGeometry,
      anchorCell: input.areaSelection.anchorCell, angleDegrees: input.areaSelection.areaPlacement.angleDegrees ?? 0,
      pitchDegrees: input.areaSelection.areaPlacement.objectLaunchPitchDegrees,
      slotLevel: launch.castLevel, limits: launch.limits })
    if (!flight.ok) return { ok: false, reason: 'invalid-map-object-selection' }
    if (launch.harmlessPush) {
      if (launch.amount !== 0 || launch.impactTargetId != null || launch.departureSave != null) return { ok: false, reason: 'invalid-map-object-selection' }
      const object = map.tokens.find(token => token.id === flight.plan.objectId)!
      const landing = planDnd5eMapObjectLanding({map, geometry: launchGeometry, objectId: object.id,
        point: flight.plan.to, elevationFeet: flight.plan.destinationElevationFeet})
      if (!landing) return { ok: false, reason: 'invalid-map-object-selection' }
      object.x = flight.plan.to.x; object.y = flight.plan.to.y; object.elevationFeet = landing.elevationFeet
      changedTokenIds.push(object.id)
      movementPaths.push({operationId: launch.operationId, targetId: object.id,
        path: [flight.plan.from, flight.plan.to], to: flight.plan.to, provokesOpportunityAttacks: false})
      continue
    }
    const impact = launch.impactTargetId == null ? undefined : flight.plan.creatures.find(contact => contact.tokenId === launch.impactTargetId)
    if (launch.impactTargetId != null && !impact) return { ok: false, reason: 'invalid-map-object-selection' }
    if (!impact && flight.plan.stop?.kind === 'map-boundary') {
      if (!launch.departureSave) return { ok: false, reason: 'invalid-map-object-selection' }
      const departure = captureDnd5eObjectFlightDeparture({ map, geometry: launchGeometry,
        objectId: flight.plan.objectId, limits: launch.limits, slotLevel: launch.castLevel,
        angleDegrees: input.areaSelection.areaPlacement.angleDegrees ?? 0,
        pitchDegrees: input.areaSelection.areaPlacement.objectLaunchPitchDegrees,
        actionId: input.actionId, operationId: launch.operationId, actorId: input.actorId,
        packageId: input.packageId, activityId: input.activity.legacySource?.id ?? input.activity.id,
        saveDc: launch.departureSave.dc, saveAbility: launch.departureSave.ability,
        successfulTargetIds: launch.departureSave.successfulTargetIds, damage: launch.amount, damageType: launch.damageType })
      if (!departure || map.dnd5eObjectFlightDepartures?.some(receipt => receipt.id === departure.id)) return { ok: false, reason: 'invalid-map-object-selection' }
      map.dnd5eObjectFlightDepartures = [...map.dnd5eObjectFlightDepartures ?? [], departure]
      map.tokens = map.tokens.filter(token => token.id !== departure.object.id)
      removedTokenIds.push(departure.object.id)
      continue
    }
    // If every creature saved and nothing stopped the launch, the first landing
    // surface receives the same spell impact. Never add a second spell hit after
    // a creature or surface has already stopped the flight.
    const endLanding = !impact && !flight.plan.stop ? planDnd5eMapObjectLanding({ map, geometry: launchGeometry,
      objectId: flight.plan.objectId, point: flight.plan.to, elevationFeet: flight.plan.destinationElevationFeet }) : undefined
    if (!impact && !flight.plan.stop && !endLanding) return { ok: false, reason: 'invalid-map-object-selection' }
    const collision = !impact ? flight.plan.stop ?? endLanding?.support : undefined
    const groundImpact = collision?.kind === 'ground' ? collision : undefined
    const surface = collision?.kind === 'geometry' ? collision : undefined
    if (surface && !map.dnd5ePluginAreas?.some(area => area.id === surface.id)) {
      const geometry = launchGeometry
      const entity = geometry && [...geometry.walls, ...geometry.doors, ...(geometry.windows ?? []), ...geometry.obstacles]
        .find(candidate => candidate.id === surface.id)
      const templeForce = entity && geometry?.structureLifetimes?.some(record =>
        record.templeWard && record.entityIds.includes(entity.id))
      // A force shell stops the projectile without taking ordinary damage.
      // Keep settling the projectile's own impact damage below.
      if (!templeForce) {
        const patch = damageGeometryEntity(entity, launch.amount, launch.damageType)
        if (!patch) return { ok: false, reason: 'invalid-map-object-selection' }
        geometryEntityPatches.push({ entityId: surface.id, patch })
        Object.assign(entity!, patch)
      }
    } else if (surface) {
      const settled = resolvePersistentAreaEntityImpact({ map, characters: boundCharacters, areaId: surface.id,
        panelId: surface.panelId, damage: launch.amount, damageType: launch.damageType, round: input.round })
      // Unmodeled mapped surfaces need durability data; do not silently discard damage.
      if (!settled) return { ok: false, reason: 'invalid-map-object-selection' }
      const beforeTokenIds = new Set(map.tokens.map(token => token.id))
      const afterTokenIds = new Set(settled.map.tokens.map(token => token.id))
      for (const id of beforeTokenIds) if (!afterTokenIds.has(id)) removedTokenIds.push(id)
      changedTokenIds.push(...settled.map.tokens.filter(token => token !== map.tokens.find(previous => previous.id === token.id)).map(token => token.id))
      if (!settled.map.dnd5ePluginAreas?.some(area => area.id === surface.id)) endedAreaIds.push(surface.id)
      Object.assign(map, settled.map)
      if (settled.characters) {
        boundCharacters = settled.characters
        boundCharacterIds.push(...settled.characters.map(character => character.id))
      } else if (settled.character) {
        const changed = settled.character
        boundCharacters = boundCharacters.map(character => character.id === changed.id ? changed : character)
        boundCharacterIds.push(changed.id)
      }
    }
    const object = map.tokens.find(token => token.id === flight.plan.objectId)!
    const recipient = collision?.kind === 'object'
      ? map.tokens.find(token => token.id === collision.id) : undefined
    if (impact || recipient || surface || groundImpact) {
      for (const token of recipient ? [object, recipient] : [object]) {
        const hp = token.hp ?? token.maxHp
        if (hp == null || !Number.isFinite(hp)) return { ok: false, reason: 'invalid-map-object-selection' }
        token.hp = Math.max(0, hp - launch.amount)
        changedTokenIds.push(token.id)
      }
    }
    const destination = impact?.point ?? flight.plan.to
    const landing = planDnd5eMapObjectLanding({ map, geometry: launchGeometry, objectId: object.id,
      point: destination, elevationFeet: impact?.elevationFeet ?? flight.plan.destinationElevationFeet })
    if (!landing) return { ok: false, reason: 'invalid-map-object-selection' }
    object.x = destination.x; object.y = destination.y
    object.elevationFeet = landing.elevationFeet
    if (groundImpact) object.dnd5eObjectState = { ...object.dnd5eObjectState, schemaVersion: 1,
      groundImpact: { actionId: input.actionId, operationId: launch.operationId, surfaceId: groundImpact.id,
        damage: launch.amount, x: destination.x, y: destination.y, elevationFeet: endLanding?.elevationFeet ?? flight.plan.destinationElevationFeet } }
    changedTokenIds.push(object.id)
    movementPaths.push({ operationId: launch.operationId, targetId: object.id,
      path: [flight.plan.from, destination], to: destination, provokesOpportunityAttacks: false })
  }

  const truePolymorphOriginalObject = truePolymorphObjectToCreature
    ? (() => {
        const selectedCells = input.areaSelection?.cells
        if (!selectedCells?.length || !input.areaSelection) return undefined
        const selectedKeys = new Set(selectedCells.map(cellKey))
        const anchorPoint = cellToPixel(input.areaSelection.anchorCell, map)
        const object = map.tokens
          .filter((candidate) => candidate.type === 'obstacle' && !candidate.dnd5eSpellEffect &&
            tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => selectedKeys.has(cellKey(cell))))
          .sort((left, right) => Math.hypot(left.x - anchorPoint.x, left.y - anchorPoint.y) -
            Math.hypot(right.x - anchorPoint.x, right.y - anchorPoint.y))[0]
        if (!object) return undefined
        return {
          schemaVersion: 1 as const,
          id: object.id,
          label: object.label,
          x: object.x,
          y: object.y,
          color: object.color,
          emoji: object.emoji,
          size: object.size,
          hp: object.hp,
          maxHp: object.maxHp,
          obstacleKind: object.obstacleKind,
          elevationFeet: object.elevationFeet,
          portraitImageId: object.portraitImageId,
          tokenPortraitImageId: object.tokenPortraitImageId,
          showHpOnToken: object.showHpOnToken,
          showDetailOnToken: object.showDetailOnToken,
          visibilityMode: object.visibilityMode,
          lightSource: object.lightSource ? { ...object.lightSource } : undefined,
          dnd5eObjectState: object.dnd5eObjectState ? structuredClone(object.dnd5eObjectState) : undefined,
        }
      })()
    : undefined
  if (truePolymorphObjectToCreature && !truePolymorphOriginalObject) {
    return { ok: false, reason: 'invalid-map-object-selection' }
  }
  if (truePolymorphOriginalObject) {
    map.tokens = map.tokens.filter((candidate) => candidate.id !== truePolymorphOriginalObject.id)
    changedTokenIds.push(truePolymorphOriginalObject.id)
  }

  const actorCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, map)
  if ((input.handoffs.mapItemConversions?.length ?? 0) > 1) return {ok:false,reason:'invalid-map-object-selection'}
  for (const proposal of input.handoffs.mapItemConversions ?? []) {
    const converted = settleDnd5eMapItemConversion({map, actorTokenId:actorToken.id, activity:input.activity,
      anchorCell:input.areaSelection!.anchorCell, actionId:input.actionId, proposal})
    if (!converted.ok) return {ok:false,reason:'invalid-map-object-selection'}
    map.tokens = converted.map.tokens
    changedTokenIds.push(...converted.changedTokenIds)
  }
  for (const proposal of input.handoffs.mapRemainsProtections ?? []) {
    const selected = input.areaSelection
    if (!selected || !Number.isSafeInteger(input.worldMinute) || Number(input.worldMinute) < 0 ||
      !Number.isSafeInteger(proposal.durationMinutes) || proposal.durationMinutes < 1 ||
      proposal.durationMinutes > 5_256_000 || proposal.minimumPower !== 'wish' ||
      !Number.isInteger(proposal.spellLevel) || proposal.spellLevel < 0 || proposal.spellLevel > 9) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const verified = resolveDnd5eActivityAreaMapSelectionV1({ activity: input.activity, map, actorToken,
      anchorCell: selected.anchorCell })
    if (!verified) return { ok: false, reason: 'invalid-map-object-selection' }
    const keys = new Set(verified.cells.map(cellKey))
    const corpses = map.tokens.filter(candidate => candidate.type === 'obstacle' && !candidate.dnd5eSpellEffect &&
      ['humanoid-corpse', 'creature-corpse'].includes(normalizeDnd5eMapObjectStateV1(candidate.dnd5eObjectState)?.remains?.kind ?? '') &&
      tokenOccupiedCellsAt(candidate, map, candidate).some(cell => keys.has(cellKey(cell))))
    // No automatic nearest-corpse guess when several bodies share the selected space.
    if (corpses.length !== 1) return { ok: false, reason: 'invalid-map-object-selection' }
    const corpse = corpses[0]
    const geometry = mapGeometryRuntimeForMap(map.id)
    const actorElevation = actorToken.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, actorToken)
    const corpseElevation = corpse.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, corpse)
    const maximumRange = input.activity.target.kind === 'area' ? input.activity.target.placeRangeFeet ?? 0 : 0
    if (Math.max(tokenFootprintDistanceCells(actorToken, corpse, map) * Math.max(1, map.feetPerCell ?? 5),
      Math.abs(corpseElevation - actorElevation)) > maximumRange) return { ok: false, reason: 'invalid-map-object-selection' }
    if (mapGeometryLineOfEffectBlocked({ geometry, map, from: actorToken, to: corpse,
      fromElevationFeet: actorToken.elevationFeet, toElevationFeet: corpse.elevationFeet })) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const expiry = Number(input.worldMinute) + proposal.durationMinutes
    if (!Number.isSafeInteger(expiry)) return { ok: false, reason: 'invalid-map-object-selection' }
    map.tokens = map.tokens.map(token => token.id !== corpse.id ? token : { ...token,
      dnd5eObjectState: { ...normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState)!, undeadCreationProtection: {
        schemaVersion: 1, minimumPower: 'wish', sourceTokenId: actorToken.id,
        sourceActivityId: input.activity.id, sourcePackageId: input.packageId, spellLevel: proposal.spellLevel,
        createdWorldMinute: Number(input.worldMinute), expiresAtWorldMinute: expiry,
      } } })
    changedTokenIds.push(corpse.id)
  }
  for (const proposal of input.handoffs.mapObjectLocks ?? []) {
    const selectedCells = input.areaSelection?.cells
    if (!selectedCells?.length || !input.areaSelection) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const selectedKeys = new Set(selectedCells.map(cellKey))
    const geometry = mapGeometryRuntimeForMap(map.id)
    const anchorPoint = cellToPixel(input.areaSelection.anchorCell, map)
    const door = proposal.targetKinds.includes('door')
      ? geometry?.doors
          .filter((candidate) => selectedKeys.has(cellKey(pixelToCell(
            (candidate.points[0].x + candidate.points[1].x) / 2,
            (candidate.points[0].y + candidate.points[1].y) / 2,
            map,
          ))))
          .sort((left, right) => {
            const leftMidpoint = {
              x: (left.points[0].x + left.points[1].x) / 2,
              y: (left.points[0].y + left.points[1].y) / 2,
            }
            const rightMidpoint = {
              x: (right.points[0].x + right.points[1].x) / 2,
              y: (right.points[0].y + right.points[1].y) / 2,
            }
            return Math.hypot(leftMidpoint.x - anchorPoint.x, leftMidpoint.y - anchorPoint.y) -
              Math.hypot(rightMidpoint.x - anchorPoint.x, rightMidpoint.y - anchorPoint.y)
          })[0]
      : undefined
    const obstacle = !door && proposal.targetKinds.includes('obstacle')
      ? map.tokens
          .filter((candidate) => candidate.type === 'obstacle' &&
            tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => selectedKeys.has(cellKey(cell))))
          .sort((left, right) => Math.hypot(left.x - anchorPoint.x, left.y - anchorPoint.y) -
            Math.hypot(right.x - anchorPoint.x, right.y - anchorPoint.y))[0]
      : undefined
    if (!door && !obstacle) return { ok: false, reason: 'invalid-map-object-selection' }

    const suppression = proposal.mode === 'knock' && proposal.suppressionMinutes
      ? input.combatId
        ? {
            kind: 'combat-round' as const,
            combatId: input.combatId,
            throughRound: input.round + proposal.suppressionMinutes * 10 - 1,
          }
        : {
            kind: 'campaign-time' as const,
            untilWorldMinute: Math.max(0, Math.floor(input.worldMinute ?? 0)) + proposal.suppressionMinutes,
          }
      : undefined
    if (door) {
      const existingArcaneLock = door.dnd5eArcaneLock
      if (proposal.mode === 'arcane-lock') {
        if (mapGeometryDoorOpenState(door) === 'open') {
          return { ok: false, reason: 'invalid-map-object-selection' }
        }
        const lock: Dnd5eArcaneLockStateV1 = {
          schemaVersion: 1,
          sourceTokenId: actorToken.id,
          sourceActivityId: input.activity.id,
          spellLevel: proposal.spellLevel,
          previousLocked: mapGeometryDoorLockState(door) === 'locked',
          authorizedTokenIds: proposal.authorizedTargetIds ? [...proposal.authorizedTargetIds] : undefined,
          passwordDigest: proposal.passwordDigest,
        }
        geometryDoorPatches.push({
          entityId: door.id,
          patch: { state: 'locked', openState: 'closed', lockState: 'locked', dnd5eArcaneLock: lock },
        })
      } else if (existingArcaneLock) {
        geometryDoorPatches.push({
          entityId: door.id,
          patch: {
            state: 'closed', openState: 'closed', lockState: 'unlocked',
            dnd5eArcaneLock: { ...existingArcaneLock, suppression },
          },
        })
      } else {
        geometryDoorPatches.push({
          entityId: door.id,
          patch: { state: 'closed', openState: 'closed', lockState: 'unlocked' },
        })
      }
      continue
    }
    if (obstacle) {
      const existing = obstacle.dnd5eObjectState
      const arcaneLock = existing?.arcaneLock
      const nextState = proposal.mode === 'arcane-lock'
        ? {
            schemaVersion: 1 as const,
            locked: true,
            arcaneLock: {
              schemaVersion: 1 as const,
              sourceTokenId: actorToken.id,
              sourceActivityId: input.activity.id,
              spellLevel: proposal.spellLevel,
              previousLocked: existing?.locked === true,
              authorizedTokenIds: proposal.authorizedTargetIds ? [...proposal.authorizedTargetIds] : undefined,
              passwordDigest: proposal.passwordDigest,
            },
          }
        : {
            schemaVersion: 1 as const,
            locked: false,
            arcaneLock: arcaneLock ? { ...arcaneLock, suppression } : undefined,
          }
      map.tokens = map.tokens.map((candidate) => candidate.id === obstacle.id
        ? { ...candidate, dnd5eObjectState: nextState }
        : candidate)
      changedTokenIds.push(obstacle.id)
    }
  }
  let flameGeometries = input.flameGeometries
  for (const proposal of input.handoffs.areaFlameExtinguishings ?? []) {
    const selected = input.areaSelection
    const rect = persistentRectGeometryForSelection(input.activity, selected, actorToken, map)
    const geometry = flameGeometries?.find(value => value.mapId === map.id)
    if (!selected || !rect || !geometry || !flameGeometries || input.worldMinute == null ||
      selected.areaPlacement.elevationFeet == null || selected.areaPlacement.heightFeet == null) return {ok:false,reason:'invalid-map-object-selection'}
    const reaches = prepareDnd5eAreaFlameReach({map,geometry,rect,center:selected.areaPlacement,
      baseElevationFeet:selected.areaPlacement.elevationFeet,heightFeet:selected.areaPlacement.heightFeet,groundSpreadFeet:proposal.groundSpreadFeet})
    if (!reaches) return {ok:false,reason:'invalid-map-object-selection'}
    const result = extinguishDnd5eAreaFlames({map,lights:geometry.lights??[],worldMinute:input.worldMinute,
      reachesToken:token=>reaches(token,mapGeometryTokenElevation(geometry,token)),
      reachesLight:light=>reaches(light.points[0],light.elevationFeet)})
    map.tokens = result.map.tokens
    for (const area of map.dnd5ePluginAreas ?? []) {
      const cells = area.webState?.burningCells?.filter(cell => {
        const point = cellToPixel(cell,map)
        const elevation = area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet
          : mapGeometryTerrainElevationAtPoint(geometry,point)
        return reaches(point,elevation)
      }) ?? []
      if (cells.length) map.dnd5ePluginAreas = extinguishDnd5eWebAreaCells({map,areaId:area.id,cells}).dnd5ePluginAreas
    }
    changedTokenIds.push(...result.changedTokenIds)
    geometryLightUpserts.push(...result.lights.filter(light=>result.changedLightIds.includes(light.id)))
    flameGeometries=flameGeometries.map(value=>value.mapId===map.id?{...value,lights:[...result.lights]}:value)
  }
  if (input.handoffs.areaFuelIgnitions?.length) {
    const selected = input.areaSelection
    const heightFeet = input.activity.target.kind === 'area' ? input.activity.target.heightFeet : undefined
    const geometry = flameGeometries?.find(value => value.mapId === map.id)
    if (!selected?.cells.length || !geometry || heightFeet == null || selected.areaPlacement.elevationFeet == null) {
      return {ok:false,reason:'invalid-map-object-selection'}
    }
    const lights = igniteUnattendedFuelInVolume({map,cells:selected.cells,baseElevationFeet:selected.areaPlacement.elevationFeet,heightFeet,lights:geometry.lights??[]})
    for (let index=0;index<lights.length;index++) if(lights[index]!==geometry.lights?.[index]) geometryLightUpserts.push(lights[index])
    flameGeometries=flameGeometries!.map(value=>value.mapId===map.id?{...value,lights}:value)
  }
  for (const proposal of input.handoffs.mapFlameChanges ?? []) {
    if (proposal.requireAreaOrigin && !input.areaSelection) return { ok: false, reason: 'invalid-map-object-selection' }
    const selected = input.selection.flamesByOperationId?.[proposal.operationId]
    const targetMapId = selected?.mapId ?? map.id
    if (proposal.change.kind !== 'dismiss' && targetMapId !== map.id) return { ok: false, reason: 'invalid-map-object-selection' }
    const geometry = flameGeometries?.find(value => value.mapId === targetMapId)
    if (!geometry || !flameGeometries || input.worldMinute == null) return { ok: false, reason: 'invalid-map-object-selection' }
    const candidates = (geometry.lights ?? []).filter(light => light.controlledFlame && (selected
      ? light.id === selected.lightId
      : input.areaSelection && light.points.some(point => cellKey(pixelToCell(point.x,point.y,map)) === cellKey(input.areaSelection!.anchorCell))))
    if (candidates.length !== 1) return { ok: false, reason: 'invalid-map-object-selection' }
    const light = candidates[0]
    if (proposal.requireAreaOrigin && (!light.points.every(point =>
      cellKey(pixelToCell(point.x,point.y,map)) === cellKey(input.areaSelection!.anchorCell)) ||
      Math.abs((light.elevationFeet ?? 0) - (input.areaSelection!.areaPlacement.elevationFeet ?? 0)) > 1e-6)) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const casterId = actorToken.characterId ? `character:${actorToken.characterId}` : JSON.stringify(['map-token',map.id,actorToken.id])
    const effectId = selected?.effectId
    if (proposal.change.kind === 'dismiss' && (!effectId || !light.controlledFlame?.alterations.some(effect => effect.id === effectId))) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    if (proposal.change.kind === 'spread' && !selected?.destinationId) return { ok: false, reason: 'invalid-map-object-selection' }
    const result = prepareDnd5eControlledFlameMapChange({ map, geometries: flameGeometries, actorTokenId: input.actorId,
      casterId, actionId: `${input.actionId}:${proposal.operationId}`, worldMinute: input.worldMinute,
      selection: proposal.change.kind === 'dismiss' ? { dismissEffectId: effectId! } : {
        lightId: light.id, change: proposal.change.kind === 'spread' ? {kind:'spread',destinationId:selected!.destinationId!} : proposal.change,
      } })
    if (!result.ok) return { ok: false, reason: 'invalid-map-object-selection' }
    flameGeometries = result.geometries
    for (const changed of result.geometries.find(value => value.mapId === targetMapId)?.lights ?? []) {
      if (JSON.stringify(changed) === JSON.stringify(geometry.lights?.find(value => value.id === changed.id))) continue
      if (targetMapId !== map.id) {
        const existing = otherMapLightUpserts.findIndex(value => value.mapId === targetMapId && value.light.id === changed.id)
        const patch = { mapId: targetMapId, light: changed }
        if (existing < 0) otherMapLightUpserts.push(patch)
        else otherMapLightUpserts[existing] = patch
        continue
      }
      const existing = geometryLightUpserts.findIndex(value => value.id === changed.id)
      if (existing < 0) geometryLightUpserts.push(changed)
      else geometryLightUpserts[existing] = changed
    }
  }
  for (const proposal of input.handoffs.mapWeaponEnchantments ?? []) {
    if (!input.characters || !input.areaSelection || !input.concentrationId) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const anchor = input.areaSelection.anchorCell
    const objects = map.tokens.flatMap(token => {
      if (!tokenOccupiedCellsAt(token, map, token).some(cell => cell.col === anchor.col && cell.row === anchor.row)) return []
      const candidates: { token: typeof token; receiptId: string; carriedItemId?: string }[] = []
      if (token.type === 'obstacle' && token.dnd5eObjectState?.inventoryItem) candidates.push({ token, receiptId: token.dnd5eObjectState.inventoryItem.receiptId })
      if (token.type === 'enemy') for (const item of token.dnd5eCarriedObjects ?? []) {
        if (item.wieldedWeapon && item.objectState.inventoryItem) candidates.push({ token, receiptId: item.objectState.inventoryItem.receiptId, carriedItemId: item.id })
      }
      return candidates
    })
    if (objects.length !== 1) return { ok: false, reason: 'invalid-map-object-selection' }
    const object = objects[0]
    const caster = boundCharacters.find(character => character.id === actorToken.characterId)
    const control = caster?.dnd5eCombatState?.activeEffects?.find(effect => effect.source.actorId === input.actorId &&
      effect.source.rulesId === input.concentrationId && effect.duration.type === 'concentration' && effect.source.executionId)
    try {
      const attached = prepareDnd5eMapWeaponEnchantment({
        map, characters: boundCharacters, actorTokenId: input.actorId, objectTokenId: object.token.id,
        carriedItemId: object.carriedItemId, expectedReceiptId: object.receiptId,
        rangeFeet: proposal.rangeFeet, appliedAt: Date.now(),
        resolveEffect: entry => bindDnd5eResolvedGroundWeaponEffect({
          resolved: proposal.resolved, entry, actionId: input.actionId, appliedAt: Date.now(), round: input.round,
          source: { kind: 'spell', actorId: input.actorId, characterId: actorToken.characterId,
            pluginId: input.packageId, rulesId: input.concentrationId, spellLevel: input.castLevel,
            magical: true, executionId: control?.source.executionId },
        }),
      })
      if (!attached.ok) return { ok: false, reason: 'invalid-map-object-selection' }
      map.tokens = attached.map.tokens
      changedTokenIds.push(object.token.id)
    } catch {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
  }
  for (const proposal of input.handoffs.mapWeaponEffects ?? []) {
    const effect = proposal.effect
    if (effect.source.actorId !== input.actorId || effect.source.pluginId !== input.packageId ||
        (effect.duration.type === 'concentration' &&
          (effect.duration.sourceActorId !== input.actorId ||
           effect.source.rulesId !== input.concentrationId))) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const attached = prepareDnd5eMapWeaponEnchantment({
      map, characters: input.characters ?? [], actorTokenId: input.actorId,
      objectTokenId: proposal.objectTokenId, expectedReceiptId: proposal.expectedReceiptId,
      rangeFeet: proposal.rangeFeet, appliedAt: effect.appliedAt,
      resolveEffect: () => effect,
    })
    if (!attached.ok) return { ok: false, reason: 'invalid-map-object-selection' }
    map.tokens = attached.map.tokens
    changedTokenIds.push(proposal.objectTokenId)
  }
  for (const proposal of input.handoffs.mapObjectLights ?? []) {
    const selectedCells = input.areaSelection?.cells
    if (!selectedCells?.length || !input.areaSelection) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const selectedKeys = new Set(selectedCells.map(cellKey))
    const anchorPoint = cellToPixel(input.areaSelection.anchorCell, map)
    const obstacleToken = map.tokens
      .filter((candidate) => candidate.type === 'obstacle' &&
        tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => selectedKeys.has(cellKey(cell))))
      .sort((left, right) => Math.hypot(left.x - anchorPoint.x, left.y - anchorPoint.y) -
        Math.hypot(right.x - anchorPoint.x, right.y - anchorPoint.y))[0]
    const geometry = mapGeometryRuntimeForMap(map.id)
    const door = !obstacleToken
      ? geometry?.doors.find((candidate) => selectedKeys.has(cellKey(pixelToCell(
          (candidate.points[0].x + candidate.points[1].x) / 2,
          (candidate.points[0].y + candidate.points[1].y) / 2,
          map,
        ))))
      : undefined
    const geometryObstacle = !obstacleToken && !door
      ? geometry?.obstacles.find((candidate) => {
          if (candidate.points.length === 0) return false
          const center = candidate.points.reduce((total, point) => ({
            x: total.x + point.x / candidate.points.length,
            y: total.y + point.y / candidate.points.length,
          }), { x: 0, y: 0 })
          return selectedKeys.has(cellKey(pixelToCell(center.x, center.y, map)))
        })
      : undefined
    if (!obstacleToken && !door && !geometryObstacle) {
      return { ok: false, reason: 'invalid-map-object-selection' }
    }
    const durationMinutes = proposal.durationMinutes
    const startedAtWorldMinute = Math.max(0, Math.floor(input.worldMinute ?? 0))
    const lightSource = {
      enabled: true,
      brightRadiusFeet: proposal.brightRadiusFeet,
      dimRadiusFeet: proposal.dimRadiusFeet,
      color: proposal.color,
      sourceKind: 'spell' as const,
      startedAtWorldMinute,
      durationMinutes,
      expiresAtWorldMinute: durationMinutes == null
        ? undefined
        : startedAtWorldMinute + durationMinutes,
    }
    if (obstacleToken) {
      map.tokens = map.tokens.map((candidate) => candidate.id === obstacleToken.id
        ? { ...candidate, lightSource }
        : candidate)
      changedTokenIds.push(obstacleToken.id)
      continue
    }
    const objectPoint = door
      ? {
          x: (door.points[0].x + door.points[1].x) / 2,
          y: (door.points[0].y + door.points[1].y) / 2,
        }
      : geometryObstacle!.points.reduce((total, point) => ({
          x: total.x + point.x / geometryObstacle!.points.length,
          y: total.y + point.y / geometryObstacle!.points.length,
        }), { x: 0, y: 0 })
    geometryLightUpserts.push({
      id: `activity-light:${input.actionId}:${proposal.operationId}`,
      kind: 'light',
      label: proposal.operationId,
      points: [objectPoint],
      elevationFeet: 0,
      createdAt: Date.now(),
      ...lightSource,
    })
  }
  for (const proposal of [...input.handoffs.mapObjectPurifications ?? [], ...input.handoffs.mapVegetationChanges ?? []]) {
    const selectedCells = input.areaSelection?.cells
    if (!selectedCells?.length) return { ok: false, reason: 'invalid-map-object-selection' }
    const area = dnd5eActivityMapTemplateV1(input.activity)
    if (!area || !input.areaSelection) return { ok: false, reason: 'invalid-map-object-selection' }
    const geometry = mapGeometryRuntimeForMap(map.id)
    const origin = area.origin === 'self' ? actorToken : input.areaSelection.areaPlacement
    const elevationFeet = input.areaSelection.areaPlacement.elevationFeet ?? spellAreaPointElevation(geometry, origin)
    const obstruction = resolveSpellAreaObstruction({ map, geometry, cells: selectedCells, area, origin,
      elevationFeet, heightFeet: input.areaSelection.areaPlacement.heightFeet,
      ignoresWalls: input.activity.target.kind === 'area' && input.activity.target.requiresLineOfEffect === false,
      propagationCover: input.activity.target.kind === 'area' ? input.activity.target.propagationCover : undefined,
      spreadsAroundCorners: input.activity.target.kind === 'area' && input.activity.target.spreadsAroundCorners })
    const selectedKeys = new Set(obstruction.cells.map(cellKey))
    const contaminants = new Set(proposal.kind === 'purify-map-consumables' ? proposal.contaminants : [])
    map.tokens = map.tokens.map((candidate) => {
      if (
        candidate.type !== 'obstacle' ||
        !tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => selectedKeys.has(cellKey(cell))) ||
        !obstruction.affectsToken(candidate) ||
        !dnd5eInstantAoeAffectsTokenVertically({ spellId: '', area, map, geometry,
          sourceToken: actorToken, targetToken: candidate, effectOrigin: origin,
          effectOriginElevationFeet: elevationFeet, effectHeightFeet: input.areaSelection?.areaPlacement.heightFeet })
      ) return candidate
      const objectState = normalizeDnd5eMapObjectStateV1(candidate.dnd5eObjectState)
      if (proposal.kind === 'wither-map-vegetation') {
        if (objectState?.vegetation !== 'living' || objectState.magical) return candidate
        changedTokenIds.push(candidate.id)
        // A dead tree still has a trunk. Preserve durability and physical geometry.
        return { ...candidate, dnd5eObjectState: { ...objectState, vegetation: 'dead' } }
      }
      if (!objectState?.consumable || objectState.magical) return candidate
      const remaining = objectState.consumable.contaminants.filter((entry) => !contaminants.has(entry))
      if (remaining.length === objectState.consumable.contaminants.length) return candidate
      changedTokenIds.push(candidate.id)
      return {
        ...candidate,
        dnd5eObjectState: {
          ...objectState,
          consumable: { ...objectState.consumable, contaminants: remaining },
        },
      }
    })
  }
  for (const proposal of input.handoffs.areaDispels ?? []) {
    const maximumCells = Math.floor(proposal.radiusFeet / Math.max(1, map.feetPerCell ?? 5))
    map.dnd5ePluginAreas = (map.dnd5ePluginAreas ?? []).filter((area) => {
      if (
        proposal.areaKind !== 'magical-darkness' || area.lighting?.kind !== 'magical-darkness' ||
        area.lighting.spellLevel > proposal.maximumSpellLevel
      ) return true
      return !area.cells.some((cell) => cellDistance(actorCell, cell) <= maximumCells)
    })
  }

  for (const proposal of input.handoffs.persistentAreas) {
    if(proposal.utilityProjectionId==='temple-of-the-gods'){
      const area=input.areaSelection,target=input.activity.target,geometry=mapGeometryRuntimeForMap(map.id)
      if(!input.supportsStructureCommit||structureGeometry||!area||!geometry||!input.templeSelection||
        area.areaPlacement.elevationFeet==null||input.worldMinute==null||input.castLevel==null||input.castLevel<7||input.sourceSaveDc==null||input.sourceAbilityScores?.wis==null||
        proposal.concentration||proposal.permanent||proposal.durationRounds!==14400||target.kind!=='area'||
        !['rect','cube'].includes(target.shape))return {ok:false,reason:'invalid-persistent-area'}
      const widthFeet=area.areaPlacement.widthFeet??target.widthFeet??0
      const depthFeet=area.areaPlacement.lengthFeet??target.lengthFeet??0
      const heightFeet=area.areaPlacement.heightFeet??target.heightFeet??0
      if(widthFeet>(target.widthFeet??0)||depthFeet>(target.lengthFeet??0)||heightFeet>(target.heightFeet??0))return {ok:false,reason:'invalid-persistent-area'}
      const placement=structureAreaPlacement(map,area,{widthFeet,depthFeet})
      if(!placement)return {ok:false,reason:'invalid-persistent-area'}
      let hash=0x6c62272e07bb014262b821756295c58dn
      for(const byte of new TextEncoder().encode(JSON.stringify([input.actionId,proposal.operationId])))hash=((hash^BigInt(byte))*0x1000000000000000000013bn)&((1n<<128n)-1n)
      try{
        const prepared=prepareDnd5eTempleStructure({map,geometry,...placement,widthFeet,depthFeet,heightFeet,characters:input.characters,layout:input.templeSelection.layout,
          elevationFeet:area.areaPlacement.elevationFeet,structureId:`temple:${hash.toString(16)}`,
          casterId:actorToken.characterId??input.actorId,authorizedCreatureIds:input.templeSelection.authorizedCreatureIds,
          hostileCreatureTypes:input.templeSelection.hostileCreatureTypes,lighting:input.templeSelection.lighting,
          sourceSaveDc:input.sourceSaveDc,sourceWisdomModifier:Math.floor((input.sourceAbilityScores.wis-10)/2),
          worldMinute:input.worldMinute,createdAt:Date.now()})
        if(!prepared.ok)return {ok:false,reason:'invalid-persistent-area'}
        structureGeometry=prepared.geometry
      }catch{return {ok:false,reason:'invalid-persistent-area'}}
      continue
    }
    if(proposal.utilityProjectionId==='mighty-fortress'){
      const mealTemplateId=proposal.structureServices?.mealTemplateId
      if(mealTemplateId!=null){
        const template=dnd5eInventoryItemTemplate(mealTemplateId)
        if(!template||template.category!=='consumable'||!dnd5eMapPhysicalItemTemplate(template))return {ok:false,reason:'invalid-persistent-area'}
      }
      const area=input.areaSelection,layout=input.fortressSelection,geometry=mapGeometryRuntimeForMap(map.id)
      const target=input.activity.target,cellFeet=map.feetPerCell??5,side=120/cellFeet
      if(!input.supportsStructureCommit||structureGeometry||!area||area.areaPlacement.elevationFeet==null||!layout||!input.fortressQualifications||!geometry||
        input.worldMinute==null||input.castLevel==null||input.castLevel<8||proposal.concentration||proposal.permanent||
        proposal.durationRounds!==100800||target.kind!=='area'||!['rect','cube'].includes(target.shape)||
        target.widthFeet!==120||target.lengthFeet!==120||!Number.isInteger(side))return {ok:false,reason:'invalid-persistent-area'}
      const placement=fortressAreaPlacement(map,area)
      if(!placement)return {ok:false,reason:'invalid-persistent-area'}
      let hash=0x6c62272e07bb014262b821756295c58dn
      for(const byte of new TextEncoder().encode(JSON.stringify([input.actionId,proposal.operationId])))hash=((hash^BigInt(byte))*0x1000000000000000000013bn)&((1n<<128n)-1n)
      try{
        const prepared=prepareDnd5eMightyFortressStructure({map,geometry,structureId:`fortress:${hash.toString(16)}`,
          ...placement,elevationFeet:area.areaPlacement.elevationFeet,
          createdAt:Date.now(),lifetime:{casterId:actorToken.characterId??input.actorId,worldMinute:input.worldMinute},
          towerThicknessInches:layout.towerThicknessInches,floorThicknessInches:layout.floorThicknessInches,
          authorizedCreatureIds:layout.authorizedCreatureIds,mealTemplateId,eastRoomsPerLevel:layout.eastRoomsPerLevel,roomArchways:layout.roomArchways,roomBlueprint:layout.roomBlueprint,
          stairs:layout.stairs,stairOpenings:layout.stairOpenings,openings:layout.openings,qualifications:input.fortressQualifications})
        if(!prepared.ok)return {ok:false,reason:'invalid-persistent-area'}
        const emergence=prepareDnd5eStructureEmergence({map:prepared.map,before:geometry,after:prepared.geometry,placements:input.fortressEmergencePlacements})
        if(!emergence.ok)return {ok:false,reason:'invalid-persistent-area'}
        const furnished=placeDnd5eFortressFurnishings({map:emergence.map,geometry:prepared.geometry,structureId:`fortress:${hash.toString(16)}`,
          catalog:proposal.structureServices?.furnishings??[],placements:layout.furnishings??[]})
        const staffed=placeDnd5eMightyFortressServants({map:furnished.map,geometry:prepared.geometry,structureId:`fortress:${hash.toString(16)}`})
        map.tokens=staffed.map.tokens
        changedTokenIds.push(...emergence.changedTokenIds,...furnished.tokenIds,...staffed.tokenIds)
        structureGeometry=staffed.geometry
      }catch{return {ok:false,reason:'invalid-persistent-area'}}
      continue
    }
    if (proposal.investigationDc && (!Number.isInteger(input.sourceSaveDc) || input.sourceSaveDc! < 1 || input.sourceSaveDc! > 40)) return { ok: false, reason: 'invalid-persistent-area' }
    if (proposal.discovery && (!Number.isInteger(input.sourceSaveDc) || input.sourceSaveDc! < 1 || input.sourceSaveDc! > 40 ||
      proposal.discovery.dc !== 'source-save-dc' || !['perception', 'investigation'].includes(proposal.discovery.skill))) return { ok: false, reason: 'invalid-persistent-area' }

    if (proposal.utilityProjectionId === 'druid-grove') {
      const selection = normalizeDnd5eGroveActivitySelection(input.groveSelection)
      const geometry = mapGeometryRuntimeForMap(map.id)
      const area = input.areaSelection
      const source = input.activity.legacySource
      if (!selection || !geometry || !input.groveQualifications || !actorToken.characterId || !area ||
        source?.kind !== 'spell' || proposal.concentration || proposal.permanent || proposal.durationRounds !== 14_400 ||
        input.castLevel == null || input.sourceSaveDc == null || input.worldMinute == null ||
        input.activity.target.kind !== 'area' || input.activity.target.shape !== 'cube') {
        return { ok: false, reason: 'invalid-persistent-area' }
      }
      // The detailed subareas cannot replace the volume authorized by normal spell targeting.
      const side = selection.placement.sideFeet / 5
      const selectedCells = new Set(area.cells.map(cellKey))
      if (selectedCells.size !== side * side || area.areaPlacement.heightFeet !== selection.placement.sideFeet ||
        area.areaPlacement.widthFeet !== selection.placement.sideFeet || area.areaPlacement.lengthFeet !== selection.placement.sideFeet ||
        area.areaPlacement.elevationFeet !== selection.baseElevationFeet) return { ok: false, reason: 'invalid-persistent-area' }
      for (let row = 0; row < side; row++) for (let col = 0; col < side; col++) {
        if (!selectedCells.has(cellKey({ col: selection.placement.origin.col + col, row: selection.placement.origin.row + row }))) {
          return { ok: false, reason: 'invalid-persistent-area' }
        }
      }
      const prepared = prepareDnd5eDruidGroveAreaBundle({ ...selection, map, geometry, characters: input.characters, qualifications: input.groveQualifications,
        source: { castId: dnd5eGroveCastIdentity(input.actionId, proposal.operationId), pluginId: input.packageId,
          spellId: source.id, characterId: actorToken.characterId, tokenId: actorToken.id,
          slotLevel: input.castLevel, saveDc: input.sourceSaveDc }, round: input.round, worldMinute: input.worldMinute })
      if (!prepared.ok) return { ok: false, reason: 'invalid-persistent-area' }
      if (input.combatId && prepared.guardianPlans.length) {
        const rolls = input.groveInitiativeD20s
        const monster = getDnd5eSrdMonsterBySlug('awakened-tree')
        if (!monster || rolls?.length !== prepared.guardianPlans.length ||
          rolls.some(d20 => !Number.isInteger(d20) || d20 < 1 || d20 > 20)) return { ok: false, reason: 'invalid-summon-placement' }
        const modifier = Math.floor((monster.abilities.dex - 10) / 2)
        prepared.guardianPlans.forEach(({ guardian }, index) => initiativeEntries.push({
          slotId: `${guardian.id}:normal`, tokenId: guardian.id, label: guardian.label, emoji: guardian.emoji, color: guardian.color,
          roll: rolls[index] + modifier, initiativeCalculation: { rolls: [rolls[index]], d20: rolls[index], modifier, mode: 'normal' },
        }))
      }
      // Command entitlements belong to the guardian subeffect, so dispelling it revokes them.
      for (const area of prepared.areas) if (area.effectGroup?.effectId === 'guardians') {
        area.grantedActivities = proposal.grantedActivities?.map(grant => ({ ...grant }))
      }
      map.dnd5eGroveAnnualCasting = prepared.preparedMap.dnd5eGroveAnnualCasting
      map.tokens = prepared.preparedMap.tokens
      map.dnd5ePluginAreas = prepared.preparedMap.dnd5ePluginAreas
      changedTokenIds.push(...prepared.guardianPlans.map(plan => plan.guardian.id))
      continue
    }
    const restSession = proposal.bindToRestSession
      ? activeRestAreaSession(input.restAuthority?.clock, actorToken.characterId ?? input.actorId, input.restAuthority?.eventId)
      : undefined
    if (proposal.bindToRestSession && (!restSession || input.worldMinute !== input.restAuthority?.clock.worldMinute ||
      input.activity.invocation?.kind !== 'triggered' || input.activity.invocation.event !== `${restSession.kind}-started`)) {
      return { ok: false, reason: 'invalid-persistent-area' }
    }
    const cells = input.areaSelection?.cells
    if (!cells?.length || !proposal.areaInstance) return { ok: false, reason: 'invalid-persistent-area' }
    const areaGeometry = proposal.surfaceAtPlacementElevation
      ? mapGeometryWithObjectSurfaces(map,mapGeometryRuntimeForMap(map.id),boundCharacters) : mapGeometryRuntimeForMap(map.id)
    const placement = proposal.areaInstance
    const requestedSurface = placement.verticalSurface
    const verticalSurface = requestedSurface && areaGeometry && input.activity.target.kind === 'area' &&
      input.activity.target.origin === 'point' && proposal.anchorMode === 'fixed' &&
      proposal.surfaceAtPlacementElevation && proposal.requireAllSurfaceMaterials && proposal.surfaceMaterials?.length &&
      !placement.instances && !proposal.separateSelectedInstances && !proposal.instanceCount &&
      ['surface-inscription', 'surface-color', 'surface-drawing'].includes(proposal.visual?.preset ?? '')
      ? selectVerticalMaterialSurface({ geometry: areaGeometry,
        entityId: requestedSurface.entityId, edgeIndex: requestedSurface.edgeIndex, centerFraction: requestedSurface.centerFraction,
        widthFeet: placement.widthFeet!, heightFeet: placement.heightFeet!, baseElevationFeet: placement.elevationFeet!,
        pixelsPerFoot: map.gridSize / (map.feetPerCell ?? 5),
        maximumSideFeet: Math.min(input.activity.target.widthFeet ?? 0, input.activity.target.heightFeet ?? 0),
        materials: proposal.surfaceMaterials }) : undefined
    if (requestedSurface) {
      if (!verticalSurface || input.activity.target.kind !== 'area') return { ok: false, reason: 'invalid-persistent-area' }
      const center = { x: (verticalSurface.a.x + verticalSurface.b.x) / 2, y: (verticalSurface.a.y + verticalSurface.b.y) / 2 }
      if (![placement.x,placement.y].every(Number.isFinite) || Math.hypot(placement.x - center.x, placement.y - center.y) > 1e-4) return { ok: false, reason: 'invalid-persistent-area' }
      // Inspect just outside the solid so its own face does not occlude itself.
      const point = { x: center.x + verticalSurface.outward.x * 0.001,
        y: center.y + verticalSurface.outward.y * 0.001,
        elevationFeet: verticalSurface.baseElevationFeet + verticalSurface.heightFeet / 2 }
      for(const fragment of verticalSurface.fragments??[]){
        const face=fragment.surface,fragmentPoint={x:(face.a.x+face.b.x)/2+face.outward.x*0.001,
          y:(face.a.y+face.b.y)/2+face.outward.y*0.001,elevationFeet:face.baseElevationFeet+face.heightFeet/2}
        const horizontalDistanceFeet=Math.max(Math.abs(actorToken.x-fragmentPoint.x),Math.abs(actorToken.y-fragmentPoint.y))/map.gridSize*(map.feetPerCell??5)
        if(dnd5eTokenToPointDistanceFeet({geometry:areaGeometry,token:actorToken,pointElevationFeet:fragmentPoint.elevationFeet,horizontalDistanceFeet})>(input.activity.target.placeRangeFeet??0)+1e-4 ||
          mapGeometryLineOfEffectBlocked({geometry:areaGeometry,map,from:actorToken,to:fragmentPoint,fromElevationFeet:mapGeometryTokenElevation(areaGeometry,actorToken),toElevationFeet:fragmentPoint.elevationFeet}) ||
          (input.activity.target.requiresLineOfSight&&!dnd5eActivityPointVisible({map,viewer:actorToken,characters:input.characters,worldMinute:input.worldMinute,point:fragmentPoint})))return {ok:false,reason:'invalid-persistent-area'}
      }
      const horizontalDistanceFeet = Math.max(Math.abs(actorToken.x - center.x), Math.abs(actorToken.y - center.y)) / map.gridSize * (map.feetPerCell ?? 5)
      if (dnd5eTokenToPointDistanceFeet({geometry:areaGeometry,token:actorToken,pointElevationFeet:point.elevationFeet,horizontalDistanceFeet}) > (input.activity.target.placeRangeFeet ?? 0) + 1e-4 ||
        mapGeometryLineOfEffectBlocked({geometry:areaGeometry,map,from:actorToken,to:point,fromElevationFeet:mapGeometryTokenElevation(areaGeometry,actorToken),toElevationFeet:point.elevationFeet}) ||
        (input.activity.target.requiresLineOfSight && !dnd5eActivityPointVisible({map,viewer:actorToken,characters:input.characters,worldMinute:input.worldMinute,point}))) return { ok:false,reason:'invalid-persistent-area' }
    }
    if ([placement, ...(placement.instances ?? [])].some(point => !dnd5eAreaPlacementMatchesSurface({
      target: input.activity.target, geometry: areaGeometry, point, elevationFeet: point.elevationFeet,
    }))) return { ok: false, reason: 'invalid-persistent-area' }
    const areaInstance = input.activity.target.kind === 'area' && input.activity.target.placementSurface === 'ground'
      ? { ...placement, elevationFeet: spellAreaPointElevation(areaGeometry, placement, placement.elevationFeet) }
      : placement
    const baseId = `activity-area:${input.actionId}:${proposal.operationId}`
    if (proposal.teleportationPortal) {
      const clock=input.restAuthority?.clock
      if(!clock || !input.sourceLimitMaps || !actorToken.characterId || input.activity.target.kind!=='area' ||
        input.activity.target.origin!=='self' || input.activity.target.shape!=='sphere' || input.activity.target.radiusFeet!==5) return {ok:false,reason:'invalid-persistent-area'}
      const exit=dnd5eLastLongRestDestination({clock,sourceMap:map,maps:input.sourceLimitMaps,characterId:actorToken.characterId})
      if(!exit)return {ok:false,reason:'invalid-persistent-area'}
      const portal=createTeleportationCircle({id:baseId,map,caster:actorToken,round:input.round,
        exit:input.combatId?exit:{...exit,exploration:true,expiresAt:Date.now()+6000}})
      map.dnd5ePluginAreas=[...(map.dnd5ePluginAreas??[]),{...portal,pluginId:input.packageId,featureId:input.activity.id}]
      continue
    }
    const selectedInstances: Dnd5eActivityAreaMapSelectionV1[] = []
    if (proposal.separateSelectedInstances) {
      const target = input.activity.target
      const anchors = placement.instances ?? [placement]
      if (target.kind !== 'area' || target.origin !== 'point' || target.rotatable ||
        !proposal.entityProfile || proposal.utilityProjectionId || proposal.instanceCount != null ||
        anchors.length < (target.minimumInstanceCount ?? target.instanceCount ?? 1) ||
        anchors.length > (target.instanceCount ?? 1) ||
        anchors[0]?.x !== placement.x || anchors[0]?.y !== placement.y) return { ok: false, reason: 'invalid-persistent-area' }
      const occupiedCells = new Set<string>()
      for (const point of anchors) {
        const selection = resolveDnd5eActivityAreaMapSelectionV1({
          activity: input.activity, map, actorToken, characters: input.characters, worldMinute: input.worldMinute,
          anchorCell: pixelToCell(point.x, point.y, map),
          dimensions: { radiusFeet: placement.radiusFeet, lengthFeet: placement.lengthFeet,
            widthFeet: placement.widthFeet, volumeHeightFeet: placement.heightFeet },
        })
        if (!selection?.cells.length || selection.cells.some(cell => occupiedCells.has(cellKey(cell)))) {
          return { ok: false, reason: 'invalid-persistent-area' }
        }
        selection.cells.forEach(cell => occupiedCells.add(cellKey(cell)))
        selectedInstances.push(selection)
      }
    }
    const instanceCount = selectedInstances.length || (proposal.utilityProjectionId
      ? Math.max(1, Math.min(16, proposal.instanceCount ?? 1))
      : 1)
    const baseAnchor = input.areaSelection!.anchorCell
    if (
      input.activity.target.kind === 'area' &&
      activityAreaAnchorIsOccupied(map, baseAnchor, input.activity.target.unoccupiedAnchorSizeFeet)
    ) return { ok: false, reason: 'invalid-persistent-area' }
    const magicMouthObject = (() => {
      if (proposal.mappedObjectEnchantment !== 'magic-mouth') return undefined
      if (!proposal.magicMouth) return null
      const anchorKey = cellKey(baseAnchor)
      const obstacleToken = map.tokens.find((candidate) => candidate.type === 'obstacle' &&
        tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => cellKey(cell) === anchorKey))
      if (obstacleToken) return {
        objectKind: 'obstacle-token' as const,
        objectId: obstacleToken.id,
        objectLabel: obstacleToken.label || '地图物件',
      }
      const geometry = mapGeometryRuntimeForMap(map.id)
      const door = geometry?.doors.find((candidate) => cellKey(pixelToCell(
        (candidate.points[0].x + candidate.points[1].x) / 2,
        (candidate.points[0].y + candidate.points[1].y) / 2,
        map,
      )) === anchorKey)
      if (door) return {
        objectKind: 'door' as const,
        objectId: door.id,
        objectLabel: door.label || '门',
      }
      const geometryObstacle = geometry?.obstacles.find((candidate) => {
        if (candidate.points.length === 0) return false
        const center = candidate.points.reduce((total, point) => ({
          x: total.x + point.x / candidate.points.length,
          y: total.y + point.y / candidate.points.length,
        }), { x: 0, y: 0 })
        return cellKey(pixelToCell(center.x, center.y, map)) === anchorKey
      })
      return geometryObstacle
        ? {
            objectKind: 'geometry-obstacle' as const,
            objectId: geometryObstacle.id,
            objectLabel: geometryObstacle.label || '区域／障碍物',
          }
        : null
    })()
    if (magicMouthObject === null) return { ok: false, reason: 'invalid-map-object-selection' }
    const { cols, rows } = mapCellExtent(map)
    const occupied = new Set(map.tokens.flatMap((token) =>
      tokenOccupiedCellsAt(token, map, token).map(cellKey)))
    const used = new Set<string>()
    const candidateAnchors: GridCell[] = selectedInstances.length ? selectedInstances.map(selection => selection.anchorCell)
      : instanceCount === 1 ? [{ ...baseAnchor }] : []
    for (let radius = 0; instanceCount > 1 && radius <= Math.max(cols, rows) && candidateAnchors.length < instanceCount; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
          if (Math.max(Math.abs(colOffset), Math.abs(rowOffset)) !== radius) continue
          const anchor = { col: baseAnchor.col + colOffset, row: baseAnchor.row + rowOffset }
          const translated = cells.map((cell) => ({
            col: anchor.col + cell.col - baseAnchor.col,
            row: anchor.row + cell.row - baseAnchor.row,
          }))
          const placeRangeFeet = input.activity.target.kind === 'area'
            ? input.activity.target.placeRangeFeet ?? 0
            : 0
          if (
            translated.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
            translated.some((cell) => occupied.has(cellKey(cell)) || used.has(cellKey(cell))) ||
            cellDistance(actorCell, anchor) * Math.max(1, map.feetPerCell ?? 5) > placeRangeFeet
          ) continue
          candidateAnchors.push(anchor)
          translated.forEach((cell) => used.add(cellKey(cell)))
          if (candidateAnchors.length >= instanceCount) break
        }
        if (candidateAnchors.length >= instanceCount) break
      }
    }
    if (candidateAnchors.length !== instanceCount) return { ok: false, reason: 'invalid-persistent-area' }
    const directionalGeometry = proposal.directionalMovementCost || proposal.modes?.some(mode => mode.directionalMovementCost)
      ? persistentRectGeometryForSelection(input.activity, input.areaSelection, actorToken, map) : undefined
    if (proposal.directionalMovementCost && !directionalGeometry) return { ok: false, reason: 'invalid-persistent-area' }
    const modeState = proposal.modes ? resolveDnd5ePersistentAreaModeState({
      profiles: proposal.modes, initialModeId: proposal.initialModeId ?? '', direction: directionalGeometry?.direction, sourceSaveDc: input.sourceSaveDc, excludedTokenIds: proposal.triggerExemptTargetIds,
    }) : undefined
    if (proposal.modes && !modeState) return { ok: false, reason: 'invalid-persistent-area' }
    const resolvedTriggers = proposal.triggers?.map(trigger => resolveDnd5ePersistentAreaTriggerSourceDc(trigger, input.sourceSaveDc))
    if (resolvedTriggers?.some(trigger => !trigger)) return { ok: false, reason: 'invalid-persistent-area' }
    const triggers = (resolvedTriggers as Dnd5ePersistentAreaTriggerSnapshot[] | undefined)?.map((trigger) => ({
      ...trigger,
      excludedTokenIds: proposal.triggerExemptTargetIds?.length
        ? [...proposal.triggerExemptTargetIds]
        : undefined,
    }))
    const ids = new Set(candidateAnchors.map((_, index) =>
      instanceCount === 1 ? baseId : `${baseId}:${index + 1}`))
    const sourceLimit = normalizeDnd5ePersistentAreaSourceLimit(proposal.sourceLimit)
    if (proposal.sourceLimit != null) {
      if (!sourceLimit || !input.sourceLimitMaps) return { ok: false, reason: 'invalid-persistent-area' }
      const maps = [map, ...input.sourceLimitMaps.filter(candidate => candidate.id !== map.id)]
      const existing = maps.flatMap(candidate => (candidate.dnd5ePluginAreas ?? []).filter(area => {
        if (area.pluginId !== input.packageId || area.sourceLimit?.groupId !== sourceLimit.groupId ||
          (candidate.id === map.id && ids.has(area.id))) return false
        const sameSource = actorToken.characterId
          ? area.sourceCharacterId === actorToken.characterId
          : candidate.id === map.id && area.sourceTokenId === actorToken.id
        if (!sameSource) return false
        if (area.permanent === true) return true
        if (area.expiresAtWorldMinute != null && input.worldMinute != null) return input.worldMinute < area.expiresAtWorldMinute
        // Rounds from a different map cannot be compared to the current combat.
        return candidate.id !== map.id || input.round <= area.expiresAfterRound
      }))
      const maximum = Math.min(sourceLimit.maximum, ...existing.map(area => area.sourceLimit!.maximum))
      if (existing.length + instanceCount > maximum) return { ok: false, reason: 'invalid-persistent-area' }
    }
    const effectTokenIds = new Set(candidateAnchors.map((_, index) =>
      instanceCount === 1
        ? `activity-effect:${input.actionId}:${proposal.operationId}`
        : `activity-effect:${input.actionId}:${proposal.operationId}:${index + 1}`))
    if (proposal.concentration) {
      const concentrationId = input.concentrationId ?? `activity:${input.activity.id}`
      const currentActionAreaPrefix = `activity-area:${input.actionId}:`
      const replacedAreas = (map.dnd5ePluginAreas ?? []).filter((area) =>
        area.sourceTokenId === actorToken.id &&
        area.concentrationId === concentrationId &&
        !area.id.startsWith(currentActionAreaPrefix),
      )
      if (replacedAreas.length > 0) {
        const replacedAreaIds = new Set(replacedAreas.map((area) => area.id))
        const replacedEffectTokenIds = new Set(replacedAreas.flatMap((area) =>
          area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
        ))
        map.dnd5ePluginAreas = (map.dnd5ePluginAreas ?? []).filter((area) =>
          !replacedAreaIds.has(area.id),
        )
        map.tokens = map.tokens.filter((token) => !replacedEffectTokenIds.has(token.id))
      }
    }
    const surfaceCells = verticalSurface ? verticalSurfaceCells(verticalSurface,map) : []
    if(verticalSurface && !surfaceCells.length)return {ok:false,reason:'invalid-persistent-area'}
    const instanceCellsByAnchor = verticalSurface ? [surfaceCells] : selectedInstances.length ? selectedInstances.map(selection => [...selection.cells])
      : candidateAnchors.map((anchorCell) => cells.map((cell) => ({
      col: anchorCell.col + cell.col - baseAnchor.col,
      row: anchorCell.row + cell.row - baseAnchor.row,
    })))
    const targetAnchorTokenId = proposal.anchorMode === 'target-token'
      ? input.areaSelection?.targetIds.find((targetId) =>
          map.tokens.some((token) => token.id === targetId && token.type !== 'obstacle'))
      : undefined
    if (proposal.anchorMode === 'target-token' && !targetAnchorTokenId) {
      return { ok: false, reason: 'invalid-persistent-area' }
    }
    const sensorTargetToken = proposal.effectToken?.followSelectedTarget
      ? map.tokens.find(token => token.id === targetAnchorTokenId && token.type !== 'obstacle') : undefined
    if (proposal.effectToken?.followSelectedTarget != null && (
      proposal.effectToken.followSelectedTarget !== true || !sensorTargetToken ||
      input.areaSelection?.targetIds.length !== 1 || instanceCount !== 1 ||
      proposal.sourceFollower != null || proposal.effectToken.remotePlacement != null ||
      proposal.effectToken.hiddenBody !== true || proposal.effectToken.visionFromSource !== true ||
      (sensorTargetToken.characterId && map.tokens.filter(token => token.type !== 'obstacle' &&
        token.characterId === sensorTargetToken.characterId).length !== 1)
    )) return { ok: false, reason: 'invalid-persistent-area' }
    if (proposal.creationConstraints) {
      for (const instanceCells of instanceCellsByAnchor) {
        if (proposal.creationConstraints.forbidCoreSpellOverlap) {
          const keys = new Set(instanceCells.map((cell) => `${cell.col}:${cell.row}`))
          if ((map.dnd5ePluginAreas ?? []).some((area) =>
            area.sourceKind === 'core-spell' &&
            area.coreSpellId === proposal.creationConstraints!.forbidCoreSpellOverlap &&
            area.cells.some((cell) => keys.has(`${cell.col}:${cell.row}`)))) {
            return { ok: false, reason: 'invalid-persistent-area' }
          }
        }
        const creatures = tokensOccupyingCells(map, instanceCells).filter((token) => token.type !== 'obstacle')
        if (
          proposal.creationConstraints.maximumCreatureCount != null &&
          creatures.length > proposal.creationConstraints.maximumCreatureCount
        ) return { ok: false, reason: 'invalid-persistent-area' }
        if (
          proposal.creationConstraints.maximumCreatureSizeRank != null &&
          creatures.some((token) => mapTokenSizeRank(token) > proposal.creationConstraints!.maximumCreatureSizeRank!)
        ) return { ok: false, reason: 'invalid-persistent-area' }
      }
    }
    const sourceSpellId = input.activity.legacySource?.kind === 'spell'
      ? input.activity.legacySource.id : undefined
    const qualifiedSpellId = sourceSpellId ? `${input.packageId}:${sourceSpellId}` : undefined
    const coreSpellId = qualifiedSpellId && dnd5ePluginSpellDefinition(qualifiedSpellId)
      ? qualifiedSpellId : sourceSpellId
    const createdEffectTokens: Token[] = proposal.effectToken
      ? candidateAnchors.map((anchorCell, index) => {
          const id = [...effectTokenIds][index]!
          const size = Math.max(0.25, Math.min(8, proposal.effectToken!.size ?? 1))
          const cells = instanceCellsByAnchor[index]!
          const minCol = Math.min(...cells.map(cell => cell.col)), minRow = Math.min(...cells.map(cell => cell.row))
          const fillsToken = size > 1 && Number.isInteger(size) && cells.length === size * size &&
            cells.every(cell => cell.col >= minCol && cell.col < minCol + size && cell.row >= minRow && cell.row < minRow + size)
          const position = tokenCenterForAnchorCell(fillsToken ? { col: minCol, row: minRow } : anchorCell, { size }, map)
          return {
            id,
            label: proposal.effectToken!.label,
            x: position.x,
            y: position.y,
            elevationFeet: (selectedInstances[index]?.areaPlacement ?? placement).elevationFeet ?? actorToken.elevationFeet ?? 0,
            color: proposal.effectToken!.color ?? proposal.color ?? '#8b5cf6',
            emoji: proposal.effectToken!.emoji ?? '✦',
            size,
            type: 'obstacle' as const,
            // A visible spell entity (for example Mislead, Flaming Sphere, or
            // Arcane Sword) must travel through the ordinary player LOS
            // projection. Marking a hidden-body entity DM-only lets a player
            // projection strip its anchor Token while retaining the linked
            // persistent area, which then fails shared-map validation. The
            // body is already suppressed by MapTokenNode; only explicitly
            // source-only entities need the DM-only projection boundary.
            visibilityMode: proposal.effectToken!.visibleToSourceOnly === true
              ? 'dm-only' as const
              : 'line-of-sight' as const,
            visionRangeFeet: proposal.effectToken!.visionRangeFeet,
            darkvisionRangeFeet: proposal.effectToken!.darkvisionRangeFeet,
            dnd5eSpellEffect: {
              schemaVersion: 1 as const,
              spellId: coreSpellId ?? input.activity.id,
              sourceCharacterId: actorToken.characterId ?? input.actorId,
              sourceTokenId: actorToken.id,
              createdRound: input.round,
              expiresAfterRound: input.round + proposal.durationRounds -
                (input.activity.legacySource?.kind === 'spell' ? 0 : 1),
              concentrationId: proposal.concentration
                ? input.concentrationId ?? `activity:${input.activity.id}`
                : undefined,
              shareVisionWithSource: proposal.effectToken!.shareVisionWithSource === true
                ? true as const
                : undefined,
              visionFromSource: proposal.effectToken!.visionFromSource === true ? true as const : undefined,
              sensorSense: proposal.effectToken!.sensorSense,
              hearingFromSource: proposal.effectToken!.hearingFromSource === true ? true as const : undefined,
              hiddenBody: proposal.effectToken!.hiddenBody === true ? true as const : undefined,
              visibleToSourceOnly: proposal.effectToken!.visibleToSourceOnly === true
                ? true as const
                : undefined,
            },
          }
        })
      : []
    if (createdEffectTokens.length > 0) {
      const sourceDefinition=coreSpellId?dnd5ePluginSpellDefinition(coreSpellId):undefined
      const divinationSensor=sourceDefinition?.school==='divination'&&
        (proposal.effectToken?.shareVisionWithSource||proposal.effectToken?.hearingFromSource)
      if(divinationSensor&&createdEffectTokens.some(sensor=>dnd5eTempleWardAt(
        mapGeometryRuntimeForMap(map.id),sensor,sensor.elevationFeet??0,input.worldMinute))) {
        return {ok:false,reason:'invalid-persistent-area'}
      }
      map.tokens = [
        ...map.tokens.filter((token) => !effectTokenIds.has(token.id)),
        ...createdEffectTokens,
      ]
      changedTokenIds.push(...effectTokenIds)
    }
    const clippedHeights: number[] = []
    if (proposal.clipHeightToMappedSolids) {
      if (input.activity.target.kind !== 'area' || input.activity.target.placementSurface !== 'ground' ||
        !proposal.separateSelectedInstances || !selectedInstances.length) return { ok: false, reason: 'invalid-persistent-area' }
      const liftedIds = new Set(input.handoffs.movements.filter(movement => movement.mode === 'ascend' &&
        movement.verticalDestination === 'area-top' && movement.stopAtMappedObstacle).map(movement => movement.targetId))
      for (const [index, anchor] of candidateAnchors.entries()) {
        const placement = selectedInstances[index].areaPlacement
        const base = placement.elevationFeet ?? mapGeometryTerrainElevationAtPoint(areaGeometry, cellToPixel(anchor, map))
        if (!Number.isFinite(placement.heightFeet) || placement.heightFeet! <= 0) return { ok: false, reason: 'invalid-persistent-area' }
        const desiredTop = base + placement.heightFeet!
        const probe = { ...actorToken, ...cellToPixel(anchor, map), size: Math.max(1, (placement.widthFeet ?? 5) / (map.feetPerCell ?? 5)) }
        let top = dnd5eMappedVerticalDisplacement({ map, geometry: areaGeometry, token: probe,
          fromFeet: base, toFeet: desiredTop, bodyHeightFeet: 0 }).elevationFeet
        for (const occupant of tokensOccupyingCells(map, instanceCellsByAnchor[index]).filter(token => liftedIds.has(token.id))) {
          const from = mapGeometryTokenElevation(areaGeometry, occupant)
          const sweep = dnd5eMappedVerticalDisplacement({ map, geometry: areaGeometry, token: occupant,
            fromFeet: from, toFeet: desiredTop })
          top = Math.min(top, sweep.elevationFeet)
        }
        if (top <= base) return { ok: false, reason: 'invalid-persistent-area' }
        clippedHeights.push(top - base)
      }
    }
    // Exact surface markings validate their physical footprint, not every touched grid square.
    const exactTopSurfaces = instanceCellsByAnchor.map((_, index) => {
      const target = input.activity.target
      if (verticalSurface || !areaGeometry || target.kind !== 'area' || target.gridAligned !== false ||
        !['rect', 'cube'].includes(target.shape) || !proposal.surfaceAtPlacementElevation || !proposal.requireAllSurfaceMaterials ||
        !proposal.surfaceMaterials?.length || !['surface-inscription','surface-color','surface-drawing'].includes(proposal.visual?.preset ?? '')) return undefined
      const current = selectedInstances[index]?.areaPlacement ?? areaInstance
      const scale = map.gridSize / (map.feetPerCell ?? 5)
      const width = current.widthFeet!, length = current.lengthFeet!
      if (![width,length,current.x,current.y,current.elevationFeet].every(Number.isFinite) || width <= 0 || length <= 0 ||
        width > (target.widthFeet ?? 0) || length > (target.lengthFeet ?? target.heightFeet ?? 0)) return undefined
      const angle = (current.angleDegrees ?? 0) * Math.PI / 180
      const ux = Math.cos(angle), uy = Math.sin(angle)
      const corners = [[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]]
        .map(([x,y])=>({x:current.x+(x*ux-y*uy)*scale,y:current.y+(x*uy+y*ux)*scale}))
      return selectHorizontalMaterialSurface({geometry:areaGeometry,corners,elevationFeet:current.elevationFeet!,pixelsPerFoot:scale,materials:proposal.surfaceMaterials})
    })
    if (!verticalSurface && proposal.requireAllSurfaceMaterials && (!proposal.surfaceMaterials?.length ||
      instanceCellsByAnchor.some((cells,index) => !cells.length || (!exactTopSurfaces[index] && cells.some(cell => {
        const surfaceElevationFeet=proposal.surfaceAtPlacementElevation ? (selectedInstances[index]?.areaPlacement ?? areaInstance).elevationFeet : undefined
        const samples = mapGeometryFootprintTerrainSamples({ geometry: areaGeometry, at: cellToPixel(cell, map), halfSizePixels: map.gridSize / 2, surfaceElevationFeet,
          ...(proposal.requireNonmagicalSurfaceMaterials ? {includeMaterialMagic:true as const} : {}) })
        return !samples.length || samples.some(sample => !sample.material || !proposal.surfaceMaterials!.includes(sample.material) ||
          (proposal.requireNonmagicalSurfaceMaterials && sample.materialMagic !== 'nonmagical'))
      }))))) {
      return { ok: false, reason: 'invalid-persistent-area' }
    }
    if (proposal.normalGroundTerrain && instanceCellsByAnchor.some(cells => cells.some(cell => {
      const point = cellToPixel(cell, map)
      const elevationFeet = mapGeometryTerrainElevationAtPoint(areaGeometry, point)
      const probe = { ...actorToken, ...point, size: 1, elevationFeet }
      const groundMap = { ...map, dnd5ePluginAreas: (map.dnd5ePluginAreas ?? []).filter(area => area.vertical?.mode === 'ground') }
      return Math.max(
        terrainMultiplierAtPoint(areaGeometry, point, { map, token: probe, elevationFeet, tokenHeightFeet: 1, canClimb: true, canSwim: true }),
        dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: groundMap, token: probe, position: point }),
      ) <= 1
    }))) return { ok: false, reason: 'invalid-persistent-area' }
    const createdAreas: Dnd5ePluginArea[] = candidateAnchors.map((anchorCell, index) => {
      const selectedInstance = selectedInstances[index]
      const instancePlacement = { ...(selectedInstance?.areaPlacement ?? areaInstance),
        ...(proposal.clipHeightToMappedSolids ? { heightFeet: clippedHeights[index] } : {}) }
      const id = instanceCount === 1 ? baseId : `${baseId}:${index + 1}`
      const effectTokenId = createdEffectTokens[index]?.id
      const effectAnchor = createdEffectTokens[index] && tokenAnchorCellFromPixel(
        createdEffectTokens[index].x, createdEffectTokens[index].y, createdEffectTokens[index], map)
      const instanceCells = instanceCellsByAnchor[index]!.filter(cell => verticalSurface || exactTopSurfaces[index] || !proposal.surfaceMaterials ||
        proposal.surfaceMaterials.includes((proposal.surfaceAtPlacementElevation
          ? mapGeometrySurfaceMaterialAtElevation(areaGeometry,cellToPixel(cell,map),instancePlacement.elevationFeet ?? mapGeometryTerrainElevationAtPoint(areaGeometry,cellToPixel(cell,map)))
          : mapGeometrySurfaceMaterialAtPoint(areaGeometry, cellToPixel(cell, map)))!))
      const initialOccupants = proposal.blocking?.entryPermission === 'occupants-at-creation'
        ? tokensOccupyingCells(map, instanceCells).map((token) => token.id)
        : undefined
      const horizontalSurface=exactTopSurfaces[index] ?? (()=>{
        if(verticalSurface||!areaGeometry||!proposal.surfaceAtPlacementElevation||!proposal.requireAllSurfaceMaterials||
          !proposal.surfaceMaterials?.length||!['surface-inscription','surface-color','surface-drawing'].includes(proposal.visual?.preset??'')||!instanceCells.length)return undefined
        const minCol=Math.min(...instanceCells.map(cell=>cell.col)),maxCol=Math.max(...instanceCells.map(cell=>cell.col))
        const minRow=Math.min(...instanceCells.map(cell=>cell.row)),maxRow=Math.max(...instanceCells.map(cell=>cell.row))
        if(new Set(instanceCells.map(cellKey)).size!==(maxCol-minCol+1)*(maxRow-minRow+1))return undefined
        const left=map.gridOffsetX+minCol*map.gridSize,right=map.gridOffsetX+(maxCol+1)*map.gridSize
        const top=map.gridOffsetY+minRow*map.gridSize,bottom=map.gridOffsetY+(maxRow+1)*map.gridSize
        return selectHorizontalMaterialSurface({geometry:areaGeometry,corners:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}],
          elevationFeet:instancePlacement.elevationFeet!,pixelsPerFoot:map.gridSize/(map.feetPerCell??5),materials:proposal.surfaceMaterials})
      })()
      const createdWorldMinute = Number.isSafeInteger(input.worldMinute) && Number(input.worldMinute) >= 0
        ? Number(input.worldMinute)
        : undefined
      return {
        id,
        pluginId: input.packageId,
        featureId: input.activity.id,
        sourceKind: coreSpellId ? 'core-spell' as const : 'plugin-feature' as const,
        coreSpellId,
        slotLevel: Number.isInteger(input.castLevel) && Number(input.castLevel) >= 0 && Number(input.castLevel) <= 9
          ? Number(input.castLevel)
          : undefined,
        sourceSpellSaveDc: Number.isInteger(input.sourceSaveDc) &&
          Number(input.sourceSaveDc) >= 1 && Number(input.sourceSaveDc) <= 40
            ? Number(input.sourceSaveDc)
            : undefined,
        utilityProjectionId: proposal.utilityProjectionId,
        label: instanceCount === 1 ? proposal.label : `${proposal.label} ${index + 1}`,
        color: proposal.color ?? '#8b5cf6',
        sourceCharacterId: actorToken.characterId ?? input.actorId,
        sourceTokenId: actorToken.id,
        cells: instanceCells,
        createdRound: input.round,
        creationActivationScope: proposal.grantedActivities?.some(grant => grant.activationWindow === 'creation-turn')
          ? persistentAreaMovementScope({ mapId: map.id, actorId: actorToken.id, combatId: input.combatId,
              round: input.round, turnKey: input.turnKey, worldMinute: input.worldMinute,
              worldSecondRemainder: input.worldSecondRemainder }) : undefined,
        // Spell-backed Activity areas use the same exclusive round boundary as
        // createDnd5eCoreSpellArea. Plugin feature areas retain their inclusive
        // final-round representation.
        expiresAfterRound: input.round + proposal.durationRounds - (coreSpellId ? 0 : 1),
        createdWorldMinute,
        expiresAtWorldMinute: proposal.permanent !== true && createdWorldMinute != null
          ? createdWorldMinute + Math.max(1, Math.ceil(proposal.durationRounds / 10))
          : undefined,
        permanent: proposal.permanent === true ? true : undefined,
        magicMouth: proposal.magicMouth && magicMouthObject
          ? { ...proposal.magicMouth, ...magicMouthObject }
          : undefined,
        concentrationId: proposal.concentration
          ? input.concentrationId ?? `activity:${input.activity.id}`
          : undefined,
        // Cleared-by-hand residual terrain is physical ground, independent of the initial spell's victims.
        relation: proposal.terrainClearing ? 'any' : input.activity.target.kind === 'area' ? input.activity.target.relation : 'any',
        includeSelf: proposal.terrainClearing ? true : input.activity.target.kind === 'area' && input.activity.target.includeSelf === true,
        visual: proposal.visual ? { ...proposal.visual, verticalSurface, horizontalSurface } : undefined,
        lighting: proposal.lighting ? { ...proposal.lighting } : undefined,
        hallow: proposal.hallow ? {
          ...proposal.hallow,
          wardedCreatureTypes: [...proposal.hallow.wardedCreatureTypes],
        } : undefined,
        hallucinatoryTerrain: proposal.hallucinatoryTerrain
          ? { ...proposal.hallucinatoryTerrain }
          : undefined,
        symbol: proposal.symbolMode ? { mode: proposal.symbolMode, activated: false } : undefined,
        hiddenFromPlayers: proposal.hiddenFromPlayers || proposal.symbolMode || proposal.discovery ? true : undefined,
        visualRecognition: proposal.discovery ? { dc: input.sourceSaveDc!, skill: proposal.discovery.skill, knownTokenIds: [actorToken.id] } : undefined,
        programmedIllusion: proposal.programmedIllusion
          ? { ...proposal.programmedIllusion }
          : undefined,
        movement: proposal.movement ? { ...proposal.movement } : undefined,
        sourceFollower: proposal.sourceFollower ? { ...proposal.sourceFollower } : undefined,
        sensorTarget: sensorTargetToken ? { tokenId: sensorTargetToken.id,
          characterId: sensorTargetToken.characterId } : undefined,
        lifecycle: proposal.lifecycle ? structuredClone(proposal.lifecycle) : undefined,
        modeState: modeState ? structuredClone(modeState) : undefined,
        directionalMovementCost: proposal.directionalMovementCost && directionalGeometry ? {
          direction: { ...directionalGeometry.direction }, additionalFeetPerFoot: proposal.directionalMovementCost.additionalFeetPerFoot,
        } : undefined,
        movementCostMultiplier: proposal.movementCostMultiplier,
        normalGroundTerrain: proposal.normalGroundTerrain,
        terrainClearing: proposal.terrainClearing ? { ...proposal.terrainClearing } : undefined,
        movementRequiresGroundedSource: proposal.movementRequiresGroundedSource,
        movementExcludesSource: proposal.movementExcludesSource,
        movementGroundCover: proposal.movementGroundCover,
        extinguishesUnprotectedFlames: proposal.extinguishesUnprotectedFlames,
        endFlameExtinguishRadiusFeet: proposal.endFlameExtinguishRadiusFeet,
        excludesWindDispersibleGas: proposal.excludesWindDispersibleGas,
        obscuration: proposal.obscuration ? { ...proposal.obscuration } : undefined,
        dispersedByStrongWind: proposal.dispersedByStrongWind,
        ignitesUnattendedFuel: proposal.ignitesUnattendedFuel,
        occupantModifiers: proposal.occupantModifiers
          ? {
              ...proposal.occupantModifiers,
              damageImmunities: proposal.occupantModifiers.damageImmunities
                ? [...proposal.occupantModifiers.damageImmunities]
                : undefined,
              damageResistances: proposal.occupantModifiers.damageResistances
                ? [...proposal.occupantModifiers.damageResistances]
                : undefined,
              damageVulnerabilities: proposal.occupantModifiers.damageVulnerabilities
                ? [...proposal.occupantModifiers.damageVulnerabilities]
                : undefined,
              conditionImmunities: proposal.occupantModifiers.conditionImmunities
                ? [...proposal.occupantModifiers.conditionImmunities]
                : undefined,
            }
          : undefined,
        blocking: proposal.blocking || proposal.teleportationExitSavingThrow
          ? {
              ...proposal.blocking,
              ...(proposal.teleportationExitSavingThrow
                ? {
                    blocksTeleportationExit: true,
                    teleportationExitSavingThrow: {
                      ability: proposal.teleportationExitSavingThrow.ability,
                      dc: proposal.teleportationExitSavingThrow.dc === 'source-save-dc'
                        ? Math.max(1, Math.min(40, Math.floor(input.sourceSaveDc ?? 10)))
                        : proposal.teleportationExitSavingThrow.dc,
                    },
                  }
                : {}),
              authorizedTokenIds: initialOccupants,
            }
          : undefined,
        entityProfile: proposal.entityProfile ? { ...proposal.entityProfile } : undefined,
        projectionDefense: proposal.projectionDefense,
        illusionRecognition: proposal.investigationDc === 'source-save-dc' && input.sourceSaveDc != null
          ? { dc: input.sourceSaveDc, knownTokenIds: [] } : undefined,
        entityCurrentHitPoints: proposal.entityProfile?.hitPoints,
        weaponHitBonusDamage: proposal.weaponHitBonusDamage
          ? { ...proposal.weaponHitBonusDamage }
          : undefined,
        grantedActivities: proposal.grantedActivities?.map((grant) => ({ ...grant })),
        triggers: triggers && triggers.length > 0 ? triggers : undefined,
        anchorMode: effectTokenId ? 'effect-token' : proposal.anchorMode ?? (
          input.activity.target.kind === 'area' && input.activity.target.origin === 'self'
            ? 'source-token'
            : 'fixed'
        ),
        anchorTokenOffsetCells: effectAnchor && (effectAnchor.col !== anchorCell.col || effectAnchor.row !== anchorCell.row)
          ? { col: anchorCell.col - effectAnchor.col, row: anchorCell.row - effectAnchor.row } : undefined,
        anchorTokenId: effectTokenId ?? targetAnchorTokenId ?? (
          (proposal.anchorMode ?? (
            input.activity.target.kind === 'area' && input.activity.target.origin === 'self'
              ? 'source-token'
              : 'fixed'
          )) === 'source-token'
            ? actorToken.id
            : undefined
        ),
        anchorCell,
        rectGeometry: persistentRectGeometryForSelection(input.activity, selectedInstance ?? input.areaSelection, actorToken, map),
        circularGeometry: input.activity.target.kind === 'area' && input.activity.target.shape === 'cylinder' && instancePlacement.radiusFeet &&
          (proposal.entityProfile || input.activity.target.wallThicknessFeet != null || proposal.movement?.carryRestrainedTargets)
          ? { radiusFeet: instancePlacement.radiusFeet,
              ...(input.activity.target.wallThicknessFeet != null
                ? {innerRadiusFeet:instancePlacement.radiusFeet-input.activity.target.wallThicknessFeet} : {}) } : undefined,
        sourceExitBehavior: proposal.sourceExitBehavior,
        restSessionId: restSession?.id,
        concealsFlameLightFromOutside: proposal.concealsFlameLightFromOutside,
        sourceSlotSpellHealing: proposal.sourceSlotSpellHealing ? { ...proposal.sourceSlotSpellHealing } : undefined,
        creatureDetectionAdvantage: proposal.creatureDetectionAdvantage,
        attackAdvantageReaction: proposal.attackAdvantageReaction,
        sourceIncapacitatedBehavior: proposal.sourceIncapacitatedBehavior,
        sourceAbilityCheckRules: proposal.sourceAbilityCheckRules?.map(rule => structuredClone(rule)),
        sourceOverlapBehavior: proposal.sourceOverlapBehavior,
        sourceLimit,
        vertical: proposal.groundOnly === true ? { mode: 'ground' }
          : input.activity.target.kind === 'area' && input.activity.target.shape === 'sphere' && input.activity.target.radiusFeet
          ? {
              mode: 'volume',
              shape: 'sphere',
              baseElevationFeet: (instancePlacement.elevationFeet ?? actorToken.elevationFeet ?? 0) - input.activity.target.radiusFeet,
              heightFeet: input.activity.target.radiusFeet * 2,
              ...((effectTokenId || proposal.anchorMode === 'source-token' || proposal.anchorMode === 'target-token' || input.activity.target.origin === 'self')
                ? { anchorOffsetFeet: -input.activity.target.radiusFeet } : {}),
            }
          : instancePlacement.heightFeet
          ? {
              mode: 'volume',
              baseElevationFeet: instancePlacement.elevationFeet ?? actorToken.elevationFeet ?? 0,
              heightFeet: instancePlacement.heightFeet,
            }
          : undefined,
      }
    })
    if (sensorTargetToken) {
      const synchronized = reconcileDnd5ePersistentAreaAnchors({ ...map, dnd5ePluginAreas: createdAreas })
      map.tokens = synchronized.tokens
      createdAreas.splice(0, createdAreas.length, ...(synchronized.dnd5ePluginAreas ?? []))
      if (createdAreas.length !== instanceCount) return { ok: false, reason: 'invalid-persistent-area' }
    }
    for (let index = createdAreas.length - 1; index >= 0; index--) {
      if (createdAreas[index].cells.length === 0) createdAreas.splice(index, 1)
    }
    if(proposal.materialTransformation){
      const transform=proposal.materialTransformation,target=input.activity.target
      const falling=transform.mode==='ceiling-rock-to-mud'
      const depth=transform.depthFeet==='selected-height'?areaInstance.heightFeet:transform.depthFeet
      if(!input.supportsStructureCommit||structureGeometry||!areaGeometry||createdAreas.length!==1||target.kind!=='area'||
        !['rect','cube'].includes(target.shape)||proposal.permanent!==true||proposal.concentration!==false||
        (falling?proposal.groundOnly!=null||proposal.surfaceMaterials!=null||proposal.requireNonmagicalSurfaceMaterials!=null||proposal.surfaceAtPlacementElevation!=null||target.placementSurface==='ground'||!Number.isFinite(areaInstance.elevationFeet)
          :proposal.groundOnly!==true||proposal.requireNonmagicalSurfaceMaterials!==true)||
        proposal.anchorMode!=='fixed'||!['rock-to-mud','mud-to-rock','ceiling-rock-to-mud'].includes(transform.mode)||
        depth==null||!Number.isFinite(depth)||depth<=0||depth>(transform.mode==='mud-to-rock'?10:40))return {ok:false,reason:'invalid-persistent-area'}
      const width=areaInstance.widthFeet,length=areaInstance.lengthFeet
      if(width==null||length==null||![areaInstance.x,areaInstance.y,width,length].every(Number.isFinite))return {ok:false,reason:'invalid-persistent-area'}
      const top=areaInstance.elevationFeet??mapGeometryTerrainElevationAtPoint(areaGeometry,{x:areaInstance.x,y:areaInstance.y})
      const request={geometry:areaGeometry,executionId:materialTransformationExecutionId(input.actionId),center:{x:areaInstance.x,y:areaInstance.y},
        angleDegrees:areaInstance.angleDegrees??0,widthFeet:length,lengthFeet:width,heightFeet:depth,bottomFeet:falling?top:top-depth,
        pixelsPerFoot:map.gridSize/(map.feetPerCell??5),mode:transform.mode==='mud-to-rock'?'mud-to-rock' as const:'rock-to-mud' as const}
      const entityIds=areaGeometry.obstacles.filter(body=>prepareMaterialVolumeTransformation({...request,entityIds:[body.id]})).map(body=>body.id)
      const fallen=falling&&entityIds.length?prepareHostFallingMaterialTransformation({...request,entityIds}):undefined
      const converted=falling?fallen:entityIds.length?prepareMaterialVolumeTransformation({...request,entityIds}):undefined
      if(!converted)return {ok:false,reason:'invalid-persistent-area'}
      structureGeometry=converted.geometry
      createdAreas[0].materialTransformation=converted.receipt
      createdAreas[0].materialTransformationAvailable=true
      if(fallen){
        createdAreas[0].materialFallVolumes=fallen.falls
        const bottom=Math.min(...fallen.falls.map(volume=>volume.bottomFeet)),top=Math.max(...fallen.falls.map(volume=>volume.topFeet))
        createdAreas[0].vertical={mode:'volume',baseElevationFeet:bottom,heightFeet:top-bottom}
      }
    }
    map.dnd5ePluginAreas = [
      ...(map.dnd5ePluginAreas ?? []).filter((area) => !ids.has(area.id)),
      ...createdAreas.map(area => area.modeState ? projectDnd5ePersistentAreaMode(area, area.modeState) : area),
    ]
    for (const area of createdAreas) if (area.entityProfile?.supportsStanding) newlyCreatedSupportIds.add(area.id)
    if (proposal.bindRestraintEffectIds?.length) for (const area of createdAreas) {
      const bound = bindDnd5eAreaRestraints({ map, characters: boundCharacters, area, effectIds: proposal.bindRestraintEffectIds })
      map.tokens = bound.map.tokens
      boundCharacters = bound.characters
      changedTokenIds.push(...bound.changedTokenIds)
      boundCharacterIds.push(...bound.changedCharacterIds)
    }
  }

  for (const proposal of input.handoffs.duplications ?? []) {
    const subject = map.tokens.find((token) => token.id === proposal.targetId && token.type !== 'obstacle')
    if (
      !subject ||
      proposal.profile !== 'simulacrum' ||
      (input.combatId != null && (!Number.isFinite(input.sourceInitiative) || !Number.isInteger(input.sourceInitiative)))
    ) {
      return { ok: false, reason: 'invalid-summon-placement' }
    }
    const tokenId = `activity-simulacrum:${actorToken.id}`
    map.tokens = map.tokens.filter((token) => token.id !== tokenId)
    const { cols, rows } = mapCellExtent(map)
    const occupied = new Set(map.tokens
      .filter((token) => token.type !== 'obstacle' || token.obstacleKind !== 'marker')
      .flatMap((token) => tokenOccupiedCellsAt(token, map, token).map(cellKey)))
    const subjectCell = tokenAnchorCellFromPixel(subject.x, subject.y, subject, map)
    let destination: GridCell | undefined
    for (let radius = 1; radius <= Math.max(cols, rows) && !destination; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius && !destination; rowOffset += 1) {
        for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
          if (Math.max(Math.abs(colOffset), Math.abs(rowOffset)) !== radius) continue
          const cell = { col: subjectCell.col + colOffset, row: subjectCell.row + rowOffset }
          if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) continue
          const position = tokenCenterForAnchorCell(cell, subject, map)
          const footprint = tokenOccupiedCellsAt(subject, map, position)
          if (footprint.some((entry) => occupied.has(cellKey(entry)))) continue
          if (mapGeometryPlacementBlocked({ geometry: mapGeometryRuntimeForMap(map.id), map, token: subject, at: position }).blocked) continue
          destination = cell
          break
        }
      }
    }
    if (!destination) return { ok: false, reason: 'invalid-summon-placement' }
    const position = tokenCenterForAnchorCell(destination, subject, map)
    const side = dnd5eCombatTokenSide(actorToken) ?? 'player'
    const duplicate: Token = {
      ...subject,
      id: tokenId,
      label: `${subject.label}·拟像`,
      x: position.x, y: position.y,
      type: side,
      dnd5eSide: side,
      hp: proposal.maximumHitPoints,
      maxHp: proposal.maximumHitPoints,
      dnd5eCombatState: undefined,
      dnd5eSimulacrum: {
        schemaVersion: 1,
        subjectProfile: (() => {
          const original = input.characters?.find((character) => character.id === subject.characterId)
          if (!original) return undefined
          const { charClass, race, dnd5eRaceId, dnd5eClassChoices, dnd5eFeatIds,
            dnd5eContentChoices, savingThrows, skills, background } = original
          return structuredClone({ charClass, race, dnd5eRaceId, dnd5eClassChoices, dnd5eFeatIds,
            dnd5eContentChoices, savingThrows, skills, background })
        })(),
        sourceTokenId: actorToken.id,
        subjectTokenId: subject.id,
        sourceCharacterId: actorToken.characterId ?? input.actorId,
        sourceActivityId: input.activity.id,
        createdRound: input.round,
        level: proposal.level,
        proficiencyBonus: proposal.proficiencyBonus,
        abilities: { ...proposal.abilities },
        armorClass: proposal.armorClass,
        maximumHitPoints: proposal.maximumHitPoints,
        speed: proposal.speed,
        sizeRank: proposal.sizeRank,
        creatureType: proposal.creatureType,
        saveDc: proposal.saveDc,
        classLevels: proposal.classLevels ? { ...proposal.classLevels } : undefined,
        classResources: Object.fromEntries(Object.entries(proposal.resources).map(([id, resource]) => {
          // A self-copy is created after paying for this casting, not with the slot just consumed.
          const settled = subject.id === actorToken.id
            ? input.characters?.find((character) => character.id === subject.characterId)?.classResources?.[id]
            : undefined
          return [id, { ...resource, current: settled ? Math.min(resource.current, settled.current) : resource.current }]
        })),
        cannotIncreaseLevel: true,
        cannotRegainSpellSlots: true,
        cannotRegainHitPoints: true,
      },
      dnd5eSummon: {
        schemaVersion: 1, pluginId: input.packageId, featureId: input.activity.id,
        sourceCharacterId: actorToken.characterId ?? input.actorId,
        sourceTokenId: actorToken.id, createdRound: input.round,
        expiresAfterRound: input.round + 14_399, side, persistent: true,
      },
    }
    map.tokens.push(duplicate)
    changedTokenIds.push(tokenId)
    if (input.combatId != null) {
      initiativeEntries.push({
        slotId: `${tokenId}:source-companion`, tokenId, label: duplicate.label,
        emoji: duplicate.emoji, color: duplicate.color,
        roll: input.sourceInitiative!,
        turnKind: 'source-companion',
      })
    }
  }

  // Resolve identity against current Host inventory before replacing any existing summon.
  for(const proposal of input.handoffs.summons){
    if(proposal.requiredMonsterMaterialTagPrefix==null)continue
    if(!/^[-a-z0-9.]{1,64}$/.test(proposal.requiredMonsterMaterialTagPrefix))return {ok:false,reason:'invalid-summon-placement'}
    const owner=input.characters?.find(character=>character.id===actorToken.characterId)
    const tag=`${proposal.requiredMonsterMaterialTagPrefix}:${proposal.monsterId}`
    if(!owner || !dnd5eSpellMaterialConsumptionPlan({...owner,dnd5eWorldTimeAppliedMinute:input.worldMinute ?? owner.dnd5eWorldTimeAppliedMinute},
      {label:'召唤绑定物品',options:[{label:'绑定所选实体',components:[{tag,label:'绑定所选实体',quantity:1,consumed:false}]}]})){
      return {ok:false,reason:'invalid-summon-placement'}
    }
  }
  // Check before recast/concentration replacement can erase a living companion.
  for (const proposal of input.handoffs.summons) {
    if (proposal.existingBondPolicy == null) continue
    if (proposal.existingBondPolicy !== 'reject-living' || !proposal.persistent || !proposal.bondKey || !input.sourceLimitMaps) {
      return { ok: false, reason: 'invalid-summon-placement' }
    }
    const requested = input.handoffs.summons.filter(candidate => candidate.bondKey === proposal.bondKey)
      .reduce((count, candidate) => count + candidate.count, 0)
    if (requested !== 1) return { ok: false, reason: 'invalid-summon-placement' }
    const scope = [input.map, ...input.sourceLimitMaps.filter(candidate => candidate.id !== input.map.id)]
    const living = dnd5eHasLivingSummonBond({ maps: scope, characters: input.characters ?? [],
      mapId: input.map.id, actor: actorToken, packageId: input.packageId, bondKey: proposal.bondKey })
    if (living) return { ok: false, reason: 'invalid-summon-placement' }
  }
  const concentrationSummonSourceCharacterId = actorToken.characterId ?? input.actorId
  if (input.handoffs.summons.some((proposal) => proposal.concentration)) {
    const replaced = map.tokens.filter((token) =>
      token.dnd5eSummon?.concentrationId != null &&
      token.dnd5eSummon.sourceCharacterId === concentrationSummonSourceCharacterId)
    if (replaced.length > 0) {
      const replacedIds = new Set(replaced.map((token) => token.id))
      const removedIds = new Set<string>()
      map.tokens = map.tokens.flatMap((token) => {
        if (!replacedIds.has(token.id)) return [token]
        if(token.dnd5eSummon?.controlEnded && (token.dnd5eSummon.uncontrolledLinger || token.dnd5eSummon.controlSave?.lingerDieSides))return [detachDnd5eUncontrolledSummon(token,input.round,undefined,input.worldMinute)]
        if (token.dnd5eSummon?.becomesHostileAfterConcentrationEnds === true) {
          return [{
            ...token,
            dnd5eSummon: {
              ...token.dnd5eSummon,
              concentrationId: undefined,
              becomesHostileAfterConcentrationEnds: undefined,
              side: token.dnd5eSummon.side === 'player' ? 'enemy' as const : 'player' as const,
              controlEnded: true as const,
            },
          }]
        }
        removedIds.add(token.id)
        const restoredObject = dnd5eRestoredSummonedOriginalObject(token)
        const possessions = droppedDnd5eCompanionObjects(token)
        changedTokenIds.push(...possessions.map(possession => possession.id))
        return [...(restoredObject ? [restoredObject] : []), ...possessions]
      })
      changedTokenIds.push(...replacedIds)
      removedTokenIds.push(...removedIds)
    }
  }

  // Persistent recasts replace only pre-existing companions. New members of
  // this atomic batch must remain present for later placement/occupancy checks.
  const replaceableSummonIds = new Set(map.tokens.map(token => token.id))
  let summonIndex = 0
  for (const proposal of input.handoffs.summons) {
    if (proposal.timing !== 'immediate') {
      return { ok: false, reason: 'delayed-summon-placement-unsupported' }
    }
    for (let occurrence = 0; occurrence < proposal.count; occurrence += 1) {
      const animatedObject=proposal.objectTokenId ? map.tokens.find(token=>token.id===proposal.objectTokenId) : undefined
      const originalAnimatedObject=proposal.animatedObjectSize ? dnd5eAnimatedObjectSnapshot(animatedObject,proposal.animatedObjectSize,actorToken.id) : undefined
      if ((proposal.objectTokenId || proposal.animatedObjectSize) && (!originalAnimatedObject || proposal.count!==1 || proposal.corpseTokenId)) return {ok:false,reason:'invalid-summon-placement'}
      if(animatedObject){map.tokens=map.tokens.filter(token=>token.id!==animatedObject.id);removedTokenIds.push(animatedObject.id);changedTokenIds.push(animatedObject.id)}
      const corpse=proposal.corpseTokenId ? map.tokens.find(token=>token.id===proposal.corpseTokenId) : undefined
      if (proposal.corpseTokenId && (!corpse || proposal.count!==1 || (corpse.hp??corpse.maxHp??1)>0)) return {ok:false,reason:'invalid-summon-placement'}
      if (corpse && proposal.afterDamageKillOperationId) {
        const current = createDnd5eMapCombatSnapshot({ combatId: input.combatId ?? `corpse:${map.id}`,
          map, characters: boundCharacters, worldMinute: input.worldMinute,
          initiativeOrder: map.tokens.filter(token => token.type !== 'obstacle').map(token => ({
            tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0,
          })),
        }).state.combatants[corpse.id]
        if (!current || current.currentHp !== 0 || (!current.deathSaves.dead && current.classState.deathRound == null) ||
          current.classState.bodyPresent === false || dnd5eUndeadCreationIsProtected(current.classState.activeEffects)) {
          return { ok:false, reason:'invalid-summon-placement' }
        }
      }
      if (corpse && dnd5eUndeadCreationIsProtected(corpse.dnd5eCombatState?.activeEffects)) return {ok:false,reason:'invalid-summon-placement'}
      if(corpse){map.tokens=map.tokens.filter(token=>token.id!==corpse.id);removedTokenIds.push(corpse.id);changedTokenIds.push(corpse.id)}
      const targetCell = animatedObject ? tokenAnchorCellFromPixel(animatedObject.x,animatedObject.y,animatedObject,map) : corpse ? tokenAnchorCellFromPixel(corpse.x,corpse.y,corpse,map) : truePolymorphOriginalObject
        ? input.areaSelection?.anchorCell
        : input.selection.summonCells?.[summonIndex]
      const initiativeD20 = input.selection.summonInitiativeD20s?.[proposal.groupInitiative?0:summonIndex]
      if (!targetCell || !Number.isSafeInteger(targetCell.col) || !Number.isSafeInteger(targetCell.row) || initiativeD20 == null) return { ok: false, reason: 'invalid-summon-placement' }
      if (proposal.persistent && !proposal.independentPersistent) {
        const sourceCharacterId = actorToken.characterId ?? input.actorId
        const replaced = map.tokens.filter((token) =>
          replaceableSummonIds.has(token.id) && token.dnd5eSummon?.persistent === true &&
          token.dnd5eSummon.pluginId === input.packageId &&
          token.dnd5eSummon.sourceCharacterId === sourceCharacterId &&
          (token.dnd5eSummon.featureId === input.activity.id || (proposal.bondKey && token.dnd5eSummon.bondKey===proposal.bondKey)))
        if (replaced.length > 0) {
          const replacedIds = new Set(replaced.map((token) => token.id))
          for (const id of replacedIds) replaceableSummonIds.delete(id)
          map.tokens = map.tokens.flatMap((token) => {
            if (!replacedIds.has(token.id)) return [token]
            const possessions = droppedDnd5eCompanionObjects(token)
            changedTokenIds.push(...possessions.map(possession => possession.id))
            return possessions
          })
          changedTokenIds.push(...replacedIds)
          removedTokenIds.push(...replacedIds)
        }
      }
      // A committed damage-triggered transformation occurs at the corpse. The
      // caster's subsequent movement must not rerun the original cast range or
      // line-of-effect checks, and must not relocate the creature vertically.
      const corpseTransformation = corpse && proposal.afterDamageKillOperationId
      const placementActorToken = corpseTransformation
        ? { ...actorToken, x: corpse.x, y: corpse.y, elevationFeet: corpse.elevationFeet }
        : actorToken
      const planned = planDnd5eSummonedCreature({
        map,
        actorToken: placementActorToken,
        sourceCharacterId: actorToken.characterId ?? input.actorId,
        featureId: input.activity.id,
        pluginId: input.packageId,
        actionId: `${input.actionId}:${proposal.operationId}`,
        sourceSpellId: proposal.spellEffectSourceId ?? input.activity.spellInvocation?.spellId ??
          (input.activity.legacySource?.kind === 'spell' ? input.activity.legacySource.id : undefined),
        occurrenceIndex: summonIndex,
        concentrationId: proposal.concentration
          ? input.concentrationId ?? `activity:${input.activity.id}`
          : undefined,
        createdWorldMinute: input.worldMinute,
        round: input.round,
        targetCell,
        animatedObject,
        initiativeD20,
        summon: {
          monsterId: proposal.monsterId,
          bondKey:proposal.bondKey,bondEffectId:proposal.bondEffectId,understoodLanguage:proposal.understoodLanguage,telepathyRangeFeet:proposal.telepathyRangeFeet,
          controlSave:proposal.controlSave,
          uncontrolledLinger: proposal.uncontrolledLinger,
          maximumChallengeRating:proposal.maximumChallengeRating,
          requiredCreatureSubtype:proposal.requiredCreatureSubtype,
          autonomousBehavior:proposal.autonomousBehavior,
          commandPolicy:proposal.commandPolicy,
          durationRounds: proposal.durationRounds,
          concentration: proposal.concentration,
          side: proposal.side,
          persistent: proposal.persistent,
          independentPersistent: proposal.independentPersistent,
          persistAfterConcentrationCompletes: proposal.persistAfterConcentrationCompletes,
          becomesHostileAfterConcentrationEnds: proposal.becomesHostileAfterConcentrationEnds,
          temporaryHitPoints: proposal.temporaryHitPoints,
          minimumMaximumHitPoints: proposal.minimumMaximumHitPoints,
          maximumHitPointBonus: proposal.maximumHitPointBonus,
          armorClassBonus: proposal.armorClassBonus,
          weaponAttackBonus: proposal.weaponAttackBonus,
          weaponDamageBonus: proposal.weaponDamageBonus,
          savingThrowBonus: proposal.savingThrowBonus,
          proficientSkillCheckBonus: proposal.proficientSkillCheckBonus,
          naturalWeaponAttacksMagical: proposal.naturalWeaponAttacksMagical,
          weaponAttacksMagical: proposal.weaponAttacksMagical,
          attacksPerAction: proposal.attacksPerAction,
          shareSelfSpellsRangeFeet: proposal.shareSelfSpellsRangeFeet,
      shareSelfSpellsRequiresMounted: proposal.shareSelfSpellsRequiresMounted,
      creatureTypeOverride: proposal.creatureTypeOverride,
      minimumIntelligence: proposal.minimumIntelligence,
          cannotAttack: proposal.cannotAttack,
          walkingSpeedFeet: proposal.walkingSpeedFeet,
          dismissAfterDamageRounds: proposal.dismissAfterDamageRounds,
          sourceDeathBehavior: proposal.sourceDeathBehavior,
        },
      })
      if (!planned.ok) return { ok: false, reason: 'invalid-summon-placement' }
      const placementRange = summonPlacementRange(input.activity, proposal)
      if (!Number.isInteger(placementRange) || placementRange < 0 || placementRange > 100000 ||
        (animatedObject && dnd5eMapTokenDistanceFeet({ map, geometry: mapGeometryRuntimeForMap(map.id), left: actorToken, right: animatedObject }) > placementRange) ||
        (!corpseTransformation && tokenFootprintDistanceCells(actorToken, planned.plan.token, map) * Math.max(1, map.feetPerCell ?? 5) > placementRange) ||
        (proposal.requiresVisiblePlacement != null && typeof proposal.requiresVisiblePlacement !== 'boolean') ||
        (!corpseTransformation && proposal.requiresVisiblePlacement === true && !dnd5eActivityPointVisible({
          map, viewer: actorToken, characters: input.characters, worldMinute: input.worldMinute,
          point: { x: planned.plan.token.x, y: planned.plan.token.y, elevationFeet: actorToken.elevationFeet },
        }))) return { ok: false, reason: 'invalid-summon-placement' }

      const originalObjectSnapshot = originalAnimatedObject ?? truePolymorphOriginalObject
      const plannedToken = originalObjectSnapshot
        ? {
            ...planned.plan.token,
            dnd5eSummon: {
              ...planned.plan.token.dnd5eSummon!,
              truePolymorphOriginalObject:originalObjectSnapshot,
            },
          }
        : planned.plan.token
      if (animatedObject) plannedToken.elevationFeet=animatedObject.elevationFeet
      if (corpseTransformation) plannedToken.elevationFeet = corpse.elevationFeet
      if(corpse) {const {dnd5eSummon:_previous,...original}=corpse;plannedToken.dnd5eSummon={...plannedToken.dnd5eSummon!,animatedCorpse:structuredClone(original)}}
      if(proposal.groupInitiative && initiativeEntries[0]) {
        planned.plan.initiativeEntry.roll=initiativeEntries[0].roll
        planned.plan.initiativeEntry.initiativeCalculation=structuredClone(initiativeEntries[0].initiativeCalculation)
      }
      map.tokens = [...map.tokens, plannedToken]
      if(proposal.protectiveCircle)map.dnd5ePluginAreas=[...(map.dnd5ePluginAreas??[]),{
        id:`${plannedToken.id}:protective-circle`,pluginId:input.packageId,featureId:input.activity.id,
        label:'召唤防护圈',color:'#b4533c',sourceCharacterId:actorToken.characterId??actorToken.id,sourceTokenId:actorToken.id,
        cells:tokenOccupiedCellsAt(actorToken,map,actorToken),createdRound:input.round,expiresAfterRound:input.round+proposal.durationRounds-1,
        concentrationId:plannedToken.dnd5eSummon?.concentrationId,anchorMode:'fixed',
        blocking:{movement:true,movementMode:'boundary',blocksTeleportationEntry:true,blocksTeleportationExit:true,restrictedTokenIds:[plannedToken.id],protectsOccupantsFromRestrictedTokens:true},
      }]
      changedTokenIds.push(planned.plan.token.id)
      initiativeEntries.push(planned.plan.initiativeEntry)
      summonIndex += 1
    }
  }

  for (const proposal of input.handoffs.movements) {
    const target = map.tokens.find((token) => token.id === proposal.targetId)
    if (!target) return { ok: false, reason: 'invalid-movement-placement' }
    if (proposal.mode === 'ascend' || proposal.mode === 'descend') {
      const geometry = mapGeometryRuntimeForMap(map.id)
      const groundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, target)
      const fromElevationFeet = Math.max(groundElevationFeet, target.elevationFeet ?? groundElevationFeet)
      const areaBaseElevationFeet = input.areaSelection?.areaPlacement.elevationFeet
        ?? actorToken.elevationFeet
        ?? mapGeometryTerrainElevationAtPoint(geometry, actorToken)
      const areaTopElevationFeet = input.areaSelection?.areaPlacement.heightFeet != null
        ? areaBaseElevationFeet + input.areaSelection.areaPlacement.heightFeet
        : undefined
      let toElevationFeet = proposal.verticalDestination === 'area-top'
        ? areaTopElevationFeet
        : proposal.verticalDestination === 'ground'
          ? groundElevationFeet
          : proposal.mode === 'ascend'
            ? Math.min(10_000, fromElevationFeet + proposal.distanceFeet)
            : Math.max(groundElevationFeet, fromElevationFeet - proposal.distanceFeet)
      if (!Number.isFinite(toElevationFeet) || toElevationFeet === fromElevationFeet) {
        return { ok: false, reason: 'invalid-movement-placement' }
      }
      if (proposal.maximumDistanceFromActorFeet != null) {
        const actorCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, map)
        const targetCell = tokenAnchorCellFromPixel(target.x, target.y, target, map)
        const actorElevation = actorToken.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, actorToken)
        if (Math.max(cellDistance(actorCell, targetCell) * Math.max(1, map.feetPerCell ?? 5),
          Math.abs(toElevationFeet! - actorElevation)) > proposal.maximumDistanceFromActorFeet) {
          return { ok: false, reason: 'invalid-movement-placement' }
        }
      }
      const verticalSweep = dnd5eMappedVerticalDisplacement({ map, geometry, token: target,
        fromFeet: fromElevationFeet, toFeet: toElevationFeet! })
      if (verticalSweep.blocked) {
        if (proposal.stopAtMappedObstacle !== true || proposal.mode !== 'ascend') return { ok: false, reason: 'invalid-movement-placement' }
        toElevationFeet = verticalSweep.elevationFeet
      }
      // The surface lifting this creature grows beneath it. Ignore only that
      // newly created support while reaching its top, never pre-existing walls.
      const liftMap = proposal.mode === 'ascend' && proposal.verticalDestination === 'area-top'
        ? { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area => {
            if (!newlyCreatedSupportIds.has(area.id) || area.vertical?.mode !== 'volume') return true
            const top = area.vertical.baseElevationFeet + area.vertical.heightFeet
            return Math.abs(top - toElevationFeet!) > 1e-4 ||
              !tokenOccupiedCellsAt(target, map, target).some(cell => area.cells.some(other => other.col === cell.col && other.row === cell.row))
          }) } : map
      if (mapGeometryMovementBlocked({ geometry, map: liftMap, token: target, to: target,
          fromElevationFeet, toElevationFeet }).blocked) return { ok: false, reason: 'invalid-movement-placement' }
      map.tokens = map.tokens.map((token) => token.id === target.id
        ? { ...token, elevationFeet: toElevationFeet }
        : token)
      changedTokenIds.push(target.id)
      movementPaths.push({
        operationId: proposal.operationId,
        targetId: target.id,
        path: [{ x: target.x, y: target.y }],
        to: { x: target.x, y: target.y },
        provokesOpportunityAttacks: false,
      })
      if (proposal.harmful && toElevationFeet !== fromElevationFeet) harmfulMovementTargetIds.add(target.id)
      continue
    }
    if (proposal.mode === 'swap') {
      const liveActor = map.tokens.find((token) => token.id === actorToken.id)
      if (!liveActor) return { ok: false, reason: 'invalid-actor-token' }
      const positions = validSwapPositions({
        map, actorToken: liveActor, targetToken: target, distanceFeet: proposal.distanceFeet,
      })
      if (!positions) return { ok: false, reason: 'invalid-movement-placement' }
      map.tokens = map.tokens.map((token) => {
        if (token.id === liveActor.id) return { ...token, ...positions.actor }
        if (token.id === target.id) return { ...token, ...positions.target }
        return token
      })
      changedTokenIds.push(liveActor.id, target.id)
      if (proposal.harmful && (positions.target.x !== target.x || positions.target.y !== target.y)) harmfulMovementTargetIds.add(target.id)
      continue
    }
    const cardinalOrigin = proposal.cardinalDirection
      ? tokenAnchorCellFromPixel(target.x, target.y, target, map) : undefined
    const cardinalOffset = proposal.cardinalDirection && ({
      north: { col: 0, row: -1 }, east: { col: 1, row: 0 },
      south: { col: 0, row: 1 }, west: { col: -1, row: 0 },
    } as const)[proposal.cardinalDirection]
    if (proposal.cardinalDirection && (!cardinalOffset || proposal.mode !== 'forced' ||
      !Number.isFinite(proposal.distanceFeet) || proposal.distanceFeet < 0)) {
      return { ok: false, reason: 'invalid-movement-placement' }
    }
    const cardinalCells = Math.floor(proposal.distanceFeet / Math.max(1, map.feetPerCell ?? 5))
    const destination = cardinalOrigin && cardinalOffset ? {
      col: cardinalOrigin.col + cardinalOffset.col * cardinalCells,
      row: cardinalOrigin.row + cardinalOffset.row * cardinalCells,
    } : input.selection.movementCellsByOperationId?.[
      dnd5eActivityMovementSelectionKeyV1(proposal)
    ] ?? input.selection.movementCellsByOperationId?.[proposal.operationId]
    if (!destination) return { ok: false, reason: 'invalid-movement-placement' }
    const directionOriginCell = dnd5eActivityMovementOriginCellV1({
      activity: input.activity, map, actorToken, directionOrigin: proposal.directionOrigin,
      areaSelection: input.areaSelection, legacyOriginCell: input.movementOriginCell,
    })
    if (!directionOriginCell) return { ok: false, reason: 'invalid-movement-placement' }
    const evadingNewSupport = proposal.mode === 'forced' && proposal.requiresDifferentDestination
    const destinationPoint = tokenCenterForAnchorCell(destination, target, map)
    if (evadingNewSupport && mapGeometryPlacementBlocked({ geometry: mapGeometryRuntimeForMap(map.id),
      map, token: target, at: destinationPoint }).blocked) return { ok: false, reason: 'invalid-movement-placement' }
    const movementMap = evadingNewSupport ? { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area =>
      !newlyCreatedSupportIds.has(area.id) || !tokenOccupiedCellsAt(target, map, target)
        .some(cell => area.cells.some(other => other.col === cell.col && other.row === cell.row))) } : map
    let movement = validMovementDestination({
      map: movementMap, actorToken, targetToken: target, destination,
      characters: input.characters, worldMinute: input.worldMinute,
      mode: proposal.mode, distanceFeet: proposal.distanceFeet,
      verticalDestination: proposal.verticalDestination,
      maximumMovementCostFeet: proposal.usesActorMovement && proposal.mode === 'voluntary' && actorMovementRemainingFeet != null
        ? actorMovementRemainingFeet + proposal.distanceFeet : undefined,
      maximumDistanceFromActorFeet: proposal.maximumDistanceFromActorFeet,
      requiresDifferentDestination: proposal.requiresDifferentDestination,
      destinationPolicy: proposal.destinationPolicy,
      continuationTargetRadiusFeet: proposal.continuationTargetRadiusFeet,
      continuationTargetIds: proposal.continuationTargetIds,
      originIllumination: proposal.originIllumination,
      destinationIllumination: proposal.destinationIllumination,
      requiresLineOfSight: proposal.requiresLineOfSight,
      requiresVisibleDestination: proposal.requiresVisibleDestination,
      usesTargetReactionIfAvailable: proposal.usesTargetReactionIfAvailable,
      directionOriginCell,
    })
    // A blocked random direction is a settled no-op, not another roll or a failed cast.
    if (!movement && cardinalOrigin) movement = validMovementDestination({
      map, actorToken, targetToken: target, destination: cardinalOrigin,
      mode: 'forced', distanceFeet: proposal.distanceFeet,
    })
    if (!movement) return { ok: false, reason: 'invalid-movement-placement' }
    if (proposal.usesActorMovement && proposal.mode === 'voluntary' && actorMovementRemainingFeet != null) {
      if (proposal.targetId !== actorToken.id || !Number.isFinite(actorMovementRemainingFeet) || actorMovementRemainingFeet < 0)
        return { ok: false, reason: 'invalid-movement-placement' }
      actorMovementRemainingFeet += proposal.distanceFeet - movement.movementCostFeet
    }
    const movementAnimation = proposal.mode === 'teleport' ? undefined : createTokenMovementAnimation({
      id: `${input.actionId}:${proposal.operationId}:${target.id}`,
      path: movement.path,
      finalPosition: movement.position,
      issuedAt: Date.now() + 100,
    })
    if (proposal.harmful && (movement.position.x !== target.x || movement.position.y !== target.y)) harmfulMovementTargetIds.add(target.id)
    map.tokens = map.tokens.map((token) => token.id === target.id
      ? { ...token, ...movement.position, movementAnimation }
      : token)
    changedTokenIds.push(target.id)
    movementPaths.push({
      operationId: proposal.operationId,
      targetId: target.id,
      path: movement.path,
      to: movement.position,
      provokesOpportunityAttacks: proposal.ignoresOpportunityAttacks !== true &&
        (proposal.provokesOpportunityAttacks ?? proposal.mode === 'voluntary'),
    })
  }

  for (const proposal of input.handoffs.areaRelocations ?? []) {
    const area = input.grantingPersistentAreaId
      ? map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.grantingPersistentAreaId)
      : undefined
    const target = map.tokens.find((candidate) => candidate.id === proposal.targetId)
    const grant = area?.grantedActivities?.find((candidate) => candidate.activityId === input.activity.id)
    if (
      !area || !target || !grant || area.sourceTokenId !== actorToken.id ||
      area.sourceCharacterId !== (actorToken.characterId ?? input.actorId)
    ) return { ok: false, reason: 'invalid-persistent-area' }
    const currentAnchor = area.anchorCell ?? area.cells[0]
    const destination = proposal.interposition === 'blocked' || proposal.interposition === 'difficult-terrain'
      ? dnd5eInterpositionAnchorCell(map, actorToken, target)
      : input.activity.target.kind === 'area' && input.areaSelection
      ? input.areaSelection.anchorCell
      : tokenAnchorCellFromPixel(target.x, target.y, target, map)
    if (!currentAnchor || cellDistance(currentAnchor, destination) * Math.max(1, map.feetPerCell ?? 5) > proposal.maximumFeet) {
      return { ok: false, reason: 'invalid-movement-placement' }
    }
    const priorBudget = area.movementContinuation
    const movementScope = persistentAreaMovementScope({ mapId: map.id, actorId: actorToken.id,
      combatId: input.combatId, round: input.round, turnKey: input.turnKey,
      worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder })
    if (proposal.retainMovementBudget && ((!input.combatId && !movementScope) ||
      (input.expectedMovementScope && (movementScope?.combatId !== input.expectedMovementScope.combatId ||
        movementScope?.round !== input.expectedMovementScope.round || movementScope?.turnKey !== input.expectedMovementScope.turnKey)))) {
      return { ok: false, reason: 'invalid-movement-placement' }
    }
    const sharedBudget = proposal.retainMovementBudget && priorBudget && movementScope?.combatId === priorBudget.combatId &&
      movementScope.turnKey === priorBudget.turnKey && movementScope.round === priorBudget.round ? priorBudget : undefined
    if (sharedBudget && (sharedBudget.pendingActivityId !== input.activity.id ||
      cellDistance(currentAnchor, destination) * Math.max(1, map.feetPerCell ?? 5) > sharedBudget.remainingFeet)) {
      return { ok: false, reason: 'invalid-movement-placement' }
    }
    const movementBudget = Math.min(sharedBudget?.remainingFeet ?? proposal.maximumFeet, area.movement?.maximumFeet ?? proposal.maximumFeet)
    const validatedMovement = area.movement
      ? moveDnd5eCoreSpellArea({
          characters: input.characters,
          map: { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id
            ? { ...candidate, movement: { ...area.movement!, maximumFeet: movementBudget } } : candidate) },
          areaId: area.id, sourceTokenId: actorToken.id, round: input.round, targetCell: destination,
          worldMinute: input.worldMinute,
          targetElevationFeet: area.vertical?.mode === 'volume' && area.vertical.shape === 'sphere' && area.movement?.carryRestrainedTargets
            ? input.areaRelocationTargetElevationFeet == null ? undefined : input.areaRelocationTargetElevationFeet - area.vertical.heightFeet / 2
            : input.areaSelection?.areaPlacement.elevationFeet,
        }) : undefined
    if (validatedMovement && !validatedMovement.ok) return { ok: false, reason: 'invalid-movement-placement' }
    const movementDistance = validatedMovement?.ok ? validatedMovement.distanceFeet
      : cellDistance(currentAnchor, destination) * Math.max(1, map.feetPerCell ?? 5)
    const deltaCol = destination.col - currentAnchor.col
    const deltaRow = destination.row - currentAnchor.row
    if (proposal.requiresDifferentAnchor && deltaCol === 0 && deltaRow === 0) {
      return { ok: false, reason: 'invalid-movement-placement' }
    }
    const translatedCells = area.cells.map((cell) => ({
      col: cell.col + deltaCol,
      row: cell.row + deltaRow,
    }))
    const { cols, rows } = mapCellExtent(map)
    if (translatedCells.some((cell) =>
      cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows
    )) return { ok: false, reason: 'invalid-movement-placement' }
    const anchorToken = map.tokens.find(token => token.id === area.anchorTokenId)
    const tokenAnchor = {
      col: destination.col - (area.anchorTokenOffsetCells?.col ?? 0),
      row: destination.row - (area.anchorTokenOffsetCells?.row ?? 0),
    }
    const anchorPoint = area.anchorTokenOffsetCells && anchorToken
      ? tokenCenterForAnchorCell(tokenAnchor, anchorToken, map)
      : cellToPixel(tokenAnchor, map)
    const relocatedArea: Dnd5ePluginArea = {
          ...(validatedMovement?.ok ? validatedMovement.area : area),
          movement: area.movement,
          movementContinuation: proposal.retainMovementBudget && movementScope &&
            input.activity.activation.kind === 'bonus-action' && area.movement?.economy === 'bonus-action'
            ? { ...movementScope,
                remainingFeet: Math.max(0, movementBudget - movementDistance) }
            : undefined,
          anchorCell: destination,
          cells: translatedCells,
          interposition: proposal.interposition === 'blocked' || proposal.interposition === 'difficult-terrain'
            ? { targetTokenId: target.id, mode: proposal.interposition }
            : proposal.interposition === 'clear'
              ? undefined
              : area.interposition,
        }
    const needsSphereSweep = area.vertical?.mode === 'volume' && (area.vertical.shape === 'sphere' || !!area.circularGeometry?.radiusFeet) &&
      area.movement?.carryRestrainedTargets && area.triggers?.some(trigger=>trigger.timing==='on-area-move-impact')
    if (needsSphereSweep && !input.supportsSphereSweepSettlement) return {ok:false,reason:'invalid-movement-placement'}
    if (needsSphereSweep && area.vertical?.mode === 'volume' && relocatedArea.vertical?.mode === 'volume') {
      sphereSweeps.push({areaId:area.id,startArea:structuredClone(area),path:validatedMovement?.ok && validatedMovement.areaPath
        ? validatedMovement.areaPath : [
          {x:map.gridOffsetX+(currentAnchor.col+.5)*map.gridSize,y:map.gridOffsetY+(currentAnchor.row+.5)*map.gridSize,elevationFeet:area.vertical.baseElevationFeet},
          {x:map.gridOffsetX+(destination.col+.5)*map.gridSize,y:map.gridOffsetY+(destination.row+.5)*map.gridSize,elevationFeet:relocatedArea.vertical.baseElevationFeet},
        ]})
    }
    const carried = needsSphereSweep ? [] : planDnd5ePersistentAreaCarry({ map, characters: input.characters ?? [], area, nextArea: relocatedArea, areaPath: validatedMovement?.ok ? validatedMovement.areaPath : undefined })
    if (!carried) return { ok: false, reason: 'invalid-movement-placement' }
    map.dnd5ePluginAreas = map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id ? relocatedArea : candidate)
    for (const move of carried) {
      carriedTargetIds.push(move.targetId)
      map.tokens = map.tokens.map(token => token.id === move.targetId ? { ...token, ...move.to,
        ...(move.toElevationFeet!==undefined?{elevationFeet:move.toElevationFeet}:{}) } : token)
      changedTokenIds.push(move.targetId)
      movementPaths.push({ operationId: proposal.operationId, targetId: move.targetId,
        path: [move.from, move.to], to: move.to, provokesOpportunityAttacks: false })
    }
    if (area.anchorTokenId) {
      map.tokens = map.tokens.map((token) => token.id === area.anchorTokenId
        ? { ...token, ...(validatedMovement?.ok ? validatedMovement.map.tokens.find(candidate => candidate.id === token.id) : undefined), x: anchorPoint.x, y: anchorPoint.y }
        : token)
      changedTokenIds.push(area.anchorTokenId)
    }
  }

  for (const proposal of input.handoffs.areaModeChanges ?? []) {
    const area = map.dnd5ePluginAreas?.find(candidate => candidate.id === input.grantingPersistentAreaId)
    if (!area || proposal.targetId !== actorToken.id || area.pluginId !== input.packageId ||
      area.sourceTokenId !== actorToken.id || area.sourceCharacterId !== (actorToken.characterId ?? actorToken.id) ||
      !area.grantedActivities?.some(grant => grant.activityId === input.activity.id) ||
      (!area.permanent && area.expiresAtWorldMinute != null && input.worldMinute != null && input.worldMinute >= area.expiresAtWorldMinute) ||
      (!area.permanent && area.expiresAtWorldMinute == null && input.round > area.expiresAfterRound)) return { ok: false, reason: 'invalid-persistent-area' }
    const direction = proposal.direction === 'area-orientation' && input.areaSelection
      ? persistentRectGeometryForSelection(input.activity, input.areaSelection, actorToken, map)?.direction : undefined
    if (proposal.direction && !direction) return {ok:false,reason:'invalid-persistent-area'}
    const next = changeDnd5ePersistentAreaMode(area, { change: proposal.change, modeId: proposal.modeId, direction, receipt: `${input.actionId}:${proposal.operationId}` })
    if (!next) return { ok: false, reason: 'invalid-persistent-area' }
    map.dnd5ePluginAreas = map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id ? next : candidate)
  }

  for (const proposal of input.handoffs.areaShrinks ?? []) {
    const area = map.dnd5ePluginAreas?.find(candidate => candidate.id === input.grantingPersistentAreaId)
    const geometry = normalizeDnd5ePersistentRectGeometry(area?.rectGeometry)
    if (!area || !geometry || !area.anchorCell || proposal.targetId !== actorToken.id ||
        area.sourceTokenId !== actorToken.id || area.sourceCharacterId !== (actorToken.characterId ?? input.actorId) ||
        !area.grantedActivities?.some(grant => grant.activityId === input.activity.id) ||
        !Number.isFinite(proposal.lengthFeet) || proposal.lengthFeet <= 0 || proposal.lengthFeet > 10000) {
      return { ok: false, reason: 'invalid-persistent-area' }
    }
    const receipt = `${input.actionId}:${proposal.operationId}`
    if (receipt.length > 512) return { ok: false, reason: 'invalid-persistent-area' }
    if (area.shapeChangeReceipts?.includes(receipt)) continue
    const lengthFeet = geometry.lengthFeet - proposal.lengthFeet
    if (lengthFeet <= 0) {
      map.dnd5ePluginAreas = map.dnd5ePluginAreas?.filter(candidate => candidate.id !== area.id)
      if (area.anchorMode === 'effect-token' && area.anchorTokenId) {
        map.tokens = map.tokens.filter(token => token.id !== area.anchorTokenId)
        removedTokenIds.push(area.anchorTokenId)
      }
      endedAreaIds.push(area.id)
      continue
    }
    const anchor = area.anchorCell
    const bounds = gridAlignedRectBounds(anchor, geometry.widthFeet, lengthFeet)
    const tiltedCells = geometry.pitchDegrees || geometry.rollDegrees
      ? rectangularPrismCells(map,{...area,rectGeometry:{...geometry,lengthFeet}}) : undefined
    if ((geometry.pitchDegrees || geometry.rollDegrees) && !tiltedCells?.length) return {ok:false,reason:'invalid-persistent-area'}
    const tiltedKeys = tiltedCells ? new Set(tiltedCells.map(cellKey)) : undefined
    // Test only existing cells: bounded by the persisted area and cannot restore clipped cells.
    const cells = area.cells.filter(cell => tiltedKeys ? tiltedKeys.has(cellKey(cell)) : geometry.gridAligned
      ? cell.col >= bounds.firstCol && cell.col < bounds.firstCol + bounds.widthCells &&
        cell.row >= bounds.firstRow && cell.row < bounds.firstRow + bounds.heightCells
      : cellTouchesOrientedRect(cell, { x: anchor.col, y: anchor.row },
          { x: geometry.direction.dc, y: geometry.direction.dr },
          geometry.widthFeet / DND_FEET_PER_CELL, lengthFeet / DND_FEET_PER_CELL))
    if (!cells.length) return { ok: false, reason: 'invalid-persistent-area' }
    map.dnd5ePluginAreas = map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id ? {
      ...candidate, cells, rectGeometry: { ...geometry, lengthFeet },
      shapeChangeReceipts: [...(candidate.shapeChangeReceipts ?? []), receipt].slice(-256),
    } : candidate)
  }

  for (const proposal of input.handoffs.areaReshapes ?? []) {
    const area = input.grantingPersistentAreaId
      ? map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.grantingPersistentAreaId)
      : undefined
    const grant = area?.grantedActivities?.find((candidate) => candidate.activityId === input.activity.id)
    const selection = input.areaSelection
    if (
      !area || !grant || !selection || proposal.targetId !== actorToken.id ||
      area.sourceTokenId !== actorToken.id ||
      area.sourceCharacterId !== (actorToken.characterId ?? input.actorId) ||
      selection.cells.length < 1
    ) return { ok: false, reason: 'invalid-persistent-area' }
    const currentAnchor = area.anchorCell ?? area.cells[0]
    if (
      proposal.maximumFeet != null && currentAnchor &&
      cellDistance(currentAnchor, selection.anchorCell) * Math.max(1, map.feetPerCell ?? 5) > proposal.maximumFeet
    ) return { ok: false, reason: 'invalid-movement-placement' }
    const sourceAnchorCell = tokenAnchorCellFromPixel(
      actorToken.x,
      actorToken.y,
      actorToken,
      map,
    )
    const nextAnchorCell = area.anchorMode === 'source-token'
      ? sourceAnchorCell
      : selection.anchorCell
    const anchorPoint = cellToPixel(selection.anchorCell, map)
    map.dnd5ePluginAreas = map.dnd5ePluginAreas?.map((candidate) => candidate.id === area.id
      ? {
          ...candidate,
          anchorCell: { ...nextAnchorCell },
          cells: selection.cells.map((cell) => ({ ...cell })),
          rectGeometry: persistentRectGeometryForSelection(input.activity, selection, actorToken, map),
          vertical: selection.areaPlacement.heightFeet && selection.areaPlacement.heightFeet > 0
            ? {
                mode: 'volume' as const,
                baseElevationFeet: selection.areaPlacement.elevationFeet ?? actorToken.elevationFeet ?? 0,
                heightFeet: selection.areaPlacement.heightFeet,
              }
            : candidate.vertical,
        }
      : candidate)
    if (area.anchorMode === 'effect-token' && area.anchorTokenId) {
      map.tokens = map.tokens.map((token) => token.id === area.anchorTokenId
        ? { ...token, x: anchorPoint.x, y: anchorPoint.y }
        : token)
      changedTokenIds.push(area.anchorTokenId)
    }
  }

  for (const proposal of input.handoffs.areaSenseModes ?? []) {
    const area = input.grantingPersistentAreaId
      ? map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.grantingPersistentAreaId)
      : undefined
    const grant = area?.grantedActivities?.find((candidate) => candidate.activityId === input.activity.id)
    if (
      !area || !grant || proposal.targetId !== actorToken.id || !area.anchorTokenId ||
      area.sourceTokenId !== actorToken.id ||
      area.sourceCharacterId !== (actorToken.characterId ?? input.actorId)
    ) return { ok: false, reason: 'invalid-persistent-area' }
    const effectToken = map.tokens.find((candidate) => candidate.id === area.anchorTokenId)
    if (!effectToken?.dnd5eSpellEffect) return { ok: false, reason: 'invalid-persistent-area' }
    if ((proposal.mode === 'projection-sight' || proposal.mode === 'projection-hearing') &&
      (!effectToken.dnd5eSpellEffect.visionFromSource || !effectToken.dnd5eSpellEffect.hearingFromSource)) return { ok: false, reason: 'invalid-persistent-area' }
    map.tokens = map.tokens.map((token) => token.id === area.anchorTokenId
      ? {
          ...token,
          dnd5eSpellEffect: {
            ...token.dnd5eSpellEffect!,
            shareVisionWithSource: proposal.mode !== 'source' ? true as const : undefined,
            sensorSense: proposal.mode === 'projection-sight' ? 'sight' as const : proposal.mode === 'projection-hearing' ? 'hearing' as const : undefined,
          },
        }
      : token)
    changedTokenIds.push(area.anchorTokenId)
  }

  const otherMapAreaDismissals: NonNullable<Dnd5eActivityMapHandoffResultV1['otherMapAreaDismissals']>[number][] = []
  for (const proposal of input.handoffs.areaDismissals ?? []) {
    if(input.grantingPersistentAreaMapId && input.grantingPersistentAreaMapId!==map.id) {
      const remote=input.supportsRemoteAreaDismissal && input.grantingPersistentAreaId && proposal.actorId===actorToken.id &&
        resolveRemoteAreaDismissal({maps:input.sourceLimitMaps??[],actor:actorToken,actorMapId:map.id,
          areaMapId:input.grantingPersistentAreaMapId,areaId:input.grantingPersistentAreaId,
          packageId:input.packageId,activity:input.activity,worldMinute:input.worldMinute})
      if(!remote)return {ok:false,reason:'invalid-persistent-area'}
      if(!otherMapAreaDismissals.some(item=>item.mapId===remote.map.id&&item.area.id===remote.area.id))
        otherMapAreaDismissals.push({mapId:remote.map.id,area:remote.area})
      continue
    }
    const area = map.dnd5ePluginAreas?.find(candidate => candidate.id === input.grantingPersistentAreaId)
    if (!area || area.pluginId !== input.packageId || proposal.actorId !== actorToken.id ||
        !dnd5eOwnsPersistentArea(area, actorToken) ||
        !area.grantedActivities?.some(grant => grant.activityId === input.activity.id)) {
      return { ok: false, reason: 'invalid-persistent-area' }
    }
    map.dnd5ePluginAreas = map.dnd5ePluginAreas?.filter(candidate => candidate.id !== area.id)
    if (area.anchorMode === 'effect-token' && area.anchorTokenId &&
        !map.dnd5ePluginAreas?.some(candidate => candidate.anchorTokenId === area.anchorTokenId)) {
      const projection = map.tokens.find(token => token.id === area.anchorTokenId)
      if (projection?.dnd5eSpellEffect?.sourceTokenId === area.sourceTokenId) {
        map.tokens = map.tokens.filter(token => token.id !== projection.id)
        removedTokenIds.push(projection.id)
      }
    }
    endedAreaIds.push(area.id)
  }

  for (const proposal of input.handoffs.areaDetonations ?? []) {
    const area = input.grantingPersistentAreaId
      ? map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.grantingPersistentAreaId)
      : undefined
    const grant = area?.grantedActivities?.find((candidate) => candidate.activityId === input.activity.id)
    if (
      !area || !grant || proposal.actorId !== actorToken.id ||
      area.sourceTokenId !== actorToken.id ||
      area.sourceCharacterId !== (actorToken.characterId ?? input.actorId) ||
      !area.triggers?.some((trigger) => trigger.timing === 'on-detonate')
    ) return { ok: false, reason: 'invalid-persistent-area' }
    detonatedAreaIds.push(area.id)
  }

  const otherMapGeometryUpdates: import('../../../lib/mapGeometry').MapGeometryState[] = []
  if (input.handoffs.mapWaterChanges?.length) {
    // Full replacements cannot overwrite geometry proposals prepared by another operation.
    if (!input.supportsStructureCommit || structureGeometry || !flameGeometries ||
      geometryDoorPatches.length || geometryEntityPatches.length || geometryLightUpserts.length || otherMapLightUpserts.length ||
      input.worldMinute == null) return {ok:false,reason:'invalid-map-object-selection'}
    const before = flameGeometries
    let waters = before
    const casterId = actorToken.characterId ? `character:${actorToken.characterId}` : JSON.stringify(['map-token',map.id,actorToken.id])
    for (const proposal of input.handoffs.mapWaterChanges) {
      if (proposal.change.promptForChange) return {ok:false,reason:'invalid-map-object-selection'}
      const selected = input.selection.watersByOperationId?.[proposal.operationId]
      if (!selected || (proposal.change.kind === 'dismiss') !== ('dismissEffectId' in selected)) {
        return {ok:false,reason:'invalid-map-object-selection'}
      }
      const selection = proposal.change.kind === 'dismiss' && 'dismissEffectId' in selected
        ? {dismissEffectId:selected.dismissEffectId}
        : proposal.change.kind !== 'dismiss' && 'waterId' in selected
          ? {...selected,change:proposal.change} : undefined
      if (!selection) return {ok:false,reason:'invalid-map-object-selection'}
      const result = prepareDnd5eWaterAppearanceMapChange({map,geometries:waters,actorTokenId:input.actorId,
        casterId,actionId:`${input.actionId}:${proposal.operationId}`,worldMinute:input.worldMinute,selection,rules:proposal.rules})
      if (!result.ok) return {ok:false,reason:'invalid-map-object-selection'}
      waters = result.geometries
    }
    for (const geometry of waters) {
      if (JSON.stringify(geometry) === JSON.stringify(before.find(value=>value.mapId===geometry.mapId))) continue
      if (geometry.mapId === map.id) structureGeometry = geometry
      else {
        if (!input.supportsOtherMapGeometryCommit) return {ok:false,reason:'invalid-map-object-selection'}
        otherMapGeometryUpdates.push(geometry)
      }
    }
  }

  // New or moved fire areas must expose webs in this transaction, including
  // empty cells that produce no creature damage event.
  let exposedMap = igniteDnd5eWebAreasFromFire({ map, round: input.round, turnTokenId: input.turnTokenId ?? '' })
  if(input.handoffs.areaSpellDamageTypes?.includes('cold')){
    const requested=input.areaSelection,target=input.activity.target,declared=dnd5eActivityMapTemplateV1(input.activity)
    if(!requested||target.kind!=='area'||!declared||input.activity.legacySource?.kind!=='spell')return {ok:false,reason:'activity-area-required'}
    const placement=requested.areaPlacement
    const dimensions={radiusFeet:placement.radiusFeet,widthFeet:placement.widthFeet,heightFeet:placement.lengthFeet,
      lengthFeet:placement.lengthFeet,volumeHeightFeet:placement.heightFeet}
    const selected=resolveDnd5eActivityAreaMapSelectionV1({activity:input.activity,map:input.map,actorToken,
      characters:input.characters,worldMinute:input.worldMinute,grantingPersistentAreaId:input.grantingPersistentAreaId,
      anchorCell:requested.anchorCell,targetElevationFeet:placement.elevationFeet,rectAngleDegrees:placement.angleDegrees,dimensions})
    const area=resolveAoeDimensions(declared,dimensions)
    if(!selected||!area)return {ok:false,reason:'activity-area-required'}
    const geometry=mapGeometryRuntimeForMap(map.id),point=selected.areaPlacement
    const origin=area.origin==='point'?point:actorToken
    const elevation=area.origin==='point'?point.elevationFeet??mapGeometryTerrainElevationAtPoint(geometry,point):mapGeometryTokenElevation(geometry,actorToken)
    const radians=(point.angleDegrees??0)*Math.PI/180
    const aim=area.shape==='cone'&&area.origin==='point'?{x:point.x+Math.cos(radians)*map.gridSize,y:point.y+Math.sin(radians)*map.gridSize}:point
    exposedMap=freezeDnd5eWaterWallsFromArea({map:exposedMap,cells:selected.cells,elevationFeet:elevation,actorId:input.actorId,
      round:input.round,worldMinute:input.worldMinute,exposure:{area,origin,originElevationFeet:elevation,aim,
        aimElevationFeet:point.elevationFeet??elevation,sourceHeightFeet:mapTokenBodyHeight(actorToken)}})
  }
  for(const area of exposedMap.dnd5ePluginAreas??[]){
    if(input.map.dnd5ePluginAreas?.some(before=>before.id===area.id))continue
    const captured=captureDnd5eAreaObjects(exposedMap,area)
    if(!captured)return {ok:false,reason:'invalid-movement-placement'}
    for(const token of captured.tokens)if(token!==exposedMap.tokens.find(before=>before.id===token.id))changedTokenIds.push(token.id)
    exposedMap=captured
  }
  const previousAreaIds = new Set(input.map.dnd5ePluginAreas?.map(area => area.id))

  return {
    ok: true,
    map: exposedMap,
    createdAreaIds: [...new Set(exposedMap.dnd5ePluginAreas?.filter(area => !previousAreaIds.has(area.id)).map(area => area.id) ?? [])],
    changedTokenIds: [...new Set(changedTokenIds)],
    ...(boundCharacterIds.length ? { boundCharacters, boundCharacterIds: [...new Set(boundCharacterIds)] } : {}),
    carriedTargetIds: [...new Set(carriedTargetIds)],
    sphereSweeps,
    harmfulMovementTargetIds: [...harmfulMovementTargetIds],
    removedTokenIds: [...new Set(removedTokenIds)],
    initiativeEntries,
    geometryDoorPatches,
    geometryLightUpserts,
    otherMapLightUpserts,
    otherMapAreaDismissals,
    geometryEntityPatches,
    ...(structureGeometry?{structureGeometry}:{}),
    ...(otherMapGeometryUpdates.length?{otherMapGeometryUpdates}:{}),
    movementPaths,
    detonatedAreaIds: [...new Set(detonatedAreaIds)],
    persistentEntityResults,
    endedAreaIds: [...new Set(endedAreaIds)],
    actorMovementRemainingFeet,
  }
}

export function dnd5eActivityMapCellForPlacementV1(
  placement: Dnd5eActivityAreaPlacementV1,
  map: BattleMap,
): GridCell {
  return pixelToCell(placement.x, placement.y, map)
}

/** Candidate cells are a UI aid; the handoff validates the same rule again against the live map. */
/** Supported destination levels, revalidated by the Host when the move commits. */
export function dnd5eActivityGroundTeleportLevels(input: {
  map: BattleMap; actorToken: Token; movement: Extract<Dnd5eActivityCapabilityProposal,{kind:'move'}>;
  destination: GridCell; characters?: readonly import('../../../types/character').Character[]; worldMinute?: number;
}): number[] {
  const target = input.map.tokens.find(token => token.id === input.movement.targetId)
  if (!target || input.movement.mode !== 'teleport' || input.movement.verticalDestination !== 'ground') return []
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const point = tokenCenterForAnchorCell(input.destination, target, input.map)
  const heights = new Set([mapGeometryTerrainElevationAtPoint(geometry, point),
    ...(geometry?.obstacles ?? []).map(obstacle => obstacle.baseHeightFeet + obstacle.heightFeet),
    ...(input.map.dnd5ePluginAreas ?? []).flatMap(area => area.vertical?.mode === 'volume'
      ? [area.vertical.baseElevationFeet + area.vertical.heightFeet] : []),
  ])
  return [...heights].filter(elevationFeet => Number.isFinite(elevationFeet) && validMovementDestination({
    map: input.map, actorToken: input.actorToken, targetToken: target,
    characters: input.characters, worldMinute: input.worldMinute,
    ...input.movement, mode: 'teleport', destination: { ...input.destination, elevationFeet },
  }) != null).sort((a,b) => a-b)
}

export function dnd5eActivityContinuationTeleportCells(input: {
  map: BattleMap
  actorMovementRemainingFeet?: number
  characters?: readonly import('../../../types/character').Character[]
  worldMinute?: number
  actorToken: Token
  movement: Extract<Dnd5eActivityCapabilityProposal,{kind:'move'}>
}): GridCell[] {
  const {map,actorToken,movement}=input
  if(!['teleport','forced','voluntary'].includes(movement.mode)||(movement.continuationTargetRadiusFeet==null && !movement.requiresVisibleDestination && !movement.requiresDifferentDestination))return []
  const moving=map.tokens.find(token=>token.id===movement.targetId)
  if(!moving)return []
  const extent=mapCellExtent(map)
  const padding=Math.ceil((movement.continuationTargetRadiusFeet??movement.distanceFeet)/Math.max(1,map.feetPerCell??5))+Math.ceil(moving.size)+1
  const candidates=new Map<string,GridCell>()
  const anchors=movement.continuationTargetRadiusFeet==null ? [moving] : map.tokens.filter(token=>movement.continuationTargetIds?.includes(token.id))
  for(const anchor of anchors){
    for(const cell of tokenOccupiedCellsAt(anchor,map,anchor)){
      for(let row=Math.max(0,cell.row-padding);row<Math.min(extent.rows,cell.row+padding+1);row++)for(let col=Math.max(0,cell.col-padding);col<Math.min(extent.cols,cell.col+padding+1);col++)candidates.set(`${col},${row}`,{col,row})
    }
  }
  return [...candidates.values()].filter(destination=>movement.mode === 'teleport' && movement.verticalDestination === 'ground'
    ? dnd5eActivityGroundTeleportLevels({...input,destination}).length > 0
    : validMovementDestination({map,actorToken,targetToken:moving,destination,
    characters:input.characters,worldMinute:input.worldMinute,requiresVisibleDestination:movement.requiresVisibleDestination,
    requiresDifferentDestination:movement.requiresDifferentDestination,
    destinationPolicy:movement.destinationPolicy,
    verticalDestination:movement.verticalDestination,
    maximumDistanceFromActorFeet:movement.maximumDistanceFromActorFeet,originIllumination:movement.originIllumination,destinationIllumination:movement.destinationIllumination,
    mode:movement.mode as 'teleport' | 'forced' | 'voluntary',distanceFeet:movement.distanceFeet,requiresLineOfSight:movement.requiresLineOfSight,
    maximumMovementCostFeet:movement.usesActorMovement && movement.mode==='voluntary' && input.actorMovementRemainingFeet!=null
      ? input.actorMovementRemainingFeet+movement.distanceFeet : undefined,
    continuationTargetRadiusFeet:movement.continuationTargetRadiusFeet,continuationTargetIds:movement.continuationTargetIds})!=null)
}

function summonPlacementRange(activity: Dnd5eActivityDefinitionV1, summon: Dnd5eActivityAuthorityHandoffs['summons'][number]): number {
  return summon.placementRangeFeet ?? (activity.target.kind === 'area'
    ? activity.target.placeRangeFeet ?? 30 : activity.target.kind === 'creature' ? activity.target.rangeFeet ?? 30 : 30)
}

/** Preview only: replay the selected prefix through the same atomic placement rules.
 * Final Host placement still checks the complete transaction against current state.
 */
export function dnd5eActivitySummonPlacementCells(input: {
  map: BattleMap
  sourceLimitMaps?: readonly BattleMap[]
  characters?: readonly import('../../../types/character').Character[]
  worldMinute?: number
  activity: Dnd5eActivityDefinitionV1
  packageId: string
  actorId: string
  summons: Dnd5eActivityAuthorityHandoffs['summons']
  selectedCells: readonly GridCell[]
}): GridCell[] {
  if (input.summons.some(summon => summon.corpseTokenId || summon.objectTokenId || !Number.isInteger(summon.count) || summon.count < 1 || summon.count > 1000)) return []
  const expanded = input.summons.flatMap(summon => Array.from({ length: summon.count }, () => ({ ...summon, count: 1 })))
  const actor = input.map.tokens.find(token => token.id === input.actorId)
  if (input.selectedCells.length >= expanded.length || !actor) return []
  const next = expanded[input.selectedCells.length]
  const monster = getDnd5eSrdMonster(next.monsterId)
  const range = summonPlacementRange(input.activity, next)
  if (!monster || !Number.isInteger(range) || range < 0 || range > 100000) return []
  const prefix = expanded.slice(0, input.selectedCells.length + 1)
  const { cols, rows } = mapCellExtent(input.map)
  const actorCells = tokenOccupiedCellsAt(actor, input.map, actor)
  const footprint = creatureSizeToFootprintCells(monster.size)
  const padding = Math.ceil(range / Math.max(1, input.map.feetPerCell ?? 5))
  // The anchor is the upper-left cell: a large creature can reach the range
  // boundary even when its anchor lies farther left/above than that boundary.
  const firstCol = Math.max(0, Math.min(...actorCells.map(cell => cell.col)) - padding - footprint + 1)
  const lastCol = Math.min(cols - footprint, Math.max(...actorCells.map(cell => cell.col)) + padding)
  const firstRow = Math.max(0, Math.min(...actorCells.map(cell => cell.row)) - padding - footprint + 1)
  const lastRow = Math.min(rows - footprint, Math.max(...actorCells.map(cell => cell.row)) + padding)
  const cells: GridCell[] = []
  for (let row = firstRow; row <= lastRow; row++) for (let col = firstCol; col <= lastCol; col++) {
    if (input.selectedCells.some(cell => cell.col === col && cell.row === row)) continue
    const result = applyDnd5eActivityMapHandoffsV1({
      ...input, actionId: 'summon-placement-preview', round: 1,
      // Pure placement preview: validate geometry as if present now, but never
      // commit these tokens. The real handoff retains its delayed timing.
      handoffs: { summons: prefix.map(summon => summon.timing === 'source-next-turn-start'
        ? { ...summon, timing: 'immediate' as const } : summon), persistentAreas: [], movements: [], invocations: [] },
      selection: { summonCells: [...input.selectedCells, { col, row }], summonInitiativeD20s: prefix.map(() => 10) },
    })
    if (result.ok) cells.push({ col, row })
  }
  return cells
}


import { dnd5eLastLongRestDestination } from '../restTeleportationDestination'
import { createTeleportationCircle } from '../teleportationCircle'
