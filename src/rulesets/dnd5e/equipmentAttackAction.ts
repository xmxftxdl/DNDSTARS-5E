import { dnd5eAttackActionSlot } from './attackActionSlot'
import { dnd5eOrdinaryAttacksUsed } from './attackActionHistory'
import { prepareDnd5eAttackTeleportDestination } from './attackTeleportDestination'
import { resolveDnd5eAttackTeleportLanding, attackTeleportArrivalConsumedAction, type Dnd5eAttackTeleportArrival } from './attackTeleportLanding'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeaturesAvailableForCharacter } from './pluginApi'
import { dnd5eDeclarativeAttackIntentDefinition } from './pluginApi'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {resolveDnd5eRollDiceModifiers} from './rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from './rollDiceTransaction'
import { dnd5eEffectiveCharacterMovementProfile } from './characterMovement'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { CombatTransaction } from '../../lib/combatTransaction'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eAttackOutcome } from './attackResolution'
import { dnd5eConditionHitIsAutomaticCritical } from './conditions'
import { dnd5eActiveAttackRollFlags, dnd5eActiveTargetLinkedAttackRollFlags } from './activeEffects'
import { dnd5eAreaAttackAdvantageCandidates, dnd5eCombatantCanSee, dnd5eCanActAtZeroHitPoints, dnd5eSavingThrowCounterattackOptions, type Dnd5eAction } from './headlessCombatEngine'
import {
  dnd5eMonkMartialArtsEligible,
  dnd5eUnarmedAttackProfiles,
  dnd5eMonkWeapon,
  dnd5eOffHandWeaponAttackProfile,
  dnd5eShillelaghAttackChoice,
  dnd5eWeaponAttackProfile,
  dnd5eWeaponDamageSource,
  dnd5eVirtualWeaponDamageSource,
  dnd5eWeaponPropertyIds,
  dnd5eWeaponRangeFeet,
  dnd5eWearingUnproficientArmor,
  type Dnd5eWeaponDamageSource,
  type Dnd5eWeaponAttackProfile,
} from './equipment'
import { dnd5eClassDefinitionForCharacter } from './classes'
import { dnd5eCharacterClassLevel } from './multiclass'
import {
  dnd5eDeclarativeCombatManeuverDefinition,
  dnd5eEffectiveAttacksPerAttackAction,
  dnd5ePluginBonusWeaponAttackForCharacter,
} from './pluginApi'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode, type Dnd5eRollModeResolution } from './rollMode'
import { dnd5eUtilityProjectionAttackAdvantageApplies } from './utilityProjection'
import { dnd5eNextD20AdvantageApplies } from './nextD20Advantage'
import {
  dnd5eBlurImposesAttackDisadvantage,
  dnd5eAttackDisadvantageReasons,
  dnd5eAttackerIsUnseenForAttack,
  dnd5ePendingAllyAttackAdvantage,
  dnd5eSourceProximityAttackAdvantage,
  dnd5eSourceMarkedAttackDisadvantage,
  dnd5eRageAllyProtectionDisadvantage,
  dnd5eRageAllyMeleeAdvantage,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eTranquilityWardCheck,
  dnd5eIsFavoredEnemy,
  dnd5eSourceLinkedRelations,
  dnd5eWeaponClassDamageDefinitions,
  dnd5eFirstOwnTurnWeaponAttackFeature,
  dnd5eDistinctTargetBonusAttackFeatures,
  dnd5eEffectiveSizeRank,
  previewDnd5ePostD20AdjustedAttack,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eCombatManeuverAttackIntentPayload,
  type Dnd5eCombatManeuverTargetReaction,
  type Dnd5eClassDamageDefinition,
  type Dnd5eClassDamageRolls,
  type Dnd5eCuttingWordsUse,
  type Dnd5eStandAgainstTideUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5eWeaponClassDamageContext,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eOpeningAttackSavingThrowRoll,
  type Dnd5ePostD20AdjustmentUse,
  type Dnd5eDamageMitigationInterruptUse,
  type Dnd5eAttackRetargetInterruptUse,
  type Dnd5eMountedAttackRedirectUse,
  type Dnd5eWholeWeaponDamageRerollUse,
} from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import {
  previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  type Dnd5eCombatEvent,
} from './headlessCombatEngine'
import {
  applyDnd5eAttackCoverOverride,
  createDnd5eMapCombatSnapshot,
  dnd5eAttackCoverForPair,
  dnd5eMapTokenCanThreatenRangedAttacker,
  dnd5eRequestedInitiativeActorIndex,
  planDnd5eMapResultApplication,
  type Dnd5eAttackCoverSnapshot,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetAttackAdvantageReasons, dnd5eTargetIsDodging } from './passiveDefenses'
import { consumeDnd5eWeaponAmmunition, releaseDnd5eTemporaryWeapon } from './items'
import { mapGeometryOrdinaryProjectileBlocked, mapGeometryRangedWeaponAttackDisadvantage, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { dnd5eUnderwaterWeaponAttack } from './environmentRules'
import { dnd5eMartialSpellBonusAttackAvailable } from './martialSpellSynergy'
import {
  dnd5eActiveAttackProfileRewrite,
  dnd5eActiveEnvironmentalCapabilities,
  dnd5eActiveSubmerged,
  dnd5eActiveMagicWeaponBonus,
  dnd5eAvailableRestrictedExtraActionKinds,
} from './activeEffects'
import { dnd5eCreatureHeightFeetForSizeRank, dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import type { Dnd5ePluginDiceRollResult } from './pluginApi'
import { dnd5eActivityWeaponAttackGrantMatchesV1 } from './activities/dnd5eActivityWeaponAttackGrant'
import {
  dnd5eOpeningAttackHasAdvantage,
  dnd5eOpeningAttackIsAutomaticCritical,
  dnd5eOpeningAttackSavingThrowRequirement,
} from './openingAttack'

export type Dnd5eEquipmentAttackRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'not-dnd5e-class'
  | 'no-weapon'
  | 'ammunition-unavailable'
  | 'projectile-blocked-by-wind-wall'
  | 'target-out-of-range'
  | 'attack-action-spent'
  | 'class-resource-unavailable'
  | 'divine-smite-unavailable'
  | 'reckless-attack-unavailable'
  | 'frenzy-attack-unavailable'
  | 'off-hand-attack-unavailable'
  | 'horde-breaker-unavailable'
  | 'stunning-strike-unavailable'
  | 'foe-slayer-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eEquipmentAttack {
  attackTeleportPrelude?: {
    originalState: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    events: Dnd5eCombatEvent[]
  }
  attackActionTeleport?: {
    preparationInput: Parameters<typeof prepareDnd5eEquipmentAttack>[0]
    featureId: string
    originalState: Dnd5eHeadlessCombatState
    from: { x: number; y: number }
    fromElevationFeet: number
    distanceFeet: number
    worldMinute?: number
  }
  disadvantageNegation?: { rollId: string; transactionId: string }
  /** Host preparation only; commit recomputes against its scene. */
  homingProjectileReached?: boolean
  /** Host pre-roll choice, not part of the player request. */
  areaAttackAdvantageReaction?: { areaId: string; sourceId: string }
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetToken: Token
  profile: Dnd5eWeaponAttackProfile
  /** 仅由权威角色装备与 ActiveEffect 生成；不读取客户端请求中的同名字段。 */
  damageSource: Dnd5eWeaponDamageSource
  targetArmorClass: number
  cover: Dnd5eAttackCoverSnapshot & { overriddenByDm: boolean }
  distanceFeet: number
  attackNumber: number
  attacksAllowed: number
  /** Host ledger used to prepare this ordinary Attack-action attack. */
  attackBudget?: Parameters<typeof dnd5eAttackActionSlot>[0]
  spendsAction: boolean
  spendsBonusAction: boolean
  countsTowardAttackAction: boolean
  /** Prepared for embedding in the forcing save transaction, never a standalone attack. */
  savingThrowCounterattackFeatureId?: string
  attackMode: 'normal' | 'advantage' | 'disadvantage'
  attackModeResolution?: Dnd5eRollModeResolution
  declarativeIntentFeatureIds: readonly string[]
  classDamageContext: Dnd5eWeaponClassDamageContext
  stunningStrike?: {
    saveDc: number
    saveModifier: number
    saveMode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }
  openingAttackSavingThrow?: {
    featureId: string
    ability: keyof Dnd5eCombatant['abilities']
    dc: number
    saveModifier: number
    saveMode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
    failureDamageMultiplier: number
  }
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  foeSlayerAttackBonus: number
  offHandAttack: boolean
  blessed: boolean
  baned: boolean
}

/** Reuse the actual weapon authority for each candidate, including long range and cover. */
export function dnd5eVisibleEquipmentAttackTargets(input: Parameters<typeof prepareDnd5eEquipmentAttack>[0]): PreparedDnd5eEquipmentAttack[] {
  return input.map.tokens.flatMap(token => {
    const result = prepareDnd5eEquipmentAttack({ ...input, action: { ...input.action, targetTokenId: token.id } })
    if (!result.ok || result.prepared.cover.blocksLineOfEffect ||
      !dnd5eCombatantCanSee(result.prepared.state, result.prepared.actorToken.id, token.id)) return []
    return [result.prepared]
  })
}

export function prepareDnd5eEquipmentAttack(input: {
  /** Host-only parent save checkpoint; absent from the player request schema. */
  savingThrowCounterattack?: { state: Dnd5eHeadlessCombatState; featureId: string }
  /** Host scene clock, never taken from the player action. */
  worldMinute?: number
  worldSecondRemainder?: number
  /** Host-recomputed replacement-area occupants; does not grant initiative slots. */
  additionalCreatureTokenIds?: readonly string[]
  /** Host area replacement only: prepare equipment at the origin when there is no victim. */
  replacementAreaOriginOnly?: true
  action: SharedPlayerActionState
  /** Trusted DM-host ruling supplied after the player request reaches authority. */
  dmCoverOverride?: Dnd5eAttackCoverSnapshot['cover']
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  attacksUsed: number
  attackActionsAvailable?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eEquipmentAttack } | { ok: false; reason: Dnd5eEquipmentAttackRejectReason } {
  const { action } = input
  if (action.type !== 'dnd5e-weapon-attack' || !action.targetTokenId) return { ok: false, reason: 'invalid-action' }
  const requestedCoverOverride = action.dnd5eWeaponAttackOptions?.coverOverride
  if (requestedCoverOverride != null && action.sourceMode !== 'dm') return { ok: false, reason: 'invalid-action' }
  const coverOverride = input.dmCoverOverride ?? requestedCoverOverride
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken) return { ok: false, reason: 'invalid-actor' }
  const counter = input.savingThrowCounterattack
  if (counter && (
    !dnd5eSavingThrowCounterattackOptions(counter.state, actorToken.id, action.targetTokenId)
      .some(option => option.featureId === counter.featureId) ||
    action.dnd5eWeaponAttackOptions?.attackActionTeleport ||
    action.dnd5eWeaponAttackOptions?.activityWeaponAttackGrantId ||
    action.dnd5eWeaponAttackOptions?.offHandAttack || action.dnd5eWeaponAttackOptions?.frenzyAttack ||
    action.dnd5eWeaponAttackOptions?.hordeBreakerAttack || action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttack ||
    action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttackId
  )) return { ok: false, reason: 'class-resource-unavailable' }
  const teleport = action.dnd5eWeaponAttackOptions?.attackActionTeleport
  if (teleport != null) {
    const feature = dnd5ePluginFeaturesAvailableForCharacter(actor).find(candidate =>
      candidate.automation === 'full' && candidate.declarativeAbility?.mechanic?.kind === 'attack-action-teleport' &&
      dnd5eCharacterHasPluginFeature(actor, candidate.id))
    const mechanic = feature?.declarativeAbility?.mechanic
    if (!feature || mechanic?.kind !== 'attack-action-teleport' || !action.combatId ||
      input.initiativeOrder[action.initiativeIndex]?.tokenId !== actorToken.id)
      return { ok: false, reason: 'class-resource-unavailable' }
    const destination = prepareDnd5eAttackTeleportDestination({
      map: input.map, actorTokenId: actorToken.id, characters: input.characters,
      targetCell: teleport.targetCell, targetElevationFeet: teleport.elevationFeet,
      rangeFeet: mechanic.rangeFeet, worldMinute: input.worldMinute,
    })
    if (!destination.ok) return { ok: false, reason: destination.reason === 'target-out-of-range' ? destination.reason : 'invalid-target' }
    const movedMap = { ...input.map, tokens: input.map.tokens.map(token => token.id === actorToken.id
      ? { ...token, ...destination.to, elevationFeet: destination.elevationFeet } : token) }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, map: movedMap,
      action: { ...action, dnd5eWeaponAttackOptions: { ...action.dnd5eWeaponAttackOptions, attackActionTeleport: undefined } } })
    if (!prepared.ok) return prepared
    if (!prepared.prepared.countsTowardAttackAction || prepared.prepared.spendsBonusAction ||
      prepared.prepared.classDamageContext.spellAttack)
      return { ok: false, reason: 'invalid-action' }
    const original = createDnd5eMapCombatSnapshot({
      worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder,
      combatId: action.combatId, round: action.round,
      turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
      map: input.map, characters: input.characters, initiativeOrder: input.initiativeOrder,
      additionalCreatureTokenIds: [action.targetTokenId, ...input.additionalCreatureTokenIds ?? []],
    })
    return { ok: true, prepared: { ...prepared.prepared, action, map: input.map,
      attackActionTeleport: { preparationInput: input, featureId: feature.id, originalState: original.state,
        from: { x: actorToken.x, y: actorToken.y }, fromElevationFeet: original.state.combatants[actorToken.id]?.elevationFeet ?? 0,
        distanceFeet: destination.distanceFeet, worldMinute: input.worldMinute } } }
  }
  const declarativeIntentFeatureIds =
    action.dnd5eWeaponAttackOptions?.declarativeIntentFeatureIds ?? []
  if (
    !Array.isArray(declarativeIntentFeatureIds) ||
    declarativeIntentFeatureIds.length > 16 ||
    declarativeIntentFeatureIds.some((featureId) =>
      typeof featureId !== 'string' || featureId.length < 1 || featureId.length > 200
    ) ||
    new Set(declarativeIntentFeatureIds).size !== declarativeIntentFeatureIds.length
  ) return { ok: false, reason: 'invalid-action' }
  if (!dnd5eClassDefinitionForCharacter(actor)) return { ok: false, reason: 'not-dnd5e-class' }
  const targetToken = input.map.tokens.find((token) => token.id === action.targetTokenId)
  if (!targetToken || (targetToken.id === actorToken.id && !input.replacementAreaOriginOnly) || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
  const turnSlotId = input.initiativeOrder[action.initiativeIndex]?.slotId
  const turnKey = `${action.combatId ?? `map-${input.map.id}`}:${Math.max(1, action.round)}:${turnSlotId ?? actorToken.id}`
  const offHandAttack = action.dnd5eWeaponAttackOptions?.offHandAttack === true
  const activityWeaponAttackGrantId = action.dnd5eWeaponAttackOptions?.activityWeaponAttackGrantId
  const activityWeaponAttackGrant = activityWeaponAttackGrantId
    ? actor.dnd5eCombatState?.activityWeaponAttackGrants?.[activityWeaponAttackGrantId]
    : undefined
  const grantOriginId = actor.dnd5eCombatState?.activityWeaponAttackGrants?.[activityWeaponAttackGrantId ?? '']?.targetRestriction?.originTargetId
  const activityWeaponAttackWeaponSlot = action.dnd5eWeaponAttackOptions?.activityWeaponAttackWeaponSlot ?? 'main-hand'
  if (
    !['main-hand', 'off-hand'].includes(activityWeaponAttackWeaponSlot) ||
    (action.dnd5eWeaponAttackOptions?.activityWeaponAttackWeaponSlot != null && activityWeaponAttackGrantId == null)
  ) return { ok: false, reason: 'invalid-action' }
  const selectedWeaponSlot = activityWeaponAttackGrantId != null && activityWeaponAttackWeaponSlot === 'off-hand'
    ? 'offHand' as const
    : 'mainWeapon' as const
  const shillelaghAbility = action.dnd5eWeaponAttackOptions?.shillelaghAbility
  const shillelagh = dnd5eShillelaghAttackChoice(actor)
  if (
    shillelaghAbility != null &&
    shillelaghAbility !== 'str' &&
    shillelaghAbility !== 'spellcasting'
  ) return { ok: false, reason: 'invalid-action' }
  if (shillelaghAbility != null && (offHandAttack || selectedWeaponSlot !== 'mainWeapon' || !shillelagh)) {
    return { ok: false, reason: 'invalid-action' }
  }
  const handSnapshot = createDnd5eMapCombatSnapshot({
    worldMinute: input.worldMinute,
    worldSecondRemainder: input.worldSecondRemainder,
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
    additionalCreatureTokenIds: [...new Set([targetToken.id, ...(grantOriginId ? [grantOriginId] : []), ...input.additionalCreatureTokenIds ?? []])],
  })
  const handActor = handSnapshot.state.combatants[actorToken.id]
  if (!handActor || handActor.deathSaves.dead ||
    (handActor.currentHp <= 0 && !dnd5eCanActAtZeroHitPoints(handActor))) return { ok: false, reason: 'invalid-actor' }
  const maintainedGrapples = dnd5eSourceLinkedRelations(
    handSnapshot.state,
    actorToken.id,
    'free-hand',
  ).length
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const tokenDistanceFeet = (left: Token, right: Token): number => {
    const leftCombatant = handSnapshot.state.combatants[left.id]
    const rightCombatant = handSnapshot.state.combatants[right.id]
    return dnd5eMapTokenDistanceFeet({
      map: input.map,
      geometry,
      left,
      right,
      leftSizeRank: leftCombatant ? dnd5eEffectiveSizeRank(leftCombatant) : undefined,
      rightSizeRank: rightCombatant ? dnd5eEffectiveSizeRank(rightCombatant) : undefined,
    })
  }
  if ((offHandAttack || selectedWeaponSlot === 'offHand') && maintainedGrapples > 0) {
    return { ok: false, reason: 'off-hand-attack-unavailable' }
  }
  const naturalWeaponId = action.dnd5eWeaponAttackOptions?.naturalWeaponId
  const naturalProfile = naturalWeaponId == null ? undefined : dnd5eUnarmedAttackProfiles(actor,
    handSnapshot.state.combatants[actorToken.id]?.pluginFeatureIds ?? []).find(profile => profile.weaponId === naturalWeaponId)
  if (naturalWeaponId != null && (!naturalProfile || offHandAttack || shillelaghAbility != null || activityWeaponAttackGrantId != null)) {
    return { ok: false, reason: 'no-weapon' }
  }
  const baseProfile = naturalProfile ?? (offHandAttack
    ? dnd5eOffHandWeaponAttackProfile(actor)
    : dnd5eWeaponAttackProfile(actor, {
        shillelaghAbility,
        forceOneHanded: maintainedGrapples > 0,
        weaponSlot: selectedWeaponSlot,
      }))
  if (!baseProfile) return { ok: false, reason: 'no-weapon' }
  const attackProfileRewrite = dnd5eActiveAttackProfileRewrite(
    actor.dnd5eCombatState?.activeEffects,
    baseProfile.mode,
    baseProfile.weaponId,
  )
  let profile: Dnd5eWeaponAttackProfile = {
    ...baseProfile,
    reachFeet: (baseProfile.reachFeet ?? 0) + attackProfileRewrite.reachBonusFeet,

    damage: {
      ...baseProfile.damage,
      type: attackProfileRewrite.damageTypeOverride ?? baseProfile.damage.type,
    },
  }
  if (action.dnd5eWeaponAttackOptions?.useSling) {
    const sling = actor.equipment?.offHand
    if (!profile.slingRangeFeet || !(sling?.baseEquipmentId ?? sling?.id)?.endsWith('dnd5e-sling')) return {ok:false,reason:'no-weapon'}
    profile={...profile,rangeFeet:profile.slingRangeFeet,mode:'ranged'}
  }
  const thrownRequested = action.dnd5eWeaponAttackOptions?.thrownAttack === true
  const canThrow = profile.properties.some(property => property === 'thrown' || property.includes('投掷')) && !!profile.rangeFeet
  if (thrownRequested && !canThrow) return {ok:false,reason:'no-weapon'}
  if (canThrow && (thrownRequested || tokenDistanceFeet(actorToken,targetToken) > (profile.reachFeet ?? 5))) {
    profile = {...profile,mode:'ranged'}
  }
  profile.criticalThreshold = Math.min(baseProfile.criticalThreshold, dnd5eActiveAttackProfileRewrite(actor.dnd5eCombatState?.activeEffects, profile.mode, profile.weaponId).criticalThreshold ?? 20)
  const equippedWeapon = offHandAttack ? actor.equipment?.offHand : actor.equipment?.[selectedWeaponSlot]
  const persistedDamageSource = naturalProfile ? { weaponId: naturalProfile.weaponId, magical: naturalProfile.magical } : dnd5eWeaponDamageSource(equippedWeapon) ??
    dnd5eVirtualWeaponDamageSource(profile.weaponId)
  if (!persistedDamageSource || persistedDamageSource.weaponId !== profile.weaponId) {
    return { ok: false, reason: 'no-weapon' }
  }
  const damageSource: Dnd5eWeaponDamageSource = {
    ...persistedDamageSource,
    magical: persistedDamageSource.magical ||
      dnd5eActiveMagicWeaponBonus(actor.dnd5eCombatState?.activeEffects, profile.weaponId) > 0 ||
      (!offHandAttack && selectedWeaponSlot === 'mainWeapon' && shillelagh?.weaponId === profile.weaponId),
  }
  if (
    profile.mode === 'ranged' &&
    mapGeometryOrdinaryProjectileBlocked({
      geometry,
      map: input.map,
      from: actorToken,
      to: targetToken,
      fromHeightFeet: dnd5eCreatureHeightFeetForSizeRank(
        dnd5eEffectiveSizeRank(handSnapshot.state.combatants[actorToken.id]),
      ),
      toHeightFeet: dnd5eCreatureHeightFeetForSizeRank(
        dnd5eEffectiveSizeRank(handSnapshot.state.combatants[targetToken.id]),
      ),
    })
  ) return { ok: false, reason: 'projectile-blocked-by-wind-wall' }
  if (
    offHandAttack && (
      input.attacksUsed < 1 || (input.turnEconomy?.bonusAction.current ?? 1) < 1 ||
      action.dnd5eWeaponAttackOptions?.frenzyAttack || action.dnd5eWeaponAttackOptions?.hordeBreakerAttack
    )
  ) return { ok: false, reason: 'off-hand-attack-unavailable' }
  const redirectOrigin = activityWeaponAttackGrant?.reusedProjectileWeaponId === profile.weaponId &&
    dnd5eActivityWeaponAttackGrantMatchesV1(activityWeaponAttackGrant, turnKey, {
      weaponId:profile.weaponId,baseWeaponId:profile.baseWeaponId,mode:profile.mode,
      weaponProperties:dnd5eWeaponPropertyIds(profile.properties),proficient:profile.proficient,
    },activityWeaponAttackWeaponSlot)
    ? input.map.tokens.find(token => token.id === grantOriginId) : undefined
  const distanceFeet = tokenDistanceFeet(redirectOrigin ?? actorToken, targetToken)
  const extendedReachIntent = action.dnd5eWeaponAttackOptions?.declarativeIntentFeatureIds?.some((featureId) =>
    dnd5eDeclarativeCombatManeuverDefinition(featureId)?.mechanic.operation === 'extended-reach'
  ) === true
  const effectiveRangeFeet = (redirectOrigin ? activityWeaponAttackGrant!.targetRestriction!.maximumFeet : dnd5eWeaponRangeFeet(profile)) +
    (profile.mode === 'melee' && extendedReachIntent ? 5 : 0)
  if (distanceFeet > effectiveRangeFeet) return { ok: false, reason: 'target-out-of-range' }
  const underwater = dnd5eUnderwaterWeaponAttack({
    environment: dnd5eActiveSubmerged(actor.dnd5eCombatState?.activeEffects) ? 'underwater' : geometry?.environment,
    weaponId: profile.weaponId,
    mode: profile.mode,
    distanceFeet,
    normalRangeFeet: profile.rangeFeet?.normal,
    hasSwimmingSpeed: (dnd5eEffectiveCharacterMovementProfile(actor).swimSpeed ?? 0) > 0 ||
      dnd5eActiveEnvironmentalCapabilities(actor.dnd5eCombatState?.activeEffects)
        .ignoresUnderwaterAttackPenalty,
  })
  if (underwater.automaticMiss) return { ok: false, reason: 'target-out-of-range' }
  const divineSmiteSlotLevel = action.dnd5eWeaponAttackOptions?.divineSmiteSlotLevel
  if (divineSmiteSlotLevel != null) {
    const slot = actor.classResources?.[`dnd5e-spell-slot-${divineSmiteSlotLevel}`]
    if (
      dnd5eCharacterClassLevel(actor, 'paladin') < 2 || profile.mode !== 'melee' ||
      !Number.isInteger(divineSmiteSlotLevel) || divineSmiteSlotLevel < 1 || divineSmiteSlotLevel > 9 ||
      !slot || slot.current < 1
    ) return { ok: false, reason: 'divine-smite-unavailable' }
  }
  const recklessAlreadyActive = actor.dnd5eCombatState?.recklessAttackTurnKey === turnKey
  const recklessAttack = action.dnd5eWeaponAttackOptions?.recklessAttack === true
  if (
    recklessAttack && (
      dnd5eCharacterClassLevel(actor, 'barbarian') < 2 || profile.mode !== 'melee' || profile.attackAbility !== 'str' ||
      input.attacksUsed !== 0
    )
  ) return { ok: false, reason: 'reckless-attack-unavailable' }
  const frenzyAttack = action.dnd5eWeaponAttackOptions?.frenzyAttack === true
  const featureBonusWeaponAttack =
    action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttack === true ||
    action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttackId != null
  const genericBonusWeaponAttackId = action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttackId
  const activityWeaponAttackGranted = activityWeaponAttackGrantId != null &&
    dnd5eActivityWeaponAttackGrantMatchesV1(activityWeaponAttackGrant, turnKey, {
      weaponId: profile.weaponId,
      baseWeaponId: profile.baseWeaponId,
      mode: profile.mode,
      weaponProperties: dnd5eWeaponPropertyIds(profile.properties),
      proficient: profile.proficient,
    }, activityWeaponAttackWeaponSlot)
  if (!(activityWeaponAttackGranted && activityWeaponAttackGrant?.reusedProjectileWeaponId) &&
    !consumeDnd5eWeaponAmmunition(actor, profile.weaponId).ok) return { ok: false, reason: 'ammunition-unavailable' }
  if (activityWeaponAttackGranted && activityWeaponAttackGrant?.projectileAttackSnapshot) {
    const original = activityWeaponAttackGrant.projectileAttackSnapshot
    profile = {...profile,attackModifier:original.attackModifier,damage:{...original.damage}}
  }
  if (activityWeaponAttackGranted && activityWeaponAttackGrant?.damageDice) {
    profile = {
      ...profile,
      damage: {
        ...profile.damage,
        count: activityWeaponAttackGrant.damageDice.count,
        sides: activityWeaponAttackGrant.damageDice.sides,
        type: activityWeaponAttackGrant.damageType ?? profile.damage.type,
      },
    }
  }
  if (activityWeaponAttackGranted && activityWeaponAttackGrant?.damageBonus) {
    profile = {
      ...profile,
      damage: {
        ...profile.damage,
        bonus: profile.damage.bonus + activityWeaponAttackGrant.damageBonus,
      },
    }
  }
  const genericBonusWeaponAttack = genericBonusWeaponAttackId
    ? dnd5ePluginBonusWeaponAttackForCharacter(actor, turnKey)
    : undefined
  if (
    featureBonusWeaponAttack && (
      frenzyAttack || offHandAttack ||
      (genericBonusWeaponAttackId
        ? genericBonusWeaponAttack?.id !== genericBonusWeaponAttackId || action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttack === true
        : !dnd5eMartialSpellBonusAttackAvailable(actor, turnKey)) ||
      (input.turnEconomy?.bonusAction.current ?? 1) < 1
    )
  ) return { ok: false, reason: 'attack-action-spent' }
  if (
    activityWeaponAttackGrantId != null && (
      featureBonusWeaponAttack || frenzyAttack || offHandAttack || !activityWeaponAttackGranted ||
      (activityWeaponAttackGrant?.economy === 'bonus-action' && (input.turnEconomy?.bonusAction.current ?? 1) < 1)
    )
  ) return { ok: false, reason: 'attack-action-spent' }
  if (activityWeaponAttackGranted && activityWeaponAttackGrant?.targetRestriction) {
    const restriction = activityWeaponAttackGrant.targetRestriction
    const origin = input.map.tokens.find(token => token.id === restriction.originTargetId)
    if (!origin || origin.id === targetToken.id || !Number.isFinite(restriction.maximumFeet) ||
      restriction.maximumFeet <= 0 || tokenDistanceFeet(origin, targetToken) > restriction.maximumFeet) {
      return {ok: false, reason: 'invalid-target'}
    }
  }
  if (activityWeaponAttackGranted && activityWeaponAttackGrant?.requiredTargetId != null &&
    activityWeaponAttackGrant.requiredTargetId !== targetToken.id) return { ok: false, reason: 'invalid-target' }
  if (activityWeaponAttackGranted && activityWeaponAttackGrant?.attackResourceCost &&
    (actor.classResources?.[activityWeaponAttackGrant.attackResourceCost.resourceId]?.current ?? 0) < activityWeaponAttackGrant.attackResourceCost.amount) {
    return { ok: false, reason: 'class-resource-unavailable' }
  }
  const barbarianSubclass = actor.dnd5eClassChoices?.classes?.barbarian?.subclass
  if (
    frenzyAttack && (
      dnd5eCharacterClassLevel(actor, 'barbarian') < 3 || barbarianSubclass !== 'berserker' ||
      actor.dnd5eCombatState?.raging !== true || actor.dnd5eCombatState?.frenzying !== true ||
      actor.dnd5eCombatState?.frenzyStartedTurnKey === turnKey || profile.mode !== 'melee' ||
      (input.turnEconomy?.bonusAction.current ?? 1) < 1
    )
  ) return { ok: false, reason: 'frenzy-attack-unavailable' }
  const hordeBreakerAttack = action.dnd5eWeaponAttackOptions?.hordeBreakerAttack === true
  const loadingWeapon = profile.properties.some((property) => property.includes('装填')) &&
    handSnapshot.state.combatants[actorToken.id]?.ignoreLoadingWeaponProperty !== true
  const rangerChoices = actor.dnd5eClassChoices?.classes?.ranger
  const hordeBreakerSelected = dnd5eCharacterClassLevel(actor, 'ranger') >= 3 && rangerChoices?.subclass === 'hunter' &&
    rangerChoices.selections?.['hunters-prey']?.includes('horde-breaker') === true
  const hordeSourceToken = actor.dnd5eCombatState?.hordeBreakerSourceTargetId
    ? input.map.tokens.find((token) => token.id === actor.dnd5eCombatState?.hordeBreakerSourceTargetId)
    : undefined
  if (
    hordeBreakerAttack && (
      frenzyAttack || !hordeBreakerSelected || actor.dnd5eCombatState?.hordeBreakerOpportunityTurnKey !== turnKey ||
      actor.dnd5eCombatState?.hordeBreakerUsedTurnKey === turnKey || !hordeSourceToken ||
      loadingWeapon ||
      hordeSourceToken.id === targetToken.id || !areOpposedCombatTokens(actorToken, hordeSourceToken) ||
      !areOpposedCombatTokens(actorToken, targetToken) ||
      tokenDistanceFeet(hordeSourceToken, targetToken) > 5
    )
  ) return { ok: false, reason: 'horde-breaker-unavailable' }
  const stunningStrike = action.dnd5eWeaponAttackOptions?.stunningStrike === true
  if (
    stunningStrike && (
      dnd5eCharacterClassLevel(actor, 'monk') < 5 || profile.mode !== 'melee' ||
      (actor.classResources?.['dnd5e-ki']?.current ?? 0) < 1
    )
  ) return { ok: false, reason: 'stunning-strike-unavailable' }
  const foeSlayer = action.dnd5eWeaponAttackOptions?.foeSlayer
  const specialAttack = counter != null || frenzyAttack || hordeBreakerAttack || offHandAttack ||
    featureBonusWeaponAttack || activityWeaponAttackGranted
  const attacksPerAction = dnd5eEffectiveAttacksPerAttackAction(actor, !action.combatId || input.initiativeOrder[action.initiativeIndex]?.tokenId === actorToken.id)
  const weaponAttacksPerAction = loadingWeapon ? 1 : attacksPerAction
  handSnapshot.state.initiativeIndex = action.initiativeIndex
  const firstTurnWeaponFeature = action.combatId && !loadingWeapon
    ? dnd5eFirstOwnTurnWeaponAttackFeature(handSnapshot.state, actorToken.id) : undefined
  const attackBudget = {
    attacksPerAction: weaponAttacksPerAction,
    actionCount: Math.max(1, Math.floor(input.attackActionsAvailable ?? 1)),
    attacksUsed: dnd5eOrdinaryAttacksUsed(handActor.classState.attackActionHistory, turnKey, input.attacksUsed),
    extraWeaponAttacksPerAction: firstTurnWeaponFeature ? 1 : 0,
    attackKind: !naturalProfile && equippedWeapon?.dnd5e?.kind === 'weapon' &&
      equippedWeapon.dnd5e.usesSourceSpellcastingAbility !== true ? 'weapon' as const : 'replacement' as const,
  }
  const ordinarySlot = specialAttack ? undefined : dnd5eAttackActionSlot(attackBudget)
  if (!specialAttack && !Number.isSafeInteger(attackBudget.attacksUsed)) return { ok: false, reason: 'attack-action-spent' }
  const distinctTargetFeature = !specialAttack && !loadingWeapon && (!ordinarySlot || ordinarySlot.spendsAction) &&
    (naturalProfile || equippedWeapon?.dnd5e?.kind !== 'weapon' || equippedWeapon.dnd5e.usesSourceSpellcastingAbility !== true)
    ? dnd5eDistinctTargetBonusAttackFeatures(handSnapshot.state, actorToken.id, targetToken.id)[0] : undefined
  const attackSlot = distinctTargetFeature
    ? { attackNumber: input.attacksUsed + 1, attacksAllowed: input.attacksUsed + 1, spendsAction: false, weaponOnly: undefined }
    : ordinarySlot
  if (!specialAttack && !attackSlot) return { ok: false, reason: 'attack-action-spent' }
  if (attackSlot?.weaponOnly && (
    handActor.classState.firstOwnTurnWeaponAttack?.featureId !== firstTurnWeaponFeature?.featureId ||
    handActor.classState.firstOwnTurnWeaponAttack?.turnKey !== turnKey
  )) return { ok: false, reason: 'attack-action-spent' }
  const attacksAllowed = attackSlot?.attacksAllowed ?? 1
  const spendsAction = attackSlot?.spendsAction ?? false
  const restrictedWeaponAttackAvailable = dnd5eAvailableRestrictedExtraActionKinds({
    effects: actor.dnd5eCombatState?.activeEffects,
    usesByEffect: actor.dnd5eCombatState?.restrictedExtraActionUsesByEffect,
    turnKey: input.turnEconomy?.turnKey,
  }).includes('weapon-attack')
  if (
    !specialAttack && spendsAction && input.turnEconomy &&
    input.turnEconomy.action.current < 1 && !restrictedWeaponAttackAvailable
  ) {
    return { ok: false, reason: 'attack-action-spent' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    worldMinute: input.worldMinute,
    worldSecondRemainder: input.worldSecondRemainder,
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
    additionalCreatureTokenIds: [...new Set([targetToken.id, ...(grantOriginId ? [grantOriginId] : []), ...input.additionalCreatureTokenIds ?? []])],
  })
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const target = snapshot.state.combatants[targetToken.id]
  if (actorIndex < 0 || !snapshot.state.combatants[actorToken.id] || !target) return { ok: false, reason: 'combatant-missing' }
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (coverOverride != null) {
    applyDnd5eAttackCoverOverride(snapshot.state, actorToken.id, targetToken.id, coverOverride)
  }
  const effectiveCover = dnd5eAttackCoverForPair(snapshot.state, actorToken.id, targetToken.id)
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = {
      ...combatant.turn,
      actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current,
    }
  }
  const foeSlayerAttackBonus = foeSlayer
    ? Math.max(0, rules.abilityModifier(actorCombatant.abilities.wis))
    : 0
  if (
    foeSlayer && (
      dnd5eCharacterClassLevel(actor, 'ranger') < 20 || foeSlayerAttackBonus <= 0 ||
      actorCombatant.classState.foeSlayerTurnKey === turnKey || !dnd5eIsFavoredEnemy(actorCombatant, target)
    )
  ) return { ok: false, reason: 'foe-slayer-unavailable' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
    }
  }
  const adjacentEnemyOfTarget = input.map.tokens.some((token) => {
    if (token.id === actorToken.id || token.id === targetToken.id || !areOpposedCombatTokens(token, targetToken)) return false
    const combatant = snapshot.state.combatants[token.id]
    return !!combatant && combatant.currentHp > 0 && tokenDistanceFeet(token, targetToken) <= 5
  })
  const classDamageContext: Dnd5eWeaponClassDamageContext = {
    distinctTargetBonusAttackFeatureId: distinctTargetFeature?.id,
    firstOwnTurnWeaponAttackFeatureId: attackSlot?.weaponOnly ? firstTurnWeaponFeature?.featureId : undefined,
    unarmedStrike: naturalProfile != null,
    monkWeapon: !naturalProfile && equippedWeapon?.dnd5e?.kind === 'weapon' && dnd5eMonkWeapon(actor,equippedWeapon),
    spellAttack:!naturalProfile && equippedWeapon?.dnd5e?.kind==='weapon' && equippedWeapon.dnd5e.usesSourceSpellcastingAbility===true,
    spellDeliveredByWeapon:action.dnd5eWeaponAttackOptions?.useSling===true,
    weaponId: profile.weaponId,
    weaponBaseId: profile.baseWeaponId,
    weaponCategory: !naturalProfile && equippedWeapon?.dnd5e?.kind === 'weapon' ? equippedWeapon.dnd5e.category : undefined,
    weaponProperties: [...dnd5eWeaponPropertyIds(profile.properties)],
    proficient: profile.proficient,
    handsUsed: profile.handsUsed,
    mode: profile.mode,
    distanceFeet,
    normalRangeFeet: profile.rangeFeet?.normal,
    longRangeFeet: profile.rangeFeet?.long,
    finesse: profile.finesse,
    strengthBased: profile.attackAbility === 'str',
    monkMartialArtsEligible: dnd5eMonkMartialArtsEligible(actor),
    weaponDamageSides: profile.damage.sides,
    reachFeet: profile.reachFeet,
    damageType: profile.damage.type,
    adjacentEnemyOfTarget,
    divineSmiteSlotLevel,
    recklessAttack,
    frenzyAttack,
    twoWeaponBonusAttack: offHandAttack,
    hordeBreakerEligible: hordeBreakerSelected,
    hordeBreakerAttack,
    stunningStrike,
    foeSlayer,
  }
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const mountedMeleeAdvantage = profile.mode === 'melee' &&
    actorCombatant.mountedMeleeAdvantageAgainstSmallerUnmounted === true &&
    !dnd5eSourceLinkedRelations(snapshot.state, target.id)
      .some((link) => link.effect.relation?.movement === 'source-rides-target') &&
    dnd5eSourceLinkedRelations(snapshot.state, actorCombatant.id).some((link) =>
      link.effect.relation?.movement === 'source-rides-target' &&
      link.target.currentHp > 0 && dnd5eEffectiveSizeRank(link.target) > dnd5eEffectiveSizeRank(target))
  const advantageAllowed = !dnd5ePreventsAttackAdvantage(target)
  const rangedThreatened = profile.mode === 'ranged' && input.map.tokens.some((candidate) => {
    const candidateCombatant = snapshot.state.combatants[candidate.id]
    return candidate.id !== actorToken.id && candidate.type !== 'obstacle' &&
      areOpposedCombatTokens(actorToken, candidate) &&
      dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
      tokenDistanceFeet(actorToken, candidate) <= 5
  })
  const weaponRollEffects = dnd5eActiveAttackRollFlags(actorCombatant.classState.activeEffects, profile.attackAbility, classDamageContext.spellAttack ? 'spell' : 'weapon', classDamageContext.weaponCategory)
  const targetRollEffects = dnd5eActiveTargetLinkedAttackRollFlags(target.classState.activeEffects, actorCombatant.id,
    actorCombatant.creatureType, snapshot.state, { category: classDamageContext.spellAttack ? 'spell' : 'weapon', delivery: profile.mode })
  const attackModeResolution = resolveDnd5eRollMode({
    advantage: [
      ...weaponRollEffects.advantageReasons.map(reason => ({ active: advantageAllowed, reason })),
      ...targetRollEffects.advantageReasons.map(reason => ({ active: advantageAllowed, reason })),
      { active: advantageAllowed && equippedWeapon?.dnd5e?.kind === 'weapon' && equippedWeapon.dnd5e.advantageAgainstUnlitTargets === true && target.illumination != null && target.illumination !== 'bright', reason: '武器对暗光目标具有优势' },
      ...dnd5eTargetAttackAdvantageReasons(target)
        .map((reason) => ({ active: advantageAllowed, reason })),
      { active: advantageAllowed && dnd5eHelpAttackApplies(snapshot.state, actorCombatant, target), reason: '协助动作' },
      { active: advantageAllowed && dnd5eUtilityProjectionAttackAdvantageApplies(snapshot.state, actorCombatant, target), reason: '规则效果提供攻击优势' },
      { active: advantageAllowed && dnd5eNextD20AdvantageApplies(actorCombatant, 'attack'), reason: '下一次 d20 攻击优势' },
      { active: advantageAllowed && actorCombatant.classState.hiddenCheckTotal != null, reason: '攻击者处于隐藏状态' },
      { active: advantageAllowed && (recklessAttack || recklessAlreadyActive), reason: '鲁莽攻击' },
      { active: advantageAllowed && !!target.classState.recklessAttackTurnKey, reason: '目标的鲁莽攻击仍在持续' },
      { active: advantageAllowed && !!target.classState.stunnedByActorId, reason: '目标处于震慑状态' },
      { active: advantageAllowed && dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id), reason: '目标看不见攻击者' },
      { active: advantageAllowed && targetProne && distanceFeet <= 5, reason: '目标倒地且攻击者在 5 尺内' },
      { active: advantageAllowed && dnd5ePendingAllyAttackAdvantage(actorCombatant, target), reason: '盟友能力提供攻击优势' },
      { active: advantageAllowed && dnd5eSourceProximityAttackAdvantage(snapshot.state, actorCombatant, target), reason: '链接来源的距离与视线提供攻击优势' },
      { active: advantageAllowed && dnd5eRageAllyMeleeAdvantage(snapshot.state, actorCombatant, target, profile.mode === 'melee'), reason: '狂暴盟友能力提供近战优势' },
      { active: advantageAllowed && dnd5eOpeningAttackHasAdvantage(snapshot.state, actorCombatant, target), reason: '首击能力提供优势' },
      { active: advantageAllowed && mountedMeleeAdvantage, reason: '骑乘战斗：近战攻击更小的未骑乘目标' },
      { active: advantageAllowed && activityWeaponAttackGranted && activityWeaponAttackGrant?.attackAdvantage === true, reason: '特殊武器攻击优势' },
    ],
    disadvantage: [
      ...weaponRollEffects.disadvantageReasons.map(reason => ({ active: true, reason })),
      ...targetRollEffects.disadvantageReasons.map(reason => ({ active: true, reason })),
      ...dnd5eAttackDisadvantageReasons(snapshot.state, actorToken.id, targetToken.id)
        .map((reason) => ({ active: true, reason })),
      { active: underwater.disadvantage, reason: '水下武器攻击限制' },
      { active: profile.mode === 'ranged' && mapGeometryRangedWeaponAttackDisadvantage({ geometry, map: input.map,
        from: actorToken, to: targetToken,
        fromHeightFeet: dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(actorCombatant)),
        toHeightFeet: dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(target)),
      }), reason: '远程武器攻击轨迹受到区域干扰' },
      { active: (actor.exhaustionLevel ?? 0) >= 3, reason: '3 级或更高力竭' },
      { active: dnd5eWearingUnproficientArmor(actor), reason: '穿着不熟练的护甲' },
      { active: dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant), reason: '恶毒嘲笑' },
      { active: dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant), reason: '攻击者处于恐慌且能看见恐惧源' },
      { active: actorProne, reason: '攻击者处于倒地状态' },
      { active: targetProne && distanceFeet > 5, reason: '目标倒地且攻击距离超过 5 尺' },
      { active: profile.mode === 'ranged' && distanceFeet > (profile.rangeFeet?.normal ?? 0), reason: '远程攻击超过常规射程' },
      { active: rangedThreatened, reason: '远程攻击者 5 尺内有敌人' },
      { active: dnd5eTargetIsDodging(target), reason: '目标正在闪避' },
      { active: dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, targetToken.id), reason: '目标受朦胧术影响' },
      { active: dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id), reason: '攻击者看不见目标' },
      { active: dnd5eSourceMarkedAttackDisadvantage(actorCombatant, target, snapshot.state), reason: '攻击受到标记类能力限制' },
      { active: dnd5eRageAllyProtectionDisadvantage(snapshot.state, actorCombatant, target), reason: '目标受到盟友保护能力影响' },
    ],
  })
  const attackMode = attackModeResolution.mode
  const stunningStrikeResolution = stunningStrike
    ? {
        saveDc: 8 + rules.proficiencyBonus(actor.level) + rules.abilityModifier(actor.abilities.wis),
        saveModifier: target.savingThrowBonuses.con ?? rules.abilityModifier(target.abilities.con),
        saveMode: dnd5eSavingThrowMode(target, 'con', { condition: 'stunned' }),
      }
    : undefined
  const openingAttackRequirement =
    dnd5eOpeningAttackSavingThrowRequirement(
      snapshot.state,
      actorCombatant,
      target,
    )
  return {
    ok: true,
    prepared: {
      action,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: counter ? structuredClone(counter.state) : { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      targetToken,
      profile,
      damageSource,
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      cover: { ...effectiveCover, overriddenByDm: coverOverride != null },
      distanceFeet,
      attackNumber: specialAttack ? 1 : input.attacksUsed + 1,
      attacksAllowed,
      attackBudget: specialAttack || distinctTargetFeature ? undefined : attackBudget,
      spendsAction,
      spendsBonusAction: frenzyAttack || offHandAttack || featureBonusWeaponAttack ||
        (activityWeaponAttackGranted && activityWeaponAttackGrant?.economy === 'bonus-action'),
      countsTowardAttackAction: !specialAttack,
      savingThrowCounterattackFeatureId: counter?.featureId,
      attackMode,
      attackModeResolution,
      declarativeIntentFeatureIds: [...declarativeIntentFeatureIds],
      classDamageContext,
      stunningStrike: stunningStrikeResolution ? {
        ...stunningStrikeResolution,
        blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bless'),
        baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bane'),
      } : undefined,
      openingAttackSavingThrow: openingAttackRequirement ? {
        featureId: openingAttackRequirement.featureId,
        ability: openingAttackRequirement.ability,
        dc: openingAttackRequirement.dc,
        saveModifier: target.savingThrowBonuses[openingAttackRequirement.ability] ??
          rules.abilityModifier(target.abilities[openingAttackRequirement.ability]),
        saveMode: dnd5eSavingThrowMode(
          target,
          openingAttackRequirement.ability,
        ),
        blessed: dnd5eCombatantHasConcentrationEffect(
          snapshot.state,
          target.id,
          'bless',
        ),
        baned: dnd5eCombatantHasConcentrationEffect(
          snapshot.state,
          target.id,
          'bane',
        ),
        failureDamageMultiplier:
          openingAttackRequirement.failureDamageMultiplier,
      } : undefined,
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, target, snapshot.state),
      foeSlayerAttackBonus: foeSlayer === 'attack' ? foeSlayerAttackBonus : 0,
      offHandAttack,
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    },
  }
}

export function dnd5eAttackModeWithProtection(
  mode: PreparedDnd5eEquipmentAttack['attackMode'],
  protectedAttack: boolean,
): PreparedDnd5eEquipmentAttack['attackMode'] {
  return protectedAttack ? imposeDnd5eRollDisadvantage(mode, 'protection').mode : mode
}

export function dnd5ePreparedEquipmentAttackMode(
  prepared: PreparedDnd5eEquipmentAttack,
  protectedAttack: boolean,
): PreparedDnd5eEquipmentAttack['attackMode'] {
  return dnd5ePreparedEquipmentAttackModeResolution(prepared, protectedAttack).mode
}

export function dnd5ePreparedEquipmentAttackModeResolution(
  prepared: PreparedDnd5eEquipmentAttack,
  protectedAttack: boolean,
): Dnd5eRollModeResolution {
  const baseResolution = prepared.attackModeResolution ?? resolveDnd5eRollMode({
    advantage: [{ active: prepared.attackMode === 'advantage', reason: 'Headless 攻击上下文判定' }],
    disadvantage: [{ active: prepared.attackMode === 'disadvantage', reason: 'Headless 攻击上下文判定' }],
  })
  const nextAttackAdvantageIntent = prepared.declarativeIntentFeatureIds.some((featureId) =>
    dnd5eDeclarativeCombatManeuverDefinition(featureId)?.mechanic.operation === 'next-attack-advantage'
  )
  const resolution = resolveDnd5eRollMode({
    advantage: [
      ...baseResolution.advantageReasons.map((reason) => ({ active: true, reason })),
      { active: nextAttackAdvantageIntent, reason: '战技令下一次攻击具有优势' },
      { active: !!prepared.areaAttackAdvantageReaction && !dnd5ePreventsAttackAdvantage(prepared.state.combatants[prepared.targetToken.id]) &&
        dnd5eAreaAttackAdvantageCandidates(prepared.state, prepared.targetToken.id).some(candidate =>
          candidate.areaId === prepared.areaAttackAdvantageReaction?.areaId && candidate.sourceId === prepared.areaAttackAdvantageReaction?.sourceId),
        reason: '区域来源者消耗反应授予优势' },
    ],
    disadvantage: [
      ...baseResolution.disadvantageReasons.map((reason) => ({ active: true, reason })),
      { active: protectedAttack, reason: '保护战斗风格' },
    ],
  })
  const exchangesAdvantage = prepared.declarativeIntentFeatureIds.some(featureId =>
    dnd5eDeclarativeAttackIntentDefinition(featureId)?.feature.declarativeAbility?.mechanic?.kind === 'advantage-for-extra-attack')
  // Keep the original sources on the prepared transaction for Host eligibility.
  // Only this attack's roll presentation loses advantage.
  return prepared.disadvantageNegation && resolution.mode === 'disadvantage' || exchangesAdvantage && resolution.mode === 'advantage'
    ? { mode: 'normal', advantageReasons: [], disadvantageReasons: [] }
    : resolution
}

export function preparedDnd5eEquipmentAttackEffectContext(prepared: PreparedDnd5eEquipmentAttack) {
  const actor=prepared.state.combatants[prepared.actorToken.id]
  return {actorId:actor.id,effects:actor.classState.activeEffects,kind:'attack' as const,
    eventId:dnd5eRollDiceOccurrenceId(prepared.action.id,actor.id,'attack',0)}
}

export function previewDnd5eEquipmentAttack(
  prepared: PreparedDnd5eEquipmentAttack,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
  additionalAttackBonus = 0,
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse,
  effectRollDice?: Readonly<Record<string,readonly number[]>>,
) {
  const mode = dnd5ePreparedEquipmentAttackMode(prepared, protectedAttack)
  const magicWeaponBonus = dnd5ePreparedEquipmentAttackMagicWeaponBonus(prepared)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveAttack({
    rolls,
    mode,
    modifier: prepared.profile.attackModifier + magicWeaponBonus +
      prepared.foeSlayerAttackBonus + (blessRoll ?? 0) - (baneRoll ?? 0) +
      additionalAttackBonus + (effectRollDice ? resolveDnd5eRollDiceModifiers(preparedDnd5eEquipmentAttackEffectContext(prepared),effectRollDice).modifier : 0),
    targetAc: prepared.targetArmorClass,
  })
  return resolveDnd5eAttackOutcome({
    sourceId: prepared.actorToken.id,
    targetEffects: prepared.state.combatants[prepared.targetToken.id]?.classState.activeEffects,
    attack: previewDnd5ePostD20AdjustedAttack({
      state: prepared.state,
      affectedId: prepared.actorToken.id,
      targetId: prepared.targetToken.id,
      attackMode: prepared.profile.mode,
      targetAc: prepared.targetArmorClass,
      resolution: resolved,
      use: postD20Adjustment,
    }),
    criticalThreshold: prepared.profile.criticalThreshold,
    automaticCritical: dnd5ePreparedEquipmentAttackIsAutomaticCritical(prepared),
  })
}

/**
 * Host-authoritative automatic-critical rule for a prepared weapon attack.
 *
 * Keep this separate from the provisional attack preview: an AC-changing
 * interrupt can turn a provisional hit into a miss (or vice versa). The UI
 * must therefore decide the final critical only after all hit adjustments,
 * then build the damage pool from this same predicate that Headless uses.
 */
export function dnd5ePreparedEquipmentAttackIsAutomaticCritical(
  prepared: PreparedDnd5eEquipmentAttack,
): boolean {
  const actor = prepared.state.combatants[prepared.actorToken.id]
  const target = prepared.state.combatants[prepared.targetToken.id]
  if (!actor || !target) return false
  return dnd5eConditionHitIsAutomaticCritical({
    target,
    distanceFeet: prepared.distanceFeet,
  }) || dnd5eOpeningAttackIsAutomaticCritical(
    prepared.state,
    actor,
    target,
  )
}

/**
 * Authoritative Magic Weapon bonus for the exact weapon captured by a prepared
 * equipment attack. Presentation and interrupt code must use this accessor too;
 * otherwise Headless applies the bonus while the dice ledger and combat log
 * incorrectly continue to display the mundane weapon modifier.
 */
export function dnd5ePreparedEquipmentAttackMagicWeaponBonus(
  prepared: PreparedDnd5eEquipmentAttack,
): 0 | 1 | 2 | 3 {
  return dnd5eActiveMagicWeaponBonus(
    prepared.state.combatants[prepared.actorToken.id]?.classState.activeEffects,
    prepared.classDamageContext.weaponId,
  )
}

/** Host snapshot for replacing an attack with an Activity, without an attack roll. */
export function dnd5ePreparedEquipmentActivityWeaponDamage(
  prepared: PreparedDnd5eEquipmentAttack,
): import('./activities/dnd5eEquipmentWeaponDamage').Dnd5eEquipmentWeaponDamageSnapshot {
  return {
    homingReached: prepared.homingProjectileReached,
    profile: { ...prepared.profile, damage: { ...prepared.profile.damage,
      bonus: prepared.profile.damage.bonus + dnd5ePreparedEquipmentAttackMagicWeaponBonus(prepared),
    } },
    source: { ...prepared.damageSource },
  }
}

export function dnd5eEquipmentClassDamageDefinitions(
  prepared: PreparedDnd5eEquipmentAttack,
  critical: boolean,
  protectedAttack = false,
): readonly Dnd5eClassDamageDefinition[] {
  return dnd5eWeaponClassDamageDefinitions({
    state: prepared.state,
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    context: prepared.classDamageContext,
    effectiveMode: dnd5ePreparedEquipmentAttackMode(prepared, protectedAttack),
    critical,
  })
}

/** Resolve pre-attack landing without requesting or consuming an attack die.
 * The returned preparation retains the original commit baseline until the attack finishes.
 */
export function resolvePreparedDnd5eEquipmentAttackLanding(input: {
  prepared: PreparedDnd5eEquipmentAttack
  arrival?: Dnd5eAttackTeleportArrival
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
  preparedAfterLanding?: PreparedDnd5eEquipmentAttack
} {
  const { prepared } = input
  if (prepared.savingThrowCounterattackFeatureId) return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-plugin-action' },
  }
  const teleport = prepared.attackActionTeleport
  if (teleport) {
    const actor = prepared.state.combatants[prepared.actorToken.id]
    const feature = dnd5ePluginFeaturesAvailableForCharacter(prepared.actor).find(candidate =>
      candidate.id === teleport.featureId && candidate.automation === 'full' &&
      dnd5eCharacterHasPluginFeature(prepared.actor, candidate.id))
    const mechanic = feature?.declarativeAbility?.mechanic
    if (!actor?.pluginFeatureIds.includes(teleport.featureId) || mechanic?.kind !== 'attack-action-teleport' ||
      !prepared.state.active || prepared.state.initiativeOrder[prepared.state.initiativeIndex] !== actor.id ||
      !prepared.countsTowardAttackAction || prepared.spendsBonusAction)
      return { result: { ok: false, reason: 'invalid-class-feature', state: structuredClone(teleport.originalState), events: [] } }
    const requested = prepared.action.dnd5eWeaponAttackOptions?.attackActionTeleport
    const destination = requested && prepareDnd5eAttackTeleportDestination({
      map: prepared.map, actorTokenId: actor.id, characters: prepared.characters,
      targetCell: requested.targetCell, targetElevationFeet: requested.elevationFeet,
      rangeFeet: mechanic.rangeFeet, worldMinute: teleport.worldMinute,
    })
    if (!destination?.ok || destination.to.x !== actor.position.x || destination.to.y !== actor.position.y ||
      destination.elevationFeet !== (actor.elevationFeet ?? 0))
      return { result: { ok: false, reason: 'invalid-target', state: structuredClone(teleport.originalState), events: [] } }
    {
      const landing = resolveDnd5eAttackTeleportLanding({ includeSupportedDestination: true,
        arrival: input.arrival, teleport, state: prepared.state, actorId: actor.id,
        map: prepared.map, characters: prepared.characters,
        characterIdByCombatantId: prepared.characterIdByCombatantId,
        rolls: input.airborneFallDamageRollsByCombatantId })!
      if (!landing.ok) return { result: landing.result, airborneFalls: landing.falls }
      const precedingEvents = landing.events
      const landingPlan = landing.plan
      const request = teleport.preparationInput
      const resumed = prepareDnd5eEquipmentAttack({ ...request, map: landingPlan.map, characters: landingPlan.characters,
        action: { ...request.action, dnd5eWeaponAttackOptions: {
          ...request.action.dnd5eWeaponAttackOptions, attackActionTeleport: undefined } } })
      if (!resumed.ok || attackTeleportArrivalConsumedAction(input.arrival, actor.id)) {
        // Landing can kill/incapacitate the attacker or put the target out of
        // reach. Those real consequences must not disappear with the attack.
        if (prepared.spendsAction) {
          landing.state.combatants[actor.id].turn.actionAvailable = false
          precedingEvents.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
        }
        return { result: { ok: true, state: landing.state, events: precedingEvents },
          application: planDnd5eMapResultApplication({ state: landing.state,
            map: { ...prepared.map, dnd5ePluginAreas: landingPlan.map.dnd5ePluginAreas },
            characters: landingPlan.characters, baselineCharacters: prepared.characters,
            characterIdByCombatantId: prepared.characterIdByCombatantId, events: precedingEvents }) }
      }
      return { result: { ok: true, state: landing.state, events: precedingEvents },
        preparedAfterLanding: { ...resumed.prepared, attackTeleportPrelude: {
          originalState: teleport.originalState, map: prepared.map, characters: prepared.characters,
          events: precedingEvents,
        } } }

    }
  }
  return { result: { ok: true, state: prepared.state, events: [] }, preparedAfterLanding: prepared }
}

export function resolvePreparedDnd5eEquipmentAttack(input: {
  shieldSpellcastingSavingThrows?: Readonly<Record<string, readonly import('./headlessCombatEngine').Dnd5eSpellcastingSavingThrowRoll[]>>
  effectRollDice?: Readonly<Record<string,readonly number[]>>
  prepared: PreparedDnd5eEquipmentAttack
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  savageAttacksRoll?: number
  wholeWeaponDamageReroll?: Dnd5eWholeWeaponDamageRerollUse
  missedWeaponAttackReroll?: { featureId: string; d20: number; dieIndex: 0 | 1; shieldSpellReaction?: boolean; grantedDieArmorClassRoll?: number }
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  grantedDieWeaponDamageRoll?: number
  grantedDieArmorClassRoll?: number
  strokeOfLuck?: boolean
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse
  attackRetargetInterrupt?: Dnd5eAttackRetargetInterruptUse
  mountedAttackRedirect?: Dnd5eMountedAttackRedirectUse
  areaAttackAdvantageReaction?: { areaId: string; sourceId: string }
  protectionReactionActorId?: string
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  deflectMissilesD10?: number
  stunningStrikeSaveD20?: number
  stunningStrikeSaveD20Second?: number
  stunningStrikeSaveHalflingLuckyD20?: number
  stunningStrikeSaveHalflingLuckyD20Second?: number
  stunningStrikeSaveBlessRoll?: number
  stunningStrikeSaveBaneRoll?: number
  stunningStrikeSaveRerollResourceKey?: string; stunningStrikeSaveRerollD20?: number
  stunningStrikeSaveRerollD20Second?: number
  stunningStrikeBardicInspirationRoll?: number
  stunningStrikeDarkOnesOwnLuckRoll?: number
  openingAttackSavingThrow?: Dnd5eOpeningAttackSavingThrowRoll
  hurlThroughHellDamageRolls?: readonly number[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
  declarativeIntentRolls?: Readonly<Record<string, Readonly<Record<string, Dnd5ePluginDiceRollResult>>>>
  declarativeIntentPayloads?: Readonly<Record<string, Dnd5eCombatManeuverAttackIntentPayload>>
  declarativeTargetReaction?: Dnd5eCombatManeuverTargetReaction
  damageRolls: readonly number[]
  classDamageRolls?: readonly Dnd5eClassDamageRolls[]
  inventoryEffectRolls?: Readonly<Record<string, readonly number[]>>
  damageMitigationInterrupts?: readonly Dnd5eDamageMitigationInterruptUse[]
  transaction?: CombatTransaction
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} {
  const { prepared } = input
  const prelude = prepared.attackTeleportPrelude
  if (prepared.savingThrowCounterattackFeatureId) return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-plugin-action' },
  }
  if (prelude) {
    const continuation = resolvePreparedDnd5eEquipmentAttack({ ...input,
      prepared: { ...prepared, attackTeleportPrelude: undefined } })
    if (!continuation.result.ok) return { ...continuation,
      result: { ...continuation.result, state: structuredClone(prelude.originalState), events: [] } }
    const events = [...prelude.events, ...continuation.result.events]
    return { ...continuation, result: { ...continuation.result, events },
      application: planDnd5eMapResultApplication({ state: continuation.result.state,
        // Keep the original token baseline for movement patches, but retain
        // area changes and trigger receipts accumulated after arrival.
        map: { ...prelude.map, dnd5ePluginAreas: (continuation.application?.map ?? prepared.map).dnd5ePluginAreas },
        characters: continuation.application?.characters ?? prepared.characters, baselineCharacters: prelude.characters,
        characterIdByCombatantId: prepared.characterIdByCombatantId, events }) }
  }
  const teleport = prepared.attackActionTeleport
  if (teleport) {
    const landing = resolvePreparedDnd5eEquipmentAttackLanding(input)
    if (!landing.preparedAfterLanding) return landing
    if (landing.preparedAfterLanding !== prepared) {
      const fallIds = new Set(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
        teleport.originalState, prepared.state, [prepared.actorToken.id]).flatMap(fall => [fall.combatantId,
          ...(fall.collision ? [fall.collision.rollKey] : fall.collisionCandidates?.map(collision => collision.rollKey) ?? [])]))
      const remaining = input.airborneFallDamageRollsByCombatantId && Object.fromEntries(
        Object.entries(input.airborneFallDamageRollsByCombatantId).filter(([id]) => !fallIds.has(id)))
      return resolvePreparedDnd5eEquipmentAttack({ ...input, prepared: landing.preparedAfterLanding,
        airborneFallDamageRollsByCombatantId: remaining && Object.keys(remaining).length ? remaining : undefined })
    }
  }
  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, buildPreparedDnd5eEquipmentAttackAction(input), input.airborneFallDamageRollsByCombatantId, { transaction: input.transaction,transactionId:prepared.action.id })
  if (!result.ok) return { result: teleport ? { ...result, state: structuredClone(teleport.originalState), events: [] } : result, airborneFalls }
  if (teleport) {
    // This is the pre-attack destination, before any resulting fall or reaction.
    const destination = prepared.state.combatants[prepared.actorToken.id]
    result.events = [{ type: 'teleported', actorId: prepared.actorToken.id,
      spellId: teleport.featureId, from: { ...teleport.from }, to: { ...destination.position },
      distanceFeet: teleport.distanceFeet, fromElevationFeet: teleport.fromElevationFeet,
      toElevationFeet: destination.elevationFeet ?? 0 }, ...result.events]
  }
  const grantId = prepared.action.dnd5eWeaponAttackOptions?.activityWeaponAttackGrantId
  const reusesProjectile = grantId && prepared.state.combatants[prepared.actorToken.id].classState.activityWeaponAttackGrants?.[grantId]?.reusedProjectileWeaponId === prepared.profile.weaponId
  const ammunition = reusesProjectile ? {ok: true as const, character: prepared.actor, instanceId: undefined}
    : consumeDnd5eWeaponAmmunition(prepared.actor, prepared.profile.weaponId)
  const released = ammunition.ok && prepared.profile.mode === 'ranged' && prepared.profile.properties.some(property => property === 'thrown' || property.includes('投掷'))
    ? releaseDnd5eTemporaryWeapon(ammunition.character,prepared.profile.weaponId) : ammunition.character
  const characters = ammunition.ok
    ? prepared.characters.map((character) => character.id === prepared.actor.id ? released : character)
    : prepared.characters
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: prepared.map,
    characters,
    characterIdByCombatantId: prepared.characterIdByCombatantId,
    events: [...result.events],
  })
  if (ammunition.ok && ammunition.instanceId && !application.changedCharacterIds.includes(prepared.actor.id)) {
    application.changedCharacterIds = [...application.changedCharacterIds, prepared.actor.id]
  }
  if (released !== prepared.actor) {
    if (!application.changedCharacterIds.includes(prepared.actor.id)) application.changedCharacterIds=[...application.changedCharacterIds,prepared.actor.id]
    const updated = application.characters.find(character => character.id === prepared.actor.id)!
    application.characterPatches = {...application.characterPatches,[prepared.actor.id]:{
      ...application.characterPatches?.[prepared.actor.id],dnd5eInventory:updated.dnd5eInventory,equipment:updated.equipment,
    }}
  }
  return {
    result,
    application,
    airborneFalls,
  }
}


/** Build Host weapon dice/profile input without publishing state or spending ammunition. */
export function buildPreparedDnd5eEquipmentAttackAction(
  input: Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0],
): Extract<Dnd5eAction, { type: 'attack' }> {
  const { prepared } = input
  return {
    type: 'attack',
    effectRollDice:input.effectRollDice,
    attackDecoyRolls: input.attackDecoyRolls,
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    attackModifier: prepared.profile.attackModifier,
    criticalThreshold: prepared.profile.criticalThreshold,
    spendAction: prepared.spendsAction,
    spendBonusAction: prepared.spendsBonusAction,
    featureBonusWeaponAttack:
      prepared.action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttack === true,
    featureBonusWeaponAttackId:
      prepared.action.dnd5eWeaponAttackOptions?.featureBonusWeaponAttackId,
    activityWeaponAttackGrantId:
      prepared.action.dnd5eWeaponAttackOptions?.activityWeaponAttackGrantId,
    activityWeaponAttackWeaponSlot:
      prepared.action.dnd5eWeaponAttackOptions?.activityWeaponAttackWeaponSlot,
    d20: input.d20,
    d20Second: input.d20Second,
    halflingLuckyD20: input.halflingLuckyD20,
    halflingLuckyD20Second: input.halflingLuckyD20Second,
    savageAttacksRoll: input.savageAttacksRoll,
    wholeWeaponDamageReroll: input.wholeWeaponDamageReroll,
    missedWeaponAttackReroll: input.missedWeaponAttackReroll,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    bardicInspirationRoll: input.bardicInspirationRoll,
    grantedDieWeaponDamageRoll: input.grantedDieWeaponDamageRoll,
    grantedDieArmorClassRoll: input.grantedDieArmorClassRoll,
    strokeOfLuck: input.strokeOfLuck,
    cuttingWords: input.cuttingWords,
    cuttingWordsDamage: input.cuttingWordsDamage,
    postD20Adjustment: input.postD20Adjustment,
    attackRetargetInterrupt: input.attackRetargetInterrupt,
    mountedAttackRedirect: input.mountedAttackRedirect,
    areaAttackAdvantageReaction: input.areaAttackAdvantageReaction ?? prepared.areaAttackAdvantageReaction,
    protectionReactionActorId: input.protectionReactionActorId,
    tranquilitySave: input.tranquilitySave,
    shieldSpellReaction: input.shieldSpellReaction,
    shieldSpellcastingSavingThrows: input.shieldSpellcastingSavingThrows,
    uncannyDodge: input.uncannyDodge,
    deflectMissilesD10: input.deflectMissilesD10,
    stunningStrikeSaveD20: input.stunningStrikeSaveD20,
    stunningStrikeSaveD20Second: input.stunningStrikeSaveD20Second,
    stunningStrikeSaveHalflingLuckyD20: input.stunningStrikeSaveHalflingLuckyD20,
    stunningStrikeSaveHalflingLuckyD20Second: input.stunningStrikeSaveHalflingLuckyD20Second,
    stunningStrikeSaveBlessRoll: input.stunningStrikeSaveBlessRoll,
    stunningStrikeSaveBaneRoll: input.stunningStrikeSaveBaneRoll,
    stunningStrikeSaveRerollResourceKey: input.stunningStrikeSaveRerollResourceKey, stunningStrikeSaveRerollD20: input.stunningStrikeSaveRerollD20,
    stunningStrikeSaveRerollD20Second: input.stunningStrikeSaveRerollD20Second,
    stunningStrikeBardicInspirationRoll: input.stunningStrikeBardicInspirationRoll,
    stunningStrikeDarkOnesOwnLuckRoll: input.stunningStrikeDarkOnesOwnLuckRoll,
    openingAttackSavingThrow: input.openingAttackSavingThrow,
    hurlThroughHellDamageRolls: input.hurlThroughHellDamageRolls,
    standAgainstTide: input.standAgainstTide,
    declarativeIntentFeatureIds: prepared.declarativeIntentFeatureIds,
    declarativeIntentRolls: input.declarativeIntentRolls,
    declarativeIntentPayloads: input.declarativeIntentPayloads,
    declarativeTargetReaction: input.declarativeTargetReaction,
    mode: prepared.attackMode,
    disadvantageNegation: prepared.disadvantageNegation,
    classDamageContext: prepared.classDamageContext,
    classDamageRolls: input.classDamageRolls,
    inventoryEffectRolls: input.inventoryEffectRolls,
    damageMitigationInterrupts: input.damageMitigationInterrupts,
    damage: {
      count: prepared.profile.damage.count,
      sides: prepared.profile.damage.sides,
      bonus: prepared.profile.damage.bonus,
      rolls: input.damageRolls,
      type: prepared.profile.damage.type,
    },
  }
}
