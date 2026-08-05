import type { RulesetAdapter } from '../../contracts'
import type { Character } from '../../../types/character'
import { dnd5eCharacterClassLevel } from '../classLevels'
import type { Dnd5eClassId } from '../classes'
import type { Dnd5eDamageType } from '../damageTypes'
import type {
  DeclarativeDiceFormulaV1,
  DeclarativeEffectTargetV1,
  DeclarativeSubclassAbilityV1,
  DeclarativeSubclassDurationV1,
  DeclarativeSubclassResourceCostV1,
  DeclarativeSubclassResourceRequirementV1,
  DeclarativeValueFormulaV1,
} from '../declarativeSubclassAbility'
import type { Dnd5eCombatant } from '../headlessCombatEngine'
import { dnd5eUtilityProjectionDistanceKey } from '../utilityProjectionState'
import type {
  Dnd5ePluginAutomationLevel,
  Dnd5ePluginEffectDuration,
  Dnd5ePluginTargeting,
} from '../pluginApi'
import type {
  Dnd5ePluginHeadlessActionContext,
  Dnd5ePluginHeadlessActionDefinition,
} from './pluginHeadlessContracts'
import { namespacedDnd5ePluginId } from './pluginIdentifiers'

export function dnd5eDeclarativeResourceKey(
  pluginId: string,
  reference: Pick<DeclarativeSubclassResourceCostV1, 'resourceId' | 'scope'> |
    Pick<DeclarativeSubclassResourceRequirementV1, 'resourceId' | 'scope'>,
): string {
  return reference.scope === 'core'
    ? reference.resourceId
    : namespacedDnd5ePluginId(pluginId, reference.resourceId)
}

function declarativeFormulaValue(
  formula: DeclarativeValueFormulaV1,
  creature: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'abilities' | 'proficiencyBonus'>,
  adapter: RulesetAdapter,
): number {
  let value: number
  if (formula.kind === 'fixed') return formula.value
  else if (formula.kind === 'proficiency-bonus') value = creature.proficiencyBonus
  else if (formula.kind === 'ability-modifier') value = adapter.abilityModifier(creature.abilities[formula.ability])
  else {
    const classLevel = creature.classLevels?.[formula.classId] ??
      (creature.classId === formula.classId ? creature.level : 0)
    value = Math.floor(classLevel / (formula.divisor ?? 1))
  }
  return Math.max(
    formula.minimum ?? Number.NEGATIVE_INFINITY,
    Math.floor(value * (formula.multiplier ?? 1)),
  )
}

export function declarativeResourceMaximumByLevel(
  formula: DeclarativeValueFormulaV1,
  classId: Dnd5eClassId,
  exactSteps?: readonly { level: number; maximum: number }[],
): number[] {
  const values = Array.from({ length: 20 }, (_, index) => {
    const level = index + 1
    if (formula.kind === 'fixed') return Math.max(0, formula.value)
    if (formula.kind === 'proficiency-bonus') {
      const base = 2 + Math.floor((level - 1) / 4)
      return Math.max(0, formula.minimum ?? 0, Math.floor(base * (formula.multiplier ?? 1)))
    }
    if (formula.kind === 'class-level') {
      if (formula.classId !== classId) return Math.max(0, formula.minimum ?? 0)
      return Math.max(
        formula.minimum ?? 0,
        Math.floor((level / (formula.divisor ?? 1)) * (formula.multiplier ?? 1)),
      )
    }
    return Math.max(0, formula.minimum ?? 0)
  })
  for (const step of exactSteps ?? []) {
    for (let index = step.level - 1; index < values.length; index += 1) values[index] = step.maximum
  }
  return values
}

export function declarativeResourceMaximumForCharacter(
  formula: DeclarativeValueFormulaV1,
  character: Character,
): number {
  let value: number
  if (formula.kind === 'fixed') return Math.max(0, formula.value)
  if (formula.kind === 'proficiency-bonus') value = 2 + Math.floor((Math.max(1, character.level) - 1) / 4)
  else if (formula.kind === 'ability-modifier') value = Math.floor((character.abilities[formula.ability] - 10) / 2)
  else value = Math.floor(dnd5eCharacterClassLevel(character, formula.classId) / (formula.divisor ?? 1))
  return Math.max(
    0,
    formula.minimum ?? Number.NEGATIVE_INFINITY,
    Math.floor(value * (formula.multiplier ?? 1)),
  )
}

function declarativeDurationToCapability(
  duration: DeclarativeSubclassDurationV1,
): Dnd5ePluginEffectDuration | undefined {
  if (duration.kind === 'until-source-turn-start') return { expiresAt: 'source-next-turn-start' }
  if (duration.kind === 'until-target-turn-start') return { expiresAt: 'target-next-turn-start' }
  if (duration.kind === 'until-target-turn-end') {
    return { expiresAt: 'target-turn-end', remainingRounds: duration.rounds ?? 1 }
  }
  if (duration.kind === 'fixed-rounds') {
    return duration.repeatSave
      ? {
          expiresAt: 'target-turn-end-save',
          remainingRounds: duration.rounds,
          saveAbility: duration.repeatSave.ability,
          saveDc: duration.repeatSave.dc,
        }
      : { expiresAt: 'target-turn-end', remainingRounds: duration.rounds }
  }
  return undefined
}

export function declarativeTargeting(
  targeting: DeclarativeSubclassAbilityV1['targeting'],
): Dnd5ePluginTargeting {
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.kind === 'single-creature' || targeting.kind === 'multiple-creatures') {
    return {
      kind: 'single-creature',
      relation: targeting.relation,
      rangeFeet: targeting.rangeFeet,
      includeSelf: targeting.includeSelf,
    }
  }
  const common = {
    kind: 'area' as const,
    relation: targeting.relation,
    includeSelf: targeting.includeSelf,
    maximumTargets: targeting.maximumTargets ?? 64,
  }
  if (targeting.shape === 'circle') {
    return {
      ...common,
      template: {
        shape: 'circle',
        origin: 'point',
        radiusFeet: targeting.radiusFeet ?? 5,
        placeRangeFeet: targeting.rangeFeet,
      },
    }
  }
  if (targeting.shape === 'cone') {
    return {
      ...common,
      template: {
        shape: 'cone',
        origin: 'self',
        lengthFeet: targeting.lengthFeet ?? 15,
        aimRangeFeet: targeting.rangeFeet,
      },
    }
  }
  if (targeting.shape === 'line') {
    return {
      ...common,
      template: {
        shape: 'line',
        origin: 'self',
        widthFeet: targeting.widthFeet ?? 5,
        lengthFeet: targeting.lengthFeet ?? 30,
        aimRangeFeet: targeting.rangeFeet,
      },
    }
  }
  return {
    ...common,
    template: {
      shape: 'rect',
      origin: 'point',
      widthFeet: targeting.widthFeet ?? 10,
      heightFeet: targeting.heightFeet ?? 10,
      placeRangeFeet: targeting.rangeFeet,
      rotatable: true,
    },
  }
}

function declarativeEffectTargets(
  target: DeclarativeEffectTargetV1,
  context: Dnd5ePluginHeadlessActionContext,
): readonly Dnd5eCombatant[] {
  if (target === 'actor') return [context.actor]
  if (target === 'target') return context.target ? [context.target] : []
  return context.targets
}

export function declarativeDiceCount(dice: DeclarativeDiceFormulaV1): number {
  return dice.count
}

export function createDeclarativeFeatureResolver(input: {
  pluginId: string
  subclassId: string
  classId: Dnd5eClassId
  ability: DeclarativeSubclassAbilityV1
  featureId: string
  usesResourceId?: string
  automation: Dnd5ePluginAutomationLevel
}): Dnd5ePluginHeadlessActionDefinition['resolve'] {
  return (context) => {
    const { actor, action, state } = context
    const { ability } = input
    if (input.automation === 'partial' && action.interruptChoiceId !== 'dm-apply') {
      return context.fail('invalid-plugin-action')
    }
    if (!action.transactionId || actor.classState.declarativeTransactionIds?.includes(action.transactionId)) {
      return context.fail('invalid-plugin-action')
    }
    const classLevel = actor.classLevels?.[input.classId] ??
      (actor.classId === input.classId ? actor.level : 0)
    const selectedSubclass = actor.subclassIds?.[input.classId] ??
      (actor.classId === input.classId ? actor.subclassId : undefined)
    if (
      classLevel < ability.level ||
      selectedSubclass !== input.subclassId ||
      !actor.pluginFeatureIds.includes(input.featureId)
    ) return context.fail('invalid-class-feature')
    const predicates = ability.predicates
    if (predicates?.minimumLevel != null && actor.level < predicates.minimumLevel) {
      return context.fail('invalid-class-feature')
    }
    if (
      predicates?.classId &&
      (actor.classLevels?.[predicates.classId] ??
        (actor.classId === predicates.classId ? actor.level : 0)) < 1
    ) return context.fail('invalid-class-feature')
    if (
      predicates?.subclassId &&
      selectedSubclass !== `${input.pluginId}:${predicates.subclassId}` &&
      selectedSubclass !== predicates.subclassId
    ) return context.fail('invalid-class-feature')
    const primaryTarget = context.target
    const pairKey = primaryTarget
      ? (actor.id < primaryTarget.id
          ? `${actor.id}\u0000${primaryTarget.id}`
          : `${primaryTarget.id}\u0000${actor.id}`)
      : undefined
    const authoritativeDistance = primaryTarget?.id === actor.id
      ? 0
      : pairKey == null
        ? Number.POSITIVE_INFINITY
        : state.distanceFeetByCombatantPair?.[pairKey] ?? Number.POSITIVE_INFINITY
    if (!Number.isFinite(authoritativeDistance) || authoritativeDistance < 0) {
      return context.fail('invalid-target')
    }
    if (
      (ability.targeting.kind === 'single-creature' || ability.targeting.kind === 'multiple-creatures') &&
      ability.targeting.rangeFeet != null && authoritativeDistance > ability.targeting.rangeFeet
    ) return context.fail('invalid-target')
    if (predicates?.minimumDistanceFeet != null && authoritativeDistance < predicates.minimumDistanceFeet) {
      return context.fail('invalid-target')
    }
    if (predicates?.maximumDistanceFeet != null && authoritativeDistance > predicates.maximumDistanceFeet) {
      return context.fail('invalid-target')
    }
    if (predicates?.actorHasConditions?.some((condition) => !actor.conditions.includes(condition))) {
      return context.fail('invalid-class-feature')
    }
    if (predicates?.actorLacksConditions?.some((condition) => actor.conditions.includes(condition))) {
      return context.fail('invalid-class-feature')
    }
    if (context.targets.some((target) => predicates?.targetHasConditions?.some(
      (condition) => !target.conditions.includes(condition),
    ))) return context.fail('invalid-target')
    if (context.targets.some((target) => predicates?.targetLacksConditions?.some(
      (condition) => target.conditions.includes(condition),
    ))) return context.fail('invalid-target')
    if (predicates?.targetRelation) {
      for (const target of context.targets) {
        const allied = target.controller === actor.controller
        if (predicates.targetRelation === 'self' && target.id !== actor.id) return context.fail('invalid-target')
        if (predicates.targetRelation === 'ally' && !allied) return context.fail('invalid-target')
        if (predicates.targetRelation === 'enemy' && allied) return context.fail('invalid-target')
      }
    }
    for (const requirement of predicates?.resources ?? []) {
      const resourceId = dnd5eDeclarativeResourceKey(input.pluginId, requirement)
      if ((actor.classResources[resourceId]?.current ?? -1) < requirement.minimum) {
        return context.fail('class-resource-unavailable')
      }
    }
    for (const requirement of predicates?.subclassChoices ?? []) {
      const selectionKey = `${input.subclassId}/${requirement.groupId}`
      if (!actor.classSelections[selectionKey]?.includes(requirement.optionId)) {
        return context.fail('invalid-class-feature')
      }
    }
    const turnKey = `${state.combatId}:${state.round}:${state.turnSlotId ?? actor.id}`
    const oncePerTurn = predicates?.oncePerTurn === true || ability.limits?.oncePerTurn === true
    if (
      oncePerTurn &&
      actor.classState.declarativeUsedTurnKeys?.[input.featureId] === turnKey
    ) return context.fail('feature-already-used')
    if (ability.mechanic?.kind === 'utility-projection-attack-advantage') {
      if (!primaryTarget) return context.fail('invalid-target')
      const projectionDistance = state.utilityProjectionDistanceFeetByPair?.[
        dnd5eUtilityProjectionDistanceKey(actor.id, ability.mechanic.projectionId, primaryTarget.id)
      ]
      if (
        projectionDistance == null ||
        !Number.isFinite(projectionDistance) ||
        projectionDistance > ability.mechanic.maximumDistanceFeet
      ) return context.fail('invalid-target')
    }
    if (ability.mechanic?.kind === 'next-d20-advantage' && actor.classState.nextD20Advantage != null) {
      return context.fail('invalid-plugin-action')
    }
    const costs = [
      ...(ability.cost?.resources ?? []).map((cost) => ({
        resourceId: dnd5eDeclarativeResourceKey(input.pluginId, cost),
        amount: cost.amount,
      })),
      ...(input.usesResourceId && (ability.cost?.uses ?? 1) > 0
        ? [{ resourceId: input.usesResourceId, amount: ability.cost?.uses ?? 1 }]
        : []),
    ]
    if (costs.some((cost) =>
      !actor.classResources[cost.resourceId] ||
      actor.classResources[cost.resourceId].current < cost.amount
    )) return context.fail('class-resource-unavailable')
    const operationCount = costs.length + ability.effects.reduce((total, effect) => {
      if (effect.kind === 'move') return total
      if (effect.kind === 'spend-resource' || effect.kind === 'restore-resource') return total + 1
      return total + ('target' in effect ? declarativeEffectTargets(effect.target, context).length : 0)
    }, 0)
    if (operationCount > 64) return context.fail('invalid-plugin-action')
    for (const effect of ability.effects) {
      if (effect.kind === 'move') continue
      if (
        (effect.kind === 'damage' || effect.kind === 'healing' || effect.kind === 'temporary-hit-points') &&
        effect.rollId && !context.rolls[effect.rollId]
      ) {
        const roll = ability.rolls?.find((candidate) => candidate.id === effect.rollId)
        if (
          !roll ||
          (roll.kind !== 'damage' && roll.kind !== 'healing') ||
          roll.dice.count > 0
        ) return context.fail('invalid-dice')
      }
      if (effect.kind === 'damage') {
        const declaration = ability.rolls?.find((candidate) => candidate.id === effect.rollId)
        if (
          declaration?.kind === 'damage' &&
          declaration.damageType === 'parent-weapon' &&
          !context.parentAttackDamageType
        ) return context.fail('invalid-plugin-action')
      }
      if (effect.kind === 'standard-condition' && !declarativeDurationToCapability(effect.duration)) continue
      if (
        (effect.kind === 'spend-resource' || effect.kind === 'restore-resource') &&
        declarativeFormulaValue(effect.amount, actor, context.rules) <= 0
      ) return context.fail('invalid-plugin-action')
    }
    for (const cost of costs) {
      if (!context.spendResource(cost.resourceId, cost.amount)) {
        return context.fail('class-resource-unavailable')
      }
    }

    for (const effect of ability.effects) {
      if (effect.kind === 'move') continue
      if (effect.kind === 'spend-resource' || effect.kind === 'restore-resource') {
        const amount = declarativeFormulaValue(effect.amount, actor, context.rules)
        const resourceId = namespacedDnd5ePluginId(input.pluginId, effect.resourceId)
        if (
          effect.kind === 'restore-resource' &&
          effect.whenEmpty === true &&
          actor.classResources[resourceId]?.current !== 0
        ) continue
        const ok = effect.kind === 'spend-resource'
          ? context.spendResource(resourceId, amount)
          : context.restoreResource(resourceId, amount)
        if (!ok) return context.fail('class-resource-unavailable')
        continue
      }
      if (!('target' in effect)) return context.fail('invalid-plugin-action')
      for (const target of declarativeEffectTargets(effect.target, context)) {
        if (effect.kind === 'damage' || effect.kind === 'healing') {
          const declaration = ability.rolls?.find((candidate) => candidate.id === effect.rollId)
          if (!declaration || (declaration.kind !== 'damage' && declaration.kind !== 'healing')) {
            return context.fail('invalid-dice')
          }
          const supplied = context.rolls[effect.rollId]
          const rolled = (supplied?.values.reduce((total, value) => total + value, 0) ?? 0) +
            declarativeFormulaValue(
              declaration.dice.modifier ?? { kind: 'fixed', value: 0 },
              actor,
              context.rules,
            )
          if (effect.kind === 'damage') {
            const multiplier = state.effectiveRules?.houseRules.declarativeAbilityDamageMultiplier ?? 1
            let damageType: Dnd5eDamageType | undefined
            if (declaration.kind === 'damage') {
              damageType = declaration.damageType === 'parent-weapon'
                ? context.parentAttackDamageType
                : declaration.damageType
            } else damageType = 'force'
            if (!damageType) return context.fail('invalid-plugin-action')
            context.dealDamage(target.id, Math.max(0, Math.floor(rolled * multiplier)), damageType)
          } else context.heal(target.id, Math.max(0, rolled))
        } else if (effect.kind === 'temporary-hit-points') {
          const roll = effect.rollId
            ? ability.rolls?.find((candidate) => candidate.id === effect.rollId)
            : undefined
          const amount = effect.rollId
            ? (context.rolls[effect.rollId]?.values.reduce((total, value) => total + value, 0) ?? 0) +
              (roll && (roll.kind === 'damage' || roll.kind === 'healing')
                ? declarativeFormulaValue(
                    roll.dice.modifier ?? { kind: 'fixed', value: 0 },
                    actor,
                    context.rules,
                  )
                : 0)
            : declarativeFormulaValue(effect.amount!, actor, context.rules)
          context.grantTemporaryHitPoints(target.id, Math.max(0, amount))
        } else if (effect.kind === 'standard-condition') {
          const duration = declarativeDurationToCapability(effect.duration)
          if (duration) context.applyStandardCondition(target.id, effect.condition, duration)
        }
      }
    }
    if (ability.mechanic?.kind === 'utility-projection-attack-advantage' && primaryTarget) {
      actor.classState.utilityProjectionAttackAdvantage = {
        featureId: input.featureId,
        targetId: primaryTarget.id,
        turnKey,
      }
      context.events.push({
        type: 'class-state-changed',
        actorId: actor.id,
        targetId: primaryTarget.id,
        stateKey: 'utility-projection-attack-advantage',
        active: true,
      })
    }
    if (ability.mechanic?.kind === 'next-d20-advantage') {
      actor.classState.nextD20Advantage = {
        featureId: input.featureId,
        rollKinds: [...ability.mechanic.rollKinds],
      }
      context.events.push({
        type: 'class-state-changed',
        actorId: actor.id,
        stateKey: 'next-d20-advantage',
        active: true,
      })
    }
    if (oncePerTurn) {
      actor.classState.declarativeUsedTurnKeys = {
        ...actor.classState.declarativeUsedTurnKeys,
        [input.featureId]: turnKey,
      }
    }
    actor.classState.declarativeTransactionIds = [
      ...(actor.classState.declarativeTransactionIds ?? []),
      action.transactionId,
    ].slice(-128)
    context.events.push({
      type: 'declarative-subclass-ability-resolved',
      actorId: actor.id,
      abilityId: input.featureId,
      trigger: ability.trigger.kind,
      targetIds: context.targets.map((target) => target.id),
    })
    return context.succeed()
  }
}
