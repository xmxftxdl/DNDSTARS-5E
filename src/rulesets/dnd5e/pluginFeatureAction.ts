import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  cellDistance,
  cellToPixel,
  pixelToCell,
  tokenOccupiedCellsAt,
  tokenFootprintDistanceCells,
  type GridCell,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells } from '../../lib/skillTargeting'
import type {
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  normalizeDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeatureDefinition,
  dnd5ePluginGrantedActivityDefinitionV1,
  dnd5ePluginHeadlessActionDefinition,
  missingDnd5eRulesPluginRequirements,
  type Dnd5ePluginAction,
  type Dnd5ePluginPersistentAreaVerticalDeclaration,
  type RegisteredDnd5ePluginFeature,
} from './pluginApi'
import {
  dnd5eHeadlessTurnKey,
  resolveDnd5eSandboxedPluginCapabilities,
  type Dnd5eActionFailure,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import { resolveDnd5eSandboxedPluginAction } from './pluginSandbox'
import {
  createDnd5eMapCombatSnapshot,
  dnd5eRequestedInitiativeActorIndex,
  planDnd5eMapResultApplication,
  prepareDnd5eExplorationActor,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { planDnd5eSummonedCreature } from './summonedCreatures'
import type { Dnd5ePersistentAreaVerticalSnapshot } from './persistentAreaTypes'
import type { Dnd5eActivityAreaPlacementV1 } from './activities/dnd5eActivityContracts'
import {
  dnd5eInstantAoeAffectsTokenVertically,
  dnd5eTokenToPointDistanceFeet,
} from './verticalCombatGeometry'
import { DND5E_SRD_AUDITED_SPELL_PACKAGE_ID } from './activities/dnd5eSrdAuditedSpellActivities'
import { dnd5eActivityManualAdjudicationOperationsV1 } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { dnd5eActivityRootRequirementsSatisfiedV1 } from './activities/dnd5eActivityExecutor'

export type Dnd5ePluginFeatureActionRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'plugin-missing'
  | 'room-rules-unavailable'
  | 'plugin-not-enabled-for-room'
  | 'plugin-version-mismatch'
  | 'feature-not-selected'
  | 'feature-unavailable'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'summon-position-blocked'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'reaction-unavailable'
  | 'feature-already-used'
  | 'combatant-missing'

export interface PreparedDnd5ePluginFeatureAction {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetToken: Token
  targetTokens: Token[]
  targetCells: GridCell[]
  targetCell?: GridCell
  areaTargetElevationFeet?: number
  feature: RegisteredDnd5ePluginFeature
  distanceFeet: number
  headlessAction: Dnd5ePluginAction
  /** Map entity that granted this otherwise unowned Activity control. */
  persistentAreaGrant?: {
    areaId: string
    anchorCell: GridCell
    activityId: string
    waiveActionEconomy: boolean
  }
}

export type Dnd5ePluginApplicationRebaseResult =
  | { ok: true; application: Dnd5eMapResultPlan }
  | { ok: false; reason: 'plugin-commit-conflict' }

function sameSnapshot(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Interrupt/骰子等待期间地图仍可被其他事务推进。插件结果提交前只把本事务
 * 声明修改的实体覆盖到最新快照；同一实体被并发修改时 fail closed。
 */
export function rebaseDnd5ePluginFeatureApplication(input: {
  baseMap: BattleMap
  baseCharacters: readonly Character[]
  application: Dnd5eMapResultPlan
  latestMap: BattleMap
  latestCharacters: readonly Character[]
}): Dnd5ePluginApplicationRebaseResult {
  if (
    input.baseMap.id !== input.application.map.id ||
    input.latestMap.id !== input.application.map.id
  ) return { ok: false, reason: 'plugin-commit-conflict' }

  const changedTokenIds = [...new Set(input.application.changedTokenIds)]
  const changedCharacterIds = [...new Set(input.application.changedCharacterIds)]
  const baseTokens = new Map(input.baseMap.tokens.map((token) => [token.id, token]))
  const resultTokens = new Map(input.application.map.tokens.map((token) => [token.id, token]))
  const latestTokens = new Map(input.latestMap.tokens.map((token) => [token.id, token]))
  if (
    baseTokens.size !== input.baseMap.tokens.length ||
    resultTokens.size !== input.application.map.tokens.length ||
    latestTokens.size !== input.latestMap.tokens.length
  ) return { ok: false, reason: 'plugin-commit-conflict' }

  for (const tokenId of changedTokenIds) {
    const result = resultTokens.get(tokenId)
    const base = baseTokens.get(tokenId)
    const latest = latestTokens.get(tokenId)
    if (!result || (base && !latest) || (!base && latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    if (base && latest && !sameSnapshot(base, latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    latestTokens.set(tokenId, result)
  }

  const baseCharacters = new Map(input.baseCharacters.map((character) => [character.id, character]))
  const resultCharacters = new Map(input.application.characters.map((character) => [character.id, character]))
  const latestCharacters = new Map(input.latestCharacters.map((character) => [character.id, character]))
  for (const characterId of changedCharacterIds) {
    const base = baseCharacters.get(characterId)
    const result = resultCharacters.get(characterId)
    const latest = latestCharacters.get(characterId)
    if (!base || !result || !latest || !sameSnapshot(base, latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    latestCharacters.set(characterId, result)
  }

  const baseAreas = new Map((input.baseMap.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const resultAreas = new Map((input.application.map.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const latestAreas = new Map((input.latestMap.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const areaIds = new Set([...baseAreas.keys(), ...resultAreas.keys()])
  for (const areaId of areaIds) {
    const base = baseAreas.get(areaId)
    const result = resultAreas.get(areaId)
    if (sameSnapshot(base, result)) continue
    const latest = latestAreas.get(areaId)
    if ((base && !sameSnapshot(base, latest)) || (!base && latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    if (result) latestAreas.set(areaId, result)
    else latestAreas.delete(areaId)
  }

  return {
    ok: true,
    application: {
      map: {
        ...input.latestMap,
        tokens: [...latestTokens.values()],
        dnd5ePluginAreas: [...latestAreas.values()],
      },
      characters: [...latestCharacters.values()],
      changedTokenIds,
      changedCharacterIds,
    },
  }
}

function economyRejectReason(
  economy: NonNullable<RegisteredDnd5ePluginFeature['action']>['economy'],
  turnEconomy: Dnd5eTurnEconomyCounts | undefined,
): Dnd5ePluginFeatureActionRejectReason | undefined {
  if (!turnEconomy || economy === 'none') return undefined
  if (economy === 'action' && turnEconomy.action.current < 1) return 'action-unavailable'
  if (economy === 'bonusAction' && turnEconomy.bonusAction.current < 1) return 'bonus-action-unavailable'
  if (economy === 'reaction' && turnEconomy.reaction.current < 1) return 'reaction-unavailable'
  return undefined
}

function persistentAreaGrantForAction(input: {
  map: BattleMap
  actor: Character
  actorToken: Token
  feature: RegisteredDnd5ePluginFeature
  payload: NonNullable<SharedPlayerActionState['dnd5ePluginAction']>
}) {
  const raw = input.payload.payload
  const areaId = raw && typeof raw === 'object' && !Array.isArray(raw) &&
    typeof raw.persistentAreaId === 'string'
    ? raw.persistentAreaId
    : undefined
  if (!areaId || !input.feature.action) return undefined
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
  if (
    !area || area.sourceCharacterId !== input.actor.id || area.sourceTokenId !== input.actorToken.id ||
    area.pluginId !== input.feature.ownerPluginId ||
    !area.grantedActivities?.some((grant) => grant.activityId === input.feature.action!.id)
  ) return undefined
  return {
    area,
    anchorCell: area.anchorCell ?? area.cells[0],
  }
}

function activeEffectGrantForAction(input: {
  activeEffects: readonly Dnd5eActiveEffectInstance[] | undefined
  feature: RegisteredDnd5ePluginFeature
  payload: NonNullable<SharedPlayerActionState['dnd5ePluginAction']>
}) {
  const raw = input.payload.payload
  const effectId = raw && typeof raw === 'object' && !Array.isArray(raw) &&
    typeof raw.activeEffectId === 'string'
    ? raw.activeEffectId
    : undefined
  if (!effectId || !input.feature.action) return undefined
  return normalizeDnd5eActiveEffects(input.activeEffects).find((effect) =>
    effect.id === effectId &&
    !effect.suspendedBy?.length &&
    (effect.source.pluginId ?? (effect.source.kind === 'spell'
      ? DND5E_SRD_AUDITED_SPELL_PACKAGE_ID
      : undefined)) === input.feature.ownerPluginId &&
    effect.grantedActivities?.includes(input.feature.action!.id))
}

function persistentAreaDistanceFeet(input: {
  map: BattleMap
  areaCells: readonly GridCell[]
  target: Token
}): number {
  const targetCells = tokenOccupiedCellsAt(input.target, input.map, input.target)
  const cells = input.areaCells.length > 0 ? input.areaCells : [{ col: 0, row: 0 }]
  return Math.min(...cells.flatMap((areaCell) => targetCells.map((targetCell) =>
    cellDistance(areaCell, targetCell),
  ))) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
}

export function prepareDnd5ePluginFeatureAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  roomRequiredPlugins?: readonly {
    id: string
    version: string
    integrity?: string
  }[] | null
}): { ok: true; prepared: PreparedDnd5ePluginFeatureAction } | {
  ok: false
  reason: Dnd5ePluginFeatureActionRejectReason
} {
  const { action } = input
  const payload = action.dnd5ePluginAction
  if (action.type !== 'dnd5e-plugin-action' || !payload?.featureId) {
    return { ok: false, reason: 'invalid-action' }
  }
  const registeredFeature = dnd5ePluginFeatureDefinition(payload.featureId)
  if (!registeredFeature) return { ok: false, reason: 'plugin-missing' }
  let feature: RegisteredDnd5ePluginFeature = registeredFeature
  if (input.roomRequiredPlugins === null) return { ok: false, reason: 'room-rules-unavailable' }
  if (input.roomRequiredPlugins) {
    if (feature.ownerPluginId !== DND5E_SRD_AUDITED_SPELL_PACKAGE_ID) {
      const roomRequirement = input.roomRequiredPlugins.find((plugin) => plugin.id === feature.ownerPluginId)
      if (!roomRequirement) return { ok: false, reason: 'plugin-not-enabled-for-room' }
      if (missingDnd5eRulesPluginRequirements([roomRequirement]).length > 0) {
        return { ok: false, reason: 'plugin-version-mismatch' }
      }
    }
  }
  if (!feature.action || feature.automation === 'manual') {
    return { ok: false, reason: 'feature-unavailable' }
  }
  const rawFeaturePayload = payload.payload
  const activityChoices = rawFeaturePayload && typeof rawFeaturePayload === 'object' &&
    !Array.isArray(rawFeaturePayload) && rawFeaturePayload.activityChoices &&
    typeof rawFeaturePayload.activityChoices === 'object' && !Array.isArray(rawFeaturePayload.activityChoices)
    ? Object.fromEntries(Object.entries(rawFeaturePayload.activityChoices).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ))
    : undefined
  const grantedActivityDefinition = dnd5ePluginGrantedActivityDefinitionV1(feature.id)
  if (
    feature.action.interrupt && grantedActivityDefinition && activityChoices &&
    dnd5eActivityManualAdjudicationOperationsV1(grantedActivityDefinition, activityChoices).length === 0
  ) {
    const { interrupt: _unusedInterrupt, ...actionWithoutInterrupt } = feature.action
    feature = { ...feature, action: actionWithoutInterrupt }
  }
  const featureAction = feature.action
  if (!featureAction) return { ok: false, reason: 'feature-unavailable' }
  if (featureAction.trigger && featureAction.trigger.kind !== 'active-use') {
    return { ok: false, reason: 'feature-unavailable' }
  }
  const linkedActor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId)
  if (
    !actorToken || actorToken.type === 'obstacle' ||
    (linkedActor ? actorToken.characterId !== linkedActor.id : action.sourceMode !== 'dm')
  ) return { ok: false, reason: 'invalid-actor' }
  const actorHitPoints = linkedActor?.currentHp ?? actorToken.hp ?? actorToken.maxHp ?? 0
  if (actorHitPoints <= 0) return { ok: false, reason: 'invalid-actor' }
  // DM-controlled monsters have no Character row. A narrow synthetic view is
  // sufficient for an action granted by that token's authoritative Effect;
  // the map snapshot and result application continue to use the real Token.
  const actor = linkedActor ?? ({
    id: action.characterId,
    name: actorToken.label,
    currentHp: actorHitPoints,
    maxHp: actorToken.maxHp ?? actorHitPoints,
    tempHp: actorToken.dnd5eCombatState?.temporaryHp ?? 0,
    saveDC: 10,
    dnd5eCombatState: actorToken.dnd5eCombatState,
  } as Character)
  const persistentAreaGrant = linkedActor
    ? persistentAreaGrantForAction({
        map: input.map,
        actor,
        actorToken,
        feature,
        payload,
      })
    : undefined
  const ownedActiveEffectGrant = activeEffectGrantForAction({
    activeEffects: linkedActor?.dnd5eCombatState?.activeEffects ?? actorToken.dnd5eCombatState?.activeEffects,
    feature,
    payload,
  })
  const requestedTargetToken = action.targetTokenId
    ? input.map.tokens.find((token) => token.id === action.targetTokenId)
    : undefined
  const externalActiveEffectGrant = requestedTargetToken
    ? activeEffectGrantForAction({
        activeEffects: requestedTargetToken.characterId
          ? input.characters.find((character) => character.id === requestedTargetToken.characterId)
              ?.dnd5eCombatState?.activeEffects ?? requestedTargetToken.dnd5eCombatState?.activeEffects
          : requestedTargetToken.dnd5eCombatState?.activeEffects,
        feature,
        payload,
      })
    : undefined
  const authorizedExternalActiveEffectGrant = externalActiveEffectGrant
    ?.tags?.includes('externally-usable-activity')
    ? externalActiveEffectGrant
    : undefined
  const activeEffectGrant = ownedActiveEffectGrant ?? authorizedExternalActiveEffectGrant
  if (!persistentAreaGrant && !activeEffectGrant && !dnd5eCharacterHasPluginFeature(actor, feature.id)) {
    return { ok: false, reason: feature.grantedBySubclass ? 'feature-unavailable' : 'feature-not-selected' }
  }
  const grantedActivity = persistentAreaGrant?.area.grantedActivities?.find((grant) =>
    grant.activityId === featureAction.id,
  )
  const waiveActionEconomy = grantedActivity?.activateOnCreate === true &&
    !persistentAreaGrant?.area.grantedActivityUseReceipts?.includes(featureAction.id)
  const economyFailure = waiveActionEconomy
    ? undefined
    : economyRejectReason(featureAction.economy, input.turnEconomy)
  if (economyFailure) return { ok: false, reason: economyFailure }

  let targetToken: Token | undefined
  let targetTokens: Token[]
  let targetCell: GridCell | undefined
  let targetCells: GridCell[] = []
  let areaTargetElevationFeet: number | undefined
  let activityAreaPlacement: Dnd5eActivityAreaPlacementV1 | undefined
  let distanceFeet = 0
  const distanceFeetByTargetId: Record<string, number> = {}
  if (featureAction.targeting.kind === 'self') {
    if (action.targetTokenId && action.targetTokenId !== actorToken.id) {
      return { ok: false, reason: 'invalid-target' }
    }
    targetToken = actorToken
    targetTokens = [actorToken]
  } else if (featureAction.targeting.kind === 'single-creature') {
    targetToken = input.map.tokens.find((token) => token.id === action.targetTokenId)
    if (!targetToken || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
    if (targetToken.id === actorToken.id && featureAction.targeting.includeSelf !== true) {
      return { ok: false, reason: 'invalid-target' }
    }
    const opposed = areOpposedCombatTokens(actorToken, targetToken)
    if (featureAction.targeting.relation === 'ally' && opposed) {
      return { ok: false, reason: 'invalid-target' }
    }
    if (featureAction.targeting.relation === 'enemy' && !opposed) {
      return { ok: false, reason: 'invalid-target' }
    }
    distanceFeet = persistentAreaGrant
      ? persistentAreaDistanceFeet({
          map: input.map,
          areaCells: persistentAreaGrant.area.cells,
          target: targetToken,
        })
      : tokenFootprintDistanceCells(actorToken, targetToken, input.map) *
        Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    if (
      featureAction.targeting.rangeFeet != null &&
      distanceFeet > featureAction.targeting.rangeFeet
    ) {
      return { ok: false, reason: 'target-out-of-range' }
    }
    distanceFeetByTargetId[targetToken.id] = distanceFeet
    targetTokens = [targetToken]
  } else if (featureAction.targeting.kind === 'multiple-creatures') {
    const targeting = featureAction.targeting
    const uniqueIds = [...new Set(action.targetTokenIds ?? [])]
    if (uniqueIds.length < 1 || uniqueIds.length > targeting.maximumTargets) {
      return { ok: false, reason: 'invalid-target' }
    }
    targetTokens = uniqueIds.flatMap((id) => {
      const token = input.map.tokens.find((candidate) => candidate.id === id)
      return token ? [token] : []
    })
    if (targetTokens.length !== uniqueIds.length || targetTokens.some((token) => token.type === 'obstacle')) {
      return { ok: false, reason: 'invalid-target' }
    }
    for (const token of targetTokens) {
      if (token.id === actorToken.id && targeting.includeSelf !== true) {
        return { ok: false, reason: 'invalid-target' }
      }
      const opposed = areOpposedCombatTokens(actorToken, token)
      if ((targeting.relation === 'ally' && opposed) || (targeting.relation === 'enemy' && !opposed)) {
        return { ok: false, reason: 'invalid-target' }
      }
      const targetDistanceFeet = persistentAreaGrant
        ? persistentAreaDistanceFeet({
            map: input.map,
            areaCells: persistentAreaGrant.area.cells,
            target: token,
          })
        : tokenFootprintDistanceCells(actorToken, token, input.map) *
          Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      if (targeting.rangeFeet != null && targetDistanceFeet > targeting.rangeFeet) {
        return { ok: false, reason: 'target-out-of-range' }
      }
      distanceFeetByTargetId[token.id] = targetDistanceFeet
      distanceFeet = Math.max(distanceFeet, targetDistanceFeet)
    }
    targetToken = targetTokens[0]
  } else {
    const targeting = featureAction.targeting
    const geometry = mapGeometryRuntimeForMap(input.map.id)
    const casterCell = persistentAreaGrant?.anchorCell ?? pixelToCell(actorToken.x, actorToken.y, input.map)
    targetCell = action.targetCell ?? (targeting.template.shape === 'circle' && targeting.template.origin === 'self'
      ? casterCell
      : undefined)
    if (!targetCell || !canPlaceAoe(targeting.template, casterCell, targetCell)) {
      return { ok: false, reason: 'target-out-of-range' }
    }
    const targetOrientation = action.targetOrientation
    if (
      targetOrientation != null &&
      (!Number.isInteger(targetOrientation) || targetOrientation < 0 || targetOrientation > 3)
    ) return { ok: false, reason: 'invalid-target' }
    const orientFrom = aoeOrientFromCell(targeting.template, casterCell, targetCell, {
      rectRotation: targetOrientation,
    })
    const cells = cellsForAoe(targeting.template, orientFrom, targetCell)
    targetCells = cells
    const effectAim = {
      x: input.map.gridOffsetX + (targetCell.col + 0.5) * input.map.gridSize,
      y: input.map.gridOffsetY + (targetCell.row + 0.5) * input.map.gridSize,
    }
    const grantedOrigin = persistentAreaGrant
      ? cellToPixel(persistentAreaGrant.anchorCell, input.map)
      : undefined
    const effectOrigin = targeting.template.origin === 'point'
      ? effectAim
      : grantedOrigin ?? actorToken
    if (
      action.targetElevationFeet != null &&
      (!Number.isFinite(action.targetElevationFeet) ||
        action.targetElevationFeet < -1_000 ||
        action.targetElevationFeet > 10_000)
    ) return { ok: false, reason: 'invalid-target' }
    const effectAimElevationFeet = action.targetElevationFeet ??
      mapGeometryTerrainElevationAtPoint(geometry, effectAim)
    areaTargetElevationFeet = targeting.template.origin === 'point'
      ? effectAimElevationFeet
      : mapGeometryTokenElevation(geometry, actorToken)
    const anchor = cellToPixel(targetCell, input.map)
    const angleDegrees = targeting.template.shape === 'line' || targeting.template.shape === 'cone'
      ? Math.atan2(targetCell.row - casterCell.row, targetCell.col - casterCell.col) * 180 / Math.PI
      : targeting.template.shape === 'rect' && targeting.template.rotatable
        ? (targetOrientation ?? 0) * 90
        : undefined
    activityAreaPlacement = {
      x: anchor.x,
      y: anchor.y,
      elevationFeet: areaTargetElevationFeet,
      angleDegrees,
      radiusFeet: targeting.template.shape === 'circle' ? targeting.template.radiusFeet : undefined,
      lengthFeet: targeting.template.shape === 'line' || targeting.template.shape === 'cone'
        ? targeting.template.lengthFeet
        : undefined,
      widthFeet: targeting.template.shape === 'rect' || targeting.template.shape === 'line'
        ? targeting.template.widthFeet
        : undefined,
      heightFeet: targeting.template.shape === 'rect' ? targeting.template.heightFeet : undefined,
    }
    if (targeting.template.origin === 'point') {
      const areaPointToken: Token = {
        ...actorToken,
        id: `${actorToken.id}:plugin-area-placement`,
        characterId: undefined,
        type: 'obstacle',
        size: 1,
        ...effectOrigin,
        elevationFeet: areaTargetElevationFeet,
      }
      const horizontalDistanceFeet = persistentAreaGrant
        ? cellDistance(casterCell, targetCell) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
        : tokenFootprintDistanceCells(
            actorToken,
            areaPointToken,
            input.map,
          ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      distanceFeet = horizontalDistanceFeet
      if (
        targeting.template.placeRangeFeet != null &&
        (persistentAreaGrant
          ? horizontalDistanceFeet
          : dnd5eTokenToPointDistanceFeet({
              geometry,
              token: actorToken,
              pointElevationFeet: areaTargetElevationFeet,
              horizontalDistanceFeet,
            })) > targeting.template.placeRangeFeet + 1e-4
      ) return { ok: false, reason: 'target-out-of-range' }
    }
    targetTokens = tokensInCells(input.map, input.map.tokens, cells)
      .filter((token) => {
        if (token.type === 'obstacle') return false
        if (token.id === actorToken.id && targeting.includeSelf !== true) return false
        const opposed = areOpposedCombatTokens(actorToken, token)
        if (targeting.relation === 'ally' && opposed) return false
        if (targeting.relation === 'enemy' && !opposed) return false
        return dnd5eInstantAoeAffectsTokenVertically({
          spellId: `plugin:${feature.id}`,
          area: targeting.template,
          map: input.map,
          geometry,
          sourceToken: actorToken,
          targetToken: token,
          effectOrigin,
          effectOriginElevationFeet: areaTargetElevationFeet!,
          effectAim,
          effectAimElevationFeet,
        })
      })
      .slice(0, targeting.maximumTargets ?? 64)
    targetToken = targetTokens[0]
    const permitsEmptyArea = (
      !!featureAction.persistentArea ||
      !!featureAction.summon ||
      !!persistentAreaGrant ||
      !!activeEffectGrant
    ) &&
      featureAction.interrupt?.audience !== 'target'
    if (!targetToken && !permitsEmptyArea) return { ok: false, reason: 'invalid-target' }
    // 持续区域的创建、召唤以及区域授予的移动/重塑控制都可以落在当前没有
    // 生物的格子上。Prepared 的展示目标使用施法者，但传给 Headless 的
    // targetIds 仍为空，避免把施法者伪装成区域目标。
    targetToken ??= actorToken
    if (featureAction.summon && targetCell) {
      const summonPlacement = planDnd5eSummonedCreature({
        map: input.map,
        actorToken,
        sourceCharacterId: actor.id,
        featureId: feature.id,
        pluginId: feature.ownerPluginId,
        actionId: action.id,
        round: action.round,
        targetCell,
        initiativeD20: 1,
        summon: featureAction.summon,
      })
      if (!summonPlacement.ok) return {
        ok: false,
        reason: summonPlacement.reason === 'summon-position-blocked' ? 'summon-position-blocked' : 'invalid-target',
      }
    }
  }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  // Exploration uses the same atomic Headless resolver without a live combat
  // identity.  The synthetic snapshot must therefore be executable for this
  // one transaction; the applied map/character projection does not start a
  // real combat.
  if (!action.combatId?.trim()) prepareDnd5eExplorationActor(snapshot.state, actorToken.id)
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const targetCombatants = targetTokens.map((token) => snapshot.state.combatants[token.id])
  if (actorIndex < 0 || !actorCombatant || targetCombatants.some((target) => !target)) {
    return { ok: false, reason: 'combatant-missing' }
  }
  const currentTurnKey = dnd5eHeadlessTurnKey(snapshot.state, actorToken.id)
  const oncePerTurnKeys = featureAction.oncePerTurnKeys ??
    (grantedActivityDefinition?.requirements ?? []).flatMap((requirement) =>
      requirement.kind === 'once-per-turn' ? [requirement.key] : [])
  if (oncePerTurnKeys.some((key) =>
    actorCombatant.classState.declarativeUsedTurnKeys?.[key] === currentTurnKey ||
    input.turnEconomy?.usedOncePerTurnKeys?.includes(key))) {
    return { ok: false, reason: 'feature-already-used' }
  }
  if (grantedActivityDefinition) {
    const actorSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(actorCombatant, actorCombatant)
    const targetSnapshots = targetCombatants.map((target) =>
      dnd5eActivityActorSnapshotFromCombatantV1(target!, actorCombatant))
    if (!dnd5eActivityRootRequirementsSatisfiedV1({
      activity: grantedActivityDefinition,
      actor: actorSnapshot,
      targets: targetSnapshots,
      combatants: Object.values(snapshot.state.combatants).map((combatant) =>
        dnd5eActivityActorSnapshotFromCombatantV1(combatant, actorCombatant)),
      castLevel: persistentAreaGrant?.area.slotLevel ?? activeEffectGrant?.source.spellLevel,
      rolls: {},
      choices: activityChoices,
      distanceFeetByTargetId: Object.fromEntries(targetSnapshots.map((target) => [
        target.id,
        target.id === actorSnapshot.id ? 0 : distanceFeetByTargetId[target.id] ?? distanceFeet,
      ])),
      areaPlacement: activityAreaPlacement,
      areaPlacementDistanceFeet: distanceFeet,
      usedTurnKeys: new Set(oncePerTurnKeys.filter((key) =>
        actorCombatant.classState.declarativeUsedTurnKeys?.[key] === currentTurnKey ||
        input.turnEconomy?.usedOncePerTurnKeys?.includes(key))),
    })) return { ok: false, reason: 'feature-unavailable' }
  }
  // A spell-granted follow-up Activity must retain the spell save DC captured
  // when its controller effect was created.  Character.saveDC is a legacy,
  // user-editable snapshot and can lag behind the live class-derived DC (for
  // example, a level-20 INT 20 Wizard may still carry saveDC 12).
  const grantedSpellSaveDc = persistentAreaGrant?.area.sourceSpellSaveDc ??
    ownedActiveEffectGrant?.source.spellSaveDc
  if (
    Number.isInteger(grantedSpellSaveDc) &&
    grantedSpellSaveDc! >= 1 &&
    grantedSpellSaveDc! <= 40
  ) {
    actorCombatant.saveDc = grantedSpellSaveDc!
  }
  if (targetCombatants.some((target) => target && target.currentHp <= 0)) return { ok: false, reason: 'invalid-target' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
    }
  }
  return {
    ok: true,
    prepared: {
      action,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      targetToken,
      targetTokens,
      targetCells,
      targetCell,
      areaTargetElevationFeet,
      feature,
      distanceFeet,
      headlessAction: {
        type: 'plugin',
        pluginId: feature.ownerPluginId,
        actionId: featureAction.id,
        transactionId: action.id,
        featureId: feature.id,
        modifierFeatureIds: payload.modifierFeatureIds
          ? [...new Set(payload.modifierFeatureIds)]
          : undefined,
        actorId: actorToken.id,
        targetId: targetTokens[0]?.id,
        targetIds: targetTokens.map((token) => token.id),
        targetCell,
        targetOrientation: action.targetOrientation,
        distanceFeet,
        activityAreaPlacement,
        activityAreaPlacementDistanceFeet: distanceFeet,
        castLevel: persistentAreaGrant?.area.slotLevel ?? activeEffectGrant?.source.spellLevel,
        payload: payload.payload,
        hostEntitlement: persistentAreaGrant
          ? { kind: 'persistent-area', areaId: persistentAreaGrant.area.id }
          : activeEffectGrant
            ? { kind: 'active-effect', effectId: activeEffectGrant.id }
          : undefined,
        hostDistanceFeetByTargetId: persistentAreaGrant
          ? distanceFeetByTargetId
          : undefined,
        hostWaiveActionEconomy: waiveActionEconomy || undefined,
      },
      persistentAreaGrant: persistentAreaGrant?.anchorCell
        ? {
            areaId: persistentAreaGrant.area.id,
            anchorCell: { ...persistentAreaGrant.anchorCell },
            activityId: featureAction.id,
            waiveActionEconomy,
          }
        : undefined,
    },
  }
}

const PLUGIN_FAILURE_REASONS = new Set<Dnd5eActionFailure>([
  'combat-ended',
  'stale-turn',
  'invalid-actor',
  'invalid-target',
  'action-unavailable',
  'reaction-unavailable',
  'bonus-action-unavailable',
  'class-resource-unavailable',
  'invalid-class-feature',
  'feature-already-used',
  'invalid-plugin-action',
  'invalid-monster-action',
  'insufficient-movement',
  'movement-boundary-save-failed',
  'invalid-dice',
])

function pluginFailure(reason: string): Dnd5eActionFailure {
  return PLUGIN_FAILURE_REASONS.has(reason as Dnd5eActionFailure)
    ? reason as Dnd5eActionFailure
    : 'invalid-plugin-action'
}

function pluginPersistentAreaVerticalSnapshot(input: {
  map: BattleMap
  anchorCell: GridCell
  baseElevationFeet?: number
  declaration?: Dnd5ePluginPersistentAreaVerticalDeclaration
}): Dnd5ePersistentAreaVerticalSnapshot | undefined {
  const { declaration } = input
  if (!declaration) return undefined
  if (declaration.mode === 'ground') return { mode: 'ground' }
  const gridSize = Math.max(1, input.map.gridSize)
  const anchorPoint = {
    x: (input.map.gridOffsetX ?? 0) + (input.anchorCell.col + 0.5) * gridSize,
    y: (input.map.gridOffsetY ?? 0) + (input.anchorCell.row + 0.5) * gridSize,
  }
  const requestedBaseElevationFeet = Number.isFinite(input.baseElevationFeet)
    ? Number(input.baseElevationFeet)
    : mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), anchorPoint)
  const baseElevationFeet = Math.max(-1_000, Math.min(10_000, Math.round(
    requestedBaseElevationFeet,
  )))
  return {
    mode: 'volume',
    baseElevationFeet,
    heightFeet: declaration.heightFeet,
  }
}

export async function resolvePreparedDnd5ePluginFeatureAction(input: {
  prepared: PreparedDnd5ePluginFeatureAction
  rolls?: Dnd5ePluginAction['rolls']
  /** Host-validated replacement for any untrusted player-supplied action payload. */
  authoritativePayload?: Dnd5ePluginAction['payload']
  interruptChoiceId?: string
  summonInitiativeD20?: number
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
}): Promise<{
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  summonedInitiativeEntries?: InitiativeEntry[]
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
}> {
  const summon = input.prepared.feature.action?.summon
  const summonPlan = summon && input.prepared.targetCell
    ? planDnd5eSummonedCreature({
        map: input.prepared.map,
        actorToken: input.prepared.actorToken,
        sourceCharacterId: input.prepared.actor.id,
        featureId: input.prepared.feature.id,
        pluginId: input.prepared.feature.ownerPluginId,
        actionId: input.prepared.action.id,
        round: input.prepared.action.round,
        targetCell: input.prepared.targetCell,
        initiativeD20: input.summonInitiativeD20 ?? 0,
        summon,
      })
    : undefined
  if (summon && (!summonPlan || !summonPlan.ok)) {
    return {
      result: {
        ok: false,
        state: input.prepared.state,
        events: [],
        reason: 'invalid-plugin-action',
      },
    }
  }
  const definition = dnd5ePluginHeadlessActionDefinition(
    input.prepared.headlessAction.pluginId,
    input.prepared.headlessAction.actionId,
  )
  const headlessAction: Dnd5ePluginAction = {
    ...input.prepared.headlessAction,
    payload: input.authoritativePayload ?? input.prepared.headlessAction.payload,
    rolls: input.rolls,
    interruptChoiceId: input.interruptChoiceId,
    attackDecoyRolls: input.attackDecoyRolls,
  }
  let result: Dnd5eActionResult
  let airborneFalls: readonly Dnd5eAirborneFallPreview[] | undefined
  if (definition?.execution === 'worker') {
    const actor = input.prepared.state.combatants[headlessAction.actorId]
    const target = headlessAction.targetId
      ? input.prepared.state.combatants[headlessAction.targetId]
      : undefined
    const targets = (headlessAction.targetIds ?? (target ? [target.id] : []))
      .flatMap((targetId) => input.prepared.state.combatants[targetId] ? [input.prepared.state.combatants[targetId]] : [])
    if (!actor) {
      result = { ok: false, state: input.prepared.state, events: [], reason: 'invalid-actor' }
    } else {
      try {
        const sandbox = await resolveDnd5eSandboxedPluginAction({
          action: headlessAction,
          actor,
          target,
          targets,
        })
        if (sandbox.ok) {
          const sandboxResult = resolveDnd5eSandboxedPluginCapabilities(
            input.prepared.state,
            headlessAction,
            sandbox.operations,
            input.airborneFallDamageRollsByCombatantId,
          )
          result = sandboxResult
          airborneFalls = sandboxResult.airborneFalls
        } else {
          result = {
              ok: false,
              state: input.prepared.state,
              events: [],
              reason: pluginFailure(sandbox.reason),
            }
        }
      } catch {
        result = { ok: false, state: input.prepared.state, events: [], reason: 'invalid-plugin-action' }
      }
    }
  } else {
    const resolved = resolveDnd5eActionWithAirborneFallPreview(
      input.prepared.state,
      headlessAction,
      input.airborneFallDamageRollsByCombatantId,
    )
    result = resolved.result
    airborneFalls = resolved.airborneFalls
  }
  if (!result.ok) return { result, airborneFalls }
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: input.prepared.map,
    characters: input.prepared.characters,
    characterIdByCombatantId: input.prepared.characterIdByCombatantId,
    events: [...result.events],
  })
  const persistentArea = input.prepared.feature.action?.persistentArea
  if (persistentArea && input.prepared.targetCells.length > 0) {
    const id = `plugin-area:${input.prepared.action.id}`
    const targeting = input.prepared.feature.action!.targeting
    const vertical = pluginPersistentAreaVerticalSnapshot({
      map: application.map,
      anchorCell: input.prepared.targetCell ?? input.prepared.targetCells[0],
      baseElevationFeet: input.prepared.areaTargetElevationFeet,
      declaration: persistentArea.vertical,
    })
    const triggers = persistentArea.triggers?.map((trigger) => ({
      ...trigger,
      savingThrow: trigger.savingThrow
        ? {
            ...trigger.savingThrow,
            dc: trigger.savingThrow.dc === 'source-save-dc'
              ? Math.max(1, Math.min(40,
                  input.prepared.state.combatants[input.prepared.actorToken.id]?.saveDc ??
                  input.prepared.actor.saveDC,
                ))
              : trigger.savingThrow.dc,
          }
        : undefined,
      damage: trigger.damage ? { ...trigger.damage } : undefined,
      condition: trigger.condition
        ? { ...trigger.condition, duration: { ...trigger.condition.duration } }
        : undefined,
    }))
    application.map = {
      ...application.map,
      dnd5ePluginAreas: [
        ...(application.map.dnd5ePluginAreas ?? []).filter((area) => area.id !== id),
        {
          id,
          pluginId: input.prepared.feature.ownerPluginId,
          featureId: input.prepared.feature.id,
          label: persistentArea.label,
          color: persistentArea.color ?? '#8b5cf6',
          sourceCharacterId: input.prepared.actor.id,
          sourceTokenId: input.prepared.actorToken.id,
          cells: input.prepared.targetCells.map((cell) => ({ ...cell })),
          vertical,
          createdRound: input.prepared.action.round,
          expiresAfterRound: input.prepared.action.round + persistentArea.durationRounds - 1,
          concentrationId: persistentArea.concentration ? `plugin-area:${input.prepared.action.id}` : undefined,
          relation: targeting.kind === 'area' ? targeting.relation ?? 'any' : 'any',
          includeSelf: targeting.kind === 'area' && targeting.includeSelf === true,
          visual: persistentArea.visual ? { ...persistentArea.visual } : undefined,
          triggers: triggers && triggers.length > 0 ? triggers : undefined,
        },
      ],
    }
  }
  if (summonPlan?.ok) {
    application.map = {
      ...application.map,
      tokens: [
        ...application.map.tokens.filter((token) => token.id !== summonPlan.plan.token.id),
        summonPlan.plan.token,
      ],
    }
    application.changedTokenIds = [
      ...new Set([...application.changedTokenIds, summonPlan.plan.token.id]),
    ]
  }
  return {
    result,
    application,
    airborneFalls,
    summonedInitiativeEntries: summonPlan?.ok ? [summonPlan.plan.initiativeEntry] : undefined,
  }
}
