import { afterEach, expect, it } from 'vitest'
import { cellKey, tokenOccupiedCellsAt } from '../../../lib/gridCombat'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import type { BattleMap, Token } from '../../../store/maps'
import { dnd5eNearestOutsideAreaMovementV1 } from './dnd5eActivityMapInteraction'
import { normalizeDnd5ePersistentAreaTriggerDeclaration } from '../persistentAreaTypes'

afterEach(() => setMapGeometryRuntime([]))
function fixture(): BattleMap {
  return { id: 'ejection', name: 'Ejection', width: 250, height: 250, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    feetPerCell: 5, showGrid: true, tokens: [{ id: 'target', label: 'Target', x: 125, y: 125, size: 1, type: 'enemy', color: '#fff', emoji: '' }] }
}
const area = { cells: [{ col: 2, row: 2 }] }
it('chooses the nearest free cell with stable ties and never mutates input', () => {
  const map = fixture(), before = structuredClone(map)
  const first = dnd5eNearestOutsideAreaMovementV1({ map, area, targetTokenId: 'target' })
  expect(first).toEqual({ position: { x: 75, y: 75 }, distanceFeet: 5 })
  expect(map).toEqual(before)
  map.tokens.push({ ...map.tokens[0], id: 'occupied', x: 75, y: 75 })
  expect(dnd5eNearestOutsideAreaMovementV1({ map, area, targetTokenId: 'target' }))
    .toEqual({ position: { x: 125, y: 75 }, distanceFeet: 5 })
})
it('does not move through a closed barrier even when its other side has free cells', () => {
  const map = fixture(), geometry = createEmptyMapGeometry(map.id, 1)
  geometry.doors.push({ id: 'barrier', kind: 'door', label: 'Barrier', points: [{ x: 0, y: 100 }, { x: 250, y: 100 }],
    state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact', secret: false,
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  expect(dnd5eNearestOutsideAreaMovementV1({ map, area, targetTokenId: 'target' }))
    .toEqual({ position: { x: 75, y: 125 }, distanceFeet: 5 })
})
it('moves the complete large footprint outside and refuses a map with no free outside space', () => {
  const map = fixture()
  map.tokens[0] = { ...map.tokens[0], size: 2, x: 150, y: 150 }
  const moved = dnd5eNearestOutsideAreaMovementV1({ map, area, targetTokenId: 'target' })!
  expect(moved).toBeDefined()
  const cells = tokenOccupiedCellsAt(map.tokens[0], map, moved.position)
  expect(cells.some(cell => cellKey(cell) === cellKey(area.cells[0]))).toBe(false)
  expect(cells.every(cell => cell.col >= 0 && cell.row >= 0 && cell.col < 5 && cell.row < 5)).toBe(true)
  const full = { cells: Array.from({ length: 25 }, (_, i) => ({ col: i % 5, row: Math.floor(i / 5) })) }
  expect(dnd5eNearestOutsideAreaMovementV1({ map, area: full, targetTokenId: 'target' })).toBeUndefined()
  map.tokens[0] = { ...map.tokens[0], size: 1, x: 25, y: 25 } as Token
  expect(dnd5eNearestOutsideAreaMovementV1({ map, area, targetTokenId: 'target' }))
    .toEqual({ position: { x: 25, y: 25 }, distanceFeet: 0 })
})
it('rejects invented distances and save-dependent movement without a save', () => {
  const trigger = { id: 'eject', label: 'Eject', timing: 'on-enter', forcedMovement: { mode: 'nearest-outside-area', appliesOn: 'always' } }
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration(trigger)?.forcedMovement).toEqual(trigger.forcedMovement)
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({ ...trigger, forcedMovement: { ...trigger.forcedMovement, distanceFeet: 5 } })).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({ ...trigger, forcedMovement: { ...trigger.forcedMovement, appliesOn: 'successful-save' } })).toBeUndefined()
})
