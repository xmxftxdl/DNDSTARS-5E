import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ROOM_CLIENT_ID_STORAGE_KEY,
  ROOM_PLAYER_RESUME_STORAGE_KEY,
  ROOM_SESSION_STORAGE_KEY,
  clearRoomSession,
  getRecentRoomPlayerResumeIdentity,
  getRoomPlayerResumeIdentity,
  getRoomSession,
  saveRoomSession,
  type RoomSession,
} from './roomSession'

function localStorageDouble() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('room player resume identity', () => {
  it('survives clearing the active session so the same room member can be restored', () => {
    const localStorage = localStorageDouble()
    localStorage.setItem(ROOM_CLIENT_ID_STORAGE_KEY, 'stable-browser-client')
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
    const session: RoomSession = {
      roomId: 'ABC234', roomName: '测试房间', rulesetId: 'dnd5e-2014-srd-5.1',
      memberId: 'member-stable-123', roomToken: 'room-token-abcdefghijklmnopqrstuvwxyz-1234567890', clientId: 'stable-browser-client', role: 'player',
      slot: 'player1', displayName: '玩家甲', createdAt: 1,
    }

    saveRoomSession(session)
    expect(localStorage.getItem(ROOM_SESSION_STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(ROOM_PLAYER_RESUME_STORAGE_KEY)).not.toBeNull()
    clearRoomSession()

    expect(localStorage.getItem(ROOM_SESSION_STORAGE_KEY)).toBeNull()
    expect(getRoomPlayerResumeIdentity('abc234')).toMatchObject({
      roomId: 'ABC234', memberId: 'member-stable-123', clientId: 'stable-browser-client',
    })
    expect(getRecentRoomPlayerResumeIdentity()).toMatchObject({ roomId: 'ABC234', displayName: '玩家甲' })
  })

  it('does not reuse a saved member identity after the browser client identity changes', () => {
    const localStorage = localStorageDouble()
    localStorage.setItem(ROOM_CLIENT_ID_STORAGE_KEY, 'new-browser-client')
    localStorage.setItem(ROOM_PLAYER_RESUME_STORAGE_KEY, JSON.stringify({
      ABC234: {
        roomId: 'ABC234', memberId: 'member-stable-123', clientId: 'old-browser-client',
        displayName: '玩家甲', updatedAt: 1,
      },
    }))
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
    expect(getRoomPlayerResumeIdentity('ABC234')).toBeNull()
  })

  it('rejects a legacy active session without an unforgeable room token', () => {
    const localStorage = localStorageDouble()
    localStorage.setItem(ROOM_CLIENT_ID_STORAGE_KEY, 'existing-browser-client')
    localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify({
      roomId: 'ABC234', roomName: '已有房间', rulesetId: 'dnd5e-2014-srd-5.1',
      memberId: 'existing-member-123', clientId: 'existing-browser-client', role: 'player',
      slot: 'player1', displayName: '已有玩家', createdAt: 1,
    }))
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })

    expect(getRoomSession()).toBeNull()
    expect(getRoomPlayerResumeIdentity('ABC234')).toBeNull()
  })

  it('persists a spectator identity without assigning a player slot', () => {
    const localStorage = localStorageDouble()
    localStorage.setItem(ROOM_CLIENT_ID_STORAGE_KEY, 'spectator-browser-client')
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
    saveRoomSession({
      roomId: 'ABC234', roomName: '观战房间', rulesetId: 'dnd5e-2014-srd-5.1',
      memberId: 'spectator-member-123', roomToken: 'room-token-abcdefghijklmnopqrstuvwxyz-1234567890', clientId: 'spectator-browser-client', role: 'spectator',
      displayName: '观战者', createdAt: 1,
    })
    expect(getRoomSession()).toMatchObject({ role: 'spectator' })
    expect(getRoomSession()?.slot).toBeUndefined()
    expect(getRoomPlayerResumeIdentity('ABC234')).toMatchObject({ memberId: 'spectator-member-123' })
  })
})
