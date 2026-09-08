export interface Dnd5eCampaignPeriodicHitPointMaximumReduction {
  intervalHours: number
  reduction: { average: number; count: number; sides: number; bonus: number }
  execution: 'campaign-time-only'
  recovery: 'when-effect-removed'
  onMaximumZero?: 'destroy-body'
  nextWorldMinute?: number
  lastResolvedWorldMinute?: number
}

export function normalizeDnd5eCampaignPeriodicHitPointMaximumReduction(
  raw: unknown,
): Dnd5eCampaignPeriodicHitPointMaximumReduction | undefined {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const integer = (value: unknown, minimum: number, maximum: number) => Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
  if (!record(raw) || !Object.keys(raw).every(key => ['intervalHours', 'reduction', 'execution', 'recovery',
    'onMaximumZero', 'nextWorldMinute', 'lastResolvedWorldMinute'].includes(key)) ||
    !integer(raw.intervalHours, 1, 24 * 365 * 100) || raw.execution !== 'campaign-time-only' ||
    raw.recovery !== 'when-effect-removed' || (raw.onMaximumZero != null && raw.onMaximumZero !== 'destroy-body') || !record(raw.reduction)) return undefined
  const dice = raw.reduction
  if (!Object.keys(dice).every(key => ['average', 'count', 'sides', 'bonus'].includes(key)) ||
    !integer(dice.average, 0, 1_000_000) || !integer(dice.count, 1, 1_000) ||
    !integer(dice.sides, 2, 1_000_000) || !integer(dice.bonus, -1_000_000, 1_000_000) ||
    (raw.nextWorldMinute != null && !integer(raw.nextWorldMinute, 0, Number.MAX_SAFE_INTEGER)) ||
    (raw.lastResolvedWorldMinute != null && !integer(raw.lastResolvedWorldMinute, 0, Number.MAX_SAFE_INTEGER))) return undefined
  return { intervalHours: Number(raw.intervalHours),
    reduction: { average: Number(dice.average), count: Number(dice.count), sides: Number(dice.sides), bonus: Number(dice.bonus) },
    execution: 'campaign-time-only', recovery: 'when-effect-removed',
    ...(raw.onMaximumZero === 'destroy-body' ? { onMaximumZero: 'destroy-body' as const } : {}),
    ...(raw.nextWorldMinute != null ? { nextWorldMinute: Number(raw.nextWorldMinute) } : {}),
    ...(raw.lastResolvedWorldMinute != null ? { lastResolvedWorldMinute: Number(raw.lastResolvedWorldMinute) } : {}),
  }
}
