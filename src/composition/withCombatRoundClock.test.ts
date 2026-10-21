import { expect, it } from 'vitest'
import { withCombatRoundClock } from './withCombatRoundClock'
import type { SharedRoomGatewayPort } from '../ports/sharedRoomGateway'
import { normalizeSharedCampaignTime, validateSharedCampaignTime } from '../lib/campaignTime'
import { campaignUnappliedEffectMinutes, characterCombatClockKey, tokenCombatClockKey } from '../../shared/combat-round-credits.mjs'

function fixture() {
  const state: Record<string, any> = {
    'campaign-time': { ...normalizeSharedCampaignTime({ worldMinute: 100 }), _sync: { revision: 1 } },
    maps: { maps: [{ id: 'map', tokens: [{ id: 'caster', characterId: 'hero' }, { id: 'guard' }] }], _sync: { revision: 1 } },
    combat: { combatId: 'grove', active: true, round: 1, mapId: 'map', initiativeOrder: [{ tokenId: 'caster' }, { tokenId: 'guard' }], _sync: { revision: 1 } },
  }
  let fail = false
  const gateway = {
    getRevisionWatermark: (name: string) => state[name]?._sync?.revision ?? 0,
    loadResource: async (name: string) => structuredClone(state[name] ?? null),
    saveResourcesAtomically: async (writes: any[], options: any) => {
      if (fail || writes.some(write => write.expectedRevision !== (state[write.name]?._sync?.revision ?? 0)) ||
        Object.entries(options?.readRevisions ?? {}).some(([name, revision]) => revision !== (state[name]?._sync?.revision ?? 0))) throw Error('revision-conflict')
      const revisions: Record<string, number> = {}
      for (const write of writes) {
        revisions[write.name] = (state[write.name]?._sync?.revision ?? 0) + 1
        state[write.name] = { ...structuredClone(write.data), _sync: { revision: revisions[write.name] } }
      }
      return { status: 'committed', transactionId: 'test', revisions }
    },
  } as unknown as SharedRoomGatewayPort
  return { state, transport: gateway, gateway: withCombatRoundClock(gateway), fail: () => { fail = true } }
}

it('persists clock with the tenth round commit and preserves per-participant aging credit', async () => {
  const f = fixture()
  for (let round = 1; round <= 11; round++) {
    await withCombatRoundClock(f.transport).saveResource('combat', { ...f.state.combat, round })
  }
  const clock = f.state['campaign-time']
  expect(clock.worldMinute).toBe(101)
  expect(validateSharedCampaignTime(clock)).toBe(true)
  const restored = normalizeSharedCampaignTime(JSON.parse(JSON.stringify(clock)))
  expect(campaignUnappliedEffectMinutes(restored, 100, characterCombatClockKey('hero'))).toBe(0)
  expect(campaignUnappliedEffectMinutes(restored, 100, tokenCombatClockKey('map', 'guard'))).toBe(0)
  expect(campaignUnappliedEffectMinutes(restored, 100, characterCombatClockKey('outside'))).toBe(1)
  await f.gateway.saveResource('combat', f.state.combat)
  expect(f.state['campaign-time'].worldMinute).toBe(101)
})

it('does not advance time or its cursor when the atomic commit conflicts', async () => {
  const f = fixture()
  for (let round = 1; round <= 10; round++) await f.gateway.saveResource('combat', { ...f.state.combat, round })
  const before = structuredClone(f.state)
  f.fail()
  await expect(f.gateway.saveResource('combat', { ...f.state.combat, round: 11 })).rejects.toThrow('revision-conflict')
  expect(f.state).toEqual(before)
})

it('only credits observed participant rounds when a creature leaves mid-minute', async () => {
  const f = fixture()
  for (let round = 1; round <= 11; round++) {
    if (round === 6) f.state.combat.initiativeOrder = [{ tokenId: 'caster' }]
    await f.gateway.saveResource('combat', { ...f.state.combat, round })
  }
  expect(campaignUnappliedEffectMinutes(f.state['campaign-time'], 100, tokenCombatClockKey('map', 'guard'))).toBe(0.6)
})

it('rejects excessive or malformed credits instead of letting them suppress expiration', () => {
  const clock = normalizeSharedCampaignTime({ worldMinute: 101, advances: [{ id: 'x', kind: 'advance', fromWorldMinute: 100,
    toWorldMinute: 101, minutes: 1, reason: 'combat', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1 }] })
  clock.advances[0].combatRoundCredits = { hero: 11 }
  expect(validateSharedCampaignTime(clock)).toBe(false)
})


it('keeps subminute credits even when ending combat clears its ID', async () => {
  const f = fixture()
  for (let round = 1; round <= 10; round++) await f.gateway.saveResource('combat', { ...f.state.combat, round })
  await f.gateway.saveResource('combat', { active: false, round: 1 })
  expect(f.state.combat.campaignRoundClock.pendingRounds).toBe(9)
  await f.gateway.saveResource('combat', { active: true, combatId: 'second', round: 1, mapId: 'map', initiativeOrder: [{ tokenId: 'caster' }] })
  await f.gateway.saveResource('combat', { ...f.state.combat, round: 2 })
  expect(f.state['campaign-time'].worldMinute).toBe(101)
})

it('serializes combat publication with boundary planning before reading revisions', async () => {
  const f=fixture()
  const initial=structuredClone(f.state.combat)
  const publication=f.gateway.saveResource('combat',initial)
  const boundary=f.gateway.saveResourcesAtomically([
    {name:'maps',expectedRevision:1,data:{...f.state.maps,marker:'first-turn-clock'}},
    {name:'combat',data:initial},
  ])
  await Promise.all([publication,boundary])
  expect(f.state.combat._sync.revision).toBe(3)
  expect(f.state.maps.marker).toBe('first-turn-clock')
  expect(f.state['campaign-time'].worldMinute).toBe(100)
})

it('does not relax explicit stale revisions and continues after a rejected queued write', async () => {
  const f=fixture(), initial=structuredClone(f.state.combat)
  await f.gateway.saveResource('combat',initial)
  await expect(f.gateway.saveResourcesAtomically([{name:'combat',data:initial,expectedRevision:1}])).rejects.toThrow('revision-conflict')
  await f.gateway.saveResource('combat',initial)
  expect(f.state.combat._sync.revision).toBe(3)
})
