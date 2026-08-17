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
  mapGeometryLineOfSightBlocked,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
} from '../../../lib/mapGeometry'
import { areOpposedCombatTokens } from '../../../lib/opportunityAttacks'
import { findMapGeometryPath } from '../../../lib/mapPathfinding'
import {
  aoeOrientFromCell,
  canPlaceAoe,
  cellsForAoe,
  tokensInCells,
  type SkillAoeTargeting,
} from '../../../lib/skillTargeting'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../../store/maps'
import { planDnd5eSummonedCreature } from '../summonedCreatures'
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
  initiativeEntries: readonly InitiativeEntry[]
  movementPaths: readonly {
    operationId: string
    targetId: string
    path: readonly { x: number; y: number }[]
    to: { x: number; y: number }
    provokesOpportunityAttacks: boolean
  }[]
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
  if (!canPlaceAoe(template, actorCell, input.anchorCell)) return undefined
  const orientFrom = aoeOrientFromCell(template, actorCell, input.anchorCell, {
    rectRotation: input.rectRotation ?? 0,
  })
  const cells = cellsForAoe(template, orientFrom, input.anchorCell)
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
  const anchor = cellToPixel(input.anchorCell, input.map)
  return {
    anchorCell: { ...input.anchorCell },
    cells: cells.map((cell) => ({ ...cell })),
    targetIds,
    areaPlacementDistanceFeet: cellDistance(actorCell, input.anchorCell) * Math.max(1, input.map.feetPerCell ?? 5),
    areaPlacement: {
      x: anchor.x,
      y: anchor.y,
      elevationFeet: input.actorToken.elevationFeet,
      angleDegrees: target.rotatable ? ((input.rectRotation ?? 0) % 4) * 90 : undefined,
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
  handoffs: Dnd5eActivityAuthorityHandoffs
  areaSelection?: Dnd5eActivityAreaMapSelectionV1
  selection: Dnd5eActivityMapHandoffSelectionV1
  /** Area-granted Activities measure push/pull direction from this anchor. */
  movementOriginCell?: GridCell
}): Dnd5eActivityMapHandoffResultV1 | Dnd5eActivityMapHandoffFailureV1 {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorId)
  if (!actorToken) return { ok: false, reason: 'invalid-actor-token' }
  if (input.handoffs.persistentAreas.length > 0 && !input.areaSelection) {
    return { ok: false, reason: 'activity-area-required' }
  }
  const map: BattleMap = structuredClone(input.map)
  const changedTokenIds: string[] = []
  const initiativeEntries: InitiativeEntry[] = []
  const movementPaths: Dnd5eActivityMapHandoffResultV1['movementPaths'][number][] = []

  const actorCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, map)
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
    const createdAreas: Dnd5ePluginArea[] = candidateAnchors.map((anchorCell, index) => {
      const id = instanceCount === 1 ? baseId : `${baseId}:${index + 1}`
      const instanceCells = cells.map((cell) => ({
        col: anchorCell.col + cell.col - baseAnchor.col,
        row: anchorCell.row + cell.row - baseAnchor.row,
      }))
      return {
        id,
        pluginId: input.packageId,
        featureId: input.activity.id,
        sourceKind: 'plugin-feature' as const,
        utilityProjectionId: proposal.utilityProjectionId,
        label: instanceCount === 1 ? proposal.label : `${proposal.label} ${index + 1}`,
        color: proposal.color ?? '#8b5cf6',
        sourceCharacterId: actorToken.characterId ?? input.actorId,
        sourceTokenId: actorToken.id,
        cells: instanceCells,
        createdRound: input.round,
        expiresAfterRound: input.round + proposal.durationRounds - 1,
        concentrationId: proposal.concentration
          ? input.concentrationId ?? `activity:${input.activity.id}`
          : undefined,
        relation: input.activity.target.kind === 'area' ? input.activity.target.relation : 'any',
        includeSelf: input.activity.target.kind === 'area' && input.activity.target.includeSelf === true,
        visual: proposal.visual ? { ...proposal.visual } : undefined,
        movement: proposal.movement ? { ...proposal.movement } : undefined,
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
              conditionImmunities: proposal.occupantModifiers.conditionImmunities
                ? [...proposal.occupantModifiers.conditionImmunities]
                : undefined,
            }
          : undefined,
        blocking: proposal.blocking ? { ...proposal.blocking } : undefined,
        weaponHitBonusDamage: proposal.weaponHitBonusDamage
          ? { ...proposal.weaponHitBonusDamage }
          : undefined,
        grantedActivities: proposal.grantedActivities?.map((grant) => ({ ...grant })),
        triggers: triggers && triggers.length > 0 ? triggers : undefined,
        anchorMode: input.activity.target.kind === 'area' && input.activity.target.origin === 'self'
          ? 'source-token'
          : 'fixed',
        anchorTokenId: input.activity.target.kind === 'area' && input.activity.target.origin === 'self'
          ? actorToken.id
          : undefined,
        anchorCell,
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

  let summonIndex = 0
  for (const proposal of input.handoffs.summons) {
    if (proposal.timing !== 'immediate') {
      return { ok: false, reason: 'delayed-summon-placement-unsupported' }
    }
    for (let occurrence = 0; occurrence < proposal.count; occurrence += 1) {
      const targetCell = input.selection.summonCells?.[summonIndex]
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
        concentrationId: proposal.concentration ? `activity:${input.activity.id}` : undefined,
        round: input.round,
        targetCell,
        initiativeD20,
        summon: {
          monsterId: proposal.monsterId,
          durationRounds: proposal.durationRounds,
          concentration: proposal.concentration,
          side: proposal.side,
          persistent: proposal.persistent,
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
        },
      })
      if (!planned.ok) return { ok: false, reason: 'invalid-summon-placement' }
      map.tokens = [...map.tokens, planned.plan.token]
      changedTokenIds.push(planned.plan.token.id)
      initiativeEntries.push(planned.plan.initiativeEntry)
      summonIndex += 1
    }
  }

  for (const proposal of input.handoffs.movements) {
    const target = map.tokens.find((token) => token.id === proposal.targetId)
    if (!target) return { ok: false, reason: 'invalid-movement-placement' }
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

  return {
    ok: true,
    map,
    changedTokenIds: [...new Set(changedTokenIds)],
    initiativeEntries,
    movementPaths,
  }
}

export function dnd5eActivityMapCellForPlacementV1(
  placement: Dnd5eActivityAreaPlacementV1,
  map: BattleMap,
): GridCell {
  return pixelToCell(placement.x, placement.y, map)
}
