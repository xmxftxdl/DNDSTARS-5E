import { beforeEach, describe, expect, it } from 'vitest'

import type { BattleMap } from './maps'
import { useMapStore } from './maps'

function map(tokens: BattleMap['tokens'] = []): BattleMap {
  return {
    id: 'map-character-placement',
    name: 'Character placement',
    width: 800,
    height: 600,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

describe('map character token placement', () => {
  beforeEach(() => {
    useMapStore.setState({ maps: [], selectedId: null })
  })

  it('places a character once on a map', () => {
    useMapStore.setState({ maps: [map()], selectedId: 'map-character-placement' })

    useMapStore.getState().addCharacterToken('map-character-placement', {
      characterId: 'wizard',
      name: 'Wizard',
      emoji: '🧙',
    })

    expect(useMapStore.getState().maps[0]?.tokens).toHaveLength(1)
    expect(useMapStore.getState().maps[0]?.tokens[0]).toMatchObject({
      characterId: 'wizard',
      label: 'Wizard',
      type: 'player',
    })
  })

  it('rejects a duplicate token for the same character on the same map', () => {
    useMapStore.setState({
      maps: [map([{
        id: 'wizard-token',
        label: 'Wizard',
        x: 400,
        y: 300,
        color: '#34d399',
        emoji: '🧙',
        size: 1,
        type: 'player',
        characterId: 'wizard',
      }])],
      selectedId: 'map-character-placement',
    })

    useMapStore.getState().addCharacterToken('map-character-placement', {
      characterId: 'wizard',
      name: 'Wizard',
      emoji: '🧙',
    })

    expect(useMapStore.getState().maps[0]?.tokens.map((token) => token.id))
      .toEqual(['wizard-token'])
  })
})
