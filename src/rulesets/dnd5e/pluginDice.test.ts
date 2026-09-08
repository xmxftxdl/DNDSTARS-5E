import { describe, expect, it, vi } from 'vitest'
import {
  dnd5ePluginDiceRollDeclarationsForTargets,
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

  it('expands one stable recipe into an independent roll for every Host target', () => {
    expect(dnd5ePluginDiceRollDeclarationsForTargets({
      rolls: [{ id: 'damage', label: '伤害', count: 2, sides: 6 }],
      perTargetRolls: [{ id: 'save-d20', label: '敏捷豁免', count: 1, sides: 20 }],
    }, [
      { id: 'enemy-a', name: '敌人 A' },
      { id: 'enemy-b', name: '敌人 B' },
    ])).toEqual([
      expect.objectContaining({ id: 'damage', count: 2, sides: 6 }),
      expect.objectContaining({ id: 'save-d20:enemy-a', label: '敌人 A · 敏捷豁免' }),
      expect.objectContaining({ id: 'save-d20:enemy-b', label: '敌人 B · 敏捷豁免' }),
    ])
  })

  it('rerolls closed random-table faces and rejects a submitted forbidden face', async () => {
    const roller = vi.fn()
      .mockResolvedValueOnce([8])
      .mockResolvedValueOnce([6])
    const declaration = {
      id: 'ray', label: '虹光光束', count: 1, sides: 8,
      rerollValues: [8],
    }

    await expect(executeDnd5ePluginDiceRolls({ rolls: [declaration] }, roller)).resolves.toEqual({
      ray: { values: [6], modifier: 0, total: 6 },
    })
    expect(roller).toHaveBeenCalledTimes(2)
    expect(validateDnd5ePluginDiceRolls({ rolls: [declaration] }, {
      ray: { values: [8], modifier: 0, total: 8 },
    })).toBe(false)
  })
})
