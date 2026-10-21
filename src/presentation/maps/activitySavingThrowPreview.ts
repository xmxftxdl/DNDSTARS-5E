import { dnd5eActivityCheckTargetForRollV1, previewDnd5eActivityAttackV1, previewDnd5eActivitySavingThrowV1, type Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import type { Dnd5ePluginDiceRollDeclaration } from '../../rulesets/dnd5e/plugins/pluginHeadlessContracts'
import { createDiceCheckPreview } from './diceCheckOutcome'
import { dnd5eRollDiceRecipes } from '../../rulesets/dnd5e/rollDiceModifiers'

export function activitySavingThrowPreview(
  input: Omit<Dnd5eActivityExecutionInput, 'rolls'> & { rolls?: Dnd5eActivityExecutionInput['rolls'] },
  declaration: Dnd5ePluginDiceRollDeclaration,
) {
  if (declaration.sides !== 20) return undefined
  if (declaration.d20RollKind === 'attack') {
    const check = input.activity.checks?.find(candidate => candidate.kind === 'attack-roll' &&
      dnd5eActivityCheckTargetForRollV1(input, candidate, declaration.id) != null)
    const target = check && dnd5eActivityCheckTargetForRollV1(input, check, declaration.id)
    if (!check || !target) return undefined
    if (!input.effectDicePreview && dnd5eRollDiceRecipes({actorId:input.actor.id,effects:input.actor.rollDiceEffects,
      kind:'attack',eventId:'preview-pending'}).length) return undefined
    const mode = declaration.d20RollMode ?? 'normal'
    return createDiceCheckPreview('attack', input.actor.name ?? input.actor.id, target.name ?? target.id,
      (first, second) => previewDnd5eActivityAttackV1({
        ...input,
        checkRollModes: { ...input.checkRollModes, [`${check.id}${declaration.id.slice(check.rollId.length)}`]: mode },
        rolls: { ...input.rolls, [declaration.id]: { values: mode === 'normal' ? [first] : [first, second ?? first] } },
      }, declaration.id, mode)!.success, mode)
  }
  if (declaration.d20RollKind !== 'saving-throw') return undefined
  const target = input.targets.find(candidate => candidate.id === declaration.rollerTokenId)
  const check = input.activity.checks?.find(candidate => candidate.kind === 'saving-throw' &&
    dnd5eActivityCheckTargetForRollV1(input, candidate, declaration.id, target?.id)?.id === target?.id)
  if (!target || !check) return undefined
  if (!input.effectDicePreview && dnd5eRollDiceRecipes({actorId:target.id,effects:target.rollDiceEffects,
    kind:'saving-throw',eventId:'preview-pending'}).length) return undefined
  const mode = declaration.d20RollMode ?? 'normal'
  const key = `${check.id}${declaration.id.slice(check.rollId.length)}`
  return createDiceCheckPreview('save', target.name ?? target.id, undefined, (first, second) =>
    previewDnd5eActivitySavingThrowV1({
      ...input,
      rolls: { ...input.rolls, [declaration.id]: { values: mode === 'normal' ? [first] : [first, second ?? first] } },
      checkRollModes: { ...input.checkRollModes, [key]: mode },
    }, declaration.id, target.id, mode)!.success, mode)
}
