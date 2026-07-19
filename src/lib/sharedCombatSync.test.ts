import { describe, expect, it } from 'vitest'
import type { SharedCombatState } from './sharedCombatTypes'
import {
  migrateLegacyApSharedCombatState,
  reconcileDnd5eTurnEconomy,
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
    updatedAt: 1000,
    ...patch,
  }
}

describe('shared combat sync', () => {
  it('physically removes the retired enemy AP ledger from a persisted snapshot', () => {
    const legacy = {
      ...makeState(),
      enemyApByToken: { 'enemy-token': { current: 1, max: 2 } },
    } as SharedCombatState

    const migrated = migrateLegacyApSharedCombatState(legacy)

    expect(migrated.removedLegacyAp).toBe(true)
    expect(JSON.stringify(migrated.state)).not.toContain('enemyApByToken')
    expect(migrateLegacyApSharedCombatState(migrated.state)).toEqual({
      state: migrated.state,
      removedLegacyAp: false,
    })
  })

  it('shares D&D turn economy and filters removed tokens', () => {
    const economy = {
      turnKey: 'combat-1:2:hero-token',
      attacksUsed: 1,
      action: { current: 0, max: 1 },
      bonusAction: { current: 1, max: 1 },
      reaction: { current: 1, max: 1 },
      objectInteraction: { current: 1, max: 1 },
      movement: { current: 20, max: 30 },
    }
    expect(reconcileDnd5eTurnEconomy(
      { 'hero-token': economy, removed: economy },
      {},
      new Set(['hero-token']),
    )).toEqual({ 'hero-token': economy })
  })

  it('normalizes a shared combat snapshot for the local map', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState({ initiativeIndex: 9 }),
      mapId: 'map-1',
      validTokenIds: ['hero-token'],
      currentCombatId: 'combat-old',
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
      expect(decision.combatChanged).toBe(true)
      expect(decision.shouldResetPlayerActionState).toBe(true)
      expect(decision.playerCombatEndedLocked).toBe(false)
      expect(decision.settlementMode).toBe('automatic')
    }
  })

  it('migrates legacy turn snapshots with a fresh object interaction', () => {
    const legacy = {
      turnKey: 'combat-1:2:hero-token', attacksUsed: 0,
      action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 },
      reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
    }
    expect(reconcileDnd5eTurnEconomy(
      { 'hero-token': legacy }, {}, new Set(['hero-token']),
    )['hero-token'].objectInteraction).toEqual({ current: 1, max: 1 })
  })

  it('ignores wrong-map, empty-token-map, stale, and unchanged snapshots', () => {
    const state = makeState()
    expect(
      resolveSharedCombatStateApply({
        state: { ...state, mapId: 'other-map' },
        mapId: 'map-1',
        validTokenIds: ['hero-token'],
        currentCombatId: 'combat-1',
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
