import { expect, it } from 'vitest'
import { resourceBalanceAfterRest, validateResourceRestRecovery } from './resourceRestRecovery'

it.each([null, [], {}, { dawn: { mode: 'set', amount: 1 } },
  { 'short-rest': { mode: 'set', amount: -1 } },
  { 'short-rest': { mode: 'restore', amount: 0.5 } },
  { 'long-rest': { mode: 'restore', amount: 1, onlyWhenEmpty: 'yes' } },
  { 'long-rest': { mode: 'restore', amount: 1, extra: true } },
])('rejects malformed recovery policy %j', policy => {
  expect(() => validateResourceRestRecovery(policy)).toThrow()
})

it('distinguishes exact reset, partial restoration and empty-only recovery', () => {
  expect(resourceBalanceAfterRest(4, 5, { mode: 'set', amount: 1 })).toBe(1)
  expect(resourceBalanceAfterRest(4, 5, { mode: 'restore', amount: 3 })).toBe(5)
  expect(resourceBalanceAfterRest(2, 5, { mode: 'restore', amount: 1, onlyWhenEmpty: true })).toBe(2)
  expect(resourceBalanceAfterRest(0, 5, { mode: 'restore', amount: 1, onlyWhenEmpty: true })).toBe(1)
})
