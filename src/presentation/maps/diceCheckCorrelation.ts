import type { DiceCheckOutcome } from './diceCheckOutcome'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'

/** Presentation-only correlation. Never participates in rule settlement. */
export function createDiceCheckCorrelation() {
  const rolls = new Map<string, { scope: string; actorId: string; outcome: DiceCheckOutcome }>()
  return {
    record(scope: string | undefined, actorId: string | undefined, outcome: DiceCheckOutcome) {
      if (!scope || !actorId || !outcome.rollId || !outcome.values?.length) return
      rolls.set(outcome.rollId, { scope, actorId, outcome })
      while (rolls.size > 512) rolls.delete(rolls.keys().next().value!)
    },
    attach(scope: string | undefined, event: Dnd5eCombatEvent, outcome: DiceCheckOutcome): DiceCheckOutcome {
      if (!scope || (event.type !== 'attack-resolved' && event.type !== 'saving-throw-resolved')) return outcome
      const actorId = event.type === 'attack-resolved' ? event.actorId : event.targetId
      for (const [rollId, candidate] of rolls) {
        const preview = candidate.outcome
        const values = preview.values!
        const selected = preview.mode === 'advantage' ? Math.max(...values) : preview.mode === 'disadvantage' ? Math.min(...values) : values[0]
        if (candidate.scope !== scope || candidate.actorId !== actorId || preview.kind !== outcome.kind ||
            preview.targetName !== outcome.targetName || selected !== event.d20) continue
        rolls.delete(rollId)
        return { ...outcome, id: `${rollId}:final`, rollId, mode: preview.mode, values: [...values] }
      }
      return outcome
    },
  }
}
