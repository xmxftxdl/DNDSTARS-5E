import { describe, expect, it } from 'vitest'
import { advanceInitiative } from './InitiativeCoordinator'

describe('advanceInitiative', () => {
  it('advances without mutating the source order', () => {
    const order = [{ id: 'a' }, { id: 'b' }]
    const result = advanceInitiative({ order, index: 0, round: 1, reorderForRound: (value) => [...value] })
    expect(result).toMatchObject({ kind: 'advanced', index: 1, round: 1, wrapped: false, entry: { id: 'b' } })
    expect(order).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('reorders only when entering a new round', () => {
    const result = advanceInitiative({
      order: [{ id: 'a' }, { id: 'b' }],
      index: 1,
      round: 2,
      reorderForRound: (value) => [...value].reverse(),
    })
    expect(result).toMatchObject({ kind: 'advanced', index: 0, round: 3, wrapped: true, entry: { id: 'b' } })
  })
})
