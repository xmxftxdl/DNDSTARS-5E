import { expect, it } from 'vitest'
import { dnd5eCancelledCriticalDice } from './cancelledCriticalDice'

it('retains ordered normal dice without mutating the submitted critical pool', () => {
  const rolls = [2, 4, 5, 6]
  expect(dnd5eCancelledCriticalDice(rolls, 2, 6, true)).toEqual([2, 4])
  expect(rolls).toEqual([2, 4, 5, 6])
  expect(dnd5eCancelledCriticalDice([2, 4], 2, 6, true)).toEqual([2, 4])
  expect(dnd5eCancelledCriticalDice(rolls, 2, 6, false)).toBe(rolls)
  expect(dnd5eCancelledCriticalDice([], 0, 6, true)).toEqual([])
})
it.each([[3, 99], [3, 0], [3, 1.5], [3, NaN], [], [3, 4, 5]])('rejects malformed or surplus dice %j', (...rolls) => {
  expect(() => dnd5eCancelledCriticalDice(rolls, 1, 6, true)).toThrow()
})
