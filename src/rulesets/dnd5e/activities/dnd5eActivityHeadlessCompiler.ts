import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eCombatant } from '../headlessCombatEngine'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import { dnd5eSavingThrowMode } from '../passiveDefenses'
import type {
  Dnd5ePluginHeadlessActionContext,
  Dnd5ePluginHeadlessActionDefinition,
} from '../plugins/pluginHeadlessContracts'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import {
  resolveDnd5eActivity,
  type Dnd5eActivityActorSnapshot,
  type Dnd5eActivityCapabilityProposal,
  type Dnd5eResolvedEffectDuration,
} from './dnd5eActivityExecutor'
import {
  collectScaledDnd5eActivityFormulaRollDeclarationsV1,
} from './dnd5eActivityRollRecipe'
import type { Dnd5eActivityScalingContextV1 } from './dnd5eActivityScaling'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

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
): readonly Dnd5eActivityManualAdjudicationOperationV1[] {
  return activity.outcomes.flatMap((outcome) => outcome.operations.filter(
    (operation): operation is Dnd5eActivityManualAdjudicationOperationV1 =>
      operation.kind === 'manual-adjudication',
  ))
}

const STANDARD_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

function selectedSavingThrowAbility(
  target: Dnd5eCombatant,
  primary: AbilityKey,
  options?: readonly AbilityKey[],
): AbilityKey {
  const modifier = (ability: AbilityKey) => target.savingThrowBonuses[ability] ??
    Math.floor((target.abilities[ability] - 10) / 2)
  return (options?.length ? options : [primary]).reduce((best, candidate) =>
    modifier(candidate) > modifier(best) ? candidate : best, primary)
}

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
    if (!['saving-throw', 'attack-roll'].includes(check.kind) || check.scope !== 'per-target') {
      reasons.push(`unsupported plugin Headless check: ${check.kind}/${check.scope ?? 'shared'}`)
    }
    if (!['normal', 'host-derived'].includes(check.rollMode ?? 'normal')) {
      reasons.push(`unsupported plugin Headless check roll mode: ${check.rollMode}`)
    }
  }
  for (const consumption of activity.consumption ?? []) {
    if (
      consumption.kind !== 'action-economy' && consumption.kind !== 'resource' &&
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

function actorSnapshot(combatant: Dnd5eCombatant): Dnd5eActivityActorSnapshot {
  return {
    id: combatant.id,
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
    spellSaveDc: combatant.saveDc,
    conditions: combatant.conditions.filter((condition): condition is Dnd5eStandardConditionId =>
      STANDARD_CONDITIONS.has(condition)),
    savingThrowModifiers: { ...combatant.savingThrowBonuses },
    savingThrowProficiencies: [...combatant.savingThrowProficiencies],
    activeEffectDefinitionIds: (combatant.classState.activeEffects ?? []).map((effect) => ({
      definitionId: effect.definitionId,
      sourceActorId: effect.source.actorId,
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
    elementalAdeptDamageTypes: combatant.elementalAdeptDamageTypes
      ? [...combatant.elementalAdeptDamageTypes]
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

function failureReason(reason: string): Parameters<Dnd5ePluginHeadlessActionContext['fail']>[0] {
  if (reason === 'invalid-rolls') return 'invalid-dice'
  if (reason === 'invalid-target') return 'invalid-target'
  if (reason === 'requirement-failed') return 'invalid-class-feature'
  return 'invalid-plugin-action'
}

export function compileDnd5eActivityHeadlessAction(
  activity: Dnd5eActivityDefinitionV1,
  options: { outerSpellTransaction?: boolean } = {},
): Dnd5ePluginHeadlessActionDefinition {
  const compatibility = dnd5eActivityHeadlessCompatibility(activity, options)
  if (!compatibility.supported) throw new Error(compatibility.reasons.join('; '))
  const rolls = collectDnd5eActivityFormulaRollDeclarationsV1(activity)
  const targetChecks = (activity.checks ?? []).filter((check) =>
    check.kind === 'saving-throw' || check.kind === 'attack-roll')
  return {
    id: activity.id,
    execution: 'trusted',
    rolls: rolls.map((roll) => ({
      id: roll.id,
      label: `${activity.name} · ${roll.id}`,
      count: roll.count,
      sides: roll.sides,
      modifier: 0,
      visibility: 'public',
    })),
    perTargetRolls: targetChecks.map((check) => ({
      id: check.rollId,
      label: check.kind === 'saving-throw'
        ? `${activity.name} · ${(check.abilityOptions ?? [check.ability]).map((ability) => ability.toUpperCase()).join('/')} 豁免`
        : `${activity.name} · 攻击检定`,
      count: check.rollMode === 'advantage' || check.rollMode === 'disadvantage' ||
        check.rollMode === 'host-derived' || (
          check.kind === 'saving-throw' &&
          (check.rollModeByCreatureType != null || check.rollModeBySizeRank != null)
        ) ? 2 : 1,
      sides: 20,
      modifier: 0,
      visibility: 'public',
    })),
    resolve(context) {
      const targets = context.targets.length > 0
        ? context.targets
        : context.target
          ? [context.target]
          : [context.actor]
      const result = resolveDnd5eActivity({
        activity,
        actor: actorSnapshot(context.actor),
        targets: targets.map(actorSnapshot),
        rolls: Object.fromEntries(Object.entries(context.rolls).map(([id, roll]) => [id, { values: roll.values }])),
        checkRollModes: Object.fromEntries(targetChecks.flatMap((check) =>
          check.rollMode === 'host-derived'
            ? targets.map((target) => [`${check.id}:${target.id}`, check.kind === 'saving-throw'
                ? dnd5eSavingThrowMode(
                    target,
                    selectedSavingThrowAbility(target, check.ability, check.abilityOptions),
                  )
                : context.attackRollMode(target.id, check.delivery)] as const)
            : [])),
        distanceFeetByTargetId: Object.fromEntries(targets.flatMap((target) => {
          const distance = pairDistance(context, target.id)
          return distance == null ? [] : [[target.id, distance]]
        })),
        parentDamageType: context.parentAttackDamageType,
        areaPlacement: context.action.activityAreaPlacement,
        areaPlacementDistanceFeet: context.action.activityAreaPlacementDistanceFeet,
        castLevel: context.action.castLevel,
        choices: (() => {
          const payload = context.action.payload && typeof context.action.payload === 'object' && !Array.isArray(context.action.payload)
            ? context.action.payload as Record<string, unknown>
            : undefined
          const submitted = payload?.activityChoices && typeof payload.activityChoices === 'object' && !Array.isArray(payload.activityChoices)
            ? Object.fromEntries(Object.entries(payload.activityChoices).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
            : {}
          return {
            ...Object.fromEntries((activity.choices ?? []).flatMap((choice) => {
              const fallback = choice.defaultOptionId ?? choice.options[0]?.id
              return fallback ? [[choice.id, fallback]] : []
            })),
            ...submitted,
          }
        })(),
        dmApproved: context.action.interruptChoiceId === 'dm-apply',
      })
      if (!result.ok) return context.fail(failureReason(result.reason))
      if (
        result.status === 'dm-adjudication-required' &&
        context.action.interruptChoiceId !== 'dm-apply'
      ) return context.fail('dm-adjudication-pending')
      const resolvedActivity = scaleDnd5eActivityDefinitionV1(activity, {
        actor: {
          level: context.actor.level,
          proficiencyBonus: context.actor.proficiencyBonus,
          classLevels: context.actor.classLevels,
        },
        castLevel: context.action.castLevel,
      }).activity
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
        return context.fail('invalid-plugin-action')
      }
      for (const proposal of result.proposals) {
        if (proposal.kind === 'deal-damage') {
          context.dealDamage(proposal.targetId, proposal.amount, proposal.damageType)
        } else if (proposal.kind === 'heal') {
          context.heal(proposal.targetId, proposal.amount)
        } else if (proposal.kind === 'grant-temporary-hit-points') {
          context.grantTemporaryHitPoints(proposal.targetId, proposal.amount)
        } else if (proposal.kind === 'stabilize') {
          if (!context.stabilize(proposal.targetId)) return context.fail('invalid-target')
        } else if (proposal.kind === 'stand-up') {
          if (!context.standUpUsingReactionIfAvailable(proposal.targetId)) return context.fail('invalid-target')
        } else if (proposal.kind === 'remove-standard-condition') {
          if (!context.removeStandardCondition(proposal.targetId, proposal.condition)) {
            return context.fail('invalid-target')
          }
        } else if (proposal.kind === 'apply-standard-condition') {
          const duration = pluginDuration(proposal.duration)
          if (!duration) return context.fail('invalid-plugin-action')
          context.applyStandardCondition(proposal.targetId, proposal.condition, duration)
        } else if (proposal.kind === 'apply-effect') {
          const effect = resolvedActivity.effects?.find((candidate) => candidate.id === proposal.effectId)
          if (!effect || !context.applyEffectDefinition(proposal.targetId, effect, context.action.castLevel)) {
            return context.fail('invalid-plugin-action')
          }
        } else if (proposal.kind === 'remove-effect') {
          if (!context.removeEffectDefinition(proposal.targetId, proposal.effectId, proposal.source)) {
            return context.fail('invalid-plugin-action')
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
        } else if (proposal.kind === 'request-dm-adjudication') {
          // The shared DM interrupt approved this exact transaction before
          // the trusted resolver was replayed.
          continue
        } else if (proposal.kind === 'create-persistent-area' || proposal.kind === 'summon') {
          // Map-owned effects are returned below and committed only after the
          // Host has collected and validated every placement.
          continue
        } else return context.fail('invalid-plugin-action')
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
          movements: resolvedMovements,
          invocations: [],
        },
      }
    },
  }
}
