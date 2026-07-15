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
