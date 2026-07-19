import { describe, expect, it } from 'vitest'
import { shouldClearSelectedMapToken } from './mapTokenSelection'

describe('map token selection lifetime', () => {
  it('keeps a selected 0 HP token while it still exists on the map', () => {
    expect(shouldClearSelectedMapToken('defeated-monster', [{ id: 'defeated-monster' }])).toBe(false)
  })

  it('clears selection only after the token is removed', () => {
    expect(shouldClearSelectedMapToken('removed-monster', [{ id: 'other-token' }])).toBe(true)
    expect(shouldClearSelectedMapToken(null, [])).toBe(false)
  })
})
