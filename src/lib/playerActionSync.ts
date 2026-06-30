import type {
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionRequestQueueState,
  SharedPlayerActionState,
} from '../pages/mapsPageTypes'
import { PLAYER_ACTION_QUEUE_LIMIT } from './playerActionAck'

export function isAuthoritativeActionSnapshotReady(
  appliedAt: number | undefined,
  mapsUpdatedAt: number | undefined,
  charactersUpdatedAt: number | undefined,
): boolean {
  if (!appliedAt) return true
  return (mapsUpdatedAt ?? 0) >= appliedAt && (charactersUpdatedAt ?? 0) >= appliedAt
}

export type SharedPlayerActionPatch = Pick<SharedPlayerActionState, 'type'> &
  Partial<
    Omit<
      SharedPlayerActionState,
      | 'id'
      | 'mapId'
      | 'combatId'
      | 'sourceMode'
      | 'status'
      | 'actorTokenId'
      | 'characterId'
      | 'round'
      | 'initiativeIndex'
      | 'seq'
      | 'updatedAt'
    >
  >

export interface BuildSharedPlayerActionInput {
  mapId: string
  combatId?: string
  sourceMode: SharedPlayerActionState['sourceMode']
  actorTokenId: string
  characterId: string
  round: number
  initiativeIndex: number
  seq: number
  now: number
  patch: SharedPlayerActionPatch
}

export function buildSharedPlayerAction(input: BuildSharedPlayerActionInput): SharedPlayerActionState {
  const prefix = input.sourceMode === 'dm' ? 'dm-action' : 'player-action'
  return {
    id: `${input.mapId}:${prefix}:${input.now}:${input.seq}`,
    mapId: input.mapId,
    combatId: input.combatId,
    sourceMode: input.sourceMode,
    status: 'pending',
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
    round: input.round,
    initiativeIndex: input.initiativeIndex,
    seq: input.seq,
    updatedAt: input.now,
    ...input.patch,
  }
}

export function buildPlayerActionRequestQueueState(input: {
  action: SharedPlayerActionState
  current?: SharedPlayerActionRequestQueueState | null
  updatedAt: number
  queueLimit?: number
}): SharedPlayerActionRequestQueueState {
  const queueLimit = input.queueLimit ?? PLAYER_ACTION_QUEUE_LIMIT
  const liveRequests = (input.current?.requests ?? []).filter((request) =>
    shouldKeepQueuedPlayerActionRequest(input.action, request),
  )
  return {
    mapId: input.action.mapId,
    combatId: input.action.combatId,
    requests: [...liveRequests, input.action].slice(-queueLimit),
    updatedAt: input.updatedAt,
  }
}

export async function publishPlayerActionRequest(input: {
  action: SharedPlayerActionState
  loadQueue: () => Promise<SharedPlayerActionRequestQueueState | null>
  saveQueue: (queue: SharedPlayerActionRequestQueueState) => Promise<void>
  publishAction: (action: SharedPlayerActionState) => Promise<void>
  now?: () => number
}): Promise<void> {
  const current = await input.loadQueue()
  await input.saveQueue(
    buildPlayerActionRequestQueueState({
      action: input.action,
      current,
      updatedAt: input.now?.() ?? Date.now(),
    }),
  )
  await input.publishAction(input.action)
}

export function queuedPlayerActionsForDm(input: {
  queue?: SharedPlayerActionRequestQueueState | null
  mapId: string
  combatId?: string
  processedActionIds: ReadonlySet<string>
}): SharedPlayerActionState[] {
  return (input.queue?.requests ?? [])
    .filter((action) => {
      if (!action || action.status !== 'pending') return false
      if (action.mapId !== input.mapId) return false
      if (input.combatId && action.combatId && action.combatId !== input.combatId) return false
      if (input.processedActionIds.has(action.id)) return false
      return true
    })
    .sort((a, b) => (a.updatedAt - b.updatedAt) || (a.seq - b.seq))
}

export function hydratedProcessedPlayerActionIdsForDm(input: {
  processed?: { mapId?: string; combatId?: string; actionIds?: string[] } | null
  mapId: string
  combatId?: string
}): Set<string> | undefined {
  const processed = input.processed
  if (!processed?.actionIds?.length) return undefined
  if (processed.mapId && processed.mapId !== input.mapId) return undefined
  if (input.combatId && processed.combatId && processed.combatId !== input.combatId) return undefined
  return new Set(processed.actionIds)
}

export async function loadDmPlayerActionBatch(input: {
  mapId: string
  combatId?: string
  currentProcessedActionIds: ReadonlySet<string>
  loadProcessed: () => Promise<SharedPlayerActionProcessedState | null>
  loadQueue: () => Promise<SharedPlayerActionRequestQueueState | null>
  loadLatestAction: () => Promise<SharedPlayerActionState | null>
}): Promise<{
  processedActionIds?: Set<string>
  actions: SharedPlayerActionState[]
}> {
  const processed = await input.loadProcessed()
  const processedActionIds =
    hydratedProcessedPlayerActionIdsForDm({
      processed,
      mapId: input.mapId,
      combatId: input.combatId,
    }) ?? input.currentProcessedActionIds

  const queue = await input.loadQueue()
  const queuedActions = queuedPlayerActionsForDm({
    queue,
    mapId: input.mapId,
    combatId: input.combatId,
    processedActionIds,
  })

  const latestAction = await input.loadLatestAction()
  return {
    processedActionIds:
      processedActionIds !== input.currentProcessedActionIds ? new Set(processedActionIds) : undefined,
    actions: latestAction ? [...queuedActions, latestAction] : queuedActions,
  }
}

export interface PendingPlayerActionLock {
  id: string
  label?: string
}

export type PlayerActionAckDecision =
  | { status: 'ignored'; markSeenAckId?: string }
  | {
      status: 'handle'
      markSeenAckId: string
      actionId: string
      waitForAppliedAt?: number
    }

export function resolvePlayerActionAckDecision(input: {
  ack?: SharedPlayerActionAckState | null
  mapId: string
  seenAckIds: ReadonlySet<string>
  pendingAction?: PendingPlayerActionLock | null
}): PlayerActionAckDecision {
  const ack = input.ack
  if (!ack || ack.mapId !== input.mapId) return { status: 'ignored' }
  if (input.seenAckIds.has(ack.id)) return { status: 'ignored' }

  if (!input.pendingAction || input.pendingAction.id !== ack.actionId) {
    return { status: 'ignored', markSeenAckId: ack.id }
  }

  return {
    status: 'handle',
    markSeenAckId: ack.id,
    actionId: ack.actionId,
    waitForAppliedAt: ack.status === 'accepted' ? ack.appliedAt : undefined,
  }
}

export function shouldClearPendingPlayerActionAfterAck(
  pendingAction: PendingPlayerActionLock | null | undefined,
  actionId: string,
): boolean {
  return pendingAction?.id === actionId
}

export async function waitForAuthoritativeActionSnapshot(input: {
  appliedAt?: number
  loadMapsUpdatedAt: () => Promise<number | undefined>
  loadCharactersUpdatedAt: () => Promise<number | undefined>
  sleep: (ms: number) => Promise<void>
  now?: () => number
  timeoutMs?: number
  pollMs?: number
}): Promise<void> {
  if (!input.appliedAt) return
  const now = input.now ?? Date.now
  const deadline = now() + (input.timeoutMs ?? 3000)
  const pollMs = input.pollMs ?? 100
  while (now() < deadline) {
    const [mapsUpdatedAt, charactersUpdatedAt] = await Promise.all([
      input.loadMapsUpdatedAt(),
      input.loadCharactersUpdatedAt(),
    ])
    if (isAuthoritativeActionSnapshotReady(input.appliedAt, mapsUpdatedAt, charactersUpdatedAt)) return
    await input.sleep(pollMs)
  }
}

function shouldKeepQueuedPlayerActionRequest(
  action: SharedPlayerActionState,
  request: SharedPlayerActionState | undefined,
): request is SharedPlayerActionState {
  if (!request || request.id === action.id || request.status !== 'pending') return false
  if (request.mapId !== action.mapId) return false
  if (action.combatId && request.combatId && request.combatId !== action.combatId) return false
  return true
}
