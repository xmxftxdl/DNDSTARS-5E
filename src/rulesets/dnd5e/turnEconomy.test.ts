import { describe, expect, it } from 'vitest'
import {
  createDnd5eTurnEconomyCounts,
  grantDnd5eMovement,
  grantDnd5eActionSurge,
  normalizeDnd5eTurnEconomyCounts,
  projectDnd5eHeadlessTurnEconomy,
  refreshDnd5eReactiveReactionEconomies,
  spendDnd5eMovement,
  spendDnd5eTurnResource,
} from './turnEconomy'

describe('D&D 5e counted turn economy', () => {
  it('starts each turn with one action, bonus action, and reaction', () => {
    expect(createDnd5eTurnEconomyCounts('combat:1:hero')).toEqual({
      turnKey: 'combat:1:hero',
      attacksUsed: 0,
      action: { current: 1, max: 1 },
      bonusAction: { current: 1, max: 1 },
      reaction: { current: 1, max: 1 },
      objectInteraction: { current: 1, max: 1 },
      movement: { current: 30, max: 30 },
    })
  })

  it('spends movement in feet without consuming an action', () => {
    const initial = createDnd5eTurnEconomyCounts('turn', 25)
    const spent = spendDnd5eMovement(initial, 10)
    expect(spent).toMatchObject({ ok: true, economy: { movement: { current: 15, max: 25 } } })
    expect(spent.economy.action.current).toBe(1)
    expect(spendDnd5eMovement(spent.economy, 20).ok).toBe(false)
  })

  it('preserves movement already spent when an effect changes speed mid-turn', () => {
    const spent = spendDnd5eMovement(createDnd5eTurnEconomyCounts('turn', 30), 10)
    expect(spent.ok).toBe(true)
    expect(normalizeDnd5eTurnEconomyCounts(spent.economy, 40).movement).toEqual({ current: 30, max: 40, spent: 10 })
    expect(normalizeDnd5eTurnEconomyCounts(spent.economy, 20).movement).toEqual({ current: 10, max: 20, spent: 10 })
  })

  it('preserves temporary Dash movement without redefining walking speed', () => {
    const dashed = grantDnd5eMovement(createDnd5eTurnEconomyCounts('turn', 40), 40)
    expect(dashed.movement).toEqual({ current: 80, max: 40 })
    expect(normalizeDnd5eTurnEconomyCounts(dashed, 40).movement).toEqual({ current: 80, max: 40 })
    expect(normalizeDnd5eTurnEconomyCounts(dashed, 50).movement).toEqual({ current: 90, max: 50 })
  })

  it('spends each resource independently and rejects a second spend', () => {
    const initial = createDnd5eTurnEconomyCounts('turn')
    const spent = spendDnd5eTurnResource(initial, 'bonusAction')
    expect(spent.ok).toBe(true)
    expect(spent.economy).toMatchObject({
      action: { current: 1 },
      bonusAction: { current: 0 },
      reaction: { current: 1 },
    })
    expect(spendDnd5eTurnResource(spent.economy, 'bonusAction').ok).toBe(false)
  })

  it('projects Slow action-or-bonus consumption into the shared UI economy', () => {
    const afterAction = spendDnd5eTurnResource(
      createDnd5eTurnEconomyCounts('slow-turn', 15),
      'action',
    ).economy
    expect(projectDnd5eHeadlessTurnEconomy(afterAction, {
      actionAvailable: false,
      bonusActionAvailable: false,
      reactionAvailable: false,
      objectInteractionAvailable: true,
      movementRemaining: 15,
    })).toMatchObject({
      action: { current: 0 },
      bonusAction: { current: 0 },
      reaction: { current: 0 },
      movement: { current: 15, max: 15 },
    })
  })

  it('projects an Activity movement cost into the shared UI economy without spending an action', () => {
    expect(projectDnd5eHeadlessTurnEconomy(
      createDnd5eTurnEconomyCounts('tree-stride-turn', 30),
      {
        actionAvailable: true,
        bonusActionAvailable: true,
        reactionAvailable: true,
        objectInteractionAvailable: true,
        movementRemaining: 20,
      },
    )).toMatchObject({
      action: { current: 1 },
      bonusAction: { current: 1 },
      reaction: { current: 1 },
      movement: { current: 20, max: 30 },
    })
  })

  it('projects a mid-turn speed increase into both remaining and maximum movement', () => {
    const spent = spendDnd5eMovement(createDnd5eTurnEconomyCounts('longstrider-turn', 30), 10)
    expect(spent.ok).toBe(true)
    expect(projectDnd5eHeadlessTurnEconomy(
      spent.economy,
      {
        actionAvailable: false,
        bonusActionAvailable: true,
        reactionAvailable: true,
        objectInteractionAvailable: true,
        movementRemaining: 30,
      },
      40,
    )).toMatchObject({
      movement: { current: 30, max: 40 },
    })
  })

  it('spends one free object interaction independently from the action', () => {
    const initial = createDnd5eTurnEconomyCounts('turn')
    const spent = spendDnd5eTurnResource(initial, 'objectInteraction')
    expect(spent).toMatchObject({
      ok: true,
      economy: { action: { current: 1 }, objectInteraction: { current: 0, max: 1 } },
    })
    expect(spendDnd5eTurnResource(spent.economy, 'objectInteraction').ok).toBe(false)
  })

  it('Action Surge grants one additional action for the current turn', () => {
    const spent = spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('turn'), 'action')
    expect(grantDnd5eActionSurge(spent.economy).action).toEqual({ current: 1, max: 2 })
  })

  it('refreshes only a Reactive reaction pool for the new creature turn', () => {
    const spent = spendDnd5eTurnResource(
      spendDnd5eTurnResource(
        createDnd5eTurnEconomyCounts('combat:1:first', 40),
        'action',
      ).economy,
      'reaction',
    ).economy
    const refreshed = refreshDnd5eReactiveReactionEconomies(
      { marilith: spent },
      [{
        actorId: 'marilith',
        turnKey: 'combat:1:second',
        reactionAvailable: true,
        speed: 40,
      }],
    )

    expect(refreshed.marilith).toMatchObject({
      turnKey: 'combat:1:second',
      action: { current: 0, max: 1 },
      reaction: { current: 1, max: 1 },
      movement: { current: 40, max: 40 },
    })
  })
})
