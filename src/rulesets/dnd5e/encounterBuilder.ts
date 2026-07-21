import type { EnemyTemplate } from '../../lib/enemyPool'

export interface Dnd5eEncounterEntry {
  template: EnemyTemplate
  quantity: number
}

export interface Dnd5eEncounterSummary {
  creatureCount: number
  baseExperience: number
  challengeRatings: readonly string[]
}

export function normalizeDnd5eEncounterEntries(
  entries: readonly Dnd5eEncounterEntry[],
  maximumCreatures = 50,
): Dnd5eEncounterEntry[] {
  const merged = new Map<string, Dnd5eEncounterEntry>()
  let remaining = Math.max(0, Math.floor(maximumCreatures))
  for (const entry of entries) {
    if (remaining < 1) break
    const quantity = Math.min(remaining, Math.max(0, Math.floor(entry.quantity)))
    if (quantity < 1) continue
    const existing = merged.get(entry.template.id)
    if (existing) existing.quantity += quantity
    else merged.set(entry.template.id, { template: entry.template, quantity })
    remaining -= quantity
  }
  return [...merged.values()]
}

export function dnd5eEncounterRoster(entries: readonly Dnd5eEncounterEntry[]): EnemyTemplate[] {
  return normalizeDnd5eEncounterEntries(entries).flatMap((entry) =>
    Array.from({ length: entry.quantity }, () => entry.template),
  )
}

export function summarizeDnd5eEncounter(entries: readonly Dnd5eEncounterEntry[]): Dnd5eEncounterSummary {
  const normalized = normalizeDnd5eEncounterEntries(entries)
  return {
    creatureCount: normalized.reduce((total, entry) => total + entry.quantity, 0),
    baseExperience: normalized.reduce(
      (total, entry) => total + (entry.template.experiencePoints ?? 0) * entry.quantity,
      0,
    ),
    challengeRatings: [...new Set(normalized.flatMap((entry) => entry.template.challengeRating ?? []))],
  }
}

export function dnd5eEncounterGridOffset(index: number, count: number): { column: number; row: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))))
  const rows = Math.max(1, Math.ceil(count / columns))
  return {
    column: index % columns - (columns - 1) / 2,
    row: Math.floor(index / columns) - (rows - 1) / 2,
  }
}
