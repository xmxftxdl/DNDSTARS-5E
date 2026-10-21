export interface Dnd5ePersistentAreaSourceLimit {
  /** Package-local identity shared by all modes in the same limit. */
  groupId: string
  maximum: number
}

export function normalizeDnd5ePersistentAreaSourceLimit(value: unknown): Dnd5ePersistentAreaSourceLimit | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entry = value as Record<string, unknown>
  if (Object.keys(entry).some(key => key !== 'groupId' && key !== 'maximum') ||
    typeof entry.groupId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(entry.groupId) ||
    !Number.isInteger(entry.maximum) || Number(entry.maximum) < 1 || Number(entry.maximum) > 64) return undefined
  return { groupId: entry.groupId, maximum: Number(entry.maximum) }
}
