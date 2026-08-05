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
  return {
    addEntity,
    coordinator: new MapEditingCoordinator({
      isDm: () => isDm,
      combatActive: () => combat,
      addEntity,
      removeEntity: vi.fn(),
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

  it('locks terrain mutations during combat while leaving ordinary geometry editable', () => {
    const { coordinator } = createCoordinator(true, true)
    expect(coordinator.commit('map-1', terrain))
      .toEqual({ ok: false, reason: 'terrain-editing-locked-during-combat' })
    const geometry = createEmptyMapGeometry('map-1')
    geometry.obstacles.push(terrain)
    expect(coordinator.remove('map-1', geometry, terrain.id))
      .toEqual({ ok: false, reason: 'terrain-editing-locked-during-combat' })
  })
})
