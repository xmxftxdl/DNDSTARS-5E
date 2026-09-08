import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import { coordinateDnd5eMovementHazards } from './MovementHazardCoordinator'

describe('coordinateDnd5eMovementHazards', () => {
  it('filters missing tokens and preserves an unchanged authority snapshot', async () => {
    const map = {
      id: 'map-1',
      tokens: [],
    } as unknown as BattleMap
    const state = {
      combatId: 'combat-1',
      round: 1,
      turnSlotId: 'slot-1',
      initiativeIndex: 0,
      initiativeOrder: [],
      combatants: {},
    } as unknown as Dnd5eHeadlessCombatState
    const settleStep = vi.fn()

    const result = await coordinateDnd5eMovementHazards({
      state,
      map,
      characters: [],
      characterIdByCombatantId: {},
      movements: [{ tokenId: 'missing', to: { x: 1, y: 1 }, path: [{ x: 1, y: 1 }] }],
      initiativeOrder: [],
      settleStep,
    })

    expect(settleStep).not.toHaveBeenCalled()
    expect(result.state).toBe(state)
    expect(result.map).toBe(map)
    expect(result.logs).toEqual([])
    expect(result.finalPositionByCombatantId).toEqual({})
    expect(result.application).toEqual({
      map,
      characters: [],
      changedCharacterIds: [],
      changedTokenIds: [],
    })
  })

  it('does not resurrect pruned Activity extra-turn slots while refreshing movement hazards', async () => {
    const map = {
      id: 'map-time-stop',
      width: 500,
      height: 500,
      gridSize: 50,
      feetPerCell: 5,
      tokens: [
        {
          id: 'actor', label: '施法者', type: 'enemy', poolId: 'srd-5.1:ogre',
          x: 50, y: 50, size: 1, color: '#000', emoji: '🧙', hp: 59, maxHp: 59,
        },
        {
          id: 'other', label: '其他生物', type: 'enemy', poolId: 'srd-5.1:ogre',
          x: 200, y: 50, size: 1, color: '#000', emoji: '👹', hp: 59, maxHp: 59,
        },
      ],
    } as unknown as BattleMap
    const initiativeOrder = [
      { slotId: 'actor:normal', tokenId: 'actor', label: '施法者', emoji: '🧙', color: '#000', roll: 20 },
      { slotId: 'time-stop:1', tokenId: 'actor', label: '施法者', emoji: '🧙', color: '#000', roll: 20, turnKind: 'activity-extra-turn' as const },
      { slotId: 'time-stop:2', tokenId: 'actor', label: '施法者', emoji: '🧙', color: '#000', roll: 20, turnKind: 'activity-extra-turn' as const },
      { slotId: 'other:normal', tokenId: 'other', label: '其他生物', emoji: '👹', color: '#000', roll: 10 },
    ]
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat-time-stop',
      round: 1,
      turnSlotId: 'time-stop:1',
      map,
      characters: [],
      initiativeOrder,
    })
    const prunedState = structuredClone(snapshot.state)
    prunedState.initiativeOrder = ['actor', 'actor', 'other']
    prunedState.initiativeSlotIds = ['actor:normal', 'time-stop:1', 'other:normal']
    prunedState.oneShotInitiativeSlotIds = ['time-stop:1']
    prunedState.initiativeIndex = 1

    const result = await coordinateDnd5eMovementHazards({
      state: snapshot.state,
      map,
      characters: [],
      characterIdByCombatantId: {},
      movements: [{ tokenId: 'actor', to: { x: 100, y: 50 }, path: [{ x: 50, y: 50 }, { x: 100, y: 50 }] }],
      initiativeOrder,
      settleStep: async () => ({
        state: prunedState,
        map,
        application: {
          map,
          characters: [],
          changedCharacterIds: [],
          changedTokenIds: [],
        },
        finalPosition: { x: 100, y: 50 },
        logs: [],
      }),
    })

    expect(result.state.initiativeSlotIds).toEqual([
      'actor:normal',
      'time-stop:1',
      'other:normal',
    ])
    expect(result.state.oneShotInitiativeSlotIds).toEqual(['time-stop:1'])
    expect(result.state.initiativeIndex).toBe(1)
  })
})
