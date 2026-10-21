import { expect, it } from 'vitest'
import { planCombatRoundClock, type CombatRoundClockCursor } from './combatRoundClock'

it('accounts the 99 completed rounds before the hundredth casting turn, including reloads', () => {
  let cursor: CombatRoundClockCursor | undefined
  let minutes = 0
  for (let round = 1; round <= 100; round++) {
    const before = round === 1 ? undefined : { combatId: 'grove', active: true, round: round - 1 }
    const after = { combatId: 'grove', active: true, round }
    const result = planCombatRoundClock({ before, after, cursor })!
    minutes += result.elapsedMinutes
    cursor = JSON.parse(JSON.stringify(result.cursor))
    const retry = planCombatRoundClock({ before, after, cursor })!
    expect(retry.elapsedRounds).toBe(0)
    expect(retry.elapsedMinutes).toBe(0)
  }
  expect(minutes).toBe(9)
  expect(cursor?.pendingRounds).toBe(9)
})

it('preserves subminute elapsed time across combat exit and the next combat', () => {
  const cursor = { combatId: 'first', round: 10, pendingRounds: 9 }
  const ended = planCombatRoundClock({ before: { ...cursor, active: true }, after: { ...cursor, active: false }, cursor })!
  expect(ended.elapsedMinutes).toBe(0)
  const next = planCombatRoundClock({ before: { ...cursor, active: false }, after: { combatId: 'second', active: true, round: 1 }, cursor: ended.cursor })!
  expect(next.elapsedMinutes).toBe(0)
  const completed = planCombatRoundClock({ before: { combatId: 'second', active: true, round: 1 }, after: { combatId: 'second', active: true, round: 2 }, cursor: next.cursor })!
  expect(completed.elapsedMinutes).toBe(1)
  expect(completed.cursor.pendingRounds).toBe(0)
})

it.each([1, 4, 50])('does not count a tracker reset or jump to round %i as completed turns', round => {
  const cursor = { combatId: 'grove', round: 4, pendingRounds: 3 }
  const result = planCombatRoundClock({ before: { combatId: 'grove', active: true, round: 4 }, after: { combatId: 'grove', active: true, round }, cursor })!
  expect(result.elapsedRounds).toBe(0)
  expect(result.cursor.pendingRounds).toBe(3)
})

it('does not invent elapsed time from a stale cursor or malformed counter', () => {
  const before = { combatId: 'grove', active: true, round: 9 }
  const after = { ...before, round: 10 }
  expect(planCombatRoundClock({ before, after, cursor: { combatId: 'grove', round: 7, pendingRounds: 6 } })?.elapsedRounds).toBe(0)
  expect(planCombatRoundClock({ before, after, cursor: { combatId: 'grove', round: 9, pendingRounds: 10 } })).toBeUndefined()
})
