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
import type { Dnd5eActivityDefinitionV1 } from '../activities/dnd5eActivityContracts'
import { dnd5eUtilityProjectionDistanceKey } from '../utilityProjectionState'
import { dnd5eSavingThrowMode } from '../passiveDefenses'
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

function declarativeSavingThrowDcValue(
  formula: DeclarativeValueFormulaV1,
  creature: Pick<Dnd5eCombatant, 'level' | 'classId' | 'classLevels' | 'abilities' | 'proficiencyBonus'>,
  adapter: RulesetAdapter,
): number {
  if (formula.kind === 'ability-modifier') {
    return 8 + creature.proficiencyBonus + declarativeFormulaValue(formula, creature, adapter)
  }
  return declarativeFormulaValue(formula, creature, adapter)
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
  actor?: Dnd5eCombatant,
  adapter?: RulesetAdapter,
  target?: Dnd5eCombatant,
): Dnd5ePluginEffectDuration | undefined {
  if (duration.kind === 'until-source-turn-start') return { expiresAt: 'source-next-turn-start' }
  if (duration.kind === 'until-target-turn-start') return { expiresAt: 'target-next-turn-start' }
  if (duration.kind === 'until-target-turn-end') {
    return { expiresAt: 'target-turn-end', remainingRounds: duration.rounds ?? 1 }
  }
  if (duration.kind === 'fixed-rounds') {
    const saveDc = duration.repeatSave == null
      ? undefined
      : typeof duration.repeatSave.dc === 'number'
        ? duration.repeatSave.dc
        : actor && adapter
          ? declarativeSavingThrowDcValue(duration.repeatSave.dc, actor, adapter)
          : undefined
    return duration.repeatSave
      ? {
          expiresAt: 'target-turn-end-save',
          remainingRounds: duration.rounds,
          saveAbility: target
            ? selectedSavingThrowAbility(target, duration.repeatSave.ability, duration.repeatSave.abilityOptions, adapter)
            : duration.repeatSave.ability,
          saveDc,
        }
      : { expiresAt: 'target-turn-end', remainingRounds: duration.rounds }
  }
  return undefined
}

function selectedSavingThrowAbility(
  target: Dnd5eCombatant,
  primary: import('../../../lib/dnd').AbilityKey,
  options: readonly import('../../../lib/dnd').AbilityKey[] | undefined,
  adapter?: RulesetAdapter,
): import('../../../lib/dnd').AbilityKey {
  const modifier = (ability: import('../../../lib/dnd').AbilityKey) => target.savingThrowBonuses[ability] ??
    (adapter?.abilityModifier(target.abilities[ability]) ?? Math.floor((target.abilities[ability] - 10) / 2))
  return (options?.length ? options : [primary]).reduce((best, candidate) =>
    modifier(candidate) > modifier(best) ? candidate : best, primary)
}

export function declarativeTargeting(
  targeting: DeclarativeSubclassAbilityV1['targeting'],
): Dnd5ePluginTargeting {
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.kind === 'single-creature') return {
    kind: 'single-creature',
    relation: targeting.relation,
    rangeFeet: targeting.rangeFeet,
    includeSelf: targeting.includeSelf,
  }
  if (targeting.kind === 'multiple-creatures') return {
    kind: 'multiple-creatures',
    relation: targeting.relation,
    rangeFeet: targeting.rangeFeet,
    includeSelf: targeting.includeSelf,
    maximumTargets: targeting.maximumTargets,
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
  activity?: Dnd5eActivityDefinitionV1
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
    if (
      predicates?.parentDamageTypes?.length &&
      (!context.parentAttackDamageType || !predicates.parentDamageTypes.includes(context.parentAttackDamageType))
    ) return context.fail('invalid-class-feature')
    if (
      predicates?.targetMaximumSizeRank != null &&
      context.targets.some((target) => target.sizeRank > predicates.targetMaximumSizeRank!)
    ) return context.fail('invalid-target')
    if (predicates?.targetCreatureTypes?.length) {
      const accepted = new Set(predicates.targetCreatureTypes.map((type) => type.trim().toLocaleLowerCase()))
      if (context.targets.some((target) => !target.creatureType || !accepted.has(target.creatureType.trim().toLocaleLowerCase()))) {
        return context.fail('invalid-target')
      }
    }
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
    const payload = context.action.payload && typeof context.action.payload === 'object' && !Array.isArray(context.action.payload)
      ? context.action.payload as Record<string, unknown>
      : undefined
    const submittedChoices = payload?.activityChoices && typeof payload.activityChoices === 'object' && !Array.isArray(payload.activityChoices)
      ? payload.activityChoices as Record<string, unknown>
      : undefined
    const activityChoices: Record<string, string> = {}
    const knownChoiceIds = new Set((ability.choices ?? []).map((choice) => choice.id))
    if (Object.keys(submittedChoices ?? {}).some((choiceId) => !knownChoiceIds.has(choiceId))) {
      return context.fail('invalid-plugin-action')
    }
    for (const choice of ability.choices ?? []) {
      const submitted = submittedChoices?.[choice.id]
      const selected = typeof submitted === 'string' ? submitted : choice.defaultOptionId
      if (!selected || !choice.options.some((option) => option.id === selected)) {
        return context.fail('invalid-plugin-action')
      }
      activityChoices[choice.id] = selected
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
    let persistentCompanionMonsterId: string | undefined
    let persistentCompanionProfile: Extract<
      import('../activities/dnd5eActivityExecutor').Dnd5eActivityCapabilityProposal,
      { kind: 'summon' }
    > | undefined
    if (ability.mechanic?.kind === 'persistent-companion') {
      const selectionKey = `${input.subclassId}/${ability.mechanic.choiceGroupId}`
      const selectedOptionId = actor.classSelections[selectionKey]?.[0]
      persistentCompanionMonsterId = ability.mechanic.companions.find(
        (companion) => companion.optionId === selectedOptionId,
      )?.monsterId
      if (!persistentCompanionMonsterId) return context.fail('invalid-class-feature')
      const profile = ability.mechanic.combatProfile
      const evaluate = (formula: DeclarativeValueFormulaV1 | undefined) => formula == null
        ? undefined
        : Math.max(0, Math.floor(declarativeFormulaValue(formula, actor, context.rules)))
      const advancement = [...(profile?.advancements ?? [])]
        .filter((entry) => (actor.classLevels?.[entry.classId] ??
          (actor.classId === entry.classId ? actor.level : 0)) >= entry.minimumLevel)
        .sort((left, right) => left.minimumLevel - right.minimumLevel)
        .reduce<{
          weaponAttacksMagical?: boolean
          attacksPerAction?: number
          shareSelfSpellsRangeFeet?: number
        }>((resolved, entry) => ({
          ...resolved,
          ...(entry.weaponAttacksMagical == null ? {} : { weaponAttacksMagical: entry.weaponAttacksMagical }),
          ...(entry.attacksPerAction == null ? {} : { attacksPerAction: entry.attacksPerAction }),
          ...(entry.shareSelfSpellsRangeFeet == null ? {} : { shareSelfSpellsRangeFeet: entry.shareSelfSpellsRangeFeet }),
        }), {})
      persistentCompanionProfile = {
        kind: 'summon', operationId: 'persistent-companion',
        monsterId: persistentCompanionMonsterId, count: 1, timing: 'immediate',
        durationRounds: 14_400, concentration: false, side: 'ally', persistent: true,
        minimumMaximumHitPoints: evaluate(profile?.minimumMaximumHitPoints),
        armorClassBonus: evaluate(profile?.armorClassBonus),
        weaponAttackBonus: evaluate(profile?.weaponAttackBonus),
        weaponDamageBonus: evaluate(profile?.weaponDamageBonus),
        savingThrowBonus: evaluate(profile?.savingThrowBonus),
        proficientSkillCheckBonus: evaluate(profile?.proficientSkillCheckBonus),
        weaponAttacksMagical: advancement.weaponAttacksMagical ??
          (profile?.weaponAttacksMagical === true ? true : undefined),
        attacksPerAction: advancement.attacksPerAction ?? profile?.attacksPerAction,
        shareSelfSpellsRangeFeet: advancement.shareSelfSpellsRangeFeet,
      }
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
    const savingThrow = ability.rolls?.find((roll) => roll.kind === 'saving-throw')
    const successfulSaveTargetIds = new Set<string>()
    if (savingThrow) {
      const dc = declarativeSavingThrowDcValue(savingThrow.dc, actor, context.rules)
      if (!Number.isInteger(dc) || dc < 1 || dc > 40) return context.fail('invalid-plugin-action')
      for (const target of context.targets) {
        const saveAbility = selectedSavingThrowAbility(target, savingThrow.ability, savingThrow.abilityOptions, context.rules)
        const supplied = context.rolls[`${savingThrow.id}-d20:${target.id}`]
        const conditionalMode = target.creatureType && savingThrow.rollModeByCreatureType?.creatureTypes.some((type) =>
          type.trim().toLocaleLowerCase() === target.creatureType!.trim().toLocaleLowerCase())
          ? savingThrow.rollModeByCreatureType.mode
          : undefined
        const declaredMode = conditionalMode ?? savingThrow.rollMode ?? 'normal'
        const mode = declaredMode === 'host-derived'
          ? dnd5eSavingThrowMode(target, saveAbility)
          : declaredMode
        // The action manifest is declared before a concrete target is known.  A
        // host-derived or creature-type-conditional save therefore reserves two
        // d20 values for every target; normal-mode targets consume the first one.
        const declaredDiceCount = savingThrow.rollMode === 'host-derived' || savingThrow.rollModeByCreatureType
          ? 2
          : mode === 'normal' ? 1 : 2
        if (!supplied || supplied.values.length !== declaredDiceCount) return context.fail('invalid-dice')
        const d20 = mode === 'advantage'
          ? Math.max(...supplied.values)
          : mode === 'disadvantage'
            ? Math.min(...supplied.values)
            : supplied.values[0]!
        const modifier = target.savingThrowBonuses[saveAbility] ??
          context.rules.abilityModifier(target.abilities[saveAbility])
        const total = d20 + modifier
        const success = total >= dc
        if (success) successfulSaveTargetIds.add(target.id)
        context.events.push({
          type: 'saving-throw-resolved',
          targetId: target.id,
          ability: saveAbility,
          d20,
          modifier,
          total,
          dc,
          success,
        })
      }
    }
    const operationCount = costs.length + (persistentCompanionMonsterId ? 1 : 0) + ability.effects.reduce((total, effect) => {
      if (effect.kind === 'move') return total + declarativeEffectTargets(effect.target, context).length
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
      if (effect.kind === 'standard-condition' && !declarativeDurationToCapability(effect.duration, actor, context.rules)) continue
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
        if (effect.whenChoice && activityChoices[effect.whenChoice.choiceId] !== effect.whenChoice.optionId) continue
        const amount = declarativeFormulaValue(effect.amount, actor, context.rules)
        const resourceId = effect.scope === 'core'
          ? effect.resourceId
          : namespacedDnd5ePluginId(input.pluginId, effect.resourceId)
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
      if (effect.whenChoice && activityChoices[effect.whenChoice.choiceId] !== effect.whenChoice.optionId) continue
      for (const target of declarativeEffectTargets(effect.target, context)) {
        const saved = successfulSaveTargetIds.has(target.id)
        if (effect.when === 'save-success' && !saved) continue
        if (effect.when === 'save-failure' && saved) continue
        if (
          effect.when == null && saved &&
          !(effect.kind === 'damage' && savingThrow?.onSuccess === 'half')
        ) continue
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
            const savingThrowMultiplier = saved && effect.when == null && savingThrow?.onSuccess === 'half' ? 0.5 : 1
            context.dealDamage(target.id, Math.max(0, Math.floor(rolled * multiplier * savingThrowMultiplier)), damageType)
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
          const duration = declarativeDurationToCapability(effect.duration, actor, context.rules, target)
          if (duration) context.applyStandardCondition(target.id, effect.condition, duration)
        } else if (effect.kind === 'activity-effect') {
          const definition = ability.activityEffects?.find((candidate) => candidate.id === effect.effectId)
          if (!definition || !context.applyEffectDefinition(target.id, definition)) {
            return context.fail('invalid-plugin-action')
          }
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
    if (ability.mechanic?.kind === 'marked-target' && primaryTarget) {
      const roundsRemaining = ability.duration?.kind === 'fixed-rounds'
        ? ability.duration.rounds
        : 0
      if (roundsRemaining < 1) return context.fail('invalid-plugin-action')
      actor.classState.declarativeMarkedTargets = {
        ...actor.classState.declarativeMarkedTargets,
        [input.featureId]: {
          targetId: primaryTarget.id,
          roundsRemaining,
        },
      }
      context.events.push({
        type: 'class-state-changed',
        actorId: actor.id,
        targetId: primaryTarget.id,
        stateKey: `marked-target:${input.featureId}`,
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
    const succeeded = context.succeed()
    if (!succeeded.ok) return succeeded
    const movements = ability.effects.flatMap((effect, index) => effect.kind === 'move' &&
      (!effect.whenChoice || activityChoices[effect.whenChoice.choiceId] === effect.whenChoice.optionId)
      ? declarativeEffectTargets(effect.target, context).map((target) => ({
          kind: 'move' as const,
          operationId: `effect-${index}`,
          targetId: target.id,
          mode: effect.mode ?? 'push',
          distanceFeet: effect.distanceFeet,
          originIllumination: effect.originIllumination,
          destinationIllumination: effect.destinationIllumination,
          requiresLineOfSight: effect.requiresLineOfSight,
          ignoresOpportunityAttacks: effect.ignoresOpportunityAttacks,
        }))
      : [])
    const summons = persistentCompanionProfile ? [persistentCompanionProfile] : []
    return (movements.length > 0 || summons.length > 0) && input.activity
      ? {
          ...succeeded,
          activityDefinition: input.activity,
          activityHandoffs: {
            persistentAreas: [],
            summons,
            movements,
            invocations: [],
          },
        }
      : succeeded
  }
}
