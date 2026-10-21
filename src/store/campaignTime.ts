import type { prepareDnd5eCampaignInteractionStart } from '../rulesets/dnd5e/campaignInteractionAuthority'
import { create } from 'zustand'
import {
  CAMPAIGN_TIME_RESOURCE,
  normalizeSharedCampaignTime,
  type CampaignTimeMutation,
  type SharedCampaignTimeState,
} from '../lib/campaignTime'
import { loadSharedResource, mutateSharedRoomResource } from '../composition/browserSharedRoomResources'
import { getRoomSession } from '../lib/roomSession'
import {setMapGeometryWorldMinuteReader} from '../lib/mapGeometry'

interface CampaignTimeStore {
  state: SharedCampaignTimeState
  hydratedRoomId: string | null
  loadShared: () => Promise<void>
  mutate: (mutation: CampaignTimeMutation) => Promise<SharedCampaignTimeState>
  startInteraction: (input: Omit<Parameters<typeof prepareDnd5eCampaignInteractionStart>[0], 'worldMinute'>) => Promise<SharedCampaignTimeState>
  reset: () => void
}

const emptyState = normalizeSharedCampaignTime(null)

function currentCampaignTimeRoomId(): string {
  return getRoomSession()?.roomId ?? '__local__'
}

export const useCampaignTimeStore = create<CampaignTimeStore>((set, get) => ({
  state: emptyState,
  hydratedRoomId: getRoomSession() ? null : '__local__',
  loadShared: async () => {
    const roomId = currentCampaignTimeRoomId()
    const resource = await loadSharedResource(CAMPAIGN_TIME_RESOURCE)
    // A failed room read also returns null. Never treat the local default
    // clock as authoritative: it can expire effects during a page reload.
    if (resource == null && roomId !== '__local__') return
    const state = normalizeSharedCampaignTime(resource)
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
  startInteraction: async (input) => {
    const { prepareDnd5eCampaignInteractionStart } = await import('../rulesets/dnd5e/campaignInteractionAuthority')
    const prepared = prepareDnd5eCampaignInteractionStart({ ...input, worldMinute: get().state.worldMinute })
    if (!prepared.ok) throw new Error(prepared.reason)
    return get().mutate(prepared.mutation)
  },
  reset: () => set({
    state: emptyState,
    hydratedRoomId: getRoomSession() ? null : '__local__',
  }),
}))

setMapGeometryWorldMinuteReader(() => {
  const state = useCampaignTimeStore.getState()
  return state.hydratedRoomId === currentCampaignTimeRoomId() ? state.state.worldMinute : undefined
})
