import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eCombatant } from '../headlessCombatEngine'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import type {
  Dnd5ePluginHeadlessActionContext,
  Dnd5ePluginHeadlessActionDefinition,
} from '../plugins/pluginHeadlessContracts'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from './dnd5eActivityContracts'
import {
  resolveDnd5eActivity,
  type Dnd5eActivityActorSnapshot,
  type Dnd5eResolvedEffectDuration,
} from './dnd5eActivityExecutor'
import { collectDnd5eFormulaRollDeclarations, type Dnd5eFormulaV1 } from './dnd5eFormula'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

export interface Dnd5eActivityHeadlessCompatibility {
  supported: boolean
  reasons: readonly string[]
}

const STANDARD_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

function operationFormulas(operation: Dnd5eActivityOperationV1): readonly Dnd5eFormulaV1[] {
  if (operation.kind === 'damage' || operation.kind === 'healing' || operation.kind === 'temporary-hit-points') {
    return [operation.amount]
  }
  if (operation.kind === 'resource') return [operation.amount]
  if (operation.kind === 'move') return [operation.distanceFeet]
  if (operation.kind === 'summon') return [operation.count]
  if (operation.kind === 'invoke-activity') return [operation.repeat]
  if (operation.kind === 'apply-standard-condition' && operation.duration.kind === 'save-ends') {
    return [operation.duration.dc]
  }
  return []
}

function activityFormulas(activity: Dnd5eActivityDefinitionV1): readonly Dnd5eFormulaV1[] {
  return [
    ...(activity.checks ?? []).flatMap((check) => check.kind === 'attack-roll' ? [check.attackBonus] : [check.dc]),
    ...activity.outcomes.flatMap((outcome) => outcome.operations.flatMap(operationFormulas)),
  ]
}

export function dnd5eActivityHeadlessCompatibility(
  activity: Dnd5eActivityDefinitionV1,
): Dnd5eActivityHeadlessCompatibility {
  const reasons = [...validateDnd5eActivityDefinitionV1(activity)]
  if (activity.checks?.length) reasons.push('the plugin Headless adapter delegates attack/save checks to the owning Host transaction')
  if (activity.consumption?.length) reasons.push('the plugin Headless adapter delegates consumption to the owning Host transaction')
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) {
      if (
        operation.kind === 'remove-standard-condition' || operation.kind === 'move' ||
        operation.kind === 'summon' || operation.kind === 'create-persistent-area' ||
        operation.kind === 'invoke-activity' || operation.kind === 'manual-adjudication'
      ) reasons.push(`unsupported plugin Headless operation: ${operation.kind}`)
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
    classLevels: combatant.classLevels ? { ...combatant.classLevels } : undefined,
    currentHp: combatant.currentHp,
    maxHp: combatant.maxHp,
    armorClass: combatant.armorClass,
    conditions: combatant.conditions.filter((condition): condition is Dnd5eStandardConditionId =>
      STANDARD_CONDITIONS.has(condition)),
    savingThrowModifiers: { ...combatant.savingThrowBonuses },
    resources: Object.fromEntries(Object.entries(combatant.classResources).map(([id, resource]) => [id, {
      current: resource.current,
      maximum: resource.max,
    }])),
  }
}

function pairDistance(context: Dnd5ePluginHeadlessActionContext, targetId: string): number | undefined {
  if (targetId === context.actor.id) return 0
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
): Dnd5ePluginHeadlessActionDefinition {
  const compatibility = dnd5eActivityHeadlessCompatibility(activity)
  if (!compatibility.supported) throw new Error(compatibility.reasons.join('; '))
  const criticalDice = activity.outcomes.some((outcome) => outcome.operations.some((operation) =>
    operation.kind === 'damage' && operation.critical === 'double-dice'))
  const rolls = collectDnd5eFormulaRollDeclarations(activityFormulas(activity), criticalDice ? 2 : 1)
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
        distanceFeetByTargetId: Object.fromEntries(targets.flatMap((target) => {
          const distance = pairDistance(context, target.id)
          return distance == null ? [] : [[target.id, distance]]
        })),
        parentDamageType: context.parentAttackDamageType,
        choices: context.action.interruptChoiceId
          ? { interrupt: context.action.interruptChoiceId }
          : undefined,
        dmApproved: context.action.interruptChoiceId === 'dm-apply',
      })
      if (!result.ok) return context.fail(failureReason(result.reason))
      if (result.status !== 'resolved') return context.fail('invalid-plugin-action')
      for (const proposal of result.proposals) {
        if (proposal.kind === 'deal-damage') {
          context.dealDamage(proposal.targetId, proposal.amount, proposal.damageType)
        } else if (proposal.kind === 'heal') {
          context.heal(proposal.targetId, proposal.amount)
        } else if (proposal.kind === 'grant-temporary-hit-points') {
          context.grantTemporaryHitPoints(proposal.targetId, proposal.amount)
        } else if (proposal.kind === 'apply-standard-condition') {
          const duration = pluginDuration(proposal.duration)
          if (!duration) return context.fail('invalid-plugin-action')
          context.applyStandardCondition(proposal.targetId, proposal.condition, duration)
        } else if (proposal.kind === 'spend-resource') {
          if (!context.spendResource(proposal.resourceId, proposal.amount)) return context.fail('class-resource-unavailable')
        } else if (proposal.kind === 'restore-resource') {
          if (!context.restoreResource(proposal.resourceId, proposal.amount)) return context.fail('class-resource-unavailable')
        } else return context.fail('invalid-plugin-action')
      }
      return context.succeed()
    },
  }
}
