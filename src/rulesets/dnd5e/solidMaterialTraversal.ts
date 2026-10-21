import type { MapTraversableSolidMaterial } from '../../lib/mapSolidMaterialTraversal'

export interface Dnd5eSolidMaterialTraversal {
  materials: readonly MapTraversableSolidMaterial[]
  endInside: 'eject-end-source-stun-until-next-turn-end'
}

export function normalizeDnd5eSolidMaterialTraversal(value: unknown): Dnd5eSolidMaterialTraversal | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['materials', 'endInside'].includes(key)) ||
    raw.endInside !== 'eject-end-source-stun-until-next-turn-end' ||
    !Array.isArray(raw.materials) || raw.materials.length === 0 ||
    new Set(raw.materials).size !== raw.materials.length ||
    raw.materials.some(material => material !== 'earth' && material !== 'stone')) return undefined
  return { materials: [...raw.materials], endInside: raw.endInside }
}
