import { expect, it } from 'vitest'
import { canTriggerDnd5eZeroHitPointTurn, planDnd5eInterruptingTurn, planDnd5eResumeInterruptedTurn, restoreDnd5eInterruptedTurnEconomy } from './interruptedTurn'

it('offers the zero-HP reaction only for a final nonlethal-to-life damage packet and usable reaction', () => {
  const eligible = {hitPointsBefore: 10, hitPointsAfter: 0, maximumHitPoints: 50, hitPointDamage: 10,
    remainingDamageAfterZero: 0, dead: false, reactionAvailable: true, reactionsPrevented: false,
    incapacitatedBeforeDamage: false, featureEligible: true, remainingUses: 1}
  expect(canTriggerDnd5eZeroHitPointTurn(eligible)).toBe(true)
  expect(canTriggerDnd5eZeroHitPointTurn({...eligible, hitPointDamage: 59, remainingDamageAfterZero: 49})).toBe(true)
  for (const patch of [
    {hitPointsBefore: 0}, {hitPointsAfter: 1}, {hitPointDamage: 0},
    {hitPointDamage: 9, hitPointsAfter: 1}, {hitPointDamage: 60, remainingDamageAfterZero: 50},
    {dead: true}, {reactionAvailable: false}, {reactionsPrevented: true},
    {incapacitatedBeforeDamage: true}, {featureEligible: false}, {remainingUses: 0},
    {hitPointDamage: Number.NaN}, {remainingDamageAfterZero: Number.POSITIVE_INFINITY},
  ]) expect(canTriggerDnd5eZeroHitPointTurn({...eligible, ...patch})).toBe(false)
})

it('interrupts immediately and resumes the exact slot after JSON reload, including own and last turns', () => {
  for (const index of [0, 1, 2]) for (const actorId of ['hero', 'enemy']) {
    const state = { combatId: 'combat', round: 3, initiativeIndex: index,
      initiativeOrder: ['hero', 'enemy', 'hero'], initiativeSlotIds: ['hero-base', 'enemy-base', 'hero-extra'],
      oneShotInitiativeSlotIds: ['hero-extra'] }
    const original = structuredClone(state)
    const inserted = planDnd5eInterruptingTurn(state, actorId, `damage:${index}:${actorId}`)!
    expect(inserted).toBeTruthy()
    expect(inserted.initiative.initiativeOrder[index]).toBe(actorId)
    expect(inserted.initiative.initiativeOrder[index + 1]).toBe(state.initiativeOrder[index])
    expect(inserted.initiative.round).toBe(3)
    const restored = JSON.parse(JSON.stringify(inserted))
    expect(planDnd5eResumeInterruptedTurn(restored.initiative, restored.receipt)).toEqual(state)
    expect(state).toEqual(original)
    expect(planDnd5eInterruptingTurn(inserted.initiative, actorId, `damage:${index}:${actorId}`)).toBeUndefined()
    expect(planDnd5eResumeInterruptedTurn(state, inserted.receipt)).toBeUndefined()
    expect(planDnd5eResumeInterruptedTurn({...restored.initiative, round: 4}, restored.receipt)).toBeUndefined()
  }
})

it('unwinds nested interruptions in reverse order without ending their parent turns', () => {
  const state = {combatId: 'combat', round: 2, initiativeIndex: 0,
    initiativeOrder: ['enemy', 'first', 'second'], initiativeSlotIds: ['enemy-base', 'first-base', 'second-base'],
    oneShotInitiativeSlotIds: []}
  const first = planDnd5eInterruptingTurn(state, 'first', 'first-damage')!
  const second = planDnd5eInterruptingTurn(first.initiative, 'second', 'second-damage')!
  expect(second.initiative.initiativeOrder.slice(0, 3)).toEqual(['second', 'first', 'enemy'])
  expect(planDnd5eResumeInterruptedTurn(second.initiative, first.receipt)).toBeUndefined()
  const persisted = JSON.parse(JSON.stringify({state: second.initiative, receipts: [first.receipt, second.receipt]}))
  const parent = planDnd5eResumeInterruptedTurn(persisted.state, persisted.receipts[1])!
  expect(parent).toEqual(first.initiative)
  expect(planDnd5eResumeInterruptedTurn(parent, persisted.receipts[0])).toEqual(state)
})

it('restores spent actions and movement while preserving the live reaction state', () => {
  for (const beforeReaction of [false, true]) for (const afterReaction of [false, true]) {
    const captured = {actionAvailable: false, bonusActionAvailable: true, reactionAvailable: beforeReaction,
      objectInteractionAvailable: false, movementRemaining: 5, movementSpent: 25}
    const current = {actionAvailable: true, bonusActionAvailable: false, reactionAvailable: afterReaction,
      objectInteractionAvailable: true, movementRemaining: 30, movementSpent: 0}
    const restored = restoreDnd5eInterruptedTurnEconomy(JSON.parse(JSON.stringify(captured)), current)
    expect(restored).toEqual({...captured, reactionAvailable: afterReaction})
    expect(captured.reactionAvailable).toBe(beforeReaction)
    expect(current.actionAvailable).toBe(true)
  }
})

it('creates stable distinct slots for legacy duplicate actors and rejects malformed or stale receipts', () => {
  const state = {combatId: 'combat', round: 1, initiativeIndex: 1, initiativeOrder: ['hero', 'enemy', 'hero']}
  const result = planDnd5eInterruptingTurn(state, 'hero', 'damage')!
  const resumed = planDnd5eResumeInterruptedTurn(result.initiative, result.receipt)!
  expect(resumed.initiativeIndex).toBe(1)
  expect(new Set(resumed.initiativeSlotIds).size).toBe(3)
  expect(planDnd5eResumeInterruptedTurn(result.initiative, {...result.receipt, interruptedActorId: 'hero'})).toBeUndefined()
  expect(planDnd5eInterruptingTurn({...state, initiativeSlotIds: ['duplicate', 'duplicate', 'third']}, 'hero', 'damage')).toBeUndefined()
  expect(planDnd5eInterruptingTurn(state, 'missing', 'damage')).toBeUndefined()
  expect(planDnd5eInterruptingTurn(state, 'hero', '')).toBeUndefined()
})
