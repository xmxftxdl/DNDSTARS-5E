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

  it('keeps a removed fortress servant possession on the map exactly once', () => {
    const scene=map([{id:'servant',type:'obstacle',label:'Servant',x:100,y:150,elevationFeet:10.5,size:1,color:'',emoji:'',hp:1,
      dnd5eObjectState:{schemaVersion:1,structureBinding:{schemaVersion:1,mapId:'map-character-placement',structureId:'keep'}},
      dnd5eCarriedObjects:[{id:'held',pickupReceipt:'pickup:held',label:'Potion',objectState:{schemaVersion:1,wornOrCarried:true,
        inventoryItem:{templateId:'srd-5.1:item:potion-of-healing',quantity:1,receiptId:'held'}}}]}])
    useMapStore.setState({maps:[scene],selectedId:scene.id})
    useMapStore.getState().removeToken(scene.id,'servant')
    expect(useMapStore.getState().maps[0].tokens).toHaveLength(1)
    expect(useMapStore.getState().maps[0].tokens[0]).toMatchObject({id:'carried:held',x:100,y:150,elevationFeet:10.5,
      dnd5eObjectState:{wornOrCarried:false}})
    useMapStore.getState().removeToken(scene.id,'servant')
    expect(useMapStore.getState().maps[0].tokens).toHaveLength(1)
    expect(scene.tokens[0].dnd5eCarriedObjects).toHaveLength(1)
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
