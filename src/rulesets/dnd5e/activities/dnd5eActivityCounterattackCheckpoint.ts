import { previewDnd5eSavingThrowCounterattack, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { selectedSavingThrowAbility } from './dnd5eActivityExecutor'
import type { Dnd5eActivityAuthorityInput } from './dnd5eActivityCommand'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { planDnd5eAutomaticAlliedSavingThrowRolls } from './dnd5eActivityAutomaticRolls'

/** Stage real attacks on detached state. The bridge must still validate every requested check. */
export function stageDnd5eActivityCounterattacks(
  source: Dnd5eHeadlessCombatState,
  activity: Dnd5eActivityDefinitionV1 | undefined,
  authority: Dnd5eActivityAuthorityInput,
) {
  const uses = authority.savingThrowCounterattacks ?? []
  if (!Array.isArray(uses)) throw Error('activity-counterattack-list-invalid')
  let state = source
  const events: Dnd5eCombatEvent[] = []
  const successKeys = new Set<string>()
  const requestedKeys = new Set<string>()
  if (!uses.length) return { state, events, successKeys, requestedKeys }
  if (!activity || activity.authorityBinding || uses.length > 32 || authority.weaponCounterattackSuccessCheckKeys?.size)
    throw Error('activity-counterattack-owner-invalid')
  const declarations = dnd5eActivityPerTargetRollDeclarationsV1({
    activity,
    actor: { ...authority.actor, controller: source.combatants[authority.actor.id]?.controller },
    targets: authority.targets.map(target => ({ ...target, controller: source.combatants[target.id]?.controller })),
    combatants: source.combatants,
    declarations: compileDnd5eActivityHeadlessAction(activity).perTargetRolls,
    projectileTargetIds: authority.command.projectileTargetIds, choices: authority.command.choices,
    hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal',
  })
  const requiredIds = new Set(planDnd5eAutomaticAlliedSavingThrowRolls({
    activity, actor: authority.actor, targets: authority.targets, declarations,
    willingTargetIds: authority.command.willingTargetIds,
  }).declarations.map(roll => roll.id))
  const counts = new Map<string, number>()
  const candidates = (activity.checks ?? []).flatMap(check => {
    if (check.kind !== 'saving-throw' || check.scope !== 'per-target') return []
    const ids = check.perProjectile ? authority.command.projectileTargetIds ?? [] : authority.command.targetIds
    return ids.flatMap((targetId, index) => {
      const target = authority.targets.find(target => target.id === targetId)
      if (!target || !source.combatants[targetId]) return []
      const ability = selectedSavingThrowAbility(target, check.ability, check.abilityOptions)
      const identity = JSON.stringify([targetId, ability])
      const occurrence = counts.get(identity) ?? 0
      counts.set(identity, occurrence + 1)
      const suffix = `${check.perProjectile ? `:projectile:${index}` : ''}:${targetId}`
      return requiredIds.has(`${check.rollId}${suffix}`)
        ? [{ key: `${check.id}${suffix}`, targetId, ability, occurrence }] : []
    })
  })
  const planned = uses.map((use, index) => {
    const candidate = candidates.find(candidate => candidate.targetId === use.targetId &&
      candidate.ability === use.ability && candidate.occurrence === use.occurrence)
    if (!candidate || use.sourceId !== authority.command.actorId || requestedKeys.has(candidate.key))
      throw Error('activity-counterattack-check-invalid')
    requestedKeys.add(candidate.key)
    return { use, index, candidate }
  }).sort((left, right) => candidates.indexOf(left.candidate) - candidates.indexOf(right.candidate))
  for (const { use, index, candidate } of planned) {
    const preview = previewDnd5eSavingThrowCounterattack(state, use)
    if (!preview) throw Error('activity-counterattack-invalid')
    state = preview.state
    events.push(...preview.events.map(event => event.type === 'saving-throw-counterattack-resolved' ? { ...event, index } : event))
    if (preview.hit) successKeys.add(candidate.key)
  }
  return { state, events, successKeys, requestedKeys }
}
