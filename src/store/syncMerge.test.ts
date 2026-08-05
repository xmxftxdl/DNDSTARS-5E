import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingLocalFighterChoicesForTest,
  clearPendingLocalClassChoicesForTest,
  clearPendingLocalPluginFeaturesForTest,
  clearPendingLocalCharacterLevelEditsForTest,
  clearPendingLocalCharacterHitPointEditsForTest,
  clearPendingLocalCharacterClassResourceEditsForTest,
  clearPendingLocalCharacterCreationsForTest,
  clearPendingLocalAdvancementsForTest,
  filterLegacySampleCharacters,
  mergeCharactersForSharedSave,
  mergePendingLocalFighterChoices,
  mergePendingLocalClassChoices,
  mergePendingLocalPluginFeatures,
  mergePendingLocalCharacterLevelEdits,
  mergePendingLocalCharacterHitPointEdits,
  mergePendingLocalCharacterClassResourceEdits,
  mergePendingLocalAdvancements,
  mergePlayerWritableCharacter,
  markPendingLocalCharacterLevelEdit,
  markPendingLocalCharacterHitPointEdit,
  markPendingLocalCharacterClassResourceEdit,
  markPendingLocalFighterChoices,
  markPendingLocalClassChoices,
  markPendingLocalPluginFeatures,
  markPendingLocalAdvancements,
  resetPendingLocalFighterChoicesMemoryForTest,
  resetPendingLocalClassChoicesMemoryForTest,
  resetPendingLocalPluginFeaturesMemoryForTest,
  resetPendingLocalCharacterLevelEditMemoryForTest,
  resetPendingLocalCharacterHitPointEditMemoryForTest,
  resetPendingLocalCharacterClassResourceEditMemoryForTest,
  resetPendingLocalAdvancementsMemoryForTest,
  shouldApplySharedCharactersSnapshot,
  useCharacterStore,
} from './characters'
import {
  clearPendingLocalTokenHitPointEditsForTest,
  committedTokenAnchorProjectionFromSharedMaps,
  createLatestMapsPublishPump,
  committedTokenPatchFromSharedMaps,
  markPendingLocalTokenHitPointEdit,
  mergePendingLocalTokenHitPointEdits,
  mergePlayerTokenCombatFields,
  resetPendingLocalTokenHitPointEditMemoryForTest,
  saveMapsStateWithPendingHitPointRetry,
  saveMapsStateWithTokenPatchRetry,
  type BattleMap,
  type Dnd5ePluginArea,
  type Token,
  useMapStore,
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

function anchoredArea(patch: Partial<Dnd5ePluginArea> = {}): Dnd5ePluginArea {
  return {
    id: 'sphere-area',
    pluginId: 'srd-5.1',
    featureId: 'srd-5.1:spell:flaming-sphere',
    sourceKind: 'core-spell',
    coreSpellId: 'flaming-sphere',
    label: '炽焰法球',
    color: '#f97316',
    sourceCharacterId: 'wizard',
    sourceTokenId: 'wizard-token',
    cells: [{ col: 1, row: 1 }],
    createdRound: 1,
    expiresAfterRound: 11,
    concentrationId: 'flaming-sphere',
    anchorMode: 'effect-token',
    anchorTokenId: 'sphere',
    anchorCell: { col: 1, row: 1 },
    vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
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

  it('keeps the shared concentration boolean aligned with its authoritative combat state', () => {
    const started = mergePlayerWritableCharacter(
      char({ concentrating: false, dnd5eCombatState: undefined }),
      char({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'flaming-sphere' },
      }),
    )
    expect(started.concentrating).toBe(true)
    expect(started.dnd5eCombatState?.concentrationSpellId).toBe('flaming-sphere')

    const ended = mergePlayerWritableCharacter(
      started,
      char({ concentrating: false, dnd5eCombatState: {} }),
    )
    expect(ended.concentrating).toBe(false)
    expect(ended.dnd5eCombatState?.concentrationSpellId).toBeUndefined()

    const manual = mergePlayerWritableCharacter(
      char({ concentrating: true, dnd5eCombatState: {} }),
      char({ concentrating: false, dnd5eCombatState: {} }),
    )
    expect(manual.concentrating).toBe(true)
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

  it('keeps a room-authority HP update protected during its server save window', () => {
    useCharacterStore.setState({
      characters: [char({ currentHp: 20, maxHp: 40 })],
      selectedId: 'hero',
    })
    useCharacterStore.getState().applyAuthorityUpdate(
      'hero',
      { currentHp: 21, maxHp: 40 },
      { protectHitPointsUntilAcknowledged: true },
    )

    expect(mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 20, maxHp: 40 })],
    )[0].currentHp).toBe(21)
    expect(mergePendingLocalCharacterHitPointEdits(
      [char({ currentHp: 21, maxHp: 40 })],
    )[0].currentHp).toBe(21)
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

describe('pending local character class-resource edits', () => {
  afterEach(() => {
    clearPendingLocalCharacterClassResourceEditsForTest()
    vi.unstubAllGlobals()
  })

  it('keeps Arcane Recovery and restored spell slots until the room acknowledges them', () => {
    const recovered = {
      'dnd5e-arcane-recovery': { current: 0, max: 1 },
      'dnd5e-spell-slot-1': { current: 3, max: 4 },
    }
    markPendingLocalCharacterClassResourceEdit('hero', recovered, 1_000)

    const stale = mergePendingLocalCharacterClassResourceEdits([char({
      classResources: {
        'dnd5e-arcane-recovery': { current: 1, max: 1 },
        'dnd5e-spell-slot-1': { current: 2, max: 4 },
      },
    })], 1_001)[0]
    expect(stale.classResources).toEqual(recovered)

    const acknowledged = mergePendingLocalCharacterClassResourceEdits([
      char({ classResources: recovered }),
    ], 1_002)[0]
    expect(acknowledged.classResources).toEqual(recovered)
    expect(mergePendingLocalCharacterClassResourceEdits([char({
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })], 1_003)[0].classResources).toEqual({
      'dnd5e-spell-slot-1': { current: 1, max: 4 },
    })
  })

  it('restores the pending resource choice after a page reload', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    })
    clearPendingLocalCharacterClassResourceEditsForTest()
    markPendingLocalCharacterClassResourceEdit('hero', {
      'dnd5e-arcane-recovery': { current: 0, max: 1 },
    }, 1_000)
    resetPendingLocalCharacterClassResourceEditMemoryForTest()

    expect(mergePendingLocalCharacterClassResourceEdits([char({
      classResources: { 'dnd5e-arcane-recovery': { current: 1, max: 1 } },
    })], 1_001)[0].classResources?.['dnd5e-arcane-recovery'].current).toBe(0)
  })
})

describe('character shared snapshot ordering', () => {
  it('accepts a newer server revision even when the DM wall clock is behind the player', () => {
    expect(shouldApplySharedCharactersSnapshot({
      incomingRevision: 84,
      lastAppliedRevision: 83,
      incomingUpdatedAt: 1_000,
      lastAppliedUpdatedAt: 9_000,
    })).toBe(true)
  })

  it('rejects an older revision even when its client timestamp is later', () => {
    expect(shouldApplySharedCharactersSnapshot({
      incomingRevision: 83,
      lastAppliedRevision: 84,
      incomingUpdatedAt: 9_000,
      lastAppliedUpdatedAt: 1_000,
    })).toBe(false)
  })

  it('uses timestamps only for legacy snapshots without server revisions', () => {
    expect(shouldApplySharedCharactersSnapshot({
      incomingUpdatedAt: 1_000,
      lastAppliedUpdatedAt: 9_000,
    })).toBe(false)
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

describe('pending local level advancement receipts', () => {
  afterEach(() => {
    clearPendingLocalAdvancementsForTest()
    vi.unstubAllGlobals()
  })

  it('keeps an immutable advancement receipt until the shared snapshot acknowledges it', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } })
    clearPendingLocalAdvancementsForTest()

    const base = char({ id: 'hero' })
    const record = {
      schemaVersion: 1 as const,
      id: 'adv-1',
      fromLevel: 1,
      toLevel: 2,
      classId: 'fighter' as const,
      fromClassLevel: 1,
      toClassLevel: 2,
      completedAt: 1_000,
      completedBy: 'player' as const,
      decision: {
        schemaVersion: 1 as const,
        classId: 'fighter' as const,
        levelsGained: 1,
        hitPointMethod: 'fixed' as const,
        hitPointRolls: [],
        asiChoices: [],
        fighterFightingStyles: ['archery' as const],
      },
      grantedFeatureIds: ['action-surge-1'],
      before: {
        level: 1,
        dnd5eClassLevels: { fighter: 1 },
        abilities: { ...base.abilities },
        skills: [...(base.skills ?? [])],
        maxHp: base.maxHp,
        currentHp: base.currentHp,
      },
      after: {
        level: 2,
        dnd5eClassLevels: { fighter: 2 },
        abilities: { ...base.abilities, str: 18 },
        skills: [...(base.skills ?? []), 'perception'],
        dnd5eFeatIds: ['srd5.1:grappler'],
        maxHp: base.maxHp + 6,
        currentHp: base.currentHp + 6,
      },
    }
    markPendingLocalAdvancements('hero', [record], 1_000)
    resetPendingLocalAdvancementsMemoryForTest()

    const merged = mergePendingLocalAdvancements([
      char({ id: 'hero', dnd5eLevelAdvancements: [] }),
    ], 1_001)[0]
    expect(merged.dnd5eLevelAdvancements).toEqual([record])
    expect(merged.level).toBe(2)
    expect(merged.dnd5eClassLevels).toEqual({ fighter: 2 })
    expect(merged.abilities.str).toBe(18)
    expect(merged.skills).toContain('perception')
    expect(merged.dnd5eFeatIds).toEqual(['srd5.1:grappler'])
    expect(merged.maxHp).toBe(record.after.maxHp)
    expect(merged.currentHp).toBe(record.after.currentHp)
    expect(values.size).toBe(1)

    expect(mergePendingLocalAdvancements([
      char({
        id: 'hero',
        level: record.after.level,
        dnd5eClassLevels: { ...record.after.dnd5eClassLevels },
        abilities: { ...record.after.abilities },
        skills: [...record.after.skills],
        dnd5eFeatIds: [...(record.after.dnd5eFeatIds ?? [])],
        maxHp: record.after.maxHp,
        currentHp: record.after.currentHp,
        dnd5eLevelAdvancements: [record],
      }),
    ], 1_002)[0].dnd5eLevelAdvancements).toEqual([record])
    expect(values.size).toBe(0)
  })
})

describe('T13/AC6 mergePlayerTokenCombatFields preserves DM-authoritative token positions', () => {
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

  it('takes an authoritative forced-movement position for a player-type token', () => {
    const localMap = map({ tokens: [token({
      id: 'p1', type: 'player', x: 120, y: 130, elevationFeet: 40, hp: 20, maxHp: 30,
    })] })
    const sharedMap = map({ tokens: [token({
      id: 'p1', type: 'player', x: 999, y: 888, elevationFeet: 0, hp: 15, maxHp: 30,
    })] })
    const [result] = mergePlayerTokenCombatFields([localMap], [sharedMap])
    const p1 = result.tokens.find((t) => t.id === 'p1')!
    // 玩家端旧快照不能覆盖 DM 已结算的强制位移。
    expect(p1.x).toBe(999)
    expect(p1.y).toBe(888)
    expect(p1.elevationFeet).toBe(0)
    // 战斗字段（hp 等）同样取 DM 权威值。
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

  it('在房间权威保存完成前保护怪物 HP，不接受旧地图快照回滚', () => {
    useMapStore.setState({
      maps: [map({
        id: 'map-1',
        tokens: [token({ id: 'enemy', type: 'enemy', hp: 20, maxHp: 40 })],
      })],
      selectedId: 'map-1',
    })
    useMapStore.getState().applyAuthorityTokenUpdate(
      'map-1',
      'enemy',
      { hp: 21, maxHp: 40 },
      { protectHitPointsUntilAcknowledged: true },
    )

    expect(mergePendingLocalTokenHitPointEdits([
      map({
        id: 'map-1',
        tokens: [token({ id: 'enemy', type: 'enemy', hp: 20, maxHp: 40 })],
      }),
    ])[0].tokens[0].hp).toBe(21)
    expect(mergePendingLocalTokenHitPointEdits([
      map({
        id: 'map-1',
        tokens: [token({ id: 'enemy', type: 'enemy', hp: 21, maxHp: 40 })],
      }),
    ])[0].tokens[0].hp).toBe(21)
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

describe('地图 Token 权威补丁重试', () => {
  it('从胜出的 CAS 载荷重建提交字段，避免释放预览时暴露旧坐标', () => {
    const committed = committedTokenPatchFromSharedMaps(
      [map({
        id: 'map-1',
        tokens: [token({
          id: 'monster',
          x: 575,
          y: 325,
          elevationFeet: 15,
          hp: 9,
        }),
        ],
      })],
      'map-1',
      'monster',
      { x: 575, y: 325, elevationFeet: 15, movementAnimation: undefined },
    )

    expect(committed).toEqual({
      x: 575,
      y: 325,
      elevationFeet: 15,
      movementAnimation: undefined,
    })
    expect(committed).not.toHaveProperty('hp')
  })

  it('普通 Token 移动不会重写无关的持续区域', async () => {
    const unrelatedArea = anchoredArea()
    const save = vi.fn(async () => ({ status: 'saved' as const, revision: 2 }))
    const outcome = await saveMapsStateWithTokenPatchRetry({
      payload: {
        maps: [map({
          id: 'map-1',
          tokens: [
            token({ id: 'monster', type: 'enemy', x: 75, y: 75 }),
            token({ id: 'sphere', type: 'obstacle', x: 75, y: 75 }),
          ],
          dnd5ePluginAreas: [unrelatedArea],
        })],
        selectedId: 'map-1',
        updatedAt: 1_000,
      },
      mapId: 'map-1',
      tokenId: 'monster',
      patch: { x: 225, y: 175 },
      save,
      load: vi.fn(async () => null),
    })

    expect(outcome.payload.maps[0].tokens.find((candidate) => candidate.id === 'monster'))
      .toMatchObject({ x: 225, y: 175 })
    expect(outcome.payload.maps[0].dnd5ePluginAreas).toEqual([unrelatedArea])
  })

  it('首次保存效果 Token 移动时原子重锚区域并投影胜出快照', async () => {
    const sphereEffect = {
      schemaVersion: 1 as const,
      spellId: 'flaming-sphere',
      sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token',
      createdRound: 1,
      expiresAfterRound: 11,
      concentrationId: 'flaming-sphere',
    }
    const original = map({
      id: 'map-1',
      tokens: [token({
        id: 'sphere', type: 'obstacle', x: 75, y: 75, elevationFeet: 0,
        dnd5eSpellEffect: sphereEffect,
      })],
      dnd5ePluginAreas: [anchoredArea()],
    })
    const save = vi.fn(async () => ({ status: 'saved' as const, revision: 3 }))
    const outcome = await saveMapsStateWithTokenPatchRetry({
      payload: { maps: [original], selectedId: 'map-1', updatedAt: 1_000 },
      mapId: 'map-1',
      tokenId: 'sphere',
      patch: { x: 225, y: 175, elevationFeet: 20 },
      save,
      load: vi.fn(async () => null),
    })

    const committedMap = outcome.payload.maps[0]
    expect(committedMap.tokens[0]).toMatchObject({ x: 225, y: 175, elevationFeet: 20 })
    expect(committedMap.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 4, row: 3 },
      cells: [{ col: 4, row: 3 }],
      vertical: { mode: 'volume', baseElevationFeet: 20, heightFeet: 10 },
    })

    const projection = committedTokenAnchorProjectionFromSharedMaps(
      original,
      outcome.payload.maps,
      'sphere',
      { x: 225, y: 175, elevationFeet: 20 },
    )
    expect(projection?.tokens[0]).toMatchObject({ x: 225, y: 175, elevationFeet: 20 })
    expect(projection?.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 4, row: 3 },
      cells: [{ col: 4, row: 3 }],
    })
  })

  it('本地权威位置投影在保存完成前已同步效果 Token 与区域', () => {
    useMapStore.setState({
      maps: [map({
        id: 'map-1',
        tokens: [token({ id: 'sphere', type: 'obstacle', x: 75, y: 75 })],
        dnd5ePluginAreas: [anchoredArea()],
      })],
      selectedId: 'map-1',
    })

    useMapStore.getState().applyAuthorityTokenUpdate('map-1', 'sphere', {
      x: 275,
      y: 125,
      elevationFeet: 10,
    })

    const current = useMapStore.getState().maps[0]
    expect(current.tokens[0]).toMatchObject({ x: 275, y: 125, elevationFeet: 10 })
    expect(current.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 5, row: 2 },
      cells: [{ col: 5, row: 2 }],
      vertical: { mode: 'volume', baseElevationFeet: 10, heightFeet: 10 },
    })
  })

  it('CAS 冲突后保留服务端其它 Token 的移动并重放当前移动', async () => {
    const writes: Array<{ maps: BattleMap[]; selectedId: string | null; updatedAt?: number }> = []
    const save = vi.fn(async (payload) => {
      writes.push(payload)
      return writes.length === 1
        ? { status: 'conflict' as const, expectedRevision: 7, currentRevision: 8 }
        : { status: 'saved' as const, revision: 9 }
    })
    const load = vi.fn(async () => ({
      maps: [map({
        id: 'map-1',
        tokens: [
          token({ id: 'player', type: 'player', x: 425, y: 325 }),
          token({ id: 'monster', type: 'enemy', x: 500, y: 300 }),
        ],
      })],
      selectedId: 'map-1',
      updatedAt: 1_050,
    }))

    const outcome = await saveMapsStateWithTokenPatchRetry({
      payload: {
        maps: [map({
          id: 'map-1',
          tokens: [
            token({ id: 'player', type: 'player', x: 350, y: 300 }),
            token({ id: 'monster', type: 'enemy', x: 575, y: 325 }),
          ],
        })],
        selectedId: 'map-1',
        updatedAt: 1_001,
      },
      mapId: 'map-1',
      tokenId: 'monster',
      patch: { x: 575, y: 325 },
      save,
      load,
      now: () => 1_051,
    })

    expect(outcome.result).toMatchObject({ status: 'saved', revision: 9 })
    expect(save).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledTimes(1)
    expect(writes[1].maps[0].tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'player', x: 425, y: 325 }),
      expect.objectContaining({ id: 'monster', x: 575, y: 325 }),
    ]))
  })

  it('效果 Token 在 CAS 冲突重试后按服务端最新区域再次重锚', async () => {
    const writes: Array<{ maps: BattleMap[]; selectedId: string | null; updatedAt?: number }> = []
    const save = vi.fn(async (payload) => {
      writes.push(payload)
      return writes.length === 1
        ? { status: 'conflict' as const, expectedRevision: 10, currentRevision: 11 }
        : { status: 'saved' as const, revision: 12 }
    })
    const remoteArea = anchoredArea({
      anchorCell: { col: 3, row: 2 },
      cells: [{ col: 3, row: 2 }, { col: 4, row: 2 }],
      triggerReceipts: [{
        triggerId: 'remote-trigger', targetTokenId: 'player', round: 2,
        transactionId: 'remote-transaction',
      }],
    })
    const load = vi.fn(async () => ({
      maps: [map({
        id: 'map-1',
        tokens: [
          token({ id: 'player', type: 'player', x: 425, y: 325 }),
          token({ id: 'sphere', type: 'obstacle', x: 175, y: 125, elevationFeet: 5 }),
        ],
        dnd5ePluginAreas: [remoteArea],
      })],
      selectedId: 'map-1',
      updatedAt: 2_000,
    }))

    const outcome = await saveMapsStateWithTokenPatchRetry({
      payload: {
        maps: [map({
          id: 'map-1',
          tokens: [token({ id: 'sphere', type: 'obstacle', x: 75, y: 75 })],
          dnd5ePluginAreas: [anchoredArea()],
        })],
        selectedId: 'map-1',
        updatedAt: 1_000,
      },
      mapId: 'map-1',
      tokenId: 'sphere',
      patch: { x: 325, y: 225, elevationFeet: 15 },
      save,
      load,
      now: () => 2_001,
    })

    expect(outcome.result).toMatchObject({ status: 'saved', revision: 12 })
    expect(save).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledTimes(1)
    expect(writes[1].maps[0].tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'player', x: 425, y: 325 }),
      expect.objectContaining({ id: 'sphere', x: 325, y: 225, elevationFeet: 15 }),
    ]))
    expect(writes[1].maps[0].dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 6, row: 4 },
      cells: [{ col: 6, row: 4 }, { col: 7, row: 4 }],
      triggerReceipts: [{
        triggerId: 'remote-trigger', targetTokenId: 'player', round: 2,
        transactionId: 'remote-transaction',
      }],
      vertical: { mode: 'volume', baseElevationFeet: 15, heightFeet: 10 },
    })
  })

  it('目标已被服务端删除时 fail closed，不会重新创建 Token', async () => {
    const save = vi.fn(async () => (
      { status: 'conflict' as const, expectedRevision: 2, currentRevision: 3 }
    ))
    const load = vi.fn(async () => ({
      maps: [map({ id: 'map-1', tokens: [] })],
      selectedId: 'map-1',
      updatedAt: 2_000,
    }))

    await expect(saveMapsStateWithTokenPatchRetry({
      payload: {
        maps: [map({
          id: 'map-1',
          tokens: [token({ id: 'monster', x: 500, y: 300 })],
        })],
        selectedId: 'map-1',
        updatedAt: 1_000,
      },
      mapId: 'map-1',
      tokenId: 'monster',
      patch: { x: 575, y: 325 },
      save,
      load,
    })).rejects.toThrow('map-token-patch-target-missing-after-conflict')
  })
})

describe('地图共享发布 latest-wins 泵', () => {
  it('排队旧快照不会在外部权威提交后覆盖最新 Store 状态', async () => {
    let releaseFirstSave!: () => void
    const firstSaveBlocked = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const persisted: Array<{ x: number }> = []
    let latest = { x: 10 }
    const persist = vi.fn(async (value: { x: number }) => {
      persisted.push(value)
      if (persisted.length === 1) await firstSaveBlocked
    })
    const publish = createLatestMapsPublishPump(persist, () => latest)

    const first = publish({ x: 10 })
    const staleTrailing = publish({ x: 20 })
    latest = { x: 30 }

    releaseFirstSave()
    await Promise.all([first, staleTrailing])

    expect(persisted).toEqual([{ x: 10 }, { x: 30 }])
  })

  it('连续 20 次 HP 更新最多保留一笔处理中和一笔最新待处理保存', async () => {
    let releaseFirstSave!: () => void
    const firstSaveBlocked = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const persisted: Array<{ hp: number }> = []
    const persist = vi.fn(async (value: { hp: number }) => {
      persisted.push(value)
      if (persisted.length === 1) await firstSaveBlocked
    })
    const publish = createLatestMapsPublishPump(persist)

    const requests = Array.from({ length: 20 }, (_, index) =>
      publish({ hp: index + 1 }, { retryPendingHitPoints: true }))

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persisted).toEqual([{ hp: 1 }])

    releaseFirstSave()
    await Promise.all(requests)

    expect(persist).toHaveBeenCalledTimes(2)
    expect(persisted).toEqual([{ hp: 1 }, { hp: 20 }])
  })

  it('requireSaved 会跨过失败的当前代并等待更新代真正保存成功', async () => {
    let releaseFirstSave!: () => void
    let releaseLatestSave!: () => void
    const firstSaveBlocked = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const latestSaveBlocked = new Promise<void>((resolve) => {
      releaseLatestSave = resolve
    })
    let attempt = 0
    const persist = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) {
        await firstSaveBlocked
        throw new Error('first-save-failed')
      }
      await latestSaveBlocked
    })
    const publish = createLatestMapsPublishPump(persist)
    let durableState: 'pending' | 'resolved' | 'rejected' = 'pending'

    const durable = publish({ hp: 4 }, { requireSaved: true }).then(
      () => { durableState = 'resolved' },
      (error) => {
        durableState = 'rejected'
        throw error
      },
    )
    const newer = publish({ hp: 3 })

    releaseFirstSave()
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2))
    await Promise.resolve()
    expect(durableState).toBe('pending')

    releaseLatestSave()
    await Promise.all([durable, newer])
    expect(durableState).toBe('resolved')
  })
})
