import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { createDnd5eConditionEffect, normalizeDnd5eActiveEffects } from './activeEffects'
import { reconcileDnd5eAreaCaptivesAcrossMaps } from './persistentAreaEnd'
import { reconcileDnd5eSummonSourceDeathsAcrossMaps } from './mapBridge'

function fixture(live = false) {
  const effect = { ...createDnd5eConditionEffect({ id: 'held', condition: 'restrained', targetId: 'target',
    source: { kind: 'plugin', actorId: 'source' }, duration: { type: 'permanent' }, tags: ['persistent-area:container'] }),
    areaLifetime: { mapId: 'source-map', areaId: 'container', sourceActorId: 'source' } }
  const token: Token = { id: 'target', label: 'Target', type: 'npc', x: 75, y: 75, size: 1, hp: 20, maxHp: 20,
    color: '#fff', emoji: '', dnd5eCombatState: { activeEffects: [effect] } }
  const base: BattleMap = { id: 'source-map', name: 'Source', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [] }
  const area: Dnd5ePluginArea = { id: 'container', sourceTokenId: 'source', sourceCharacterId: '', pluginId: 'test', featureId: 'test',
    label: 'Container', color: '#fff', createdRound: 1, expiresAfterRound: 10, cells: [{ col: 1, row: 1 }] }
  const source = { ...base, dnd5ePluginAreas: live ? [area] : [] }
  const remote = { ...base, id: 'remote-map', name: 'Remote', tokens: [token] }
  return { source, remote, token, effect }
}

it('persists valid Host area identities across JSON normalization and rejects malformed identities', () => {
  const { effect } = fixture()
  expect(normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))[0].areaLifetime).toEqual(effect.areaLifetime)
  for (const areaLifetime of [{ ...effect.areaLifetime, areaId: '' }, { mapId: 'source-map' },
    { ...effect.areaLifetime, sourceActorId: 2 }, { ...effect.areaLifetime, extra: true }]) {
    expect(normalizeDnd5eActiveEffects([{ ...effect, areaLifetime }])[0].areaLifetime).toBeUndefined()
  }
})

it('persists binding generations and releases only superseded remote restraints after reload', () => {
  const { source, remote, effect } = fixture(true)
  source.dnd5ePluginAreas![0].boundEffectGeneration = 2
  const previous = { ...effect, areaLifetime: { ...effect.areaLifetime, generation: 1 } }
  const current = { ...effect, id: 'current', areaLifetime: { ...effect.areaLifetime, generation: 2 } }
  remote.tokens[0].dnd5eCombatState!.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([previous, current])))
  expect(remote.tokens[0].dnd5eCombatState!.activeEffects![0].areaLifetime?.generation).toBe(1)
  const result = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: [source, remote], characters: [], round: 1 })
  expect(result.maps[1].tokens[0].dnd5eCombatState?.activeEffects?.map(entry => entry.id)).toEqual(['current'])
  for (const generation of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    expect(normalizeDnd5eActiveEffects([{ ...effect, areaLifetime: { ...effect.areaLifetime, generation } }])[0].areaLifetime).toBeUndefined()
  }
})

it('releases a captive on an unopened remote map and leaves unrelated effects intact', () => {
  const { source, remote, token } = fixture()
  const other = createDnd5eConditionEffect({ id: 'other', targetId: token.id, condition: 'restrained',
    source: { kind: 'plugin', actorId: 'other-source' }, duration: { type: 'permanent' } })
  token.dnd5eCombatState!.activeEffects!.push(other)
  const input = { maps: [source, remote], characters: [], round: 3 }
  const before = structuredClone(input)
  const result = reconcileDnd5eAreaCaptivesAcrossMaps(input)
  expect(result.maps[0]).toBe(source)
  expect(result.maps[1].tokens[0].dnd5eCombatState?.activeEffects?.map(effect => effect.id)).toEqual(['other'])
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', targetId: 'target', effectId: 'held' }))
  expect(result.maps[1].tokens[0]).toMatchObject({ x: 75, y: 75, hp: 20 })
  expect(input).toEqual(before)
})

it('keeps unknown, ambiguous or still-live source maps and mismatched provenance intact', () => {
  const { source, remote, effect } = fixture(true)
  for (const maps of [[remote], [source, source, remote], [source, remote]]) {
    expect(reconcileDnd5eAreaCaptivesAcrossMaps({ maps, characters: [], round: 3 }).maps).toBe(maps)
  }
  source.dnd5ePluginAreas = []
  effect.areaLifetime.sourceActorId = 'wrong-source'
  const maps = [source, remote]
  expect(reconcileDnd5eAreaCaptivesAcrossMaps({ maps, characters: [], round: 3 }).maps).toBe(maps)
})

it('clears ordinary mapless character restraint without creating tokens or changing hit points', () => {
  const { source, effect } = fixture()
  const character = normalizeCharacter({ id: 'character', name: 'Character', maxHp: 30, currentHp: 17,
    dnd5eCombatState: { activeEffects: [effect] } })
  const maps = [source]
  const result = reconcileDnd5eAreaCaptivesAcrossMaps({ maps, characters: [character], round: 3 })
  expect(result.maps).toBe(maps)
  expect(result.maps[0].tokens).toEqual([])
  expect(result.characters[0].conditions).not.toContain('restrained')
  expect(result.characters[0].currentHp).toBe(17)
  const repeated = reconcileDnd5eAreaCaptivesAcrossMaps({ ...result, round: 3 })
  expect(repeated.characters).toBe(result.characters)
  expect(repeated.events).toEqual([])
})

it('runs in the existing room authority lifecycle coordinator after reload', () => {
  const { source, remote } = fixture()
  const input = JSON.parse(JSON.stringify({ maps: [source, remote], characters: [], round: 3 }))
  const result = reconcileDnd5eSummonSourceDeathsAcrossMaps(input)
  expect(result.maps[1].tokens[0].dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'held')).not.toBe(true)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', effectId: 'held' }))
})

it('clears a bound character on another map after its Token identity changes', () => {
  const { source, remote, effect } = fixture()
  const character = normalizeCharacter({ id: 'traveler', name: 'Traveler', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { activeEffects: [effect] } })
  remote.tokens = [{ ...remote.tokens[0], id: 'new-token', type: 'player', characterId: character.id }]
  const result = reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [source, remote], characters: [character], round: 3 })
  expect(result.characters[0].conditions).not.toContain('restrained')
  expect(result.maps[1].tokens[0].dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'held')).not.toBe(true)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', targetId: 'new-token' }))
})

it('does not guess a mapless custom aftermath and settles it once a real Token is available', () => {
  const { source, remote, effect } = fixture()
  const character = normalizeCharacter({ id: 'aftermath', name: 'Aftermath', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { activeEffects: [{ ...effect, afterEffectEnds: { duration: 'rounds', rounds: 1,
      preventActions: true, preventMovement: true } }] } })
  const pending = reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [source], characters: [character], round: 3 })
  expect(pending.characters[0]).toBe(character)
  expect(pending.events).toEqual([])
  remote.tokens = [{ ...remote.tokens[0], characterId: character.id, type: 'player' }]
  const settled = reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [source, remote], characters: [character], round: 3 })
  expect(settled.characters[0].conditions).not.toContain('restrained')
  expect(settled.characters[0].dnd5eCombatState?.activeEffects?.some(effect => effect.modifiers?.preventActions)).toBe(true)
})

it('uses explicit persisted map deletion evidence but gives a restored live map precedence', () => {
  const { source, remote } = fixture(true)
  const unknown = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: [remote], characters: [], round: 3 })
  expect(unknown.maps[0].tokens[0].dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'held')).toBe(true)
  const deleted = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: [remote], characters: [], round: 3, deletedMapIds: ['source-map'] })
  expect(deleted.maps[0].tokens[0].dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'held')).not.toBe(true)
  const restored = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: [source, remote], characters: [], round: 3, deletedMapIds: ['source-map'] })
  expect(restored.maps[1].tokens[0].dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'held')).toBe(true)
})
