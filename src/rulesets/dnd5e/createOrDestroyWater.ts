import type { BattleMap } from '../../store/maps'
import type { GridCell } from '../../lib/gridCombat'

export const DND5E_CREATE_OR_DESTROY_WATER_MODES = [
  'create-container',
  'create-rain',
  'destroy-container',
  'destroy-fog',
] as const

export type Dnd5eCreateOrDestroyWaterMode = typeof DND5E_CREATE_OR_DESTROY_WATER_MODES[number]

export const DND5E_CREATE_OR_DESTROY_WATER_MODE_LABELS: Record<Dnd5eCreateOrDestroyWaterMode, string> = {
  'create-container': '造水：敞开容器',
  'create-rain': '造水：立方区域降雨',
  'destroy-container': '枯水：敞开容器',
  'destroy-fog': '枯水：立方区域清雾',
}

export interface Dnd5eWaterContainerStateV1 {
  schemaVersion: 1
  open: boolean
  capacityGallons: number
  waterGallons: number
}

export interface Dnd5eCreateOrDestroyWaterDeclarationV1 {
  schemaVersion: 1
  mode: Dnd5eCreateOrDestroyWaterMode
  targetCell: GridCell
  /** Container modes snapshot the exact object selected by the player. */
  targetObjectId?: string
  targetObjectName?: string
  /** Exact amount selected by the player, bounded by slot scaling and container state. */
  gallons?: number
  /** Area modes use the printed 30-foot cube plus five feet per higher slot. */
  areaEdgeFeet?: number
  /** Destroy-fog snapshots every overlapping Fog Cloud area for atomic removal. */
  fogAreaIds?: string[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function boundedId(value: unknown, maximum = 200): string | undefined {
  return typeof value === 'string' && value.length >= 1 && value.length <= maximum &&
    /^[a-z0-9][a-z0-9._:-]*$/i.test(value)
    ? value
    : undefined
}

function boundedName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= 120 ? normalized : undefined
}

function normalizedCell(value: unknown): GridCell | undefined {
  const raw = record(value)
  if (
    !raw || !Number.isInteger(raw.col) || !Number.isInteger(raw.row) ||
    Number(raw.col) < 0 || Number(raw.row) < 0 ||
    Number(raw.col) > 100_000 || Number(raw.row) > 100_000
  ) return undefined
  return { col: Number(raw.col), row: Number(raw.row) }
}

export function dnd5eCreateOrDestroyWaterMaximumGallons(slotLevel: number): number {
  return Number.isInteger(slotLevel) && slotLevel >= 1 && slotLevel <= 9 ? slotLevel * 10 : 0
}

export function dnd5eCreateOrDestroyWaterCubeEdgeFeet(slotLevel: number): number {
  return Number.isInteger(slotLevel) && slotLevel >= 1 && slotLevel <= 9
    ? 30 + (slotLevel - 1) * 5
    : 0
}

export function dnd5eCreateOrDestroyWaterAreaCells(input: {
  map: Pick<BattleMap, 'feetPerCell'>
  targetCell: GridCell
  areaEdgeFeet: number
}): GridCell[] {
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const edgeCells = Math.max(1, Math.ceil(input.areaEdgeFeet / feetPerCell))
  const cells: GridCell[] = []
  for (let row = input.targetCell.row; row < input.targetCell.row + edgeCells; row += 1) {
    for (let col = input.targetCell.col; col < input.targetCell.col + edgeCells; col += 1) {
      cells.push({ col, row })
    }
  }
  return cells
}

export function dnd5eCreateOrDestroyWaterFogAreaIds(input: {
  map: Pick<BattleMap, 'feetPerCell' | 'dnd5ePluginAreas'>
  targetCell: GridCell
  areaEdgeFeet: number
}): string[] {
  const selectedCells = new Set(dnd5eCreateOrDestroyWaterAreaCells(input)
    .map((cell) => `${cell.col}:${cell.row}`))
  return (input.map.dnd5ePluginAreas ?? [])
    .filter((area) => area.sourceKind === 'core-spell' && area.coreSpellId === 'fog-cloud' &&
      area.cells.some((cell) => selectedCells.has(`${cell.col}:${cell.row}`)))
    .map((area) => area.id)
    .sort()
}

export function normalizeDnd5eWaterContainerStateV1(
  value: unknown,
): Dnd5eWaterContainerStateV1 | undefined {
  const raw = record(value)
  if (
    !raw || raw.schemaVersion !== 1 || typeof raw.open !== 'boolean' ||
    !Number.isInteger(raw.capacityGallons) || Number(raw.capacityGallons) < 1 || Number(raw.capacityGallons) > 10_000 ||
    !Number.isInteger(raw.waterGallons) || Number(raw.waterGallons) < 0 ||
    Number(raw.waterGallons) > Number(raw.capacityGallons)
  ) return undefined
  return {
    schemaVersion: 1,
    open: raw.open,
    capacityGallons: Number(raw.capacityGallons),
    waterGallons: Number(raw.waterGallons),
  }
}

export function normalizeDnd5eCreateOrDestroyWaterDeclarationV1(
  value: unknown,
): Dnd5eCreateOrDestroyWaterDeclarationV1 | undefined {
  const raw = record(value)
  const mode = DND5E_CREATE_OR_DESTROY_WATER_MODES.includes(raw?.mode as Dnd5eCreateOrDestroyWaterMode)
    ? raw?.mode as Dnd5eCreateOrDestroyWaterMode
    : undefined
  const targetCell = normalizedCell(raw?.targetCell)
  if (!raw || raw.schemaVersion !== 1 || !mode || !targetCell) return undefined
  const containerMode = mode === 'create-container' || mode === 'destroy-container'
  if (containerMode) {
    const targetObjectId = boundedId(raw.targetObjectId)
    const targetObjectName = boundedName(raw.targetObjectName)
    if (
      !targetObjectId || !targetObjectName ||
      !Number.isInteger(raw.gallons) || Number(raw.gallons) < 1 || Number(raw.gallons) > 90 ||
      raw.areaEdgeFeet != null || raw.fogAreaIds != null
    ) return undefined
    return {
      schemaVersion: 1,
      mode,
      targetCell,
      targetObjectId,
      targetObjectName,
      gallons: Number(raw.gallons),
    }
  }
  const fogAreaIds = mode === 'destroy-fog' && Array.isArray(raw.fogAreaIds) &&
    raw.fogAreaIds.length >= 1 && raw.fogAreaIds.length <= 64 &&
    raw.fogAreaIds.every((id) => boundedId(id)) && new Set(raw.fogAreaIds).size === raw.fogAreaIds.length
    ? [...raw.fogAreaIds].sort() as string[]
    : mode === 'create-rain' && raw.fogAreaIds == null
      ? undefined
      : null
  if (
    !Number.isInteger(raw.areaEdgeFeet) || Number(raw.areaEdgeFeet) < 30 || Number(raw.areaEdgeFeet) > 70 ||
    Number(raw.areaEdgeFeet) % 5 !== 0 || fogAreaIds === null ||
    raw.targetObjectId != null || raw.targetObjectName != null || raw.gallons != null
  ) return undefined
  return {
    schemaVersion: 1,
    mode,
    targetCell,
    areaEdgeFeet: Number(raw.areaEdgeFeet),
    fogAreaIds,
  }
}
