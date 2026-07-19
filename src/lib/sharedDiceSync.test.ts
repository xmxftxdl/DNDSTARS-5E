import { describe, expect, it } from 'vitest'
import type { DiceRoll } from '../components/DiceRollOverlay'
import type { SharedDiceState } from './sharedCombatTypes'
import { resolveSharedDiceEventApply } from './sharedDiceSync'

const roll: DiceRoll = {
  values: [4],
  sides: 6,
  bonus: 2,
  total: 6,
  label: '1D6',
  targetName: 'target',
}

function state(patch: Partial<SharedDiceState> = {}): SharedDiceState {
  return {
    id: 'dice-1',
    mapId: 'map-1',
    sourceMode: 'dm',
    status: 'result',
    roll,
    updatedAt: 1000,
    ...patch,
  }
}

describe('shared dice sync', () => {
  it('applies a fresh result from the other endpoint', () => {
    const decision = resolveSharedDiceEventApply({
      state: state(),
      mapId: 'map-1',
      mode: 'player',
      now: 1200,
      seenIds: new Set(),
    })

    expect(decision).toEqual({ status: 'apply', id: 'dice-1', roll })
  })

  it('ignores stale, same-source, rolling, seen, and missing-roll events', () => {
    const base = {
      mapId: 'map-1',
      mode: 'player' as const,
      now: 62001,
      seenIds: new Set<string>(),
      maxAgeMs: 60000,
    }
    expect(resolveSharedDiceEventApply({ ...base, state: state({ updatedAt: 1 }) })).toEqual({
      status: 'ignored',
      reason: 'stale',
    })
    expect(
      resolveSharedDiceEventApply({ ...base, now: 1200, state: state({ sourceMode: 'player' }) }),
    ).toEqual({ status: 'ignored', reason: 'same-source' })
    expect(
      resolveSharedDiceEventApply({ ...base, now: 1200, state: state({ status: 'rolling' }) }),
    ).toEqual({ status: 'ignored', reason: 'rolling' })
    expect(
      resolveSharedDiceEventApply({ ...base, now: 1200, state: state({ visibility: 'dm' }) }),
    ).toEqual({ status: 'ignored', reason: 'private-roll' })
    expect(
      resolveSharedDiceEventApply({
        ...base,
        now: 1200,
        state: state(),
        seenIds: new Set(['dice-1']),
      }),
    ).toEqual({ status: 'ignored', reason: 'seen' })
    expect(
      resolveSharedDiceEventApply({ ...base, now: 1200, state: state({ roll: undefined }) }),
    ).toEqual({ status: 'ignored', reason: 'missing-roll' })
  })

  it('ignores missing or wrong-map state', () => {
    expect(
      resolveSharedDiceEventApply({
        state: null,
        mapId: 'map-1',
        mode: 'player',
        now: 1200,
        seenIds: new Set(),
      }),
    ).toEqual({ status: 'ignored', reason: 'missing-state' })

    expect(
      resolveSharedDiceEventApply({
        state: state({ mapId: 'other-map' }),
        mapId: 'map-1',
        mode: 'player',
        now: 1200,
        seenIds: new Set(),
      }),
    ).toEqual({ status: 'ignored', reason: 'wrong-map' })
  })
})
