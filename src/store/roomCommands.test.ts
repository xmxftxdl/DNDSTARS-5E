import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomCommandEnvelope } from '../lib/roomCommandBus'
import { saveSharedResourcesAtomically } from '../lib/sharedApi'
import {
  appRoomCommandBus,
  moveRoomToken,
  mutateRoomCharacterInventory,
  planRoomSpellEffectRemoval,
  removeRoomSpellEffectToken,
  replaceRoomCombatantActiveEffects,
  replaceRoomCharacterSpellSelections,
  isEditableDnd5eSpellSlotResourceKey,
  setRoomMonsterBerserk,
  spendRoomCharacterClassResources,
  setRoomCharacterHitPoints,
  setRoomCharacterSpellSlot,
} from './roomCommands'
import {
  clearPendingLocalCharacterHitPointEditsForTest,
  normalizeCharacter,
  useCharacterStore,
} from './characters'
import {
  clearPendingLocalTokenHitPointEditsForTest,
  mergePendingLocalTokenHitPointEdits,
  useMapStore,
  type BattleMap,
} from './maps'

vi.mock('../lib/sharedApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sharedApi')>()
  return {
    ...actual,
    saveSharedResourcesAtomically: vi.fn(),
  }
})

function aggregateIds(command: RoomCommandEnvelope): string[] {
  return [command.aggregateId, ...(command.relatedAggregateIds ?? [])]
}

describe('room command aggregate routing', () => {
  beforeEach(() => {
    clearPendingLocalCharacterHitPointEditsForTest()
    useCharacterStore.setState({ characters: [], selectedId: null })
    useMapStore.setState({ maps: [], selectedId: null })
    vi.spyOn(appRoomCommandBus, 'dispatch').mockResolvedValue({ status: 'submitted' })
    vi.spyOn(appRoomCommandBus, 'dispatchLatest').mockResolvedValue({ status: 'submitted' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps linked character HP, token movement, spells, and inventory ordered', async () => {
    useMapStore.setState({
      maps: [{
        id: 'map-a',
        tokens: [{ id: 'token-a', characterId: 'character-a' }],
      } as unknown as BattleMap],
    })

    await setRoomCharacterHitPoints({
      characterId: 'character-a',
      mapId: 'map-a',
      tokenId: 'token-a',
      currentHp: 7,
      maxHp: 10,
    })
    await moveRoomToken({
      mapId: 'map-a',
      tokenId: 'token-a',
      x: 10,
      y: 20,
    })
    await replaceRoomCharacterSpellSelections('character-a', {
      dnd5eClassChoices: undefined,
    })
    await replaceRoomCombatantActiveEffects({
      characterId: 'character-a',
      mapId: 'map-a',
      tokenId: 'token-a',
      activeEffects: [],
    })
    await setRoomMonsterBerserk({
      mapId: 'map-a',
      tokenId: 'token-a',
      active: true,
    })
    await mutateRoomCharacterInventory({
      type: 'grant',
      characterId: 'character-a',
      templateId: 'item-a',
      quantity: 1,
    })

    const commands = [
      vi.mocked(appRoomCommandBus.dispatchLatest).mock.calls[0][0],
      ...vi.mocked(appRoomCommandBus.dispatch).mock.calls.map(([command]) => command),
    ]
    const characterAggregate = 'room:characters:character-a'
    const tokenAggregate = 'room:maps:map-a:tokens:token-a'

    expect(aggregateIds(commands[0])).toEqual([characterAggregate, tokenAggregate])
    expect(aggregateIds(commands[1])).toEqual([characterAggregate, tokenAggregate])
    expect(aggregateIds(commands[2])).toEqual([characterAggregate])
    expect(aggregateIds(commands[3])).toEqual([characterAggregate, tokenAggregate])
    expect(aggregateIds(commands[4])).toEqual([characterAggregate, tokenAggregate])
    expect(commands[4]).toMatchObject({ type: 'combat.monster-berserk.set', active: true })
    expect(aggregateIds(commands[5])).toEqual([characterAggregate])
  })

  it('orders HP and movement for one unlinked token without blocking another token', async () => {
    useMapStore.setState({
      maps: [{
        id: 'map-a',
        tokens: [
          { id: 'monster-a' },
          { id: 'monster-b' },
        ],
      } as unknown as BattleMap],
    })

    await setRoomCharacterHitPoints({
      mapId: 'map-a',
      tokenId: 'monster-a',
      currentHp: 5,
      maxHp: 10,
    })
    await moveRoomToken({
      mapId: 'map-a',
      tokenId: 'monster-a',
      x: 10,
      y: 20,
    })
    await moveRoomToken({
      mapId: 'map-a',
      tokenId: 'monster-b',
      x: 30,
      y: 40,
    })

    const commands = [
      vi.mocked(appRoomCommandBus.dispatchLatest).mock.calls[0][0],
      ...vi.mocked(appRoomCommandBus.dispatch).mock.calls.map(([command]) => command),
    ]

    expect(aggregateIds(commands[0])).toEqual(['room:maps:map-a:tokens:monster-a'])
    expect(aggregateIds(commands[1])).toEqual(['room:maps:map-a:tokens:monster-a'])
    expect(aggregateIds(commands[2])).toEqual(['room:maps:map-a:tokens:monster-b'])
  })

  it('locks both characters involved in an inventory transfer', async () => {
    await mutateRoomCharacterInventory({
      type: 'transfer',
      characterId: 'character-a',
      targetCharacterId: 'character-b',
      instanceId: 'item-a',
      quantity: 1,
    })

    const [command] = vi.mocked(appRoomCommandBus.dispatch).mock.calls[0]
    expect(aggregateIds(command)).toEqual([
      'room:characters:character-a',
      'room:characters:character-b',
    ])
  })

  it('orders an effect-entity removal with both its caster and Token aggregates', async () => {
    useMapStore.setState({
      maps: [{
        id: 'map-sphere',
        tokens: [{
          id: 'sphere-token',
          dnd5eSpellEffect: {
            schemaVersion: 1,
            spellId: 'flaming-sphere',
            sourceCharacterId: 'caster',
            sourceTokenId: 'caster-token',
            createdRound: 1,
            expiresAfterRound: 11,
            concentrationId: 'flaming-sphere',
          },
        }],
      } as unknown as BattleMap],
    })

    await removeRoomSpellEffectToken({ mapId: 'map-sphere', tokenId: 'sphere-token' })

    const [command] = vi.mocked(appRoomCommandBus.dispatch).mock.calls[0]
    expect(command.type).toBe('map.spell-effect.remove')
    expect(aggregateIds(command)).toEqual([
      'room:characters:caster',
      'room:maps:map-sphere:tokens:sphere-token',
      'room:maps:map-sphere:tokens:caster-token',
    ])
  })
})

describe('spell slot room command authority', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [normalizeCharacter({
        id: 'wizard-a',
        name: '法师',
        charClass: '法师',
        level: 5,
        dnd5eClassLevels: { wizard: 5 },
        classResources: {
          'dnd5e-spell-slot-1': { current: 4, max: 4 },
        },
      })],
      selectedId: 'wizard-a',
    })
    vi.spyOn(useCharacterStore.getState(), 'saveSharedNow').mockResolvedValue(Date.now())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lets the authority command change only the current count', async () => {
    const result = await setRoomCharacterSpellSlot({
      characterId: 'wizard-a',
      resourceKey: 'dnd5e-spell-slot-1',
      current: 2,
    })

    expect(result.status).toBe('applied')
    expect(useCharacterStore.getState().characters[0].classResources?.['dnd5e-spell-slot-1']).toEqual({
      current: 2,
      max: 4,
    })
  })

  it('rejects an over-maximum value and non-slot resources', async () => {
    const excessive = await setRoomCharacterSpellSlot({
      characterId: 'wizard-a',
      resourceKey: 'dnd5e-spell-slot-1',
      current: 5,
    })
    const unrelated = await setRoomCharacterSpellSlot({
      characterId: 'wizard-a',
      resourceKey: 'dnd5e-arcane-recovery',
      current: 0,
    })

    expect(excessive.status).toBe('rejected')
    expect(unrelated.status).toBe('rejected')
    expect(useCharacterStore.getState().characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(4)
    expect(isEditableDnd5eSpellSlotResourceKey('dnd5e-pact-slot')).toBe(true)
    expect(isEditableDnd5eSpellSlotResourceKey('dnd5e-mystic-arcanum-6')).toBe(false)
  })
})

describe('class resource spend room command authority', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [normalizeCharacter({
        id: 'lucky-hero',
        name: '幸运角色',
        charClass: '法师',
        level: 5,
        dnd5eClassLevels: { wizard: 5 },
        classResources: {
          'dnd5e-spell-slot-1': { current: 3, max: 4 },
        },
      })],
      selectedId: 'lucky-hero',
    })
    vi.spyOn(useCharacterStore.getState(), 'saveSharedNow').mockResolvedValue(Date.now())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects an unavailable multi-resource cost without partially spending earlier entries', async () => {
    const rejected = await spendRoomCharacterClassResources({
      characterId: 'lucky-hero',
      costs: [
        { resourceKey: 'dnd5e-spell-slot-1', amount: 1 },
        { resourceKey: 'test.lucky:missing-resource', amount: 1 },
      ],
      transactionId: 'choice-reroll-rejected',
    })
    expect(rejected.status).toBe('rejected')
    expect(useCharacterStore.getState().characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(3)

    const applied = await spendRoomCharacterClassResources({
      characterId: 'lucky-hero',
      costs: [{ resourceKey: 'dnd5e-spell-slot-1', amount: 1 }],
      transactionId: 'choice-reroll-applied',
    })
    expect(applied.status).toBe('applied')
    expect(useCharacterStore.getState().characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(2)

    const replayed = await spendRoomCharacterClassResources({
      characterId: 'lucky-hero',
      costs: [{ resourceKey: 'dnd5e-spell-slot-1', amount: 1 }],
      transactionId: 'choice-reroll-applied',
    })
    expect(replayed.status).toBe('applied')
    expect(useCharacterStore.getState().characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(2)
  })

  it('spends character Inspiration atomically and does not double-spend a replayed transaction', async () => {
    useCharacterStore.getState().applyAuthorityUpdate('lucky-hero', { inspiration: 2 })

    const applied = await spendRoomCharacterClassResources({
      characterId: 'lucky-hero',
      costs: [{ resourceKey: 'dnd5e-core-inspiration', amount: 1 }],
      transactionId: 'core-inspiration-reroll',
    })
    expect(applied.status).toBe('applied')
    expect(useCharacterStore.getState().characters[0].inspiration).toBe(1)

    const replayed = await spendRoomCharacterClassResources({
      characterId: 'lucky-hero',
      costs: [{ resourceKey: 'dnd5e-core-inspiration', amount: 1 }],
      transactionId: 'core-inspiration-reroll',
    })
    expect(replayed.status).toBe('applied')
    expect(useCharacterStore.getState().characters[0].inspiration).toBe(1)
  })

  it('rolls back a mixed Inspiration and class-resource spend when either cost is unavailable', async () => {
    useCharacterStore.getState().applyAuthorityUpdate('lucky-hero', { inspiration: 1 })

    const rejected = await spendRoomCharacterClassResources({
      characterId: 'lucky-hero',
      costs: [
        { resourceKey: 'dnd5e-core-inspiration', amount: 1 },
        { resourceKey: 'test.missing:resource', amount: 1 },
      ],
      transactionId: 'mixed-inspiration-rejected',
    })
    expect(rejected.status).toBe('rejected')
    expect(useCharacterStore.getState().characters[0].inspiration).toBe(1)
  })
})

describe('spell effect removal planning', () => {
  const sphereMap = (): BattleMap => ({
    id: 'map-sphere',
    name: 'Sphere map',
    width: 500,
    height: 500,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [
      {
        id: 'caster-token', label: 'Caster', x: 25, y: 25, color: '#fff', emoji: 'C',
        size: 1, type: 'player', characterId: 'caster',
      },
      {
        id: 'sphere-token', label: '炽焰法球', x: 125, y: 125, color: '#f97316', emoji: '🔥',
        size: 1, type: 'obstacle',
        dnd5eSpellEffect: {
          schemaVersion: 1,
          spellId: 'flaming-sphere',
          sourceCharacterId: 'caster',
          sourceTokenId: 'caster-token',
          createdRound: 1,
          expiresAfterRound: 11,
          concentrationId: 'flaming-sphere',
        },
      },
    ],
    dnd5ePluginAreas: [{
      id: 'sphere-area',
      pluginId: 'srd-5.1',
      featureId: 'srd-5.1:spell:flaming-sphere',
      sourceKind: 'core-spell',
      coreSpellId: 'flaming-sphere',
      label: '炽焰法球',
      color: '#f97316',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      createdRound: 1,
      expiresAfterRound: 11,
      concentrationId: 'flaming-sphere',
      cells: [{ col: 2, row: 2 }],
      anchorMode: 'effect-token',
      anchorTokenId: 'sphere-token',
      anchorCell: { col: 2, row: 2 },
      relation: 'any',
      includeSelf: true,
      triggers: [],
    }],
  })

  it('atomically removes a battle-external sphere and ends only its matching current concentration', () => {
    const caster = {
      ...normalizeCharacter({
        id: 'caster',
        name: 'Wizard',
        dnd5eClassLevels: { wizard: 5 },
        level: 5,
      }),
      // The nested spell id is the concentration identity authority. The
      // legacy presentation boolean can temporarily lag behind shared state.
      concentrating: false,
      dnd5eCombatState: {
        concentrationSpellId: 'flaming-sphere',
        concentrationSpellLevel: 2,
        concentrationTargetIds: [],
        concentrationRoundsRemaining: 10,
      },
    }

    const plan = planRoomSpellEffectRemoval({
      map: sphereMap(),
      characters: [caster],
      tokenId: 'sphere-token',
    })

    expect(plan.status).toBe('removed')
    expect(plan.map.tokens.map((token) => token.id)).toEqual(['caster-token'])
    expect(plan.map.dnd5ePluginAreas).toEqual([])
    expect(plan.concentrationEndedCharacterId).toBe(caster.id)
    expect(plan.characters[0]).toMatchObject({ concentrating: false })
    expect(plan.characters[0]?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
    expect(planRoomSpellEffectRemoval({
      map: plan.map,
      characters: plan.characters,
      tokenId: 'sphere-token',
    }).status).toBe('missing')
  })

  it('does not clear a newer concentration when the stale sphere is deleted', () => {
    const caster = {
      ...normalizeCharacter({
        id: 'caster',
        name: 'Wizard',
        dnd5eClassLevels: { wizard: 5 },
        level: 5,
      }),
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'fly', concentrationSpellLevel: 3 },
    }

    const plan = planRoomSpellEffectRemoval({
      map: sphereMap(),
      characters: [caster],
      tokenId: 'sphere-token',
    })

    expect(plan.status).toBe('removed')
    expect(plan.concentrationEndedCharacterId).toBeUndefined()
    expect(plan.characters[0]?.concentrating).toBe(true)
    expect(plan.characters[0]?.dnd5eCombatState?.concentrationSpellId).toBe('fly')
  })

  it('removes any persistent spell entity without inventing a concentration cleanup', () => {
    const map = sphereMap()
    map.tokens[1] = {
      ...map.tokens[1],
      dnd5eSpellEffect: {
        ...map.tokens[1].dnd5eSpellEffect!,
        spellId: 'spiritual-weapon',
        concentrationId: undefined,
      },
    }

    const plan = planRoomSpellEffectRemoval({ map, characters: [], tokenId: 'sphere-token' })

    expect(plan.status).toBe('removed')
    expect(plan.concentrationEndedCharacterId).toBeUndefined()
    expect(plan.map.tokens.some((token) => token.id === 'sphere-token')).toBe(false)
    expect(plan.map.dnd5ePluginAreas).toHaveLength(0)
  })

  describe('authoritative command persistence', () => {
    const originalMapLoadShared = useMapStore.getState().loadShared
    const originalCharacterLoadShared = useCharacterStore.getState().loadShared
    const caster = () => ({
      ...normalizeCharacter({
        id: 'caster',
        name: 'Wizard',
        dnd5eClassLevels: { wizard: 5 },
        level: 5,
      }),
      concentrating: false,
      dnd5eCombatState: {
        concentrationSpellId: 'flaming-sphere',
        concentrationSpellLevel: 2,
      },
    })

    beforeEach(() => {
      useCharacterStore.setState({ characters: [caster()], selectedId: 'caster' })
      useMapStore.setState({ maps: [sphereMap()], selectedId: 'map-sphere' })
      vi.mocked(saveSharedResourcesAtomically).mockReset().mockResolvedValue({
        status: 'committed',
        transactionId: 'test-spell-effect-removal',
        revisions: { characters: 2, maps: 2 },
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      // Zustand's shallow `set` carries action function references into the
      // next state object. Restore them explicitly so a spy installed before
      // a store update cannot leak its call history into later test groups.
      useMapStore.setState({ loadShared: originalMapLoadShared })
      useCharacterStore.setState({ loadShared: originalCharacterLoadShared })
    })

    it('commits characters and maps in one shared transaction', async () => {
      await expect(removeRoomSpellEffectToken({
        mapId: 'map-sphere',
        tokenId: 'sphere-token',
      })).resolves.toEqual({ status: 'applied' })

      expect(saveSharedResourcesAtomically).toHaveBeenCalledTimes(1)
      const [resources] = vi.mocked(saveSharedResourcesAtomically).mock.calls[0]
      expect(resources.map((resource) => resource.name)).toEqual(['characters', 'maps'])
      expect(useMapStore.getState().maps[0]?.tokens.map((token) => token.id)).toEqual(['caster-token'])
      expect(useMapStore.getState().maps[0]?.dnd5ePluginAreas).toEqual([])
      expect(useCharacterStore.getState().characters[0]?.dnd5eCombatState?.concentrationSpellId)
        .toBeUndefined()
    })

    it('reloads both stores after an atomic save rejection without leaving a half-delete', async () => {
      const authoritativeMap = sphereMap()
      const authoritativeCaster = caster()
      const mapState = useMapStore.getState()
      const characterState = useCharacterStore.getState()
      vi.mocked(saveSharedResourcesAtomically).mockRejectedValueOnce(new Error('atomic-cas-rejected'))
      vi.spyOn(mapState, 'loadShared').mockImplementation(async () => {
        useMapStore.setState({ maps: [authoritativeMap], selectedId: authoritativeMap.id })
      })
      vi.spyOn(characterState, 'loadShared').mockImplementation(async () => {
        useCharacterStore.setState({ characters: [authoritativeCaster], selectedId: authoritativeCaster.id })
      })

      await expect(removeRoomSpellEffectToken({
        mapId: 'map-sphere',
        tokenId: 'sphere-token',
      })).rejects.toThrow('atomic-cas-rejected')

      expect(mapState.loadShared).toHaveBeenCalledTimes(1)
      expect(characterState.loadShared).toHaveBeenCalledTimes(1)
      expect(useMapStore.getState().maps[0]?.tokens.some((token) => token.id === 'sphere-token')).toBe(true)
      expect(useMapStore.getState().maps[0]?.dnd5ePluginAreas).toHaveLength(1)
      expect(useCharacterStore.getState().characters[0]?.dnd5eCombatState?.concentrationSpellId)
        .toBe('flaming-sphere')
    })
  })
})

describe('room command HP conflict recovery', () => {
  beforeEach(() => {
    clearPendingLocalCharacterHitPointEditsForTest()
    useCharacterStore.setState({ characters: [], selectedId: null })
    clearPendingLocalTokenHitPointEditsForTest()
    useMapStore.setState({ maps: [], selectedId: null })
  })

  afterEach(() => {
    clearPendingLocalCharacterHitPointEditsForTest()
    clearPendingLocalTokenHitPointEditsForTest()
    vi.restoreAllMocks()
  })

  it('reloads authoritative monster HP and releases a rejected optimistic guard', async () => {
    const initialMap = {
      id: 'map-hp-conflict',
      tokens: [{
        id: 'monster-hp-conflict',
        label: 'Monster',
        x: 0,
        y: 0,
        color: '#ef4444',
        emoji: 'M',
        type: 'enemy',
        hp: 10,
        maxHp: 10,
      }],
    } as unknown as BattleMap
    const authoritativeMap = {
      ...initialMap,
      tokens: initialMap.tokens.map((token) => ({ ...token, hp: 8 })),
    } as BattleMap
    useMapStore.setState({ maps: [initialMap], selectedId: initialMap.id })
    const state = useMapStore.getState()
    vi.spyOn(state, 'saveSharedNow').mockRejectedValue(new Error('maps-save-rejected:conflict'))
    vi.spyOn(state, 'loadShared').mockImplementation(async () => {
      useMapStore.setState({ maps: [authoritativeMap], selectedId: authoritativeMap.id })
    })

    await expect(setRoomCharacterHitPoints({
      mapId: initialMap.id,
      tokenId: initialMap.tokens[0].id,
      currentHp: 5,
      maxHp: 10,
    })).rejects.toThrow('maps-save-rejected:conflict')

    expect(state.loadShared).toHaveBeenCalledTimes(1)
    expect(useMapStore.getState().maps[0]?.tokens[0]?.hp).toBe(8)
    expect(mergePendingLocalTokenHitPointEdits([authoritativeMap])[0]?.tokens[0]?.hp).toBe(8)
  })

  it('projects a linked character HP edit to both stores before persistence settles', async () => {
    const character = {
      ...normalizeCharacter({
        id: 'character-immediate-hp',
        name: 'Wizard',
        dnd5eClassLevels: { fighter: 13 },
        level: 13,
      }),
      currentHp: 58,
      maxHp: 82,
      hitPointMaximumMode: 'fixed' as const,
    }
    const map = {
      id: 'map-immediate-hp',
      tokens: [{
        id: 'token-immediate-hp',
        characterId: character.id,
        label: character.name,
        x: 0,
        y: 0,
        color: '#14b8a6',
        emoji: 'W',
        type: 'player',
        hp: 58,
        maxHp: 82,
      }],
    } as unknown as BattleMap
    useCharacterStore.setState({ characters: [character], selectedId: character.id })
    useMapStore.setState({ maps: [map], selectedId: map.id })
    let settle!: (result: { status: 'submitted' }) => void
    const pending = new Promise<{ status: 'submitted' }>((resolve) => { settle = resolve })
    vi.spyOn(appRoomCommandBus, 'dispatchLatest').mockReturnValue(pending)

    const result = setRoomCharacterHitPoints({
      characterId: character.id,
      mapId: map.id,
      tokenId: map.tokens[0].id,
      currentHp: 80,
      maxHp: 82,
    })

    expect(useCharacterStore.getState().characters[0]?.currentHp).toBe(80)
    expect(useMapStore.getState().maps[0]?.tokens[0]?.hp).toBe(80)
    expect(appRoomCommandBus.dispatchLatest).toHaveBeenCalledTimes(1)

    settle({ status: 'submitted' })
    await expect(result).resolves.toEqual({ status: 'submitted' })
  })
})

describe('DM monster runtime status commands', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], selectedId: null })
    useMapStore.setState({
      maps: [{
        id: 'map-berserk',
        tokens: [{
          id: 'flesh-golem',
          label: '血肉魔像',
          x: 0,
          y: 0,
          color: '#ef4444',
          emoji: 'G',
          type: 'enemy',
          poolId: 'srd-5.1:flesh-golem',
        }],
      } as unknown as BattleMap],
      selectedId: 'map-berserk',
    })
    vi.spyOn(useMapStore.getState(), 'saveSharedNow').mockResolvedValue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds and removes berserk through the authoritative room command', async () => {
    await expect(setRoomMonsterBerserk({
      mapId: 'map-berserk',
      tokenId: 'flesh-golem',
      active: true,
    })).resolves.toEqual({ status: 'applied' })
    expect(useMapStore.getState().maps[0]?.tokens[0]?.dnd5eCombatState).toMatchObject({
      schemaVersion: 2,
      monsterBerserk: true,
    })

    await expect(setRoomMonsterBerserk({
      mapId: 'map-berserk',
      tokenId: 'flesh-golem',
      active: false,
    })).resolves.toEqual({ status: 'applied' })
    expect(useMapStore.getState().maps[0]?.tokens[0]?.dnd5eCombatState?.monsterBerserk)
      .toBeUndefined()
  })
})
