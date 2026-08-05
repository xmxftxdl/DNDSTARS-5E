import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
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
})
