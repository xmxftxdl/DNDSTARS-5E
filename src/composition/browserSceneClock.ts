import { useCampaignTimeStore } from '../store/campaignTime'

/** Browser composition hook that projects the campaign clock into the scene. */
export function useBrowserSceneWorldMinute(): number {
  return useCampaignTimeStore((state) => state.state.worldMinute)
}
