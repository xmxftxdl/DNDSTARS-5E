import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee, dnd5eMonsterSpecialCreatureTargetEligible } from './headlessCombatEngine'
import { prepareDnd5eMonsterSpecialAction } from './monsterSpecialAction'
type Input = Parameters<typeof prepareDnd5eMonsterSpecialAction>[0]
type Preparation = ReturnType<typeof prepareDnd5eMonsterSpecialAction>
export function prepareDnd5eRandomTargetMonsterSpecial(input: Input & {
  chooseRandomTarget: (candidates: readonly string[]) => string
}): Preparation | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  const original = prepareDnd5eMonsterSpecialAction(input)
  if (!original.ok) return original
  const ready = original.prepared
  if (!ready.targetToken || !dnd5eActiveRandomizesVisibleCreatureTargets(ready.state.combatants[ready.actorToken.id]?.classState.activeEffects)) return original
  const prepare = (targetTokenId: string) => prepareDnd5eMonsterSpecialAction({ ...input, targetTokenId,
    // Consent given for one creature cannot be transferred to a different creature.
    targetWilling: targetTokenId === input.targetTokenId && input.targetWilling === true ? true : undefined })
  const candidates = input.map.tokens.flatMap(token => {
    if (token.id === ready.actorToken.id || token.type === 'obstacle') return []
    const trial = prepare(token.id)
    return trial.ok && dnd5eCombatantCanSee(trial.prepared.state, ready.actorToken.id, token.id) &&
      dnd5eMonsterSpecialCreatureTargetEligible(trial.prepared.state, ready.actorToken.id, token.id, ready.action, trial.prepared.targetWilling) ? [token.id] : []
  })
  if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
  let chosen: string
  try { chosen = input.chooseRandomTarget(candidates) }
  catch { return { ok: false, reason: 'random-target-pool-changed' } }
  return candidates.includes(chosen) ? prepare(chosen) : { ok: false, reason: 'random-target-unavailable' }
}
