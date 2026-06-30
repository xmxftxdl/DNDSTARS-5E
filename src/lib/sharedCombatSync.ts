import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { SharedCombatState } from './sharedCombatTypes'

export type EnemyApByToken = Record<string, { current: number; max: number }>

/**
 * Reconcile enemy AP from a shared combat snapshot.
 *
 * If the incoming field is missing, keep the local spent-AP state. If the field
 * is present, treat it as the authoritative full snapshot.
 */
export function reconcileEnemyAp(
  incoming: EnemyApByToken | undefined,
  existing: EnemyApByToken,
  validTokenIds: Set<string>,
): EnemyApByToken {
  if (incoming === undefined && Object.keys(existing).length > 0) {
    return Object.fromEntries(
      Object.entries(existing).filter(([tokenId]) => validTokenIds.has(tokenId)),
    )
  }
  return Object.fromEntries(
    Object.entries(incoming ?? {}).filter(([tokenId]) => validTokenIds.has(tokenId)),
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
      enemyApByToken: EnemyApByToken
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
  currentEnemyApByToken: EnemyApByToken
  lastAppliedCombatId: string
  lastAppliedUpdatedAt: number
  lastSnapshot: string
  isDm: boolean
}): SharedCombatStateApplyDecision {
  const state = input.state
  if (!state) return { status: 'ignored', reason: 'missing-state' }
  if (state.mapId !== input.mapId) return { status: 'ignored', reason: 'wrong-map' }

  const validTokenIds = new Set(input.validTokenIds)
  if (state.active && (state.initiativeOrder?.length ?? 0) > 0 && validTokenIds.size === 0) {
    return { status: 'ignored', reason: 'empty-token-map' }
  }

  const initiativeOrder = (state.initiativeOrder ?? []).filter((entry) => validTokenIds.has(entry.tokenId))
  const initiativeIndex =
    initiativeOrder.length > 0
      ? Math.min(Math.max(0, state.initiativeIndex ?? 0), initiativeOrder.length - 1)
      : 0
  const active = Boolean(state.active && initiativeOrder.length > 0)
  const enemyApByToken = reconcileEnemyAp(
    state.enemyApByToken,
    input.currentEnemyApByToken,
    validTokenIds,
  )
  const incomingCombatId = state.combatId ?? ''
  const incomingUpdatedAt = state.updatedAt ?? 0

  if (
    incomingCombatId === input.lastAppliedCombatId &&
    incomingUpdatedAt < input.lastAppliedUpdatedAt
  ) {
    return { status: 'ignored', reason: 'stale' }
  }

  const snapshot = JSON.stringify({ state, tokenIds: Array.from(validTokenIds).sort() })
  if (snapshot === input.lastSnapshot) return { status: 'ignored', reason: 'unchanged' }

  const combatChanged = incomingCombatId !== input.currentCombatId
  return {
    status: 'apply',
    active,
    round: state.round,
    initiativeOrder,
    initiativeIndex,
    enemyApByToken,
    incomingCombatId,
    incomingUpdatedAt,
    snapshot,
    combatChanged,
    shouldResetPlayerActionState: combatChanged || !active,
    playerCombatEndedLocked: active ? false : !input.isDm && incomingCombatId ? true : undefined,
  }
}
