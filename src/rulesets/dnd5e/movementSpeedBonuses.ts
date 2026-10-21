import type { Dnd5eCombatant } from './headlessCombatEngine'
import { effectiveDnd5eActiveEffects } from './activeEffects'
import type { Character } from '../../types/character'
import type { Dnd5eCarriedLoadOwner } from './carryingCapacity'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeatureDefinition, dnd5ePluginRaceDefinition, runtimeDnd5ePluginFeatures as registeredDnd5ePluginFeatures } from './plugins/pluginContentCatalog'

export type Dnd5eMovementMode = 'walk' | 'climb' | 'swim' | 'fly'
export type Dnd5eMovementBonusOwner = Partial<Pick<Dnd5eCombatant, 'pluginFeatureIds' | 'raceId' | 'race' | 'classState' | 'exhaustionLevel'>> & Dnd5eCarriedLoadOwner

export function dnd5eMovementExhaustionMultiplier(owner: { exhaustionLevel?: number }): number {
  return (owner.exhaustionLevel ?? 0) >= 5 ? 0 : (owner.exhaustionLevel ?? 0) >= 2 ? 0.5 : 1
}

/** Legacy permanent speed modifiers are part of the walking baseline. */
export function dnd5eImportedWalkingSpeedBonus(owner: Dnd5eMovementBonusOwner): number {
  const race = dnd5ePluginRaceDefinition(owner.raceId ?? owner.race ?? '')
  return (race?.staticModifiers?.speedBonusFeet ?? 0) + [...new Set(owner.pluginFeatureIds ?? [])].reduce(
    (total, id) => total + (dnd5ePluginFeatureDefinition(id)?.staticModifiers?.speedBonusFeet ?? 0), 0)
}

export function dnd5eExistingCharacterMovementSpeedBonus(character: Partial<Character>, mode: Dnd5eMovementMode): number {
  return dnd5eExistingMovementSpeedBonus(dnd5eMovementBonusOwnerForCharacter(character), mode)
}

export function dnd5eMovementBonusOwnerForCharacter(character: Partial<Character>): Dnd5eMovementBonusOwner {
  return { raceId: character.dnd5eRaceId, race: character.race,
    classState: character.dnd5eCombatState,
    pluginFeatureIds: registeredDnd5ePluginFeatures().filter(feature =>
      dnd5eCharacterHasPluginFeature(character as Character, feature.id)).map(feature => feature.id),
  }
}

/** Pure data lookup; complete stat-block replacement suppresses retained class capabilities. */
export function dnd5eExistingMovementSpeedBonus(owner: Dnd5eMovementBonusOwner, mode: Dnd5eMovementMode): number {
  if (['polymorph', 'true-polymorph'].includes(owner.classState?.wildShapeMode ?? '')) return 0
  const race = dnd5ePluginRaceDefinition(owner.raceId ?? owner.race ?? '')
  let bonus = race?.staticModifiers?.existingMovementSpeedBonuses?.[mode] ?? 0
  for (const id of new Set(owner.pluginFeatureIds ?? [])) {
    const feature = dnd5ePluginFeatureDefinition(id)
    if (!feature || feature.automation === 'manual') continue
    bonus += feature.staticModifiers?.existingMovementSpeedBonuses?.[mode] ?? 0
  }
  if (mode === 'walk') bonus += effectiveDnd5eActiveEffects(owner.classState?.activeEffects).reduce((sum, effect) => sum + (effect.modifiers?.walkingSpeedBonusFeet ?? 0), 0)
  return bonus
}

/** A permanent granted swim speed is a floor, not an additive bonus. */
export function dnd5eImportedSwimSpeed(owner: Dnd5eMovementBonusOwner): number {
  if (['polymorph', 'true-polymorph'].includes(owner.classState?.wildShapeMode ?? '')) return 0
  let speed = dnd5ePluginRaceDefinition(owner.raceId ?? owner.race ?? '')?.staticModifiers?.swimSpeedMinimumFeet ?? 0
  for (const id of new Set(owner.pluginFeatureIds ?? [])) {
    const feature = dnd5ePluginFeatureDefinition(id)
    if (feature && feature.automation !== 'manual') speed = Math.max(speed, feature.staticModifiers?.swimSpeedMinimumFeet ?? 0)
  }
  return speed
}
