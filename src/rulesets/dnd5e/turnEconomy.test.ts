import { describe, expect, it } from 'vitest'
import {
  createDnd5eTurnEconomyCounts,
  grantDnd5eActionSurge,
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
})
