export function resolveBoundedNumberDraft(
  draft: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!draft.trim()) return fallback
  const parsed = Number(draft)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
}

export function parseBoundedNumberDraft(
  draft: string,
  minimum: number,
  maximum: number,
): number | null {
  if (!draft.trim()) return null
  const parsed = Number(draft)
  if (!Number.isFinite(parsed)) return null
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
}
