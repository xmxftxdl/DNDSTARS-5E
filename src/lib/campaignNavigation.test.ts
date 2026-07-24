import { describe, expect, it, vi } from 'vitest'
import {
  clearLocalRoomCampaignCache,
  LOCAL_ROOM_CAMPAIGN_CACHE_KEYS,
  requestedRoomLobbyMode,
} from './campaignNavigation'

describe('campaign navigation', () => {
  it('honors an explicit new-campaign lobby mode over room resume defaults', () => {
    expect(requestedRoomLobbyMode('?mode=create')).toBe('create')
    expect(requestedRoomLobbyMode('?mode=join')).toBe('join')
    expect(requestedRoomLobbyMode('?join=ABC123')).toBeNull()
  })

  it('clears only room-scoped campaign snapshots before entering a new room', () => {
    const removeItem = vi.fn()

    clearLocalRoomCampaignCache({ removeItem })

    expect(removeItem.mock.calls.map(([key]) => key)).toEqual([...LOCAL_ROOM_CAMPAIGN_CACHE_KEYS])
    expect(removeItem).not.toHaveBeenCalledWith('stars-account-session:v1')
    expect(removeItem).not.toHaveBeenCalledWith('stars-room-player-resume:v1')
  })
})
