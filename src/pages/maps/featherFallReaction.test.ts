import { describe, expect, it } from 'vitest'
import { dnd5eForcedFallInterruptTransactionScope } from './featherFallReaction'

describe('dnd5eForcedFallInterruptTransactionScope', () => {
  it('keeps an enclosing action transaction stable for every fall in that action', () => {
    expect(dnd5eForcedFallInterruptTransactionScope({
      activeTransactionId: 'monster-strike:current:interrupt:1',
      combatId: 'combat',
      occurrenceId: 'ignored',
    })).toBe('monster-strike:current:interrupt:1')
  })

  it('creates a distinct scope for separate monster on-hit falls without an enclosing transaction', () => {
    const first = dnd5eForcedFallInterruptTransactionScope({
      combatId: 'combat',
      occurrenceId: 'fall-1',
    })
    const second = dnd5eForcedFallInterruptTransactionScope({
      combatId: 'combat',
      occurrenceId: 'fall-2',
    })

    expect(first).toBe('combat:forced-fall:fall-1')
    expect(second).toBe('combat:forced-fall:fall-2')
    expect(second).not.toBe(first)
  })
})
