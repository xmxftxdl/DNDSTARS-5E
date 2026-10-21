import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { beginDnd5eNaturalSleep } from './naturalSleep'
import { beginDnd5eDreamContact, endDnd5eDreamContact, reconcileDnd5eDreamContact } from './dreamContact'
import type { BattleMap, Token } from '../../store/maps'
import { prepareDnd5eDreamContactFromRoom, planDnd5eDreamContactPublication } from './dreamContactAuthority'
import { reconcileDnd5eCharacterCampaignTime, reconcileDnd5eCampaignRosterSourceEffects } from './campaignTimeRules'
import type { Character } from '../../types/character'

it('updates dream contact through the campaign roster pipeline after target sleep expires, independent of roster order', () => {
  const source = normalizeCharacter({ id: 'source', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 })
  const target = normalizeCharacter({ id: 'target', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 })
  const start = beginDnd5eDreamContact({ source, target, id: 'cast', packageId: 'test.dream', worldMinute: 100,
    knowsTarget: true, targetCanSleep: true, samePlane: true })
  const sleep = beginDnd5eNaturalSleep(target, { eventId: 'sleep', worldMinute: 100, durationMinutes: 60, canSleep: true })
  if (!start.ok || !sleep.ok) throw Error('fixture rejected')
  const advance = (roster: Character[], worldMinute: number) => reconcileDnd5eCampaignRosterSourceEffects(roster.map(character =>
    reconcileDnd5eCharacterCampaignTime(character, { schemaVersion: 2, worldMinute, displayMode: 'campaign-day',
      displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1 }))).map(result => result.character)
  for (const roster of [[start.character, sleep.character], [sleep.character, start.character]]) {
    const skipped = advance(roster, 160).find(character => character.id === source.id)!
    expect(skipped.dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'target-awake' })
    expect(skipped.dnd5eCombatState?.activeEffects ?? []).toEqual([])
    const connected = advance(roster, 110)
    expect(connected.find(character => character.id === source.id)?.dnd5eDreamContact?.phase).toBe('connected')
    const ended = advance(connected, 160)
    const messenger = ended.find(character => character.id === source.id)!
    expect(messenger.dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'target-awake', expiresWorldMinute: 580 })
    expect(messenger.dnd5eCombatState?.activeEffects ?? []).toEqual([])
    expect(ended.find(character => character.id === target.id)?.dnd5eAwakeningEvents).toHaveLength(1)
    expect(advance(ended, 160)).toEqual(ended)
    const awakeTarget = ended.find(character => character.id === target.id)!
    const fresh = beginDnd5eDreamContact({ source: messenger, target: awakeTarget, id: 'new-cast',
      packageId: 'test.dream', worldMinute: 160, knowsTarget: true, targetCanSleep: true, samePlane: true })
    if (!fresh.ok) throw Error(fresh.reason)
    expect(advance([fresh.character, awakeTarget], 161)[0].dnd5eDreamContact?.phase).toBe('waiting')
  }
  expect(advance([start.character, target], 580)[0].dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'expired' })
  expect(advance([start.character], 110)[0].dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'contact-lost' })
})

it('derives dream identity and plane from live room state and rejects changes during DM confirmation', async () => {
  const characters = ['source', 'target'].map(id => normalizeCharacter({ id, currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 }))
  const token = (id: string): Token => ({ id: `${id}-token`, characterId: id, label: id, x: 0, y: 0, color: '#fff', emoji: '', size: 1, type: 'player' })
  const map = (id: string, creature: string): BattleMap => ({ id, name: id, width: 100, height: 100, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, dnd5ePlane: 'material', tokens: [token(creature)] })
  const original = { maps: [map('a', 'source'), map('b', 'target')], characters }
  let room = structuredClone(original)
  let confirmations = 0
  const input = { readRoom: () => room, sourceCharacterId: 'source', targetCharacterId: 'target', id: 'cast',
    packageId: 'test.dream', worldMinute: 100, confirmEligibility: async () => {
      confirmations++; return { knowsTarget: true, targetCanSleep: true }
    } }
  const result = await prepareDnd5eDreamContactFromRoom(input)
  expect(result.ok).toBe(true)
  expect(room).toEqual(original)
  if (!result.ok) throw Error(result.reason)
  const application = { map: room.maps[0], characters: room.characters.map(character => character.id === 'source'
    ? { ...character, currentHp: 15, classResources: { fighterSecondWind: { current: 0, max: 1 } } } : character),
    changedCharacterIds: ['source'], changedTokenIds: [], characterPatches: { source: { currentHp: 15 } } }
  const published = planDnd5eDreamContactPublication({ room, receipt: result.receipt, application })
  expect(published.ok).toBe(true)
  if (!published.ok) throw Error(published.reason)
  expect(published.application.characters[0]).toMatchObject({ currentHp: 15,
    classResources: { fighterSecondWind: { current: 0 } }, dnd5eDreamContact: { phase: 'waiting' } })
  expect(published.application.characterPatches?.source.currentHp).toBe(15)
  expect(published.application.map.tokens[0].dnd5eCombatState?.activeEffects?.some(effect => effect.definitionId === 'dream-trance')).toBe(true)
  expect(application.characters[0].dnd5eDreamContact).toBeUndefined()
  expect(planDnd5eDreamContactPublication({ room, receipt: { ...result.receipt }, application }).ok).toBe(false)
  expect(planDnd5eDreamContactPublication({ room: { ...room, characters: application.characters }, receipt: result.receipt, application }).ok).toBe(false)
  for (const mutate of [
    () => { room.maps[1].dnd5ePlane = 'astral' },
    () => { delete room.maps[1].dnd5ePlane },
    () => { room.maps[1].tokens.push(token('target')) },
    () => { room.characters.push(characters[1]) },
    () => { room.maps[1].tokens = [] },
  ]) {
    room = structuredClone(original); mutate()
    expect((await prepareDnd5eDreamContactFromRoom(input)).ok).toBe(false)
  }
  expect(confirmations).toBe(1)
  room = structuredClone(original)
  expect(await prepareDnd5eDreamContactFromRoom({ ...input, confirmEligibility: async () => {
    room = structuredClone(room)
    room.maps[1].dnd5ePlane = 'astral'
    return { knowsTarget: true, targetCanSleep: true }
  } })).toEqual({ ok: false, reason: 'dream-contact-room-conflict' })
  room = structuredClone(original)
  expect((await prepareDnd5eDreamContactFromRoom({ ...input, confirmEligibility: async () => ({ knowsTarget: true, targetCanSleep: false }) })).ok).toBe(false)
})

it('persists waiting and connected dream contact without extending its eight-hour deadline', () => {
  const source = normalizeCharacter({ id: 'source', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 })
  const target = normalizeCharacter({ id: 'target', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 })
  const input = { source, target, id: 'cast-1', packageId: 'test.dream', worldMinute: 100,
    knowsTarget: true, targetCanSleep: true, samePlane: true }
  for (const key of ['knowsTarget', 'targetCanSleep', 'samePlane'] as const) expect(beginDnd5eDreamContact({ ...input, [key]: false }).ok).toBe(false)
  const started = beginDnd5eDreamContact(input)
  expect(started.ok).toBe(true)
  if (!started.ok) return
  const saved = normalizeCharacter(JSON.parse(JSON.stringify(started.character)))
  expect(saved.dnd5eDreamContact).toMatchObject({ phase: 'waiting', expiresWorldMinute: 580 })
  expect(saved.dnd5eCombatState?.activeEffects?.[0].modifiers).toMatchObject({ preventActions: true, speedOverrideFeet: 0 })
  expect(saved.conditions).not.toContain('blinded')
  expect(saved.conditions).not.toContain('unconscious')
  expect(beginDnd5eDreamContact({ ...input, source: saved }).ok).toBe(false)
  const sleeping = beginDnd5eNaturalSleep(target, { eventId: 'sleep', worldMinute: 100, durationMinutes: 60, canSleep: true })
  if (!sleeping.ok) throw Error(sleeping.reason)
  const connected = reconcileDnd5eDreamContact(saved, sleeping.character, 110, true)
  expect(connected.dnd5eDreamContact).toMatchObject({ phase: 'connected', expiresWorldMinute: 580 })
  const awake = reconcileDnd5eDreamContact(connected, target, 120, true)
  expect(awake.dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'target-awake' })
  expect(awake.dnd5eCombatState?.activeEffects ?? []).toEqual([])
  expect(reconcileDnd5eDreamContact(awake, sleeping.character, 121, true)).toBe(awake)
  expect(reconcileDnd5eDreamContact(saved, target, 579, true).dnd5eDreamContact?.phase).toBe('waiting')
  expect(reconcileDnd5eDreamContact(saved, target, 580, true).dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'expired' })
  expect(endDnd5eDreamContact(saved).dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'voluntary' })
  expect(source.dnd5eDreamContact).toBeUndefined()
})
