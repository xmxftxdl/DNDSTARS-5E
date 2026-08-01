import type {
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionRequestQueueState,
  SharedPlayerActionState,
} from './sharedCombatTypes'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import { PLAYER_ACTION_QUEUE_LIMIT } from './playerActionAck'
import { getRoomClientId } from './roomSession'

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
  roomMemberId?: string
  clientId?: string
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
  const sourceIdentity = input.clientId
    ? `:${input.roomMemberId ?? 'local'}:${input.clientId}`
    : ''
  return {
    id: `${input.mapId}:${prefix}${sourceIdentity}:${input.now}:${input.seq}`,
    mapId: input.mapId,
    combatId: input.combatId,
    ...(input.roomMemberId ? { roomMemberId: input.roomMemberId } : {}),
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

/**
 * Actions arriving through the player-writable queue/event channels never
 * inherit DM-only claims from their JSON payload. The transport path, rather
 * than the client-reported sourceMode, establishes the caller identity.
 */
export function normalizeRemotePlayerActionForDm(action: SharedPlayerActionState): SharedPlayerActionState {
  const weaponOptions = action.dnd5eWeaponAttackOptions
  if (!weaponOptions?.coverOverride && action.sourceMode === 'player') return action
  if (!weaponOptions) return { ...action, sourceMode: 'player' }
  const trustedWeaponOptions = { ...weaponOptions }
  delete trustedWeaponOptions.coverOverride
  return {
    ...action,
    sourceMode: 'player',
    dnd5eWeaponAttackOptions: trustedWeaponOptions,
  }
}

export function createSharedPlayerActionEnvelope(input: {
  mapId?: string
  combatId?: string
  roomMemberId?: string
  sourceMode: SharedPlayerActionState['sourceMode']
  actorTokenId?: string
  characterId?: string
  round: number
  initiativeIndex: number
  nextSeq: () => number
  now?: () => number
  patch: SharedPlayerActionPatch
}): SharedPlayerActionState | null {
  if (!input.mapId || !input.actorTokenId || !input.characterId) return null
  return buildSharedPlayerAction({
    mapId: input.mapId,
    combatId: input.combatId,
    roomMemberId: input.roomMemberId,
    clientId: input.roomMemberId ? getRoomClientId() : undefined,
    sourceMode: input.sourceMode,
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
    round: input.round,
    initiativeIndex: input.initiativeIndex,
    seq: input.nextSeq(),
    now: input.now?.() ?? Date.now(),
    patch: input.patch,
  })
}

export function createPlayerActionEnvelope(input: {
  mapId?: string
  combatId?: string
  roomMemberId?: string
  turnCharacter?: Character | null
  currentInitiativeToken?: Token | null
  actorOverride?: { tokenId: string; characterId: string }
  round: number
  initiativeIndex: number
  nextSeq: () => number
  now?: () => number
  patch: SharedPlayerActionPatch
}): SharedPlayerActionState | null {
  const actorTokenId = input.actorOverride?.tokenId ?? input.currentInitiativeToken?.id
  const characterId = input.actorOverride?.characterId ?? input.turnCharacter?.id
  return createSharedPlayerActionEnvelope({
    mapId: input.mapId,
    combatId: input.combatId,
    roomMemberId: input.roomMemberId,
    sourceMode: 'player',
    actorTokenId,
    characterId,
    round: input.round,
    initiativeIndex: input.initiativeIndex,
    nextSeq: input.nextSeq,
    now: input.now,
    patch: input.patch,
  })
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
  appendAction?: (action: SharedPlayerActionState) => Promise<void>
  loadQueue: () => Promise<SharedPlayerActionRequestQueueState | null>
  saveQueue: (queue: SharedPlayerActionRequestQueueState) => Promise<void>
  publishAction: (action: SharedPlayerActionState) => Promise<void>
  now?: () => number
}): Promise<void> {
  if (input.appendAction) {
    await input.appendAction(input.action)
    await input.publishAction(input.action)
    return
  }
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

export async function submitPlayerActionRequestWithLock(input: {
  action: SharedPlayerActionState
  label: string
  lockPendingAction: (pending: { id: string; label: string }) => void
  getPendingAction: () => PendingPlayerActionLock | null | undefined
  clearPendingAction: () => void
  appendAction?: (action: SharedPlayerActionState) => Promise<void>
  loadQueue: () => Promise<SharedPlayerActionRequestQueueState | null>
  saveQueue: (queue: SharedPlayerActionRequestQueueState) => Promise<void>
  publishAction: (action: SharedPlayerActionState) => Promise<void>
  now?: () => number
}): Promise<void> {
  input.lockPendingAction({ id: input.action.id, label: input.label })
  try {
    await publishPlayerActionRequest({
      action: input.action,
      appendAction: input.appendAction,
      loadQueue: input.loadQueue,
      saveQueue: input.saveQueue,
      publishAction: input.publishAction,
      now: input.now,
    })
  } catch (error) {
    if (shouldClearPendingPlayerActionAfterAck(input.getPendingAction(), input.action.id)) {
      input.clearPendingAction()
    }
    throw error
  }
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
      authorityRevisions?: Readonly<Record<string, number>>
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
    authorityRevisions: ack.status === 'accepted' ? ack.authorityRevisions : undefined,
  }
}

export function shouldClearPendingPlayerActionAfterAck(
  pendingAction: PendingPlayerActionLock | null | undefined,
  actionId: string,
): boolean {
  return pendingAction?.id === actionId
}

export async function consumePlayerActionAck(input: {
  ack?: SharedPlayerActionAckState | null
  mapId: string
  seenAckIds: Set<string>
  getPendingAction: () => PendingPlayerActionLock | null | undefined
  waitForAuthoritativeSync: (
    appliedAt?: number,
    authorityRevisions?: Readonly<Record<string, number>>,
  ) => Promise<void>
  sleep: (ms: number) => Promise<void>
  clearPendingAction: () => void
  isCancelled?: () => boolean
  onAuthoritativeSyncError?: (error: unknown) => void
  unlockDelayMs?: number
}): Promise<'ignored' | 'handled' | 'cancelled'> {
  const decision = resolvePlayerActionAckDecision({
    ack: input.ack,
    mapId: input.mapId,
    seenAckIds: input.seenAckIds,
    pendingAction: input.getPendingAction(),
  })
  if (decision.markSeenAckId) input.seenAckIds.add(decision.markSeenAckId)
  if (decision.status !== 'handle') return 'ignored'

  try {
    await input.waitForAuthoritativeSync(decision.waitForAppliedAt, decision.authorityRevisions)
  } catch (error) {
    if (input.isCancelled?.()) return 'cancelled'
    input.onAuthoritativeSyncError?.(error)
    if (shouldClearPendingPlayerActionAfterAck(input.getPendingAction(), decision.actionId)) {
      input.clearPendingAction()
    }
    return 'handled'
  }
  if (input.isCancelled?.()) return 'cancelled'

  await input.sleep(input.unlockDelayMs ?? 100)
  if (input.isCancelled?.()) return 'cancelled'

  if (shouldClearPendingPlayerActionAfterAck(input.getPendingAction(), decision.actionId)) {
    input.clearPendingAction()
  }
  return 'handled'
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

export async function syncAuthoritativePlayerActionState(input: {
  appliedAt?: number
  loadMapsUpdatedAt: () => Promise<number | undefined>
  loadCharactersUpdatedAt: () => Promise<number | undefined>
  loadMaps: () => Promise<unknown>
  loadCharacters: () => Promise<unknown>
  sleep: (ms: number) => Promise<void>
  now?: () => number
  timeoutMs?: number
  pollMs?: number
}): Promise<void> {
  await waitForAuthoritativeActionSnapshot({
    appliedAt: input.appliedAt,
    loadMapsUpdatedAt: input.loadMapsUpdatedAt,
    loadCharactersUpdatedAt: input.loadCharactersUpdatedAt,
    sleep: input.sleep,
    now: input.now,
    timeoutMs: input.timeoutMs,
    pollMs: input.pollMs,
  })
  await Promise.all([input.loadMaps(), input.loadCharacters()])
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
