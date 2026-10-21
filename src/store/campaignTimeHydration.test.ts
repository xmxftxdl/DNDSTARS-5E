import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  room: { roomId: 'test-room' } as { roomId: string } | null,
  load: vi.fn(), mutate: vi.fn(),
}))
vi.mock('../lib/roomSession', () => ({ getRoomSession: () => mocks.room }))
vi.mock('../composition/browserSharedRoomResources', () => ({
  loadSharedResource: mocks.load, mutateSharedRoomResource: mocks.mutate,
}))
vi.mock('../lib/mapGeometry', () => ({ setMapGeometryWorldMinuteReader: vi.fn() }))
import { useCampaignTimeStore } from './campaignTime'

beforeEach(() => {
  mocks.room = { roomId: 'test-room' }
  mocks.load.mockReset()
  mocks.mutate.mockReset()
  useCampaignTimeStore.getState().reset()
})

it('does not authorize the default clock after an unavailable room read, then hydrates on retry', async () => {
  mocks.load.mockResolvedValueOnce(null).mockResolvedValueOnce({
    worldMinute: 100, timers: [], advances: [], updatedAt: 1,
  })
  await useCampaignTimeStore.getState().loadShared()
  expect(useCampaignTimeStore.getState().hydratedRoomId).toBeNull()
  await useCampaignTimeStore.getState().loadShared()
  expect(useCampaignTimeStore.getState()).toMatchObject({
    hydratedRoomId: 'test-room', state: { worldMinute: 100 },
  })
  mocks.load.mockResolvedValueOnce(null)
  await useCampaignTimeStore.getState().loadShared()
  expect(useCampaignTimeStore.getState().state.worldMinute).toBe(100)
})

it('still initializes the local clock without a room resource', async () => {
  mocks.room = null
  useCampaignTimeStore.getState().reset()
  mocks.load.mockResolvedValue(null)
  await useCampaignTimeStore.getState().loadShared()
  expect(useCampaignTimeStore.getState().hydratedRoomId).toBe('__local__')
})

it('ignores a room read that completes after switching rooms', async () => {
  let resolve!: (value: unknown) => void
  mocks.load.mockReturnValue(new Promise(done => { resolve = done }))
  const pending = useCampaignTimeStore.getState().loadShared()
  mocks.room = { roomId: 'other-room' }
  useCampaignTimeStore.getState().reset()
  resolve({ worldMinute: 100, timers: [], advances: [], updatedAt: 1 })
  await pending
  expect(useCampaignTimeStore.getState().hydratedRoomId).toBeNull()
})
