/** Presentation-only snapshot; never copies inventory, statistics or ownership. */
export interface Dnd5eLinkedTargetPresentation {
  emoji: string
  color: string
  size: number
  tokenPortrait?: string
  tokenPortraitImageId?: string
  poolId?: string
}

export function normalizeDnd5eLinkedTargetPresentation(value: unknown): Dnd5eLinkedTargetPresentation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entry = value as Record<string, unknown>
  if (Object.keys(entry).some(key => !['emoji', 'color', 'size', 'tokenPortrait', 'tokenPortraitImageId', 'poolId'].includes(key)) ||
    typeof entry.emoji !== 'string' || entry.emoji.length > 64 || typeof entry.color !== 'string' || entry.color.length > 100 ||
    typeof entry.size !== 'number' || !Number.isFinite(entry.size) || entry.size < 0.25 || entry.size > 8 ||
    (entry.tokenPortrait != null && (typeof entry.tokenPortrait !== 'string' || entry.tokenPortrait.length > 8_388_608)) ||
    (entry.tokenPortraitImageId != null && (typeof entry.tokenPortraitImageId !== 'string' || !entry.tokenPortraitImageId || entry.tokenPortraitImageId.length > 500)) ||
    (entry.poolId != null && (typeof entry.poolId !== 'string' || entry.poolId.length > 500))) return undefined
  return { emoji: entry.emoji, color: entry.color, size: entry.size,
    ...(typeof entry.tokenPortrait === 'string' ? { tokenPortrait: entry.tokenPortrait } : {}),
    ...(typeof entry.tokenPortraitImageId === 'string' ? { tokenPortraitImageId: entry.tokenPortraitImageId } : {}),
    ...(typeof entry.poolId === 'string' ? { poolId: entry.poolId } : {}) }
}
