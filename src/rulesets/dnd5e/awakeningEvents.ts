import type { Character } from '../../types/character'
import { effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eStandardConditionId } from './conditions'

/** Durable Host events awaiting Activity settlement; never inferred from UI labels. */
export interface Dnd5eAwakeningEvent {
  id: string
  characterId: string
  worldMinute: number
  sleepEffectIds: string[]
  sourceRulesIds: string[]
  /** Grant instances whose wake settlement committed atomically with this receipt. */
  consumedGrantEffectIds?: string[]
  eligibleGrantEffectIds?: string[]
}

const strings = (value: unknown): value is string[] => Array.isArray(value) &&
  value.every(entry => typeof entry === 'string' && entry.length > 0) && new Set(value).size === value.length
const eventId = (characterId: string, minute: number, ids: readonly string[]) =>
  JSON.stringify(['awakening', characterId, minute, [...ids].sort()])

export function normalizeDnd5eAwakeningEvents(value: unknown, characterId: string): Dnd5eAwakeningEvent[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) return undefined
  const events: Dnd5eAwakeningEvent[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || raw.characterId !== characterId ||
      !Number.isSafeInteger(raw.worldMinute) || raw.worldMinute < 0 ||
      !strings(raw.sleepEffectIds) || !raw.sleepEffectIds.length || !strings(raw.sourceRulesIds) ||
      (raw.consumedGrantEffectIds != null && !strings(raw.consumedGrantEffectIds)) ||
      (raw.eligibleGrantEffectIds != null && !strings(raw.eligibleGrantEffectIds)) ||
      raw.id !== eventId(characterId, raw.worldMinute, raw.sleepEffectIds) || events.some(event => event.id === raw.id)) return undefined
    events.push({ id: raw.id, characterId, worldMinute: raw.worldMinute,
      sleepEffectIds: [...raw.sleepEffectIds], sourceRulesIds: [...raw.sourceRulesIds],
      ...(raw.eligibleGrantEffectIds ? { eligibleGrantEffectIds: [...raw.eligibleGrantEffectIds] } : {}),
      ...(raw.consumedGrantEffectIds ? { consumedGrantEffectIds: [...raw.consumedGrantEffectIds] } : {}) })
  }
  return events
}

/** Host must commit this patch in the same transaction as the granted Activity. */
export function consumeDnd5eAwakeningEvent(character: Character, input: {
  eventId: string; grantEffectId: string; worldMinute: number
}): Character | undefined {
  if (!input.grantEffectId || !Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0 ||
    character.dnd5eWorldTimeAppliedMinute !== input.worldMinute) return undefined
  const events = normalizeDnd5eAwakeningEvents(character.dnd5eAwakeningEvents, character.id)
  const event = events?.find(entry => entry.id === input.eventId)
  if (!events || !event || event.worldMinute > input.worldMinute ||
    !event.eligibleGrantEffectIds?.includes(input.grantEffectId) ||
    event.consumedGrantEffectIds?.includes(input.grantEffectId)) return undefined
  return { ...character, dnd5eAwakeningEvents: events.map(entry => entry.id === event.id
    ? { ...entry, consumedGrantEffectIds: [...entry.consumedGrantEffectIds ?? [], input.grantEffectId] } : entry) }
}

/** Called by the Host clock reducer after natural timed-effect expiry. */
export function recordDnd5eTimedAwakening(before: Character, after: Character, elapsedMinutes: number): Character {
  const start = before.dnd5eWorldTimeAppliedMinute
  if (start == null || !Number.isSafeInteger(start) || start < 0 || !Number.isFinite(elapsedMinutes) ||
    elapsedMinutes <= 0 || after.currentHp <= 0 || after.deathSaveFailures === 3 ||
    after.conditions?.some(condition => dnd5eStandardConditionId(condition) === 'unconscious')) return after
  const remaining = new Set((after.dnd5eCombatState?.activeEffects ?? []).map(effect => effect.id))
  const ended = effectiveDnd5eActiveEffects(before.dnd5eCombatState?.activeEffects).filter(effect =>
    !remaining.has(effect.id) && effect.standardCondition === 'unconscious' &&
    (effect.breakOn?.includes('awakened') || effect.source.rulesId === 'sleep') &&
    effect.duration.type === 'rounds' && effect.duration.remainingRounds > 0 &&
    effect.duration.remainingRounds <= Math.floor(elapsedMinutes) * 10)
  if (!ended.length) return after
  const existing = normalizeDnd5eAwakeningEvents(after.dnd5eAwakeningEvents, after.id)
  if (after.dnd5eAwakeningEvents != null && !existing) return after
  const minute = start + Math.ceil(Math.max(...ended.map(effect =>
    effect.duration.type === 'rounds' ? effect.duration.remainingRounds : 0)) / 10)
  const ids = ended.map(effect => effect.id).sort()
  const id = eventId(after.id, minute, ids)
  if (existing?.some(event => event.id === id)) return after
  return { ...after, dnd5eAwakeningEvents: [...existing ?? [], {
    id, characterId: after.id, worldMinute: minute, sleepEffectIds: ids,
    sourceRulesIds: [...new Set(ended.flatMap(effect => effect.source.rulesId ? [effect.source.rulesId] : []))],
    eligibleGrantEffectIds: effectiveDnd5eActiveEffects(before.dnd5eCombatState?.activeEffects)
      .filter(effect => remaining.has(effect.id) && effect.source.pluginId && effect.grantedActivities?.length)
      .map(effect => effect.id),
  }] }
}
