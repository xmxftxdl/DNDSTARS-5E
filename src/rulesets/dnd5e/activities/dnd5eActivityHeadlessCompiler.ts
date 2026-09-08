import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import { SKILLS } from '../../../lib/dnd'
import { dnd5eCombatantCanHearSource } from '../audibility'
import {
  dnd5eAbilityCheckRollMode,
  dnd5eCombatantCanSpeak,
  type Dnd5eCombatant,
} from '../headlessCombatEngine'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import {
  dnd5eActiveControlledDescent,
  dnd5eActiveFlySpeed,
  dnd5eActiveHoverWhileFlying,
  dnd5eHasActiveSpellRuleState,
} from '../activeEffects'
import type {
  Dnd5ePluginHeadlessActionContext,
  Dnd5ePluginHeadlessActionDefinition,
} from '../plugins/pluginHeadlessContracts'
import type { Dnd5eActivityCheckV1, Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import {
  dnd5eActivityChoiceIsRelevantV1,
  dnd5eActivityOutcomeAllowsChoicesV1,
} from './dnd5eActivityChoices'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import {
  resolveDnd5eActivity,
  type Dnd5eActivityActorSnapshot,
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
) {
  return collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { critical, scaling })
}

export function dnd5eActivityHeadlessCompatibility(
  activity: Dnd5eActivityDefinitionV1,
  options: { outerSpellTransaction?: boolean } = {},
): Dnd5eActivityHeadlessCompatibility {
  const reasons = [...validateDnd5eActivityDefinitionV1(activity)]
  if (activity.authorityBinding) {
    reasons.push(`Activity delegates to native authority: ${activity.authorityBinding.execution}`)
  }
  const checks = activity.checks ?? []
  for (const check of checks) {
    if (check.kind === 'random-roll') {
      continue
    }
    if (![
      'saving-throw', 'attack-roll', 'ability-check', 'skill-check',
      'concentration-check', 'opposed-ability-check',
    ].includes(check.kind) || check.scope !== 'per-target') {
      reasons.push(`unsupported plugin Headless check: ${check.kind}/${check.scope ?? 'shared'}`)
    }
    if (check.kind !== 'opposed-ability-check' && !['normal', 'host-derived'].includes(check.rollMode ?? 'normal')) {
      reasons.push(`unsupported plugin Headless check roll mode: ${check.rollMode}`)
    }
  }
  for (const consumption of activity.consumption ?? []) {
    if (
      consumption.kind !== 'action-economy' && consumption.kind !== 'resource' &&
      consumption.kind !== 'movement' &&
      !(options.outerSpellTransaction && consumption.kind === 'spell-slot')
    ) {
      reasons.push(`unsupported plugin Headless consumption: ${consumption.kind}`)
    }
  }
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) {
      if (operation.kind === 'invoke-activity') reasons.push(`unsupported plugin Headless operation: ${operation.kind}`)
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
): Dnd5eActivityActorSnapshot {
  const resurrectionPenalty = combatant.classState.resurrectionPenalty?.value ?? 0
  const prone = combatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const canRemainAirborne = combatant.movementSpeeds?.hover === true ||
    dnd5eActiveHoverWhileFlying(combatant.classState.activeEffects) || (
    !prone && Math.max(
      combatant.movementSpeeds?.fly ?? 0,
      dnd5eActiveFlySpeed(combatant.classState.activeEffects) ?? 0,
    ) > 0
  ) || dnd5eActiveControlledDescent(combatant.classState.activeEffects) != null
  return {
    id: combatant.id,
    statBlockId: combatant.statBlockId,
    controller: combatant.controller,
    level: combatant.level,
    proficiencyBonus: combatant.proficiencyBonus,
    abilities: { ...combatant.abilities },
    classLevels: combatant.classLevels ? Object.fromEntries(
      Object.entries(combatant.classLevels)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ) : undefined,
    currentHp: combatant.currentHp,
    maxHp: combatant.maxHp,
    speed: combatant.speed,
    armorClass: combatant.armorClass,
    sizeRank: combatant.sizeRank,
    creatureType: combatant.creatureType,
    illumination: combatant.illumination,
    airborne: combatant.airborne,
    canRemainAirborne,
    spellSaveDc: combatant.saveDc,
    spellAttackBonus: combatant.saveDc == null ? undefined : combatant.saveDc - 8,
    // A saved spell DC is the Host-authoritative spellcasting snapshot used by
    // long-lived granted Activities.  Reconstruct the casting ability modifier
    // from DC = 8 + proficiency + ability modifier so formulas such as Arcane
    // Hand's push distance and squeeze damage remain available after the cast.
    spellcastingAbilityModifier: combatant.saveDc == null
      ? undefined
      : combatant.saveDc - 8 - combatant.proficiencyBonus,
    conditions: combatant.conditions.filter((condition): condition is Dnd5eStandardConditionId =>
      STANDARD_CONDITIONS.has(condition)),
    conditionImmunities: combatant.conditionImmunities.filter(
      (condition): condition is Dnd5eStandardConditionId => STANDARD_CONDITIONS.has(condition),
    ),
    // The generic d20 modifier below applies the resurrection ordeal to every
    // d20 roll. Strip it from saves that already carry the penalty so Activity
    // saving throws receive it exactly once.
    savingThrowModifiers: Object.fromEntries(Object.entries(combatant.savingThrowBonuses)
      .map(([ability, modifier]) => [ability, modifier - resurrectionPenalty])),
    savingThrowProficiencies: [...combatant.savingThrowProficiencies],
    activeEffectDefinitionIds: (combatant.classState.activeEffects ?? []).map((effect) => ({
      definitionId: effect.definitionId,
      sourceActorId: effect.source.actorId,
    })),
    activeEffectSourceSpellSaveDcs: (combatant.classState.activeEffects ?? []).flatMap((effect) =>
      effect.source.spellSaveDc == null ? [] : [{
        definitionId: effect.definitionId,
        sourceSpellSaveDc: effect.source.spellSaveDc,
      }]),
    abilityCheckModifiers: Object.fromEntries((['str', 'dex', 'con', 'int', 'wis', 'cha'] as const)
      .map((ability) => [ability, Math.floor((combatant.abilities[ability] - 10) / 2)])),
    skillCheckModifiers: Object.fromEntries(SKILLS.map((skill) => {
      const rank = combatant.classSelections.expertise?.includes(skill.key)
        ? 2
        : combatant.skillProficiencies.includes(skill.key) ? 1 : 0
      return [skill.key, Math.floor((combatant.abilities[skill.ability] - 10) / 2) +
        combatant.proficiencyBonus * rank]
    })),
    resources: Object.fromEntries(Object.entries(combatant.classResources).map(([id, resource]) => [id, {
      current: resource.current,
      maximum: resource.max,
    }])),
    equipment: combatant.activityEquipment ? structuredClone(combatant.activityEquipment) : undefined,
    spellcasting: combatant.activitySpellcasting
      ? { ...combatant.activitySpellcasting, classIds: [...combatant.activitySpellcasting.classIds] }
      : undefined,
    successfulSpellSaveNegatesDamage: combatant.successfulSpellSaveNegatesDamage,
    magicSuppressed: combatant.magicSuppressed,
    spellSuppressionAreas: combatant.spellSuppressionAreas?.map((entry) => ({ ...entry })),
    summonedSourceCombatantId: combatant.summonedSourceCombatantId,
    summonedPersistent: combatant.summonedPersistent,
    elementalAdeptDamageTypes: combatant.elementalAdeptDamageTypes
      ? [...combatant.elementalAdeptDamageTypes]
      : undefined,
    maximizeHealingDice: dnd5eHasActiveSpellRuleState(
      combatant.classState.activeEffects,
      'beacon-of-hope',
      'maximum-healing',
    ),
    d20RollModifier: resurrectionPenalty || undefined,
    canHearActivitySource: activitySource
      ? dnd5eCombatantCanHearSource(combatant, activitySource)
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
      return { expiresAt: 'source-turn-end', remainingRounds: duration.rounds }
    }
    if (duration.expiresAt === 'target-turn-start') {
      return { expiresAt: 'target-next-turn-start', remainingRounds: duration.rounds }
    }
    return { expiresAt: 'target-turn-end', remainingRounds: duration.rounds }
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
    duration,
    conditions: proposal.conditions,
    extensionCondition: proposal.extensionCondition,
    breakOn: proposal.breakOn,
    sourceLink: proposal.sourceLink,
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
  const formulaRolls = collectDnd5eActivityFormulaRollDeclarationsV1(activity)
  const sharedRandomChecks = (activity.checks ?? []).filter((check): check is Extract<Dnd5eActivityCheckV1, { kind: 'random-roll' }> =>
    check.kind === 'random-roll' && check.scope !== 'per-target')
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
    }))],
    perTargetRolls: targetChecks.flatMap((check) => check.kind === 'opposed-ability-check'
      ? [{
          id: check.rollId,
          label: `${activity.name} · 发起方${check.sourceAbility.toUpperCase()}检定`,
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
              (check.rollModeByCreatureType != null || check.rollModeBySizeRank != null)
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
      const actionPayload = context.action.payload && typeof context.action.payload === 'object' &&
        !Array.isArray(context.action.payload)
        ? context.action.payload as Record<string, unknown>
        : undefined
      const requiresMagicMouth = activity.outcomes.some((outcome) => outcome.operations.some((operation) =>
        operation.kind === 'create-persistent-area' && operation.mappedObjectEnchantment === 'magic-mouth'))
      const magicMouth = normalizeDnd5eMagicMouthConfigV1(actionPayload?.magicMouth)
      if (requiresMagicMouth && !magicMouth) return context.fail('invalid-plugin-action')
      // Empty-ground area Activities intentionally have no creature target.
      // Falling back to the actor fabricated a self target after Host area
      // validation and made otherwise valid persistent entities fail the
      // Activity relation/includeSelf gate during the live spell transaction.
      const targets = context.targets.length > 0
        ? context.targets
        : activity.target.kind === 'self'
          ? [context.actor]
          : activity.target.kind === 'area'
            ? []
            : context.target
              ? [context.target]
              : []
      const submittedAttackCritical = dnd5eActivitySubmittedAttackRollIsCriticalV1(activity, {
        targetIds: targets.map((target) => target.id),
        rolls: context.rolls,
        hostRollMode: (targetId, delivery) => context.attackRollMode(targetId, delivery),
      })
      const execute = (forcedAttackMissCheckKeys?: ReadonlySet<string>) => resolveDnd5eActivity({
        activity,
        actor: actorSnapshot(context.actor, context.actor),
        targets: targets.map((target) => actorSnapshot(target, context.actor)),
        combatants: Object.values(context.state.combatants)
          .map((combatant) => actorSnapshot(combatant, context.actor)),
        rolls: Object.fromEntries(Object.entries(context.rolls).map(([id, roll]) => [id, { values: roll.values }])),
        checkRollModes: Object.fromEntries(targetChecks.flatMap((check) =>
          check.kind === 'opposed-ability-check'
            ? targets.flatMap((target) => {
                const targetOption = check.targetOptions[0]!
                return [
                  ...(check.sourceRollMode === 'host-derived'
                    ? [[`${check.id}:${target.id}:source`, dnd5eAbilityCheckRollMode(context.actor, {
                        ability: check.sourceAbility,
                      })] as const]
                    : []),
                  ...(check.targetRollMode === 'host-derived'
                    ? [[`${check.id}:${target.id}:target`, dnd5eAbilityCheckRollMode(target, {
                        ability: targetOption.ability, skill: targetOption.skill,
                      })] as const]
                    : []),
                ]
              })
            : check.kind !== 'random-roll' && check.rollMode === 'host-derived'
            ? targets.map((target) => [`${check.id}:${target.id}`,
                check.kind === 'saving-throw'
                  ? dnd5eActivityHostSavingThrowModeV1({
                      activity,
                      actor: context.actor,
                      target,
                      check,
                      sourceDistanceFeet: pairDistance(context, target.id),
                    })
                  : check.kind === 'attack-roll'
                    ? context.attackRollMode(target.id, check.delivery)
                    : dnd5eAbilityCheckRollMode(context.actor, {
                        ability: check.ability,
                        skill: check.kind === 'skill-check' ? check.skill : undefined,
                      })] as const)
            : [])),
        distanceFeetByTargetId: Object.fromEntries(targets.flatMap((target) => {
          const distance = pairDistance(context, target.id)
          return distance == null ? [] : [[target.id, distance]]
        })),
        parentDamageType: context.parentAttackDamageType,
        areaPlacement: context.action.activityAreaPlacement,
        areaPlacementDistanceFeet: context.action.activityAreaPlacementDistanceFeet,
        ...(context.action.activityAreaExemptTargetIds
          ? { areaExemptTargetIds: context.action.activityAreaExemptTargetIds }
          : {}),
        secretPhrase: typeof actionPayload?.secretPhrase === 'string'
          ? actionPayload.secretPhrase
          : undefined,
        castLevel: context.action.castLevel,
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
        choices: (() => {
          const payload = context.action.payload && typeof context.action.payload === 'object' && !Array.isArray(context.action.payload)
            ? context.action.payload as Record<string, unknown>
            : undefined
          const submitted = payload?.activityChoices && typeof payload.activityChoices === 'object' && !Array.isArray(payload.activityChoices)
            ? Object.fromEntries(Object.entries(payload.activityChoices).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
            : {}
          const resolved: Record<string, string> = {}
          for (const choice of activity.choices ?? []) {
            if (!dnd5eActivityChoiceIsRelevantV1(activity, choice, { ...submitted, ...resolved })) continue
            const selected = submitted[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id
            if (selected) resolved[choice.id] = selected
          }
          return resolved
        })(),
        usedTurnKeys: new Set(context.activityUsedTurnKeys?.() ?? []),
        dmApproved: context.action.interruptChoiceId === 'dm-apply',
        forcedAttackMissCheckKeys,
        allowCriticalDiceSuperset: submittedAttackCritical,
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
      if (
        result.status === 'dm-adjudication-required' &&
        context.action.interruptChoiceId !== 'dm-apply'
      ) return context.fail('dm-adjudication-pending')
      for (const resolvedCheck of result.checks) {
        const declaredCheck = targetChecks.find((check) => check.id === resolvedCheck.checkId)
        if (
          declaredCheck?.kind === 'attack-roll' &&
          resolvedCheck.targetId != null &&
          resolvedCheck.dc != null
        ) {
          context.events.push({
            type: 'attack-resolved',
            actorId: context.actor.id,
            targetId: resolvedCheck.targetId,
            d20: resolvedCheck.d20,
            total: resolvedCheck.total,
            armorClass: resolvedCheck.dc,
            hit: resolvedCheck.success,
            critical: resolvedCheck.criticalSuccess === true && resolvedCheck.success,
            attackMode: 'spell',
            attackOrigin: 'other',
          })
        } else if (
          declaredCheck?.kind === 'saving-throw' &&
          resolvedCheck.targetId != null &&
          resolvedCheck.ability != null &&
          resolvedCheck.dc != null
        ) {
          context.events.push({
            type: 'saving-throw-resolved',
            targetId: resolvedCheck.targetId,
            ability: resolvedCheck.ability,
            d20: resolvedCheck.d20,
            modifier: resolvedCheck.modifier,
            total: resolvedCheck.total,
            dc: resolvedCheck.dc,
            success: resolvedCheck.success,
            automaticOutcome: resolvedCheck.automaticOutcome,
          })
        } else if (
          (declaredCheck?.kind === 'ability-check' || declaredCheck?.kind === 'skill-check' ||
            declaredCheck?.kind === 'concentration-check') &&
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
      for (const consumption of result.consumptions) {
        if (consumption.kind === 'action-economy') {
          // The outer feature transaction spends the declared action economy.
          continue
        }
        if (consumption.kind === 'spell-slot' && options.outerSpellTransaction) {
          // The atomic plugin-spell wrapper validates and spends the selected slot.
          continue
        }
        if (consumption.kind === 'resource') {
          const applies = consumption.consumeOn === 'hit'
            ? result.checks.some((check) => check.success)
            : consumption.consumeOn === 'dm-approval'
              ? context.action.interruptChoiceId === 'dm-apply'
              : true
          if (applies && !context.spendResource(consumption.resourceId, consumption.amount)) {
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
      for (const proposal of result.proposals) {
        if (proposal.kind === 'deal-damage') {
          context.dealDamage(proposal.targetId, proposal.amount, proposal.damageType)
        } else if (proposal.kind === 'heal') {
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
          context.heal(proposal.targetId, proposal.amount)
        } else if (proposal.kind === 'revive') {
          if (!context.revive(proposal)) return context.fail('invalid-target')
        } else if (proposal.kind === 'grant-temporary-hit-points') {
          context.grantTemporaryHitPoints(proposal.targetId, proposal.amount)
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
        } else if (proposal.kind === 'reshape-granting-area') {
          // The Host entitlement identifies the granting area. Its replacement
          // cells come only from the validated map-template selection.
          continue
        } else if (proposal.kind === 'set-granting-area-senses') {
          // Vision ownership belongs to the map entity and is committed by the
          // same Host-authoritative granting-area handoff.
          continue
        } else if (proposal.kind === 'detonate-granting-area') {
          // The map layer re-loads the granting area, settles its snapshotted
          // detonation triggers and removes it as one Host-owned transaction.
          continue
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
            allowsImmediateReply: proposal.allowsImmediateReply && dnd5eCombatantCanSpeak(target),
          })
        } else if (
          proposal.kind === 'create-persistent-area' || proposal.kind === 'summon' || proposal.kind === 'duplicate-creature' ||
          proposal.kind === 'modify-map-object-lock' || proposal.kind === 'enchant-map-object-light' ||
          proposal.kind === 'purify-map-consumables' || proposal.kind === 'identify-inventory-item' ||
          proposal.kind === 'purify-inventory-item' || proposal.kind === 'grant-inventory-item'
        ) {
          // Map-owned effects are returned below and committed only after the
          // Host has collected and validated every placement.
          continue
        } else return context.fail('invalid-plugin-action')
      }
      const usageKeys = activity.requirements?.flatMap((requirement) =>
        requirement.kind === 'once-per-turn' ? [requirement.key] : []) ?? []
      if (usageKeys.length > 0) {
        if (!context.markActivityTurnUsage) return context.fail('invalid-plugin-action')
        context.markActivityTurnUsage(usageKeys)
      }
      const succeeded = context.succeed()
      if (!succeeded.ok) return succeeded
      return {
        ...succeeded,
        activityDefinition: activity,
        activityAreaInstance: result.areaInstance,
        activityHandoffs: {
          persistentAreas: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'create-persistent-area' }> =>
            proposal.kind === 'create-persistent-area'),
          summons: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'summon' }> =>
            proposal.kind === 'summon'),
          duplications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'duplicate-creature' }> =>
            proposal.kind === 'duplicate-creature'),
          movements: resolvedMovements,
          areaRelocations: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'relocate-granting-area' }> =>
            proposal.kind === 'relocate-granting-area'),
          areaReshapes: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'reshape-granting-area' }> =>
            proposal.kind === 'reshape-granting-area'),
          areaSenseModes: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'set-granting-area-senses' }> =>
            proposal.kind === 'set-granting-area-senses'),
          areaDetonations: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'detonate-granting-area' }> =>
            proposal.kind === 'detonate-granting-area'),
          invocations: [],
          mapObjectLocks: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'modify-map-object-lock' }> =>
            proposal.kind === 'modify-map-object-lock'),
          mapObjectLights: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'enchant-map-object-light' }> =>
            proposal.kind === 'enchant-map-object-light'),
          mapObjectPurifications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'purify-map-consumables' }> =>
            proposal.kind === 'purify-map-consumables'),
          inventoryIdentifications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'identify-inventory-item' }> =>
            proposal.kind === 'identify-inventory-item'),
          inventoryPurifications: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'purify-inventory-item' }> =>
            proposal.kind === 'purify-inventory-item'),
          inventoryGrants: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'grant-inventory-item' }> =>
            proposal.kind === 'grant-inventory-item'),
          spellAuthorities: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'establish-spell-authority' }> =>
            proposal.kind === 'establish-spell-authority'),
          spellAuthorityTransitions: result.proposals.filter((proposal): proposal is Extract<typeof proposal, { kind: 'transition-spell-authority' }> =>
            proposal.kind === 'transition-spell-authority'),
        },
      }
    },
  }
}
