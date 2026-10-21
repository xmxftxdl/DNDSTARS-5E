import type { Dnd5eActivityDefinitionV1, Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'

/** Resolve once from Host event evidence, never from equipment selected after the hit. */
export function materializeDnd5eEventWeaponDice(activity: Dnd5eActivityDefinitionV1,
  context?: Dnd5eActivityTriggerContextV1): Dnd5eActivityDefinitionV1 {
  if (!activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'damage' && operation.weaponDiceFromTrigger))) return activity
  const source = context?.source
  if (context?.event !== 'attack-hit' || source?.kind !== 'attack' || source.category !== 'weapon' ||
    !['hit', 'critical-hit'].includes(source.result ?? '') || !source.weaponDamageDice || !source.damageType ||
    !Number.isInteger(source.weaponDamageDice.count) || source.weaponDamageDice.count < 1 || source.weaponDamageDice.count > 1000 ||
    !Number.isInteger(source.weaponDamageDice.sides) || source.weaponDamageDice.sides < 2 || source.weaponDamageDice.sides > 10000) {
    throw new Error('activity-trigger-weapon-dice-unavailable')
  }
  const sides = source.weaponDamageDice.sides
  return { ...activity, outcomes: activity.outcomes.map(outcome => ({ ...outcome,
    operations: outcome.operations.map(operation => {
      if (operation.kind !== 'damage' || !operation.weaponDiceFromTrigger) return operation
      const { weaponDiceFromTrigger, ...ordinary } = operation
      return { ...ordinary, amount: { kind: 'dice' as const, rollId: weaponDiceFromTrigger.rollId,
        count: weaponDiceFromTrigger.count, sides } }
    }),
  })) }
}
