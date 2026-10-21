import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { beginDnd5eNaturalSleep } from './naturalSleep'
import { beginDnd5eDreamContact, normalizeDnd5eDreamContact } from './dreamContact'
import { prepareDnd5eDreamNightmare, planDnd5eDreamNightmareReceipt } from './dreamNightmareAuthority'

function fixture() {
  const source = normalizeCharacter({ id: 'source', name: 'Source', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 })
  const target = normalizeCharacter({ id: 'target', name: 'Target', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 100 })
  const sleep = beginDnd5eNaturalSleep(target, { eventId: 'sleep', worldMinute: 100, durationMinutes: 60, canSleep: true })
  if (!sleep.ok) throw Error(sleep.reason)
  const started = beginDnd5eDreamContact({ source, target: sleep.character, id: 'session', packageId: 'test.dream', worldMinute: 100,
    knowsTarget: true, targetCanSleep: true, samePlane: true })
  if (!started.ok) throw Error(started.reason)
  const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, dnd5ePlane: 'material', tokens: ['source','target'].map(id => ({ id: `${id}-token`, characterId: id,
      label: id, type: 'player', x: 25, y: 25, size: 1, emoji: '', color: '#fff' })) }
  return { maps: [map], characters: [started.character, sleep.character] }
}

it('binds the nightmare grant to the connected source, target and Host facts, preserving a one-use receipt', async () => {
  const room = fixture(), before = structuredClone(room)
  const input = { readRoom: () => room, sourceCharacterId: 'source', packageId: 'test.dream', worldMinute: 100,
    message: 'Remember this warning', confirm: async () => ({ messageWithinTenWords: true, hasBodyConnection: true }) }
  const prepared = await prepareDnd5eDreamNightmare(input)
  expect(prepared.ok).toBe(true)
  expect(room).toEqual(before)
  if (!prepared.ok) return
  expect(prepared.grant.grantedActivityTargetIds).toEqual(['target-token'])
  expect(prepared.saveFactsByTargetId).toEqual({ 'target-token': { 'body-connection': true } })
  expect(planDnd5eDreamNightmareReceipt(room, JSON.parse(JSON.stringify(prepared.receipt)))).toBeUndefined()
  const patch = planDnd5eDreamNightmareReceipt(room, prepared.receipt)!
  expect(patch.dnd5eDreamContact?.nightmareAttempted).toBe(true)
  expect(normalizeDnd5eDreamContact(JSON.parse(JSON.stringify(patch.dnd5eDreamContact)), 'source')).toEqual(patch.dnd5eDreamContact)
  Object.assign(room.characters[0], patch)
  expect(planDnd5eDreamNightmareReceipt(room, prepared.receipt)).toBeUndefined()
  expect((await prepareDnd5eDreamNightmare(input)).ok).toBe(false)
})

it('rejects invalid lifecycle, foreign package, unconfirmed text, and room changes during confirmation', async () => {
  for (const mode of ['waiting','awake','missing-trance','expired','foreign-package','unconfirmed','changed','empty'] as const) {
    const room = fixture()
    if (mode === 'waiting') room.characters[0].dnd5eDreamContact!.phase = 'waiting'
    if (mode === 'awake') room.characters[1].dnd5eCombatState!.activeEffects = []
    if (mode === 'missing-trance') room.characters[0].dnd5eCombatState!.activeEffects = []
    const result = await prepareDnd5eDreamNightmare({ readRoom: () => room, sourceCharacterId: 'source',
      packageId: mode === 'foreign-package' ? 'other' : 'test.dream', worldMinute: mode === 'expired' ? 580 : 100,
      message: mode === 'empty' ? ' ' : 'Warning', confirm: async () => {
        if (mode === 'changed') room.characters[1].currentHp--
        return { messageWithinTenWords: mode !== 'unconfirmed', hasBodyConnection: false }
      } })
    expect(result.ok, mode).toBe(false)
  }
})
