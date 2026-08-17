import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import { collectDnd5eFormulaRollDeclarations } from './dnd5eFormula'
import {
  scaleDnd5eActivityDefinitionV1,
  type Dnd5eActivityScalingContextV1,
} from './dnd5eActivityScaling'

function operationFormulas(operation: Dnd5eActivityOperationV1): readonly Dnd5eFormulaV1[] {
  if (operation.kind === 'damage' || operation.kind === 'healing' || operation.kind === 'temporary-hit-points') return [operation.amount]
  if (operation.kind === 'resource') return [operation.amount]
  if (operation.kind === 'move') return [operation.distanceFeet]
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
  if (operation.kind === 'invoke-activity') return [operation.repeat]
  if (operation.kind === 'apply-standard-condition' && operation.duration.kind === 'save-ends') return [operation.duration.dc]
  if (operation.kind === 'dispel-area') return [operation.radiusFeet, operation.maximumSpellLevel]
  return []
}

function activityFormulas(activity: Dnd5eActivityDefinitionV1): readonly Dnd5eFormulaV1[] {
  return [
    ...(activity.checks ?? []).flatMap((check) => check.kind === 'attack-roll' ? [check.attackBonus] : [check.dc]),
    ...activity.outcomes.flatMap((outcome) => outcome.operations.flatMap(operationFormulas)),
    ...(activity.effects ?? []).flatMap((effect) => [
      ...(effect.duration.kind === 'save-ends' ? [effect.duration.dc] : []),
      ...(effect.modifiers ?? []).flatMap((modifier) => {
        if (modifier.kind === 'armor-class' || modifier.kind === 'speed' || modifier.kind === 'weapon-damage-roll') return [modifier.value]
        if (modifier.kind === 'weapon-enchantment') return [modifier.attackAndDamageBonus]
        if (modifier.kind === 'movement-boundary-save') return [modifier.dc]
        if ((modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value) return [modifier.value]
        if (modifier.kind === 'damage-reduction' || modifier.kind === 'on-hit-bonus-damage') return [modifier.amount]
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
