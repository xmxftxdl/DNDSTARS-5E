import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'

/** Stamp only grants or explicit controllers produced/refreshed by this committed execution. */
export function stampDnd5eActivityGrantProvenance(
  state: Dnd5eHeadlessCombatState, events: readonly Dnd5eCombatEvent[], executionId: string,
  options:{controllersOnly?:true}={},
): void {
  if (!executionId) return
  for (const event of events) {
    if (!options.controllersOnly&&(event.type === 'activity-resolved' || event.type === 'spell-cast')) event.executionId = executionId
    if (!options.controllersOnly&&event.type === 'temporary-hit-points-gained' && event.source) {
      event.source = { ...event.source, executionId }
    }
    if (event.type !== 'active-effect-applied' && event.type !== 'active-effect-refreshed') continue
    const actor = state.combatants[event.targetId]
    if (!actor?.classState.activeEffects) continue
    actor.classState.activeEffects = actor.classState.activeEffects.map(effect =>
      effect.id === event.effectId && (!options.controllersOnly&&effect.grantedActivities?.length ||
        effect.captureExecutionIdentity===true&&effect.definitionId===event.definitionId&&
        !!effect.source.actorId&&!!effect.source.pluginId&&!!effect.source.rulesId&&
        event.logContext?.effect?.source?.actorId===effect.source.actorId&&
        event.logContext.effect.source.pluginId===effect.source.pluginId&&
        event.logContext.effect.source.rulesId===effect.source.rulesId&&
        event.logContext.effect.source.kind===effect.source.kind)
        ? { ...effect, source: { ...effect.source, executionId } } : effect)
  }
}
