import { expect, it } from 'vitest'
import { commitCampaignEtherealReturns } from './campaignEtherealReturnCommit'
import { settleBrowserEtherealExpiry } from '../composition/browserEtherealExpiry'
import { registerTempleExpiryInteraction } from '../composition/templeExpiryInteraction'
import { normalizeCharacter } from '../store/characters'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import { createEmptyMapGeometry } from './mapGeometry'
import { normalizeSharedCampaignTime } from './campaignTime'
import type { SharedRoomGatewayPort } from '../ports/sharedRoomGateway'

function fixture(airborne = false) {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '游侠', level: 7,
    dnd5eClassLevels: { ranger: 7 }, maxHp: 30, currentHp: 30, dnd5eWorldTimeAppliedMinute: 100,
    dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'phase', label: 'Ethereal', targetId: 'hero-token',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'etherealness', magical: true },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'source-turn-end' },
      modifiers: { planarPhase: { plane: 'ethereal', ignoresMaterialCollision: true,
        suppressCrossPlaneEffects: true, unrestrictedVerticalMovement: true, materialSightRangeFeet: 60 } },
    })] } })
  const state: Record<string, any> = {
    maps: { _sync: { revision: 4 }, maps: [{ id: 'phase', name: 'Phase', width: 250, height: 250,
      gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [{ id: 'hero-token', characterId: 'hero', type: 'player', label: 'Hero', size: 1,
        x: 125, y: 125, elevationFeet: airborne ? 20 : 0, color: '', emoji: '' },
      { id: 'occupant', type: 'enemy', label: 'Occupant', size: 1, x: airborne ? 225 : 125, y: 125, hp: 30, maxHp: 30, color: '', emoji: '' }] }] },
    characters: { _sync: { revision: 3 }, characters: [hero] },
    'campaign-time': { ...normalizeSharedCampaignTime({ worldMinute: 101 }), _sync: { revision: 2 } },
    'map-geometry': { maps: [createEmptyMapGeometry('phase')], _sync: { revision: 1 } },
    combat: { active: false, _sync: { revision: 5 } },
  }
  let commits = 0
  let fail = false
  const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = {
    loadResource: async name => structuredClone(state[name] ?? null),
    saveResourcesAtomically: async (writes, options) => {
      expect(writes.map(write => write.name)).toEqual(['maps', 'characters'])
      expect(options?.readRevisions).toEqual({ 'campaign-time': 2, 'map-geometry': 1, combat: 5 })
      expect(writes.map(write => write.expectedRevision)).toEqual([4, 3])
      if (fail) throw Error('state-transaction-conflict:maps')
      for (const write of writes) state[write.name] = structuredClone(write.data)
      commits++
      return { status: 'committed', transactionId: 'test', revisions: { maps: 5, characters: 4 } }
    },
  }
  return { state, gateway, commits: () => commits, fail: () => { fail = true } }
}

it('atomically expires, ejects and damages the character and is idempotent after reload', async () => {
  const f = fixture(), hp = f.state.characters.characters[0].currentHp
  expect(await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).toBe(true)
  expect(f.commits()).toBe(1)
  const saved = f.state.characters.characters[0]
  expect(saved.currentHp).toBe(hp - 10)
  expect(saved.dnd5eCombatState.activeEffects ?? []).toEqual([])
  expect(saved.dnd5eWorldTimeAppliedMinute).toBe(101)
  expect(f.state.maps.maps[0].tokens[0]).not.toMatchObject({ x: 125, y: 125 })
  expect(await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).toBe(false)
  expect(f.commits()).toBe(1)
})

it('returns at the sixth game second without waiting for a whole minute', async () => {
  const f = fixture()
  f.state.characters.characters[0].dnd5eCombatState.activeEffects[0].explorationExpiresAtWorldSecond = 6006
  f.state['campaign-time'].worldMinute = 100
  f.state['campaign-time'].worldSecondRemainder = 5
  expect(await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).toBe(false)
  expect(f.commits()).toBe(0)
  f.state['campaign-time'].worldSecondRemainder = 6
  expect(await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).toBe(true)
  expect(f.state.characters.characters[0].dnd5eCombatState.activeEffects ?? []).toEqual([])
  expect(f.state.maps.maps[0].tokens[0]).not.toMatchObject({ x: 125, y: 125 })
  expect(await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).toBe(false)
})

it('collects the actual fall interaction before publishing an airborne expiry', async () => {
  const f = fixture(true), hp = f.state.characters.characters[0].currentHp
  let prompts = 0
  const dispose = registerTempleExpiryInteraction({
    chooseFeatherFall: async () => { expect(f.commits()).toBe(0); prompts++; return undefined },
    rollFalls: async falls => {
      expect(f.commits()).toBe(0)
      expect(falls.map(fall => fall.combatantId)).toEqual(['hero-token'])
      return { 'hero-token': [4, 4] }
    },
  })
  try {
    await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)
    expect(prompts).toBe(1)
    expect(f.state.characters.characters[0].currentHp).toBe(hp - 8)
    expect(f.state.maps.maps[0].tokens[0].elevationFeet).toBe(0)
  } finally { dispose() }
})

it('does not publish effect removal or damage after a revision conflict', async () => {
  const f = fixture(), before = structuredClone(f.state)
  f.fail()
  await expect(commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).rejects.toThrow('conflict')
  expect(f.state).toEqual(before)
  expect(f.commits()).toBe(0)
})

it('replays an eligible Feather Fall choice and commits its spell slot with the return', async () => {
  const f = fixture(true), hp = f.state.characters.characters[0].currentHp
  f.state.characters.characters.push(normalizeCharacter({ id: 'wizard', name: 'Wizard', charClass: '法师', level: 1,
    dnd5eClassLevels: { wizard: 1 }, dnd5eWorldTimeAppliedMinute: 101,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['feather-fall'] } } } },
    classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
  }))
  f.state.maps.maps[0].tokens.push({ id: 'wizard-token', characterId: 'wizard', label: 'Wizard',
    type: 'player', x: 75, y: 125, size: 1, color: '', emoji: '' })
  const dispose = registerTempleExpiryInteraction({
    chooseFeatherFall: async () => ({ casterId: 'wizard-token', targetIds: ['hero-token'] }),
    rollFalls: async () => { throw Error('protected descent must not request damage dice') },
  })
  try {
    await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)
    expect(f.state.characters.characters[0].currentHp).toBe(hp)
    expect(f.state.characters.characters[1].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(f.commits()).toBe(1)
  } finally { dispose() }
})

it('does not guess a return map or publish after leaving the room', async () => {
  const f = fixture()
  expect(await commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => false)).toBe(false)
  f.state.maps.maps = []
  await expect(commitCampaignEtherealReturns(f.gateway, settleBrowserEtherealExpiry, () => true)).rejects.toThrow('map-ambiguous')
  expect(f.commits()).toBe(0)
})
