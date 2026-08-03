import { describe, expect, it, vi } from 'vitest'
import {
  clearLocalRoomCampaignCache,
  isAccountCampaignId,
  LOCAL_ROOM_CAMPAIGN_CACHE_KEYS,
  nextCampaignRoomPath,
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

  it('keeps the account campaign id when creating the next temporary room', () => {
    expect(isAccountCampaignId('ABCDEFGH2345')).toBe(true)
    expect(nextCampaignRoomPath('abcdefgh2345')).toBe('/app/rooms?mode=create&campaign=ABCDEFGH2345')
    expect(nextCampaignRoomPath('ABC123')).toBeNull()
  })
})
