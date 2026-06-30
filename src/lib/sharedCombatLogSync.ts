import type { CombatLogEntry } from './sharedCombatTypes'

export function mergeSharedCombatLogEntries(
  current: CombatLogEntry[],
  incoming: CombatLogEntry[],
  limit = 80,
): CombatLogEntry[] {
  const merged = [...incoming, ...current]
  const unique = new Map<number, CombatLogEntry>()
  for (const entry of merged) unique.set(entry.id, entry)
  return [...unique.values()].sort((a, b) => b.id - a.id).slice(0, limit)
}
