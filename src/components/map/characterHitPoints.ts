export function parseLiveHitPointDraft(draft: string, maxHp: number): number | undefined {
  if (draft.trim() === '') return undefined
  const parsed = Number(draft)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(maxHp, Math.floor(parsed)))
}

export interface HitPointDisplayInput {
  currentHp: number
  maxHp: number
  currentHpDraft: string
  maxHpDraft: string
  editingCurrentHp: boolean
  editingMaxHp: boolean
  pending?: {
    currentHp: number
    maxHp: number
  } | null
}

/**
 * Keeps the numeric fields and health bar on the same optimistic snapshot while
 * a serialized room command is waiting for its authoritative acknowledgement.
 */
export function resolveHitPointDisplay(input: HitPointDisplayInput): {
  currentHp: number
  maxHp: number
  percentage: number
} {
  const authoritativeMaxHp = Math.max(1, Math.floor(input.maxHp))
  const draftMaxHp = input.maxHpDraft.trim() === '' ? Number.NaN : Number(input.maxHpDraft)
  const maxHp = input.editingMaxHp && Number.isFinite(draftMaxHp)
    ? Math.max(1, Math.floor(draftMaxHp))
    : Math.max(1, Math.floor(input.pending?.maxHp ?? authoritativeMaxHp))
  const draftCurrentHp = parseLiveHitPointDraft(input.currentHpDraft, maxHp)
  const currentHp = Math.max(
    0,
    Math.min(
      maxHp,
      input.editingCurrentHp && draftCurrentHp != null
        ? draftCurrentHp
        : Math.floor(input.pending?.currentHp ?? input.currentHp),
    ),
  )
  return {
    currentHp,
    maxHp,
    percentage: Math.max(0, Math.min(100, currentHp / maxHp * 100)),
  }
}
