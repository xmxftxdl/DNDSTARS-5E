import { describe, expect, it } from 'vitest'
import type { SharedCombatState } from './sharedCombatTypes'
import {
  reconcileEnemyAp,
  resolveSharedCombatStateApply,
} from './sharedCombatSync'

function makeState(patch: Partial<SharedCombatState> = {}): SharedCombatState {
  return {
    mapId: 'map-1',
    combatId: 'combat-1',
    active: true,
    round: 2,
    initiativeIndex: 0,
    initiativeOrder: [
      { tokenId: 'hero-token', label: '英雄', emoji: 'H', color: '#34d399', roll: 15 },
      { tokenId: 'enemy-token', label: '敌人', emoji: 'E', color: '#ef4444', roll: 10 },
    ],
    enemyApByToken: { 'enemy-token': { current: 1, max: 2 } },
    updatedAt: 1000,
    ...patch,
  }
}

describe('shared combat sync', () => {
  it('keeps local enemy AP on torn reads and filters invalid tokens', () => {
    expect(
      reconcileEnemyAp(
        undefined,
        {
          'enemy-token': { current: 0, max: 2 },
          removed: { current: 2, max: 2 },
        },
        new Set(['enemy-token']),
      ),
    ).toEqual({ 'enemy-token': { current: 0, max: 2 } })
  })

  it('treats present enemy AP as authoritative even when empty', () => {
    expect(
      reconcileEnemyAp(
        {},
        { 'enemy-token': { current: 0, max: 2 } },
        new Set(['enemy-token']),
      ),
    ).toEqual({})
  })

  it('normalizes a shared combat snapshot for the local map', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState({ initiativeIndex: 9 }),
      mapId: 'map-1',
      validTokenIds: ['hero-token'],
      currentCombatId: 'combat-old',
      currentEnemyApByToken: {},
      lastAppliedCombatId: 'combat-old',
      lastAppliedUpdatedAt: 0,
      lastSnapshot: '',
      isDm: false,
    })

    expect(decision.status).toBe('apply')
    if (decision.status === 'apply') {
      expect(decision.active).toBe(true)
      expect(decision.initiativeOrder.map((entry) => entry.tokenId)).toEqual(['hero-token'])
      expect(decision.initiativeIndex).toBe(0)
      expect(decision.enemyApByToken).toEqual({})
      expect(decision.combatChanged).toBe(true)
      expect(decision.shouldResetPlayerActionState).toBe(true)
      expect(decision.playerCombatEndedLocked).toBe(false)
    }
  })

  it('ignores wrong-map, empty-token-map, stale, and unchanged snapshots', () => {
    const state = makeState()
    expect(
      resolveSharedCombatStateApply({
        state: { ...state, mapId: 'other-map' },
        mapId: 'map-1',
        validTokenIds: ['hero-token'],
        currentCombatId: 'combat-1',
        currentEnemyApByToken: {},
        lastAppliedCombatId: '',
        lastAppliedUpdatedAt: 0,
        lastSnapshot: '',
        isDm: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'wrong-map' })

    expect(
      resolveSharedCombatStateApply({
        state,
        mapId: 'map-1',
        validTokenIds: [],
        currentCombatId: 'combat-1',
        currentEnemyApByToken: {},
        lastAppliedCombatId: '',
        lastAppliedUpdatedAt: 0,
        lastSnapshot: '',
        isDm: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'empty-token-map' })

    expect(
      resolveSharedCombatStateApply({
        state: makeState({ updatedAt: 99 }),
        mapId: 'map-1',
        validTokenIds: ['hero-token', 'enemy-token'],
        currentCombatId: 'combat-1',
        currentEnemyApByToken: {},
        lastAppliedCombatId: 'combat-1',
        lastAppliedUpdatedAt: 100,
        lastSnapshot: '',
        isDm: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'stale' })

    const snapshot = JSON.stringify({ state, tokenIds: ['enemy-token', 'hero-token'] })
    expect(
      resolveSharedCombatStateApply({
        state,
        mapId: 'map-1',
        validTokenIds: ['hero-token', 'enemy-token'],
        currentCombatId: 'combat-1',
        currentEnemyApByToken: {},
        lastAppliedCombatId: 'combat-1',
        lastAppliedUpdatedAt: 1000,
        lastSnapshot: snapshot,
        isDm: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'unchanged' })
  })

  it('locks player combat UI when a non-DM receives an inactive combat snapshot', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState({ active: false, initiativeOrder: [] }),
      mapId: 'map-1',
      validTokenIds: ['hero-token'],
      currentCombatId: 'combat-1',
      currentEnemyApByToken: {},
      lastAppliedCombatId: '',
      lastAppliedUpdatedAt: 0,
      lastSnapshot: '',
      isDm: false,
    })

    expect(decision.status).toBe('apply')
    if (decision.status === 'apply') {
      expect(decision.active).toBe(false)
      expect(decision.shouldResetPlayerActionState).toBe(true)
      expect(decision.playerCombatEndedLocked).toBe(true)
    }
  })
})
