import { describe, expect, it } from 'vitest'
import {
  createD20AdjustmentContribution,
  createD20ReplacementContribution,
  createD20RollConfirmationInterrupt,
  resolvedD20Adjustment,
  resolvedD20Value,
  settleD20RollConfirmation,
} from './rollConfirmation'

describe('d20 roll confirmation', () => {
  it('opens a DM-owned after-roll transaction and keeps the original result by default', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', combatId: 'combat-1', rollId: 'roll-1', label: '长剑攻击',
      targetName: '地精', originalValue: 7, rollerCharacterId: 'fighter', kind: 'attack', now: 10,
    })

    expect(interrupt).toMatchObject({
      kind: 'roll-confirmation', phase: 'after-roll', timeoutPolicy: 'wait-for-dm', status: 'pending',
    })
    expect(interrupt.payload.transaction.status).toBe('waiting-for-interrupt')
    expect(settleD20RollConfirmation(interrupt, undefined, 20)).toMatchObject({
      decision: 'continue', finalValue: 7,
      transaction: { status: 'committed' },
    })
  })

  it('records the DM-accepted player replacement without losing the original roll', () => {
    const base = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'roll-2', label: '豁免检定', originalValue: 3, now: 10,
    })
    const contribution = createD20ReplacementContribution({
      interruptId: base.id, characterId: 'wizard', characterName: '先知',
      featureId: 'portent', featureLabel: '预兆', replacementValue: 18, now: 12,
    })
    const response = settleD20RollConfirmation({ ...base, contributions: [contribution] }, contribution.id, 20)
    const ledger = response.transaction?.rollLedger.entries[0]

    expect(response).toMatchObject({ finalValue: 18, acceptedContributionId: contribution.id })
    expect(ledger?.dice.values).toEqual([18])
    expect(ledger?.rerolls[0]).toMatchObject({
      method: 'replace', previousValue: 3, replacementValue: 18, sourceId: 'portent',
    })
    expect(resolvedD20Value(response, 3)).toBe(18)
  })

  it('rejects values outside a d20 and ignores an unknown contribution during settlement', () => {
    expect(() => createD20ReplacementContribution({
      interruptId: 'i', characterId: 'c', characterName: '角色', featureLabel: '特性', replacementValue: 21,
    })).toThrow('invalid-roll-confirmation-d20')
    const interrupt = createD20RollConfirmationInterrupt({ mapId: 'm', rollId: 'r', label: '检定', originalValue: 11 })
    expect(settleD20RollConfirmation(interrupt, 'missing').finalValue).toBe(11)
  })

  it('allows a DM-only roll to be corrected while preserving the original ledger value', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1',
      rollId: 'secret-roll',
      label: '暗骰察觉',
      originalValue: 6,
      visibility: 'dm-only',
      reason: 'dm-secret-roll',
      allowDmOverride: true,
      now: 10,
    })
    const response = settleD20RollConfirmation(interrupt, undefined, 20, 15)
    expect(response).toMatchObject({
      decision: 'continue',
      finalValue: 15,
      dmOverrideApplied: true,
    })
    expect(response.transaction?.rollLedger.entries[0].rerolls[0]).toMatchObject({
      method: 'replace',
      previousValue: 6,
      replacementValue: 15,
      sourceId: 'dm',
    })
  })

  it('records a Host-rolled total adjustment without replacing the natural d20', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1',
      rollId: 'roll-adjustment',
      label: '攻击检定',
      originalValue: 20,
      now: 10,
      eligibleModifiers: [{
        characterId: 'support',
        featureId: 'test.plugin:feature',
        featureLabel: '结果干预',
        modifierKind: 'adjust-d20',
        sourceTokenId: 'support-token',
        dieSides: 6,
        direction: 'subtract',
      }],
    })
    const contribution = createD20AdjustmentContribution({
      interruptId: interrupt.id,
      characterId: 'support',
      characterName: '支援者',
      featureId: 'test.plugin:feature',
      featureLabel: '结果干预',
      direction: 'subtract',
      now: 12,
    })
    const response = settleD20RollConfirmation(
      { ...interrupt, contributions: [contribution] },
      contribution.id,
      20,
      undefined,
      4,
    )

    expect(response).toMatchObject({
      finalValue: 20,
      acceptedContributionId: contribution.id,
      adjustment: {
        sourceId: 'support-token',
        featureId: 'test.plugin:feature',
        direction: 'subtract',
        roll: 4,
      },
    })
    expect(response.transaction?.rollLedger.entries).toHaveLength(2)
    expect(response.transaction?.rollLedger.entries[0].dice.values).toEqual([20])
    expect(response.transaction?.rollLedger.entries[1]).toMatchObject({
      dice: { sides: 6, values: [4] },
      sourceId: 'support-token',
    })
    expect(resolvedD20Adjustment(response)).toEqual(response.adjustment)
  })
})
