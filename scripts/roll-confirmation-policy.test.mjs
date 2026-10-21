import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyRollOptionsMutation, validateChoiceRerollResponse } from './roll-confirmation-policy.mjs'

function fixture(policy = 'highest', costs = []) {
  const acceptedContribution = { id: 'use', kind: 'choice-reroll', decision: 'use', characterId: 'hero', featureId: 'feature', featureLabel: 'Feature', selectedIndex: 1 }
  const eligibleModifier = { ...acceptedContribution, modifierKind: 'choice-reroll', rerollScope: 'self-roll', selectionPolicy: policy, resourceCosts: costs }
  const rollOptions = { contributionId: 'use', values: [12, 12] }
  const choiceReroll = { characterId: 'hero', featureId: 'feature', scope: 'self-roll', originalValue: 12, rerollValue: 12, rerollValues: [12], resourceCosts: costs, selectedValue: 12, selectedIndex: policy === 'highest' ? 0 : 1, selectionPolicy: policy }
  return { acceptedContribution, eligibleModifier, rollOptions, originalValue: 12, response: { choiceReroll } }
}

test('explicit free rerolls and valid paid rerolls settle; missing and malformed costs fail', () => {
  for (const costs of [[], [{ resourceKey: 'inspiration', amount: 1 }]]) {
    assert.equal(validateChoiceRerollResponse(fixture('highest', costs)).ok, true)
  }
  for (const costs of [undefined, null, [{ resourceKey: '', amount: 1 }], [{ resourceKey: 'x', amount: 0 }], [null]]) {
    const input = fixture()
    input.eligibleModifier.resourceCosts = costs
    assert.equal(validateChoiceRerollResponse(input).ok, false)
  }
})

test('must-use-latest selects the final die even when both results match', () => {
  const input = fixture('must-use-latest')
  assert.equal(validateChoiceRerollResponse(input).ok, true)
  input.response.choiceReroll.selectedIndex = 0
  assert.equal(validateChoiceRerollResponse(input).ok, false)
})

test('publishing owner options resumes decisions with a fresh deadline; replay cannot extend it', () => {
  for (const policy of ['owner-chooses', 'highest']) {
    const input = fixture(policy)
    const base = { revision: 1, interrupts: [{ kind: 'roll-confirmation', status: 'rolling', expiresAt: 100, contributions: [input.acceptedContribution], payload: { originalValue: 12, eligibleModifiers: [input.eligibleModifier] } }] }
    const result = applyRollOptionsMutation(base, 0, { rollOptions: input.rollOptions }, 20_000)
    assert.equal(result.ok, true)
    assert.equal(result.next.interrupts[0].status, policy === 'owner-chooses' ? 'pending' : 'rolling')
    assert.equal(result.next.interrupts[0].expiresAt, 30_000)
    const replay = applyRollOptionsMutation(result.next, 0, { rollOptions: input.rollOptions }, 25_000)
    assert.equal(replay.changed, false)
    assert.equal(replay.next.interrupts[0].expiresAt, 30_000)
  }
})
