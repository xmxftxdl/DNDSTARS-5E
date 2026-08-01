import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type {
  Dnd5eTurnEconomyByToken,
  SharedCombatFlowPauseV1,
  SharedCombatState,
} from './sharedCombatTypes'
import { normalizeCombatSettlementMode, type CombatSettlementMode } from './combatSettlementMode'
import {
  normalizeDnd5eMonsterControlState,
  type Dnd5eMonsterControlStateV1,
} from './monsterControlState'
import {
  normalizeDnd5eMonsterTurnProgress,
  type Dnd5eMonsterTurnProgressV1,
} from './monsterTurnProgress'

export interface SharedCombatStateMigration {
  state: SharedCombatState
  removedLegacyAp: boolean
}

export function normalizeSharedCombatFlowPause(value: unknown): SharedCombatFlowPauseV1 | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Partial<SharedCombatFlowPauseV1>
  if (
    source.schemaVersion !== 1 ||
    (source.reason !== 'manual' && source.reason !== 'dm-adjudication') ||
    !['paused', 'adjudicating', 'awaiting-resume'].includes(source.phase ?? '') ||
    !Number.isFinite(source.pausedAt) ||
    Number(source.pausedAt) < 0 ||
    (source.interruptId != null && (
      typeof source.interruptId !== 'string' ||
      !source.interruptId.trim() ||
      source.interruptId.length > 320
    )) ||
    (source.label != null && (typeof source.label !== 'string' || source.label.length > 240)) ||
    (source.resolvedAt != null && (!Number.isFinite(source.resolvedAt) || Number(source.resolvedAt) < 0)) ||
    (source.reason === 'manual' && source.phase !== 'paused') ||
    (source.reason === 'dm-adjudication' && (
      source.phase === 'paused' ||
      typeof source.interruptId !== 'string'
    ))
  ) return undefined
  return {
    schemaVersion: 1,
    reason: source.reason,
    phase: source.phase as SharedCombatFlowPauseV1['phase'],
    pausedAt: Number(source.pausedAt),
    ...(source.interruptId ? { interruptId: source.interruptId } : {}),
    ...(source.label != null ? { label: source.label } : {}),
    ...(source.resolvedAt != null ? { resolvedAt: Number(source.resolvedAt) } : {}),
  }
}

/**
 * Old shared snapshots may still contain the pre-5e enemy AP ledger. Do not
 * merely ignore it: remove it before applying or republishing the snapshot so
 * every connected client converges on the AP-free 5e protocol.
 */
export function migrateLegacyApSharedCombatState(state: SharedCombatState): SharedCombatStateMigration {
  const legacy = state as SharedCombatState & { enemyApByToken?: unknown }
  if (!Object.prototype.hasOwnProperty.call(legacy, 'enemyApByToken')) {
    return { state, removedLegacyAp: false }
  }
  const migrated = { ...legacy }
  delete migrated.enemyApByToken
  return { state: migrated, removedLegacyAp: true }
}

export function reconcileDnd5eTurnEconomy(
  incoming: Dnd5eTurnEconomyByToken | undefined,
  existing: Dnd5eTurnEconomyByToken,
  validTokenIds: Set<string>,
): Dnd5eTurnEconomyByToken {
  const source = incoming === undefined ? existing : incoming
  return Object.fromEntries(
    Object.entries(source).filter(([tokenId]) => validTokenIds.has(tokenId)).map(([tokenId, economy]) => [
      tokenId,
      {
        turnKey: economy.turnKey,
        attacksUsed: Math.max(0, Math.floor(economy.attacksUsed ?? 0)),
        action: { ...economy.action },
        bonusAction: { ...economy.bonusAction },
        reaction: { ...economy.reaction },
        objectInteraction: economy.objectInteraction
          ? { ...economy.objectInteraction }
          : { current: 1, max: 1 },
        movement: economy.movement
          ? { ...economy.movement }
          : { current: 30, max: 30 },
      },
    ]),
  )
}

export type SharedCombatStateApplyDecision =
  | { status: 'ignored'; reason: 'missing-state' | 'wrong-map' | 'empty-token-map' | 'stale' | 'unchanged' }
  | {
      status: 'apply'
      active: boolean
      round: number
      initiativeOrder: InitiativeEntry[]
      initiativeIndex: number
      dnd5eTurnEconomyByToken: Dnd5eTurnEconomyByToken
      settlementMode: CombatSettlementMode
      monsterControl: Dnd5eMonsterControlStateV1
      flowPause?: SharedCombatFlowPauseV1
      monsterTurnProgress?: Dnd5eMonsterTurnProgressV1
      incomingCombatId: string
      incomingUpdatedAt: number
      snapshot: string
      combatChanged: boolean
      shouldResetPlayerActionState: boolean
      playerCombatEndedLocked?: boolean
    }

export function resolveSharedCombatStateApply(input: {
  state?: SharedCombatState | null
  mapId: string
  validTokenIds: Iterable<string>
  currentCombatId: string
  currentDnd5eTurnEconomyByToken?: Dnd5eTurnEconomyByToken
  lastAppliedCombatId: string
  lastAppliedUpdatedAt: number
  lastSnapshot: string
  isDm: boolean
  /** Injectable only for deterministic expiry checks in tests. */
  now?: number
}): SharedCombatStateApplyDecision {
  const state = input.state
  if (!state) return { status: 'ignored', reason: 'missing-state' }
  if (state.mapId !== input.mapId) return { status: 'ignored', reason: 'wrong-map' }

  const visibleTokenIds = new Set(input.validTokenIds)
  if (input.isDm && state.active && (state.initiativeOrder?.length ?? 0) > 0 && visibleTokenIds.size === 0) {
    return { status: 'ignored', reason: 'empty-token-map' }
  }

  // The combat snapshot is authoritative for players. Their projected map can
  // temporarily omit a combatant because of fog/LOS or while an edge-position
  // correction is arriving; that must not delete its initiative slot.
  const combatTokenIds = input.isDm
    ? visibleTokenIds
    : new Set([
        ...visibleTokenIds,
        ...(state.initiativeOrder ?? []).map((entry) => entry.tokenId),
      ])
  const initiativeOrder = (state.initiativeOrder ?? []).filter((entry) => combatTokenIds.has(entry.tokenId))
  const initiativeIndex =
    initiativeOrder.length > 0
      ? Math.min(Math.max(0, state.initiativeIndex ?? 0), initiativeOrder.length - 1)
      : 0
  const active = Boolean(state.active && initiativeOrder.length > 0)
  const dnd5eTurnEconomyByToken = reconcileDnd5eTurnEconomy(
    state.dnd5eTurnEconomyByToken,
    input.currentDnd5eTurnEconomyByToken ?? {},
    combatTokenIds,
  )
  const incomingCombatId = state.combatId ?? ''
  const incomingUpdatedAt = state.updatedAt ?? 0
  const settlementMode = normalizeCombatSettlementMode(state.settlementMode)
  const currentEntry = initiativeOrder[initiativeIndex]
  const monsterTurnProgress = normalizeDnd5eMonsterTurnProgress(
    state.monsterTurnProgress,
    {
      active,
      current: active && incomingCombatId && currentEntry
        ? {
            combatId: incomingCombatId,
            round: state.round,
            initiativeIndex,
            initiativeSlotId: currentEntry.slotId ?? currentEntry.tokenId,
            tokenId: currentEntry.tokenId,
          }
        : undefined,
      now: input.now ?? Date.now(),
    },
  )

  if (
    incomingCombatId === input.lastAppliedCombatId &&
    incomingUpdatedAt < input.lastAppliedUpdatedAt
  ) {
    return { status: 'ignored', reason: 'stale' }
  }

  // Snapshot the normalized lease, not the raw wire value. Once its deadline
  // passes, a recovery read must produce a different snapshot and clear a
  // previously rendered thinking badge even when no newer write arrived.
  const snapshot = JSON.stringify({
    state: { ...state, monsterTurnProgress },
    tokenIds: Array.from(combatTokenIds).sort(),
  })
  if (snapshot === input.lastSnapshot) return { status: 'ignored', reason: 'unchanged' }

  const combatChanged = incomingCombatId !== input.currentCombatId
  return {
    status: 'apply',
    active,
    round: state.round,
    initiativeOrder,
    initiativeIndex,
    dnd5eTurnEconomyByToken,
    settlementMode,
    monsterControl: normalizeDnd5eMonsterControlState(
      state.monsterControl,
      settlementMode,
      incomingUpdatedAt,
    ),
    flowPause: normalizeSharedCombatFlowPause(state.flowPause),
    monsterTurnProgress,
    incomingCombatId,
    incomingUpdatedAt,
    snapshot,
    combatChanged,
    shouldResetPlayerActionState: combatChanged || !active,
    playerCombatEndedLocked: active ? false : !input.isDm && incomingCombatId ? true : undefined,
  }
}
