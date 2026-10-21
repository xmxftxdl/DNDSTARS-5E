interface TargetCheckpoint { candidates: string[]; selected: string }
const storageKey = 'astraltrace:host-random-creature-targets:v1'
const memory = new Map<string, TargetCheckpoint>()

/** Host-only selection, keyed by transaction and attack/target occurrence before any target roll. */
export function selectRandomCreatureTarget(
  occurrenceId: string,
  eligibleIds: readonly string[],
  randomIndex: (count: number) => number,
): string {
  const candidates = [...new Set(eligibleIds)].sort()
  if (!occurrenceId || !candidates.length) throw new Error('random-target-unavailable')
  let records: Record<string, TargetCheckpoint> = {}
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) ?? '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) records = parsed as typeof records
  } catch { /* The current Host still retains its in-memory selection. */ }
  const previous = Object.prototype.hasOwnProperty.call(records, occurrenceId) ? records[occurrenceId] : memory.get(occurrenceId)
  if (previous) {
    if (!Array.isArray(previous.candidates) ||
      JSON.stringify(previous.candidates) !== JSON.stringify(candidates) ||
      !candidates.includes(previous.selected)) throw new Error('random-target-pool-changed')
    return previous.selected
  }
  const index = candidates.length === 1 ? 0 : randomIndex(candidates.length)
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) throw new Error('random-target-invalid-roll')
  const selected = candidates[index]!
  const checkpoint = { candidates, selected }
  memory.set(occurrenceId, checkpoint)
  if (memory.size > 500) memory.delete(memory.keys().next().value!)
  try {
    const entries = Object.entries(records).filter(([id]) => id !== occurrenceId)
    entries.push([occurrenceId, checkpoint])
    window.sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries.slice(-500))))
  } catch { /* Memory fallback, matching other Host roll checkpoints. */ }
  return selected
}
