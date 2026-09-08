import type { GridCell } from '../../lib/gridCombat'

export const DND5E_CREATION_MATERIALS = [
  'plant',
  'stone-or-crystal',
  'precious-metal',
  'gemstone',
  'adamantine-or-mithral',
] as const

export type Dnd5eCreationMaterial = typeof DND5E_CREATION_MATERIALS[number]

export interface Dnd5eCreationDeclarationV1 {
  schemaVersion: 1
  objectDescription: string
  /** Mixed objects list every constituent category; the shortest duration wins. */
  materials: Dnd5eCreationMaterial[]
  /** Edge length of the enclosing cube selected by the player. */
  edgeFeet: number
  /** Top-left grid anchor of the created object's square map footprint. */
  targetCell: GridCell
}

export interface Dnd5eCreationObjectStateV1 {
  schemaVersion: 1
  sourceTokenId: string
  sourceCharacterId: string
  sourceActionId: string
  slotLevel: number
  objectDescription: string
  materials: Dnd5eCreationMaterial[]
  edgeFeet: number
  createdWorldMinute: number
  expiresAtWorldMinute: number
  /** Rules guard: another spell that uses this object as a component fails. */
  cannotBeSpellMaterial: true
}

export const DND5E_CREATION_MATERIAL_LABELS: Record<Dnd5eCreationMaterial, string> = {
  plant: '植物材料',
  'stone-or-crystal': '石头或水晶',
  'precious-metal': '贵金属',
  gemstone: '宝石',
  'adamantine-or-mithral': '精金或秘银',
}

const DURATION_MINUTES: Record<Dnd5eCreationMaterial, number> = {
  plant: 24 * 60,
  'stone-or-crystal': 12 * 60,
  'precious-metal': 60,
  gemstone: 10,
  'adamantine-or-mithral': 1,
}

function normalizedText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= 120 ? normalized : undefined
}

function normalizedMaterials(value: unknown): Dnd5eCreationMaterial[] | undefined {
  return Array.isArray(value) && value.length >= 1 && value.length <= 5 &&
    value.every((material) => DND5E_CREATION_MATERIALS.includes(material as Dnd5eCreationMaterial)) &&
    new Set(value).size === value.length
    ? value as Dnd5eCreationMaterial[]
    : undefined
}

export function dnd5eCreationMaximumEdgeFeet(slotLevel: number): number {
  if (!Number.isInteger(slotLevel) || slotLevel < 5 || slotLevel > 9) return 0
  return 5 + (slotLevel - 5) * 5
}

export function dnd5eCreationDurationMinutes(
  materials: readonly Dnd5eCreationMaterial[],
): number {
  if (materials.length < 1) return 0
  return Math.min(...materials.map((material) => DURATION_MINUTES[material] ?? 0))
}

export function normalizeDnd5eCreationDeclarationV1(
  value: unknown,
): Dnd5eCreationDeclarationV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const objectDescription = normalizedText(raw.objectDescription)
  const materials = normalizedMaterials(raw.materials)
  const targetCell = raw.targetCell && typeof raw.targetCell === 'object' && !Array.isArray(raw.targetCell)
    ? raw.targetCell as Record<string, unknown>
    : undefined
  if (
    raw.schemaVersion !== 1 || !objectDescription || !materials ||
    !Number.isInteger(raw.edgeFeet) || Number(raw.edgeFeet) < 1 || Number(raw.edgeFeet) > 25 ||
    !targetCell || !Number.isInteger(targetCell.col) || !Number.isInteger(targetCell.row) ||
    Number(targetCell.col) < 0 || Number(targetCell.row) < 0 ||
    Number(targetCell.col) > 100_000 || Number(targetCell.row) > 100_000
  ) return undefined
  return {
    schemaVersion: 1,
    objectDescription,
    materials: [...materials],
    edgeFeet: Number(raw.edgeFeet),
    targetCell: { col: Number(targetCell.col), row: Number(targetCell.row) },
  }
}

export function normalizeDnd5eCreationObjectStateV1(
  value: unknown,
): Dnd5eCreationObjectStateV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const objectDescription = normalizedText(raw.objectDescription)
  const materials = normalizedMaterials(raw.materials)
  const validId = (id: unknown, maximum: number) =>
    typeof id === 'string' && id.length >= 1 && id.length <= maximum && /^[a-z0-9][a-z0-9._:-]*$/i.test(id)
  if (
    raw.schemaVersion !== 1 ||
    !validId(raw.sourceTokenId, 160) || !validId(raw.sourceCharacterId, 160) ||
    !validId(raw.sourceActionId, 200) ||
    !Number.isInteger(raw.slotLevel) || Number(raw.slotLevel) < 5 || Number(raw.slotLevel) > 9 ||
    !objectDescription || !materials ||
    !Number.isInteger(raw.edgeFeet) || Number(raw.edgeFeet) < 1 ||
    Number(raw.edgeFeet) > dnd5eCreationMaximumEdgeFeet(Number(raw.slotLevel)) ||
    !Number.isSafeInteger(raw.createdWorldMinute) || Number(raw.createdWorldMinute) < 0 ||
    !Number.isSafeInteger(raw.expiresAtWorldMinute) ||
    Number(raw.expiresAtWorldMinute) !== Number(raw.createdWorldMinute) + dnd5eCreationDurationMinutes(materials) ||
    raw.cannotBeSpellMaterial !== true
  ) return undefined
  return {
    schemaVersion: 1,
    sourceTokenId: raw.sourceTokenId as string,
    sourceCharacterId: raw.sourceCharacterId as string,
    sourceActionId: raw.sourceActionId as string,
    slotLevel: Number(raw.slotLevel),
    objectDescription,
    materials: [...materials],
    edgeFeet: Number(raw.edgeFeet),
    createdWorldMinute: Number(raw.createdWorldMinute),
    expiresAtWorldMinute: Number(raw.expiresAtWorldMinute),
    cannotBeSpellMaterial: true,
  }
}
