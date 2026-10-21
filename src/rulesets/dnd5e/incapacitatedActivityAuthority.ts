import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eIsIncapacitated } from './passiveDefenses'
import { dnd5eBoundHpRetaliationGrant } from './activities/dnd5eAutonomousRetaliationContract'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityTriggerContextV1 } from './activities/dnd5eActivityContracts'

let current: { combatId: string; round: number; actorId: string; packageId: string; activityId: string } | undefined

/** Synchronous scope entered only by Host-owned hit/committed-event trigger paths. */
export function withDnd5eIncapacitatedActivityAuthority<T>(state: Dnd5eHeadlessCombatState, packageId: string,
  activity: Dnd5eActivityDefinitionV1, trigger: Dnd5eActivityTriggerContextV1, actorId: string, run: () => T): T {
  const actor = state.combatants[actorId]
  if (!activity.usableWhileIncapacitated || !actor || actor.deathSaves.dead || !trigger.eligibleActorIds.includes(actorId)) return run()
  const selfTrigger = activity.activation.kind === 'free' && activity.target.kind === 'self' &&
    activity.invocation?.kind === 'triggered' && activity.invocation.event === trigger.event &&
    ['self-dropped-to-zero', 'self-involuntarily-incapacitated'].includes(trigger.event) &&
    trigger.eligibleTargetIds.includes(actorId) &&
    (trigger.event === 'self-dropped-to-zero' ? actor.currentHp === 0 : dnd5eIsIncapacitated(actor))
  const autonomous = trigger.event === 'reaction-window' &&
    trigger.source.kind === 'attack' && trigger.source.targetId === actorId && trigger.source.result !== 'miss' &&
    dnd5eBoundHpRetaliationGrant(actor, packageId, activity) != null
  if (!selfTrigger && !autonomous) return run()
  const previous = current
  current = { combatId: state.combatId, round: state.round, actorId, packageId, activityId: activity.id }
  try { return run() } finally { current = previous }
}

export function hasDnd5eIncapacitatedActivityAuthority(state: Dnd5eHeadlessCombatState,
  actorId: string, activityId: string, packageId?: string): boolean {
  const actor = state.combatants[actorId]
  return !!current && current.combatId === state.combatId && current.round === state.round &&
    current.actorId === actorId && current.activityId === activityId && current.packageId === packageId &&
    !!actor && (actor.currentHp === 0 || dnd5eIsIncapacitated(actor)) && !actor.deathSaves.dead
}
