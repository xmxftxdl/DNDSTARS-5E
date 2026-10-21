import { DND5E_2014_ALIGNMENT_OPTIONS } from './characterOptions'

/** Recorded facts only. Never infer a previous alignment from the current one. */
export function normalizeDnd5eRecordedAlignment(value: unknown): string | undefined {
  return typeof value === 'string' && (DND5E_2014_ALIGNMENT_OPTIONS as readonly string[]).includes(value) ? value : undefined
}

export function dnd5eRestorableOriginalAlignment(target: { alignment?: string; originalAlignment?: string }): string | undefined {
  const current = normalizeDnd5eRecordedAlignment(target.alignment)
  const original = normalizeDnd5eRecordedAlignment(target.originalAlignment)
  return current && original && current !== original ? original : undefined
}
