import { expect, it } from 'vitest'
import { diceCheckAwaitsSettlement } from './diceCheckSettlement'

it('holds a check until its local or mirrored dice complete', () => {
  expect(diceCheckAwaitsSettlement('attack', ['attack'])).toBe(true)
  expect(diceCheckAwaitsSettlement('attack', ['attack:player-authority'])).toBe(true)
  expect(diceCheckAwaitsSettlement('attack', ['attack:supplement'])).toBe(true)
  expect(diceCheckAwaitsSettlement('attack', [])).toBe(false)
})
it('waits for a queued player roll, without blocking on unrelated damage or another player', () => {
  expect(diceCheckAwaitsSettlement('second', ['first', 'second:player-authority'])).toBe(true)
  expect(diceCheckAwaitsSettlement('first', ['second:player-authority', 'damage'])).toBe(false)
  expect(diceCheckAwaitsSettlement('attack', ['attack-2', 'attack:dm-confirmed'])).toBe(false)
  expect(diceCheckAwaitsSettlement(undefined, ['damage'])).toBe(false)
})
