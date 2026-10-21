/** Host-owned origin retained through physical-object and inventory conversions. */
export interface Dnd5eStructureObjectBinding {
  schemaVersion: 1
  mapId: string
  structureId: string
}

export function normalizeDnd5eStructureObjectBinding(value: unknown): Dnd5eStructureObjectBinding | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== 1 || Object.keys(raw).some(key => !['schemaVersion', 'mapId', 'structureId'].includes(key)) ||
    ![raw.mapId, raw.structureId].every(id => typeof id === 'string' && id.trim() === id && id.length > 0 && id.length <= 160)) return undefined
  return { schemaVersion: 1, mapId: raw.mapId as string, structureId: raw.structureId as string }
}
