import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingLocalFighterChoicesForTest,
  clearPendingLocalCharacterLevelEditsForTest,
  clearPendingLocalCharacterCreationsForTest,
  mergeCharactersForSharedSave,
  mergePendingLocalFighterChoices,
  mergePendingLocalCharacterLevelEdits,
  mergePlayerWritableCharacter,
  markPendingLocalCharacterLevelEdit,
  markPendingLocalFighterChoices,
  resetPendingLocalFighterChoicesMemoryForTest,
  resetPendingLocalCharacterLevelEditMemoryForTest,
} from './characters'
import { mergePlayerTokenCombatFields, type BattleMap, type Token } from './maps'
import type { Character } from '../types/character'

// [T13/AC6] 同步合并回归：玩家端在合并对端（DM 权威）快照时，
// 必须保留 DM 的血量/AP/token 位置，且不要覆盖非白名单字段。
// 这里测试真实合并函数，确保玩家不能越权写战斗权威状态。

function char(patch: Partial<Character>): Character {
  return {
    id: 'hero',
    name: '英雄',
    currentHp: 30,
    maxHp: 40,
    tempHp: 0,
    conditions: [],
    actionPoints: 2,
    currentAP: 2,
    ...patch,
  } as Character
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'tok',
    label: 'Tok',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'enemy',
    ...patch,
  }
}

function map(patch: Partial<BattleMap>): BattleMap {
  return {
    id: 'map1',
    name: '地图',
    width: 800,
    height: 600,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [],
    ...patch,
  }
}

describe('T13/AC6 mergePlayerWritableCharacter keeps DM-authoritative fields', () => {
  it('keeps DM HP/AP from the shared snapshot during combat (player local value discarded)', () => {
    // 玩家本地把自己治满血、AP 拉满（越权），DM 权威快照说他被打到 12 血、AP 已花光。
    const local = char({ currentHp: 40, maxHp: 40, actionPoints: 2, currentAP: 2 })
    const shared = char({ currentHp: 12, maxHp: 40, actionPoints: 0, currentAP: 0 })
    const merged = mergePlayerWritableCharacter(local, shared)
    // DM 权威血量/AP 胜出（不被玩家本地覆盖）。
    expect(merged.currentHp).toBe(12)
    expect(merged.actionPoints).toBe(0)
    expect(merged.currentAP).toBe(0)
    expect(merged.tempHp).toBe(shared.tempHp)
    expect(merged.conditions).toBe(shared.conditions)
  })

  it('keeps DM combat buffs, qi, cooldowns and feature uses from the shared snapshot', () => {
    const local = char({
      qi: 0,
      combatBuffs: {},
      traits: [
        {
          id: 'gale-local',
          name: 'Gale Combo',
          level: 1,
          uses: 1,
          maxUses: 1,
          description: '',
          featureKey: 'galeCombo',
        },
      ],
      combatSkills: [
        {
          id: 'basic-shot',
          name: 'Basic Shot',
          emoji: 'bow',
          description: '',
          apCost: 1,
          cooldown: 0,
          cdReduction: 0,
          remaining: 0,
          usedThisTurn: false,
          damageCount: 1,
          damageSides: 8,
          damageBonus: 0,
          skillTreeId: 'basicShot',
        },
      ],
    })
    const shared = char({
      qi: 7,
      combatBuffs: { galeComboReady: true },
      traits: [
        {
          id: 'gale-shared',
          name: 'Gale Combo',
          level: 1,
          uses: 0,
          maxUses: 1,
          description: '',
          featureKey: 'galeCombo',
        },
      ],
      combatSkills: [
        {
          id: 'basic-shot',
          name: 'Basic Shot',
          emoji: 'bow',
          description: '',
          apCost: 1,
          cooldown: 0,
          cdReduction: 0,
          remaining: 2,
          usedThisTurn: true,
          damageCount: 1,
          damageSides: 8,
          damageBonus: 0,
          skillTreeId: 'basicShot',
        },
      ],
    })

    const merged = mergePlayerWritableCharacter(local, shared)

    expect(merged.qi).toBe(7)
    expect(merged.combatBuffs?.galeComboReady).toBe(true)
    expect(merged.traits[0].uses).toBe(0)
    expect(merged.traits[0].maxUses).toBe(1)
    expect(merged.combatSkills[0]).toMatchObject({ remaining: 2, usedThisTurn: true })
  })

  it('does NOT clobber non-whitelisted local fields (only the whitelist comes from shared)', () => {
    // name 不在白名单，保留本地值，不被对端覆盖。
    const local = char({ name: '玩家改的名字', currentHp: 40 })
    const shared = char({ name: 'DM改的名字', currentHp: 12 })
    const merged = mergePlayerWritableCharacter(local, shared)
    expect(merged.name).toBe('玩家改的名字') // 非白名单字段保留本地。
    expect(merged.currentHp).toBe(12) // 白名单字段取对端。
  })
})


describe('character shared-save merge preserves cross-end creations', () => {
  it('keeps shared-only characters when a stale DM snapshot writes later', () => {
    const dmLocal = [char({ id: 'dm-known', name: 'DM already loaded' })]
    const shared = [
      char({ id: 'dm-known', name: 'DM already loaded' }),
      char({ id: 'player-new', name: 'Player created' }),
    ]

    const merged = mergeCharactersForSharedSave(dmLocal, shared, { playerPort: false })
    expect(merged.map((item) => item.id)).toEqual(['dm-known', 'player-new'])
  })

  it('does not let a player stale local-only sample overwrite shared characters', () => {
    clearPendingLocalCharacterCreationsForTest()
    const playerLocal = [
      char({ id: 'sample-local', name: 'Local sample' }),
      char({ id: 'shared-hero', name: 'Edited locally' }),
    ]
    const shared = [char({ id: 'shared-hero', name: 'Shared hero' })]

    const merged = mergeCharactersForSharedSave(playerLocal, shared, { playerPort: true })
    expect(merged.map((item) => item.id)).toEqual(['shared-hero'])
    expect(merged[0].name).toBe('Edited locally')
  })
})

describe('pending local character level edits', () => {
  afterEach(() => {
    clearPendingLocalCharacterLevelEditsForTest()
    vi.unstubAllGlobals()
  })

  it('preserves an edited level until the shared snapshot acknowledges it', () => {
    clearPendingLocalCharacterLevelEditsForTest()
    const id = 'hero'
    markPendingLocalCharacterLevelEdit(id, 12, 1_000)

    const staleShared = [char({ id, level: 1 })]
    expect(mergePendingLocalCharacterLevelEdits(staleShared, 1_001)[0].level).toBe(12)

    const acknowledgedShared = [char({ id, level: 12 })]
    expect(mergePendingLocalCharacterLevelEdits(acknowledgedShared, 1_002)[0].level).toBe(12)

    const laterShared = [char({ id, level: 8 })]
    expect(mergePendingLocalCharacterLevelEdits(laterShared, 1_003)[0].level).toBe(8)

    clearPendingLocalCharacterLevelEditsForTest()
  })

  it('releases an unacknowledged edit after the protection window', () => {
    clearPendingLocalCharacterLevelEditsForTest()
    markPendingLocalCharacterLevelEdit('hero', 12, 1_000)
    expect(mergePendingLocalCharacterLevelEdits([char({ level: 1 })], 31_001)[0].level).toBe(1)
  })

  it('rehydrates an unacknowledged level after a page-reload-style memory reset', () => {
    const values = new Map<string, string>()
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    vi.stubGlobal('window', { localStorage })
    clearPendingLocalCharacterLevelEditsForTest()

    markPendingLocalCharacterLevelEdit('hero', 12, 1_000)
    resetPendingLocalCharacterLevelEditMemoryForTest()

    expect(mergePendingLocalCharacterLevelEdits([char({ id: 'hero', level: 1 })], 1_001)[0].level).toBe(12)
    expect(values.size).toBe(1)

    expect(mergePendingLocalCharacterLevelEdits([char({ id: 'hero', level: 12 })], 1_002)[0].level).toBe(12)
    expect(values.size).toBe(0)
  })
})

describe('pending local fighter choices', () => {
  afterEach(() => {
    clearPendingLocalFighterChoicesForTest()
    vi.unstubAllGlobals()
  })

  it('survives a reload and rejects stale maneuver choices until shared state acknowledges them', () => {
    const values = new Map<string, string>()
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    vi.stubGlobal('window', { localStorage })
    clearPendingLocalFighterChoicesForTest()

    const choices = {
      subclass: 'battle-master' as const,
      maneuverAbility: 'str' as const,
      maneuvers: ['disarming-attack', 'precision-attack', 'trip-attack'] as const,
    }
    markPendingLocalFighterChoices('hero', {
      ...choices,
      maneuvers: [...choices.maneuvers],
    }, 1_000)
    resetPendingLocalFighterChoicesMemoryForTest()

    const stale = [char({
      id: 'hero',
      dnd5eClassChoices: { fighter: { subclass: 'battle-master', maneuvers: [] } },
    })]
    expect(mergePendingLocalFighterChoices(stale, 1_001)[0].dnd5eClassChoices?.fighter?.maneuvers)
      .toEqual(choices.maneuvers)
    expect(values.size).toBe(1)

    const acknowledged = [char({
      id: 'hero',
      dnd5eClassChoices: { fighter: { ...choices, maneuvers: [...choices.maneuvers] } },
    })]
    expect(mergePendingLocalFighterChoices(acknowledged, 1_002)[0].dnd5eClassChoices?.fighter?.maneuvers)
      .toEqual(choices.maneuvers)
    expect(values.size).toBe(0)
  })
})

describe('T13/AC6 mergePlayerTokenCombatFields preserves DM token positions', () => {
  it('a non-player (enemy) token takes DM x/y from shared (player cannot move it)', () => {
    const localMap = map({ tokens: [token({ id: 'e1', type: 'enemy', x: 100, y: 100, hp: 5, maxHp: 10 })] })
    const sharedMap = map({
      tokens: [token({ id: 'e1', type: 'enemy', x: 500, y: 700, hp: 3, maxHp: 10, illusionDanceTurns: 1 })],
    })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    const e1 = result.tokens.find((t) => t.id === 'e1')!
    // DM 权威位置覆盖玩家本地位置。
    expect(e1.x).toBe(500)
    expect(e1.y).toBe(700)
    // 战斗字段同样取 DM 权威值。
    expect(e1.hp).toBe(3)
    expect(e1.illusionDanceTurns).toBe(1)
  })

  it("a player-type token keeps its OWN local x/y (DM does not move the player's own token)", () => {
    const localMap = map({ tokens: [token({ id: 'p1', type: 'player', x: 120, y: 130, hp: 20, maxHp: 30 })] })
    const sharedMap = map({ tokens: [token({ id: 'p1', type: 'player', x: 999, y: 888, hp: 15, maxHp: 30 })] })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    const p1 = result.tokens.find((t) => t.id === 'p1')!
    // 玩家自己 token 的位置保留本地（dmControlledPosition 仅对非 player 生效）。
    expect(p1.x).toBe(120)
    expect(p1.y).toBe(130)
    // 但战斗字段（hp 等）仍取 DM 权威值。
    expect(p1.hp).toBe(15)
  })

  it('a token absent from the shared snapshot is left untouched (no spurious overwrite)', () => {
    const localMap = map({ tokens: [token({ id: 'only-local', type: 'enemy', x: 50, y: 60, hp: 9, maxHp: 9 })] })
    const sharedMap = map({ tokens: [] })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    const t = result.tokens.find((x) => x.id === 'only-local')!
    expect(t.x).toBe(50)
    expect(t.y).toBe(60)
    expect(t.hp).toBe(9)
  })
})
