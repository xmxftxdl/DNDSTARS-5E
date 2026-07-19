import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getAssignedPlayerCharacterId,
  getPlayerCharacter,
  playerViewCharacters,
  planRoomCharacterOwnershipRecovery,
  roomCharactersOwnedByMembers,
  roomOwnedPlayerCharacters,
} from './playerView'
import type { Character } from '../types/character'
import { ROOM_SESSION_STORAGE_KEY } from './roomSession'

function character(id: string, player: string, visibleToPlayers = true): Character {
  return {
    id,
    name: id,
    player,
    avatar: '🙂',
    accent: '',
    race: '',
    charClass: '弓手',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d8',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('player view assignment', () => {
  it('selects the character owned by the current player slot', () => {
    const characters = [
      character('c1', '玩家1'),
      character('c2', '玩家2'),
      character('c3', '玩家3'),
    ]

    expect(getPlayerCharacter(characters, { slot: 'player2' })?.id).toBe('c2')
    expect(playerViewCharacters(characters, { slot: 'player3' }).map((c) => c.id)).toEqual(['c3'])
  })

  it('uses explicit local assignment before owner aliases', () => {
    const characters = [
      character('c1', '玩家1'),
      character('c2', '玩家2'),
    ]

    expect(getPlayerCharacter(characters, { slot: 'player1', assignedCharacterId: 'c2' })?.id).toBe('c2')
  })

  it('does not guess a character when no owner matches and several are visible', () => {
    const characters = [
      character('unowned', '玩家'),
      character('c2', '别人'),
    ]

    expect(getPlayerCharacter(characters, { slot: 'player2' })).toBeUndefined()
    expect(getPlayerCharacter(characters, { slot: 'player1' })).toBeUndefined()
  })

  it('only exposes characters created by the current room member', () => {
    const mine = { ...character('mine', '玩家甲'), roomId: 'ABC234', roomMemberId: 'member-a' }
    const sameRoomOther = { ...character('other', '玩家乙'), roomId: 'ABC234', roomMemberId: 'member-b' }
    const otherRoom = { ...character('other-room', '玩家甲'), roomId: 'XYZ234', roomMemberId: 'member-a' }
    expect(roomOwnedPlayerCharacters([mine, sameRoomOther, otherRoom], 'ABC234', 'member-a'))
      .toEqual([mine])
  })

  it('only gives DM consumers characters owned by current room members', () => {
    const current = { ...character('current', '玩家甲'), roomId: 'ABC234', roomMemberId: 'member-current' }
    const departed = { ...character('departed', '玩家乙'), roomId: 'ABC234', roomMemberId: 'member-departed' }
    const legacy = character('legacy', '玩家甲')
    expect(roomCharactersOwnedByMembers(
      [current, departed, legacy],
      'ABC234',
      new Set(['member-current']),
    )).toEqual([current])
  })

  it('migrates room character assignment from a slot key to the stable member key', () => {
    const values = new Map<string, string>()
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
    }
    values.set(ROOM_SESSION_STORAGE_KEY, JSON.stringify({
      roomId: 'ABC234', roomName: '测试房间', rulesetId: 'dnd5e-2014-srd-5.1',
      memberId: 'member-stable-123', clientId: 'client-stable-123', role: 'player',
      slot: 'player1', displayName: '玩家甲', createdAt: 1,
    }))
    values.set('stars-player-character-id:ABC234:player1', 'hero-character')
    vi.stubGlobal('window', { localStorage })

    expect(getAssignedPlayerCharacterId('player1')).toBe('hero-character')
    expect(values.get('stars-player-character-id:ABC234:member-stable-123')).toBe('hero-character')
  })

  it('recovers a uniquely named orphaned room character for a rejoined current member', () => {
    const old = {
      ...character('old-hero', 'AAA'), roomId: 'ABC234', roomMemberId: 'previous-member',
    }
    const other = {
      ...character('other-hero', 'AA'), roomId: 'ABC234', roomMemberId: 'other-previous-member',
    }
    expect(planRoomCharacterOwnershipRecovery(
      [old, other],
      'ABC234',
      [{ memberId: 'current-member', displayName: 'AAA' }],
    )).toEqual([{ characterId: 'old-hero', memberId: 'current-member' }])
  })

  it('does not guess ownership when names collide or the current member already owns a character', () => {
    const old = {
      ...character('old-hero', 'AAA'), roomId: 'ABC234', roomMemberId: 'previous-member',
    }
    const current = {
      ...character('current-hero', 'AAA'), roomId: 'ABC234', roomMemberId: 'current-member',
    }
    expect(planRoomCharacterOwnershipRecovery(
      [old],
      'ABC234',
      [
        { memberId: 'current-member', displayName: 'AAA' },
        { memberId: 'second-member', displayName: 'AAA' },
      ],
    )).toEqual([])
    expect(planRoomCharacterOwnershipRecovery(
      [old, current],
      'ABC234',
      [{ memberId: 'current-member', displayName: 'AAA' }],
    )).toEqual([])
  })
})
