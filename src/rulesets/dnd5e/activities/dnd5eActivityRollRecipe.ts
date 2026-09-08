import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from './dnd5eActivityContracts'
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
  if (operation.kind === 'damage' || operation.kind === 'healing' || operation.kind === 'temporary-hit-points') return [operation.amount]
  if (operation.kind === 'revive') return [operation.hitPoints]
  if (operation.kind === 'resource') return [operation.amount]
  if (operation.kind === 'move') return [operation.distanceFeet]
  if (operation.kind === 'relocate-granting-area') return [operation.maximumFeet]
  if (operation.kind === 'summon') return [
    operation.count,
    ...[
      operation.minimumMaximumHitPoints,
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
        if (modifier.kind === 'armor-class' || modifier.kind === 'speed' || modifier.kind === 'weapon-damage-roll') return [modifier.value]
        if (modifier.kind === 'weapon-enchantment') return [modifier.attackAndDamageBonus]
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

export function collectScaledDnd5eActivityFormulaRollDeclarationsV1(
  activity: Dnd5eActivityDefinitionV1,
  options: { critical?: boolean; scaling?: Dnd5eActivityScalingContextV1 } = {},
) {
  const resolved = options.scaling
    ? scaleDnd5eActivityDefinitionV1(activity, options.scaling).activity
    : activity
  const doublesDice = options.critical === true && resolved.outcomes.some((outcome) =>
    outcome.operations.some((operation) => operation.kind === 'damage' && operation.critical === 'double-dice'))
  return collectDnd5eFormulaRollDeclarations(activityFormulas(resolved), doublesDice ? 2 : 1)
}

/**
 * Derives the critical-damage recipe from the submitted attack d20s using the
 * same roll-mode selection used by the Activity executor.  The browser asks
 * for attack dice first, then uses this Host-reproducible decision to request
 * the exact number of damage dice.
 */
export function dnd5eActivitySubmittedAttackRollIsCriticalV1(
  activity: Dnd5eActivityDefinitionV1,
  input: {
    targetIds: readonly string[]
    rolls: Readonly<Record<string, { values: readonly number[] }>>
    hostRollMode: (
      targetId: string,
      delivery?: 'melee' | 'ranged',
    ) => 'normal' | 'advantage' | 'disadvantage'
  },
): boolean {
  for (const check of activity.checks ?? []) {
    if (check.kind !== 'attack-roll') continue
    const targetIds = check.scope === 'per-target'
      ? input.targetIds
      : input.targetIds.slice(0, 1)
    for (const targetId of targetIds) {
      const rollId = check.scope === 'per-target'
        ? `${check.rollId}:${targetId}`
        : check.rollId
      const values = input.rolls[rollId]?.values
      if (!values) continue
      const declaredMode = check.rollMode ?? 'normal'
      const mode = declaredMode === 'host-derived'
        ? input.hostRollMode(targetId, check.delivery)
        : declaredMode
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
      if (selected >= (check.criticalThreshold ?? 20)) return true
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
    actor: Dnd5eActivityActorSnapshot
    targets: readonly Dnd5eActivityActorSnapshot[]
    rolls: Readonly<Record<string, { values: readonly number[] }>>
    choices?: Readonly<Record<string, string>>
    castLevel?: number
    hostRollMode: (
      targetId: string,
      delivery?: 'melee' | 'ranged',
    ) => 'normal' | 'advantage' | 'disadvantage'
  },
): Set<string> {
  const successes = new Set<string>()
  for (const check of activity.checks ?? []) {
    if (check.kind !== 'attack-roll') continue
    if (
      check.appliesWhenChoice &&
      !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')
    ) continue
    const targets = check.scope === 'per-target' ? input.targets : input.targets.slice(0, 1)
    for (const target of targets) {
      const rollId = check.scope === 'per-target' ? `${check.rollId}:${target.id}` : check.rollId
      const values = input.rolls[rollId]?.values
      if (!values) continue
      const declaredMode = check.rollMode ?? 'normal'
      const mode = declaredMode === 'host-derived'
        ? input.hostRollMode(target.id, check.delivery)
        : declaredMode
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
      }) + (input.actor.d20RollModifier ?? 0)
      if (d20 >= (check.criticalThreshold ?? 20) || (d20 !== 1 && d20 + modifier >= target.armorClass)) {
        successes.add(check.scope === 'per-target' ? `${check.id}:${target.id}` : check.id)
      }
    }
  }
  return successes
}
