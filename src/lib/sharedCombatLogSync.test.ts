import { describe, expect, it } from 'vitest'
import type { CombatLogEntry } from './sharedCombatTypes'
import { mergeSharedCombatLogEntries } from './sharedCombatLogSync'

function entry(id: number, text = `log-${id}`): CombatLogEntry {
  return { id, round: 1, text, kind: 'system', time: '10:00' }
}

describe('shared combat log sync', () => {
  it('merges incoming logs with current logs sorted newest first', () => {
    expect(
      mergeSharedCombatLogEntries([entry(1), entry(3)], [entry(2), entry(4)]).map((item) => item.id),
    ).toEqual([4, 3, 2, 1])
  })

  it('deduplicates by id with current entries taking priority', () => {
    const merged = mergeSharedCombatLogEntries([entry(1, 'old')], [entry(1, 'new')])
    expect(merged).toEqual([entry(1, 'old')])
  })

  it('truncates to the requested limit', () => {
    const merged = mergeSharedCombatLogEntries(
      [entry(1), entry(2)],
      [entry(3), entry(4)],
      2,
    )
    expect(merged.map((item) => item.id)).toEqual([4, 3])
  })
})
