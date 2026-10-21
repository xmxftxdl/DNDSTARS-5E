import type { Dnd5eCombatant } from '../headlessCombatEngine'
import type { Dnd5ePluginDiceRollDeclaration } from '../plugins/pluginHeadlessContracts'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityHostActorCheckModeV1 } from './dnd5eActivityHostActorCheckMode'

/** Rebuild shared actor-check dice from live Host state; random/damage dice remain distinct. */
export function dnd5eActivitySharedRollDeclarationsV1(input: {
  activity: Dnd5eActivityDefinitionV1
  declarations?: readonly Dnd5ePluginDiceRollDeclaration[]
  actor: Dnd5eCombatant
  choices?: Readonly<Record<string, string>>
}): Dnd5ePluginDiceRollDeclaration[] {
  return (input.declarations ?? []).filter(declaration => {
    const check = input.activity.checks?.find(check => check.rollId === declaration.id && check.scope !== 'per-target')
    return !check || !('appliesWhenChoice' in check) || !check.appliesWhenChoice ||
      check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')
  }).map(declaration => {
    const check = input.activity.checks?.find(check => check.rollId === declaration.id && check.scope !== 'per-target')
    if (!check || (check.kind !== 'ability-check' && check.kind !== 'skill-check' && check.kind !== 'concentration-check')) return declaration
    const mode = check.rollMode === 'host-derived' ? dnd5eActivityHostActorCheckModeV1(input.actor, check) : check.rollMode ?? 'normal'
    const count = mode === 'normal' ? 1 : 2
    return { ...declaration, count, sides: 20, rollerTokenId: input.actor.id,
      d20RollKind: check.kind === 'concentration-check' ? 'saving-throw' : 'ability-check', d20RollMode: mode,
      attackAbility: undefined,
      acceptedCounts: check.rollMode === 'host-derived' && declaration.count === 2 && count === 1 ? [1, 2] : undefined }
  })
}
