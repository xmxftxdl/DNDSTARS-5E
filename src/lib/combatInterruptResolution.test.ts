import { describe, expect, it } from 'vitest'
import { createCombatInterrupt } from './combatInterruptQueue'
import {
  applyDmInterruptResolution,
  isCounterspellSuccessful,
  resolveCombatInterruptTimeout,
} from './combatInterruptResolution'

describe('P1 DM interrupt resolution capabilities', () => {
  it('applies only the adjustment allowed at each Headless checkpoint', () => {
    expect(applyDmInterruptResolution({
      phase: 'before-hit', proposed: { hit: true, damage: 12 },
      response: { decision: 'approved', effects: [], hitOverride: false, damageAdjustment: { mode: 'set', value: 99 } },
    })).toMatchObject({ hit: false, damage: 12, changed: true })
    expect(applyDmInterruptResolution({
      phase: 'before-damage', proposed: { damage: 12 },
      response: { decision: 'approved', effects: [], damageAdjustment: { mode: 'multiply', value: 0.5 } },
    })).toMatchObject({ damage: 6, changed: true })
    expect(applyDmInterruptResolution({
      phase: 'after-save', proposed: { saveSuccess: false },
      response: { decision: 'approved', effects: [], useLegendaryResistance: true },
    })).toMatchObject({ saveSuccess: true, changed: true })
    expect(applyDmInterruptResolution({
      phase: 'before-condition', proposed: { conditionIds: ['prone', 'blinded'] },
      response: { decision: 'approved', effects: [], blockedConditionIds: ['blinded'] },
    })).toMatchObject({ conditionIds: ['prone'], changed: true })
  })

  it('distinguishes reaction rollback from DM wait semantics', () => {
    const shield = createCombatInterrupt({ mapId: 'map', kind: 'shield-spell', payload: {} })
    const adjudication = createCombatInterrupt({ mapId: 'map', kind: 'dm-adjudication', payload: {} })
    expect(resolveCombatInterruptTimeout(shield, 'timeout')).toEqual({ action: 'rollback', reason: 'timeout' })
    expect(resolveCombatInterruptTimeout(adjudication, 'dm-disconnected')).toEqual({ action: 'wait-for-dm', reason: 'dm-disconnected' })
  })

  it('uses SRD Counterspell level and DC rules', () => {
    expect(isCounterspellSuccessful({ spellLevel: 3, counterspellSlotLevel: 3 })).toBe(true)
    expect(isCounterspellSuccessful({ spellLevel: 6, counterspellSlotLevel: 3, abilityCheckTotal: 15 })).toBe(false)
    expect(isCounterspellSuccessful({ spellLevel: 6, counterspellSlotLevel: 3, abilityCheckTotal: 16 })).toBe(true)
  })
})
