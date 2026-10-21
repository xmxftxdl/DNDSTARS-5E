import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSharedResource,saveSharedResourceWithResult } from '../composition/browserSharedRoomResources'
vi.mock('../composition/browserSharedRoomResources', () => ({
  loadSharedResource: vi.fn(),
  saveSharedResourceWithResult: vi.fn().mockResolvedValue({ status: 'saved' }),
}))
import {
  createEmptyMapGeometry,
  MAP_GEOMETRY_SCHEMA_VERSION,
  mapGeometryRelationshipIssues,
  normalizeMapGeometry,
  type MapGeometryWall,
} from '../lib/mapGeometry'
import { useMapGeometryStore } from './mapGeometry'
import { buildLooseEarthTransferGeometry } from '../rulesets/dnd5e/looseEarthTransferGeometry'
import { mapGeometryTerrainElevationAtPoint } from '../lib/mapGeometry'

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
  it('stages every map together and rejects a malformed batch without partial writes',()=>{
    const store=useMapGeometryStore.getState()
    const first=createEmptyMapGeometry('first',1),second=createEmptyMapGeometry('second',1)
    second.walls=[{...wall}]
    vi.mocked(saveSharedResourceWithResult).mockClear()
    const updates=vi.fn(),unsubscribe=useMapGeometryStore.subscribe(updates)
    try {
      const before=useMapGeometryStore.getState().maps
      expect(store.applyAuthorityMapReplacements([first,{...second,mapId:''}])).toBe(false)
      expect(useMapGeometryStore.getState().maps).toBe(before)
      expect(updates).not.toHaveBeenCalled()
      expect(store.applyAuthorityMapReplacements([first,first])).toBe(false)
      expect(store.applyAuthorityMapReplacements([first,second])).toBe(true)
      expect(updates).toHaveBeenCalledTimes(1)
      expect(useMapGeometryStore.getState().maps.map(map=>map.mapId)).toEqual([...before.map(map=>map.mapId),'first','second'])
      second.walls[0].label='External mutation'
      expect(useMapGeometryStore.getState().maps.find(map=>map.mapId==='second')!.walls[0].label).toBe('北墙')
      expect(saveSharedResourceWithResult).not.toHaveBeenCalled()
      expect(useMapGeometryStore.getState().historyByMapId).toEqual({})
    } finally {unsubscribe()}
  })
  it('stages excavation geometry without independently publishing or flattening the pit', () => {
    vi.mocked(saveSharedResourceWithResult).mockClear()
    const geometry = createEmptyMapGeometry('soil-map', 1)
    geometry.obstacles.push({ id: 'soil-volume', kind: 'obstacle', label: 'Soil',
      points: [{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],
      surfaceMaterial: 'loose-earth', terrainRegion: true, terrainElevationFeet: 0,
      baseHeightFeet: -5, heightFeet: 5, cover: 'none', blocksMovement: false,
      blocksVision: false, blocksLineOfEffect: false, createdAt: 1 })
    const candidate = buildLooseEarthTransferGeometry({ geometry, sourceVolumeId: 'soil-volume',
      translation: {x:50,y:0}, pixelsPerFoot: 10, maximumSideFeet: 5, maximumDisplacementFeet: 5,
      destinationGroundFeet: 0, executionId: 'cast', now: 2 })!
    expect(useMapGeometryStore.getState().applyAuthorityMapReplacement('soil-map', candidate)).toBe(true)
    const staged = useMapGeometryStore.getState().maps.find(map => map.mapId === 'soil-map')!
    const restored = normalizeMapGeometry(JSON.parse(JSON.stringify(staged)))!
    expect(mapGeometryTerrainElevationAtPoint(restored, {x:25,y:25})).toBe(-5)
    expect(mapGeometryTerrainElevationAtPoint(restored, {x:75,y:25})).toBe(5)
    expect(saveSharedResourceWithResult).not.toHaveBeenCalled()
    const previous = useMapGeometryStore.getState().maps
    expect(useMapGeometryStore.getState().applyAuthorityMapReplacement('other-map', candidate)).toBe(false)
    expect(useMapGeometryStore.getState().maps).toBe(previous)
  })
  it('stages a complete Host geometry result without an independent save or editor undo entry',()=>{
    vi.mocked(saveSharedResourceWithResult).mockClear()
    const geometry={...createEmptyMapGeometry('map-1',2),walls:[wall],structureLifetimes:[{id:'cast',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:10080,entityIds:[wall.id]}]}
    expect(useMapGeometryStore.getState().applyAuthorityMapReplacement('map-1',geometry)).toBe(true)
    expect(useMapGeometryStore.getState().maps[0].structureLifetimes).toEqual(geometry.structureLifetimes)
    expect(saveSharedResourceWithResult).not.toHaveBeenCalled()
    expect(useMapGeometryStore.getState().historyByMapId).toEqual({})
    const staged=useMapGeometryStore.getState().maps
    expect(useMapGeometryStore.getState().applyAuthorityMapReplacement('wrong-map',geometry)).toBe(false)
    expect(useMapGeometryStore.getState().applyAuthorityMapReplacement('map-1',{...geometry,structureLifetimes:[...geometry.structureLifetimes,...geometry.structureLifetimes]})).toBe(false)
    expect(useMapGeometryStore.getState().maps).toBe(staged)
    geometry.walls[0]={...wall,label:'Changed outside'}
    expect(useMapGeometryStore.getState().maps[0].walls[0].label).toBe('北墙')
  })
  it('preserves undo for server echoes and drops it for a competing edit', async () => {
    const store = useMapGeometryStore.getState()
    store.addEntity('map-1', wall)
    const current = useMapGeometryStore.getState().maps[0]
    const now = Date.now() + 1000
    vi.mocked(loadSharedResource).mockResolvedValue({
      schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION, updatedAt: now,
      maps: [{ ...current, updatedAt: now }],
    })
    await store.loadShared()
    expect(useMapGeometryStore.getState().historyByMapId['map-1']).toHaveLength(1)
    vi.mocked(loadSharedResource).mockResolvedValue({
      schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION, updatedAt: now + 1,
      maps: [{ ...current, walls: [], updatedAt: now + 1 }],
    })
    await store.loadShared()
    expect(useMapGeometryStore.getState().historyByMapId['map-1']).toBeUndefined()
  })
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
