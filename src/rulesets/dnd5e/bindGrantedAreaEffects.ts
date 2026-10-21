import type { BattleMap } from '../../store/maps'
import type { Dnd5eActionResult } from './headlessCombatEngine'

/** Bind only effects produced by this successful control invocation, never unrelated existing effects. */
export function bindDnd5eGrantedAreaEffects(input: {
  result: Dnd5eActionResult; map: BattleMap; areaId?: string; actorId: string; pluginId: string
}): boolean {
  if (!input.result.ok) return false
  const activity = input.result.activityDefinition
  const definitions = activity?.effects?.filter(effect => effect.bindToGrantingArea) ?? []
  const area = input.map.dnd5ePluginAreas?.find(candidate => candidate.id === input.areaId)
  const grant = area?.grantedActivities?.find(candidate => candidate.activityId === activity?.id)
  if (!definitions.length && !grant?.releaseBoundEffects) return true
  if (!area || area.sourceTokenId !== input.actorId || area.pluginId !== input.pluginId ||
    !area.grantedActivities?.some(grant => grant.activityId === activity?.id)) return false
  let generation = area.boundEffectGeneration ?? 0
  if (grant?.releaseBoundEffects) {
    if (!Number.isSafeInteger(generation) || generation < 0 || generation >= Number.MAX_SAFE_INTEGER) return false
    generation += 1
    input.map.dnd5ePluginAreas = input.map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id
      ? { ...candidate, boundEffectGeneration: generation } : candidate)
  }
  const applied = input.result.events.filter(event =>
    event.type === 'active-effect-applied' || event.type === 'active-effect-refreshed')
  for (const event of applied) {
    if (event.type !== 'active-effect-applied' && event.type !== 'active-effect-refreshed') continue
    const target = input.result.state.combatants[event.targetId]
    if (!target) return false
    target.classState.activeEffects = target.classState.activeEffects?.map(effect => {
      if (effect.id !== event.effectId || effect.source.actorId !== input.actorId ||
        effect.standardCondition !== 'restrained' || !definitions.some(definition =>
          effect.definitionId === definition.id || effect.definitionId.endsWith(`:${definition.id}`))) return effect
      return { ...effect, areaLifetime: { mapId: input.map.id, areaId: area.id, sourceActorId: input.actorId,
        ...(generation > 0 ? { generation } : {}) } }
    })
  }
  return true
}
