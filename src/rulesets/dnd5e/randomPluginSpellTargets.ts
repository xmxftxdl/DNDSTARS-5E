import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { prepareDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'

type Preparation = ReturnType<typeof prepareDnd5ePluginSpellCast>
type Input = Parameters<typeof prepareDnd5ePluginSpellCast>[0]

/** Host owns the choice; callers supply a durable random selection for each target occurrence. */
export function prepareDnd5eRandomTargetPluginSpellCast(input: Input & {
  chooseRandomTarget: (occurrence: number, candidates: readonly string[]) => string
}): Preparation | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  const original = prepareDnd5ePluginSpellCast(input)
  if (!original.ok) return original
  const cast = original.prepared
  const selectiveArea = cast.targetSelection?.kind === 'area' && cast.targetSelection.selection === 'choose-any'
  if (!dnd5eActiveRandomizesVisibleCreatureTargets(cast.state.combatants[cast.actorToken.id]?.classState.activeEffects) ||
    (!selectiveArea && (cast.area || cast.activity?.target.kind === 'area')) || cast.activity?.target.kind === 'self') return original
  const selected: string[] = []
  const working = cast.targetTokens.map(token => token.id)
  const areaTrial = (occurrence: number, targetId: string) => {
    const ids = [...working], previous = ids[occurrence]!, existing = ids.indexOf(targetId)
    if (existing > occurrence) ids[existing] = previous
    ids[occurrence] = targetId
    return ids
  }
  const prepareTargets = (ids: string[]) => prepareDnd5ePluginSpellCast({ ...input, action: {
    ...input.action, targetTokenId: ids[0], targetTokenIds: ids,
    dnd5eSpellCast: { ...input.action.dnd5eSpellCast!, targetTokenId: ids[0], targetTokenIds: ids,
      projectileTargetIds: input.action.dnd5eSpellCast?.projectileTargetIds ? ids : undefined },
  } })
  for (const [occurrence, requested] of cast.targetTokens.entries()) {
    // The effect randomizes choices of other creatures, not a choice to target oneself.
    if (requested.id === cast.actorToken.id) { selected.push(requested.id); continue }
    const candidates = input.map.tokens.flatMap(token => {
      if (token.id === cast.actorToken.id || token.type === 'obstacle' || selectiveArea && selected.includes(token.id)) return []
      const ids = selectiveArea ? areaTrial(occurrence, token.id) : [...selected, token.id]
      const trial = prepareTargets(ids)
      if (!trial.ok || trial.prepared.targetTokens.length !== ids.length ||
        !dnd5eCombatantCanSee(trial.prepared.state, cast.actorToken.id, token.id)) return []
      const targeting = trial.prepared.targetSelection
      if (targeting?.kind === 'creature') {
        const distance = trial.prepared.targets.find(target => target.token.id === token.id)?.distanceFeet
        if (distance == null || distance < (targeting.minimumRangeFeet ?? 0) ||
          (targeting.rangeFeet != null && distance > targeting.rangeFeet)) return []
        if (targeting.maximumTargetSeparationFeet != null && trial.prepared.targetTokens.some(other =>
          dnd5eMapTokenDistanceFeet({ map: input.map, left: other, right: token }) > targeting.maximumTargetSeparationFeet!)) return []
      }
      return [token.id]
    })
    if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
    let chosen: string
    try { chosen = input.chooseRandomTarget(occurrence, candidates) }
    catch { return { ok: false, reason: 'random-target-pool-changed' } }
    if (!candidates.includes(chosen)) return { ok: false, reason: 'random-target-unavailable' }
    if (selectiveArea) working.splice(0, working.length, ...areaTrial(occurrence, chosen))
    selected.push(chosen)
  }
  return prepareTargets(selected)
}
