import type { CombatSettlementMode } from './combatSettlementMode'

export type Dnd5eMonsterControlMode = 'automatic' | 'manual'

/**
 * DM-authoritative monster control state shared with every room client.
 *
 * A requested takeover deliberately remains in automatic mode until the
 * current Headless action reaches a settlement boundary. This prevents an
 * already-hit attack from losing its damage roll when the DM presses pause.
 */
export interface Dnd5eMonsterControlStateV1 {
  schemaVersion: 1
  mode: Dnd5eMonsterControlMode
  pauseRequested: boolean
  controlledTokenId?: string
  requestedAt?: number
  updatedAt: number
}

function finiteTimestamp(value: unknown, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback
}

export function createDnd5eMonsterControlState(
  settlementMode: CombatSettlementMode,
  now: number,
): Dnd5eMonsterControlStateV1 {
  return {
    schemaVersion: 1,
    mode: settlementMode === 'manual' ? 'manual' : 'automatic',
    pauseRequested: false,
    updatedAt: finiteTimestamp(now, 0),
  }
}

export function isDnd5eMonsterControlStateV1(
  value: unknown,
): value is Dnd5eMonsterControlStateV1 {
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
  if (!isDnd5eMonsterControlStateV1(value)) {
    return createDnd5eMonsterControlState(settlementMode, now)
  }
  if (settlementMode === 'manual') {
    return {
      schemaVersion: 1,
      mode: 'manual',
      pauseRequested: false,
      controlledTokenId: value.controlledTokenId,
      updatedAt: value.updatedAt,
    }
  }
  return {
    ...value,
    controlledTokenId: value.controlledTokenId?.trim(),
  }
}

export function requestDnd5eMonsterTakeover(
  state: Dnd5eMonsterControlStateV1,
  input: {
    currentTokenId?: string
    eventInFlight: boolean
    now: number
  },
): Dnd5eMonsterControlStateV1 {
  const updatedAt = finiteTimestamp(input.now, state.updatedAt)
  if (!input.eventInFlight) {
    return {
      schemaVersion: 1,
      mode: 'manual',
      pauseRequested: false,
      controlledTokenId: input.currentTokenId,
      updatedAt,
    }
  }
  return {
    schemaVersion: 1,
    mode: 'automatic',
    pauseRequested: true,
    controlledTokenId: input.currentTokenId,
    requestedAt: updatedAt,
    updatedAt,
  }
}

export function completeDnd5eMonsterTakeoverAtSafePoint(
  state: Dnd5eMonsterControlStateV1,
  currentTokenId: string,
  now: number,
): Dnd5eMonsterControlStateV1 {
  if (!state.pauseRequested) return state
  if (state.controlledTokenId && state.controlledTokenId !== currentTokenId) return state
  return {
    schemaVersion: 1,
    mode: 'manual',
    pauseRequested: false,
    controlledTokenId: currentTokenId,
    updatedAt: finiteTimestamp(now, state.updatedAt),
  }
}

export function resumeDnd5eMonsterAutomation(
  state: Dnd5eMonsterControlStateV1,
  now: number,
): Dnd5eMonsterControlStateV1 {
  return {
    schemaVersion: 1,
    mode: 'automatic',
    pauseRequested: false,
    updatedAt: finiteTimestamp(now, state.updatedAt),
  }
}

export function dnd5eMonsterAutomationEnabled(
  state: Dnd5eMonsterControlStateV1,
  settlementMode: CombatSettlementMode,
): boolean {
  return settlementMode === 'automatic' && state.mode === 'automatic'
}

export function dnd5eMonsterManualControlEnabled(
  state: Dnd5eMonsterControlStateV1,
): boolean {
  return state.mode === 'manual'
}
