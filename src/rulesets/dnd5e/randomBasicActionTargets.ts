import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { prepareDnd5ePlayerBasicAction } from './playerBasicAction'

type Input = Parameters<typeof prepareDnd5ePlayerBasicAction>[0]
export function prepareDnd5eRandomTargetBasicAction(input: Input & {
  chooseRandomTarget: (candidates: readonly string[]) => string
}): ReturnType<typeof prepareDnd5ePlayerBasicAction> | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  // Only serializable preparation data may enter replayable Host snapshots.
  // The selection callback belongs to this orchestration step alone.
  const { chooseRandomTarget, ...preparationInput } = input
  const original = prepareDnd5ePlayerBasicAction(preparationInput)
  if (!original.ok) return original
  const ready = original.prepared, payload = ready.payload
  if ((payload.kind !== 'grapple' && payload.kind !== 'shove' && payload.kind !== 'help' && payload.kind !== 'wake') ||
    !dnd5eActiveRandomizesVisibleCreatureTargets(ready.state.combatants[ready.actorTokenId]?.classState.activeEffects)) return original
  const prepare = (targetTokenId: string) => prepareDnd5ePlayerBasicAction({ ...preparationInput,
    action: { ...input.action, dnd5eBasicAction: { ...payload, targetTokenId } } })
  const candidates = input.map.tokens.flatMap(token => {
    if (token.id === ready.actorTokenId || token.type === 'obstacle') return []
    const trial = prepare(token.id)
    return trial.ok && dnd5eCombatantCanSee(trial.prepared.state, ready.actorTokenId, token.id) ? [token.id] : []
  })
  if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
  let selected: string
  try { selected = chooseRandomTarget(candidates) }
  catch { return { ok: false, reason: 'random-target-pool-changed' } }
  return candidates.includes(selected) ? prepare(selected) : { ok: false, reason: 'random-target-unavailable' }
}
