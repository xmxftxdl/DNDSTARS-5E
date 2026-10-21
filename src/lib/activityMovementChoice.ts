import type { GridCell } from './gridCombat'

export interface ActivityMovementChoice {
  actorTokenId: string
  originTokenId: string
  rangeFeet: number
  label: string
  allowedCells?: readonly GridCell[]
}

export function readActivityMovementCell(value: unknown): GridCell | undefined {
  if (!value || typeof value !== 'object') return undefined
  const cell = value as Record<string, unknown>
  return Number.isSafeInteger(cell.col) && Number.isSafeInteger(cell.row) &&
    Math.abs(cell.col as number) <= 1_000_000 && Math.abs(cell.row as number) <= 1_000_000
    ? { col: cell.col as number, row: cell.row as number } : undefined
}

export function readActivityMovementChoice(value: unknown): ActivityMovementChoice | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  if (typeof input.actorTokenId !== 'string' || !input.actorTokenId ||
    typeof input.originTokenId !== 'string' || !input.originTokenId ||
    typeof input.label !== 'string' || typeof input.rangeFeet !== 'number' ||
    !Number.isFinite(input.rangeFeet) || input.rangeFeet < 0 || input.rangeFeet > 1_000_000) return undefined
  if (input.allowedCells !== undefined && (!Array.isArray(input.allowedCells) ||
    input.allowedCells.some(cell => !readActivityMovementCell(cell)))) return undefined
  return { actorTokenId: input.actorTokenId, originTokenId: input.originTokenId,
    rangeFeet: input.rangeFeet, label: input.label,
    ...(Array.isArray(input.allowedCells) ? { allowedCells: input.allowedCells.map(cell => readActivityMovementCell(cell)!) } : {}) }
}
