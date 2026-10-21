import type { Character } from '../../types/character'
import { dnd5ePluginBooleanStaticModifierForCharacter } from './plugins/pluginContentCatalog'
import { dnd5eWalkingSpeed, dnd5eClassDefinition } from './classes'
import { dnd5eMovementBonusOwnerForCharacter, dnd5eImportedWalkingSpeedBonus } from './movementSpeedBonuses'
import { createDnd5eCombatant, dnd5eEffectiveWalkSpeed, dnd5eEffectiveOptionalMovementSpeed, dnd5eEffectiveFlySpeed, dnd5eEffectiveMovementPoolSpeed } from './headlessCombatEngine'
import { normalizeDnd5eClassLevels } from './classLevels'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eInventoryLoad } from './items'
import { dnd5eRageFeatureCarryingCapacityMultiplier } from './rageFeature'

export interface Dnd5eCharacterMovementProfile {
  walkSpeed: number
  climbSpeed?: number
  swimSpeed?: number
  flySpeed?: number
  hover?: boolean
  maximumSpeed: number
  canBreatheWater?: boolean
}

export type Dnd5eCharacterMovementStateProjection = Pick<
  NonNullable<Character['dnd5eCombatState']>,
  'activeEffects' | 'wildShapeFormId' | 'wildShapeMode'
>

/**
 * Projects the movement modes of the creature the character currently is.
 * A polymorphed character keeps its body fields for restoration, so map
 * movement must read the active monster form instead of those persisted fields.
 */
export function dnd5eEffectiveCharacterMovementProfile(
  character: Partial<Character> & Pick<
    Character,
    | 'charClass'
    | 'level'
    | 'dnd5eClassLevels'
    | 'speed'
    | 'equipment'
    | 'dnd5eInventory'
    | 'exhaustionLevel'
    | 'dnd5eCombatState'
    | 'dnd5eMovementSpeeds'
  >,
  projectedCombatState?: Dnd5eCharacterMovementStateProjection,
): Dnd5eCharacterMovementProfile {
  // During room synchronization the map token and character resource can be
  // observed one revision apart. The token carries the same Headless creature
  // form state, so accept it as a projection instead of briefly falling back
  // to the character's original body speeds on the player client.
  const effects = projectedCombatState?.activeEffects ??
    character.dnd5eCombatState?.activeEffects
  const creatureFormId = projectedCombatState?.wildShapeFormId ??
    character.dnd5eCombatState?.wildShapeFormId
  const creatureForm = creatureFormId
    ? getDnd5eSrdMonster(creatureFormId)
    : undefined
  const owner = dnd5eMovementBonusOwnerForCharacter(character)
  const baseWalk = creatureForm?.speed.walk ?? Math.max(0, dnd5eWalkingSpeed({ ...character, exhaustionLevel: 0 }, true) + dnd5eImportedWalkingSpeedBonus(owner))
  const movementSpeeds = creatureForm ? { ...creatureForm.speed } : { ...character.dnd5eMovementSpeeds, walk: baseWalk }
  const actor = createDnd5eCombatant({ ...owner,
    carriedWeightLb: dnd5eInventoryLoad(character as Character).totalWeightLb,
    carryingCapacityMultiplier: dnd5eRageFeatureCarryingCapacityMultiplier(character as Character),
    id: character.id ?? 'movement-preview', name: character.name ?? 'Movement', controller: 'player', initiative: 0,
    abilities: creatureForm?.abilities ?? character.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 1, maxHp: 1, temporaryHp: 0, exhaustionLevel: character.exhaustionLevel, speed: baseWalk, movementSpeeds,
    position: { x: 0, y: 0 }, concentrating: false, conditions: character.conditions ?? [],
    level: character.level, classId: dnd5eClassDefinition(character.charClass)?.id, classLevels: normalizeDnd5eClassLevels(character),
    classState: { ...character.dnd5eCombatState, ...projectedCombatState, activeEffects: effects },
    swimSpeedEqualsWalking: dnd5ePluginBooleanStaticModifierForCharacter(character as Character, 'swimSpeedEqualsWalking'),
  })
  return { walkSpeed: dnd5eEffectiveWalkSpeed(actor), climbSpeed: dnd5eEffectiveOptionalMovementSpeed(actor, 'climb'),
    swimSpeed: dnd5eEffectiveOptionalMovementSpeed(actor, 'swim'), flySpeed: dnd5eEffectiveFlySpeed(actor),
    maximumSpeed: dnd5eEffectiveMovementPoolSpeed(actor), hover: movementSpeeds.hover,
    canBreatheWater: dnd5ePluginBooleanStaticModifierForCharacter(character as Character, 'canBreatheWater') }

}
