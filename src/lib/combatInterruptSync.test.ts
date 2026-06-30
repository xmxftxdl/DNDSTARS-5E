import { describe, expect, it } from 'vitest'
import {
  COMBAT_INTERRUPT_RESOURCE,
  createCombatInterrupt,
  emptyCombatInterruptQueue,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import {
  answerSharedCombatInterrupt,
  finishSharedCombatInterrupt,
  markSharedCombatInterruptRolling,
  publishSharedCombatInterrupt,
  type SharedCombatInterruptLoad,
  type SharedCombatInterruptSave,
} from './combatInterruptSync'

function makeStore(initial: SharedCombatInterruptQueueState | null = null) {
  let saved: SharedCombatInterruptQueueState | null = null
  const loadSharedResource: SharedCombatInterruptLoad = async <T>() =>
    (saved ?? initial) as T | null
  const saveSharedResource: SharedCombatInterruptSave = async <T>(name: string, data: T) => {
    void name
    saved = data as SharedCombatInterruptQueueState
  }
  return {
    loadSharedResource,
    saveSharedResource,
    saved: () => saved,
  }
}

describe('combat interrupt sync', () => {
  it('publishes an interrupt into the shared queue resource', async () => {
    const store = makeStore(emptyCombatInterruptQueue('map-1', 100))
    const interrupt = createCombatInterrupt({
      id: 'dodge-1',
      mapId: 'map-1',
      kind: 'dodge',
      payload: { targetName: 'hero', result: {} },
      now: 110,
    })

    await publishSharedCombatInterrupt({
      ...store,
      interrupt,
    })

    expect(store.saved()?.mapId).toBe('map-1')
    expect(store.saved()?.interrupts.map((item) => item.id)).toEqual(['dodge-1'])
  })

  it('answers an interrupt on the matching map', async () => {
    const interrupt = createCombatInterrupt({
      id: 'gale-1',
      mapId: 'map-1',
      kind: 'gale-combo',
      payload: { casterName: 'hero', triggerLabel: '触发' },
      now: 100,
    })
    const store = makeStore({ mapId: 'map-1', interrupts: [interrupt], updatedAt: 100 })

    await answerSharedCombatInterrupt({
      ...store,
      mapId: 'map-1',
      id: 'gale-1',
      response: { useGaleCombo: true },
    })

    expect(store.saved()?.interrupts[0]).toMatchObject({
      id: 'gale-1',
      status: 'answered',
      response: { useGaleCombo: true },
    })
  })

  it('replaces another map queue with an empty current-map queue when answering', async () => {
    const other = createCombatInterrupt({
      id: 'other-1',
      mapId: 'other-map',
      kind: 'agile-leap',
      payload: { targetName: 'hero', feet: 10, uses: 1, maxUses: 2 },
      now: 100,
    })
    const store = makeStore({ mapId: 'other-map', interrupts: [other], updatedAt: 100 })

    await answerSharedCombatInterrupt({
      ...store,
      mapId: 'map-1',
      id: 'other-1',
      response: { useAgileLeap: true },
    })

    expect(store.saved()).toMatchObject({ mapId: 'map-1', interrupts: [] })
  })

  it('marks an interrupt rolling and then done', async () => {
    const interrupt = createCombatInterrupt({
      id: 'dodge-1',
      mapId: 'map-1',
      kind: 'dodge',
      payload: { targetName: 'hero', result: {} },
      now: 100,
    })
    const store = makeStore({ mapId: 'map-1', interrupts: [interrupt], updatedAt: 100 })

    await markSharedCombatInterruptRolling({
      ...store,
      mapId: 'map-1',
      id: 'dodge-1',
      response: { wantsDodge: true },
    })

    expect(store.saved()?.interrupts[0]).toMatchObject({
      status: 'rolling',
      response: { wantsDodge: true },
    })

    await finishSharedCombatInterrupt({
      ...store,
      mapId: 'map-1',
      id: 'dodge-1',
      response: { wantsDodge: true, dodgeD20: 12 },
    })

    expect(store.saved()?.interrupts[0]).toMatchObject({
      status: 'done',
      response: { wantsDodge: true, dodgeD20: 12 },
    })
  })

  it('uses the canonical resource name for all writes', async () => {
    let savedName = ''
    const interrupt = createCombatInterrupt({
      id: 'stable-1',
      mapId: 'map-1',
      kind: 'stable-mind',
      payload: {
        targetName: 'hero',
        fullDamage: 10,
        damageAfterSave: 5,
        saveD20: 12,
        saveMod: 1,
        saveTotal: 13,
        dc: 12,
      },
      now: 100,
    })

    await publishSharedCombatInterrupt({
      interrupt,
      loadSharedResource: async () => null,
      saveSharedResource: async <T>(name: string, data: T) => {
        void data
        savedName = name
      },
    })

    expect(savedName).toBe(COMBAT_INTERRUPT_RESOURCE)
  })
})
