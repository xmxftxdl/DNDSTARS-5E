import type { DiceCheckOutcome } from './diceCheckOutcome'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'

/** Presentation-only correlation. Never participates in rule settlement. */
export function createDiceCheckCorrelation(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const key = 'astraltrace:dice-check-correlation:v1'
  type Entry = { scope: string; actorId: string; outcome: DiceCheckOutcome; matched?: boolean }
  const rolls = new Map<string, Entry>()
  const attachedEvents = new WeakMap<object, { scope: string; outcome: DiceCheckOutcome }>()
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? '[]')
    if (Array.isArray(saved)) for (const entry of saved.slice(-512)) {
      if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1]?.scope === 'string' &&
        typeof entry[1]?.actorId === 'string' && Array.isArray(entry[1]?.outcome?.values)) rolls.set(entry[0], entry[1])
    }
  } catch { /* Storage is optional. */ }
  const persist = () => {
    try { storage?.setItem(key, JSON.stringify([...rolls])) } catch { /* Retain in-memory correlation. */ }
  }
  return {
    record(scope: string | undefined, actorId: string | undefined, outcome: DiceCheckOutcome) {
      if (!scope || !actorId || !outcome.rollId || !outcome.values?.length) return
      rolls.set(outcome.rollId, { scope, actorId, outcome })
      while (rolls.size > 512) rolls.delete(rolls.keys().next().value!)
      persist()
    },
    attach(scope: string | undefined, event: Dnd5eCombatEvent, outcome: DiceCheckOutcome): DiceCheckOutcome {
      if (!scope || (event.type !== 'attack-resolved' && event.type !== 'saving-throw-resolved')) return outcome
      const attached = attachedEvents.get(event)
      if (attached?.scope === scope) return { ...attached.outcome,
        id: `${attached.outcome.rollId}:final:${outcome.success}`, success: outcome.success }
      const actorId = event.type === 'attack-resolved' ? event.actorId : event.targetId
      // New physical rolls win over retained matches; retained matches allow
      // repeated settlement events and refresh recovery to reuse the same cue.
      for (const [rollId, candidate] of [...rolls].sort((a, b) => Number(!!a[1].matched) - Number(!!b[1].matched))) {
        const preview = candidate.outcome
        const values = preview.values!
        const selected = preview.mode === 'advantage' ? Math.max(...values) : preview.mode === 'disadvantage' ? Math.min(...values) : values[0]
        if (candidate.scope !== scope || candidate.actorId !== actorId || preview.kind !== outcome.kind ||
            preview.targetName !== outcome.targetName || selected !== event.d20) continue
        candidate.matched = true
        persist()
        const linked = { ...outcome, id: `${rollId}:final:${outcome.success}`, rollId, mode: preview.mode, values: [...values] }
        attachedEvents.set(event, { scope, outcome: linked })
        return linked
      }
      return outcome
    },
  }
}
