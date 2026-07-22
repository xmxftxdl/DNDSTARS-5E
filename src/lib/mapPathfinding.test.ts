import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { createEmptyMapGeometry, type MapGeometryState } from './mapGeometry'
import { findMapGeometryPath } from './mapPathfinding'

const token = (patch: Partial<Token> = {}): Token => ({
  id: 'hero', label: '英雄', x: 25, y: 25, color: '#fff', emoji: 'H', size: 1, type: 'player', ...patch,
})

const battleMap = (patch: Partial<BattleMap> = {}): BattleMap => ({
  id: 'map', name: '地图', width: 250, height: 150, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
  tokens: [token()], ...patch,
})

const geometry = (): MapGeometryState => createEmptyMapGeometry('map', 1)

describe('map geometry pathfinding', () => {
  it('finds a legal polyline around walls and charges every grid step', () => {
    const map = battleMap()
    const state = geometry()
    state.walls.push({
      id: 'wall', kind: 'wall', label: '墙', points: [{ x: 75, y: 0 }, { x: 75, y: 75 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    const path = findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 } })
    expect(path).toBeDefined()
    expect(path!.points.length).toBeGreaterThan(3)
    expect(path!.distanceFeet).toBe((path!.points.length - 1) * 5)
    expect(path!.movementCostFeet).toBe(path!.distanceFeet)
  })

  it('charges difficult, climbing, and swimming terrain through the authoritative path', () => {
    const map = battleMap({ height: 50 })
    const state = geometry()
    state.obstacles.push({
      id: 'mud', kind: 'obstacle', label: '泥泞',
      points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1,
    })
    const mud = findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 } })
    expect(mud).toMatchObject({ distanceFeet: 10, movementCostFeet: 15 })
    expect(findMapGeometryPath({
      map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 },
      additionalDifficultTerrainMultiplier: (_token, position) => position.x <= 100 ? 2 : 1,
    })).toMatchObject({ distanceFeet: 10, movementCostFeet: 15 })
    expect(findMapGeometryPath({
      map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 },
      additionalSpeedCostMultiplier: () => 2,
    })).toMatchObject({ distanceFeet: 10, movementCostFeet: 30 })

    state.obstacles[0] = { ...state.obstacles[0], terrainCostMultiplier: 1, traversal: 'climb' }
    expect(findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 } }))
      .toMatchObject({ distanceFeet: 10, movementCostFeet: 15 })
    expect(findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 }, canClimb: true }))
      .toMatchObject({ distanceFeet: 10, movementCostFeet: 10 })

    state.obstacles[0] = { ...state.obstacles[0], traversal: 'swim' }
    expect(findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 }, canSwim: true }))
      .toMatchObject({ distanceFeet: 10, movementCostFeet: 10 })
  })

  it('does not charge ground difficult terrain to a creature flying above its height interval', () => {
    const flyer = token({ elevationFeet: 50 })
    const map = battleMap({ height: 50, tokens: [flyer] })
    const state = geometry()
    state.obstacles.push({
      id: 'mud', kind: 'obstacle', label: '泥泞',
      points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 0,
      terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1,
    })
    expect(findMapGeometryPath({
      map,
      geometry: state,
      token: flyer,
      to: { x: 125, y: 25 },
      canFly: true,
      targetElevationFeet: 50,
    })).toMatchObject({ distanceFeet: 10, movementCostFeet: 10 })
  })

  it('tracks terrain elevation per path node and rejects non-flying steps above 10 feet', () => {
    const map = battleMap({ height: 50 })
    const state = geometry()
    state.obstacles.push({
      id: 'ledge', kind: 'obstacle', label: '高台',
      points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 15, createdAt: 1,
    })
    expect(findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 } }))
      .toBeUndefined()
    state.obstacles[0].terrainElevationFeet = 10
    expect(findMapGeometryPath({ map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 } }))
      .toMatchObject({ elevationsFeet: [0, 10, 0] })
  })

  it('uses the declared target elevation along a three-dimensional flight path', () => {
    const map = battleMap({ height: 50 })
    const state = geometry()
    state.walls.push({
      id: 'wall', kind: 'wall', label: '墙', points: [{ x: 75, y: 0 }, { x: 75, y: 50 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(findMapGeometryPath({
      map,
      geometry: state,
      token: map.tokens[0],
      to: { x: 125, y: 25 },
      canFly: true,
      targetElevationFeet: 40,
    })).toMatchObject({ elevationsFeet: [0, 20, 40] })
    expect(findMapGeometryPath({
      map,
      geometry: state,
      token: map.tokens[0],
      to: { x: 125, y: 25 },
      canFly: true,
      targetElevationFeet: 5,
    })).toBeUndefined()
  })

  it('lets authoritative monster movement plan through closed unlocked doors but never locked doors', () => {
    const map = battleMap({ height: 50 })
    const state = geometry()
    state.doors.push({
      id: 'door', kind: 'door', label: '门', points: [{ x: 75, y: 0 }, { x: 75, y: 50 }], state: 'closed',
      secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(findMapGeometryPath({
      map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 }, allowOpenUnlockedDoors: true,
    })).toMatchObject({ doorsToOpen: ['door'] })
    state.doors[0].state = 'locked'
    expect(findMapGeometryPath({
      map, geometry: state, token: map.tokens[0], to: { x: 125, y: 25 }, allowOpenUnlockedDoors: true,
    })).toBeUndefined()
  })

  it('respects large-token footprints and narrow passages', () => {
    const large = token({ size: 2, x: 50, y: 50 })
    const map = battleMap({ height: 200, tokens: [large] })
    const state = geometry()
    state.walls.push(
      {
        id: 'top', kind: 'wall', label: '上墙', points: [{ x: 100, y: 0 }, { x: 100, y: 50 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      },
      {
        id: 'bottom', kind: 'wall', label: '下墙', points: [{ x: 100, y: 100 }, { x: 100, y: 200 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      },
    )
    expect(findMapGeometryPath({ map, geometry: state, token: large, to: { x: 150, y: 50 } })).toBeUndefined()
  })

  it('does not cut diagonally between occupied corner cells', () => {
    const map = battleMap({
      width: 100,
      height: 100,
      tokens: [
        token(),
        token({ id: 'east-blocker', type: 'enemy', characterId: undefined, x: 75, y: 25 }),
        token({ id: 'south-blocker', type: 'enemy', characterId: undefined, x: 25, y: 75 }),
      ],
    })

    expect(findMapGeometryPath({ map, geometry: geometry(), token: map.tokens[0], to: { x: 75, y: 75 } }))
      .toBeUndefined()
  })

  it('allows a diagonal step when only one orthogonal corner contains a creature', () => {
    const map = battleMap({
      width: 100,
      height: 100,
      tokens: [
        token(),
        token({ id: 'east-blocker', type: 'enemy', characterId: undefined, x: 75, y: 25 }),
      ],
    })

    expect(findMapGeometryPath({ map, geometry: geometry(), token: map.tokens[0], to: { x: 75, y: 75 } }))
      .toMatchObject({ distanceFeet: 5, movementCostFeet: 5 })
  })

  it('does not overshoot an axis and zigzag when an equal-cost direct route exists', () => {
    const hero = token({ x: 225, y: 225 })
    const map = battleMap({ width: 300, height: 300, tokens: [hero] })
    const path = findMapGeometryPath({ map, geometry: geometry(), token: hero, to: { x: 25, y: 125 } })

    expect(path).toBeDefined()
    expect(path!.cells.every((cell) => cell.col >= 0 && cell.col <= 4)).toBe(true)
    expect(path!.cells.every((cell) => cell.row >= 2 && cell.row <= 4)).toBe(true)
    expect(path!.distanceFeet).toBe(20)
  })

  it('keeps a clear vertical move on the same column', () => {
    const hero = token({ x: 225, y: 75 })
    const map = battleMap({ width: 300, height: 300, tokens: [hero] })
    const path = findMapGeometryPath({ map, geometry: geometry(), token: hero, to: { x: 225, y: 225 } })

    expect(path).toBeDefined()
    expect(path!.cells.map((cell) => cell.col)).toEqual([4, 4, 4, 4])
    expect(path!.distanceFeet).toBe(15)
  })
})
