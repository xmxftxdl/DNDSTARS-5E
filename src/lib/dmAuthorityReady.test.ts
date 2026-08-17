import { describe, expect, it } from 'vitest'
import {
  matchesDmAuthorityReady,
  persistDmAuthorityReady,
  type DmAuthorityReadyState,
} from './dmAuthorityReady'

const ready: DmAuthorityReadyState = {
  mapId: 'map-1',
  combatId: 'combat-1',
  ready: true,
  updatedAt: 1,
}

describe('matchesDmAuthorityReady', () => {
  it('accepts only the current active combat', () => {
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-1', combatId: 'combat-1', combatActive: true })).toBe(true)
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-2', combatId: 'combat-1', combatActive: true })).toBe(false)
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-1', combatId: 'combat-2', combatActive: true })).toBe(false)
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-1', combatId: 'combat-1', combatActive: false })).toBe(false)
  })

  it('rebases once and retries when the first authority write is rejected', async () => {
    const saved: DmAuthorityReadyState[] = []
    let attempts = 0
    await expect(persistDmAuthorityReady(ready, {
      load: async () => null,
      save: async (state) => {
        attempts += 1
        if (attempts === 1) throw new Error('revision-conflict')
        saved.push(state)
      },
    })).resolves.toEqual(ready)
    expect(attempts).toBe(2)
    expect(saved).toEqual([ready])
  })

  it('accepts a matching authority latch published by another writer', async () => {
    let attempts = 0
    const concurrent = { ...ready, updatedAt: 2 }
    await expect(persistDmAuthorityReady(ready, {
      load: async () => concurrent,
      save: async () => {
        attempts += 1
        throw new Error('revision-conflict')
      },
    })).resolves.toEqual(concurrent)
    expect(attempts).toBe(1)
  })
})
