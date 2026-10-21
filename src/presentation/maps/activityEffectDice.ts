import type {Dnd5eActivityExecutionInput} from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import type {Dnd5ePluginDiceRollDeclaration} from '../../rulesets/dnd5e/plugins/pluginHeadlessContracts'
import {dnd5eRollDiceRecipes, type Dnd5eRollDiceKind} from '../../rulesets/dnd5e/rollDiceModifiers'
import {dnd5eRollDiceCheckSlot, dnd5eRollDiceOccurrenceId} from '../../rulesets/dnd5e/rollDiceTransaction'

/** Prepare one declared check before presenting its d20 or conditional damage. */
export function activityEffectDiceRecipes(
  input: Pick<Dnd5eActivityExecutionInput,'activity'|'actor'|'targets'|'willingTargetIds'|'projectileTargetIds'> & {eventId:string},
  declaration: Dnd5ePluginDiceRollDeclaration,
) {
  if (declaration.sides !== 20) return []
  for (const check of input.activity.checks ?? []) {
    if (check.kind === 'random-roll') continue
    const subjects = 'perProjectile' in check && check.perProjectile
      ? (input.projectileTargetIds ?? []).flatMap((id, projectileOccurrenceIndex) => {
          const target = input.targets.find(target => target.id === id)
          return target ? [{ ...target, projectileOccurrenceIndex }] : []
        })
      : check.scope === 'per-target' ? input.targets : [input.targets[0]]
    for (const target of subjects) {
      const suffix = check.scope === 'per-target' && target
        ? `${'perProjectile' in check && check.perProjectile ? `:projectile:${target.projectileOccurrenceIndex}` : ''}:${target.id}` : ''
      const key = `${check.id}${suffix}`
      const rollId = `${check.rollId}${suffix}`
      const opposed = check.kind === 'opposed-ability-check' && target && declaration.id === `${check.opposedRollId}:${target.id}`
      if (declaration.id !== rollId && !opposed) continue
      if (check.kind === 'saving-throw' && target && (
        check.automaticSuccessIfConditionImmune && target.conditionImmunities?.includes(check.automaticSuccessIfConditionImmune) ||
        check.allowWillingFailure && input.willingTargetIds?.includes(target.id) ||
        check.automaticFailureIfAllied && (target.id === input.actor.id || target.controller === input.actor.controller)
      )) return []
      const subject = opposed || check.kind === 'saving-throw' ? 'target' : 'source'
      const actor = subject === 'target' ? target : input.actor
      if (!actor) return []
      const kind: Dnd5eRollDiceKind = check.kind === 'attack-roll' ? 'attack' :
        check.kind === 'saving-throw' ? 'saving-throw' : check.kind === 'concentration-check' ? 'concentration-save' : 'ability-check'
      return dnd5eRollDiceRecipes({actorId:actor.id,effects:actor.rollDiceEffects,kind,
        eventId:dnd5eRollDiceOccurrenceId(input.eventId,actor.id,kind,0,dnd5eRollDiceCheckSlot(input.activity.id,key,subject))})
    }
  }
  return []
}
