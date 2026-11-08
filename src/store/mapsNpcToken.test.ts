import { beforeEach, describe, expect, it } from 'vitest'
import { migrateMapsState, useMapStore, type BattleMap } from './maps'

const scene: BattleMap = {
  id: 'npc-scene', name: 'NPC scene', width: 800, height: 600,
  gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
}

describe('named NPC placement', () => {
  beforeEach(() => useMapStore.setState({ maps: [structuredClone(scene)], selectedId: scene.id }))

  it('preserves the name and shared portrait references across save and reload', () => {
    const id = useMapStore.getState().addToken(scene.id, 'npc', {
      label: '  酒馆老板艾琳  ', portraitImageId: 'npc_portrait_test', tokenPortraitImageId: 'npc_portrait_test',
    })
    expect(id).toBeTruthy()
    const snapshot = JSON.parse(JSON.stringify({ maps: useMapStore.getState().maps, selectedId: scene.id }))
    const restored = migrateMapsState(snapshot)
    expect(restored.maps[0].tokens).toHaveLength(1)
    expect(restored.maps[0].tokens[0]).toMatchObject({
      id, type: 'npc', label: '酒馆老板艾琳', portraitImageId: 'npc_portrait_test', tokenPortraitImageId: 'npc_portrait_test',
      hp: 12, maxHp: 12,
    })
  })

  it('allows a named NPC without a portrait and rejects a removed map', () => {
    const store = useMapStore.getState()
    expect(store.addToken('removed-map', 'npc', { label: '艾琳' })).toBeNull()
    expect(useMapStore.getState().maps[0].tokens).toHaveLength(0)
    expect(store.addToken(scene.id, 'npc', { label: '艾琳' })).toBeTruthy()
    expect(useMapStore.getState().maps[0].tokens[0]).toMatchObject({ type: 'npc', label: '艾琳' })
    expect(useMapStore.getState().maps[0].tokens[0].portraitImageId).toBeUndefined()
  })
})
