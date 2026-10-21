import type {
  Dnd5eActivityChoiceDefinitionV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOutcomeV1,
  Dnd5eActivityTargetV1,
} from './dnd5eActivityContracts'
import { DND5E_SRD_MONSTERS, listDnd5eInstalledMonsters } from '../monsters'
import { dnd5eCreatureSubtypeMatches, persistentAreaCreatureTypesAllowed } from '../persistentAreaCreatureFilter'
import { dnd5eChallengeRatingValue } from '../wildShape'
import { dnd5eActivityHitDiePool, type Dnd5eActivityHitDiePool } from '../activityHitDice'

/** Client renders the choices; Host reconstructs them from its own actor snapshot. */
export function dnd5eActivityLanguageChoicesV1(activity: Dnd5eActivityDefinitionV1, languages: readonly string[] = [], hitPointDice?: readonly Dnd5eActivityHitDiePool[], creatures: readonly { id: string; name?: string }[] = []): Dnd5eActivityDefinitionV1 {
  if (!activity.choices?.some(choice => choice.optionsFrom)) return activity
  const known = [...new Set(languages.filter(language => language.trim()))]
  return {...activity, choices: activity.choices.map(choice => {
    if (choice.optionsFrom === 'combat-creatures') {
      const options = [...new Map(creatures.filter(creature => creature.id).map(creature =>
        [creature.id, { id: creature.id, label: creature.name || creature.id }])).values()]
      return { ...choice, options, defaultOptionId: undefined }
    }
    if (choice.optionsFrom === 'actor-languages') return {...choice, options: known.map((label, index) => ({id: `language-${index}`, label})), defaultOptionId: known.length ? 'language-0' : undefined}
    if (choice.optionsFrom === 'actor-hit-dice') {
      const options = [6, 8, 10, 12].flatMap(sides => {
        const id = `hit-die:d${sides}`, pool = dnd5eActivityHitDiePool(hitPointDice, id)
        return pool && pool.current > 0 ? [{ id, label: `d${sides}（剩余 ${pool.current}/${pool.max}）` }] : []
      })
      return { ...choice, options, defaultOptionId: options.some(option => option.id === choice.defaultOptionId) ? choice.defaultOptionId : undefined }
    }
    if (choice.optionsFrom === 'actor-hit-die-count') {
      const validPools = hitPointDice != null && hitPointDice.every(pool => dnd5eActivityHitDiePool(hitPointDice, `hit-die:d${pool.sides}`))
      const current = dnd5eActivityHitDiePool(hitPointDice, `hit-die:d${choice.hitDieSides}`)?.current ?? 0
      const ceiling = choice.hitDieMaximumCount ?? 20
      const options = validPools && Number.isSafeInteger(ceiling) && ceiling >= 0 && ceiling <= 511
        ? Array.from({ length: Math.min(current, ceiling) + 1 }, (_, count) => ({ id: String(count), label: count === 0 ? '不消耗' : `${count}d${choice.hitDieSides}` })) : []
      return { ...choice, options, defaultOptionId: options.some(option => option.id === choice.defaultOptionId) ? choice.defaultOptionId : undefined }
    }
    if (choice.optionsFrom === 'srd-beast-forms') {
      const options = DND5E_SRD_MONSTERS.filter(monster => /野兽|\bbeast\b/iu.test(monster.creatureType))
        .map(monster => ({ id: monster.id, label: `${monster.name} (CR ${monster.challenge.rating})` }))
      return { ...choice, options, defaultOptionId: options.some(option => option.id === choice.defaultOptionId) ? choice.defaultOptionId : undefined }
    }
    if (choice.optionsFrom === 'srd-monsters' || choice.optionsFrom === 'installed-monsters') {
      const filter = choice.monsterFilter
      const subtype = filter?.subtype
      const catalog = choice.optionsFrom === 'installed-monsters' ? listDnd5eInstalledMonsters() : DND5E_SRD_MONSTERS
      const options = catalog.filter(monster =>
        persistentAreaCreatureTypesAllowed({ includedCreatureTypes: filter?.creatureTypes }, [monster.creatureType]) &&
        (!subtype || dnd5eCreatureSubtypeMatches(monster.subtypes, subtype)) &&
        (filter?.maximumChallengeRating == null || dnd5eChallengeRatingValue(monster.challenge.rating) <= filter.maximumChallengeRating),
      ).map(monster => ({ id: monster.id, label: `${monster.name} (CR ${monster.challenge.rating})` }))
      return { ...choice, options, defaultOptionId: options.some(option => option.id === choice.defaultOptionId) ? choice.defaultOptionId : undefined }
    }
    return choice
  })}
}

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
  if (activity.consumption?.some(cost => (cost.kind === 'hit-die' || cost.kind === 'resource') && cost.whenChoice?.choiceId === choice.id)) return true
  if (activity.choices?.find((candidate) => candidate.id === choice.id)?.options.some((option) => option.targetOverride)) {
    return true
  }
  let referenced = false
  for (const outcome of activity.outcomes) {
    const conditions = outcome.when.kind === 'all' ? outcome.when.conditions : [outcome.when]
    const consumesChoice = conditions.some((condition) =>
      condition.kind === 'choice' && condition.choiceId === choice.id,
    ) || outcome.operations.some((operation) =>
      (operation.kind === 'apply-effect' && (operation.frightenedSourceChoiceId === choice.id || operation.charmedSourceChoiceId === choice.id)) ||
      (operation.kind === 'create-persistent-area' && operation.labelTextChoiceId === choice.id) ||
      (operation.kind === 'create-persistent-area' && operation.colorTextChoiceId === choice.id) ||
      (operation.kind === 'create-persistent-area' && operation.drawingTextChoiceId === choice.id) ||
      (operation.kind === 'transform-creature' && operation.formChoiceId === choice.id) ||
      (operation.kind === 'summon' && [operation.monsterChoiceId, operation.corpseFormChoiceId, operation.languageChoiceId].includes(choice.id)) ||
      (operation.kind === 'damage' && (operation.damageTypeChoiceId === choice.id || operation.damageTypeFromRoll?.indexChoiceId === choice.id)),
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

/** Form prompts follow the selected mode; unresolved Host checks stay eligible. */
export function dnd5eActivityTargetFormOperationV1(
  activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'>,
  choices: Readonly<Record<string, string>> | undefined,
) {
  return activity.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations)
    .find(operation => operation.kind === 'transform-creature' ||
      (operation.kind === 'summon' && !!operation.corpseFormChoiceId))
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
