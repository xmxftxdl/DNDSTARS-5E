import { describe, expect, it, vi } from 'vitest'
import { createEmptyMapGeometry, type MapGeometryObstacle } from '../../lib/mapGeometry'
import { MapEditingCoordinator } from './MapEditingCoordinator'

const terrain: MapGeometryObstacle = {
  id: 'terrain-1',
  kind: 'obstacle',
  label: '高地',
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  createdAt: 1,
  terrainRegion: true,
  terrainElevationFeet: 10,
  cover: 'none',
  blocksMovement: true,
  blocksVision: false,
  blocksLineOfEffect: false,
  baseHeightFeet: 0,
  heightFeet: 10,
}

function createCoordinator(isDm = true, combat = false) {
  const addEntity = vi.fn(() => true)
  const removeEntity = vi.fn()
  return {
    addEntity,
    removeEntity,
    coordinator: new MapEditingCoordinator({
      isDm: () => isDm,
      combatActive: () => combat,
      addEntity,
      removeEntity,
      setEntityPoints: vi.fn(() => true),
      replaceMap: vi.fn(() => true),
      selectEntity: vi.fn(),
    }),
  }
}

describe('MapEditingCoordinator', () => {
  it('rejects player editor mutations', () => {
    expect(createCoordinator(false).coordinator.commit('map-1', terrain))
      .toEqual({ ok: false, reason: 'dm-authority-required' })
  })

  it('locks terrain creation and point editing during combat but still lets the DM delete it', () => {
    const { coordinator, removeEntity } = createCoordinator(true, true)
    expect(coordinator.commit('map-1', terrain))
      .toEqual({ ok: false, reason: 'terrain-editing-locked-during-combat' })
    const geometry = createEmptyMapGeometry('map-1')
    geometry.obstacles.push(terrain)
    expect(coordinator.remove('map-1', geometry, terrain.id))
      .toEqual({ ok: true })
    expect(removeEntity).toHaveBeenCalledWith('map-1', terrain.id)
    expect(coordinator.setPoints('map-1', geometry, terrain.id, terrain.points))
      .toEqual({ ok: false, reason: 'terrain-editing-locked-during-combat' })
  })
})
