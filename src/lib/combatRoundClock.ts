import { validCombatRoundCredits } from '../../shared/combat-round-credits.mjs'
/** Persist this cursor with the combat commit, including commits below one minute. */
export interface CombatRoundClockCursor {
  combatId: string
  round: number
  pendingRounds: number
  pendingRoundCredits?: Record<string, number>
}

export interface CombatRoundClockState {
  combatId?: string
  active?: boolean
  round?: number
}

/**
 * Count observed completed rounds, not turns, dice or wall-clock time.
 * A round reset/jump establishes a new baseline: changing the tracker is not
 * evidence that its skipped turns and their timed effects were actually settled.
 */
export function planCombatRoundClock(input: {
  before: CombatRoundClockState | undefined
  after: CombatRoundClockState
  cursor: CombatRoundClockCursor | undefined
  roundParticipantKeys?: readonly string[]
}): { cursor: CombatRoundClockCursor; elapsedRounds: number; elapsedMinutes: number; combatRoundCredits?: Record<string, number> } | undefined {
  const { before, after, cursor } = input
  if (!after.combatId || !Number.isSafeInteger(after.round) || after.round! < 1) return undefined
  if (cursor && (!Number.isSafeInteger(cursor.pendingRounds) || cursor.pendingRounds < 0 || cursor.pendingRounds > 9 || !validCombatRoundCredits(cursor.pendingRoundCredits, cursor.pendingRounds) ||
    !Number.isSafeInteger(cursor.round) || cursor.round < 1 || !cursor.combatId)) return undefined
  const pending = cursor?.pendingRounds ?? 0
  // Same committed cursor makes a retry/reload inert even if the caller retains
  // its original before snapshot. The surrounding write must still use CAS.
  if (cursor?.combatId === after.combatId && cursor.round === after.round) {
    return { cursor, elapsedRounds: 0, elapsedMinutes: 0 }
  }
  const continuous = before?.active === true && after.active === true && before.combatId === after.combatId &&
    Number.isSafeInteger(before.round) && after.round === before.round! + 1 &&
    (!cursor || (cursor.combatId === before.combatId && cursor.round === before.round))
  const elapsedRounds = continuous ? 1 : 0
  const accumulated = pending + elapsedRounds
  const credits = { ...cursor?.pendingRoundCredits }
  if (elapsedRounds) for (const key of new Set(input.roundParticipantKeys ?? [])) {
    credits[key] = (credits[key] ?? 0) + elapsedRounds
  }
  if (!validCombatRoundCredits(credits, accumulated)) return undefined
  return {
    ...(accumulated >= 10 ? { combatRoundCredits: credits } : {}),
    cursor: { combatId: after.combatId, round: after.round!, pendingRounds: accumulated % 10, pendingRoundCredits: accumulated >= 10 ? {} : credits },
    elapsedRounds,
    elapsedMinutes: Math.floor(accumulated / 10),
  }
}
