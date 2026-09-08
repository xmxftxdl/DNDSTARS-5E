import type { CombatSettlementMode } from './combatSettlementMode'

export type Dnd5eMonsterControlMode = 'manual'

/**
 * DM-authoritative monster control state shared with every room client.
 *
 * `automatic` remains readable only for schema-v1 snapshots written by older
 * clients. Every newly created or normalized state is permanently manual;
 * live combat no longer exposes or schedules monster AI turns.
 */
export interface Dnd5eMonsterControlStateV1 {
  schemaVersion: 1
  mode: 'manual'
  pauseRequested: false
  controlledTokenId?: string
  updatedAt: number
}

/** Wire-only shape accepted while old room snapshots are being migrated. */
export interface Dnd5eMonsterControlWireStateV1 {
  schemaVersion: 1
  mode: 'automatic' | 'manual'
  pauseRequested: boolean
  controlledTokenId?: string
  requestedAt?: number
  updatedAt: number
}

function finiteTimestamp(value: unknown, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback
}

export function createDnd5eMonsterControlState(
  _settlementMode: CombatSettlementMode,
  now: number,
): Dnd5eMonsterControlStateV1 {
  return {
    schemaVersion: 1,
    mode: 'manual',
    pauseRequested: false,
    updatedAt: finiteTimestamp(now, 0),
  }
}

export function isDnd5eMonsterControlStateV1(
  value: unknown,
): value is Dnd5eMonsterControlStateV1 {
  return isDnd5eMonsterControlWireStateV1(value) &&
    value.mode === 'manual' && value.pauseRequested === false
}

export function isDnd5eMonsterControlWireStateV1(
  value: unknown,
): value is Dnd5eMonsterControlWireStateV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as Record<string, unknown>
  if (state.schemaVersion !== 1) return false
  if (state.mode !== 'automatic' && state.mode !== 'manual') return false
  if (typeof state.pauseRequested !== 'boolean') return false
  if (!Number.isFinite(state.updatedAt) || Number(state.updatedAt) < 0) return false
  if (
    state.controlledTokenId != null &&
    (
      typeof state.controlledTokenId !== 'string' ||
      !state.controlledTokenId.trim() ||
      state.controlledTokenId.length > 180
    )
  ) return false
  if (
    state.requestedAt != null &&
    (!Number.isFinite(state.requestedAt) || Number(state.requestedAt) < 0)
  ) return false
  if (
    state.pauseRequested &&
    (
      state.mode !== 'automatic' ||
      typeof state.controlledTokenId !== 'string' ||
      state.requestedAt == null
    )
  ) return false
  return true
}

export function normalizeDnd5eMonsterControlState(
  value: unknown,
  settlementMode: CombatSettlementMode,
  now: number,
): Dnd5eMonsterControlStateV1 {
  if (!isDnd5eMonsterControlWireStateV1(value)) {
    return createDnd5eMonsterControlState(settlementMode, now)
  }
  return {
    schemaVersion: 1,
    mode: 'manual',
    pauseRequested: false,
    controlledTokenId: value.controlledTokenId?.trim(),
    updatedAt: value.updatedAt,
  }
}

export function dnd5eMonsterManualControlEnabled(
  state: Dnd5eMonsterControlStateV1,
): boolean {
  return state.mode === 'manual'
}

/**
 * Returns whether a dropped Token must use the current monster's authoritative
 * Headless movement transaction. Keep this check independent from React's
 * rendered/selected Token: selection and initiative snapshots can settle in
 * different frames, while the initiative refs remain the movement authority.
 */
export function dnd5eMonsterManualMovementEnabled(
  state: Dnd5eMonsterControlStateV1,
  input: {
    combatActive: boolean
    currentTokenId?: string
    token: { id: string; type: string }
  },
): boolean {
  return input.combatActive &&
    dnd5eMonsterManualControlEnabled(state) &&
    input.token.type === 'enemy' &&
    input.token.id === input.currentTokenId
}
