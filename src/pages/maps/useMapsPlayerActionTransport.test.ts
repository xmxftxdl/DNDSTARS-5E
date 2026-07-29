import { describe, expect, it, vi } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { drainDmPlayerActionQueue, playerActionRejectionNotice } from './useMapsPlayerActionTransport'

function action(id: string): SharedPlayerActionState {
  return {
    id,
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'end-turn',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1,
  }
}

describe('DM player action drain', () => {
  it('updates the processed-id projection before dispatching queued actions in order', async () => {
    const calls: string[] = []
    const handled = await drainDmPlayerActionQueue({
      mapId: 'map-1',
      combatId: 'combat-1',
      processedActionIds: new Set(['done']),
      loadProcessed: async () => ({
        mapId: 'map-1', combatId: 'combat-1', actionIds: ['done', 'remote-done'], updatedAt: 2,
      }),
      loadQueue: async () => ({
        mapId: 'map-1', combatId: 'combat-1', requests: [action('done'), action('next-1'), action('next-2')], updatedAt: 3,
      }),
      loadLatestAction: async () => null,
      onProcessedActionIds: (ids) => calls.push(`processed:${[...ids].sort().join(',')}`),
      onAction: async (item) => { calls.push(`action:${item.id}`) },
    })

    expect(handled).toBe(2)
    expect(calls).toEqual([
      'processed:done,remote-done',
      'action:next-1',
      'action:next-2',
    ])
  })

  it('stops dispatching when its page lifecycle is cancelled', async () => {
    let cancelled = false
    const onAction = vi.fn(async () => { cancelled = true })
    const handled = await drainDmPlayerActionQueue({
      mapId: 'map-1',
      combatId: 'combat-1',
      processedActionIds: new Set(),
      loadProcessed: async () => null,
      loadQueue: async () => ({
        mapId: 'map-1', combatId: 'combat-1', requests: [action('first'), action('second')], updatedAt: 2,
      }),
      loadLatestAction: async () => null,
      onProcessedActionIds: vi.fn(),
      onAction,
      isCancelled: () => cancelled,
    })

    expect(handled).toBe(1)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'first', sourceMode: 'player' }))
  })
})

describe('player action rejection notice', () => {
  it('explains ammunition rejection without hiding the authoritative result', () => {
    expect(playerActionRejectionNotice('ammunition-unavailable')).toEqual({
      title: '弹药不足',
      message: '当前武器没有可用弹药，本次攻击未结算。',
    })
  })

  it('keeps unknown rejection reasons visible for diagnosis', () => {
    expect(playerActionRejectionNotice('future-authority-rule')).toEqual({
      title: '行动被拒绝',
      message: 'DM 权威结算拒绝了这次行动（future-authority-rule），本次行动未结算。',
    })
  })

  it('explains why a spell was rejected instead of collapsing every failure into spell unavailable', () => {
    expect(playerActionRejectionNotice('spell-not-known-or-prepared')).toEqual({
      title: '尚未学习或准备',
      message: '当前角色未学习该戏法，或该法术未被当前施法职业学习并准备，本次施法未结算。',
    })
    expect(playerActionRejectionNotice('spell-definition-unavailable')).toEqual({
      title: '法术尚未接入',
      message: '该法术没有可用的 Headless 定义，或当前房间规则包未提供它，本次施法未结算。',
    })
  })
})
