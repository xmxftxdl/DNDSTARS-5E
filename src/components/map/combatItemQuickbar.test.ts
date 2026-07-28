import { describe, expect, it } from 'vitest'
import {
  assignCombatItemQuickbarSlot,
  clearCombatItemQuickbarSlot,
  COMBAT_ITEM_QUICK_SLOT_COUNT,
  reconcileCombatItemQuickbarPreference,
} from './combatItemQuickbar'

describe('combatItemQuickbar', () => {
  it('首次使用时只放入前七个物品，并为背包入口保留第八格', () => {
    const preference = reconcileCombatItemQuickbarPreference(
      undefined,
      Array.from({ length: 10 }, (_, index) => `item-${index + 1}`),
    )

    expect(preference.slots).toHaveLength(COMBAT_ITEM_QUICK_SLOT_COUNT)
    expect(preference.slots).toEqual([
      'item-1',
      'item-2',
      'item-3',
      'item-4',
      'item-5',
      'item-6',
      'item-7',
    ])
  })

  it('库存变化时移除失效和重复实例，但不擅自覆盖玩家留下的空槽', () => {
    const preference = reconcileCombatItemQuickbarPreference({
      schemaVersion: 1,
      slots: ['potion', 'missing', 'potion', null, 'rope', null, null],
    }, ['potion', 'rope', 'torch'])

    expect(preference.slots).toEqual(['potion', null, null, null, 'rope', null, null])
  })

  it('已在快捷栏中的物品改槽时交换两格', () => {
    expect(assignCombatItemQuickbarSlot(
      ['potion', 'rope', null, null, null, null, null],
      'potion',
      1,
    )).toEqual(['rope', 'potion', null, null, null, null, null])
  })

  it('背包物品替换快捷槽后，原物品回到背包，并可清空槽位', () => {
    const assigned = assignCombatItemQuickbarSlot(
      ['potion', null, null, null, null, null, null],
      'torch',
      0,
    )
    expect(assigned).toEqual(['torch', null, null, null, null, null, null])
    expect(clearCombatItemQuickbarSlot(assigned, 0)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })
})
