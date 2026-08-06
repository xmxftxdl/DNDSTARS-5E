import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRoomVoiceStatus,
  normalizeRoomRosterPayload,
  onlineRoomRoster,
  requestRoomVoiceAccess,
  RoomApiError,
  roomHeartbeatErrorIsTerminal,
} from './roomApi'
import type { RoomSession } from './roomSession'

afterEach(() => {
  vi.unstubAllGlobals()
})

const voiceTestSession: RoomSession = {
  roomId: '4Y3ZTK',
  roomName: 'Voice test',
  rulesetId: 'dnd5e-2014-srd-5.1',
  memberId: 'member-voice-test',
  roomToken: 'x'.repeat(48),
  clientId: 'client-voice-test',
  role: 'dm',
  displayName: 'DM',
  createdAt: 1,
}

describe('room voice API routing', () => {
  it('does not duplicate the /api prefix for status and token requests', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input))
      return new Response(JSON.stringify({ schemaVersion: 1, enabled: false, provider: 'livekit' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await getRoomVoiceStatus(voiceTestSession)
    await requestRoomVoiceAccess(voiceTestSession)

    expect(requestedUrls).toEqual([
      'http://127.0.0.1:5273/api/rooms/4Y3ZTK/voice',
      'http://127.0.0.1:5273/api/rooms/4Y3ZTK/voice/token',
    ])
  })
})

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
        role: 'player',
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
        role: 'player',
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
