import { dnd5eActiveRandomizesVisibleCreatureTargets } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { prepareDnd5eMonsterCoreSpell, type PreparedDnd5eMonsterCoreSpell } from './monsterCoreSpellAction'
import type { Dnd5eMonsterTurnPlan } from './monsterTurnPlan'

type Input = Parameters<typeof prepareDnd5eMonsterCoreSpell>[0]
type Preparation = ReturnType<typeof prepareDnd5eMonsterCoreSpell>
export function prepareDnd5eRandomTargetMonsterSpell(input: Input & {
  projectileTargetIds?: readonly string[]
  chooseRandomTarget: (occurrence: number, candidates: readonly string[]) => string
}): Preparation | { ok: false; reason: 'random-target-unavailable' | 'random-target-pool-changed' } {
  const stored = input.map.tokens.find(token => token.id === input.actorTokenId)?.dnd5eCombatState
  const gate = stored?.slowSpellGate
  const pending = gate?.delayed && gate.intent.kind === 'monster-core' ? gate.intent.spell : stored?.slowDelayedMonsterSpell?.intent
  if (pending && pending.spellId === input.spellId && pending.slotLevel === input.slotLevel) {
    const resumed = prepareDnd5eMonsterCoreSpell({ ...input, targetTokenIds: pending.targetTokenIds })
    if (resumed.ok) resumed.prepared.randomizedProjectileTargetIds = pending.projectileTargetIds
    return resumed
  }
  const initial = prepareDnd5eMonsterCoreSpell(input)
  if (!initial.ok) return initial
  const ready = initial.prepared
  if (ready.spell.area || !dnd5eActiveRandomizesVisibleCreatureTargets(ready.state.combatants[ready.actorToken.id]?.classState.activeEffects)) return initial
  const projectiles = ready.spell.effect === 'automatic-damage'
  const requested = projectiles ? input.projectileTargetIds : ready.targetTokens.map(token => token.id)
  if (!requested || (projectiles && (requested.length !== ready.diceCount || requested.some(id => !input.targetTokenIds.includes(id))))) return { ok: false, reason: 'invalid-target' }
  const selected: string[] = []
  const prepare = (ids: string[]) => prepareDnd5eMonsterCoreSpell({ ...input, targetTokenIds: [...new Set(ids)] })
  for (const [occurrence, targetId] of requested.entries()) {
    if (targetId === ready.actorToken.id) { selected.push(targetId); continue }
    const candidates = input.map.tokens.flatMap(token => {
      if (token.id === ready.actorToken.id || token.type === 'obstacle' || (!projectiles && selected.includes(token.id))) return []
      const trial = prepare([...selected, token.id])
      return trial.ok && dnd5eCombatantCanSee(trial.prepared.state, ready.actorToken.id, token.id) ? [token.id] : []
    })
    if (!candidates.length) return { ok: false, reason: 'random-target-unavailable' }
    let chosen: string
    try { chosen = input.chooseRandomTarget(occurrence, candidates) }
    catch { return { ok: false, reason: 'random-target-pool-changed' } }
    if (!candidates.includes(chosen)) return { ok: false, reason: 'random-target-unavailable' }
    selected.push(chosen)
  }
  const final = prepare(selected)
  if (final.ok && projectiles) final.prepared.randomizedProjectileTargetIds = selected
  return final
}


/** Persist the authoritative choices rather than the tactical planner's original targets. */
export function dnd5eMonsterSpellIntentWithPreparedTargets(
  intent: NonNullable<Dnd5eMonsterTurnPlan['spellCast']>, prepared: PreparedDnd5eMonsterCoreSpell,
): NonNullable<Dnd5eMonsterTurnPlan['spellCast']> {
  return { ...intent, targetTokenIds: prepared.targetTokens.map(token => token.id),
    projectileTargetIds: prepared.randomizedProjectileTargetIds ?? intent.projectileTargetIds }
}
