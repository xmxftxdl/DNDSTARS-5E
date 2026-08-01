import { describe, expect, it, vi } from 'vitest'
import {
  createDnd5eMonsterControlState,
  requestDnd5eMonsterTakeover,
} from '../../lib/monsterControlState'
import {
  completeAutomatedMonsterAction,
  completeInterruptedMonsterMove,
  completeManualMonsterAction,
} from './completeAutomatedMonsterAction'

describe('completeAutomatedMonsterAction', () => {
  it('ends combat after a lethal settlement even when takeover is pending', () => {
    const events: string[] = []
    let automationOwner: string | null = 'combat:1:monster'
    let control = requestDnd5eMonsterTakeover(
      createDnd5eMonsterControlState('automatic', 10),
      {
        currentTokenId: 'monster',
        eventInFlight: true,
        now: 20,
      },
    )
    const stopAtSafePoint = vi.fn(() => {
      events.push('takeover')
      return true
    })

    expect(completeAutomatedMonsterAction({
      hasCombatOutcome: () => true,
      releaseAutomationOwner: () => {
        automationOwner = null
        events.push('release-owner')
      },
      endCombatIfNeeded: () => {
        control = createDnd5eMonsterControlState('automatic', 30)
        events.push('end-combat')
      },
      stopAtSafePoint,
      continueTurn: () => events.push('continue'),
    })).toBe('combat-ended')

    expect(events).toEqual(['release-owner', 'end-combat'])
    expect(automationOwner).toBeNull()
    expect(control).toMatchObject({
      mode: 'automatic',
      pauseRequested: false,
    })
    expect(control.controlledTokenId).toBeUndefined()
    expect(stopAtSafePoint).not.toHaveBeenCalled()
  })

  it('releases ownership when a nonlethal action reaches a requested takeover', () => {
    const events: string[] = []

    expect(completeAutomatedMonsterAction({
      hasCombatOutcome: () => false,
      releaseAutomationOwner: () => events.push('release-owner'),
      endCombatIfNeeded: () => events.push('end-combat'),
      stopAtSafePoint: () => {
        events.push('takeover')
        return true
      },
      continueTurn: () => events.push('continue'),
    })).toBe('stopped')

    expect(events).toEqual(['takeover', 'release-owner'])
  })

  it('continues only when combat is live and automation still owns the turn', () => {
    const events: string[] = []

    expect(completeAutomatedMonsterAction({
      hasCombatOutcome: () => false,
      releaseAutomationOwner: () => events.push('release-owner'),
      endCombatIfNeeded: () => events.push('end-combat'),
      stopAtSafePoint: () => false,
      continueTurn: () => events.push('continue'),
    })).toBe('continue')

    expect(events).toEqual(['continue'])
  })

  it('clears a manual action lock before ending combat after lethal damage', () => {
    const events: string[] = []

    expect(completeManualMonsterAction({
      clearPendingAction: () => events.push('clear-pending-action'),
      hasCombatOutcome: () => true,
      endCombatIfNeeded: () => events.push('end-combat'),
    })).toBe('combat-ended')

    expect(events).toEqual(['clear-pending-action', 'end-combat'])
  })

  it('ends combat instead of attempting takeover when movement settlement is terminal', () => {
    const events: string[] = []

    expect(completeInterruptedMonsterMove({
      hasCombatOutcome: () => true,
      actorAlive: false,
      releaseAutomationOwner: () => events.push('release-owner'),
      endCombatIfNeeded: () => events.push('end-combat'),
      completeTakeoverAtSafePoint: () => events.push('takeover'),
      settleDefeatedActorTurn: () => events.push('skip-dead-actor'),
      stopAtSafePoint: () => events.push('stop'),
    })).toBe('combat-ended')

    expect(events).toEqual(['release-owner', 'end-combat'])
  })

  it('releases the owner and advances a defeated actor when combat continues', () => {
    const events: string[] = []

    expect(completeInterruptedMonsterMove({
      hasCombatOutcome: () => false,
      actorAlive: false,
      releaseAutomationOwner: () => events.push('release-owner'),
      endCombatIfNeeded: () => events.push('end-combat'),
      completeTakeoverAtSafePoint: () => events.push('takeover'),
      settleDefeatedActorTurn: () => events.push('skip-dead-actor'),
      stopAtSafePoint: () => events.push('stop'),
    })).toBe('actor-defeated')

    expect(events).toEqual(['takeover', 'release-owner', 'skip-dead-actor'])
  })
})
