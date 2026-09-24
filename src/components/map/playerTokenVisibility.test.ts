import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { playerVisibleCanvasTokens } from './playerTokenVisibility'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'

const viewer = { id: 'viewer', type: 'player', characterId: 'mine', x: 25, y: 25, size: 1 } as Token
const target = { id: 'target', type: 'player', characterId: 'other', x: 125, y: 25, size: 1 } as Token
const map: BattleMap = {
  id: 'map', name: 'map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
  tokens: [viewer, target],
  dnd5ePluginAreas: [{
    id: 'fog', pluginId: 'srd', featureId: 'fog-cloud', label: 'fog', color: '#ffffff',
    sourceCharacterId: 'mine', sourceTokenId: 'viewer', cells: [{ col: 1, row: 0 }],
    createdRound: 1, expiresAfterRound: 10, obscuration: { kind: 'heavy' },
    vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 40 },
  }],
}
const input = { map, visionSourceTokenIds: ['viewer'], viewerCharacterId: 'mine', worldMinute: 0 }
describe('player canvas hit-target visibility', () => {
  it('does not impose a 30-foot range cap when a hut enables obstruction checks on a bright map', () => {
    const caster = { ...viewer, x: 562.5, y: 487.5 }
    const minotaur = { ...target, type: 'enemy' as const, x: 775, y: 475, size: 2 }
    const hutMap: BattleMap = { ...map, width: 1024, height: 1024, gridSize: 25, feetPerCell: 5,
      tokens: [caster, minotaur], dnd5ePluginAreas: [{
        ...map.dnd5ePluginAreas![0], coreSpellId: 'tiny-hut', obscuration: undefined,
        cells: [{ col: 22, row: 19 }], blocking: { vision: true, visionMode: 'outside-in' },
      }] }
    const geometry: MapGeometryState = { mapId: 'map', walls: [], doors: [], windows: [], obstacles: [], lights: [],
      vision: { enabled: false, defaultRangeFeet: 30, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 0 }
    expect(playerVisibleCanvasTokens({ ...input, map: hutMap, geometry }).map(t => t.id)).toContain('target')
    const serverIds = (scene: BattleMap, sceneGeometry: MapGeometryState, characterId = 'mine') =>
      projectMapsForPlayer({ maps: [scene] }, { maps: [sceneGeometry] }, characterId)
        .maps[0].tokens.map((token: Token) => token.id)
    expect(serverIds(hutMap, geometry)).toContain('target')
    const outsideViewerMap = { ...hutMap, tokens: [
      { ...caster, type: 'enemy' as const }, { ...minotaur, type: 'player' as const },
    ] }
    expect(serverIds(outsideViewerMap, geometry, 'other')).not.toContain('viewer')
    expect(serverIds(hutMap, { ...geometry,
      vision: { ...geometry.vision, ambientLight: 'darkness' },
    })).not.toContain('target')
    // Looking in from outside must still be blocked by the hut.
    expect(playerVisibleCanvasTokens({ ...input, map: hutMap, geometry,
      visionSourceTokenIds: ['target'], viewerCharacterId: 'other' }).map(t => t.id)).not.toContain('viewer')
    expect(playerVisibleCanvasTokens({ ...input, map: hutMap,
      geometry: { ...geometry, vision: { ...geometry.vision, ambientLight: 'darkness' } } }).map(t => t.id)).not.toContain('target')
  })
  it('removes obscured allies from all interactive token layers even without dynamic vision', () => {
    expect(playerVisibleCanvasTokens(input).map(token => token.id)).toEqual(['viewer'])
  })
  it('restores the target when the obscuring field is removed', () => {
    expect(playerVisibleCanvasTokens({ ...input, map: { ...map, dnd5ePluginAreas: [] } })).toHaveLength(2)
  })
  it('honors blindsight and keeps the controlled character usable', () => {
    expect(playerVisibleCanvasTokens({ ...input, map: { ...map, tokens: [{ ...viewer, blindsightRangeFeet: 30 }, target] } })).toHaveLength(2)
  })
})
