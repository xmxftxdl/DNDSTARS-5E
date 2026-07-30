export const DND5E_HIT_POINT_MAXIMUM_REDUCTION_LEDGER_VERSION = 1 as const

export type Dnd5eHitPointMaximumReductionRecovery =
  | 'long-rest'
  | 'greater-restoration-or-other-magic'

export interface Dnd5eHitPointMaximumReductionEntry {
  id: string
  amount: number
  recovery: Dnd5eHitPointMaximumReductionRecovery
  sourceActorId?: string
  sourceActionId?: string
  damageType?: string
  combatId?: string
}

/**
 * The base maximum is retained separately from the effective maximum so a
 * recoverable reduction is never mistaken for a permanent character-sheet
 * edit. Entries are additive and remain authoritative across map snapshots.
 */
export interface Dnd5eHitPointMaximumReductionLedger {
  schemaVersion: typeof DND5E_HIT_POINT_MAXIMUM_REDUCTION_LEDGER_VERSION
  baseMaximum: number
  entries: Dnd5eHitPointMaximumReductionEntry[]
}

function nonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(1_000_000_000, Math.floor(value)))
}

function normalizeEntry(
  value: unknown,
): Dnd5eHitPointMaximumReductionEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Partial<Dnd5eHitPointMaximumReductionEntry>
  const amount = nonNegativeInteger(raw.amount)
  if (
    typeof raw.id !== 'string' ||
    raw.id.length < 1 ||
    raw.id.length > 256 ||
    amount == null ||
    amount < 1 ||
    (
      raw.recovery !== 'long-rest' &&
      raw.recovery !== 'greater-restoration-or-other-magic'
    )
  ) return undefined
  return {
    id: raw.id,
    amount,
    recovery: raw.recovery,
    sourceActorId:
      typeof raw.sourceActorId === 'string' && raw.sourceActorId.length <= 256
        ? raw.sourceActorId
        : undefined,
    sourceActionId:
      typeof raw.sourceActionId === 'string' && raw.sourceActionId.length <= 256
        ? raw.sourceActionId
        : undefined,
    damageType:
      typeof raw.damageType === 'string' && raw.damageType.length <= 64
        ? raw.damageType
        : undefined,
    combatId:
      typeof raw.combatId === 'string' && raw.combatId.length <= 256
        ? raw.combatId
        : undefined,
  }
}

export function normalizeDnd5eHitPointMaximumReductionLedger(
  value: unknown,
): Dnd5eHitPointMaximumReductionLedger | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Partial<Dnd5eHitPointMaximumReductionLedger>
  const baseMaximum = nonNegativeInteger(raw.baseMaximum)
  if (
    raw.schemaVersion !== DND5E_HIT_POINT_MAXIMUM_REDUCTION_LEDGER_VERSION ||
    baseMaximum == null ||
    !Array.isArray(raw.entries) ||
    raw.entries.length < 1 ||
    raw.entries.length > 512
  ) return undefined
  const entries = raw.entries.map(normalizeEntry)
  if (entries.some((entry) => entry == null)) return undefined
  const normalizedEntries = entries as Dnd5eHitPointMaximumReductionEntry[]
  if (new Set(normalizedEntries.map((entry) => entry.id)).size !== normalizedEntries.length) {
    return undefined
  }
  return {
    schemaVersion: DND5E_HIT_POINT_MAXIMUM_REDUCTION_LEDGER_VERSION,
    baseMaximum,
    entries: normalizedEntries,
  }
}

export function dnd5eHitPointMaximumReductionTotal(
  ledger: Dnd5eHitPointMaximumReductionLedger | undefined,
): number {
  return ledger?.entries.reduce(
    (total, entry) => Math.min(1_000_000_000, total + entry.amount),
    0,
  ) ?? 0
}

export function dnd5eEffectiveHitPointMaximum(
  baseMaximum: number,
  ledger: Dnd5eHitPointMaximumReductionLedger | undefined,
): number {
  return Math.max(
    0,
    Math.floor(baseMaximum) - dnd5eHitPointMaximumReductionTotal(ledger),
  )
}

/** Rebase a character ledger after its durable class-derived maximum changes. */
export function rebaseDnd5eHitPointMaximumReductionLedger(
  ledger: Dnd5eHitPointMaximumReductionLedger | undefined,
  baseMaximum: number,
): Dnd5eHitPointMaximumReductionLedger | undefined {
  if (!ledger) return undefined
  return {
    ...ledger,
    baseMaximum: Math.max(0, Math.floor(baseMaximum)),
    entries: ledger.entries.map((entry) => ({ ...entry })),
  }
}

export function appendDnd5eHitPointMaximumReduction(input: {
  ledger: Dnd5eHitPointMaximumReductionLedger | undefined
  currentMaximum: number
  entry: Dnd5eHitPointMaximumReductionEntry
}): {
  ledger: Dnd5eHitPointMaximumReductionLedger
  maximum: number
  appliedAmount: number
} {
  const baseMaximum = input.ledger?.baseMaximum ??
    Math.max(0, Math.floor(input.currentMaximum))
  const existingEntries = input.ledger?.entries ?? []
  const ledger: Dnd5eHitPointMaximumReductionLedger = {
    schemaVersion: DND5E_HIT_POINT_MAXIMUM_REDUCTION_LEDGER_VERSION,
    baseMaximum,
    entries: [...existingEntries.map((entry) => ({ ...entry })), {
      ...input.entry,
      amount: Math.max(1, Math.floor(input.entry.amount)),
    }],
  }
  const maximum = dnd5eEffectiveHitPointMaximum(baseMaximum, ledger)
  return {
    ledger,
    maximum,
    appliedAmount: Math.max(0, Math.floor(input.currentMaximum) - maximum),
  }
}

export function recoverDnd5eHitPointMaximumReductions(
  ledger: Dnd5eHitPointMaximumReductionLedger | undefined,
  recovery: Dnd5eHitPointMaximumReductionRecovery,
): {
  ledger: Dnd5eHitPointMaximumReductionLedger | undefined
  maximum: number | undefined
  recoveredAmount: number
} {
  if (!ledger) return { ledger: undefined, maximum: undefined, recoveredAmount: 0 }
  const retained = ledger.entries.filter((entry) => entry.recovery !== recovery)
  const recoveredAmount = ledger.entries
    .filter((entry) => entry.recovery === recovery)
    .reduce((total, entry) => total + entry.amount, 0)
  const nextLedger = retained.length > 0
    ? { ...ledger, entries: retained.map((entry) => ({ ...entry })) }
    : undefined
  return {
    ledger: nextLedger,
    maximum: dnd5eEffectiveHitPointMaximum(ledger.baseMaximum, nextLedger),
    recoveredAmount,
  }
}
