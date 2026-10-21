import type { Character } from '../../types/character'
import { createDnd5eConditionEffect, effectiveDnd5eActiveEffects, projectDnd5eActiveEffectState } from './activeEffects'
import { dnd5eStandardConditionId } from './conditions'

/** Host-confirmed ordinary sleep. Magical-sleep immunity is deliberately not
 * used as a proxy for whether a creature sleeps. This does not grant a rest. */
export function beginDnd5eNaturalSleep(character: Character, input: {
  eventId: string; worldMinute: number; durationMinutes: number; canSleep: boolean
}): { ok: true; character: Character } | { ok: false; reason: string } {
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(input.eventId) || !Number.isSafeInteger(input.worldMinute) ||
    input.worldMinute < 0 || character.dnd5eWorldTimeAppliedMinute !== input.worldMinute ||
    !Number.isSafeInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440) {
    return { ok: false, reason: 'invalid-sleep-session' }
  }
  if (input.canSleep !== true || character.currentHp <= 0 || (character.deathSaveFailures ?? 0) >= 3) {
    return { ok: false, reason: 'sleep-ineligible' }
  }
  const effects = character.dnd5eCombatState?.activeEffects ?? []
  const id = `natural-sleep:${input.eventId}`
  if (effects.some(effect => effect.id === id) || character.conditions?.some(condition =>
    dnd5eStandardConditionId(condition) === 'unconscious') || effectiveDnd5eActiveEffects(effects).some(effect =>
      effect.standardCondition === 'unconscious')) return { ok: false, reason: 'already-unconscious' }
  // Stable session identity prevents a second start from extending existing sleep.
  const effect = createDnd5eConditionEffect({ id, condition: 'unconscious', targetId: character.id,
    source: { kind: 'system', rulesId: 'natural-sleep', magical: false },
    duration: { type: 'rounds', remainingRounds: input.durationMinutes * 10, tickOn: 'target-turn-end' },
    breakOn: ['awakened', 'takes-damage'] })
  const projection = projectDnd5eActiveEffectState([...effects, effect])
  return { ok: true, character: { ...character, conditions: projection.conditions,
    dnd5eCombatState: { ...character.dnd5eCombatState, activeEffects: projection.activeEffects } } }
}
