import { describe, expect, it } from 'vitest'
import { buildCombatMessageQueueReset } from './sharedCombatReset'

describe('shared combat reset', () => {
  it('builds empty shared sidecar states for a new combat', () => {
    const reset = buildCombatMessageQueueReset({
      mapId: 'map-1',
      combatId: 'combat-1',
      updatedAt: 123,
    })

    expect(reset.interruptQueue).toEqual({ mapId: 'map-1', interrupts: [], updatedAt: 123, revision: 0 })
    expect(reset.diceEvents).toEqual({ mapId: 'map-1', events: [], updatedAt: 123 })
    expect(reset.playerAction).toMatchObject({
      id: 'map-1:combat-start:player-action:123',
      combatId: 'combat-1',
      status: 'done',
      type: 'end-turn',
    })
    expect(reset.playerActionRequests).toEqual({
      mapId: 'map-1',
      combatId: 'combat-1',
      requests: [],
      updatedAt: 123,
    })
    expect(reset.playerActionProcessed).toEqual({
      mapId: 'map-1',
      combatId: 'combat-1',
      actionIds: [],
      updatedAt: 123,
    })
    expect(reset.playerActionAck).toMatchObject({
      id: 'map-1:combat-start:player-action-ack:123',
      combatId: 'combat-1',
      actionId: '',
      status: 'accepted',
    })
    expect(reset.combatLog).toBeUndefined()
  })

  it('includes an empty combat log when requested', () => {
    expect(
      buildCombatMessageQueueReset({
        mapId: 'map-1',
        combatId: 'combat-1',
        updatedAt: 123,
        clearCombatLog: true,
      }).combatLog,
    ).toEqual({ mapId: 'map-1', entries: [], updatedAt: 123 })
  })
})
