import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissRoomDice, loadRoomDiceDismissal, roomDiceDismissed, saveRoomDiceDismissal } from './roomDiceDismissal'
import type { RoomDiceEntry } from './roomDiceFeed'

const roll = (id: string, updatedAt = 100): RoomDiceEntry => ({ id, updatedAt, rollerName: '玩家', targetName: '玩家', label: '豁免', sides: 20, values: [12], total: 12, formula: '1d20', status: 'result' })
afterEach(() => vi.unstubAllGlobals())
describe('room dice dismissal', () => {
  it('stays closed for a replay or correction and opens for a new roll', () => {
    const dismissal = dismissRoomDice([roll('a')])
    expect(roomDiceDismissed([roll('a')], dismissal)).toBe(true)
    expect(roomDiceDismissed([roll('a', 200)], dismissal)).toBe(true)
    expect(roomDiceDismissed([roll('older', 50), roll('a')], dismissal)).toBe(true)
    expect(roomDiceDismissed([roll('b', 101), roll('a')], dismissal)).toBe(false)
  })
  it('remembers closure after reload, scoped to the room, and supports manual reopening', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('window', { sessionStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } })
    saveRoomDiceDismissal('room-a', dismissRoomDice([roll('a')]))
    expect(roomDiceDismissed([roll('a')], loadRoomDiceDismissal('room-a'))).toBe(true)
    expect(loadRoomDiceDismissal('room-b')).toBeNull()
    saveRoomDiceDismissal('room-a', null)
    expect(roomDiceDismissed([roll('a')], loadRoomDiceDismissal('room-a'))).toBe(false)
  })
})
