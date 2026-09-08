const SELECTION_POLICIES = new Set(['owner-chooses', 'highest', 'lowest', 'must-use-latest'])
export const ROLL_CONFIRMATION_STAGE_TIMEOUT_MS = 10_000

export function validateChoiceRerollResponse(input) {
  const { acceptedContribution, eligibleModifier, response, originalValue, rollOptions } = input
  if (acceptedContribution?.kind !== 'choice-reroll') {
    return response.choiceReroll == null
      ? { ok: true, finalValue: undefined }
      : { ok: false, status: 400, error: 'unexpected-choice-reroll' }
  }
  const choice = response.choiceReroll
  const scope = eligibleModifier?.rerollScope
  const additionalDice = eligibleModifier?.additionalDice ?? 1
  const selectionPolicy = eligibleModifier?.selectionPolicy ?? 'owner-chooses'
  const rerollValues = Array.isArray(choice?.rerollValues)
    ? choice.rerollValues
    : additionalDice === 1 ? [choice?.rerollValue] : []
  const resourceCosts = Array.isArray(eligibleModifier?.resourceCosts) ? eligibleModifier.resourceCosts : []
  const invalid = acceptedContribution.decision !== 'use' ||
    eligibleModifier?.modifierKind !== 'choice-reroll' ||
    !['self-roll', 'attack-against-self'].includes(scope) ||
    resourceCosts.length < 1 || !choice || choice.characterId !== acceptedContribution.characterId ||
    choice.featureId !== acceptedContribution.featureId || choice.scope !== scope ||
    choice.originalValue !== originalValue || ![1, 2].includes(additionalDice) ||
    !SELECTION_POLICIES.has(selectionPolicy) || rerollValues.length !== additionalDice ||
    rerollValues.some((value) => !Number.isInteger(value) || value < 1 || value > 20) ||
    choice.rerollValue !== rerollValues[0] || !Array.isArray(choice.resourceCosts) ||
    JSON.stringify(choice.resourceCosts) !== JSON.stringify(resourceCosts) ||
    rollOptions?.contributionId !== acceptedContribution.id ||
    JSON.stringify(rollOptions?.values) !== JSON.stringify([originalValue, ...rerollValues])
  if (invalid) return { ok: false, status: 409, error: 'roll-choice-reroll-conflict' }
  const values = [originalValue, ...rerollValues]
  const selectedValue = selectionPolicy === 'owner-chooses'
    ? values[acceptedContribution.selectedIndex ?? -1]
    : selectionPolicy === 'must-use-latest'
      ? values.at(-1)
      : selectionPolicy === 'lowest' ? Math.min(...values) : Math.max(...values)
  const selectedIndex = selectionPolicy === 'owner-chooses'
    ? acceptedContribution.selectedIndex : values.indexOf(selectedValue)
  const selectionInvalid = choice.selectedValue !== selectedValue ||
    (choice.selectedIndex != null && choice.selectedIndex !== selectedIndex) ||
    (choice.selectionPolicy != null && choice.selectionPolicy !== selectionPolicy) ||
    ((additionalDice > 1 || selectionPolicy !== 'owner-chooses') &&
      (choice.selectedIndex == null || choice.selectionPolicy == null))
  return selectionInvalid
    ? { ok: false, status: 409, error: 'roll-choice-reroll-conflict' }
    : { ok: true, finalValue: selectedValue }
}

export function applyRollOptionsMutation(base, index, mutation, now) {
  const current = base.interrupts[index]
  const options = mutation?.rollOptions
  const contribution = current?.contributions?.find((entry) =>
    entry?.id === options?.contributionId && entry?.kind === 'choice-reroll' && entry?.decision === 'use')
  const eligible = contribution && current.payload?.eligibleModifiers?.find((entry) =>
    entry?.characterId === contribution.characterId && entry?.featureId === contribution.featureId &&
    entry?.featureLabel === contribution.featureLabel && entry?.modifierKind === 'choice-reroll')
  const values = options?.values
  if (current?.kind !== 'roll-confirmation' || !['pending', 'rolling', 'waiting-for-dm'].includes(current.status) ||
    !contribution || !eligible || !Array.isArray(values) || values.length !== (eligible.additionalDice ?? 1) + 1 ||
    values[0] !== current.payload.originalValue || values.some((value) => !Number.isInteger(value) || value < 1 || value > 20)) {
    return { ok: false, status: 409, error: 'invalid-roll-options' }
  }
  const previous = current.payload.rollOptions
  if (previous) return JSON.stringify(previous) === JSON.stringify(options)
    ? { ok: true, changed: false, next: base }
    : { ok: false, status: 409, error: 'roll-options-conflict' }
  const interrupts = [...base.interrupts]
  interrupts[index] = {
    ...current, payload: { ...current.payload, rollOptions: options },
    expiresAt: current.payload?.visibility === 'dm-only' ? current.expiresAt : now + ROLL_CONFIRMATION_STAGE_TIMEOUT_MS,
    updatedAt: now,
  }
  return { ok: true, changed: true, next: {
    ...base, interrupts, updatedAt: now, revision: Number(base.revision ?? 0) + 1,
  } }
}
