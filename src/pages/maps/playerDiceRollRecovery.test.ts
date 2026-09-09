import { afterEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ roomId: 'room-a', memberId: 'player-a' }))
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session }))

describe('player roll refresh recovery', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('restores the same value after reload, separates members, and removes submitted work', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } })
    session.memberId = 'player-a'
    const before = await import('./playerDiceRoll')
    const event = {
      eventId: 'event', requestId: 'roll', mapId: 'map', sourceMode: 'dm' as const,
      kind: 'd20' as const, count: 1, sides: 20, values: [], label: '敏捷豁免',
      targetName: '法师', targetCharacterId: 'wizard',
      delivery: 'player-roll-request' as const, updatedAt: 1_000,
    }
    before.rememberPendingPlayerDiceRollRequest(event)
    before.savePlayerDiceRollValue(event, 17)
    const { readDiceTrayHistory } = await import('../../presentation/maps/diceTrayHistory')
    expect(readDiceTrayHistory('room-a:player-a:player:map')?.record.values).toEqual([17])
    vi.resetModules()
    const after = await import('./playerDiceRoll')
    expect(after.pendingPlayerDiceRollRequests(1_001)).toEqual([event])
    expect(after.savedPlayerDiceRollValue('roll')).toBe(17)
    after.savePlayerDiceRollValue(event, 2)
    expect(after.savedPlayerDiceRollValue('roll')).toBe(17)
    session.memberId = 'player-b'
    expect(after.pendingPlayerDiceRollRequests(1_001)).toEqual([])
    expect(after.savedPlayerDiceRollValue('roll')).toBeUndefined()
    session.memberId = 'player-a'
    after.forgetPendingPlayerDiceRollRequest('roll')
    // Successful submission removes pending work, not the last visible dice.
    expect(readDiceTrayHistory('room-a:player-a:player:map')?.record.values).toEqual([17])
    vi.resetModules()
    expect((await import('./playerDiceRoll')).pendingPlayerDiceRollRequests(1_002)).toEqual([])
  })
})
