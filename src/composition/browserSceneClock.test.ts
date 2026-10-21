import { expect, it, vi } from 'vitest'
import * as roomSession from '../lib/roomSession'
import { useCampaignTimeStore } from '../store/campaignTime'
import { readBrowserSceneWorldMinute } from './browserSceneClock'

it('reads only the hydrated current room clock', () => {
  const previous = useCampaignTimeStore.getState()
  const room = vi.spyOn(roomSession, 'getRoomSession')
  try {
    room.mockReturnValue({ roomId: 'room-a' } as NonNullable<ReturnType<typeof roomSession.getRoomSession>>)
    useCampaignTimeStore.setState({ state: { ...previous.state, worldMinute: 90 }, hydratedRoomId: 'room-b' })
    expect(readBrowserSceneWorldMinute()).toBeUndefined()
    useCampaignTimeStore.setState({ hydratedRoomId: 'room-a' })
    expect(readBrowserSceneWorldMinute()).toBe(90)
    useCampaignTimeStore.setState({ hydratedRoomId: null })
    expect(readBrowserSceneWorldMinute()).toBeUndefined()
    room.mockReturnValue(null)
    useCampaignTimeStore.setState({ hydratedRoomId: '__local__', state: { ...previous.state, worldMinute: 5 } })
    expect(readBrowserSceneWorldMinute()).toBe(5)
  } finally { useCampaignTimeStore.setState(previous); room.mockRestore() }
})
