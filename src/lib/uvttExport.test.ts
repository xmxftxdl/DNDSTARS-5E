import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from './mapGeometry'
import { exportUvttGeometry } from './uvttExport'
import { importUvttGeometry } from './uvttImport'

describe('UVTT geometry export', () => {
  it('exports walls, portals, blocking objects, lights and an embedded image', () => {
    const geometry = createEmptyMapGeometry('map', 1)
    geometry.walls = [{
      id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 70, y: 0 }, { x: 70, y: 140 }],
      edgeIds: ['edge'], material: 'stone', blocksVision: true, blocksMovement: true,
      blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    geometry.doors = [{
      id: 'door', kind: 'door', label: 'Door', points: [{ x: 70, y: 56 }, { x: 70, y: 84 }],
      wallEdgeId: 'edge', startT: 0.4, endT: 0.6, state: 'closed', openState: 'closed',
      lockState: 'unlocked', physicalState: 'intact', secret: false, blocksVision: true,
      blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    }]
    geometry.obstacles = [{
      id: 'pillar', kind: 'obstacle', label: 'Pillar',
      points: [{ x: 140, y: 70 }, { x: 210, y: 70 }, { x: 210, y: 140 }], cover: 'total',
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 3,
    }]
    geometry.lights = [{
      id: 'light', kind: 'light', label: 'Light', points: [{ x: 210, y: 210 }], enabled: true,
      brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fbbf24', elevationFeet: 5, createdAt: 4,
    }]

    const result = exportUvttGeometry(geometry, {
      width: 700, height: 350, pixelsPerGrid: 70, feetPerCell: 5,
      imageDataUrl: 'data:image/png;base64,AA==',
    })

    expect(result.resolution).toEqual({
      map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 5 }, pixels_per_grid: 70,
    })
    expect(result.line_of_sight).toEqual([[{ x: 1, y: 0 }, { x: 1, y: 2 }]])
    expect(result.objects_line_of_sight[0]).toEqual([
      { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 1 },
    ])
    expect(result.portals[0]).toMatchObject({
      position: { x: 1, y: 1 }, bounds: [{ x: 1, y: 0.8 }, { x: 1, y: 1.2 }], closed: true,
    })
    expect(result.lights[0]).toMatchObject({ position: { x: 3, y: 3 }, range: 8, color: '#fbbf24' })
    expect(result.image).toBe('AA==')
  })

  it('round-trips exported wall and door coordinates through the importer', () => {
    const geometry = createEmptyMapGeometry('source', 1)
    geometry.walls = [{
      id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 10, y: 20 }, { x: 310, y: 20 }],
      edgeIds: ['edge'], blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    geometry.doors = [{
      id: 'door', kind: 'door', label: 'Door', points: [{ x: 130, y: 20 }, { x: 190, y: 20 }],
      wallEdgeId: 'edge', startT: 0.4, endT: 0.6, state: 'open', openState: 'open',
      lockState: 'unlocked', physicalState: 'intact', secret: false, blocksVision: true,
      blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    }]
    const encoded = exportUvttGeometry(geometry, { width: 400, height: 200, pixelsPerGrid: 50 })
    const decoded = importUvttGeometry(encoded, {
      mapId: 'target', targetWidth: 400, targetHeight: 200, feetPerCell: 5, now: 10,
    })

    expect(decoded.geometry.walls[0].points).toEqual(geometry.walls[0].points)
    expect(decoded.geometry.doors[0].points[0]).toMatchObject({ x: 130, y: 20 })
    expect(decoded.geometry.doors[0].points[1]).toMatchObject({ x: 190, y: 20 })
    expect(decoded.geometry.doors[0].openState).toBe('open')
  })
})
