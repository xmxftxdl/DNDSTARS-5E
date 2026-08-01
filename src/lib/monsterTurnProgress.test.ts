import { describe, expect, it } from 'vitest'
import {
  createDnd5eMonsterTurnProgress,
  isDnd5eMonsterTurnProgressV1,
  markDnd5eMonsterTurnPlanning,
  normalizeDnd5eMonsterTurnProgress,
  type Dnd5eMonsterTurnIdentity,
} from './monsterTurnProgress'

const identity: Dnd5eMonsterTurnIdentity = {
  combatId: 'combat-1',
  round: 2,
  initiativeIndex: 1,
  initiativeSlotId: 'enemy-slot',
  tokenId: 'enemy-token',
}

describe('monster turn progress', () => {
  it('creates a bounded starting lease and advances the same request to planning', () => {
    const starting = createDnd5eMonsterTurnProgress({
      identity,
      requestId: 'end-turn-1',
      now: 1_000,
    })

    expect(starting).toMatchObject({
      schemaVersion: 1,
      status: 'starting',
      ...identity,
      requestId: 'end-turn-1',
      startedAt: 1_000,
      updatedAt: 1_000,
      expiresAt: 61_000,
    })
    expect(markDnd5eMonsterTurnPlanning(starting, {
      requestId: 'end-turn-1',
      now: 2_000,
    })).toMatchObject({ status: 'planning', startedAt: 1_000, updatedAt: 2_000 })
    expect(markDnd5eMonsterTurnPlanning(starting, {
      requestId: 'another-request',
      now: 2_000,
    })).toBeUndefined()
  })

  it('keeps only a valid marker for the active authoritative turn', () => {
    const progress = createDnd5eMonsterTurnProgress({
      identity,
      requestId: 'end-turn-1',
      now: 1_000,
    })

    expect(normalizeDnd5eMonsterTurnProgress(progress, {
      active: true,
      current: identity,
      now: 2_000,
    })).toEqual(progress)
    expect(normalizeDnd5eMonsterTurnProgress(progress, {
      active: true,
      current: { ...identity, initiativeIndex: 0 },
      now: 2_000,
    })).toBeUndefined()
    expect(normalizeDnd5eMonsterTurnProgress(progress, {
      active: false,
      current: identity,
      now: 2_000,
    })).toBeUndefined()
    expect(normalizeDnd5eMonsterTurnProgress(progress, {
      active: true,
      current: identity,
      now: progress.expiresAt,
    })).toBeUndefined()
  })

  it('rejects malformed or unbounded leases and accepts legacy absence', () => {
    const valid = createDnd5eMonsterTurnProgress({
      identity,
      requestId: 'end-turn-1',
      now: 1_000,
    })
    expect(isDnd5eMonsterTurnProgressV1(valid)).toBe(true)
    expect(isDnd5eMonsterTurnProgressV1({ ...valid, requestId: '' })).toBe(false)
    expect(isDnd5eMonsterTurnProgressV1({ ...valid, round: 0 })).toBe(false)
    expect(isDnd5eMonsterTurnProgressV1({ ...valid, expiresAt: valid.updatedAt })).toBe(false)
    expect(isDnd5eMonsterTurnProgressV1({
      ...valid,
      expiresAt: valid.updatedAt + 120_001,
    })).toBe(false)
    expect(normalizeDnd5eMonsterTurnProgress(undefined, {
      active: true,
      current: identity,
      now: 2_000,
    })).toBeUndefined()
  })
})
