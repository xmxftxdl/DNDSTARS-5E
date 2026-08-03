import type { Character } from '../../types/character'
import {
  DND5E_RAGE_FEATURE_OPERATIONS,
  type DeclarativeRageFeatureMechanicV1,
  type Dnd5eRageFeatureOperation,
} from './declarativeSubclassAbility'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5eCharacterClassLevel } from './multiclass'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginSubclassDefinition,
} from './pluginApi'

export interface Dnd5eRageFeatureDefinition {
  featureId: string
  operation: Dnd5eRageFeatureOperation
  minimumLevel: number
  mechanic: DeclarativeRageFeatureMechanicV1
}

function definitionForSubclass(
  subclassId: string | undefined,
  barbarianLevel: number,
  operation: Dnd5eRageFeatureOperation,
): Dnd5eRageFeatureDefinition | undefined {
  if (!subclassId || barbarianLevel < 1) return undefined
  const subclass = dnd5ePluginSubclassDefinition(subclassId)
  if (subclass?.classId !== 'barbarian') return undefined
  const registeredFeature = subclass.features.find((candidate) =>
    candidate.level <= barbarianLevel &&
    candidate.automation === 'full' &&
    candidate.declarativeAbility?.mechanic?.kind === 'rage-feature' &&
    candidate.declarativeAbility.mechanic.operation === operation
  )
  const mechanic = registeredFeature?.declarativeAbility?.mechanic
  if (!registeredFeature || mechanic?.kind !== 'rage-feature') return undefined
  return {
    featureId: registeredFeature.featureId,
    operation,
    minimumLevel: registeredFeature.level,
    mechanic,
  }
}

export function dnd5eRageFeatureForCharacter(
  character: Character,
  operation: Dnd5eRageFeatureOperation,
): Dnd5eRageFeatureDefinition | undefined {
  const definition = definitionForSubclass(
    character.dnd5eClassChoices?.classes?.barbarian?.subclass,
    dnd5eCharacterClassLevel(character, 'barbarian'),
    operation,
  )
  return definition && dnd5eCharacterHasPluginFeature(character, definition.featureId)
    ? definition
    : undefined
}

export function dnd5eRageFeatureForCombatant(
  combatant: Pick<
    Dnd5eCombatant,
    'classId' | 'level' | 'classLevels' | 'subclassIds' | 'pluginFeatureIds'
  >,
  operation: Dnd5eRageFeatureOperation,
): Dnd5eRageFeatureDefinition | undefined {
  if (!(DND5E_RAGE_FEATURE_OPERATIONS as readonly string[]).includes(operation)) {
    return undefined
  }
  const barbarianLevel = combatant.classLevels?.barbarian ??
    (combatant.classId === 'barbarian' ? combatant.level : 0)
  const definition = definitionForSubclass(
    combatant.subclassIds?.barbarian,
    barbarianLevel,
    operation,
  )
  return definition && combatant.pluginFeatureIds.includes(definition.featureId)
    ? definition
    : undefined
}

export function dnd5eRageFeatureCarryingCapacityMultiplier(
  character: Character,
): number {
  return dnd5eRageFeatureForCharacter(
    character,
    'object-strength-and-carrying',
  )?.mechanic.carryingCapacityMultiplier ?? 1
}
