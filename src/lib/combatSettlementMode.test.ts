import { describe, expect, it } from 'vitest'
import {
  allowsPlayerActionInSettlementMode,
  applyManualHitPointOperation,
  normalizeCombatSettlementMode,
  supportsDmBattlefieldAdjustment,
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

  it('separates automatic and manual authority', () => {
    expect(usesAutomatedPlayerSettlement('manual')).toBe(false)
    expect(usesAutomatedMonsterSettlement('manual')).toBe(false)
    expect(supportsManualDice('manual', 'player')).toBe(true)
    expect(supportsManualDice('manual', 'dm')).toBe(true)
    expect(supportsManualDice('automatic', 'dm')).toBe(true)
    expect(supportsManualDice('automatic', 'player')).toBe(false)
  })

  it('migrates the removed semi-automatic mode to manual', () => {
    expect(normalizeCombatSettlementMode('semi-automatic')).toBe('manual')
  })

  it.each(['automatic', 'manual'] as const)(
    'allows DM battlefield adjustments in %s mode without granting them to players',
    (mode) => {
      expect(supportsDmBattlefieldAdjustment(mode, 'dm')).toBe(true)
      expect(supportsDmBattlefieldAdjustment(mode, 'player')).toBe(false)
    },
  )

  it('allows ending a turn without enabling automated actions in manual mode', () => {
    expect(allowsPlayerActionInSettlementMode('manual', 'end-turn')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-map-interaction')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'move-token', false)).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'move-token', true)).toBe(false)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-weapon-attack')).toBe(false)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-spell')).toBe(false)
    expect(allowsPlayerActionInSettlementMode('automatic', 'dnd5e-weapon-attack')).toBe(true)
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
