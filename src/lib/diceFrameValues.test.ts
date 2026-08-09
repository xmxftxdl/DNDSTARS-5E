import { describe, expect, it } from 'vitest'
import { sameOrderedDiceValues } from './diceFrameValues'

describe('dice frame values', () => {
  it('treats each physical die as stable instead of comparing only the value multiset', () => {
    expect(sameOrderedDiceValues([1, 4], [1, 4])).toBe(true)
    expect(sameOrderedDiceValues([1, 4], [4, 1])).toBe(false)
    expect(sameOrderedDiceValues([1, 4], [4, 4])).toBe(false)
  })
})
