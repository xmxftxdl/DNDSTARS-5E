import { useEffect, useRef } from 'react'
import {
  loadSharedResource,
  subscribeSharedEvent,
  subscribeSharedResourceInvalidation,
} from '../../lib/sharedApi'
import {
  consumePlayerActionAck,
  loadDmPlayerActionBatch,
  normalizeRemotePlayerActionForDm,
  syncAuthoritativePlayerActionState,
} from '../../lib/playerActionSync'
import type {
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionRequestQueueState,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import { useCharacterStore } from '../../store/characters'
import { useMapStore } from '../../store/maps'

interface RefCell<T> {
  current: T
}

interface PendingPlayerAction {
  id: string
  label: string
}

export interface PlayerActionRejectionNotice {
  title: string
  message: string
}

const PLAYER_ACTION_REJECTION_NOTICES: Readonly<Record<string, PlayerActionRejectionNotice>> = {
  'target-out-of-range': { title: '距离不足', message: '目标已经超出该行动的有效距离，本次行动未消耗。' },
  'ammunition-unavailable': { title: '弹药不足', message: '当前武器没有可用弹药，本次攻击未结算。' },
  'action-unavailable': { title: '动作已用尽', message: '本回合已没有可用动作，本次行动未结算。' },
  'attack-action-spent': { title: '攻击次数已用尽', message: '本回合的攻击次数已经用完，本次攻击未结算。' },
  'bonus-action-unavailable': { title: '附赠动作已用尽', message: '本回合已没有可用附赠动作，本次行动未结算。' },
  'reaction-unavailable': { title: '反应已用尽', message: '当前已没有可用反应，本次行动未结算。' },
  'insufficient-movement': { title: '移动力不足', message: '剩余移动力不足以完成该移动。' },
  'invalid-target': { title: '目标无效', message: '目标不符合该行动的规则或已不可用，本次行动未结算。' },
  'slot-unavailable': { title: '法术位不足', message: '没有可用的对应环阶法术位，本次施法未结算。' },
  'spell-unavailable': { title: '法术不可用', message: '当前角色不能施放该法术，本次施法未结算。' },
  'armor-proficiency-required': { title: '护甲妨碍施法', message: '角色正穿戴未熟练的护甲或盾牌，按 D&D 5e 2014 规则不能施法。' },
  'class-resource-unavailable': { title: '特性资源不足', message: '该职业或子职资源已用尽，本次能力未结算。' },
  'feature-already-used': { title: '特性已使用', message: '该特性已达到当前回合或休息周期的使用上限。' },
  'stale-turn': { title: '回合已更新', message: '行动到达 DM 端时回合已经变更，请核对当前先攻后重试。' },
  'stale-combat': { title: '战斗已更新', message: '行动到达 DM 端时战斗状态已经变更，请重试。' },
  'invalid-action-origin': { title: '行动身份无效', message: 'DM 不能代替玩家角色发起行动，本次行动已被拒绝。' },
  'character-owner-mismatch': { title: '角色归属不匹配', message: '该角色不属于当前玩家，不能代替其他玩家进行操作。' },
  'interaction-point-out-of-reach': { title: '距离不足', message: '角色必须先移动到互动点附近，才能进行调查。' },
  'interaction-already-resolved': { title: '已经调查过', message: '这个互动点已经按 DM 设置的次数限制完成，不能重复领取结果。' },
  'interaction-reward-unavailable': { title: '奖励规则未就绪', message: '互动点引用的物品模板当前不可用，为避免错误发放，本次交互已拒绝。' },
  'room-rules-unavailable': { title: '房间规则未就绪', message: '尚未获得可验证的房规快照，为避免错误结算，已拒绝本次行动。' },
  'plugin-not-allowed': { title: '插件未授权', message: '当前房间规则未授权该插件能力，本次行动未结算。' },
  'authority-commit-failed': { title: '结算同步失败', message: '权威战斗结果未能安全保存，本次行动已结束且不会重复扣除资源。请稍后重试。' },
}

export function playerActionRejectionNotice(reason?: string): PlayerActionRejectionNotice {
  const known = reason ? PLAYER_ACTION_REJECTION_NOTICES[reason] : undefined
  if (known) return known
  return {
    title: '行动被拒绝',
    message: `DM 权威结算拒绝了这次行动${reason ? `（${reason}）` : ''}，本次行动未结算。`,
  }
}

export async function drainDmPlayerActionQueue(input: {
  mapId: string
  combatId?: string
  processedActionIds: ReadonlySet<string>
  loadProcessed: () => Promise<SharedPlayerActionProcessedState | null>
  loadQueue: () => Promise<SharedPlayerActionRequestQueueState | null>
  loadLatestAction: () => Promise<SharedPlayerActionState | null>
  onProcessedActionIds: (ids: Set<string>) => void
  onAction: (action: SharedPlayerActionState) => Promise<void>
  isCancelled?: () => boolean
}): Promise<number> {
  const batch = await loadDmPlayerActionBatch({
    mapId: input.mapId,
    combatId: input.combatId,
    currentProcessedActionIds: input.processedActionIds,
    loadProcessed: input.loadProcessed,
    loadQueue: input.loadQueue,
    loadLatestAction: input.loadLatestAction,
  })
  if (input.isCancelled?.()) return 0
  if (batch.processedActionIds) input.onProcessedActionIds(batch.processedActionIds)
  let handled = 0
  for (const action of batch.actions) {
    if (input.isCancelled?.()) break
    await input.onAction(normalizeRemotePlayerActionForDm(action))
    handled += 1
  }
  return handled
}

async function waitForAuthoritativePlayerActionSync(appliedAt?: number): Promise<void> {
  await syncAuthoritativePlayerActionState({
    appliedAt,
    loadMapsUpdatedAt: async () => (await loadSharedResource<{ updatedAt?: number }>('maps'))?.updatedAt,
    loadCharactersUpdatedAt: async () =>
      (await loadSharedResource<{ updatedAt?: number }>('characters'))?.updatedAt,
    sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    loadMaps: () => useMapStore.getState().loadShared(),
    loadCharacters: () => useCharacterStore.getState().loadShared(),
  })
}

export function useMapsPlayerActionTransport(input: {
  isDm: boolean
  mode: 'dm' | 'player' | null
  activeMapId?: string
  dmRefreshKey: string
  getCombatId: () => string
  processedActionIdsRef: RefCell<Set<string>>
  seenAckIdsRef: RefCell<Set<string>>
  pendingActionRef: RefCell<PendingPlayerAction | null>
  onAction: (action: SharedPlayerActionState) => Promise<void>
  clearPendingAction: () => void
  onActionRejected: (reason: string) => void
}): void {
  const {
    isDm,
    mode,
    activeMapId,
    dmRefreshKey,
    getCombatId,
    processedActionIdsRef,
    seenAckIdsRef,
    pendingActionRef,
    onAction,
    clearPendingAction,
    onActionRejected,
  } = input
  const actionHandlerRef = useRef(onAction)
  const actionRejectedRef = useRef(onActionRejected)
  const getCombatIdRef = useRef(getCombatId)
  const clearPendingActionRef = useRef(clearPendingAction)

  useEffect(() => {
    actionHandlerRef.current = onAction
    actionRejectedRef.current = onActionRejected
    getCombatIdRef.current = getCombatId
    clearPendingActionRef.current = clearPendingAction
  })

  useEffect(() => {
    if (!isDm || !activeMapId) return
    const mapId = activeMapId
    let cancelled = false
    const handle = (action: SharedPlayerActionState) => {
      void actionHandlerRef.current(normalizeRemotePlayerActionForDm(action))
    }
    const unsubscribeEvent = subscribeSharedEvent<SharedPlayerActionState>(
      'player-action-player-to-dm',
      handle,
    )
    const load = async () => {
      await drainDmPlayerActionQueue({
        mapId,
        combatId: getCombatIdRef.current(),
        processedActionIds: processedActionIdsRef.current,
        loadProcessed: () => loadSharedResource<SharedPlayerActionProcessedState>('player-action-processed'),
        loadQueue: () => loadSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests'),
        loadLatestAction: () => loadSharedResource<SharedPlayerActionState>('player-action'),
        onProcessedActionIds: (ids) => { processedActionIdsRef.current = ids },
        onAction: (action) => actionHandlerRef.current(action),
        isCancelled: () => cancelled,
      })
    }
    const unsubscribeQueue = subscribeSharedResourceInvalidation('player-action-requests', load)
    return () => {
      cancelled = true
      unsubscribeEvent()
      unsubscribeQueue()
    }
  }, [isDm, activeMapId, dmRefreshKey, processedActionIdsRef])

  useEffect(() => {
    if (mode !== 'player' || !activeMapId) return
    const mapId = activeMapId
    let cancelled = false
    const applyAck = (ack: SharedPlayerActionAckState | null) => {
      if (
        ack?.status === 'rejected' &&
        pendingActionRef.current?.id === ack.actionId &&
        !seenAckIdsRef.current.has(ack.id)
      ) {
        actionRejectedRef.current(ack.reason ?? 'unknown')
      }
      void consumePlayerActionAck({
        ack,
        mapId,
        seenAckIds: seenAckIdsRef.current,
        getPendingAction: () => pendingActionRef.current,
        waitForAuthoritativeSync: waitForAuthoritativePlayerActionSync,
        sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
        clearPendingAction: () => clearPendingActionRef.current(),
        isCancelled: () => cancelled,
      })
    }
    const unsubscribeEvent = subscribeSharedEvent<SharedPlayerActionAckState>(
      'player-action-dm-to-player',
      applyAck,
    )
    const load = async () => {
      const ack = await loadSharedResource<SharedPlayerActionAckState>('player-action-ack')
      if (!cancelled) applyAck(ack)
    }
    const unsubscribeAck = subscribeSharedResourceInvalidation('player-action-ack', load)
    return () => {
      cancelled = true
      unsubscribeEvent()
      unsubscribeAck()
    }
  }, [mode, activeMapId, pendingActionRef, seenAckIdsRef])
}
