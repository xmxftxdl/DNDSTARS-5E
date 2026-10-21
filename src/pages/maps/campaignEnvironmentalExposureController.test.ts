import { beforeEach, expect, it, vi } from 'vitest'
import { campaignInteractionFixture } from './campaignInteractionCompletion.fixture'

const ports = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), load: vi.fn(), reload: vi.fn(), roll: vi.fn(), session: { role: 'dm', roomId: 'room', memberId: 'host' } }))
vi.mock('./campaignInteractionController', () => ({ readCampaignInteractionContext: ports.read }))
vi.mock('../../composition/browserSharedRoomResources', () => ({ saveSharedResourcesAtomically: ports.save, loadSharedResource: ports.load }))
vi.mock('../../composition/environmentalExposureInteraction', () => ({ getEnvironmentalExposureInteraction: () => ports.roll }))
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => ports.session }))
vi.mock('../../lib/roomAuthorityScheduler', () => ({ appRoomAuthorityScheduler: { run: (_id: string, operation: () => unknown) => operation() } }))
vi.mock('../../store/campaignTime', () => ({ useCampaignTimeStore: { getState: () => ({ loadShared: ports.reload }) } }))
import { runCampaignEnvironmentalExposure } from './campaignEnvironmentalExposureController'

const input = () => ({ mapId: 'map', targetId: 'source', exposureId: 'cold:1', hazard: 'extreme-cold' as const,
  fromWorldMinute: 420, toWorldMinute: 480, dc: 10, continuityConfirmed: true })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(ports.session, { role: 'dm', roomId: 'room', memberId: 'host' })
  const context = campaignInteractionFixture()
  ports.read.mockResolvedValue({ ...context, maps: [context.map], expectedRevisions: { characters: 1, maps: 2, 'campaign-time': 3 }, readRevisions: { combat: 4, 'map-geometry': 5 } })
  ports.save.mockResolvedValue({ status: 'committed', transactionId: 'test', revisions: {} })
  ports.load.mockResolvedValue(null)
  ports.roll.mockResolvedValue([1])
  ports.reload.mockResolvedValue(undefined)
})

it('derives the Host save mode, rolls once and atomically publishes the failed save', async () => {
  expect(await runCampaignEnvironmentalExposure(input())).toMatchObject({ outcome: 'failure', subjectId: 'character:hero' })
  expect(ports.roll).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ characterId: 'hero', targetId: 'source', mode: 'normal' }))
  expect(ports.save).toHaveBeenCalledTimes(1)
  expect(ports.save.mock.calls[0][0][0].data.characters[0].exhaustionLevel).toBe(1)
  expect(ports.save.mock.calls[0][0][2].data.environmentalExposures).toHaveLength(1)
})

it('rejects duplicate exposure before requesting dice', async () => {
  await runCampaignEnvironmentalExposure(input())
  const context = await ports.read()
  context.clock = ports.save.mock.calls[0][0][2].data
  ports.roll.mockClear(); ports.save.mockClear()
  await expect(runCampaignEnvironmentalExposure({ ...input(), exposureId: 'other-click' })).rejects.toThrow('already-settled')
  expect(ports.roll).not.toHaveBeenCalled()
  expect(ports.save).not.toHaveBeenCalled()
})

it.each(['player', 'unconfirmed', 'missing-combat-slot', 'changed-room'] as const)('rejects unsafe execution: %s', async scenario => {
  const request = input()
  if (scenario === 'player') ports.session.role = 'player'
  if (scenario === 'unconfirmed') request.continuityConfirmed = false
  if (scenario === 'missing-combat-slot') (await ports.read()).rawCombat = { active: true, mapId: 'map', initiativeOrder: [], initiativeIndex: 0 }
  if (scenario === 'changed-room') ports.roll.mockImplementationOnce(async () => { ports.session.roomId = 'other'; return [1] })
  await expect(async () => runCampaignEnvironmentalExposure(request)).rejects.toThrow()
  expect(ports.save).not.toHaveBeenCalled()
})
