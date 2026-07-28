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
