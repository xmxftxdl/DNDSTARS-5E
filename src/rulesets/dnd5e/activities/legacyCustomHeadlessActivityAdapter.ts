import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type {
  Dnd5eCustomHeadlessActionDraft,
  Dnd5eCustomHeadlessDiceFormula,
} from '../customRulesPlugin'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from './dnd5eActivityContracts'
import type { Dnd5eEffectDurationV1 } from './dnd5eEffectContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import { dnd5eWorkshopDamageFormulaAsFormulaV1 } from '../workshopDamageFormula'

function diceFormula(
  rollId: string,
  dice: Dnd5eCustomHeadlessDiceFormula,
): Dnd5eFormulaV1 {
  const rolled: Dnd5eFormulaV1 = { kind: 'dice', rollId, count: dice.count, sides: dice.sides }
  const values: Dnd5eFormulaV1[] = [rolled]
  if (dice.modifier) values.push({ kind: 'constant', value: dice.modifier })
  const dynamicModifier = dnd5eWorkshopDamageFormulaAsFormulaV1(dice.modifierFormula)
  if (dynamicModifier) values.push(dynamicModifier)
  return values.length === 1 ? rolled : { kind: 'add', values }
}

function effectDuration(duration: Dnd5ePluginEffectDuration): Dnd5eEffectDurationV1 {
  if (duration.expiresAt === 'permanent') return { kind: 'permanent' }
  if (duration.expiresAt === 'source-next-turn-start') {
    return { kind: 'rounds', rounds: duration.remainingRounds ?? 1, expiresAt: 'source-turn-start' }
  }
  if (duration.expiresAt === 'target-next-turn-start') {
    return { kind: 'rounds', rounds: duration.remainingRounds ?? 1, expiresAt: 'target-turn-start' }
  }
  if (duration.expiresAt === 'target-turn-end-save') {
    return {
      kind: 'save-ends', maximumRounds: duration.remainingRounds ?? 1,
      timing: 'target-turn-end', ability: duration.saveAbility ?? 'con',
      dc: { kind: 'constant', value: duration.saveDc ?? 10 },
    }
  }
  return { kind: 'rounds', rounds: duration.remainingRounds ?? 1, expiresAt: 'target-turn-end' }
}

/**
 * Compatibility adapter for V2 workshop actions. Existing packages keep their
 * bytes and ids; the Host now compiles them through the shared Activity IR.
 */
export function dnd5eActivityFromCustomHeadlessAction(
  definition: Dnd5eCustomHeadlessActionDraft,
): Dnd5eActivityDefinitionV1 {
  const operations: Dnd5eActivityOperationV1[] = definition.effects.map((effect, index) => {
    const id = `effect-${index}`
    if (effect.kind === 'damage') return {
      id,
      kind: 'damage',
      target: 'target',
      amount: diceFormula(id, effect.dice),
      damageType: effect.damageType,
    }
    if (effect.kind === 'healing') return {
      id,
      kind: 'healing',
      target: 'target',
      amount: diceFormula(id, effect.dice),
    }
    return {
      id,
      kind: 'apply-standard-condition',
      target: 'target',
      condition: effect.condition,
      duration: effectDuration(effect.duration),
    }
  })
  const savingThrow = definition.savingThrow
  const successOperations: Dnd5eActivityOperationV1[] = savingThrow?.onSuccess === 'half'
    ? operations.flatMap((operation) => operation.kind === 'damage' ? [{
        ...operation,
        id: `${operation.id}-half`,
        amount: {
          kind: 'floor' as const,
          value: { kind: 'multiply' as const, values: [operation.amount, { kind: 'constant' as const, value: 0.5 }] },
        },
      }] : [])
    : []
  return {
    schemaVersion: 1,
    id: definition.id,
    name: definition.label,
    activation: { kind: 'special', timing: 'inherited from the owning content definition' },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: { kind: 'creature', relation: 'any', count: 256, includeSelf: true },
    requirements: definition.requiredInterruptOptionId
      ? [{ kind: 'choice', choiceId: 'interrupt', optionId: definition.requiredInterruptOptionId }]
      : undefined,
    checks: savingThrow ? [{
      id: 'target-save',
      kind: 'saving-throw',
      rollId: 'target-save-d20',
      ability: savingThrow.ability,
      dc: savingThrow.dc === 'source-save-dc'
        ? { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }
        : { kind: 'constant', value: savingThrow.dc },
      rollMode: 'normal',
      scope: 'per-target',
    }] : undefined,
    outcomes: savingThrow ? [
      { id: 'failed-save', when: { kind: 'check', checkId: 'target-save', result: 'failure' }, operations },
      ...(successOperations.length > 0 ? [{
        id: 'successful-save',
        when: { kind: 'check' as const, checkId: 'target-save', result: 'success' as const },
        operations: successOperations,
      }] : []),
    ] : [{ id: 'resolve', when: { kind: 'always' }, operations }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'custom-headless-action', id: definition.id },
  }
}
