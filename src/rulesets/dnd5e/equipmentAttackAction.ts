import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { CombatTransaction } from '../../lib/combatTransaction'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eAttackOutcome } from './attackResolution'
import { dnd5eConditionHitIsAutomaticCritical } from './conditions'
import {
  dnd5eMonkMartialArtsEligible,
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
import { consumeDnd5eWeaponAmmunition } from './items'
import { mapGeometryOrdinaryProjectileBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { dnd5eUnderwaterWeaponAttack } from './environmentRules'
import { dnd5eMartialSpellBonusAttackAvailable } from './martialSpellSynergy'
import {
  dnd5eActiveAttackProfileRewrite,
  dnd5eActiveEnvironmentalCapabilities,
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
  | 'divine-smite-unavailable'
  | 'reckless-attack-unavailable'
  | 'frenzy-attack-unavailable'
  | 'off-hand-attack-unavailable'
  | 'horde-breaker-unavailable'
  | 'stunning-strike-unavailable'
  | 'foe-slayer-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eEquipmentAttack {
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
  spendsAction: boolean
  spendsBonusAction: boolean
  countsTowardAttackAction: boolean
  attackMode: 'normal' | 'advantage' | 'disadvantage'
  attackModeResolution?: Dnd5eRollModeResolution
  declarativeIntentFeatureIds: readonly string[]
  classDamageContext: Dnd5eWeaponClassDamageContext
  stunningStrike?: {
    saveDc: number
    saveModifier: number
    saveMode: 'normal' | 'disadvantage'
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

export function prepareDnd5eEquipmentAttack(input: {
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
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
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
  if (!targetToken || targetToken.id === actorToken.id || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
  const turnSlotId = input.initiativeOrder[action.initiativeIndex]?.slotId
  const turnKey = `${action.combatId ?? `map-${input.map.id}`}:${Math.max(1, action.round)}:${turnSlotId ?? actorToken.id}`
  const offHandAttack = action.dnd5eWeaponAttackOptions?.offHandAttack === true
  const activityWeaponAttackGrantId = action.dnd5eWeaponAttackOptions?.activityWeaponAttackGrantId
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
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
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
  const baseProfile = offHandAttack
    ? dnd5eOffHandWeaponAttackProfile(actor)
    : dnd5eWeaponAttackProfile(actor, {
        shillelaghAbility,
        forceOneHanded: maintainedGrapples > 0,
        weaponSlot: selectedWeaponSlot,
      })
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
  const equippedWeapon = offHandAttack ? actor.equipment?.offHand : actor.equipment?.[selectedWeaponSlot]
  const persistedDamageSource = dnd5eWeaponDamageSource(equippedWeapon) ??
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
  if (!consumeDnd5eWeaponAmmunition(actor, profile.weaponId).ok) return { ok: false, reason: 'ammunition-unavailable' }
  if (
    offHandAttack && (
      input.attacksUsed < 1 || (input.turnEconomy?.bonusAction.current ?? 1) < 1 ||
      action.dnd5eWeaponAttackOptions?.frenzyAttack || action.dnd5eWeaponAttackOptions?.hordeBreakerAttack
    )
  ) return { ok: false, reason: 'off-hand-attack-unavailable' }
  const distanceFeet = tokenDistanceFeet(actorToken, targetToken)
  const extendedReachIntent = action.dnd5eWeaponAttackOptions?.declarativeIntentFeatureIds?.some((featureId) =>
    dnd5eDeclarativeCombatManeuverDefinition(featureId)?.mechanic.operation === 'extended-reach'
  ) === true
  const effectiveRangeFeet = dnd5eWeaponRangeFeet(profile) +
    (profile.mode === 'melee' && extendedReachIntent ? 5 : 0)
  if (distanceFeet > effectiveRangeFeet) return { ok: false, reason: 'target-out-of-range' }
  const underwater = dnd5eUnderwaterWeaponAttack({
    environment: geometry?.environment,
    weaponId: profile.weaponId,
    mode: profile.mode,
    distanceFeet,
    normalRangeFeet: profile.rangeFeet?.normal,
    hasSwimmingSpeed: (actor.dnd5eMovementSpeeds?.swim ?? 0) > 0 ||
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
  const activityWeaponAttackGrant = activityWeaponAttackGrantId
    ? actor.dnd5eCombatState?.activityWeaponAttackGrants?.[activityWeaponAttackGrantId]
    : undefined
  const activityWeaponAttackGranted = activityWeaponAttackGrantId != null &&
    dnd5eActivityWeaponAttackGrantMatchesV1(activityWeaponAttackGrant, turnKey, {
      weaponId: profile.weaponId,
      baseWeaponId: profile.baseWeaponId,
      mode: profile.mode,
      weaponProperties: dnd5eWeaponPropertyIds(profile.properties),
      proficient: profile.proficient,
    }, activityWeaponAttackWeaponSlot)
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
      (input.turnEconomy?.bonusAction.current ?? 1) < 1
    )
  ) return { ok: false, reason: 'attack-action-spent' }
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
  const specialAttack = frenzyAttack || hordeBreakerAttack || offHandAttack ||
    featureBonusWeaponAttack || activityWeaponAttackGranted
  const attacksPerAction = dnd5eEffectiveAttacksPerAttackAction(actor)
  const weaponAttacksPerAction = loadingWeapon ? 1 : attacksPerAction
  const attacksAllowed = specialAttack ? 1 : weaponAttacksPerAction * Math.max(1, Math.floor(input.attackActionsAvailable ?? 1))
  if (!specialAttack && input.attacksUsed >= attacksAllowed) return { ok: false, reason: 'attack-action-spent' }
  const spendsAction = !specialAttack && input.attacksUsed % weaponAttacksPerAction === 0
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
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
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
    weaponId: profile.weaponId,
    weaponBaseId: profile.baseWeaponId,
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
  const attackModeResolution = resolveDnd5eRollMode({
    advantage: [
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
      { active: advantageAllowed && dnd5eRageAllyMeleeAdvantage(snapshot.state, actorCombatant, target, profile.mode === 'melee'), reason: '狂暴盟友能力提供近战优势' },
      { active: advantageAllowed && dnd5eOpeningAttackHasAdvantage(snapshot.state, actorCombatant, target), reason: '首击能力提供优势' },
      { active: advantageAllowed && mountedMeleeAdvantage, reason: '骑乘战斗：近战攻击更小的未骑乘目标' },
    ],
    disadvantage: [
      ...dnd5eAttackDisadvantageReasons(snapshot.state, actorToken.id, targetToken.id)
        .map((reason) => ({ active: true, reason })),
      { active: underwater.disadvantage, reason: '水下武器攻击限制' },
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
      { active: dnd5eSourceMarkedAttackDisadvantage(actorCombatant, target), reason: '攻击受到标记类能力限制' },
      { active: dnd5eRageAllyProtectionDisadvantage(snapshot.state, actorCombatant, target), reason: '目标受到盟友保护能力影响' },
    ],
  })
  const attackMode = attackModeResolution.mode
  const stunningStrikeResolution = stunningStrike
    ? {
        saveDc: 8 + rules.proficiencyBonus(actor.level) + rules.abilityModifier(actor.abilities.wis),
        saveModifier: target.savingThrowBonuses.con ?? rules.abilityModifier(target.abilities.con),
        saveMode: target.exhaustionLevel >= 3 ? 'disadvantage' as const : 'normal' as const,
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
      state: { ...snapshot.state, initiativeIndex: actorIndex },
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
      spendsAction,
      spendsBonusAction: frenzyAttack || offHandAttack || featureBonusWeaponAttack || activityWeaponAttackGranted,
      countsTowardAttackAction: !specialAttack,
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
  return resolveDnd5eRollMode({
    advantage: [
      ...baseResolution.advantageReasons.map((reason) => ({ active: true, reason })),
      { active: nextAttackAdvantageIntent, reason: '战技令下一次攻击具有优势' },
    ],
    disadvantage: [
      ...baseResolution.disadvantageReasons.map((reason) => ({ active: true, reason })),
      { active: protectedAttack, reason: '保护战斗风格' },
    ],
  })
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
) {
  const mode = dnd5ePreparedEquipmentAttackMode(prepared, protectedAttack)
  const magicWeaponBonus = dnd5ePreparedEquipmentAttackMagicWeaponBonus(prepared)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveAttack({
    rolls,
    mode,
    modifier: prepared.profile.attackModifier + magicWeaponBonus +
      prepared.foeSlayerAttackBonus + (blessRoll ?? 0) - (baneRoll ?? 0) +
      additionalAttackBonus,
    targetAc: prepared.targetArmorClass,
  })
  return resolveDnd5eAttackOutcome({
    attack: previewDnd5ePostD20AdjustedAttack({
      state: prepared.state,
      affectedId: prepared.actorToken.id,
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

export function resolvePreparedDnd5eEquipmentAttack(input: {
  prepared: PreparedDnd5eEquipmentAttack
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  savageAttacksRoll?: number
  wholeWeaponDamageReroll?: Dnd5eWholeWeaponDamageRerollUse
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
  stunningStrikeSaveRerollD20?: number
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
  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'attack',
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
    protectionReactionActorId: input.protectionReactionActorId,
    tranquilitySave: input.tranquilitySave,
    shieldSpellReaction: input.shieldSpellReaction,
    uncannyDodge: input.uncannyDodge,
    deflectMissilesD10: input.deflectMissilesD10,
    stunningStrikeSaveD20: input.stunningStrikeSaveD20,
    stunningStrikeSaveD20Second: input.stunningStrikeSaveD20Second,
    stunningStrikeSaveHalflingLuckyD20: input.stunningStrikeSaveHalflingLuckyD20,
    stunningStrikeSaveHalflingLuckyD20Second: input.stunningStrikeSaveHalflingLuckyD20Second,
    stunningStrikeSaveBlessRoll: input.stunningStrikeSaveBlessRoll,
    stunningStrikeSaveBaneRoll: input.stunningStrikeSaveBaneRoll,
    stunningStrikeSaveRerollD20: input.stunningStrikeSaveRerollD20,
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
  }, input.airborneFallDamageRollsByCombatantId, { transaction: input.transaction })
  if (!result.ok) return { result, airborneFalls }
  const ammunition = consumeDnd5eWeaponAmmunition(prepared.actor, prepared.profile.weaponId)
  const characters = ammunition.ok
    ? prepared.characters.map((character) => character.id === prepared.actor.id ? ammunition.character : character)
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
  return {
    result,
    application,
    airborneFalls,
  }
}
