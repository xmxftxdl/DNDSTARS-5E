import { shouldPresentSharedDiceInPlayerTray } from './roomDiceFeed'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCompletedRoomDice, clearedRoomDiceReplay, readRoomDiceFeed, roomDiceRequest, roomDiceResult, sharedDicePresentationLabels, upsertRoomDice, type RoomDiceEntry } from './roomDiceFeed'
import { resolveSharedDiceEventApply } from '../../lib/sharedDiceSync'

const entry = (id: string): RoomDiceEntry => ({ id, rollerName: id, label: '敏捷豁免', targetName: id,
  sides: 20, values: [12], total: 12, formula: '1d20', status: 'review', updatedAt: 100 })

describe('independent room dice', () => {
  it('uses the same target and title for an original roll and its DM confirmation', () => {
    const original = { label: '粉碎音波效果', targetName: '牛头人', rollerName: '新冒险者' }
    expect(sharedDicePresentationLabels(original)).toEqual({ label: '粉碎音波效果', targetName: '牛头人' })
    expect(sharedDicePresentationLabels({ ...original, label: '粉碎音波效果（DM 修正）' }))
      .toEqual(sharedDicePresentationLabels(original))
    expect(sharedDicePresentationLabels({ ...original, targetName: '' }).targetName).toBe('')
  })
  it.each([
    { sides: 20, values: [17], bonus: 7, total: 24, formula: '1d20+7' },
    { sides: 6, values: [5, 6], bonus: 4, total: 15, formula: '2d6+4' },
    { sides: 20, values: [10], bonus: -2, total: 8, formula: '1d20-2' },
  ])('preserves the modifier and final total in $formula', ({ formula, ...roll }) => {
    const result = roomDiceResult({ id: 'result', mapId: 'map', sourceMode: 'dm', updatedAt: 110,
      rollerName: '新冒险者', roll: { ...roll, sourceRollIds: ['raw'], label: '形态攻击', targetName: '牛头人' } })!
    expect(result).toMatchObject({ formula, bonus: roll.bonus, total: roll.total })
    const merged = upsertRoomDice([{ ...entry('raw'), status: 'confirmed' }], result)
    expect(merged).toHaveLength(1)
    expect(merged[0].total).toBe(roll.total)
    expect(upsertRoomDice(merged, { ...entry('raw'), status: 'confirmed', updatedAt: 120 })).toEqual(merged)
  })
  it('replaces raw check rows with one final total and ignores late confirmations after reload', () => {
    const raw = { ...entry('check-a'), total: 15, status: 'confirmed' as const }
    const other = entry('check-b')
    const final = { ...raw, sourceRollIds: ['check-a'], total: 16, formula: '1d20+1', status: 'result' as const, updatedAt: 110 }
    const updated = upsertRoomDice([raw, other], final)
    expect(updated).toHaveLength(2)
    expect(updated.find(row => row.id === 'check-a')?.total).toBe(16)
    const restored = JSON.parse(JSON.stringify(updated))
    expect(upsertRoomDice(restored, { ...raw, updatedAt: 120 })).toEqual(updated)
    expect(upsertRoomDice([other], final)).toEqual(updated)
  })
  afterEach(() => vi.unstubAllGlobals())
  it('clears completed cards across reloads without losing pending rolls or restoring old broadcasts', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', { sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } })
    const completed = { ...entry('done'), status: 'result' as const }
    const waiting = { ...entry('waiting'), status: 'waiting' as const }
    const review = entry('review')
    expect(clearCompletedRoomDice('room', [completed, waiting, review])).toEqual([waiting, review])
    const restored = readRoomDiceFeed('room')
    expect(restored).toEqual([waiting, review])
    expect(clearedRoomDiceReplay('room', restored, { ...completed, status: 'confirmed', updatedAt: 200 })).toBe(true)
    expect(clearedRoomDiceReplay('room', restored, { ...review, status: 'confirmed' })).toBe(false)
    const next = { ...completed, id: 'new', updatedAt: 201 }
    expect(clearedRoomDiceReplay('room', restored, next)).toBe(false)
    expect(clearCompletedRoomDice('room', [next])).toEqual([])
    expect(readRoomDiceFeed('room')).toEqual([])
    expect(clearedRoomDiceReplay('room', [], completed)).toBe(true)
    expect(clearedRoomDiceReplay('another-room', [], completed)).toBe(false)
  })
  it('retains simultaneous players and updates only the matching roll', () => {
    const entries = ['战士', '法师', '游荡者'].reduce<RoomDiceEntry[]>((all, id) => upsertRoomDice(all, entry(id)), [])
    const confirmed = upsertRoomDice(entries, { ...entry('法师'), rollerName: 'DM', values: [18], total: 18, status: 'confirmed', updatedAt: 101 })
    expect(confirmed).toHaveLength(3)
    expect(confirmed.find(row => row.id === '法师')).toMatchObject({ rollerName: '法师', total: 18, status: 'confirmed' })
    expect(confirmed.find(row => row.id === '战士')?.total).toBe(12)
    expect(upsertRoomDice(confirmed, { ...entry('法师'), updatedAt: 102 })).toEqual(confirmed)
  })
  it('merges a DM confirmation into the original card', () => {
    expect(roomDiceRequest({ eventId: 'event', requestId: 'roll:dm-confirmed', mapId: 'map', sourceMode: 'dm',
      kind: 'd20', count: 1, sides: 20, values: [17], label: '敏捷豁免（DM 修正）', targetName: '战士', updatedAt: 200,
    })).toMatchObject({ id: 'roll', label: '敏捷豁免', status: 'confirmed', total: 17 })
  })
  it('shows other players on the same role, hides own echoes and private dice', () => {
    const input = { mapId: 'map', mode: 'player' as const, memberId: 'a', now: 101, seenIds: new Set<string>(),
      state: { id: 'r', mapId: 'map', sourceMode: 'player' as const, sourceMemberId: 'b', updatedAt: 100,
        roll: { sides: 20, values: [12], total: 12, bonus: 0, label: '豁免', targetName: '战士' } } }
    expect(resolveSharedDiceEventApply(input).status).toBe('apply')
    expect(resolveSharedDiceEventApply({ ...input, memberId: 'b' })).toMatchObject({ reason: 'same-source' })
    expect(resolveSharedDiceEventApply({ ...input, state: { ...input.state, visibility: 'dm' } })).toMatchObject({ reason: 'private-roll' })
  })
})

describe('opposed dice tray ownership', () => {
  it('keeps the caster die on its player and the monster die on the DM', () => {
    const owner = new Set(['wizard'])
    expect(shouldPresentSharedDiceInPlayerTray({ ownerOnlyPresentation: true, targetCharacterId: 'wizard' }, owner)).toBe(true)
    expect(shouldPresentSharedDiceInPlayerTray({ ownerOnlyPresentation: true }, owner)).toBe(false)
    expect(shouldPresentSharedDiceInPlayerTray({ ownerOnlyPresentation: true, targetCharacterId: 'other-player' }, owner)).toBe(false)
    expect(shouldPresentSharedDiceInPlayerTray({}, owner)).toBe(true)
  })
})
