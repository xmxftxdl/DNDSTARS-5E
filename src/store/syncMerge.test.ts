import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingLocalFighterChoicesForTest,
  clearPendingLocalClassChoicesForTest,
  clearPendingLocalPluginFeaturesForTest,
  clearPendingLocalCharacterLevelEditsForTest,
  clearPendingLocalCharacterHitPointEditsForTest,
  clearPendingLocalCharacterCreationsForTest,
  filterLegacySampleCharacters,
  mergeCharactersForSharedSave,
  mergePendingLocalFighterChoices,
  mergePendingLocalClassChoices,
  mergePendingLocalPluginFeatures,
  mergePendingLocalCharacterLevelEdits,
  mergePendingLocalCharacterHitPointEdits,
  mergePlayerWritableCharacter,
  markPendingLocalCharacterLevelEdit,
  markPendingLocalCharacterHitPointEdit,
  markPendingLocalFighterChoices,
  markPendingLocalClassChoices,
  markPendingLocalPluginFeatures,
  resetPendingLocalFighterChoicesMemoryForTest,
  resetPendingLocalClassChoicesMemoryForTest,
  resetPendingLocalPluginFeaturesMemoryForTest,
  resetPendingLocalCharacterLevelEditMemoryForTest,
  resetPendingLocalCharacterHitPointEditMemoryForTest,
} from './characters'
import {
  clearPendingLocalTokenHitPointEditsForTest,
  markPendingLocalTokenHitPointEdit,
  mergePendingLocalTokenHitPointEdits,
  mergePlayerTokenCombatFields,
  resetPendingLocalTokenHitPointEditMemoryForTest,
  saveMapsStateWithPendingHitPointRetry,
  type BattleMap,
  type Token,
} from './maps'
import type { Character } from '../types/character'
import { dnd5eInventoryItemTemplate } from '../rulesets/dnd5e/items'
import { createDnd5eConditionEffect } from '../rulesets/dnd5e/activeEffects'

// 玩家端合并 DM 权威快照时，只接受公开的 D&D 战斗字段。

function char(patch: Partial<Character>): Character {
  return {
    id: 'hero',
    name: '英雄',
    currentHp: 30,
    maxHp: 40,
    tempHp: 0,
    conditions: [],
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
  it('restores authoritative active effects after a player reconnects with stale local combat state', () => {
    const effect = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'hero-token', source: { kind: 'dm', label: 'DM 裁定' },
      duration: { type: 'rounds', remainingRounds: 2, tickOn: 'target-turn-end' },
    })
    const local = char({ conditions: [], dnd5eCombatState: undefined })
    const shared = char({ conditions: ['blinded'], dnd5eCombatState: { activeEffects: [effect] } })
    const merged = mergePlayerWritableCharacter(local, shared)
    expect(merged.conditions).toEqual(['blinded'])
    expect(merged.dnd5eCombatState?.activeEffects).toEqual([effect])
    expect(merged.dnd5eCombatState?.activeEffects).not.toBe(shared.dnd5eCombatState?.activeEffects)
  })

  it('keeps DM HP and temporary HP from the shared snapshot', () => {
    const local = char({ currentHp: 40, maxHp: 40, tempHp: 20 })
    const shared = char({ currentHp: 12, maxHp: 40, tempHp: 3 })
    const merged = mergePlayerWritableCharacter(local, shared)
    expect(merged.currentHp).toBe(12)
    expect(merged.tempHp).toBe(3)
    expect(merged.conditions).toEqual(shared.conditions)
  })

  it('keeps DM class resources from the shared snapshot', () => {
    const local = char({ classResources: { fighterSecondWind: { current: 1, max: 1 } } })
    const shared = char({ classResources: { fighterSecondWind: { current: 0, max: 1 } } })

    const merged = mergePlayerWritableCharacter(local, shared)
    expect(merged.classResources?.fighterSecondWind).toEqual({ current: 0, max: 1 })
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
  it('removes retired showcase records without removing real characters with the same display name', () => {
    const legacy = char({ id: 'sample-adventurer', name: '新冒险者' })
    const real = char({ id: 'real-adventurer', name: '新冒险者' })
    expect(filterLegacySampleCharacters([legacy, real])).toEqual([real])
    expect(mergeCharactersForSharedSave(
      [legacy, real],
      [legacy, real],
      { playerPort: false },
    ).map((character) => character.id)).toEqual(['real-adventurer'])
  })

  it('keeps the DM inventory snapshot when a player local copy has a forged quantity', () => {
    const potion = dnd5eInventoryItemTemplate('srd-5.1:item:potion-of-healing')!
    const entry = {
      instanceId: 'potion-1',
      templateId: potion.id,
      item: potion,
      acquiredAt: 1,
    }
    const local = char({ dnd5eInventory: { schemaVersion: 1, entries: [{ ...entry, quantity: 99 }] } })
    const shared = char({ dnd5eInventory: { schemaVersion: 1, entries: [{ ...entry, quantity: 1 }] } })
    const merged = mergePlayerWritableCharacter(local, shared)
    expect(merged.dnd5eInventory?.entries[0].quantity).toBe(1)
  })

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

describe('pending local character-sheet hit point edits', () => {
  afterEach(() => {
    clearPendingLocalCharacterHitPointEditsForTest()
    vi.unstubAllGlobals()
  })

  it('preserves healing until the shared room snapshot acknowledges it', () => {
    markPendingLocalCharacterHitPointEdit('hero', { currentHp: 24 }, 1_000)
    const stale = mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 10 })],
      1_001,
    )
    expect(stale[0].currentHp).toBe(24)

    const acknowledged = mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 24 })],
      1_002,
    )
    expect(acknowledged[0].currentHp).toBe(24)
    expect(mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 8 })],
      1_003,
    )[0].currentHp).toBe(8)
  })

  it('does not compare wall clocks from different clients while awaiting acknowledgement', () => {
    markPendingLocalCharacterHitPointEdit('hero', { currentHp: 24, maxHp: 40 }, 1_000)
    const clockSkewedSnapshot = mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 7, maxHp: 35 })],
      1_002,
    )
    expect(clockSkewedSnapshot[0]).toMatchObject({ currentHp: 24, maxHp: 40 })
  })

  it('restores a persisted edit after a page reload', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    })
    clearPendingLocalCharacterHitPointEditsForTest()
    markPendingLocalCharacterHitPointEdit('hero', { currentHp: 24 }, 1_000)
    resetPendingLocalCharacterHitPointEditMemoryForTest()

    expect(mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 10 })],
      1_001,
    )[0].currentHp).toBe(24)
  })

  it('preserves a manual Hit Die plan until the room snapshot acknowledges it', () => {
    const rolls = [10, 8, 4]
    markPendingLocalCharacterHitPointEdit('hero', {
      currentHp: 28,
      maxHp: 28,
      hitPointMaximumMode: 'manual',
      hitPointRolls: rolls,
    }, 1_000)
    const stale = mergePendingLocalCharacterHitPointEdits([char({
      currentHp: 24,
      maxHp: 24,
      hitPointMaximumMode: 'fixed',
      hitPointRolls: undefined,
    })], 1_001)[0]
    expect(stale).toMatchObject({
      currentHp: 28,
      maxHp: 28,
      hitPointMaximumMode: 'manual',
      hitPointRolls: rolls,
    })

    const acknowledged = mergePendingLocalCharacterHitPointEdits([char({
      currentHp: 28,
      maxHp: 28,
      hitPointMaximumMode: 'manual',
      hitPointRolls: rolls,
    })], 1_002)[0]
    expect(acknowledged.hitPointRolls).toEqual(rolls)
    expect(mergePendingLocalCharacterHitPointEdits([char({
      hitPointMaximumMode: 'fixed',
      hitPointRolls: undefined,
    })], 1_003)[0].hitPointMaximumMode).toBe('fixed')
  })

  it('preserves spent Hit Dice until the room snapshot acknowledges the short rest', () => {
    const spent = [{ sides: 10, current: 1, max: 3 }]
    markPendingLocalCharacterHitPointEdit('hero', { currentHp: 18, hitPointDice: spent }, 1_000)

    const stale = mergePendingLocalCharacterHitPointEdits([char({
      currentHp: 10,
      hitPointDice: [{ sides: 10, current: 3, max: 3 }],
    })], 1_001)[0]
    expect(stale.currentHp).toBe(18)
    expect(stale.hitPointDice).toEqual(spent)

    const acknowledged = mergePendingLocalCharacterHitPointEdits([char({
      currentHp: 18,
      hitPointDice: spent,
    })], 1_002)[0]
    expect(acknowledged.hitPointDice).toEqual(spent)
    expect(mergePendingLocalCharacterHitPointEdits([char({
      hitPointDice: [{ sides: 10, current: 3, max: 3 }],
    })], 1_003)[0].hitPointDice).toEqual([{ sides: 10, current: 3, max: 3 }])
  })
})

describe('pending local fighter choices', () => {
  afterEach(() => {
    clearPendingLocalFighterChoicesForTest()
    vi.unstubAllGlobals()
  })

  it('survives a reload and rejects stale plugin choices until shared state acknowledges them', () => {
    const values = new Map<string, string>()
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    vi.stubGlobal('window', { localStorage })
    clearPendingLocalFighterChoicesForTest()

    const choices = {
      subclass: 'example.rules:tactician',
      extensionChoices: {
        'example.rules:tactician/techniques': ['disarm', 'precision', 'trip'],
      },
    }
    markPendingLocalFighterChoices('hero', choices, 1_000)
    resetPendingLocalFighterChoicesMemoryForTest()

    const stale = [char({
      id: 'hero',
      dnd5eClassChoices: { fighter: { subclass: choices.subclass, extensionChoices: {} } },
    })]
    expect(mergePendingLocalFighterChoices(stale, 1_001)[0].dnd5eClassChoices?.fighter?.extensionChoices)
      .toEqual(choices.extensionChoices)
    expect(values.size).toBe(1)

    const acknowledged = [char({
      id: 'hero',
      dnd5eClassChoices: { fighter: choices },
    })]
    expect(mergePendingLocalFighterChoices(acknowledged, 1_002)[0].dnd5eClassChoices?.fighter?.extensionChoices)
      .toEqual(choices.extensionChoices)
    expect(values.size).toBe(0)
  })
})

describe('pending local SRD class choices', () => {
  afterEach(() => {
    clearPendingLocalClassChoicesForTest()
    vi.unstubAllGlobals()
  })

  it('survives a reload and rejects a stale subclass/feature-choice snapshot', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } })
    clearPendingLocalClassChoicesForTest()

    const choices = { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['colossus-slayer'] } } }
    markPendingLocalClassChoices('hero', choices, 1_000)
    resetPendingLocalClassChoicesMemoryForTest()

    const stale = [char({ id: 'hero', dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter', selections: {} } } } })]
    expect(mergePendingLocalClassChoices(stale, 1_001)[0].dnd5eClassChoices?.classes?.ranger.selections)
      .toEqual(choices.ranger.selections)
    expect(values.size).toBe(1)

    const acknowledged = [char({ id: 'hero', dnd5eClassChoices: { classes: choices } })]
    expect(mergePendingLocalClassChoices(acknowledged, 1_002)[0].dnd5eClassChoices?.classes?.ranger.selections)
      .toEqual(choices.ranger.selections)
    expect(values.size).toBe(0)
  })
})

describe('pending local plugin feature choices', () => {
  afterEach(() => {
    clearPendingLocalPluginFeaturesForTest()
    vi.unstubAllGlobals()
  })

  it('survives a reload until the shared character acknowledges the namespaced IDs', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } })
    clearPendingLocalPluginFeaturesForTest()

    const featureIds = ['com.example.rules:guardian-spark']
    markPendingLocalPluginFeatures('hero', featureIds, 1_000)
    resetPendingLocalPluginFeaturesMemoryForTest()

    expect(mergePendingLocalPluginFeatures([
      char({ id: 'hero', dnd5ePluginFeatureIds: [] }),
    ], 1_001)[0].dnd5ePluginFeatureIds).toEqual(featureIds)
    expect(values.size).toBe(1)

    expect(mergePendingLocalPluginFeatures([
      char({ id: 'hero', dnd5ePluginFeatureIds: featureIds }),
    ], 1_002)[0].dnd5ePluginFeatureIds).toEqual(featureIds)
    expect(values.size).toBe(0)
  })
})

describe('T13/AC6 mergePlayerTokenCombatFields preserves DM token positions', () => {
  it('keeps DM-authored item areas when a player publishes an unrelated map write', () => {
    const localMap = map({ dnd5eItemAreas: [] })
    const sharedArea = {
      id: 'area', kind: 'caltrops' as const, sourceCharacterId: 'hero', sourceTokenId: 'tok',
      sourceItemTemplateId: 'srd-5.1:item:caltrops-bag', sourceItemName: '铁蒺藜',
      cells: [{ col: 2, row: 2 }], createdAt: 1, armed: true,
    }
    const sharedMap = map({ dnd5eItemAreas: [sharedArea] })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    expect(result.dnd5eItemAreas).toEqual([sharedArea])
  })

  it('a non-player (enemy) token takes DM x/y from shared (player cannot move it)', () => {
    const localMap = map({ tokens: [token({ id: 'e1', type: 'enemy', x: 100, y: 100, hp: 5, maxHp: 10 })] })
    const blinded = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'e1', source: { kind: 'dm', label: 'DM 裁定' }, appliedAt: 1,
    })
    const sharedMap = map({
      tokens: [token({
        id: 'e1', type: 'enemy', x: 500, y: 700, hp: 3, maxHp: 10,
        dnd5eCombatState: { schemaVersion: 2, conditions: ['blinded'], activeEffects: [blinded] },
      })],
    })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    const e1 = result.tokens.find((t) => t.id === 'e1')!
    // DM 权威位置覆盖玩家本地位置。
    expect(e1.x).toBe(500)
    expect(e1.y).toBe(700)
    // 战斗字段同样取 DM 权威值。
    expect(e1.hp).toBe(3)
    expect(e1.dnd5eCombatState?.activeEffects).toEqual([blinded])
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

  it('always takes the authoritative movement path metadata for multi-client animation', () => {
    const localMap = map({ tokens: [token({ id: 'p1', type: 'player', x: 10, y: 10 })] })
    const movementAnimation = {
      id: 'move', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], durationMs: 500, issuedAt: 1,
    }
    const sharedMap = map({ tokens: [token({ id: 'p1', type: 'player', x: 20, y: 10, movementAnimation })] })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    expect(result.tokens[0].movementAnimation).toEqual(movementAnimation)
  })

  it('removes a stale local DM token that is absent from the authoritative snapshot', () => {
    const localMap = map({ tokens: [token({ id: 'only-local', type: 'enemy', x: 50, y: 60, hp: 9, maxHp: 9 })] })
    const sharedMap = map({ tokens: [] })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    expect(result.tokens).toEqual([])
  })

  it('adds a DM-created summon missing from the player cache', () => {
    const localMap = map({ tokens: [] })
    const summon = token({
      id: 'plugin-summon:action-1', type: 'enemy', x: 150, y: 150,
      dnd5eSummon: {
        schemaVersion: 1, pluginId: 'com.example', featureId: 'com.example:wolf',
        sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
        expiresAfterRound: 10, concentrationId: 'plugin-summon:action-1', side: 'player',
      },
    })
    const [result] = mergePlayerTokenCombatFields([localMap], [map({ tokens: [summon] })])
    expect(result.tokens).toEqual([summon])
  })

  it('takes core spell effect-token ownership and position from the DM snapshot', () => {
    const effect = {
      schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token', createdRound: 1, expiresAfterRound: 11,
      concentrationId: 'flaming-sphere',
    }
    const local = token({ id: 'sphere', type: 'obstacle', x: 50, y: 50 })
    const authoritative = token({
      id: 'sphere', type: 'obstacle', x: 250, y: 150, dnd5eSpellEffect: effect,
    })
    const [result] = mergePlayerTokenCombatFields(
      [map({ tokens: [local] })],
      [map({ tokens: [authoritative] })],
    )
    expect(result.tokens[0]).toMatchObject({ x: 250, y: 150, dnd5eSpellEffect: effect })
  })
})

describe('地图 Token HP 本地写入竞争保护', () => {
  afterEach(() => {
    clearPendingLocalTokenHitPointEditsForTest()
    vi.unstubAllGlobals()
  })

  it('旧共享快照不会把刚编辑的怪物 HP 回弹，服务端回显后解除保护', () => {
    markPendingLocalTokenHitPointEdit('map-1', 'enemy', { hp: 4 }, 1_000)
    const stale = mergePendingLocalTokenHitPointEdits([
      map({ id: 'map-1', tokens: [token({ id: 'enemy', type: 'enemy', hp: 9, maxHp: 12 })] }),
    ], 1_001)
    expect(stale[0].tokens[0].hp).toBe(4)

    const acknowledged = mergePendingLocalTokenHitPointEdits([
      map({ id: 'map-1', tokens: [token({ id: 'enemy', type: 'enemy', hp: 4, maxHp: 12 })] }),
    ], 1_002)
    expect(acknowledged[0].tokens[0].hp).toBe(4)

    const laterAuthority = mergePendingLocalTokenHitPointEdits([
      map({ id: 'map-1', tokens: [token({ id: 'enemy', type: 'enemy', hp: 2, maxHp: 12 })] }),
    ], 1_003)
    expect(laterAuthority[0].tokens[0].hp).toBe(2)
  })

  it('刷新后仍保留保护，并且不覆盖其他地图或 Token', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } })
    clearPendingLocalTokenHitPointEditsForTest()
    markPendingLocalTokenHitPointEdit('map-1', 'enemy', { hp: 4, maxHp: 14 }, 1_000)
    resetPendingLocalTokenHitPointEditMemoryForTest()

    const result = mergePendingLocalTokenHitPointEdits([
      map({
        id: 'map-1',
        tokens: [
          token({ id: 'enemy', type: 'enemy', hp: 9, maxHp: 12 }),
          token({ id: 'other', type: 'enemy', hp: 7, maxHp: 7 }),
        ],
      }),
      map({ id: 'map-2', tokens: [token({ id: 'enemy', type: 'enemy', hp: 11, maxHp: 11 })] }),
    ], 1_001)
    expect(result[0].tokens[0]).toMatchObject({ hp: 4, maxHp: 14 })
    expect(result[0].tokens[1]).toMatchObject({ hp: 7, maxHp: 7 })
    expect(result[1].tokens[0]).toMatchObject({ hp: 11, maxHp: 11 })
  })

  it('CAS 冲突后以服务端新快照为底稿重放 HP，并有限重试', async () => {
    markPendingLocalTokenHitPointEdit('map-1', 'enemy', { hp: 4 }, 1_000)
    const writes: Array<{ maps: BattleMap[]; selectedId: string | null; updatedAt?: number }> = []
    const save = vi.fn(async (payload) => {
      writes.push(payload)
      return writes.length === 1
        ? { status: 'conflict' as const, expectedRevision: 2, currentRevision: 3 }
        : { status: 'saved' as const, revision: 4 }
    })
    const load = vi.fn(async () => ({
      maps: [map({
        id: 'map-1',
        tokens: [token({ id: 'enemy', type: 'enemy', x: 275, hp: 9, maxHp: 12 })],
      })],
      selectedId: 'map-1',
      updatedAt: 1_050,
    }))

    const outcome = await saveMapsStateWithPendingHitPointRetry({
      payload: {
        maps: [map({
          id: 'map-1',
          tokens: [token({ id: 'enemy', type: 'enemy', x: 25, hp: 4, maxHp: 12 })],
        })],
        selectedId: 'map-1',
        updatedAt: 1_001,
      },
      retryPendingHitPoints: true,
      save,
      load,
      now: () => 1_051,
    })

    expect(outcome.result).toMatchObject({ status: 'saved', revision: 4 })
    expect(save).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledTimes(1)
    expect(writes[1].maps[0].tokens[0]).toMatchObject({ x: 275, hp: 4, maxHp: 12 })
  })
})
