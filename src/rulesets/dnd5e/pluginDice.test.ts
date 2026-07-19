import { describe, expect, it, vi } from 'vitest'
import {
  executeDnd5ePluginDiceRolls,
  validateDnd5ePluginDiceRolls,
} from './pluginDice'

describe('D&D 5e plugin declarative dice', () => {
  const definition = {
    rolls: [
      { id: 'damage', label: '伤害', count: 2, sides: 6, modifier: 3, visibility: 'public' as const },
      { id: 'secret', label: '暗骰', count: 1, sides: 20, visibility: 'dm' as const },
    ],
  }

  it('executes host-owned recipes and records auditable totals', async () => {
    const roller = vi.fn()
      .mockResolvedValueOnce([2, 5])
      .mockResolvedValueOnce([17])
    const result = await executeDnd5ePluginDiceRolls(definition, roller)

    expect(result).toEqual({
      damage: { values: [2, 5], modifier: 3, total: 10 },
      secret: { values: [17], modifier: 0, total: 17 },
    })
    expect(validateDnd5ePluginDiceRolls(definition, result)).toBe(true)
    expect(roller).toHaveBeenCalledTimes(2)
  })

  it('fails closed when a face, total, or undeclared roll is forged', () => {
    expect(validateDnd5ePluginDiceRolls(definition, {
      damage: { values: [2, 7], modifier: 3, total: 12 },
      secret: { values: [17], modifier: 0, total: 17 },
    })).toBe(false)
    expect(validateDnd5ePluginDiceRolls(definition, {
      damage: { values: [2, 5], modifier: 3, total: 99 },
      secret: { values: [17], modifier: 0, total: 17 },
    })).toBe(false)
    expect(validateDnd5ePluginDiceRolls(definition, {
      damage: { values: [2, 5], modifier: 3, total: 10 },
      secret: { values: [17], modifier: 0, total: 17 },
      forged: { values: [1], modifier: 0, total: 1 },
    })).toBe(false)
  })
})
