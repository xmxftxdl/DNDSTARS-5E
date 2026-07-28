export function parseLiveHitPointDraft(draft: string, maxHp: number): number | undefined {
  if (draft.trim() === '') return undefined
  const parsed = Number(draft)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(maxHp, Math.floor(parsed)))
}
