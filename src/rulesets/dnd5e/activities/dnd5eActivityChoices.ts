import type {
  Dnd5eActivityChoiceDefinitionV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOutcomeV1,
  Dnd5eActivityTargetV1,
} from './dnd5eActivityContracts'

/**
 * Omits a closed choice when every outcome that consumes it has already been
 * ruled out by an earlier choice. This keeps mutually exclusive Activity
 * branches from asking for fields that cannot affect the submitted action.
 */
export function dnd5eActivityChoiceIsRelevantV1(
  activity: Dnd5eActivityDefinitionV1,
  choice: Pick<Dnd5eActivityChoiceDefinitionV1, 'id'>,
  selectedChoices: Readonly<Record<string, string>> | undefined,
): boolean {
  if (activity.choices?.find((candidate) => candidate.id === choice.id)?.options.some((option) => option.targetOverride)) {
    return true
  }
  let referenced = false
  for (const outcome of activity.outcomes) {
    const conditions = outcome.when.kind === 'all' ? outcome.when.conditions : [outcome.when]
    const consumesChoice = conditions.some((condition) =>
      condition.kind === 'choice' && condition.choiceId === choice.id,
    ) || outcome.operations.some((operation) =>
      operation.kind === 'transform-creature' && operation.formChoiceId === choice.id,
    )
    if (!consumesChoice) continue
    referenced = true
    const contradicted = conditions.some((condition) =>
      condition.kind === 'choice' &&
      condition.choiceId !== choice.id &&
      selectedChoices?.[condition.choiceId] != null &&
      selectedChoices[condition.choiceId] !== condition.optionId,
    )
    if (!contradicted) return true
  }
  // Unknown/custom consumers remain conservative and keep their prompt.
  return !referenced
}

/**
 * Filters only the closed choice predicates that the client already knows.
 * Check totals and Host predicates intentionally remain possible here; this
 * helper is for deciding which UI inputs an outcome can require before the
 * authoritative execution resolves those later conditions.
 */
export function dnd5eActivityOutcomeAllowsChoicesV1(
  outcome: Pick<Dnd5eActivityOutcomeV1, 'when'>,
  choices: Readonly<Record<string, string>> | undefined,
): boolean {
  const conditions = outcome.when.kind === 'all'
    ? outcome.when.conditions
    : [outcome.when]
  return conditions.every((condition) =>
    condition.kind !== 'choice' || choices?.[condition.choiceId] === condition.optionId,
  )
}

/** Returns the one schema-declared target variant selected by closed choices. */
export function dnd5eActivityTargetOverrideForChoicesV1(
  activity: Dnd5eActivityDefinitionV1,
  choices: Readonly<Record<string, string>> | undefined,
): Dnd5eActivityTargetV1 | undefined {
  for (const choice of activity.choices ?? []) {
    const selectedId = choices?.[choice.id] ?? choice.defaultOptionId
    const selected = choice.options.find((option) => option.id === selectedId)
    if (selected?.targetOverride) return structuredClone(selected.targetOverride)
  }
  return undefined
}

/** Resolves the authoritative target declaration used by preview and Host. */
export function dnd5eActivityTargetForChoicesV1(
  activity: Dnd5eActivityDefinitionV1,
  choices: Readonly<Record<string, string>> | undefined,
): Dnd5eActivityTargetV1 {
  return dnd5eActivityTargetOverrideForChoicesV1(activity, choices) ?? activity.target
}

export function dnd5eActivityWithTargetChoicesV1(
  activity: Dnd5eActivityDefinitionV1,
  choices: Readonly<Record<string, string>> | undefined,
): Dnd5eActivityDefinitionV1 {
  const target = dnd5eActivityTargetForChoicesV1(activity, choices)
  return target === activity.target ? activity : { ...activity, target }
}
