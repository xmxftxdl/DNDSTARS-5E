import { describe, expect, it } from 'vitest'
import type { MapAssetManifest } from '../../../../packages/mobile-protocol/src'
import { visibleTileKeys } from './tileMath'

const manifest: MapAssetManifest = {
  schemaVersion: 1,
  assetId: 'stress-map',
  assetHash: 'stress-map-v1',
  revision: 1,
  worldWidth: 12000,
  worldHeight: 12000,
  tileSize: 256,
  imageFormat: 'png',
  zoomLevels: [
    { level: 0, scale: 0.04, pixelWidth: 480, pixelHeight: 480, columns: 2, rows: 2 },
    { level: 4, scale: 0.64, pixelWidth: 7680, pixelHeight: 7680, columns: 30, rows: 30 },
  ],
  preview: { url: '/preview.png', width: 480, height: 480 },
  tileUrlTemplate: '/tiles/{z}/{x}_{y}.png',
}

describe('mobile tile viewport scheduler', () => {
  it('only requests viewport-near tiles on a 12000x12000 map', () => {
    const tiles = visibleTileKeys(manifest, { x: -1200, y: -900, scale: 0.64 }, { width: 390, height: 700 }, 2, 1)
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThanOrEqual(30)
    expect(tiles.every((tile) => tile.url.includes(`/tiles/${tile.level}/`))).toBe(true)
  })

  it('loads the lowest level for an overview camera', () => {
    const tiles = visibleTileKeys(manifest, { x: 0, y: 0, scale: 0.04 }, { width: 390, height: 700 }, 1, 0)
    expect(new Set(tiles.map((tile) => tile.level))).toEqual(new Set([0]))
    expect(tiles.length).toBeLessThanOrEqual(4)
  })
})
