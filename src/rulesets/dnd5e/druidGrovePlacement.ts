import type { GridCell } from '../../lib/gridCombat'

/** Prepared by the Host from the selected ground surface and mapped structures. */
export interface Dnd5eDruidGroveGroundFacts {
  environment: 'outdoors' | 'underground' | 'indoors'
  cells: readonly GridCell[]
  structureCells: readonly GridCell[]
  trees: readonly { tokenId: string; cell: GridCell }[]
}

export interface Dnd5eDruidGrovePlacement {
  origin: GridCell
  sideFeet: number
  fogCells: readonly GridCell[]
  undergrowthCells: readonly GridCell[]
  guardianTreeIds: readonly string[]
}

const key = (cell: GridCell) => `${cell.col},${cell.row}`
const validCell = (cell: GridCell) => cell != null && Number.isSafeInteger(cell.col) && Number.isSafeInteger(cell.row)

/** Geometry only: callers must separately authorize the cast, material and exemptions. */
export function planDnd5eDruidGroveGround(
  placement: Dnd5eDruidGrovePlacement,
  facts: Dnd5eDruidGroveGroundFacts,
): { ok: true; protectedCells: GridCell[]; fogCells: GridCell[]; undergrowthCells: GridCell[]; guardianTreeIds: string[] }
  | { ok: false; reason: 'invalid-environment' | 'invalid-volume' | 'invalid-ground' | 'invalid-subarea' | 'overlapping-subareas' | 'invalid-guardians' } {
  if (!['outdoors', 'underground'].includes(facts.environment)) return { ok: false, reason: 'invalid-environment' }
  if (!validCell(placement.origin) || !Number.isFinite(placement.sideFeet) || placement.sideFeet < 30 || placement.sideFeet > 90 || placement.sideFeet % 5 !== 0) {
    return { ok: false, reason: 'invalid-volume' }
  }
  if ([...facts.cells, ...facts.structureCells].some(cell => !validCell(cell))) return { ok: false, reason: 'invalid-ground' }
  const sideCells = placement.sideFeet / 5
  const inside = (cell: GridCell) => cell.col >= placement.origin.col && cell.row >= placement.origin.row &&
    cell.col < placement.origin.col + sideCells && cell.row < placement.origin.row + sideCells
  const structures = new Set(facts.structureCells.map(key))
  const protectedCells = [...new Map(facts.cells.filter(cell => inside(cell) && !structures.has(key(cell))).map(cell => [key(cell), { ...cell }])).values()]
  const protectedKeys = new Set(protectedCells.map(key))
  if (!protectedKeys.size) return { ok: false, reason: 'invalid-ground' }
  const validSubarea = (cells: readonly GridCell[]) => cells.every(cell => validCell(cell) && protectedKeys.has(key(cell))) && new Set(cells.map(key)).size === cells.length
  if (!validSubarea(placement.fogCells) || !validSubarea(placement.undergrowthCells)) return { ok: false, reason: 'invalid-subarea' }
  const fog = new Set(placement.fogCells.map(key))
  if (placement.undergrowthCells.some(cell => fog.has(key(cell)))) return { ok: false, reason: 'overlapping-subareas' }
  if (placement.guardianTreeIds.length > 4 || new Set(placement.guardianTreeIds).size !== placement.guardianTreeIds.length ||
    placement.guardianTreeIds.some(id => {
      const matches = facts.trees.filter(tree => tree.tokenId === id)
      return !id.trim() || matches.length !== 1 || !validCell(matches[0].cell) || !protectedKeys.has(key(matches[0].cell))
    })) return { ok: false, reason: 'invalid-guardians' }
  return { ok: true, protectedCells, fogCells: placement.fogCells.map(cell => ({ ...cell })),
    undergrowthCells: placement.undergrowthCells.map(cell => ({ ...cell })), guardianTreeIds: [...placement.guardianTreeIds] }
}
