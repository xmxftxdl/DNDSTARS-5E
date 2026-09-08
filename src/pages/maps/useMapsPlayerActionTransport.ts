import { useEffect, useRef } from 'react'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
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

interface PlayerActionAuthorityLockManager {
  request(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<boolean> | boolean,
  ): Promise<boolean>
}

function processedStateMatchesAction(
  processed: SharedPlayerActionProcessedState | null,
  action: SharedPlayerActionState,
): processed is SharedPlayerActionProcessedState {
  return !!processed &&
    (!processed.mapId || processed.mapId === action.mapId) &&
    (!action.combatId || !processed.combatId || processed.combatId === action.combatId)
}

/**
 * A DM can have the map open in more than one tab. Shared-event delivery reaches
 * every tab, but only one of them may roll dice and build the authoritative
 * snapshot for a player action. Web Locks provide the same-origin cross-tab
 * election; the fresh processed-state read also closes the race for a delayed
 * event that arrives after the winning tab releases the lock.
 */
export async function runExclusiveDmPlayerAction(input: {
  action: SharedPlayerActionState
  getProcessedActionIds: () => ReadonlySet<string>
  loadProcessed: () => Promise<SharedPlayerActionProcessedState | null>
  onProcessedActionIds: (ids: Set<string>) => void
  onAction: (action: SharedPlayerActionState) => Promise<void>
  lockManager?: PlayerActionAuthorityLockManager
}): Promise<boolean> {
  const runIfPending = async (): Promise<boolean> => {
    const persisted = await input.loadProcessed()
    if (processedStateMatchesAction(persisted, input.action)) {
      const processedIds = new Set(persisted.actionIds)
      input.onProcessedActionIds(processedIds)
      if (processedIds.has(input.action.id)) return false
    } else if (input.getProcessedActionIds().has(input.action.id)) {
      return false
    }
    await input.onAction(input.action)
    return true
  }

  if (!input.lockManager) return runIfPending()
  return input.lockManager.request(
    `astral-trace:dm-player-action:${input.action.mapId}:${input.action.id}`,
    { mode: 'exclusive', ifAvailable: true },
    (lock) => lock ? runIfPending() : false,
  )
}

export interface PlayerActionRejectionNotice {
  title: string
  message: string
}

const PLAYER_ACTION_REJECTION_NOTICES: Readonly<Record<string, PlayerActionRejectionNotice>> = {
  'component-unavailable': { title: '施法成分不可用', message: '角色受到沉默影响、缺少适用的法器或材料包，或该法术包含仍需 DM 确认数量的复杂特殊材料。' },
  'verbal-component-unavailable': { title: '无法说出咒语', message: '角色处于沉默效果中，而该法术需要言语成分，本次施法未结算。' },
  'somatic-component-unavailable': { title: '无法完成施法姿势', message: '该法术需要姿势成分，但角色双手均被占用，且不能用持用法器的手完成该法术姿势；请先空出一只手。' },
  'material-component-unavailable': { title: '无法取用施法材料', message: '角色没有空手取用所需材料，或没有在手中持用对应职业的施法法器；特殊材料即使在背包中，也必须空出一只手操作。' },
  'costly-material-unavailable': { title: '缺少特殊材料', message: '库存中缺少该法术指定种类、单件价值或总价值的材料；职业法器和材料包不能替代标价或会被消耗的材料。' },
  'spell-reaction-only': { title: '只能作为反应施放', message: '该法术的施法时间是反应，不能从普通动作快捷栏直接发动；请等待对应触发条件。' },
  'spell-option-required': { title: '施法选项不完整', message: '该法术需要先选择伤害类型、效果分支或其他施法选项；当前选择缺失或已失效。' },
  'spell-environment-unavailable': { title: '环境无法容纳法术', message: '当前权威地图标记为没有可见且足以容纳风暴云的高空空间；召雷术施法失败，未消耗动作或法术位。' },
  'spell-target-count-invalid': { title: '目标数量不正确', message: '当前选择的目标数量不符合该法术或升环后的目标数量规则，本次施法未结算。' },
  'spell-area-target-required': { title: '尚未选择施法点', message: '该法术需要在地图上选择一个有效的范围中心或起点；当前没有收到有效格点。' },
  'spell-area-target-out-of-bounds': { title: '施法点超出地图', message: '所选范围中心位于当前地图边界之外，请在地图内重新选择。' },
  'spell-area-target-out-of-range': { title: '施法点超出射程', message: '所选范围中心超出该法术允许的施法距离；请在角色射程内重新选择。' },
  'spell-area-orientation-invalid': { title: '范围方向无效', message: '该法术的范围方向或旋转参数无效，请重新放置法术模板。' },
  'spell-target-not-visible': { title: '必须看见目标点', message: '该法术要求施法者看见目标或范围中心，但施法者正处于目盲状态，或视线被黑暗、墙体及其他遮挡阻断。' },
  'invalid-spell-target-attack-count': { title: '逐次法术攻击数量无效', message: '实际提交的逐道射线或多次法术攻击数量与权威规则要求不一致；本次结算已安全取消。' },
  'invalid-spell-target-attacks': { title: '逐次法术攻击目标无效', message: '逐道射线或多次法术攻击的目标或顺序与权威分配不一致；本次结算已安全取消。' },
  'invalid-spell-target-attack-fields': { title: '逐次法术攻击字段冲突', message: '多次法术攻击请求同时携带了只适用于单次攻击的顶层字段；本次结算已安全取消。' },
  'invalid-spell-attack-dice': { title: '逐次法术攻击骰无效', message: '某次法术攻击的攻击骰、优势/劣势骰或命中伤害骰与权威判定不一致；本次结算已安全取消。' },
  'invalid-dice': { title: '骰子数据无效', message: '提交的骰子数量、骰面或目标对应关系与该法术不一致；本次结算已安全取消，请重新施放。' },
  'target-out-of-range': { title: '距离不足', message: '目标已经超出该行动的有效距离，本次行动未消耗。' },
  'ammunition-unavailable': { title: '弹药不足', message: '当前武器没有可用弹药，本次攻击未结算。' },
  'projectile-blocked-by-wind-wall': { title: '飞射物被风墙偏转', message: '普通箭矢、弩矢或其他普通飞射物穿过风墙时自动未命中；本次攻击未消耗动作或弹药。' },
  'action-unavailable': { title: '动作已用尽', message: '本回合已没有可用动作，本次行动未结算。' },
  'action-prohibited': { title: '当前效果禁止该动作', message: '当前形态或其他持续效果只允许规则明确列出的动作；本次行动未结算，也不会消耗动作或其他资源。' },
  'spellcasting-prohibited': { title: '当前效果禁止施法', message: '当前形态或其他持续效果明确禁止施法；本次施法未结算，也不会消耗动作、法术位或其他资源。' },
  'attack-action-spent': { title: '攻击次数已用尽', message: '本回合的攻击次数已经用完，本次攻击未结算。' },
  'bonus-action-unavailable': { title: '附赠动作已用尽', message: '本回合已没有可用附赠动作，本次行动未结算。' },
  'reaction-unavailable': { title: '反应已用尽', message: '当前已没有可用反应，本次行动未结算。' },
  'insufficient-movement': { title: '移动力不足', message: '剩余移动力不足以完成该移动。' },
  'movement-boundary-save-failed': { title: '移动被法术限制', message: '角色未通过离开来源范围所需的豁免，本次移动没有发生，也不会消耗移动力。' },
  'invalid-target': { title: '目标无效', message: '目标不符合该行动的规则或已不可用，本次行动未结算。' },
  'target-immune': { title: '目标免疫该法术', message: '该目标已经对当前施法者的这次法术免疫；本次施法未结算，也不会消耗时间、法术位或其他资源。' },
  'slot-unavailable': { title: '法术位不足', message: '没有可用的对应环阶法术位，本次施法未结算。' },
  'spell-unavailable': { title: '法术不可用', message: '当前角色不能施放该法术，本次施法未结算。' },
  'spell-definition-unavailable': { title: '法术尚未接入', message: '该法术没有可用的 Headless 定义，或当前房间规则包未提供它，本次施法未结算。' },
  'spell-not-known-or-prepared': { title: '尚未学习或准备', message: '当前角色未学习该戏法，或该法术未被当前施法职业学习并准备，本次施法未结算。' },
  'spellcasting-class-unavailable': { title: '施法职业不可用', message: '当前角色没有可用于施放该法术的有效施法职业等级或施法属性，本次施法未结算。' },
  'effect-line-blocked': { title: '效果线被阻挡', message: '施法者与目标点之间存在全身掩护或阻挡效果线的墙体，本次施法未结算。' },
  'innate-spell-unavailable': { title: '天生施法不可用', message: '该法术不是当前角色可用的种族天生施法，或对应免费使用次数不可用，本次施法未结算。' },
  'sustained-spell-unavailable': { title: '持续法术已失效', message: '对应的持续法术、专注或效果 Token 已不存在或已经过期，不能再次发动。' },
  'wild-shape-spellcasting-unavailable': { title: '荒野形态无法施法', message: '当前角色处于荒野形态，且尚未达到 18 级德鲁伊的兽形施法条件，本次施法未结算。' },
  'armor-proficiency-required': { title: '护甲妨碍施法', message: '角色正穿戴未熟练的护甲或盾牌，按 D&D 5e 2014 规则不能施法。' },
  'class-resource-unavailable': { title: '特性资源不足', message: '该职业或子职资源已用尽，本次能力未结算。' },
  'invalid-class-feature': { title: '目标或行动前提不满足', message: '目标的生物类型、状态或这项法术／特性的其他规则前提不满足；本次行动未结算，也没有消耗资源。' },
  'feature-already-used': { title: '特性已使用', message: '该特性已达到当前回合或休息周期的使用上限。' },
  'stale-turn': { title: '回合已更新', message: '行动到达 DM 端时回合已经变更，请核对当前先攻后重试。' },
  'stale-combat': { title: '战斗已更新', message: '行动到达 DM 端时战斗状态已经变更，请重试。' },
  'combat-ending': { title: '战斗正在结束', message: 'DM 正在清理上一场战斗；本次行动未结算，也不会消耗动作、法术位或其他资源。' },
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
  const normalizedReason = reason?.startsWith('authority-commit-failed:')
    ? 'authority-commit-failed'
    : reason
  const known = normalizedReason ? PLAYER_ACTION_REJECTION_NOTICES[normalizedReason] : undefined
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

export async function syncPersistedAcceptedPlayerActionSnapshot(input: {
  appliedAt?: number
  syncAuthoritativeState: () => Promise<void>
  loadCombatState?: () => Promise<void>
}): Promise<void> {
  await input.syncAuthoritativeState()
  if (input.appliedAt != null) await input.loadCombatState?.()
}

export async function waitForAuthoritativePlayerActionSync(
  appliedAt?: number,
  authorityRevisions?: Readonly<Record<string, number>>,
  loadCombatState?: () => Promise<void>,
): Promise<void> {
  const expectedCharactersRevision = authorityRevisions?.characters
  const expectedMapsRevision = authorityRevisions?.maps
  const expectedCombatRevision = authorityRevisions?.combat
  if (expectedCharactersRevision || expectedMapsRevision || expectedCombatRevision) {
    const deadline = Date.now() + 3000
    do {
      await Promise.all([
        useMapStore.getState().loadShared(),
        useCharacterStore.getState().loadShared(),
        expectedCombatRevision
          ? (loadCombatState?.() ?? browserSharedRoomService.loadSharedResource('combat').then(() => undefined))
          : Promise.resolve(),
      ])
      const mapsReady = !expectedMapsRevision ||
        browserSharedRoomService.getSharedResourceRevisionWatermark('maps') >= expectedMapsRevision
      const charactersReady = !expectedCharactersRevision ||
        browserSharedRoomService.getSharedResourceRevisionWatermark('characters') >= expectedCharactersRevision
      const combatReady = !expectedCombatRevision ||
        browserSharedRoomService.getSharedResourceRevisionWatermark('combat') >= expectedCombatRevision
      if (mapsReady && charactersReady && combatReady) return
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    } while (Date.now() < deadline)
    throw new Error('player-action-authoritative-revision-timeout')
  }
  await syncPersistedAcceptedPlayerActionSnapshot({
    appliedAt,
    syncAuthoritativeState: () => syncAuthoritativePlayerActionState({
      appliedAt,
      loadMapsUpdatedAt: async () => (await browserSharedRoomService.loadSharedResource<{ updatedAt?: number }>('maps'))?.updatedAt,
      loadCharactersUpdatedAt: async () =>
        (await browserSharedRoomService.loadSharedResource<{ updatedAt?: number }>('characters'))?.updatedAt,
      sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
      loadMaps: () => useMapStore.getState().loadShared(),
      loadCharacters: () => useCharacterStore.getState().loadShared(),
    }),
    // Persisted ACK snapshots cannot contain the transaction revisions that are
    // only known after commit. If the live SSE ACK was missed, explicitly apply
    // combat too so the accepted next turn / monster-thinking marker is visible
    // before the player's pending-action lock is released.
    loadCombatState,
  })
}

export function playerActionAckMustWaitForCombatReceipt(input: {
  ack: SharedPlayerActionAckState | null
  mapId: string
  pendingActionId?: string
  isReceiptAuthoritativeAction?: (actionId: string) => boolean
}): boolean {
  const { ack } = input
  return !!ack &&
    ack.mapId === input.mapId &&
    ack.actionId === input.pendingActionId &&
    input.isReceiptAuthoritativeAction?.(ack.actionId) === true
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
  onActionAccepted?: (ack: SharedPlayerActionAckState) => void
  onSpellWhisper?: (whisper: NonNullable<SharedPlayerActionAckState['spellWhisper']>) => void
  /**
   * These actions are settled only by the durable combat-command receipt.
   * Their legacy ACK remains a wake hint and must never unlock the UI.
   */
  isReceiptAuthoritativeAction?: (actionId: string) => boolean
  /** Loads and applies the authoritative combat snapshot before an ACK unlocks the UI. */
  loadCombatState?: () => Promise<void>
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
    onActionAccepted,
    onSpellWhisper,
    isReceiptAuthoritativeAction,
    loadCombatState,
  } = input
  const actionHandlerRef = useRef(onAction)
  const actionRejectedRef = useRef(onActionRejected)
  const actionAcceptedRef = useRef(onActionAccepted)
  const spellWhisperRef = useRef(onSpellWhisper)
  const getCombatIdRef = useRef(getCombatId)
  const clearPendingActionRef = useRef(clearPendingAction)
  const loadCombatStateRef = useRef(loadCombatState)
  const isReceiptAuthoritativeActionRef = useRef(isReceiptAuthoritativeAction)

  useEffect(() => {
    actionHandlerRef.current = onAction
    actionRejectedRef.current = onActionRejected
    actionAcceptedRef.current = onActionAccepted
    spellWhisperRef.current = onSpellWhisper
    getCombatIdRef.current = getCombatId
    clearPendingActionRef.current = clearPendingAction
    loadCombatStateRef.current = loadCombatState
    isReceiptAuthoritativeActionRef.current = isReceiptAuthoritativeAction
  })

  useEffect(() => {
    if (!isDm || !activeMapId) return
    const mapId = activeMapId
    let cancelled = false
    const dispatch = (action: SharedPlayerActionState) => runExclusiveDmPlayerAction({
      action: normalizeRemotePlayerActionForDm(action),
      getProcessedActionIds: () => processedActionIdsRef.current,
      loadProcessed: () => browserSharedRoomService.loadSharedResource<SharedPlayerActionProcessedState>('player-action-processed'),
      onProcessedActionIds: (ids) => { processedActionIdsRef.current = ids },
      onAction: (nextAction) => actionHandlerRef.current(nextAction),
      lockManager: typeof navigator !== 'undefined'
        ? navigator.locks as PlayerActionAuthorityLockManager
        : undefined,
    })
    const handle = (action: SharedPlayerActionState) => {
      void dispatch(action)
    }
    const unsubscribeEvent = browserSharedRoomService.subscribeSharedEvent<SharedPlayerActionState>(
      'player-action-player-to-dm',
      handle,
    )
    const load = async () => {
      await drainDmPlayerActionQueue({
        mapId,
        combatId: getCombatIdRef.current(),
        processedActionIds: processedActionIdsRef.current,
        loadProcessed: () => browserSharedRoomService.loadSharedResource<SharedPlayerActionProcessedState>('player-action-processed'),
        loadQueue: () => browserSharedRoomService.loadSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests'),
        loadLatestAction: () => browserSharedRoomService.loadSharedResource<SharedPlayerActionState>('player-action'),
        onProcessedActionIds: (ids) => { processedActionIdsRef.current = ids },
        onAction: async (action) => { await dispatch(action) },
        isCancelled: () => cancelled,
      })
    }
    const unsubscribeQueue = browserSharedRoomService.subscribeSharedResourceInvalidation('player-action-requests', load, {
      recoveryMs: 2_000,
      recoverWhenHidden: true,
      refreshOnVisibilityRestore: true,
    })
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
      if (ack?.mapId === mapId && ack.spellWhisper) {
        if (!seenAckIdsRef.current.has(ack.id)) {
          seenAckIdsRef.current.add(ack.id)
          spellWhisperRef.current?.(ack.spellWhisper)
        }
        return
      }
      if (playerActionAckMustWaitForCombatReceipt({
        ack,
        mapId,
        pendingActionId: pendingActionRef.current?.id,
        isReceiptAuthoritativeAction: isReceiptAuthoritativeActionRef.current,
      })) {
        // The command transaction persists its terminal receipt before publishing
        // this compatibility ACK. Remember the hint, but leave the lock and the
        // authoritative reload to the receipt polling path.
        seenAckIdsRef.current.add(ack!.id)
        return
      }
      if (
        ack &&
        pendingActionRef.current?.id === ack.actionId &&
        !seenAckIdsRef.current.has(ack.id)
      ) {
        if (ack.status === 'rejected') actionRejectedRef.current(ack.reason ?? 'unknown')
        else actionAcceptedRef.current?.(ack)
      }
      void consumePlayerActionAck({
        ack,
        mapId,
        seenAckIds: seenAckIdsRef.current,
        getPendingAction: () => pendingActionRef.current,
        waitForAuthoritativeSync: (appliedAt, authorityRevisions) =>
          waitForAuthoritativePlayerActionSync(
            appliedAt,
            authorityRevisions,
            loadCombatStateRef.current,
          ),
        sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
        clearPendingAction: () => clearPendingActionRef.current(),
        isCancelled: () => cancelled,
        onAuthoritativeSyncError: (error) => {
          console.error('[player-action] authoritative reload failed after ACK', error)
        },
      })
    }
    const unsubscribeEvent = browserSharedRoomService.subscribeSharedEvent<SharedPlayerActionAckState>(
      'player-action-dm-to-player',
      applyAck,
    )
    const load = async () => {
      const ack = await browserSharedRoomService.loadSharedResource<SharedPlayerActionAckState>('player-action-ack')
      if (!cancelled) applyAck(ack)
    }
    const unsubscribeAck = browserSharedRoomService.subscribeSharedResourceInvalidation('player-action-ack', load)
    return () => {
      cancelled = true
      unsubscribeEvent()
      unsubscribeAck()
    }
  }, [mode, activeMapId, pendingActionRef, seenAckIdsRef])
}
