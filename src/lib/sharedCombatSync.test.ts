import { describe, expect, it } from 'vitest'
import type { SharedCombatState } from './sharedCombatTypes'
import {
  migrateLegacyApSharedCombatState,
  reconcileDnd5eTurnEconomy,
  resolveSharedCombatStateApply,
} from './sharedCombatSync'
import { createDnd5eMonsterTurnProgress } from './monsterTurnProgress'

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
      isDm: true,
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
      expect(decision.monsterControl).toMatchObject({
        schemaVersion: 1,
        mode: 'automatic',
        pauseRequested: false,
      })
      expect(decision.flowPause).toBeUndefined()
    }
  })

  it('projects a valid room-wide DM adjudication pause and rejects malformed pause metadata', () => {
    const resolve = (flowPause: SharedCombatState['flowPause']) => resolveSharedCombatStateApply({
      state: makeState({ flowPause }),
      mapId: 'map-1',
      validTokenIds: ['hero-token', 'enemy-token'],
      currentCombatId: 'combat-1',
      lastAppliedCombatId: '',
      lastAppliedUpdatedAt: 0,
      lastSnapshot: '',
      isDm: false,
    })
    const valid = resolve({
      schemaVersion: 1,
      reason: 'dm-adjudication',
      phase: 'awaiting-resume',
      interruptId: 'dm-adjudication:table-result-50',
      label: '施法后随机表结果 50',
      pausedAt: 1_000,
      resolvedAt: 1_100,
    })
    expect(valid.status).toBe('apply')
    if (valid.status === 'apply') {
      expect(valid.flowPause).toMatchObject({
        reason: 'dm-adjudication',
        phase: 'awaiting-resume',
        interruptId: 'dm-adjudication:table-result-50',
      })
    }

    const malformed = resolve({
      schemaVersion: 1,
      reason: 'dm-adjudication',
      phase: 'paused',
      pausedAt: 1_000,
    } as SharedCombatState['flowPause'])
    expect(malformed.status).toBe('apply')
    if (malformed.status === 'apply') expect(malformed.flowPause).toBeUndefined()
  })

  it('keeps a requested takeover automatic until the current event settles', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState({
        monsterControl: {
          schemaVersion: 1,
          mode: 'automatic',
          pauseRequested: true,
          controlledTokenId: 'enemy-token',
          requestedAt: 900,
          updatedAt: 900,
        },
      }),
      mapId: 'map-1',
      validTokenIds: ['hero-token', 'enemy-token'],
      currentCombatId: 'combat-1',
      lastAppliedCombatId: '',
      lastAppliedUpdatedAt: 0,
      lastSnapshot: '',
      isDm: false,
    })

    expect(decision.status).toBe('apply')
    if (decision.status === 'apply') {
      expect(decision.monsterControl).toMatchObject({
        mode: 'automatic',
        pauseRequested: true,
        controlledTokenId: 'enemy-token',
      })
    }
  })

  it('projects only a live progress lease owned by the current initiative slot', () => {
    const progress = createDnd5eMonsterTurnProgress({
      identity: {
        combatId: 'combat-1',
        round: 2,
        initiativeIndex: 1,
        initiativeSlotId: 'enemy-token',
        tokenId: 'enemy-token',
      },
      requestId: 'end-turn-1',
      now: 1_000,
    })
    const state = makeState({ initiativeIndex: 1, monsterTurnProgress: progress })
    const resolve = (now: number, patch: Partial<SharedCombatState> = {}) =>
      resolveSharedCombatStateApply({
        state: { ...state, ...patch },
        mapId: 'map-1',
        validTokenIds: ['hero-token', 'enemy-token'],
        currentCombatId: 'combat-1',
        lastAppliedCombatId: '',
        lastAppliedUpdatedAt: 0,
        lastSnapshot: '',
        isDm: false,
        now,
      })

    const current = resolve(2_000)
    expect(current.status).toBe('apply')
    if (current.status === 'apply') expect(current.monsterTurnProgress).toEqual(progress)

    const wrongTurn = resolve(2_000, { initiativeIndex: 0 })
    expect(wrongTurn.status).toBe('apply')
    if (wrongTurn.status === 'apply') expect(wrongTurn.monsterTurnProgress).toBeUndefined()

    const expired = resolveSharedCombatStateApply({
      state,
      mapId: 'map-1',
      validTokenIds: ['hero-token', 'enemy-token'],
      currentCombatId: 'combat-1',
      lastAppliedCombatId: 'combat-1',
      lastAppliedUpdatedAt: state.updatedAt,
      lastSnapshot: current.status === 'apply' ? current.snapshot : '',
      isDm: false,
      now: progress.expiresAt,
    })
    expect(expired.status).toBe('apply')
    if (expired.status === 'apply') expect(expired.monsterTurnProgress).toBeUndefined()
  })

  it('keeps player initiative slots when a projected edge token is temporarily absent', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState(),
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
      expect(decision.initiativeOrder.map((entry) => entry.tokenId))
        .toEqual(['hero-token', 'enemy-token'])
      expect(decision.active).toBe(true)
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
        isDm: true,
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
        isDm: true,
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

  it('accepts a rolled-back combat snapshot when its authority revision is newer', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState({
        updatedAt: 100,
        dnd5eTurnEconomyByToken: {
          'hero-token': {
            turnKey: 'combat-1:1:hero-token',
            attacksUsed: 0,
            action: { current: 1, max: 1 },
            bonusAction: { current: 1, max: 1 },
            reaction: { current: 1, max: 1 },
            objectInteraction: { current: 1, max: 1 },
            movement: { current: 30, max: 30 },
          },
        },
        _sync: { schemaVersion: 1, revision: 12, writerId: 'dm-undo:spell', writtenAt: 2_000 },
      }),
      mapId: 'map-1',
      validTokenIds: ['hero-token', 'enemy-token'],
      currentCombatId: 'combat-1',
      lastAppliedCombatId: 'combat-1',
      lastAppliedRevision: 11,
      lastAppliedUpdatedAt: 1_000,
      lastSnapshot: '',
      isDm: false,
    })

    expect(decision.status).toBe('apply')
    if (decision.status === 'apply') {
      expect(decision.incomingRevision).toBe(12)
      expect(decision.dnd5eTurnEconomyByToken['hero-token'].action.current).toBe(1)
      expect(decision.authorityRollback).toBe(true)
    }
  })

  it('does not mark an ordinary newer authority snapshot as a rollback', () => {
    const decision = resolveSharedCombatStateApply({
      state: makeState({
        updatedAt: 2_000,
        _sync: { schemaVersion: 1, revision: 12, writerId: 'dm:host:client', writtenAt: 2_000 },
      }),
      mapId: 'map-1',
      validTokenIds: ['hero-token', 'enemy-token'],
      currentCombatId: 'combat-1',
      lastAppliedCombatId: 'combat-1',
      lastAppliedRevision: 11,
      lastAppliedUpdatedAt: 1_000,
      lastSnapshot: '',
      isDm: true,
    })

    expect(decision.status).toBe('apply')
    if (decision.status === 'apply') expect(decision.authorityRollback).toBe(false)
  })

  it('rejects an older combat authority revision even when its domain timestamp is newer', () => {
    expect(resolveSharedCombatStateApply({
      state: makeState({
        updatedAt: 2_000,
        _sync: { schemaVersion: 1, revision: 10, writerId: 'stale-writer', writtenAt: 2_000 },
      }),
      mapId: 'map-1',
      validTokenIds: ['hero-token', 'enemy-token'],
      currentCombatId: 'combat-1',
      lastAppliedCombatId: 'combat-1',
      lastAppliedRevision: 11,
      lastAppliedUpdatedAt: 1_000,
      lastSnapshot: '',
      isDm: false,
    })).toEqual({ status: 'ignored', reason: 'stale' })
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
