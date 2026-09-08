import { describe, expect, it } from 'vitest'
import { applyPlayerSceneDelta, type PlayerSceneSnapshot } from '../../../packages/mobile-protocol/src'

const snapshot: PlayerSceneSnapshot = {
  schemaVersion: 1,
  protocolVersion: 1,
  sceneId: 'scene-1',
  revision: 4,
  mapManifest: {
    schemaVersion: 1,
    assetId: 'map-1',
    assetHash: 'hash-1',
    revision: 1,
    worldWidth: 12000,
    worldHeight: 12000,
    tileSize: 256,
    imageFormat: 'png',
    zoomLevels: [{ level: 0, scale: 0.1, pixelWidth: 1200, pixelHeight: 1200, columns: 5, rows: 5 }],
    preview: { url: '/preview.png', width: 120, height: 120 },
    tileUrlTemplate: '/tiles/{z}/{x}_{y}.png',
  },
  controlledTokens: [{
    id: 'player', name: '玩家', portraitColor: '#fff', x: 10, y: 10, radius: 5,
    hp: 10, maxHp: 10, controlled: true, friendly: true, conditions: [],
  }],
  visibleTokens: [],
  opaqueSegments: [],
  fogChunks: [],
}

describe('mobile player scene revision', () => {
  it('applies the next delta to controlled tokens', () => {
    const next = applyPlayerSceneDelta(snapshot, { type: 'token-moved', revision: 5, tokenId: 'player', x: 50, y: 60 })
    expect(next.revision).toBe(5)
    expect(next.controlledTokens[0]).toMatchObject({ x: 50, y: 60 })
  })

  it('fails closed when a delta revision is missing', () => {
    expect(() => applyPlayerSceneDelta(snapshot, {
      type: 'token-moved', revision: 7, tokenId: 'player', x: 50, y: 60,
    })).toThrow('revision-gap:4->7')
  })
})
