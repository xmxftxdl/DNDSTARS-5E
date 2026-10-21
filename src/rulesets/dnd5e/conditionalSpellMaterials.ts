import type { Dnd5eImportedSpell } from './spellbook'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

/** Every material mode must be bound to the same closed choice used by the spell. */
export function dnd5eConditionalSpellMaterialProblems(
  components: Dnd5eImportedSpell['components'],
  activity: Dnd5eActivityDefinitionV1 | undefined,
  duration?: Dnd5eImportedSpell['duration'],
): string[] {
  const modes = components.materialRequirementByChoice
  const recipes = [components.materialRequirement, ...(modes?.options.map(option => option.requirement) ?? [])]
  if (recipes.some(recipe => recipe?.consumptionTiming === 'spell-end') &&
    (!activity || duration?.type !== 'timed' || !duration.value || duration.value <= 0 || !duration.unit)) {
    return ['End-of-spell materials require an Activity and an explicit timed duration.']
  }
  if (!modes) return []
  const choice = activity?.choices?.find(entry => entry.id === modes.choiceId)
  if (!choice || choice.optionsFrom) return ['Conditional spell materials require a declared static Activity choice.']
  const ids = new Set(modes.options.map(option => option.optionId))
  if (ids.size !== modes.options.length || ids.size !== choice.options.length ||
    choice.options.some(option => !ids.has(option.id))) return ['Conditional spell material modes must exactly cover the Activity choice.']
  return []
}
