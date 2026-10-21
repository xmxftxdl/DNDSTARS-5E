import { expect, it, vi } from 'vitest'
import { campaignInteractionFixture } from './campaignInteractionCompletion.fixture'
import { campaignEnvironmentalCombatContext } from './campaignEnvironmentalCombatContext'
import { planDnd5eCampaignEnvironmentalExposure } from './campaignEnvironmentalExposure'
import { publishCampaignEnvironmentalExposure } from './publishCampaignEnvironmentalExposure'
import { createDnd5eTurnEconomyCounts } from '../../rulesets/dnd5e/turnEconomy'
import type { SharedCombatState } from '../../lib/sharedCombatTypes'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'

function fixture() {
  const base = campaignInteractionFixture()
  base.characters[0].exhaustionLevel = 1
  const owner = createDnd5eTurnEconomyCounts('round7:extra', 30)
  owner.action = { current: 2, max: 3 }
  owner.bonusAction.current = 0
  owner.reaction.current = 0
  owner.objectInteraction = { current: 0, max: 1 }
  owner.movement = { current: 20, max: 30, spent: 10 }
  const combat: SharedCombatState = { active: true, mapId: 'map', combatId: 'live', round: 7, initiativeIndex: 1,
    initiativeOrder: [{ tokenId: 'source', slotId: 'source', label: 'Hero', emoji: 'H', color: '#fff', roll: 20 },
      { tokenId: 'bearer', slotId: 'bearer', label: 'Enemy', emoji: 'E', color: '#fff', roll: 10 }],
    dnd5eTurnEconomyByToken: { source: owner, bearer: createDnd5eTurnEconomyCounts('round7:bearer') }, updatedAt: 1 }
  return { ...base, maps: [base.map], geometry: null, rawCombat: combat,
    characterSelectedId: 'hero', mapSelectedId: 'map', expectedRevisions: { characters: 4, maps: 5, 'campaign-time': 6 },
    readRevisions: { combat: 7, 'map-geometry': 8 } }
}

it('preserves the live slot, counted resources and spent movement while exhaustion halves speed', async () => {
  const original = fixture(), before = structuredClone(original)
  const context = campaignEnvironmentalCombatContext(original)
  expect(context.state.round).toBe(7)
  expect(context.state.initiativeOrder[context.state.initiativeIndex]).toBe('bearer')
  expect(context.state.combatants.other).toBeDefined()
  expect(context.state.initiativeOrder).not.toContain('other')
  const result = planDnd5eCampaignEnvironmentalExposure({ ...context, targetId: 'source', exposureId: 'combat-cold', hazard: 'extreme-cold',
    fromWorldMinute: 420, toWorldMinute: 480, dc: 100, rolls: { 'save:source': { values: [1] } }, now: 2 })
  if (!result.ok) throw Error(JSON.stringify(result))
  expect(result.application.characters[0].exhaustionLevel).toBe(2)
  expect(result.combat).toMatchObject({ active: true, round: 7, initiativeIndex: 1, initiativeOrder: original.rawCombat.initiativeOrder })
  expect(result.combat?.dnd5eTurnEconomyByToken?.source).toEqual({ ...original.rawCombat.dnd5eTurnEconomyByToken!.source,
    movement: { current: 5, max: 15, spent: 10 } })
  expect(result.combat?.dnd5eTurnEconomyByToken?.bearer).toEqual(original.rawCombat.dnd5eTurnEconomyByToken!.bearer)
  expect(original).toEqual(before)
  const save = vi.fn<SharedRoomGatewayPort['saveResourcesAtomically']>().mockResolvedValue({ status: 'committed', transactionId: 'test', revisions: {} })
  await publishCampaignEnvironmentalExposure({ ...context, completion: result, updatedAt: 2, gateway: { saveResourcesAtomically: save, loadResource: async () => null } })
  expect(save.mock.calls[0][0].map(row => [row.name, row.expectedRevision])).toEqual([['characters', 4], ['maps', 5], ['campaign-time', 6], ['combat', 7]])
  expect(save.mock.calls[0][1]?.readRevisions).toEqual({ 'map-geometry': 8 })
})

it('does not touch combat on another map and rejects missing active-turn resources', () => {
  const input = fixture()
  const otherMap = campaignEnvironmentalCombatContext({ ...input, rawCombat: { ...input.rawCombat, mapId: 'elsewhere' } })
  expect(otherMap.combat).toBeUndefined()
  expect(otherMap.state.active).toBe(false)
  expect(() => campaignEnvironmentalCombatContext({ ...input, rawCombat: { ...input.rawCombat, dnd5eTurnEconomyByToken: {} } })).toThrow('exposure-combat-economy-unavailable')
})

it('honors the DM pause gate and handles legacy absent object-interaction counts', () => {
  const input = fixture()
  expect(() => campaignEnvironmentalCombatContext({ ...input, rawCombat: { ...input.rawCombat,
    flowPause: { schemaVersion: 1, reason: 'manual', phase: 'paused', pausedAt: 1 } } })).toThrow('战斗已暂停')
  delete input.rawCombat.dnd5eTurnEconomyByToken!.source.objectInteraction
  expect(campaignEnvironmentalCombatContext(input).state.combatants.source.turn.objectInteractionAvailable).toBe(true)
})
