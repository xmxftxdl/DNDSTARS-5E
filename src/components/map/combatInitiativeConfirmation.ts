import type { InitiativeEntry } from './InitiativeTracker'

function initiativeEntryKey(entry: InitiativeEntry): string {
  return entry.slotId ?? entry.tokenId
}

function entryWithInitiativeRank(
  entry: InitiativeEntry,
  rank: Pick<InitiativeEntry, 'roll' | 'initiativeCalculation'>,
): InitiativeEntry {
  return {
    ...entry,
    roll: rank.roll,
    initiativeCalculation: rank.initiativeCalculation
      ? {
          ...rank.initiativeCalculation,
          rolls: [...rank.initiativeCalculation.rolls],
        }
      : undefined,
  }
}

/**
 * Initiative totals belong to the confirmed rank, not to a stale row. Moving
 * one combatant therefore exchanges both combatants and their authoritative
 * dice breakdowns, keeping the visible order and saved totals consistent.
 */
export function swapInitiativeConfirmationEntries(
  entries: readonly InitiativeEntry[],
  firstSlotId: string,
  secondSlotId: string,
): InitiativeEntry[] {
  const firstIndex = entries.findIndex((entry) => initiativeEntryKey(entry) === firstSlotId)
  const secondIndex = entries.findIndex((entry) => initiativeEntryKey(entry) === secondSlotId)
  if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return entries as InitiativeEntry[]
  const next = [...entries]
  const first = entries[firstIndex]
  const second = entries[secondIndex]
  next[firstIndex] = entryWithInitiativeRank(second, first)
  next[secondIndex] = entryWithInitiativeRank(first, second)
  return next
}

export function moveInitiativeConfirmationEntry(
  entries: readonly InitiativeEntry[],
  slotId: string,
  direction: -1 | 1,
): InitiativeEntry[] {
  const sourceIndex = entries.findIndex((entry) => initiativeEntryKey(entry) === slotId)
  const targetIndex = sourceIndex + direction
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= entries.length) return entries as InitiativeEntry[]
  return swapInitiativeConfirmationEntries(
    entries,
    initiativeEntryKey(entries[sourceIndex]),
    initiativeEntryKey(entries[targetIndex]),
  )
}

export function combatInitiativeEntryKey(entry: InitiativeEntry): string {
  return initiativeEntryKey(entry)
}
