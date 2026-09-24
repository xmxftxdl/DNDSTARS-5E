import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { resolveSpellAreaObstruction } from './spellAreaObstruction'

const map = { id: 'obstruction', gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, width: 500, height: 500, tokens: [] } as unknown as BattleMap
const target = { id: 'target', x: 175, y: 125, elevationFeet: 0, size: 1, type: 'enemy' } as Token
function setup(spellId = 'shatter', height = 20) {
  const geometry = createEmptyMapGeometry(map.id)
  geometry.walls.push({ id: 'wall', kind: 'wall', label: 'wall', points: [{ x: 100, y: 0 }, { x: 100, y: 500 }],
    baseHeightFeet: 0, heightFeet: height, blocksVision: false, blocksMovement: true, blocksLineOfEffect: true, createdAt: 0 })
  const cells = Array.from({ length: 36 }, (_, i) => ({ col: i % 6, row: Math.floor(i / 6) }))
  const input = { spellId, map, geometry, cells, area: { shape: 'circle' as const, origin: 'point' as const, radiusFeet: 25 }, origin: { x: 75, y: 125 }, elevationFeet: 0 }
  return { geometry, input }
}
describe('shared spell obstruction', () => {
  it('blocks effects through a transparent physical wall', () => {
    const { input } = setup()
    const result = resolveSpellAreaObstruction(input)
    expect(result.affectsToken(target)).toBe(false)
    expect(result.cells.some(cell => cell.col > 1)).toBe(false)
  })
  it('does not confuse fog-like vision blocking with physical effect blocking', () => {
    const { input, geometry } = setup()
    geometry.walls[0].blocksVision = true
    geometry.walls[0].blocksLineOfEffect = false
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(true)
  })
  it('allows elevated effects over a low wall', () => {
    const { input } = setup('shatter', 5)
    expect(resolveSpellAreaObstruction({ ...input, elevationFeet: 15 }).affectsToken({ ...target, elevationFeet: 15 })).toBe(true)
  })
  it('recomputes obstruction when a door opens', () => {
    const { input, geometry } = setup()
    const wall = geometry.walls.pop()!
    geometry.doors.push({ ...wall, points: [wall.points[0], wall.points[1]], kind: 'door', state: 'closed', openState: 'closed', secret: false })
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(false)
    geometry.doors[0].state = 'open'
    geometry.doors[0].openState = 'open'
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(true)
  })
  it('spreads only explicitly permitted spells around a reachable corner', () => {
    const { input, geometry } = setup('fireball')
    geometry.walls[0].points[1].y = 160
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(true)
    expect(resolveSpellAreaObstruction({ ...input, spellId: 'shatter' }).affectsToken(target)).toBe(false)
    expect(resolveSpellAreaObstruction({ ...input, area: { ...input.area, radiusFeet: 5 } }).affectsToken(target)).toBe(false)
  })
  it('does not spread through a sealed wall, and honors explicit wall exceptions', () => {
    const { input } = setup('fireball')
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(false)
    expect(resolveSpellAreaObstruction({ ...input, ignoresWalls: true }).affectsToken(target)).toBe(true)
  })
})
