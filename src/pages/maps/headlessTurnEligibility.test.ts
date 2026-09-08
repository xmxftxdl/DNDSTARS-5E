import { describe, expect, it } from 'vitest'
import { dnd5eCombatantHasHeadlessTurnRules } from './headlessTurnEligibility'

describe('dnd5eCombatantHasHeadlessTurnRules', () => {
  it('does not route a generic linked test character into a rejected Headless end turn', () => {
    expect(dnd5eCombatantHasHeadlessTurnRules({
      character: { charClass: '测试施法者' },
    })).toBe(false)
    expect(dnd5eCombatantHasHeadlessTurnRules({
      character: { charClass: '法师' },
    })).toBe(true)
  })

  it('recognizes registered SRD monster tokens only', () => {
    expect(dnd5eCombatantHasHeadlessTurnRules({
      token: { poolId: 'srd-5.1:archmage' },
    })).toBe(true)
    expect(dnd5eCombatantHasHeadlessTurnRules({
      token: { poolId: 'custom:plain-token' },
    })).toBe(false)
  })
})
