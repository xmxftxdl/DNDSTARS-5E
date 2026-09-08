import type { SkillAoeTargeting } from '../../../lib/skillTargeting'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eDamageType } from '../damageTypes'
import type { DeclarativeSubclassAbilityV1 } from '../declarativeSubclassAbility'
import type {
  Dnd5ePersistentAreaTriggerDeclaration,
  Dnd5ePersistentAreaVisual,
} from '../persistentAreaTypes'
import type { Dnd5ePluginInterruptDeclaration } from './pluginHeadlessContracts'

export type Dnd5ePluginActionEconomy = 'action' | 'bonusAction' | 'reaction' | 'none'
export type Dnd5ePluginAutomationLevel = 'full' | 'partial' | 'manual'
export type Dnd5ePluginTargetRelation = 'any' | 'ally' | 'enemy'

export interface Dnd5ePluginFeatPrerequisite {
  minimumLevel?: number
  /** Every listed score is required (logical AND). */
  abilityScores?: Partial<Record<AbilityKey, number>>
  /** At least one listed score must meet its threshold (logical OR). */
  anyAbilityScores?: Partial<Record<AbilityKey, number>>
  /** Core race names/IDs or namespaced plugin race IDs. */
  raceIds?: readonly string[]
  /** Stable build-time capabilities; independent from currently equipped armor. */
  armorProficiencies?: readonly ('light' | 'medium' | 'heavy' | 'shield')[]
  /** The character must currently have at least one Host-recognized spell source. */
  spellcasting?: boolean
}

/** Legacy authoring declaration. Native content uses Activity area operations. */
export type Dnd5ePluginPersistentAreaVerticalDeclaration =
  | { mode: 'ground' }
  | { mode: 'volume'; heightFeet: number }

export function normalizeDnd5ePluginPersistentAreaVerticalDeclaration(
  value: unknown,
): Dnd5ePluginPersistentAreaVerticalDeclaration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const vertical = value as Record<string, unknown>
  const keys = Object.keys(vertical)
  if (vertical.mode === 'ground' && keys.length === 1 && keys[0] === 'mode') return { mode: 'ground' }
  if (
    vertical.mode === 'volume' &&
    keys.length === 2 &&
    keys.every((key) => key === 'mode' || key === 'heightFeet') &&
    typeof vertical.heightFeet === 'number' && Number.isInteger(vertical.heightFeet) &&
    vertical.heightFeet >= 1 && vertical.heightFeet <= 10_000
  ) return { mode: 'volume', heightFeet: vertical.heightFeet }
  return undefined
}

export type Dnd5ePluginTargeting =
  | { kind: 'self' }
  | {
      kind: 'single-creature'
      relation?: Dnd5ePluginTargetRelation
      rangeFeet?: number
      includeSelf?: boolean
    }
  | {
      kind: 'multiple-creatures'
      relation?: Dnd5ePluginTargetRelation
      rangeFeet?: number
      maximumTargets: number
      includeSelf?: boolean
    }
  | {
      kind: 'area'
      relation?: Dnd5ePluginTargetRelation
      includeSelf?: boolean
      maximumTargets?: number
      template: SkillAoeTargeting
    }

export interface Dnd5ePluginFeatureAction {
  id: string
  label: string
  description?: string
  economy: Dnd5ePluginActionEconomy
  targeting: Dnd5ePluginTargeting
  /** Host-authoritative turn-usage keys projected from Unified Activity requirements. */
  oncePerTurnKeys?: readonly string[]
  trigger?: DeclarativeSubclassAbilityV1['trigger']
  interrupt?: Dnd5ePluginInterruptDeclaration
  persistentArea?: {
    label: string
    color?: string
    durationRounds: number
    concentration?: boolean
    vertical?: Dnd5ePluginPersistentAreaVerticalDeclaration
    visual?: Dnd5ePersistentAreaVisual
    triggers?: readonly Dnd5ePersistentAreaTriggerDeclaration[]
  }
  summon?: {
    monsterId: `srd-5.1:${string}`
    label?: string
    durationRounds: number
    concentration?: boolean
    side?: 'ally' | 'enemy'
  }
}

export interface Dnd5ePluginStaticCombatModifiers {
  armorClassBonus?: number
  initiativeBonus?: number
  speedBonusFeet?: number
  savingThrowBonus?: number
  darkvisionRangeFeet?: number
  hitPointsPerLevelBonus?: number
  passivePerceptionBonus?: number
  passiveInvestigationBonus?: number
  minimumHitDieHealingConstitutionMultiplier?: number
  cannotBeSurprisedWhileConscious?: boolean
  unseenAttackersDoNotGainAdvantage?: boolean
  ignoreLongRangeRangedWeaponDisadvantage?: boolean
  ignoreNearbyHostileRangedAttackDisadvantage?: boolean
  /** Allows every attack granted by one Attack action to ignore the loading cap. */
  ignoreLoadingWeaponProperty?: boolean
  /** Allows two-weapon fighting with equipped one-handed melee weapons that are not light. */
  allowNonLightTwoWeaponFighting?: boolean
  ignoreRangedWeaponCoverBonus?: boolean
  mediumArmorDexterityCapBonus?: number
  ignoreMediumArmorStealthDisadvantage?: boolean
  dualWieldMeleeArmorClassBonus?: number
  /** Grants melee attack advantage while riding a larger mount against an unmounted target. */
  mountedMeleeAdvantageAgainstSmallerUnmounted?: boolean
  /** While riding, may replace an attack's mounted-creature target with the rider. */
  redirectMountedCreatureAttacksToRider?: boolean
  /** While riding, the mount takes no damage on a successful Dexterity save and half on failure. */
  grantMountedCreatureDexterityEvasion?: boolean
  preventOpportunityAttacksFromMeleeAttackTargets?: boolean
  /** Disengage does not suppress opportunity attacks made by this creature. */
  opportunityAttacksIgnoreDisengage?: boolean
  /** A qualifying opportunity-attack hit reduces the mover's remaining movement to zero. */
  opportunityAttackHitStopsMovement?: boolean
  /** Stable weapon catalog ids that may make an opportunity attack when a hostile enters reach. */
  opportunityAttacksOnEnterReachWeaponIds?: readonly string[]
  /** Difficult terrain contributes no extra movement cost during a Host-recorded Dash. */
  ignoreDifficultTerrainWhileDashing?: boolean
  /** Ordinary climbing multiplies movement by this amount when no climb speed applies. */
  climbWithoutSpeedCostMultiplier?: number
  /** Feet that must be moved on foot immediately before a running jump. Lower compatible values win. */
  runningJumpMinimumApproachFeet?: number
  /** Fixed movement cost for standing from prone; lower compatible values win. */
  standFromProneMovementCostFeet?: number
  spellAttackRangeMultiplier?: number
  ignoreSpellAttackCoverBonus?: boolean
  /** Advantage on saves against spells cast by a source no farther than this distance. */
  spellSavingThrowAdvantageWithinFeet?: number
  /** Damage dealt by this creature imposes disadvantage on the resulting concentration save. */
  imposeConcentrationCheckDisadvantageOnDamage?: boolean
  /** May replace one melee weapon damage roll group per turn after comparing both groups. */
  meleeWeaponDamageRerollOncePerTurn?: boolean
  /** Add the wielded shield's AC bonus to a Dexterity save against a sole-target effect. */
  shieldDexteritySaveBonusWhenSoleTarget?: boolean
  /** May spend a reaction after a successful Dexterity save to negate its half damage. */
  shieldSuccessfulDexteritySaveNegatesDamage?: boolean
  /** Fixed superiority-style die for cross-content maneuver grants. */
  combatManeuverDieSidesOverride?: 4 | 6 | 8 | 10 | 12
  opportunityAttackSpellReplacement?: boolean
  /** Somatic components may be performed while both hands are occupied. */
  ignoreOccupiedHandsForSomaticComponents?: boolean
  /** A missed ranged weapon attack made while hidden does not reveal the attacker. */
  retainHiddenOnRangedWeaponMiss?: boolean
  damageResistances?: readonly Dnd5eDamageType[]
  damageImmunities?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly string[]
}
