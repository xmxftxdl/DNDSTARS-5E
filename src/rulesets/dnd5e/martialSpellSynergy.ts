import type { Character } from '../../types/character'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import {
  DND5E_MARTIAL_SPELL_SYNERGY_OPERATIONS,
  type DeclarativeMartialSpellSynergyMechanicV1,
  type Dnd5eMartialSpellSynergyOperation,
} from './declarativeSubclassAbility'
import { dnd5ePluginSubclassDefinition } from './pluginApi'
import { dnd5eCharacterClassLevel } from './multiclass'

export interface Dnd5eMartialSpellSynergyDefinition {
  featureId: string
  operation: Dnd5eMartialSpellSynergyOperation
  minimumLevel: number
  mechanic: DeclarativeMartialSpellSynergyMechanicV1
}

function definitionForSubclass(
  subclassId: string | undefined,
  fighterLevel: number,
  operation: Dnd5eMartialSpellSynergyOperation,
): Dnd5eMartialSpellSynergyDefinition | undefined {
  if (!subclassId || fighterLevel < 1) return undefined
  const subclass = dnd5ePluginSubclassDefinition(subclassId)
  if (subclass?.classId !== 'fighter') return undefined
  const registeredFeature = subclass.features.find((candidate) =>
    candidate.level <= fighterLevel &&
    candidate.automation === 'full' &&
    candidate.declarativeAbility?.mechanic?.kind === 'martial-spell-synergy' &&
    candidate.declarativeAbility.mechanic.operation === operation
  )
  const mechanic = registeredFeature?.declarativeAbility?.mechanic
  if (!registeredFeature || mechanic?.kind !== 'martial-spell-synergy') return undefined
  return {
    featureId: registeredFeature.featureId,
    operation,
    minimumLevel: registeredFeature.level,
    mechanic,
  }
}

export function dnd5eMartialSpellSynergyForCharacter(
  character: Character,
  operation: Dnd5eMartialSpellSynergyOperation,
): Dnd5eMartialSpellSynergyDefinition | undefined {
  return definitionForSubclass(
    character.dnd5eClassChoices?.fighter?.subclass,
    dnd5eCharacterClassLevel(character, 'fighter'),
    operation,
  )
}

export function dnd5eMartialSpellSynergyForCombatant(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'level' | 'classLevels' | 'subclassIds' | 'pluginFeatureIds'>,
  operation: Dnd5eMartialSpellSynergyOperation,
): Dnd5eMartialSpellSynergyDefinition | undefined {
  if (!(DND5E_MARTIAL_SPELL_SYNERGY_OPERATIONS as readonly string[]).includes(operation)) return undefined
  const fighterLevel = combatant.classLevels?.fighter ??
    (combatant.classId === 'fighter' ? combatant.level : 0)
  const definition = definitionForSubclass(combatant.subclassIds?.fighter, fighterLevel, operation)
  return definition && combatant.pluginFeatureIds.includes(definition.featureId)
    ? definition
    : undefined
}

export function dnd5eMartialSpellBonusAttackAvailable(
  character: Character,
  turnKey: string,
): boolean {
  const hasSpellTrigger = !!dnd5eMartialSpellSynergyForCharacter(character, 'spell-then-bonus-attack')
  const hasCantripTrigger = !!dnd5eMartialSpellSynergyForCharacter(character, 'cantrip-then-bonus-attack')
  const state = character.dnd5eCombatState
  return hasSpellTrigger
    ? state?.spellBonusWeaponAttackTurnKey === turnKey
    : hasCantripTrigger && state?.cantripBonusWeaponAttackTurnKey === turnKey
}

export function dnd5eSpellSavePressureApplies(
  caster: Pick<Dnd5eCombatant, 'id' | 'classId' | 'level' | 'classLevels' | 'subclassIds' | 'pluginFeatureIds'>,
  target: Pick<Dnd5eCombatant, 'classState'>,
): boolean {
  return !!target.classState.spellSavePressureBySource?.[caster.id] &&
    !!dnd5eMartialSpellSynergyForCombatant(caster, 'weapon-hit-save-pressure')
}
