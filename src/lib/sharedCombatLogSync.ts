import { mutateSharedRoomResource } from './sharedApi'
import type { CombatLogEntry, SharedCombatLogState } from './sharedCombatTypes'

export function appendSharedCombatLogEntry(
  mapId: string,
  entry: CombatLogEntry,
): Promise<SharedCombatLogState> {
  return mutateSharedRoomResource<SharedCombatLogState>(
    'combat-log',
    '/state/combat-log/entry',
    { operation: 'append', mapId, entry },
  )
}

export function truncateSharedCombatLogAfterEntry(
  mapId: string,
  targetEntryId: number,
): Promise<SharedCombatLogState> {
  return mutateSharedRoomResource<SharedCombatLogState>(
    'combat-log',
    '/state/combat-log/entry',
    { operation: 'truncate-after', mapId, targetEntryId },
  )
}

export function mergeSharedCombatLogEntries(
  current: CombatLogEntry[],
  incoming: CombatLogEntry[],
  limit = 160,
): CombatLogEntry[] {
  const merged = [...incoming, ...current]
  const unique = new Map<number, CombatLogEntry>()
  for (const entry of merged) unique.set(entry.id, entry)
  return [...unique.values()].sort((a, b) => b.id - a.id).slice(0, limit)
}
