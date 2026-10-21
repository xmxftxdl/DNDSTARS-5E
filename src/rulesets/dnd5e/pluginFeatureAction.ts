import { dnd5eCreatureSeenRecently, dnd5eSightingWorldMinute } from './recentCreatureSightings'
import { observeDnd5eLongCasting, invalidateDnd5eLongCasting, type Dnd5eLongCastingReceipt } from './longCastingContinuity'
import { prepareDnd5eEquipmentAttackReplacement, resolvePreparedDnd5eEquipmentAttackReplacement } from './activities/dnd5eEquipmentAttackReplacement'
import type { PreparedDnd5eEquipmentAttack } from './equipmentAttackAction'
import {dnd5eAttackActionSlot} from './attackActionSlot'
import { dnd5eOrdinaryAttacksUsed } from './attackActionHistory'
import { prepareDnd5eAttackTeleportDestination } from './attackTeleportDestination'
import { resolveDnd5eAttackTeleportLanding, attackTeleportArrivalConsumedAction, type Dnd5eAttackTeleportArrival } from './attackTeleportLanding'
import {dnd5eFirstOwnTurnWeaponAttackFeature, dnd5eDistinctTargetBonusAttackFeatures} from './headlessCombatEngine'
import {dnd5eEffectiveAttacksPerAttackAction} from './pluginApi'
import {resolveRegisteredDnd5eActivityInCombatV1} from './activities/dnd5eActivityCombatAuthority'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { dnd5ePersistentAreaLooseRocks } from './persistentAreaObjectOrigin'
import { dnd5eOwnsPersistentArea } from './persistentAreaOwnership'
import {clippedPrismDistanceToBox} from '../../../shared/clipped-prism-origin.mjs'
import { moveDnd5eCoreSpellArea } from './coreSpellAreas'
import { resolveRemoteAreaDismissal } from './remoteAreaDismissal'
import { dnd5eAreaInitialActivationAvailable } from './persistentAreaInitialActivation'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5eActivityGrantChargeAvailable } from './activities/dnd5eActivityEntitlements'
import { createDnd5eMapHostilityView } from './mapPerceivedHostility'
import { bindDnd5eGrantedAreaEffects } from './bindGrantedAreaEffects'
import { dnd5eActivityEffectOriginId } from './activities/dnd5eActivityEffectOrigin'
import { dnd5eAttackableMapObject } from './mapObjectCombatProfile'
import { persistentAreaMovementScope } from './persistentAreaMovementScope'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { planDnd5eMapObjectFlightAtAnchor } from './mapObjectFlight'
import { dnd5eAreaTargetSelectionValid } from './activities/dnd5eAreaTargetSelection'
import { dnd5eActivityWithTargetChoicesV1 } from './activities/dnd5eActivityChoices'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { resolveDnd5eInventoryExchangePluginAction } from './inventoryExchangePluginAction'
import { resolveDnd5ePersistentAreaTriggerSourceDc, type Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { scaleDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityScaling'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { settleDnd5eActivityInventoryAlterations } from './activities/dnd5eActivityInventorySettlement'
import type { Dnd5eReactionMaterialChange } from './damageReactionMaterialLedger'
import { mergeDnd5eReactionMaterialsIntoMapPlan } from './damageReactionMaterialApplication'
import { dnd5eAreaPlacementMatchesSurface, resolveSpellAreaObstruction } from './spellAreaObstruction'
import { dnd5eActivityPointVisible } from './activityPointVisibility'
import {
  DND_FEET_PER_CELL,
  cellDistance,
  cellToPixel,
  pixelToCell,
  tokenOccupiedCellsAt,
  tokenFootprintDistanceCells,
  tokenFootprintCells,
  type GridCell,
} from '../../lib/gridCombat'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  mapGeometryLineOfEffectBlocked,
} from '../../lib/mapGeometry'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells } from '../../lib/skillTargeting'
import type {
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type { BattleMap, Token, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { resolveDnd5eActivityInvocationV1 } from './activities/dnd5eActivityInvocation'
import { settleDnd5eRestActivityV1 } from './activities/dnd5eRestActivitySettlement'
import { prepareDnd5eRestActivityCastingV1 } from './activities/dnd5eRestActivityCasting'
import { dnd5eFeatureActivityControls } from './activities/dnd5eFeatureActivityControls'
import {
  normalizeDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeaturesAvailableForCharacter,
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
  dnd5ePersistentDetectionReports,
  dnd5eCombatantPairKey,
  dnd5eDirectedCombatantPairKey,
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
  dnd5eMapTokenDistanceFeet,
  dnd5eInstantAoeAffectsTokenVertically,
  dnd5eTokenToPointDistanceFeet,
  dnd5eTokenHeightFeet,
  dnd5eVerticalIntervalDistanceFeet,
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
  attackTeleportPrelude?: {
    originalState: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    events: import('./headlessCombatEngine').Dnd5eCombatEvent[]
  }
  attackActionTeleport?: {
    preparationInput: Parameters<typeof prepareDnd5ePluginFeatureAction>[0]
    featureId: string
    originalState: Dnd5eHeadlessCombatState
    from: { x: number; y: number }
    fromElevationFeet: number
    distanceFeet: number
    worldMinute?: number
  }
  featureAttackBudget?: Parameters<typeof dnd5eAttackActionSlot>[0]
  featureAttackNumber?: number
  distinctTargetBonusAttackFeatureId?: string
  equipmentAttackReplacement?: PreparedDnd5eEquipmentAttack
  movementScope?: ReturnType<typeof persistentAreaMovementScope>
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetToken: Token
  targetTokens: Token[]
  automaticCreatureTargets?: true
  selectableAreaTargets?: true
  targetCells: GridCell[]
  targetCell?: GridCell
  areaTargetElevationFeet?: number
  feature: RegisteredDnd5ePluginFeature
  distanceFeet: number
  headlessAction: Dnd5ePluginAction
  /** Map entity that granted this otherwise unowned Activity control. */
  persistentAreaGrant?: {
    mapId?: string
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
  /** Explicit removals produced by the Host map handoff, never inferred from omissions. */
  removedTokenIds?: readonly string[]
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

  const removedTokenIds = new Set(input.removedTokenIds ?? [])
  for (const tokenId of removedTokenIds) {
    const base = baseTokens.get(tokenId)
    const latest = latestTokens.get(tokenId)
    if (!base || !latest || resultTokens.has(tokenId) || !sameSnapshot(base, latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    latestTokens.delete(tokenId)
  }
  for (const tokenId of changedTokenIds) {
    if (removedTokenIds.has(tokenId)) continue
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
      // The commit adapter protects character-sheet state unless the Host
      // explicitly patched it. Dropping these deltas loses rest receipts.
      tokenPatches: input.application.tokenPatches,
      characterPatches: input.application.characterPatches,
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
  roomMaps?: readonly BattleMap[]
  round: number
  worldMinute?: number
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
  const areaMapId = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.persistentAreaMapId === 'string'
    ? raw.persistentAreaMapId : input.map.id
  if(areaMapId!==input.map.id) {
    const activity=getRegisteredDnd5eActivity(input.feature.ownerPluginId,input.feature.action.id)
    const remote=activity&&resolveRemoteAreaDismissal({maps:input.roomMaps??[],actor:input.actorToken,actorMapId:input.map.id,
      areaMapId,areaId,packageId:input.feature.ownerPluginId,activity,worldMinute:input.worldMinute})
    return remote?.area.cells.length ? {area:remote.area,mapId:remote.map.id,anchorCell:remote.area.anchorCell??remote.area.cells[0]} : undefined
  }
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
  if (
    !area || area.cells.length === 0 || !dnd5eOwnsPersistentArea(area, input.actorToken) ||
    (!area.permanent && (area.expiresAtWorldMinute != null && input.worldMinute != null
      ? input.worldMinute >= area.expiresAtWorldMinute
      : input.round > area.expiresAfterRound)) ||
    area.pluginId !== input.feature.ownerPluginId ||
    !area.grantedActivities?.some((grant) => grant.activityId === input.feature.action!.id)
  ) return undefined
  return {
    area,
    mapId: input.map.id,
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
  const activity = getRegisteredDnd5eActivity(input.feature.ownerPluginId, input.feature.action.id)
  return normalizeDnd5eActiveEffects(input.activeEffects).find((effect) =>
    effect.id === effectId &&
    (!activity || dnd5eActivityGrantChargeAvailable(effect, activity)) &&
    !effect.suspendedBy?.length &&
    (effect.grantedActivityCharges == null || effect.grantedActivityCharges.current > 0) &&
    (effect.source.pluginId ?? (effect.source.kind === 'spell'
      ? DND5E_SRD_AUDITED_SPELL_PACKAGE_ID
      : undefined)) === input.feature.ownerPluginId &&
    effect.grantedActivities?.includes(input.feature.action!.id))
}

function persistentAreaDistanceFeet(input: {
  map: BattleMap
  area?: Dnd5ePluginArea
  areaCells: readonly GridCell[]
  centerCell?: GridCell
  centerVertical?: Dnd5ePersistentAreaVerticalSnapshot
  target: Token
}): number {
  const targetCells = tokenOccupiedCellsAt(input.target, input.map, input.target)
  const cells = input.centerCell ? [input.centerCell] : input.areaCells.length > 0 ? input.areaCells : [{ col: 0, row: 0 }]
  const horizontalDistanceFeet = Math.min(...cells.flatMap((areaCell) => targetCells.map((targetCell) =>
    cellDistance(areaCell, targetCell),
  ))) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  if (!input.centerCell && input.area && (input.area.rectGeometry?.pitchDegrees || input.area.rectGeometry?.rollDegrees)) {
    const half=tokenFootprintCells(input.target)*input.map.gridSize/2
    const bottom=mapGeometryTokenElevation(geometry,input.target)
    return clippedPrismDistanceToBox(input.map,input.area,
      {x:input.target.x-half,y:input.target.y-half,elevationFeet:bottom},
      {x:input.target.x+half,y:input.target.y+half,elevationFeet:bottom+dnd5eTokenHeightFeet(input.target)})
  }
  const vertical = input.centerVertical
  if (!input.centerCell) {
    const targetBottom = mapGeometryTokenElevation(geometry, input.target)
    return Math.min(...cells.map(areaCell => {
      const horizontal = Math.min(...targetCells.map(targetCell => cellDistance(areaCell, targetCell))) *
        Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      const bottom = vertical?.mode === 'volume' ? vertical.baseElevationFeet :
        mapGeometryTerrainElevationAtPoint(geometry, cellToPixel(areaCell, input.map))
      const height = vertical?.mode === 'volume' ? vertical.heightFeet : 0
      return Math.max(horizontal, dnd5eVerticalIntervalDistanceFeet(bottom, height,
        targetBottom, dnd5eTokenHeightFeet(input.target)))
    }))
  }
  const pointElevationFeet = vertical?.mode === 'volume'
    ? vertical.baseElevationFeet + (vertical.shape === 'sphere' ? vertical.heightFeet / 2 : 0)
    : mapGeometryTerrainElevationAtPoint(geometry, cellToPixel(input.centerCell, input.map))
  return dnd5eTokenToPointDistanceFeet({ geometry, token: input.target, pointElevationFeet, horizontalDistanceFeet })
}

export function prepareDnd5ePluginFeatureAction(input: {
  roomMaps?: readonly BattleMap[]
  roomScenes?: readonly import('../../lib/sceneOrchestration').OrchestratedScene[]
  worldMinute?: number
  worldSecondRemainder?: number
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
  const requestedActivityId = payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)
    ? payload.payload.selectedActivityId : undefined
  if (requestedActivityId != null) {
    const selected = typeof requestedActivityId === 'string'
      ? dnd5eFeatureActivityControls(feature).find(control => control.activity.id === requestedActivityId)
      : undefined
    if (!selected || !dnd5ePluginHeadlessActionDefinition(feature.ownerPluginId, selected.activity.id)) {
      return { ok: false, reason: 'feature-unavailable' }
    }
    feature = { ...feature, action: selected.action, automation:selected.activity.automation.level==='full'?'full':'partial',
      ...(feature.action?.id !== selected.action.id ? {declarativeAbility:undefined} : {}) }
  }
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
  const grantedActivityDefinition = requestedActivityId != null
    ? getRegisteredDnd5eActivity(feature.ownerPluginId, feature.action.id)
    : dnd5ePluginGrantedActivityDefinitionV1(feature.id)
  if (
    feature.action.interrupt && grantedActivityDefinition && activityChoices &&
    dnd5eActivityManualAdjudicationOperationsV1(grantedActivityDefinition, activityChoices).length === 0
  ) {
    const { interrupt: _unusedInterrupt, ...actionWithoutInterrupt } = feature.action
    feature = { ...feature, action: actionWithoutInterrupt }
  }
  let featureAction = feature.action
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
  // sufficient for an action granted by that token's authoritative Effect or area;
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
  const targetingActivity = grantedActivityDefinition ?? getRegisteredDnd5eActivity(feature.ownerPluginId, featureAction.id)
  const earlySnapshot = targetingActivity?.scaling?.length ? createDnd5eMapCombatSnapshot({
    roomMaps: input.roomMaps,
    roomScenes: input.roomScenes,
    worldSecondRemainder: input.worldSecondRemainder,
    worldMinute: input.worldMinute,
    combatId: action.combatId ?? `map-${input.map.id}`, round: action.round,
    turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
    map: input.map, characters: input.characters, initiativeOrder: input.initiativeOrder,
    additionalCreatureTokenIds: input.map.tokens.filter(token => token.type !== 'obstacle').map(token => token.id),
  }) : undefined
  const scalingActor = earlySnapshot?.state.combatants[actorToken.id]
  const scaledFeatureActivity = targetingActivity ? dnd5eActivityWithTargetChoicesV1(scalingActor
    ? scaleDnd5eActivityDefinitionV1(targetingActivity, { actor: scalingActor }).activity : targetingActivity, activityChoices) : undefined
  const projectedAction = scaledFeatureActivity && (targetingActivity?.scaling?.length || targetingActivity?.choices?.length)
    ? dnd5ePluginFeatureActionFromActivityV1(scaledFeatureActivity) : undefined
  if (projectedAction) {
    featureAction = { ...featureAction, targeting: projectedAction.targeting }
    feature = { ...feature, action: featureAction }
  }
  if (payload.attackActionTeleport) {
    const teleportFeature = linkedActor && dnd5ePluginFeaturesAvailableForCharacter(linkedActor).find(candidate =>
      candidate.automation === 'full' && candidate.declarativeAbility?.mechanic?.kind === 'attack-action-teleport' &&
      dnd5eCharacterHasPluginFeature(linkedActor, candidate.id))
    const mechanic = teleportFeature?.declarativeAbility?.mechanic
    // Save-only replacements do not make an attack, even when they consume an attack slot.
    if (!teleportFeature || mechanic?.kind !== 'attack-action-teleport' ||
      !action.combatId || input.initiativeOrder[action.initiativeIndex]?.tokenId !== actorToken.id ||
      !scaledFeatureActivity?.usesAttackActionAttack ||
      !scaledFeatureActivity.checks?.some(check => check.kind === 'attack-roll'))
      return { ok: false, reason: 'feature-unavailable' }
    const destination = prepareDnd5eAttackTeleportDestination({
      map: input.map, actorTokenId: actorToken.id, characters: input.characters,
      targetCell: payload.attackActionTeleport.targetCell,
      targetElevationFeet: payload.attackActionTeleport.elevationFeet,
      rangeFeet: mechanic.rangeFeet, worldMinute: input.worldMinute,
    })
    if (!destination.ok) return { ok: false, reason: 'invalid-target' }
    const movedMap = { ...input.map, tokens: input.map.tokens.map(token => token.id === actorToken.id
      ? { ...token, ...destination.to, elevationFeet: destination.elevationFeet } : token) }
    const ready = prepareDnd5ePluginFeatureAction({ ...input, map: movedMap,
      action: { ...action, dnd5ePluginAction: { ...payload, attackActionTeleport: undefined } } })
    if (!ready.ok) return ready
    if (!ready.prepared.featureAttackBudget) return { ok: false, reason: 'feature-unavailable' }
    const original = createDnd5eMapCombatSnapshot({
      roomMaps: input.roomMaps, roomScenes: input.roomScenes,
      worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder,
      combatId: action.combatId, round: action.round,
      turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
      map: input.map, characters: input.characters, initiativeOrder: input.initiativeOrder,
      additionalCreatureTokenIds: input.map.tokens.filter(token => token.type !== 'obstacle').map(token => token.id),
    })
    return { ok: true, prepared: { ...ready.prepared, action, map: input.map,
      attackActionTeleport: { preparationInput: input, featureId: teleportFeature.id, originalState: original.state,
        from: { x: actorToken.x, y: actorToken.y },
        fromElevationFeet: original.state.combatants[actorToken.id]?.elevationFeet ?? 0,
        distanceFeet: destination.distanceFeet, worldMinute: input.worldMinute } } }
  }
  const persistentAreaGrant = persistentAreaGrantForAction({
    map: input.map,
    roomMaps: input.roomMaps,
    round: action.round,
    worldMinute: input.worldMinute,
    actorToken,
    feature,
    payload,
  })
  const creatureTarget = scaledFeatureActivity?.target.kind === 'creature' ? scaledFeatureActivity.target : undefined
  if ((creatureTarget?.requiresInsideGrantingArea || creatureTarget?.mappedObjectOrigin) && !persistentAreaGrant) return { ok: false, reason: 'feature-unavailable' }
  if (creatureTarget?.mappedObjectOrigin && persistentAreaGrant) {
    const raw = payload.payload
    const objectId = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.mappedObjectOriginTokenId : undefined
    if (typeof objectId !== 'string' || !dnd5ePersistentAreaLooseRocks(input.map, persistentAreaGrant.area).some(token => token.id === objectId)) {
      return { ok: false, reason: 'invalid-target' }
    }
  }
  const usesGrantCenter = scaledFeatureActivity?.target.kind === 'creature' && scaledFeatureActivity.target.rangeOrigin === 'granting-area'
  if (usesGrantCenter && !persistentAreaGrant) return { ok: false, reason: 'feature-unavailable' }
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
  const objectLaunch = scaledFeatureActivity?.outcomes.flatMap(outcome => outcome.operations)
    .find(operation => operation.kind === 'launch-map-object')
  if (action.objectLaunchPitchDegrees != null && (!objectLaunch || !Number.isFinite(action.objectLaunchPitchDegrees) ||
    action.objectLaunchPitchDegrees < -90 || action.objectLaunchPitchDegrees > 90)) return { ok: false, reason: 'invalid-target' }
  if (!persistentAreaGrant && !activeEffectGrant && !dnd5eCharacterHasPluginFeature(actor, feature.id)) {
    return { ok: false, reason: feature.grantedBySubclass ? 'feature-unavailable' : 'feature-not-selected' }
  }
  const grantedActivity = persistentAreaGrant?.area.grantedActivities?.find((grant) =>
    grant.activityId === featureAction.id,
  )
  const waiveActionEconomy = !!grantedActivity && !!persistentAreaGrant &&
    dnd5eAreaInitialActivationAvailable(input.map.id, persistentAreaGrant.area, grantedActivity, {
      combatId: action.combatId, round: action.round, turnKey: input.turnEconomy?.turnKey,
      worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder,
    })
  const movementReceipt = persistentAreaGrant?.area.movementContinuation
  const movementScope = persistentAreaMovementScope({ mapId: input.map.id, actorId: actorToken.id,
    combatId: action.combatId, round: action.round, turnKey: input.turnEconomy?.turnKey,
    worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder })
  const sameMovementScope = movementReceipt && movementScope && movementReceipt.combatId === movementScope.combatId &&
    movementReceipt.round === movementScope.round && movementReceipt.turnKey === movementScope.turnKey
  const retainsMovement = scaledFeatureActivity?.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'relocate-granting-area' && operation.retainMovementBudget === true))
  if (retainsMovement && !action.combatId && !movementScope) return { ok: false, reason: 'invalid-target' }
  if (sameMovementScope && retainsMovement && movementReceipt.pendingActivityId !== scaledFeatureActivity?.id) {
    return { ok: false, reason: 'bonus-action-unavailable' }
  }
  const movementContinuationAvailable = !!(movementReceipt?.pendingActivityId && scaledFeatureActivity && sameMovementScope &&
      movementReceipt.pendingActivityId === scaledFeatureActivity?.id &&
      scaledFeatureActivity.activation.kind === 'bonus-action' && scaledFeatureActivity.outcomes.some(outcome =>
        outcome.operations.some(operation => operation.kind === 'relocate-granting-area' && operation.retainMovementBudget === true)))
  const economyFailure = waiveActionEconomy || movementContinuationAvailable
    ? undefined
    : economyRejectReason(featureAction.economy, input.turnEconomy)
  if (economyFailure) return { ok: false, reason: economyFailure }

  const perceivesHostile = createDnd5eMapHostilityView({ ...input, actorToken, combatId: action.combatId ?? `map-${input.map.id}`, round: action.round })
  let automaticCreatureTargets = false
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
    if (!targetToken || targetToken.type === 'obstacle' && !(featureAction.targeting.allowObjectAttack && dnd5eAttackableMapObject(targetToken))) return { ok: false, reason: 'invalid-target' }
    if (targetToken.id === actorToken.id && featureAction.targeting.includeSelf !== true) {
      return { ok: false, reason: 'invalid-target' }
    }
    const opposed = perceivesHostile(targetToken)
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
          area: persistentAreaGrant.area,
          centerCell: usesGrantCenter ? persistentAreaGrant.anchorCell : undefined,
          centerVertical: persistentAreaGrant.area.vertical,
          target: targetToken,
        })
      : dnd5eMapTokenDistanceFeet({ map: input.map,
          geometry: mapGeometryRuntimeForMap(input.map.id), left: actorToken, right: targetToken })
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
    const mandatorySplash = grantedActivityDefinition?.requiresContinuationFrom
      ? Object.values(linkedActor?.dnd5eCombatState?.activityContinuations ?? actorToken.dnd5eCombatState?.activityContinuations ?? {}).find(pending => pending.nextActivityId === grantedActivityDefinition.id && pending.requireAllTargetsInRadius)
      : undefined
    automaticCreatureTargets = mandatorySplash != null
    const splashCenters = mandatorySplash?.previousTargetIds.flatMap(id => input.map.tokens.filter(token => token.id === id)) ?? []
    const uniqueIds = mandatorySplash
      ? input.map.tokens.filter(token => token.type !== 'obstacle' && (token.characterId ? input.characters.find(character => character.id === token.characterId)?.currentHp ?? token.hp ?? 0 : token.hp ?? token.maxHp ?? 0) > 0 && splashCenters.some(center => tokenFootprintDistanceCells(center, token, input.map) * Math.max(1, input.map.feetPerCell ?? 5) <= mandatorySplash.maximumDistanceFromPreviousTargetFeet!)).map(token => token.id)
      : [...new Set(action.targetTokenIds ?? [])]
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
      const opposed = perceivesHostile(token)
      if ((targeting.relation === 'ally' && opposed) || (targeting.relation === 'enemy' && !opposed)) {
        return { ok: false, reason: 'invalid-target' }
      }
      const targetDistanceFeet = persistentAreaGrant
        ? persistentAreaDistanceFeet({
            map: input.map,
            areaCells: persistentAreaGrant.area.cells,
            area: persistentAreaGrant.area,
          centerCell: usesGrantCenter ? persistentAreaGrant.anchorCell : undefined,
          centerVertical: persistentAreaGrant.area.vertical,
            target: token,
          })
        : dnd5eMapTokenDistanceFeet({ map: input.map,
            geometry: mapGeometryRuntimeForMap(input.map.id), left: actorToken, right: token })
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
    const activityAreaTarget = scaledFeatureActivity?.target.kind === 'area'
      ? scaledFeatureActivity.target : undefined
    const grantDefinesRange = activityAreaTarget?.rangeOrigin === 'granting-area' ||
      (!grantedActivityDefinition && !!persistentAreaGrant)
    if (grantDefinesRange && !persistentAreaGrant) return { ok: false, reason: 'feature-unavailable' }
    const casterCell = grantDefinesRange ? persistentAreaGrant!.anchorCell : pixelToCell(actorToken.x, actorToken.y, input.map)
    targetCell = action.targetCell ?? (targeting.template.shape === 'circle' && targeting.template.origin === 'self'
      ? casterCell
      : undefined)
    if (!targetCell || !canPlaceAoe(targeting.template, casterCell, targetCell)) {
      return { ok: false, reason: 'target-out-of-range' }
    }
    const targetOrientation = action.targetOrientation
    const targetAngleDegrees = action.targetAngleDegrees
    if (targetAngleDegrees != null && (
      !Number.isFinite(targetAngleDegrees) || targetAngleDegrees < 0 || targetAngleDegrees >= 360 ||
      (targeting.template.shape !== 'rect' && !(targeting.template.shape === 'cone' && targeting.template.origin === 'point')) || !targeting.template.rotatable
    )) return { ok: false, reason: 'invalid-target' }
    if (
      targetOrientation != null &&
      (!Number.isInteger(targetOrientation) || targetOrientation < 0 || targetOrientation > 3)
    ) return { ok: false, reason: 'invalid-target' }
    const orientFrom = aoeOrientFromCell(targeting.template, casterCell, targetCell, {
      rectRotation: targetOrientation,
      rectAngleDegrees: targetAngleDegrees,
    })
    const objectFlight = objectLaunch ? planDnd5eMapObjectFlightAtAnchor({
      map: input.map, geometry, anchorCell: targetCell, angleDegrees: targetAngleDegrees ?? (targetOrientation ?? 0) * 90,
      pitchDegrees: action.objectLaunchPitchDegrees,
      slotLevel: persistentAreaGrant?.area.slotLevel ?? activeEffectGrant?.source.spellLevel ?? objectLaunch.limits.baseSlotLevel,
      limits: objectLaunch.limits,
    }) : undefined
    if (objectFlight && !objectFlight.ok) return { ok: false, reason: 'invalid-target' }
    const cells = cellsForAoe(targeting.template, orientFrom, targetCell)
    targetCells = cells
    const effectAim = {
      x: input.map.gridOffsetX + (targetCell.col + 0.5) * input.map.gridSize,
      y: input.map.gridOffsetY + (targetCell.row + 0.5) * input.map.gridSize,
    }
    const grantedOrigin = grantDefinesRange
      ? cellToPixel(persistentAreaGrant!.anchorCell, input.map)
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
    const grantedSphere = persistentAreaGrant?.area
    const sphereRelocation = grantedSphere?.vertical?.mode === 'volume' && grantedSphere.vertical.shape === 'sphere' &&
      grantedSphere.movement?.carryRestrainedTargets && scaledFeatureActivity?.outcomes.some(outcome=>
        outcome.operations.some(operation=>operation.kind==='relocate-granting-area'))
      ? moveDnd5eCoreSpellArea({map:input.map,geometry,areaId:grantedSphere.id,sourceTokenId:actorToken.id,
          round:action.round,targetCell,targetElevationFeet:action.targetElevationFeet == null ? undefined : action.targetElevationFeet-grantedSphere.vertical.heightFeet/2})
      : undefined
    if(sphereRelocation && !sphereRelocation.ok)return {ok:false,reason:'invalid-target'}
    const sphereCenter = sphereRelocation?.ok && sphereRelocation.area.vertical?.mode==='volume'
      ? sphereRelocation.area.vertical.baseElevationFeet+sphereRelocation.area.vertical.heightFeet/2 : undefined
    const effectAimElevationFeet = sphereCenter ?? (objectFlight?.ok
      ? mapGeometryTokenElevation(geometry, input.map.tokens.find(token => token.id === objectFlight.plan.objectId)!)
      : action.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, effectAim))
    areaTargetElevationFeet = targeting.template.origin === 'point'
      ? effectAimElevationFeet
      : mapGeometryTokenElevation(geometry, actorToken)
    const anchor = cellToPixel(targetCell, input.map)
    if (!dnd5eAreaPlacementMatchesSurface({ target: activityAreaTarget, geometry,
      point: effectAim, elevationFeet: areaTargetElevationFeet })) return { ok: false, reason: 'invalid-target' }
    if (activityAreaTarget && targeting.template.origin === 'point') {
      const ray = { geometry, map: input.map, from: actorToken, to: effectAim,
        fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken), toElevationFeet: areaTargetElevationFeet }
      if ((activityAreaTarget.requiresLineOfSight && !dnd5eActivityPointVisible({ map: input.map,
        worldMinute: input.worldMinute,
        viewer: actorToken, characters: input.characters, point: { ...effectAim, elevationFeet: areaTargetElevationFeet } })) ||
        (!activityAreaTarget.projectileImpact && activityAreaTarget.requiresLineOfEffect !== false && mapGeometryLineOfEffectBlocked(ray))) {
        return { ok: false, reason: 'invalid-target' }
      }
    }
    const activityUsesPlanarRectangle = activityAreaTarget != null && targeting.template.shape === 'rect'
    const angleDegrees = targeting.template.shape === 'cone' && targeting.template.origin === 'point'
      ? targetAngleDegrees ?? (targetOrientation ?? 0) * 90
      : targeting.template.shape === 'line' || targeting.template.shape === 'cone'
      ? Math.atan2(targetCell.row - casterCell.row, targetCell.col - casterCell.col) * 180 / Math.PI
      : targeting.template.shape === 'rect' && targeting.template.rotatable
         ? targetAngleDegrees ?? (targetOrientation ?? 0) * 90
        : undefined
    activityAreaPlacement = {
      x: anchor.x,
      y: anchor.y,
      elevationFeet: areaTargetElevationFeet,
      angleDegrees,
      objectLaunchPitchDegrees: action.objectLaunchPitchDegrees,
      radiusFeet: targeting.template.shape === 'circle' ? targeting.template.radiusFeet : undefined,
      lengthFeet: targeting.template.shape === 'line' || targeting.template.shape === 'cone'
        ? targeting.template.lengthFeet
        : activityUsesPlanarRectangle && activityAreaTarget.lengthFeet != null && targeting.template.shape === 'rect'
          ? targeting.template.heightFeet : undefined,
      widthFeet: targeting.template.shape === 'rect' || targeting.template.shape === 'line'
        ? targeting.template.widthFeet
        : undefined,
      heightFeet: activityAreaTarget ? activityAreaTarget.heightFeet
        : targeting.template.shape === 'rect' ? targeting.template.heightFeet : undefined,
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
      const horizontalDistanceFeet = grantDefinesRange
        ? cellDistance(casterCell, targetCell) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
        : tokenFootprintDistanceCells(
            actorToken,
            areaPointToken,
            input.map,
          ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      distanceFeet = horizontalDistanceFeet
      if (
        targeting.template.placeRangeFeet != null &&
        (grantDefinesRange
          ? horizontalDistanceFeet
          : dnd5eTokenToPointDistanceFeet({
              geometry,
              token: actorToken,
              pointElevationFeet: areaTargetElevationFeet,
              horizontalDistanceFeet,
            })) > targeting.template.placeRangeFeet + 1e-4
      ) return { ok: false, reason: 'target-out-of-range' }
    }
    const obstruction = activityAreaTarget ? resolveSpellAreaObstruction({
      spellId: scaledFeatureActivity?.authorityBinding?.kind === 'core-spell-transaction'
        ? scaledFeatureActivity.authorityBinding.spellId : undefined,
      map: input.map, geometry, cells, area: targeting.template,
      origin: effectOrigin, elevationFeet: areaTargetElevationFeet!,
      heightFeet: targeting.template.volumeHeightFeet,
      ignoresWalls: activityAreaTarget.requiresLineOfEffect === false,
      spreadsAroundCorners: activityAreaTarget.spreadsAroundCorners,
    }) : undefined
    if (obstruction) targetCells = obstruction.cells
    const perception = activityAreaTarget?.requiresVisibleTargets ? createDnd5eMapCombatSnapshot({
      combatId: `feature-area-perception:${input.map.id}`, map: input.map, characters: input.characters, worldMinute: input.worldMinute,
      initiativeOrder: input.map.tokens.filter(token => token.type !== 'obstacle').map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })),
    }).state : undefined
    targetTokens = tokensInCells(input.map, input.map.tokens, cells)
      .filter((token) => {
        if (token.type === 'obstacle') return false
        if (obstruction && !obstruction.affectsToken(token)) return false
        if (perception && !dnd5eCombatantCanSee(perception, actorToken.id, token.id)) return false
        if (token.id === actorToken.id && targeting.includeSelf !== true) return false
        const opposed = perceivesHostile(token)
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
          effectHeightFeet: activityAreaTarget && ['rect', 'cube', 'cylinder'].includes(activityAreaTarget.shape)
            ? activityAreaTarget.heightFeet : undefined,
          effectAim: targeting.template.shape === 'cone' && targeting.template.origin === 'point'
            ? cellToPixel({ col: 2 * targetCell!.col - orientFrom.col, row: 2 * targetCell!.row - orientFrom.row }, input.map) : effectAim,
          effectAimElevationFeet,
        })
      })
      .slice(0, activityAreaTarget?.selection === 'choose-any' ? undefined : activityAreaTarget ? activityAreaTarget.maximumTargets : targeting.maximumTargets)
    if (activityAreaTarget?.selection === 'choose-any') {
      if (!dnd5eAreaTargetSelectionValid(activityAreaTarget, targetTokens.map(token => token.id), action.targetTokenIds)) return { ok: false, reason: 'invalid-target' }
      const chosen = new Set(action.targetTokenIds)
      targetTokens = targetTokens.filter(token => chosen.has(token.id))
    }
    if (objectFlight?.ok) {
      // The selected cell identifies the object, not the creatures it will hit.
      // Resolve their order from the Host map, just as the spell entry point does.
      targetTokens = objectFlight.plan.creatures.map(contact => input.map.tokens.find(token => token.id === contact.tokenId)!)
    }
    if (activityAreaTarget?.projectileImpact && scaledFeatureActivity) {
      // Use the same Host placement resolver as triggered first/second launches.
      // The requested anchor was range-checked above; it is not the impact point.
      const impactSelection = resolveDnd5eActivityAreaMapSelectionV1({
        activity: scaledFeatureActivity, map: input.map, actorToken,
        characters: input.characters, worldMinute: input.worldMinute,
        anchorCell: targetCell, targetElevationFeet: action.targetElevationFeet,
      })
      if (!impactSelection) return { ok: false, reason: 'invalid-target' }
      activityAreaPlacement = impactSelection.areaPlacement
      areaTargetElevationFeet = impactSelection.areaPlacement.elevationFeet
      targetCells = [...impactSelection.cells]
      const ids = new Set(impactSelection.targetIds)
      targetTokens = input.map.tokens.filter(token => ids.has(token.id))
    }
    targetToken = targetTokens[0]
    const permitsEmptyArea = (
      objectLaunch != null ||
      (activityAreaTarget && (activityAreaTarget.minimumTargets ?? 0) === 0 &&
        scaledFeatureActivity?.outcomes.some(outcome => outcome.operations.some(operation =>
          operation.kind === 'damage' && operation.equipmentWeaponDamage))) ||
      (activityAreaTarget?.selection === 'choose-any' && (activityAreaTarget.minimumTargets ?? 0) === 0) ||
      scaledFeatureActivity?.outcomes.some(outcome => outcome.operations.some(operation =>
        operation.kind === 'affect-persistent-entity' || operation.kind === 'ignite-area-fuel' || operation.kind === 'extinguish-area-flames' || operation.kind === 'control-map-water' || operation.kind === 'create-persistent-area' || operation.kind === 'summon' || operation.kind === 'wither-map-vegetation')) ||
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

  if (scaledFeatureActivity?.target.kind === 'creature') {
    const targeting = scaledFeatureActivity.target
    if (!targeting.effectOrigin && targetTokens.some(token =>
      (distanceFeetByTargetId[token.id] ?? 0) < (targeting.minimumRangeFeet ?? 0))) {
      return { ok: false, reason: 'target-out-of-range' }
    }
    if (targeting.maximumTargetSeparationFeet != null) {
      for (let first = 0; first < targetTokens.length; first++) {
        for (let second = first + 1; second < targetTokens.length; second++) {
          if (dnd5eMapTokenDistanceFeet({ map: input.map,
            left: targetTokens[first]!, right: targetTokens[second]! }) > targeting.maximumTargetSeparationFeet) {
            return { ok: false, reason: 'target-out-of-range' }
          }
        }
      }
    }
  }

  const snapshot = (targetTokens.some(token => token.type === 'obstacle') ? undefined : earlySnapshot) ?? createDnd5eMapCombatSnapshot({
    roomMaps: input.roomMaps,
    roomScenes: input.roomScenes,
    worldSecondRemainder: input.worldSecondRemainder,
    objectAttackTargetIds: featureAction.targeting.kind === 'single-creature' && featureAction.targeting.allowObjectAttack ? targetTokens.filter(token => token.type === 'obstacle').map(token => token.id) : undefined,
    worldMinute: input.worldMinute,
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
    additionalCreatureTokenIds: (scaledFeatureActivity?.target.kind === 'creature' && scaledFeatureActivity.target.effectOrigin
      ? input.map.tokens : targetTokens).filter(token => token.type !== 'obstacle').map(token => token.id),
  })
  if (scaledFeatureActivity?.target.kind === 'creature') {
    const targeting = scaledFeatureActivity.target
    const origin = dnd5eActivityEffectOriginId(snapshot.state, actorToken.id, scaledFeatureActivity)
    if (!origin) return { ok: false, reason: 'invalid-target' }
    for (const target of targetTokens) {
      if (targeting.requiresSeenWithinSeconds != null && !dnd5eCreatureSeenRecently({
        history: snapshot.state.combatants[actorToken.id]?.classState.recentCreatureSightings,
        targetId: target.id, mapId: input.map.id, worldMinute: dnd5eSightingWorldMinute(input.worldMinute,input.worldSecondRemainder),
        maximumAgeSeconds: targeting.requiresSeenWithinSeconds,
        currentlyVisible: dnd5eCombatantCanSee(snapshot.state, actorToken.id, target.id),
      })) return { ok: false, reason: 'invalid-target' }
      if (targeting.effectOrigin) {
        const distance = target.id === origin ? 0 : snapshot.state.distanceFeetByCombatantPair?.[
          dnd5eCombatantPairKey(origin, target.id)]
        if (distance == null || distance < (targeting.minimumRangeFeet ?? 0) || distance > targeting.effectOrigin.rangeFeet) {
          return { ok: false, reason: 'target-out-of-range' }
        }
      }
      if ((targeting.requiresLineOfSight && !dnd5eCombatantCanSee(snapshot.state, actorToken.id, target.id)) ||
        (targeting.requiresTargetSeeActor && !dnd5eCombatantCanSee(snapshot.state, target.id, actorToken.id)) ||
        (targeting.requiresLineOfEffect && snapshot.state.lineOfEffectBlockedByCombatantPair?.[
          dnd5eDirectedCombatantPairKey(origin, target.id)])) {
        return { ok: false, reason: 'invalid-target' }
      }
    }
  }
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
  const damagesAreaCreatures = scaledFeatureActivity?.target.kind === 'area' &&
    scaledFeatureActivity.outcomes.some(outcome => outcome.operations.some(operation =>
      operation.kind === 'damage'))
  if (damagesAreaCreatures) {
    // Corpses are not creatures hit by a damaging area. An unconscious living
    // creature is still a target; do not use zero HP as a corpse predicate.
    targetTokens = targetTokens.filter(token => !snapshot.state.combatants[token.id]?.deathSaves.dead)
    targetToken = targetTokens[0] ?? actorToken
  }
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
  if (creatureTarget?.requiresInsideGrantingArea && (!persistentAreaGrant || targetTokens.some(token =>
    !dnd5eTokenIntersectsPersistentAreaAt(token, input.map, persistentAreaGrant.area, token)))) return { ok: false, reason: 'invalid-target' }
  if (grantedActivityDefinition) {
    const actorSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(actorCombatant, actorCombatant)
    const targetSnapshots = targetCombatants.map((target) =>
      dnd5eActivityActorSnapshotFromCombatantV1(target!, actorCombatant))
    if (!dnd5eActivityRootRequirementsSatisfiedV1({
      activity: grantedActivityDefinition,
      combatActive: Boolean(action.combatId?.trim()),
      currentTurnActorId: action.combatId?.trim() ? input.initiativeOrder[action.initiativeIndex]?.tokenId : undefined,
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
  // Maximum-HP transfers can restore current HP to an unconscious companion.
  // The transfer executor still rejects confirmed death and enforces its bond.
  const restoresTransferredHp = scaledFeatureActivity?.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'transfer-hit-point-maximum' && operation.target === 'target' && operation.increaseCurrentHp === true))
  if (targetCombatants.some(target => target && target.currentHp <= 0 &&
    (!(restoresTransferredHp || damagesAreaCreatures) || target.deathSaves.dead))) return { ok: false, reason: 'invalid-target' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
    }
  }
  if (movementContinuationAvailable) {
    if (distanceFeet > movementReceipt!.remainingFeet) return { ok: false, reason: 'target-out-of-range' }
    actorCombatant.turn.bonusActionAvailable = true
  }
  let equipmentAttackReplacement: PreparedDnd5eEquipmentAttack | undefined
  const featureAttackBudget = targetingActivity?.usesAttackActionAttack ? {
    attacksPerAction:dnd5eEffectiveAttacksPerAttackAction(actor, !action.combatId || input.initiativeOrder[action.initiativeIndex]?.tokenId === actorToken.id),
    actionCount:input.turnEconomy?.action.max ?? 1,
    attacksUsed:dnd5eOrdinaryAttacksUsed(actorCombatant.classState.attackActionHistory,
      input.turnEconomy?.turnKey, input.turnEconomy?.attacksUsed ?? 0),
    extraWeaponAttacksPerAction: action.combatId &&
      dnd5eFirstOwnTurnWeaponAttackFeature({ ...snapshot.state, initiativeIndex: actorIndex }, actorToken.id) ? 1 : 0,
    attackKind: 'replacement' as const,
  } : undefined
  let distinctTargetBonusAttackFeatureId: string | undefined
  if (featureAttackBudget) {
    const slot = dnd5eAttackActionSlot(featureAttackBudget)
    if (Number.isSafeInteger(featureAttackBudget.attacksUsed) && (!slot || slot.spendsAction) &&
      targetingActivity?.target.kind === 'creature' && targetTokens.length === 1 &&
      targetingActivity.checks?.some(check => check.kind === 'attack-roll')) {
      distinctTargetBonusAttackFeatureId = dnd5eDistinctTargetBonusAttackFeatures(
        { ...snapshot.state, initiativeIndex: actorIndex }, actorToken.id, targetTokens[0].id)[0]?.id
    }
    if ((!slot && !distinctTargetBonusAttackFeatureId) ||
      (action.combatId && input.initiativeOrder[action.initiativeIndex]?.tokenId !== actorToken.id) ||
      (slot?.spendsAction && !distinctTargetBonusAttackFeatureId && input.turnEconomy && input.turnEconomy.action.current < 1))
      return {ok:false,reason:'action-unavailable'}
  }
  if (targetingActivity?.outcomes.some(outcome => outcome.operations.some(op => op.kind === 'damage' && op.equipmentWeaponDamage))) {
    const equipment = prepareDnd5eEquipmentAttackReplacement({ packageId: feature.ownerPluginId,
      activityId: featureAction.id, areaAimCell: targetCell,
      attack: { worldSecondRemainder: input.worldSecondRemainder, worldMinute: input.worldMinute, action: { ...action, type: 'dnd5e-weapon-attack', targetTokenId: targetTokens[0]?.id ?? targetToken.id },
        map: input.map, characters: input.characters, initiativeOrder: input.initiativeOrder,
        turnEconomy: input.turnEconomy, attacksUsed: input.turnEconomy?.attacksUsed ?? 0,
        attackActionsAvailable: input.turnEconomy?.action.max ?? 1 },
    })
    if (!equipment.ok) return { ok: false, reason: 'feature-unavailable' }
    equipmentAttackReplacement = equipment.prepared
  }
  return {
    ok: true,
    prepared: {
      equipmentAttackReplacement,
      featureAttackBudget,
      featureAttackNumber: featureAttackBudget ? (input.turnEconomy?.attacksUsed ?? 0) + 1 : undefined,
      distinctTargetBonusAttackFeatureId,
      movementScope: retainsMovement ? movementScope : undefined,
      action,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      targetToken,
      targetTokens,
      automaticCreatureTargets: automaticCreatureTargets ? true : undefined,
      selectableAreaTargets: scaledFeatureActivity?.target.kind === 'area' && scaledFeatureActivity.target.selection === 'choose-any' ? true : undefined,
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
            mapId: persistentAreaGrant.mapId,
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


/** The feature facade and casting start must use identical command identity,
 * choices and inventory bindings; the player cannot supply continuity. */
function preparedRestFeatureCommand(prepared: PreparedDnd5ePluginFeatureAction, combatRevision: number,
  headlessAction = prepared.headlessAction) {
  const payload = headlessAction.payload && typeof headlessAction.payload === 'object' && !Array.isArray(headlessAction.payload)
    ? headlessAction.payload : undefined
  return {schemaVersion:1 as const,commandId:prepared.action.id,actorId:headlessAction.actorId,packageId:headlessAction.pluginId,
        packageVersion:listRegisteredDnd5eActivityPackages().find(entry=>entry.packageId===headlessAction.pluginId)?.packageVersion??'',
        activityId:headlessAction.actionId,targetIds:headlessAction.targetIds??[],expectedRevision:combatRevision,
        areaPlacement: headlessAction.activityAreaPlacement,
        willingTargetIds: Array.isArray(payload?.activityWillingTargetIds)
          ? payload.activityWillingTargetIds.filter((id): id is string => typeof id === 'string') : undefined,
        choices:payload?.activityChoices && typeof payload?.activityChoices==='object' && !Array.isArray(payload?.activityChoices)
          ? Object.fromEntries(Object.entries(payload?.activityChoices).filter((entry):entry is [string,string]=>typeof entry[1]==='string')) : undefined,
        inventoryOwnerId:typeof payload?.activityInventoryCharacterId==='string'?payload?.activityInventoryCharacterId:undefined,
        inventoryInstanceId:typeof payload?.activityInventoryInstanceId==='string'?payload?.activityInventoryInstanceId:undefined,
        expectedInventoryRevision:typeof payload?.expectedActivityInventoryRevision==='number'?payload?.expectedActivityInventoryRevision:undefined,
      }
}

/** Prepare and project the real casting marker. Caller publishes this start,
 * then arms its private receipt; this does not consume the feature's charge. */
export function prepareDnd5ePluginRestFeatureCasting(input: {
  prepared: PreparedDnd5ePluginFeatureAction; clock: SharedCampaignTimeState; combatRevision: number;
  maps: readonly BattleMap[]; combatActive: boolean;
}) {
  const { prepared } = input
  const payload = prepared.headlessAction.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
    typeof payload.restEventId !== 'string' || (payload.restDecision != null && payload.restDecision !== 'use') ||
    (input.combatActive && !prepared.action.combatId)) return { ok: false as const, reason: 'invalid-command' }
  const start = prepareDnd5eRestActivityCastingV1({ state: { ...prepared.state, active: input.combatActive },
    actorCharacter: prepared.actor, clock: input.clock, combatRevision: input.combatRevision,
    restEventId: payload.restEventId, decision: 'use', confirmedBy: 'actor',
    authoritativeRolls: {}, // Starting a cast never rolls its completion checks.
    command: preparedRestFeatureCommand(prepared, input.combatRevision), mapId: prepared.map.id,
    restMapContext: { sourceMap: prepared.map, maps: input.maps } })
  if (!start.ok) return start
  return { ...start, application: planDnd5eMapResultApplication({ map: prepared.map, characters: prepared.characters,
    state: start.state, characterIdByCombatantId: prepared.characterIdByCombatantId }) }
}

/** Rebuild completion from published room state. The private casting receipt
 * proves continuity; persisted casting markers alone cannot resume a cast. */
export function refreshDnd5ePluginRestFeatureCasting(input: {
  prepared: PreparedDnd5ePluginFeatureAction;
  castingReceipt: Dnd5eLongCastingReceipt;
  binding: Parameters<typeof observeDnd5eLongCasting>[1];
  map: BattleMap; maps: readonly BattleMap[]; characters: readonly Character[];
  worldMinute: number;
  combat: Pick<Dnd5eHeadlessCombatState, 'active' | 'combatId' | 'round' | 'initiativeIndex'>;
  turnEconomy?: Dnd5eTurnEconomyCounts;
  initiativeOrder: Parameters<typeof createDnd5eMapCombatSnapshot>[0]['initiativeOrder'];
}): { ok: true; prepared: PreparedDnd5ePluginFeatureAction } | { ok: false; reason: string } {
  const { prepared, binding, map, characters } = input
  const fail = () => {
    invalidateDnd5eLongCasting(input.castingReceipt)
    return { ok: false as const, reason: 'rest-casting-interrupted' }
  }
  if (map.id !== prepared.map.id || binding.mapId !== map.id ||
    binding.actorTokenId !== prepared.actorToken.id || binding.actorCharacterId !== prepared.actor.id ||
    binding.requestId !== prepared.action.id || !Number.isSafeInteger(input.worldMinute)) return fail()
  const actorTokens = map.tokens.filter(token => token.id === binding.actorTokenId)
  const actors = characters.filter(character => character.id === binding.actorCharacterId)
  if (actorTokens.length !== 1 || actorTokens[0].characterId !== binding.actorCharacterId || actors.length !== 1 ||
    actors[0].dnd5eWorldTimeAppliedMinute !== input.worldMinute) return fail()
  const targetTokens = prepared.targetTokens.map(target => {
    const matches = map.tokens.filter(token => token.id === target.id && token.characterId === target.characterId)
    return matches.length === 1 ? matches[0] : undefined
  })
  if (targetTokens.some(token => !token)) return fail()
  const snapshot = createDnd5eMapCombatSnapshot({ map, roomMaps: input.maps, characters,
    worldMinute: input.worldMinute, combatId: input.combat.combatId, round: input.combat.round,
    initiativeOrder: input.initiativeOrder, additionalCreatureTokenIds: prepared.targetTokens.map(token => token.id) })
  Object.assign(snapshot.state, input.combat)
  if (input.combat.active) {
    const economy = input.turnEconomy
    const actor = snapshot.state.combatants[binding.actorTokenId]
    if (!actor || !economy || ![economy.action.current, economy.bonusAction.current,
      economy.reaction.current, economy.movement.current].every(value => Number.isFinite(value) && value >= 0)) return fail()
    actor.turn = { ...actor.turn, actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0, reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current }
  }
  if (!observeDnd5eLongCasting(input.castingReceipt, binding, snapshot.state.combatants[binding.actorTokenId])) return fail()
  return { ok: true, prepared: { ...prepared, map, characters, actor: actors[0], actorToken: actorTokens[0],
    targetTokens: targetTokens as Token[], targetToken: (targetTokens[0] ?? actorTokens[0]) as Token,
    state: snapshot.state, characterIdByCombatantId: snapshot.characterIdByCombatantId } }
}

/** Stage an Attack-action Activity teleport before its attack rolls or damage choices. */
export function resolvePreparedDnd5ePluginFeatureLanding(input: {
  prepared: PreparedDnd5ePluginFeatureAction
  arrival?: Dnd5eAttackTeleportArrival
  authoritativePayload?: Dnd5ePluginAction['payload']
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
  remainingRolls?: Dnd5eAirborneFallDamageRolls
  preparedAfterLanding?: PreparedDnd5ePluginFeatureAction
} {
  const teleport = input.prepared.attackActionTeleport
  if (teleport) {
    const prepared = input.prepared
    const actor = prepared.state.combatants[prepared.actorToken.id]
    const feature = dnd5ePluginFeaturesAvailableForCharacter(prepared.actor).find(candidate =>
      candidate.id === teleport.featureId && candidate.automation === 'full' &&
      dnd5eCharacterHasPluginFeature(prepared.actor, candidate.id))
    const mechanic = feature?.declarativeAbility?.mechanic
    const request = prepared.action.dnd5ePluginAction?.attackActionTeleport
    const rawPayload = input.authoritativePayload ?? prepared.headlessAction.payload
    const choices = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) &&
      rawPayload.activityChoices && typeof rawPayload.activityChoices === 'object' && !Array.isArray(rawPayload.activityChoices)
      ? Object.fromEntries(Object.entries(rawPayload.activityChoices).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string')) : undefined
    const registered = getRegisteredDnd5eActivity(prepared.headlessAction.pluginId, prepared.headlessAction.actionId)
    const activity = registered && actor && dnd5eActivityWithTargetChoicesV1(
      scaleDnd5eActivityDefinitionV1(registered, { actor }).activity, choices)
    const destination = request && mechanic?.kind === 'attack-action-teleport' &&
      prepareDnd5eAttackTeleportDestination({ map: prepared.map, actorTokenId: prepared.actorToken.id,
        characters: prepared.characters, targetCell: request.targetCell,
        targetElevationFeet: request.elevationFeet, rangeFeet: mechanic.rangeFeet, worldMinute: teleport.worldMinute })
    if (!prepared.featureAttackBudget || !activity?.usesAttackActionAttack ||
      !activity.checks?.some(check => check.kind === 'attack-roll') ||
      !actor?.pluginFeatureIds.includes(teleport.featureId) ||
      !prepared.state.active || prepared.state.initiativeOrder[prepared.state.initiativeIndex] !== actor.id ||
      !destination || !destination.ok || destination.to.x !== actor.position.x ||
      destination.to.y !== actor.position.y || destination.elevationFeet !== (actor.elevationFeet ?? 0)) {
      return { result: { ok: false, reason: 'invalid-target', state: structuredClone(teleport.originalState), events: [] } }
    }
    const landing = resolveDnd5eAttackTeleportLanding({ includeSupportedDestination: true, arrival: input.arrival, teleport, state: prepared.state,
      actorId: actor.id, map: prepared.map, characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId, rolls: input.airborneFallDamageRollsByCombatantId })
    if (landing) {
      if (!landing.ok) return { result: landing.result, airborneFalls: landing.falls }
      const request = teleport.preparationInput
      const resumed = prepareDnd5ePluginFeatureAction({ ...request, map: landing.plan.map, characters: landing.plan.characters,
        action: { ...request.action, dnd5ePluginAction: { ...request.action.dnd5ePluginAction!,
          attackActionTeleport: undefined } } })
      if (!resumed.ok || attackTeleportArrivalConsumedAction(input.arrival, actor.id)) {
        const slot = prepared.featureAttackBudget && dnd5eAttackActionSlot(prepared.featureAttackBudget)
        if (slot?.spendsAction && !prepared.distinctTargetBonusAttackFeatureId) {
          landing.state.combatants[actor.id].turn.actionAvailable = false
          landing.events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
        }
        return { result: { ok: true, state: landing.state, events: landing.events },
          application: planDnd5eMapResultApplication({ state: landing.state,
            map: { ...prepared.map, dnd5ePluginAreas: landing.plan.map.dnd5ePluginAreas },
            characters: landing.plan.characters, baselineCharacters: prepared.characters,
            characterIdByCombatantId: prepared.characterIdByCombatantId, events: landing.events }) }
      }
      return { result: { ok: true, state: landing.state, events: landing.events },
        remainingRolls: landing.remainingRolls,
        preparedAfterLanding: { ...resumed.prepared, attackTeleportPrelude: {
          originalState: teleport.originalState, map: prepared.map, characters: prepared.characters,
          events: landing.events,
        } } }

    }
  }
  return { result: { ok: true, state: input.prepared.state, events: [] }, preparedAfterLanding: input.prepared }
}

export async function resolvePreparedDnd5ePluginFeatureAction(input: {
  combatRevision?: number
  inventoryExchangeAuthority?: { worldMinute: number; combatRevision: number; combatActive: boolean }
  effectRollDice?: Readonly<Record<string, readonly number[]>>
  prepared: PreparedDnd5ePluginFeatureAction
  /** Current Host clock, never copied from the player payload. */
  restAuthority?: {clock:SharedCampaignTimeState;combatRevision:number;maps?:readonly BattleMap[];
    castingContinuation?: Parameters<typeof settleDnd5eRestActivityV1>[0]['castingContinuation']}
  disadvantageNegationChoices?: Dnd5ePluginAction['disadvantageNegationChoices']
  rolls?: Dnd5ePluginAction['rolls']
  /** Host-validated replacement for any untrusted player-supplied action payload. */
  authoritativePayload?: Dnd5ePluginAction['payload']
  interruptChoiceId?: string
  summonInitiativeD20?: number
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
  /** Host-only async choice driver around a synchronous commit. The worker
   * itself runs once, outside any global damage listener scope. */
  resolveDamageBoundary?: <Result>(state:Dnd5eHeadlessCombatState,resolve:(state:Dnd5eHeadlessCombatState)=>Result)=>Promise<Result>
  /** Host-only material-aware boundary; never read from plugin/player payloads. */
  resolveMaterialDamageBoundary?: <Result>(state: Dnd5eHeadlessCombatState, resolve: (state: Dnd5eHeadlessCombatState) => Result,
    succeeded: (result: Result) => boolean) => Promise<{ result: Result; materialChanges: readonly Dnd5eReactionMaterialChange[] }>
}): Promise<{
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  summonedInitiativeEntries?: InitiativeEntry[]
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
  equipmentAttackSlot?: { attackNumber: number; attacksAllowed: number; spendsAction: boolean }
}> {
  const prelude = input.prepared.attackTeleportPrelude
  if (prelude) {
    const continuation = await resolvePreparedDnd5ePluginFeatureAction({ ...input,
      prepared: { ...input.prepared, attackTeleportPrelude: undefined } })
    if (!continuation.result.ok) return { ...continuation,
      result: { ...continuation.result, state: structuredClone(prelude.originalState), events: [] } }
    const events = [...prelude.events, ...continuation.result.events]
    return { ...continuation, result: { ...continuation.result, events },
      application: planDnd5eMapResultApplication({ state: continuation.result.state,
        map: { ...prelude.map, dnd5ePluginAreas: (continuation.application?.map ?? input.prepared.map).dnd5ePluginAreas },
        characters: continuation.application?.characters ?? input.prepared.characters, baselineCharacters: prelude.characters,
        characterIdByCombatantId: input.prepared.characterIdByCombatantId, events }) }
  }
  const teleport = input.prepared.attackActionTeleport
  if (teleport) {
    const landing = resolvePreparedDnd5ePluginFeatureLanding(input)
    if (!landing.preparedAfterLanding) return landing
    if (landing.preparedAfterLanding !== input.prepared) return resolvePreparedDnd5ePluginFeatureAction({ ...input,
      prepared: landing.preparedAfterLanding, airborneFallDamageRollsByCombatantId: landing.remainingRolls })
  }
  let materialChanges: readonly Dnd5eReactionMaterialChange[] = []
  const damageBoundary = async <Result,>(resolve: (state: Dnd5eHeadlessCombatState) => Result, succeeded: (result: Result) => boolean): Promise<Result> => {
    if (input.resolveMaterialDamageBoundary) {
      const settled = await input.resolveMaterialDamageBoundary(input.prepared.state, resolve, succeeded)
      materialChanges = succeeded(settled.result) ? settled.materialChanges : []
      return settled.result
    }
    return input.resolveDamageBoundary ? input.resolveDamageBoundary(input.prepared.state, resolve) : resolve(input.prepared.state)
  }
  if (input.prepared.featureAttackBudget) {
    const failureState = teleport ? structuredClone(teleport.originalState) : input.prepared.state
    if (!Number.isSafeInteger(input.combatRevision)) return {result:{ok:false,state:failureState,events:[],reason:'invalid-plugin-action'}}
    const prepared = input.prepared
    const resolved = await damageBoundary(state=>resolveRegisteredDnd5eActivityInCombatV1({
      state,combatRevision:input.combatRevision!,featureAttackBudget:prepared.featureAttackBudget,
      savingThrowCounterattacks: prepared.headlessAction.savingThrowCounterattacks,
      distinctTargetBonusAttackFeatureId:prepared.distinctTargetBonusAttackFeatureId,
      command:preparedRestFeatureCommand(prepared,input.combatRevision!,{...prepared.headlessAction,payload:input.authoritativePayload ?? prepared.headlessAction.payload}),
      authoritativeRolls:input.rolls ?? {},authoritativeEffectRollDice:input.effectRollDice,
      disadvantageNegationChoices:input.disadvantageNegationChoices,confirmedBy:'actor',
      actorCharacter:prepared.actor,inventoryOwner:prepared.actor,inventoryRoster:prepared.characters,
    }),value=>value.result.ok)
    if (resolved.phase !== 'commit' || !resolved.result.ok) return {result:{ok:false,state:failureState,events:[],reason:pluginFailure(resolved.result.ok ? 'invalid-plugin-action' : resolved.result.reason)}}
    const equipmentAttackSlot = resolved.result.equipmentAttackSlot ? {
      ...resolved.result.equipmentAttackSlot,
      attackNumber: prepared.featureAttackNumber ?? resolved.result.equipmentAttackSlot.attackNumber,
    } : undefined
    const result = {...resolved.result,equipmentAttackSlot,events:[...resolved.result.events]}
    if (teleport) {
      const destination = prepared.state.combatants[prepared.actorToken.id]
      result.events.unshift({ type: 'teleported', actorId: prepared.actorToken.id, spellId: teleport.featureId,
        from: { ...teleport.from }, to: { ...destination.position }, distanceFeet: teleport.distanceFeet,
        fromElevationFeet: teleport.fromElevationFeet, toElevationFeet: destination.elevationFeet ?? 0 })
    }
    const application = planDnd5eMapResultApplication({state:result.state,map:prepared.map,
      characters:prepared.characters,baselineCharacters:prepared.characters,
      characterIdByCombatantId:prepared.characterIdByCombatantId,events:result.events})
    return {result,application:mergeDnd5eReactionMaterialsIntoMapPlan(application,materialChanges),equipmentAttackSlot}
  }
  if (input.prepared.equipmentAttackReplacement) {
    if (!Number.isSafeInteger(input.combatRevision)) return { result: { ok: false, state: input.prepared.state, events: [], reason: 'invalid-plugin-action' } }
    const headlessAction = { ...input.prepared.headlessAction,
      payload: input.authoritativePayload ?? input.prepared.headlessAction.payload }
    const equipment = input.prepared.equipmentAttackReplacement
    const replaced = await damageBoundary(state => resolvePreparedDnd5eEquipmentAttackReplacement({ prepared: { ...equipment, state },
      areaAimCell: input.prepared.targetCell, activity: { combatRevision: input.combatRevision!,
        savingThrowCounterattacks: headlessAction.savingThrowCounterattacks,
        command: preparedRestFeatureCommand(input.prepared, input.combatRevision!, headlessAction),
        authoritativeRolls: input.rolls ?? {}, authoritativeEffectRollDice: input.effectRollDice, confirmedBy: 'actor' } }),
      value => value.result.ok)
    if (!replaced.result.ok) return { result: { ok: false, state: input.prepared.state, events: [], reason: pluginFailure(replaced.result.reason) } }
    return { result: replaced.result, application: replaced.application
      ? mergeDnd5eReactionMaterialsIntoMapPlan(replaced.application, materialChanges) : undefined,
      equipmentAttackSlot: replaced.attackSlot }
  }
  const exchangePayload = input.authoritativePayload ?? input.prepared.headlessAction.payload
  const exchangeActivity = getRegisteredDnd5eActivity(input.prepared.headlessAction.pluginId, input.prepared.headlessAction.actionId)
  const exchangeRequested = !!exchangePayload && typeof exchangePayload === 'object' && !Array.isArray(exchangePayload) && exchangePayload.inventoryExchangeRitual != null
  if (exchangeRequested || exchangeActivity?.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'exchange-inventory-items'))) {
    const exchange = resolveDnd5eInventoryExchangePluginAction({ prepared: input.prepared, payload: exchangePayload,
      authority: input.inventoryExchangeAuthority })
    if (!exchange.ok) return { result: { ok: false, state: input.prepared.state, events: [], reason: 'invalid-plugin-action' } }
    return { result: { ok: true, state: exchange.state, events: [...exchange.events] }, application: exchange.application }
  }
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
    effectRollDice: input.effectRollDice,
    payload: input.authoritativePayload ?? input.prepared.headlessAction.payload,
    rolls: input.rolls,
    disadvantageNegationChoices: input.disadvantageNegationChoices,
    interruptChoiceId: input.interruptChoiceId,
    attackDecoyRolls: input.attackDecoyRolls,
  }
  let result: Dnd5eActionResult
  let restReceiptPatch: Pick<Character,'dnd5eRestActivityWindow'|'dnd5eRestStartActivityWindow'> | undefined
  let airborneFalls: readonly Dnd5eAirborneFallPreview[] | undefined
  const restActivity=getRegisteredDnd5eActivity(headlessAction.pluginId,headlessAction.actionId)
  const invocation=restActivity && resolveDnd5eActivityInvocationV1(restActivity)
  if (invocation?.kind==='triggered' && ['long-rest-complete','short-rest-complete','long-rest-started','short-rest-started'].includes(invocation.event)) {
    const payload=headlessAction.payload && typeof headlessAction.payload==='object' && !Array.isArray(headlessAction.payload) ? headlessAction.payload : undefined
    if (!input.restAuthority || typeof payload?.restEventId!=='string') return {result:{ok:false,state:input.prepared.state,events:[],reason:'invalid-plugin-action'}}
    if (payload.restDecision != null && payload.restDecision !== 'use' && payload.restDecision !== 'decline') return {result:{ok:false,state:input.prepared.state,events:[],reason:'invalid-plugin-action'}}
    const settled=settleDnd5eRestActivityV1({state:input.prepared.state,combatRevision:input.restAuthority.combatRevision,
      actorCharacter:input.prepared.actor,clock:input.restAuthority.clock,restEventId:payload.restEventId,decision:payload.restDecision==='decline'?'decline':'use',confirmedBy:'actor',
      restMapContext: input.restAuthority.maps ? {sourceMap:input.prepared.map,maps:input.restAuthority.maps} : undefined,
      castingContinuation: input.restAuthority.castingContinuation,
      inventoryOwner:input.prepared.actor,inventoryRoster:input.prepared.characters,authoritativeRolls:input.rolls??{},
      authoritativeEffectRollDice:input.effectRollDice,
      areaTargetIds: restActivity?.target.kind === 'area' ? headlessAction.targetIds : undefined,
      areaPlacementDistanceFeet: headlessAction.activityAreaPlacementDistanceFeet,
      command:preparedRestFeatureCommand(input.prepared,input.restAuthority.combatRevision,headlessAction)})
    if (!settled.ok) return {result:{ok:false,state:input.prepared.state,events:[],reason:'invalid-plugin-action'}}
    if (settled.outcome==='declined') {
      result={ok:true,state:input.prepared.state,events:[]}
    } else {
      if (settled.resolution.phase!=='commit') return {result:{ok:false,state:input.prepared.state,events:[],reason:'invalid-plugin-action'}}
      const committed = settled.resolution.result
      result=committed.ok ? {...committed,
        activityDefinition: restActivity,
        activityAreaInstance: committed.areaInstance,
      } : committed
    }
    restReceiptPatch=settled.receiptPatch
  } else if (definition?.execution === 'worker') {
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
          const commitSandbox = (state:Dnd5eHeadlessCombatState) => resolveDnd5eSandboxedPluginCapabilities(
            state,
            headlessAction,
            sandbox.operations,
            input.airborneFallDamageRollsByCombatantId,
          )
          const sandboxResult = await damageBoundary(commitSandbox, value => value.ok)
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
    const commitAction = (state:Dnd5eHeadlessCombatState) => resolveDnd5eActionWithAirborneFallPreview(
      state,
      headlessAction,
      input.airborneFallDamageRollsByCombatantId,
    )
    const resolved = await damageBoundary(commitAction, value => value.result.ok)
    result = resolved.result
    airborneFalls = resolved.airborneFalls
  }
  if (!result.ok) return { result, airborneFalls }
  // Compiled Activities do not pass through commitDnd5eActivityExecution's
  // detection report emission. Keep this result usable outside the map UI too.
  if (input.prepared.feature.ownerPluginId === DND5E_SRD_AUDITED_SPELL_PACKAGE_ID &&
      result.activityDefinition?.id === 'spell:detect-magic:reveal-auras') {
    const actorId=input.prepared.actorToken.id
    const reports=dnd5ePersistentDetectionReports(result.state,actorId).filter(report=>report.mode==='magic')
    result={...result,events:[...result.events,...reports.filter(report=>!result.events.some(event=>
      event.type==='spell-detection-updated' && event.actorId===actorId && event.spellId===report.spellId &&
      event.revealAuras===true && JSON.stringify(event.presences)===JSON.stringify(report.presences)))
      .map(report=>({type:'spell-detection-updated' as const,actorId,spellId:report.spellId,mode:report.mode,presences:report.presences,revealAuras:true}))]}
  }
  const grantedEffectsMap = { ...input.prepared.map }
  if (!bindDnd5eGrantedAreaEffects({ result, map: grantedEffectsMap,
    areaId: input.prepared.persistentAreaGrant?.areaId, actorId: input.prepared.actorToken.id,
    pluginId: input.prepared.feature.ownerPluginId })) {
    return { result: { ok: false, state: input.prepared.state, events: [], reason: 'invalid-plugin-action' }, airborneFalls }
  }
  const inventoryPayload = headlessAction.payload && typeof headlessAction.payload === 'object' && !Array.isArray(headlessAction.payload) ? headlessAction.payload : undefined
  const alteredInventory = settleDnd5eActivityInventoryAlterations({
    characters: input.prepared.characters, baselineCharacters: input.prepared.characters,
    state: result.state, actorId: input.prepared.actorToken.id, characterId: input.prepared.actor.id,
    characterIdByCombatantId: input.prepared.characterIdByCombatantId,
    proposals: result.activityHandoffs?.inventoryAlterations ?? [],
    selection: { instanceId: inventoryPayload?.activityInventoryInstanceId,
      ownerId: inventoryPayload?.activityInventoryCharacterId,
      expectedRevision: inventoryPayload?.expectedActivityInventoryRevision },
  })
  if (!alteredInventory.ok) return { result: { ok: false, state: input.prepared.state, events: [], reason: 'item-resource-unavailable' }, airborneFalls }
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: grantedEffectsMap,
    characters: alteredInventory.characters,
    baselineCharacters: input.prepared.characters,
    characterIdByCombatantId: input.prepared.characterIdByCombatantId,
    events: [...result.events],
  })
  if (restReceiptPatch) {
    const id=input.prepared.actor.id
    application.characters=application.characters.map(character=>character.id===id?{...character,...restReceiptPatch}:character)
    application.changedCharacterIds=[...new Set([...application.changedCharacterIds,id])]
    application.characterPatches={...application.characterPatches,[id]:{...application.characterPatches?.[id],...restReceiptPatch}}
  }
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
    const resolvedTriggers = persistentArea.triggers?.map(trigger => resolveDnd5ePersistentAreaTriggerSourceDc(trigger,
      input.prepared.state.combatants[input.prepared.actorToken.id]?.saveDc ?? input.prepared.actor.saveDC))
    if (resolvedTriggers?.some(trigger => !trigger)) return { result: { ok: false, state: input.prepared.state, events: [], reason: 'invalid-plugin-action' }, airborneFalls }
    const triggers = resolvedTriggers as Dnd5ePersistentAreaTriggerSnapshot[] | undefined
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
    application: mergeDnd5eReactionMaterialsIntoMapPlan(application, materialChanges),
    airborneFalls,
    summonedInitiativeEntries: summonPlan?.ok ? [summonPlan.plan.initiativeEntry] : undefined,
  }
}



