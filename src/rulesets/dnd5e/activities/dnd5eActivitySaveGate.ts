import { previewDnd5eActivityAttackV1, previewDnd5eActivitySavingThrowV1, previewDnd5eActivityUpwardClearanceV1, type Dnd5eActivityExecutionInput } from './dnd5eActivityExecutor'
import type { Dnd5eActivityOutcomeWhenV1 } from './dnd5eActivityContracts'
import type { Dnd5ePluginDiceRollDeclaration } from '../plugins/pluginHeadlessContracts'
import { Dnd5eFormulaEvaluationError } from './dnd5eFormula'

function previewSave(...args: Parameters<typeof previewDnd5eActivitySavingThrowV1>) {
  try { return previewDnd5eActivitySavingThrowV1(...args) }
  catch (error) {
    // Invalid submitted dice establish neither outcome; final authority rejects them.
    if (error instanceof Dnd5eFormulaEvaluationError) return undefined
    throw error
  }
}

/** The UI and Host derive projectile damage recipes from the same submitted checks. */
export function dnd5eActivityProjectileFormulaOptionsV1(
  input: Dnd5eActivityExecutionInput,
  declarations: readonly Dnd5ePluginDiceRollDeclaration[],
) {
  const criticalProjectileIndices = new Set<number>()
  const criticalIndependentTargetIds = new Set<string>()
  const hasIndependentDamage = input.activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'damage' && operation.perTarget))
  for (const target of hasIndependentDamage ? input.targets : []) {
    for (const check of input.activity.checks ?? []) {
      if (check.kind !== 'attack-roll' || check.perProjectile) continue
      const suffix = check.scope === 'per-target' ? `:${target.id}` : ''
      const rollId = `${check.rollId}${suffix}`
      if (!input.rolls[rollId]) continue
      const key = `${check.id}${suffix}`
      const mode = declarations.find(declaration => declaration.id === rollId)?.d20RollMode ?? input.checkRollModes?.[key]
      const result = previewDnd5eActivityAttackV1({ ...input,
        targets: [target], checkRollModes: mode == null ? input.checkRollModes : { ...input.checkRollModes, [key]: mode },
      }, rollId, mode)
      if (result?.success && result.criticalSuccess) criticalIndependentTargetIds.add(target.id)
    }
  }
  for (const [index, targetId] of (input.projectileTargetIds ?? []).entries()) {
    for (const check of input.activity.checks ?? []) {
      if (check.kind !== 'attack-roll') continue
      if (check.appliesWhenChoice && !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')) continue
      const suffix = check.scope === 'per-target' ? `${check.perProjectile ? `:projectile:${index}` : ''}:${targetId}` : ''
      const rollId = `${check.rollId}${suffix}`
      if (!input.rolls[rollId]) continue
      const key = `${check.id}${suffix}`
      const mode = declarations.find(declaration => declaration.id === rollId)?.d20RollMode ?? input.checkRollModes?.[key]
      const result = previewDnd5eActivityAttackV1({ ...input,
        checkRollModes: mode == null ? input.checkRollModes : { ...input.checkRollModes, [key]: mode },
      }, rollId, mode)
      if (result?.success && result.criticalSuccess) criticalProjectileIndices.add(index)
    }
  }
  return {
    independentTargetIds: input.targets.map(target => target.id),
    criticalIndependentTargetIds,
    independentTargetOutcomeGate: (when: Dnd5eActivityOutcomeWhenV1, targetId: string) =>
      dnd5eActivityTargetOutcomeGateV1({ ...input, targets: input.targets.filter(target => target.id === targetId) }, declarations, when),
    projectileTargetIds: input.projectileTargetIds,
    criticalProjectileIndices,
    projectileOutcomeGate: (when: Dnd5eActivityOutcomeWhenV1, index: number) =>
      dnd5eActivityTargetOutcomeGateV1(input, declarations, when, index),
  }
}

/** Only a proven false branch may omit target damage; unknown predicates keep their dice. */
export function dnd5eActivityTargetOutcomeGateV1(
  input: Dnd5eActivityExecutionInput,
  declarations: readonly Dnd5ePluginDiceRollDeclaration[],
  when: Dnd5eActivityOutcomeWhenV1,
  projectileOccurrenceIndex?: number,
): boolean | undefined {
  const projectileTargetId = projectileOccurrenceIndex == null ? undefined : input.projectileTargetIds?.[projectileOccurrenceIndex]
  if (projectileOccurrenceIndex != null && projectileTargetId == null) return undefined
  if (when.kind === 'always') return true
  const results = input.targets.filter(target => projectileTargetId == null || target.id === projectileTargetId).map(target => {
    const conditions = (when.kind === 'all' ? when.conditions : [when]).map(condition => {
      if (condition.kind === 'choice') {
        const choice = input.choices?.[condition.choiceId] ?? input.activity.choices?.find(c => c.id === condition.choiceId)?.defaultOptionId
        return choice == null ? undefined : choice === condition.optionId
      }
      if (condition.kind === 'check' && (condition.result === 'success' || condition.result === 'failure')) {
        const check = input.activity.checks?.find(check => check.id === condition.checkId)
        const success = check?.kind === 'attack-roll'
          ? dnd5eActivityAttackGateResultV1(input, declarations, condition.checkId, target.id, projectileOccurrenceIndex)
          : dnd5eActivitySaveGateResultV1(input, declarations, condition.checkId, target.id, projectileOccurrenceIndex)
        return success == null ? undefined : success === (condition.result === 'success')
      }
      if (condition.kind === 'predicate' && condition.predicate.kind === 'upward-clearance') {
        const predicate = condition.predicate
        const subject = predicate.subject === 'target' ? target : input.actor
        return previewDnd5eActivityUpwardClearanceV1(subject.upwardClearanceFeet,
          predicate.distanceFeet === 'area-height' ? input.areaPlacement?.heightFeet : predicate.distanceFeet, predicate.blocked)
      }
      return undefined
    })
    return conditions.includes(false) ? false : conditions.every(value => value === true) ? true : undefined
  })
  return results.includes(true) ? true : results.every(value => value === false) ? false : undefined
}

export function dnd5eActivityAttackGateResultV1(
  input: Dnd5eActivityExecutionInput,
  declarations: readonly Dnd5ePluginDiceRollDeclaration[],
  checkId: string,
  targetId: string,
  projectileOccurrenceIndex?: number,
): boolean | undefined {
  const check = input.activity.checks?.find(candidate => candidate.id === checkId)
  if (check?.kind !== 'attack-roll') return undefined
  if (check.appliesWhenChoice && !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')) return undefined
  if (check.perProjectile && (projectileOccurrenceIndex == null || input.projectileTargetIds?.[projectileOccurrenceIndex] !== targetId)) return undefined
  const suffix = check.scope === 'per-target' ? `${check.perProjectile ? `:projectile:${projectileOccurrenceIndex}` : ''}:${targetId}` : ''
  const rollId = `${check.rollId}${suffix}`
  const key = `${check.id}${suffix}`
  if (!input.rolls[rollId]) return undefined
  const mode = declarations.find(declaration => declaration.id === rollId)?.d20RollMode ?? input.checkRollModes?.[key]
  try {
    return previewDnd5eActivityAttackV1({ ...input,
      checkRollModes: mode == null ? input.checkRollModes : { ...input.checkRollModes, [key]: mode },
    }, rollId, mode)?.success
  } catch (error) {
    // An invalid submitted die proves neither branch. Keep the dice declaration
    // so authoritative validation rejects it without throwing from UI preview.
    if (error instanceof Dnd5eFormulaEvaluationError) return undefined
    throw error
  }
}

/** Read a settled save without executing outcomes or consuming its effect dice again. */
export function dnd5eActivitySaveGateResultV1(
  input: Dnd5eActivityExecutionInput,
  declarations: readonly Dnd5ePluginDiceRollDeclaration[],
  checkId: string,
  targetId: string,
  projectileOccurrenceIndex?: number,
): boolean | undefined {
  const check = input.activity.checks?.find(candidate => candidate.id === checkId)
  if (check?.kind !== 'saving-throw' || check.scope !== 'per-target') return undefined
  if (check.perProjectile && (projectileOccurrenceIndex == null || input.projectileTargetIds?.[projectileOccurrenceIndex] !== targetId)) return undefined
  const suffixFor = (id: string, index?: number) => `${check.perProjectile ? `:projectile:${index}` : ''}:${id}`
  if (check.stopAfterFirstFailure) {
    const orderedIds = check.perProjectile ? input.projectileTargetIds! : input.targets.map(target => target.id)
    const index = check.perProjectile ? projectileOccurrenceIndex! : orderedIds.indexOf(targetId)
    if (index < 0) return undefined
    // Do not let prefilled dice behind the first impact open later branches.
    for (const [previousIndex, previousId] of orderedIds.slice(0, index).entries()) {
      const previousRollId = `${check.rollId}${suffixFor(previousId, previousIndex)}`
      const previousKey = `${check.id}${suffixFor(previousId, previousIndex)}`
      if (!input.rolls[previousRollId] && !input.weaponCounterattackSuccessCheckKeys?.has(previousKey)) return undefined
      const mode = declarations.find(declaration => declaration.id === previousRollId)?.d20RollMode ?? input.checkRollModes?.[previousKey]
      if (previewSave({ ...input,
        checkRollModes: mode == null ? input.checkRollModes : { ...input.checkRollModes, [previousKey]: mode },
      }, previousRollId, previousId, mode)?.success !== true) return undefined
    }
  }
  if (check.appliesWhenChoice && !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')) return undefined
  if (check.appliesWhenCheck && dnd5eActivityAttackGateResultV1(input, declarations, check.appliesWhenCheck.checkId, targetId, projectileOccurrenceIndex) !== true) return undefined
  const rollId = `${check.rollId}${suffixFor(targetId, projectileOccurrenceIndex)}`
  const key = `${check.id}${suffixFor(targetId, projectileOccurrenceIndex)}`
  if (!input.rolls[rollId] && !input.weaponCounterattackSuccessCheckKeys?.has(key)) return undefined
  const mode = declarations.find(declaration => declaration.id === rollId)?.d20RollMode ?? input.checkRollModes?.[key]
  return previewSave({ ...input,
    checkRollModes: mode == null ? input.checkRollModes : { ...input.checkRollModes, [key]: mode },
  }, rollId, targetId, mode)?.success
}
