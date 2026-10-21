import type { Dnd5eHeadlessCombatState, Dnd5eCombatEvent } from '../headlessCombatEngine'

/** Bind dependent effects only to controllers emitted by this application. */
export function bindDnd5eApplicationEffectLinks(state: Dnd5eHeadlessCombatState, events: Dnd5eCombatEvent[]): boolean {
  const renewedControllers = new Set<object>()
  // Bind only to effects emitted by this successful application, never an older
  // same-named controller. The whole transaction rolls back on ambiguity.
  for (const event of events.filter(event => event.type === 'active-effect-applied' || event.type === 'active-effect-refreshed')) {
    const bearer = state.combatants[event.targetId]
    const dependent = bearer?.classState.activeEffects?.find(effect => effect.id === event.effectId)
    const link = dependent?.removal?.sourceLink
    if (!dependent || !link?.sourceRequiresEffectSameApplication || link.sourceRequiresEffectInstanceId) continue
    const owner = dependent.source.actorId ? state.combatants[dependent.source.actorId] : undefined
    const createdIds = new Set(events.filter(candidate =>
      (candidate.type === 'active-effect-applied' || candidate.type === 'active-effect-refreshed') && candidate.targetId === owner?.id)
      .map(candidate => (candidate as Extract<Dnd5eCombatEvent, {type:'active-effect-applied'}>).effectId))
    const matches = owner?.classState.activeEffects?.filter(effect => createdIds.has(effect.id) && (
      effect.definitionId === link.sourceRequiresEffect || effect.definitionId.endsWith(`:${link.sourceRequiresEffect}`) ||
      effect.definitionId.includes(`:${link.sourceRequiresEffect}:`))) ?? []
    if (matches.length !== 1) return false
    if (!renewedControllers.has(matches[0])) {
      const previousId = matches[0].id
      matches[0].id = `${previousId}:application:${crypto.randomUUID()}`
      for (const created of events) {
        if ((created.type === 'active-effect-applied' || created.type === 'active-effect-refreshed') &&
            created.targetId === owner?.id && created.effectId === previousId) created.effectId = matches[0].id
      }
      renewedControllers.add(matches[0])
    }
    link.sourceRequiresEffectInstanceId = matches[0].id
    // Remember the dependent identity on its exact controller. It must not be
    // reconstructed later from whichever corpse happens to remain on a map.
    const linkedTargets = (matches[0].linkedTargetSnapshots ?? []).filter(entry => entry.effectId !== dependent.id)
    if (linkedTargets.length >= 64) return false
    matches[0].linkedTargetSnapshots = [...linkedTargets, { actorId: bearer.id, effectId: dependent.id, name: bearer.name }]
  }
  return true
}
