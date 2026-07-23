import { describe, expect, it } from 'vitest'
import { createEmptyMapFog } from '../../lib/fogOfWar'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  buildMapExplorationUpdates,
  buildMapsFogGeometryProjection,
} from './mapsFogGeometryController'

function token(id: string, characterId: string, x: number): Token {
  return { id, characterId, label: id, x, y: 50, color: '#000', emoji: '', size: 1, type: 'player' }
}

const map: BattleMap = {
  id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
  tokens: [token('token-a', 'char-a', 50), token('token-b', 'char-b', 150)],
}

describe('地图迷雾与几何控制器', () => {
  it('组队视野使用全部玩家 Token，同时按当前成员读取历史探索区', () => {
    const geometry = createEmptyMapGeometry(map.id, 0)
    geometry.vision.enabled = true
    geometry.vision.sharePartyVision = true
    const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]

    const projection = buildMapsFogGeometryProjection({
      map,
      fogMaps: [{ ...createEmptyMapFog(map.id, 0), filled: true }],
      geometryMaps: [geometry],
      explorationMaps: [{
        mapId: map.id,
        updatedAt: 1,
        byMemberId: { memberA: { updatedAt: 1, polygons: [polygon] } },
      }],
      isDm: false,
      roomMemberId: 'memberA',
      controlledCharacterIds: ['char-a'],
    })

    expect(projection.visionSourceTokenIds).toEqual(['token-a', 'token-b'])
    expect(projection.exploredVisionPolygons).toEqual([polygon])
    expect(projection.manualFogExplorationEnabled).toBe(true)
  })

  it('关闭组队视野时只使用玩家控制的角色作为视野来源', () => {
    const geometry = createEmptyMapGeometry(map.id, 0)
    geometry.vision.sharePartyVision = false

    const projection = buildMapsFogGeometryProjection({
      map,
      fogMaps: [],
      geometryMaps: [geometry],
      explorationMaps: [],
      isDm: false,
      controlledCharacterIds: ['char-b'],
    })

    expect(projection.visionSourceTokenIds).toEqual(['token-b'])
    expect(projection.exploredVisionPolygons).toEqual([])
  })

  it('角色数据尚未同步时仍使用服务端标记的受控 Token 打开玩家视野', () => {
    const geometry = createEmptyMapGeometry(map.id, 0)
    geometry.vision.sharePartyVision = false
    const projectedMap = {
      ...map,
      tokens: map.tokens.map((entry) => ({
        ...entry,
        viewerControlled: entry.id === 'token-a',
      })),
    }

    const projection = buildMapsFogGeometryProjection({
      map: projectedMap,
      fogMaps: [{ ...createEmptyMapFog(map.id, 0), filled: true }],
      geometryMaps: [geometry],
      explorationMaps: [],
      isDm: false,
      controlledCharacterIds: [],
    })

    expect(projection.visionSourceTokenIds).toEqual(['token-a'])
  })

  it('组队探索时把两名角色本轮看到的区域合并给每个成员', () => {
    const geometry = createEmptyMapGeometry(map.id, 0)
    geometry.vision.enabled = true
    geometry.vision.sharePartyVision = true
    const characters = [
      { id: 'char-a', roomMemberId: 'member-a' },
      { id: 'char-b', roomMemberId: 'member-b' },
    ] as Character[]

    const updates = buildMapExplorationUpdates({ map, geometry, characters, forceEnabled: false })

    expect(updates.map((entry) => entry.memberId)).toEqual(['member-a', 'member-b'])
    expect(updates[0].polygons.length).toBe(2)
    expect(updates[1].polygons).toEqual(updates[0].polygons)
  })

  it('视野和手动迷雾都关闭时不生成探索写入', () => {
    const geometry = createEmptyMapGeometry(map.id, 0)
    geometry.vision.enabled = false
    const updates = buildMapExplorationUpdates({
      map,
      geometry,
      characters: [{ id: 'char-a', roomMemberId: 'member-a' }] as Character[],
      forceEnabled: false,
    })
    expect(updates).toEqual([])
  })
})
