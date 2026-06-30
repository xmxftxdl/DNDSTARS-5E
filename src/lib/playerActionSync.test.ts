import { describe, expect, it } from 'vitest'
import {
  buildPlayerActionRequestQueueState,
  buildSharedPlayerAction,
  isAuthoritativeActionSnapshotReady,
  queuedPlayerActionsForDm,
  resolvePlayerActionAckDecision,
  shouldClearPendingPlayerActionAfterAck,
  waitForAuthoritativeActionSnapshot,
} from './playerActionSync'

describe('player action sync barrier', () => {
  it('is ready when no authoritative appliedAt barrier is provided', () => {
    expect(isAuthoritativeActionSnapshotReady(undefined, undefined, undefined)).toBe(true)
  })

  it('waits until both maps and characters reach the DM appliedAt watermark', () => {
    expect(isAuthoritativeActionSnapshotReady(1000, 1000, 999)).toBe(false)
    expect(isAuthoritativeActionSnapshotReady(1000, 999, 1000)).toBe(false)
    expect(isAuthoritativeActionSnapshotReady(1000, 1000, 1000)).toBe(true)
    expect(isAuthoritativeActionSnapshotReady(1000, 1200, 1100)).toBe(true)
  })

  it('builds canonical player and DM action envelopes', () => {
    expect(
      buildSharedPlayerAction({
        mapId: 'map-1',
        combatId: 'combat-1',
        sourceMode: 'player',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 2,
        initiativeIndex: 1,
        seq: 7,
        now: 1234,
        patch: { type: 'move-token', targetPosition: { x: 10, y: 20 } },
      }),
    ).toMatchObject({
      id: 'map-1:player-action:1234:7',
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      status: 'pending',
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 10, y: 20 },
      round: 2,
      initiativeIndex: 1,
      seq: 7,
      updatedAt: 1234,
    })

    expect(
      buildSharedPlayerAction({
        mapId: 'map-1',
        sourceMode: 'dm',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 1,
        initiativeIndex: 0,
        seq: 1,
        now: 99,
        patch: { type: 'end-turn' },
      }).id,
    ).toBe('map-1:dm-action:99:1')
  })

  it('merges queued player action requests without replaying duplicates or stale combat actions', () => {
    const action = buildSharedPlayerAction({
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 4,
      now: 4000,
      patch: { type: 'end-turn' },
    })
    const oldLive = { ...action, id: 'old-live', seq: 1, updatedAt: 1000 }
    const staleCombat = { ...action, id: 'stale-combat', combatId: 'combat-old', seq: 2, updatedAt: 2000 }
    const duplicate = { ...action, seq: 3, updatedAt: 3000 }

    const queue = buildPlayerActionRequestQueueState({
      action,
      current: {
        mapId: 'map-1',
        combatId: 'combat-1',
        requests: [oldLive, staleCombat, duplicate],
        updatedAt: 3000,
      },
      updatedAt: 5000,
    })

    expect(queue.requests.map((item) => item.id)).toEqual(['old-live', action.id])
    expect(queue.updatedAt).toBe(5000)
  })

  it('returns queued DM actions in deterministic order and skips processed ids', () => {
    const base = {
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player' as const,
      status: 'pending' as const,
      type: 'end-turn' as const,
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
    }
    const queued = queuedPlayerActionsForDm({
      mapId: 'map-1',
      combatId: 'combat-1',
      processedActionIds: new Set(['done']),
      queue: {
        mapId: 'map-1',
        combatId: 'combat-1',
        updatedAt: 5000,
        requests: [
          { ...base, id: 'late', seq: 2, updatedAt: 2000 },
          { ...base, id: 'done', seq: 1, updatedAt: 1000 },
          { ...base, id: 'early', seq: 1, updatedAt: 1000 },
          { ...base, id: 'other-map', mapId: 'map-2', seq: 3, updatedAt: 3000 },
        ],
      },
    })

    expect(queued.map((action) => action.id)).toEqual(['early', 'late'])
  })

  it('decides whether a player ack should be consumed by the current pending action', () => {
    const ack = {
      id: 'ack-1',
      mapId: 'map-1',
      combatId: 'combat-1',
      actionId: 'action-1',
      status: 'accepted' as const,
      appliedAt: 1234,
      round: 1,
      initiativeIndex: 0,
      updatedAt: 1234,
    }

    expect(
      resolvePlayerActionAckDecision({
        ack: null,
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({ status: 'ignored' })

    expect(
      resolvePlayerActionAckDecision({
        ack: { ...ack, mapId: 'other-map' },
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({ status: 'ignored' })

    expect(
      resolvePlayerActionAckDecision({
        ack,
        mapId: 'map-1',
        seenAckIds: new Set(['ack-1']),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({ status: 'ignored' })

    expect(
      resolvePlayerActionAckDecision({
        ack,
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'other-action' },
      }),
    ).toEqual({ status: 'ignored', markSeenAckId: 'ack-1' })

    expect(
      resolvePlayerActionAckDecision({
        ack,
        mapId: 'map-1',
        seenAckIds: new Set(),
        pendingAction: { id: 'action-1' },
      }),
    ).toEqual({
      status: 'handle',
      markSeenAckId: 'ack-1',
      actionId: 'action-1',
      waitForAppliedAt: 1234,
    })
  })

  it('does not wait for authoritative snapshots on rejected acks but still clears matching pending action', () => {
    const decision = resolvePlayerActionAckDecision({
      ack: {
        id: 'ack-2',
        mapId: 'map-1',
        actionId: 'action-2',
        status: 'rejected',
        reason: 'stale-turn',
        round: 1,
        initiativeIndex: 0,
        updatedAt: 2000,
      },
      mapId: 'map-1',
      seenAckIds: new Set(),
      pendingAction: { id: 'action-2' },
    })

    expect(decision).toEqual({
      status: 'handle',
      markSeenAckId: 'ack-2',
      actionId: 'action-2',
      waitForAppliedAt: undefined,
    })
    expect(shouldClearPendingPlayerActionAfterAck({ id: 'action-2' }, 'action-2')).toBe(true)
    expect(shouldClearPendingPlayerActionAfterAck({ id: 'other' }, 'action-2')).toBe(false)
  })

  it('waits for authoritative snapshots before resolving', async () => {
    let now = 0
    let mapsUpdatedAt = 0
    let charactersUpdatedAt = 0
    let sleeps = 0

    await waitForAuthoritativeActionSnapshot({
      appliedAt: 100,
      now: () => now,
      pollMs: 10,
      timeoutMs: 100,
      loadMapsUpdatedAt: async () => mapsUpdatedAt,
      loadCharactersUpdatedAt: async () => charactersUpdatedAt,
      sleep: async (ms) => {
        sleeps += 1
        now += ms
        if (sleeps === 2) {
          mapsUpdatedAt = 100
          charactersUpdatedAt = 100
        }
      },
    })

    expect(sleeps).toBe(2)
  })
})
