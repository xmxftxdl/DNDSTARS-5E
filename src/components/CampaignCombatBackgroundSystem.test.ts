import { afterEach, describe, expect, it } from 'vitest'
import {
  shouldConsumeBackgroundPlayerActionAck,
  shouldSilentlyConsumeDiceEvent,
} from '../lib/combatBackgroundAcknowledgement'
import { combatPlaybackIds, combatPlaybackScope, resetCombatPlaybackLedgersForTests } from '../lib/combatPlaybackLedger'
import type { SharedDiceState, SharedPlayerActionAckState } from '../lib/sharedCombatTypes'
import { resolveSharedDiceEventApply } from '../lib/sharedDiceSync'

afterEach(() => resetCombatPlaybackLedgersForTests())

function dice(overrides: Partial<SharedDiceState> = {}): SharedDiceState {
  return {
    id: 'dice-1',
    mapId: 'map-1',
    sourceMode: 'dm',
    status: 'result',
    roll: {
      values: [14],
      sides: 20,
      bonus: 3,
      total: 17,
      label: '攻击检定',
      targetName: '目标',
    },
    updatedAt: 1_000,
    ...overrides,
  }
}

describe('campaign combat background acknowledgements', () => {
  it('consumes a remote roll off-map so returning to Maps cannot replay it', () => {
    const scope = combatPlaybackScope({ roomId: 'ROOM01', memberId: 'player-1', mode: 'player' })
    const ids = combatPlaybackIds(scope, 'dice')
    const event = dice()

    expect(shouldSilentlyConsumeDiceEvent({ event, mode: 'player', now: 1_500, seenIds: ids })).toBe(true)
    ids.add(event.id)
    expect(shouldSilentlyConsumeDiceEvent({ event, mode: 'player', now: 1_500, seenIds: ids })).toBe(false)
    expect(resolveSharedDiceEventApply({
      state: event,
      mapId: 'map-1',
      mode: 'player',
      now: 1_500,
      seenIds: ids,
    })).toEqual({ status: 'ignored', reason: 'seen' })
  })

  it('consumes a rolling announcement before its terminal result arrives', () => {
    const ids = new Set<string>()
    const event = dice({ status: 'rolling', roll: undefined })
    expect(shouldSilentlyConsumeDiceEvent({ event, mode: 'player', now: 1_500, seenIds: ids })).toBe(true)
  })

  it('does not expose a DM-only roll to a player background endpoint', () => {
    expect(shouldSilentlyConsumeDiceEvent({
      event: dice({ visibility: 'dm' }),
      mode: 'player',
      now: 1_500,
      seenIds: new Set(),
    })).toBe(false)
  })

  it('accepts only action ACKs addressed to the current player', () => {
    const ack: SharedPlayerActionAckState = {
      id: 'ack-1',
      mapId: 'map-1',
      actionId: 'action-1',
      recipientMemberId: 'player-1',
      status: 'accepted',
      round: 1,
      initiativeIndex: 0,
      updatedAt: 1_000,
    }
    expect(shouldConsumeBackgroundPlayerActionAck({
      ack,
      roomMemberId: 'player-1',
      seenIds: new Set(),
    })).toBe(true)
    expect(shouldConsumeBackgroundPlayerActionAck({
      ack,
      roomMemberId: 'player-2',
      seenIds: new Set(),
    })).toBe(false)
  })
})
