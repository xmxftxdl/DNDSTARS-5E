import { beforeEach, describe, expect, it } from 'vitest'
import {
  createEmptyMapGeometry,
  mapGeometryRelationshipIssues,
  normalizeMapGeometry,
  type MapGeometryWall,
} from '../lib/mapGeometry'
import { useMapGeometryStore } from './mapGeometry'

const wall: MapGeometryWall = {
  id: 'wall-1',
  kind: 'wall',
  label: '北墙',
  points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
  blocksVision: true,
  blocksMovement: true,
  blocksLineOfEffect: true,
  baseHeightFeet: 0,
  heightFeet: 10,
  createdAt: 1,
}

describe('map geometry editor history', () => {
  beforeEach(() => {
    useMapGeometryStore.setState({
      maps: [createEmptyMapGeometry('map-1', 1)],
      selectedEntityId: null,
      historyByMapId: {},
      futureByMapId: {},
    })
  })

  it('supports undo and redo without persisting transient history', () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', wall)
    expect(useMapGeometryStore.getState().maps[0].walls).toHaveLength(1)

    useMapGeometryStore.getState().undo('map-1')
    expect(useMapGeometryStore.getState().maps[0].walls).toHaveLength(0)

    useMapGeometryStore.getState().redo('map-1')
    expect(useMapGeometryStore.getState().maps[0].walls).toHaveLength(1)
  })

  it('duplicates an entity with a fresh id and offset points', () => {
    useMapGeometryStore.getState().addEntity('map-1', wall)
    const id = useMapGeometryStore.getState().duplicateEntity('map-1', wall.id, 10)
    const walls = useMapGeometryStore.getState().maps[0].walls
    expect(id).toBeTruthy()
    expect(walls).toHaveLength(2)
    expect(walls[1].id).not.toBe(wall.id)
    expect(walls[1].points[0]).toEqual({ x: 10, y: 10 })
    expect(walls[1].edgeIds).not.toEqual(walls[0].edgeIds)
    expect(mapGeometryRelationshipIssues(useMapGeometryStore.getState().maps[0])).toEqual([])
  })

  it('removes stable-only openings with their wall', () => {
    useMapGeometryStore.getState().addEntity('map-1', wall)
    const storedWall = useMapGeometryStore.getState().maps[0].walls[0]
    useMapGeometryStore.getState().addEntity('map-1', {
      id: 'stable-door', kind: 'door', label: 'door', points: [{ x: 10, y: 0 }, { x: 20, y: 0 }],
      wallEdgeId: storedWall.edgeIds![0], startT: 0.2, endT: 0.4,
      state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    })
    useMapGeometryStore.getState().removeEntity('map-1', wall.id)
    expect(useMapGeometryStore.getState().maps[0].doors).toEqual([])
  })

  it('round-trips an exported geometry through schema validation', () => {
    useMapGeometryStore.getState().addEntity('map-1', wall)
    const exported = JSON.stringify(useMapGeometryStore.getState().maps[0])
    const parsed = normalizeMapGeometry(JSON.parse(exported))
    expect(parsed?.walls[0].label).toBe('北墙')
    expect(useMapGeometryStore.getState().replaceMap('map-1', parsed!)).toBe(true)
  })

  it('removes embedded doors and windows when their parent wall is deleted', () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', wall)
    store.addEntity('map-1', {
      id: 'door', kind: 'door', label: '门', points: [{ x: 10, y: 0 }, { x: 20, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, state: 'closed', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    })
    store.addEntity('map-1', {
      id: 'window', kind: 'window', label: '窗户', points: [{ x: 30, y: 0 }, { x: 40, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, windowType: 'glass',
      blocksVision: false, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 3,
    })
    useMapGeometryStore.getState().removeEntity('map-1', wall.id)
    const geometry = useMapGeometryStore.getState().maps[0]
    expect(geometry.walls).toEqual([])
    expect(geometry.doors).toEqual([])
    expect(geometry.windows).toEqual([])
  })

  it('extends same-material walls into a continuous polyline', () => {
    const store = useMapGeometryStore.getState()
    expect(store.addEntity('map-1', { ...wall, material: 'stone' })).toBe(true)
    expect(useMapGeometryStore.getState().addEntity('map-1', {
      ...wall, id: 'wall-2', material: 'stone', points: [{ x: 50, y: 0 }, { x: 100, y: 50 }],
    })).toBe(true)
    expect(useMapGeometryStore.getState().maps[0].walls).toEqual([
      expect.objectContaining({ id: wall.id, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 50 }] }),
    ])
  })

  it('reprojects attached openings when a wall endpoint moves', () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', wall)
    store.addEntity('map-1', {
      id: 'door', kind: 'door', label: '门', points: [{ x: 10, y: 0 }, { x: 20, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, state: 'closed', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    })
    expect(useMapGeometryStore.getState().setEntityPoints('map-1', wall.id, [{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(true)
    expect(useMapGeometryStore.getState().maps[0].doors[0].points).toEqual([{ x: 20, y: 0 }, { x: 40, y: 0 }])
  })

  it('preserves a light source height above ground when moving across terrain elevations', () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', {
      id: 'high-ground',
      kind: 'obstacle',
      label: 'High ground',
      points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
      blocksVision: false,
      blocksMovement: false,
      blocksLineOfEffect: false,
      cover: 'none',
      baseHeightFeet: 0,
      heightFeet: 0,
      terrainRegion: true,
      terrainElevationFeet: 20,
      createdAt: 2,
    })
    store.addEntity('map-1', {
      id: 'light',
      kind: 'light',
      label: 'Torch',
      points: [{ x: 25, y: 25 }],
      enabled: true,
      brightRadiusFeet: 20,
      dimRadiusFeet: 20,
      color: '#fbbf24',
      elevationFeet: 5,
      createdAt: 3,
    })

    expect(useMapGeometryStore.getState().setEntityPoints('map-1', 'light', [{ x: 75, y: 25 }])).toBe(true)
    expect(useMapGeometryStore.getState().maps.find((map) => map.mapId === 'map-1')?.lights?.[0]).toMatchObject({
      points: [{ x: 75, y: 25 }],
      elevationFeet: 25,
    })
  })

  it('rejects overlapping wall openings without changing history', () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', wall)
    expect(store.addEntity('map-1', {
      id: 'door', kind: 'door', label: '门', points: [{ x: 10, y: 0 }, { x: 30, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, state: 'closed', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    })).toBe(true)
    const historyLength = useMapGeometryStore.getState().historyByMapId['map-1'].length
    expect(useMapGeometryStore.getState().addEntity('map-1', {
      id: 'window', kind: 'window', label: '窗', points: [{ x: 20, y: 0 }, { x: 40, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, windowType: 'glass',
      blocksVision: false, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 3,
    })).toBe(false)
    expect(useMapGeometryStore.getState().maps[0].windows).toEqual([])
    expect(useMapGeometryStore.getState().historyByMapId['map-1']).toHaveLength(historyLength)
  })

  it('moves and resizes an opening along its wall but rejects a collision', () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', wall)
    store.addEntity('map-1', {
      id: 'door', kind: 'door', label: '门', points: [{ x: 5, y: 0 }, { x: 15, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, state: 'closed', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
    })
    store.addEntity('map-1', {
      id: 'window', kind: 'window', label: '窗', points: [{ x: 35, y: 0 }, { x: 45, y: 0 }],
      parentWallId: wall.id, parentWallSegmentIndex: 0, windowType: 'glass',
      blocksVision: false, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 3,
    })
    expect(useMapGeometryStore.getState().setEntityPoints('map-1', 'door', [{ x: 10, y: 3 }, { x: 25, y: 3 }])).toBe(true)
    expect(useMapGeometryStore.getState().maps[0].doors[0].points).toEqual([{ x: 10, y: 0 }, { x: 25, y: 0 }])
    expect(useMapGeometryStore.getState().setEntityPoints('map-1', 'door', [{ x: 25, y: 0 }, { x: 40, y: 0 }])).toBe(false)
    expect(useMapGeometryStore.getState().maps[0].doors[0].points).toEqual([{ x: 10, y: 0 }, { x: 25, y: 0 }])
  })
})
