import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Character } from '../types/character'
import {
  buildInitiativeOrder,
  insertInitiativeEntriesPreservingActive,
  migrateLegacyApCombatLogText,
  placeableRoomCharacters,
  rollInitiative,
} from './mapsPageHelpers'
import type { RoomSession } from '../lib/roomSession'

function champion(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'champion', name: '勇士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士',
    level: 7, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 60, currentHp: 60, tempHp: 0, hitDice: '7d10',
    ac: 18, speed: 30, initiativeBonus: 0, saveDC: 12, 
    passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: ['defense'] } },
  }
}

afterEach(() => vi.restoreAllMocks())

describe('D&D 5e map helpers', () => {
  it('only offers characters belonging to current room members in the DM placement menu', () => {
    const session: RoomSession = {
      roomId: 'ABC234',
      roomName: '测试房间',
      rulesetId: 'dnd5e-2014-srd-5.1',
      memberId: 'dm-member',
      roomToken: 'room-token-abcdefghijklmnopqrstuvwxyz-1234567890',
      clientId: 'dm-client-id',
      role: 'dm',
      displayName: 'DM',
      createdAt: 1,
    }
    const active = { ...champion(), id: 'active', roomId: 'ABC234', roomMemberId: 'player-active' }
    const departed = { ...champion(), id: 'departed', roomId: 'ABC234', roomMemberId: 'player-departed' }
    const showcase = { ...champion(), id: 'sample-aria' }
    expect(placeableRoomCharacters(
      [active, departed, showcase],
      session,
      new Set(['player-active']),
    ).map((character) => character.id)).toEqual(['active'])
  })

  it('includes Remarkable Athlete in a Champion initiative check', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.45) // d20 = 10
    expect(rollInitiative({} as never, champion())).toBe(14) // 10 + DEX 2 + half proficiency 2
  })

  it('rolls Feral Instinct initiative with advantage and lets exhaustion cancel it', () => {
    const barbarian = { ...champion(), charClass: '野蛮人', level: 7, dnd5eClassChoices: undefined }
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.15).mockReturnValueOnce(0.8) // 4, 17
    expect(rollInitiative({} as never, barbarian)).toBe(19)
    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.4) // one roll: 9, advantage and disadvantage cancel
    expect(rollInitiative({} as never, { ...barbarian, exhaustionLevel: 1 })).toBe(11)
  })

  it('uses the monster Dexterity modifier for initiative instead of a random bonus', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.45) // d20 = 10
    const goblin = { poolId: 'srd-5.1:goblin' } as never
    expect(rollInitiative(goblin)).toBe(12) // DEX 14 = +2
    expect(Math.random).toHaveBeenCalledTimes(1)
  })

  it('adds a distinct first-round Thief Reflexes slot unless the Thief is surprised', () => {
    const thief = {
      ...champion(), id: 'thief', name: '盗贼', charClass: '游荡者', level: 17,
      abilities: { str: 10, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
      dnd5eClassChoices: { classes: { rogue: { subclass: 'thief' } } },
      conditions: [],
    } as Character
    const token = {
      id: 'thief-token', label: thief.name, emoji: '🗡️', color: '#fff', type: 'player',
      characterId: thief.id, x: 0, y: 0, size: 1,
    } as never
    vi.spyOn(Math, 'random').mockReturnValue(0.45) // d20 10 + DEX 4
    expect(buildInitiativeOrder([token], [thief])).toMatchObject([
      { tokenId: 'thief-token', slotId: 'thief-token:normal', label: '盗贼', emoji: '🗡️', roll: 14 },
      { tokenId: 'thief-token', slotId: 'thief-token:thief-reflexes', turnKind: 'thief-reflexes', label: '盗贼', emoji: '🗡️', roll: 4 },
    ])
    expect(buildInitiativeOrder([token], [{
      ...thief,
      dnd5eCombatState: { surprisedCombatId: 'combat-1', surpriseResolvedCombatId: undefined },
    }])).toHaveLength(1)
  })

  it('uses the cropped initiative portrait and falls back to the full portrait', () => {
    const token = {
      id: 'hero-token', label: '勇士', emoji: '🛡️', color: '#fff', type: 'player',
      characterId: 'champion', x: 0, y: 0, size: 1,
    } as never
    vi.spyOn(Math, 'random').mockReturnValue(0.45)
    expect(buildInitiativeOrder([token], [{
      ...champion(), portrait: 'full-portrait', initiativePortrait: 'initiative-portrait',
    }])[0].portrait).toBe('initiative-portrait')
    expect(buildInitiativeOrder([token], [{
      ...champion(), portrait: 'full-portrait', initiativePortrait: undefined,
    }])[0].portrait).toBe('full-portrait')
  })

  it('inserts a summoned initiative slot without changing the active turn', () => {
    const current = [
      { slotId: 'hero:normal', tokenId: 'hero', label: '英雄', emoji: 'H', color: '#fff', roll: 15 },
      { slotId: 'enemy:normal', tokenId: 'enemy', label: '敌人', emoji: 'E', color: '#f00', roll: 8 },
    ]
    const inserted = insertInitiativeEntriesPreservingActive(current, 1, [
      { slotId: 'summon:normal', tokenId: 'summon', label: '召唤物', emoji: 'S', color: '#0ff', roll: 18 },
    ])
    expect(inserted.order.map((entry) => entry.tokenId)).toEqual(['summon', 'hero', 'enemy'])
    expect(inserted.index).toBe(2)
  })

  it('migrates a persisted AP movement log without losing the action detail', () => {
    expect(migrateLegacyApCombatLogText('新冒险者 花费 1 AP：移动（10 尺）。剩余 AP 1/2'))
      .toBe('新冒险者 移动（10 尺）。')
    expect(migrateLegacyApCombatLogText('新冒险者花费1AP：移动（10 尺）。剩余 AP 1/2'))
      .toBe('新冒险者移动（10 尺）。')
    expect(migrateLegacyApCombatLogText('新冒险者 消耗 1 点 AP: 移动（10 尺）；本回合剩余 AP 1 / 2'))
      .toBe('新冒险者 移动（10 尺）')
    expect(migrateLegacyApCombatLogText('新冒险者 移动（10 尺），AP 1/2'))
      .toBe('新冒险者 移动（10 尺）')
    expect(migrateLegacyApCombatLogText('新冒险者 移动 10 尺；本回合剩余移动 20/30 尺。'))
      .toBe('新冒险者 移动 10 尺；本回合剩余移动 20/30 尺。')
  })

  it('removes every historical AP wording variant without changing 5e movement counters', () => {
    const legacy = [
      '新冒险者 花费 1 AP 移动到 (3,4)，距离 20 -> 10',
      '新冒险者 行动，AP 2/2，位置 (3,4)',
      '新冒险者 保留 AP：不闪避长剑',
      '新冒险者 尝试闪避，但 AP 不足。',
      '新冒险者 发动灵巧跳跃：可移动至多 10 尺，不消耗 AP。',
      '新冒险者 发动安定心神，AP 回满为 2/2。',
    ]
    for (const text of legacy) {
      expect(migrateLegacyApCombatLogText(text)).not.toMatch(/\bAP\b/i)
    }
    expect(migrateLegacyApCombatLogText('新冒险者 移动 10 尺；本回合剩余移动 20/30 尺。'))
      .toBe('新冒险者 移动 10 尺；本回合剩余移动 20/30 尺。')
  })
})
