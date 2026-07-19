import {
  cellDistance,
  cellKey,
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Dnd5eItemArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry, Dnd5eInventoryTargeting } from '../../types/inventory'
import { applyDnd5eInventoryMutation } from './items'

export type Dnd5eItemAreaPlacementFailure =
  | 'invalid-targeting'
  | 'invalid-target-cell'
  | 'target-out-of-range'
  | 'area-out-of-bounds'
  | 'area-overlaps-actor'
  | 'item-use-rejected'

export interface Dnd5eItemAreaPreview {
  cells: GridCell[]
  rangeCells: GridCell[]
  valid: boolean
  reason?: Dnd5eItemAreaPlacementFailure
}

function areaCells(targeting: Extract<Dnd5eInventoryTargeting, { kind: 'map-area' }>, anchor: GridCell): GridCell[] {
  const cols = Math.max(1, Math.round(targeting.widthFeet / 5))
  const rows = Math.max(1, Math.round(targeting.heightFeet / 5))
  return Array.from({ length: cols * rows }, (_, index) => ({
    col: anchor.col + index % cols,
    row: anchor.row + Math.floor(index / cols),
  }))
}

function actorCells(actorToken: Token, map: BattleMap): GridCell[] {
  return tokenOccupiedCellsAt(actorToken, map, actorToken)
}

function minimumCellDistance(left: readonly GridCell[], right: readonly GridCell[]): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const a of left) for (const b of right) minimum = Math.min(minimum, cellDistance(a, b))
  return minimum
}

function inMap(cell: GridCell, map: BattleMap): boolean {
  const extent = mapCellExtent(map)
  return cell.col >= 0 && cell.row >= 0 && cell.col < extent.cols && cell.row < extent.rows
}

export function previewDnd5eItemAreaPlacement(input: {
  map: BattleMap
  actorToken: Token
  targeting: Dnd5eInventoryTargeting
  targetCell: GridCell
}): Dnd5eItemAreaPreview {
  if (input.targeting.kind !== 'map-area') return { cells: [], rangeCells: [], valid: false, reason: 'invalid-targeting' }
  const occupied = actorCells(input.actorToken, input.map)
  const rangeCells: GridCell[] = []
  const extent = mapCellExtent(input.map)
  const range = Math.max(0, Math.floor(input.targeting.rangeFeet / Math.max(1, input.map.feetPerCell ?? 5)))
  for (let row = 0; row < extent.rows; row++) {
    for (let col = 0; col < extent.cols; col++) {
      const cell = { col, row }
      if (Math.min(...occupied.map((actorCell) => cellDistance(actorCell, cell))) <= range) rangeCells.push(cell)
    }
  }
  const cells = areaCells(input.targeting, input.targetCell)
  if (cells.length < 1) return { cells, rangeCells, valid: false, reason: 'invalid-target-cell' }
  if (cells.some((cell) => !inMap(cell, input.map))) {
    return { cells, rangeCells, valid: false, reason: 'area-out-of-bounds' }
  }
  const occupiedKeys = new Set(occupied.map(cellKey))
  if (cells.some((cell) => occupiedKeys.has(cellKey(cell)))) {
    return { cells, rangeCells, valid: false, reason: 'area-overlaps-actor' }
  }
  if (minimumCellDistance(occupied, cells) > range) {
    return { cells, rangeCells, valid: false, reason: 'target-out-of-range' }
  }
  return { cells, rangeCells, valid: true }
}

export function placeDnd5eItemArea(input: {
  map: BattleMap
  characters: readonly Character[]
  actor: Character
  actorToken: Token
  entry: Dnd5eInventoryEntry
  targetCell: GridCell
  turnEconomy: Dnd5eTurnEconomyCounts
  areaId: string
  createdAt: number
}):
  | { ok: true; map: BattleMap; characters: Character[]; area: Dnd5eItemArea; spentEconomy?: 'action' | 'bonusAction' }
  | { ok: false; reason: Dnd5eItemAreaPlacementFailure } {
  const targeting = input.entry.item.use?.targeting
  if (!targeting || targeting.kind !== 'map-area') return { ok: false, reason: 'invalid-targeting' }
  const preview = previewDnd5eItemAreaPlacement({
    map: input.map,
    actorToken: input.actorToken,
    targeting,
    targetCell: input.targetCell,
  })
  if (!preview.valid) return { ok: false, reason: preview.reason ?? 'invalid-target-cell' }
  const mutation = applyDnd5eInventoryMutation(
    input.characters,
    { type: 'use', characterId: input.actor.id, instanceId: input.entry.instanceId },
    { turnEconomy: input.turnEconomy },
  )
  if (!mutation.ok) return { ok: false, reason: 'item-use-rejected' }
  const area: Dnd5eItemArea = {
    id: input.areaId,
    kind: targeting.areaKind,
    sourceCharacterId: input.actor.id,
    sourceTokenId: input.actorToken.id,
    sourceItemTemplateId: input.entry.templateId,
    sourceItemName: input.entry.item.name,
    cells: preview.cells,
    createdAt: input.createdAt,
    armed: true,
  }
  return {
    ok: true,
    map: { ...input.map, dnd5eItemAreas: [...(input.map.dnd5eItemAreas ?? []), area] },
    characters: mutation.characters,
    area,
    spentEconomy: mutation.spentEconomy,
  }
}

/** Bresenham 路径；地图当前按直线拖放结算，因此区域触发也沿同一格线顺序判断。 */
export function dnd5eMovementPathCells(from: GridCell, to: GridCell): GridCell[] {
  const cells: GridCell[] = []
  let col = from.col
  let row = from.row
  const deltaCol = Math.abs(to.col - from.col)
  const stepCol = from.col < to.col ? 1 : -1
  const deltaRow = -Math.abs(to.row - from.row)
  const stepRow = from.row < to.row ? 1 : -1
  let error = deltaCol + deltaRow
  while (true) {
    cells.push({ col, row })
    if (col === to.col && row === to.row) break
    const twice = 2 * error
    if (twice >= deltaRow) { error += deltaRow; col += stepCol }
    if (twice <= deltaCol) { error += deltaCol; row += stepRow }
  }
  return cells
}

export interface Dnd5eEnteredItemArea {
  area: Dnd5eItemArea
  enteredAt: GridCell
  pathIndex: number
}

export function dnd5eItemAreasEnteredByMove(input: {
  map: BattleMap
  token: Token
  to: { x: number; y: number }
}): Dnd5eEnteredItemArea[] {
  const fromAnchor = tokenAnchorCellFromPixel(input.token.x, input.token.y, input.token, input.map)
  const toAnchor = tokenAnchorCellFromPixel(input.to.x, input.to.y, input.token, input.map)
  const path = dnd5eMovementPathCells(fromAnchor, toAnchor)
  const found = new Set<string>()
  const entered: Dnd5eEnteredItemArea[] = []
  for (let pathIndex = 1; pathIndex < path.length; pathIndex++) {
    const anchor = path[pathIndex]
    const center = tokenCenterForAnchorCell(anchor, input.token, input.map)
    const footprint = new Set(tokenOccupiedCellsAt(input.token, input.map, center).map(cellKey))
    for (const area of input.map.dnd5eItemAreas ?? []) {
      if (!area.armed || found.has(area.id) || !area.cells.some((cell) => footprint.has(cellKey(cell)))) continue
      found.add(area.id)
      entered.push({ area, enteredAt: anchor, pathIndex })
    }
  }
  return entered
}

export function markDnd5eHuntingTrapTriggered(
  areas: readonly Dnd5eItemArea[] | undefined,
  areaId: string,
  tokenId: string,
): Dnd5eItemArea[] {
  return (areas ?? []).map((area) => area.id === areaId && area.kind === 'hunting-trap'
    ? { ...area, armed: false, triggeredTokenId: tokenId }
    : area)
}

