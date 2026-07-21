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
  onTargetOutOfRange: () => void
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
    onTargetOutOfRange,
  } = input
  const actionHandlerRef = useRef(onAction)
  const targetOutOfRangeRef = useRef(onTargetOutOfRange)
  const getCombatIdRef = useRef(getCombatId)
  const clearPendingActionRef = useRef(clearPendingAction)

  useEffect(() => {
    actionHandlerRef.current = onAction
    targetOutOfRangeRef.current = onTargetOutOfRange
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
        ack?.status === 'rejected' && ack.reason === 'target-out-of-range' &&
        pendingActionRef.current?.id === ack.actionId &&
        !seenAckIdsRef.current.has(ack.id)
      ) {
        targetOutOfRangeRef.current()
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
