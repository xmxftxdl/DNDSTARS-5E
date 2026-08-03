import { canWriteSharedState } from './appMode'
import { getRoomClientId, getRoomSession } from './roomSession'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'
import {
  reportSharedIntegrityIssue,
  validateAndMigrateSharedResource,
} from './sharedResourceValidation'
import {
  recordDuplicateSharedEvent,
  recordSharedConflict,
  recordSharedEvent,
  recordSharedEventGap,
  recordSharedRevision,
  recordSharedWrite,
  settleSharedRecovery,
} from './sharedSyncHealth'
import type { RoomJournalMutation } from './roomCommunications'

const SHARED_CLIENT_PROTOCOL_VERSION = CLIENT_SHARED_PROTOCOL_VERSION
export const SHARED_STATE_CLIENT_MAX_BYTES = 8 * 1024 * 1024
const sharedResourceRevisions = new Map<string, number>()
const sharedResourceWriteChains = new Map<string, Promise<unknown>>()

export type SharedResourceSaveResult =
  | { status: 'saved'; revision?: number }
  | { status: 'skipped'; reason: 'spectator' | 'forbidden' }
  | { status: 'invalid'; reason: 'schema' | 'serialization' }
  | { status: 'too-large' }
  | { status: 'conflict'; expectedRevision: number; currentRevision: number }
  | { status: 'failed' }

export interface SharedResourceWriteOptions {
  undoGroupId?: string
  undoLabel?: string
  /**
   * DM-authoritative journal side effects that must commit with the supplied
   * state snapshots. The server validates and applies these mutations while it
   * holds the same transaction lock; clients never submit a replacement
   * journal snapshot assembled from stale state.
   */
  roomJournalMutations?: readonly RoomJournalMutation[]
}

export class SharedResourceSaveError extends Error {
  readonly resource: string
  readonly result: SharedResourceSaveResult

  constructor(resource: string, result: SharedResourceSaveResult) {
    super(`shared-resource-save-rejected:${resource}:${result.status}`)
    this.name = 'SharedResourceSaveError'
    this.resource = resource
    this.result = result
  }
}

export function requireSharedResourceSaved(
  resource: string,
  result: SharedResourceSaveResult,
): asserts result is Extract<SharedResourceSaveResult, { status: 'saved' }> {
  if (result.status !== 'saved') throw new SharedResourceSaveError(resource, result)
}

function sharedSecretHeader(): Record<string, string> {
  // VITE_* values are public browser code. Production authority is carried by
  // the opaque room membership token, never by a bundled server secret.
  return {}
}

function sharedAccessHeaders(): Record<string, string> {
  return {}
}

function sharedSessionUrl(url: string, includeToken = false): string {
  const session = getRoomSession()
  const room = session?.roomId ?? (import.meta.env.VITE_STARS_ROOM_ID as string | undefined)?.trim()
  if (!room && (!includeToken || !session?.memberId)) return url
  const parsed = new URL(url)
  if (room) parsed.searchParams.set('room', room)
  if (includeToken && session?.memberId) parsed.searchParams.set('member', session.memberId)
  if (includeToken && session?.roomToken) parsed.searchParams.set('roomToken', session.roomToken)
  return parsed.toString()
}

function sharedResourceRevisionKey(name: string): string {
  const room = getRoomSession()?.roomId ||
    (import.meta.env.VITE_STARS_ROOM_ID as string | undefined)?.trim() ||
    '__lobby__'
  return `${room}:${name}`
}

function rememberSharedResourceRevisionWatermark(name: string, revision: number): void {
  if (!Number.isInteger(revision) || revision < 0) return
  const key = sharedResourceRevisionKey(name)
  const previous = sharedResourceRevisions.get(key) ?? -1
  if (revision < previous) return
  sharedResourceRevisions.set(key, revision)
}

export function getSharedResourceRevisionWatermark(name: string): number {
  return sharedResourceRevisions.get(sharedResourceRevisionKey(name)) ?? 0
}

// exported for the client-sync-layer unit test (dedup/trim/empty-filter of the
// configured base list — the routing core of read/double-send-write/single-canonical-event).
export function configuredApiBases(): string[] | null {
  const configured = import.meta.env.VITE_SHARED_API_BASES as string | undefined
  if (configured) {
    return configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
  }
  return null
}

function defaultDmApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5273/api'
  const port = '5273'
  return `${window.location.protocol}//${window.location.hostname}:${port}/api`
}

function sameOriginApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5273/api'
  const sameOrigin = `${window.location.origin}/api`
  return sameOrigin
}

const LOCAL_SPLIT_SHARED_PORTS = new Set(['5273', '5274', '5275', '5276'])

/**
 * The packaged local preview serves DM/player/spectator clients from separate
 * processes. They share files but not the in-memory SSE backlog, so all clients
 * must use the DM process as the event/write authority.
 */
function isLocalSplitSharedRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname.toLowerCase()
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  return isLoopback && LOCAL_SPLIT_SHARED_PORTS.has(window.location.port)
}

export function defaultSharedApiCandidates(production = import.meta.env.PROD): string[] {
  if (production && !isLocalSplitSharedRuntime()) return [sameOriginApiBase()]
  return [defaultDmApiBase(), sameOriginApiBase()]
    .filter((value, index, all) => all.indexOf(value) === index)
}

function sharedApiCandidates(): string[] {
  const configured = configuredApiBases()
  if (configured) return configured
  return defaultSharedApiCandidates()
}

function sharedMemberHeaders(): Record<string, string> {
  const session = getRoomSession()
  return session?.memberId && session.roomToken
    ? { 'X-Stars-Member': session.memberId, 'X-Stars-Room-Token': session.roomToken }
    : {}
}

function sharedProtocolHeaders(): Record<string, string> {
  const session = getRoomSession()
  const writerId = session
    ? `${session.role}:${session.memberId}:${session.clientId}`
    : `client:${getRoomClientId()}`
  return {
    'X-Stars-Protocol': String(SHARED_CLIENT_PROTOCOL_VERSION),
    'X-Stars-Writer': writerId,
  }
}

function rememberSharedResourceRevision(name: string, value: unknown, response?: Response): void {
  const headerRevision = Number(response?.headers.get('X-Stars-State-Revision'))
  const bodyRevision = value && typeof value === 'object'
    ? Number((value as { _sync?: { revision?: unknown } })._sync?.revision)
    : Number.NaN
  const revision = Number.isInteger(headerRevision) && headerRevision >= 0 ? headerRevision : bodyRevision
  if (!Number.isInteger(revision) || revision < 0) return
  rememberSharedResourceRevisionWatermark(name, revision)
  recordSharedRevision(name, revision)
}

/** 大厅在尚无房间会话时也要访问共享服务，因此公开与普通读取相同的容错端点列表。 */
export function sharedLobbyApiCandidates(): string[] {
  return sharedApiCandidates()
}

// state/image WRITES double-send to ALL configured bases (file-backed, idempotent —
// each process writes the same shared file root). Contrast sharedEventApiCandidates (single canonical).
export function sharedWriteApiCandidates(production = import.meta.env.PROD): string[] {
  const configured = configuredApiBases()
  if (configured) return configured
  if (isLocalSplitSharedRuntime()) return [defaultDmApiBase()]
  return production ? [sameOriginApiBase()] : [defaultDmApiBase()]
}

// 事件（SSE 订阅 + POST + DELETE）只走单一 canonical 端口（DM），
// 与 state/image 的「双发到所有端口」相反。生产 serve 模式下两个独立 static-server 各有一份进程内
// eventBacklog；若事件分发到多个端口，重连/迟到的一端会回放到另一份/空 backlog（C2 分歧 bug）。
// 路由到单一 canonical（已配置时取第一个=DM，否则 defaultDmApiBase）后，全端共享同一份 backlog。
// 注意：故意 NOT 复用 configured 全列表 —— 那正是分歧根因。
export function sharedEventApiCandidates(production = import.meta.env.PROD): string[] {
  const configured = configuredApiBases()
  if (configured && configured.length > 0) return [configured[0]]
  if (isLocalSplitSharedRuntime()) return [defaultDmApiBase()]
  return production ? [sameOriginApiBase()] : [defaultDmApiBase()]
}

async function requestJson<T>(path: string, init?: RequestInit, resourceName?: string): Promise<T | null> {
  let notFound = false
  for (const api of sharedApiCandidates()) {
    try {
      const res = await fetch(sharedSessionUrl(`${api}${path}`), {
        cache: 'no-store',
        ...init,
        headers: {
          ...(init?.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
          ...(init?.headers ?? {}),
          ...sharedAccessHeaders(),
          ...sharedMemberHeaders(),
        },
      })
      if (!res.ok) {
        if (res.status === 404) {
          notFound = true
          const tombstoneRevision = Number(res.headers.get('X-Stars-State-Revision'))
          if (resourceName && Number.isInteger(tombstoneRevision) && tombstoneRevision >= 0) {
            rememberSharedResourceRevisionWatermark(resourceName, tombstoneRevision)
            recordSharedRevision(resourceName, tombstoneRevision)
            return null
          }
        }
        if (res.status === 422 && resourceName) {
          const body = await res.json().catch(() => ({})) as { reason?: string; quarantineId?: string }
          reportSharedIntegrityIssue({
            resource: resourceName,
            reason: body.reason ?? '共享服务已隔离损坏状态',
            source: 'server',
            quarantineId: body.quarantineId,
          })
          return null
        }
        continue
      }
      const value = (await res.json()) as T
      if (resourceName) rememberSharedResourceRevision(resourceName, value, res)
      return value
    } catch {
      // Try the next local endpoint. DM and player ports may be started independently.
    }
  }
  if (resourceName && notFound) {
    rememberSharedResourceRevisionWatermark(resourceName, 0)
    recordSharedRevision(resourceName, 0)
  }
  return null
}

export async function loadSharedResource<T>(name: string): Promise<T | null> {
  const value = await requestJson<unknown>(`/state/${name}`, undefined, name)
  if (value == null) return null
  const validation = validateAndMigrateSharedResource(name, value)
  if (validation.status === 'invalid') {
    reportSharedIntegrityIssue({ resource: name, reason: validation.reasons.join('；'), value })
    return null
  }
  if (validation.status === 'migrated') {
    console.warn(`[共享状态迁移:${name}] ${validation.reasons.join('；')}`)
  }
  return validation.value as T
}

export const SHARED_STATE_CHANGED_CHANNEL = 'shared-state-changed'
export const SHARED_RESOURCE_RECOVERY_MS = 15_000

export interface SharedStateChangedEvent {
  id: string
  name: string
  updatedAt: number
  deleted?: boolean
}

const sharedStateChangedListeners = new Set<(event: SharedStateChangedEvent) => void>()
let stopSharedStateChangedSource: (() => void) | null = null

async function performSharedResourceSave<T>(
  name: string,
  data: T,
  options: SharedResourceWriteOptions = {},
): Promise<SharedResourceSaveResult> {
  if (getRoomSession()?.role === 'spectator') return { status: 'skipped', reason: 'spectator' }
  if (!canWriteSharedState()) {
    if (
      name !== 'characters' &&
      name !== 'dodge' &&
      name !== 'gale-combo' &&
      name !== 'stable-mind' &&
      name !== 'agile-leap' &&
      name !== 'combat-interrupts' &&
      name !== 'player-action' &&
      name !== 'player-action-requests' &&
      name !== 'dice' &&
      name !== 'dice-events' &&
      name !== 'combat-log'
    ) return { status: 'skipped', reason: 'forbidden' }
  }
  const validation = validateAndMigrateSharedResource(name, data)
  if (validation.status === 'invalid') {
    reportSharedIntegrityIssue({ resource: name, reason: `已阻止写入：${validation.reasons.join('；')}`, value: data })
    return { status: 'invalid', reason: 'schema' }
  }
  let serializedBody: string
  try {
    serializedBody = JSON.stringify(validation.value)
  } catch {
    reportSharedIntegrityIssue({ resource: name, reason: '已阻止写入：共享状态无法序列化', value: data })
    return { status: 'invalid', reason: 'serialization' }
  }
  if (new TextEncoder().encode(serializedBody).byteLength > SHARED_STATE_CLIENT_MAX_BYTES) {
    reportSharedIntegrityIssue({
      resource: name,
      reason: '已阻止写入：共享状态超过 8 MiB 上限；请移除或压缩人物立绘等大型内容',
    })
    return { status: 'too-large' }
  }
  const revisionKey = sharedResourceRevisionKey(name)
  if (!sharedResourceRevisions.has(revisionKey)) await requestJson(`/state/${name}`, undefined, name)
  const expectedRevision = sharedResourceRevisions.get(revisionKey) ?? 0
  for (const api of sharedWriteApiCandidates()) {
    try {
      const response = await fetch(sharedSessionUrl(`${api}/state/${name}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...sharedSecretHeader(),
          ...sharedAccessHeaders(),
          ...sharedMemberHeaders(),
          ...sharedProtocolHeaders(),
          'X-Stars-Expected-Revision': String(expectedRevision),
          ...(options.undoGroupId ? { 'X-Stars-Undo-Group': options.undoGroupId } : {}),
          ...(options.undoLabel ? { 'X-Stars-Undo-Label': encodeURIComponent(options.undoLabel) } : {}),
        },
        body: serializedBody,
      })
      const currentRevision = Number(response.headers.get('X-Stars-State-Revision'))
      if (response.status === 409) {
        const body = await response.json().catch(() => ({})) as { currentRevision?: number }
        const resolvedCurrent = Number.isInteger(body.currentRevision) ? Number(body.currentRevision) : currentRevision
        const revision = Number.isInteger(resolvedCurrent) && resolvedCurrent >= 0 ? resolvedCurrent : expectedRevision
        // A conflict response proves that our snapshot is stale, but it does
        // not contain the winning resource value. Do not advance the local CAS
        // watermark until a subsequent GET has actually rebased the store.
        // Otherwise an already-queued HP/healing snapshot could reuse the new
        // revision with old data and overwrite the authoritative result.
        recordSharedConflict(name, expectedRevision, revision)
        const event = { id: `conflict:${name}:${Date.now()}`, name, updatedAt: Date.now() }
        for (const listener of [...sharedStateChangedListeners]) listener(event)
        return { status: 'conflict', expectedRevision, currentRevision: revision }
      }
      if (response.status === 413) {
        reportSharedIntegrityIssue({
          resource: name,
          reason: '服务端拒绝了超过容量上限的共享状态；请移除或压缩人物立绘等大型内容',
          source: 'server',
        })
        return { status: 'too-large' }
      }
      if (!response.ok) continue
      const body = await response.json().catch(() => ({})) as { revision?: number }
      const revision = Number.isInteger(body.revision) ? Number(body.revision) : currentRevision
      if (Number.isInteger(revision) && revision >= 0) {
        rememberSharedResourceRevisionWatermark(name, revision)
        recordSharedWrite(name, revision)
      }
      return {
        status: 'saved',
        ...(Number.isInteger(revision) && revision >= 0 ? { revision } : {}),
      }
    } catch {
      // Try the next configured endpoint only when the canonical endpoint is unavailable.
    }
  }
  return { status: 'failed' }
}

/**
 * Keep writes from one browser ordered per resource. Without this queue two
 * rapid local saves would legitimately share the same expected revision and
 * turn the second local edit into an avoidable CAS conflict.
 */
function enqueueSharedResourceWrite<T>(_name: string, operation: () => Promise<T>): Promise<T> {
  const key = sharedResourceRevisionKey('__all-writes__')
  const previous = sharedResourceWriteChains.get(key) ?? Promise.resolve()
  const current = previous
    .catch(() => {})
    .then(operation)
  sharedResourceWriteChains.set(key, current)
  return current.finally(() => {
    if (sharedResourceWriteChains.get(key) === current) sharedResourceWriteChains.delete(key)
  })
}

export function saveSharedResource<T>(
  name: string,
  data: T,
  options: SharedResourceWriteOptions = {},
): Promise<void> {
  return saveSharedResourceWithResult(name, data, options).then((result) => {
    requireSharedResourceSaved(name, result)
  })
}

/**
 * Saves a shared resource and exposes whether the authoritative server actually
 * accepted it. Stores that maintain monotonic snapshots must use this variant;
 * advancing a local ACK watermark before a successful response can hide the
 * server's conflict recovery snapshot.
 */
export function saveSharedResourceWithResult<T>(
  name: string,
  data: T,
  options: SharedResourceWriteOptions = {},
): Promise<SharedResourceSaveResult> {
  return enqueueSharedResourceWrite(name, () => performSharedResourceSave(name, data, options))
}

export interface SharedResourceTransactionWrite<T = unknown> {
  name: string
  data: T
}

export interface SharedResourceTransactionResult {
  status: 'committed'
  transactionId: string
  revisions: Record<string, number>
}

/**
 * Commits coupled authoritative resources behind one server transaction lock.
 * The endpoint preflights every revision before writing any resource and rolls
 * back already-written files if an I/O failure occurs.
 */
async function performSharedResourcesAtomicSave(
  writes: readonly SharedResourceTransactionWrite[],
  options: SharedResourceWriteOptions & { transactionId?: string } = {},
): Promise<SharedResourceTransactionResult> {
  if (writes.length < 1) throw new Error('shared-state-transaction-empty')
  const normalized = writes.map(({ name, data }) => {
    const validation = validateAndMigrateSharedResource(name, data)
    if (validation.status === 'invalid') {
      throw new Error(`shared-state-transaction-invalid:${name}`)
    }
    return {
      name,
      data: validation.value,
      expectedRevision: sharedResourceRevisions.get(sharedResourceRevisionKey(name)) ?? 0,
    }
  })
  for (const write of normalized) {
    const revisionKey = sharedResourceRevisionKey(write.name)
    if (!sharedResourceRevisions.has(revisionKey)) {
      await requestJson(`/state/${write.name}`, undefined, write.name)
      write.expectedRevision = sharedResourceRevisions.get(revisionKey) ?? 0
    }
  }
  const transactionId = options.transactionId ?? globalThis.crypto?.randomUUID?.() ??
    `state-transaction:${Date.now()}:${Math.random().toString(36).slice(2)}`
  const api = sharedEventApiCandidates()[0]
  if (!api) throw new Error('shared-state-transaction-unavailable')
  const response = await fetch(sharedSessionUrl(`${api}/state/transaction`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...sharedAccessHeaders(),
      ...sharedMemberHeaders(),
      ...sharedProtocolHeaders(),
    },
    body: JSON.stringify({
      transactionId,
      undoGroupId: options.undoGroupId,
      undoLabel: options.undoLabel,
      roomJournalMutations: options.roomJournalMutations,
      writes: normalized,
    }),
  })
  const body = await response.json().catch(() => ({})) as {
    error?: string
    revisions?: Record<string, number>
    conflicts?: Array<{ name: string; currentRevision: number }>
  }
  if (!response.ok) {
    for (const conflict of body.conflicts ?? []) {
      // Keep the pre-transaction watermark until a real read obtains the
      // winning snapshot. This makes queued stale full-state writes fail
      // closed instead of authorizing them with the winner's revision.
      recordSharedConflict(conflict.name, normalized.find((write) => write.name === conflict.name)?.expectedRevision ?? 0, conflict.currentRevision)
      const event = {
        id: `conflict:${conflict.name}:${Date.now()}`,
        name: conflict.name,
        updatedAt: Date.now(),
      }
      for (const listener of [...sharedStateChangedListeners]) listener(event)
    }
    throw new Error(body.error ?? `shared-state-transaction-${response.status}`)
  }
  const revisions = body.revisions ?? {}
  for (const [name, revision] of Object.entries(revisions)) {
    rememberSharedResourceRevisionWatermark(name, revision)
    recordSharedWrite(name, revision)
  }
  return { status: 'committed', transactionId, revisions }
}

export function saveSharedResourcesAtomically(
  writes: readonly SharedResourceTransactionWrite[],
  options: SharedResourceWriteOptions & { transactionId?: string } = {},
): Promise<SharedResourceTransactionResult> {
  return enqueueSharedResourceWrite('__transaction__', () =>
    performSharedResourcesAtomicSave(writes, options))
}

export async function appendSharedPlayerActionRequest<T>(action: T): Promise<void> {
  const api = sharedEventApiCandidates()[0]
  if (!api) throw new Error('player-action-append-unavailable')
  const response = await fetch(sharedSessionUrl(`${api}/state/player-action-requests/append`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...sharedAccessHeaders(),
      ...sharedMemberHeaders(),
      ...sharedProtocolHeaders(),
    },
    body: JSON.stringify({ action }),
  })
  const body = await response.json().catch(() => ({})) as { error?: string; revision?: number }
  if (!response.ok) throw new Error(body.error ?? `player-action-append-${response.status}`)
  if (Number.isInteger(body.revision)) rememberSharedResourceRevisionWatermark('player-action-requests', Number(body.revision))
}

export interface DmUndoTransactionSummary {
  transactionId: string
  label: string
  status: 'applied' | 'undone'
  resources: string[]
  createdAt: number
  updatedAt: number
  undoneAt?: number
}

export async function loadDmUndoHistory(): Promise<DmUndoTransactionSummary[]> {
  for (const api of sharedWriteApiCandidates()) {
    try {
      const response = await fetch(sharedSessionUrl(`${api}/dm/undo`), {
        method: 'GET',
        headers: {
          ...sharedMemberHeaders(),
          ...sharedProtocolHeaders(),
        },
      })
      if (!response.ok) continue
      const body = await response.json() as { transactions?: DmUndoTransactionSummary[] }
      return Array.isArray(body.transactions) ? body.transactions : []
    } catch {
      // Try the next configured endpoint.
    }
  }
  throw new Error('dm-undo-history-unavailable')
}

export async function undoDmTransaction(transactionId?: string): Promise<{
  transaction: DmUndoTransactionSummary
  restored: Array<{ resource: string; revision: number }>
}> {
  for (const api of sharedWriteApiCandidates()) {
    try {
      const response = await fetch(sharedSessionUrl(`${api}/dm/undo`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...sharedMemberHeaders(),
          ...sharedProtocolHeaders(),
        },
        body: JSON.stringify(transactionId ? { transactionId } : {}),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `dm-undo-${response.status}`)
      }
      return await response.json()
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('dm-undo-')) throw error
    }
  }
  throw new Error('dm-undo-unavailable')
}

export async function publishSharedEvent<T>(channel: string, data: T): Promise<void> {
  if (getRoomSession()?.role === 'spectator') return
  const candidates = sharedEventApiCandidates()
  let lastError: unknown = new Error(`shared-event-unavailable:${channel}`)
  for (const api of candidates) {
    try {
      const response = await fetch(sharedSessionUrl(`${api}/events/${encodeURIComponent(channel)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `shared-event-${channel}-${response.status}`)
      }
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export async function clearSharedEventBacklog(channels?: string[]): Promise<void> {
  if (getRoomSession()?.role === 'spectator') return
  const targets = channels && channels.length > 0 ? channels : ['_all']
  const responses = await Promise.all(
    sharedEventApiCandidates().flatMap((api) =>
      targets.map(async (channel) => {
        const response = await fetch(sharedSessionUrl(`${api}/events/${encodeURIComponent(channel)}`), {
          method: 'DELETE',
          headers: { ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
        })
        if (!response.ok) throw new Error(`shared-event-clear-${channel}-${response.status}`)
        return response
      }),
    ),
  )
  if (responses.length < 1) throw new Error('shared-event-clear-unavailable')
}

async function performClearSharedResource(name: string): Promise<void> {
  if (getRoomSession()?.role === 'spectator') return
  const revisionKey = sharedResourceRevisionKey(name)
  if (!sharedResourceRevisions.has(revisionKey)) await requestJson(`/state/${name}`, undefined, name)
  const expectedRevision = sharedResourceRevisions.get(revisionKey) ?? 0
  for (const api of sharedWriteApiCandidates()) {
    try {
      const response = await fetch(sharedSessionUrl(`${api}/state/${encodeURIComponent(name)}`), {
        method: 'DELETE',
        headers: {
          ...sharedAccessHeaders(),
          ...sharedMemberHeaders(),
          ...sharedProtocolHeaders(),
          'X-Stars-Expected-Revision': String(expectedRevision),
        },
      })
      const currentRevision = Number(response.headers.get('X-Stars-State-Revision'))
      if (response.status === 409) {
        const body = await response.json().catch(() => ({})) as { currentRevision?: number }
        const resolvedCurrent = Number.isInteger(body.currentRevision) ? Number(body.currentRevision) : currentRevision
        const revision = Number.isInteger(resolvedCurrent) && resolvedCurrent >= 0 ? resolvedCurrent : expectedRevision
        // A delete conflict needs the same read-before-retry barrier as a save;
        // knowing only the newer revision must not authorize a stale retry.
        recordSharedConflict(name, expectedRevision, revision)
        const event = { id: `conflict:${name}:${Date.now()}`, name, updatedAt: Date.now() }
        for (const listener of [...sharedStateChangedListeners]) listener(event)
        return
      }
      if (!response.ok) continue
      const body = await response.json().catch(() => ({})) as { revision?: number }
      const revision = Number.isInteger(body.revision) ? Number(body.revision) : currentRevision
      if (Number.isInteger(revision) && revision >= 0) {
        rememberSharedResourceRevisionWatermark(name, revision)
        recordSharedWrite(name, revision)
      }
      return
    } catch {
      // Try the next configured endpoint only when the canonical endpoint is unavailable.
    }
  }
}

export function clearSharedResource(name: string): Promise<void> {
  return enqueueSharedResourceWrite(name, () => performClearSharedResource(name))
}

export type SharedCombatInterruptMutation =
  | { operation: 'upsert'; mapId: string; interrupt: object }
  | { operation: 'contribute'; mapId: string; id: string; contribution: object }
  | { operation: 'answer' | 'rolling' | 'finish' | 'wait'; mapId: string; id: string; response?: Record<string, unknown> }
  | { operation: 'rollback'; mapId: string; id: string; response?: Record<string, unknown>; rollbackReason: 'timeout' | 'dm-disconnected' | 'cancelled' | 'stale-transaction' }

export async function mutateSharedCombatInterrupt<T>(mutation: SharedCombatInterruptMutation): Promise<T | null> {
  const api = sharedEventApiCandidates()[0]
  if (!api) return null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(sharedSessionUrl(`${api}/state/combat-interrupts/interrupt`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...sharedSecretHeader(), ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
        body: JSON.stringify(mutation),
      })
      if (res.ok) {
        const value = (await res.json()) as T
        rememberSharedResourceRevision('combat-interrupts', value, res)
        return value
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 409) return null
    } catch {
      // A short retry covers a server restart or a transient local connection loss.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 80 * 2 ** attempt))
  }
  return null
}

export function subscribeSharedEvent<T>(
  channel: string,
  onMessage: (data: T) => void,
): () => void {
  const listeners = sharedEventListeners.get(channel) ?? new Set<(data: unknown) => void>()
  listeners.add(onMessage as (data: unknown) => void)
  sharedEventListeners.set(channel, listeners)
  ensureSharedEventSource()
  return () => {
    const current = sharedEventListeners.get(channel)
    current?.delete(onMessage as (data: unknown) => void)
    if (current?.size === 0) sharedEventListeners.delete(channel)
    if (sharedEventListeners.size === 0) closeSharedEventSource()
  }
}

interface SharedEventEnvelope {
  channel: string
  payload: unknown
  sequence?: number
  streamId?: string
  emittedAt?: number
}

export async function mutateSharedCombatInterruptOrThrow<T>(mutation: SharedCombatInterruptMutation): Promise<T> {
  const result = await mutateSharedCombatInterrupt<T>(mutation)
  if (result == null) throw new Error(`combat-interrupt-mutation-rejected:${mutation.operation}`)
  return result
}

const sharedEventListeners = new Map<string, Set<(data: unknown) => void>>()
let sharedEventSources: EventSource[] = []
let sharedEventStreamId: string | null = null
let lastSharedEventSequence = 0
let sharedEventReconnectTimer: ReturnType<typeof globalThis.setTimeout> | null = null
const SHARED_EVENT_RECONNECT_DELAY_MS = 250

function requestFullSharedRecovery(): void {
  const event: SharedStateChangedEvent = {
    id: `event-gap:${Date.now()}`,
    name: '*',
    updatedAt: Date.now(),
  }
  for (const listener of [...sharedStateChangedListeners]) listener(event)
}

function ensureSharedEventSource(): void {
  if (sharedEventSources.length > 0) return
  for (const api of sharedEventApiCandidates()) {
    try {
      const source = new EventSource(sharedSessionUrl(`${api}/events/_all`, true))
      source.addEventListener('message', (event) => {
        try {
          const envelope = JSON.parse(event.data) as SharedEventEnvelope
          if (!envelope || typeof envelope.channel !== 'string') return
          if (typeof envelope.streamId === 'string' && Number.isInteger(envelope.sequence)) {
            const sequence = Number(envelope.sequence)
            if (sharedEventStreamId && envelope.streamId !== sharedEventStreamId) {
              recordSharedEventGap(lastSharedEventSequence, sequence, true)
              lastSharedEventSequence = 0
              requestFullSharedRecovery()
            }
            sharedEventStreamId = envelope.streamId
            if (sequence <= lastSharedEventSequence) {
              recordDuplicateSharedEvent()
              return
            }
            if (lastSharedEventSequence > 0 && sequence > lastSharedEventSequence + 1) {
              recordSharedEventGap(lastSharedEventSequence, sequence)
              requestFullSharedRecovery()
            }
            lastSharedEventSequence = sequence
            recordSharedEvent(sequence)
          }
          for (const listener of [...(sharedEventListeners.get(envelope.channel) ?? [])]) {
            listener(envelope.payload)
          }
        } catch {
          // Ignore malformed local event payloads.
        }
      })
      source.onerror = () => {
        if (source.readyState !== EventSource.CLOSED) return
        source.close()
        sharedEventSources = sharedEventSources.filter((candidate) => candidate !== source)
        if (sharedEventSources.length === 0 && sharedEventListeners.size > 0 && sharedEventReconnectTimer == null) {
          sharedEventReconnectTimer = globalThis.setTimeout(() => {
            sharedEventReconnectTimer = null
            if (sharedEventListeners.size > 0) ensureSharedEventSource()
          }, SHARED_EVENT_RECONNECT_DELAY_MS)
        }
      }
      sharedEventSources.push(source)
    } catch {
      // Try every local endpoint that is available.
    }
  }
}

function closeSharedEventSource(): void {
  if (sharedEventReconnectTimer != null) {
    globalThis.clearTimeout(sharedEventReconnectTimer)
    sharedEventReconnectTimer = null
  }
  for (const source of sharedEventSources) source.close()
  sharedEventSources = []
  sharedEventStreamId = null
  lastSharedEventSequence = 0
}

function subscribeSharedStateChanged(listener: (event: SharedStateChangedEvent) => void): () => void {
  sharedStateChangedListeners.add(listener)
  if (!stopSharedStateChangedSource) {
    stopSharedStateChangedSource = subscribeSharedEvent<SharedStateChangedEvent>(
      SHARED_STATE_CHANGED_CHANNEL,
      (event) => {
        for (const current of [...sharedStateChangedListeners]) current(event)
      },
    )
  }
  return () => {
    sharedStateChangedListeners.delete(listener)
    if (sharedStateChangedListeners.size === 0 && stopSharedStateChangedSource) {
      stopSharedStateChangedSource()
      stopSharedStateChangedSource = null
    }
  }
}

export function subscribeSharedResourceInvalidation(
  name: string,
  refresh: () => void | Promise<void>,
  options: {
    recoveryMs?: number
    immediate?: boolean
    recoverWhenHidden?: boolean
    refreshOnVisibilityRestore?: boolean
  } = {},
): () => void {
  let disposed = false
  let running = false
  let pending = false

  const run = async () => {
    if (disposed) return
    if (running) {
      pending = true
      return
    }
    running = true
    try {
      do {
        pending = false
        await refresh()
      } while (!disposed && pending)
    } catch (error) {
      console.error(`[shared-state] refresh failed for ${name}`, error)
    } finally {
      running = false
      settleSharedRecovery()
    }
  }

  const unsubscribe = subscribeSharedStateChanged(
    (event) => {
      if (event?.name === name || event?.name === '*') void run()
    },
  )
  if (options.immediate !== false) void run()
  const recoveryMs = Math.max(1_000, options.recoveryMs ?? SHARED_RESOURCE_RECOVERY_MS)
  const timer = globalThis.setInterval(() => {
    if (
      !options.recoverWhenHidden &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) return
    void run()
  }, recoveryMs)
  const visibilityDocument = options.refreshOnVisibilityRestore && typeof document !== 'undefined'
    ? document
    : null
  const handleVisibilityChange = () => {
    if (visibilityDocument?.visibilityState === 'visible') void run()
  }
  visibilityDocument?.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    disposed = true
    globalThis.clearInterval(timer)
    visibilityDocument?.removeEventListener('visibilitychange', handleVisibilityChange)
    unsubscribe()
  }
}

/**
 * Sends a server-authoritative, atomic mutation for append-oriented room resources.
 * Chat and journal entries must never use a client-side read/modify/PUT cycle: an
 * overlapping message would otherwise be lost and a client could forge its author.
 */
export async function mutateSharedRoomResource<T>(
  resourceName: string,
  endpoint: string,
  mutation: unknown,
): Promise<T> {
  let lastError = '共享服务暂时不可用'
  for (const api of sharedEventApiCandidates()) {
    try {
      const response = await fetch(sharedSessionUrl(`${api}${endpoint}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...sharedAccessHeaders(),
          ...sharedMemberHeaders(),
          ...sharedProtocolHeaders(),
        },
        body: JSON.stringify(mutation),
      })
      const body = await response.json().catch(() => ({})) as T & { error?: string }
      if (!response.ok) {
        lastError = body?.error || `共享服务返回 ${response.status}`
        continue
      }
      rememberSharedResourceRevision(resourceName, body, response)
      return body
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError)
}

export async function putSharedImage(
  id: string,
  blob: Blob,
  purpose: 'general' | 'handout' | 'scene-audio' = 'general',
): Promise<boolean> {
  if (!canWriteSharedState()) return false
  for (const api of sharedApiCandidates()) {
    try {
      const res = await fetch(sharedSessionUrl(`${api}/images/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'X-Stars-Image-Purpose': purpose,
          ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders(),
        },
        body: blob,
      })
      if (res.ok) return true
    } catch {
      // Try the next endpoint.
    }
  }
  return false
}

export interface SharedServerClockSample {
  offsetMs: number
  roundTripMs: number
  sampledAt: number
}

/** Uses the lowest-latency sample so synchronized media is independent of client wall-clock skew. */
export async function sampleSharedServerClock(attempts = 3): Promise<SharedServerClockSample | null> {
  const api = sharedEventApiCandidates()[0]
  if (!api) return null
  let best: SharedServerClockSample | null = null
  for (let attempt = 0; attempt < Math.max(1, Math.min(5, attempts)); attempt += 1) {
    const sentAt = Date.now()
    try {
      const response = await fetch(sharedSessionUrl(`${api}/time`), {
        cache: 'no-store',
        headers: { ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
      })
      const receivedAt = Date.now()
      const body = await response.json().catch(() => ({})) as { serverNow?: number }
      if (!response.ok || !Number.isFinite(body.serverNow)) continue
      const sample = {
        offsetMs: Number(body.serverNow) - (sentAt + receivedAt) / 2,
        roundTripMs: Math.max(0, receivedAt - sentAt),
        sampledAt: receivedAt,
      }
      if (!best || sample.roundTripMs < best.roundTripMs) best = sample
    } catch {
      // A later sample or normal shared-state recovery can retry after a server restart.
    }
  }
  return best
}

export async function getSharedImage(id: string): Promise<Blob | undefined> {
  for (const api of sharedApiCandidates()) {
    try {
      const res = await fetch(sharedSessionUrl(`${api}/images/${encodeURIComponent(id)}`), {
        headers: { ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
      })
      if (!res.ok) continue
      return await res.blob()
    } catch {
      // Try the next endpoint.
    }
  }
  return undefined
}

export async function deleteSharedImage(id: string): Promise<void> {
  if (!canWriteSharedState()) return
  await Promise.allSettled(
    sharedWriteApiCandidates().map((api) =>
      fetch(sharedSessionUrl(`${api}/images/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: { ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
      }),
    ),
  )
}
