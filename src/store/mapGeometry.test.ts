import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, normalizeMapGeometry, type MapGeometryWall } from '../lib/mapGeometry'
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
  })

  it('round-trips an exported geometry through schema validation', () => {
    useMapGeometryStore.getState().addEntity('map-1', wall)
    const exported = JSON.stringify(useMapGeometryStore.getState().maps[0])
    const parsed = normalizeMapGeometry(JSON.parse(exported))
    expect(parsed?.walls[0].label).toBe('北墙')
    expect(useMapGeometryStore.getState().replaceMap('map-1', parsed!)).toBe(true)
  })
})
