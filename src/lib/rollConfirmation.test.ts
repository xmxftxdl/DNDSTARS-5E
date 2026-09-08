import { describe, expect, it } from 'vitest'
import {
  createD20AdjustmentContribution,
  createD20ChoiceRerollContribution,
  createD20DeclineContribution,
  createD20ReplacementContribution,
  createD20RollConfirmationInterrupt,
  currentD20RollConfirmations,
  d20ChoiceRerollRequiresOwnerSelection,
  durableD20RollId,
  findD20RollConfirmationByRollId,
  findCurrentD20RollConfirmation,
  resolvedD20Adjustment,
  resolvedD20Value,
  settleD20RollConfirmation,
} from './rollConfirmation'
import { dnd5eCoreInspirationChoiceRerollOption } from './d20InterruptPolicy'

describe('d20 roll confirmation', () => {
  it('reuses a stable d20 identity when a durable parent action resumes after refresh', () => {
    const first = durableD20RollId({
      mapId: 'map-1', sourceMode: 'dm', transactionId: 'player-action-123', occurrenceIndex: 0,
    })
    const replay = durableD20RollId({
      mapId: 'map-1', sourceMode: 'dm', transactionId: 'player-action-123', occurrenceIndex: 0,
    })
    const nextOccurrence = durableD20RollId({
      mapId: 'map-1', sourceMode: 'dm', transactionId: 'player-action-123', occurrenceIndex: 1,
    })
    expect(replay).toBe(first)
    expect(nextOccurrence).not.toBe(first)

    const settled = {
      ...createD20RollConfirmationInterrupt({
        mapId: 'map-1', rollId: first, label: '巨鹰·喙击命中检定',
        targetName: '牛头人', originalValue: 8,
      }),
      status: 'done' as const,
      response: { decision: 'continue' as const, finalValue: 16 },
    }
    expect(findD20RollConfirmationByRollId({ interrupts: [settled] }, replay))
      .toBe(settled)
    expect(resolvedD20Value(settled.response, settled.payload.originalValue)).toBe(16)
  })

  it('shows only the latest reconnect generation and never revives an older ghost prompt', () => {
    const first = createD20RollConfirmationInterrupt({
      mapId: 'map-1', combatId: 'combat-1', rollId: 'retry-1', label: '法术攻击',
      targetName: '红龙', originalValue: 15, rollerCharacterId: 'wizard', now: 10,
    })
    const latest = createD20RollConfirmationInterrupt({
      mapId: 'map-1', combatId: 'combat-1', rollId: 'retry-2', label: '法术攻击',
      targetName: '红龙', originalValue: 9, rollerCharacterId: 'wizard', now: 20,
    })

    expect(currentD20RollConfirmations({ interrupts: [first, latest] }))
      .toEqual([latest])
    expect(currentD20RollConfirmations({
      interrupts: [first, { ...latest, status: 'done' }],
    })).toEqual([])
    const reconnectPrototype = createD20RollConfirmationInterrupt({
      mapId: 'map-1', combatId: 'combat-1', rollId: 'retry-3', label: '法术攻击',
      targetName: '红龙', originalValue: 4, rollerCharacterId: 'wizard', now: 30,
    })
    expect(findCurrentD20RollConfirmation({ interrupts: [first, latest] }, reconnectPrototype))
      .toEqual(latest)
  })

  it('does not present an expired public confirmation as an active reconnect prompt', () => {
    const expired = createD20RollConfirmationInterrupt({
      mapId: 'map-1', combatId: 'combat-1', rollId: 'expired-roll', label: '法术攻击',
      targetName: '红龙', originalValue: 8, rollerCharacterId: 'wizard', now: 100,
      eligibleModifiers: [{
        characterId: 'wizard', featureId: 'inspiration', featureLabel: '激励',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll',
        resourceCosts: [{ resourceKey: 'inspiration', amount: 1 }],
      }],
    })

    expect(currentD20RollConfirmations({ interrupts: [expired] }, expired.expiresAt)).toEqual([])
    expect(findCurrentD20RollConfirmation({ interrupts: [expired] }, expired, expired.expiresAt)).toBeUndefined()
    expect(currentD20RollConfirmations({ interrupts: [expired] }, expired.expiresAt! - 1)).toEqual([expired])
  })

  it('reconnects to an in-flight Inspiration reroll until it can finish or safely time out', () => {
    const pending = createD20RollConfirmationInterrupt({
      mapId: 'map-1', combatId: 'combat-1', rollId: 'inspiration-recovery', label: '敏捷豁免',
      targetName: '卓尔', originalValue: 7, rollerCharacterId: 'drow', now: 100,
      eligibleModifiers: [dnd5eCoreInspirationChoiceRerollOption({ id: 'drow', inspiration: 1 }, 'drow-token')!],
    })
    const rolling = { ...pending, status: 'rolling' as const, expiresAt: 10_100 }

    expect(currentD20RollConfirmations({ interrupts: [rolling] }, 10_099)).toEqual([rolling])
    expect(currentD20RollConfirmations({ interrupts: [rolling] }, 10_100)).toEqual([])

    const diceRecorded = {
      ...rolling,
      payload: {
        ...rolling.payload,
        rollOptions: { contributionId: 'inspiration-use', values: [7, 16] },
      },
    }
    expect(currentD20RollConfirmations({ interrupts: [diceRecorded] }, 20_000)).toEqual([diceRecorded])
  })

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
      eligibleModifiers: [{
        characterId: 'wizard', featureId: 'portent', featureLabel: '预兆',
        replacementValues: [18, 7],
      }],
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

  it('rejects a replacement that is not in the Host-owned stored d20 pool', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'stored-portent', label: '豁免检定', originalValue: 13,
      eligibleModifiers: [{
        characterId: 'wizard', featureId: 'portent', featureLabel: '预兆',
        replacementValues: [4, 18],
      }],
    })
    const forged = createD20ReplacementContribution({
      interruptId: interrupt.id, characterId: 'wizard', characterName: '先知',
      featureId: 'portent', featureLabel: '预兆', replacementValue: 20,
    })
    expect(() => settleD20RollConfirmation(
      { ...interrupt, contributions: [forged] }, forged.id,
    )).toThrow('invalid-roll-confirmation-replacement')
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

  it('records a fixed adjustment without requesting or inventing a Host die', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'fixed-adjustment', label: '攻击检定', originalValue: 7,
      eligibleModifiers: [{
        characterId: 'cleric', featureId: 'war:guided-strike', featureLabel: '导引打击',
        modifierKind: 'adjust-d20', sourceTokenId: 'cleric-token', fixedAmount: 10,
        direction: 'add',
      }],
    })
    const contribution = createD20AdjustmentContribution({
      interruptId: interrupt.id, characterId: 'cleric', characterName: '战争牧师',
      featureId: 'war:guided-strike', featureLabel: '导引打击', direction: 'add',
    })

    const response = settleD20RollConfirmation(
      { ...interrupt, contributions: [contribution] }, contribution.id,
    )

    expect(response.adjustment).toEqual({
      sourceId: 'cleric-token', featureId: 'war:guided-strike', direction: 'add', roll: 10,
    })
    expect(response.transaction?.rollLedger.entries).toHaveLength(1)
  })

  it('waits for the owning player to explicitly use or decline a choice reroll', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1',
      rollId: 'lucky-roll',
      label: '游侠攻击检定',
      originalValue: 6,
      rollerCharacterId: 'ranger',
      kind: 'attack',
      eligibleModifiers: [{
        characterId: 'ranger',
        featureId: 'test.lucky:feat-lucky',
        featureLabel: '幸运',
        modifierKind: 'choice-reroll',
        rerollScope: 'self-roll',
        resourceCosts: [{ resourceKey: 'test.lucky:luck-points', amount: 1 }],
        decisionRequired: true,
      }],
      now: 10,
    })

    expect(() => settleD20RollConfirmation(interrupt, undefined, 20))
      .toThrow('roll-confirmation-player-decision-pending')

    const decline = createD20ChoiceRerollContribution({
      interruptId: interrupt.id,
      characterId: 'ranger',
      characterName: '游侠',
      featureId: 'test.lucky:feat-lucky',
      featureLabel: '幸运',
      decision: 'decline',
      now: 12,
    })
    const declined = settleD20RollConfirmation({ ...interrupt, contributions: [decline] }, undefined, 20)
    expect(declined.finalValue).toBe(6)
    expect(declined.choiceReroll).toBeUndefined()
  })

  it('gives public player modifiers ten seconds and keeps the original result after timeout', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'timed-choice', label: '攻击检定', originalValue: 13, now: 100,
      eligibleModifiers: [{
        characterId: 'hero', featureId: 'inspiration', featureLabel: '激励',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll',
        resourceCosts: [{ resourceKey: 'inspiration', amount: 1 }],
      }],
    })
    expect(interrupt).toMatchObject({ timeoutPolicy: 'rollback', expiresAt: 10_100 })
    expect(() => settleD20RollConfirmation(interrupt, undefined, 10_099))
      .toThrow('roll-confirmation-player-decision-pending')
    expect(settleD20RollConfirmation(interrupt, undefined, 10_100)).toMatchObject({
      decision: 'continue', finalValue: 13, acceptedContributionId: undefined,
    })
  })

  it('records the Host extra d20 and selects the favorable value for the owner', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'enemy-attack', label: '食人魔攻击', originalValue: 17,
      eligibleModifiers: [{
        characterId: 'wizard', featureId: 'test.lucky:feat-lucky', featureLabel: '幸运',
        modifierKind: 'choice-reroll', rerollScope: 'attack-against-self',
        resourceCosts: [{ resourceKey: 'test.lucky:luck-points', amount: 1 }], decisionRequired: true,
      }],
      now: 10,
    })
    const use = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'wizard', characterName: '法师',
      featureId: 'test.lucky:feat-lucky', featureLabel: '幸运', decision: 'use', selectedIndex: 1, now: 12,
    })
    const response = settleD20RollConfirmation(
      { ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, 5, 1,
    )

    expect(response).toMatchObject({
      finalValue: 5,
      acceptedContributionId: use.id,
      choiceReroll: {
        originalValue: 17, rerollValue: 5, selectedValue: 5,
        scope: 'attack-against-self',
        resourceCosts: [{ resourceKey: 'test.lucky:luck-points', amount: 1 }],
      },
    })
    expect(response.transaction?.rollLedger.entries).toHaveLength(2)
    expect(response.transaction?.rollLedger.entries[1].dice).toEqual({ sides: 20, values: [5] })
  })

  it('settles core Inspiration in one click as advantage and keeps the higher d20', () => {
    const option = dnd5eCoreInspirationChoiceRerollOption({ id: 'hero', inspiration: 1 }, 'hero-token')!
    expect(d20ChoiceRerollRequiresOwnerSelection(option)).toBe(false)
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'core-inspiration', label: '英雄攻击', originalValue: 8,
      rollerCharacterId: 'hero', eligibleModifiers: [option], now: 10,
    })
    const use = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: option.featureId, featureLabel: option.featureLabel, decision: 'use', now: 12,
    })
    const improved = settleD20RollConfirmation(
      { ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, 16,
    )
    expect(improved).toMatchObject({
      finalValue: 16,
      choiceReroll: { selectedValue: 16, selectedIndex: 1, selectionPolicy: 'highest' },
    })

    const lowerReroll = settleD20RollConfirmation(
      { ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, 4,
    )
    expect(lowerReroll).toMatchObject({
      finalValue: 8,
      choiceReroll: { selectedValue: 8, selectedIndex: 0, selectionPolicy: 'highest' },
    })
  })

  it('only pauses after the second d20 when the feature owner must choose a result', () => {
    expect(d20ChoiceRerollRequiresOwnerSelection({ selectionPolicy: 'owner-chooses' })).toBe(true)
    expect(d20ChoiceRerollRequiresOwnerSelection({ selectionPolicy: undefined })).toBe(true)
    expect(d20ChoiceRerollRequiresOwnerSelection({ selectionPolicy: 'highest' })).toBe(false)
    expect(d20ChoiceRerollRequiresOwnerSelection({ selectionPolicy: 'lowest' })).toBe(false)
    expect(d20ChoiceRerollRequiresOwnerSelection({ selectionPolicy: 'must-use-latest' })).toBe(false)
    expect(d20ChoiceRerollRequiresOwnerSelection()).toBe(false)
  })

  it('supports a three-result choice and records every Host die', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'three-way', label: '命运三择', originalValue: 8,
      eligibleModifiers: [{
        characterId: 'hero', featureId: 'fortune', featureLabel: '命运三择',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: 2,
        selectionPolicy: 'owner-chooses', resourceCosts: [{ resourceKey: 'fortune', amount: 1 }],
      }],
    })
    const use = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: 'fortune', featureLabel: '命运三择', decision: 'use', selectedIndex: 2,
    })
    const response = settleD20RollConfirmation(
      { ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, [12, 19], 2,
    )
    expect(response.choiceReroll).toMatchObject({
      rerollValues: [12, 19], selectedIndex: 2, selectedValue: 19,
      selectionPolicy: 'owner-chooses',
    })
    expect(response.transaction?.rollLedger.entries[1].dice.values).toEqual([12, 19])
  })

  it('does not let owner-chooses settle before the player selects a result', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'pending-selection', label: '选择重掷', originalValue: 9,
      eligibleModifiers: [{
        characterId: 'hero', featureId: 'fortune', featureLabel: '幸运',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: 1,
        selectionPolicy: 'owner-chooses', resourceCosts: [{ resourceKey: 'fortune', amount: 1 }],
      }],
    })
    const use = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: 'fortune', featureLabel: '幸运', decision: 'use',
    })
    expect(() => settleD20RollConfirmation(
      { ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, 18,
    )).toThrow('roll-confirmation-player-selection-pending')
  })

  it('enforces must-use-latest even when the original d20 is higher', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'forced-second', label: '强制重掷', originalValue: 20,
      eligibleModifiers: [{
        characterId: 'hero', featureId: 'forced', featureLabel: '强制重掷',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: 1,
        selectionPolicy: 'must-use-latest', resourceCosts: [{ resourceKey: 'forced', amount: 1 }],
      }],
    })
    const use = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: 'forced', featureLabel: '强制重掷', decision: 'use',
    })
    expect(settleD20RollConfirmation(
      { ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, 2,
    ).choiceReroll).toMatchObject({ selectedValue: 2, selectedIndex: 1, selectionPolicy: 'must-use-latest' })
  })

  it('accepts an explicit character-level decline for replacement and adjustment features', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'decline', label: '攻击', originalValue: 11,
      eligibleModifiers: [{ characterId: 'wizard', featureId: 'portent', featureLabel: '预兆' }],
    })
    expect(() => settleD20RollConfirmation(interrupt)).toThrow('roll-confirmation-player-decision-pending')
    const decline = createD20DeclineContribution({
      interruptId: interrupt.id, characterId: 'wizard', characterName: '法师',
    })
    expect(settleD20RollConfirmation({ ...interrupt, contributions: [decline] })).toMatchObject({
      finalValue: 11, acceptedContributionId: undefined,
    })
  })

  it('rejects a forged choice decision that is not in the Host eligibility list', () => {
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: 'map-1', rollId: 'forged-choice', label: '攻击', originalValue: 12,
      eligibleModifiers: [{
        characterId: 'hero', featureId: 'test.lucky:feat-lucky', featureLabel: '幸运',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll',
        resourceCosts: [{ resourceKey: 'test.lucky:luck-points', amount: 1 }], decisionRequired: true,
      }],
    })
    const forged = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '角色',
      featureId: 'forged:feat', featureLabel: '伪造能力', decision: 'decline',
    })
    expect(() => settleD20RollConfirmation({ ...interrupt, contributions: [forged] }))
      .toThrow('invalid-roll-confirmation-choice-decision')
  })
})
