import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { shouldApplySharedMapsSnapshot } from './maps'

const mapsStoreSource = readFileSync(new URL('./maps.ts', import.meta.url), 'utf8')

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

  it('publishes the DM authoritative selected map through the shared maps resource', () => {
    const selectionStart = mapsStoreSource.indexOf('select: (id) => {')
    const selectionEnd = mapsStoreSource.indexOf('addMap:', selectionStart)
    const selectionBody = mapsStoreSource.slice(selectionStart, selectionEnd)
    expect(selectionBody).toContain('set({ selectedId })')
    expect(selectionBody).toContain('if (canWriteSharedState()) publishMapsState(get())')
  })

  it('forces an equal durable snapshot to replay during failed-transaction recovery', () => {
    expect(mapsStoreSource).toContain('snapshot === lastSharedMapsSnapshot && !options?.force')
    expect(mapsStoreSource).toContain('loadShared: (options?: { force?: boolean }) => Promise<void>')
  })
})
