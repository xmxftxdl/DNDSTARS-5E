import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from './mapGeometry'
import { createMapGeometryPathTree, findMapGeometryPath } from './mapPathfinding'
import type { BattleMap, Token } from '../store/maps'

const token: Token = { id: 'climber', label: 'Climber', x: 25, y: 25, size: 1, type: 'player', color: '#fff', emoji: '' }
const map: BattleMap = { id: 'climb', name: 'Climb', width: 150, height: 50, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [token] }
const geometry = () => {
  const state = createEmptyMapGeometry(map.id, 1)
  state.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 0, y: 0 }, { x: 150, y: 0 }], blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 30, createdAt: 1 })
  return state
}

describe('surface-supported climbing', () => {
  it.each([[0, 20], [20, 0], [20, 30]])('charges vertical movement from %s to %s in both solvers', (from, to) => {
    const input = { map, geometry: geometry(), token: { ...token, elevationFeet: from }, climbVerticalSurfaces: true, canClimb: true, targetElevationFeet: to }
    for (const path of [findMapGeometryPath({ ...input, to: token }), createMapGeometryPathTree(input).pathTo(token)]) {
      expect(path).toMatchObject({ distanceFeet: Math.abs(to - from), movementCostFeet: Math.abs(to - from), elevationsFeet: [to] })
    }
    expect(createMapGeometryPathTree({ ...input, maximumMovementCostFeet: 5 }).pathTo(token)).toBeUndefined()
  })
  it('rejects unsupported ascent, leaving the wall and climbing beyond its top', () => {
    const input = { map, token, climbVerticalSurfaces: true, targetElevationFeet: 20 }
    expect(findMapGeometryPath({ ...input, to: token })).toBeUndefined()
    expect(findMapGeometryPath({ ...input, geometry: geometry(), targetElevationFeet: 35, to: token })).toBeUndefined()
    expect(findMapGeometryPath({ ...input, map: { ...map, height: 150 }, geometry: geometry(), to: { x: 25, y: 125 } })).toBeUndefined()
  })
  it('preserves wall collision and blocks ascent through another creature', () => {
    const state = geometry()
    state.walls.push({ ...state.walls[0], id: 'barrier', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] })
    expect(findMapGeometryPath({ map, token, geometry: state, climbVerticalSurfaces: true, targetElevationFeet: 20, to: { x: 75, y: 25 } })).toBeUndefined()
    expect(findMapGeometryPath({ map: { ...map, tokens: [token, { ...token, id: 'blocker', elevationFeet: 10 }] }, token, geometry: geometry(), climbVerticalSurfaces: true, targetElevationFeet: 20, to: token })).toBeUndefined()
  })
  it('charges both cliff faces even when the final elevation equals the starting elevation', () => {
    const state = createEmptyMapGeometry(map.id, 1)
    state.obstacles.push({ id: 'ledge', kind: 'obstacle', label: 'Ledge', points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }], blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 20, cover: 'none', createdAt: 1 })
    const input = { map, token, geometry: state, to: { x: 125, y: 25 } }
    expect(findMapGeometryPath(input)).toBeUndefined()
    expect(findMapGeometryPath({ ...input, climbVerticalSurfaces: true })).toMatchObject({ distanceFeet: 50, movementCostFeet: 50, elevationsFeet: [0, 20, 0] })
  })
})
