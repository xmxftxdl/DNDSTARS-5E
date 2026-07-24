import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, migrateMapGeometryV3 } from './mapGeometry'
import { buildMapGeometryDiagnostics } from './mapGeometryDiagnostics'

describe('map geometry diagnostics', () => {
  it('reports stable wall edges, room cells, portals and relationship issues', () => {
    const geometry = createEmptyMapGeometry('diagnostics', 1)
    geometry.walls = [{
      id: 'wall', kind: 'wall', label: 'wall',
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      material: 'stone', blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    const stable = migrateMapGeometryV3(geometry)
    stable.doors = [{
      id: 'door', kind: 'door', label: 'door',
      points: [{ x: 180, y: 100 }, { x: 220, y: 100 }],
      wallEdgeId: stable.walls[0].edgeIds![0], startT: 0.4, endT: 0.6,
      state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact',
      secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    }]
    const diagnostics = buildMapGeometryDiagnostics({
      geometry: stable, width: 400, height: 400, cellSize: 20,
    })
    expect(diagnostics.edges).toEqual([
      expect.objectContaining({ wallId: 'wall', wallEdgeId: stable.walls[0].edgeIds![0] }),
    ])
    expect(diagnostics.portals).toEqual([
      expect.objectContaining({ id: 'door', open: false }),
    ])
    expect(diagnostics.rooms.length).toBeGreaterThan(0)
    expect(diagnostics.issues).toEqual([])
  })
})
