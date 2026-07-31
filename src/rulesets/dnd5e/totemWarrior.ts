import type { Character } from '../../types/character'
import {
  DND5E_2014_TOTEM_WARRIOR_FEATURES,
  type DeclarativeTotemWarriorMechanicV1,
  type Dnd5e2014TotemWarriorFeatureId,
} from './declarativeSubclassAbility'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5eCharacterClassLevel } from './multiclass'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginSubclassDefinition,
} from './pluginApi'

export interface Dnd5eTotemWarriorFeatureDefinition {
  featureId: string
  feature: Dnd5e2014TotemWarriorFeatureId
  minimumLevel: number
  mechanic: DeclarativeTotemWarriorMechanicV1
}

function definitionForSubclass(
  subclassId: string | undefined,
  barbarianLevel: number,
  feature: Dnd5e2014TotemWarriorFeatureId,
): Dnd5eTotemWarriorFeatureDefinition | undefined {
  if (!subclassId || barbarianLevel < 1) return undefined
  const subclass = dnd5ePluginSubclassDefinition(subclassId)
  if (subclass?.classId !== 'barbarian') return undefined
  const registeredFeature = subclass.features.find((candidate) =>
    candidate.level <= barbarianLevel &&
    candidate.automation === 'full' &&
    candidate.declarativeAbility?.mechanic?.kind === 'totem-warrior-2014' &&
    candidate.declarativeAbility.mechanic.feature === feature
  )
  const mechanic = registeredFeature?.declarativeAbility?.mechanic
  if (!registeredFeature || mechanic?.kind !== 'totem-warrior-2014') return undefined
  return {
    featureId: registeredFeature.featureId,
    feature,
    minimumLevel: registeredFeature.level,
    mechanic,
  }
}

export function dnd5eTotemWarriorFeatureForCharacter(
  character: Character,
  feature: Dnd5e2014TotemWarriorFeatureId,
): Dnd5eTotemWarriorFeatureDefinition | undefined {
  const definition = definitionForSubclass(
    character.dnd5eClassChoices?.classes?.barbarian?.subclass,
    dnd5eCharacterClassLevel(character, 'barbarian'),
    feature,
  )
  return definition && dnd5eCharacterHasPluginFeature(character, definition.featureId)
    ? definition
    : undefined
}

export function dnd5eTotemWarriorFeatureForCombatant(
  combatant: Pick<
    Dnd5eCombatant,
    'classId' | 'level' | 'classLevels' | 'subclassIds' | 'pluginFeatureIds'
  >,
  feature: Dnd5e2014TotemWarriorFeatureId,
): Dnd5eTotemWarriorFeatureDefinition | undefined {
  if (!(DND5E_2014_TOTEM_WARRIOR_FEATURES as readonly string[]).includes(feature)) {
    return undefined
  }
  const barbarianLevel = combatant.classLevels?.barbarian ??
    (combatant.classId === 'barbarian' ? combatant.level : 0)
  const definition = definitionForSubclass(
    combatant.subclassIds?.barbarian,
    barbarianLevel,
    feature,
  )
  return definition && combatant.pluginFeatureIds.includes(definition.featureId)
    ? definition
    : undefined
}

export function dnd5eTotemWarriorCarryingCapacityMultiplier(
  character: Character,
): number {
  return dnd5eTotemWarriorFeatureForCharacter(
    character,
    'aspect-of-the-beast-bear',
  )
    ? 2
    : 1
}
