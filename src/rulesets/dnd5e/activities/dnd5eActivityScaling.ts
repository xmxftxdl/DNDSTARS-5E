import type { Dnd5ePersistentAreaTriggerDeclaration } from '../persistentAreaTypes'
import type {
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityScalingV1,
} from './dnd5eActivityContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import type { AbilityKey } from '../../../lib/dnd'
import { dnd5eActivityTargetForChoicesV1 } from './dnd5eActivityChoices'

/** Same scale-then-choice order as execution, for Host spatial validation. */
export function dnd5eActivityEffectiveTargetV1(activity: Dnd5eActivityDefinitionV1,
  context: Dnd5eActivityScalingContextV1, choices?: Readonly<Record<string, string>>) {
  return dnd5eActivityTargetForChoicesV1(scaleDnd5eActivityDefinitionV1(activity, context).activity, choices)
}

export interface Dnd5eActivityScalingContextV1 {
  actor: {
    level: number
    proficiencyBonus: number
    classLevels?: Readonly<Record<string, number | undefined>>
    abilities?: Readonly<Partial<Record<AbilityKey, number>>>
  }
  castLevel?: number
}

function scalingSteps(scaling: Dnd5eActivityScalingV1, context: Dnd5eActivityScalingContextV1): number {
  if (scaling.basis === 'custom-table') {
    const level = scaling.classId == null ? context.actor.level : context.actor.classLevels?.[scaling.classId] ?? 0
    const entry = [...(scaling.table ?? [])]
      .filter((candidate) => candidate.level <= level && typeof candidate.value === 'number')
      .sort((left, right) => right.level - left.level)[0]
    const steps = Math.max(0, Math.floor(typeof entry?.value === 'number' ? entry.value : 0))
    return scaling.maximumSteps == null ? steps : Math.min(steps, scaling.maximumSteps)
  }
  const abilityScore = scaling.ability ? context.actor.abilities?.[scaling.ability] : undefined
  if (scaling.basis === 'ability-modifier' && !Number.isFinite(abilityScore)) throw new Error('activity-scaling-ability-score-missing')
  const value = scaling.basis === 'ability-modifier'
    ? Math.floor((abilityScore! - 10) / 2)
    : scaling.basis === 'slot-level'
    ? context.castLevel ?? 0
    : scaling.basis === 'character-level'
      ? context.actor.level
      : scaling.basis === 'class-level'
        ? context.actor.classLevels?.[scaling.classId ?? ''] ?? 0
        : context.actor.proficiencyBonus
  const steps = Math.max(0, Math.floor(value - (scaling.baseLevel ?? 0)))
  return scaling.maximumSteps == null ? steps : Math.min(steps, scaling.maximumSteps)
}

function scaledDieSides(sides: number, increment: number): number {
  const result = sides + increment
  if (!Number.isSafeInteger(result) || result < 2 || result > 10_000) throw new Error('activity-scaled-die-sides-invalid')
  return result
}

function hasDice(formula: Dnd5eFormulaV1): boolean {
  if (formula.kind === 'dice') return true
  if ('value' in formula && typeof formula.value === 'object') return hasDice(formula.value)
  return 'values' in formula && formula.values.some(hasDice)
}

function addDiceCount(formula: Dnd5eFormulaV1, amount: number, sides = 0): Dnd5eFormulaV1 {
  if (amount === 0 && sides === 0) return formula
  if (formula.kind === 'dice') return { ...formula, count: Math.max(0, formula.count + amount), sides: scaledDieSides(formula.sides, sides) }
  if (formula.kind === 'damage-roll' || formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round') {
    return { ...formula, value: addDiceCount(formula.value, amount, sides) }
  }
  if (formula.kind === 'clamp') return { ...formula, value: addDiceCount(formula.value, amount, sides) }
  if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
    const diceIndex = formula.values.findIndex(hasDice)
    if (diceIndex < 0) return formula
    return { ...formula, values: formula.values.map((value, index) => index === diceIndex ? addDiceCount(value, amount, sides) : value) }
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
  diceSides: number,
): Dnd5eActivityOperationV1 {
  let scaled = operation
  if (scaled.kind === 'create-persistent-area' && (diceCount !== 0 || flatAmount !== 0 || diceSides !== 0 || additionalUses !== 0)) {
    const scalesAmount = diceCount !== 0 || flatAmount !== 0 || diceSides !== 0
    const scaleTrigger = (trigger: Dnd5ePersistentAreaTriggerDeclaration): Dnd5ePersistentAreaTriggerDeclaration => ({
      ...trigger,
      ...(scalesAmount && trigger.damage ? { damage: {
        ...trigger.damage,
        count: Math.max(1, trigger.damage.count + diceCount),
        sides: scaledDieSides(trigger.damage.sides, diceSides),
        modifier: (trigger.damage.modifier ?? 0) + flatAmount,
      } } : {}),
      ...(scalesAmount && trigger.healing ? { healing: {
        ...trigger.healing,
        amount: Math.max(0, trigger.healing.amount + flatAmount),
        ...(trigger.healing.dice ? { dice: { ...trigger.healing.dice,
          count: Math.max(1, trigger.healing.dice.count + diceCount), sides: scaledDieSides(trigger.healing.dice.sides, diceSides) } } : {}),
      } } : {}),
      ...(trigger.maximumTotalUses != null && additionalUses !== 0
        ? { maximumTotalUses: Math.max(1, trigger.maximumTotalUses + additionalUses) } : {}),
    })
    scaled = { ...scaled, triggers: scaled.triggers?.map(scaleTrigger),
      modes: scaled.modes?.map(mode => ({ ...mode, triggers: mode.triggers?.map(scaleTrigger) })),
    }
  }
  if ('amount' in scaled && (diceCount !== 0 || flatAmount !== 0 || diceSides !== 0)) {
    scaled = { ...scaled, amount: addFlatAmount(addDiceCount(scaled.amount, diceCount, diceSides), flatAmount) }
  }
  if (scaled.kind === 'revive' && (diceCount !== 0 || flatAmount !== 0 || diceSides !== 0)) {
    scaled = {
      ...scaled,
      hitPoints: addFlatAmount(addDiceCount(scaled.hitPoints, diceCount, diceSides), flatAmount),
    }
  }
  if (durationRounds !== 0) {
    if (scaled.kind === 'summon' || scaled.kind === 'create-persistent-area' || scaled.kind === 'transform-creature') {
      if (scaled.durationRounds != null) scaled = { ...scaled, durationRounds: Math.max(1, scaled.durationRounds + durationRounds) }
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
  const castLevelTarget = [...(activity.castLevelTargetProfiles ?? [])]
    .filter((profile) => profile.minimumCastLevel <= (context.castLevel ?? 0))
    .sort((left, right) => right.minimumCastLevel - left.minimumCastLevel)[0]?.target
  const totals = new Map<string, { dice: number; sides: number; flat: number; targets: number; projectiles: number; uses: number; duration: number }>()
  let extraAreaRadiusFeet = 0
  for (const scaling of activity.scaling ?? []) {
    const steps = scalingSteps(scaling, context)
    extraAreaRadiusFeet += (scaling.areaRadiusFeetPerStep ?? 0) * steps
    for (const adjustment of scaling.adjustments ?? []) {
      const current = totals.get(adjustment.operationId) ?? { dice: 0, sides: 0, flat: 0, targets: 0, projectiles: 0, uses: 0, duration: 0 }
      current.dice += (adjustment.diceCountPerStep ?? 0) * steps
      current.sides += (adjustment.diceSidesPerStep ?? 0) * steps
      current.flat += (adjustment.flatAmountPerStep ?? 0) * steps
      current.targets += (adjustment.additionalTargetsPerStep ?? 0) * steps
      current.projectiles += (adjustment.additionalProjectilesPerStep ?? 0) * steps
      current.uses += (adjustment.additionalUsesPerStep ?? 0) * steps
      current.duration += (adjustment.durationRoundsPerStep ?? 0) * steps
      totals.set(adjustment.operationId, current)
    }
  }
  const extraTargets = [...totals.values()].reduce((maximum, value) => Math.max(maximum, value.targets), 0)
  const effectTotals = new Map<string, { dice: number; sides: number; flat: number; duration: number }>()
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) {
      if (operation.kind !== 'apply-effect') continue
      const total = totals.get(operation.id)
      if (!total) continue
      const current = effectTotals.get(operation.effectId) ?? { dice: 0, sides: 0, flat: 0, duration: 0 }
      current.dice += total.dice
      current.sides += total.sides
      current.flat += total.flat
      current.duration += total.duration
      effectTotals.set(operation.effectId, current)
    }
  }
  const profiledTarget = castLevelTarget ?? activity.target
  const target = profiledTarget.kind === 'creature'
    ? { ...profiledTarget, count: profiledTarget.count + extraTargets }
    : profiledTarget.kind === 'area'
      ? {
          ...profiledTarget,
          ...(profiledTarget.maximumTargets == null ? {} : {maximumTargets: profiledTarget.maximumTargets + extraTargets}),
          ...(profiledTarget.radiusFeet != null && extraAreaRadiusFeet !== 0
            ? { radiusFeet: Math.max(0, profiledTarget.radiusFeet + extraAreaRadiusFeet) }
            : {}),
        }
      : profiledTarget
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
                  sides: scaledDieSides(effect.duration.damageOnFailure.sides, total.sides),
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
              sides: scaledDieSides(effect.periodicDamage.sides, total.sides),
              modifier: total.flat === 0
                ? effect.periodicDamage.modifier
                : addFlatAmount(
                    effect.periodicDamage.modifier ?? { kind: 'constant', value: 0 },
                    total.flat,
                  ),
            }
          : undefined
        const modifiers = effect.modifiers?.map((modifier) => {
          if (
            (modifier.kind === 'on-hit-bonus-damage' || modifier.kind === 'damage-reduction') &&
            (total.dice !== 0 || total.flat !== 0 || total.sides !== 0)
          ) {
            if (modifier.kind === 'on-hit-bonus-damage' && modifier.amount.kind === 'weapon-dice') return {
              ...modifier,
              amount: { ...modifier.amount, count: modifier.amount.count + total.dice, bonus: (modifier.amount.bonus ?? 0) + total.flat },
            }
            if (modifier.amount.kind === 'weapon-dice') return modifier
            return {
            ...modifier,
            amount: addFlatAmount(addDiceCount(modifier.amount, total.dice, total.sides), total.flat),
            }
          }
          return modifier
        })
        return { ...effect, duration, periodicDamage, modifiers }
      }),
      outcomes: activity.outcomes.map((outcome) => ({
        ...outcome,
        operations: outcome.operations.map((operation) => {
          const total = totals.get(operation.id)
          return total ? scaledOperation(operation, total.dice, total.flat, total.uses, total.duration, total.sides) : operation
        }),
      })),
    },
    additionalProjectilesByOperationId: new Map([...totals].map(([id, value]) => [id, value.projectiles])),
  }
}
