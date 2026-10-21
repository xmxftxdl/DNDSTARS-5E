import { dnd5eActiveOptionalBonusDice } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eCombatantClassLevel } from '../../rulesets/dnd5e/headlessCombatPrimitives'
import { dnd5eOptionalBonusDieSourceEligible } from '../../rulesets/dnd5e/optionalBonusDieEligibility'
import { dnd5eActivityCheckTargetForRollV1, previewDnd5eActivitySavingThrowV1, type Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import type { Dnd5eActivityRetainedSaveDice } from '../../rulesets/dnd5e/activities/dnd5eActivityRetainedSaveDice'
import type { Dnd5eHeadlessCombatState, Dnd5eOptionalBonusDieUse } from '../../rulesets/dnd5e/headlessCombatEngine'
import type { Dnd5ePluginDiceRollDeclaration } from '../../rulesets/dnd5e/pluginApi'
import type { Dnd5eOptionalBonusDieInterruptRequest } from './dnd5eRollInterruptPipeline'
import type { Character } from '../../types/character'

export async function collectDnd5eActivityRetainedSaveChoice(input: {
  state: Dnd5eHeadlessCombatState
  execution: Omit<Dnd5eActivityExecutionInput, 'rolls'> & { rolls?: Dnd5eActivityExecutionInput['rolls'] }
  declaration: Dnd5ePluginDiceRollDeclaration
  values: readonly number[]
  selections: Record<string, Dnd5eActivityRetainedSaveDice[string]>
  prompted: Set<string>
  characterForToken: (id: string) => Character | undefined
  request: (request: Dnd5eOptionalBonusDieInterruptRequest) => Promise<Dnd5eOptionalBonusDieUse | undefined>
}): Promise<void> {
  const declaration = input.declaration
  if (declaration.d20RollKind !== 'saving-throw' || declaration.sides !== 20 || !declaration.rollerTokenId) return
  const target = input.state.combatants[declaration.rollerTokenId]
  if (!target) return
  const eligible = dnd5eActiveOptionalBonusDice(target.classState.activeEffects, 'saving-throw').filter(effect => {
    const die = effect.modifiers!.optionalBonusDie!
    return !die.consumeOnUse && dnd5eOptionalBonusDieSourceEligible({
      constraint: die.boundTargetSource, boundTargetId: effect.modifiers?.onHitBonusDamage?.boundTargetId,
      classLevel: die.boundTargetSource ? dnd5eCombatantClassLevel(target, die.boundTargetSource.classId) : 0,
      rollKind: 'saving-throw', source: { actorId: input.execution.actor.id, kind: 'saving-throw' },
    })
  })
  if (!eligible.length) return
  const check = input.execution.activity.checks?.find(candidate => candidate.kind === 'saving-throw' &&
    dnd5eActivityCheckTargetForRollV1(input.execution, candidate, declaration.id, target.id)?.id === target.id)
  if (!check || check.kind !== 'saving-throw') return
  const key = `${check.id}${declaration.id.slice(check.rollId.length)}`
  const mode = declaration.d20RollMode ?? 'normal'
  const preview = previewDnd5eActivitySavingThrowV1({ ...input.execution,
    checkRollModes: { ...input.execution.checkRollModes, [key]: mode },
    rolls: { ...input.execution.rolls, [declaration.id]: { values: [...input.values] } },
  }, declaration.id, target.id, mode)
  if (!preview || preview.dc == null || preview.automaticOutcome || input.prompted.has(preview.key)) return
  input.prompted.add(preview.key)
  const use = await input.request({
    target: input.characterForToken(target.id), combatant: target, retainedOnly: true, checkKey: preview.key,
    source: { actorId: input.execution.actor.id, kind: 'saving-throw' },
    rollKind: 'saving-throw', rollType: '豁免', originalD20: preview.d20,
    total: preview.total, targetNumber: preview.dc,
  })
  if (!use) return
  const effect = eligible.find(effect => effect.id === use.effectId)
  if (!effect || use.targetId !== target.id || use.rollKind !== 'saving-throw' ||
    !Number.isInteger(use.roll) || use.roll < 1 || use.roll > effect.modifiers!.optionalBonusDie!.sides) {
    throw new Error('invalid-activity-optional-save-choice')
  }
  input.selections[preview.key] = { effectId: use.effectId, targetId: target.id, roll: use.roll }
}
