import { previewDnd5eActivityAttackV1, previewDnd5eActivitySavingThrowV1, type Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import type { Dnd5ePluginDiceRollDeclaration } from '../../rulesets/dnd5e/plugins/pluginHeadlessContracts'
import { createDiceCheckPreview } from './diceCheckOutcome'

export function activitySavingThrowPreview(
  input: Omit<Dnd5eActivityExecutionInput, 'rolls'> & { rolls?: Dnd5eActivityExecutionInput['rolls'] },
  declaration: Dnd5ePluginDiceRollDeclaration,
) {
  if (declaration.sides !== 20) return undefined
  if (declaration.d20RollKind === 'attack') {
    const check = input.activity.checks?.find(candidate => candidate.kind === 'attack-roll' &&
      input.targets.some(target => declaration.id === (candidate.scope === 'per-target' ? `${candidate.rollId}:${target.id}` : candidate.rollId)))
    const target = check && input.targets.find(candidate =>
      declaration.id === (check.scope === 'per-target' ? `${check.rollId}:${candidate.id}` : check.rollId))
    if (!check || !target) return undefined
    const mode = declaration.d20RollMode ?? 'normal'
    return createDiceCheckPreview('attack', input.actor.name ?? input.actor.id, target.name ?? target.id,
      (first, second) => previewDnd5eActivityAttackV1({
        ...input,
        checkRollModes: { ...input.checkRollModes, [check.scope === 'per-target' ? `${check.id}:${target.id}` : check.id]: mode },
        rolls: { ...input.rolls, [declaration.id]: { values: mode === 'normal' ? [first] : [first, second ?? first] } },
      }, declaration.id, mode)!.success, mode)
  }
  if (declaration.d20RollKind !== 'saving-throw') return undefined
  const target = input.targets.find(candidate => candidate.id === declaration.rollerTokenId)
  const check = input.activity.checks?.find(candidate => candidate.kind === 'saving-throw' &&
    declaration.id === (candidate.scope === 'per-target' ? `${candidate.rollId}:${target?.id}` : candidate.rollId))
  if (!target || !check) return undefined
  const mode = declaration.d20RollMode ?? 'normal'
  const key = check.scope === 'per-target' ? `${check.id}:${target.id}` : check.id
  return createDiceCheckPreview('save', target.name ?? target.id, undefined, (first, second) =>
    previewDnd5eActivitySavingThrowV1({
      ...input,
      rolls: { ...input.rolls, [declaration.id]: { values: mode === 'normal' ? [first] : [first, second ?? first] } },
      checkRollModes: { ...input.checkRollModes, [key]: mode },
    }, declaration.id, target.id, mode)!.success, mode)
}
