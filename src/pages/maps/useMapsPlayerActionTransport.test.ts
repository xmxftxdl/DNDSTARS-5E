import { describe, expect, it, vi } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { consumePlayerActionAck } from '../../lib/playerActionSync'
import {
  drainDmPlayerActionQueue,
  playerActionAckMustWaitForCombatReceipt,
  playerActionRejectionNotice,
  runExclusiveDmPlayerAction,
  syncPersistedAcceptedPlayerActionSnapshot,
} from './useMapsPlayerActionTransport'

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

describe('DM player action cross-tab authority lock', () => {
  it('lets only the tab that owns the action lock execute the rules engine', async () => {
    const onAction = vi.fn(async () => undefined)
    const lockManager = {
      request: vi.fn(async (_name: string, _options: unknown, callback: (lock: unknown | null) => Promise<boolean>) =>
        callback(null)),
    }

    await expect(runExclusiveDmPlayerAction({
      action: action('spell-1'),
      getProcessedActionIds: () => new Set(),
      loadProcessed: async () => null,
      onProcessedActionIds: vi.fn(),
      onAction,
      lockManager,
    })).resolves.toBe(false)

    expect(lockManager.request).toHaveBeenCalledWith(
      'astral-trace:dm-player-action:map-1:spell-1',
      { mode: 'exclusive', ifAvailable: true },
      expect.any(Function),
    )
    expect(onAction).not.toHaveBeenCalled()
  })

  it('rechecks durable processed ids after acquiring a delayed event lock', async () => {
    const onAction = vi.fn(async () => undefined)
    const onProcessedActionIds = vi.fn()
    const lockManager = {
      request: vi.fn(async (_name: string, _options: unknown, callback: (lock: unknown | null) => Promise<boolean>) =>
        callback({ name: 'owned' })),
    }

    await expect(runExclusiveDmPlayerAction({
      action: action('spell-1'),
      getProcessedActionIds: () => new Set(),
      loadProcessed: async () => ({
        mapId: 'map-1', combatId: 'combat-1', actionIds: ['spell-1'], updatedAt: 2,
      }),
      onProcessedActionIds,
      onAction,
      lockManager,
    })).resolves.toBe(false)

    expect(onProcessedActionIds).toHaveBeenCalledWith(new Set(['spell-1']))
    expect(onAction).not.toHaveBeenCalled()
  })

  it('executes once when it owns the lock and the action is still pending', async () => {
    const onAction = vi.fn(async () => undefined)
    const lockManager = {
      request: vi.fn(async (_name: string, _options: unknown, callback: (lock: unknown | null) => Promise<boolean>) =>
        callback({ name: 'owned' })),
    }

    await expect(runExclusiveDmPlayerAction({
      action: action('spell-1'),
      getProcessedActionIds: () => new Set(),
      loadProcessed: async () => ({
        mapId: 'map-1', combatId: 'combat-1', actionIds: [], updatedAt: 2,
      }),
      onProcessedActionIds: vi.fn(),
      onAction,
      lockManager,
    })).resolves.toBe(true)

    expect(onAction).toHaveBeenCalledOnce()
  })
})

describe('persisted player action ACK fallback', () => {
  it('keeps move/end-turn locked until their durable command receipt arrives', () => {
    const ack = {
      id: 'ack-command-1',
      mapId: 'map-1',
      actionId: 'command-1',
      status: 'accepted' as const,
      round: 1,
      initiativeIndex: 0,
      updatedAt: 10,
    }

    expect(playerActionAckMustWaitForCombatReceipt({
      ack,
      mapId: 'map-1',
      pendingActionId: 'command-1',
      isReceiptAuthoritativeAction: (actionId) => actionId === 'command-1',
    })).toBe(true)
    expect(playerActionAckMustWaitForCombatReceipt({
      ack,
      mapId: 'map-1',
      pendingActionId: 'legacy-action',
      isReceiptAuthoritativeAction: () => true,
    })).toBe(false)
  })

  it('loads combat after fallback sync and before unlocking an accepted action without revisions', async () => {
    const calls: string[] = []
    let pendingAction: { id: string; label?: string } | null = { id: 'action-1' }

    const result = await consumePlayerActionAck({
      ack: {
        id: 'ack-1',
        mapId: 'map-1',
        actionId: 'action-1',
        status: 'accepted',
        appliedAt: 1_234,
        round: 1,
        initiativeIndex: 1,
        updatedAt: 1_234,
      },
      mapId: 'map-1',
      seenAckIds: new Set(),
      getPendingAction: () => pendingAction,
      waitForAuthoritativeSync: async (appliedAt, authorityRevisions) => {
        expect(authorityRevisions).toBeUndefined()
        await syncPersistedAcceptedPlayerActionSnapshot({
          appliedAt,
          syncAuthoritativeState: async () => { calls.push('fallback-sync') },
          loadCombatState: async () => {
            expect(pendingAction?.id).toBe('action-1')
            calls.push('load-combat')
          },
        })
      },
      sleep: async (ms) => { calls.push(`sleep:${ms}`) },
      clearPendingAction: () => {
        calls.push('unlock')
        pendingAction = null
      },
      unlockDelayMs: 0,
    })

    expect(result).toBe('handled')
    expect(calls).toEqual(['fallback-sync', 'load-combat', 'sleep:0', 'unlock'])
    expect(pendingAction).toBeNull()
  })
})

describe('player action rejection notice', () => {
  it('explains ammunition rejection without hiding the authoritative result', () => {
    expect(playerActionRejectionNotice('ammunition-unavailable')).toEqual({
      title: '弹药不足',
      message: '当前武器没有可用弹药，本次攻击未结算。',
    })
  })

  it('explains that Wind Wall rejects an ordinary projectile without consuming it', () => {
    expect(playerActionRejectionNotice('projectile-blocked-by-wind-wall')).toEqual({
      title: '飞射物被风墙偏转',
      message: '普通箭矢、弩矢或其他普通飞射物穿过风墙时自动未命中；本次攻击未消耗动作或弹药。',
    })
  })

  it('keeps unknown rejection reasons visible for diagnosis', () => {
    expect(playerActionRejectionNotice('future-authority-rule')).toEqual({
      title: '行动被拒绝',
      message: 'DM 权威结算拒绝了这次行动（future-authority-rule），本次行动未结算。',
    })
  })

  it('explains why a spell was rejected instead of collapsing every failure into spell unavailable', () => {
    expect(playerActionRejectionNotice('spell-environment-unavailable')).toEqual({
      title: '环境无法容纳法术',
      message: '当前权威地图标记为没有可见且足以容纳风暴云的高空空间；召雷术施法失败，未消耗动作或法术位。',
    })
    expect(playerActionRejectionNotice('invalid-class-feature')).toEqual({
      title: '目标或行动前提不满足',
      message: '目标的生物类型、状态或这项法术／特性的其他规则前提不满足；本次行动未结算，也没有消耗资源。',
    })
    expect(playerActionRejectionNotice('spellcasting-prohibited')).toEqual({
      title: '当前效果禁止施法',
      message: '当前形态或其他持续效果明确禁止施法；本次施法未结算，也不会消耗动作、法术位或其他资源。',
    })
    expect(playerActionRejectionNotice('action-prohibited')).toEqual({
      title: '当前效果禁止该动作',
      message: '当前形态或其他持续效果只允许规则明确列出的动作；本次行动未结算，也不会消耗动作或其他资源。',
    })
    expect(playerActionRejectionNotice('combat-ending')).toEqual({
      title: '战斗正在结束',
      message: 'DM 正在清理上一场战斗；本次行动未结算，也不会消耗动作、法术位或其他资源。',
    })
    expect(playerActionRejectionNotice('spell-not-known-or-prepared')).toEqual({
      title: '尚未学习或准备',
      message: '当前角色未学习该戏法，或该法术未被当前施法职业学习并准备，本次施法未结算。',
    })
    expect(playerActionRejectionNotice('spell-definition-unavailable')).toEqual({
      title: '法术尚未接入',
      message: '该法术没有可用的 Headless 定义，或当前房间规则包未提供它，本次施法未结算。',
    })
    expect(playerActionRejectionNotice('effect-line-blocked')).toEqual({
      title: '效果线被阻挡',
      message: '施法者与目标点之间存在全身掩护或阻挡效果线的墙体，本次施法未结算。',
    })
    expect(playerActionRejectionNotice('spell-target-not-visible')).toEqual({
      title: '必须看见目标点',
      message: '该法术要求施法者看见目标或范围中心，但施法者正处于目盲状态，或视线被黑暗、墙体及其他遮挡阻断。',
    })
    expect(playerActionRejectionNotice('target-immune')).toEqual({
      title: '目标免疫该法术',
      message: '该目标已经对当前施法者的这次法术免疫；本次施法未结算，也不会消耗时间、法术位或其他资源。',
    })
    expect(playerActionRejectionNotice('component-unavailable')).toEqual({
      title: '施法成分不可用',
      message: '角色受到沉默影响、缺少适用的法器或材料包，或该法术包含仍需 DM 确认数量的复杂特殊材料。',
    })
    expect(playerActionRejectionNotice('spell-area-target-out-of-range')).toEqual({
      title: '施法点超出射程',
      message: '所选范围中心超出该法术允许的施法距离；请在角色射程内重新选择。',
    })
    expect(playerActionRejectionNotice('verbal-component-unavailable')).toEqual({
      title: '无法说出咒语',
      message: '角色处于沉默效果中，而该法术需要言语成分，本次施法未结算。',
    })
    expect(playerActionRejectionNotice('somatic-component-unavailable')).toEqual({
      title: '无法完成施法姿势',
      message: '该法术需要姿势成分，但角色双手均被占用，且不能用持用法器的手完成该法术姿势；请先空出一只手。',
    })
    expect(playerActionRejectionNotice('invalid-spell-target-attack-fields')).toEqual({
      title: '逐次法术攻击字段冲突',
      message: '多次法术攻击请求同时携带了只适用于单次攻击的顶层字段；本次结算已安全取消。',
    })
  })
})
