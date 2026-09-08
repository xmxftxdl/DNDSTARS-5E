import { describe, expect, it } from 'vitest'
import { dnd5eMonsterDamageRollLogDetail } from './monsterAttackDamageLog'

describe('dnd5eMonsterDamageRollLogDetail', () => {
  it('keeps the individual weapon dice, fixed modifier, and subtotal', () => {
    expect(dnd5eMonsterDamageRollLogDetail({
      actionName: '顶撞',
      componentLabel: '基础伤害',
      damageType: 'piercing',
      sides: 8,
      rolls: [6, 7],
      bonus: 4,
    })).toBe(
      '伤害骰 · 顶撞（基础伤害·穿刺）｜2d8 骰面：6 + 7 = 13｜固定加值 +4｜小计 17',
    )
  })

  it('keeps a charge rider separate from the base weapon damage', () => {
    expect(dnd5eMonsterDamageRollLogDetail({
      actionName: '顶撞',
      componentLabel: '冲锋附伤',
      damageType: 'piercing',
      sides: 8,
      rolls: [5, 8],
      bonus: 0,
    })).toBe(
      '伤害骰 · 顶撞（冲锋附伤·穿刺）｜2d8 骰面：5 + 8 = 13｜固定加值 +0｜小计 13',
    )
  })

  it('rejects an impossible die face instead of publishing a false audit line', () => {
    expect(dnd5eMonsterDamageRollLogDetail({
      actionName: '顶撞',
      componentLabel: '基础伤害',
      damageType: 'piercing',
      sides: 8,
      rolls: [9],
      bonus: 4,
    })).toBeUndefined()
  })
})
