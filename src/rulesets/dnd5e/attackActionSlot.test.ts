import { expect, it } from 'vitest'
import { dnd5eAttackActionSlot } from './attackActionSlot'

it.each([1, 2, 3, 4])('shares the %i-attack budget across normal and replacement attacks and Action Surge', attacksPerAction => {
  for (const actionCount of [1, 2]) {
    let actionSpending = 0
    for (let attacksUsed = 0; attacksUsed < attacksPerAction * actionCount; attacksUsed++) {
      const slot = dnd5eAttackActionSlot({ attacksPerAction, actionCount, attacksUsed })!
      expect(slot.attackNumber).toBe(attacksUsed + 1)
      expect(slot.attacksAllowed).toBe(attacksPerAction * actionCount)
      expect(slot.spendsAction).toBe(attacksUsed % attacksPerAction === 0)
      actionSpending += Number(slot.spendsAction)
    }
    expect(actionSpending).toBe(actionCount)
    expect(dnd5eAttackActionSlot({ attacksPerAction, actionCount, attacksUsed: attacksPerAction * actionCount })).toBeUndefined()
  }
})

it.each([-1, 0.5, NaN, Infinity])('rejects invalid used-attack counts %s', attacksUsed => {
  expect(dnd5eAttackActionSlot({ attacksPerAction: 2, actionCount: 1, attacksUsed })).toBeUndefined()
})

it.each([1, 2, 3, 4])('reserves the extra slot for a weapon with %i normal attacks per action', attacksPerAction => {
  for (const actionCount of [1, 2]) {
    let actionsSpent = 0
    const total = (attacksPerAction + 1) * actionCount
    for (let attacksUsed = 0; attacksUsed < total; attacksUsed++) {
      const budget = { attacksPerAction, actionCount, attacksUsed, extraWeaponAttacksPerAction: 1 }
      const slot = dnd5eAttackActionSlot({ ...budget, attackKind: 'weapon' })!
      const extra = attacksUsed % (attacksPerAction + 1) === attacksPerAction
      expect(slot.attackNumber).toBe(attacksUsed + 1)
      expect(slot.attacksAllowed).toBe(total)
      expect(slot.weaponOnly === true).toBe(extra)
      actionsSpent += Number(slot.spendsAction)
      for (const attackKind of [undefined, 'replacement'] as const) {
        const replacement = dnd5eAttackActionSlot({ ...budget, attackKind })
        if (extra) expect(replacement).toBeUndefined()
        else expect(replacement).toEqual(slot)
      }
    }
    expect(actionsSpent).toBe(actionCount)
    expect(dnd5eAttackActionSlot({
      attacksPerAction, actionCount, attacksUsed: total,
      extraWeaponAttacksPerAction: 1, attackKind: 'weapon',
    })).toBeUndefined()
  }
})

it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejects invalid or overflowing extra weapon budgets %s', extraWeaponAttacksPerAction => {
  expect(dnd5eAttackActionSlot({
    attacksPerAction: 2, actionCount: 2, attacksUsed: 0,
    extraWeaponAttacksPerAction, attackKind: 'weapon',
  })).toBeUndefined()
})
