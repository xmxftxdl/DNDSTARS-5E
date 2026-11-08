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
    const concurrent = { ...ready, updatedAt: 2 };let loads=0
    await expect(persistDmAuthorityReady(ready, {
      load: async () => ++loads===1?null:concurrent,
      save: async () => {
        attempts += 1
        throw new Error('revision-conflict')
      },
    })).resolves.toEqual(concurrent)
    expect(attempts).toBe(1)
  })
})

it('reuses the exact already-persisted current latch on fresh local state without rewriting its timestamp or revision',async()=>{const stored={...ready,_sync:{revision:1,writtenAt:100}},writes:unknown[]=[];const result=await persistDmAuthorityReady({...ready,updatedAt:200},{load:async()=>stored,save:async value=>{writes.push(value)}});expect(result).toBe(stored);expect(writes).toEqual([]);expect(result).toEqual({...ready,_sync:{revision:1,writtenAt:100}})})
it.each([{...ready,mapId:'other-map'},{...ready,combatId:'other-combat'},{...ready,ready:false}])('does not reuse a latch with a different current semantic identity %j',async stored=>{const writes:unknown[]=[];expect(await persistDmAuthorityReady(ready,{load:async()=>stored,save:async value=>{writes.push(value)}})).toEqual(ready);expect(writes).toEqual([ready])})
