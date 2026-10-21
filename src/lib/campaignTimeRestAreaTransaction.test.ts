import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { atomicMutateCampaignTimeAndMaps, mutateCampaignTimeState } from '../../scripts/shared-server-core.mjs'
import { expireRestBoundAreas } from '../../shared/rest-bound-areas.mjs'
import { normalizeSharedCampaignTime } from './campaignTime'
import type { BattleMap } from '../store/maps'
import { normalizeCharacter } from '../store/characters'
import { createDnd5eConditionEffect } from '../rulesets/dnd5e/activeEffects'
import { createEmptyMapGeometry } from './mapGeometry'

let stateRoot: string
const host = { role: 'dm', memberId: 'host' }
const context = { host, restCharacterIds: ['hero', 'other'] }
const area = (id: string, restSessionId?: string) => ({ id, label: id, createdRound: 1, expiresAfterRound: 100,
  sourceCharacterId: 'hero', restSessionId })
const maps = { maps: [{ id: 'map', tokens: [{ id: 'hero' }, { id: 'effect' }], dnd5ePluginAreas: [
  { ...area('bound', 'rest-1'), anchorMode: 'effect-token', anchorTokenId: 'effect' }, area('ordinary'),
] }] }
const read = async (name: string) => JSON.parse(await readFile(path.join(stateRoot, `${name}.json`), 'utf8'))
const mutate = (operation: string, extra = {}, member = host) => atomicMutateCampaignTimeAndMaps({ stateRoot },
  current => mutateCampaignTimeState(current, { operation, id: 'rest-1', expectedWorldMinute: 480, ...extra }, 5, member, context), host.memberId)
beforeEach(async () => {
  stateRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-rest-areas-'))
  expect((await mutate('start-rest-session', { kind: 'long-rest', characterIds: ['hero'] })).ok).toBe(true)
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify(maps))
})
afterEach(async () => { await rm(stateRoot, { recursive: true, force: true }) })

it.each(['complete-rest-session', 'interrupt-rest-session', 'advance'])('atomically removes rest areas on %s, retaining unrelated areas', async operation => {
  const result = await mutate(operation, operation === 'advance' ? { minutes: 1 } : {})
  expect(result).toMatchObject({ ok: true, changed: true, mapsMutation: { changed: true } })
  const saved = await read('maps')
  expect(saved.maps[0].dnd5ePluginAreas).toEqual([area('ordinary')])
  expect(saved.maps[0].tokens).toEqual([{ id: 'hero' }])
  const clock = normalizeSharedCampaignTime(await read('campaign-time'))
  expect(clock.restSessions?.[0].status).toBe(operation === 'complete-rest-session' ? 'completed' : 'interrupted')
  expect(expireRestBoundAreas(saved.maps[0], clock)).toBe(saved.maps[0])
  if (operation !== 'advance') {
    expect(await mutate(operation)).toMatchObject({ ok: true, changed: false })
    expect(await read('maps')).toEqual(saved)
  }
})

it('preserves active areas across reload and an unrelated session start; rejects unauthenticated cleanup', async () => {
  const clock = normalizeSharedCampaignTime(await read('campaign-time'))
  const map = JSON.parse(JSON.stringify(maps.maps[0])) as BattleMap
  expect(expireRestBoundAreas(map, clock)).toBe(map)
  expect(await mutate('start-rest-session', { id: 'rest-2', kind: 'short-rest', characterIds: ['other'] })).toMatchObject({ ok: true })
  expect(await read('maps')).toEqual(maps)
  expect(await mutate('interrupt-rest-session', {}, { role: 'player', memberId: 'player' })).toMatchObject({ ok: false })
  expect(await read('maps')).toEqual(maps)
})

it('does not keep an orphan, invalid binding, or area whose source was not a participant', async () => {
  const clock = normalizeSharedCampaignTime(await read('campaign-time'))
  for (const invalid of [area('bad', 'missing'), area('bad', ' '), { ...area('bad', 'rest-1'), sourceCharacterId: 'outsider' }]) {
    const map = { ...maps.maps[0], dnd5ePluginAreas: [invalid, area('ordinary')] } as unknown as BattleMap
    expect(expireRestBoundAreas(map, clock).dnd5ePluginAreas).toEqual([area('ordinary')])
  }
})

it('rejects invalid map output before writing either resource', async () => {
  const invalidMaps = { ...maps, updatedAt: -1 }
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify(invalidMaps))
  const before = await read('campaign-time')
  expect(await mutate('interrupt-rest-session')).toMatchObject({ ok: false, error: 'invalid-campaign-time-map-result' })
  expect(await read('campaign-time')).toEqual(before)
  expect(await read('maps')).toEqual(invalidMaps)
})

it('atomically decrements and expires a six-second area without advancing a whole minute',async()=>{
 const timed=JSON.parse(JSON.stringify(maps))
 timed.maps[0].dnd5ePluginAreas[1].remainingExplorationSeconds=6
 await writeFile(path.join(stateRoot,'maps.json'),JSON.stringify(timed))
 expect(await mutate('advance-seconds',{seconds:5},{role:'player',memberId:'player'})).toMatchObject({ok:false})
 expect(await read('maps')).toEqual(timed)
 expect(await mutate('advance-seconds',{seconds:5})).toMatchObject({ok:true})
 expect((await read('maps')).maps[0].dnd5ePluginAreas[1].remainingExplorationSeconds).toBe(1)
 expect(await read('campaign-time')).toMatchObject({worldMinute:480,worldSecondRemainder:5})
 expect(await mutate('advance-seconds',{seconds:1})).toMatchObject({ok:true})
 expect((await read('maps')).maps[0].dnd5ePluginAreas.map((a:{id:string})=>a.id)).toEqual(['bound'])
 expect(await read('campaign-time')).toMatchObject({worldMinute:480,worldSecondRemainder:6})
})

it('reports derived captive and flame writes for campaign-time notifications and grouped undo', async () => {
  const held = { ...createDnd5eConditionEffect({ id: 'held', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'caster' }, modifiers: { submerged: true }, duration: { type: 'permanent' } }),
    areaLifetime: { mapId: 'water', areaId: 'sphere', sourceActorId: 'caster' } }
  const character = normalizeCharacter({ id: 'victim', name: 'Victim', currentHp: 20, maxHp: 20,
    conditions: ['restrained'], dnd5eCombatState: { schemaVersion: 2, activeEffects: [held] } })
  const characterState = { characters: [character], updatedAt: 1 }
  const timedMap = { id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'victim-token', characterId: character.id, type: 'player', label: 'Victim', x: 25, y: 25,
      elevationFeet: 10, size: 1, color: '', emoji: '' }],
    dnd5ePluginAreas: [{ id: 'sphere', label: 'Water', sourceTokenId: 'caster', sourceCharacterId: '',
      createdRound: 1, expiresAfterRound: 10, remainingExplorationSeconds: 6,
      anchorCell: { col: 0, row: 0 }, cells: [{ col: 0, row: 0 }], endFlameExtinguishRadiusFeet: 30,
      triggers: [{ condition: { condition: 'restrained', endsWithArea: true, proneOnAreaEnd: true, groundOnAreaEnd: true } }] }] }
  const geometry = createEmptyMapGeometry(timedMap.id, 1)
  geometry.lights = [{ id: 'fire', kind: 'light', label: 'Fire', points: [{ x: 25, y: 25 }], elevationFeet: 0,
    sourceKind: 'torch', enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ff8000', createdAt: 1 }]
  const geometryState = { schemaVersion: 3, maps: [geometry], updatedAt: 1 }
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify({ maps: [timedMap], updatedAt: 1 }))
  await writeFile(path.join(stateRoot, 'characters.json'), JSON.stringify(characterState))
  await writeFile(path.join(stateRoot, 'map-geometry.json'), JSON.stringify(geometryState))
  const savedCharacters = await read('characters'), savedGeometry = await read('map-geometry')
  const result = await mutate('advance-seconds', { seconds: 6 })
  expect(result).toMatchObject({ ok: true, changed: true,
    charactersMutation: { changed: true, previous: savedCharacters }, geometryMutation: { changed: true, previous: savedGeometry } })
  expect(result.charactersMutation?.next).toEqual(await read('characters'))
  expect(result.geometryMutation?.next).toEqual(await read('map-geometry'))
  expect(result.mapsMutation?.next).toMatchObject({ maps: [{ tokens: [{ elevationFeet: 0 }] }] })
  expect(result.charactersMutation?.next).toMatchObject({ characters: [{ conditions: ['prone'] }] })
  expect(result.geometryMutation?.next).toMatchObject({ maps: [{ lights: [{ enabled: false }] }] })
})

it.each([false, true])('expires a combat-credited breathing protection with combined swimming=%s', async swimming => {
  const held = createDnd5eConditionEffect({ id: 'held', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'caster' }, modifiers: { submerged: true }, duration: { type: 'permanent' } })
  const ward = createDnd5eConditionEffect({ id: 'ward', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'helper' },
    modifiers: { environmentalCapabilities: { breatheIn: ['water'] }, ...(swimming ? { swimSpeedEqualsWalking: true } : {}) },
    duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' } })
  const victim = normalizeCharacter({ id: 'victim', name: 'Victim', currentHp: 20, maxHp: 20,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [held, ward] } })
  await writeFile(path.join(stateRoot, 'characters.json'), JSON.stringify({ characters: [victim], updatedAt: 1 }))
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify({ maps: [{ id: 'water',
    tokens: [{ id: 'victim-token', characterId: 'victim', type: 'player' }] }], updatedAt: 1 }))
  const result = await atomicMutateCampaignTimeAndMaps({ stateRoot }, current => {
    const advanced = mutateCampaignTimeState(current, { operation: 'advance', minutes: 1 }, 6, host, context)
    if (advanced.ok && advanced.next) {
      const next = advanced.next as { advances: Array<{ combatRoundCredits?: Record<string, number> }> }
      next.advances[next.advances.length - 1].combatRoundCredits = { '["character","victim"]': 10 }
    }
    return advanced
  }, host.memberId)
  expect(result).toMatchObject({ ok: true })
  const protectedVictim = (await read('characters')).characters[0]
  expect(protectedVictim.dnd5eCombatState.activeEffects.some((effect: { id: string }) => effect.id === 'ward')).toBe(true)
  expect(protectedVictim.dnd5eCombatState.submergedBreathingEffectDeadlines).toEqual([
    { effectId: 'ward', appliedAt: ward.appliedAt, expiresAtSeconds: 481 * 60 + 6 },
  ])
  expect(await mutate('advance-seconds', { seconds: 5 })).toMatchObject({ ok: true })
  expect((await read('characters')).characters[0].dnd5eCombatState.activeEffects.some((effect: { id: string }) => effect.id === 'ward')).toBe(true)
  expect(await mutate('advance-seconds', { seconds: 1 })).toMatchObject({ ok: true })
  const expired = (await read('characters')).characters[0]
  expect(expired.dnd5eCombatState.activeEffects.some((effect: { id: string }) => effect.id === 'ward')).toBe(false)
  expect(expired.currentHp).toBe(20)
  expect(expired.dnd5eCombatState.submergedBreathing.breathSeconds).toBeGreaterThan(0)
})

it('ends a suffocating NPC source concentration across character and token targets without clearing another NPC source', async () => {
  const held = createDnd5eConditionEffect({ id: 'held', condition: 'restrained', targetId: 'caster',
    source: { kind: 'plugin', actorId: 'water-source' }, modifiers: { submerged: true }, duration: { type: 'permanent' } })
  const linked = createDnd5eConditionEffect({ id: 'linked', condition: 'blinded', targetId: 'ally',
    source: { kind: 'plugin', actorId: 'caster' },
    duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'spell' } })
  const unrelated = createDnd5eConditionEffect({ id: 'other', condition: 'deafened', targetId: 'ally',
    source: { kind: 'plugin', actorId: 'other-caster' },
    duration: { type: 'concentration', sourceActorId: 'other-caster', concentrationId: 'spell' } })
  const effects = [linked, unrelated]
  const ally = normalizeCharacter({ id: 'ally', name: 'Ally', currentHp: 20, maxHp: 20,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: effects } })
  const scene = { id: 'water', tokens: [
    { id: 'caster', type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [held], concentrationSpellId: 'spell',
        concentrationSpellLevel: 4, concentrationTargetIds: ['ally'], concentrationStartedTurnKey: 'turn:1' } },
    { id: 'npc-target', type: 'enemy', hp: 20, maxHp: 20, dnd5eCombatState: { schemaVersion: 2, activeEffects: effects } },
  ], dnd5ePluginAreas: ['caster', 'other-caster'].map(sourceTokenId => ({ id: sourceTokenId + '-area',
    label: 'Area', sourceTokenId, concentrationId: 'spell', createdRound: 1, expiresAfterRound: 100 })) }
  await writeFile(path.join(stateRoot, 'characters.json'), JSON.stringify({ characters: [ally], updatedAt: 1 }))
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify({ maps: [scene], updatedAt: 1 }))
  expect(await mutate('advance-seconds', { seconds: 120 })).toMatchObject({ ok: true })
  const saved = (await read('maps')).maps[0]
  expect(saved.tokens[0].hp).toBe(0)
  expect(saved.tokens[0].dnd5eCombatState.concentrationSpellLevel).toBeUndefined()
  expect(saved.tokens[0].dnd5eCombatState.concentrationTargetIds).toBeUndefined()
  expect(saved.tokens[0].dnd5eCombatState.concentrationStartedTurnKey).toBeUndefined()
  expect(saved.dnd5ePluginAreas.map((entry: { id: string }) => entry.id)).toEqual(['other-caster-area'])
  expect(saved.tokens[1].dnd5eCombatState.activeEffects.map((entry: { id: string }) => entry.id)).toEqual(['other'])
  expect((await read('characters')).characters[0].dnd5eCombatState.activeEffects.map((entry: { id: string }) => entry.id)).toEqual(['other'])
})

it.each([true, false].flatMap(isCharacter => [true, false].flatMap(aquatic => [true, false].map(retainsHp => ({ isCharacter, aquatic, retainsHp })))))(
  'restores original after exploration form suffocation, character=$isCharacter aquatic=$aquatic retainsHp=$retainsHp', async ({ isCharacter, aquatic, retainsHp }) => {
  const held = createDnd5eConditionEffect({ id: 'held', condition: 'restrained', targetId: 'target',
    source: { kind: 'plugin', actorId: 'water' }, modifiers: { submerged: true }, duration: { type: 'permanent' } })
  const state = { schemaVersion: 2 as const, activeEffects: [held], conditions: ['restrained'], concentrationSpellId: 'maintained',
    wildShapeFormId: 'srd-5.1:goblin', wildShapeMode: 'polymorph' as const,
    wildShapeRetainsHitPoints: retainsHp || undefined, temporaryHp: 10,
    wildShapeCurrentHp: 7, wildShapeOriginalCurrentHp: 15, wildShapeOriginalMaxHp: 20,
    wildShapeOriginalStatBlockId: aquatic ? 'srd-5.1:frog' : 'srd-5.1:goblin', wildShapeOriginalSizeRank: 0 }
  const character = normalizeCharacter({ id: 'hero', name: 'Hero', currentHp: 15, maxHp: 20, tempHp: 10,
    concentrating: true, dnd5eCombatState: state })
  const token = { id: 'target', type: isCharacter ? 'player' : 'enemy', characterId: isCharacter ? 'hero' : undefined,
    poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7, size: 2, dnd5eCombatState: state }
  await writeFile(path.join(stateRoot, 'characters.json'), JSON.stringify({ characters: isCharacter ? [character] : [], updatedAt: 1 }))
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify({ maps: [{ id: 'water', tokens: [token] }], updatedAt: 1 }))
  const advancement = await mutate('advance-seconds', { seconds: 66 })
  expect(advancement, JSON.stringify(advancement)).toMatchObject({ ok: true })
  const savedToken = (await read('maps')).maps[0].tokens[0]
  expect(savedToken.hp).toBe(retainsHp ? 0 : 15)
  expect(savedToken.maxHp).toBe(20)
  expect(savedToken.size).toBe(1)
  const saved = isCharacter ? (await read('characters')).characters[0] : savedToken
  expect(saved.dnd5eCombatState.wildShapeFormId).toBeUndefined()
  if (retainsHp && isCharacter) expect(saved.tempHp).toBe(0)
  if (retainsHp) expect(saved.dnd5eCombatState.temporaryHp ?? 0).toBe(0)
  if (aquatic) expect(saved.dnd5eCombatState.submergedBreathing).toBeUndefined()
  else if (retainsHp) expect(saved.dnd5eCombatState.submergedBreathing.collapsed).toBe(true)
  else expect(saved.dnd5eCombatState.submergedBreathing).toMatchObject({ breathSeconds: 0, collapsed: true,
    pendingCollapseAtSeconds: 480 * 60 + 72 })
  expect(saved.dnd5eCombatState.concentrationSpellId).toBe(retainsHp ? undefined : 'maintained')
  expect((saved.dnd5eCombatState.conditions ?? []).includes('unconscious')).toBe(retainsHp)
  if (isCharacter) expect(saved.concentrating).toBe(!retainsHp)
  else expect(savedToken.poolId).toBe(aquatic ? 'srd-5.1:frog' : 'srd-5.1:goblin')
  expect(await mutate('advance-seconds', { seconds: 5 })).toMatchObject({ ok: true })
  expect((await read('maps')).maps[0].tokens[0].hp).toBe(retainsHp ? 0 : 15)
  expect(await mutate('advance-seconds', { seconds: 1 })).toMatchObject({ ok: true })
  expect(await mutate('advance-seconds', { seconds: 120 })).toMatchObject({ ok: true })
  const later = isCharacter ? (await read('characters')).characters[0] : (await read('maps')).maps[0].tokens[0]
  if (aquatic) expect(later.dnd5eCombatState.submergedBreathing).toBeUndefined()
  else expect(later.dnd5eCombatState.submergedBreathing.collapsed).toBe(true)
  expect(isCharacter ? later.currentHp : later.hp).toBe(aquatic && !retainsHp ? 15 : 0)
})

it.each([
  { lifetime: 60, protection: 0, collapses: true },
  { lifetime: 30, protection: 0, collapses: false },
  { lifetime: 60, protection: 2, collapses: true },
  { lifetime: 60, protection: 10, collapses: false },
].flatMap(scenario => [60, 6].map(step => ({ ...scenario, step }))))('settles submerged time before area expiry: $lifetime seconds, protection $protection rounds, steps $step', async ({ lifetime, protection, collapses, step }) => {
  const held = { ...createDnd5eConditionEffect({ id: 'held', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'caster' }, modifiers: { submerged: true }, duration: { type: 'permanent' } }),
    areaLifetime: { mapId: 'water', areaId: 'sphere', sourceActorId: 'caster' } }
  const ward = { ...createDnd5eConditionEffect({ id: 'ward', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'helper' }, appliedRound: 1, appliedTurnKey: 'combat:1:helper',
    duration: { type: 'rounds', remainingRounds: protection || 1, tickOn: 'target-turn-end' } }),
    modifiers: { environmentalCapabilities: { breatheIn: ['water'] as const } } }
  const character = normalizeCharacter({ id: 'victim', name: 'Victim', currentHp: 20, maxHp: 20,
    abilities: { str: 10, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
    concentrating: true,
    dnd5eCombatState: { schemaVersion: 2, concentrationSpellId: 'test-concentration',
      concentrationTargetIds: ['ally'], activeEffects: [held, ...(protection ? [ward] : [])] } })
  const dependent = createDnd5eConditionEffect({ id: 'dependent', condition: 'blinded', targetId: 'ally',
    source: { kind: 'plugin', actorId: 'victim-token' },
    duration: { type: 'concentration', sourceActorId: 'victim-token', concentrationId: 'test-concentration' } })
  const ally = normalizeCharacter({ id: 'ally', name: 'Ally', currentHp: 20, maxHp: 20,
    conditions: ['blinded'], dnd5eCombatState: { schemaVersion: 2, activeEffects: [dependent],
      concentrationEffectsBySource: { 'victim-token': 'test-concentration' } } })
  const map = { id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'victim-token', characterId: character.id, type: 'player', label: 'Victim', x: 25, y: 25, size: 1, color: '', emoji: '' }],
    dnd5ePluginAreas: [{ id: 'sphere', label: 'Water', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 10,
      remainingExplorationSeconds: lifetime, cells: [{ col: 0, row: 0 }] }] }
  await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify({ maps: [map], updatedAt: 1 }))
  await writeFile(path.join(stateRoot, 'characters.json'), JSON.stringify({ characters: [character, ally], updatedAt: 1 }))
  for (let elapsed = 0; elapsed < 60; elapsed += step) {
    expect(await mutate('advance-seconds', { seconds: step })).toMatchObject({ ok: true })
    if (protection && elapsed + step >= protection * 6) {
      const current = (await read('characters')).characters[0]
      expect(current.dnd5eCombatState.activeEffects?.some((effect: { id: string }) => effect.id === 'ward')).not.toBe(true)
      const { dnd5eActiveEnvironmentalCapabilities } = await import('../rulesets/dnd5e/activeEffects')
      expect(dnd5eActiveEnvironmentalCapabilities(current.dnd5eCombatState.activeEffects).canBreatheWater).toBe(false)
    }
  }
  const saved = (await read('characters')).characters[0]
  expect(saved.currentHp).toBe(collapses ? 0 : 20)
  expect(saved.conditions.includes('unconscious')).toBe(collapses)
  expect(saved.concentrating).toBe(!collapses)
  const savedAlly = (await read('characters')).characters.find((row: { id: string }) => row.id === 'ally')
  expect(savedAlly.dnd5eCombatState.activeEffects?.some((effect: { id: string }) => effect.id === 'dependent') ?? false).toBe(!collapses)
  expect(!!savedAlly.dnd5eCombatState.concentrationEffectsBySource?.['victim-token']).toBe(!collapses)
  expect(saved.dnd5eCombatState.submergedBreathing).toBeUndefined()
  expect((await read('maps')).maps[0].dnd5ePluginAreas).toEqual([])
})
