import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { prepareDnd5eMonsterAttack } from './monsterAttackAction'

type Input = Parameters<typeof prepareDnd5eMonsterAttack>[0]
type Preparation = ReturnType<typeof prepareDnd5eMonsterAttack>

/** Selects each concrete weapon occurrence only after a variable attack count is known. */
export function prepareDnd5eRandomTargetMonsterAttack(input: Input & {
  chooseRandomTarget: (occurrence: number, candidates: readonly string[]) => string
}): Preparation | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  const initial = prepareDnd5eMonsterAttack(input)
  if (!initial.ok) return initial
  const ready = initial.prepared
  if (!dnd5eActiveRandomizesVisibleCreatureTargets(ready.state.combatants[ready.actorToken.id]?.classState.activeEffects) ||
    (ready.action.randomRepeat && input.randomRepeatRoll == null)) return initial
  const ids = ready.targetOccurrences.map(entry => entry.targetId)
  const prepare = (targets: string[]) => prepareDnd5eMonsterAttack({ ...input,
    // A declared attack preference must not narrow an active random-target effect.
    // Rebind only this Host trial; keep the saved declaration untouched until execution.
    map: input.readiedAttack ? { ...input.map, tokens: input.map.tokens.map(token =>
      token.id === ready.actorToken.id && token.dnd5eCombatState?.readiedAction?.targetId
        ? { ...token, dnd5eCombatState: { ...token.dnd5eCombatState,
          readiedAction: { ...token.dnd5eCombatState.readiedAction, targetId: targets[0] } } }
        : token) } : input.map,
    targetTokenId: targets[0], targetTokenIds: targets,
    targetTurnEconomy: input.turnEconomyByToken?.[targets[0]] ?? (targets[0] === input.targetTokenId ? input.targetTurnEconomy : undefined) })
  for (let occurrence = 0; occurrence < ids.length; occurrence++) {
    const candidates = input.map.tokens.flatMap(token => {
      if (token.id === ready.actorToken.id || token.type === 'obstacle') return []
      const trialIds = [...ids]; trialIds[occurrence] = token.id
      const trial = prepare(trialIds)
      if (!trial.ok || trial.prepared.targetOccurrences[occurrence]?.targetId !== token.id ||
        !dnd5eCombatantCanSee(trial.prepared.state, ready.actorToken.id, token.id)) return []
      return [token.id]
    })
    if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
    let selected: string
    try { selected = input.chooseRandomTarget(occurrence, candidates) }
    catch { return { ok: false, reason: 'random-target-pool-changed' } }
    if (!candidates.includes(selected)) return { ok: false, reason: 'random-target-unavailable' }
    ids[occurrence] = selected
  }
  return prepare(ids)
}
