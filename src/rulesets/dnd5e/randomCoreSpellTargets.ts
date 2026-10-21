import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { prepareDnd5eSpellCast } from './spellAction'

type Input = Parameters<typeof prepareDnd5eSpellCast>[0]
type Preparation = ReturnType<typeof prepareDnd5eSpellCast>

export function prepareDnd5eRandomTargetCoreSpellCast(input: Input & {
  chooseRandomTarget: (occurrence: number, candidates: readonly string[]) => string
}): Preparation | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  const original = prepareDnd5eSpellCast(input)
  if (!original.ok) return original
  const cast = original.prepared
  if (!dnd5eActiveRandomizesVisibleCreatureTargets(cast.state.combatants[cast.actorToken.id]?.classState.activeEffects) ||
    cast.spell.target === 'area' || cast.spell.area != null || cast.activity.target.kind === 'self' ||
    cast.guessedTargetCell || cast.targetToken.type === 'obstacle') return original
  const occurrences = cast.projectileTargetIds ?? cast.targetTokens.map(token => token.id)
  const selected: string[] = []
  const prepareTargets = (ids: string[]) => {
    // The native ray authority requires the exact full projectile count even for a candidate trial.
    const fullIds = cast.projectileTargetIds ? [...ids, ...occurrences.slice(ids.length)] : ids
    const uniqueIds = [...new Set(fullIds)]
    return prepareDnd5eSpellCast({ ...input, action: { ...input.action,
      targetTokenId: fullIds[0], targetTokenIds: uniqueIds,
      dnd5eSpellCast: { ...input.action.dnd5eSpellCast!, targetTokenId: fullIds[0], targetTokenIds: uniqueIds,
        projectileTargetIds: cast.projectileTargetIds ? fullIds : undefined },
    } })
  }
  for (const [occurrence, requested] of occurrences.entries()) {
    if (requested === cast.actorToken.id) { selected.push(requested); continue }
    const candidates = input.map.tokens.flatMap(token => {
      if (token.id === cast.actorToken.id || token.type === 'obstacle' ||
        (!cast.projectileTargetIds && selected.includes(token.id))) return []
      const trial = prepareTargets([...selected, token.id])
      if (!trial.ok || !dnd5eCombatantCanSee(trial.prepared.state, cast.actorToken.id, token.id)) return []
      return [token.id]
    })
    if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
    let chosen: string
    try { chosen = input.chooseRandomTarget(occurrence, candidates) }
    catch { return { ok: false, reason: 'random-target-pool-changed' } }
    if (!candidates.includes(chosen)) return { ok: false, reason: 'random-target-unavailable' }
    selected.push(chosen)
  }
  return prepareTargets(selected)
}
