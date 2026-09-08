import { describe, expect, it } from 'vitest'
import { dnd5eMonsterAttackRollExpression } from './monsterAttackRollExpression'

describe('dnd5eMonsterAttackRollExpression', () => {
  it('shows the Bane die that reduced the attack total', () => {
    expect(dnd5eMonsterAttackRollExpression({
      d20: 5,
      baseModifier: 3,
      baneRoll: 3,
      total: 5,
    })).toBe('5+3-3=5')
  })

  it('shows all optional attack modifiers in calculation order', () => {
    expect(dnd5eMonsterAttackRollExpression({
      d20: 10,
      baseModifier: -1,
      blessRoll: 4,
      baneRoll: 2,
      bardicInspirationRoll: 6,
      cuttingWordsRoll: 3,
      total: 14,
    })).toBe('10-1+4-2+6-3=14')
  })
})
