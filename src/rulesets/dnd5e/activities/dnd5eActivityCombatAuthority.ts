import { dnd5eActivityRetainedSaveDiceHooks, type Dnd5eActivityRetainedSaveDice } from './dnd5eActivityRetainedSaveDice'
import { dnd5eEquipmentHomingProjectileReached } from '../homingProjectilePath'
import { dnd5eActorEtherealAccess } from '../etherealAccess'
import { dnd5eCreatureSeenRecently, dnd5eSightingWorldMinute } from '../recentCreatureSightings'
import { dnd5eMonsterHitDiceMaximum } from './dnd5eMonsterHitDice'
import { dnd5eActivePerceivesVisibleCreaturesAsHostile } from '../activeEffects'
import { dnd5eCombatantEnvironmentalImmunities } from '../environmentalProtection'
import { dnd5eCombatantPerceivesHostile } from '../headlessCombatEngine'
import { dnd5eMaximizesSpellHealingAtZeroHp } from '../headlessCombatEngine'
import { dnd5eTargetDamageRollBonus } from '../targetDamageRollBonus'
import { dnd5eUndeadCreationIsProtected } from '../undeadCreationProtection'
import { dnd5eActiveCharmSourceIds } from '../sourceCharmEligibility'
import { grantedDamageSource } from '../headlessCombatEngine'
import { dnd5eTargetCriticalThreshold } from '../targetCriticalThreshold'
import { dnd5eConcentrationDefenseBonus } from '../concentrationDefense'
import { dnd5eHeadlessMaximizeHealingDice } from '../headlessCompanionHealing'
import { dnd5eActivityTargetImmunities } from './dnd5eActivityTargetExclusions'
import { dnd5eActivitySequentialCheckModesV1 } from './dnd5eActivitySequentialCheckModes'
import { dnd5eOpposedHostRollModes } from './dnd5eActivityOpposedChecks'
import { dnd5eActivityEffectiveTargetV1 } from './dnd5eActivityScaling'
import { consumeDnd5eActivityGrant } from '../headlessCombatEngine'
import { SKILLS } from '../../../lib/dnd'
import { dnd5eActivityAttackDefenses } from './dnd5eActivityAttackDefenses'
import { dnd5eActivityCanSpeakAudibly } from './dnd5eActivitySpeech'
import { dnd5eActiveSkillCheckBonus, dnd5eActiveLanguageCapabilities, dnd5eActiveSavingThrowProficiencyBonus } from '../activeEffects'
import { dnd5eSkillProficiencyRank } from '../headlessCombatEngine'
import { dnd5eEnchantedInventoryInstanceIds, dnd5eActiveArmorEnchantmentBonus, dnd5eMagicallyEnchantedWeaponIds } from '../activeEffects'
import { withDnd5eRollDiceTransaction, type Dnd5eRollDiceAudit } from '../rollDiceTransaction'
import { dnd5eClassDefinition } from '../classes'
import { dnd5eActivityEffectOriginId } from './dnd5eActivityEffectOrigin'
import { getDnd5eSrdMonster } from '../monsters'
import type { Character } from '../../../types/character'
import type { BattleMap } from '../../../store/maps'
import { dnd5eCombatantCanHearSource } from '../audibility'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import {
  dnd5eHeadlessTurnKey,
  dnd5eMonsterSpellAttackMode,
  dnd5eEnvironmentalSkillBonus,
  dnd5eCombatantCanSee,
  dnd5eEffectiveSpeed,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import { dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from '../headlessCombatPrimitives'
import type { Dnd5eActivityAuthorityInput, Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import {
  resolveAndCommitDnd5eActivityCommand,
  type Dnd5eActivityHeadlessAuthorityBridgeResult,
} from './dnd5eActivityHeadlessAuthorityBridge'
import type { Dnd5eActivityActorSnapshot, Dnd5eActivityRollMode } from './dnd5eActivityExecutor'
import type { Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import type { Dnd5eActivityConfirmedByV1 } from './dnd5eActivityInvocation'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { dnd5eCombatantEntitledToActivityV1, dnd5eActivityExecutionGrant, dnd5eActivityUsesExecutionGrant } from './dnd5eActivityEntitlements'
import { getDnd5eActivityContinuationV1 } from './dnd5eActivityContinuation'

const STANDARD_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

/**
 * Builds an Activity snapshot exclusively from the current Host combat state.
 * Callers never submit ability scores, defenses, resources, or current HP.
 */
export function dnd5eActivityActorSnapshotFromCombatantV1(
  combatant: Dnd5eCombatant,
  activitySource?: Dnd5eCombatant,
  state?: Dnd5eHeadlessCombatState,
): Dnd5eActivityActorSnapshot {
  const spellAttackBonus = combatant.saveDc == null ? undefined : combatant.saveDc - 8
  const resurrectionPenalty = combatant.classState.resurrectionPenalty?.value ?? 0
  return {
    etherealAccess: dnd5eActorEtherealAccess(state, combatant.classState.activeEffects),
    id: combatant.id,
    raging: combatant.classState.raging === true,
    criticalThresholdAgainstSource: dnd5eTargetCriticalThreshold(combatant.classState.activeEffects, activitySource?.id),
    statBlockId: combatant.statBlockId,
    name: combatant.name,
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
    summonedPersistent:combatant.summonedPersistent,summonedSourceCombatantId:combatant.summonedSourceCombatantId,summonedBondKey:combatant.summonedBondKey,
    summonedSourcePackageId: combatant.summonedSourcePackageId,
    summonedSourceActivityId: combatant.summonedSourceActivityId,
    classLevels: combatant.classLevels ? Object.fromEntries(
      Object.entries(combatant.classLevels)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ) : undefined,
    currentHp: combatant.currentHp,
    temporaryHp: combatant.temporaryHp,
    temporaryHitPointsSource: combatant.classState.temporaryHitPointsSource
      ? { ...combatant.classState.temporaryHitPointsSource } : undefined,
    maxHp: combatant.maxHp,
    speed: dnd5eEffectiveSpeed(combatant),
    armorClass: combatant.armorClass + dnd5eConcentrationDefenseBonus(combatant.pluginFeatureIds, combatant.concentrating ? combatant.classState.concentrationSpellId : undefined, 'armorClass'),
    sizeRank: combatant.sizeRank,
    creatureType: combatant.creatureType,
    elevationFeet: combatant.elevationFeet,
    groundElevationFeet: combatant.groundElevationFeet,
    upwardClearanceFeet: combatant.upwardClearanceFeet,
    environmentalImmunities: dnd5eCombatantEnvironmentalImmunities(combatant),
    conditionImmunities: combatant.conditionImmunities.filter(
      (condition): condition is Dnd5eStandardConditionId => STANDARD_CONDITIONS.has(condition),
    ),
    illumination: combatant.illumination,
    spellSaveDc: combatant.saveDc,
    spellAttackBonus,
    spellcastingAbility: (combatant.classId ? dnd5eClassDefinition(combatant.classId)?.spellcasting?.ability : undefined) ?? (combatant.statBlockId ? getDnd5eSrdMonster(combatant.statBlockId)?.spellcasting?.ability : undefined),
    spellcastingAbilityModifier: spellAttackBonus == null
      ? undefined
      : spellAttackBonus - combatant.proficiencyBonus,
    abilityCheckModifiers: Object.fromEntries(Object.entries(combatant.abilities).map(([ability, score]) => [
      ability,
      Math.floor((score - 10) / 2),
    ])),
    skillCheckModifiers: Object.fromEntries(SKILLS.map(skill => [skill.key, Math.floor((combatant.abilities[skill.ability]-10)/2) + combatant.proficiencyBonus*dnd5eSkillProficiencyRank(combatant,skill.key) +
      (state ? dnd5eEnvironmentalSkillBonus(state,combatant,skill.key) : (combatant.magicSuppressed ? 0 : combatant.persistentAreaSkillBonuses?.[skill.key] ?? 0) + dnd5eActiveSkillCheckBonus(combatant.classState.activeEffects, skill.ability, skill.key))])),
    conditions: combatant.conditions.filter((condition): condition is Dnd5eStandardConditionId =>
      STANDARD_CONDITIONS.has(condition)),
    savingThrowModifiers: Object.fromEntries(Object.entries(combatant.savingThrowBonuses)
      .map(([ability, modifier]) => [ability, modifier - resurrectionPenalty + dnd5eConcentrationDefenseBonus(combatant.pluginFeatureIds, combatant.concentrating ? combatant.classState.concentrationSpellId : undefined, 'savingThrows') + dnd5eActiveSavingThrowProficiencyBonus(combatant.classState.activeEffects, ability as keyof typeof combatant.abilities, combatant)])),
    hitPointDice: combatant.hitPointDice?.map(pool => ({ ...pool })),
    hitPointDiceMaximum: combatant.statBlockId
      ? dnd5eMonsterHitDiceMaximum(getDnd5eSrdMonster(combatant.statBlockId)?.hitPoints.dice)
      : undefined,
    resources: Object.fromEntries(Object.entries(combatant.classResources).map(([id, resource]) => [id, {
      current: resource.current,
      maximum: resource.max,
    }])),
    bodyPartPresence: combatant.classState.bodyPartPresence ? { ...combatant.classState.bodyPartPresence } : undefined,
    corpse:combatant.currentHp===0 && (combatant.deathSaves.dead || combatant.classState.deathRound!=null) ? {bodyPresent:combatant.classState.bodyPresent!==false, undeadCreationProtected:dnd5eUndeadCreationIsProtected(combatant.classState.activeEffects)} : undefined,
    ammunitionContainers:combatant.ammunitionContainers,
    maximizeHealingDice: dnd5eHeadlessMaximizeHealingDice(state, combatant),
    maximizeSpellHealingDiceAtZeroHp: dnd5eMaximizesSpellHealingAtZeroHp(combatant),
    rollDiceEffects: structuredClone((combatant.classState.activeEffects ?? []).filter(effect => effect.modifiers?.rollDiceModifiers != null)),
    charmedByActorIds: dnd5eActiveCharmSourceIds(combatant.classState.activeEffects, combatant.magicSuppressed),
    activeEffectDefinitionIds: (combatant.classState.activeEffects ?? []).map((effect) => ({
      definitionId: effect.definitionId,
      stackingKey: effect.stackingKey,
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
    elementalAdeptDamageTypes: combatant.elementalAdeptDamageTypes
      ? [...combatant.elementalAdeptDamageTypes]
      : undefined,
    d20RollModifier: resurrectionPenalty || undefined,
    canHearActivitySource: activitySource
      ? dnd5eCombatantCanHearSource(combatant, activitySource, state?.mapId)
      : undefined,
  }
}

export interface Dnd5eRegisteredActivityCombatAuthorityInputV1 {
  /** Host-collected weapon reactions; never copied from the wire command. */
  savingThrowCounterattacks?: Dnd5eActivityAuthorityInput['savingThrowCounterattacks']
  /** Host-collected reactions only; never copied from command data. */
  damageMitigationInterrupts?: Dnd5eActivityAuthorityInput['damageMitigationInterrupts']
  spellcastingSavingThrows?: Dnd5eActivityAuthorityInput['spellcastingSavingThrows']
  activityTeleportInterruptions?: readonly import('../headlessCombatEngine').Dnd5eActivityTeleportInterruptionUse[]
  sourceActionInterruptionReaction?: Dnd5eActivityAuthorityInput['sourceActionInterruptionReaction']
  counterspellReaction?: Dnd5eActivityAuthorityInput['counterspellReaction']
  /** Host-collected choices; never read from the wire command. */
  disadvantageNegationChoices?: Dnd5eActivityAuthorityInput['disadvantageNegationChoices']
  /** Host-owned scene and clock for inventory exchange; never copied from command data. */
  exchangeScene?: { map: BattleMap; actorTokenId: string }
  worldMinute?: number
  /** Internal rest gate receipt; never read from a player Activity command. */
  allowInactiveRestCommit?: boolean
  allowInactiveAwakeningCommit?: boolean
  /** Host-validated personal damage checkpoint only; never serialized in a command. */
  allowInactiveDamageReactionCommit?: boolean
  /** Internal Host death-event settlement only; never serialized in a command. */
  allowInactiveDeathReactionCommit?: boolean
  state: Dnd5eHeadlessCombatState
  command: Dnd5eExecuteActivityCommandV1
  /** Revision of the authoritative combat resource that produced `state`. */
  combatRevision: number
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  authoritativeRetainedSaveDice?: Dnd5eActivityRetainedSaveDice
  /** Host-owned prepared equipment profile; never copied from the submitted command. */
  equipmentWeaponDamage?: import('./dnd5eEquipmentWeaponDamage').Dnd5eEquipmentWeaponDamageSnapshot
  /** Existing map attack ledger, supplied by the Host only; never read from command. */
  equipmentAttackBudget?: Parameters<typeof import('../attackActionSlot').dnd5eAttackActionSlot>[0]
  featureAttackBudget?: Parameters<typeof import('../attackActionSlot').dnd5eAttackActionSlot>[0]
  /** Host-selected conditional extra attack, revalidated against the source combat state. */
  distinctTargetBonusAttackFeatureId?: string
  authoritativeEffectRollDice?: Readonly<Record<string, readonly number[]>>
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  /** Trusted Host assessments, never read from the player command. */
  saveFactsByTargetId?: import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactsV1
  areaPlacementDistanceFeet?: number
  areaTargetIds?: readonly string[]
  parentDamageType?: Dnd5eActivityAuthorityInput['parentDamageType']
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
  dmApproved?: boolean
  inventoryOwner?: Character
  inventoryRoster?:readonly Character[]
  /** Host-owned character projection used for race/background/feat/item entitlement. */
  actorCharacter?: Character
}

/**
 * The single authoritative runtime entry for registered Activities. It derives
 * every mutable rule snapshot and distance from combat state, resolves the
 * registered recipe, and commits costs/effects atomically.
 */
export function resolveRegisteredDnd5eActivityInCombatV1(
  input: Dnd5eRegisteredActivityCombatAuthorityInputV1,
): Dnd5eActivityHeadlessAuthorityBridgeResult {
  const audit: Dnd5eRollDiceAudit[] = []
  try {
    const wrapped = withDnd5eRollDiceTransaction({eventId: input.command.commandId,
      rolls: input.authoritativeEffectRollDice, onAudit: entry => audit.push(entry)}, () => {
      const value = resolveRegisteredDnd5eActivityInCombatInternal(input)
      return {ok: value.result.ok, value}
    })
    const value = wrapped.value
    if (value.phase === 'commit' && value.result.ok) {
      const events = [...value.result.events]
      const activity = getRegisteredDnd5eActivity(input.command.packageId, input.command.activityId)!
      const executionGrant = dnd5eActivityUsesExecutionGrant(activity) ? dnd5eActivityExecutionGrant({
        packageId: input.command.packageId, activity, combatant: input.state.combatants[input.command.actorId],
        targetIds: input.command.targetIds, triggerContext: input.triggerContext,
      }) : undefined
      consumeDnd5eActivityGrant({ before: input.state, after: value.result.state, actorId: input.command.actorId,
        packageId: input.command.packageId, activityId: input.command.activityId, targetIds: input.command.targetIds,
        grantEffectId: input.command.grantEffectId ?? executionGrant?.id, events })
      return { ...value, result: { ...value.result, events, rollDiceAudit: audit.length ? audit : undefined } }
    }
    return value
  } catch (error) {
    if (!(error instanceof RangeError) || !error.message.startsWith('roll-dice-')) throw error
    return {phase:'resolve',result:{ok:false,reason:'invalid-rolls',details:[error.message]}}
  }
}

function resolveRegisteredDnd5eActivityInCombatInternal(
  input: Dnd5eRegisteredActivityCombatAuthorityInputV1,
): Dnd5eActivityHeadlessAuthorityBridgeResult {
  const actor = input.state.combatants[input.command.actorId]
  const targets = input.command.targetIds.map((id) => input.state.combatants[id])
  const requestedAreaExemptTargetIds = input.command.areaExemptTargetIds ?? []
  const areaExemptTargetIds = requestedAreaExemptTargetIds.filter((id) => !!input.state.combatants[id])
  if (!actor || targets.some((target) => !target)) {
    return {
      phase: 'resolve',
      result: {
        ok: false,
        reason: !actor ? 'unauthorized-actor' : 'target-snapshot-mismatch',
        details: [!actor ? 'actor is absent from Host combat state' : 'target is absent from Host combat state'],
      },
    }
  }
  if (areaExemptTargetIds.length !== requestedAreaExemptTargetIds.length) {
    return {
      phase: 'resolve',
      result: { ok: false, reason: 'target-snapshot-mismatch', details: ['an area trigger exemption is absent from Host combat state'] },
    }
  }
  const activity = getRegisteredDnd5eActivity(input.command.packageId, input.command.activityId)
  if (!activity || (!(getDnd5eActivityContinuationV1(input.state, input.command) && !activity.requiresEffectGrant && input.command.grantEffectId === undefined) && !dnd5eCombatantEntitledToActivityV1({
    packageId: input.command.packageId,
    activity,
    combatant: actor,
    targetIds: input.command.targetIds,
    character: input.actorCharacter ?? input.inventoryOwner,
    triggerContext: input.triggerContext,
    grantEffectId: input.command.grantEffectId,
  }))) {
    return {
      phase: 'resolve',
      result: {
        ok: false,
        reason: 'unauthorized-actor',
        details: ['actor is not entitled to the registered Activity'],
      },
    }
  }
  const spatialActivity = { ...activity, target: dnd5eActivityEffectiveTargetV1(activity,
    { actor, castLevel: input.command.castLevel }, input.command.choices) }
  const seenWithin = spatialActivity.target.kind === 'creature' ? spatialActivity.target.requiresSeenWithinSeconds : undefined
  if (seenWithin != null && targets.some(target => !dnd5eCreatureSeenRecently({
    history: actor.classState.recentCreatureSightings, targetId: target!.id, mapId: input.state.mapId ?? '',
    worldMinute: dnd5eSightingWorldMinute(input.state.companionScene?.worldMinute,input.state.companionScene?.worldSecondRemainder), maximumAgeSeconds: seenWithin,
    currentlyVisible: dnd5eCombatantCanSee(input.state, actor.id, target!.id),
  }))) return { phase: 'resolve', result: { ok: false, reason: 'target-snapshot-mismatch',
    details: ['selected target has no qualifying recent Host sighting'] } }
  if (((spatialActivity.target.kind === 'creature' && spatialActivity.target.requiresLineOfSight === true) ||
    (spatialActivity.target.kind === 'area' && spatialActivity.target.requiresVisibleTargets === true)) &&
    targets.some(target => !dnd5eCombatantCanSee(input.state, actor.id, target!.id))) {
    return { phase: 'resolve', result: { ok: false, reason: 'target-snapshot-mismatch',
      details: ['selected target is not visible to the actor in Host combat state'] } }
  }
  if (spatialActivity.target.kind === 'creature' && spatialActivity.target.requiresTargetSeeActor === true &&
    targets.some(target => !dnd5eCombatantCanSee(input.state, target!.id, actor.id))) {
    return { phase: 'resolve', result: { ok: false, reason: 'target-snapshot-mismatch',
      details: ['selected target cannot perceive the actor in Host combat state'] } }
  }
  const origin=dnd5eActivityEffectOriginId(input.state,actor.id,spatialActivity)
  if (spatialActivity.target.kind === 'creature' && spatialActivity.target.requiresLineOfEffect === true &&
    targets.some(target => !origin || input.state.lineOfEffectBlockedByCombatantPair?.[
      dnd5eDirectedCombatantPairKey(origin, target!.id)] === true)) {
    return { phase: 'resolve', result: { ok: false, reason: 'target-snapshot-mismatch',
      details: ['selected target is blocked from the effect origin in Host combat state'] } }
  }
  let equipmentWeaponDamage = input.equipmentWeaponDamage
  if (activity.equipmentHomingProjectile) {
    const reached = dnd5eEquipmentHomingProjectileReached({ state: input.state, actorId: actor.id,
      targetIds: input.command.targetIds, profile: equipmentWeaponDamage?.profile })
    if (reached == null || !equipmentWeaponDamage) {
      return { phase: 'resolve', result: { ok: false, reason: 'target-snapshot-mismatch', details: ['Host homing scene/equipment unavailable or vertical route unsupported'] } }
    }
    equipmentWeaponDamage = { ...equipmentWeaponDamage, homingReached: reached }
  }

  const distanceFeetByTargetId = Object.fromEntries(Object.values(input.state.combatants).map((target) => [
    target!.id,
    target!.id === origin
      ? 0
      : origin ? input.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(origin, target!.id)] ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY,
  ]))
  const turnKey = dnd5eHeadlessTurnKey(input.state, actor.id)
  const usedTurnKeys = new Set(Object.entries(actor.classState.declarativeUsedTurnKeys ?? {})
    .filter(([, appliedTurnKey]) => appliedTurnKey === turnKey)
    .map(([key]) => key))

  return resolveAndCommitDnd5eActivityCommand(input.state, {
    savingThrowCounterattacks: input.savingThrowCounterattacks,
    ...dnd5eActivityRetainedSaveDiceHooks(input.state, actor.id, input.authoritativeRetainedSaveDice),
    damageMitigationInterrupts: input.damageMitigationInterrupts,
    spellcastingSavingThrows: input.spellcastingSavingThrows,
    activityTeleportInterruptions: input.activityTeleportInterruptions,
    sourceActionInterruptionReaction: input.sourceActionInterruptionReaction,
    counterspellReaction: input.counterspellReaction,
    resolveDamageRollBonus: (targetId, attribution) => dnd5eTargetDamageRollBonus(input.state.combatants[targetId]?.classState.activeEffects,
      attribution === 'grant-source' ? grantedDamageSource(input.state, actor, input.command.packageId, input.command.activityId, targetId)?.actor.id : actor.id),
    command: input.command,
    currentRevision: input.combatRevision,
    combatActive: input.state.active,
    currentTurnActorId: input.state.active ? input.state.initiativeOrder[input.state.initiativeIndex] : undefined,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, input.state),
    combatants: Object.values(input.state.combatants).map(combatant => dnd5eActivityActorSnapshotFromCombatantV1(combatant, actor, input.state)),
    targets: targets.map((target) => ({ ...dnd5eActivityActorSnapshotFromCombatantV1(target!, actor, input.state), conditionImmunities: dnd5eActivityTargetImmunities(spatialActivity, target!, actor), attackArmorClasses: dnd5eActivityAttackDefenses(input.state, actor.id, target!.id) })),
    authoritativeRolls: input.authoritativeRolls,
    disadvantageNegationChoices: input.disadvantageNegationChoices,
    saveFactsByTargetId: input.saveFactsByTargetId,
    resolveSequentialCheckRollModes: dnd5eActivitySequentialCheckModesV1({
      activity: spatialActivity, actor, combatants: input.state.combatants,
      sourceDistanceFeet: targetId => distanceFeetByTargetId[targetId],
    }),
    checkRollModes: { ...input.checkRollModes, ...Object.fromEntries((spatialActivity.checks ?? []).flatMap(check =>
      check.kind === 'attack-roll' && check.rollMode === 'host-derived' && (check.attackType ?? 'spell') === 'spell'
        ? targets.map(target => [check.scope === 'per-target' ? `${check.id}:${target!.id}` : check.id,
            dnd5eMonsterSpellAttackMode(input.state, actor.id, target!.id, check.delivery, undefined, { activity: spatialActivity })] as const)
        : [])), ...Object.fromEntries((spatialActivity.checks ?? []).flatMap(check =>
      check.kind === 'opposed-ability-check' ? targets.flatMap(target => {
        const modes = dnd5eOpposedHostRollModes(check, actor, target!)
        return [
          [`${check.id}:${target!.id}:source-final`, modes.source] as const,
          [`${check.id}:${target!.id}:target-final`, modes.target] as const,
          ...(check.sourceRollMode === 'host-derived' ? [[`${check.id}:${target!.id}:source`, modes.source] as const] : []),
          ...(check.targetRollMode === 'host-derived' ? [[`${check.id}:${target!.id}:target`, modes.target] as const] : []),
        ]
      }) : [])) },
    distanceFeetByTargetId,
    equipmentWeaponDamage,
    distanceFeetBetweenTargets: (spatialActivity.target.kind === 'creature' && spatialActivity.target.maximumTargetSeparationFeet != null) ||
          spatialActivity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'apply-effect' && operation.conditionSourceMaximumDistanceFeet != null))
      ? Object.fromEntries(Object.values(input.state.combatants).map((first) => [first!.id, Object.fromEntries(Object.values(input.state.combatants).flatMap((second) => {
          const distance = first!.id === second!.id ? 0 : input.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(first!.id, second!.id)]
          return distance == null ? [] : [[second!.id, distance]]
        }))]))
      : undefined,
    areaPlacementDistanceFeet: input.areaPlacementDistanceFeet,
    areaTargetIds: input.areaTargetIds,
    areaExemptTargetIds,
    secretPhrase: input.command.secretPhrase,
    parentDamageType: input.parentDamageType,
    usedTurnKeys,
    dmApproved: input.dmApproved,
    triggerContext: input.triggerContext,
    confirmedBy: input.confirmedBy,
    inventoryOwner: input.inventoryOwner,
    inventoryRoster:input.inventoryRoster,
  }, { equipmentAttackBudget: input.equipmentAttackBudget, featureAttackBudget:input.featureAttackBudget,
    distinctTargetBonusAttackFeatureId: input.distinctTargetBonusAttackFeatureId, allowInactiveRestCommit: input.allowInactiveRestCommit,
    allowInactiveAwakeningCommit: input.allowInactiveAwakeningCommit,
    allowInactiveDamageReactionCommit: input.allowInactiveDamageReactionCommit,
    allowInactiveDeathReactionCommit: input.allowInactiveDeathReactionCommit,
    exchangeScene: input.exchangeScene, worldMinute: input.worldMinute })
}
