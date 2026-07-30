import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { createEmptyMapGeometry } from './mapGeometry'
import { planMapTokenDrop } from './mapTokenDropPlanner'

const token = (patch: Partial<Token> = {}): Token => ({
  id: 'hero',
  label: 'Hero',
  x: 25,
  y: 25,
  color: '#fff',
  emoji: 'H',
  size: 1,
  type: 'player',
  ...patch,
})

const map = (tokens: Token[]): BattleMap => ({
  id: 'map',
  name: 'Map',
  width: 500,
  height: 500,
  gridSize: 50,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  feetPerCell: 5,
  tokens,
})

describe('map Token drop planner', () => {
  it('snaps a Token and preserves its height above new terrain', () => {
    const actor = token({ elevationFeet: 10 })
    const geometry = createEmptyMapGeometry('map', 1)
    geometry.obstacles.push({
      id: 'raised-ground',
      kind: 'obstacle',
      label: 'Raised ground',
      points: [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }],
      blocksVision: false,
      blocksMovement: false,
      blocksLineOfEffect: false,
      cover: 'none',
      baseHeightFeet: 0,
      heightFeet: 0,
      terrainElevationFeet: 15,
      createdAt: 1,
    })
    const plan = planMapTokenDrop({
      token: actor,
      map: map([actor]),
      geometry,
      x: 125,
      y: 25,
      validateMovementLocally: true,
    })
    expect(plan).toEqual({
      status: 'allowed',
      position: { x: 125, y: 25 },
      elevationFeet: 25,
    })
  })

  it('reports a blocking wall before any map mutation', () => {
    const actor = token()
    const geometry = createEmptyMapGeometry('map', 1)
    geometry.walls.push({
      id: 'wall',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    expect(planMapTokenDrop({
      token: actor,
      map: map([actor]),
      geometry,
      x: 125,
      y: 25,
      validateMovementLocally: true,
    })).toEqual({ status: 'blocked', entityId: 'wall' })
  })

  it('allows authority to bypass only the local collision decision', () => {
    const actor = token()
    const geometry = createEmptyMapGeometry('map', 1)
    geometry.walls.push({
      id: 'wall',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    expect(planMapTokenDrop({
      token: actor,
      map: map([actor]),
      geometry,
      x: 125,
      y: 25,
      validateMovementLocally: false,
    })).toMatchObject({
      status: 'allowed',
      position: { x: 125, y: 25 },
    })
  })
})
