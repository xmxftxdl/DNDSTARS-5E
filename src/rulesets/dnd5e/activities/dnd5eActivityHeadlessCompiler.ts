import { dnd5eActivityRetainedSaveDiceHooks } from './dnd5eActivityRetainedSaveDice'
import { recordDnd5eDeclaredDamageTraitReport } from '../damageTraitReport'
import { bindDnd5eApplicationEffectLinks } from './dnd5eApplicationEffectLinks'
import { dnd5eActorEtherealAccess } from '../etherealAccess'
import { createDnd5eActivityNegationSession } from './dnd5eActivityDisadvantageNegation'
import { recordDnd5eTargetLocation } from '../knownCreatureLocations'
import { planDnd5ePlanarPortalReport, recordDnd5ePlanarPortalReport } from '../planarPortalReport'
import { dnd5eMonsterHitDiceMaximum } from './dnd5eMonsterHitDice'
import { claimDnd5eNextAttackVulnerability, settleDnd5eCriticalCancellationCheckpoint, dnd5eDeclarativeSummonedCreatureBonuses } from '../headlessCombatEngine'
import {recognizeDnd5eGrantingDisguise} from '../disguiseRecognition'
import { dnd5eActivityMappedRockOrigin } from '../persistentAreaObjectOrigin'
import { dnd5eInterruptedFeatureSpellActivity } from './dnd5eInterruptedFeatureSpell'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'
import { dnd5eCombatantEnvironmentalImmunities } from '../environmentalProtection'
import { dnd5eCarriedLoadPreventsMovement } from '../carryingCapacity'
import { dnd5eActivityDmChoicesAuthorizedV1 } from './dnd5eActivityDmChoices'
import { dnd5eActivityDamagePathAmount } from '../activityDamagePath'
import { dnd5eActivePerceivesVisibleCreaturesAsHostile } from '../activeEffects'
import { dnd5eCombatantPerceivesHostile } from '../headlessCombatEngine'
import { dnd5eCombatantCanSee } from '../headlessCombatEngine'
import { dnd5eCanReceiveCreatedWeaponsInHand } from '../headlessCombatEngine'
import { dnd5eUndeadCreationIsProtected } from '../undeadCreationProtection'
import { dnd5eActivityAttackDamageRollBudgets, dnd5eAttackDamageRollBudgets } from '../attackDamageRollBudget'
import { dnd5eActiveCharmSourceIds } from '../sourceCharmEligibility'
import { dnd5eRestorableOriginalAlignment } from '../alignmentRestoration'
import { bindDnd5eCohortEffectProposals } from '../cohortArmorClass'
import { bindDnd5eBenefitHistoryRecipients } from '../benefitHistoryRenewal'
import type { Dnd5eCombatEvent } from '../headlessCombatEngine'
import { dnd5eTargetDamageRollBonus } from '../targetDamageRollBonus'
import { grantedDamageSource } from '../headlessCombatEngine'
import { dnd5eTargetCriticalThreshold } from '../targetCriticalThreshold'
import { recordDnd5eMeleeAttackTarget } from '../headlessCombatEngine'
import { dnd5eConcentrationDefenseBonus } from '../concentrationDefense'
import { dnd5eActiveSavingThrowProficiencyBonus } from '../activeEffects'
import { dnd5eHeadlessMaximizeHealingDice } from '../headlessCompanionHealing'
import { dnd5eMaximizesSpellHealingAtZeroHp } from '../headlessCombatEngine'
import { dnd5eActivityTargetImmunities } from './dnd5eActivityTargetExclusions'
import { dnd5eHostTargetQualificationsV1, dnd5eHostTargetBodyPartsV1 } from './dnd5eActivityTargetQualifications'
import { dnd5eHostSaveFactsV1 } from './dnd5eActivitySaveFacts'
import { dnd5eActivityHasInventoryExchangeRitualProfile } from './dnd5eInventoryExchangeProfile'
import { dnd5eActivitySequentialCheckModesV1 } from './dnd5eActivitySequentialCheckModes'
import { dnd5eActivityHostActorCheckModeV1 } from './dnd5eActivityHostActorCheckMode'
import { dnd5eOpposedHostRollModes } from './dnd5eActivityOpposedChecks'
import { dnd5eEffectiveSpeed, dnd5eSkillProficiencyRank } from '../headlessCombatEngine'
import { settleDnd5eWitnessedAllyHarm } from '../headlessCombatEngine'
import { dnd5eActivityAttackDefenses } from './dnd5eActivityAttackDefenses'
import { dnd5eActivityCanSpeakAudibly } from './dnd5eActivitySpeech'
import { dnd5eActiveLanguageCapabilities } from '../activeEffects'
import { dnd5eEnchantedInventoryInstanceIds, dnd5eActiveArmorEnchantmentBonus, dnd5eMagicallyEnchantedWeaponIds } from '../activeEffects'
import { dnd5eActivityEffectOriginId } from './dnd5eActivityEffectOrigin'
import { settleDnd5eSummonActivityCapability } from './dnd5eSummonActivitySettlement'
import { shareDnd5eSelfSpellProposals } from './dnd5eSelfSpellSharing'
import { listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import { getDnd5eActivityContinuationV1, prepareDnd5eActivityContinuationV1, finishDnd5eActivityContinuationV1 } from './dnd5eActivityContinuation'
import type { Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { dnd5eClassDefinition } from '../classes'
import { getDnd5eSrdMonster } from '../monsters'
import { dnd5eSummonMatchesDeclaredLimits } from '../summonEligibility'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import { SKILLS } from '../../../lib/dnd'
import { dnd5eCombatantCanHearSource } from '../audibility'
import {
  dnd5eCombatantPairKey,
  dnd5eCombatantCanSpeak,
  type Dnd5eCombatant,
} from '../headlessCombatEngine'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import {
  dnd5eActiveControlledDescent,
  dnd5eActiveFlySpeed,
  dnd5eLimitFlySpeed,
  dnd5eActiveHoverWhileFlying,
} from '../activeEffects'
import type {
  Dnd5ePluginHeadlessActionContext,
  Dnd5ePluginHeadlessActionDefinition,
} from '../plugins/pluginHeadlessContracts'
import type { Dnd5eActivityCheckV1, Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { canSpendDnd5eActivityHitDiceCosts } from '../activityHitDice'
import {
  dnd5eActivityChoiceIsRelevantV1,
  dnd5eActivityOutcomeAllowsChoicesV1,
  dnd5eActivityWithTargetChoicesV1,
} from './dnd5eActivityChoices'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import {
  resolveDnd5eActivity,
  type Dnd5eActivityActorSnapshot,
  type Dnd5eActivityInventoryItemSnapshotV1,
  type Dnd5eActivityCapabilityProposal,
  type Dnd5eResolvedEffectDuration,
} from './dnd5eActivityExecutor'
import {
  collectScaledDnd5eActivityFormulaRollDeclarationsV1,
  dnd5eActivitySubmittedAttackRollIsCriticalV1,
} from './dnd5eActivityRollRecipe'
import type { Dnd5eActivityScalingContextV1 } from './dnd5eActivityScaling'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { normalizeDnd5eMagicMouthConfigV1 } from '../magicMouth'
import { dnd5eActivitySelectsEquipmentItem } from './dnd5eActivityInventorySelection'
import { resolveDnd5eActivityInvocationV1 } from './dnd5eActivityInvocation'
import { dnd5eActivityHostSavingThrowModeV1 } from './dnd5eActivityPerTargetRolls'

export interface Dnd5eActivityHeadlessCompatibility {
  supported: boolean
  reasons: readonly string[]
}

export type Dnd5eActivityManualAdjudicationOperationV1 = Extract<
  Dnd5eActivityDefinitionV1['outcomes'][number]['operations'][number],
  { kind: 'manual-adjudication' }
>

/** Manual boundaries remain data-only and are routed through the shared DM pause. */
export function dnd5eActivityManualAdjudicationOperationsV1(
  activity: Dnd5eActivityDefinitionV1,
  choices?: Readonly<Record<string, string>>,
): readonly Dnd5eActivityManualAdjudicationOperationV1[] {
  return activity.outcomes.flatMap((outcome) =>
    choices != null && !dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices)
      ? []
      : outcome.operations.filter(
          (operation): operation is Dnd5eActivityManualAdjudicationOperationV1 =>
            operation.kind === 'manual-adjudication',
        ))
}

const STANDARD_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

/**
 * Returns the Host dice recipe used by both active and event-triggered Activity
 * execution. Keeping this in one place prevents the workshop preview and the
 * production map runtime from silently asking for different dice.
 */
export function collectDnd5eActivityFormulaRollDeclarationsV1(
  activity: Dnd5eActivityDefinitionV1,
  critical = false,
  scaling?: Dnd5eActivityScalingContextV1,
  choices?: Readonly<Record<string, string>>,
  equipmentWeaponDamage?: import('./dnd5eEquipmentWeaponDamage').Dnd5eEquipmentWeaponDamageSnapshot,
) {
  return collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { critical, scaling, choices, equipmentWeaponDamage, unexpandedProjectileDeclarations: true })
}

export function dnd5eActivityHeadlessCompatibility(
  activity: Dnd5eActivityDefinitionV1,
  options: { outerSpellTransaction?: boolean } = {},
): Dnd5eActivityHeadlessCompatibility {
  const reasons = [...validateDnd5eActivityDefinitionV1(activity)]
  const perProjectile = activity.checks?.some(check => 'perProjectile' in check && check.perProjectile) ||
    activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'damage' && operation.perProjectile))
  if (perProjectile && (activity.legacySource?.kind !== 'spell' || activity.invocation?.kind === 'triggered')) {
    reasons.push('per-projectile dice collection requires an active spell transaction')
  }
  if (activity.castingConstraints && !options.outerSpellTransaction) reasons.push('castingConstraints requires the outer Host spell transaction')
  if (reasons.length === 0) {
    try {
      const formulaIds = new Set(collectDnd5eActivityFormulaRollDeclarationsV1(activity).map(roll => roll.id))
      for (const check of activity.checks ?? []) {
        if (check.kind === 'random-roll' && check.scope !== 'per-target' && formulaIds.has(check.rollId)) {
          reasons.push(`duplicate shared dice declaration: ${check.rollId}; formula dice already declare this pool; remove an unused random-roll check or use distinct rolls for independent checks`)
        }
      }
    } catch (error) { reasons.push(`invalid formula dice declarations: ${String(error)}`) }
  }
  if (activity.authorityBinding) {
    reasons.push(`Activity delegates to native authority: ${activity.authorityBinding.execution}`)
  }
  const checks = activity.checks ?? []
  for (const check of checks) {
    if (check.kind === 'random-roll') {
      continue
    }
    const actorCheck = check.kind === 'ability-check' || check.kind === 'skill-check' || check.kind === 'concentration-check'
    if (![
      'saving-throw', 'attack-roll', 'ability-check', 'skill-check',
      'concentration-check', 'opposed-ability-check',
    ].includes(check.kind) || (check.scope !== 'per-target' && !actorCheck)) {
      reasons.push(`unsupported plugin Headless check: ${check.kind}/${check.scope ?? 'shared'}`)
    }
  }
  for (const consumption of activity.consumption ?? []) {
    if (
      consumption.kind !== 'action-economy' && consumption.kind !== 'resource' && consumption.kind !== 'hit-die' &&
      consumption.kind !== 'movement' &&
      !(options.outerSpellTransaction && consumption.kind === 'spell-slot')
    ) {
      reasons.push(`unsupported plugin Headless consumption: ${consumption.kind}`)
    }
  }
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) {
      if (operation.kind === 'invoke-activity' || (operation.kind === 'exchange-inventory-items' && !dnd5eActivityHasInventoryExchangeRitualProfile(activity))) reasons.push(`unsupported plugin Headless operation: ${operation.kind}`)
      if (operation.kind === 'resource' && operation.subject !== 'actor') {
        reasons.push('plugin Headless resource operations may only mutate the actor resource ledger')
      }
      if (operation.kind === 'apply-standard-condition' && (
        operation.duration.kind === 'instantaneous' || operation.duration.kind === 'concentration'
      )) reasons.push(`unsupported condition duration: ${operation.duration.kind}`)
    }
  }
  return { supported: reasons.length === 0, reasons }
}

function actorSnapshot(
  combatant: Dnd5eCombatant,
  activitySource?: Dnd5eCombatant,
  state?: import('../headlessCombatEngine').Dnd5eHeadlessCombatState,
): Dnd5eActivityActorSnapshot {
  const resurrectionPenalty = combatant.classState.resurrectionPenalty?.value ?? 0
  const prone = combatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const canRemainAirborne = combatant.movementSpeeds?.hover === true ||
    dnd5eActiveHoverWhileFlying(combatant.classState.activeEffects) || (
    !prone && dnd5eLimitFlySpeed(combatant.classState.activeEffects, Math.max(
      combatant.movementSpeeds?.fly ?? 0,
      dnd5eActiveFlySpeed(combatant.classState.activeEffects) ?? 0,
    )) > 0
  ) || dnd5eActiveControlledDescent(combatant.classState.activeEffects) != null
  return {
    etherealAccess: dnd5eActorEtherealAccess(state, combatant.classState.activeEffects),
    id: combatant.id,
    raging: combatant.classState.raging === true,
    criticalThresholdAgainstSource: dnd5eTargetCriticalThreshold(combatant.classState.activeEffects, activitySource?.id),
    statBlockId: combatant.statBlockId,
    controller: combatant.controller,
    perceivedHostileTargetIds: state && dnd5eActivePerceivesVisibleCreaturesAsHostile(combatant.classState.activeEffects)
      ? Object.keys(state.combatants).filter(id => dnd5eCombatantPerceivesHostile(state, combatant.id, id)) : undefined,
    objectDamageThreshold: combatant.objectDamageThreshold,
    level: combatant.level,
    proficiencyBonus: combatant.proficiencyBonus,
    skillProficiencyRanks: Object.fromEntries(SKILLS.map(skill => [skill.key, dnd5eSkillProficiencyRank(combatant, skill.key)])),
    abilities: { ...combatant.abilities },
    languages:combatant.languages,
    communicationCreatureTypes: combatant.communicationCreatureTypes,
    canSpeakAudibly: dnd5eActivityCanSpeakAudibly(combatant),
    languageCapabilities: dnd5eActiveLanguageCapabilities(combatant.classState.activeEffects),
    classLevels: combatant.classLevels ? Object.fromEntries(
      Object.entries(combatant.classLevels)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ) : undefined,
    currentHp: combatant.currentHp,
    maxHp: combatant.maxHp,
    speed: dnd5eEffectiveSpeed(combatant),
    armorClass: combatant.armorClass + dnd5eConcentrationDefenseBonus(combatant.pluginFeatureIds, combatant.concentrating ? combatant.classState.concentrationSpellId : undefined, 'armorClass'),
    sizeRank: combatant.sizeRank,
    creatureType: combatant.creatureType,
    elevationFeet: combatant.elevationFeet,
    groundElevationFeet: combatant.groundElevationFeet,
    illumination: combatant.illumination,
    airborne: combatant.airborne,
    upwardClearanceFeet: combatant.upwardClearanceFeet,
    canRemainAirborne,
    spellSaveDc: combatant.saveDc,
    spellAttackBonus: combatant.saveDc == null ? undefined : combatant.saveDc - 8,
    // A saved spell DC is the Host-authoritative spellcasting snapshot used by
    // long-lived granted Activities.  Reconstruct the casting ability modifier
    // from DC = 8 + proficiency + ability modifier so formulas such as Arcane
    // Hand's push distance and squeeze damage remain available after the cast.
    spellcastingAbility: (combatant.classId ? dnd5eClassDefinition(combatant.classId)?.spellcasting?.ability : undefined) ?? (combatant.statBlockId ? getDnd5eSrdMonster(combatant.statBlockId)?.spellcasting?.ability : undefined),
    spellcastingAbilityModifier: combatant.saveDc == null
      ? undefined
      : combatant.saveDc - 8 - combatant.proficiencyBonus,
    conditions: combatant.conditions.filter((condition): condition is Dnd5eStandardConditionId =>
      STANDARD_CONDITIONS.has(condition)),
    environmentalImmunities: dnd5eCombatantEnvironmentalImmunities(combatant),
    conditionImmunities: combatant.conditionImmunities.filter(
      (condition): condition is Dnd5eStandardConditionId => STANDARD_CONDITIONS.has(condition),
    ),
    // The generic d20 modifier below applies the resurrection ordeal to every
    // d20 roll. Strip it from saves that already carry the penalty so Activity
    // saving throws receive it exactly once.
    savingThrowModifiers: Object.fromEntries(Object.entries(combatant.savingThrowBonuses)
      .map(([ability, modifier]) => [ability, modifier - resurrectionPenalty + dnd5eConcentrationDefenseBonus(combatant.pluginFeatureIds, combatant.concentrating ? combatant.classState.concentrationSpellId : undefined, 'savingThrows') + dnd5eActiveSavingThrowProficiencyBonus(combatant.classState.activeEffects, ability as keyof typeof combatant.abilities, combatant)])),
    savingThrowProficiencies: [...combatant.savingThrowProficiencies],
    bodyPartPresence: combatant.classState.bodyPartPresence ? { ...combatant.classState.bodyPartPresence } : undefined,
    corpse:combatant.currentHp===0 && (combatant.deathSaves.dead || combatant.classState.deathRound!=null) ? {bodyPresent:combatant.classState.bodyPresent!==false, undeadCreationProtected:dnd5eUndeadCreationIsProtected(combatant.classState.activeEffects)} : undefined,
    ammunitionContainers:combatant.ammunitionContainers,
    rollDiceEffects: structuredClone((combatant.classState.activeEffects ?? []).filter(effect => effect.modifiers?.rollDiceModifiers != null)),
    charmedByActorIds: dnd5eActiveCharmSourceIds(combatant.classState.activeEffects, combatant.magicSuppressed),
    activeEffectDefinitionIds: (combatant.classState.activeEffects ?? []).map((effect) => ({
      definitionId: effect.definitionId,
      sourceActorId: effect.source.actorId,
      sourceCharacterId: effect.source.characterId,
      tags: effect.suspendedBy?.length ? [] : effect.tags,
      suspended: !!effect.suspendedBy?.length,
      spellLevel: effect.source.spellLevel,
    })),
    activeEffectSourceSpellSaveDcs: (combatant.classState.activeEffects ?? []).flatMap((effect) =>
      effect.source.spellSaveDc == null ? [] : [{
        definitionId: effect.definitionId,
        sourceSpellSaveDc: effect.source.spellSaveDc,
      }]),
    abilityCheckModifiers: Object.fromEntries((['str', 'dex', 'con', 'int', 'wis', 'cha'] as const)
      .map((ability) => [ability, Math.floor((combatant.abilities[ability] - 10) / 2)])),
    skillCheckModifiers: Object.fromEntries(SKILLS.map((skill) => {
      const rank = dnd5eSkillProficiencyRank(combatant, skill.key)
      return [skill.key, Math.floor((combatant.abilities[skill.ability] - 10) / 2) +
        combatant.proficiencyBonus * rank]
    })),
    hitPointDice: combatant.hitPointDice?.map(pool => ({ ...pool })),
    hitPointDiceMaximum: combatant.statBlockId
      ? dnd5eMonsterHitDiceMaximum(getDnd5eSrdMonster(combatant.statBlockId)?.hitPoints.dice)
      : undefined,
    resources: Object.fromEntries(Object.entries(combatant.classResources).map(([id, resource]) => [id, {
      current: resource.current,
      maximum: resource.max,
    }])),
    equipment: combatant.activityEquipment ? structuredClone(combatant.activityEquipment) : undefined,
    magicallyEnchantedWeaponIds: dnd5eMagicallyEnchantedWeaponIds(combatant.classState.activeEffects),
    characterId: combatant.classState.wardingBondParticipantCharacterId,
    enchantedInventoryInstanceIds: dnd5eEnchantedInventoryInstanceIds(combatant.classState.activeEffects),
    magicallyEnchantedArmor: dnd5eActiveArmorEnchantmentBonus(combatant.classState.activeEffects, combatant.activityEquipment?.armor) > 0,
    spellcasting: combatant.activitySpellcasting
      ? { ...combatant.activitySpellcasting, classIds: [...combatant.activitySpellcasting.classIds] }
      : undefined,
    successfulSpellSaveNegatesDamage: combatant.successfulSpellSaveNegatesDamage,
    magicSuppressed: combatant.magicSuppressed,
    spellSuppressionAreas: combatant.spellSuppressionAreas?.map((entry) => ({ ...entry })),
    summonedSourceCombatantId: combatant.summonedSourceCombatantId,
    summonedPersistent: combatant.summonedPersistent,
    summonedBondKey:combatant.summonedBondKey,
    summonedSourcePackageId: combatant.summonedSourcePackageId,
    summonedSourceActivityId: combatant.summonedSourceActivityId,
    elementalAdeptDamageTypes: combatant.elementalAdeptDamageTypes
      ? [...combatant.elementalAdeptDamageTypes]
      : undefined,
    maximizeHealingDice: dnd5eHeadlessMaximizeHealingDice(state, combatant),
    maximizeSpellHealingDiceAtZeroHp: dnd5eMaximizesSpellHealingAtZeroHp(combatant),
    d20RollModifier: resurrectionPenalty || undefined,
    canHearActivitySource: activitySource
      ? dnd5eCombatantCanHearSource(combatant, activitySource, state?.mapId)
      : undefined,
  }
}

function pairDistance(context: Dnd5ePluginHeadlessActionContext, targetId: string): number | undefined {
  if (targetId === context.actor.id) return 0
  const hostOriginDistance = context.action.hostDistanceFeetByTargetId?.[targetId]
  if (hostOriginDistance != null) return hostOriginDistance
  const pair = context.actor.id < targetId
    ? `${context.actor.id}\u0000${targetId}`
    : `${targetId}\u0000${context.actor.id}`
  return context.state.distanceFeetByCombatantPair?.[pair]
}

function pluginDuration(duration: Dnd5eResolvedEffectDuration): Dnd5ePluginEffectDuration | undefined {
  if (duration.kind === 'permanent') return { expiresAt: 'permanent' }
  if (duration.kind === 'rounds') {
    if (duration.expiresAt === 'source-turn-start') {
      return { expiresAt: 'source-next-turn-start', remainingRounds: duration.rounds }
    }
    if (duration.expiresAt === 'source-turn-end') {
      return { expiresAt: 'source-turn-end', remainingRounds: duration.rounds, includeCreationTurn: duration.includeCreationTurn }
    }
    if (duration.expiresAt === 'target-turn-start') {
      return { expiresAt: 'target-next-turn-start', remainingRounds: duration.rounds }
    }
    return { expiresAt: 'target-turn-end', remainingRounds: duration.rounds, includeCreationTurn: duration.includeCreationTurn }
  }
  if (duration.kind === 'save-ends') return {
    expiresAt: 'target-turn-end-save', remainingRounds: duration.maximumRounds,
    saveAbility: duration.ability, saveDc: duration.dc,
  }
  return undefined
}

function failureReason(
  reason: string,
  activity?: Dnd5eActivityDefinitionV1,
): Parameters<Dnd5ePluginHeadlessActionContext['fail']>[0] {
  if (reason === 'invalid-rolls') return 'invalid-dice'
  if (reason === 'invalid-target') return 'invalid-target'
  if (
    reason === 'requirement-failed' &&
    activity?.legacySource?.kind === 'spell' &&
    activity.legacySource.id === 'imprisonment'
  ) return 'invalid-target'
  if (reason === 'requirement-failed') return 'invalid-class-feature'
  return 'invalid-plugin-action'
}

function mechanicEffectDefinition(
  proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'apply-effect' }>,
): Dnd5eEffectDefinitionV1 | undefined {
  // Mechanic handlers may mint durable marker/condition effects, but arbitrary
  // ActiveEffect modifier objects cannot bypass the public Effect schema.
  if (
    proposal.modifierGroups.some((group) => Object.values(group).some((value) => value != null)) ||
    proposal.escapeCheck != null || proposal.escapeSavingThrow != null || proposal.onDamageCondition != null ||
    proposal.afterEffectEnds != null ||
    proposal.periodicDamage != null || proposal.periodicHealing != null ||
    proposal.bodyRestoration != null
  ) {
    return undefined
  }
  const duration: Dnd5eEffectDefinitionV1['duration'] = proposal.duration.kind === 'save-ends'
    ? {
        kind: 'save-ends', maximumRounds: proposal.duration.maximumRounds,
        timing: proposal.duration.timing, ability: proposal.duration.ability,
        dc: { kind: 'constant', value: proposal.duration.dc },
      }
    : proposal.duration
  return {
    schemaVersion: 1,
    id: proposal.effectId,
    name: proposal.name,
    tags: proposal.tags,
    grants: proposal.grantedActivities,
    grantsSingleUse: proposal.grantedActivitiesSingleUse,
    completionGrant: proposal.completionGrant,
    duration,
    conditions: proposal.conditions,
    extensionCondition: proposal.extensionCondition,
    breakOn: proposal.breakOn,
    spellcastingSave: proposal.spellcastingSave ? { ability: proposal.spellcastingSave.ability, dc: { kind: 'constant', value: proposal.spellcastingSave.dc } } : undefined,
    repeatSaveAtTurnBoundary:proposal.repeatSaveAtTurnBoundary?{...proposal.repeatSaveAtTurnBoundary,dc:{kind:'constant',value:proposal.repeatSaveAtTurnBoundary.dc}}:undefined,
    completionReward: proposal.completionReward,
    sourceLink: proposal.sourceLink,
    sourceAttitude: proposal.sourceAttitude,
    onEndAwareness: proposal.onEndAwareness,
    concentration: proposal.concentration,
    stacking: proposal.stacking === 'reject' || proposal.stacking === 'keep-strongest'
      ? 'replace'
      : proposal.stacking,
    exclusiveGroup: proposal.exclusiveGroup,
  }
}

export function compileDnd5eActivityHeadlessAction(
  activity: Dnd5eActivityDefinitionV1,
  options: { outerSpellTransaction?: boolean } = {},
): Dnd5ePluginHeadlessActionDefinition {
  const compatibility = dnd5eActivityHeadlessCompatibility(activity, options)
  if (!compatibility.supported) throw new Error(compatibility.reasons.join('; '))
  const formulaRolls = collectDnd5eActivityFormulaRollDeclarationsV1(activity).filter(roll => !activity.carriedRollIds?.includes(roll.id))
  const sharedRandomChecks = (activity.checks ?? []).filter((check): check is Extract<Dnd5eActivityCheckV1, { kind: 'random-roll' }> =>
    check.kind === 'random-roll' && check.scope !== 'per-target')
  const sharedActorChecks = (activity.checks ?? []).filter((check): check is Extract<Dnd5eActivityCheckV1, { kind: 'ability-check' | 'skill-check' | 'concentration-check' }> =>
    (check.kind === 'ability-check' || check.kind === 'skill-check' || check.kind === 'concentration-check') && check.scope !== 'per-target')
  const targetChecks = (activity.checks ?? []).filter((check): check is Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' | 'attack-roll' | 'ability-check' | 'skill-check' | 'concentration-check' | 'random-roll' | 'opposed-ability-check' }> =>
    (check.kind === 'saving-throw' || check.kind === 'attack-roll' || check.kind === 'ability-check' ||
      check.kind === 'skill-check' || check.kind === 'concentration-check' ||
      check.kind === 'random-roll' || check.kind === 'opposed-ability-check') &&
    check.scope === 'per-target')
  return {
    id: activity.id,
    execution: 'trusted',
    rolls: [...formulaRolls.map((roll) => ({
      id: roll.id,
      label: `${activity.name} · ${roll.id}`,
      count: roll.count,
      sides: roll.sides,
      modifier: 0,
      visibility: 'public' as const,
    })), ...sharedRandomChecks.map((check) => ({
      id: check.rollId,
      label: `${activity.name} · ${check.label?.trim() || '随机表'}`,
      count: check.count,
      sides: check.sides,
      modifier: check.modifier ?? 0,
      rerollValues: check.rerollValues,
      visibility: 'public' as const,
    })), ...sharedActorChecks.map((check) => ({
      id: check.rollId,
      label: `${activity.name} · ${check.kind === 'skill-check' && check.skill ? check.skill : check.ability.toUpperCase()}检定`,
      count: check.rollMode && check.rollMode !== 'normal' ? 2 : 1,
      sides: 20,
      modifier: 0,
      visibility: 'public' as const,
    }))],
    perTargetRolls: targetChecks.flatMap((check) => check.kind === 'opposed-ability-check'
      ? [{
          id: check.rollId,
          label: `${activity.name} · 发起方${check.sourceAbility === 'spellcasting' ? '施法属性' : check.sourceAbility.toUpperCase()}检定`,
          count: check.sourceRollMode === 'advantage' || check.sourceRollMode === 'disadvantage' ||
            check.sourceRollMode === 'host-derived' || check.sourceRollModeByTargetSizeRank != null ? 2 : 1,
          sides: 20, modifier: 0, visibility: 'public' as const,
        }, {
          id: check.opposedRollId,
          label: `${activity.name} · 目标对抗检定`,
          count: check.targetRollMode === 'advantage' || check.targetRollMode === 'disadvantage' ||
            check.targetRollMode === 'host-derived' ? 2 : 1,
          sides: 20, modifier: 0, visibility: 'public' as const,
        }]
      : [{
      id: check.rollId,
      label: check.kind === 'saving-throw'
        ? `${activity.name} · ${(check.abilityOptions ?? [check.ability]).map((ability) => ability.toUpperCase()).join('/')} 豁免`
        : check.kind === 'attack-roll'
          ? `${activity.name} · 攻击检定`
          : check.kind === 'skill-check'
            ? `${activity.name} · ${check.skill ?? check.ability.toUpperCase()}检定`
            : check.kind === 'ability-check' || check.kind === 'concentration-check'
              ? `${activity.name} · ${check.ability.toUpperCase()}检定`
          : check.kind === 'random-roll'
            ? `${activity.name} · ${check.label?.trim() || '随机表'}`
            : `${activity.name} · 随机表`,
      count: check.kind === 'random-roll'
        ? check.count
        : check.rollMode === 'advantage' || check.rollMode === 'disadvantage' ||
            check.rollMode === 'host-derived' || (
              check.kind === 'saving-throw' &&
              (check.rollModeByCreatureType != null || check.rollModeByStatBlock != null || check.rollModeBySizeRank != null)
            )
          ? 2
          : 1,
      sides: check.kind === 'random-roll' ? check.sides : 20,
      modifier: check.kind === 'random-roll' ? check.modifier ?? 0 : 0,
      ...(check.kind === 'random-roll' && check.rerollValues
        ? { rerollValues: check.rerollValues }
        : {}),
      visibility: 'public',
    }]),
    resolve(context) {
      if (!dnd5eActivityDmChoicesAuthorizedV1(context.action, activity, context.rolls)) return context.fail('invalid-plugin-action')
      // Crafting needs the persisted Host ritual and atomic inventory/map plan.
      if (dnd5eActivityHasInventoryExchangeRitualProfile(activity)) return context.fail('invalid-plugin-action')
      const invocation = resolveDnd5eActivityInvocationV1(activity)
      if (activity.legacySource?.kind === 'subclass-ability' && invocation.kind === 'active' &&
        !activity.requiresEffectGrant && !dnd5eCombatantEntitledToActivityV1({
          packageId: context.action.pluginId, activity, combatant: context.actor,
          targetIds: context.targets.map(target => target.id),
        })) return context.fail('invalid-plugin-action')
      // Rest choices require the Host clock and a persisted one-use receipt.
      // The ordinary plugin action transport cannot supply that authority.
      if (invocation.kind === 'triggered' && ['long-rest-complete','short-rest-complete','long-rest-started','short-rest-started'].includes(invocation.event)) return context.fail('invalid-plugin-action')
      const actionPayload = context.action.payload && typeof context.action.payload === 'object' &&
        !Array.isArray(context.action.payload)
        ? context.action.payload as Record<string, unknown>
        : undefined
      const requiresMagicMouth = activity.outcomes.some((outcome) => outcome.operations.some((operation) =>
        operation.kind === 'create-persistent-area' && operation.mappedObjectEnchantment === 'magic-mouth'))
      const magicMouth = normalizeDnd5eMagicMouthConfigV1(actionPayload?.magicMouth)
      if (requiresMagicMouth && !magicMouth) return context.fail('invalid-plugin-action')
      const submittedChoices = actionPayload?.activityChoices && typeof actionPayload.activityChoices === 'object' && !Array.isArray(actionPayload.activityChoices)
        ? Object.fromEntries(Object.entries(actionPayload.activityChoices).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
      const resolvedChoices: Record<string, string> = {}
      for (const choice of activity.choices ?? []) {
        if (!dnd5eActivityChoiceIsRelevantV1(activity, choice, { ...submittedChoices, ...resolvedChoices })) continue
        const selected = submittedChoices[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id
        if (selected) resolvedChoices[choice.id] = selected
      }
      const selectedActivity = dnd5eActivityWithTargetChoicesV1(activity, resolvedChoices)
      const selectedTarget = selectedActivity.target
      // Empty-ground area Activities intentionally have no creature target.
      // Falling back to the actor fabricated a self target after Host area
      // validation and made otherwise valid persistent entities fail the
      // Activity relation/includeSelf gate during the live spell transaction.
      const targets = context.targets.length > 0
        ? context.targets
        : selectedTarget.kind === 'self'
          ? [context.actor]
          : selectedTarget.kind === 'area'
            ? []
            : context.target
              ? [context.target]
              : []
      const packageVersion = listRegisteredDnd5eActivityPackages().find(entry => entry.packageId === context.action.pluginId)?.packageVersion ?? '1.0.0'
      // The plugin transport must enforce the same Host perception requirements
      // as ExecuteActivity; submitted target ids do not establish visibility.
      if (((selectedTarget.kind === 'creature' && selectedTarget.requiresLineOfSight === true) ||
        (selectedTarget.kind === 'area' && selectedTarget.requiresVisibleTargets === true)) &&
        targets.some(target => !dnd5eCombatantCanSee(context.activityTargetingState ?? context.state, context.actor.id, target.id))) {
        return context.fail('invalid-plugin-action')
      }
      if (selectedTarget.kind === 'creature' && selectedTarget.requiresTargetSeeActor === true &&
        targets.some(target => !dnd5eCombatantCanSee(context.activityTargetingState ?? context.state, target.id, context.actor.id))) {
        return context.fail('invalid-plugin-action')
      }
      const selectsAmmunitionContainer = activity.outcomes.some(outcome =>
        dnd5eActivityOutcomeAllowsChoicesV1(outcome, resolvedChoices) && outcome.operations.some(operation =>
          operation.kind === 'apply-effect' && activity.effects?.find(effect => effect.id === operation.effectId)?.modifiers?.some(modifier =>
            modifier.kind === 'weapon-enchantment' && modifier.weaponSlot === 'ammunition-container')))
      if (selectsAmmunitionContainer) {
        const owners = [...new Map([context.actor, ...targets].map(target => [target.id, target])).values()]
          .filter(target => target.ammunitionContainers?.some(container => container.instanceId === actionPayload?.activityInventoryInstanceId))
        if (owners.length !== 1 ||
            actionPayload?.activityInventoryCharacterId != null && actionPayload.activityInventoryCharacterId !== (owners[0].classState.wardingBondParticipantCharacterId ?? owners[0].id) ||
            actionPayload?.expectedActivityInventoryRevision != null && actionPayload.expectedActivityInventoryRevision !== owners[0].activityEquipment?.inventory?.revision) {
          return context.fail('invalid-plugin-action')
        }
      }
      let selectedInventoryItem: Dnd5eActivityInventoryItemSnapshotV1 | undefined
      const inventoryChoices = actionPayload?.activityChoices && typeof actionPayload.activityChoices === 'object' && !Array.isArray(actionPayload.activityChoices)
        ? Object.fromEntries(Object.entries(actionPayload.activityChoices).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : undefined
      if (dnd5eActivitySelectsEquipmentItem(activity, inventoryChoices)) {
        const ownerId = actionPayload?.activityInventoryCharacterId ?? context.actor.classState.wardingBondParticipantCharacterId ?? context.actor.id
        const owners = [...new Map([context.actor, ...targets].map(target => [target.id, target])).values()]
          .filter(target => (target.classState.wardingBondParticipantCharacterId ?? target.id) === ownerId)
        const inventory = owners.length === 1 ? owners[0].activityEquipment?.inventory : undefined
        const item = inventory?.items.find(candidate => candidate.inventoryInstanceId === actionPayload?.activityInventoryInstanceId)
        if (!inventory || !item || actionPayload?.expectedActivityInventoryRevision !== inventory.revision) return context.fail('invalid-plugin-action')
        selectedInventoryItem = {...item, ownerActorId: owners[0].id,
          magical: item.magical === true || dnd5eEnchantedInventoryInstanceIds(owners[0].classState.activeEffects).includes(item.inventoryInstanceId)}
      }
      const continuationCommand: Dnd5eExecuteActivityCommandV1 = {
        schemaVersion: 1, commandId: context.action.transactionId ?? `activity:${context.actor.id}:${context.state.round}:${context.state.initiativeIndex}:${activity.id}`,
        actorId: context.actor.id, packageId: context.action.pluginId, packageVersion, activityId: activity.id,
        targetIds: targets.map(target => target.id), castLevel: context.action.castLevel, expectedRevision: 0,
        continuationId: typeof actionPayload?.activityContinuationId === 'string' ? actionPayload.activityContinuationId : undefined,
      }
      if (activity.requiresContinuationFrom && !continuationCommand.continuationId) {
        const candidates = Object.keys(context.actor.classState.activityContinuations ?? {}).filter(id => getDnd5eActivityContinuationV1(context.state, { ...continuationCommand, continuationId: id }))
        if (candidates.length !== 1) return context.fail('invalid-plugin-action')
        continuationCommand.continuationId = candidates[0]
      }
      const saved = getDnd5eActivityContinuationV1(context.state, continuationCommand)
      if (saved && continuationCommand.castLevel == null) continuationCommand.castLevel = saved.castLevel
      const continuation = prepareDnd5eActivityContinuationV1(context.state, continuationCommand, activity, context.rolls)
      if (continuation.error) return context.fail('invalid-plugin-action')
      const submittedAttackCritical = dnd5eActivitySubmittedAttackRollIsCriticalV1(activity, {
        negatedRollIds: new Set(Object.keys(context.action.disadvantageNegationChoices ?? {})),
        criticalThresholdForTarget: targetId => dnd5eTargetCriticalThreshold(context.state.combatants[targetId]?.classState.activeEffects, context.actor.id),
        targetIds: targets.map((target) => target.id),
        projectileTargetIds: context.action.projectileTargetIds,
        rolls: context.rolls,
        hostRollMode: (targetId, delivery) => context.attackRollMode(targetId, delivery),
      })
      const negationSource = context.action.disadvantageNegationChoices ? structuredClone(context.state) : undefined
      const negation = negationSource ? createDnd5eActivityNegationSession({ state: negationSource,
        activityId: activity.id, actionId: continuationCommand.commandId,
        choices: context.action.disadvantageNegationChoices! }) : undefined
      const cancelledCriticalCheckKeys = new Set<string>()
      const execute = (forcedAttackMissCheckKeys?: ReadonlySet<string>) => resolveDnd5eActivity({
        weaponCounterattackSuccessCheckKeys: context.weaponCounterattackSuccessCheckKeys,
        ...dnd5eActivityRetainedSaveDiceHooks(context.state, context.actor.id, actionPayload?.activityRetainedSaveDice),
        negateDisadvantage: negation?.negate,
        resolveDamageRollBonus: (targetId, attribution) => dnd5eTargetDamageRollBonus(context.state.combatants[targetId]?.classState.activeEffects,
          attribution === 'grant-source' ? grantedDamageSource(context.state, context.actor, context.action.pluginId, activity.id, targetId)?.actor.id : context.actor.id),
        combatActive: context.state.active,
        currentTurnActorId: context.state.active ? context.state.initiativeOrder[context.state.initiativeIndex] : undefined,
        activity: context.featureSpellInvocationInterrupted ? dnd5eInterruptedFeatureSpellActivity(activity) : activity,
        targetQualificationIdsByTargetId: dnd5eHostTargetQualificationsV1(context.action),
        saveFactsByTargetId: dnd5eHostSaveFactsV1(context.action),
        actor: actorSnapshot(context.actor, context.actor, context.state),
        targets: targets.map((target) => ({ ...actorSnapshot(target, context.actor, context.state), conditionImmunities: dnd5eActivityTargetImmunities(activity, target, context.actor), attackArmorClasses: dnd5eActivityAttackDefenses(context.state, context.actor.id, target.id, activity.target.kind === 'creature' && activity.target.mappedObjectOrigin ? dnd5eActivityMappedRockOrigin({ state: context.state, actorId: context.actor.id, activityId: activity.id, areaId: context.action.hostEntitlement?.kind === 'persistent-area' ? context.action.hostEntitlement.areaId : undefined, payload: context.action.payload }) : undefined) })),
        combatants: Object.values(context.state.combatants)
          .map((combatant) => actorSnapshot(combatant, context.actor, context.state)),
        rolls: continuation.rolls,
        resolveSequentialCheckRollModes: dnd5eActivitySequentialCheckModesV1({
          activity, actor: context.actor, combatants: context.state.combatants,
          state: context.state, grantingAreaId: context.action.hostEntitlement?.kind === 'persistent-area' ? context.action.hostEntitlement.areaId : undefined,
          sourceDistanceFeet: targetId => pairDistance(context, targetId),
        }),
        continuationTargetIds: continuation.pending?.finishActivityId === activity.id ? continuation.pending.visitedTargetIds : undefined,
        checkRollModes: Object.fromEntries([...sharedActorChecks.flatMap((check) =>
          check.rollMode === 'host-derived'
            ? [[check.id, dnd5eActivityHostActorCheckModeV1(context.actor, check)] as const]
            : []), ...targetChecks.flatMap((check) =>
          check.kind === 'opposed-ability-check'
            ? targets.flatMap((target) => {
                const modes = dnd5eOpposedHostRollModes(check, context.actor, target)
                return [
                  [`${check.id}:${target.id}:source-final`, modes.source] as const,
                  [`${check.id}:${target.id}:target-final`, modes.target] as const,
                  ...(check.sourceRollMode === 'host-derived'
                    ? [[`${check.id}:${target.id}:source`, modes.source] as const]
                    : []),
                  ...(check.targetRollMode === 'host-derived'
                    ? [[`${check.id}:${target.id}:target`, modes.target] as const]
                    : []),
                ]
              })
            : check.kind !== 'random-roll' && check.rollMode === 'host-derived'
            ? targets.flatMap((target) => {
                const mode = check.kind === 'saving-throw'
                  ? dnd5eActivityHostSavingThrowModeV1({
                      activity,
                      state: context.state, grantingAreaId: context.action.hostEntitlement?.kind === 'persistent-area' ? context.action.hostEntitlement.areaId : undefined,
                      actor: context.actor,
                      target,
                      check,
                      sourceDistanceFeet: pairDistance(context, target.id),
                    })
                  : check.kind === 'attack-roll'
                    ? context.attackRollMode(target.id, check.delivery)
                    : dnd5eActivityHostActorCheckModeV1(context.actor, check)
                if ('perProjectile' in check && check.perProjectile) {
                  return (context.action.projectileTargetIds ?? []).flatMap((targetId, index) =>
                    targetId === target.id ? [[`${check.id}:projectile:${index}:${target.id}`, mode] as const] : [])
                }
                return [[`${check.id}:${target.id}`, mode] as const]
              })
            : [])]),
        distanceFeetBetweenTargets: (activity.target.kind === 'creature' && activity.target.maximumTargetSeparationFeet != null) ||
          activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'apply-effect' && operation.conditionSourceMaximumDistanceFeet != null))
          ? Object.fromEntries(Object.values(context.state.combatants).map((first) => [first.id, Object.fromEntries(Object.values(context.state.combatants).flatMap((second) => {
              const distance = first.id === second.id ? 0 : context.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(first.id, second.id)]
              return distance == null ? [] : [[second.id, distance]]
            }))]))
          : undefined,
        distanceFeetByTargetId: Object.fromEntries(Object.values(context.state.combatants).flatMap((target) => {
          const origin=dnd5eActivityEffectOriginId(context.state,context.actor.id,activity)
          const distance = activity.target.kind==='creature' && activity.target.effectOrigin
            ? origin ? origin===target.id?0:context.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(origin,target.id)] : undefined
            : pairDistance(context, target.id)
          return distance == null ? [] : [[target.id, distance]]
        })),
        parentDamageType: context.parentAttackDamageType,
        companionHelpTargets: actionPayload?.companionHelpTargets,
        companionAttackTargets: actionPayload?.companionAttackTargets,
        companionMovementDestinations: actionPayload?.companionMovementDestinations,
        companionObjectInteractions: actionPayload?.companionObjectInteractions,
        companionTaskDescriptions: actionPayload?.companionTaskDescriptions,
        companionReadyTriggers: actionPayload?.companionReadyTriggers,
        companionGuardAreas: actionPayload?.companionGuardAreas,
        selectedInventoryItem,
        areaPlacement: context.action.activityAreaPlacement,
        areaPlacementDistanceFeet: context.action.activityAreaPlacementDistanceFeet,
        projectileTargetIds: context.action.projectileTargetIds,
        ...(context.action.activityAreaExemptTargetIds
          ? { areaExemptTargetIds: context.action.activityAreaExemptTargetIds }
          : {}),
        secretPhrase: typeof actionPayload?.secretPhrase === 'string'
          ? actionPayload.secretPhrase
          : undefined,
        castLevel: continuationCommand.castLevel,
        willingTargetIds: Array.isArray(actionPayload?.activityWillingTargetIds) ? actionPayload.activityWillingTargetIds.filter((id): id is string => typeof id === 'string' && targets.some(target => target.id === id)) : undefined,
        targetFormIds: actionPayload?.activityTargetFormIds && typeof actionPayload.activityTargetFormIds === 'object' && !Array.isArray(actionPayload.activityTargetFormIds)
          ? Object.fromEntries(Object.entries(actionPayload.activityTargetFormIds).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : undefined,
        completionDelayRounds: (() => {
          const value = actionPayload?.activityCompletionDelayRounds
          return Number.isSafeInteger(value) && Number(value) >= 0
            ? Number(value)
            : undefined
        })(),
        inventoryInstanceId: (() => {
          const payload = context.action.payload && typeof context.action.payload === 'object' && !Array.isArray(context.action.payload)
            ? context.action.payload as Record<string, unknown>
            : undefined
          return typeof payload?.activityInventoryInstanceId === 'string'
            ? payload.activityInventoryInstanceId
            : undefined
        })(),
        spellAuthorityRecordId: (() => {
          const payload = context.action.payload && typeof context.action.payload === 'object' && !Array.isArray(context.action.payload)
            ? context.action.payload as Record<string, unknown>
            : undefined
          return typeof payload?.activitySpellAuthorityRecordId === 'string'
            ? payload.activitySpellAuthorityRecordId
            : undefined
        })(),
        magicMouth,
        choices: resolvedChoices,
        usedTurnKeys: new Set(context.activityUsedTurnKeys?.() ?? []),
        dmApproved: context.action.interruptChoiceId === 'dm-apply',
        forcedAttackMissCheckKeys,
        cancelledCriticalCheckKeys,
        allowCriticalDiceSuperset: submittedAttackCritical || cancelledCriticalCheckKeys.size > 0,
      })
      let result = execute()
      if (!result.ok) {
        return context.fail(failureReason(result.reason, activity))
      }
      const redirectedCheckKeys = new Set<string>()
      for (const check of result.checks) {
        if (
          check.targetId == null ||
          !targetChecks.some((definition) =>
            definition.id === check.checkId && definition.kind === 'attack-roll')
        ) continue
        const settled = context.settleAttackDecoy({
          occurrenceId: `activity:${context.action.pluginId}:${context.action.actionId}:${check.key}`,
          targetId: check.targetId,
          d20: check.d20,
          total: check.total,
        })
        if (!settled.ok) return settled.result
        if (settled.redirected) redirectedCheckKeys.add(check.key)
      }
      if (redirectedCheckKeys.size > 0) {
        result = execute(redirectedCheckKeys)
        if (!result.ok) return context.fail(failureReason(result.reason, activity))
      }
      for (const check of result.checks) {
        if (check.kind !== 'attack-roll' || !check.success || !check.criticalSuccess || !check.targetId || check.dc == null) continue
        const event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> = {
          type: 'attack-resolved', actorId: context.actor.id, targetId: check.targetId,
          d20: check.d20, total: check.total, armorClass: check.dc,
          hit: true, critical: true, activityId: activity.id,
        }
        if (!settleDnd5eCriticalCancellationCheckpoint(context.state, event, context.events)) return context.fail('reaction-unavailable')
        if (!event.critical) cancelledCriticalCheckKeys.add(check.key)
      }
      if (cancelledCriticalCheckKeys.size > 0) {
        result = execute(redirectedCheckKeys)
        if (!result.ok) return context.fail(failureReason(result.reason, activity))
      }
      for (const [key, expected] of context.weaponCounterattackChecks ?? []) {
        if (!result.checks.some(check => check.key === key && check.kind === 'saving-throw' &&
          check.targetId === expected.targetId && check.ability === expected.ability)) {
          return context.fail('invalid-plugin-action')
        }
      }
      if (activity.spellInvocation) {
        const allowed = context.settleFeatureSpellInvocation?.()
        if (allowed == null) return context.fail('invalid-plugin-action')
        if (!allowed) result = { ...result, proposals: result.proposals.filter(proposal =>
          !activity.spellInvocation!.operationIds.includes(proposal.operationId)) }
      }
      // Target selection and shared dice are authorized by the atomic weapon-hit adapter.
      if (result.proposals.some(proposal => proposal.kind === 'select-secondary-weapon-damage'||proposal.kind==='select-reaction-follow')) return context.fail('invalid-plugin-action')
      const historyProposals = bindDnd5eBenefitHistoryRecipients(result.proposals, id => ({ actorId: id,
        ...(context.state.combatants[id]?.classState.wardingBondParticipantCharacterId
          ? { characterId: context.state.combatants[id].classState.wardingBondParticipantCharacterId } : {}) }))
      if (!historyProposals) return context.fail('invalid-target')
      if (historyProposals.some(proposal => proposal.kind === 'summon' &&
        !dnd5eSummonMatchesDeclaredLimits(proposal))) return context.fail('invalid-target')
      result = { ...result, proposals: historyProposals }
      if (!dnd5eCanReceiveCreatedWeaponsInHand(context.state, context.actor.id, result.proposals)) return context.fail('invalid-target')
      if (
        result.status === 'dm-adjudication-required' &&
        context.action.interruptChoiceId !== 'dm-apply'
      ) return context.fail('dm-adjudication-pending')
      if (result.proposals.some(proposal => proposal.kind === 'apply-effect' && proposal.completionReward &&
        context.canReceiveRestCompletion?.(proposal.targetId) !== true)) return context.fail('invalid-target')
      if (result.proposals.some(proposal => proposal.kind === 'restore-original-alignment' &&
        !dnd5eRestorableOriginalAlignment(context.state.combatants[proposal.targetId] ?? {}))) return context.fail('invalid-target')
      const lifetimeClaims = new Set<string>()
      for (const proposal of result.proposals) {
        if (proposal.kind !== 'establish-spell-authority' || proposal.recordKind !== 'benefit-history') continue
        const identity = JSON.stringify([proposal.targetId, proposal.benefitKey])
        if (!proposal.benefitKey || lifetimeClaims.has(identity) || context.canReceiveBenefitHistory?.(proposal.targetId, proposal.benefitKey, proposal.benefitRenewal, proposal.benefitScope) !== true) {
          return context.fail('invalid-target')
        }
        lifetimeClaims.add(identity)
      }
      for (const targetId of result.coldSpellMissTargetIds ?? []) {
        const target = context.state.combatants[targetId]
        if (target) dnd5eActivityDamagePathAmount({ state: context.state, actor: context.actor, target,
          activity, grantingAreaId: context.action.hostEntitlement?.kind === 'persistent-area' ? context.action.hostEntitlement.areaId : undefined,
          amount: 0, damageType: 'cold', events: context.events, spellEffect: true })
      }
      const activityDamageBudgets = dnd5eActivityAttackDamageRollBudgets(result.checks, result.proposals)
      const activityAttackEvents = new Map<string, Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>>()
      const vulnerabilityAttackEvents = new Map<string, Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>>()
      for (const resolvedCheck of result.checks) {
        const declaredCheck = activity.checks?.find((check) => check.id === resolvedCheck.checkId)
        if (
          declaredCheck?.kind === 'attack-roll' &&
          resolvedCheck.targetId != null &&
          resolvedCheck.dc != null
        ) {
          const damagePool = activityDamageBudgets.get(resolvedCheck.key)
          const attackEvent: Extract<Dnd5eCombatEvent, {type:'attack-resolved'}> = {
            type: 'attack-resolved',
            actorId: context.actor.id,
            targetId: resolvedCheck.targetId,
            d20: resolvedCheck.d20,
            total: resolvedCheck.total,
            armorClass: resolvedCheck.dc,
            hit: resolvedCheck.success,
            critical: resolvedCheck.criticalSuccess === true && resolvedCheck.success,
            attackMode: declaredCheck.attackType === 'weapon' ? declaredCheck.delivery ?? 'melee' : 'spell',
            attackCategory: declaredCheck.attackType ?? 'spell',
            activityId: activity.id,
            attackDelivery: declaredCheck.delivery,
            attackOrigin: 'other',
            ...(damagePool?.damageType ? {damageType:damagePool.damageType} : {}),
          }
          if (damagePool) dnd5eAttackDamageRollBudgets.set(attackEvent, damagePool.budget)
          context.events.push(attackEvent)
          if (claimDnd5eNextAttackVulnerability(context.state, attackEvent, context.events))
            vulnerabilityAttackEvents.set(resolvedCheck.key, attackEvent)
          activityAttackEvents.set(resolvedCheck.key, attackEvent)
          recordDnd5eMeleeAttackTarget(context.state, context.actor.id, resolvedCheck.targetId, declaredCheck.delivery)
          settleDnd5eWitnessedAllyHarm(context.state, resolvedCheck.targetId, 'witnesses-ally-attacked', context.events, undefined, context.actor.id)
        } else if (
          declaredCheck?.kind === 'saving-throw' &&
          resolvedCheck.targetId != null &&
          resolvedCheck.ability != null &&
          resolvedCheck.dc != null
        ) {
          context.events.push({
            type: 'saving-throw-resolved',
            sourceId: context.actor.id,
            targetId: resolvedCheck.targetId,
            ability: resolvedCheck.ability,
            d20: resolvedCheck.d20,
            modifier: resolvedCheck.modifier,
            total: resolvedCheck.total,
            dc: resolvedCheck.dc,
            success: resolvedCheck.success,
            automaticOutcome: resolvedCheck.automaticOutcome,
          })
        } else if (declaredCheck?.kind === 'concentration-check' && resolvedCheck.dc != null) {
          context.actor.classState.concentrationCheckDisadvantagePendingSourceId = undefined
          context.events.push({ type: 'concentration-resolved', actorId: context.actor.id,
            activityId: activity.id, checkId: resolvedCheck.checkId,
            d20: resolvedCheck.d20, total: resolvedCheck.total, dc: resolvedCheck.dc, success: resolvedCheck.success })
        } else if (
          (declaredCheck?.kind === 'ability-check' || declaredCheck?.kind === 'skill-check') &&
          resolvedCheck.ability != null
        ) {
          context.events.push({
            type: 'ability-check-resolved',
            actorId: context.actor.id,
            ability: resolvedCheck.ability,
            skill: resolvedCheck.skill,
            perceivedTargetId: resolvedCheck.targetId,
            d20: resolvedCheck.d20,
            modifier: resolvedCheck.modifier,
            total: resolvedCheck.total,
            mode: resolvedCheck.rollMode ?? 'normal',
            reliableTalentApplied: false,
            dc: resolvedCheck.dc,
            success: resolvedCheck.success,
          })
        }
      }
      const resolvedActivity = scaleDnd5eActivityDefinitionV1(activity, {
        actor: {
          level: context.actor.level,
          proficiencyBonus: context.actor.proficiencyBonus,
          classLevels: context.actor.classLevels,
          abilities: context.actor.abilities,
        },
        castLevel: context.action.castLevel,
      }).activity
      for (const check of result.checks) {
        if (
          check.targetId == null || check.ability == null || check.opposedAbility == null ||
          check.opposedD20 == null || check.opposedModifier == null || check.opposedTotal == null
        ) continue
        context.events.push({
          type: 'opposed-ability-check-resolved',
          actorId: context.actor.id,
          targetId: check.targetId,
          activityId: activity.id,
          checkId: check.checkId,
          sourceAbility: check.ability,
          sourceSkill: check.skill,
          sourceD20: check.d20,
          sourceModifier: check.modifier,
          sourceTotal: check.total,
          targetAbility: check.opposedAbility,
          targetSkill: check.opposedSkill,
          targetD20: check.opposedD20,
          targetModifier: check.opposedModifier,
          targetTotal: check.opposedTotal,
          success: check.success,
        })
      }
      const resolvedMovements: Extract<Dnd5eActivityCapabilityProposal, { kind: 'move' }>[] = []
      const selectedProposals=options.outerSpellTransaction && (activity.target.kind==='self' || activity.target.kind==='creature') && targets.length===1 && targets[0].id===context.actor.id
        ? shareDnd5eSelfSpellProposals(context.state,context.actor.id,result.proposals) : result.proposals
      const settledProposals = bindDnd5eCohortEffectProposals(selectedProposals, id => ({ actorId: id,
        ...(context.state.combatants[id]?.classState.wardingBondParticipantCharacterId
          ? { characterId: context.state.combatants[id].classState.wardingBondParticipantCharacterId } : {}) }))
      if (!settledProposals) return context.fail('invalid-target')
      for (const proposal of result.proposals) {
        if (proposal.kind !== 'detect-planar-portal') continue
        if (proposal.targetId !== context.actor.id) return context.fail('invalid-target')
        if (!planDnd5ePlanarPortalReport(context.state, context.actor.id, activity.id, proposal.rangeFeet))
          return context.fail('planar-portal-scene-unavailable')
      }
      const activeConsumptions = result.consumptions.filter(consumption =>
        consumption.consumeOn === 'hit' ? result.checks.some(check => check.success)
          : consumption.consumeOn === 'dm-approval' ? context.action.interruptChoiceId === 'dm-apply' : true)
      if (!canSpendDnd5eActivityHitDiceCosts(context.actor.hitPointDice, activeConsumptions)) return context.fail('class-resource-unavailable')
      for (const consumption of result.consumptions) {
        if (consumption.kind === 'action-economy') {
          // The outer feature transaction spends the declared action economy.
          continue
        }
        if (consumption.kind === 'spell-slot' && options.outerSpellTransaction) {
          // The atomic plugin-spell wrapper validates and spends the selected slot.
          continue
        }
        if (consumption.kind === 'resource' || consumption.kind === 'hit-die') {
          const applies = consumption.consumeOn === 'hit'
            ? result.checks.some((check) => check.success)
            : consumption.consumeOn === 'dm-approval'
              ? context.action.interruptChoiceId === 'dm-apply'
              : true
          const spendCost = () => consumption.kind === 'hit-die'
            ? context.spendHitDice?.(consumption.resourceId, consumption.amount)
            : context.spendResource(consumption.resourceId, consumption.amount)
          if (applies && !spendCost()) {
            return context.fail('class-resource-unavailable')
          }
          continue
        }
        if (consumption.kind === 'movement') {
          if (!context.spendMovement?.(consumption.amount)) {
            return context.fail('insufficient-movement')
          }
          continue
        }
        return context.fail('invalid-plugin-action')
      }
      if (negation && negationSource) {
        if (!negation.complete()) return context.fail('invalid-plugin-action')
        const costs = Object.entries(negation.state().combatants).flatMap(([id, planned]) =>
          Object.entries(planned.classResources).flatMap(([key, resource]) => {
            const amount = (negationSource.combatants[id]?.classResources[key]?.current ?? resource.current) - resource.current
            return amount > 0 ? [{ id, key, amount }] : []
          }))
        if (costs.some(({ id, key, amount }) => (context.state.combatants[id]?.classResources[key]?.current ?? -1) < amount)) {
          return context.fail('class-resource-unavailable')
        }
        for (const { id, key, amount } of costs) context.state.combatants[id].classResources[key].current -= amount
      }
      const teleportInterruptionState = settledProposals.some(proposal => proposal.kind === 'move' &&
        (proposal.mode === 'teleport' || proposal.mode === 'swap')) ? structuredClone(context.state) : undefined
      const cancelledTeleports = context.settleActivityTeleportInterruptions?.(settledProposals)
      if (context.action.activityTeleportInterruptions?.length && !cancelledTeleports) return context.fail('invalid-class-feature')
      const damageKills = new Set<string>()
      const resolvedSummons: Extract<typeof result.proposals[number], { kind: 'summon' }>[] = []
      const settledDamageResults = new Map<string, number>()
      const damageResultKey = (operationId: string, targetId: string) => JSON.stringify([operationId, targetId])
      for (const proposal of settledProposals) {
        if (proposal.kind === 'summon' && proposal.afterDamageKillOperationId && (!proposal.corpseTokenId || !damageKills.has(damageResultKey(proposal.afterDamageKillOperationId, proposal.corpseTokenId)))) continue
        const summonSettlement=settleDnd5eSummonActivityCapability(context.state,context.actor,proposal,activity.id,context.events,context.action.pluginId,context.action.interruptChoiceId==='dm-apply')
        if(summonSettlement===false)return context.fail('invalid-target')
        if(summonSettlement===true && proposal.kind !== 'summon')continue
        if (proposal.kind === 'summon') {
          const spellId = proposal.spellEffectSourceId ?? activity.spellInvocation?.spellId ??
            (activity.legacySource?.kind === 'spell' ? activity.legacySource.id : undefined)
          const bonuses = dnd5eDeclarativeSummonedCreatureBonuses(
            context.actor, spellId, proposal.monsterId, proposal.creatureTypeOverride,
          )
          resolvedSummons.push({
            ...proposal,
            ...(bonuses.temporaryHitPoints > 0 ? { temporaryHitPoints: bonuses.temporaryHitPoints } : {}),
            ...(bonuses.maximumHitPointBonus > 0 ? { maximumHitPointBonus: bonuses.maximumHitPointBonus } : {}),
            ...(bonuses.weaponDamageBonus > 0 ? { weaponDamageBonus: bonuses.weaponDamageBonus } : {}),
            ...(bonuses.naturalWeaponAttacksMagical ? { naturalWeaponAttacksMagical: true } : {}),
          })
          continue
        }
        if (proposal.kind === 'deal-damage') {
          const beforeDamage = context.state.combatants[proposal.targetId]
          const wasDead = beforeDamage?.deathSaves.dead || beforeDamage?.classState.deathRound != null
          const damage = context.dealDamage(proposal.targetId, proposal.amount, proposal.damageType, proposal.damageSource, { damageComponents: proposal.damageComponents, damageGroupMultiplier: proposal.damageGroup?.multiplier, magical: proposal.magicalOverride, cannotBeReduced: proposal.cannotBeReduced, destroysBodyOnDeath: proposal.destroysBodyOnDeath, destroysBodyPartOnDeath: proposal.destroysBodyPartOnDeath,
            bodyPartPresent: proposal.destroysBodyPartOnDeath ? dnd5eHostTargetBodyPartsV1(context.action)?.[proposal.targetId]?.[proposal.destroysBodyPartOnDeath.part] : undefined, attackDamage: proposal.attackDamage,
            attackVulnerabilityEvents: (proposal.attackCheckKeys ?? []).flatMap(key => { const event = vulnerabilityAttackEvents.get(key); return event ? [event] : [] }),
            attackCheckKeys: proposal.attackCheckKeys,
            attackEvents: (proposal.attackCheckKeys ?? []).flatMap(key => { const event = activityAttackEvents.get(key); activityAttackEvents.delete(key); return event ? [event] : [] }),
            formulaRoll: proposal.diceAudit?.length ? { activityId: activity.id, operationId: proposal.operationId,
              dice: proposal.diceAudit, attackCheckKeys: proposal.attackCheckKeys, formulaAdjustment: proposal.formulaAdjustment ?? 0 } : undefined })
          if (damage < 0) return context.fail('invalid-plugin-action')
          settledDamageResults.set(damageResultKey(proposal.operationId, proposal.targetId), damage)
          const afterDamage = context.state.combatants[proposal.targetId]
          if (!wasDead && damage > 0 && afterDamage?.currentHp === 0 && (afterDamage.deathSaves.dead || afterDamage.classState.deathRound != null) && afterDamage.classState.bodyPresent !== false && !dnd5eUndeadCreationIsProtected(afterDamage.classState.activeEffects)) {
            damageKills.add(damageResultKey(proposal.operationId, proposal.targetId))
          }
        } else if (proposal.kind === 'heal') {
          const dependency = proposal.damageResult
          const damage = dependency ? settledDamageResults.get(damageResultKey(dependency.operationId, dependency.targetId)) : undefined
          if (dependency && damage == null) return context.fail('invalid-plugin-action')
          const healingAmount = dependency ? Math.min(1_000_000, Math.max(0, Math.floor(damage! * dependency.multiplier))) : proposal.amount
          if (proposal.diceAudit?.length) {
            context.events.push({
              type: 'activity-formula-roll-resolved', actorId: context.actor.id,
              targetId: proposal.targetId, activityId: activity.id,
              operationId: proposal.operationId, kind: 'healing',
              castLevel: context.action.castLevel, total: proposal.amount,
              formulaAdjustment: proposal.formulaAdjustment ?? 0,
              dice: proposal.diceAudit.map((die) => ({ ...die, values: [...die.values] })),
            })
          }
          context.heal(proposal.targetId, healingAmount)
        } else if (proposal.kind === 'revive') {
          if (!context.revive(proposal)) return context.fail('invalid-target')
        } else if (proposal.kind === 'reveal-target-location') {
          if (!recordDnd5eTargetLocation(context.state, context.actor.id, proposal.targetId, activity.id)) return context.fail('invalid-target')
        } else if (proposal.kind === 'read-damage-traits') {
          if (!recordDnd5eDeclaredDamageTraitReport(context.state, context.actor.id, proposal.targetId, activity.id)) return context.fail('invalid-target')
        } else if (proposal.kind === 'detect-planar-portal') {
          if (proposal.targetId !== context.actor.id ||
            !recordDnd5ePlanarPortalReport(context.state, context.actor.id, activity.id, proposal.rangeFeet))
            return context.fail('invalid-target')
        } else if (proposal.kind === 'grant-temporary-hit-points') {
          if (context.grantTemporaryHitPoints(proposal.targetId, proposal.amount, proposal.sourceEffectId, proposal.replacement) < 0) return context.fail('invalid-plugin-action')
        } else if (proposal.kind === 'stabilize') {
          if (!context.stabilize(proposal.targetId)) return context.fail('invalid-target')
        } else if (proposal.kind === 'stand-up') {
          if (!context.standUpUsingReactionIfAvailable(proposal.targetId)) return context.fail('invalid-target')
        } else if (proposal.kind === 'remove-standard-condition') {
          if (!context.removeStandardCondition(
            proposal.targetId, proposal.condition, proposal.sourceCreatureTypes,
          )) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'apply-standard-condition') {
          const duration = pluginDuration(proposal.duration)
          if (!duration) return context.fail('invalid-plugin-action')
          context.applyStandardCondition(proposal.targetId, proposal.condition, duration)
        } else if (proposal.kind === 'apply-effect') {
          if (proposal.disguiseFromGrant) {
            const entitlement = context.action.hostEntitlement
            if (entitlement?.kind !== 'active-effect') return context.fail('invalid-plugin-action')
            proposal.disguiseGrantEffectId = entitlement.effectId
          }
          const effect = resolvedActivity.effects?.find((candidate) => candidate.id === proposal.effectId) ??
            mechanicEffectDefinition(proposal)
          if (!effect || !context.applyResolvedEffect(proposal)) {
            return context.fail('invalid-plugin-action')
          }
        } else if (proposal.kind === 'remove-effect') {
          if (!context.removeEffectDefinition(proposal.targetId, proposal.effectId, proposal.source)) {
            return context.fail('invalid-plugin-action')
          }
        } else if (proposal.kind === 'remove-effects-by-tag') {
          if (!context.removeEffectsByTag || !context.removeEffectsByTag(
            proposal.targetId, proposal.tags, proposal.match, proposal.source,
            proposal.maximumCount, proposal.sourceCreatureTypes,
          )) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'adjust-exhaustion') {
          if (!context.adjustExhaustion || !context.adjustExhaustion(proposal.targetId, proposal.amount)) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'lower-ability-score') {
          if (!context.lowerAbilityScore || !context.lowerAbilityScore(
            proposal.targetId,
            proposal.ability,
            proposal.maximumScore,
            proposal.recoveryGroupId,
          )) return context.fail('invalid-target')
        } else if (proposal.kind === 'recover-ability-score') {
          if (!context.recoverAbilityScore || !context.recoverAbilityScore(proposal.targetId, proposal.ability, proposal.maximumCount)) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'reduce-hit-point-maximum') {
          if (!context.reduceHitPointMaximum?.(proposal)) return context.fail('invalid-target')
        } else if (proposal.kind === 'transfer-hit-point-maximum') {
          if (!context.transferHitPointMaximum?.(proposal)) return context.fail('invalid-target')
        } else if (proposal.kind === 'recover-hit-point-maximum') {
          if (!context.recoverHitPointMaximum || !context.recoverHitPointMaximum(proposal.targetId, proposal.maximumCount)) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'instant-death') {
          if (!context.instantDeath || !context.instantDeath(proposal.targetId)) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'spend-resource') {
          if (!context.spendResource(proposal.resourceId, proposal.amount)) return context.fail('class-resource-unavailable')
        } else if (proposal.kind === 'restore-resource') {
          if (!context.restoreResource(proposal.resourceId, proposal.amount)) return context.fail('class-resource-unavailable')
        } else if (proposal.kind === 'move') {
          if (cancelledTeleports?.has(JSON.stringify([proposal.operationId, proposal.targetId]))) continue
          const movedTarget = context.state.combatants[proposal.targetId]
          if (proposal.requiresWithinCarryingCapacity && (!movedTarget || dnd5eCarriedLoadPreventsMovement(movedTarget))) return context.fail('invalid-target')
          if (proposal.usesActorMovement && (proposal.targetId !== context.actor.id ||
            !context.spendMovement?.(proposal.distanceFeet))) return context.fail('insufficient-movement')
          if (proposal.usesTargetReactionIfAvailable && !context.spendTargetReaction(proposal.targetId)) {
            continue
          }
          resolvedMovements.push(proposal)
          // Map-owned movement is committed only after the Host validates its path.
          continue
        } else if (proposal.kind === 'relocate-granting-area') {
          // The granting map entity is resolved from the Host entitlement and
          // relocated only in the map-owned atomic handoff below.
          continue
        } else if (proposal.kind === 'shrink-granting-area' || proposal.kind === 'reshape-granting-area') {
          // The Host entitlement identifies the granting area. Its replacement
          // cells come only from the validated map-template selection.
          continue
        } else if (proposal.kind === 'change-granting-area-mode') {
          // Closed mode changes are validated and committed by the granting map area.
          continue
        } else if (proposal.kind === 'set-granting-area-senses') {
          // Vision ownership belongs to the map entity and is committed by the
          // same Host-authoritative granting-area handoff.
          continue
        } else if (proposal.kind === 'detonate-granting-area' || proposal.kind === 'dismiss-granting-area') {
          // The map layer revalidates ownership of the granting area. Only
          // detonation settles its triggers; ordinary dismissal just removes it.
          continue
        } else if (proposal.kind === 'recognize-granting-disguise') {
          const entitlement = context.action.hostEntitlement
          const effects = context.state.combatants[proposal.targetId] && recognizeDnd5eGrantingDisguise({effects:context.actor.classState.activeEffects,
            effectId:entitlement?.kind==='active-effect'?entitlement.effectId:undefined, packageId:context.action.pluginId, activityId:activity.id, actorId:context.actor.id, observerId:proposal.targetId})
          if (!effects) return context.fail('invalid-target')
          context.actor.classState.activeEffects=effects
          context.events.push({type:'class-state-changed',actorId:context.actor.id,stateKey:'disguise-recognized',active:true})
        } else if (proposal.kind === 'restore-original-alignment') {
          const target = context.state.combatants[proposal.targetId]
          const alignment = target && dnd5eRestorableOriginalAlignment(target)
          if (!alignment) return context.fail('invalid-target')
          const previousAlignment = target.alignment!
          target.alignment = alignment
          context.events.push({ type: 'original-alignment-restored', actorId: context.actor.id, targetId: target.id,
            activityId: activity.id, previousAlignment, alignment })
        } else if (proposal.kind === 'transform-creature') {
          if (!context.transformCreature(proposal)) return context.fail('invalid-target')
        } else if (proposal.kind === 'grant-extra-turns') {
          if (!context.grantExtraTurns(proposal)) return context.fail('invalid-plugin-action')
        } else if (proposal.kind === 'set-directional-command') {
          if (!context.setDirectionalCommand(proposal)) return context.fail('invalid-plugin-action')
        } else if (proposal.kind === 'establish-spell-authority') {
          if (!context.establishSpellAuthority(proposal)) return context.fail('invalid-plugin-action')
        } else if (proposal.kind === 'transition-spell-authority') {
          if (!context.transitionSpellAuthority(proposal)) return context.fail('invalid-plugin-action')
        } else if (proposal.kind === 'request-dm-adjudication') {
          // The shared DM interrupt approved this exact transaction before
          // the trusted resolver was replayed.
          continue
        } else if (proposal.kind === 'narrative-prompt') {
          if (!proposal.prompt.trim() || proposal.prompt.length > 2000) return context.fail('invalid-plugin-action')
          context.events.push({ type: 'activity-narrative-prompt', actorId: context.actor.id,
            activityId: activity.id, prompt: proposal.prompt })
        } else if (proposal.kind === 'emit-sound') {
          context.events.push({
            type: 'audible-event-emitted', actorId: context.actor.id,
            activityId: activity.id, label: proposal.label,
            audibleRadiusFeet: proposal.audibleRadiusFeet,
          })
        } else if (proposal.kind === 'open-communication') {
          const target = context.state.combatants[proposal.targetId]
          if (!target || (proposal.requiresTargetLanguage && target.languages?.length === 0)) {
            return context.fail('invalid-target')
          }
          context.events.push({
            type: 'communication-opened', actorId: context.actor.id,
            targetId: proposal.targetId, activityId: activity.id,
            medium: proposal.medium,
            allowsImmediateReply: proposal.allowsImmediateReply && (proposal.medium==='telepathy'||dnd5eCombatantCanSpeak(target)),
          })
        } else if (
          proposal.kind === 'create-persistent-area' || proposal.kind === 'duplicate-creature' ||
          proposal.kind === 'affect-persistent-entity' || proposal.kind === 'enchant-map-weapon' || proposal.kind === 'ignite-area-fuel' || proposal.kind === 'extinguish-area-flames' || proposal.kind === 'control-map-flame' || proposal.kind === 'control-map-water' || proposal.kind === 'transfer-loose-earth' || proposal.kind === 'modify-map-object-lock' || proposal.kind === 'enchant-map-object-light' || proposal.kind === 'launch-map-object' ||
          proposal.kind === 'convert-map-inventory-item' || proposal.kind === 'protect-map-remains' || proposal.kind === 'purify-map-consumables' || proposal.kind === 'wither-map-vegetation' || proposal.kind === 'identify-inventory-item' ||
          proposal.kind === 'purify-inventory-item' || proposal.kind === 'grant-inventory-item' || proposal.kind === 'alter-inventory-item'
        ) {
          // Map-owned effects are returned below and committed only after the
          // Host has collected and validated every placement.
          continue
        } else return context.fail('invalid-plugin-action')
      }
      if (!bindDnd5eApplicationEffectLinks(context.state, context.events)) return context.fail('invalid-target')
      const usageKeys = activity.requirements?.flatMap((requirement) =>
        requirement.kind === 'once-per-turn' ? [requirement.key] : []) ?? []
      if (usageKeys.length > 0) {
        if (!context.markActivityTurnUsage) return context.fail('invalid-plugin-action')
        context.markActivityTurnUsage(usageKeys)
      }
      const succeeded = context.succeed()
      if (!succeeded.ok) return succeeded
      finishDnd5eActivityContinuationV1(succeeded.state, continuationCommand, activity, continuation.rolls, result.checks, continuation.pending)
      context.events.push({ type: 'activity-resolved', actorId: context.actor.id, activityId: activity.id,
        targetIds: targets.map(target => target.id),
        sourceKind: activity.legacySource?.kind === 'spell' ? 'spell' : activity.legacySource?.kind === 'item' ? 'item' :
          activity.legacySource?.kind === 'monster' || activity.legacySource?.kind === 'monster-action' ? 'action' : 'feature',
        sourceId: activity.legacySource?.id ?? activity.id, castLevel: context.action.castLevel,
      })
      return {
        ...succeeded,
        activityDefinition: selectedActivity,
        activityAreaInstance: result.areaInstance,
        activityHandoffs: {
          teleportInterruptionState,
          persistentAreas: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'create-persistent-area' }> =>
            proposal.kind === 'create-persistent-area'),
          summons: resolvedSummons,
          duplications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'duplicate-creature' }> =>
            proposal.kind === 'duplicate-creature'),
          movements: resolvedMovements,
          areaRelocations: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'relocate-granting-area' }> =>
            proposal.kind === 'relocate-granting-area'),
          areaShrinks: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'shrink-granting-area' }> => proposal.kind === 'shrink-granting-area'),
          areaReshapes: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'reshape-granting-area' }> =>
            proposal.kind === 'reshape-granting-area'),
          areaModeChanges: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'change-granting-area-mode' }> => proposal.kind === 'change-granting-area-mode'),
          areaSenseModes: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'set-granting-area-senses' }> =>
            proposal.kind === 'set-granting-area-senses'),
          areaDetonations: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'detonate-granting-area' }> =>
            proposal.kind === 'detonate-granting-area'),
          areaDismissals: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'dismiss-granting-area' }> => proposal.kind === 'dismiss-granting-area'),
          invocations: [],
          persistentEntityImpacts: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'affect-persistent-entity' }> => proposal.kind === 'affect-persistent-entity'),
          looseEarthTransfers: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'transfer-loose-earth' }> => proposal.kind === 'transfer-loose-earth'),
      mapObjectLaunches: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'launch-map-object' }> => proposal.kind === 'launch-map-object'),
          mapObjectLocks: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'modify-map-object-lock' }> =>
            proposal.kind === 'modify-map-object-lock'),
          areaSpellDamageTypes:result.areaSpellDamageTypes??[],
          areaFuelIgnitions: result.proposals.filter((proposal): proposal is Extract<Dnd5eActivityCapabilityProposal, {kind:'ignite-area-fuel'}> => proposal.kind === 'ignite-area-fuel'),
          areaFlameExtinguishings: result.proposals.filter((proposal): proposal is Extract<Dnd5eActivityCapabilityProposal, {kind:'extinguish-area-flames'}> => proposal.kind === 'extinguish-area-flames'),
          mapWaterChanges: result.proposals.filter((proposal): proposal is Extract<Dnd5eActivityCapabilityProposal, {kind:'control-map-water'}> => proposal.kind === 'control-map-water'),
          mapFlameChanges: result.proposals.filter((proposal): proposal is Extract<Dnd5eActivityCapabilityProposal, {kind:'control-map-flame'}> => proposal.kind === 'control-map-flame'),
          mapWeaponEnchantments: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'enchant-map-weapon' }> => proposal.kind === 'enchant-map-weapon'),
          mapObjectLights: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'enchant-map-object-light' }> =>
            proposal.kind === 'enchant-map-object-light'),
          mapItemConversions: result.proposals.filter((proposal): proposal is Extract<Dnd5eActivityCapabilityProposal, {kind: 'convert-map-inventory-item'}> => proposal.kind === 'convert-map-inventory-item'),
      mapRemainsProtections: result.proposals.filter((proposal): proposal is Extract<typeof proposal, {kind:'protect-map-remains'}> => proposal.kind === 'protect-map-remains'),
          mapObjectPurifications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'purify-map-consumables' }> =>
            proposal.kind === 'purify-map-consumables'),
          mapVegetationChanges: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'wither-map-vegetation' }> =>
            proposal.kind === 'wither-map-vegetation'),
          inventoryIdentifications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'identify-inventory-item' }> =>
            proposal.kind === 'identify-inventory-item'),
          inventoryPurifications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'purify-inventory-item' }> =>
            proposal.kind === 'purify-inventory-item'),
          inventoryGrants: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'grant-inventory-item' }> =>
            proposal.kind === 'grant-inventory-item'),
          inventoryAlterations: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'alter-inventory-item' }> =>
            proposal.kind === 'alter-inventory-item'),
          spellAuthorities: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'establish-spell-authority' }> =>
            proposal.kind === 'establish-spell-authority'),
          spellAuthorityTransitions: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'transition-spell-authority' }> =>
            proposal.kind === 'transition-spell-authority'),
        },
      }
    },
  }
}
