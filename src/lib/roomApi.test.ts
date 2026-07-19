import { describe, expect, it } from 'vitest'
import { normalizeRoomRosterPayload, onlineRoomRoster, RoomApiError, roomHeartbeatErrorIsTerminal } from './roomApi'

describe('room heartbeat recovery policy', () => {
  it('keeps the session during a temporary host-offline window', () => {
    expect(roomHeartbeatErrorIsTerminal(new RoomApiError('room-offline', 409))).toBe(false)
    expect(roomHeartbeatErrorIsTerminal(new RoomApiError('request-failed', 503))).toBe(false)
  })

  it('clears sessions that cannot be resumed with the current membership', () => {
    expect(roomHeartbeatErrorIsTerminal(new RoomApiError('room-closed', 409))).toBe(true)
    expect(roomHeartbeatErrorIsTerminal(new RoomApiError('room-not-found', 404))).toBe(true)
    expect(roomHeartbeatErrorIsTerminal(new RoomApiError('member-not-found', 404))).toBe(true)
  })
})

describe('room roster payload migration', () => {
  it('only exposes currently online players to DM consumers', () => {
    const roster = normalizeRoomRosterPayload({
      roomId: '4Y3ZTK',
      players: [
        { memberId: 'online-member', displayName: '在线玩家', slot: 'player1', online: true },
        { memberId: 'offline-member', displayName: '历史玩家', slot: 'player2', online: false },
      ],
    }, '4Y3ZTK')
    expect(onlineRoomRoster(roster).players.map((player) => player.memberId)).toEqual(['online-member'])
  })

  it('fills plugin-readiness fields omitted by a pre-plugin room server', () => {
    expect(normalizeRoomRosterPayload({
      roomId: '4Y3ZTK',
      players: [{
        memberId: 'player-1',
        displayName: '旧房间玩家',
        slot: 'player1',
        joinedAt: 100,
        lastSeenAt: 200,
        online: true,
      }],
    }, '4Y3ZTK')).toEqual({
      roomId: '4Y3ZTK',
      locked: false,
      passwordRequired: false,
      maxPlayers: 3,
      players: [{
        memberId: 'player-1',
        displayName: '旧房间玩家',
        slot: 'player1',
        joinedAt: 100,
        lastSeenAt: 200,
        online: true,
        status: 'online',
        activeCharacterId: null,
        activeCharacterName: null,
        ready: true,
        missing: [],
        mismatched: [],
      }],
    })
  })

  it('drops malformed members and preserves valid readiness issues', () => {
    const result = normalizeRoomRosterPayload({
      players: [
        null,
        { memberId: 'bad', displayName: '无席位' },
        {
          memberId: 'player-2', displayName: '插件未就绪', slot: 'player2', ready: false,
          missing: [{ id: 'com.example.rules', version: '1.0.0', integrity: 'sha256-test' }],
          mismatched: [{}],
        },
      ],
    }, 'ROOM01')
    expect(result.roomId).toBe('ROOM01')
    expect(result.players).toHaveLength(1)
    expect(result.players[0]).toMatchObject({
      memberId: 'player-2', ready: false, mismatched: [],
      missing: [{ id: 'com.example.rules', version: '1.0.0', integrity: 'sha256-test' }],
    })
  })
})
