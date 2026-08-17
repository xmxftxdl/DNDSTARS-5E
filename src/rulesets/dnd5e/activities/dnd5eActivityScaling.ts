import type {
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityScalingV1,
} from './dnd5eActivityContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

export interface Dnd5eActivityScalingContextV1 {
  actor: {
    level: number
    proficiencyBonus: number
    classLevels?: Readonly<Record<string, number | undefined>>
  }
  castLevel?: number
}

function scalingSteps(scaling: Dnd5eActivityScalingV1, context: Dnd5eActivityScalingContextV1): number {
  if (scaling.basis === 'custom-table') {
    const entry = [...(scaling.table ?? [])]
      .filter((candidate) => candidate.level <= context.actor.level && typeof candidate.value === 'number')
      .sort((left, right) => right.level - left.level)[0]
    const steps = Math.max(0, Math.floor(typeof entry?.value === 'number' ? entry.value : 0))
    return scaling.maximumSteps == null ? steps : Math.min(steps, scaling.maximumSteps)
  }
  const value = scaling.basis === 'slot-level'
    ? context.castLevel ?? 0
    : scaling.basis === 'character-level'
      ? context.actor.level
      : scaling.basis === 'class-level'
        ? context.actor.classLevels?.[scaling.classId ?? ''] ?? 0
        : context.actor.proficiencyBonus
  const steps = Math.max(0, Math.floor(value - (scaling.baseLevel ?? 0)))
  return scaling.maximumSteps == null ? steps : Math.min(steps, scaling.maximumSteps)
}

function addDiceCount(formula: Dnd5eFormulaV1, amount: number): Dnd5eFormulaV1 {
  if (amount === 0) return formula
  if (formula.kind === 'dice') return { ...formula, count: Math.max(0, formula.count + amount) }
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round') {
    return { ...formula, value: addDiceCount(formula.value, amount) }
  }
  if (formula.kind === 'clamp') return { ...formula, value: addDiceCount(formula.value, amount) }
  if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
    const diceIndex = formula.values.findIndex((value) => value.kind === 'dice' ||
      value.kind === 'floor' || value.kind === 'ceil' || value.kind === 'round' || value.kind === 'clamp' ||
      value.kind === 'add' || value.kind === 'multiply' || value.kind === 'minimum' || value.kind === 'maximum')
    if (diceIndex < 0) return formula
    return { ...formula, values: formula.values.map((value, index) => index === diceIndex ? addDiceCount(value, amount) : value) }
  }
  return formula
}

function addFlatAmount(formula: Dnd5eFormulaV1, amount: number): Dnd5eFormulaV1 {
  if (amount === 0) return formula
  return { kind: 'add', values: [formula, { kind: 'constant', value: amount }] }
}

function scaledOperation(
  operation: Dnd5eActivityOperationV1,
  diceCount: number,
  flatAmount: number,
  additionalUses: number,
  durationRounds: number,
): Dnd5eActivityOperationV1 {
  let scaled = operation
  if (scaled.kind === 'create-persistent-area' && (diceCount !== 0 || flatAmount !== 0)) {
    scaled = {
      ...scaled,
      triggers: scaled.triggers?.map((trigger) => trigger.damage ? {
        ...trigger,
        damage: {
          ...trigger.damage,
          count: Math.max(1, trigger.damage.count + diceCount),
          modifier: (trigger.damage.modifier ?? 0) + flatAmount,
        },
      } : trigger),
    }
  }
  if (scaled.kind === 'create-persistent-area' && additionalUses !== 0) {
    scaled = {
      ...scaled,
      triggers: scaled.triggers?.map((trigger) => trigger.maximumTotalUses == null
        ? trigger
        : { ...trigger, maximumTotalUses: Math.max(1, trigger.maximumTotalUses + additionalUses) }),
    }
  }
  if ('amount' in scaled && (diceCount !== 0 || flatAmount !== 0)) {
    scaled = { ...scaled, amount: addFlatAmount(addDiceCount(scaled.amount, diceCount), flatAmount) }
  }
  if (durationRounds !== 0) {
    if (scaled.kind === 'summon' || scaled.kind === 'create-persistent-area') {
      scaled = { ...scaled, durationRounds: Math.max(1, scaled.durationRounds + durationRounds) }
    } else if (scaled.kind === 'apply-standard-condition' && scaled.duration.kind === 'rounds') {
      scaled = { ...scaled, duration: { ...scaled.duration, rounds: Math.max(1, scaled.duration.rounds + durationRounds) } }
    }
  }
  return scaled
}

/**
 * Expands a data-only Activity for the authoritative actor/cast context. Both
 * the Host dice recipe and the executor call this function, so an upcast can
 * never request one number of dice and consume another.
 */
export function scaleDnd5eActivityDefinitionV1(
  activity: Dnd5eActivityDefinitionV1,
  context: Dnd5eActivityScalingContextV1,
): {
  activity: Dnd5eActivityDefinitionV1
  additionalProjectilesByOperationId: ReadonlyMap<string, number>
} {
  const totals = new Map<string, { dice: number; flat: number; targets: number; projectiles: number; uses: number; duration: number }>()
  for (const scaling of activity.scaling ?? []) {
    const steps = scalingSteps(scaling, context)
    for (const adjustment of scaling.adjustments ?? []) {
      const current = totals.get(adjustment.operationId) ?? { dice: 0, flat: 0, targets: 0, projectiles: 0, uses: 0, duration: 0 }
      current.dice += (adjustment.diceCountPerStep ?? 0) * steps
      current.flat += (adjustment.flatAmountPerStep ?? 0) * steps
      current.targets += (adjustment.additionalTargetsPerStep ?? 0) * steps
      current.projectiles += (adjustment.additionalProjectilesPerStep ?? 0) * steps
      current.uses += (adjustment.additionalUsesPerStep ?? 0) * steps
      current.duration += (adjustment.durationRoundsPerStep ?? 0) * steps
      totals.set(adjustment.operationId, current)
    }
  }
  const extraTargets = [...totals.values()].reduce((maximum, value) => Math.max(maximum, value.targets), 0)
  const effectTotals = new Map<string, { dice: number; flat: number; duration: number }>()
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) {
      if (operation.kind !== 'apply-effect') continue
      const total = totals.get(operation.id)
      if (!total) continue
      const current = effectTotals.get(operation.effectId) ?? { dice: 0, flat: 0, duration: 0 }
      current.dice += total.dice
      current.flat += total.flat
      current.duration += total.duration
      effectTotals.set(operation.effectId, current)
    }
  }
  const target = activity.target.kind === 'creature'
    ? { ...activity.target, count: activity.target.count + extraTargets }
    : activity.target.kind === 'area'
      ? { ...activity.target, maximumTargets: activity.target.maximumTargets + extraTargets }
      : activity.target
  return {
    activity: {
      ...activity,
      target,
      effects: activity.effects?.map((effect) => {
        const total = effectTotals.get(effect.id)
        if (!total) return effect
        const duration = effect.duration.kind === 'rounds'
          ? total.duration !== 0
            ? { ...effect.duration, rounds: Math.max(1, effect.duration.rounds + total.duration) }
            : effect.duration
          : effect.duration.kind === 'save-ends' && effect.duration.damageOnFailure
            ? {
                ...effect.duration,
                damageOnFailure: {
                  ...effect.duration.damageOnFailure,
                  count: Math.max(1, effect.duration.damageOnFailure.count + total.dice),
                  modifier: total.flat === 0
                    ? effect.duration.damageOnFailure.modifier
                    : addFlatAmount(
                        effect.duration.damageOnFailure.modifier ?? { kind: 'constant', value: 0 },
                        total.flat,
                      ),
                },
              }
            : effect.duration
        const periodicDamage = effect.periodicDamage
          ? {
              ...effect.periodicDamage,
              count: Math.max(1, effect.periodicDamage.count + total.dice),
              modifier: total.flat === 0
                ? effect.periodicDamage.modifier
                : addFlatAmount(
                    effect.periodicDamage.modifier ?? { kind: 'constant', value: 0 },
                    total.flat,
                  ),
            }
          : undefined
        return { ...effect, duration, periodicDamage }
      }),
      outcomes: activity.outcomes.map((outcome) => ({
        ...outcome,
        operations: outcome.operations.map((operation) => {
          const total = totals.get(operation.id)
          return total ? scaledOperation(operation, total.dice, total.flat, total.uses, total.duration) : operation
        }),
      })),
    },
    additionalProjectilesByOperationId: new Map([...totals].map(([id, value]) => [id, value.projectiles])),
  }
}
