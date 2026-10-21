import { useCampaignTimeStore } from '../store/campaignTime'
import { getRoomSession } from '../lib/roomSession'

/** Never reuse a different room's clock while the current room is hydrating. */
export function readBrowserSceneWorldMinute(): number | undefined {
  const clock = useCampaignTimeStore.getState()
  return clock.hydratedRoomId === (getRoomSession()?.roomId ?? '__local__')
    ? clock.state.worldMinute : undefined
}

/** Browser composition hook that projects the campaign clock into the scene. */
export function useBrowserSceneWorldMinute(): number {
  return useCampaignTimeStore((state) => state.state.worldMinute)
}
