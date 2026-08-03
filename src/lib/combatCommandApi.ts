import { sharedEventApiCandidates } from './sharedApi'
import { getRoomClientId, getRoomSession, type RoomSession } from './roomSession'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'
import { modeFromPort } from './appMode'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import type { Dnd5eTraversalMode } from '../rulesets/dnd5e/traversal'

export const COMBAT_COMMAND_SCHEMA_VERSION = 1 as const
export const COMBAT_COMMAND_ENDPOINT = '/combat/commands' as const
export const DEFAULT_COMBAT_COMMAND_TIMEOUT_MS = 10_000
export const DEFAULT_COMBAT_COMMAND_REQUEST_TIMEOUT_MS = 3_000
export const DEFAULT_COMBAT_COMMAND_POLL_INTERVAL_MS = 120

export type CombatCommandType = 'move-token' | 'end-turn'
export type CombatCommandReceiptStatus = 'pending' | 'committed' | 'rejected' | 'conflict'

export interface CombatCommandExpectedRevisionsV1 {
  combat: number
  maps?: number
}

export interface CombatCommandFromPlayerActionPreconditions {
  expectedRevisions: CombatCommandExpectedRevisionsV1
  expectedPosition?: { x: number; y: number }
  expectedElevationFeet?: number
}

interface CombatCommandBaseV1 {
  schemaVersion: typeof COMBAT_COMMAND_SCHEMA_VERSION
  /** Stable caller-generated idempotency key. A retry must reuse this exact value. */
  commandId: string
  type: CombatCommandType
  mapId: string
  /** Required so exploration movement cannot accidentally enter the combat authority queue. */
  combatId: string
  actorTokenId: string
  characterId: string
  /** Optimistic turn precondition, revalidated by the DM authority before settlement. */
  round: number
  initiativeIndex: number
  /** Existing player-action sequence, retained for deterministic queue order. */
  seq: number
  /** CAS watermarks captured when the command was created. */
  expectedRevisions: CombatCommandExpectedRevisionsV1
  issuedAt: number
}

export interface MoveTokenCombatCommandV1 extends CombatCommandBaseV1 {
  type: 'move-token'
  /** Authoritative starting point expected by the caller, not a visual/optimistic position. */
  expectedPosition: { x: number; y: number }
  expectedElevationFeet: number
  targetPosition: { x: number; y: number }
  targetElevationFeet?: number
  dnd5eCarefulMovement?: boolean
  dnd5eStandFromProne?: boolean
  dnd5eTraversalMode?: Dnd5eTraversalMode
}

export interface EndTurnCombatCommandV1 extends CombatCommandBaseV1 {
  type: 'end-turn'
}

export type CombatCommandV1 = MoveTokenCombatCommandV1 | EndTurnCombatCommandV1

export interface CombatCommandAuthoritativeStateV1 {
  appliedAt: number
  revisions: Readonly<Record<string, number>>
  mapId: string
  combatId: string
  round: number
  initiativeIndex: number
  acceptedPosition?: { x: number; y: number }
  acceptedElevationFeet?: number
}

interface CombatCommandReceiptBaseV1 {
  schemaVersion: typeof COMBAT_COMMAND_SCHEMA_VERSION
  receiptId: string
  commandId: string
  commandType: CombatCommandType
  status: CombatCommandReceiptStatus
  updatedAt: number
  /** Added by the client parser; it is not trusted from response JSON. */
  receiptSource: 'authority' | 'client'
}

export interface PendingCombatCommandReceiptV1 extends CombatCommandReceiptBaseV1 {
  status: 'pending'
}

export interface CommittedCombatCommandReceiptV1 extends CombatCommandReceiptBaseV1 {
  status: 'committed'
  authoritative: CombatCommandAuthoritativeStateV1
}

export interface RejectedCombatCommandReceiptV1 extends CombatCommandReceiptBaseV1 {
  status: 'rejected'
  reason: string
  retryable?: boolean
}

export interface ConflictCombatCommandReceiptV1 extends CombatCommandReceiptBaseV1 {
  status: 'conflict'
  reason: string
}

export type CombatCommandReceiptV1 =
  | PendingCombatCommandReceiptV1
  | CommittedCombatCommandReceiptV1
  | RejectedCombatCommandReceiptV1
  | ConflictCombatCommandReceiptV1

export type TerminalCombatCommandReceiptV1 = Exclude<
  CombatCommandReceiptV1,
  PendingCombatCommandReceiptV1
>

export interface CombatCommandTransport {
  put(command: CombatCommandV1, signal: AbortSignal): Promise<CombatCommandReceiptV1>
  get(
    commandId: string,
    commandType: CombatCommandType,
    signal: AbortSignal,
  ): Promise<CombatCommandReceiptV1 | null>
}

export interface CombatCommandExecutionOptions {
  /** Overall PUT + polling deadline. A timeout leaves the command pending and retryable. */
  timeoutMs?: number
  /** Per-request deadline, bounded by the overall deadline. */
  requestTimeoutMs?: number
  pollIntervalMs?: number
  /** PUT is safe to retry only because every attempt uses the same commandId and payload. */
  maxPutAttempts?: number
  signal?: AbortSignal
}

export class CombatCommandProtocolError extends Error {
  readonly causeValue?: unknown

  constructor(message: string, causeValue?: unknown) {
    super(message)
    this.name = 'CombatCommandProtocolError'
    this.causeValue = causeValue
  }
}

export class CombatCommandHttpError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(status: number, body?: unknown) {
    super(`combat-command-http-${status}`)
    this.name = 'CombatCommandHttpError'
    this.status = status
    this.body = body
  }
}

export class CombatCommandTimeoutError extends Error {
  readonly commandId: string
  readonly lastReceipt?: CombatCommandReceiptV1

  constructor(commandId: string, lastReceipt?: CombatCommandReceiptV1) {
    super(`combat-command-timeout:${commandId}`)
    this.name = 'CombatCommandTimeoutError'
    this.commandId = commandId
    this.lastReceipt = lastReceipt
  }
}

export class CombatCommandAbortedError extends Error {
  readonly commandId: string

  constructor(commandId: string) {
    super(`combat-command-aborted:${commandId}`)
    this.name = 'CombatCommandAbortedError'
    this.commandId = commandId
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown, maxLength = 512): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isValidCombatCommandId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.test(value)
}

function parsePosition(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return undefined
  return { x: value.x, y: value.y }
}

function parseAuthoritativeState(value: unknown): CombatCommandAuthoritativeStateV1 | undefined {
  if (!isRecord(value)) return undefined
  if (
    !isFiniteNumber(value.appliedAt) ||
    !isRecord(value.revisions) ||
    !isNonEmptyString(value.mapId) ||
    !isNonEmptyString(value.combatId) ||
    !isNonNegativeInteger(value.round) ||
    !isNonNegativeInteger(value.initiativeIndex)
  ) return undefined
  const revisions: Record<string, number> = {}
  for (const [name, revision] of Object.entries(value.revisions)) {
    if (!isNonEmptyString(name, 160) || !isNonNegativeInteger(revision)) return undefined
    revisions[name] = revision
  }
  const acceptedPosition = value.acceptedPosition == null
    ? undefined
    : parsePosition(value.acceptedPosition)
  if (value.acceptedPosition != null && !acceptedPosition) return undefined
  const acceptedElevationFeet = value.acceptedElevationFeet == null
    ? undefined
    : value.acceptedElevationFeet
  if (acceptedElevationFeet != null && !isFiniteNumber(acceptedElevationFeet)) return undefined
  return {
    appliedAt: value.appliedAt,
    revisions,
    mapId: value.mapId,
    combatId: value.combatId,
    round: value.round,
    initiativeIndex: value.initiativeIndex,
    ...(acceptedPosition ? { acceptedPosition } : {}),
    ...(acceptedElevationFeet != null ? { acceptedElevationFeet } : {}),
  }
}

/**
 * Parses the only response that can settle a command. SSE messages intentionally
 * never enter this module: they may tell a UI to poll sooner, but cannot prove
 * that a command committed.
 */
export function parseCombatCommandReceipt(
  value: unknown,
  expected?: { commandId?: string; commandType?: CombatCommandType },
): CombatCommandReceiptV1 {
  const wrapped = isRecord(value) && 'receipt' in value ? value.receipt : value
  if (!isRecord(wrapped)) throw new CombatCommandProtocolError('combat-command-receipt-not-object', value)
  const status = wrapped.status
  const commandType = wrapped.commandType
  if (
    wrapped.schemaVersion !== COMBAT_COMMAND_SCHEMA_VERSION ||
    !isValidCombatCommandId(wrapped.receiptId) ||
    !isValidCombatCommandId(wrapped.commandId) ||
    (commandType !== 'move-token' && commandType !== 'end-turn') ||
    (status !== 'pending' && status !== 'committed' && status !== 'rejected' && status !== 'conflict') ||
    !isFiniteNumber(wrapped.updatedAt)
  ) throw new CombatCommandProtocolError('combat-command-receipt-invalid', value)
  if (expected?.commandId && wrapped.commandId !== expected.commandId) {
    throw new CombatCommandProtocolError('combat-command-receipt-command-id-mismatch', value)
  }
  if (expected?.commandType && commandType !== expected.commandType) {
    throw new CombatCommandProtocolError('combat-command-receipt-command-type-mismatch', value)
  }
  const normalizedCommandType = commandType as CombatCommandType
  const base = {
    schemaVersion: COMBAT_COMMAND_SCHEMA_VERSION,
    receiptId: wrapped.receiptId,
    commandId: wrapped.commandId,
    commandType: normalizedCommandType,
    updatedAt: wrapped.updatedAt,
    receiptSource: 'authority' as const,
  }
  if (status === 'pending') return { ...base, status }
  if (status === 'committed') {
    const authoritative = parseAuthoritativeState(wrapped.authoritative)
    if (!authoritative) {
      throw new CombatCommandProtocolError('combat-command-receipt-authority-invalid', value)
    }
    return { ...base, status, authoritative }
  }
  if (!isNonEmptyString(wrapped.reason, 1_000)) {
    throw new CombatCommandProtocolError('combat-command-receipt-reason-invalid', value)
  }
  if (status === 'rejected') {
    if (wrapped.retryable != null && typeof wrapped.retryable !== 'boolean') {
      throw new CombatCommandProtocolError('combat-command-receipt-retryable-invalid', value)
    }
    return {
      ...base,
      status,
      reason: wrapped.reason,
      ...(typeof wrapped.retryable === 'boolean' ? { retryable: wrapped.retryable } : {}),
    }
  }
  return { ...base, status, reason: wrapped.reason }
}

function assertCommand(command: CombatCommandV1): void {
  if (
    command.schemaVersion !== COMBAT_COMMAND_SCHEMA_VERSION ||
    !isValidCombatCommandId(command.commandId) ||
    (command.type !== 'move-token' && command.type !== 'end-turn') ||
    !isNonEmptyString(command.mapId) ||
    !isNonEmptyString(command.combatId) ||
    !isNonEmptyString(command.actorTokenId) ||
    !isNonEmptyString(command.characterId) ||
    !isNonNegativeInteger(command.round) ||
    !isNonNegativeInteger(command.initiativeIndex) ||
    !isNonNegativeInteger(command.seq) ||
    !isRecord(command.expectedRevisions) ||
    !isNonNegativeInteger(command.expectedRevisions.combat) ||
    (command.expectedRevisions.maps != null && !isNonNegativeInteger(command.expectedRevisions.maps)) ||
    !isFiniteNumber(command.issuedAt)
  ) throw new CombatCommandProtocolError('combat-command-invalid', command)
  if (command.type === 'move-token') {
    if (
      !isNonNegativeInteger(command.expectedRevisions.maps) ||
      !parsePosition(command.expectedPosition) ||
      !parsePosition(command.targetPosition)
    ) {
      throw new CombatCommandProtocolError('combat-command-target-position-invalid', command)
    }
    if (!isFiniteNumber(command.expectedElevationFeet)) {
      throw new CombatCommandProtocolError('combat-command-expected-elevation-invalid', command)
    }
    if (command.targetElevationFeet != null && !isFiniteNumber(command.targetElevationFeet)) {
      throw new CombatCommandProtocolError('combat-command-target-elevation-invalid', command)
    }
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry ?? null)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

export function fingerprintCombatCommand(command: CombatCommandV1): string {
  assertCommand(command)
  return canonicalJson(command)
}

/**
 * Migration adapter for the existing player-action envelope. It deliberately
 * accepts only the two commands owned by this first authority-queue slice.
 */
export function combatCommandFromPlayerAction(
  action: SharedPlayerActionState,
  preconditions: CombatCommandFromPlayerActionPreconditions,
): CombatCommandV1 | null {
  if ((action.type !== 'move-token' && action.type !== 'end-turn') || !action.combatId) return null
  const base = {
    schemaVersion: COMBAT_COMMAND_SCHEMA_VERSION,
    commandId: action.id,
    mapId: action.mapId,
    combatId: action.combatId,
    actorTokenId: action.actorTokenId,
    characterId: action.characterId,
    round: action.round,
    initiativeIndex: action.initiativeIndex,
    seq: action.seq,
    expectedRevisions: { ...preconditions.expectedRevisions },
    issuedAt: action.updatedAt,
  }
  if (action.type === 'end-turn') return { ...base, type: action.type }
  if (
    !action.targetPosition ||
    !preconditions.expectedPosition ||
    !isFiniteNumber(preconditions.expectedElevationFeet)
  ) return null
  return {
    ...base,
    type: action.type,
    expectedPosition: { ...preconditions.expectedPosition },
    expectedElevationFeet: preconditions.expectedElevationFeet,
    targetPosition: { ...action.targetPosition },
    ...(action.targetElevationFeet != null
      ? { targetElevationFeet: action.targetElevationFeet }
      : {}),
    ...(action.dnd5eCarefulMovement != null
      ? { dnd5eCarefulMovement: action.dnd5eCarefulMovement }
      : {}),
    ...(action.dnd5eStandFromProne != null
      ? { dnd5eStandFromProne: action.dnd5eStandFromProne }
      : {}),
    ...(action.dnd5eTraversalMode
      ? { dnd5eTraversalMode: action.dnd5eTraversalMode }
      : {}),
  }
}

type CombatCommandSession = Pick<
  RoomSession,
  'roomId' | 'memberId' | 'roomToken' | 'role' | 'clientId'
>

export interface CombatCommandHttpTransportOptions {
  fetch?: typeof fetch
  apiBase?: string | (() => string | undefined)
  getSession?: () => CombatCommandSession | null
}

function commandApiBase(option?: string | (() => string | undefined)): string {
  const configured = typeof option === 'function' ? option() : option
  const resolved = configured ?? sharedEventApiCandidates()[0]
  if (!resolved) throw new CombatCommandProtocolError('combat-command-api-unavailable')
  return resolved.replace(/\/$/, '')
}

function commandUrl(base: string, commandId: string, roomId?: string): string {
  // commandId is already restricted to URL path-safe ASCII. Keeping ':' literal
  // also matches the server route without relying on pathname percent-decoding.
  const raw = `${base}${COMBAT_COMMAND_ENDPOINT}/${commandId}`
  if (!roomId) return raw
  try {
    const parsed = new URL(raw)
    parsed.searchParams.set('room', roomId)
    return parsed.toString()
  } catch {
    return `${raw}${raw.includes('?') ? '&' : '?'}room=${encodeURIComponent(roomId)}`
  }
}

function commandHeaders(session: CombatCommandSession | null, commandId: string): Record<string, string> {
  const localMode = session ? null : modeFromPort()
  const writerId = session
    ? `${session.role}:${session.memberId}:${session.clientId}`
    : `client:${getRoomClientId()}`
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': commandId,
    'X-Stars-Command-Id': commandId,
    'X-Stars-Protocol': String(CLIENT_SHARED_PROTOCOL_VERSION),
    'X-Stars-Writer': writerId,
    ...(!session && localMode ? { 'X-Stars-Command-Source': localMode } : {}),
    ...(session ? {
      'X-Stars-Member': session.memberId,
      'X-Stars-Room-Token': session.roomToken,
    } : {}),
  }
}

async function responseJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined)
}

/** HTTP transport for the asynchronous authority queue contract. */
export function createCombatCommandHttpTransport(
  options: CombatCommandHttpTransportOptions = {},
): CombatCommandTransport {
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (!fetchImpl) throw new CombatCommandProtocolError('combat-command-fetch-unavailable')
  const authorityByCommandId = new Map<string, {
    apiBase: string
    session: CombatCommandSession | null
  }>()
  const authorityFor = (commandId: string) => {
    const existing = authorityByCommandId.get(commandId)
    if (existing) return existing
    const currentSession = options.getSession?.() ?? getRoomSession()
    const authority = {
      apiBase: commandApiBase(options.apiBase),
      session: currentSession ? { ...currentSession } : null,
    }
    // A PUT and every later retry/poll for one idempotency key must stay on
    // the same authority. Switching rooms or accounts mid-flight must never
    // redirect an ambiguous command to the newly active room.
    authorityByCommandId.set(commandId, authority)
    return authority
  }
  const request = async (
    method: 'PUT' | 'GET',
    commandId: string,
    commandType: CombatCommandType,
    command: CombatCommandV1 | undefined,
    signal: AbortSignal,
  ): Promise<CombatCommandReceiptV1 | null> => {
    if (!isValidCombatCommandId(commandId)) {
      throw new CombatCommandProtocolError('combat-command-id-invalid', commandId)
    }
    const authority = authorityFor(commandId)
    const session = authority.session
    const response = await fetchImpl(commandUrl(authority.apiBase, commandId, session?.roomId), {
      method,
      cache: 'no-store',
      headers: commandHeaders(session, commandId),
      ...(command ? { body: JSON.stringify({ schemaVersion: COMBAT_COMMAND_SCHEMA_VERSION, command }) } : {}),
      signal,
    })
    const body = await responseJson(response)
    if (method === 'GET' && response.status === 404) return null
    let receipt: CombatCommandReceiptV1
    try {
      receipt = parseCombatCommandReceipt(body, { commandId, commandType })
    } catch (error) {
      if (!response.ok) throw new CombatCommandHttpError(response.status, body)
      throw error
    }
    if (response.status === 409 && receipt.status !== 'conflict') {
      throw new CombatCommandProtocolError('combat-command-http-conflict-status-mismatch', body)
    }
    if (!response.ok && receipt.status !== 'rejected' && receipt.status !== 'conflict') {
      throw new CombatCommandHttpError(response.status, body)
    }
    return receipt
  }
  return {
    async put(command, signal) {
      assertCommand(command)
      const receipt = await request('PUT', command.commandId, command.type, command, signal)
      if (!receipt) throw new CombatCommandProtocolError('combat-command-put-receipt-missing')
      return receipt
    },
    get(commandId, commandType, signal) {
      return request('GET', commandId, commandType, undefined, signal)
    },
  }
}

function clientConflictReceipt(
  command: CombatCommandV1,
  now: number,
): ConflictCombatCommandReceiptV1 {
  return {
    schemaVersion: COMBAT_COMMAND_SCHEMA_VERSION,
    receiptId: command.commandId,
    commandId: command.commandId,
    commandType: command.type,
    status: 'conflict',
    reason: 'command-id-reused-with-different-payload',
    updatedAt: now,
    receiptSource: 'client',
  }
}

export function isTerminalCombatCommandReceipt(
  receipt: CombatCommandReceiptV1,
): receipt is TerminalCombatCommandReceiptV1 {
  return receipt.status !== 'pending'
}

function retryableTransportError(error: unknown): boolean {
  return !(error instanceof CombatCommandProtocolError) &&
    !(error instanceof CombatCommandAbortedError) &&
    (!(error instanceof CombatCommandHttpError) || error.status >= 500)
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new CombatCommandAbortedError('unknown'))
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(done, Math.max(0, ms))
    function done() {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }
    function aborted() {
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', aborted)
      reject(new CombatCommandAbortedError('unknown'))
    }
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

async function withRequestDeadline<T>(
  commandId: string,
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (externalSignal?.aborted) throw new CombatCommandAbortedError(commandId)
  const controller = new AbortController()
  return await new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      globalThis.clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onAbort)
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onAbort = () => {
      controller.abort()
      settle(() => reject(new CombatCommandAbortedError(commandId)))
    }
    const timer = globalThis.setTimeout(() => {
      controller.abort()
      settle(() => reject(new CombatCommandTimeoutError(commandId)))
    }, Math.max(1, timeoutMs))
    externalSignal?.addEventListener('abort', onAbort, { once: true })
    void Promise.resolve().then(() => operation(controller.signal)).then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error)),
    )
  })
}

export interface CombatCommandCoordinatorOptions {
  now?: () => number
  maxRememberedCommands?: number
}

/**
 * Coordinates PUT/retry/poll without coupling success to real-time events.
 * A commandId is permanently bound to one canonical payload for this client
 * instance; terminal authority receipts are immutable and may be returned from
 * the local cache on a later identical retry.
 */
export class CombatCommandCoordinator {
  private readonly transport: CombatCommandTransport
  private readonly now: () => number
  private readonly maxRememberedCommands: number
  private readonly fingerprints = new Map<string, string>()
  private readonly terminalReceipts = new Map<string, TerminalCombatCommandReceiptV1>()
  private readonly inFlight = new Map<string, Promise<TerminalCombatCommandReceiptV1>>()
  private readonly latestReceipts = new Map<string, CombatCommandReceiptV1>()

  constructor(transport: CombatCommandTransport, options: CombatCommandCoordinatorOptions = {}) {
    this.transport = transport
    this.now = options.now ?? Date.now
    this.maxRememberedCommands = Math.max(16, options.maxRememberedCommands ?? 512)
  }

  execute(
    command: CombatCommandV1,
    options: CombatCommandExecutionOptions = {},
  ): Promise<TerminalCombatCommandReceiptV1> {
    const fingerprint = fingerprintCombatCommand(command)
    const previous = this.fingerprints.get(command.commandId)
    if (previous && previous !== fingerprint) {
      return Promise.resolve(clientConflictReceipt(command, this.now()))
    }
    this.rememberFingerprint(command.commandId, fingerprint)
    const terminal = this.terminalReceipts.get(command.commandId)
    if (terminal) return Promise.resolve(terminal)
    const active = this.inFlight.get(command.commandId)
    if (active) return active
    const operation = this.executeUncached(command, options)
      .then((receipt) => {
        this.terminalReceipts.set(command.commandId, receipt)
        this.latestReceipts.set(command.commandId, receipt)
        return receipt
      })
      .finally(() => {
        if (this.inFlight.get(command.commandId) === operation) {
          this.inFlight.delete(command.commandId)
        }
      })
    this.inFlight.set(command.commandId, operation)
    return operation
  }

  latestReceipt(commandId: string): CombatCommandReceiptV1 | undefined {
    return this.latestReceipts.get(commandId)
  }

  forget(commandId: string): void {
    if (this.inFlight.has(commandId)) return
    this.fingerprints.delete(commandId)
    this.terminalReceipts.delete(commandId)
    this.latestReceipts.delete(commandId)
  }

  private async executeUncached(
    command: CombatCommandV1,
    options: CombatCommandExecutionOptions,
  ): Promise<TerminalCombatCommandReceiptV1> {
    const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_COMBAT_COMMAND_TIMEOUT_MS)
    const requestTimeoutMs = Math.max(
      1,
      options.requestTimeoutMs ?? DEFAULT_COMBAT_COMMAND_REQUEST_TIMEOUT_MS,
    )
    const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? DEFAULT_COMBAT_COMMAND_POLL_INTERVAL_MS)
    const maxPutAttempts = Math.max(1, Math.floor(options.maxPutAttempts ?? 2))
    const deadline = this.now() + timeoutMs
    let lastReceipt = this.latestReceipts.get(command.commandId)
    let putAttempts = 0

    while (putAttempts < maxPutAttempts) {
      this.assertNotAborted(command.commandId, options.signal)
      const remaining = deadline - this.now()
      if (remaining <= 0) throw new CombatCommandTimeoutError(command.commandId, lastReceipt)
      putAttempts += 1
      try {
        lastReceipt = await withRequestDeadline(
          command.commandId,
          Math.min(remaining, requestTimeoutMs),
          options.signal,
          (signal) => this.transport.put(command, signal),
        )
        this.latestReceipts.set(command.commandId, lastReceipt)
        break
      } catch (error) {
        if (error instanceof CombatCommandTimeoutError && this.now() >= deadline) {
          throw new CombatCommandTimeoutError(command.commandId, lastReceipt)
        }
        if (!retryableTransportError(error)) {
          throw error
        }
        // After an ambiguous PUT failure, never claim the command was not
        // accepted. Exhausting PUT attempts switches to receipt polling; the
        // same stable id can be retried by a later execution if polling times out.
        if (putAttempts >= maxPutAttempts) break
      }
    }
    if (lastReceipt && isTerminalCombatCommandReceipt(lastReceipt)) return lastReceipt

    for (;;) {
      this.assertNotAborted(command.commandId, options.signal)
      const remaining = deadline - this.now()
      if (remaining <= 0) throw new CombatCommandTimeoutError(command.commandId, lastReceipt)
      if (pollIntervalMs > 0) {
        try {
          await delay(Math.min(pollIntervalMs, remaining), options.signal)
        } catch (error) {
          if (error instanceof CombatCommandAbortedError) {
            throw new CombatCommandAbortedError(command.commandId)
          }
          throw error
        }
      }
      const afterDelay = deadline - this.now()
      if (afterDelay <= 0) throw new CombatCommandTimeoutError(command.commandId, lastReceipt)
      try {
        const receipt = await withRequestDeadline(
          command.commandId,
          Math.min(afterDelay, requestTimeoutMs),
          options.signal,
          (signal) => this.transport.get(command.commandId, command.type, signal),
        )
        if (!receipt) continue
        lastReceipt = receipt
        this.latestReceipts.set(command.commandId, receipt)
        if (isTerminalCombatCommandReceipt(receipt)) return receipt
      } catch (error) {
        if (!retryableTransportError(error)) throw error
      }
    }
  }

  private assertNotAborted(commandId: string, signal?: AbortSignal): void {
    if (signal?.aborted) throw new CombatCommandAbortedError(commandId)
  }

  private rememberFingerprint(commandId: string, fingerprint: string): void {
    if (this.fingerprints.has(commandId)) return
    this.fingerprints.set(commandId, fingerprint)
    while (this.fingerprints.size > this.maxRememberedCommands) {
      const oldest = this.fingerprints.keys().next().value as string | undefined
      if (!oldest || this.inFlight.has(oldest)) break
      this.forget(oldest)
    }
  }
}

export function createSharedCombatCommandCoordinator(
  transportOptions: CombatCommandHttpTransportOptions = {},
  coordinatorOptions: CombatCommandCoordinatorOptions = {},
): CombatCommandCoordinator {
  return new CombatCommandCoordinator(
    createCombatCommandHttpTransport(transportOptions),
    coordinatorOptions,
  )
}
