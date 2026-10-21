export interface Dnd5ePersistentAreaGroundCover {
  feature: 'undergrowth'
  relation: 'ally' | 'enemy' | 'any'
}

export function normalizeDnd5ePersistentAreaGroundCover(value: unknown): Dnd5ePersistentAreaGroundCover | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['feature', 'relation'].includes(key)) || raw.feature !== 'undergrowth' ||
    (raw.relation !== 'ally' && raw.relation !== 'enemy' && raw.relation !== 'any')) return undefined
  return { feature: raw.feature, relation: raw.relation }
}
