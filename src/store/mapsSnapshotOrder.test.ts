import { describe, expect, it } from 'vitest'
import { shouldApplySharedMapsSnapshot } from './maps'

describe('shared maps snapshot ordering', () => {
  it('uses the server revision before incomparable client timestamps', () => {
    expect(shouldApplySharedMapsSnapshot({
      incomingRevision: 85,
      lastAppliedRevision: 84,
      incomingUpdatedAt: 100,
      lastAppliedUpdatedAt: 200,
    })).toBe(true)

    expect(shouldApplySharedMapsSnapshot({
      incomingRevision: 83,
      lastAppliedRevision: 84,
      incomingUpdatedAt: 300,
      lastAppliedUpdatedAt: 200,
    })).toBe(false)
  })

  it('falls back to updatedAt only for legacy snapshots without revisions', () => {
    expect(shouldApplySharedMapsSnapshot({
      incomingUpdatedAt: 201,
      lastAppliedUpdatedAt: 200,
    })).toBe(true)
    expect(shouldApplySharedMapsSnapshot({
      incomingUpdatedAt: 199,
      lastAppliedUpdatedAt: 200,
    })).toBe(false)
  })
})
