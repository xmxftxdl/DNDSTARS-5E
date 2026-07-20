import { describe, expect, it } from 'vitest'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'

describe('D&D 5e roll mode resolver', () => {
  it('does not stack multiple sources on the same side', () => {
    expect(resolveDnd5eRollMode({
      advantage: [
        { active: true, reason: 'unseen-attacker' },
        { active: true, reason: 'prone-target' },
      ],
    })).toMatchObject({ mode: 'advantage', advantageReasons: ['unseen-attacker', 'prone-target'] })
  })

  it('cancels every advantage source with any disadvantage source', () => {
    expect(resolveDnd5eRollMode({
      requestedMode: 'advantage',
      advantage: [{ active: true, reason: 'unseen-attacker' }],
      disadvantage: [{ active: true, reason: 'protection' }],
    }).mode).toBe('normal')
  })

  it('uses the same cancellation rule when Protection imposes disadvantage', () => {
    expect(imposeDnd5eRollDisadvantage('normal', 'protection').mode).toBe('disadvantage')
    expect(imposeDnd5eRollDisadvantage('advantage', 'protection').mode).toBe('normal')
    expect(imposeDnd5eRollDisadvantage('disadvantage', 'protection').mode).toBe('disadvantage')
  })
})
