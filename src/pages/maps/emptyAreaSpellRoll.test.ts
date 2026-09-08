import { describe, expect, it } from 'vitest'
import { dnd5eEmptyAreaSpellRollPlan } from './emptyAreaSpellRoll'

describe('empty-area spell effect rolls', () => {
  it('keeps shared HP-pool rolls for empty Sleep and Color Spray areas', () => {
    expect(dnd5eEmptyAreaSpellRollPlan({
      effect: 'sleep-hit-point-pool', diceCount: 9, dieSides: 8,
    })).toEqual({ count: 9, sides: 8 })
    expect(dnd5eEmptyAreaSpellRollPlan({
      effect: 'color-spray-hit-point-pool', diceCount: 6, dieSides: 10,
    })).toEqual({ count: 6, sides: 10 })
  })

  it('does not fabricate targetless damage rolls for ordinary area damage', () => {
    expect(dnd5eEmptyAreaSpellRollPlan({
      effect: 'automatic-damage', diceCount: 8, dieSides: 6,
    })).toBeUndefined()
  })
})
