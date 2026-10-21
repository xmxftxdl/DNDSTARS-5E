import { expect, it } from 'vitest'
import { migrateMapsState, type Dnd5ePluginArea } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { dnd5eRemoteSensorCanHearToken } from './remoteSensorHearing'

it('checks hearing at the live remote sensor, respecting deafness, silence, height and expiry', () => {
  const character = normalizeCharacter({ id: 'owner', name: 'Owner', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'activity:eyes', concentrationRoundsRemaining: 100 } })
  const base: Dnd5ePluginArea = { id: 'eyes', pluginId: 'test', featureId: 'eyes', label: 'Eyes', color: '#fff',
    sourceTokenId: 'body', sourceCharacterId: 'owner', anchorMode: 'effect-token', anchorTokenId: 'sensor',
    concentrationId: 'activity:eyes', cells: [{ col: 0, row: 0 }], createdRound: 1, expiresAfterRound: 101, createdWorldMinute: 100, expiresAtWorldMinute: 110, triggers: [] }
  const maps = migrateMapsState({ maps: [{ id: 'remote', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    dnd5ePluginAreas: [base], tokens: [{ id: 'speaker', type: 'enemy', x: 125, y: 25, size: 1 },
      { id: 'sensor', type: 'obstacle', x: 25, y: 25, size: 1, dnd5eSpellEffect: { schemaVersion: 1, spellId: 'eyes',
        sourceTokenId: 'body', sourceCharacterId: 'owner', createdRound: 1, expiresAfterRound: 101,
        concentrationId: 'activity:eyes', visionFromSource: true, hearingFromSource: true, shareVisionWithSource: true, hiddenBody: true } }] }] }).maps
  const input = { maps, characters: [character], sensorId: 'sensor', soundSourceTokenId: 'speaker', worldMinute: 100 }
  expect(character.dnd5eCombatState?.concentrationSpellId).toBe('activity:eyes')
  expect(maps[0].tokens.find(token => token.id === 'sensor')?.dnd5eSpellEffect?.hearingFromSource).toBe(true)
  expect(maps[0].dnd5ePluginAreas).toHaveLength(1)
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(true)
  const sensorEffect=maps[0].tokens.find(token=>token.id==='sensor')!.dnd5eSpellEffect!
  sensorEffect.sensorSense='sight'
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(false)
  sensorEffect.sensorSense='hearing'
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(true)
  sensorEffect.sensorSense=undefined
  character.conditions = ['blinded']
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(true)
  character.conditions = ['deafened']
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(false)
  character.conditions = []
  const silence: Dnd5ePluginArea = { ...base, id: 'silence', anchorMode: undefined, anchorTokenId: undefined,
    concentrationId: undefined, occupantModifiers: { preventsVerbalComponents: true }, vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 } }
  maps[0].dnd5ePluginAreas!.push(silence)
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(false)
  maps[0].tokens.find(token => token.id === 'sensor')!.elevationFeet = 20
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(true)
  silence.cells = [{ col: 2, row: 0 }]
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(false)
  silence.expiresAtWorldMinute = 100
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(true)
  expect(dnd5eRemoteSensorCanHearToken({ ...input, worldMinute: 110 })).toBe(false)
  character.dnd5eCombatState!.concentrationSpellId = undefined
  expect(dnd5eRemoteSensorCanHearToken(input)).toBe(false)
})
