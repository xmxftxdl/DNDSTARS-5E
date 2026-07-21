/// <reference types="node" />
// 服务端硬化核心的纯函数单测。直接 import scripts/shared-server-core.mjs。
import { mkdtemp, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as sharedServerCore from '../../scripts/shared-server-core.mjs'
import {
  EVENT_BACKLOG_LIMIT,
  EVENT_CHANNEL_LIMIT,
  EVENT_REPLAY_LIMIT,
  CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH,
  IMAGE_COUNT_LIMIT,
  LockTimeoutError,
  ROOM_HOST_TTL_MS,
  ROOM_PLAYER_TTL_MS,
  assignRoomPlayer,
  capEventChannels,
  STATE_MAX_BYTES,
  SHARED_PROTOCOL_VERSION,
  atomicDeleteJsonStateCasLocked,
  atomicWriteImageLocked,
  atomicWriteJsonStateCasLocked,
  atomicWriteJsonStateFreshLocked,
  atomicWriteLocked,
  authorizeStateWrite,
  enforceImageQuota,
  extractSecret,
  migrateLegacyApCombatLogText,
  mergePlayerCharactersStateForAuthority,
  normalizeDedicatedDnd5eSharedState,
  normalizeLobbyRoomCode,
  normalizeAccountRecoveryCode,
  normalizeRoomPluginRequirements,
  mutateRoomChatState,
  mutateRoomJournalState,
  parseRoomChatRollCommand,
  projectRoomChatForMember,
  projectRoomJournalForMember,
  pushBacklog,
  replaySlice,
  safeName,
  roomPluginReadiness,
  roomPlayerPresence,
  withWriteLock,
  validateSharedStateShape,
} from '../../scripts/shared-server-core.mjs'

describe('room communications authority', () => {
  const host = { role: 'dm', memberId: 'dm-member', displayName: '主持人' }
  const player = {
    role: 'player', memberId: 'player-a', displayName: '玩家甲', activeCharacterId: 'hero-a',
  }
  const context = {
    host,
    playerMemberIds: ['player-a', 'player-b'],
    characters: { characters: [{ id: 'hero-a', roomMemberId: 'player-a', name: '艾琳', avatar: '🧝' }] },
    maps: { maps: [{ tokens: [{ id: 'npc-innkeeper', type: 'npc', label: '旅店老板', emoji: '🧔' }] }] },
    rollDie: () => 4,
  }

  it('parses bounded inline dice commands', () => {
    expect(parseRoomChatRollCommand('/roll 2d6+3 搜索暗门')).toEqual({
      expression: '2d6+3', count: 2, sides: 6, modifier: 3, label: '搜索暗门',
    })
    expect(parseRoomChatRollCommand('/roll 101d6')).toBeNull()
    expect(parseRoomChatRollCommand('/roll 1d1')).toBeNull()
  })

  it('stamps player identity and resolves dice on the server', () => {
    const result = mutateRoomChatState(null, { channel: 'ic', text: '/roll 2d6+3 搜索暗门' }, 1_000, player, context)
    expect(result).toMatchObject({
      ok: true,
      message: {
        senderMemberId: 'player-a',
        senderRole: 'player',
        persona: { kind: 'character', name: '艾琳', avatar: '🧝' },
        roll: { values: [4, 4], total: 11 },
      },
    })
  })

  it('validates an NPC persona against the DM map snapshot', () => {
    expect(mutateRoomChatState(null, {
      channel: 'ic', text: '欢迎光临。', npcTokenId: 'npc-innkeeper',
    }, 1_000, host, context)).toMatchObject({
      ok: true,
      message: { persona: { kind: 'npc', name: '旅店老板', avatar: '🧔' } },
    })
    expect(mutateRoomChatState(null, {
      channel: 'ic', text: '伪造身份', npcTokenId: 'missing',
    }, 1_000, host, context)).toMatchObject({ ok: false, error: 'invalid-npc-persona' })
  })

  it('projects private notes only to the related player and DM', () => {
    const first = mutateRoomChatState(null, { channel: 'dm-private', text: '我检查口袋。' }, 1_000, player, context)
    if (!first.ok) throw new Error('expected chat mutation')
    expect(projectRoomChatForMember(first.next, 'player-a', false).messages).toHaveLength(1)
    expect(projectRoomChatForMember(first.next, 'player-b', false).messages).toHaveLength(0)
    expect(projectRoomChatForMember(first.next, 'dm-member', true).messages).toHaveLength(1)
  })

  it('keeps targeted handouts hidden while shared notes remain collaborative', () => {
    const handout = mutateRoomJournalState(null, {
      operation: 'add-handout', title: '密信', body: '只给甲', audience: ['player-a'],
    }, 2_000, host, context)
    if (!handout.ok) throw new Error('expected journal mutation')
    expect(projectRoomJournalForMember(handout.next, 'player-a', false).handouts).toHaveLength(1)
    expect(projectRoomJournalForMember(handout.next, 'player-b', false).handouts).toHaveLength(0)
    const note = mutateRoomJournalState(handout.next, {
      operation: 'add-shared-note', kind: 'task', title: '寻找钥匙', body: '',
    }, 2_100, player, context)
    expect(note).toMatchObject({ ok: true, next: { sharedNotes: [{ authorMemberId: 'player-a' }] } })
  })
})

describe('room lobby allocation', () => {
  const now = 1_000_000
  const baseRoom = () => ({
    id: 'ABC234',
    name: '测试战役',
    rulesetId: 'dnd5e-2014-srd-5.1',
    createdAt: now,
    host: { memberId: 'dm-member', clientId: 'dm-client', displayName: 'DM', lastSeenAt: now },
    players: [],
  })

  it('allows enough presence grace for background-tab timer throttling', () => {
    expect(ROOM_HOST_TTL_MS).toBeGreaterThanOrEqual(120_000)
    expect(ROOM_PLAYER_TTL_MS).toBeGreaterThanOrEqual(ROOM_HOST_TTL_MS * 2)
  })

  it('normalizes shareable six-character room codes', () => {
    expect(normalizeLobbyRoomCode(' ab-i0c234 ')).toBe('ABC234')
    expect(normalizeLobbyRoomCode('abc234')).toBe('ABC234')
  })

  it('pins room plugins by unique ID, version and SHA-256', () => {
    const requirement = {
      id: 'com.example.rules',
      version: '1.0.0',
      integrity: 'sha256-YWJjZA==',
      stateSchemaVersion: 1,
    }
    expect(normalizeRoomPluginRequirements([requirement])).toEqual([requirement])
    expect(normalizeRoomPluginRequirements([{ ...requirement }, { ...requirement }])).toBeNull()
    expect(normalizeRoomPluginRequirements([{ ...requirement, integrity: 'latest' }])).toBeNull()
    expect(roomPluginReadiness([requirement], [])).toMatchObject({ ready: false, missing: [requirement] })
    expect(roomPluginReadiness([requirement], [requirement])).toEqual({ ready: true, missing: [], mismatched: [] })
    expect(roomPluginReadiness([requirement], [{ ...requirement, version: '2.0.0' }]))
      .toMatchObject({ ready: false, mismatched: [requirement] })
  })

  it('assigns the first free player slot and resumes the same browser', () => {
    const first = assignRoomPlayer(baseRoom(), {
      memberId: 'member-1',
      clientId: 'client-1',
      displayName: '玩家甲',
    }, now)
    expect(first).toMatchObject({ ok: true, member: { slot: 'player1' } })
    if (!first.ok) throw new Error('expected first allocation')
    const resumed = assignRoomPlayer(first.next, {
      memberId: 'should-not-replace',
      clientId: 'client-1',
      displayName: '玩家甲（重连）',
    }, now + 1_000)
    expect(resumed).toMatchObject({
      ok: true,
      member: { memberId: 'member-1', slot: 'player1', displayName: '玩家甲（重连）' },
    })
  })

  it('resumes the same account from a different browser without changing member ownership', () => {
    const first = assignRoomPlayer(baseRoom(), {
      memberId: 'account-member', accountId: 'ABC234DEF567',
      clientId: 'device-one', displayName: '账号玩家',
    }, now)
    if (!first.ok) throw new Error('expected account allocation')
    const resumed = assignRoomPlayer(first.next, {
      memberId: 'new-random-member', accountId: 'ABC234DEF567',
      clientId: 'device-two', displayName: '账号玩家',
    }, now + 1_000)
    expect(resumed).toMatchObject({
      ok: true,
      member: { memberId: 'account-member', accountId: 'ABC234DEF567', clientId: 'device-two' },
    })
  })

  it('distinguishes temporary disconnection, explicit leave and removal', () => {
    const player = { lastSeenAt: now }
    expect(roomPlayerPresence(player, now)).toBe('online')
    expect(roomPlayerPresence(player, now + 30_000)).toBe('temporarily-offline')
    expect(roomPlayerPresence({ ...player, leftAt: now + 1 }, now + 2)).toBe('left')
    expect(roomPlayerPresence({ ...player, removedAt: now + 1 }, now + 2)).toBe('removed')
  })

  it('normalizes readable account recovery codes without exposing ambiguity characters', () => {
    expect(normalizeAccountRecoveryCode('DS5E-ABC234DEF567-ABCDE-FGHJK-LMNPQ-RSTUV')).toMatchObject({
      accountId: 'ABC234DEF567', secret: 'ABCDEFGHJKLMNPQRSTUV',
    })
    expect(normalizeAccountRecoveryCode('not-a-code')).toBeNull()
  })

  it('rejects joining when the creator heartbeat has expired', () => {
    const room = baseRoom()
    room.host.lastSeenAt = now - ROOM_HOST_TTL_MS - 1
    expect(assignRoomPlayer(room, {
      memberId: 'member-1',
      clientId: 'client-1',
      displayName: '玩家甲',
    }, now)).toMatchObject({ ok: false, error: 'room-offline' })
  })

  it('keeps a background-throttled creator joinable during the heartbeat grace window', () => {
    const room = baseRoom()
    room.host.lastSeenAt = now - ROOM_HOST_TTL_MS + 1
    expect(assignRoomPlayer(room, {
      memberId: 'member-1',
      clientId: 'client-1',
      displayName: '玩家甲',
    }, now)).toMatchObject({ ok: true, member: { slot: 'player1' } })
  })

  it('reclaims a stale player slot before allocation', () => {
    const room = {
      ...baseRoom(),
      players: [{
        memberId: 'stale-member',
        clientId: 'stale-client',
        displayName: '离线玩家',
        slot: 'player1',
        joinedAt: now - ROOM_PLAYER_TTL_MS - 10,
        lastSeenAt: now - ROOM_PLAYER_TTL_MS - 1,
      }],
    }
    const allocated = assignRoomPlayer(room, {
      memberId: 'new-member',
      clientId: 'new-client',
      displayName: '新玩家',
    }, now)
    expect(allocated).toMatchObject({ ok: true, member: { memberId: 'new-member', slot: 'player1' } })
    if (!allocated.ok) throw new Error('expected reclaimed slot allocation')
    expect((allocated.next.players as Array<{ memberId: string }>).map((player) => player.memberId))
      .toEqual(['stale-member', 'new-member'])

    const resumed = assignRoomPlayer(allocated.next, {
      memberId: 'stale-member',
      clientId: 'stale-client',
      displayName: '离线玩家（重连）',
    }, now + 1)
    expect(resumed).toMatchObject({
      ok: true,
      member: { memberId: 'stale-member', slot: 'player2', displayName: '离线玩家（重连）' },
    })
  })

  it('lets an explicitly locked room restore a known browser without opening a new seat', () => {
    const room = {
      ...baseRoom(),
      locked: true,
      players: [{
        memberId: 'known-member', clientId: 'known-client', displayName: '原玩家',
        slot: 'player1', joinedAt: now - 1_000, lastSeenAt: now - 1_000,
      }],
    }
    expect(assignRoomPlayer(room, {
      memberId: 'known-member', clientId: 'known-client', displayName: '原玩家',
    }, now)).toMatchObject({ ok: true, member: { memberId: 'known-member', slot: 'player1' } })
    expect(assignRoomPlayer(room, {
      memberId: 'new-member', clientId: 'new-client', displayName: '陌生玩家',
    }, now)).toMatchObject({ ok: false, error: 'room-locked' })
  })
})

describe('map geometry player projection', () => {
  const common = {
    label: '阻挡物', blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
  }
  const geometry = {
    schemaVersion: 1,
    updatedAt: 1,
    maps: [{
      mapId: 'map-1',
      walls: [{ ...common, id: 'wall-1', kind: 'wall', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] }],
      doors: [{
        ...common, id: 'secret-door', kind: 'door',
        points: [{ x: 20, y: 60 }, { x: 30, y: 60 }], state: 'locked', secret: true,
      }],
      windows: [] as Array<Record<string, unknown>>,
      obstacles: [],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: false },
      updatedAt: 1,
    }],
  }

  it('removes hidden and DM-only tokens before serializing a player response', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'near', type: 'enemy', x: 30, y: 20 },
          { id: 'hidden', type: 'enemy', x: 90, y: 20 },
          { id: 'dm-only', type: 'enemy', visibilityMode: 'dm-only', x: 30, y: 30 },
          { id: 'always', type: 'npc', visibilityMode: 'always', x: 90, y: 30 },
        ],
        dnd5ePluginAreas: [
          { id: 'shown-area', sourceTokenId: 'near' },
          { id: 'hidden-area', sourceTokenId: 'hidden' },
        ],
      }],
    }, geometry, 'character-1')
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'near', 'always'])
    expect(projected.maps[0].dnd5ePluginAreas.map((area: { id: string }) => area.id))
      .toEqual(['shown-area'])
  })

  it('recovers the player viewer from room ownership before presence catches up', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'near', type: 'enemy', x: 30, y: 20 },
          { id: 'hidden', type: 'enemy', x: 90, y: 20 },
        ],
      }],
    }, geometry, null, {
      characters: [{ id: 'character-1', roomMemberId: 'member-1', passivePerception: 10 }],
    }, { memberId: 'member-1' })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'near'])
  })

  it('uses a 30-foot player view when filled fog is active without any geometry state', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 200, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'inside-30', type: 'enemy', x: 60, y: 20 },
          { id: 'outside-30', type: 'enemy', x: 80, y: 20 },
        ],
      }],
    }, null, 'character-1', null, null, {
      maps: [{ mapId: 'map-1', filled: true, shapes: [] }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'inside-30'])
  })

  it('respects the configured default vision range for filled fog without dynamic vision', () => {
    const disabledGeometry = {
      ...geometry,
      maps: geometry.maps.map((map) => ({ ...map, walls: [], vision: { ...map.vision, enabled: false } })),
    }
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 200, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'at-35-feet', type: 'enemy', x: 80, y: 20 },
          { id: 'at-70-feet', type: 'enemy', x: 150, y: 20 },
        ],
      }],
    }, disabledGeometry, 'character-1', null, null, {
      maps: [{ mapId: 'map-1', filled: true, shapes: [] }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'at-35-feet'])
  })

  it('applies scene lights in dynamic darkness but ignores ambient lighting when only manual fog is enabled', () => {
    const darkGeometry = {
      ...geometry,
      maps: geometry.maps.map((entry) => ({
        ...entry,
        walls: [],
        lights: [{
          id: 'lamp', kind: 'light', label: 'Lamp', points: [{ x: 80, y: 20 }], enabled: true,
          brightRadiusFeet: 5, dimRadiusFeet: 5, color: '#ffffff', elevationFeet: 5, createdAt: 1,
        }],
        vision: { ...entry.vision, enabled: true, ambientLight: 'darkness', defaultRangeFeet: 60 },
      })),
    }
    const maps = {
      maps: [{
        id: 'map-1', width: 200, height: 120, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'lit', type: 'enemy', x: 80, y: 20 },
          { id: 'unlit', type: 'enemy', x: 80, y: 80 },
        ],
      }],
    }
    expect(sharedServerCore.projectMapsForPlayer(maps, darkGeometry, 'character-1')
      .maps[0].tokens.map((token: { id: string }) => token.id)).toEqual(['hero', 'lit'])

    const disabledGeometry = {
      ...darkGeometry,
      maps: darkGeometry.maps.map((entry) => ({ ...entry, vision: { ...entry.vision, enabled: false } })),
    }
    expect(sharedServerCore.projectMapsForPlayer(maps, disabledGeometry, 'character-1', null, null, {
      maps: [{ mapId: 'map-1', filled: true, shapes: [] }],
    }).maps[0].tokens.map((token: { id: string }) => token.id)).toEqual(['hero', 'lit', 'unlit'])
  })

  it('hides tokens under cover shapes even when the fog is not filled', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 400, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'in-open', type: 'enemy', x: 390, y: 20 },
          { id: 'under-cover', type: 'enemy', x: 250, y: 20 },
        ],
      }],
    }, null, 'character-1', null, null, {
      maps: [{
        mapId: 'map-1', filled: false,
        shapes: [{ id: 'cover', kind: 'rect', operation: 'cover', x: 200, y: 0, width: 100, height: 100, createdAt: 1 }],
      }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'in-open'])
  })

  it('shows tokens inside revealed fog areas regardless of vision distance', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 400, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'revealed-far', type: 'enemy', x: 350, y: 20 },
          { id: 'still-fogged', type: 'enemy', x: 150, y: 20 },
        ],
      }],
    }, null, 'character-1', null, null, {
      maps: [{
        mapId: 'map-1', filled: true,
        shapes: [{ id: 'reveal', kind: 'rect', operation: 'reveal', x: 300, y: 0, width: 100, height: 100, createdAt: 1 }],
      }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'revealed-far'])
  })

  it('lets a later cover shape re-hide a previously revealed area', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 400, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 're-hidden', type: 'enemy', x: 350, y: 20 },
        ],
      }],
    }, null, 'character-1', null, null, {
      maps: [{
        mapId: 'map-1', filled: true,
        shapes: [
          { id: 'reveal', kind: 'rect', operation: 'reveal', x: 300, y: 0, width: 100, height: 100, createdAt: 1 },
          { id: 'cover-again', kind: 'rect', operation: 'cover', x: 300, y: 0, width: 100, height: 100, createdAt: 2 },
        ],
      }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero'])
  })

  it('shows revealed fog areas even when dynamic vision is enabled', () => {
    const wallless = {
      ...geometry,
      maps: geometry.maps.map((map) => ({ ...map, walls: [], vision: { ...map.vision, sharePartyVision: true } })),
    }
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 400, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'revealed-far', type: 'enemy', x: 350, y: 20 },
          { id: 'unseen-far', type: 'enemy', x: 200, y: 80 },
        ],
      }],
    }, wallless, 'character-1', null, null, {
      maps: [{
        mapId: 'map-1', filled: false,
        shapes: [{ id: 'reveal', kind: 'rect', operation: 'reveal', x: 300, y: 0, width: 100, height: 100, createdAt: 1 }],
      }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'revealed-far'])
  })

  it('uses passive Perception to omit hidden tokens from the serialized player response', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'unnoticed', type: 'enemy', label: '刺客', poolId: 'assassin', x: 30, y: 20, dnd5eCombatState: { hiddenCheckTotal: 18 } },
          { id: 'noticed', type: 'enemy', label: '地精', poolId: 'goblin', x: 35, y: 20, dnd5eCombatState: { hiddenCheckTotal: 14 } },
        ],
      }],
    }, geometry, 'character-1', {
      characters: [{ id: 'character-1', passivePerception: 15 }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'noticed'])
    expect(JSON.stringify(projected)).not.toContain('assassin')
  })

  it('recomputes passive Perception from current abilities and proficiency instead of stale cache data', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          { id: 'hidden', type: 'enemy', label: '潜伏者', x: 30, y: 20, dnd5eCombatState: { hiddenCheckTotal: 16 } },
        ],
      }],
    }, geometry, 'character-1', {
      characters: [{
        id: 'character-1', level: 5, charClass: '游侠', abilities: { wis: 18 },
        skills: ['perception'], passivePerception: 10,
      }],
    })
    expect(projected.maps[0].tokens.map((token: { id: string }) => token.id))
      .toEqual(['hero', 'hidden'])
  })

  it('serializes a detected but unseen creature as an anonymous position marker', () => {
    const projected = sharedServerCore.projectMapsForPlayer({
      maps: [{
        id: 'map-1', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'character-1', x: 10, y: 20 },
          {
            id: 'invisible-enemy', type: 'enemy', label: '隐形法师', poolId: 'mage', hp: 40, maxHp: 40,
            x: 30, y: 20, dnd5eCombatState: { conditions: ['invisible'] },
          },
        ],
      }],
    }, geometry, 'character-1', {
      characters: [{ id: 'character-1', passivePerception: 10 }],
    })
    expect(projected.maps[0].tokens[1]).toMatchObject({
      id: 'invisible-enemy', label: '未见生物', emoji: '◇', perceptionVisibility: 'detected-unseen',
      showHpOnToken: false, showDetailOnToken: false,
    })
    const serialized = JSON.stringify(projected.maps[0].tokens[1])
    expect(serialized).not.toContain('隐形法师')
    expect(serialized).not.toContain('mage')
    expect(serialized).not.toContain('40')
    expect(serialized).not.toContain('dnd5eCombatState')
  })

  it('redacts closed secret doors as anonymous walls', () => {
    const projected = sharedServerCore.projectMapGeometryForPlayer(geometry)
    expect(projected.maps[0].doors).toEqual([])
    expect(projected.maps[0].walls).toContainEqual(expect.objectContaining({ kind: 'wall' }))
    expect(JSON.stringify(projected)).not.toContain('secret-door')
  })

  it('projects an opened hidden door as an anonymous non-interactive wall opening', () => {
    const opened = structuredClone(geometry)
    Object.assign(opened.maps[0].doors[0], {
      state: 'open',
      parentWallId: 'wall-1',
      parentWallSegmentIndex: 0,
      points: [{ x: 50, y: 20 }, { x: 50, y: 40 }],
    })
    const projected = sharedServerCore.projectMapGeometryForPlayer(opened)
    expect(projected.maps[0].doors).toEqual([])
    expect(projected.maps[0].windows).toContainEqual(expect.objectContaining({
      kind: 'window', windowType: 'opening', blocksMovement: false,
    }))
    expect(JSON.stringify(projected)).not.toContain('secret-door')
  })

  it('projects a discovered secret door only to the authorized room member', () => {
    const discovered = structuredClone(geometry)
    Object.assign(discovered.maps[0].doors[0], { revealedToMemberIds: ['member-a'] })
    const visible = sharedServerCore.projectMapGeometryForPlayer(discovered, 'member-a')
    const hidden = sharedServerCore.projectMapGeometryForPlayer(discovered, 'member-b')
    expect(visible.maps[0].doors.map((door) => door.id)).toEqual(['secret-door'])
    expect(hidden.maps[0].doors).toEqual([])
    expect(JSON.stringify(hidden)).not.toContain('secret-door')
  })

  it('projects exploration memory only to the requesting room member', () => {
    const exploration = {
      schemaVersion: 1,
      maps: [{
        mapId: 'map-1',
        byMemberId: {
          alice: { polygons: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]], updatedAt: 1 },
          bob: { polygons: [[{ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 100, y: 110 }]], updatedAt: 1 },
        },
        updatedAt: 1,
      }],
      updatedAt: 1,
    }
    const projected = sharedServerCore.projectMapExplorationForPlayer(exploration, 'alice')
    expect(Object.keys(projected.maps[0].byMemberId)).toEqual(['alice'])
    expect(JSON.stringify(projected)).not.toContain('bob')
    expect(sharedServerCore.validateSharedStateShape('map-exploration', exploration)).toEqual({ ok: true })
  })

  it('fails closed on malformed geometry resources', () => {
    expect(validateSharedStateShape('map-geometry', geometry)).toEqual({ ok: true })
    expect(validateSharedStateShape('map-geometry', {
      ...geometry,
      maps: [{
        ...geometry.maps[0],
        windows: [{
          ...common, id: 'window', kind: 'window', windowType: 'glass',
          parentWallId: 'wall-1', parentWallSegmentIndex: 0,
          points: [{ x: 50, y: 20 }, { x: 50, y: 40 }],
        }],
      }],
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('map-geometry', {
      ...geometry,
      maps: [{ ...geometry.maps[0], vision: { enabled: true } }],
    })).toMatchObject({ ok: false, reason: 'invalid-map-geometry' })
    expect(validateSharedStateShape('map-geometry', {
      ...geometry,
      maps: [{ ...geometry.maps[0], windows: [{ ...common, id: 'window', kind: 'window', points: [] }] }],
    })).toMatchObject({ ok: false, reason: 'invalid-map-geometry' })
    const v2 = {
      ...geometry,
      schemaVersion: 2,
      maps: [{ ...geometry.maps[0], lights: [] }],
    }
    expect(validateSharedStateShape('map-geometry', v2)).toEqual({ ok: true })
    expect(validateSharedStateShape('map-geometry', {
      ...v2,
      maps: [{ ...v2.maps[0], lights: undefined }],
    })).toMatchObject({ ok: false, reason: 'invalid-map-geometry' })
    expect(validateSharedStateShape('map-geometry', {
      ...v2,
      maps: [{ ...v2.maps[0], windows: [{
        ...common, id: 'window-v2', kind: 'window', windowType: 'glass', windowState: 'teleported',
        points: [{ x: 50, y: 20 }, { x: 50, y: 40 }],
      }] }],
    })).toMatchObject({ ok: false, reason: 'invalid-map-geometry' })
  })
})

describe('dedicated 5e shared-state migration', () => {
  it('removes AP wording from persisted combat logs at the server boundary', () => {
    expect(migrateLegacyApCombatLogText('新冒险者 花费 1 AP：移动（10 尺）。剩余 AP 1/2'))
      .toBe('新冒险者 移动（10 尺）。')
    expect(normalizeDedicatedDnd5eSharedState('combat-log', {
      mapId: 'map',
      entries: [{ id: 1, text: '战士 移动 10 尺，AP 1/2' }],
    })).toMatchObject({ entries: [{ text: '战士 移动 10 尺' }] })
  })

  it('removes the retired enemy AP ledger from shared combat snapshots', () => {
    expect(normalizeDedicatedDnd5eSharedState('combat', {
      active: true,
      enemyApByToken: { goblin: { current: 1, max: 2 } },
      dnd5eTurnEconomyByToken: {},
    })).toEqual({ active: true, dnd5eTurnEconomyByToken: {} })
  })
})

describe('P0 shared state boundary', () => {
  it('publishes a positive protocol version', () => {
    expect(SHARED_PROTOCOL_VERSION).toBeGreaterThanOrEqual(2)
  })

  it('rejects damaged known envelopes and accepts object plugin state', () => {
    expect(validateSharedStateShape('characters', { characters: [] })).toMatchObject({ ok: true })
    expect(validateSharedStateShape('spellbook', { spells: [] })).toMatchObject({ ok: true })
    expect(validateSharedStateShape('custom-monsters', { schemaVersion: 1, monsters: [] })).toMatchObject({ ok: true })
    expect(validateSharedStateShape('spellbook', { spells: 'broken' })).toMatchObject({ ok: false })
    expect(validateSharedStateShape('custom-monsters', { monsters: 'broken' })).toMatchObject({ ok: false })
    expect(validateSharedStateShape('custom-monsters', { schemaVersion: 1, monsters: [{ id: 'forged' }] })).toMatchObject({
      ok: false,
      reason: 'invalid-custom-monster',
    })
    expect(validateSharedStateShape('characters', { characters: 'broken' })).toMatchObject({ ok: false })
    expect(validateSharedStateShape('maps', [])).toMatchObject({ ok: false })
    expect(validateSharedStateShape('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'hero', movementAnimation: {
        id: 'bad', points: [{ x: 0, y: 0 }], durationMs: 50_000, issuedAt: 1,
      } }] }],
    })).toMatchObject({ ok: false, reason: 'invalid-token-movement-animation' })
    expect(validateSharedStateShape('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'hero', movementAnimation: {
        id: 'move', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], durationMs: 500, issuedAt: 1,
      } }] }],
    })).toMatchObject({ ok: true })
    expect(validateSharedStateShape('plugin-owned-state', { payload: {} })).toMatchObject({ ok: true })
  })

  it('fails closed for damaged combat statistics', () => {
    const combatant = {
      combatantId: 'fighter', name: '战士', side: 'player',
      damageDealt: 10, damageTaken: 2, healingDone: 0, healingReceived: 0,
      temporaryHpGranted: 0, damagePrevented: 0, hostileConditionsApplied: 0,
      attacks: 1, hits: 1, criticalHits: 0, knockouts: 0, kills: 0, alliesRescued: 0,
      successfulSaves: 0, failedSaves: 0, concentrationChecks: 0, concentrationMaintained: 0,
      actionsSpent: 1, bonusActionsSpent: 0, reactionsSpent: 0, movementSpentFeet: 10,
      classResourcesSpent: 0, spellSlotsSpent: 0,
    }
    const state = {
      schemaVersion: 1,
      sessions: [{
        combatId: 'combat', mapId: 'map', startedAt: 1, updatedAt: 2, lastRound: 1,
        combatants: { fighter: combatant }, receipts: ['receipt'],
      }],
      updatedAt: 2,
    }
    expect(validateSharedStateShape('combat-statistics', state)).toEqual({ ok: true })
    const experienceSettlement = {
      combatId: 'combat', mapId: 'map', mode: 'even', totalXp: 50, awardedXp: 50, settledAt: 3,
      defeatedMonsters: [{ tokenId: 'goblin', name: '哥布林', monsterId: 'srd-5.1:goblin', challengeRating: '1/4', xp: 50 }],
      awards: [{ characterId: 'fighter', characterName: '战士', xp: 50 }],
    }
    expect(validateSharedStateShape('combat-statistics', {
      ...state,
      schemaVersion: 2,
      sessions: [{ ...state.sessions[0], experienceSettlement }],
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('combat-statistics', {
      ...state,
      schemaVersion: 2,
      sessions: [{ ...state.sessions[0], experienceSettlement: { ...experienceSettlement, awardedXp: 49 } }],
    })).toMatchObject({ ok: false, reason: 'invalid-combat-statistics' })
    expect(validateSharedStateShape('combat-statistics', {
      ...state,
      sessions: [{ ...state.sessions[0], combatants: { fighter: { ...combatant, damageDealt: -1 } } }],
    })).toMatchObject({ ok: false, reason: 'invalid-combat-statistics' })
  })

  it('rejects malformed or forged ActiveEffect schema v2 payloads at the server boundary', () => {
    const effect = {
      schemaVersion: 1,
      id: 'blind',
      definitionId: 'condition:blinded',
      label: '目盲',
      kind: 'condition',
      standardCondition: 'blinded',
      source: { kind: 'dm' },
      appliedAt: 1,
      duration: { type: 'permanent' },
      stackingKey: 'condition:blinded',
      stackingPolicy: 'refresh-duration',
    }
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', conditions: ['blinded'], dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] } }],
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', conditions: [], dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] } }],
    })).toMatchObject({ ok: false, reason: 'condition-projection-mismatch' })
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', conditions: ['blinded'], dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [{ ...effect, duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' } }],
      } }],
    })).toMatchObject({ ok: false, reason: 'invalid-active-effect' })
  })
})

describe('P1 shared resource compare-and-swap', () => {
  it('allows exactly one writer for an expected revision and records generic sync metadata', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'stars-cas-'))
    const file = path.join(dir, 'maps.json')
    try {
      const initial = await atomicWriteJsonStateCasLocked(file, { maps: [], updatedAt: 1 }, {
        expectedRevision: 0,
        writerId: 'dm-a',
      })
      expect(initial).toMatchObject({ ok: true, revision: 1 })
      const writes = await Promise.all([
        atomicWriteJsonStateCasLocked(file, { maps: [{ id: 'a' }], updatedAt: 2 }, { expectedRevision: 1, writerId: 'dm-a' }),
        atomicWriteJsonStateCasLocked(file, { maps: [{ id: 'b' }], updatedAt: 3 }, { expectedRevision: 1, writerId: 'player-b' }),
      ])
      expect(writes.filter((result) => result.ok)).toHaveLength(1)
      expect(writes.filter((result) => !result.ok)).toEqual([
        expect.objectContaining({ conflict: true, currentRevision: 2 }),
      ])
      const stored = JSON.parse(await readFile(file, 'utf8'))
      expect(stored._sync).toMatchObject({ schemaVersion: 1, revision: 2 })
      const deleted = await atomicDeleteJsonStateCasLocked(file, { expectedRevision: 2, writerId: 'dm-a' })
      expect(deleted).toMatchObject({ ok: true, revision: 3, value: { _deleted: true } })
      expect(await atomicWriteJsonStateCasLocked(file, { maps: [], updatedAt: 4 }, {
        expectedRevision: 2,
        writerId: 'stale-client',
      })).toMatchObject({ ok: false, conflict: true, currentRevision: 3 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

const securityHelpers = sharedServerCore as unknown as {
  authorizeAccessToken: (token: string | null) => { ok: boolean; role?: string; status?: number }
  consumeRateLimit: (
    buckets: Map<string, { startedAt: number; count: number }>,
    key: string,
    now?: number,
    limit?: number,
    windowMs?: number,
  ) => { ok: boolean; remaining?: number; retryAfterMs?: number }
  normalizeRoomId: (value?: string) => string
  roomScopedPath: (root: string, roomId: string) => string
}
const { authorizeAccessToken, consumeRateLimit, normalizeRoomId, roomScopedPath } = securityHelpers

describe('room isolation and access security', () => {
  const previousDmToken = process.env.STARS_DM_TOKEN
  const previousPlayerToken = process.env.STARS_PLAYER_TOKEN

  afterEach(() => {
    if (previousDmToken == null) delete process.env.STARS_DM_TOKEN
    else process.env.STARS_DM_TOKEN = previousDmToken
    if (previousPlayerToken == null) delete process.env.STARS_PLAYER_TOKEN
    else process.env.STARS_PLAYER_TOKEN = previousPlayerToken
  })

  it('keeps the default paths compatible and isolates named rooms', () => {
    expect(normalizeRoomId(undefined)).toBe('default')
    expect(roomScopedPath('C:/state', 'default')).toBe('C:/state')
    expect(roomScopedPath('C:/state', normalizeRoomId('table-a'))).toContain(path.join('rooms', 'table-a'))
    expect(normalizeRoomId('../table-a')).not.toContain('/')
  })

  it('enables role tokens only when configured', () => {
    delete process.env.STARS_DM_TOKEN
    delete process.env.STARS_PLAYER_TOKEN
    expect(authorizeAccessToken(null)).toMatchObject({ ok: true, role: 'open' })
    process.env.STARS_DM_TOKEN = 'dm-token'
    process.env.STARS_PLAYER_TOKEN = 'player-token'
    expect(authorizeAccessToken('dm-token')).toMatchObject({ ok: true, role: 'dm' })
    expect(authorizeAccessToken('player-token')).toMatchObject({ ok: true, role: 'player' })
    expect(authorizeAccessToken(null)).toMatchObject({ ok: false, status: 401 })
    expect(authorizeAccessToken('wrong')).toMatchObject({ ok: false, status: 403 })
  })

  it('limits each room and client bucket independently', () => {
    const buckets = new Map()
    expect(consumeRateLimit(buckets, 'room-a:client', 100, 2).ok).toBe(true)
    expect(consumeRateLimit(buckets, 'room-a:client', 101, 2).ok).toBe(true)
    expect(consumeRateLimit(buckets, 'room-a:client', 102, 2).ok).toBe(false)
    expect(consumeRateLimit(buckets, 'room-b:client', 102, 2).ok).toBe(true)
  })
})

const mutateCombatInterruptQueue = (
  sharedServerCore as unknown as {
    mutateCombatInterruptQueue: (queue: unknown, mutation: unknown, now?: number, authorityRole?: 'open' | 'dm' | 'player') => {
      ok: boolean
      status?: number
      error?: string
      changed?: boolean
      next: {
        revision: number
        interrupts: Array<{ id: string; status: string }>
      }
    }
  }
).mutateCombatInterruptQueue

describe('combat interrupt atomic mutation', () => {
  it('updates different interrupt ids without replacing the queue', () => {
    const queue = {
      mapId: 'map-1',
      revision: 2,
      updatedAt: 100,
      interrupts: [
        { id: 'a', mapId: 'map-1', kind: 'dodge', status: 'pending', payload: {}, createdAt: 1, updatedAt: 1 },
        { id: 'b', mapId: 'map-1', kind: 'stable-mind', status: 'pending', payload: {}, createdAt: 2, updatedAt: 2 },
      ],
    }
    const answered = mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'a', response: { wantsDodge: true },
    }, 200)
    expect(answered.ok).toBe(true)
    expect(answered.next.revision).toBe(3)
    expect(answered.next.interrupts.find((item: { id: string }) => item.id === 'a')?.status).toBe('answered')
    expect(answered.next.interrupts.find((item: { id: string }) => item.id === 'b')?.status).toBe('pending')
  })

  it('rejects a backwards state transition and keeps repeats idempotent', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{ id: 'a', mapId: 'map-1', kind: 'dodge', status: 'answered', payload: {}, createdAt: 1, updatedAt: 2 }],
    }
    expect(mutateCombatInterruptQueue(queue, { operation: 'rolling', mapId: 'map-1', id: 'a' }, 200)).toMatchObject({
      ok: false, status: 409,
    })
    expect(mutateCombatInterruptQueue(queue, { operation: 'answer', mapId: 'map-1', id: 'a' }, 200)).toMatchObject({
      ok: true, changed: false,
    })
  })

  it('atomically rejects a second active interrupt for the same Headless transaction', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{
        id: 'shield', transactionId: 'action-1', mapId: 'map-1', kind: 'shield-spell',
        status: 'pending', phase: 'before-hit', timeoutPolicy: 'rollback', payload: {}, createdAt: 1, updatedAt: 1,
      }],
    }
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'upsert', mapId: 'map-1', interrupt: {
        id: 'uncanny', transactionId: 'action-1', mapId: 'map-1', kind: 'uncanny-dodge',
        status: 'pending', phase: 'before-damage', timeoutPolicy: 'rollback', payload: {}, createdAt: 2, updatedAt: 2,
      },
    }, 200)).toMatchObject({ ok: false, status: 409, error: 'transaction-locked' })
  })

  it('rejects oversized inline portrait aggregates at the server boundary', () => {
    const portrait = `data:image/webp;base64,${'A'.repeat(580_000)}`
    expect(CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH).toBeLessThan(STATE_MAX_BYTES)
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', portrait }],
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('characters', {
      characters: Array.from({ length: 7 }, (_, index) => ({ id: `hero-${index}`, portrait })),
    })).toMatchObject({ ok: false, reason: 'character-portraits-too-large' })
  })

  it('rejects unbounded D&D 5e map lifecycles and labels at the server boundary', () => {
    const summon = {
      schemaVersion: 1, createdRound: 1, expiresAfterRound: 10, side: 'player',
    }
    expect(validateSharedStateShape('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'summon', dnd5eSummon: summon }] }],
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'summon', dnd5eSummon: { ...summon, expiresAfterRound: 14_401 } }] }],
    })).toMatchObject({ ok: false, reason: 'invalid-dnd5e-summon' })
    expect(validateSharedStateShape('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{
        label: 'x'.repeat(121), createdRound: 1, expiresAfterRound: 2,
      }] }],
    })).toMatchObject({ ok: false, reason: 'invalid-dnd5e-plugin-area' })
  })

  it('atomically appends player roll contributions while the DM confirmation is open', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{
        id: 'confirm', transactionId: 'roll-1', mapId: 'map-1', kind: 'roll-confirmation',
        status: 'pending', phase: 'after-roll', timeoutPolicy: 'wait-for-dm', payload: { originalValue: 7 }, createdAt: 1, updatedAt: 1,
      }],
    }
    const result = mutateCombatInterruptQueue(queue, {
      operation: 'contribute', mapId: 'map-1', id: 'confirm', contribution: {
        id: 'confirm:wizard', kind: 'replace-d20', characterId: 'wizard', characterName: '先知',
        featureLabel: '预兆', dieIndex: 0, replacementValue: 17, createdAt: 150,
      },
    }, 200)
    expect(result).toMatchObject({ ok: true, changed: true, next: { revision: 2 } })
    expect((result.next.interrupts[0] as { contributions?: unknown[] }).contributions).toEqual([
      expect.objectContaining({ characterId: 'wizard', replacementValue: 17 }),
    ])
    expect(mutateCombatInterruptQueue({
      ...result.next,
      interrupts: result.next.interrupts.map((entry) => ({ ...entry, status: 'done' })),
    }, {
      operation: 'contribute', mapId: 'map-1', id: 'confirm', contribution: {
        id: 'late', kind: 'replace-d20', characterId: 'rogue', characterName: '游荡者',
        featureLabel: '幸运', dieIndex: 0, replacementValue: 20, createdAt: 220,
      },
    }, 220)).toMatchObject({ ok: false, status: 409 })
  })

  it('accepts plugin and roll-confirmation Interrupt kinds at the shared boundary', () => {
    const interrupt = (kind: 'plugin-choice' | 'roll-confirmation') => ({
      id: kind, transactionId: kind, mapId: 'map-1', kind,
      status: 'pending', phase: kind === 'roll-confirmation' ? 'after-roll' : 'before-action',
      timeoutPolicy: kind === 'roll-confirmation' ? 'wait-for-dm' : 'rollback',
      payload: {}, createdAt: 1, updatedAt: 1,
    })
    expect(validateSharedStateShape('combat-interrupts', {
      mapId: 'map-1', interrupts: [interrupt('plugin-choice')], updatedAt: 1,
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('combat-interrupts', {
      mapId: 'map-1', interrupts: [interrupt('roll-confirmation')], updatedAt: 1,
    })).toEqual({ ok: true })
  })

  it('requires DM authority to settle a roll confirmation', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{
        id: 'confirm', transactionId: 'roll-1', mapId: 'map-1', kind: 'roll-confirmation',
        status: 'pending', phase: 'after-roll', timeoutPolicy: 'wait-for-dm', payload: { originalValue: 7 }, createdAt: 1, updatedAt: 1,
      }],
    }
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'confirm', response: { decision: 'continue', finalValue: 7 },
    }, 200, 'player')).toMatchObject({ ok: false, status: 403, error: 'dm-authority-required' })
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'confirm', response: { decision: 'continue', finalValue: 7 },
    }, 200, 'dm')).toMatchObject({ ok: true, changed: true })
  })

  it('accepts only the original d20 or a contribution that exists in the open window', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{
        id: 'confirm', transactionId: 'roll-1', mapId: 'map-1', kind: 'roll-confirmation', status: 'pending',
        phase: 'after-roll', timeoutPolicy: 'wait-for-dm', payload: { originalValue: 4 }, createdAt: 1, updatedAt: 1,
        contributions: [{
          id: 'confirm:wizard', kind: 'replace-d20', characterId: 'wizard', characterName: '先知',
          featureLabel: '预兆', dieIndex: 0, replacementValue: 18, createdAt: 2,
        }],
      }],
    }
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'confirm', response: {
        decision: 'continue', finalValue: 20, acceptedContributionId: 'missing',
      },
    }, 200, 'dm')).toMatchObject({ ok: false, status: 409, error: 'roll-contribution-not-found' })
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'confirm', response: {
        decision: 'continue', finalValue: 4, acceptedContributionId: 'confirm:wizard',
      },
    }, 200, 'dm')).toMatchObject({ ok: false, status: 409, error: 'roll-confirmation-value-conflict' })
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'confirm', response: {
        decision: 'continue', finalValue: 18, acceptedContributionId: 'confirm:wizard',
      },
    }, 200, 'dm')).toMatchObject({ ok: true, changed: true })
  })

  it('normalizes a newly published roll confirmation to an open DM-owned window', () => {
    const result = mutateCombatInterruptQueue(null, {
      operation: 'upsert', mapId: 'map-1', interrupt: {
        id: 'confirm', transactionId: 'roll-1', mapId: 'map-1', kind: 'roll-confirmation', status: 'done',
        phase: 'before-action', timeoutPolicy: 'rollback', response: { decision: 'continue', finalValue: 20 },
        payload: {
          rollId: 'roll-1', label: '攻击', originalValue: 8, visibility: 'public', transaction: { id: 'roll-1' },
        },
        createdAt: 1, updatedAt: 1,
      },
    }, 100, 'player')
    expect(result).toMatchObject({ ok: true, changed: true })
    expect(result.next.interrupts[0]).toMatchObject({
      status: 'pending', phase: 'after-roll', timeoutPolicy: 'wait-for-dm', contributions: [],
    })
    expect((result.next.interrupts[0] as { response?: unknown }).response).toBeUndefined()
  })
})

describe('player character aggregate authority', () => {
  const activeEffect = {
    schemaVersion: 1,
    id: 'hold',
    definitionId: 'spell:hold-person',
    label: '麻痹',
    kind: 'condition',
    standardCondition: 'paralyzed',
    source: { kind: 'spell', actorId: 'enemy', rulesId: 'hold-person' },
    appliedAt: 10,
    duration: { type: 'concentration', sourceActorId: 'enemy', concentrationId: 'hold-person' },
    stackingKey: 'condition:paralyzed',
    stackingPolicy: 'refresh-duration',
  }
  const current = {
    selectedId: 'hero-a',
    updatedAt: 10,
    characters: [
      {
        id: 'hero-a', roomId: 'ROOM', roomMemberId: 'member-a', ownerAccountId: 'account-a',
        name: 'Hero A', currentHp: 4, maxHp: 20, tempHp: 2, hitPointDice: [{ sides: 10, current: 1, max: 2 }],
        conditions: ['paralyzed'], concentrating: true,
        dnd5eCombatState: { schemaVersion: 2, activeEffects: [activeEffect], concentrationSpellId: 'bless' },
        dnd5eInventory: { schemaVersion: 2, entries: [{ id: 'potion', templateId: 'potion', quantity: 1 }] },
        classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 2 } },
        equipment: { armorId: 'chain-mail' }, dmNotes: 'secret', visibleToPlayers: true,
      },
      { id: 'hero-b', roomId: 'ROOM', roomMemberId: 'member-b', name: 'Hero B', currentHp: 12 },
    ],
  }

  it('keeps other members and Headless-owned combat fields on a player upload', () => {
    const forged = {
      selectedId: 'hero-b',
      updatedAt: 20,
      characters: [{
        ...current.characters[0],
        name: 'Renamed Hero', ownerAccountId: 'forged-account', currentHp: 20, tempHp: 0,
        hitPointDice: [{ sides: 10, current: 2, max: 2 }], conditions: [], concentrating: false,
        dnd5eCombatState: undefined, dnd5eInventory: { schemaVersion: 2, entries: [] },
        classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } }, equipment: undefined,
        dmNotes: 'stolen', visibleToPlayers: false,
      }],
    }
    const merged = mergePlayerCharactersStateForAuthority(current, forged, 'member-a', { combatActive: true })
    expect(merged.characters).toHaveLength(2)
    expect(merged.characters[0]).toMatchObject({
      name: 'Renamed Hero', ownerAccountId: 'account-a', currentHp: 4, tempHp: 2,
      conditions: ['paralyzed'], concentrating: true, dmNotes: 'secret', visibleToPlayers: true,
      dnd5eCombatState: current.characters[0].dnd5eCombatState,
      dnd5eInventory: current.characters[0].dnd5eInventory,
      classResources: current.characters[0].classResources,
      equipment: current.characters[0].equipment,
    })
    expect(merged.characters[1]).toEqual(current.characters[1])
    expect(merged.selectedId).toBe('hero-a')
  })

  it('allows ordinary owned-sheet edits outside combat but still rejects forged Headless state', () => {
    const incoming = {
      selectedId: 'hero-a', updatedAt: 20,
      characters: [{ ...current.characters[0], name: 'Renamed Hero', currentHp: 20, concentrating: false, dnd5eCombatState: undefined }],
    }
    const merged = mergePlayerCharactersStateForAuthority(current, incoming, 'member-a', { combatActive: false })
    expect(merged.characters[0]).toMatchObject({ name: 'Renamed Hero', currentHp: 20, concentrating: true })
    expect(merged.characters[0].dnd5eCombatState).toEqual(current.characters[0].dnd5eCombatState)
  })

  it('rejects new characters that claim a different room member', () => {
    const merged = mergePlayerCharactersStateForAuthority(current, {
      selectedId: 'forged', updatedAt: 20,
      characters: [{ id: 'forged', roomMemberId: 'member-b', name: 'Forged' }],
    }, 'member-a')
    expect(merged.characters.map((character) => character.id)).toEqual(['hero-b'])
  })
})

describe('safeName — AC5 防碰撞', () => {
  it('纯安全字符原样返回（无回归）', () => {
    expect(safeName('combat')).toBe('combat')
    expect(safeName('maps')).toBe('maps')
    expect(safeName('player-action-ack')).toBe('player-action-ack')
  })

  it('不同逻辑名不再折叠成同一文件名', () => {
    // 旧实现：'a/b' 与 'ab' 都 → 'ab'（碰撞）。新实现必不相等。
    expect(safeName('a/b')).not.toBe(safeName('ab'))
    expect(safeName('x.1')).not.toBe(safeName('x1'))
    expect(safeName('foo bar')).not.toBe(safeName('foobar'))
  })

  it('输出只含文件系统安全字符', () => {
    expect(safeName('a/b<>:c')).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('确定性：同输入同输出', () => {
    expect(safeName('a/b')).toBe(safeName('a/b'))
  })
})

describe('authorizeStateWrite — AC2 鉴权', () => {
  const prev = process.env.STARS_SHARED_SECRET
  afterEach(() => {
    if (prev == null) delete process.env.STARS_SHARED_SECRET
    else process.env.STARS_SHARED_SECRET = prev
  })

  it('(a) flag 未设 ⇒ 所有写放行（零回归锚点）', () => {
    delete process.env.STARS_SHARED_SECRET
    expect(authorizeStateWrite('combat', null).ok).toBe(true)
    expect(authorizeStateWrite('combat', 'whatever').ok).toBe(true)
    expect(authorizeStateWrite('characters', null).ok).toBe(true)
  })

  it('(b) flag 设 + 正确 secret + DM 资源 ⇒ 放行', () => {
    process.env.STARS_SHARED_SECRET = 's3cr3t'
    expect(authorizeStateWrite('combat', 's3cr3t').ok).toBe(true)
    expect(authorizeStateWrite('player-action-ack', 's3cr3t').ok).toBe(true)
  })

  it('(c) flag 设 + 缺/错 secret + DM 资源 ⇒ 401/403', () => {
    process.env.STARS_SHARED_SECRET = 's3cr3t'
    expect(authorizeStateWrite('combat', null)).toEqual({ ok: false, status: 401 })
    expect(authorizeStateWrite('combat', '')).toEqual({ ok: false, status: 401 })
    expect(authorizeStateWrite('combat', 'wrong')).toEqual({ ok: false, status: 403 })
  })

  it('(d) flag 设 + 玩家写白名单资源（无 secret）⇒ 仍放行', () => {
    process.env.STARS_SHARED_SECRET = 's3cr3t'
    for (const name of [
      'characters',
      'dodge',
      'gale-combo',
      'stable-mind',
      'player-action',
      'player-action-requests',
      'dice',
      'dice-events',
      'combat-log',
    ]) {
      expect(authorizeStateWrite(name, null).ok).toBe(true)
    }
    expect(authorizeStateWrite('maps', null)).toEqual({ ok: false, status: 401 })
  })

  it('extractSecret 从 x-stars-secret 头读取', () => {
    expect(extractSecret({ headers: { 'x-stars-secret': 'abc' } })).toBe('abc')
    expect(extractSecret({ headers: {} })).toBe(null)
  })
})

describe('backlog cap — AC3', () => {
  it('replaySlice 只取末尾 EVENT_REPLAY_LIMIT 条', () => {
    const backlog = Array.from({ length: 500 }, (_, i) => i)
    const slice = replaySlice(backlog)
    expect(slice.length).toBe(EVENT_REPLAY_LIMIT)
    expect(slice[slice.length - 1]).toBe(499)
    expect(EVENT_REPLAY_LIMIT).toBeLessThan(EVENT_BACKLOG_LIMIT)
  })

  it('短 backlog 全量返回', () => {
    expect(replaySlice([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('pushBacklog 维持总量 ≤ EVENT_BACKLOG_LIMIT', () => {
    let b: number[] = []
    for (let i = 0; i < EVENT_BACKLOG_LIMIT + 50; i += 1) b = pushBacklog(b, i)
    expect(b.length).toBe(EVENT_BACKLOG_LIMIT)
    expect(b[b.length - 1]).toBe(EVENT_BACKLOG_LIMIT + 49)
  })

  it('STATE_MAX_BYTES 是正数上限', () => {
    expect(STATE_MAX_BYTES).toBeGreaterThan(0)
  })
})

describe('capEventChannels — AC5 channel COUNT-CAP（T-P1-421）', () => {
  it('超过 limit 时按插入序淘汰最旧 channel（确定性）', () => {
    const m = new Map<string, number[]>()
    for (let i = 0; i < 5; i += 1) m.set(`ch${i}`, [i])
    const evicted = capEventChannels(m, 3)
    expect(evicted).toEqual(['ch0', 'ch1'])
    expect([...m.keys()]).toEqual(['ch2', 'ch3', 'ch4'])
  })

  it('未超 limit 不淘汰任何 channel', () => {
    const m = new Map<string, number[]>([['a', [1]], ['b', [2]]])
    expect(capEventChannels(m, 8)).toEqual([])
    expect(m.size).toBe(2)
  })

  it('受保护（活跃订阅）channel 永不被淘汰（会话中途不清活跃）', () => {
    const m = new Map<string, number[]>()
    for (let i = 0; i < 5; i += 1) m.set(`ch${i}`, [i])
    // ch0 是最旧但活跃 → 跳过它，淘汰次旧的 ch1/ch2。
    const evicted = capEventChannels(m, 3, new Set(['ch0']))
    expect(evicted).toEqual(['ch1', 'ch2'])
    expect(m.has('ch0')).toBe(true)
    expect(m.size).toBe(3)
  })

  it('EVENT_CHANNEL_LIMIT 是正数且 < backlog 总量上限', () => {
    expect(EVENT_CHANNEL_LIMIT).toBeGreaterThan(0)
    expect(EVENT_CHANNEL_LIMIT).toBeLessThanOrEqual(EVENT_BACKLOG_LIMIT)
  })
})

describe('withWriteLock / atomicWriteLocked — AC1 锁', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stars-lock-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('两个快速并发写都落地（不丢更新、不交错）', async () => {
    const file = path.join(dir, 'state.json')
    await Promise.all([
      atomicWriteLocked(file, Buffer.from(JSON.stringify({ v: 1 }))),
      atomicWriteLocked(file, Buffer.from(JSON.stringify({ v: 2 }))),
    ])
    const final = JSON.parse(await readFile(file, 'utf8'))
    // 最终内容是某个完整写（1 或 2），绝非半个文件交错。
    expect([1, 2]).toContain(final.v)
    // 锁文件已释放。
    await expect(stat(`${file}.lock`)).rejects.toBeTruthy()
  })

  it('串行化：N 个并发 increment 不丢更新', async () => {
    const file = path.join(dir, 'counter.json')
    await writeFile(file, JSON.stringify({ n: 0 }))
    const bump = () =>
      withWriteLock(file, async () => {
        const cur = JSON.parse(await readFile(file, 'utf8'))
        await writeFile(file, JSON.stringify({ n: cur.n + 1 }))
      })
    await Promise.all(Array.from({ length: 20 }, bump))
    const final = JSON.parse(await readFile(file, 'utf8'))
    expect(final.n).toBe(20)
  })

  it('fn 抛错也释放锁（不死锁）', async () => {
    const file = path.join(dir, 'err.json')
    await expect(
      withWriteLock(file, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    await expect(stat(`${file}.lock`)).rejects.toBeTruthy()
    // 锁已释放，后续写正常。
    await atomicWriteLocked(file, Buffer.from('{"ok":1}'))
    expect(JSON.parse(await readFile(file, 'utf8')).ok).toBe(1)
  })

  it('does not let an older updatedAt state overwrite a newer one', async () => {
    const file = path.join(dir, 'fresh-state.json')
    await atomicWriteJsonStateFreshLocked(file, Buffer.from(JSON.stringify({ updatedAt: 20, value: 'new' })))
    const accepted = await atomicWriteJsonStateFreshLocked(
      file,
      Buffer.from(JSON.stringify({ updatedAt: 10, value: 'old' })),
    )
    expect(accepted).toBe(false)
    expect(JSON.parse(await readFile(file, 'utf8')).value).toBe('new')
  })

  // 抢锁超时 ⇒ fail-closed：抛 LockTimeoutError(503)，fn 绝不无锁运行。
  it('AC1 — lock-acquire timeout fails CLOSED (throws, fn never runs)', async () => {
    const file = path.join(dir, 'busy.json')
    // 手动占住一把「非陈旧」的锁（刚创建，mtime 新鲜）。
    await writeFile(`${file}.lock`, 'held-by-other', { flag: 'wx' })
    process.env.STARS_LOCK_WAIT_MAX_MS = '120'
    let ran = false
    try {
      await expect(
        withWriteLock(file, async () => {
          ran = true
        }),
      ).rejects.toMatchObject({ name: 'LockTimeoutError', code: 'ELOCKTIMEOUT', statusCode: 503 })
      expect(ran).toBe(false)
      // 占用的锁未被错误删除（我们没持有它）。
      await expect(stat(`${file}.lock`)).resolves.toBeTruthy()
      expect(new LockTimeoutError('x').statusCode).toBe(503)
    } finally {
      delete process.env.STARS_LOCK_WAIT_MAX_MS
      await rm(`${file}.lock`, { force: true })
    }
  })

  // 持锁期间心跳刷新 lockfile mtime ⇒ 合法慢写不会因 mtime 老化被判陈旧而被抢占。
  it('AC2 — the held lock mtime is heartbeated while a slow write runs', async () => {
    process.env.STARS_LOCK_HEARTBEAT_MS = '40'
    process.env.STARS_LOCK_STALE_MS = '120'
    const file = path.join(dir, 'slow.json')
    let mtimeAtStart = 0
    let mtimeLate = 0
    try {
      await withWriteLock(file, async () => {
        mtimeAtStart = (await stat(`${file}.lock`)).mtimeMs
        // 持锁 200ms（> staleMs 120ms）；若无心跳，第二进程会判定陈旧并抢占。
        await new Promise((r) => setTimeout(r, 200))
        mtimeLate = (await stat(`${file}.lock`)).mtimeMs
      })
      // 心跳已把 mtime 推进（持锁期间始终「新鲜」）。
      expect(mtimeLate).toBeGreaterThan(mtimeAtStart)
    } finally {
      delete process.env.STARS_LOCK_HEARTBEAT_MS
      delete process.env.STARS_LOCK_STALE_MS
    }
  })

  // 图片写：blob+meta 在同一把锁内各自 temp+rename 原子落盘。
  it('AC3 — atomicWriteImageLocked writes blob + meta atomically and releases the lock', async () => {
    const imgPath = path.join(dir, 'img-xyz')
    const metaPath = `${imgPath}.json`
    await atomicWriteImageLocked(
      imgPath,
      metaPath,
      Buffer.from([1, 2, 3, 4]),
      JSON.stringify({ type: 'image/png' }),
    )
    expect([...(await readFile(imgPath))]).toEqual([1, 2, 3, 4])
    expect(JSON.parse(await readFile(metaPath, 'utf8')).type).toBe('image/png')
    await expect(stat(`${imgPath}.lock`)).rejects.toBeTruthy()
  })
})

describe('enforceImageQuota — AC4 配额', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stars-img-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('超过 IMAGE_COUNT_LIMIT 时按最旧优先 GC', async () => {
    const total = IMAGE_COUNT_LIMIT + 5
    for (let i = 0; i < total; i += 1) {
      const name = `img${String(i).padStart(3, '0')}`
      await writeFile(path.join(dir, name), Buffer.from(`data${i}`))
      await writeFile(path.join(dir, `${name}.json`), JSON.stringify({ type: 'image/png' }))
      // 强制 mtime 递增，确保 i 越小越旧。
      const t = new Date(Date.now() + i * 10)
      const { utimes } = await import('node:fs/promises')
      await utimes(path.join(dir, name), t, t)
    }
    const removed = await enforceImageQuota(dir)
    expect(removed.length).toBe(5)
    const remaining = (await readdir(dir)).filter((n) => !n.endsWith('.json'))
    expect(remaining.length).toBe(IMAGE_COUNT_LIMIT)
    // 最旧的 5 张（img000..img004）被删。
    expect(removed.sort()).toEqual(['img000', 'img001', 'img002', 'img003', 'img004'])
  })

  it('未超配额不删任何图片', async () => {
    await writeFile(path.join(dir, 'only'), Buffer.from('x'))
    await writeFile(path.join(dir, 'only.json'), '{}')
    expect(await enforceImageQuota(dir)).toEqual([])
  })
})
