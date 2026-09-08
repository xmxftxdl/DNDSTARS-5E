import { describe, expect, it } from 'vitest'
import { completeManualMonsterAction } from './completeManualMonsterAction'

describe('completeManualMonsterAction', () => {
  it('clears the action lock and ends combat after lethal damage', () => {
    const events: string[] = []

    expect(completeManualMonsterAction({
      clearPendingAction: () => events.push('clear-pending-action'),
      hasCombatOutcome: () => true,
      endCombatIfNeeded: () => events.push('end-combat'),
    })).toBe('combat-ended')

    expect(events).toEqual(['clear-pending-action', 'end-combat'])
  })

  it('clears the action lock and returns control to the DM after a nonlethal action', () => {
    const events: string[] = []

    expect(completeManualMonsterAction({
      clearPendingAction: () => events.push('clear-pending-action'),
      hasCombatOutcome: () => false,
      endCombatIfNeeded: () => events.push('end-combat'),
    })).toBe('ready')

    expect(events).toEqual(['clear-pending-action'])
  })
})
