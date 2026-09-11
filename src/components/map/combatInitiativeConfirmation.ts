import type { InitiativeEntry } from './InitiativeTracker'

function initiativeEntryKey(entry: InitiativeEntry): string {
  return entry.slotId ?? entry.tokenId
}

function entryWithInitiativeRank(
  entry: InitiativeEntry,
  rank: Pick<InitiativeEntry, 'roll'>,
): InitiativeEntry {
  return {
    ...entry,
    roll: rank.roll,

  }
}

/** DM rank overrides change scheduling totals, never the creature's original dice evidence. */
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

export function originalInitiativeTotal(entry: InitiativeEntry): number {
  if (!entry.initiativeCalculation) return entry.roll
  return entry.initiativeCalculation.d20 + entry.initiativeCalculation.modifier -
    (entry.turnKind === 'thief-reflexes' ? 10 : 0)
}
