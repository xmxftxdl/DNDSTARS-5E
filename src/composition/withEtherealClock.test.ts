import { expect, it } from 'vitest'
import { withEtherealClock } from './withEtherealClock'
import type { SharedRoomGatewayPort } from '../ports/sharedRoomGateway'
import { normalizeCharacter } from '../store/characters'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from '../rulesets/dnd5e/activeEffects'
import { reconcileDnd5eCharacterCampaignTime } from '../rulesets/dnd5e/campaignTimeRules'
import { normalizeSharedCampaignTime } from '../lib/campaignTime'

function fixture() {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'phase', label: 'Phase', targetId: 'hero',
    appliedAt: 1, source: { kind: 'spell', rulesId: 'etherealness', actorId: 'hero', magical: true },
    duration: { type: 'rounds', remainingRounds: 1, tickOn: 'source-turn-end' },
    modifiers: { planarPhase: { plane: 'ethereal', ignoresMaterialCollision: true,
      suppressCrossPlaneEffects: true, unrestrictedVerticalMovement: true } } })
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '游侠', level: 7,
    dnd5eWorldTimeAppliedMinute: 100, dnd5eCombatState: { activeEffects: [effect] } })
  const state: Record<string, any> = {
    characters: { _sync: { revision: 2 }, characters: [] },
    'campaign-time': { worldMinute: 100, worldSecondRemainder: 58, _sync: { revision: 7 } },
  }
  let writes = 0
  const gateway = withEtherealClock({
    getRevisionWatermark: () => 2,
    loadResource: async (name: string) => structuredClone(state[name]),
    saveResourcesAtomically: async (changes: any[], options: any) => {
      expect(options.readRevisions['campaign-time']).toBe(7)
      expect(changes[0].expectedRevision).toBe(2)
      state.characters = structuredClone(changes[0].data)
      writes++
      return { status: 'committed', transactionId: 'test', revisions: { characters: 3 } }
    },
  } as unknown as SharedRoomGatewayPort)
  return { hero, state, gateway, writes: () => writes }
}

it('stamps six seconds at cast time, preserves it on reload, and expires across a minute boundary', async () => {
  const f = fixture()
  f.hero.dnd5eCombatState!.activeEffects![0].explorationExpiresAtWorldSecond = 999999
  await f.gateway.saveResource('characters', { characters: [f.hero] })
  let saved = f.state.characters.characters[0]
  expect(saved.dnd5eCombatState.activeEffects[0].explorationExpiresAtWorldSecond).toBe(6064)
  expect(normalizeDnd5eActiveEffects(saved.dnd5eCombatState.activeEffects)[0].explorationExpiresAtWorldSecond).toBe(6064)
  f.state['campaign-time'].worldMinute = 101
  f.state['campaign-time'].worldSecondRemainder = 0
  saved.currentHp = 1
  await f.gateway.saveResource('characters', { characters: [saved] })
  saved = f.state.characters.characters[0]
  expect(saved.dnd5eCombatState.activeEffects[0].explorationExpiresAtWorldSecond).toBe(6064)
  const early = reconcileDnd5eCharacterCampaignTime(saved, normalizeSharedCampaignTime({ worldMinute: 101, worldSecondRemainder: 3 }))
  expect(early.character.dnd5eCombatState?.activeEffects).toHaveLength(1)
  const ended = reconcileDnd5eCharacterCampaignTime(JSON.parse(JSON.stringify(early.character)),
    normalizeSharedCampaignTime({ worldMinute: 101, worldSecondRemainder: 4 }))
  expect(ended.changed).toBe(true)
  expect(ended.character.dnd5eCombatState?.activeEffects ?? []).toEqual([])
  const again = reconcileDnd5eCharacterCampaignTime(ended.character, normalizeSharedCampaignTime({ worldMinute: 101, worldSecondRemainder: 4 }))
  expect(again.changed).toBe(false)
})

it('starts a refreshed phase from its new application rather than inheriting the old deadline', async () => {
  const f = fixture()
  await f.gateway.saveResource('characters', { characters: [f.hero] })
  const renewed = structuredClone(f.state.characters)
  renewed.characters[0].dnd5eCombatState.activeEffects[0].appliedAt = 2
  f.state['campaign-time'].worldSecondRemainder = 59
  await f.gateway.saveResource('characters', renewed)
  expect(f.state.characters.characters[0].dnd5eCombatState.activeEffects[0].explorationExpiresAtWorldSecond).toBe(6065)
})

it('honors an existing deadline on first load even without a legacy minute baseline', () => {
  const hero = fixture().hero
  delete hero.dnd5eWorldTimeAppliedMinute
  hero.dnd5eCombatState!.activeEffects![0].explorationExpiresAtWorldSecond = 6006
  const early = reconcileDnd5eCharacterCampaignTime(structuredClone(hero),
    normalizeSharedCampaignTime({ worldMinute: 100, worldSecondRemainder: 5 }))
  expect(early.character.dnd5eCombatState?.activeEffects).toHaveLength(1)
  const ended = reconcileDnd5eCharacterCampaignTime(hero,
    normalizeSharedCampaignTime({ worldMinute: 100, worldSecondRemainder: 6 }))
  expect(ended.character.dnd5eCombatState?.activeEffects ?? []).toEqual([])
  expect(ended.character.dnd5eWorldTimeAppliedMinute).toBe(100)
  const legacy = structuredClone(hero)
  delete legacy.dnd5eCombatState!.activeEffects![0].explorationExpiresAtWorldSecond
  const initialized = reconcileDnd5eCharacterCampaignTime(legacy,
    normalizeSharedCampaignTime({ worldMinute: 100, worldSecondRemainder: 6 }))
  expect(initialized.character.dnd5eCombatState?.activeEffects).toEqual(legacy.dnd5eCombatState?.activeEffects)
})

it('refuses to replace a known roster deadline when its authoritative read fails', async () => {
  const f = fixture()
  f.state.characters = null
  await expect(f.gateway.saveResource('characters', { characters: [f.hero] })).rejects.toThrow('roster-unavailable')
  expect(f.writes()).toBe(0)
})

it.each([-1, 0.5, Infinity, '6006'])('rejects malformed saved deadlines: %s', value => {
  const effect = fixture().hero.dnd5eCombatState!.activeEffects![0]
  Object.assign(effect, { explorationExpiresAtWorldSecond: value })
  expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(false)
})
