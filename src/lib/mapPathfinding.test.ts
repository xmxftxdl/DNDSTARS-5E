import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { createEmptyMapGeometry, type MapGeometryState } from './mapGeometry'
import { createMapGeometryPathTree, findMapGeometryPath } from './mapPathfinding'

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

  it('uses terrain elevation as the starting elevation for legacy tokens without an explicit value', () => {
    const map = battleMap({ height: 50 })
    const state = geometry()
    state.obstacles.push({
      id: 'plateau',
      kind: 'obstacle',
      label: 'Plateau',
      points: [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 50 }, { x: 0, y: 50 }],
      blocksVision: false,
      blocksMovement: false,
      blocksLineOfEffect: false,
      cover: 'none',
      baseHeightFeet: 0,
      heightFeet: 0,
      terrainRegion: true,
      terrainElevationFeet: 20,
      createdAt: 1,
    })

    expect(findMapGeometryPath({
      map,
      geometry: state,
      token: map.tokens[0],
      to: { x: 125, y: 25 },
    })).toMatchObject({ elevationsFeet: [20, 20, 20] })
  })

  it('binds legacy difficult-terrain overlays to each cell terrain surface without charging flyers', () => {
    const grounded = token()
    const map = battleMap({ height: 50, tokens: [grounded] })
    const state = geometry()
    state.obstacles.push({
      id: 'plateau', kind: 'obstacle', label: 'Plateau',
      points: [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 50 }, { x: 0, y: 50 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1,
    }, {
      id: 'legacy-mud', kind: 'obstacle', label: 'Legacy mud',
      points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 0,
      terrainCostMultiplier: 2, traversal: 'ground', createdAt: 2,
    })

    expect(findMapGeometryPath({ map, geometry: state, token: grounded, to: { x: 125, y: 25 } }))
      .toMatchObject({ elevationsFeet: [20, 20, 20], distanceFeet: 10, movementCostFeet: 15 })

    const flyer = { ...grounded, elevationFeet: 40 }
    expect(findMapGeometryPath({
      map: { ...map, tokens: [flyer] },
      geometry: state,
      token: flyer,
      to: { x: 125, y: 25 },
      canFly: true,
      targetElevationFeet: 40,
    })).toMatchObject({ elevationsFeet: [40, 40, 40], distanceFeet: 10, movementCostFeet: 10 })
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
    // 飞行采用明确的“先在起点升降，再水平移动”顺序。
    })).toMatchObject({ elevationsFeet: [0, 40, 40] })
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

  it('reuses one exact weighted tree for many destinations', () => {
    const hero = token({ x: 25, y: 75 })
    const map = battleMap({ width: 300, height: 250, tokens: [hero] })
    const state = geometry()
    state.walls.push({
      id: 'divider', kind: 'wall', label: 'Divider',
      points: [{ x: 125, y: 0 }, { x: 125, y: 150 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    state.obstacles.push({
      id: 'mud', kind: 'obstacle', label: 'Mud',
      points: [
        { x: 50, y: 100 }, { x: 200, y: 100 },
        { x: 200, y: 200 }, { x: 50, y: 200 },
      ],
      blocksVision: false, blocksMovement: false,
      blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0,
      terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1,
    })
    const tree = createMapGeometryPathTree({
      map,
      geometry: state,
      token: hero,
    })

    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const destination = { x: col * 50 + 25, y: row * 50 + 25 }
        const reference = findMapGeometryPath({
          map,
          geometry: state,
          token: hero,
          to: destination,
        })
        const reused = tree.pathTo(destination)
        expect(reused?.movementCostFeet).toBe(reference?.movementCostFeet)
        expect(reused?.cells.at(-1)).toEqual(reference?.cells.at(-1))
      }
    }
    expect(tree.visitedCells).toBeLessThanOrEqual(30)
    expect(tree.truncated).toBe(false)
  })

  it('matches a target-directed path for a same-cell vertical flight', () => {
    const flyer = token({ elevationFeet: 0 })
    const map = battleMap({ tokens: [flyer] })
    const state = geometry()
    const input = {
      map,
      geometry: state,
      token: flyer,
      canFly: true,
      targetElevationFeet: 20,
    }
    const reference = findMapGeometryPath({
      ...input,
      to: { x: flyer.x, y: flyer.y },
    })
    const reused = createMapGeometryPathTree(input)
      .pathTo({ x: flyer.x, y: flyer.y })

    expect(reused).toEqual(reference)
    expect(reused?.elevationsFeet).toEqual([20])
  })

  it('passes each flight step elevation to additional cost callbacks in A* and path trees', () => {
    const flyer = token({ elevationFeet: 0 })
    const map = battleMap({ height: 50, tokens: [flyer] })
    const directSeen = {
      difficult: [] as Array<number | undefined>,
      speed: [] as Array<number | undefined>,
      legacy: [] as Array<number | undefined>,
    }
    const treeSeen = {
      difficult: [] as Array<number | undefined>,
      speed: [] as Array<number | undefined>,
      legacy: [] as Array<number | undefined>,
    }
    const callbacks = (seen: typeof directSeen) => ({
      additionalDifficultTerrainMultiplier: (stepToken: Token) => {
        seen.difficult.push(stepToken.elevationFeet)
        return 1
      },
      additionalSpeedCostMultiplier: (stepToken: Token) => {
        seen.speed.push(stepToken.elevationFeet)
        return 1
      },
      additionalCostMultiplier: (stepToken: Token) => {
        seen.legacy.push(stepToken.elevationFeet)
        return 1
      },
    })

    const direct = findMapGeometryPath({
      map,
      geometry: geometry(),
      token: flyer,
      to: { x: 125, y: 25 },
      canFly: true,
      targetElevationFeet: 20,
      ...callbacks(directSeen),
    })
    const reused = createMapGeometryPathTree({
      map,
      geometry: geometry(),
      token: flyer,
      canFly: true,
      targetElevationFeet: 20,
      ...callbacks(treeSeen),
    }).pathTo({ x: 125, y: 25 })

    expect(direct).toBeDefined()
    expect(reused).toBeDefined()
    for (const seen of [directSeen, treeSeen]) {
      for (const elevations of Object.values(seen)) {
        expect(elevations.length).toBeGreaterThan(0)
        expect(new Set(elevations)).toEqual(new Set([20]))
      }
    }
  })

  it('reports when the reusable search reaches its visited-cell limit', () => {
    const hero = token({ x: 505, y: 505 })
    const map = battleMap({
      width: 1_000,
      height: 1_000,
      gridSize: 10,
      tokens: [hero],
    })
    const tree = createMapGeometryPathTree({
      map,
      geometry: geometry(),
      token: hero,
      maximumVisited: 100,
    })

    expect(tree.visitedCells).toBe(100)
    expect(tree.truncated).toBe(true)
  })
})
