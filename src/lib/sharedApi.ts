import type{StormCastOriginalPreparationBook,StormCastPreparationIdentity}from'../rulesets/dnd5e/stormCastOriginalPreparation'
import type{BountifulDamageZeroOriginalParent}from'../rulesets/dnd5e/bountifulDamageZeroOriginalParentTypes'
import { canWriteSharedState } from './appMode'
import { getRoomClientId, getRoomSession } from './roomSession'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'
import {
  clearSharedIntegrityIssues,
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
  recordSharedReadFailure,
  recordSharedReadSuccess,
} from './sharedSyncHealth'
import type { RoomJournalMutation } from './roomCommunications'

const SHARED_CLIENT_PROTOCOL_VERSION = CLIENT_SHARED_PROTOCOL_VERSION
export const SHARED_STATE_CLIENT_MAX_BYTES = 8 * 1024 * 1024
const SHARED_REQUEST_TIMEOUT_MS = 5_000
const sharedResourceRevisions = new Map<string, number>()
const sharedResourceWriteChains = new Map<string, Promise<unknown>>()

const COLD_SHARED_RESOURCE_CACHE_TTL_MS = 60_000
const coldSharedResources = new Set([
  'spellbook',
  'custom-monsters',
  'combat-statistics',
  'room-journal',
  'scene-audio-library',
])
const sharedResourceReadCache = new Map<string, {
  name: string
  expiresAt: number
  value: unknown
}>()
const sharedResourceReadRequests = new Map<string, Promise<unknown | null>>()
const sharedResourceReadGenerations = new Map<string, number>()
let sharedResourceReadEpoch = 0

async function fetchSharedCandidate(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), SHARED_REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export type SharedResourceSaveResult =
  | { status: 'saved'; revision?: number }
  | { status: 'skipped'; reason: 'spectator' | 'forbidden' }
  | { status: 'invalid'; reason: 'schema' | 'serialization' }
  | { status: 'too-large' }
  | { status: 'conflict'; expectedRevision: number; currentRevision: number }
  | { status: 'failed' }

export interface SharedResourceWriteOptions {
  /** Atomic transactions only: validate read dependencies without modifying them. */
  readRevisions?: Readonly<Record<string, number>>
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

function sharedResourceReadKey(name: string): string {
  const session = getRoomSession()
  const room = session?.roomId ||
    (import.meta.env.VITE_STARS_ROOM_ID as string | undefined)?.trim() ||
    '__lobby__'
  const member = session?.memberId ?? '__anonymous__'
  const role = session?.role ?? '__anonymous__'
  return `${room}:${member}:${role}:${name}`
}

export function sharedResourceReadCacheTtlMs(name: string): number {
  return coldSharedResources.has(name) ? COLD_SHARED_RESOURCE_CACHE_TTL_MS : 0
}

function invalidateSharedResourceReadCache(name?: string): void {
  for (const [key, entry] of sharedResourceReadCache) {
    if (!name || entry.name === name) sharedResourceReadCache.delete(key)
  }
  if (!name) {
    sharedResourceReadEpoch += 1
    sharedResourceReadRequests.clear()
    return
  }
  sharedResourceReadGenerations.set(name, (sharedResourceReadGenerations.get(name) ?? 0) + 1)
  for (const [key] of sharedResourceReadRequests) {
    if (key.endsWith(`:${name}`)) sharedResourceReadRequests.delete(key)
  }
}

export function resetSharedResourceReadCacheForTests(): void {
  invalidateSharedResourceReadCache()
  sharedResourceReadGenerations.clear()
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
  const currentPort = window.location.port
  const port = currentPort.startsWith('617') ? '6173'
    : currentPort.startsWith('647') ? '6473'
      : '5273'
  return `${window.location.protocol}//${window.location.hostname}:${port}/api`
}

function sameOriginApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5273/api'
  const sameOrigin = `${window.location.origin}/api`
  return sameOrigin
}

const LOCAL_SPLIT_SHARED_PORTS = new Set([
  '5273', '5274', '5275', '5276',
  // Local preview/QA builds may be served from alternate static ports while
  // the canonical shared API remains on the DM runtime at 5273.
  '6173', '6174', '6175', '6176',
  '6473', '6474', '6475', '6476',
])

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

/** Single canonical endpoint: acquire must never be replayed after an ambiguous response. */
export async function sendLongCastingOwnerCommand(roomId:string,memberId:string,command:unknown,signal:AbortSignal):Promise<{status:number;body:Record<string,unknown>}>{
  const session=getRoomSession()
  if(session?.role!=='dm'||session.roomId!==roomId||session.memberId!==memberId)throw Error('casting-owner-room-changed')
  const api=sharedEventApiCandidates()[0]
  if(!api)throw Error('casting-owner-api-unavailable')
  const response=await fetch(sharedSessionUrl(`${api}/rooms/${encodeURIComponent(roomId)}/long-casting-owner`),{
    method:'POST',signal,cache:'no-store',
    headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},
    body:JSON.stringify(command),
  })
  const body:unknown=await response.json()
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid-casting-owner-response')
  return {status:response.status,body:body as Record<string,unknown>}
}

async function requestJson<T>(path: string, init?: RequestInit, resourceName?: string): Promise<T | null> {
  let notFound = false
  for (const api of sharedApiCandidates()) {
    try {
      const res = await fetchSharedCandidate(sharedSessionUrl(`${api}${path}`), {
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

export function loadSharedResource<T>(name: string): Promise<T | null> {
  const key = sharedResourceReadKey(name)
  const ttlMs = sharedResourceReadCacheTtlMs(name)
  const requestEpoch = sharedResourceReadEpoch
  const requestGeneration = sharedResourceReadGenerations.get(name) ?? 0
  const cached = sharedResourceReadCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as T)
  }
  if (cached) sharedResourceReadCache.delete(key)

  const activeRequest = sharedResourceReadRequests.get(key)
  if (activeRequest) return activeRequest as Promise<T | null>

  const request = (async (): Promise<T | null> => {
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
    clearSharedIntegrityIssues(name)
    const normalized = validation.value as T
    if (
      ttlMs > 0 &&
      sharedResourceReadEpoch === requestEpoch &&
      (sharedResourceReadGenerations.get(name) ?? 0) === requestGeneration
    ) {
      sharedResourceReadCache.set(key, {
        name,
        expiresAt: Date.now() + ttlMs,
        value: normalized,
      })
    }
    return normalized
  })()
  sharedResourceReadRequests.set(key, request)
  return request.finally(() => {
    if (sharedResourceReadRequests.get(key) === request) sharedResourceReadRequests.delete(key)
  })
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
      const response = await fetchSharedCandidate(sharedSessionUrl(`${api}/state/${name}`), {
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
        invalidateSharedResourceReadCache(name)
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
      invalidateSharedResourceReadCache(name)
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
  /** Revision of the exact snapshot used to compute this transaction. */
  expectedRevision?: number
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
  const normalized = writes.map(({ name, data, expectedRevision }) => {
    if (expectedRevision != null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) throw new Error(`shared-state-transaction-invalid-revision:${name}`)
    const validation = validateAndMigrateSharedResource(name, data)
    if (validation.status === 'invalid') {
      throw new Error(`shared-state-transaction-invalid:${name}`)
    }
    return {
      name,
      data: validation.value,
      expectedRevision: expectedRevision ?? sharedResourceRevisions.get(sharedResourceRevisionKey(name)) ?? 0,
    }
  })
  for (const write of normalized) {
    const revisionKey = sharedResourceRevisionKey(write.name)
    if (!sharedResourceRevisions.has(revisionKey) && writes.find(candidate => candidate.name === write.name)?.expectedRevision == null) {
      await requestJson(`/state/${write.name}`, undefined, write.name)
      write.expectedRevision = sharedResourceRevisions.get(revisionKey) ?? 0
    }
  }
  const transactionId = options.transactionId ?? globalThis.crypto?.randomUUID?.() ??
    `state-transaction:${Date.now()}:${Math.random().toString(36).slice(2)}`
  const api = sharedEventApiCandidates()[0]
  if (!api) throw new Error('shared-state-transaction-unavailable')
  const response = await fetchSharedCandidate(sharedSessionUrl(`${api}/state/transaction`), {
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
      readRevisions: options.readRevisions,
      writes: normalized,
    }),
  })
  const body = await response.json().catch(() => ({})) as {
    error?: string
    name?: string
    reason?: string
    revisions?: Record<string, number>
    conflicts?: Array<{ name: string; currentRevision: number }>
  }
  if (!response.ok) {
    for (const conflict of body.conflicts ?? []) {
      // Keep the pre-transaction watermark until a real read obtains the
      // winning snapshot. This makes queued stale full-state writes fail
      // closed instead of authorizing them with the winner's revision.
      recordSharedConflict(conflict.name, normalized.find((write) => write.name === conflict.name)?.expectedRevision ?? 0, conflict.currentRevision)
      invalidateSharedResourceReadCache(conflict.name)
      const event = {
        id: `conflict:${conflict.name}:${Date.now()}`,
        name: conflict.name,
        updatedAt: Date.now(),
      }
      for (const listener of [...sharedStateChangedListeners]) listener(event)
    }
    const conflictResources = (body.conflicts ?? [])
      .map((conflict) => conflict.name)
      .filter(Boolean)
      .join(',')
    throw new Error(
      `${body.error ?? `shared-state-transaction-${response.status}`}` +
      (body.name ? `:${body.name}` : '') +
      (body.reason ? `:${body.reason}` : '') +
      (conflictResources ? `:${conflictResources}` : ''),
    )
  }
  const revisions = body.revisions ?? {}
  for (const [name, revision] of Object.entries(revisions)) {
    invalidateSharedResourceReadCache(name)
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

/** Dedicated authenticated transport; its server routes validate the original
 * prefix/controller. No generic shared-state upload can mint these facts. */
export async function requestSharedScBasePrefix<T>(operation:'begin'|'issue'|'raw'|'confirm'|'request',input:unknown):Promise<T>{
  const candidates=sharedApiCandidates()
  if(!candidates.length)throw Error('sc-base-prefix-unavailable')
  let lastError:unknown
  for(const api of candidates){
    let response:Response
    try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/sc-base-prefix/${operation}${operation==='request'?`?requestId=${encodeURIComponent((input as {requestId:string}).requestId)}`:''}`),{
      method:operation==='request'?'GET':'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},...(operation==='request'?{}:{body:JSON.stringify(input)}),
    })}catch(error){lastError=error;continue}
    const body=await response.json() as T&{error?:string}
    if(!response.ok)throw Error(body.error??`sc-base-prefix-${response.status}`)
    return body
  }
  throw lastError??Error('sc-base-prefix-unavailable')
}

export async function appendSharedPlayerActionRequest<T>(action: T): Promise<void> {
  let lastError: unknown = new Error('player-action-append-unavailable')
  for (const api of sharedApiCandidates()) {
    try {
      const response = await fetchSharedCandidate(
        sharedSessionUrl(`${api}/state/player-action-requests/append`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...sharedAccessHeaders(),
            ...sharedMemberHeaders(),
            ...sharedProtocolHeaders(),
          },
          body: JSON.stringify({ action }),
        },
      )
      const body = await response.json().catch(() => ({})) as { error?: string; revision?: number }
      if (!response.ok) throw new Error(body.error ?? `player-action-append-${response.status}`)
      if (Number.isInteger(body.revision)) {
        rememberSharedResourceRevisionWatermark('player-action-requests', Number(body.revision))
      }
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export async function submitSharedPlayerCharacterCommand(
  command: Record<string, unknown> & { commandId: string },
): Promise<{ revision: number; result: Record<string, unknown> }> {
  let lastError: unknown = new Error('player-character-command-unavailable')
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await loadSharedResource('characters')
    const expectedRevision = getSharedResourceRevisionWatermark('characters')
    for (const api of sharedApiCandidates()) {
      try {
        const response = await fetchSharedCandidate(
          sharedSessionUrl(`${api}/state/characters/command`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...sharedAccessHeaders(),
              ...sharedMemberHeaders(),
              ...sharedProtocolHeaders(),
            },
            body: JSON.stringify({ expectedRevision, command }),
          },
        )
        const body = await response.json().catch(() => ({})) as {
          error?: string
          currentRevision?: number
          revision?: number
          result?: Record<string, unknown>
        }
        if (response.status === 409 && attempt === 0) {
          invalidateSharedResourceReadCache('characters')
          break
        }
        if (!response.ok) throw new Error(body.error ?? `player-character-command-${response.status}`)
        const revision = Number(body.revision)
        if (!Number.isSafeInteger(revision) || revision < 0) {
          throw new Error('player-character-command-invalid-revision')
        }
        invalidateSharedResourceReadCache('characters')
        rememberSharedResourceRevisionWatermark('characters', revision)
        recordSharedWrite('characters', revision)
        return { revision, result: body.result ?? {} }
      } catch (error) {
        lastError = error
      }
    }
  }
  throw lastError
}

export interface DmUndoTransactionSummary {
  details?: string[]
  transactionId: string
  label: string
  status: 'applied' | 'undone'
  resources: string[]
  createdAt: number
  updatedAt: number
  undoneAt?: number
  combatRecoverable?: boolean
  combat?: {
    beforeActorId?: string
    beforeActorLabel?: string
    beforeSlotId?: string
    afterActorId?: string
    afterActorLabel?: string
    afterSlotId?: string
    beforeActive?: boolean
    afterActive?: boolean
    mapId?: string
    combatId?: string
    beforeRound?: number
    afterRound?: number
    beforeInitiativeIndex?: number
    afterInitiativeIndex?: number
  }
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

export async function recoverDmCombatToTransaction(transactionId: string): Promise<{
  transaction: DmUndoTransactionSummary
  transactions: DmUndoTransactionSummary[]
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
        body: JSON.stringify({ transactionId, mode: 'combat-cascade' }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `dm-combat-recovery-${response.status}`)
      }
      return await response.json()
    } catch (error) {
      if (error instanceof Error && (
        error.message.startsWith('dm-undo-') ||
        error.message.startsWith('dm-combat-recovery-')
      )) throw error
    }
  }
  throw new Error('dm-combat-recovery-unavailable')
}

export async function publishSharedEvent<T>(channel: string, data: T): Promise<void> {
  if (getRoomSession()?.role === 'spectator') return
  const candidates = sharedEventApiCandidates()
  let lastError: unknown = new Error(`shared-event-unavailable:${channel}`)
  for (const api of candidates) {
    try {
      const response = await fetchSharedCandidate(sharedSessionUrl(`${api}/events/${encodeURIComponent(channel)}`), {
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
      const response = await fetchSharedCandidate(sharedSessionUrl(`${api}/state/${encodeURIComponent(name)}`), {
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
        invalidateSharedResourceReadCache(name)
        const event = { id: `conflict:${name}:${Date.now()}`, name, updatedAt: Date.now() }
        for (const listener of [...sharedStateChangedListeners]) listener(event)
        return
      }
      if (!response.ok) continue
      invalidateSharedResourceReadCache(name)
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
  | { operation: 'roll-options'; mapId: string; id: string; rollOptions: { contributionId: string; values: number[] } }
  | { operation: 'answer' | 'rolling' | 'finish' | 'wait'; mapId: string; id: string; response?: Record<string, unknown> }
  | { operation: 'rollback'; mapId: string; id: string; response?: Record<string, unknown>; rollbackReason: 'timeout' | 'dm-disconnected' | 'cancelled' | 'stale-transaction' }

export async function mutateSharedCombatInterrupt<T>(mutation: SharedCombatInterruptMutation): Promise<T | null> {
  const api = sharedEventApiCandidates()[0]
  if (!api) return null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetchSharedCandidate(sharedSessionUrl(`${api}/state/combat-interrupts/interrupt`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...sharedSecretHeader(), ...sharedAccessHeaders(), ...sharedMemberHeaders(), ...sharedProtocolHeaders() },
        body: JSON.stringify(mutation),
      })
      if (res.ok) {
        const value = (await res.json()) as T
        rememberSharedResourceRevision('combat-interrupts', value, res)
        // Do not wait for this client's own SSE echo before reflecting a
        // successful interrupt mutation. In particular, choice-reroll uses a
        // two-stage contribution -> Host roll -> selection flow; a stale local
        // prompt otherwise looks like a dead button and can time out before the
        // new roll options are rendered.
        invalidateSharedResourceReadCache('combat-interrupts')
        const updatedAt = value && typeof value === 'object'
          ? Number((value as { updatedAt?: unknown }).updatedAt)
          : Number.NaN
        const event: SharedStateChangedEvent = {
          id: `local:combat-interrupts:${Date.now()}`,
          name: 'combat-interrupts',
          updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        }
        for (const listener of [...sharedStateChangedListeners]) listener(event)
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
  invalidateSharedResourceReadCache()
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
        invalidateSharedResourceReadCache(event?.name === '*' ? undefined : event?.name)
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
  const healthKey = `${name}:${Math.random().toString(36).slice(2)}`
  let failures = 0
  let retryAfter = 0

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
      failures = 0
      retryAfter = 0
      recordSharedReadSuccess(healthKey)
    } catch (error) {
      if (!disposed) {
        if (failures === 0) console.error(`[shared-state] refresh failed for ${name}`, error)
        failures += 1
        retryAfter = Date.now() + Math.min(60_000, 1_000 * 2 ** Math.min(failures, 6))
        recordSharedReadFailure(healthKey)
      }
    } finally {
      running = false
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
    if (Date.now() < retryAfter) return
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
    recordSharedReadSuccess(healthKey)
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
      invalidateSharedResourceReadCache(resourceName)
      rememberSharedResourceRevision(resourceName, body, response)
      return body
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError)
}

export class SharedStorageQuotaError extends Error {
  constructor() { super('账号素材空间不足。请在个人资料查看用量，清理不需要的素材或联系管理员升级。已有素材不会删除。') }
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
      if (res.status === 413) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        if (body.error === 'account-storage-quota-exceeded') throw new SharedStorageQuotaError()
      }
    } catch (error) {
      if (error instanceof SharedStorageQuotaError) throw error
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

/** Idempotent by the private Host-issued request identity. This endpoint cannot
 * issue a request, replace its locked raw, or confirm any result. */
export async function submitSharedActivityDeathInitiativeRaw(input:{requestId:string;rollerTokenId:string;sides:number;values:readonly number[]}):Promise<void>{
 if(!input.requestId.startsWith('host-death-init:'))return
 let failure:unknown=new Error('death-initiative-raw-unavailable')
 for(const api of sharedApiCandidates()){
  try{
   const response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/activity-death-initiative/raw`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})
   const result=await response.json().catch(()=>({})) as {error?:string;requestId?:string}
   if(!response.ok)throw Error(result.error??`death-initiative-raw-${response.status}`)
   if(result.requestId!==input.requestId)throw Error('death-initiative-raw-identity-mismatch')
   return
  }catch(error){failure=error}
 }
 throw failure
}

/** Collects only a genuine server-stamped original-owner answer. */
export async function submitSharedActivityDeathChoice(input:{parentId:string;receiptId:string}):Promise<void>{
 let failure:unknown=new Error('death-choice-accept-unavailable')
 for(const api of sharedApiCandidates()){
  try{
   const response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/activity-death-choice/accept`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})
   const result=await response.json().catch(()=>({})) as {error?:string;receiptId?:string;parentId?:string}
   if(!response.ok)throw Error(result.error??`death-choice-accept-${response.status}`)
   if(result.receiptId!==input.receiptId||result.parentId!==input.parentId)throw Error('death-choice-accept-identity-mismatch')
   return
  }catch(error){failure=error}
 }
 throw failure
}

/** Authenticated original Armor controller raw, never a Host proxy for a PC. */
export async function submitSharedArmorNativeRaw(input:{requestId:string;rollerTokenId:string;sides:number;values:readonly number[]}):Promise<void>{
 if(!input.requestId.startsWith('host-armor-d6:'))throw Error('armor-native-raw-issued-request-required')
 let failure:unknown=Error('armor-native-raw-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/armor-native/raw`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)});const result=await response.json().catch(()=>({})) as{error?:string;requestId?:string};if(!response.ok)throw Error(result.error??`armor-native-raw-${response.status}`);if(result.requestId!==input.requestId)throw Error('armor-native-raw-identity-mismatch');return}catch(error){failure=error}}throw failure
}
export async function submitSharedArmorNativeChoice(parentId:string):Promise<void>{
 let failure:unknown=Error('armor-native-choice-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/armor-native/accept-choice`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify({parentId})});const result=await response.json().catch(()=>({})) as{error?:string;requestId?:string};if(!response.ok)throw Error(result.error??`armor-native-choice-${response.status}`);if(result.requestId!==parentId)throw Error('armor-native-choice-identity-mismatch');return}catch(error){failure=error}}throw failure
}

/** One authenticated request. A failed/lost POST is re-read, never silently re-sent. */
export async function requestSharedArcaneNative<T>(operation:'requests'|'choice',input?:unknown):Promise<T>{
  const session=getRoomSession(),api=sharedApiCandidates()[0]
  if(!session||!['dm','player'].includes(session.role)||!api)throw Error('arcane-native-room-required')
  const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/arcane-native/'+operation),{
    method:operation==='requests'?'GET':'POST',cache:'no-store',
    headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},
    ...(operation==='choice'?{body:JSON.stringify(input)}:{}),
  })
  if(!response.ok)throw Error('arcane-native-transport:'+response.status)
  if(operation==='choice')invalidateSharedResourceReadCache('arcane-native-parents')
  return await response.json() as T
}

/** Exact Arcane original-prefix endpoint. No implicit POST retries. */
export async function requestSharedArcaneBasePrefix<T>(operation:'request'|'begin'|'issue'|'raw'|'confirm',input:Record<string,unknown>):Promise<T>{
 const session=getRoomSession(),api=sharedApiCandidates()[0]
 if(!session||!['dm','player'].includes(session.role)||!api)throw Error('arcane-prefix-room-required')
 const url=sharedSessionUrl(api+'/state/arcane-base-prefix/'+operation),requestUrl=operation==='request'?url+(url.includes('?')?'&':'?')+'requestId='+encodeURIComponent(String(input.requestId??'')):url
 const response=await fetchSharedCandidate(requestUrl,{method:operation==='request'?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},...(operation==='request'?{}:{body:JSON.stringify(input)})})
 if(!response.ok)throw Error('arcane-prefix-transport:'+response.status)
 if(operation!=='request')invalidateSharedResourceReadCache('arcane-base-prefix-rolls')
 return await response.json()as T
}

/** Dedicated owner/Host observation facts; generic shared-state writes are forbidden. */
export async function requestSharedMastermindObservation<T>(operation:'request'|'accept'|'interval'|'interrupt'|'disclose'|'project'|'list',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('观察服务暂时不可用，请确认房间连接。')
 let lastError:unknown
 for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-observation/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}
 const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'观察状态已改变，请重新查看。');return body}
 throw lastError??Error('观察服务暂时不可用，请确认房间连接。')
}


/** A private original-input ledger; this endpoint never returns native result authority. */
export async function requestSharedMastermindSpellWindow<T>(operation:'ward-choice-list'|'begin'|'register'|'ward-register'|'ward-complete'|'ward-bountiful-register'|'ward-bountiful-choice'|'ward-bountiful-raw'|'ward-bountiful-confirm'|'ward-bountiful-complete'|'ward-bountiful-project'|'ward-outcome-register'|'ward-outcome'|'ward-retarget-propose'|'ward-retarget-accept'|'ward-retarget-reject'|'issue'|'raw'|'confirm'|'complete'|'abort-extra'|'source'|'request',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('spell-window-room-unavailable')
 const requestId=input&&typeof input==='object'&&'requestId'in input&&typeof input.requestId==='string'?input.requestId:''
 let lastError:unknown;for(const api of candidates){const target=sharedSessionUrl(api+'/state/mastermind-spell-window/'+operation),url=operation==='request'?target+(target.includes('?')?'&':'?')+'requestId='+encodeURIComponent(requestId):target;let response:Response;try{response=await fetchSharedCandidate(url,{method:operation==='request'?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},...(operation==='request'?{}:{body:JSON.stringify(input)})})}catch(error){lastError=error;continue}const body=await response.json()as T&{error?:string};if(!response.ok)throw Error(body.error??'spell-window-transport:'+response.status);return body}throw lastError??Error('spell-window-room-unavailable')
}

export async function requestSharedMastermindWardOriginal<T>(operation:'register'|'request'|'raw'|'confirm'|'complete'|'abort-extra',input:unknown):Promise<T>{const candidates=sharedApiCandidates();if(!candidates.length)throw Error('原豁免骰服务暂时不可用。');let lastError:unknown;for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-ward-original/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'原豁免或控制权已改变。');return body}throw lastError??Error('原豁免骰服务暂时不可用。')}
export async function requestSharedMastermindWardSavingChoice<T>(operation:'register'|'request'|'list'|'answer'|'raw'|'confirm'|'complete',input:unknown):Promise<T>{const candidates=sharedApiCandidates();if(!candidates.length)throw Error('本次豁免选择服务暂时不可用。');let lastError:unknown;for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-ward-saving/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'原豁免或控制权已改变。');return body}throw lastError??Error('本次豁免选择服务暂时不可用。')}

export async function requestSharedMastermindWardAttack<T>(operation:'issue'|'answer'|'project'|'list',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('攻击选择服务暂时不可用，请确认房间连接。')
 let lastError:unknown
 for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-ward-attack/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}
 const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'原攻击或控制权已改变，请重新查看。');return body}
 throw lastError??Error('攻击选择服务暂时不可用，请确认房间连接。')
}

export async function requestSharedMastermindMisdirection<T>(operation:'begin'|'begin-native'|'answer'|'project'|'list',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('攻击转移服务暂时不可用，请确认房间连接。')
 let lastError:unknown
 for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-misdirection/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}
 const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'攻击转移状态已改变，请重新查看。');return body}
 throw lastError??Error('攻击转移服务暂时不可用，请确认房间连接。')
}

/** Exact ordinary-movement endpoints. Original request identity is issued by Host. */
export async function requestSharedArcaneMovement<T>(operation:'request'|'requests'|'begin'|'issue'|'raw'|'confirm'|'checkpoint'|'choice',input:Record<string,unknown>={}):Promise<T>{
 const session=getRoomSession(),api=sharedApiCandidates()[0];if(!session||!['dm','player'].includes(session.role)||!api)throw Error('arcane-move-room-required')
 const get=operation==='request'||operation==='requests',url=sharedSessionUrl(api+'/state/arcane-movement/'+operation),target=operation==='request'?url+(url.includes('?')?'&':'?')+'requestId='+encodeURIComponent(String(input.requestId??'')):url
 try{const response=await fetchSharedCandidate(target,{method:get?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},...(get?{}:{body:JSON.stringify(input)})});if(!response.ok)throw Error('arcane-move-transport:'+response.status);return await response.json()as T}finally{if(!get)invalidateSharedResourceReadCache('arcane-movement-parents')}
}

export async function requestSharedMastermindThoughtReading<T>(operation:'begin-native'|'begin'|'answer'|'project'|'list'|'issue-roll'|'raw'|'confirm'|'roll-request'|'read-result'|'read-results',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('思想读取服务暂时不可用，请确认房间连接。')
 let lastError:unknown
 for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-thought-reading/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}
 const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'思想读取状态已改变，请重新查看。');return body}
 throw lastError??Error('思想读取服务暂时不可用，请确认房间连接。')
}
export async function requestSharedMastermindMagicTruth<T>(operation:'begin'|'begin-native'|'answer'|'project'|'list',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('魔法显现服务暂时不可用，请确认房间连接。')
 let lastError:unknown
 for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-magic-truth/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}
 const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'魔法显现状态已改变，请重新查看。');return body}
 throw lastError??Error('魔法显现服务暂时不可用，请确认房间连接。')
}

import type{BountifulOpportunitySequencePrivateBook}from'../rulesets/dnd5e/bountifulOpportunitySequencePrefixWindow'
/** Host-only original-roll book for the actual queued move. Ordinary room
 * resource reads cannot expose another player's protected physical faces. */
export async function readBountifulOpportunitySequenceBook(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulOpportunitySequencePrivateBook>{
 let failure:unknown=new Error('opportunity-sequence:private-source-unavailable')
 for(const api of sharedApiCandidates()){
  try{
   const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-opportunity-sequence/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})
   const result=await response.json().catch(()=>null)as(BountifulOpportunitySequencePrivateBook&{error?:string})|null
   if(!response.ok)throw Error(result?.error??'opportunity-sequence:private-source-'+response.status)
   if(!result?.source||!Array.isArray(result.rows)||!Array.isArray(result.prefixSettlementRolls)||result.rows.some(row=>!row.originalIssuer||!['dm','player'].includes(row.originalIssuer.mode)||!Number.isSafeInteger(row.originalIssuer.cursor)))throw Error('opportunity-sequence:invalid-private-source-response')
   return result
  }catch(error){failure=error}
 }
 throw failure
}

import type{BountifulDamageZeroOriginalRawBook}from'../rulesets/dnd5e/bountifulDamageZeroOriginalRaw'
/** Protected original save faces are read only by the authenticated Host. */
export async function readBountifulDamageZeroOriginalBook(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulDamageZeroOriginalRawBook>{
 let failure:unknown=Error('damage-zero-original:private-source-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-damage-zero-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),result=await response.json().catch(()=>null)as(BountifulDamageZeroOriginalRawBook&{error?:string})|null;if(!response.ok)throw Error(result?.error??'damage-zero-original:private-source-'+response.status);if(!result?.ok||result.sourceKind!=='damage-zero-original-v1'||!result.source||!Array.isArray(result.rows))throw Error('damage-zero-original:invalid-private-source-response');return result}catch(error){failure=error}}throw failure
}

/** Only an authenticated canonical pending weapon parent may report absence.
 * A stale issued source always rejects; it must never trigger a physical reroll. */
export async function findBountifulDamageZeroOriginalBook(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulDamageZeroOriginalRawBook|undefined>{
 let failure:unknown=Error('damage-zero-original:private-probe-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-damage-zero-original/probe'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),result=await response.json().catch(()=>null)as(Omit<Partial<BountifulDamageZeroOriginalRawBook>,'sourceKind'>&{sourceKind?:string;present?:boolean;error?:string})|null;if(!response.ok)throw Error(result?.error??'damage-zero-original:private-probe-'+response.status);if(!result?.ok||result.parentId!==input.parentId||result.mapId!==input.mapId||result.combatId!==input.combatId)throw Error('damage-zero-original:invalid-private-probe-response');if(result.present===false&&result.sourceKind==='damage-zero-original-probe-v1')return undefined;if(result.present!==true||result.sourceKind!=='damage-zero-original-v1'||!result.source||!Array.isArray(result.rows))throw Error('damage-zero-original:invalid-private-probe-response');return result as BountifulDamageZeroOriginalRawBook}catch(error){failure=error}}throw failure
}

export async function inspectBountifulDamageZeroOriginalParent(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulDamageZeroOriginalParent|undefined>{
 let failure:unknown=Error('damage-zero-original:private-parent-unavailable');for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-damage-zero-original/probe'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),result=await response.json().catch(()=>null)as Record<string,unknown>|null;if(!response.ok)throw Error(typeof result?.error==='string'?result.error:'damage-zero-original:private-parent-'+response.status);if(!result?.ok||result.parentId!==input.parentId||result.mapId!==input.mapId||result.combatId!==input.combatId)throw Error('damage-zero-original:invalid-private-parent-response');if(result.present===false&&result.sourceKind==='damage-zero-original-probe-v1')return undefined;if(result.present!==true||!['damage-zero-preparation-v1','damage-zero-original-v1'].includes(result.sourceKind as string)||!result.source||!result.frame||typeof result.prefixSignature!=='string'||typeof result.effectTimestamp!=='number'||result.sourceKind==='damage-zero-preparation-v1'&&Object.hasOwn(result,'rows')||result.sourceKind==='damage-zero-original-v1'&&(!Array.isArray(result.rows)||!result.labels))throw Error('damage-zero-original:invalid-private-parent-response');return result as unknown as BountifulDamageZeroOriginalParent}catch(error){failure=error}}throw failure
}

/** A reachable private authority rejection never becomes optional absence. */
export async function readStormCastOriginalPreparationBook(input:StormCastPreparationIdentity):Promise<StormCastOriginalPreparationBook|undefined>{
 let networkFailure:unknown=Error('storm-cast-preparation:private-probe-unavailable')
 for(const api of sharedApiCandidates()){
  let response:Response
  try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/storm-cast-preparation/probe'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){networkFailure=error;continue}
  const result=await response.json().catch(()=>null)as Record<string,unknown>|null
  if(!response.ok)throw Error(typeof result?.error==='string'?result.error:'storm-cast-preparation:private-probe-'+response.status)
  if(!result?.ok||result.parentId!==input.parentId||result.mapId!==input.mapId||result.combatId!==input.combatId)throw Error('storm-cast-preparation:invalid-private-probe-response')
  if(result.present===false&&result.sourceKind==='storm-cast-preparation-probe-v1')return undefined
  if(result.present!==true||result.sourceKind!=='storm-cast-preparation-v1'||!result.source||!result.frame||typeof result.prefixSignature!=='string'||typeof result.effectTimestamp!=='number')throw Error('storm-cast-preparation:invalid-private-probe-response')
  return result as unknown as StormCastOriginalPreparationBook
 }
 throw networkFailure
}

/** A reachable private authority rejection never becomes optional absence. */
export async function readTempestuousBeforeOriginalPreparationBook(input:import('../rulesets/dnd5e/tempestuousBeforeOriginalPreparation').TempestuousBeforePreparationIdentity):Promise<import('../rulesets/dnd5e/tempestuousBeforeOriginalPreparation').TempestuousBeforeOriginalPreparationBook|undefined>{
 let networkFailure:unknown=Error('tempestuous-before-preparation:private-probe-unavailable')
 for(const api of sharedApiCandidates()){
  let response:Response
  try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/tempestuous-before-preparation/probe'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){networkFailure=error;continue}
  const result=await response.json().catch(()=>null)as Record<string,unknown>|null
  if(!response.ok)throw Error(typeof result?.error==='string'?result.error:'tempestuous-before-preparation:private-probe-'+response.status)
  if(!result?.ok||result.parentId!==input.parentId||result.mapId!==input.mapId||result.combatId!==input.combatId)throw Error('tempestuous-before-preparation:invalid-private-probe-response')
  if(result.present===false&&result.sourceKind==='tempestuous-before-preparation-probe-v1')return undefined
  if(result.present!==true||result.sourceKind!=='tempestuous-before-preparation-v1'||!result.source||!result.frame||!result.preparation||typeof result.prefixSignature!=='string'||typeof result.effectTimestamp!=='number')throw Error('tempestuous-before-preparation:invalid-private-probe-response')
  return result as unknown as import('../rulesets/dnd5e/tempestuousBeforeOriginalPreparation').TempestuousBeforeOriginalPreparationBook
 }
 throw networkFailure
}

/** The protected missing-caster preparation is readable only by its actual Host. */
export async function readSpellcastingOriginalPreparationBook(input:import('../rulesets/dnd5e/spellcastingOriginalPreparation').SpellcastingOriginalPreparationIdentity):Promise<import('../rulesets/dnd5e/spellcastingOriginalPreparation').SpellcastingOriginalPreparationBook>{
 let networkFailure:unknown=Error('spellcasting-preparation:private-source-unavailable')
 for(const api of sharedApiCandidates()){
  let response:Response
  try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/spellcasting-original-preparation/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){networkFailure=error;continue}
  const result=await response.json()
  if(!response.ok)throw Error(typeof result?.error==='string'?result.error:'spellcasting-preparation:private-source-'+response.status)
  if(!result?.ok||result.sourceKind!=='spellcasting-original-preparation-v1'||!['parentId','mapId','combatId','effectId'].every(key=>result[key]===input[key as keyof typeof input])||!result.source||!result.requirement||typeof result.prefixSignature!=='string'||!Number.isSafeInteger(result.effectTimestamp)||typeof result.earlierStorm!=='boolean')throw Error('spellcasting-preparation:invalid-private-source-response')
  return result
 }
 throw networkFailure
}

import type{BountifulSpellDamageZeroOriginalParent}from'../rulesets/dnd5e/bountifulSpellDamageZeroOriginalParentTypes'
import type{BountifulSpellDamageZeroOriginalRawBook}from'../rulesets/dnd5e/bountifulSpellDamageZeroOriginalRaw'
/** Protected original save faces are read only by the authenticated Host. */
export async function readBountifulSpellDamageZeroOriginalBook(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulSpellDamageZeroOriginalRawBook>{
 let failure:unknown=Error('damage-zero-original:private-source-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-spell-damage-zero-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),result=await response.json().catch(()=>null)as(BountifulSpellDamageZeroOriginalRawBook&{error?:string})|null;if(!response.ok)throw Error(result?.error??'damage-zero-original:private-source-'+response.status);if(!result?.ok||result.sourceKind!=='spell-damage-zero-original-v1'||!result.source||!Array.isArray(result.rows))throw Error('damage-zero-original:invalid-private-source-response');return result}catch(error){failure=error}}throw failure
}

/** Only an authenticated canonical pending weapon parent may report absence.
 * A stale issued source always rejects; it must never trigger a physical reroll. */
export async function findBountifulSpellDamageZeroOriginalBook(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulSpellDamageZeroOriginalRawBook|undefined>{
 let failure:unknown=Error('damage-zero-original:private-probe-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-spell-damage-zero-original/probe'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),result=await response.json().catch(()=>null)as(Omit<Partial<BountifulSpellDamageZeroOriginalRawBook>,'sourceKind'>&{sourceKind?:string;present?:boolean;error?:string})|null;if(!response.ok)throw Error(result?.error??'damage-zero-original:private-probe-'+response.status);if(!result?.ok||result.parentId!==input.parentId||result.mapId!==input.mapId||result.combatId!==input.combatId)throw Error('damage-zero-original:invalid-private-probe-response');if(result.present===false&&result.sourceKind==='spell-damage-zero-original-probe-v1')return undefined;if(result.present!==true||result.sourceKind!=='spell-damage-zero-original-v1'||!result.source||!Array.isArray(result.rows))throw Error('damage-zero-original:invalid-private-probe-response');return result as BountifulSpellDamageZeroOriginalRawBook}catch(error){failure=error}}throw failure
}

export async function inspectBountifulSpellDamageZeroOriginalParent(input:{mapId:string;combatId:string;parentId:string}):Promise<BountifulSpellDamageZeroOriginalParent|undefined>{
 let failure:unknown=Error('damage-zero-original:private-parent-unavailable');for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-spell-damage-zero-original/probe'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),result=await response.json().catch(()=>null)as Record<string,unknown>|null;if(!response.ok)throw Error(typeof result?.error==='string'?result.error:'damage-zero-original:private-parent-'+response.status);if(!result?.ok||result.parentId!==input.parentId||result.mapId!==input.mapId||result.combatId!==input.combatId)throw Error('damage-zero-original:invalid-private-parent-response');if(result.present===false&&result.sourceKind==='spell-damage-zero-original-probe-v1')return undefined;if(result.present!==true||!['spell-damage-zero-preparation-v1','spell-damage-zero-original-v1'].includes(result.sourceKind as string)||!result.source||!result.frame||typeof result.prefixSignature!=='string'||typeof result.effectTimestamp!=='number'||result.sourceKind==='spell-damage-zero-preparation-v1'&&Object.hasOwn(result,'rows')||result.sourceKind==='spell-damage-zero-original-v1'&&(!Array.isArray(result.rows)||!result.labels))throw Error('damage-zero-original:invalid-private-parent-response');return result as unknown as BountifulSpellDamageZeroOriginalParent}catch(error){failure=error}}throw failure
}


type MonsterZeroIdentity={parentId:string;mapId:string;combatId:string}
async function readPrivateMonsterZero<T>(path:'source'|'probe'|'current',input:MonsterZeroIdentity|Omit<MonsterZeroIdentity,'parentId'>,valid:(value:unknown)=>value is T):Promise<T>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('monster-zero-api:actual-host-required')
 let failure:unknown=Error('monster-zero-api:private-source-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-monster-damage-zero-original/'+path),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'monster-zero-api:private-source-'+response.status);if(!valid(value))throw Error('monster-zero-api:invalid-private-response');return value}catch(error){failure=error}}throw failure
}
/** Dedicated Host private transport. JSON is only an input to the actual
 * Native restorer; this fetch never registers a capability or a result. */
export async function loadBountifulMonsterDamageZeroOriginalSource(input:MonsterZeroIdentity){return readPrivateMonsterZero('source',input,(value):value is import('../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalRaw').BountifulMonsterDamageZeroOriginalRawBook=>{if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;return v.ok===true&&v.sourceKind==='monster-damage-zero-original-v1'&&v.parentId===input.parentId&&v.mapId===input.mapId&&v.combatId===input.combatId&&!!v.source&&!!v.frame&&typeof v.prefixSignature==='string'&&typeof v.effectTimestamp==='number'&&Array.isArray(v.rows)})}
export async function probeBountifulMonsterDamageZeroOriginalParent(input:MonsterZeroIdentity):Promise<import('../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalPreparation').BountifulMonsterDamageZeroOriginalParent|undefined>{
 const value=await readPrivateMonsterZero('probe',input,(value):value is Record<string,unknown>=>{if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;if(v.ok!==true||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId)return false;if(v.present===false)return v.sourceKind==='monster-damage-zero-original-probe-v1';return v.present===true&&['monster-damage-zero-preparation-v1','monster-damage-zero-original-v1'].includes(v.sourceKind as string)&&!!v.source&&!!v.frame&&typeof v.prefixSignature==='string'&&typeof v.effectTimestamp==='number'&&(v.sourceKind==='monster-damage-zero-preparation-v1'?!Object.hasOwn(v,'rows'):Array.isArray(v.rows))});return value.present===false?undefined:value as unknown as import('../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalPreparation').BountifulMonsterDamageZeroOriginalParent
}
export async function loadBountifulMonsterDamageZeroOriginalParent(input:MonsterZeroIdentity){const parent=await probeBountifulMonsterDamageZeroOriginalParent(input);if(!parent)throw Error('monster-zero-api:protected-original-parent-required');return parent}
export async function currentBountifulMonsterDamageZeroOriginal(input:Omit<MonsterZeroIdentity,'parentId'>):Promise<MonsterZeroIdentity|undefined>{const value=await readPrivateMonsterZero('current',input,(value):value is Record<string,unknown>=>{if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;return v.ok===true&&v.sourceKind==='monster-damage-zero-current-v1'&&v.mapId===input.mapId&&v.combatId===input.combatId&&(v.present===false||v.present===true&&typeof v.parentId==='string'&&v.parentId.length>0)});return value.present===false?undefined:{parentId:value.parentId as string,mapId:input.mapId,combatId:input.combatId}}

/** A completed public row is insufficient: this reads independently authenticated owner answers. */
export async function verifySharedTempestuousAfterOwnerDecision(input:{parentId:string;mapId:string;combatId:string;frameId:string}):Promise<{kind:'decline'}|{kind:'use';selection:{frameId:string;featureId:string;cell:{col:number;row:number};elevationFeet:number}}>{
 let failure:unknown=Error('tempestuous-after-choice:private-verification-unavailable')
 for(const api of sharedApiCandidates()){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/tempestuous-after-owner/verify'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){failure=error;continue}
 const result=await response.json().catch(()=>null)as{ok?:boolean;error?:string;frameId?:string;decision?:{kind:'decline'}|{kind:'use';selection:{frameId:string;featureId:string;cell:{col:number;row:number};elevationFeet:number}}}|null
 if(!response.ok)throw Error(result?.error??'tempestuous-after-choice:private-verification-'+response.status)
 if(!result?.ok||result.frameId!==input.frameId||!result.decision||!['decline','use'].includes(result.decision.kind))throw Error('tempestuous-after-choice:invalid-private-verification')
 return result.decision
 }throw failure
}

export async function loadBountifulActivityOriginalSource(input:import('../ports/dnd5eActivityOriginalTransport').BountifulActivityOriginalIdentity):Promise<import('../ports/dnd5eActivityOriginalTransport').BountifulActivityOriginalBook>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('activity-original-api:actual-host-required');let failure:unknown;
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-activity-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'activity-original-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('activity-original-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true||v.schemaVersion!==1||v.sourceKind!=='activity-original-v1'||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!v.source||!Array.isArray(v.rows)||!Number.isSafeInteger(v.effectTimestamp))throw Error('activity-original-api:invalid-book');return value as import('../ports/dnd5eActivityOriginalTransport').BountifulActivityOriginalBook}catch(error){failure=error}}throw failure
}

/** Fury-family private transport only; no decoded data is a Native/raw grant. */
export async function requestSharedStormFurySaving(operation:'prepare'|'inspect'|'dice'|'read',payload:unknown):Promise<Record<string,unknown>>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('storm-fury-api:actual-host-required')
 let failure:unknown=Error('storm-fury-api:private-source-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/storm-fury-saving/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(payload)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'storm-fury-api:private-response-'+response.status);if(!value||typeof value!=='object'||!('ok'in value)||value.ok!==true)throw Error('storm-fury-api:invalid-private-response');return value as Record<string,unknown>}catch(error){failure=error}}throw failure
}

async function requestPrivateStormFuryRoom(family:'owner'|'push',operation:string,payload:unknown):Promise<Record<string,unknown>>{
 const s=getRoomSession();if(!s?.roomId||!s.memberId||s.role!=='dm')throw Error('storm-fury-room-api:actual-host-required')
 let failure:unknown=Error('storm-fury-room-api:private-response-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/storm-fury-'+family+'/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(payload)}),result:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(result&&typeof result==='object'&&'error'in result&&typeof result.error==='string'?result.error:'storm-fury-room-api:rejected-'+response.status);if(!result||typeof result!=='object'||!('ok'in result)||result.ok!==true)throw Error('storm-fury-room-api:invalid-response');return result as Record<string,unknown>}catch(error){failure=error}}throw failure
}
export function requestSharedStormFuryOwner(operation:'prepare'|'decision',payload:unknown){return requestPrivateStormFuryRoom('owner',operation,payload)}
export function requestSharedStormFuryPush(operation:'prepare'|'decision',payload:unknown){return requestPrivateStormFuryRoom('push',operation,payload)}

export async function requestSharedBountifulInitiativeOriginal<T>(operation:'begin'|'issue'|'qualify'|'answer'|'raw'|'confirm'|'replacement-raw'|'replacement-confirm'|'complete'|'project'|'list',input:unknown):Promise<T>{const candidates=sharedApiCandidates();if(!candidates.length)throw Error('先攻原骰服务暂时不可用。');let lastError:unknown;for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/bountiful-initiative-original/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'先攻准备或控制权已改变。');return body}throw lastError??Error('先攻原骰服务暂时不可用。')}
export async function requestSharedMastermindNativeWardOriginal<T>(operation:'register'|'request'|'raw'|'confirm'|'complete',input:unknown):Promise<T>{const candidates=sharedApiCandidates();if(!candidates.length)throw Error('原豁免骰服务暂时不可用。');let lastError:unknown;for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-native-ward-original/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'原豁免或控制权已改变。');return body}throw lastError??Error('原豁免骰服务暂时不可用。')}
export async function requestSharedMastermindNativeWardBountiful<T>(operation:'register'|'project'|'list'|'answer'|'raw'|'confirm',input:unknown):Promise<T>{const candidates=sharedApiCandidates();if(!candidates.length)throw Error('丰厚运势服务暂时不可用。');let lastError:unknown;for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-native-ward-bountiful/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'原豁免、反应或控制权已改变。');return body}throw lastError??Error('丰厚运势服务暂时不可用。')}

export async function requestSharedMastermindNativeWardOutcome<T>(operation:'register'|'answer'|'project'|'list',input:unknown):Promise<T>{
 const candidates=sharedApiCandidates();if(!candidates.length)throw Error('攻击选择服务暂时不可用，请确认房间连接。')
 let lastError:unknown
 for(const api of candidates){let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(`${api}/state/mastermind-native-ward-outcome/${operation}`),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)})}catch(error){lastError=error;continue}
 const body=await response.json() as T&{error?:string};if(!response.ok)throw Error(body.error??'原攻击或控制权已改变，请重新查看。');return body}
 throw lastError??Error('攻击选择服务暂时不可用，请确认房间连接。')
}

export async function loadBountifulPluginSpellAbilityOriginalSource(input:import('../ports/dnd5ePluginSpellAbilityOriginalTransport').BountifulPluginSpellAbilityOriginalIdentity):Promise<import('../ports/dnd5ePluginSpellAbilityOriginalTransport').BountifulPluginSpellAbilityOriginalBook>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('plugin-spell-ability-original-api:actual-host-required');let failure:unknown;
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-plugin-spell-ability-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'plugin-spell-ability-original-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('plugin-spell-ability-original-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true||v.schemaVersion!==1||v.sourceKind!=='plugin-spell-ability-original-v1'||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!v.source||!Array.isArray(v.rows)||!Number.isSafeInteger(v.effectTimestamp))throw Error('plugin-spell-ability-original-api:invalid-book');return value as import('../ports/dnd5ePluginSpellAbilityOriginalTransport').BountifulPluginSpellAbilityOriginalBook}catch(error){failure=error}}throw failure
}

export async function loadBountifulPluginSpellSavingOriginalSource(input:import('../ports/dnd5ePluginSpellSavingOriginalTransport').BountifulPluginSpellSavingOriginalIdentity):Promise<import('../ports/dnd5ePluginSpellSavingOriginalTransport').BountifulPluginSpellSavingOriginalBook>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('plugin-spell-saving-original-api:actual-host-required');let failure:unknown;
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-plugin-spell-saving-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'plugin-spell-saving-original-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('plugin-spell-saving-original-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true||v.schemaVersion!==1||v.sourceKind!=='plugin-spell-saving-original-v1'||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!v.source||!Array.isArray(v.rows)||!Number.isSafeInteger(v.effectTimestamp))throw Error('plugin-spell-saving-original-api:invalid-book');return value as import('../ports/dnd5ePluginSpellSavingOriginalTransport').BountifulPluginSpellSavingOriginalBook}catch(error){failure=error}}throw failure
}

export async function loadBountifulPluginSpellCompoundPrimarySource(input:import('../ports/dnd5ePluginSpellSavingOriginalTransport').BountifulPluginSpellSavingOriginalIdentity):Promise<import('../ports/dnd5ePluginSpellCompoundPrimaryTransport').BountifulPluginSpellCompoundPrimaryBook>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('plugin-spell-saving-original-api:actual-host-required');let failure:unknown;
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-plugin-spell-saving-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify({...input,poolKind:'primary'})}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'plugin-spell-saving-original-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('plugin-spell-saving-original-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true||v.schemaVersion!==1||v.sourceKind!=='plugin-spell-compound-primary-v1'||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!v.source||!Array.isArray(v.rows)||!Number.isSafeInteger(v.effectTimestamp))throw Error('plugin-spell-saving-original-api:invalid-book');return value as import('../ports/dnd5ePluginSpellCompoundPrimaryTransport').BountifulPluginSpellCompoundPrimaryBook}catch(error){failure=error}}throw failure
}

export const loadSpellcastingOriginalPreparation=readSpellcastingOriginalPreparationBook
export async function requestSharedSpellcastingOriginalSaving(operation:'prepare'|'inspect'|'dice'|'read'|'target-source'|'target-prepare'|'target-inspect'|'target-dice'|'target-read',payload:unknown):Promise<Record<string,unknown>>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('spellcasting-saving-api:actual-host-required')
 if(!['prepare','inspect','dice','read','target-source','target-prepare','target-inspect','target-dice','target-read'].includes(operation))throw Error('spellcasting-saving-api:operation-required')
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('spellcasting-saving-api:identity-required')
 const identity=payload as Record<string,unknown>;if(!['parentId','mapId','combatId','effectId'].every(key=>typeof identity[key]==='string'&&(identity[key] as string).length>0&&(identity[key] as string).length<=2000))throw Error('spellcasting-saving-api:identity-required')
 if(operation.startsWith('target-')&&(typeof identity.targetId!=='string'||!identity.targetId||identity.targetId.length>2000))throw Error('spellcasting-saving-api:target-identity-required')
 let networkFailure:unknown=Error('spellcasting-saving-api:private-source-unavailable')
 for(const api of sharedApiCandidates()){
  let response:Response;try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/spellcasting-original-saving/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(payload)})}catch(error){networkFailure=error;continue}
  const value:unknown=await response.json();if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'spellcasting-saving-api:private-response-'+response.status)
  if(!value||typeof value!=='object'||Array.isArray(value)||!('ok'in value)||value.ok!==true)throw Error('spellcasting-saving-api:invalid-private-response')
  const reply=value as Record<string,unknown>,target=operation.startsWith('target-'),sourceKind=operation==='target-source'?'spell-target-original-preparation-v1':target?'spell-target-original-saving-v1':'spellcasting-original-saving-v1',identityKeys=target?['parentId','mapId','combatId','effectId','targetId']:['parentId','mapId','combatId','effectId'];if(operation!=='dice'&&operation!=='target-dice'&&(reply.schemaVersion!==1||reply.sourceKind!==sourceKind||reply.roomId!==session.roomId||reply.hostMemberId!==session.memberId||!identityKeys.every(key=>reply[key]===identity[key])||(operation==='target-source'?typeof reply.prefixSignature!=='string'||!reply.source||typeof reply.source!=='object'||!reply.requirement||typeof reply.requirement!=='object':typeof reply.parentSignature!=='string')||target&&(!Number.isSafeInteger(reply.effectTimestamp)||Number(reply.effectTimestamp)<=0)))throw Error('spellcasting-saving-api:invalid-private-response')
  return reply
 }
 throw networkFailure
}


export async function requestSharedTempestuousLandingOriginal(operation:'prepare'|'inspect'|'dice'|'read',payload:unknown):Promise<Record<string,unknown>>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('tempestuous-landing-api:actual-host-required')
 let failure:unknown=Error('tempestuous-landing-api:private-source-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/tempestuous-landing-original/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(payload)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'tempestuous-landing-api:private-response-'+response.status);if(!value||typeof value!=='object'||!('ok'in value)||value.ok!==true)throw Error('tempestuous-landing-api:invalid-private-response');return value as Record<string,unknown>}catch(error){failure=error}}throw failure
}

export async function requestSharedTempestuousHostOriginal(operation:'begin'|'read'|'cancel'|'spell-window-prefix',payload:unknown):Promise<Record<string,unknown>>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('tempestuous-host-api:actual-host-required')
 let failure:unknown=Error('tempestuous-host-api:private-source-unavailable')
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/tempestuous-host-original/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(payload)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'tempestuous-host-api:private-response-'+response.status);if(!value||typeof value!=='object'||!('ok'in value)||value.ok!==true)throw Error('tempestuous-host-api:invalid-private-response');return value as Record<string,unknown>}catch(error){failure=error}}throw failure
}

/** Host-only source transport; decoded data grants no Native or physical authority. */
export async function loadBountifulDeathRepeatSavingSource(input:import('../ports/dnd5eDeathRepeatSavingTransport').BountifulDeathRepeatSavingIdentity):Promise<import('../ports/dnd5eDeathRepeatSavingTransport').BountifulDeathRepeatSavingBook>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('death-repeat-saving-api:actual-host-required');let failure:unknown;
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-death-repeat-saving/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'death-repeat-saving-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('death-repeat-saving-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true||v.present!==true||v.schemaVersion!==1||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!v.originalSource||!Array.isArray(v.originalRows)||!v.originalRows.length||!Number.isSafeInteger(v.effectTimestamp)||typeof v.requestId!=='string'||!v.requestId.startsWith('bountiful-death-repeat-saving:'))throw Error('death-repeat-saving-api:invalid-book');return value as import('../ports/dnd5eDeathRepeatSavingTransport').BountifulDeathRepeatSavingBook}catch(error){failure=error}}throw failure
}

/** Host transport for this independent input ledger only. It grants no Native,
 * raw pool, movement or World permission and has no caller source-registration. */
async function requestPluginTempestuousPrivate(namespace:'tempestuous-plugin-original'|'tempestuous-plugin-landing-original'|'tempestuous-plugin-saving-owned',operation:string,payload:unknown):Promise<Record<string,unknown>>{
 const host=getRoomSession(),allowed=namespace==='tempestuous-plugin-original'?['prepare','read','probe','publication','inputs-read','inputs-start','inputs-record','inputs-save-start','saving-read','saving-begin','saving-append','saving-answer','saving-complete','saving-material-read','saving-material']:namespace==='tempestuous-plugin-saving-owned'?['read','claim']:['prepare','inspect','read','dice']
 if(!host||host.role!=='dm'&&!(namespace==='tempestuous-plugin-saving-owned'&&host.role==='player')||!host.roomId||!host.memberId||!allowed.includes(operation))throw Error('plugin-tempestuous-api:actual-host-operation-required')
 let failure:unknown=Error('plugin-tempestuous-api:private-source-unavailable')
 for(const api of sharedApiCandidates()){
  let response:Response
  try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/'+namespace+'/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(payload)})}catch(error){failure=error;continue}
  const value:unknown=await response.json().catch(()=>null),current=getRoomSession()
  if(current?.role!==host.role||current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('plugin-tempestuous-api:changed-host')
  // An actual authority rejection is final, not a reason to query another host.
  if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'plugin-tempestuous-api:private-response-'+response.status)
  if(!value||typeof value!=='object'||!('ok'in value)||value.ok!==true)throw Error('plugin-tempestuous-api:invalid-private-response')
  return value as Record<string,unknown>
 }
 throw failure
}
export async function requestSharedPluginTempestuousOriginal(operation:'prepare'|'read'|'probe'|'publication'|'inputs-read'|'inputs-start'|'inputs-record'|'inputs-save-start'|'saving-read'|'saving-begin'|'saving-append'|'saving-answer'|'saving-complete'|'saving-material-read'|'saving-material',payload:unknown):Promise<Record<string,unknown>>{return requestPluginTempestuousPrivate('tempestuous-plugin-original',operation,payload)}
export async function requestSharedPluginTempestuousLandingOriginal(operation:'prepare'|'inspect'|'read'|'dice',payload:unknown):Promise<Record<string,unknown>>{return requestPluginTempestuousPrivate('tempestuous-plugin-landing-original',operation,payload)}

/** Actual Host-only private first-ready/end-source transport. Returned data never
 * substitutes for the Native operation and Node original issuance guards. */
async function readDeathFirstPrivateSource(input:import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstRepeatIdentity,lane:'first'|'inspect'|'end'):Promise<unknown>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.memberId||!session.roomId)throw Error('death-first-api:actual-host-required');let failure:unknown=new Error('death-first-api:source-unavailable');for(const api of sharedApiCandidates()){try{const route=lane==='end'?'bountiful-death-first-repeat-saving/source':lane==='inspect'?'bountiful-death-first-original/inspect':'bountiful-death-first-original/source',response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/'+route),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'death-first-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('death-first-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true)throw Error('death-first-api:invalid-book');if(lane==='inspect'&&v.present===false){if(Object.keys(v).some(k=>k!=='ok'&&k!=='present'))throw Error('death-first-api:invalid-absence');return value}if(v.schemaVersion!==1||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!Number.isSafeInteger(v.effectTimestamp))throw Error('death-first-api:invalid-book');if(lane==='end'){if(v.present!==true||v.sourceKind!=='death-first-repeat-saving-v1'||!v.originalSource||!Array.isArray(v.originalRows)||typeof v.requestId!=='string'||!/^bountiful-death-first-repeat-saving:[a-f0-9]{64}$/.test(v.requestId))throw Error('death-first-api:invalid-end-book')}else if(v.sourceKind!=='death-first-ready-v1'||!v.source||!v.firstRaw||!v.firstAdopted||lane==='inspect'&&v.present!==true)throw Error('death-first-api:invalid-first-book');return value}catch(error){failure=error}}throw failure
}
export async function loadBountifulDeathFirstOriginalSource(input:import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstRepeatIdentity):Promise<import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstPreparationBook>{return await readDeathFirstPrivateSource(input,'first')as import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstPreparationBook}
export async function inspectBountifulDeathFirstOriginal(input:import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstRepeatIdentity):Promise<import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstPreparationPresence>{return await readDeathFirstPrivateSource(input,'inspect')as import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstPreparationPresence}
export async function loadBountifulDeathFirstRepeatSavingSource(input:import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstRepeatIdentity):Promise<import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstRepeatSavingBook>{return await readDeathFirstPrivateSource(input,'end')as import('../ports/dnd5eDeathFirstRepeatTransport').BountifulDeathFirstRepeatSavingBook}

export async function requestSharedPluginTempestuousSavingOwned(operation:'read'|'claim',payload:unknown):Promise<Record<string,unknown>>{return requestPluginTempestuousPrivate('tempestuous-plugin-saving-owned',operation,payload)}

/** Authenticated private Monster held-saving input ledger. No Native authority. */
export async function requestSharedBountifulMonsterSavingLate<T>(input:{parentId:string;mapId:string;combatId:string}):Promise<T>{const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('monster-save-late-api:actual-host-required');let failure:unknown=Error('monster-save-late-api:source-unavailable');for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-monster-saving-late/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'monster-save-late-api:source-'+response.status);if(!value||typeof value!=='object')throw Error('monster-save-late-api:invalid-response');const row=value as Record<string,unknown>;if(row.ok!==true||typeof row.present!=='boolean'||row.present&&(row.sourceKind!=='monster-saving-late-v1'||row.parentId!==input.parentId||row.mapId!==input.mapId||row.combatId!==input.combatId||!Array.isArray(row.slots)))throw Error('monster-save-late-api:invalid-response');return value as T}catch(error){failure=error}}throw failure}

export async function loadBountifulDeathAreaOriginalSource(input:import('../ports/dnd5eDeathAreaOriginalTransport').BountifulDeathAreaOriginalIdentity):Promise<import('../ports/dnd5eDeathAreaOriginalTransport').BountifulDeathAreaOriginalBook>{
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('death-area-original-api:actual-host-required');let failure:unknown;
 for(const api of sharedApiCandidates()){try{const response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/bountiful-death-area-original/source'),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify(input)}),value:unknown=await response.json().catch(()=>null);if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'death-area-original-api:private-source-'+response.status);if(!value||typeof value!=='object')throw Error('death-area-original-api:invalid-book');const v=value as Record<string,unknown>;if(v.ok!==true||v.present!==true||v.schemaVersion!==1||v.parentId!==input.parentId||v.mapId!==input.mapId||v.combatId!==input.combatId||v.roomId!==session.roomId||v.hostMemberId!==session.memberId||!v.originalSource||!Array.isArray(v.originalRows)||!v.originalRows.length||!Number.isSafeInteger(v.effectTimestamp)||typeof v.requestId!=='string'||!v.requestId.startsWith('bountiful-death-area-original:'))throw Error('death-area-original-api:invalid-book');return value as import('../ports/dnd5eDeathAreaOriginalTransport').BountifulDeathAreaOriginalBook}catch(error){failure=error}}throw failure
}

/** Host-attested transport recovery; never a substitute for the normal world commit. */
export async function requestSharedEffectEndConfirmedReceipt<T>(operation:'read'|'record',mapId:string,receipt?:{before:T;after:T;contextKey:string}):Promise<{receipt:{before:T;after:T}|null;contextKey:string;combatRevision:number;hasPending:boolean}>{
 const session=getRoomSession()
 if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('effect-end-receipt:actual-host-required')
 let networkFailure:unknown=Error('effect-end-receipt:unavailable')
 for(const api of sharedApiCandidates()){
  let response:Response
  try{response=await fetchSharedCandidate(sharedSessionUrl(api+'/state/effect-end-confirmed/'+operation),{method:'POST',headers:{'Content-Type':'application/json',...sharedAccessHeaders(),...sharedMemberHeaders(),...sharedProtocolHeaders()},body:JSON.stringify({mapId,...(receipt?{contextKey:receipt.contextKey,receipt:{before:receipt.before,after:receipt.after}}:{})})})}catch(error){networkFailure=error;continue}
  const value:unknown=await response.json()
  if(!response.ok)throw Error(value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'effect-end-receipt:response-'+response.status)
  if(!value||typeof value!=='object'||!('ok'in value)||value.ok!==true||!('roomId'in value)||value.roomId!==session.roomId||!('hostMemberId'in value)||value.hostMemberId!==session.memberId||!('mapId'in value)||value.mapId!==mapId||!('contextKey'in value)||typeof value.contextKey!=='string'||!('combatRevision'in value)||typeof value.combatRevision!=='number'||!Number.isSafeInteger(value.combatRevision)||value.combatRevision<0||!('hasPending'in value)||typeof value.hasPending!=='boolean'||!('receipt'in value))throw Error('effect-end-receipt:invalid-response')
  if(value.receipt===null)return {receipt:null,contextKey:value.contextKey,combatRevision:value.combatRevision,hasPending:value.hasPending}
  const saved=value.receipt
  if(!saved||typeof saved!=='object'||!('before'in saved)||!('after'in saved)||!saved.before||typeof saved.before!=='object'||!saved.after||typeof saved.after!=='object')throw Error('effect-end-receipt:invalid-receipt')
  return {receipt:saved as {before:T;after:T},contextKey:value.contextKey,combatRevision:value.combatRevision,hasPending:value.hasPending}
 }
 throw networkFailure
}
