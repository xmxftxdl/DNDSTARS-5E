import { describe, expect, it } from 'vitest'
import { importUvttGeometry, uvttEmbeddedImageBlob } from './uvttImport'
import { mapGeometrySegments } from './mapGeometry'

describe('UVTT/DD2VTT geometry import', () => {
  it('imports walls, attached portals and lights at the target map scale', () => {
    const result = importUvttGeometry({
      format: 0.3,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 10, y: 10 },
        pixels_per_grid: 50,
      },
      line_of_sight: [[{ x: 5, y: 0 }, { x: 5, y: 10 }]],
      portals: [{
        bounds: [{ x: 5, y: 4 }, { x: 5, y: 6 }],
        closed: true,
      }],
      lights: [{ position: { x: 2, y: 2 }, range: 4, color: '#ffaa00' }],
    }, {
      mapId: 'map',
      targetWidth: 1_000,
      targetHeight: 1_000,
      feetPerCell: 5,
      now: 1,
    })

    expect(result.geometry.walls[0]).toMatchObject({
      points: [{ x: 500, y: 0 }, { x: 500, y: 1_000 }],
      edgeIds: ['uvtt:wall:0:edge:0'],
    })
    expect(result.geometry.doors[0]).toMatchObject({
      wallEdgeId: 'uvtt:wall:0:edge:0',
      startT: 0.4,
      endT: 0.6,
      openState: 'closed',
      lockState: 'unlocked',
    })
    expect(result.geometry.lights?.[0]).toMatchObject({
      points: [{ x: 200, y: 200 }],
      brightRadiusFeet: 10,
      dimRadiusFeet: 10,
      color: '#ffaa00',
    })
    expect(mapGeometrySegments(result.geometry).some((segment) => segment.entityId === 'uvtt:door:0')).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('rejects malformed resolution data', () => {
    expect(() => importUvttGeometry({ resolution: {} }, { mapId: 'map' }))
      .toThrow(/resolution/)
  })

  it('imports object line-of-sight collections and exposes embedded images', () => {
    const result = importUvttGeometry({
      resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 10 }, pixels_per_grid: 50 },
      line_of_sight: [],
      objects_line_of_sight: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]],
      image: 'data:image/png;base64,AA==',
    }, { mapId: 'map', targetWidth: 500, targetHeight: 500, now: 1 })
    expect(result.geometry.walls[0].points).toEqual([{ x: 50, y: 50 }, { x: 100, y: 100 }])
    expect(result.embeddedImageDataUrl).toBe('data:image/png;base64,AA==')
    expect(uvttEmbeddedImageBlob(result.embeddedImageDataUrl!).type).toBe('image/png')
  })

  it.each([
    ['PNG', 'iVBORw0KGgoAAA==', 'image/png'],
    ['JPEG', '/9j/AA==', 'image/jpeg'],
    ['WebP', 'UklGRgAAAAA=', 'image/webp'],
  ])('accepts raw %s base64 images emitted by real UVTT exporters', (_label, image, mime) => {
    const result = importUvttGeometry({
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 1, y: 1 },
        pixels_per_grid: 100,
      },
      line_of_sight: [],
      image,
    }, { mapId: 'raw-image' })
    expect(result.embeddedImageDataUrl).toBe(`data:${mime};base64,${image}`)
    expect(uvttEmbeddedImageBlob(result.embeddedImageDataUrl!).type).toBe(mime)
  })
})
