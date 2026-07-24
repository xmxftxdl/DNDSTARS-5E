export type RoomLobbyMode = 'create' | 'join'

export const LOCAL_ROOM_CAMPAIGN_CACHE_KEYS = [
  'stars-maps',
  'stars-characters',
] as const

export function requestedRoomLobbyMode(search: string): RoomLobbyMode | null {
  const mode = new URLSearchParams(search).get('mode')
  return mode === 'create' || mode === 'join' ? mode : null
}

/**
 * A newly allocated room must not bootstrap itself from the previous room's
 * persisted Zustand snapshots. Account identity and recovery information are
 * intentionally stored under separate keys and are not touched here.
 */
export function clearLocalRoomCampaignCache(storage: Pick<Storage, 'removeItem'>): void {
  for (const key of LOCAL_ROOM_CAMPAIGN_CACHE_KEYS) storage.removeItem(key)
}
