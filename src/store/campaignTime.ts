import { create } from 'zustand'
import {
  CAMPAIGN_TIME_RESOURCE,
  normalizeSharedCampaignTime,
  type CampaignTimeMutation,
  type SharedCampaignTimeState,
} from '../lib/campaignTime'
import { loadSharedResource, mutateSharedRoomResource } from '../composition/browserSharedRoomResources'

interface CampaignTimeStore {
  state: SharedCampaignTimeState
  loadShared: () => Promise<void>
  mutate: (mutation: CampaignTimeMutation) => Promise<SharedCampaignTimeState>
  reset: () => void
}

const emptyState = normalizeSharedCampaignTime(null)

export const useCampaignTimeStore = create<CampaignTimeStore>((set) => ({
  state: emptyState,
  loadShared: async () => {
    const state = normalizeSharedCampaignTime(await loadSharedResource(CAMPAIGN_TIME_RESOURCE))
    set({ state })
  },
  mutate: async (mutation) => {
    const result = normalizeSharedCampaignTime(await mutateSharedRoomResource<SharedCampaignTimeState>(
      CAMPAIGN_TIME_RESOURCE,
      '/state/campaign-time/mutation',
      mutation,
    ))
    set({ state: result })
    return result
  },
  reset: () => set({ state: emptyState }),
}))
