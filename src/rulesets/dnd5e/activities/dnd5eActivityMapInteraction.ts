import type { InitiativeEntry } from '../../../components/map/InitiativeTracker'
import {
  cellDistance,
  cellKey,
  cellToPixel,
  mapCellExtent,
  pixelToCell,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../../lib/gridCombat'
import {
  mapGeometryIlluminationAtPoint,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryLineOfSightBlocked,
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
  tokensInCells,
  type SkillAoeTargeting,
} from '../../../lib/skillTargeting'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../../store/maps'
import { dnd5eInterpositionAnchorCell } from '../coreSpellAreas'
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
  anchorCell: GridCell
  cells: readonly GridCell[]
  targetIds: readonly string[]
  areaPlacement: Dnd5eActivityAreaPlacementV1
  areaPlacementDistanceFeet: number
}

export interface Dnd5eActivityMapHandoffSelectionV1 {
  summonCells?: readonly GridCell[]
  movementCellsByOperationId?: Readonly<Record<string, GridCell>>
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
  map: BattleMap
  changedTokenIds: readonly string[]
  /** Summons replaced by this atomic map transaction; callers must prune their initiative slots. */
  removedTokenIds: readonly string[]
  initiativeEntries: readonly InitiativeEntry[]
  geometryDoorPatches: readonly {
    entityId: string
    patch: MapGeometryEntityPatch
  }[]
  geometryLightUpserts: readonly MapGeometryLight[]
  movementPaths: readonly {
    operationId: string
    targetId: string
    path: readonly { x: number; y: number }[]
    to: { x: number; y: number }
    provokesOpportunityAttacks: boolean
  }[]
  /** Areas whose snapshotted `on-detonate` triggers must be settled, then removed. */
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
    shape: 'cone', origin: 'self', lengthFeet: target.lengthFeet ?? 5,
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
    gridAligned: target.gridAligned ?? (target.shape === 'cube' ? true : undefined),
    minimumWidthFeet: target.minimumWidthFeet,
    minimumHeightFeet: target.minimumLengthFeet ?? target.minimumHeightFeet,
    placeRangeFeet: target.origin === 'self' ? 0 : target.placeRangeFeet,
    rotatable: target.rotatable,
  }
  return {
    shape: 'circle', origin: target.origin === 'event-target' ? 'point' : target.origin,
    radiusFeet: target.radiusFeet ?? target.widthFeet ?? 5,
    minimumRadiusFeet: target.minimumRadiusFeet,
    placeRangeFeet: target.origin === 'self' || target.origin === 'event-target' ? 0 : target.placeRangeFeet,
  }
}

/**
 * Host rebuilds affected cells and targets from the selected anchor. Client
 * supplied target ids are never accepted by this boundary.
 */
export function resolveDnd5eActivityAreaMapSelectionV1(input: {
  activity: Dnd5eActivityDefinitionV1
  map: BattleMap
  actorToken: Token
  anchorCell: GridCell
  rectRotation?: number
}): Dnd5eActivityAreaMapSelectionV1 | undefined {
  const target = input.activity.target
  const template = dnd5eActivityMapTemplateV1(input.activity)
  if (target.kind !== 'area' || !template) return undefined
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
  if (!canPlaceAoe(template, actorCell, anchorCell)) return undefined
  if (activityAreaAnchorIsOccupied(input.map, anchorCell, target.unoccupiedAnchorSizeFeet)) {
    return undefined
  }
  const orientFrom = aoeOrientFromCell(template, actorCell, anchorCell, {
    rectRotation: input.rectRotation ?? 0,
  })
  const cells = cellsForAoe(template, orientFrom, anchorCell)
  const targetIds = tokensInCells(input.map, input.map.tokens, cells)
    .filter((token) => {
      if (token.type === 'obstacle') return false
      if (token.id === input.actorToken.id && target.includeSelf !== true) return false
      const opposed = areOpposedCombatTokens(input.actorToken, token)
      if (target.relation === 'ally' && opposed) return false
      if (target.relation === 'enemy' && !opposed) return false
      return true
    })
    .map((token) => token.id)
    .slice(0, target.maximumTargets)
  const anchor = cellToPixel(anchorCell, input.map)
  const directionalAngleDegrees = target.rotatable && (target.shape === 'line' || target.shape === 'cone')
      ? ((Math.atan2(anchorCell.row - actorCell.row, anchorCell.col - actorCell.col) * 180 / Math.PI) + 360) % 360
    : target.rotatable
      ? ((input.rectRotation ?? 0) % 4) * 90
      : undefined
  return {
    anchorCell: { ...anchorCell },
    cells: cells.map((cell) => ({ ...cell })),
    targetIds,
    areaPlacementDistanceFeet: cellDistance(actorCell, anchorCell) * Math.max(1, input.map.feetPerCell ?? 5),
    areaPlacement: {
      x: anchor.x,
      y: anchor.y,
      elevationFeet: input.actorToken.elevationFeet,
      angleDegrees: directionalAngleDegrees,
      radiusFeet: 'radiusFeet' in template ? template.radiusFeet : undefined,
      lengthFeet: 'lengthFeet' in template ? template.lengthFeet : target.lengthFeet,
      widthFeet: 'widthFeet' in template ? template.widthFeet : target.widthFeet,
      heightFeet: target.heightFeet,
    },
  }
}

function validMovementDestination(input: {
  map: BattleMap
  actorToken: Token
  targetToken: Token
  destination: GridCell
  mode: 'push' | 'pull' | 'teleport'
  distanceFeet: number
  originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
  destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
  requiresLineOfSight?: boolean
  usesTargetReactionIfAvailable?: boolean
  /** Directional push/pull origin supplied by a Host-owned area entity. */
  directionOriginCell?: GridCell
}): { position: { x: number; y: number }; path: readonly { x: number; y: number }[] } | undefined {
  const origin = tokenAnchorCellFromPixel(
    input.targetToken.x, input.targetToken.y, input.targetToken, input.map,
  )
  const actor = input.directionOriginCell ?? tokenAnchorCellFromPixel(
    input.actorToken.x, input.actorToken.y, input.actorToken, input.map,
  )
  const movementFeet = cellDistance(origin, input.destination) * Math.max(1, input.map.feetPerCell ?? 5)
  if (movementFeet > input.distanceFeet) return undefined
  if (movementFeet === 0) {
    return {
      position: { x: input.targetToken.x, y: input.targetToken.y },
      path: [{ x: input.targetToken.x, y: input.targetToken.y }],
    }
  }
  const beforeActorDistance = cellDistance(actor, origin)
  const afterActorDistance = cellDistance(actor, input.destination)
  if (input.mode === 'push' && afterActorDistance <= beforeActorDistance) return undefined
  if (input.mode === 'pull' && afterActorDistance >= beforeActorDistance) return undefined
  const { cols, rows } = mapCellExtent(input.map)
  const to = tokenCenterForAnchorCell(input.destination, input.targetToken, input.map)
  const footprint = tokenOccupiedCellsAt(input.targetToken, input.map, to)
  const occupied = new Set(input.map.tokens
    .filter((token) => token.id !== input.targetToken.id && (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
    .flatMap((token) => tokenOccupiedCellsAt(token, input.map, token))
    .map(cellKey))
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const originIllumination = mapGeometryIlluminationAtPoint({
    geometry, map: input.map, tokens: input.map.tokens,
    point: input.targetToken, elevationFeet: input.targetToken.elevationFeet,
  })
  const destinationIllumination = mapGeometryIlluminationAtPoint({
    geometry, map: input.map, tokens: input.map.tokens,
    point: to, elevationFeet: input.targetToken.elevationFeet,
  })
  if (
    footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
    footprint.some((cell) => occupied.has(cellKey(cell))) ||
    mapGeometryPlacementBlocked({ geometry, map: input.map, token: input.targetToken, at: to }).blocked ||
    (input.originIllumination != null && !input.originIllumination.some((value) => value === originIllumination)) ||
    (input.destinationIllumination != null && !input.destinationIllumination.some((value) => value === destinationIllumination)) ||
    (input.requiresLineOfSight === true && mapGeometryLineOfSightBlocked({
      geometry, map: input.map, from: input.targetToken, to,
      fromElevationFeet: input.targetToken.elevationFeet,
      toElevationFeet: input.targetToken.elevationFeet,
    })) ||
    (input.mode !== 'teleport' && mapGeometryMovementBlocked({
      geometry, map: input.map, token: input.targetToken, to,
    }).blocked)
  ) return undefined
  let path: readonly { x: number; y: number }[] = [
    { x: input.targetToken.x, y: input.targetToken.y },
    to,
  ]
  if (input.usesTargetReactionIfAvailable) {
    const legalPath = findMapGeometryPath({
      map: input.map,
      geometry,
      token: input.targetToken,
      to,
    })
    if (!legalPath || legalPath.movementCostFeet > input.distanceFeet) return undefined
    path = legalPath.points
  }
  return { position: to, path }
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

/** Applies a closed persistent-area push using the same collision/path validator as Activity movement. */
export function applyDnd5ePersistentAreaForcedMovementV1(input: {
  map: BattleMap
  sourceTokenId: string
  targetTokenId: string
  distanceFeet: number
}): BattleMap | undefined {
  const source = input.map.tokens.find((token) => token.id === input.sourceTokenId)
  const target = input.map.tokens.find((token) => token.id === input.targetTokenId)
  if (!source || !target || !Number.isFinite(input.distanceFeet) || input.distanceFeet <= 0) return undefined
  const destination = dnd5eActivityAutomaticDirectionalMovementCellV1({
    map: input.map,
    actorToken: source,
    targetToken: target,
    mode: 'push',
    distanceFeet: input.distanceFeet,
  })
  const movement = validMovementDestination({
    map: input.map,
    actorToken: source,
    targetToken: target,
    destination,
    mode: 'push',
    distanceFeet: input.distanceFeet,
  })
  if (!movement) return input.map
  return {
    ...input.map,
    tokens: input.map.tokens.map((token) => token.id === target.id
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

/** Applies map-owned handoffs only after every requested placement is present and valid. */
export function applyDnd5eActivityMapHandoffsV1(input: {
  map: BattleMap
  activity: Dnd5eActivityDefinitionV1
  packageId: string
  actionId: string
  actorId: string
  /** Host-derived at the combat boundary; only used to resolve `source-save-dc`. */
  sourceSaveDc?: number
  /** Optional outer spell concentration identity; features keep the Activity identity. */
  concentrationId?: string
  round: number
  /** Campaign clock used for ten-minute Arcane Lock suppression outside combat. */
  worldMinute?: number
  /** Present only while combat is active; ten minutes is represented as 100 rounds. */
  combatId?: string
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
}): Dnd5eActivityMapHandoffResultV1 | Dnd5eActivityMapHandoffFailureV1 {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorId)
  if (!actorToken) return { ok: false, reason: 'invalid-actor-token' }
  const truePolymorphObjectToCreature = isTruePolymorphObjectToCreatureHandoff(input)
  // Ordinary objects are deliberately outside the automated tabletop model.
  // The spell transaction itself is already settled by the Host, while the
  // table handles any object result through its voice channel and the DM's
  // direct scene tools.  Keep this guard at the final map-write boundary so a
  // stale client or a future Activity cannot resurrect object automation.
  const hasDisabledObjectHandoff =
    truePolymorphObjectToCreature ||
    (input.handoffs.mapObjectLocks?.length ?? 0) > 0 ||
    (input.handoffs.mapObjectLights?.length ?? 0) > 0 ||
    (input.handoffs.mapObjectPurifications?.length ?? 0) > 0 ||
    input.handoffs.persistentAreas.some((area) =>
      area.mappedObjectEnchantment != null ||
      area.blocking?.suppressesMappedBarriers === true,
    )
  if (hasDisabledObjectHandoff) {
    return {
      ok: true,
      map: structuredClone(input.map),
      changedTokenIds: [],
      removedTokenIds: [],
      initiativeEntries: [],
      geometryDoorPatches: [],
      geometryLightUpserts: [],
      movementPaths: [],
      detonatedAreaIds: [],
    }
  }
  if (
    (
      input.handoffs.persistentAreas.length > 0 ||
      (input.handoffs.mapObjectLocks?.length ?? 0) > 0 ||
      (input.handoffs.mapObjectLights?.length ?? 0) > 0 ||
      (input.handoffs.mapObjectPurifications?.length ?? 0) > 0 ||
      truePolymorphObjectToCreature
    ) &&
    !input.areaSelection
  ) {
    return { ok: false, reason: 'activity-area-required' }
  }
  const map: BattleMap = structuredClone(input.map)
  const changedTokenIds: string[] = []
  const removedTokenIds: string[] = []
  const initiativeEntries: InitiativeEntry[] = []
  const movementPaths: Dnd5eActivityMapHandoffResultV1['movementPaths'][number][] = []
  const geometryDoorPatches: Dnd5eActivityMapHandoffResultV1['geometryDoorPatches'][number][] = []
  const geometryLightUpserts: MapGeometryLight[] = []
  const detonatedAreaIds: string[] = []

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
  for (const proposal of input.handoffs.mapObjectPurifications ?? []) {
    const selectedCells = input.areaSelection?.cells
    if (!selectedCells?.length) return { ok: false, reason: 'invalid-map-object-selection' }
    const selectedKeys = new Set(selectedCells.map(cellKey))
    const contaminants = new Set(proposal.contaminants)
    map.tokens = map.tokens.map((candidate) => {
      if (
        candidate.type !== 'obstacle' ||
        !tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => selectedKeys.has(cellKey(cell)))
      ) return candidate
      const objectState = normalizeDnd5eMapObjectStateV1(candidate.dnd5eObjectState)
      if (!objectState?.consumable) return candidate
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
    const cells = input.areaSelection?.cells
    if (!cells?.length || !proposal.areaInstance) return { ok: false, reason: 'invalid-persistent-area' }
    const areaInstance = proposal.areaInstance
    const baseId = `activity-area:${input.actionId}:${proposal.operationId}`
    const instanceCount = proposal.utilityProjectionId
      ? Math.max(1, Math.min(16, proposal.instanceCount ?? 1))
      : 1
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
    const candidateAnchors: GridCell[] = instanceCount === 1 ? [{ ...baseAnchor }] : []
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
    const triggers = proposal.triggers?.map((trigger) => ({
      ...structuredClone(trigger),
      excludedTokenIds: proposal.triggerExemptTargetIds?.length
        ? [...proposal.triggerExemptTargetIds]
        : undefined,
      savingThrow: trigger.savingThrow
        ? {
            ...trigger.savingThrow,
            dc: trigger.savingThrow.dc === 'source-save-dc'
              ? Math.max(1, Math.min(40, Math.floor(input.sourceSaveDc ?? 10)))
              : trigger.savingThrow.dc,
          }
        : undefined,
    }))
    const ids = new Set(candidateAnchors.map((_, index) =>
      instanceCount === 1 ? baseId : `${baseId}:${index + 1}`))
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
    const instanceCellsByAnchor = candidateAnchors.map((anchorCell) => cells.map((cell) => ({
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
    const createdEffectTokens: Token[] = proposal.effectToken
      ? candidateAnchors.map((anchorCell, index) => {
          const id = [...effectTokenIds][index]!
          const size = Math.max(0.25, Math.min(8, proposal.effectToken!.size ?? 1))
          const position = tokenCenterForAnchorCell(anchorCell, { size }, map)
          return {
            id,
            label: proposal.effectToken!.label,
            x: position.x,
            y: position.y,
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
              spellId: input.activity.legacySource?.kind === 'spell'
                ? input.activity.legacySource.id
                : input.activity.id,
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
              hiddenBody: proposal.effectToken!.hiddenBody === true ? true as const : undefined,
              visibleToSourceOnly: proposal.effectToken!.visibleToSourceOnly === true
                ? true as const
                : undefined,
            },
          }
        })
      : []
    if (createdEffectTokens.length > 0) {
      map.tokens = [
        ...map.tokens.filter((token) => !effectTokenIds.has(token.id)),
        ...createdEffectTokens,
      ]
      changedTokenIds.push(...effectTokenIds)
    }
    const createdAreas: Dnd5ePluginArea[] = candidateAnchors.map((anchorCell, index) => {
      const id = instanceCount === 1 ? baseId : `${baseId}:${index + 1}`
      const effectTokenId = createdEffectTokens[index]?.id
      const coreSpellId = input.activity.legacySource?.kind === 'spell'
        ? input.activity.legacySource.id
        : undefined
      const instanceCells = instanceCellsByAnchor[index]!
      const initialOccupants = proposal.blocking?.entryPermission === 'occupants-at-creation'
        ? tokensOccupyingCells(map, instanceCells).map((token) => token.id)
        : undefined
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
        relation: input.activity.target.kind === 'area' ? input.activity.target.relation : 'any',
        includeSelf: input.activity.target.kind === 'area' && input.activity.target.includeSelf === true,
        visual: proposal.visual ? { ...proposal.visual } : undefined,
        lighting: proposal.lighting ? { ...proposal.lighting } : undefined,
        hallow: proposal.hallow ? {
          ...proposal.hallow,
          wardedCreatureTypes: [...proposal.hallow.wardedCreatureTypes],
        } : undefined,
        hallucinatoryTerrain: proposal.hallucinatoryTerrain
          ? { ...proposal.hallucinatoryTerrain }
          : undefined,
        programmedIllusion: proposal.programmedIllusion
          ? { ...proposal.programmedIllusion }
          : undefined,
        movement: proposal.movement ? { ...proposal.movement } : undefined,
        sourceFollower: proposal.sourceFollower ? { ...proposal.sourceFollower } : undefined,
        lifecycle: proposal.lifecycle ? structuredClone(proposal.lifecycle) : undefined,
        movementCostMultiplier: proposal.movementCostMultiplier,
        obscuration: proposal.obscuration ? { ...proposal.obscuration } : undefined,
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
        sourceExitBehavior: proposal.sourceExitBehavior,
        sourceOverlapBehavior: proposal.sourceOverlapBehavior,
        vertical: areaInstance.heightFeet
          ? {
              mode: 'volume',
              baseElevationFeet: areaInstance.elevationFeet ?? actorToken.elevationFeet ?? 0,
              heightFeet: areaInstance.heightFeet,
            }
          : undefined,
      }
    })
    map.dnd5ePluginAreas = [
      ...(map.dnd5ePluginAreas ?? []).filter((area) => !ids.has(area.id)),
      ...createdAreas,
    ]
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
        classResources: Object.fromEntries(Object.entries(proposal.resources).map(([id, resource]) => [id, { ...resource }])),
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
        return restoredObject ? [restoredObject] : []
      })
      changedTokenIds.push(...replacedIds)
      removedTokenIds.push(...removedIds)
    }
  }

  let summonIndex = 0
  for (const proposal of input.handoffs.summons) {
    if (proposal.timing !== 'immediate') {
      return { ok: false, reason: 'delayed-summon-placement-unsupported' }
    }
    for (let occurrence = 0; occurrence < proposal.count; occurrence += 1) {
      const targetCell = truePolymorphOriginalObject
        ? input.areaSelection?.anchorCell
        : input.selection.summonCells?.[summonIndex]
      const initiativeD20 = input.selection.summonInitiativeD20s?.[summonIndex]
      if (!targetCell || initiativeD20 == null) return { ok: false, reason: 'invalid-summon-placement' }
      if (proposal.persistent) {
        const sourceCharacterId = actorToken.characterId ?? input.actorId
        const replaced = map.tokens.filter((token) =>
          token.dnd5eSummon?.persistent === true &&
          token.dnd5eSummon.sourceCharacterId === sourceCharacterId &&
          token.dnd5eSummon.featureId === input.activity.id)
        if (replaced.length > 0) {
          const replacedIds = new Set(replaced.map((token) => token.id))
          map.tokens = map.tokens.filter((token) => !replacedIds.has(token.id))
          changedTokenIds.push(...replacedIds)
          removedTokenIds.push(...replacedIds)
        }
      }
      const planned = planDnd5eSummonedCreature({
        map,
        actorToken,
        sourceCharacterId: actorToken.characterId ?? input.actorId,
        featureId: input.activity.id,
        pluginId: input.packageId,
        actionId: `${input.actionId}:${proposal.operationId}`,
        occurrenceIndex: summonIndex,
        concentrationId: proposal.concentration
          ? input.concentrationId ?? `activity:${input.activity.id}`
          : undefined,
        createdWorldMinute: input.worldMinute,
        round: input.round,
        targetCell,
        initiativeD20,
        summon: {
          monsterId: proposal.monsterId,
          durationRounds: proposal.durationRounds,
          concentration: proposal.concentration,
          side: proposal.side,
          persistent: proposal.persistent,
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
          weaponAttacksMagical: proposal.weaponAttacksMagical,
          attacksPerAction: proposal.attacksPerAction,
          shareSelfSpellsRangeFeet: proposal.shareSelfSpellsRangeFeet,
          cannotAttack: proposal.cannotAttack,
          walkingSpeedFeet: proposal.walkingSpeedFeet,
          dismissAfterDamageRounds: proposal.dismissAfterDamageRounds,
        },
      })
      if (!planned.ok) return { ok: false, reason: 'invalid-summon-placement' }
      const plannedToken = truePolymorphOriginalObject
        ? {
            ...planned.plan.token,
            dnd5eSummon: {
              ...planned.plan.token.dnd5eSummon!,
              truePolymorphOriginalObject,
            },
          }
        : planned.plan.token
      map.tokens = [...map.tokens, plannedToken]
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
      const toElevationFeet = proposal.verticalDestination === 'area-top'
        ? areaTopElevationFeet
        : proposal.verticalDestination === 'ground'
          ? groundElevationFeet
          : proposal.mode === 'ascend'
            ? Math.min(10_000, fromElevationFeet + proposal.distanceFeet)
            : Math.max(groundElevationFeet, fromElevationFeet - proposal.distanceFeet)
      if (!Number.isFinite(toElevationFeet) || toElevationFeet === fromElevationFeet) {
        return { ok: false, reason: 'invalid-movement-placement' }
      }
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
      continue
    }
    const destination = input.selection.movementCellsByOperationId?.[
      dnd5eActivityMovementSelectionKeyV1(proposal)
    ] ?? input.selection.movementCellsByOperationId?.[proposal.operationId]
    if (!destination) return { ok: false, reason: 'invalid-movement-placement' }
    const movement = validMovementDestination({
      map, actorToken, targetToken: target, destination,
      mode: proposal.mode, distanceFeet: proposal.distanceFeet,
      originIllumination: proposal.originIllumination,
      destinationIllumination: proposal.destinationIllumination,
      requiresLineOfSight: proposal.requiresLineOfSight,
      usesTargetReactionIfAvailable: proposal.usesTargetReactionIfAvailable,
      directionOriginCell: input.movementOriginCell,
    })
    if (!movement) return { ok: false, reason: 'invalid-movement-placement' }
    map.tokens = map.tokens.map((token) => token.id === target.id ? { ...token, ...movement.position } : token)
    changedTokenIds.push(target.id)
    movementPaths.push({
      operationId: proposal.operationId,
      targetId: target.id,
      path: movement.path,
      to: movement.position,
      provokesOpportunityAttacks: proposal.provokesOpportunityAttacks === true,
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
      : tokenAnchorCellFromPixel(target.x, target.y, target, map)
    if (!currentAnchor || cellDistance(currentAnchor, destination) * Math.max(1, map.feetPerCell ?? 5) > proposal.maximumFeet) {
      return { ok: false, reason: 'invalid-movement-placement' }
    }
    const deltaCol = destination.col - currentAnchor.col
    const deltaRow = destination.row - currentAnchor.row
    const translatedCells = area.cells.map((cell) => ({
      col: cell.col + deltaCol,
      row: cell.row + deltaRow,
    }))
    const { cols, rows } = mapCellExtent(map)
    if (translatedCells.some((cell) =>
      cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows
    )) return { ok: false, reason: 'invalid-movement-placement' }
    const anchorPoint = cellToPixel(destination, map)
    map.dnd5ePluginAreas = map.dnd5ePluginAreas?.map((candidate) => candidate.id === area.id
      ? {
          ...candidate,
          anchorCell: destination,
          cells: translatedCells,
          interposition: proposal.interposition === 'blocked' || proposal.interposition === 'difficult-terrain'
            ? { targetTokenId: target.id, mode: proposal.interposition }
            : proposal.interposition === 'clear'
              ? undefined
              : candidate.interposition,
        }
      : candidate)
    if (area.anchorTokenId) {
      map.tokens = map.tokens.map((token) => token.id === area.anchorTokenId
        ? { ...token, x: anchorPoint.x, y: anchorPoint.y }
        : token)
      changedTokenIds.push(area.anchorTokenId)
    }
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
    map.tokens = map.tokens.map((token) => token.id === area.anchorTokenId
      ? {
          ...token,
          dnd5eSpellEffect: {
            ...token.dnd5eSpellEffect!,
            shareVisionWithSource: proposal.mode === 'projection' ? true as const : undefined,
          },
        }
      : token)
    changedTokenIds.push(area.anchorTokenId)
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

  return {
    ok: true,
    map,
    changedTokenIds: [...new Set(changedTokenIds)],
    removedTokenIds: [...new Set(removedTokenIds)],
    initiativeEntries,
    geometryDoorPatches,
    geometryLightUpserts,
    movementPaths,
    detonatedAreaIds: [...new Set(detonatedAreaIds)],
  }
}

export function dnd5eActivityMapCellForPlacementV1(
  placement: Dnd5eActivityAreaPlacementV1,
  map: BattleMap,
): GridCell {
  return pixelToCell(placement.x, placement.y, map)
}
