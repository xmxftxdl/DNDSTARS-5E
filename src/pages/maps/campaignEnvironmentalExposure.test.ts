import { expect, it, vi } from 'vitest'
import { campaignInteractionFixture } from './campaignInteractionCompletion.fixture'
import { planDnd5eCampaignEnvironmentalExposure } from './campaignEnvironmentalExposure'
import { validateSharedCampaignTime } from '../../lib/campaignTime'
import { publishCampaignEnvironmentalExposure } from './publishCampaignEnvironmentalExposure'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'

function fixture() {
  return { ...campaignInteractionFixture(), targetId: 'source', exposureId: 'cold:1', hazard: 'extreme-cold' as const,
    fromWorldMinute: 420, toWorldMinute: 480, dc: 10, rollMode: 'normal' as const,
    rolls: { 'save:source': { values: [1] } } }
}

it.each([1, 20])('settles noncombat exposure and saves a stable character receipt (d20=%s)', roll => {
  const input = fixture()
  input.rolls['save:source'].values = [roll]
  const before = structuredClone(input)
  const result = planDnd5eCampaignEnvironmentalExposure(input)
  if (!result.ok) throw Error(result.reason)
  expect(result.state.active).toBe(false)
  expect(result.state.combatants.source.exhaustionLevel).toBe(roll === 1 ? 1 : 0)
  expect(result.application.characters[0].exhaustionLevel ?? 0).toBe(roll === 1 ? 1 : 0)
  expect(result.receipt).toMatchObject({ subjectId: 'character:hero', outcome: roll === 1 ? 'failure' : 'success' })
  expect(validateSharedCampaignTime(result.clock)).toBe(true)
  expect(result.clock.worldMinute).toBe(480)
  expect(result.state.combatants.source.turn).toMatchObject(before.state.combatants.source.turn)
  expect(result.state.combatants.source.turn.movementSpent ?? 0).toBe(before.state.combatants.source.turn.movementSpent ?? 0)
  expect(input).toEqual(before)
  const replay = planDnd5eCampaignEnvironmentalExposure({ ...input, state: result.state, clock: JSON.parse(JSON.stringify(result.clock)), exposureId: 'new-click' })
  expect(replay).toEqual({ ok: false, reason: 'environmental-exposure-already-settled' })
})

it('publishes exhaustion and receipt atomically, and recovers only an exact durable receipt without retry', async () => {
  const source = fixture(), completion = planDnd5eCampaignEnvironmentalExposure(source)
  if (!completion.ok) throw Error(completion.reason)
  const save = vi.fn<SharedRoomGatewayPort['saveResourcesAtomically']>().mockResolvedValue({ status: 'committed', transactionId: 'exposure', revisions: {} })
  const load = vi.fn<Parameters<typeof publishCampaignEnvironmentalExposure>[0]['gateway']['loadResource']>().mockResolvedValue(null)
  const input = { completion, maps: [source.map], updatedAt: 2, expectedRevisions: { characters: 1, maps: 2, 'campaign-time': 3 },
    readRevisions: { combat: 4, 'map-geometry': 5 }, gateway: { saveResourcesAtomically: save, loadResource: load } }
  expect(await publishCampaignEnvironmentalExposure(input)).toEqual({ recovered: false })
  expect(save.mock.calls[0][0].map(row => [row.name, row.expectedRevision])).toEqual([['characters', 1], ['maps', 2], ['campaign-time', 3]])
  expect(save.mock.calls[0][1]?.readRevisions).toEqual(input.readRevisions)
  save.mockRejectedValue(Error('Failed to fetch'))
  await expect(publishCampaignEnvironmentalExposure(input)).rejects.toThrow('Failed to fetch')
  load.mockResolvedValue(JSON.parse(JSON.stringify(completion.clock)))
  expect(await publishCampaignEnvironmentalExposure(input)).toEqual({ recovered: true })
  expect(save).toHaveBeenCalledTimes(3)
  load.mockResolvedValue({ ...completion.clock, environmentalExposures: completion.clock.environmentalExposures.map(row => ({ ...row, dc: 11 })) })
  await expect(publishCampaignEnvironmentalExposure(input)).rejects.toThrow('Failed to fetch')
  await expect(publishCampaignEnvironmentalExposure({ ...input, readRevisions: { ...input.readRevisions, combat: NaN } })).rejects.toThrow('exposure-snapshot-revision-required:combat')
  expect(save).toHaveBeenCalledTimes(4)
})

it('can apply exposure to an unconscious creature without granting it an action', () => {
  const input = fixture()
  input.state.combatants.source.currentHp = 0
  const result = planDnd5eCampaignEnvironmentalExposure(input)
  if (!result.ok) throw Error(result.reason)
  expect(result.state.combatants.source.exhaustionLevel).toBe(1)
  expect(result.state.combatants.source.currentHp).toBe(0)
})

it('does not produce a receipt for a missing save or an absent map target', () => {
  const input = fixture()
  expect(planDnd5eCampaignEnvironmentalExposure({ ...input, rolls: {} })).toMatchObject({ ok: false, reason: 'exposure-roll-invalid' })
  expect(planDnd5eCampaignEnvironmentalExposure({ ...input, map: { ...input.map, tokens: [] } })).toEqual({ ok: false, reason: 'exposure-target-unavailable' })
  expect(input.clock.environmentalExposures).toBeUndefined()
  expect(input.state.combatants.source.exhaustionLevel).toBe(0)
})

it('derives disadvantage from current exhaustion instead of accepting a caller mode', () => {
  const input = fixture()
  input.state.combatants.source.exhaustionLevel = 3
  const result = planDnd5eCampaignEnvironmentalExposure({ ...input, rolls: { 'save:source': { values: [20, 1] } } })
  if (!result.ok) throw Error(JSON.stringify(result))
  expect(result.receipt.outcome).toBe('failure')
  expect(result.state.combatants.source.exhaustionLevel).toBe(4)
})
