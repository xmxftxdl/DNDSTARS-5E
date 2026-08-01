import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomCommandEnvelope } from '../lib/roomCommandBus'
import {
  appRoomCommandBus,
  moveRoomToken,
  mutateRoomCharacterInventory,
  replaceRoomCombatantActiveEffects,
  replaceRoomCharacterSpellSelections,
  setRoomCharacterHitPoints,
} from './roomCommands'
import { useMapStore, type BattleMap } from './maps'

function aggregateIds(command: RoomCommandEnvelope): string[] {
  return [command.aggregateId, ...(command.relatedAggregateIds ?? [])]
}

describe('room command aggregate routing', () => {
  beforeEach(() => {
    useMapStore.setState({ maps: [], selectedId: null })
    vi.spyOn(appRoomCommandBus, 'dispatch').mockResolvedValue({ status: 'submitted' })
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
    await mutateRoomCharacterInventory({
      type: 'grant',
      characterId: 'character-a',
      templateId: 'item-a',
      quantity: 1,
    })

    const commands = vi.mocked(appRoomCommandBus.dispatch).mock.calls
      .map(([command]) => command)
    const characterAggregate = 'room:characters:character-a'
    const tokenAggregate = 'room:maps:map-a:tokens:token-a'

    expect(aggregateIds(commands[0])).toEqual([characterAggregate, tokenAggregate])
    expect(aggregateIds(commands[1])).toEqual([characterAggregate, tokenAggregate])
    expect(aggregateIds(commands[2])).toEqual([characterAggregate])
    expect(aggregateIds(commands[3])).toEqual([characterAggregate, tokenAggregate])
    expect(aggregateIds(commands[4])).toEqual([characterAggregate])
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

    const commands = vi.mocked(appRoomCommandBus.dispatch).mock.calls
      .map(([command]) => command)

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
})
