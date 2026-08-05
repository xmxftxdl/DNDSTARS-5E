import { describe, expect, it, vi } from 'vitest'
import { coordinateResolvedSpellSettlement } from './SpellSettlementCoordinator'

describe('coordinateResolvedSpellSettlement', () => {
  it('orders observation before secondary settlement', async () => {
    const calls: string[] = []
    const result = await coordinateResolvedSpellSettlement({
      resolved: { ok: true, application: { hp: 3 } },
      validate: () => ({ ok: true }),
      application: (resolved) => resolved.application,
      beforeSettlement: () => { calls.push('observe') },
      settle: async () => { calls.push('settle'); return 3 },
    })
    expect(result).toEqual({ ok: true, settled: 3 })
    expect(calls).toEqual(['observe', 'settle'])
  })

  it('fails closed before settlement when application is absent', async () => {
    const settle = vi.fn(async () => 1)
    const result = await coordinateResolvedSpellSettlement({
      resolved: { ok: true },
      validate: () => ({ ok: true }),
      application: () => undefined,
      settle,
    })
    expect(result).toEqual({ ok: false, reason: 'missing-application' })
    expect(settle).not.toHaveBeenCalled()
  })
})
