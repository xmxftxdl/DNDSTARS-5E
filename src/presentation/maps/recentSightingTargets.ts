import type { Dnd5eHeadlessCombatState } from '../../application/combat/dnd5eCombatRules'
import { dnd5eCombatantCanSee } from '../../application/combat/dnd5eCombatRules'
import { dnd5eCreatureSeenRecently } from '../../rulesets/dnd5e/recentCreatureSightings'

/** UI preview only. The Host repeats qualification at commit. No coordinates are returned. */
export function recentSightingTargetOptions(input: {
  state: Dnd5eHeadlessCombatState; actorId: string; worldMinute?: number; maximumAgeSeconds: number;
  detectedUnseenIds?: ReadonlySet<string>;
}): ReadonlyMap<string, { currentlyVisible: boolean; label?: string }> {
  const actor = input.state.combatants[input.actorId]
  const options = new Map<string, { currentlyVisible: boolean; label?: string }>()
  if (!actor) return options
  for (const target of Object.values(input.state.combatants)) {
    if (target.id === actor.id || target.objectDamageThreshold != null || target.objectInteractionOnly) continue
    const currentlyVisible = !input.detectedUnseenIds?.has(target.id) && dnd5eCombatantCanSee(input.state, actor.id, target.id)
    if (dnd5eCreatureSeenRecently({ history: actor.classState.recentCreatureSightings, targetId: target.id,
      mapId: input.state.mapId ?? '', worldMinute: input.worldMinute, maximumAgeSeconds: input.maximumAgeSeconds, currentlyVisible })) {
      const label = actor.classState.recentCreatureSightings?.[target.id]?.label
      options.set(target.id, { currentlyVisible, ...(!currentlyVisible && label ? { label } : {}) })
    }
  }
  return options
}
