import { describe, expect, it, vi } from 'vitest'
import type { DmAdjudicationInterruptResponse } from './combatInterruptProtocol'
import type { DmCombatInterruptSettlement } from './combatInterruptDmSettlement'
import {
  applyDmCombatInterruptSettlements,
  type DmCombatInterruptSettlementChannels,
  type PendingCombatInterruptChannel,
} from './combatInterruptSettlementRuntime'

function channel<T>(id?: string) {
  const resolve = vi.fn<(value: T) => void>()
  return {
    ref: {
      current: id ? { id, resolve } : null,
    } as PendingCombatInterruptChannel<T>,
    resolve,
  }
}

function channels() {
  return {
    opportunityAttack: channel<boolean>('opportunity'),
    protection: channel<boolean>(),
    shieldSpell: channel<boolean>('shield'),
    counterspell: channel<boolean>(),
    uncannyDodge: channel<boolean>(),
    deflectMissiles: channel<boolean>(),
    savingThrowReroll: channel<boolean>(),
    bardicInspiration: channel<boolean>(),
    cuttingWords: channel<boolean>(),
    darkOnesOwnLuck: channel<boolean>(),
    strokeOfLuck: channel<boolean>(),
    empoweredSpell: channel<string[]>('empowered'),
    standAgainstTide: channel<string | undefined>(),
    dmAdjudication: channel<DmAdjudicationInterruptResponse>('adjudication'),
  }
}

function refs(input: ReturnType<typeof channels>): DmCombatInterruptSettlementChannels {
  return {
    opportunityAttack: input.opportunityAttack.ref,
    protection: input.protection.ref,
    shieldSpell: input.shieldSpell.ref,
    counterspell: input.counterspell.ref,
    uncannyDodge: input.uncannyDodge.ref,
    deflectMissiles: input.deflectMissiles.ref,
    savingThrowReroll: input.savingThrowReroll.ref,
    bardicInspiration: input.bardicInspiration.ref,
    cuttingWords: input.cuttingWords.ref,
    darkOnesOwnLuck: input.darkOnesOwnLuck.ref,
    strokeOfLuck: input.strokeOfLuck.ref,
    empoweredSpell: input.empoweredSpell.ref,
    standAgainstTide: input.standAgainstTide.ref,
    dmAdjudication: input.dmAdjudication.ref,
  }
}

describe('DM combat interrupt settlement runtime', () => {
  it('settles matching pending channels in queue order and resolves their typed values', async () => {
    const pending = channels()
    const settle = vi.fn<(settlement: DmCombatInterruptSettlement) => Promise<void>>().mockResolvedValue(undefined)
    const settlements: DmCombatInterruptSettlement[] = [
      {
        kind: 'opportunity-attack', id: 'opportunity', reason: 'answered',
        finishResponse: { useOpportunityAttack: true }, useOpportunityAttack: true,
      },
      {
        kind: 'shield-spell', id: 'shield', reason: 'answered',
        finishResponse: { useShieldSpell: false }, useShieldSpell: false,
      },
      {
        kind: 'empowered-spell', id: 'empowered', reason: 'answered',
        finishResponse: { rerollKeys: ['effect::0'] }, rerollKeys: ['effect::0'],
      },
    ]

    await applyDmCombatInterruptSettlements({
      settlements,
      channels: refs(pending),
      settle,
      clearDmAdjudicationPrompt: vi.fn(),
    })

    expect(settle.mock.calls.map(([settlement]) => settlement.id)).toEqual(['opportunity', 'shield', 'empowered'])
    expect(pending.opportunityAttack.resolve).toHaveBeenCalledWith(true)
    expect(pending.shieldSpell.resolve).toHaveBeenCalledWith(false)
    expect(pending.empoweredSpell.resolve).toHaveBeenCalledWith(['effect::0'])
    expect(pending.opportunityAttack.ref.current).toBeNull()
  })

  it('ignores a stale settlement whose id no longer owns the pending channel', async () => {
    const pending = channels()
    const settle = vi.fn<(settlement: DmCombatInterruptSettlement) => Promise<void>>().mockResolvedValue(undefined)
    await applyDmCombatInterruptSettlements({
      settlements: [{
        kind: 'opportunity-attack', id: 'stale', reason: 'answered',
        finishResponse: { useOpportunityAttack: true }, useOpportunityAttack: true,
      }],
      channels: refs(pending),
      settle,
      clearDmAdjudicationPrompt: vi.fn(),
    })

    expect(settle).not.toHaveBeenCalled()
    expect(pending.opportunityAttack.resolve).not.toHaveBeenCalled()
    expect(pending.opportunityAttack.ref.current?.id).toBe('opportunity')
  })

  it('clears a DM adjudication prompt and resumes the transaction without finishing it twice', async () => {
    const pending = channels()
    const settle = vi.fn<(settlement: DmCombatInterruptSettlement) => Promise<void>>().mockResolvedValue(undefined)
    const clearDmAdjudicationPrompt = vi.fn()
    const response: DmAdjudicationInterruptResponse = { decision: 'approved', effects: [] }
    await applyDmCombatInterruptSettlements({
      settlements: [{
        kind: 'dm-adjudication', id: 'adjudication', reason: 'answered',
        finishResponse: response, response,
      }],
      channels: refs(pending),
      settle,
      clearDmAdjudicationPrompt,
    })

    expect(settle).not.toHaveBeenCalled()
    expect(clearDmAdjudicationPrompt).toHaveBeenCalledOnce()
    expect(pending.dmAdjudication.resolve).toHaveBeenCalledWith(response)
    expect(pending.dmAdjudication.ref.current).toBeNull()
  })

  it('does not resume a DM adjudication transaction until the combat pause gate opens', async () => {
    const pending = channels()
    const response: DmAdjudicationInterruptResponse = { decision: 'approved', effects: [] }
    let release = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const waitForDmAdjudicationResume = vi.fn(async () => gate)
    const settling = applyDmCombatInterruptSettlements({
      settlements: [{
        kind: 'dm-adjudication', id: 'adjudication', reason: 'answered',
        finishResponse: response, response,
      }],
      channels: refs(pending),
      settle: vi.fn(),
      clearDmAdjudicationPrompt: vi.fn(),
      waitForDmAdjudicationResume,
    })
    await Promise.resolve()

    expect(waitForDmAdjudicationResume).toHaveBeenCalledOnce()
    expect(pending.dmAdjudication.resolve).not.toHaveBeenCalled()
    release()
    await settling
    expect(pending.dmAdjudication.resolve).toHaveBeenCalledWith(response)
  })
})
