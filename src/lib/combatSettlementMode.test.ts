import { describe, expect, it } from 'vitest'
import {
  allowsPlayerActionInSettlementMode,
  applyManualHitPointOperation,
  normalizeCombatSettlementMode,
  supportsDmBattlefieldAdjustment,
  supportsManualDice,
  usesAutomatedPlayerSettlement,
} from './combatSettlementMode'

describe('combat settlement modes', () => {
  it('keeps automatic as the backwards-compatible default', () => {
    expect(normalizeCombatSettlementMode(undefined)).toBe('automatic')
    expect(usesAutomatedPlayerSettlement('automatic')).toBe(true)
  })

  it('normalizes legacy room modes into per-action automatic routing', () => {
    expect(usesAutomatedPlayerSettlement('manual')).toBe(true)
    expect(supportsManualDice('manual', 'player')).toBe(false)
    expect(supportsManualDice('manual', 'dm')).toBe(true)
    expect(supportsManualDice('automatic', 'dm')).toBe(true)
    expect(supportsManualDice('automatic', 'player')).toBe(false)
  })

  it('migrates every removed global mode to automatic capability routing', () => {
    expect(normalizeCombatSettlementMode('manual')).toBe('automatic')
    expect(normalizeCombatSettlementMode('semi-automatic')).toBe('automatic')
  })

  it.each(['automatic', 'manual'] as const)(
    'allows DM battlefield adjustments in %s mode without granting them to players',
    (mode) => {
      expect(supportsDmBattlefieldAdjustment(mode, 'dm')).toBe(true)
      expect(supportsDmBattlefieldAdjustment(mode, 'player')).toBe(false)
    },
  )

  it('does not globally disable individual action routes for legacy manual snapshots', () => {
    expect(allowsPlayerActionInSettlementMode('manual', 'end-turn')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-map-interaction')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'move-token', false)).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'move-token', true)).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-weapon-attack')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-spell-cast')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-adjudicated-spell')).toBe(true)
    expect(allowsPlayerActionInSettlementMode('manual', 'dnd5e-persistent-area-move')).toBe(true)
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
