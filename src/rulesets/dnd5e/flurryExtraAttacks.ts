import type { Character } from '../../types/character'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5ePluginSubclassDefinition } from './pluginApi'
import { dnd5eCharacterClassLevel } from './multiclass'

function capability(subclassId: string | undefined, monkLevel: number) {
  const subclass = subclassId ? dnd5ePluginSubclassDefinition(subclassId) : undefined
  if (subclass?.classId !== 'monk') return undefined
  return subclass.features.find(feature => feature.level <= monkLevel && feature.automation === 'full' &&
    feature.declarativeAbility?.mechanic?.kind === 'flurry-extra-attacks')
}

export function dnd5eFlurryMaximumForCharacter(character: Character): number {
  const mechanic = capability(character.dnd5eClassChoices?.classes?.monk?.subclass,
    dnd5eCharacterClassLevel(character, 'monk'))?.declarativeAbility?.mechanic
  return mechanic?.kind === 'flurry-extra-attacks' ? 2 + mechanic.additionalAttacks : 2
}

export function dnd5eFlurryMaximumForCombatant(actor: Dnd5eCombatant): number {
  const feature = capability(actor.subclassIds?.monk, actor.classLevels?.monk ?? (actor.classId === 'monk' ? actor.level : 0))
  const mechanic = feature?.declarativeAbility?.mechanic
  return feature && actor.pluginFeatureIds.includes(feature.featureId) && mechanic?.kind === 'flurry-extra-attacks'
    ? 2 + mechanic.additionalAttacks : 2
}

/** Extra attacks are optional. Ordinary two-attack Flurry may repeat a target. */
export function dnd5eFlurryTargetsValid(targetIds: readonly string[], maximum: number): boolean {
  return targetIds.length >= 2 && targetIds.length <= maximum &&
    (targetIds.length === 2 || new Set(targetIds).size === targetIds.length)
}
