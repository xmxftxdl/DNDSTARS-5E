import { create } from 'zustand'
import {
  CAMPAIGN_TIME_RESOURCE,
  normalizeSharedCampaignTime,
  type CampaignTimeMutation,
  type SharedCampaignTimeState,
} from '../lib/campaignTime'
import { loadSharedResource, mutateSharedRoomResource } from '../composition/browserSharedRoomResources'
import { getRoomSession } from '../lib/roomSession'

interface CampaignTimeStore {
  state: SharedCampaignTimeState
  hydratedRoomId: string | null
  loadShared: () => Promise<void>
  mutate: (mutation: CampaignTimeMutation) => Promise<SharedCampaignTimeState>
  reset: () => void
}

const emptyState = normalizeSharedCampaignTime(null)

function currentCampaignTimeRoomId(): string {
  return getRoomSession()?.roomId ?? '__local__'
}

export const useCampaignTimeStore = create<CampaignTimeStore>((set) => ({
  state: emptyState,
  hydratedRoomId: getRoomSession() ? null : '__local__',
  loadShared: async () => {
    const roomId = currentCampaignTimeRoomId()
    const state = normalizeSharedCampaignTime(await loadSharedResource(CAMPAIGN_TIME_RESOURCE))
    if (roomId === currentCampaignTimeRoomId()) set({ state, hydratedRoomId: roomId })
  },
  mutate: async (mutation) => {
    const roomId = currentCampaignTimeRoomId()
    const result = normalizeSharedCampaignTime(await mutateSharedRoomResource<SharedCampaignTimeState>(
      CAMPAIGN_TIME_RESOURCE,
      '/state/campaign-time/mutation',
      mutation,
    ))
    if (roomId === currentCampaignTimeRoomId()) set({ state: result, hydratedRoomId: roomId })
    return result
  },
  reset: () => set({
    state: emptyState,
    hydratedRoomId: getRoomSession() ? null : '__local__',
  }),
}))
