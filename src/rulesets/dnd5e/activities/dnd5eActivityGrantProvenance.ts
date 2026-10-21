import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'

/** Stamp only grants produced/refreshed by this committed execution, not old grants. */
export function stampDnd5eActivityGrantProvenance(
  state: Dnd5eHeadlessCombatState, events: readonly Dnd5eCombatEvent[], executionId: string,
): void {
  if (!executionId) return
  for (const event of events) {
    if (event.type === 'activity-resolved' || event.type === 'spell-cast') event.executionId = executionId
    if (event.type === 'temporary-hit-points-gained' && event.source) {
      event.source = { ...event.source, executionId }
    }
    if (event.type !== 'active-effect-applied' && event.type !== 'active-effect-refreshed') continue
    const actor = state.combatants[event.targetId]
    if (!actor?.classState.activeEffects) continue
    actor.classState.activeEffects = actor.classState.activeEffects.map(effect =>
      effect.id === event.effectId && effect.grantedActivities?.length
        ? { ...effect, source: { ...effect.source, executionId } } : effect)
  }
}
