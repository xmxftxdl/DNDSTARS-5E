import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { prepareDnd5ePluginFeatureAction } from './pluginFeatureAction'

type Input = Parameters<typeof prepareDnd5ePluginFeatureAction>[0]
type Preparation = ReturnType<typeof prepareDnd5ePluginFeatureAction>
export function prepareDnd5eRandomTargetFeatureAction(input: Input & {
  chooseRandomTarget: (occurrence: number, candidates: readonly string[]) => string
}): Preparation | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  const { chooseRandomTarget, ...preparationInput } = input
  const original = prepareDnd5ePluginFeatureAction(preparationInput)
  if (!original.ok) return original
  const ready = original.prepared, kind = ready.feature.action?.targeting.kind
  if ((kind !== 'single-creature' && kind !== 'multiple-creatures' && !ready.selectableAreaTargets) || ready.automaticCreatureTargets ||
    !dnd5eActiveRandomizesVisibleCreatureTargets(ready.state.combatants[ready.actorToken.id]?.classState.activeEffects)) return original
  const selected: string[] = []
  const working = ready.targetTokens.map(token => token.id)
  const areaTrial = (occurrence: number, targetId: string) => {
    const ids = [...working], previous = ids[occurrence]!, existing = ids.indexOf(targetId)
    if (existing > occurrence) ids[existing] = previous
    ids[occurrence] = targetId
    return ids
  }
  const prepareTargets = (ids: string[]) => prepareDnd5ePluginFeatureAction({ ...preparationInput,
    action: { ...input.action, targetTokenId: ids[0], targetTokenIds: ids } })
  for (const [occurrence, requested] of ready.targetTokens.entries()) {
    if (requested.id === ready.actorToken.id || requested.type === 'obstacle') { selected.push(requested.id); continue }
    const candidates = input.map.tokens.flatMap(token => {
      if (token.id === ready.actorToken.id || token.type === 'obstacle' || selected.includes(token.id)) return []
      const ids = ready.selectableAreaTargets ? areaTrial(occurrence, token.id) : [...selected, token.id]
      const trial = prepareTargets(ids)
      if (!trial.ok || trial.prepared.targetTokens.length !== ids.length ||
        !dnd5eCombatantCanSee(trial.prepared.state, ready.actorToken.id, token.id)) return []
      return [token.id]
    })
    if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
    let chosen: string
    try { chosen = chooseRandomTarget(occurrence, candidates) }
    catch { return { ok: false, reason: 'random-target-pool-changed' } }
    if (!candidates.includes(chosen)) return { ok: false, reason: 'random-target-unavailable' }
    if (ready.selectableAreaTargets) working.splice(0, working.length, ...areaTrial(occurrence, chosen))
    selected.push(chosen)
  }
  return prepareTargets(selected)
}
