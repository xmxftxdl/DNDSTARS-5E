import { resolveDnd5eAttackRollOutcome } from '../attackResolution'
import { materializeDnd5eEquipmentWeaponDamage, type Dnd5eEquipmentWeaponDamageSnapshot } from './dnd5eEquipmentWeaponDamage'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1, Dnd5eActivityOutcomeWhenV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import { collectDnd5eFormulaRollDeclarations, evaluateDnd5eFormulaV1 } from './dnd5eFormula'
import {
  scaleDnd5eActivityDefinitionV1,
  type Dnd5eActivityScalingContextV1,
} from './dnd5eActivityScaling'
import type { Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'

export const DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID = 'bestow-curse-source-bonus-damage'

function hasBestowCurseSpellDamageEffect(
  actor: Dnd5eActivityActorSnapshot,
  target: Dnd5eActivityActorSnapshot,
): boolean {
  return target.activeEffectDefinitionIds?.some((effect) =>
    effect.sourceActorId === actor.id &&
    (
      effect.definitionId === DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID ||
      effect.definitionId.endsWith(`:${DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID}`)
    )) === true
}

export function dnd5eBestowCurseSpellDamageRiderAppliesV1(
  activity: Dnd5eActivityDefinitionV1,
  actor: Dnd5eActivityActorSnapshot,
  target: Dnd5eActivityActorSnapshot,
): boolean {
  return activity.legacySource?.kind === 'spell' &&
    activity.outcomes.some((outcome) => outcome.operations.some((operation) => operation.kind === 'damage')) &&
    hasBestowCurseSpellDamageEffect(actor, target)
}

/**
 * Host-owned dice recipe for Bestow Curse's delayed spell-damage rider. The
 * target id is part of the roll id so one creature's curse can never leak onto
 * another target in a multi-target spell. A critical spell attack supplies two
 * dice, matching the attack's ordinary critical-dice boundary.
 */
export function dnd5eBestowCurseSpellDamageRollDeclarationsV1(
  activity: Dnd5eActivityDefinitionV1,
  actor: Dnd5eActivityActorSnapshot,
  targets: readonly Dnd5eActivityActorSnapshot[],
  criticalTargetIds: ReadonlySet<string> = new Set(),
) {
  const doublesOnCritical = activity.outcomes.some((outcome) => outcome.operations.some(
    (operation) => operation.kind === 'damage' && operation.critical === 'double-dice',
  ))
  return targets.flatMap((target) =>
    dnd5eBestowCurseSpellDamageRiderAppliesV1(activity, actor, target)
      ? [{
          id: `${DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID}:${target.id}`,
          label: `${target.name?.trim() || target.id} · 降咒法术额外伤害`,
          count: doublesOnCritical && criticalTargetIds.has(target.id) ? 2 : 1,
          sides: 8,
          modifier: 0,
          visibility: 'public' as const,
        }]
      : [],
  )
}

function operationFormulas(operation: Dnd5eActivityOperationV1): readonly Dnd5eFormulaV1[] {
  if (operation.kind === 'launch-map-object') return [operation.amount]
  if (operation.kind === 'affect-persistent-entity') return [operation.amount, ...(operation.savingThrow ? [operation.savingThrow.dc] : [])]
  if (operation.kind === 'damage' || operation.kind === 'healing' || operation.kind === 'temporary-hit-points' ||
    operation.kind === 'reduce-hit-point-maximum' || operation.kind === 'transfer-hit-point-maximum') return [operation.amount]
  if (operation.kind === 'revive') return [operation.hitPoints]
  if (operation.kind === 'resource') return [operation.amount]
  if (operation.kind === 'move') return [operation.distanceFeet]
  if (operation.kind === 'shrink-granting-area') return [operation.lengthFeet]
  if (operation.kind === 'relocate-granting-area') return [operation.maximumFeet]
  if (operation.kind === 'summon') return [
    operation.count,
    ...[
      operation.minimumMaximumHitPoints,
      operation.controlSave?.dc,
      operation.maximumChallengeRating,
      operation.armorClassBonus,
      operation.weaponAttackBonus,
      operation.weaponDamageBonus,
      operation.savingThrowBonus,
      operation.proficientSkillCheckBonus,
      operation.attacksPerAction,
    ].filter((formula): formula is Dnd5eFormulaV1 => formula != null),
  ]
  if (operation.kind === 'grant-extra-turns') return [operation.turns]
  if (operation.kind === 'invoke-activity') return [operation.repeat]
  if (operation.kind === 'apply-standard-condition' && operation.duration.kind === 'save-ends') return [operation.duration.dc]
  if (operation.kind === 'dispel-area') return [operation.radiusFeet, operation.maximumSpellLevel]
  return []
}

function activityFormulas(activity: Dnd5eActivityDefinitionV1): readonly Dnd5eFormulaV1[] {
  return [
    ...(activity.checks ?? []).flatMap((check) =>
      check.kind === 'random-roll'
        ? []
        : check.kind === 'opposed-ability-check'
          ? [check.sourceModifier]
        : check.kind === 'attack-roll'
          ? [check.attackBonus]
          : [check.dc]),
    ...activity.outcomes.flatMap((outcome) => outcome.operations.flatMap(operationFormulas)),
    ...(activity.effects ?? []).flatMap((effect) => [
      ...(effect.duration.kind === 'save-ends' ? [effect.duration.dc] : []),
      ...(effect.periodicHealing ? [effect.periodicHealing.amount] : []),
      ...(effect.modifiers ?? []).flatMap((modifier) => {
        if (modifier.kind === 'armor-class' || modifier.kind === 'speed' || modifier.kind === 'weapon-damage-roll' || modifier.kind === 'hit-point-maximum') return [modifier.value]
        if (modifier.kind === 'armor-enchantment') return [modifier.armorClassBonus]
        if (modifier.kind === 'weapon-enchantment') return [modifier.attackAndDamageBonus, ...(modifier.attackUses ? [modifier.attackUses] : [])]
        if (modifier.kind === 'movement-boundary-save') return [modifier.dc]
        if ((modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value) return [modifier.value]
        // Delayed hit riders are rolled by the eventual weapon-hit
        // transaction, never by the Activity that arms the effect.
        if (modifier.kind === 'damage-reduction') return [modifier.amount]
        return []
      }),
    ]),
  ]
}

/** Unexpanded formula IDs distinguish compiled formula declarations from non-formula dice. */
export function dnd5eActivityBaseFormulaRollIdsV1(activity: Dnd5eActivityDefinitionV1): ReadonlySet<string> {
  return new Set(collectDnd5eFormulaRollDeclarations(activityFormulas(activity))
    .filter(roll => !activity.carriedRollIds?.includes(roll.id)).map(roll => roll.id))
}

export function collectScaledDnd5eActivityFormulaRollDeclarationsV1(
  activity: Dnd5eActivityDefinitionV1,
  options: { critical?: boolean; scaling?: Dnd5eActivityScalingContextV1; choices?: Readonly<Record<string, string>>; targetCount?: number;
    equipmentWeaponDamage?: Dnd5eEquipmentWeaponDamageSnapshot;
    projectileTargetIds?: readonly string[]; criticalProjectileIndices?: ReadonlySet<number>;
    independentTargetIds?: readonly string[]; criticalIndependentTargetIds?: ReadonlySet<string>;
    independentTargetOutcomeGate?: (when: Dnd5eActivityOutcomeWhenV1, targetId: string) => boolean | undefined;
    /** Compiler metadata only; execution recipes must expand the ordered occurrences. */
    unexpandedProjectileDeclarations?: true;
    projectileOutcomeGate?: (when: Dnd5eActivityOutcomeWhenV1, index: number, targetId: string) => boolean | undefined;
    targetOutcomeGate?: (when: Dnd5eActivityOutcomeWhenV1) => boolean | undefined } = {},
) {
  const scaledDefinition = options.scaling
    ? scaleDnd5eActivityDefinitionV1(activity, options.scaling).activity
    : activity
  const scaled = options.equipmentWeaponDamage
    ? materializeDnd5eEquipmentWeaponDamage(scaledDefinition, options.equipmentWeaponDamage)
    : scaledDefinition
  const choices = options.choices && { ...Object.fromEntries((scaled.choices ?? []).flatMap(choice =>
    choice.defaultOptionId ? [[choice.id, choice.defaultOptionId]] : [])), ...options.choices }
  // A choice requested after an earlier roll is still unresolved. Only a known
  // contradiction may remove a branch from the recipe before that prompt.
  const selected = choices ? { ...scaled, outcomes: scaled.outcomes.filter(outcome =>
    (outcome.when.kind === 'all' ? outcome.when.conditions : [outcome.when]).every(condition =>
       condition.kind !== 'choice' || choices[condition.choiceId] == null || choices[condition.choiceId] === condition.optionId)) } : scaled
  // No creature can consume target-only damage when an area contains no
  // targets. Keep actor/global damage and unknown target counts unchanged.
  const resolved = { ...selected, outcomes: selected.outcomes.map(outcome => ({
    ...outcome, operations: outcome.operations.filter(operation => operation.kind !== 'damage' ||
      (operation.target !== 'target' && operation.target !== 'all-targets') ||
      (options.targetCount !== 0 && (operation.perProjectile || options.targetOutcomeGate?.(outcome.when) !== false))),
  })) }
  const criticalRollIds = new Set(options.critical === true
    ? collectDnd5eFormulaRollDeclarations(resolved.outcomes.flatMap(outcome => outcome.operations.flatMap(operation =>
      operation.kind === 'damage' && operation.critical === 'double-dice' ? [operation.amount] : []))).map(roll => roll.id)
    : [])
  const shared = { ...resolved, outcomes: resolved.outcomes.map(outcome => ({ ...outcome,
    operations: outcome.operations.filter(operation => operation.kind !== 'damage' || (!operation.perProjectile && !operation.perTarget)),
  })) }
  const projectileRolls = resolved.outcomes.flatMap(outcome => outcome.operations.flatMap(operation => {
    if (operation.kind === 'damage' && operation.perTarget) {
      const rolls = collectDnd5eFormulaRollDeclarations([operation.amount])
      if (options.unexpandedProjectileDeclarations) return rolls
      if (!options.independentTargetIds) throw new Error('activity-independent-targets-missing')
      return [...new Set(options.independentTargetIds)].flatMap(targetId => {
        if (options.independentTargetOutcomeGate?.(outcome.when, targetId) === false) return []
        return rolls.map(roll => ({ ...roll, id: `${roll.id}:${targetId}`,
          count: operation.critical === 'double-dice' && options.criticalIndependentTargetIds?.has(targetId) ? roll.count * 2 : roll.count }))
      })
    }
    if (operation.kind !== 'damage' || !operation.perProjectile) return []
    if (options.unexpandedProjectileDeclarations) return collectDnd5eFormulaRollDeclarations([operation.amount])
      .map(roll => ({ ...roll, count: operation.critical === 'double-dice' && options.critical ? roll.count * 2 : roll.count }))
    if (!options.projectileTargetIds?.length) throw new Error('activity-projectile-order-missing')
    return options.projectileTargetIds.flatMap((targetId, index) => {
      if (options.projectileOutcomeGate?.(outcome.when, index, targetId) === false) return []
      return collectDnd5eFormulaRollDeclarations([operation.amount]).map(roll => ({ ...roll,
        id: `${roll.id}:projectile:${index}:${targetId}`,
        count: operation.critical === 'double-dice' && options.criticalProjectileIndices?.has(index) ? roll.count * 2 : roll.count,
      }))
    })
  }))
  const sharedRolls = collectDnd5eFormulaRollDeclarations(activityFormulas(shared))
    .map(roll => criticalRollIds.has(roll.id) ? { ...roll, count: roll.count * 2 } : roll)
    .filter(roll => !activity.carriedRollIds?.includes(roll.id))
  const declarations = new Map(sharedRolls.map(roll => [roll.id, roll]))
  for (const roll of projectileRolls) {
    const prior = declarations.get(roll.id)
    if (prior && (prior.count !== roll.count || prior.sides !== roll.sides)) throw new Error('activity-projectile-dice-conflict')
    declarations.set(roll.id, roll)
  }
  return [...declarations.values()]
}

/**
 * Derives the critical-damage recipe from the submitted attack d20s using the
 * same roll-mode selection used by the Activity executor.  The browser asks
 * for attack dice first, then uses this Host-reproducible decision to request
 * the exact number of damage dice.
 */
function attackRollOccurrences(
  check: { scope?: string; perProjectile?: true },
  targetIds: readonly string[],
  projectileTargetIds?: readonly string[],
  occurrenceIndex?: number,
) {
  if (check.perProjectile) return (projectileTargetIds ?? []).flatMap((targetId, index) =>
    targetIds.includes(targetId) && (occurrenceIndex == null || index === occurrenceIndex)
      ? [{ targetId, suffix: `:projectile:${index}:${targetId}` }] : [])
  return (check.scope === 'per-target' ? targetIds : targetIds.slice(0, 1)).map(targetId =>
    ({ targetId, suffix: check.scope === 'per-target' ? `:${targetId}` : '' }))
}

export function dnd5eActivitySubmittedAttackRollIsCriticalV1(
  activity: Dnd5eActivityDefinitionV1,
  input: {
    negatedRollIds?: ReadonlySet<string>
    targetIds: readonly string[]
    projectileTargetIds?: readonly string[]
    projectileOccurrenceIndex?: number
    criticalThresholdForTarget?: (targetId: string) => number
    rolls: Readonly<Record<string, { values: readonly number[] }>>
    hostRollMode: (
      targetId: string,
      delivery?: 'melee' | 'ranged',
    ) => 'normal' | 'advantage' | 'disadvantage'
  },
): boolean {
  for (const check of activity.checks ?? []) {
    if (check.kind !== 'attack-roll') continue
    for (const { targetId, suffix } of attackRollOccurrences(check, input.targetIds, input.projectileTargetIds, input.projectileOccurrenceIndex)) {
      const rollId = `${check.rollId}${suffix}`
      const values = input.rolls[rollId]?.values
      if (!values) continue
      const declaredMode = check.rollMode ?? 'normal'
      const originalMode = declaredMode === 'host-derived'
        ? input.hostRollMode(targetId, check.delivery)
        : declaredMode
      const mode = originalMode === 'disadvantage' && input.negatedRollIds?.has(rollId) ? 'normal' : originalMode
      const requiredCount = mode === 'normal' ? 1 : 2
      if (
        (mode === 'normal' ? values.length !== 1 && values.length !== 2 : values.length !== requiredCount) ||
        values.some((value) => !Number.isInteger(value) || value < 1 || value > 20)
      ) continue
      const selected = mode === 'advantage'
        ? Math.max(values[0]!, values[1]!)
        : mode === 'disadvantage'
          ? Math.min(values[0]!, values[1]!)
          : values[0]!
      if (selected >= Math.min(check.criticalThreshold ?? 20, input.criticalThresholdForTarget?.(targetId) ?? 20)) return true
    }
  }
  return false
}

/**
 * Resolves the successful attack-check keys from already submitted Host dice.
 * This is intentionally shared by the browser's sequential dice prompts and
 * the server's exact roll-recipe validation.
 */
export function dnd5eActivitySubmittedAttackCheckSuccessKeysV1(
  activity: Dnd5eActivityDefinitionV1,
  input: {
    negatedRollIds?: ReadonlySet<string>
    actor: Dnd5eActivityActorSnapshot
    effectDicePreview?: Dnd5eRollDicePreviewContext
    targets: readonly Dnd5eActivityActorSnapshot[]
    projectileTargetIds?: readonly string[]
    rolls: Readonly<Record<string, { values: readonly number[] }>>
    choices?: Readonly<Record<string, string>>
    castLevel?: number
    hostRollMode: (
      targetId: string,
      delivery?: 'melee' | 'ranged',
    ) => 'normal' | 'advantage' | 'disadvantage'
  },
): Set<string> {
  return withDnd5eRollDicePreview(() => {
  const successes = new Set<string>()
  for (const check of activity.checks ?? []) {
    if (check.kind !== 'attack-roll') continue
    if (
      check.appliesWhenChoice &&
      !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')
    ) continue
    for (const { targetId, suffix } of attackRollOccurrences(check, input.targets.map(target => target.id), input.projectileTargetIds)) {
      const target = input.targets.find(candidate => candidate.id === targetId)!
      const rollId = `${check.rollId}${suffix}`
      const checkKey = `${check.id}${suffix}`
      const values = input.rolls[rollId]?.values
      if (!values) continue
      const declaredMode = check.rollMode ?? 'normal'
      const originalMode = declaredMode === 'host-derived'
        ? input.hostRollMode(target.id, check.delivery)
        : declaredMode
      const mode = originalMode === 'disadvantage' && input.negatedRollIds?.has(rollId) ? 'normal' : originalMode
      const requiredCount = mode === 'normal' ? 1 : 2
      if (
        (mode === 'normal' ? values.length !== 1 && values.length !== 2 : values.length !== requiredCount) ||
        values.some((value) => !Number.isInteger(value) || value < 1 || value > 20)
      ) continue
      const d20 = mode === 'advantage'
        ? Math.max(values[0]!, values[1]!)
        : mode === 'disadvantage'
          ? Math.min(values[0]!, values[1]!)
          : values[0]!
      const modifier = evaluateDnd5eFormulaV1(check.attackBonus, {
        actor: input.actor,
        target,
        castLevel: input.castLevel,
        rolls: input.rolls,
      }) + (input.actor.d20RollModifier ?? 0) + consumeDnd5eRollDiceModifier(input.actor.id,
        input.actor.rollDiceEffects, 'attack', dnd5eRollDiceCheckSlot(activity.id,
          checkKey, 'source'))
      const attackMode = (check.attackType === 'spell' || (check.attackType == null && activity.legacySource?.kind === 'spell')) ? 'spell' : check.delivery ?? 'default'
      if (resolveDnd5eAttackRollOutcome({ roll: { d20, total: d20 + modifier, naturalOne: d20 === 1, naturalTwenty: d20 === 20 },
        targetArmorClass: target.attackArmorClasses?.[attackMode] ?? target.armorClass,
        criticalThreshold: Math.min(check.criticalThreshold ?? 20, target.criticalThresholdAgainstSource ?? 20) }).hit) {
        successes.add(checkKey)
      }
    }
  }
  return successes
  }, input.effectDicePreview)
}
import { consumeDnd5eRollDiceModifier, dnd5eRollDiceCheckSlot, withDnd5eRollDicePreview, type Dnd5eRollDicePreviewContext } from '../rollDiceTransaction'
