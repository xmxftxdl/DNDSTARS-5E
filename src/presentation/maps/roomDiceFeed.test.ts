import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCompletedRoomDice, clearedRoomDiceReplay, readRoomDiceFeed, roomDiceRequest, upsertRoomDice, type RoomDiceEntry } from './roomDiceFeed'
import { resolveSharedDiceEventApply } from '../../lib/sharedDiceSync'

const entry = (id: string): RoomDiceEntry => ({ id, rollerName: id, label: '敏捷豁免', targetName: id,
  sides: 20, values: [12], total: 12, formula: '1d20', status: 'review', updatedAt: 100 })

describe('independent room dice', () => {
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
