import type { Character } from '../../types/character'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import {
  DND5E_2014_ELDRITCH_KNIGHT_FEATURES,
  type DeclarativeEldritchKnightMechanicV1,
  type Dnd5e2014EldritchKnightFeatureId,
} from './declarativeSubclassAbility'
import { dnd5ePluginSubclassDefinition } from './pluginApi'
import { dnd5eCharacterClassLevel } from './multiclass'

export interface Dnd5eEldritchKnightFeatureDefinition {
  featureId: string
  feature: Dnd5e2014EldritchKnightFeatureId
  minimumLevel: number
  mechanic: DeclarativeEldritchKnightMechanicV1
}

function definitionForSubclass(
  subclassId: string | undefined,
  fighterLevel: number,
  feature: Dnd5e2014EldritchKnightFeatureId,
): Dnd5eEldritchKnightFeatureDefinition | undefined {
  if (!subclassId || fighterLevel < 1) return undefined
  const subclass = dnd5ePluginSubclassDefinition(subclassId)
  if (subclass?.classId !== 'fighter') return undefined
  const registeredFeature = subclass.features.find((candidate) =>
    candidate.level <= fighterLevel &&
    candidate.automation === 'full' &&
    candidate.declarativeAbility?.mechanic?.kind === 'eldritch-knight-2014' &&
    candidate.declarativeAbility.mechanic.feature === feature
  )
  const mechanic = registeredFeature?.declarativeAbility?.mechanic
  if (!registeredFeature || mechanic?.kind !== 'eldritch-knight-2014') return undefined
  return {
    featureId: registeredFeature.featureId,
    feature,
    minimumLevel: registeredFeature.level,
    mechanic,
  }
}

export function dnd5eEldritchKnightFeatureForCharacter(
  character: Character,
  feature: Dnd5e2014EldritchKnightFeatureId,
): Dnd5eEldritchKnightFeatureDefinition | undefined {
  return definitionForSubclass(
    character.dnd5eClassChoices?.fighter?.subclass,
    dnd5eCharacterClassLevel(character, 'fighter'),
    feature,
  )
}

export function dnd5eEldritchKnightFeatureForCombatant(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'level' | 'classLevels' | 'subclassIds' | 'pluginFeatureIds'>,
  feature: Dnd5e2014EldritchKnightFeatureId,
): Dnd5eEldritchKnightFeatureDefinition | undefined {
  if (!(DND5E_2014_ELDRITCH_KNIGHT_FEATURES as readonly string[]).includes(feature)) return undefined
  const fighterLevel = combatant.classLevels?.fighter ??
    (combatant.classId === 'fighter' ? combatant.level : 0)
  const definition = definitionForSubclass(combatant.subclassIds?.fighter, fighterLevel, feature)
  return definition && combatant.pluginFeatureIds.includes(definition.featureId)
    ? definition
    : undefined
}

export function dnd5eEldritchKnightWarMagicAvailable(
  character: Character,
  turnKey: string,
): boolean {
  const hasImproved = !!dnd5eEldritchKnightFeatureForCharacter(character, 'improved-war-magic')
  const hasWarMagic = !!dnd5eEldritchKnightFeatureForCharacter(character, 'war-magic')
  const state = character.dnd5eCombatState
  return hasImproved
    ? state?.eldritchKnightWarMagicTurnKey === turnKey
    : hasWarMagic && state?.eldritchKnightWarMagicCantripTurnKey === turnKey
}

export function dnd5eEldritchStrikeApplies(
  caster: Pick<Dnd5eCombatant, 'id' | 'classId' | 'level' | 'classLevels' | 'subclassIds' | 'pluginFeatureIds'>,
  target: Pick<Dnd5eCombatant, 'classState'>,
): boolean {
  return !!target.classState.eldritchStrikeBySource?.[caster.id] &&
    !!dnd5eEldritchKnightFeatureForCombatant(caster, 'eldritch-strike')
}
