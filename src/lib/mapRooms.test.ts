import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, migrateMapGeometryV3 } from './mapGeometry'
import { deriveMapRoomGraph, derivedRoomAtPoint } from './mapRooms'

describe('derived room graph', () => {
  it('derives sealed rooms from barriers and recomputes them after a door opens', () => {
    const geometry = createEmptyMapGeometry('rooms', 1)
    const common = {
      kind: 'wall' as const,
      label: '墙',
      material: 'stone' as const,
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    }
    geometry.walls = [
      { ...common, id: 'top', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] },
      { ...common, id: 'right', points: [{ x: 300, y: 100 }, { x: 300, y: 300 }] },
      { ...common, id: 'bottom', points: [{ x: 300, y: 300 }, { x: 100, y: 300 }] },
      { ...common, id: 'left', points: [{ x: 100, y: 300 }, { x: 100, y: 100 }] },
    ]
    const stable = migrateMapGeometryV3(geometry)
    stable.doors = [{
      id: 'door',
      kind: 'door',
      label: '门',
      points: [{ x: 180, y: 100 }, { x: 220, y: 100 }],
      wallEdgeId: stable.walls[0].edgeIds?.[0],
      startT: 0.4,
      endT: 0.6,
      state: 'closed',
      openState: 'closed',
      lockState: 'unlocked',
      physicalState: 'intact',
      secret: false,
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 2,
    }]

    const closed = deriveMapRoomGraph({ geometry: stable, width: 400, height: 400, cellSize: 20 })
    expect(derivedRoomAtPoint(closed, { x: 200, y: 200 })?.sealed).toBe(true)

    stable.doors[0].state = 'open'
    stable.doors[0].openState = 'open'
    const opened = deriveMapRoomGraph({ geometry: stable, width: 400, height: 400, cellSize: 20 })
    expect(derivedRoomAtPoint(opened, { x: 200, y: 200 })?.sealed).toBe(false)
  })

  it('keeps internal rooms sealed when an internal connecting door opens', () => {
    const geometry = createEmptyMapGeometry('internal', 1)
    const wall = (id: string, points: [{ x: number; y: number }, { x: number; y: number }]) => ({
      id, kind: 'wall' as const, label: id, points, edgeIds: [`${id}:edge`], material: 'stone' as const,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    geometry.walls = [
      wall('top', [{ x: 100, y: 100 }, { x: 300, y: 100 }]),
      wall('right', [{ x: 300, y: 100 }, { x: 300, y: 300 }]),
      wall('bottom', [{ x: 300, y: 300 }, { x: 100, y: 300 }]),
      wall('left', [{ x: 100, y: 300 }, { x: 100, y: 100 }]),
      wall('divider', [{ x: 200, y: 100 }, { x: 200, y: 300 }]),
    ]
    geometry.doors = [{
      id: 'internal-door', kind: 'door', label: 'internal', points: [{ x: 200, y: 180 }, { x: 200, y: 220 }],
      wallEdgeId: 'divider:edge', startT: 0.4, endT: 0.6,
      state: 'open', openState: 'open', lockState: 'unlocked', physicalState: 'intact', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    }]
    const graph = deriveMapRoomGraph({ geometry, width: 400, height: 400, cellSize: 20 })
    expect(derivedRoomAtPoint(graph, { x: 150, y: 200 })?.sealed).toBe(true)
    expect(derivedRoomAtPoint(graph, { x: 250, y: 200 })?.sealed).toBe(true)
  })
})
