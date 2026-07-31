import type { AbilityKey } from '../../lib/dnd'
import type { DeclarativeOpeningAttackMechanicV1 } from './declarativeSubclassAbility'
import type {
  Dnd5eCombatant,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { dnd5eCombatantClassLevel } from './headlessCombatPrimitives'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { dnd5eCombatantIsSurprised } from './surprise'

export interface Dnd5eOpeningAttackFeature {
  featureId: string
  mechanic: DeclarativeOpeningAttackMechanicV1
}

export interface Dnd5eOpeningAttackSavingThrowRequirement {
  featureId: string
  ability: AbilityKey
  dcAbility: AbilityKey
  dc: number
  failureDamageMultiplier: number
}

function actorOwnsRegisteredFeature(
  actor: Dnd5eCombatant,
  featureId: string,
): boolean {
  const feature = dnd5ePluginFeatureDefinition(featureId)
  if (!feature || feature.automation !== 'full') return false
  if (
    feature.sourceClassId &&
    dnd5eCombatantClassLevel(actor, feature.sourceClassId) <
      (feature.minimumLevel ?? feature.declarativeAbility?.level ?? 1)
  ) return false
  if (
    feature.sourceClassId &&
    feature.sourceSubclassId &&
    actor.subclassIds?.[feature.sourceClassId] !== feature.sourceSubclassId
  ) return false
  return true
}

export function dnd5eOpeningAttackFeatures(
  actor: Dnd5eCombatant,
): readonly Dnd5eOpeningAttackFeature[] {
  return actor.pluginFeatureIds.flatMap((featureId) => {
    if (!actorOwnsRegisteredFeature(actor, featureId)) return []
    const mechanic = dnd5ePluginFeatureDefinition(featureId)
      ?.declarativeAbility?.mechanic
    return mechanic?.kind === 'opening-attack'
      ? [{ featureId, mechanic }]
      : []
  })
}

export function dnd5eTargetHasTakenFirstTurn(
  state: Dnd5eHeadlessCombatState,
  target: Dnd5eCombatant,
): boolean {
  return state.round > 1 ||
    target.classState.turnStartResolvedTurnKey?.startsWith(
      `${state.combatId}:`,
    ) === true
}

export function dnd5eOpeningAttackHasAdvantage(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): boolean {
  return !dnd5eTargetHasTakenFirstTurn(state, target) &&
    dnd5eOpeningAttackFeatures(actor).some(
      ({ mechanic }) => mechanic.advantageBeforeTargetFirstTurn === true,
    )
}

export function dnd5eOpeningAttackIsAutomaticCritical(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): boolean {
  return dnd5eCombatantIsSurprised(target, state.combatId) &&
    dnd5eOpeningAttackFeatures(actor).some(
      ({ mechanic }) => mechanic.automaticCriticalAgainstSurprised === true,
    )
}

export function dnd5eOpeningAttackSavingThrowRequirement(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): Dnd5eOpeningAttackSavingThrowRequirement | undefined {
  if (!dnd5eCombatantIsSurprised(target, state.combatId)) return undefined
  return dnd5eOpeningAttackFeatures(actor)
    .flatMap(({ featureId, mechanic }) => {
      const savingThrow = mechanic.surprisedHitSavingThrow
      if (!savingThrow) return []
      return [{
        featureId,
        ...savingThrow,
        dc: 8 + actor.proficiencyBonus +
          Math.floor((actor.abilities[savingThrow.dcAbility] - 10) / 2),
      }]
    })
    .sort((left, right) =>
      right.failureDamageMultiplier - left.failureDamageMultiplier ||
      right.dc - left.dc ||
      left.featureId.localeCompare(right.featureId),
    )[0]
}
