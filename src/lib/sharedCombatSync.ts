import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { Dnd5eTurnEconomyByToken, SharedCombatState } from './sharedCombatTypes'
import { normalizeCombatSettlementMode, type CombatSettlementMode } from './combatSettlementMode'
import {
  normalizeDnd5eMonsterControlState,
  type Dnd5eMonsterControlStateV1,
} from './monsterControlState'

export interface SharedCombatStateMigration {
  state: SharedCombatState
  removedLegacyAp: boolean
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

  if (
    incomingCombatId === input.lastAppliedCombatId &&
    incomingUpdatedAt < input.lastAppliedUpdatedAt
  ) {
    return { status: 'ignored', reason: 'stale' }
  }

  const snapshot = JSON.stringify({ state, tokenIds: Array.from(combatTokenIds).sort() })
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
    incomingCombatId,
    incomingUpdatedAt,
    snapshot,
    combatChanged,
    shouldResetPlayerActionState: combatChanged || !active,
    playerCombatEndedLocked: active ? false : !input.isDm && incomingCombatId ? true : undefined,
  }
}
