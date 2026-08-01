export type Dnd5eMonsterTurnProgressStatus = 'starting' | 'planning'

/**
 * Short-lived, DM-authoritative marker for the gap between advancing initiative
 * onto an automated monster and obtaining its plan. It intentionally does not
 * describe execution: once a plan exists, normal combat presentation is the
 * source of truth and this marker must be removed from the combat snapshot.
 */
export interface Dnd5eMonsterTurnProgressV1 {
  schemaVersion: 1
  status: Dnd5eMonsterTurnProgressStatus
  combatId: string
  round: number
  initiativeIndex: number
  initiativeSlotId: string
  tokenId: string
  /** End-turn action id (or another authority request id) that started the turn. */
  requestId: string
  startedAt: number
  updatedAt: number
  /** A stale Host must not leave every client showing an infinite spinner. */
  expiresAt: number
}

export interface Dnd5eMonsterTurnIdentity {
  combatId: string
  round: number
  initiativeIndex: number
  initiativeSlotId: string
  tokenId: string
}

export const DND5E_MONSTER_TURN_PROGRESS_DEFAULT_LEASE_MS = 60_000
export const DND5E_MONSTER_TURN_PROGRESS_MAX_LEASE_MS = 120_000

const MAX_COMBAT_ID_LENGTH = 300
const MAX_SLOT_ID_LENGTH = 220
const MAX_TOKEN_ID_LENGTH = 180
const MAX_REQUEST_ID_LENGTH = 300

function nonEmptyBoundedString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength
}

function finiteTimestamp(value: unknown): value is number {
  return Number.isFinite(value) && Number(value) >= 0
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

export function dnd5eMonsterTurnIdentityKey(identity: Dnd5eMonsterTurnIdentity): string {
  return [
    identity.combatId,
    identity.round,
    identity.initiativeIndex,
    identity.initiativeSlotId,
    identity.tokenId,
  ].join(':')
}

/** Shape validation only. Current-turn and expiry checks belong to normalization. */
export function isDnd5eMonsterTurnProgressV1(
  value: unknown,
): value is Dnd5eMonsterTurnProgressV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const progress = value as Record<string, unknown>
  if (progress.schemaVersion !== 1) return false
  if (progress.status !== 'starting' && progress.status !== 'planning') return false
  if (!nonEmptyBoundedString(progress.combatId, MAX_COMBAT_ID_LENGTH)) return false
  if (!positiveInteger(progress.round)) return false
  if (!nonNegativeInteger(progress.initiativeIndex)) return false
  if (!nonEmptyBoundedString(progress.initiativeSlotId, MAX_SLOT_ID_LENGTH)) return false
  if (!nonEmptyBoundedString(progress.tokenId, MAX_TOKEN_ID_LENGTH)) return false
  if (!nonEmptyBoundedString(progress.requestId, MAX_REQUEST_ID_LENGTH)) return false
  if (!finiteTimestamp(progress.startedAt)) return false
  if (!finiteTimestamp(progress.updatedAt)) return false
  if (!finiteTimestamp(progress.expiresAt)) return false
  if (Number(progress.updatedAt) < Number(progress.startedAt)) return false
  if (Number(progress.expiresAt) <= Number(progress.updatedAt)) return false
  if (
    Number(progress.expiresAt) - Number(progress.updatedAt) >
    DND5E_MONSTER_TURN_PROGRESS_MAX_LEASE_MS
  ) return false
  return true
}

function normalizeLeaseMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DND5E_MONSTER_TURN_PROGRESS_DEFAULT_LEASE_MS
  return Math.max(1_000, Math.min(DND5E_MONSTER_TURN_PROGRESS_MAX_LEASE_MS, Math.floor(value!)))
}

export function createDnd5eMonsterTurnProgress(input: {
  identity: Dnd5eMonsterTurnIdentity
  requestId: string
  now: number
  status?: Dnd5eMonsterTurnProgressStatus
  leaseMs?: number
}): Dnd5eMonsterTurnProgressV1 {
  const now = finiteTimestamp(input.now) ? input.now : 0
  const leaseMs = normalizeLeaseMs(input.leaseMs)
  return {
    schemaVersion: 1,
    status: input.status ?? 'starting',
    combatId: input.identity.combatId,
    round: input.identity.round,
    initiativeIndex: input.identity.initiativeIndex,
    initiativeSlotId: input.identity.initiativeSlotId,
    tokenId: input.identity.tokenId,
    requestId: input.requestId,
    startedAt: now,
    updatedAt: now,
    expiresAt: now + leaseMs,
  }
}

/** Refreshes the lease only when the same authority request still owns this turn. */
export function markDnd5eMonsterTurnPlanning(
  progress: Dnd5eMonsterTurnProgressV1,
  input: { requestId: string; now: number; leaseMs?: number },
): Dnd5eMonsterTurnProgressV1 | undefined {
  if (progress.requestId !== input.requestId || !finiteTimestamp(input.now)) return undefined
  return {
    ...progress,
    status: 'planning',
    updatedAt: input.now,
    expiresAt: input.now + normalizeLeaseMs(input.leaseMs),
  }
}

/**
 * Drops malformed, expired, or wrong-turn markers. Older combat snapshots have
 * no marker and therefore remain fully compatible.
 */
export function normalizeDnd5eMonsterTurnProgress(
  value: unknown,
  input: {
    active: boolean
    current: Dnd5eMonsterTurnIdentity | undefined
    now: number
  },
): Dnd5eMonsterTurnProgressV1 | undefined {
  if (!isDnd5eMonsterTurnProgressV1(value)) return undefined
  if (!input.active || !input.current || !finiteTimestamp(input.now)) return undefined
  if (input.now >= value.expiresAt) return undefined
  if (dnd5eMonsterTurnIdentityKey(value) !== dnd5eMonsterTurnIdentityKey(input.current)) {
    return undefined
  }
  return { ...value }
}
