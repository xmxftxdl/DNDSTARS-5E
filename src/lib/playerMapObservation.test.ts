import { expect, it } from 'vitest'
import type { BattleMap } from '../store/maps'
import { playerObservationSelectedMap, resolvePlayerMapObservation } from './playerMapObservation'

const fixture = () => [
  { id: 'home', tokens: [{ id: 'body', type: 'player', characterId: 'owner', viewerControlled: true }] },
  { id: 'remote', tokens: [{ id: 'sensor', label: 'Eyes', type: 'obstacle', viewerControlled: true,
    dnd5eSpellEffect: { sourceCharacterId: 'owner', visionFromSource: true, hiddenBody: true, concentrationId: 'eyes' } }],
    dnd5ePluginAreas: [{ anchorTokenId: 'sensor', sourceCharacterId: 'owner', concentrationId: 'eyes' }] },
] as unknown as BattleMap[]

it('switches only the local view of an owned, linked remote sensor and retains that choice across sync', () => {
  const maps = fixture(), before = structuredClone(maps)
  expect(resolvePlayerMapObservation(maps)).toEqual({ id: 'sensor', label: 'Eyes', remoteMapId: 'remote', bodyMapId: 'home' })
  expect(playerObservationSelectedMap(maps, 'remote', { sensorId: 'sensor', view: 'body' })).toBe('home')
  expect(playerObservationSelectedMap(maps, 'home', { sensorId: 'sensor', view: 'sensor' })).toBe('remote')
  expect(playerObservationSelectedMap(maps, 'remote', { sensorId: 'old-sensor', view: 'body' })).toBe('remote')
  expect(maps).toEqual(before)
})

it('does not expose observation controls for another owner, missing links or ambiguous bodies', () => {
  for (const mutate of [
    (maps: BattleMap[]) => { maps[1].tokens[0].viewerControlled = false },
    (maps: BattleMap[]) => { maps[0].tokens[0].viewerControlled = false },
    (maps: BattleMap[]) => { maps[1].dnd5ePluginAreas = [] },
    (maps: BattleMap[]) => { maps[0].tokens.push({ ...maps[0].tokens[0], id: 'duplicate' }) },
  ]) {
    const maps = fixture(); mutate(maps)
    expect(resolvePlayerMapObservation(maps)).toBeUndefined()
    expect(playerObservationSelectedMap(maps, 'home', { sensorId: 'sensor', view: 'sensor' })).toBe('home')
  }
})
