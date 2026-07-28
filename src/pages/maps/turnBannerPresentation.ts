export interface PlayerTurnBannerIdentity {
  combatId: string
  round: number
  slotId: string
}

/**
 * A turn banner is a one-shot presentation for a concrete initiative slot.
 * Keep its identity independent from token/character snapshots: moving or
 * resolving an action may replace those objects without actually starting a
 * new turn.
 */
export function playerTurnBannerKey(input: PlayerTurnBannerIdentity): string {
  return `${input.combatId}:${input.round}:${input.slotId}`
}

export function shouldPresentPlayerTurnBanner(
  lastPresentedKey: string | null,
  nextKey: string,
): boolean {
  return lastPresentedKey !== nextKey
}

export interface PlayerTurnBannerStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const PLAYER_TURN_BANNER_STORAGE_PREFIX = 'dndstars5e:player-turn-banner:'

/**
 * Claim a concrete turn before scheduling its banner. Session storage keeps
 * the claim across panel-driven route remounts and reloads, while naturally
 * resetting when the browser session ends.
 */
export function claimPlayerTurnBanner(
  storage: PlayerTurnBannerStorage | undefined,
  lastPresentedKey: string | null,
  nextKey: string,
): boolean {
  if (!shouldPresentPlayerTurnBanner(lastPresentedKey, nextKey)) return false
  if (!storage) return true
  const storageKey = `${PLAYER_TURN_BANNER_STORAGE_PREFIX}${nextKey}`
  try {
    if (storage.getItem(storageKey) === 'shown') return false
    storage.setItem(storageKey, 'shown')
  } catch {
    // Storage can be unavailable in privacy-restricted contexts. The
    // component-local ref still prevents duplicate effects while mounted.
  }
  return true
}
