import { expect, it, vi } from 'vitest'
import { campaignInteractionFixture as fixture } from './campaignInteractionCompletion.fixture'
import { advanceCampaignTimeSnapshot, validateSharedCampaignTime } from '../../lib/campaignTime'
import { reconcileDnd5eCharacterCampaignTime } from '../../rulesets/dnd5e/campaignTimeRules'
import { planDnd5eCampaignInteractionCompletion } from './campaignInteractionCompletion'
import { publishDnd5eCampaignInteractionCompletion } from './publishCampaignInteractionCompletion'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'


function publicationFixture() {
  const source = fixture(), completion = planDnd5eCampaignInteractionCompletion(source)
  if (!completion.ok) throw Error(completion.reason)
  const save = vi.fn<SharedRoomGatewayPort['saveResourcesAtomically']>().mockResolvedValue({ status: 'committed', transactionId: 'campaign-interaction:talk', revisions: {} })
  const load = vi.fn<Parameters<typeof publishDnd5eCampaignInteractionCompletion>[0]['gateway']['loadResource']>().mockResolvedValue(null)
  return { completion, maps: [source.map, { ...source.map, id: 'untouched' }], updatedAt: 2,
    expectedRevisions: { characters: 3, maps: 4, 'campaign-time': 5 },
    readRevisions: { combat: 0, 'map-geometry': 0 },
    gateway: { saveResourcesAtomically: save, loadResource: load } }
}

it('publishes actors, map and completion clock in one revision-checked transaction', async () => {
  const input = publicationFixture()
  expect(await publishDnd5eCampaignInteractionCompletion(input)).toEqual({ recovered: false })
  expect(input.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
  const [writes, options] = input.gateway.saveResourcesAtomically.mock.calls[0]
  expect(writes.map(row => [row.name, row.expectedRevision])).toEqual([['characters', 3], ['maps', 4], ['campaign-time', 5]])
  expect(writes[0].data).toMatchObject({ characters: input.completion.application.characters })
  expect(writes[1].data).toMatchObject({ maps: [input.completion.application.map, input.maps[1]] })
  expect(writes[2].data).toEqual(input.completion.clock)
  expect(options?.transactionId).toBe('campaign-interaction:talk')
  expect(options?.readRevisions).toEqual({ combat: 0, 'map-geometry': 0 })
})

it('rejects missing snapshot revisions before publication', async () => {
  const input = publicationFixture()
  input.expectedRevisions.maps = NaN
  await expect(publishDnd5eCampaignInteractionCompletion(input)).rejects.toThrow('interaction-snapshot-revision-required:maps')
  expect(input.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})

it.each(['combat', 'map-geometry'] as const)('requires the original %s read revision', async name => {
  const input = publicationFixture()
  input.readRevisions[name] = NaN
  await expect(publishDnd5eCampaignInteractionCompletion(input)).rejects.toThrow(`interaction-snapshot-revision-required:${name}`)
  expect(input.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})

it('does not retry a stale actor snapshot or claim success from a still-active clock', async () => {
  const input = publicationFixture(), error = Error('shared-state-transaction-conflict:maps')
  input.gateway.saveResourcesAtomically.mockRejectedValue(error)
  input.gateway.loadResource.mockResolvedValue(fixture().clock)
  await expect(publishDnd5eCampaignInteractionCompletion(input)).rejects.toBe(error)
  expect(input.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
})

it('recovers a lost reply from the exact durable completion without republishing consumed rewards', async () => {
  const input = publicationFixture()
  input.gateway.saveResourcesAtomically.mockRejectedValue(Error('Failed to fetch'))
  const later = advanceCampaignTimeSnapshot({ state: input.completion.clock, minutes: 5, reason: 'Later', now: 8, advanceId: 'later' })!
  input.gateway.loadResource.mockResolvedValue(later)
  expect(await publishDnd5eCampaignInteractionCompletion(input)).toEqual({ recovered: true })
  expect(input.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
  input.gateway.loadResource.mockResolvedValue({ ...later, interactions: later.interactions?.map(row => ({ ...row, effectId: 'different' })) })
  await expect(publishDnd5eCampaignInteractionCompletion(input)).rejects.toThrow('Failed to fetch')
})

it.each([true, false])('plans clock and scoped receipt together for a character or creature source (%s)', characterSource => {
  const input = fixture(characterSource), before = structuredClone(input)
  const result = planDnd5eCampaignInteractionCompletion(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(input).toEqual(before)
  if (!result.ok) throw Error(result.reason)
  expect(validateSharedCampaignTime(result.clock)).toBe(true)
  expect(result.clock.worldMinute).toBe(481)
  expect(validateSharedCampaignTime({ ...result.clock, advances: [] })).toBe(false)
  expect(result.clock.interactions?.[0]).toMatchObject({ status: 'completed', completionAdvanceId: 'interaction:talk' })
  const receipt = characterSource ? result.application.characters[0].dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'prepare:completed')
    : result.application.map.tokens.find(token => token.id === 'source')?.dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'prepare:completed')
  expect(receipt).toMatchObject({ grantedActivityTargetIds: ['bearer'], grantedActivities: ['finish'], duration: { remainingRounds: 10 } })
  expect(result.application.map.tokens.find(token => token.id === 'bearer')?.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'prepare') ?? false).toBe(false)
  expect(result.application.tokenPatches?.other?.dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'other-buff')?.duration).toMatchObject({ remainingRounds: 20 })
  if (characterSource) {
    expect(result.application.characterPatches?.hero?.dnd5eWorldTimeAppliedMinute).toBe(481)
    const reloaded = reconcileDnd5eCharacterCampaignTime(result.application.characters[0], JSON.parse(JSON.stringify(result.clock))).character
    expect(reloaded.dnd5eCombatState?.activeEffects?.find(effect => effect.id === receipt?.id)?.duration).toEqual(receipt?.duration)
  }
  expect(planDnd5eCampaignInteractionCompletion({ ...input, clock: result.clock })).toMatchObject({ ok: false, reason: 'interaction-not-active' })
  if (characterSource) {
    let aged = result.clock
    for (let i = 0; i < 513; i++) aged = advanceCampaignTimeSnapshot({ state: aged, minutes: 1, reason: 'Travel', now: 3 + i, advanceId: `later-${i}` })!
    expect(aged.advances).toHaveLength(512)
    expect(validateSharedCampaignTime(aged)).toBe(true)
    expect(aged.interactions?.[0].status).toBe('completed')
  }
})

it.each(['confirmation', 'silence', 'removed', 'clock', 'interrupted'] as const)('returns no publishable bundle for invalid completion (%s)', scenario => {
  const input = fixture()
  if (scenario === 'confirmation') input.continuityConfirmed = false
  if (scenario === 'silence') input.state.combatants.source.soundSuppressed = true
  if (scenario === 'removed') input.state.combatants.bearer.classState.activeEffects = []
  if (scenario === 'clock') input.clock.worldMinute = 481
  if (scenario === 'interrupted') Object.assign(input.clock.interactions![0], { status: 'interrupted', interruptedAtWorldMinute: 480, interruptionReason: 'host-interrupted' })
  const before = structuredClone(input)
  const result = planDnd5eCampaignInteractionCompletion(input)
  expect(result.ok).toBe(false)
  expect(result).not.toHaveProperty('clock')
  expect(result).not.toHaveProperty('application')
  expect(input).toEqual(before)
})

it('does not create an already-expired receipt when minute precision overshoots the availability', () => {
  const result = planDnd5eCampaignInteractionCompletion(fixture(false, 1, 5))
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.application.map.tokens.flatMap(token => token.dnd5eCombatState?.activeEffects ?? []).some(effect => effect.grantedActivities?.includes('finish'))).toBe(false)
  expect(result.application.tokenPatches?.other?.dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'other-buff')?.duration).toMatchObject({ remainingRounds: 20 })
})
