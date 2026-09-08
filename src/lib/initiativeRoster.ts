import type { InitiativeEntry } from '../components/map/InitiativeTracker'

export interface InitiativeRosterPruneResult {
  order: InitiativeEntry[]
  index: number
  /** The active slot itself was removed, rather than merely shifting left. */
  activeEntryRemoved: boolean
  /** The removed active slot had no surviving successor in the current round. */
  wrappedToStart: boolean
  removedTokenIds: string[]
}

/**
 * Removes initiative slots whose map token no longer exists while preserving
 * the identity of the active slot. If the active slot was removed, the next
 * surviving slot in turn order becomes active (wrapping to the first slot).
 *
 * Initiative is slot based: one token can legitimately own multiple slots.
 * Filtering and adjusting by only the first matching index therefore corrupts
 * the active index. This helper treats the whole roster in one operation.
 */
export function pruneInitiativeForValidTokens(
  order: InitiativeEntry[],
  currentIndex: number,
  validTokenIds: ReadonlySet<string>,
): InitiativeRosterPruneResult {
  if (order.length === 0) {
    return {
      order,
      index: 0,
      activeEntryRemoved: false,
      wrappedToStart: false,
      removedTokenIds: [],
    }
  }

  const normalizedIndex = Math.min(Math.max(0, currentIndex), order.length - 1)
  const activeEntry = order[normalizedIndex]
  const removedTokenIds = [...new Set(
    order.filter((entry) => !validTokenIds.has(entry.tokenId)).map((entry) => entry.tokenId),
  )]
  if (removedTokenIds.length === 0) {
    return {
      order,
      index: currentIndex,
      activeEntryRemoved: false,
      wrappedToStart: false,
      removedTokenIds,
    }
  }

  const nextOrder = order.filter((entry) => validTokenIds.has(entry.tokenId))
  if (nextOrder.length === 0) {
    return {
      order: nextOrder,
      index: 0,
      activeEntryRemoved: true,
      wrappedToStart: false,
      removedTokenIds,
    }
  }

  if (activeEntry && validTokenIds.has(activeEntry.tokenId)) {
    return {
      order: nextOrder,
      index: nextOrder.indexOf(activeEntry),
      activeEntryRemoved: false,
      wrappedToStart: false,
      removedTokenIds,
    }
  }

  const successor = order.slice(normalizedIndex + 1)
    .find((entry) => validTokenIds.has(entry.tokenId))
  if (successor) {
    return {
      order: nextOrder,
      index: nextOrder.indexOf(successor),
      activeEntryRemoved: true,
      wrappedToStart: false,
      removedTokenIds,
    }
  }

  const wrappedSuccessor = order.slice(0, normalizedIndex)
    .find((entry) => validTokenIds.has(entry.tokenId))
  return {
    order: nextOrder,
    index: wrappedSuccessor ? nextOrder.indexOf(wrappedSuccessor) : 0,
    activeEntryRemoved: true,
    wrappedToStart: true,
    removedTokenIds,
  }
}

/** Removes every initiative slot belonging to one map token. */
export function pruneInitiativeForToken(
  order: InitiativeEntry[],
  currentIndex: number,
  tokenId: string,
): InitiativeRosterPruneResult {
  if (!order.some((entry) => entry.tokenId === tokenId)) {
    return {
      order,
      index: currentIndex,
      activeEntryRemoved: false,
      wrappedToStart: false,
      removedTokenIds: [],
    }
  }
  const pruned = pruneInitiativeForValidTokens(
    order,
    currentIndex,
    new Set(order.filter((entry) => entry.tokenId !== tokenId).map((entry) => entry.tokenId)),
  )
  // Keep the legacy single-token cursor convention for older callers that
  // separately advance/wrap the round. Full roster reconciliation uses the
  // helper above and can atomically advance the round when it wraps.
  return pruned.activeEntryRemoved && pruned.wrappedToStart && pruned.order.length > 0
    ? { ...pruned, index: pruned.order.length - 1 }
    : pruned
}
