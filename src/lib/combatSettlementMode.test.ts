import { describe, expect, it } from 'vitest'
import {
  applyManualHitPointOperation,
  normalizeCombatSettlementMode,
  supportsManualDice,
  usesAutomatedMonsterSettlement,
  usesAutomatedPlayerSettlement,
} from './combatSettlementMode'

describe('combat settlement modes', () => {
  it('keeps automatic as the backwards-compatible default', () => {
    expect(normalizeCombatSettlementMode(undefined)).toBe('automatic')
    expect(usesAutomatedPlayerSettlement('automatic')).toBe(true)
    expect(usesAutomatedMonsterSettlement('automatic')).toBe(true)
  })

  it('separates manual and semi-automatic authority', () => {
    expect(usesAutomatedPlayerSettlement('manual')).toBe(false)
    expect(usesAutomatedMonsterSettlement('manual')).toBe(false)
    expect(usesAutomatedPlayerSettlement('semi-automatic')).toBe(true)
    expect(usesAutomatedMonsterSettlement('semi-automatic')).toBe(false)
    expect(supportsManualDice('manual', 'player')).toBe(true)
    expect(supportsManualDice('semi-automatic', 'player')).toBe(false)
    expect(supportsManualDice('semi-automatic', 'dm')).toBe(true)
  })

  it('applies temporary hit points before damage and does not stack lower temporary hp', () => {
    expect(applyManualHitPointOperation(
      { currentHp: 12, maxHp: 20, temporaryHp: 5 },
      'damage',
      8,
    )).toEqual({ currentHp: 9, maxHp: 20, temporaryHp: 0 })
    expect(applyManualHitPointOperation(
      { currentHp: 9, maxHp: 20, temporaryHp: 5 },
      'temporary-hit-points',
      3,
    )).toEqual({ currentHp: 9, maxHp: 20, temporaryHp: 5 })
  })
})

