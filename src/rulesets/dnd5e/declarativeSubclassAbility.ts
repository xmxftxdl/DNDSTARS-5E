import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eClassId } from './classes'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import type { Dnd5eSpellbookSchoolId, Dnd5eSpellcastingClassId } from './spellbook'
import type { Dnd5eEffectDefinitionV1, Dnd5ePredicateV1 } from './activities/dnd5eEffectContracts'
import { validateDnd5eActivityPredicateV1, validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'
import { validateDeclarativeClassDefinitionV1 } from './declarativeClass'
import {
  validateDnd5eAdvancementCollectionV1,
  type Dnd5eAdvancementDefinitionV1,
} from './activities/dnd5eAdvancementContracts'

export const DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION = 1 as const
export const DND5E_DECLARATIVE_PACKAGE_FORMAT = 'dndstars5e-declarative' as const

export type DeclarativeSubclassTriggerV1 =
  | { kind: 'active-use' }
  | { kind: 'before-attack-roll' }
  | { kind: 'after-attack-roll' }
  | { kind: 'after-attack-hit' }
  | { kind: 'after-attack-miss' }
  | { kind: 'after-d20-roll' }
  | { kind: 'before-spell-effect' }
  | { kind: 'before-damage-taken' }
  | { kind: 'after-damage-taken' }
  | { kind: 'after-spell-cast' }
  | { kind: 'after-condition-attempted' }
  | { kind: 'after-condition-applied' }
  | { kind: 'before-drop-to-zero' }
  | { kind: 'turn-start' }
  | { kind: 'turn-end' }
  | { kind: 'short-rest-complete' }
  | { kind: 'long-rest-complete' }

export type DeclarativeValueFormulaV1 =
  | { kind: 'fixed'; value: number }
  | { kind: 'proficiency-bonus'; multiplier?: number; minimum?: number }
  | { kind: 'ability-modifier'; ability: AbilityKey; multiplier?: number; minimum?: number }
  | { kind: 'class-level'; classId: Dnd5eClassId; divisor?: number; multiplier?: number; minimum?: number }

export interface DeclarativeDiceFormulaV1 {
  count: number
  sides: number
  modifier?: DeclarativeValueFormulaV1
  scaling?: {
    basis: 'character-level' | 'class-level'
    classId?: Dnd5eClassId
    steps: readonly { level: number; addDice: number }[]
  }
}

export interface DeclarativeHostRollRecipeV1 {
  timing: 'on-trigger'
  die: {
    kind: 'resource-die'
    resourceId: string
  }
  /** Damage dice may be doubled when the parent weapon attack is critical. */
  critical?: 'normal' | 'double-dice'
}

export interface DeclarativeSubclassPredicatesV1 {
  minimumLevel?: number
  classId?: Dnd5eClassId
  subclassId?: string
  equipmentIds?: readonly string[]
  minimumDistanceFeet?: number
  maximumDistanceFeet?: number
  targetRelation?: 'self' | 'ally' | 'enemy' | 'any'
  actorHasConditions?: readonly Dnd5eStandardConditionId[]
  actorLacksConditions?: readonly Dnd5eStandardConditionId[]
  targetHasConditions?: readonly Dnd5eStandardConditionId[]
  targetLacksConditions?: readonly Dnd5eStandardConditionId[]
  /** Authoritative map illumination at the acting creature's token. */
  actorIllumination?: readonly ('bright' | 'dim' | 'darkness' | 'magical-darkness')[]
  /** Authoritative map illumination at the selected target's token. */
  targetIllumination?: readonly ('bright' | 'dim' | 'darkness' | 'magical-darkness')[]
  /** Restricts a triggered ability to the authoritative parent damage type. */
  parentDamageTypes?: readonly Dnd5eDamageType[]
  /** Restricts an after-spell trigger to Host-derived spell metadata. */
  parentSpellSchools?: readonly Dnd5eSpellbookSchoolId[]
  minimumParentSpellLevel?: number
  maximumParentSpellLevel?: number
  /** Tiny=0 through Gargantuan=5. */
  targetMaximumSizeRank?: number
  /** Closed creature-type aliases accepted for the selected target. */
  targetCreatureTypes?: readonly string[]
  resources?: readonly DeclarativeSubclassResourceRequirementV1[]
  /** Requires a persisted option from this subclass's choice group. */
  subclassChoices?: readonly { groupId: string; optionId: string }[]
  oncePerTurn?: boolean
}

export interface DeclarativeSubclassCostV1 {
  economy?: 'action' | 'bonusAction' | 'reaction' | 'none'
  movementFeet?: number
  resources?: readonly DeclarativeSubclassResourceCostV1[]
  uses?: number
}

/**
 * Declarative packages normally own their resources. `core` is an explicit,
 * closed escape hatch for a Host-defined class resource already present on the
 * authoritative combatant snapshot; it never creates or aliases a resource.
 */
export interface DeclarativeSubclassResourceRequirementV1 {
  resourceId: string
  minimum: number
  scope?: 'plugin' | 'core'
}

export interface DeclarativeSubclassResourceCostV1 {
  resourceId: string
  amount: number
  scope?: 'plugin' | 'core'
}

export type DeclarativeSubclassTargetingV1 =
  | { kind: 'self' }
  | {
      kind: 'single-creature'
      relation?: 'ally' | 'enemy' | 'any'
      rangeFeet?: number
      includeSelf?: boolean
      requiresSight?: boolean
    }
  | {
      kind: 'multiple-creatures'
      relation?: 'ally' | 'enemy' | 'any'
      rangeFeet?: number
      maximumTargets: number
      includeSelf?: boolean
    }
  | {
      kind: 'area'
      relation?: 'ally' | 'enemy' | 'any'
      includeSelf?: boolean
      maximumTargets?: number
      shape: 'circle' | 'cone' | 'line' | 'rect'
      rangeFeet: number
      radiusFeet?: number
      lengthFeet?: number
      widthFeet?: number
      heightFeet?: number
    }

export type DeclarativeSubclassRollV1 =
  | { id: string; kind: 'damage'; label: string; dice: DeclarativeDiceFormulaV1; damageType: Dnd5eDamageType | 'parent-weapon'; hostRoll?: DeclarativeHostRollRecipeV1 }
  | { id: string; kind: 'healing'; label: string; dice: DeclarativeDiceFormulaV1; hostRoll?: DeclarativeHostRollRecipeV1 }
  | { id: string; kind: 'attack'; label: string; ability: AbilityKey; proficiency: boolean }
  | {
      id: string
      kind: 'saving-throw'
      label: string
      ability: AbilityKey
      /** The target chooses the most favorable saving throw ability from this set. */
      abilityOptions?: readonly AbilityKey[]
      dc: DeclarativeValueFormulaV1
      onSuccess?: 'none' | 'half'
      rollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      rollModeByCreatureType?: {
        creatureTypes: readonly string[]
        mode: 'advantage' | 'disadvantage'
      }
    }

export type DeclarativeEffectTargetV1 = 'actor' | 'target' | 'all-targets'
export type DeclarativeEffectWhenV1 = 'always' | 'save-failure' | 'save-success'

export interface DeclarativeActivityChoiceV1 {
  id: string
  label: string
  options: readonly { id: string; label: string; description?: string; requirements?: readonly Dnd5ePredicateV1[] }[]
  defaultOptionId?: string
}

export type DeclarativeSubclassEffectV1 = (
  | { kind: 'damage'; target: DeclarativeEffectTargetV1; rollId: string }
  | { kind: 'healing'; target: DeclarativeEffectTargetV1; rollId: string }
  | {
      kind: 'temporary-hit-points'
      target: DeclarativeEffectTargetV1
      /** Exactly one of amount or rollId is required. */
      amount?: DeclarativeValueFormulaV1
      rollId?: string
    }
  | {
      kind: 'standard-condition'
      target: DeclarativeEffectTargetV1
      condition: Dnd5eStandardConditionId
      duration: DeclarativeSubclassDurationV1
    }
  | {
      /** References a shared Activity Effect definition declared by this ability. */
      kind: 'activity-effect'
      target: DeclarativeEffectTargetV1
      effectId: string
    }
  | {
      kind: 'move'
      target: DeclarativeEffectTargetV1
      distanceFeet: number
      mode?: 'push' | 'pull' | 'teleport' | 'swap'
      originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      requiresLineOfSight?: boolean
      ignoresOpportunityAttacks?: boolean
    }
  | {
      kind: 'dispel-area'
      target: 'actor'
      areaKind: 'magical-darkness'
      radiusFeet: number
      maximumSpellLevel: DeclarativeValueFormulaV1
    }
  | {
      /** Issues one Host-owned command to a living persistent companion owned by the actor. */
      kind: 'command-owned-companion'
      target: 'target'
      command: 'attack' | 'dash' | 'disengage' | 'dodge' | 'help'
    }
  | {
      kind: 'spend-resource' | 'restore-resource'
      resourceId: string
      amount: DeclarativeValueFormulaV1
      /** Core resources are closed Host-owned ids such as dnd5e-spell-slot-1. */
      scope?: 'plugin' | 'core'
      /** Restore only when the resource is currently empty. */
      whenEmpty?: boolean
    }
) & {
  when?: DeclarativeEffectWhenV1
  whenChoice?: { choiceId: string; optionId: string }
}

export interface DeclarativeSubclassLimitsV1 {
  oncePerTurn?: boolean
  reset?: 'combat' | 'short-rest' | 'long-rest' | 'none'
  uses?: DeclarativeValueFormulaV1
}

export type DeclarativeSubclassDurationV1 =
  | { kind: 'instantaneous' }
  | { kind: 'until-source-turn-start' }
  | { kind: 'until-source-turn-end' }
  | { kind: 'until-target-turn-start' }
  | { kind: 'until-target-turn-end'; rounds?: number }
  | { kind: 'fixed-rounds'; rounds: number; repeatSave?: { ability: AbilityKey; abilityOptions?: readonly AbilityKey[]; dc: number | DeclarativeValueFormulaV1 } }
  | { kind: 'concentration'; rounds: number }
  | { kind: 'permanent' }

export const DND5E_COMBAT_MANEUVER_OPERATIONS = [
  'ally-reaction-attack',
  'drop-held-item',
  'next-ally-advantage',
  'movement-defense',
  'next-attack-advantage',
  'target-attack-disadvantage',
  'extended-reach',
  'ally-reposition',
  'frighten-on-hit',
  'reaction-damage-reduction',
  'attack-roll-bonus',
  'push-on-hit',
  'temporary-hit-points',
  'reaction-counterattack',
  'secondary-target-damage',
  'prone-on-hit',
] as const

export type Dnd5eCombatManeuverOperation =
  typeof DND5E_COMBAT_MANEUVER_OPERATIONS[number]

/** A closed, content-neutral Host operation selected by imported data. */
export interface DeclarativeCombatManeuverMechanicV1 {
  kind: 'combat-maneuver'
  operation: Dnd5eCombatManeuverOperation
  resourceId: string
  superiorityRollId: string
}

export const DND5E_MARTIAL_SPELL_SYNERGY_OPERATIONS = [
  'linked-equipment',
  'cantrip-then-bonus-attack',
  'weapon-hit-save-pressure',
  'extra-action-teleport',
  'spell-then-bonus-attack',
] as const

export type Dnd5eMartialSpellSynergyOperation =
  typeof DND5E_MARTIAL_SPELL_SYNERGY_OPERATIONS[number]

/** Closed content-neutral martial/spell interoperability operations. */
export interface DeclarativeMartialSpellSynergyMechanicV1 {
  kind: 'martial-spell-synergy'
  operation: Dnd5eMartialSpellSynergyOperation
  linkedEquipmentLimit?: number
  recallEconomy?: 'bonusAction'
  teleportRangeFeet?: number
}

export const DND5E_RAGE_FEATURE_OPERATIONS = [
  'exploration-rituals',
  'broad-rage-resistance',
  'rage-mobile-defense',
  'ally-melee-advantage-aura',
  'object-strength-and-carrying',
  'long-range-vision',
  'travel-tracking',
  'nature-communion-ritual',
  'ally-protection-aura',
  'turn-flight',
  'bonus-prone-on-hit',
] as const

export type Dnd5eRageFeatureOperation =
  typeof DND5E_RAGE_FEATURE_OPERATIONS[number]

/** Closed content-neutral rage operations selected by imported data. */
export interface DeclarativeRageFeatureMechanicV1 {
  kind: 'rage-feature'
  operation: Dnd5eRageFeatureOperation
  radiusFeet?: number
  excludedDamageTypes?: readonly Dnd5eDamageType[]
  requiresNoHeavyArmor?: boolean
  speedMultiplier?: number
  carryingCapacityMultiplier?: number
  maximumTargetSizeRank?: number
}

/**
 * Generic opening-attack semantics. Local data may combine the independent
 * clauses, while the Host remains authoritative for turn order, surprise,
 * saving throws and damage settlement.
 */
export interface DeclarativeOpeningAttackMechanicV1 {
  kind: 'opening-attack'
  advantageBeforeTargetFirstTurn?: boolean
  automaticCriticalAgainstSurprised?: boolean
  surprisedHitSavingThrow?: {
    ability: AbilityKey
    dcAbility: AbilityKey
    failureDamageMultiplier: number
  }
}

/**
 * Generic passive spell pressure applied when a registered feature owner
 * starts a spell cast while hidden. The Host remains authoritative for the
 * hidden snapshot and every saving-throw mode in that cast transaction.
 */
export interface DeclarativeHiddenSpellSaveDisadvantageMechanicV1 {
  kind: 'hidden-spell-save-disadvantage'
}

/**
 * Generic control override for a movable, non-creature spell projection.
 * Imported data identifies the projection and an audited action economy;
 * position and movement remain Host-owned map state.
 */
export interface DeclarativeUtilityProjectionControlMechanicV1 {
  kind: 'utility-projection-control'
  projectionId: string
  economy: 'action' | 'bonusAction'
}

/**
 * Generic current-turn attack pressure against a creature near an owned
 * utility projection. Projection-to-creature distance is captured by the Host.
 */
export interface DeclarativeUtilityProjectionAttackAdvantageMechanicV1 {
  kind: 'utility-projection-attack-advantage'
  projectionId: string
  maximumDistanceFeet: number
}

export type DeclarativeNextD20RollKindV1 =
  | 'attack'
  | 'ability-check'
  | 'saving-throw'

/**
 * Generic player-prearmed advantage for exactly one later d20 roll. The Host
 * owns the pending marker and consumes it after the first eligible resolution.
 */
export interface DeclarativeNextD20AdvantageMechanicV1 {
  kind: 'next-d20-advantage'
  rollKinds: readonly DeclarativeNextD20RollKindV1[]
}

/**
 * Generic post-result adjustment. The submitted direction is a player choice,
 * while the die is rolled by the Host and the reaction/resource cost is spent
 * in the same Headless transaction as the affected d20 resolution.
 */
export interface DeclarativePostD20AdjustmentMechanicV1 {
  kind: 'post-d20-adjustment'
  rollKinds: readonly DeclarativeNextD20RollKindV1[]
  /** Exactly one amount source is required. */
  dieSides?: number
  fixedAmount?: number
  fixedAmountReference?: 'source-proficiency-bonus'
  directions: readonly ('add' | 'subtract')[]
  scope?: 'any' | 'attack-against-self'
  attackModes?: readonly ('melee' | 'ranged')[]
  sourceHeldWeapon?: {
    properties?: readonly string[]
    proficient?: boolean
  }
}

export type DeclarativeD20ChoiceRerollScopeV1 =
  | 'self-roll'
  | 'attack-against-self'

/**
 * Generic Lucky-style decision window. The imported package only declares
 * eligibility. The Host rolls the additional d20, validates ownership and
 * resources, and waits for the owning player to use or decline the feature.
 */
export interface DeclarativeD20ChoiceRerollMechanicV1 {
  kind: 'd20-choice-reroll'
  rollKinds: readonly DeclarativeNextD20RollKindV1[]
  scopes: readonly DeclarativeD20ChoiceRerollScopeV1[]
  additionalDice: 1 | 2
  selection: 'owner-chooses' | 'highest' | 'lowest' | 'must-use-latest'
}

export interface DeclarativePostSpellRandomTableOutcomeV1 {
  id: string
  minimum: number
  maximum: number
  effect?: {
    kind: 'self-centered-core-spell'
    spellId: string
    slotLevel: number
  }
}

/**
 * Generic Host-owned random table requested after a qualifying class spell.
 * Local data may map ranges to audited core-spell effects but never supplies
 * executable code. Unmapped ranges remain explicit DM adjudication.
 */
export interface DeclarativePostSpellRandomTableMechanicV1 {
  kind: 'post-spell-random-table'
  spellcastingClassId: Dnd5eClassId
  minimumSpellLevel: number
  triggerDieSides: number
  triggerValues: readonly number[]
  tableDieSides: number
  outcomes: readonly DeclarativePostSpellRandomTableOutcomeV1[]
  forceTableWhenUsesEmptyAbilityId?: string
  restoreUsesAbilityIdOnTable?: string
}

/**
 * Passive modifier for another declarative random-table ability in the same
 * subclass. The Host rolls every candidate and the owning player chooses one;
 * imported data never supplies dice or executable selection code.
 */
export interface DeclarativePostSpellRandomTableChoiceMechanicV1 {
  kind: 'post-spell-random-table-choice'
  tableAbilityId: string
  rollCount: number
}

/**
 * Generic passive spell-damage rider. After a qualifying class spell rolls at
 * least one maximum-valued damage die, the Host may roll the declared number
 * of extra dice with the selected die's sides and bind them to that damage
 * group. The authoritative cast transaction validates both the maximum die
 * and the once-per-turn ledger before applying the bonus.
 */
export interface DeclarativeSpellDamageMaxDieBonusMechanicV1 {
  kind: 'spell-damage-max-die-bonus'
  spellcastingClassId: Dnd5eClassId
  additionalDice: number
}

/** Host-owned, map-persisted companion selected from a closed package list. */
export interface DeclarativePersistentCompanionMechanicV1 {
  kind: 'persistent-companion'
  choiceGroupId: string
  companions: readonly { optionId: string; monsterId: string }[]
  /**
   * Content-neutral combat projection applied to the Host-owned companion
   * token when it is created.  Every number is derived from the owner by the
   * Host; imported packages cannot submit final combat totals.
   */
  combatProfile?: {
    minimumMaximumHitPoints?: DeclarativeValueFormulaV1
    armorClassBonus?: DeclarativeValueFormulaV1
    weaponAttackBonus?: DeclarativeValueFormulaV1
    weaponDamageBonus?: DeclarativeValueFormulaV1
    savingThrowBonus?: DeclarativeValueFormulaV1
    proficientSkillCheckBonus?: DeclarativeValueFormulaV1
    weaponAttacksMagical?: boolean
    attacksPerAction?: number
    advancements?: readonly {
      classId: Dnd5eClassId
      minimumLevel: number
      weaponAttacksMagical?: boolean
      attacksPerAction?: number
      shareSelfSpellsRangeFeet?: number
    }[]
  }
}

/** Passive upgrades applied to every living persistent companion owned by the feature owner. */
export interface DeclarativeCompanionProfileUpgradeMechanicV1 {
  kind: 'companion-profile-upgrade'
  weaponAttacksMagical?: boolean
  attacksPerAction?: number
  shareSelfSpellsRangeFeet?: number
}

/** Lets the Host pathfinder traverse, but never stop in, qualifying creature spaces. */
export interface DeclarativeCreatureSpaceTraversalMechanicV1 {
  kind: 'creature-space-traversal'
  /** The occupied creature must be at least this many size ranks larger. */
  minimumLargerSizeRanks: number
}

/** Passive movement mode enabled only by an authoritative map environment tag. */
export interface DeclarativeEnvironmentalMovementMechanicV1 {
  kind: 'environmental-movement'
  environments: readonly ('normal' | 'outdoors' | 'indoors' | 'underground' | 'underwater')[]
  mode: 'fly' | 'swim' | 'climb'
  speed: 'walking' | number
}

/** Creates a movable Host-owned map projection through the shared Activity area pipeline. */
export interface DeclarativePersistentProjectionMechanicV1 {
  kind: 'persistent-projection'
  projectionId: string
  label: string
  /** Number of independently movable projection instances created by one activation. */
  instanceCount?: number
  placementRangeFeet: number
  durationRounds: number
  concentration: boolean
  color?: string
  movement?: {
    economy: 'action' | 'bonus-action'
    maximumFeet: number
    maximumDistanceFromSourceFeet?: number
  }
  /** Allows qualifying spells to use a projection as their authoritative origin. */
  spellOrigin?: boolean
  /** Grants attack advantage only while both actor and projection are within this distance. */
  attackAdvantageWithinFeet?: number
}

/** Passive upgrade for an existing projection Activity owned by the same character. */
export interface DeclarativePersistentProjectionUpgradeMechanicV1 {
  kind: 'persistent-projection-upgrade'
  projectionId: string
  instanceCount: number
}

/**
 * Authorizes a closed list of existing Host spells to be cast with a class or
 * plugin resource instead of spell slots. The declaration never carries a
 * spell resolver: range, targets, dice, concentration and effects still come
 * from the authoritative spell catalogue.
 */
export interface DeclarativeAlternateResourceSpellcastingMechanicV1 {
  kind: 'alternate-resource-spellcasting'
  classId: Dnd5eClassId
  ability: AbilityKey
  resourceId: string
  resourceScope?: 'core' | 'plugin'
  ignoreMaterialComponents?: boolean
  grants: readonly {
    id: string
    spellId: string
    minimumLevel?: number
    castAtLevel: number
    resourceCost: number
    selection?: { groupId: string; optionId: string }
    upcast?: {
      resourcePerSlotLevel: number
      maximumResourceCostByClassLevel: readonly { level: number; maximumResourceCost: number }[]
    }
  }[]
}

/**
 * Extends a Host-owned granted die after it has been placed on another
 * creature.  The declaration changes only the closed ways that holder may
 * spend that die; die size, source ownership, reaction economy and one-shot
 * consumption all remain authoritative combat state.
 */
export interface DeclarativeGrantedDieCombatOptionsMechanicV1 {
  kind: 'granted-die-combat-options'
  dieState: 'bardic-inspiration'
  addToWeaponDamage?: boolean
  addToArmorClassAgainstAttack?: boolean
}

/** Pre-roll reaction that imposes disadvantage on one incoming attack. */
export interface DeclarativeAttackDisadvantageInterruptMechanicV1 {
  kind: 'attack-disadvantage-interrupt'
  protects: 'self' | 'ally-or-self'
  /** Defaults to disadvantage for backward compatibility. */
  outcome?: 'disadvantage' | 'automatic-miss'
  /** Optional one-shot follow-up used by effects such as an entropic ward. */
  onMiss?: 'next-attack-advantage-against-attacker'
}

/**
 * Pre-roll reaction that makes the attacker save before the Host chooses the
 * authoritative target.  This is intentionally a closed retarget policy:
 * packages cannot provide callbacks or name an arbitrary replacement target.
 */
export interface DeclarativeAttackRetargetInterruptMechanicV1 {
  kind: 'attack-retarget-interrupt'
  protects: 'self'
  saveAbility: AbilityKey
  dcAbility: AbilityKey
  alternativeTarget: 'nearest-other-creature'
  immunityCondition?: 'charmed'
  successfulSaveImmunity: 'long-rest'
}

/** Reaction-time mitigation settled inside the same authoritative damage transaction. */
export interface DeclarativeDamageMitigationInterruptMechanicV1 {
  kind: 'damage-mitigation-interrupt'
  mode: 'resistance' | 'ward-pool'
  protects: 'self' | 'ally-or-self'
  /** Required by resistance mode and forbidden by ward-pool mode. */
  damageTypes?: readonly Dnd5eDamageType[]
  /** Local ability id of the ward-pool mechanic used by ward-pool mode. */
  poolAbilityId?: string
}

/** Persistent, Host-owned hit-point pool created and repaired by qualifying spell casts. */
export interface DeclarativeWardPoolMechanicV1 {
  kind: 'ward-pool'
  spellcastingClassId: Dnd5eClassId
  ability: AbilityKey
  school: Dnd5eSpellbookSchoolId
  minimumSpellLevel: number
  classLevelMultiplier: number
  restorePerSpellLevel: number
}

/** Map-derived passive aura that grants resistance only to spell damage. */
export interface DeclarativeSpellDamageResistanceAuraMechanicV1 {
  kind: 'spell-damage-resistance-aura'
  radiusFeet: number
  expandedRadius?: { level: number; radiusFeet: number }
}

/** Host-generated d20 results persisted at long-rest completion and consumed once. */
export interface DeclarativeStoredD20ReplacementMechanicV1 {
  kind: 'stored-d20-replacement'
  count: number
  countByClassLevel?: readonly { level: number; count: number }[]
}

/** Passive replacement for the number of attacks granted by one Attack action. */
export interface DeclarativeAttacksPerActionMechanicV1 {
  kind: 'attacks-per-action'
  attacks: number
}

/** Automatic, Host-rolled weapon damage rider bound to an existing damage roll. */
export interface DeclarativeWeaponDamageRiderMechanicV1 {
  kind: 'weapon-damage-rider'
  rollId: string
}

/** Adds one ability modifier to a qualifying class spell damage roll. */
export interface DeclarativeSpellDamageAbilityModifierMechanicV1 {
  kind: 'spell-damage-ability-modifier'
  spellcastingClassId: Dnd5eClassId
  ability: AbilityKey
  maximumSpellLevel: number
}

/** Adds the actor's Host-derived proficiency bonus to checks made for selected spells. */
export interface DeclarativeSpellAbilityCheckBonusMechanicV1 {
  kind: 'spell-ability-check-bonus'
  spellIds: readonly string[]
  bonus: 'proficiency'
}

/** Closed reaction protocol for a structured Host spell affecting the reactor. */
export interface DeclarativeSpellInterceptionMechanicV1 {
  kind: 'spell-interception'
  spellcastingClassId: Dnd5eClassId
  saveAbility: AbilityKey
  dcAbility: AbilityKey
  minimumSpellLevel: number
  maximumSpellLevel: 'actor-maximum-slot'
  negateForSelf: boolean
  grantTemporarySpellAccess: boolean
  prohibitSourceCasting: boolean
  durationRounds: number
}

/** Adds bounded creature targets to an otherwise single-target class spell. */
export interface DeclarativeSpellTargetExpansionMechanicV1 {
  kind: 'spell-target-expansion'
  spellcastingClassId: Dnd5eClassId
  spellSchools: readonly Dnd5eSpellbookSchoolId[]
  baseMaximumTargets: 1
  additionalTargets: number
}

/**
 * Optional pre-roll replacement for qualifying damage dice. The Host derives
 * the actual damage delivery and type, validates the declared feature and
 * spends its Activity resources in the same transaction.
 */
export interface DeclarativeDamageRollMaximizationMechanicV1 {
  kind: 'damage-roll-maximization'
  damageTypes: readonly Dnd5eDamageType[]
  deliveries: readonly ('weapon-attack' | 'spell' | 'feature')[]
}

/**
 * Player-declared attack option selected before the Host rolls the attack.
 * This deliberately models the reusable transaction instead of naming a feat:
 * Workshop content may bind the same trade-off to any eligible weapon profile.
 */
export interface DeclarativeAttackTradeoffMechanicV1 {
  kind: 'attack-tradeoff'
  attackRollModifier: number
  damageBonus: number
  attackModes: readonly ('melee' | 'ranged')[]
  requiredWeaponProperties?: readonly string[]
}

/** Closed passive defense predicates compiled into the combatant snapshot. */
export interface DeclarativePassiveDefenseMechanicV1 {
  kind: 'passive-defense'
  damageResistance?: {
    damageTypes: readonly Dnd5eDamageType[]
    delivery?: 'weapon-attack' | 'spell' | 'other'
    magical?: boolean
  }
  savingThrowAdvantageAgainstSpells?: boolean
  concentrationCheckAdvantage?: boolean
  hitPointMaximumReductionImmunity?: boolean
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  damageReflection?: {
    damageTypes: readonly Dnd5eDamageType[]
    multiplier: number
  }
  concentrationCheckImmunity?: {
    spellSchools: readonly Dnd5eSpellbookSchoolId[]
  }
  /** Converts weapon/natural attacks to magical attacks under a Host-owned state predicate. */
  weaponAttacksMagical?: {
    while: 'always' | 'transformed'
  }
}

/** Host-issued reaction window that permits exactly one melee weapon attack. */
export interface DeclarativeReactionWeaponAttackMechanicV1 {
  kind: 'reaction-weapon-attack'
  event: 'other-creature-hit' | 'marked-target-attacks' | 'enemy-attacks-other' | 'nearby-creature-casts-spell'
  markAbilityId?: string
}

/** Active target mark used by attack advantage and marked-target reactions. */
export interface DeclarativeMarkedTargetMechanicV1 {
  kind: 'marked-target'
  attackAdvantage: boolean
}

/** Passive replacement for an otherwise valid drop to zero hit points. */
export interface DeclarativeDeathPreventionMechanicV1 {
  kind: 'death-prevention'
  hitPointsAfter: number
  preventsMassiveDamage?: boolean
}

/** Automatic healing after this actor defeats a valid creature with a leveled spell. */
export interface DeclarativeSpellDefeatHealingMechanicV1 {
  kind: 'spell-defeat-healing'
  minimumSpellLevel: number
  baseMultiplier: number
  schoolMultipliers?: Partial<Record<Dnd5eSpellbookSchoolId, number>>
  excludedCreatureTypes?: readonly string[]
  oncePerTurn?: boolean
}

/** Host-owned bonuses attached to creatures created by a resolved spell Activity. */
export interface DeclarativeSummonedCreatureBonusMechanicV1 {
  kind: 'summoned-creature-bonus'
  source: 'spell'
  temporaryHitPoints?: DeclarativeValueFormulaV1
  maximumHitPointBonus?: DeclarativeValueFormulaV1
  weaponDamageBonus?: DeclarativeValueFormulaV1
  spellSchools?: readonly Dnd5eSpellbookSchoolId[]
  spellIds?: readonly string[]
}

/** Extends a Host-owned creature-form catalogue without supplying executable form logic. */
export interface DeclarativeCreatureFormEligibilityMechanicV1 {
  kind: 'creature-form-eligibility'
  system: 'wild-shape'
  creatureTypes: readonly string[]
  maximumChallengeRating: DeclarativeValueFormulaV1
  specificFormIds?: readonly string[]
  requiresKnownForm?: boolean
  resourceCost?: number
  /** Core druids spend Wild Shape; other features spend this ability's generated use pool. */
  resourceMode?: 'core-wild-shape' | 'ability-uses'
  /** Defaults to the core Wild Shape duration formula. */
  durationHours?: DeclarativeValueFormulaV1
  /** Overrides the base form system's activation economy for matching forms. */
  activationEconomy?: 'action' | 'bonusAction'
  /** Keep the base system's swim/fly level gates while replacing its CR progression. */
  useCoreMovementLimits?: boolean
}

/**
 * Changes how an existing Host-owned creature-form system is activated and
 * optionally exposes a bounded in-form healing transaction. Unlike form
 * eligibility, this composes with every eligible form instead of duplicating
 * the catalogue or its CR rules.
 */
export interface DeclarativeCreatureFormControlMechanicV1 {
  kind: 'creature-form-control'
  system: 'wild-shape'
  activationEconomy?: 'action' | 'bonusAction'
  inFormHealing?: {
    economy: 'action' | 'bonusAction'
    resource: 'spell-slot'
    dicePerResourceLevel: { count: number; sides: number }
    maximumResourceLevel?: number
  }
}

/** Grants one Host-validated bonus-action weapon attack after an Attack action. */
export interface DeclarativeBonusWeaponAttackMechanicV1 {
  kind: 'bonus-weapon-attack'
  event: 'after-attack-action'
}

/**
 * A source-bound aura evaluated at the beginning of each qualifying target's
 * turn. The Host derives range, save DC, immunity memory and condition
 * lifetime from this closed declaration; packages cannot provide callbacks.
 */
export interface DeclarativeTurnStartSavingThrowAuraMechanicV1 {
  kind: 'turn-start-saving-throw-aura'
  radiusFeet: number
  relation: 'enemy' | 'any'
  ability: AbilityKey
  dcAbility: AbilityKey
  condition: Dnd5eStandardConditionId
  durationRounds: number
  breakOnDamage?: boolean
  magical?: boolean
  requiresMutualSight?: boolean
  successfulSaveImmunityRounds?: number
  /** The aura is only emitted while this sibling Activity Effect is active. */
  requiredEffectId?: string
}

/**
 * Pure-data subclass ability protocol. Imported packages never supply a resolver;
 * the Host compiles supported declarations into its whitelisted Headless executor.
 */
export interface DeclarativeSubclassAbilityV1 {
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  id: string
  name: string
  description: string
  level: number
  trigger: DeclarativeSubclassTriggerV1
  predicates?: DeclarativeSubclassPredicatesV1
  /** Direct access to the shared, closed Activity predicate vocabulary. */
  requirements?: readonly Dnd5ePredicateV1[]
  cost?: DeclarativeSubclassCostV1
  targeting: DeclarativeSubclassTargetingV1
  rolls?: readonly DeclarativeSubclassRollV1[]
  /** Runtime decisions shared by every content category and Workshop import. */
  choices?: readonly DeclarativeActivityChoiceV1[]
  effects: readonly DeclarativeSubclassEffectV1[]
  /** Reusable data-only status definitions consumed through `activity-effect`. */
  activityEffects?: readonly Dnd5eEffectDefinitionV1[]
  limits?: DeclarativeSubclassLimitsV1
  duration?: DeclarativeSubclassDurationV1
  mechanic?:
    | DeclarativeCombatManeuverMechanicV1
    | DeclarativeMartialSpellSynergyMechanicV1
    | DeclarativeRageFeatureMechanicV1
    | DeclarativeOpeningAttackMechanicV1
    | DeclarativeHiddenSpellSaveDisadvantageMechanicV1
    | DeclarativeUtilityProjectionControlMechanicV1
    | DeclarativeUtilityProjectionAttackAdvantageMechanicV1
    | DeclarativeNextD20AdvantageMechanicV1
    | DeclarativePostD20AdjustmentMechanicV1
    | DeclarativeD20ChoiceRerollMechanicV1
    | DeclarativePostSpellRandomTableMechanicV1
    | DeclarativePostSpellRandomTableChoiceMechanicV1
    | DeclarativeSpellDamageMaxDieBonusMechanicV1
    | DeclarativePersistentCompanionMechanicV1
    | DeclarativeCompanionProfileUpgradeMechanicV1
    | DeclarativeCreatureSpaceTraversalMechanicV1
    | DeclarativeEnvironmentalMovementMechanicV1
    | DeclarativePersistentProjectionMechanicV1
    | DeclarativePersistentProjectionUpgradeMechanicV1
    | DeclarativeAlternateResourceSpellcastingMechanicV1
    | DeclarativeGrantedDieCombatOptionsMechanicV1
    | DeclarativeAttackDisadvantageInterruptMechanicV1
    | DeclarativeAttackRetargetInterruptMechanicV1
    | DeclarativeDamageMitigationInterruptMechanicV1
    | DeclarativeWardPoolMechanicV1
    | DeclarativeSpellDamageResistanceAuraMechanicV1
    | DeclarativeStoredD20ReplacementMechanicV1
    | DeclarativeAttacksPerActionMechanicV1
    | DeclarativeWeaponDamageRiderMechanicV1
    | DeclarativeSpellDamageAbilityModifierMechanicV1
    | DeclarativeSpellAbilityCheckBonusMechanicV1
    | DeclarativeSpellInterceptionMechanicV1
    | DeclarativeSpellTargetExpansionMechanicV1
    | DeclarativeDamageRollMaximizationMechanicV1
    | DeclarativeAttackTradeoffMechanicV1
    | DeclarativePassiveDefenseMechanicV1
    | DeclarativeReactionWeaponAttackMechanicV1
    | DeclarativeMarkedTargetMechanicV1
    | DeclarativeDeathPreventionMechanicV1
    | DeclarativeSpellDefeatHealingMechanicV1
    | DeclarativeSummonedCreatureBonusMechanicV1
    | DeclarativeCreatureFormEligibilityMechanicV1
    | DeclarativeCreatureFormControlMechanicV1
    | DeclarativeBonusWeaponAttackMechanicV1
    | DeclarativeTurnStartSavingThrowAuraMechanicV1
  /**
   * Opens the post-result reaction window when an enemy succeeds on a d20.
   * This is only an eligibility declaration; the Host and DM still validate
   * ownership and the submitted replacement before settlement.
   */
  canModifyEnemyD20?: boolean
  automation: 'full' | 'partial' | 'manual'
}

export interface DeclarativeSubclassResourceV1 {
  id: string
  label: string
  minimumLevel?: number
  maximum: DeclarativeValueFormulaV1
  /** Later exact maxima. The last entry at or below class level wins. */
  maximumByClassLevel?: readonly { level: number; maximum: number }[]
  resetOn: 'combat' | 'short-rest' | 'long-rest'
  /** Optional display/mechanics metadata for resources such as superiority dice. */
  die?: DeclarativeSubclassResourceDieV1
}

export interface DeclarativeSubclassResourceDieV1 {
  sides: number
  sidesByClassLevel?: readonly { level: number; sides: number }[]
}

export interface DeclarativeSubclassChoiceGroupV1 {
  id: string
  level: number
  name: string
  description?: string
  /** Initial cumulative selection limit when this group becomes available. */
  maxSelections: number
  /** Later cumulative limits. The last entry at or below class level wins. */
  maxSelectionsByLevel?: readonly { level: number; maxSelections: number }[]
  options: readonly { id: string; name: string; summary: string }[]
}

/**
 * Pure metadata for subclass spellcasting. It never grants executable code:
 * the Host still validates selected spells against the registered spell catalog.
 */
export interface DeclarativeSubclassSpellcastingV1 {
  progression: 'one-third'
  learning: 'known'
  ability: AbilityKey
  spellListClassId: Dnd5eSpellcastingClassId
  cantripChoiceGroupId: string
  spellChoiceGroupId: string
  cantripsKnownByClassLevel: readonly number[]
  /** Cantrips granted by the subclass and counted against the known total. */
  requiredCantripIds?: readonly string[]
  spellsKnownByClassLevel: readonly number[]
  allowedSchools?: readonly Dnd5eSpellbookSchoolId[]
  unrestrictedSpellsKnownByClassLevel?: readonly number[]
  ritualCasting: boolean
  focus: string
}

/**
 * Pure-data spell grants supplied by a subclass. `always-prepared` entries are
 * added to the character without consuming a prepared/known selection;
 * `expanded-list` entries become legal choices for that class. Spell IDs are
 * resolved only against the Host catalog, so local data cannot inject code.
 */
export interface DeclarativeSubclassSpellListV1 {
  id: string
  name: string
  mode: 'always-prepared' | 'expanded-list'
  entries: readonly {
    classLevel: number
    spellIds: readonly string[]
  }[]
}

export type DeclarativeSubclassCombatHookTimingV1 =
  | 'before-attack-roll'
  | 'after-attack-roll'
  | 'after-attack-hit'
  | 'after-attack-miss'
  | 'before-damage-taken'
  | 'after-damage-taken'
  | 'saving-throw'
  | 'ability-check'
  | 'movement'
  | 'rage-start'
  | 'spell-cast'
  | 'turn-start'
  | 'turn-end'

export type DeclarativeSubclassCombatHookActivationV1 =
  | 'automatic'
  | 'prearm'
  | 'interrupt'

export type DeclarativeSubclassCombatHookRetentionV1 =
  | 'single-attempt'
  | 'until-triggered'
  | 'until-turn-end'

export interface DeclarativeSubclassCombatHookV1 {
  id: string
  timing: DeclarativeSubclassCombatHookTimingV1
  abilityId: string
  decision: 'automatic' | 'actor-choice' | 'target-choice' | 'dm-confirm'
  /**
   * `prearm` is a player-owned intent selected before an attack. Older
   * declarations omit this field and retain the original decision-window
   * behavior.
   */
  activation?: DeclarativeSubclassCombatHookActivationV1
  /** Only meaningful for `prearm`; defaults to `single-attempt`. */
  retention?: DeclarativeSubclassCombatHookRetentionV1
  /** At most one armed intent from the same group may accompany an attack. */
  exclusiveGroup?: string
  oncePerTurn?: boolean
}

export interface DeclarativeSubclassDefinitionV1 {
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  id: string
  classId: Dnd5eClassId
  name: string
  summary: string
  resources?: readonly DeclarativeSubclassResourceV1[]
  choiceGroups?: readonly DeclarativeSubclassChoiceGroupV1[]
  spellcasting?: DeclarativeSubclassSpellcastingV1
  spellLists?: readonly DeclarativeSubclassSpellListV1[]
  advancements?: readonly Dnd5eAdvancementDefinitionV1[]
  combatHooks?: readonly DeclarativeSubclassCombatHookV1[]
  abilities: readonly DeclarativeSubclassAbilityV1[]
}

export interface Dnd5eDeclarativeRulesPackageV1 {
  format: typeof DND5E_DECLARATIVE_PACKAGE_FORMAT
  schemaVersion: typeof DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION
  manifest: {
    id: string
    name: string
    version: string
    publisher: string
    license: string
    description?: string
    apiVersion: 2
    rulesetId: 'dnd5e-2014-srd-5.1'
    stateSchemaVersion?: number
    manifestSchemaVersion?: 1
    pluginKind?: import('./pluginApi').Dnd5ePluginKind
    minimumGameProtocolVersion?: number
    dependencies?: readonly import('./pluginApi').Dnd5ePluginDependency[]
    conflicts?: readonly string[]
    declaredCapabilities?: readonly import('./pluginApi').Dnd5ePluginDeclaredCapability[]
    distributionPolicy?: import('./pluginApi').Dnd5ePluginDistributionPolicy
    contentCategory?: import('./pluginApi').Dnd5ePluginContentCategory
  }
  subclasses: readonly DeclarativeSubclassDefinitionV1[]
  classes?: readonly import('./declarativeClass').DeclarativeClassDefinitionV1[]
  /** Existing data-only builder contributions. They are validated by their v2 validators. */
  legacy?: unknown
}

export interface DeclarativeAbilityCompatibilityEntryV1 {
  abilityId: string
  requested: DeclarativeSubclassAbilityV1['automation']
  effective: DeclarativeSubclassAbilityV1['automation']
  reasons: readonly string[]
}

export interface DeclarativeAbilityCompatibilityReportV1 {
  full: number
  partial: number
  manual: number
  abilities: readonly DeclarativeAbilityCompatibilityEntryV1[]
}

export function declarativeSubclassChoiceLimitV1(
  group: DeclarativeSubclassChoiceGroupV1,
  classLevel: number,
): number {
  let maximum = group.maxSelections
  for (const step of group.maxSelectionsByLevel ?? []) {
    if (classLevel < step.level) break
    maximum = step.maxSelections
  }
  return Math.max(0, Math.min(group.options.length, Math.floor(maximum)))
}

export function declarativeSubclassResourceDieSidesV1(
  die: DeclarativeSubclassResourceDieV1,
  classLevel: number,
): number {
  let sides = die.sides
  for (const step of die.sidesByClassLevel ?? []) {
    if (classLevel < step.level) break
    sides = step.sides
  }
  return sides
}

const ID = /^[a-z0-9][a-z0-9._-]{0,99}$/
const CLASS_IDS = new Set<Dnd5eClassId>([
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
])
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const AUTOMATION = new Set(['full', 'partial', 'manual'])
const CONDITION_IDS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)
const DAMAGE_TYPES = new Set<string>(DND5E_DAMAGE_TYPES)
const SPELLCASTING_CLASS_IDS = new Set<Dnd5eSpellcastingClassId>([
  'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
])
const SPELL_SCHOOLS = new Set<Dnd5eSpellbookSchoolId>([
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
])
const COMBAT_HOOK_TIMINGS = new Set<DeclarativeSubclassCombatHookTimingV1>([
  'before-attack-roll', 'after-attack-roll', 'after-attack-hit', 'after-attack-miss',
  'before-damage-taken', 'after-damage-taken', 'saving-throw', 'ability-check',
  'movement', 'rage-start', 'spell-cast', 'turn-start', 'turn-end',
])

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const permit = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !permit.has(key))
  if (unknown) throw new Error(`${label} 包含不支持的字段：${unknown}`)
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${label} ID 无效`)
}

function assertText(value: unknown, label: string, maximum = 4_000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} 无效`)
}

function validateFormula(value: unknown, label: string): asserts value is DeclarativeValueFormulaV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}公式无效`)
  assertKeys(value, value.kind === 'fixed'
    ? ['kind', 'value']
    : value.kind === 'ability-modifier'
      ? ['kind', 'ability', 'multiplier', 'minimum']
      : value.kind === 'class-level'
        ? ['kind', 'classId', 'divisor', 'multiplier', 'minimum']
        : ['kind', 'multiplier', 'minimum'], label)
  if (value.kind === 'fixed') {
    if (!finiteInteger(value.value, -1_000_000, 1_000_000)) throw new Error(`${label}固定值无效`)
    return
  }
  if (value.kind !== 'proficiency-bonus' && value.kind !== 'ability-modifier' && value.kind !== 'class-level') {
    throw new Error(`${label}公式类型无效`)
  }
  if (value.multiplier != null && !finiteInteger(value.multiplier, -100, 100)) throw new Error(`${label}倍率无效`)
  if (value.minimum != null && !finiteInteger(value.minimum, -1_000_000, 1_000_000)) throw new Error(`${label}最小值无效`)
  if (value.kind === 'ability-modifier' && !ABILITIES.has(value.ability as AbilityKey)) throw new Error(`${label}属性无效`)
  if (value.kind === 'class-level') {
    if (!CLASS_IDS.has(value.classId as Dnd5eClassId)) throw new Error(`${label}职业无效`)
    if (value.divisor != null && !finiteInteger(value.divisor, 1, 20)) throw new Error(`${label}除数无效`)
  }
}

function validateAbilityOptions(value: unknown, primary: AbilityKey, label: string): asserts value is readonly AbilityKey[] {
  if (
    !Array.isArray(value) || value.length < 2 || value.length > ABILITIES.size ||
    value.some((ability) => !ABILITIES.has(ability as AbilityKey)) ||
    new Set(value).size !== value.length || !value.includes(primary)
  ) throw new Error(`${label}可选豁免属性无效`)
}

function validateDuration(value: unknown, label: string): asserts value is DeclarativeSubclassDurationV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}持续时间无效`)
  const timed = value.kind === 'fixed-rounds' || value.kind === 'concentration'
  assertKeys(value, value.kind === 'fixed-rounds' ? ['kind', 'rounds', 'repeatSave'] : timed || value.kind === 'until-target-turn-end' ? ['kind', 'rounds'] : ['kind'], label)
  if (!['instantaneous', 'until-source-turn-start', 'until-source-turn-end', 'until-target-turn-start', 'until-target-turn-end', 'fixed-rounds', 'concentration', 'permanent'].includes(value.kind)) {
    throw new Error(`${label}持续时间类型无效`)
  }
  if ((timed || value.rounds != null) && !finiteInteger(value.rounds, 1, 14_400)) throw new Error(`${label}轮数无效`)
  if (value.repeatSave != null) {
    if (!record(value.repeatSave)) throw new Error(`${label}重复豁免无效`)
    assertKeys(value.repeatSave, ['ability', 'abilityOptions', 'dc'], `${label}重复豁免`)
    if (!ABILITIES.has(value.repeatSave.ability as AbilityKey)) {
      throw new Error(`${label}重复豁免无效`)
    }
    if (typeof value.repeatSave.dc === 'number') {
      if (!finiteInteger(value.repeatSave.dc, 1, 40)) throw new Error(`${label}重复豁免 DC 无效`)
    } else validateFormula(value.repeatSave.dc, `${label}重复豁免 DC`)
    if (value.repeatSave.abilityOptions != null) validateAbilityOptions(value.repeatSave.abilityOptions, value.repeatSave.ability as AbilityKey, `${label}重复豁免`)
  }
}

function validateDice(value: unknown, label: string): asserts value is DeclarativeDiceFormulaV1 {
  if (!record(value)) throw new Error(`${label}骰子无效`)
  assertKeys(value, ['count', 'sides', 'modifier', 'scaling'], label)
  if (!finiteInteger(value.count, 0, 40) || !finiteInteger(value.sides, 2, 100)) throw new Error(`${label}骰子无效`)
  if (value.modifier != null) validateFormula(value.modifier, `${label}调整值`)
  if (value.scaling != null) {
    if (!record(value.scaling)) throw new Error(`${label}缩放无效`)
    assertKeys(value.scaling, ['basis', 'classId', 'steps'], `${label}缩放`)
    if (value.scaling.basis !== 'character-level' && value.scaling.basis !== 'class-level') throw new Error(`${label}缩放依据无效`)
    if (value.scaling.basis === 'class-level' && !CLASS_IDS.has(value.scaling.classId as Dnd5eClassId)) throw new Error(`${label}缩放职业无效`)
    if (!Array.isArray(value.scaling.steps) || value.scaling.steps.length > 20) throw new Error(`${label}缩放表无效`)
    for (const step of value.scaling.steps) {
      if (!record(step)) throw new Error(`${label}缩放项无效`)
      assertKeys(step, ['level', 'addDice'], `${label}缩放项`)
      if (!finiteInteger(step.level, 1, 20) || !finiteInteger(step.addDice, 0, 40)) throw new Error(`${label}缩放项无效`)
    }
  }
}

function validateHostRollRecipe(
  value: unknown,
  label: string,
  allowCritical: boolean,
): asserts value is DeclarativeHostRollRecipeV1 {
  if (!record(value)) throw new Error(`${label} Host 掷骰配方无效`)
  assertKeys(value, ['timing', 'die', 'critical'], `${label} Host 掷骰配方`)
  if (value.timing !== 'on-trigger') throw new Error(`${label} Host 掷骰时机无效`)
  if (!record(value.die)) throw new Error(`${label} Host 掷骰来源无效`)
  assertKeys(value.die, ['kind', 'resourceId'], `${label} Host 掷骰来源`)
  if (value.die.kind !== 'resource-die') throw new Error(`${label} Host 掷骰来源无效`)
  assertId(value.die.resourceId, `${label} Host 掷骰资源`)
  if (value.critical != null && !['normal', 'double-dice'].includes(String(value.critical))) {
    throw new Error(`${label} Host 暴击骰策略无效`)
  }
  if (!allowCritical && value.critical === 'double-dice') {
    throw new Error(`${label} 非伤害骰不能声明暴击加骰`)
  }
}

export function validateDeclarativeSubclassAbilityV1(value: unknown, path = '能力'): asserts value is DeclarativeSubclassAbilityV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, ['schemaVersion', 'id', 'name', 'description', 'level', 'trigger', 'predicates', 'requirements', 'cost', 'targeting', 'rolls', 'choices', 'effects', 'activityEffects', 'limits', 'duration', 'mechanic', 'canModifyEnemyD20', 'automation'], path)
  if (value.schemaVersion !== 1) throw new Error(`${path} schemaVersion 不受支持`)
  assertId(value.id, path)
  assertText(value.name, `${path}名称`, 160)
  assertText(value.description, `${path}说明`)
  if (!finiteInteger(value.level, 1, 20)) throw new Error(`${path}等级无效`)
  const trigger = value.trigger
  if (!record(trigger) || !['active-use', 'before-attack-roll', 'after-attack-roll', 'after-attack-hit', 'after-attack-miss', 'after-d20-roll', 'before-spell-effect', 'before-damage-taken', 'after-damage-taken', 'after-spell-cast', 'after-condition-attempted', 'after-condition-applied', 'before-drop-to-zero', 'turn-start', 'turn-end', 'short-rest-complete', 'long-rest-complete'].includes(String(trigger.kind))) throw new Error(`${path}触发器无效`)
  assertKeys(trigger, ['kind'], `${path}触发器`)
  const mechanicCost = record(value.cost) ? value.cost : undefined
  const mechanicTargeting = record(value.targeting) ? value.targeting : undefined
  if (!AUTOMATION.has(String(value.automation))) throw new Error(`${path}自动化等级无效`)
  if (value.canModifyEnemyD20 != null && typeof value.canModifyEnemyD20 !== 'boolean') {
    throw new Error(`${path}敌方 d20 修改声明无效`)
  }
  const activityEffectDefinitions: Dnd5eEffectDefinitionV1[] = []
  if (value.activityEffects != null) {
    if (!Array.isArray(value.activityEffects) || value.activityEffects.length < 1 || value.activityEffects.length > 32) {
      throw new Error(`${path} Activity 效果定义无效`)
    }
    const effectIds = new Set<string>()
    for (const [index, effect] of value.activityEffects.entries()) {
      const errors = validateDnd5eEffectDefinitionV1(effect as Dnd5eEffectDefinitionV1)
      if (errors.length) throw new Error(`${path} Activity 效果 ${index} 无效：${errors.join('；')}`)
      const definition = effect as Dnd5eEffectDefinitionV1
      if (effectIds.has(definition.id)) throw new Error(`${path} Activity 效果 ID 重复：${definition.id}`)
      effectIds.add(definition.id)
      activityEffectDefinitions.push(definition)
    }
  }
  if (value.mechanic != null) {
    if (!record(value.mechanic)) throw new Error(`${path}机械协议无效`)
    if (value.mechanic.kind === 'combat-maneuver') {
      assertKeys(value.mechanic, ['kind', 'operation', 'resourceId', 'superiorityRollId'], `${path}机械协议`)
      if (!DND5E_COMBAT_MANEUVER_OPERATIONS.includes(
        value.mechanic.operation as Dnd5eCombatManeuverOperation,
      )) throw new Error(`${path}战技操作协议无效`)
      assertId(value.mechanic.resourceId, `${path}战技资源`)
      assertId(value.mechanic.superiorityRollId, `${path}卓越骰`)
    } else if (value.mechanic.kind === 'martial-spell-synergy') {
      assertKeys(value.mechanic, [
        'kind', 'operation', 'linkedEquipmentLimit', 'recallEconomy', 'teleportRangeFeet',
      ], `${path}机械协议`)
      if (!DND5E_MARTIAL_SPELL_SYNERGY_OPERATIONS.includes(
        value.mechanic.operation as Dnd5eMartialSpellSynergyOperation,
      )) throw new Error(`${path}武法协同操作协议无效`)
      if (value.mechanic.operation === 'linked-equipment') {
        if (!finiteInteger(value.mechanic.linkedEquipmentLimit, 1, 32) ||
          value.mechanic.recallEconomy !== 'bonusAction') {
          throw new Error(`${path}联结装备配置无效`)
        }
      } else if (value.mechanic.linkedEquipmentLimit != null || value.mechanic.recallEconomy != null) {
        throw new Error(`${path}仅联结装备操作可声明联结配置`)
      }
      if (value.mechanic.operation === 'extra-action-teleport') {
        if (!finiteInteger(value.mechanic.teleportRangeFeet, 1, 1_000)) {
          throw new Error(`${path}额外动作传送距离无效`)
        }
      } else if (value.mechanic.teleportRangeFeet != null) {
        throw new Error(`${path}仅额外动作传送可声明距离`)
      }
    } else if (value.mechanic.kind === 'rage-feature') {
      assertKeys(value.mechanic, [
        'kind', 'operation', 'radiusFeet', 'excludedDamageTypes', 'requiresNoHeavyArmor',
        'speedMultiplier', 'carryingCapacityMultiplier', 'maximumTargetSizeRank',
      ], `${path}机械协议`)
      if (!DND5E_RAGE_FEATURE_OPERATIONS.includes(
        value.mechanic.operation as Dnd5eRageFeatureOperation,
      )) throw new Error(`${path}狂暴特性操作协议无效`)
      if (value.mechanic.radiusFeet != null && !finiteInteger(value.mechanic.radiusFeet, 0, 1_000)) {
        throw new Error(`${path}狂暴特性半径无效`)
      }
      if (value.mechanic.excludedDamageTypes != null && (
        !Array.isArray(value.mechanic.excludedDamageTypes) ||
        value.mechanic.excludedDamageTypes.some((type) => !DAMAGE_TYPES.has(String(type)))
      )) throw new Error(`${path}狂暴特性排除伤害类型无效`)
      if (value.mechanic.requiresNoHeavyArmor != null &&
        typeof value.mechanic.requiresNoHeavyArmor !== 'boolean') {
        throw new Error(`${path}狂暴特性护甲限制无效`)
      }
      for (const [field, minimum, maximum] of [
        ['speedMultiplier', 1, 10],
        ['carryingCapacityMultiplier', 1, 100],
        ['maximumTargetSizeRank', 0, 5],
      ] as const) {
        const configured = value.mechanic[field]
        if (configured != null && !finiteInteger(configured, minimum, maximum)) {
          throw new Error(`${path}狂暴特性数值配置无效`)
        }
      }
      const requiredFieldByOperation: Partial<Record<Dnd5eRageFeatureOperation, keyof DeclarativeRageFeatureMechanicV1>> = {
        'broad-rage-resistance': 'excludedDamageTypes',
        'rage-mobile-defense': 'speedMultiplier',
        'ally-melee-advantage-aura': 'radiusFeet',
        'object-strength-and-carrying': 'carryingCapacityMultiplier',
        'ally-protection-aura': 'radiusFeet',
        'turn-flight': 'speedMultiplier',
        'bonus-prone-on-hit': 'maximumTargetSizeRank',
      }
      const requiredField = requiredFieldByOperation[
        value.mechanic.operation as Dnd5eRageFeatureOperation
      ]
      if (requiredField && value.mechanic[requiredField] == null) {
        throw new Error(`${path}狂暴特性缺少 ${requiredField} 配置`)
      }
      if (value.mechanic.operation === 'rage-mobile-defense' &&
        typeof value.mechanic.requiresNoHeavyArmor !== 'boolean') {
        throw new Error(`${path}狂暴移动防御缺少护甲限制配置`)
      }
    } else if (value.mechanic.kind === 'opening-attack') {
      assertKeys(
        value.mechanic,
        [
          'kind',
          'advantageBeforeTargetFirstTurn',
          'automaticCriticalAgainstSurprised',
          'surprisedHitSavingThrow',
        ],
        `${path} opening-attack mechanic`,
      )
      if (
        value.mechanic.advantageBeforeTargetFirstTurn != null &&
        typeof value.mechanic.advantageBeforeTargetFirstTurn !== 'boolean'
      ) throw new Error(`${path} opening-attack advantage declaration is invalid`)
      if (
        value.mechanic.automaticCriticalAgainstSurprised != null &&
        typeof value.mechanic.automaticCriticalAgainstSurprised !== 'boolean'
      ) throw new Error(`${path} opening-attack critical declaration is invalid`)
      if (value.mechanic.surprisedHitSavingThrow != null) {
        if (!record(value.mechanic.surprisedHitSavingThrow)) {
          throw new Error(`${path} opening-attack saving throw is invalid`)
        }
        assertKeys(
          value.mechanic.surprisedHitSavingThrow,
          ['ability', 'dcAbility', 'failureDamageMultiplier'],
          `${path} opening-attack saving throw`,
        )
        if (
          !ABILITIES.has(value.mechanic.surprisedHitSavingThrow.ability as AbilityKey) ||
          !ABILITIES.has(value.mechanic.surprisedHitSavingThrow.dcAbility as AbilityKey) ||
          !finiteInteger(
            value.mechanic.surprisedHitSavingThrow.failureDamageMultiplier,
            2,
            4,
          )
        ) throw new Error(`${path} opening-attack saving throw is invalid`)
      }
      if (
        value.mechanic.advantageBeforeTargetFirstTurn !== true &&
        value.mechanic.automaticCriticalAgainstSurprised !== true &&
        value.mechanic.surprisedHitSavingThrow == null
      ) throw new Error(`${path} opening-attack mechanic has no effect`)
    } else if (value.mechanic.kind === 'hidden-spell-save-disadvantage') {
      assertKeys(
        value.mechanic,
        ['kind'],
        `${path} hidden-spell-save-disadvantage mechanic`,
      )
    } else if (value.mechanic.kind === 'utility-projection-control') {
      assertKeys(
        value.mechanic,
        ['kind', 'projectionId', 'economy'],
        `${path} utility-projection-control mechanic`,
      )
      assertId(value.mechanic.projectionId, `${path} utility projection`)
      if (!['action', 'bonusAction'].includes(String(value.mechanic.economy))) {
        throw new Error(`${path} utility projection economy is invalid`)
      }
    } else if (value.mechanic.kind === 'utility-projection-attack-advantage') {
      assertKeys(
        value.mechanic,
        ['kind', 'projectionId', 'maximumDistanceFeet'],
        `${path} utility-projection-attack-advantage mechanic`,
      )
      assertId(value.mechanic.projectionId, `${path} utility projection`)
      if (!finiteInteger(value.mechanic.maximumDistanceFeet, 0, 10_000)) {
        throw new Error(`${path} utility projection distance is invalid`)
      }
    } else if (value.mechanic.kind === 'next-d20-advantage') {
      assertKeys(
        value.mechanic,
        ['kind', 'rollKinds'],
        `${path} next-d20-advantage mechanic`,
      )
      if (
        !Array.isArray(value.mechanic.rollKinds) ||
        value.mechanic.rollKinds.length < 1 ||
        value.mechanic.rollKinds.length > 3 ||
        new Set(value.mechanic.rollKinds).size !== value.mechanic.rollKinds.length ||
        value.mechanic.rollKinds.some((kind) =>
          !['attack', 'ability-check', 'saving-throw'].includes(String(kind)))
      ) throw new Error(`${path} next d20 roll kinds are invalid`)
    } else if (value.mechanic.kind === 'post-d20-adjustment') {
      assertKeys(
        value.mechanic,
        [
          'kind', 'rollKinds', 'dieSides', 'fixedAmount', 'fixedAmountReference',
          'directions', 'scope', 'attackModes', 'sourceHeldWeapon',
        ],
        `${path} post-d20-adjustment mechanic`,
      )
      const hasAdjustmentDie = value.mechanic.dieSides != null
      const hasFixedAdjustment = value.mechanic.fixedAmount != null
      const hasReferencedAdjustment = value.mechanic.fixedAmountReference != null
      const adjustmentSourceCount = [
        hasAdjustmentDie,
        hasFixedAdjustment,
        hasReferencedAdjustment,
      ].filter(Boolean).length
      const heldWeapon = value.mechanic.sourceHeldWeapon
      if (
        !Array.isArray(value.mechanic.rollKinds) ||
        value.mechanic.rollKinds.length < 1 ||
        value.mechanic.rollKinds.length > 3 ||
        new Set(value.mechanic.rollKinds).size !== value.mechanic.rollKinds.length ||
        value.mechanic.rollKinds.some((kind) =>
          !['attack', 'ability-check', 'saving-throw'].includes(String(kind))) ||
        adjustmentSourceCount !== 1 ||
        (hasAdjustmentDie && !finiteInteger(value.mechanic.dieSides, 2, 100)) ||
        (hasFixedAdjustment && !finiteInteger(value.mechanic.fixedAmount, 1, 100)) ||
        (hasReferencedAdjustment && value.mechanic.fixedAmountReference !== 'source-proficiency-bonus') ||
        !Array.isArray(value.mechanic.directions) ||
        value.mechanic.directions.length < 1 ||
        value.mechanic.directions.length > 2 ||
        new Set(value.mechanic.directions).size !== value.mechanic.directions.length ||
        value.mechanic.directions.some((direction) =>
          !['add', 'subtract'].includes(String(direction))) ||
        ![undefined, 'any', 'attack-against-self'].includes(value.mechanic.scope as string | undefined) ||
        (value.mechanic.attackModes != null && (
          !Array.isArray(value.mechanic.attackModes) ||
          value.mechanic.attackModes.length < 1 ||
          value.mechanic.attackModes.length > 2 ||
          new Set(value.mechanic.attackModes).size !== value.mechanic.attackModes.length ||
          value.mechanic.attackModes.some((mode) => !['melee', 'ranged'].includes(String(mode)))
        )) ||
        (heldWeapon != null && (
          !record(heldWeapon) ||
          Object.keys(heldWeapon).some((key) => !['properties', 'proficient'].includes(key)) ||
          (heldWeapon.properties != null && (
            !Array.isArray(heldWeapon.properties) ||
            heldWeapon.properties.length < 1 ||
            new Set(heldWeapon.properties).size !== heldWeapon.properties.length ||
            heldWeapon.properties.some((property) =>
              typeof property !== 'string' || !/^[a-z0-9][a-z0-9:_-]*$/.test(property))
          )) ||
          (heldWeapon.proficient != null && typeof heldWeapon.proficient !== 'boolean')
        ))
      ) throw new Error(`${path} post d20 adjustment declaration is invalid`)
      if (value.cost != null && (!record(value.cost) ||
        ![undefined, 'none', 'reaction'].includes(value.cost.economy as string | undefined))) {
        throw new Error(`${path} post d20 adjustment economy must be none or reaction`)
      }
    } else if (value.mechanic.kind === 'd20-choice-reroll') {
      assertKeys(
        value.mechanic,
        ['kind', 'rollKinds', 'scopes', 'additionalDice', 'selection'],
        `${path} d20 choice reroll mechanic`,
      )
      if (
        !Array.isArray(value.mechanic.rollKinds) ||
        value.mechanic.rollKinds.length < 1 ||
        value.mechanic.rollKinds.length > 3 ||
        new Set(value.mechanic.rollKinds).size !== value.mechanic.rollKinds.length ||
        value.mechanic.rollKinds.some((kind) =>
          !['attack', 'ability-check', 'saving-throw'].includes(String(kind))) ||
        !Array.isArray(value.mechanic.scopes) ||
        value.mechanic.scopes.length < 1 ||
        value.mechanic.scopes.length > 2 ||
        new Set(value.mechanic.scopes).size !== value.mechanic.scopes.length ||
        value.mechanic.scopes.some((scope) =>
          !['self-roll', 'attack-against-self'].includes(String(scope))) ||
        ![1, 2].includes(Number(value.mechanic.additionalDice)) ||
        !['owner-chooses', 'highest', 'lowest', 'must-use-latest'].includes(String(value.mechanic.selection))
      ) throw new Error(`${path} d20 choice reroll declaration is invalid`)
      if (trigger.kind !== 'after-d20-roll') {
        throw new Error(`${path} d20 choice reroll must trigger after a d20 roll`)
      }
      if (!record(value.cost) || value.cost.economy !== 'none' ||
        !Array.isArray(value.cost.resources) || value.cost.resources.length < 1) {
        throw new Error(`${path} d20 choice reroll must consume a declared resource without action economy`)
      }
    } else if (value.mechanic.kind === 'post-spell-random-table') {
      const mechanic = value.mechanic
      assertKeys(
        mechanic,
        [
          'kind',
          'spellcastingClassId',
          'minimumSpellLevel',
          'triggerDieSides',
          'triggerValues',
          'tableDieSides',
          'outcomes',
          'forceTableWhenUsesEmptyAbilityId',
          'restoreUsesAbilityIdOnTable',
        ],
        `${path} post-spell-random-table mechanic`,
      )
      if (
        !CLASS_IDS.has(mechanic.spellcastingClassId as Dnd5eClassId) ||
        !finiteInteger(mechanic.minimumSpellLevel, 1, 9) ||
        !finiteInteger(mechanic.triggerDieSides, 2, 100) ||
        !Array.isArray(mechanic.triggerValues) ||
        mechanic.triggerValues.length < 1 ||
        mechanic.triggerValues.length > Number(mechanic.triggerDieSides) ||
        new Set(mechanic.triggerValues).size !== mechanic.triggerValues.length ||
        mechanic.triggerValues.some((roll) =>
          !finiteInteger(roll, 1, Number(mechanic.triggerDieSides))) ||
        !finiteInteger(mechanic.tableDieSides, 2, 1_000) ||
        !Array.isArray(mechanic.outcomes) ||
        mechanic.outcomes.length < 1 ||
        mechanic.outcomes.length > 200
      ) throw new Error(`${path} post-spell random table declaration is invalid`)
      if (mechanic.forceTableWhenUsesEmptyAbilityId != null) {
        assertId(mechanic.forceTableWhenUsesEmptyAbilityId, `${path} forced table ability`)
      }
      if (mechanic.restoreUsesAbilityIdOnTable != null) {
        assertId(mechanic.restoreUsesAbilityIdOnTable, `${path} restored table ability`)
      }
      const outcomeIds = new Set<string>()
      const covered = new Set<number>()
      for (const outcome of mechanic.outcomes) {
        if (!record(outcome)) throw new Error(`${path} random table outcome is invalid`)
        assertKeys(outcome, ['id', 'minimum', 'maximum', 'effect'], `${path} random table outcome`)
        assertId(outcome.id, `${path} random table outcome`)
        if (
          outcomeIds.has(outcome.id) ||
          !finiteInteger(outcome.minimum, 1, Number(mechanic.tableDieSides)) ||
          !finiteInteger(outcome.maximum, Number(outcome.minimum), Number(mechanic.tableDieSides))
        ) throw new Error(`${path} random table outcome range is invalid`)
        outcomeIds.add(outcome.id)
        for (let roll = Number(outcome.minimum); roll <= Number(outcome.maximum); roll += 1) {
          if (covered.has(roll)) throw new Error(`${path} random table outcome ranges overlap`)
          covered.add(roll)
        }
        if (outcome.effect != null) {
          if (!record(outcome.effect)) throw new Error(`${path} random table outcome effect is invalid`)
          assertKeys(outcome.effect, ['kind', 'spellId', 'slotLevel'], `${path} random table outcome effect`)
          if (outcome.effect.kind !== 'self-centered-core-spell') {
            throw new Error(`${path} random table outcome effect is unsupported`)
          }
          assertId(outcome.effect.spellId, `${path} random table core spell`)
          if (!finiteInteger(outcome.effect.slotLevel, 0, 9)) {
            throw new Error(`${path} random table core spell level is invalid`)
          }
        }
      }
    } else if (value.mechanic.kind === 'post-spell-random-table-choice') {
      assertKeys(
        value.mechanic,
        ['kind', 'tableAbilityId', 'rollCount'],
        `${path} post-spell-random-table-choice mechanic`,
      )
      assertId(value.mechanic.tableAbilityId, `${path} random table ability`)
      if (
        !finiteInteger(value.mechanic.rollCount, 2, 8) ||
        trigger.kind !== 'after-spell-cast'
      ) throw new Error(`${path} post-spell random table choice declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-damage-max-die-bonus') {
      assertKeys(
        value.mechanic,
        ['kind', 'spellcastingClassId', 'additionalDice'],
        `${path} spell-damage-max-die-bonus mechanic`,
      )
      if (
        !CLASS_IDS.has(value.mechanic.spellcastingClassId as Dnd5eClassId) ||
        !finiteInteger(value.mechanic.additionalDice, 1, 8) ||
        trigger.kind !== 'after-spell-cast'
      ) throw new Error(`${path} spell damage maximum die bonus declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-ability-check-bonus') {
      assertKeys(value.mechanic, ['kind', 'spellIds', 'bonus'], `${path} spell ability check bonus mechanic`)
      if (
        value.mechanic.bonus !== 'proficiency' ||
        !Array.isArray(value.mechanic.spellIds) || value.mechanic.spellIds.length < 1 ||
        value.mechanic.spellIds.length > 32 ||
        value.mechanic.spellIds.some((spellId) => typeof spellId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(spellId)) ||
        new Set(value.mechanic.spellIds).size !== value.mechanic.spellIds.length
      ) throw new Error(`${path} spell ability check bonus declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-interception') {
      assertKeys(value.mechanic, [
        'kind', 'spellcastingClassId', 'saveAbility', 'dcAbility', 'minimumSpellLevel', 'maximumSpellLevel',
        'negateForSelf', 'grantTemporarySpellAccess', 'prohibitSourceCasting',
        'durationRounds',
      ], `${path} spell interception mechanic`)
      if (
        !CLASS_IDS.has(value.mechanic.spellcastingClassId as Dnd5eClassId) ||
        !ABILITIES.has(value.mechanic.saveAbility as AbilityKey) ||
        !ABILITIES.has(value.mechanic.dcAbility as AbilityKey) ||
        !finiteInteger(value.mechanic.minimumSpellLevel, 1, 9) ||
        value.mechanic.maximumSpellLevel !== 'actor-maximum-slot' ||
        typeof value.mechanic.negateForSelf !== 'boolean' ||
        typeof value.mechanic.grantTemporarySpellAccess !== 'boolean' ||
        typeof value.mechanic.prohibitSourceCasting !== 'boolean' ||
        !finiteInteger(value.mechanic.durationRounds, 1, 14_400) ||
        (!value.mechanic.negateForSelf && !value.mechanic.grantTemporarySpellAccess &&
          !value.mechanic.prohibitSourceCasting) ||
        trigger.kind !== 'before-spell-effect' || mechanicCost?.economy !== 'reaction' ||
        mechanicTargeting?.kind !== 'self'
      ) throw new Error(`${path} spell interception declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-target-expansion') {
      assertKeys(value.mechanic, ['kind', 'spellcastingClassId', 'spellSchools', 'baseMaximumTargets', 'additionalTargets'], `${path} spell target expansion mechanic`)
      if (
        !CLASS_IDS.has(value.mechanic.spellcastingClassId as Dnd5eClassId) ||
        !Array.isArray(value.mechanic.spellSchools) || value.mechanic.spellSchools.length < 1 ||
        value.mechanic.spellSchools.some((school) => !SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId)) ||
        value.mechanic.baseMaximumTargets !== 1 || !finiteInteger(value.mechanic.additionalTargets, 1, 8) ||
        trigger.kind !== 'after-spell-cast' || mechanicTargeting?.kind !== 'self'
      ) throw new Error(`${path} spell target expansion declaration is invalid`)
    } else if (value.mechanic.kind === 'damage-roll-maximization') {
      assertKeys(value.mechanic, ['kind', 'damageTypes', 'deliveries'], `${path} damage roll maximization mechanic`)
      if (
        !Array.isArray(value.mechanic.damageTypes) || value.mechanic.damageTypes.length < 1 ||
        value.mechanic.damageTypes.length > DND5E_DAMAGE_TYPES.length ||
        value.mechanic.damageTypes.some((damageType) => !DND5E_DAMAGE_TYPES.includes(damageType as Dnd5eDamageType)) ||
        new Set(value.mechanic.damageTypes).size !== value.mechanic.damageTypes.length ||
        !Array.isArray(value.mechanic.deliveries) || value.mechanic.deliveries.length < 1 ||
        value.mechanic.deliveries.length > 3 ||
        value.mechanic.deliveries.some((delivery) => !['weapon-attack', 'spell', 'feature'].includes(String(delivery))) ||
        new Set(value.mechanic.deliveries).size !== value.mechanic.deliveries.length
      ) throw new Error(`${path} damage roll maximization declaration is invalid`)
    } else if (value.mechanic.kind === 'attack-tradeoff') {
      assertKeys(
        value.mechanic,
        ['kind', 'attackRollModifier', 'damageBonus', 'attackModes', 'requiredWeaponProperties'],
        `${path} attack tradeoff mechanic`,
      )
      if (
        !finiteInteger(value.mechanic.attackRollModifier, -20, 20) ||
        !finiteInteger(value.mechanic.damageBonus, -100, 100) ||
        value.mechanic.attackRollModifier === 0 || value.mechanic.damageBonus === 0 ||
        !Array.isArray(value.mechanic.attackModes) || value.mechanic.attackModes.length < 1 ||
        value.mechanic.attackModes.length > 2 ||
        new Set(value.mechanic.attackModes).size !== value.mechanic.attackModes.length ||
        value.mechanic.attackModes.some((mode) => !['melee', 'ranged'].includes(String(mode))) ||
        (value.mechanic.requiredWeaponProperties != null && (
          !Array.isArray(value.mechanic.requiredWeaponProperties) ||
          value.mechanic.requiredWeaponProperties.length < 1 ||
          value.mechanic.requiredWeaponProperties.length > 16 ||
          new Set(value.mechanic.requiredWeaponProperties).size !== value.mechanic.requiredWeaponProperties.length ||
          value.mechanic.requiredWeaponProperties.some((property) =>
            typeof property !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(property))
        )) ||
        trigger.kind !== 'before-attack-roll' ||
        (mechanicCost?.economy ?? 'none') !== 'none' ||
        mechanicTargeting?.kind !== 'self'
      ) throw new Error(`${path} attack tradeoff declaration is invalid`)
    } else if (value.mechanic.kind === 'persistent-companion') {
      assertKeys(value.mechanic, ['kind', 'choiceGroupId', 'companions', 'combatProfile'], `${path} persistent companion mechanic`)
      assertId(value.mechanic.choiceGroupId, `${path} companion choice group`)
      if (
        !Array.isArray(value.mechanic.companions) || value.mechanic.companions.length < 1 ||
        value.mechanic.companions.length > 64
      ) throw new Error(`${path} persistent companion list is invalid`)
      const optionIds = new Set<string>()
      for (const companion of value.mechanic.companions) {
        if (!record(companion)) throw new Error(`${path} persistent companion is invalid`)
        assertKeys(companion, ['optionId', 'monsterId'], `${path} persistent companion`)
        assertId(companion.optionId, `${path} persistent companion option`)
        if (
          optionIds.has(companion.optionId) || typeof companion.monsterId !== 'string' ||
          !/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(companion.monsterId)
        ) throw new Error(`${path} persistent companion mapping is invalid`)
        optionIds.add(companion.optionId)
      }
      if (value.mechanic.combatProfile != null) {
        const profile = value.mechanic.combatProfile
        if (!record(profile)) throw new Error(`${path} persistent companion combat profile is invalid`)
        assertKeys(profile, [
          'minimumMaximumHitPoints', 'armorClassBonus', 'weaponAttackBonus',
          'weaponDamageBonus', 'savingThrowBonus', 'proficientSkillCheckBonus',
          'weaponAttacksMagical', 'attacksPerAction', 'advancements',
        ], `${path} persistent companion combat profile`)
        for (const [label, formula] of Object.entries({
          minimumMaximumHitPoints: profile.minimumMaximumHitPoints,
          armorClassBonus: profile.armorClassBonus,
          weaponAttackBonus: profile.weaponAttackBonus,
          weaponDamageBonus: profile.weaponDamageBonus,
          savingThrowBonus: profile.savingThrowBonus,
          proficientSkillCheckBonus: profile.proficientSkillCheckBonus,
        })) {
          if (formula != null) validateFormula(formula, `${path} persistent companion ${label}`)
        }
        if (profile.weaponAttacksMagical != null && typeof profile.weaponAttacksMagical !== 'boolean') {
          throw new Error(`${path} persistent companion magical attacks is invalid`)
        }
        if (profile.attacksPerAction != null && !finiteInteger(profile.attacksPerAction, 1, 10)) {
          throw new Error(`${path} persistent companion attacks per action is invalid`)
        }
        if (profile.advancements != null) {
          if (!Array.isArray(profile.advancements) || profile.advancements.length > 20) {
            throw new Error(`${path} persistent companion advancements are invalid`)
          }
          let previousLevel = 0
          for (const advancement of profile.advancements) {
            if (!record(advancement)) throw new Error(`${path} persistent companion advancement is invalid`)
            assertKeys(advancement, [
              'classId', 'minimumLevel', 'weaponAttacksMagical',
              'attacksPerAction', 'shareSelfSpellsRangeFeet',
            ], `${path} persistent companion advancement`)
            if (
              !CLASS_IDS.has(advancement.classId as Dnd5eClassId) ||
              !finiteInteger(advancement.minimumLevel, 1, 20) ||
              advancement.minimumLevel <= previousLevel ||
              (advancement.weaponAttacksMagical != null && typeof advancement.weaponAttacksMagical !== 'boolean') ||
              (advancement.attacksPerAction != null && !finiteInteger(advancement.attacksPerAction, 1, 10)) ||
              (advancement.shareSelfSpellsRangeFeet != null && !finiteInteger(advancement.shareSelfSpellsRangeFeet, 5, 10_000))
            ) throw new Error(`${path} persistent companion advancement is invalid`)
            previousLevel = advancement.minimumLevel
          }
        }
      }
    } else if (value.mechanic.kind === 'companion-profile-upgrade') {
      assertKeys(value.mechanic, [
        'kind', 'weaponAttacksMagical', 'attacksPerAction', 'shareSelfSpellsRangeFeet',
      ], `${path} companion profile upgrade mechanic`)
      if (
        (value.mechanic.weaponAttacksMagical == null && value.mechanic.attacksPerAction == null &&
          value.mechanic.shareSelfSpellsRangeFeet == null) ||
        (value.mechanic.weaponAttacksMagical != null && typeof value.mechanic.weaponAttacksMagical !== 'boolean') ||
        (value.mechanic.attacksPerAction != null && !finiteInteger(value.mechanic.attacksPerAction, 1, 10)) ||
        (value.mechanic.shareSelfSpellsRangeFeet != null &&
          !finiteInteger(value.mechanic.shareSelfSpellsRangeFeet, 5, 10_000))
      ) throw new Error(`${path} companion profile upgrade declaration is invalid`)
    } else if (value.mechanic.kind === 'creature-space-traversal') {
      assertKeys(value.mechanic, ['kind', 'minimumLargerSizeRanks'], `${path} creature space traversal mechanic`)
      if (!finiteInteger(value.mechanic.minimumLargerSizeRanks, 1, 5)) {
        throw new Error(`${path} creature space traversal declaration is invalid`)
      }
    } else if (value.mechanic.kind === 'environmental-movement') {
      assertKeys(value.mechanic, ['kind', 'environments', 'mode', 'speed'], `${path} environmental movement mechanic`)
      if (
        !Array.isArray(value.mechanic.environments) || value.mechanic.environments.length < 1 ||
        value.mechanic.environments.some((entry) => !['normal', 'outdoors', 'indoors', 'underground', 'underwater'].includes(String(entry))) ||
        !['fly', 'swim', 'climb'].includes(String(value.mechanic.mode)) ||
        (value.mechanic.speed !== 'walking' && !finiteInteger(value.mechanic.speed, 1, 1_000))
      ) throw new Error(`${path} environmental movement declaration is invalid`)
    } else if (value.mechanic.kind === 'persistent-projection') {
      assertKeys(value.mechanic, [
        'kind', 'projectionId', 'label', 'placementRangeFeet', 'durationRounds', 'concentration',
        'color', 'movement', 'spellOrigin', 'attackAdvantageWithinFeet', 'instanceCount',
      ], `${path} persistent projection mechanic`)
      assertId(value.mechanic.projectionId, `${path} persistent projection`)
      if (
        typeof value.mechanic.label !== 'string' || !value.mechanic.label.trim() || value.mechanic.label.length > 120 ||
        !finiteInteger(value.mechanic.placementRangeFeet, 0, 10_000) ||
        !finiteInteger(value.mechanic.durationRounds, 1, 14_400) ||
        typeof value.mechanic.concentration !== 'boolean' ||
        (value.mechanic.instanceCount != null && !finiteInteger(value.mechanic.instanceCount, 1, 16)) ||
        (value.mechanic.color != null && (typeof value.mechanic.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.mechanic.color))) ||
        (value.mechanic.spellOrigin != null && typeof value.mechanic.spellOrigin !== 'boolean') ||
        (value.mechanic.attackAdvantageWithinFeet != null &&
          !finiteInteger(value.mechanic.attackAdvantageWithinFeet, 1, 1_000))
      ) throw new Error(`${path} persistent projection declaration is invalid`)
      if (value.mechanic.movement != null) {
        if (!record(value.mechanic.movement)) throw new Error(`${path} persistent projection movement is invalid`)
        assertKeys(value.mechanic.movement, [
          'economy', 'maximumFeet', 'maximumDistanceFromSourceFeet',
        ], `${path} persistent projection movement`)
        if (
          !['action', 'bonus-action'].includes(String(value.mechanic.movement.economy)) ||
          !finiteInteger(value.mechanic.movement.maximumFeet, 1, 1_000) ||
          (value.mechanic.movement.maximumDistanceFromSourceFeet != null &&
            !finiteInteger(value.mechanic.movement.maximumDistanceFromSourceFeet, 1, 10_000))
        ) throw new Error(`${path} persistent projection movement is invalid`)
      }
    } else if (value.mechanic.kind === 'persistent-projection-upgrade') {
      assertKeys(value.mechanic, ['kind', 'projectionId', 'instanceCount'], `${path} persistent projection upgrade mechanic`)
      assertId(value.mechanic.projectionId, `${path} persistent projection upgrade`)
      if (
        !finiteInteger(value.mechanic.instanceCount, 2, 16) ||
        !record(value.trigger) || value.trigger.kind !== 'active-use' ||
        !record(value.targeting) || value.targeting.kind !== 'self'
      ) throw new Error(`${path} persistent projection upgrade declaration is invalid`)
    } else if (value.mechanic.kind === 'alternate-resource-spellcasting') {
      assertKeys(value.mechanic, [
        'kind', 'classId', 'ability', 'resourceId', 'resourceScope', 'ignoreMaterialComponents', 'grants',
      ], `${path} alternate resource spellcasting mechanic`)
      assertId(value.mechanic.resourceId, `${path} alternate spell resource`)
      if (
        !CLASS_IDS.has(value.mechanic.classId as Dnd5eClassId) ||
        !ABILITIES.has(value.mechanic.ability as AbilityKey) ||
        (value.mechanic.resourceScope != null &&
          !['core', 'plugin'].includes(String(value.mechanic.resourceScope))) ||
        (value.mechanic.ignoreMaterialComponents != null &&
          typeof value.mechanic.ignoreMaterialComponents !== 'boolean') ||
        !Array.isArray(value.mechanic.grants) || value.mechanic.grants.length < 1 ||
        value.mechanic.grants.length > 64
      ) throw new Error(`${path} alternate resource spellcasting declaration is invalid`)
      const grantIds = new Set<string>()
      for (const grant of value.mechanic.grants) {
        if (!record(grant)) throw new Error(`${path} alternate spell grant is invalid`)
        assertKeys(grant, [
          'id', 'spellId', 'minimumLevel', 'castAtLevel', 'resourceCost', 'selection', 'upcast',
        ], `${path} alternate spell grant`)
        assertId(grant.id, `${path} alternate spell grant`)
        assertId(grant.spellId, `${path} alternate spell`)
        if (
          grantIds.has(grant.id) ||
          (grant.minimumLevel != null && !finiteInteger(grant.minimumLevel, 1, 20)) ||
          !finiteInteger(grant.castAtLevel, 0, 9) ||
          !finiteInteger(grant.resourceCost, 0, 99)
        ) throw new Error(`${path} alternate spell grant is invalid`)
        grantIds.add(grant.id)
        if (grant.selection != null) {
          if (!record(grant.selection)) throw new Error(`${path} alternate spell selection is invalid`)
          assertKeys(grant.selection, ['groupId', 'optionId'], `${path} alternate spell selection`)
          assertId(grant.selection.groupId, `${path} alternate spell selection group`)
          assertId(grant.selection.optionId, `${path} alternate spell selection option`)
        }
        if (grant.upcast != null) {
          if (!record(grant.upcast)) throw new Error(`${path} alternate spell upcast is invalid`)
          assertKeys(grant.upcast, [
            'resourcePerSlotLevel', 'maximumResourceCostByClassLevel',
          ], `${path} alternate spell upcast`)
          if (
            !finiteInteger(grant.upcast.resourcePerSlotLevel, 1, 20) ||
            !Array.isArray(grant.upcast.maximumResourceCostByClassLevel) ||
            grant.upcast.maximumResourceCostByClassLevel.length < 1 ||
            grant.upcast.maximumResourceCostByClassLevel.length > 20
          ) throw new Error(`${path} alternate spell upcast is invalid`)
          let previousLevel = 0
          let previousMaximum = grant.resourceCost - 1
          for (const step of grant.upcast.maximumResourceCostByClassLevel) {
            if (!record(step)) throw new Error(`${path} alternate spell upcast step is invalid`)
            assertKeys(step, ['level', 'maximumResourceCost'], `${path} alternate spell upcast step`)
            if (
              !finiteInteger(step.level, 1, 20) || step.level <= previousLevel ||
              !finiteInteger(step.maximumResourceCost, grant.resourceCost, 99) ||
              step.maximumResourceCost < previousMaximum
            ) throw new Error(`${path} alternate spell upcast step is invalid`)
            previousLevel = step.level
            previousMaximum = step.maximumResourceCost
          }
        }
      }
    } else if (value.mechanic.kind === 'granted-die-combat-options') {
      assertKeys(value.mechanic, [
        'kind', 'dieState', 'addToWeaponDamage', 'addToArmorClassAgainstAttack',
      ], `${path} granted die combat options mechanic`)
      if (
        value.mechanic.dieState !== 'bardic-inspiration' ||
        (value.mechanic.addToWeaponDamage != null && typeof value.mechanic.addToWeaponDamage !== 'boolean') ||
        (value.mechanic.addToArmorClassAgainstAttack != null &&
          typeof value.mechanic.addToArmorClassAgainstAttack !== 'boolean') ||
        (value.mechanic.addToWeaponDamage !== true &&
          value.mechanic.addToArmorClassAgainstAttack !== true)
      ) throw new Error(`${path} granted die combat options declaration is invalid`)
    } else if (value.mechanic.kind === 'attack-disadvantage-interrupt') {
      assertKeys(value.mechanic, ['kind', 'protects', 'outcome', 'onMiss'], `${path} attack disadvantage interrupt mechanic`)
      if (!['self', 'ally-or-self'].includes(String(value.mechanic.protects)) ||
        (value.mechanic.outcome != null && !['disadvantage', 'automatic-miss'].includes(String(value.mechanic.outcome))) ||
        (value.mechanic.onMiss != null && value.mechanic.onMiss !== 'next-attack-advantage-against-attacker') ||
        !record(value.trigger) || value.trigger.kind !== 'before-attack-roll' ||
        !record(value.cost) || value.cost.economy !== 'reaction' ||
        !record(value.targeting) || value.targeting.kind !== 'single-creature' ||
        value.targeting.relation !== 'enemy') {
        throw new Error(`${path} attack disadvantage interrupt declaration is invalid`)
      }
    } else if (value.mechanic.kind === 'attack-retarget-interrupt') {
      assertKeys(
        value.mechanic,
        [
          'kind', 'protects', 'saveAbility', 'dcAbility', 'alternativeTarget',
          'immunityCondition', 'successfulSaveImmunity',
        ],
        `${path} attack retarget interrupt mechanic`,
      )
      if (
        value.mechanic.protects !== 'self' ||
        !ABILITIES.has(value.mechanic.saveAbility as AbilityKey) ||
        !ABILITIES.has(value.mechanic.dcAbility as AbilityKey) ||
        value.mechanic.alternativeTarget !== 'nearest-other-creature' ||
        (value.mechanic.immunityCondition != null && value.mechanic.immunityCondition !== 'charmed') ||
        value.mechanic.successfulSaveImmunity !== 'long-rest' ||
        !record(value.trigger) || value.trigger.kind !== 'before-attack-roll' ||
        !record(value.cost) || value.cost.economy !== 'reaction' ||
        !record(value.targeting) || value.targeting.kind !== 'single-creature' ||
        value.targeting.relation !== 'enemy' || value.targeting.requiresSight !== true
      ) throw new Error(`${path} attack retarget interrupt declaration is invalid`)
    } else if (value.mechanic.kind === 'damage-mitigation-interrupt') {
      assertKeys(
        value.mechanic,
        ['kind', 'mode', 'protects', 'damageTypes', 'poolAbilityId'],
        `${path} damage mitigation interrupt mechanic`,
      )
      const mode = String(value.mechanic.mode)
      if (
        !['resistance', 'ward-pool'].includes(mode) ||
        !['self', 'ally-or-self'].includes(String(value.mechanic.protects)) ||
        !record(value.trigger) || value.trigger.kind !== 'before-damage-taken' ||
        !record(value.cost) || value.cost.economy !== 'reaction' ||
        !record(value.targeting) || value.targeting.kind !== 'single-creature'
      ) throw new Error(`${path} damage mitigation interrupt declaration is invalid`)
      if (mode === 'resistance') {
        if (
          !Array.isArray(value.mechanic.damageTypes) || value.mechanic.damageTypes.length < 1 ||
          value.mechanic.damageTypes.length > DND5E_DAMAGE_TYPES.length ||
          new Set(value.mechanic.damageTypes).size !== value.mechanic.damageTypes.length ||
          value.mechanic.damageTypes.some((damageType) => !DND5E_DAMAGE_TYPES.includes(damageType as Dnd5eDamageType)) ||
          value.mechanic.poolAbilityId != null
        ) throw new Error(`${path} damage resistance interrupt declaration is invalid`)
      } else {
        if (value.mechanic.damageTypes != null) throw new Error(`${path} ward pool interrupt cannot declare damage types`)
        assertId(value.mechanic.poolAbilityId, `${path} ward pool ability`)
      }
    } else if (value.mechanic.kind === 'ward-pool') {
      assertKeys(
        value.mechanic,
        [
          'kind', 'spellcastingClassId', 'ability', 'school', 'minimumSpellLevel',
          'classLevelMultiplier', 'restorePerSpellLevel',
        ],
        `${path} ward pool mechanic`,
      )
      if (
        !CLASS_IDS.has(value.mechanic.spellcastingClassId as Dnd5eClassId) ||
        !ABILITIES.has(value.mechanic.ability as AbilityKey) ||
        !['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'].includes(String(value.mechanic.school)) ||
        !finiteInteger(value.mechanic.minimumSpellLevel, 1, 9) ||
        !finiteInteger(value.mechanic.classLevelMultiplier, 1, 20) ||
        !finiteInteger(value.mechanic.restorePerSpellLevel, 1, 20) ||
        !record(value.trigger) || value.trigger.kind !== 'after-spell-cast' ||
        !record(value.targeting) || value.targeting.kind !== 'self'
      ) throw new Error(`${path} ward pool declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-damage-resistance-aura') {
      assertKeys(value.mechanic, ['kind', 'radiusFeet', 'expandedRadius'], `${path} spell resistance aura mechanic`)
      if (
        !finiteInteger(value.mechanic.radiusFeet, 1, 1_000) ||
        !record(value.trigger) || value.trigger.kind !== 'before-damage-taken' ||
        !record(value.targeting) || value.targeting.kind !== 'multiple-creatures' ||
        value.targeting.relation !== 'ally' || value.targeting.includeSelf !== true
      ) throw new Error(`${path} spell resistance aura declaration is invalid`)
      if (value.mechanic.expandedRadius != null) {
        if (!record(value.mechanic.expandedRadius)) throw new Error(`${path} spell resistance aura expansion is invalid`)
        assertKeys(value.mechanic.expandedRadius, ['level', 'radiusFeet'], `${path} spell resistance aura expansion`)
        if (!finiteInteger(value.mechanic.expandedRadius.level, 1, 20) ||
          !finiteInteger(value.mechanic.expandedRadius.radiusFeet, Number(value.mechanic.radiusFeet), 1_000)) {
          throw new Error(`${path} spell resistance aura expansion is invalid`)
        }
      }
    } else if (value.mechanic.kind === 'stored-d20-replacement') {
      assertKeys(value.mechanic, ['kind', 'count', 'countByClassLevel'], `${path} stored d20 replacement mechanic`)
      if (
        !finiteInteger(value.mechanic.count, 1, 8) ||
        !record(value.trigger) || value.trigger.kind !== 'long-rest-complete' ||
        !record(value.targeting) || value.targeting.kind !== 'self' ||
        value.canModifyEnemyD20 !== true
      ) throw new Error(`${path} stored d20 replacement declaration is invalid`)
      if (value.mechanic.countByClassLevel != null) {
        if (!Array.isArray(value.mechanic.countByClassLevel) || value.mechanic.countByClassLevel.length > 20) {
          throw new Error(`${path} stored d20 replacement scaling is invalid`)
        }
        let previousLevel = 0
        for (const step of value.mechanic.countByClassLevel) {
          if (!record(step)) throw new Error(`${path} stored d20 replacement scaling is invalid`)
          assertKeys(step, ['level', 'count'], `${path} stored d20 replacement scaling`)
          if (!finiteInteger(step.level, previousLevel + 1, 20) || !finiteInteger(step.count, 1, 8)) {
            throw new Error(`${path} stored d20 replacement scaling is invalid`)
          }
          previousLevel = Number(step.level)
        }
      }
    } else if (value.mechanic.kind === 'attacks-per-action') {
      assertKeys(value.mechanic, ['kind', 'attacks'], `${path} attacks-per-action mechanic`)
      if (
        !finiteInteger(value.mechanic.attacks, 2, 8) ||
        trigger.kind !== 'active-use' ||
        (mechanicCost?.economy ?? 'none') !== 'none' ||
        mechanicTargeting?.kind !== 'self'
      ) throw new Error(`${path} attacks per action declaration is invalid`)
    } else if (value.mechanic.kind === 'weapon-damage-rider') {
      assertKeys(value.mechanic, ['kind', 'rollId'], `${path} weapon damage rider mechanic`)
      assertId(value.mechanic.rollId, `${path} weapon damage rider roll`)
      const rollId = value.mechanic.rollId
      const damageRoll = Array.isArray(value.rolls)
        ? value.rolls.find((roll) => record(roll) && roll.id === rollId)
        : undefined
      if (
        !record(damageRoll) || damageRoll.kind !== 'damage' ||
        trigger.kind !== 'after-attack-hit' ||
        (mechanicCost?.economy ?? 'none') !== 'none' ||
        mechanicTargeting?.kind !== 'single-creature' ||
        mechanicTargeting.relation !== 'enemy'
      ) throw new Error(`${path} weapon damage rider declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-damage-ability-modifier') {
      assertKeys(
        value.mechanic,
        ['kind', 'spellcastingClassId', 'ability', 'maximumSpellLevel'],
        `${path} spell damage ability modifier mechanic`,
      )
      if (
        !CLASS_IDS.has(value.mechanic.spellcastingClassId as Dnd5eClassId) ||
        !ABILITIES.has(value.mechanic.ability as AbilityKey) ||
        !finiteInteger(value.mechanic.maximumSpellLevel, 0, 9) ||
        trigger.kind !== 'after-spell-cast' ||
        mechanicTargeting?.kind !== 'self'
      ) throw new Error(`${path} spell damage ability modifier declaration is invalid`)
    } else if (value.mechanic.kind === 'passive-defense') {
      assertKeys(
        value.mechanic,
        ['kind', 'damageResistance', 'savingThrowAdvantageAgainstSpells', 'concentrationCheckAdvantage', 'hitPointMaximumReductionImmunity', 'conditionImmunities', 'damageReflection', 'concentrationCheckImmunity', 'weaponAttacksMagical'],
        `${path} passive defense mechanic`,
      )
      const resistance = value.mechanic.damageResistance
      if (resistance != null) {
        if (!record(resistance)) throw new Error(`${path} passive damage resistance is invalid`)
        assertKeys(resistance, ['damageTypes', 'delivery', 'magical'], `${path} passive damage resistance`)
        if (
          !Array.isArray(resistance.damageTypes) || resistance.damageTypes.length < 1 ||
          resistance.damageTypes.length > DND5E_DAMAGE_TYPES.length ||
          new Set(resistance.damageTypes).size !== resistance.damageTypes.length ||
          resistance.damageTypes.some((damageType) =>
            !DND5E_DAMAGE_TYPES.includes(damageType as Dnd5eDamageType)) ||
          (resistance.delivery != null &&
            !['weapon-attack', 'spell', 'other'].includes(String(resistance.delivery))) ||
          (resistance.magical != null && typeof resistance.magical !== 'boolean')
        ) throw new Error(`${path} passive damage resistance is invalid`)
      }
      if (
        value.mechanic.savingThrowAdvantageAgainstSpells != null &&
        typeof value.mechanic.savingThrowAdvantageAgainstSpells !== 'boolean'
      ) throw new Error(`${path} passive spell saving throw advantage is invalid`)
      if (
        value.mechanic.concentrationCheckAdvantage != null &&
        typeof value.mechanic.concentrationCheckAdvantage !== 'boolean'
      ) throw new Error(`${path} passive concentration check advantage is invalid`)
      if (
        value.mechanic.hitPointMaximumReductionImmunity != null &&
        typeof value.mechanic.hitPointMaximumReductionImmunity !== 'boolean'
      ) throw new Error(`${path} passive maximum hit point immunity is invalid`)
      if (value.mechanic.conditionImmunities != null && (
        !Array.isArray(value.mechanic.conditionImmunities) || value.mechanic.conditionImmunities.length < 1 ||
        value.mechanic.conditionImmunities.some((condition) => !CONDITION_IDS.has(String(condition))) ||
        new Set(value.mechanic.conditionImmunities).size !== value.mechanic.conditionImmunities.length
      )) throw new Error(`${path} passive condition immunity is invalid`)
      if (value.mechanic.damageReflection != null) {
        const reflection = value.mechanic.damageReflection
        if (!record(reflection)) throw new Error(`${path} passive damage reflection is invalid`)
        assertKeys(reflection, ['damageTypes', 'multiplier'], `${path} passive damage reflection`)
        if (
          !Array.isArray(reflection.damageTypes) || reflection.damageTypes.length < 1 ||
          reflection.damageTypes.some((damageType) => !DAMAGE_TYPES.has(String(damageType))) ||
          typeof reflection.multiplier !== 'number' || !Number.isFinite(reflection.multiplier) ||
          reflection.multiplier <= 0 || reflection.multiplier > 10
        ) throw new Error(`${path} passive damage reflection is invalid`)
      }
      if (value.mechanic.concentrationCheckImmunity != null) {
        const immunity = value.mechanic.concentrationCheckImmunity
        if (!record(immunity)) throw new Error(`${path} passive concentration immunity is invalid`)
        assertKeys(immunity, ['spellSchools'], `${path} passive concentration immunity`)
        if (
          !Array.isArray(immunity.spellSchools) || immunity.spellSchools.length < 1 ||
          immunity.spellSchools.some((school) => !SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId)) ||
          new Set(immunity.spellSchools).size !== immunity.spellSchools.length
        ) throw new Error(`${path} passive concentration immunity is invalid`)
      }
      if (value.mechanic.weaponAttacksMagical != null) {
        const magical = value.mechanic.weaponAttacksMagical
        if (!record(magical)) throw new Error(`${path} passive magical attacks is invalid`)
        assertKeys(magical, ['while'], `${path} passive magical attacks`)
        if (!['always', 'transformed'].includes(String(magical.while))) {
          throw new Error(`${path} passive magical attacks is invalid`)
        }
      }
      if (
        resistance == null &&
        value.mechanic.savingThrowAdvantageAgainstSpells !== true &&
        value.mechanic.concentrationCheckAdvantage !== true &&
        value.mechanic.hitPointMaximumReductionImmunity !== true &&
        value.mechanic.conditionImmunities == null &&
        value.mechanic.damageReflection == null &&
        value.mechanic.concentrationCheckImmunity == null &&
        value.mechanic.weaponAttacksMagical == null
      ) throw new Error(`${path} passive defense mechanic has no effect`)
      if ((mechanicCost?.economy ?? 'none') !== 'none' || mechanicTargeting?.kind !== 'self') {
        throw new Error(`${path} passive defense declaration is invalid`)
      }
    } else if (value.mechanic.kind === 'reaction-weapon-attack') {
      assertKeys(value.mechanic, ['kind', 'event', 'markAbilityId'], `${path} reaction weapon attack mechanic`)
      if (
        !['other-creature-hit', 'marked-target-attacks', 'enemy-attacks-other', 'nearby-creature-casts-spell'].includes(String(value.mechanic.event)) ||
        (value.mechanic.event === 'other-creature-hit' && trigger.kind !== 'after-attack-hit') ||
        (value.mechanic.event === 'marked-target-attacks' && trigger.kind !== 'before-attack-roll') ||
        (value.mechanic.event === 'enemy-attacks-other' && trigger.kind !== 'after-attack-roll') ||
        (value.mechanic.event === 'nearby-creature-casts-spell' && trigger.kind !== 'after-spell-cast') ||
        mechanicCost?.economy !== 'reaction' || mechanicTargeting?.kind !== 'single-creature' ||
        mechanicTargeting.relation !== 'enemy'
      ) throw new Error(`${path} reaction weapon attack declaration is invalid`)
      if (value.mechanic.event === 'marked-target-attacks') {
        assertId(value.mechanic.markAbilityId, `${path} marked target ability`)
      } else if (value.mechanic.markAbilityId != null) {
        throw new Error(`${path} unmarked reaction attack cannot reference a mark`)
      }
    } else if (value.mechanic.kind === 'marked-target') {
      assertKeys(value.mechanic, ['kind', 'attackAdvantage'], `${path} marked target mechanic`)
      if (
        value.mechanic.attackAdvantage !== true || trigger.kind !== 'active-use' ||
        mechanicTargeting?.kind !== 'single-creature' || mechanicTargeting.relation !== 'enemy' ||
        !record(value.duration) || value.duration.kind !== 'fixed-rounds'
      ) throw new Error(`${path} marked target declaration is invalid`)
    } else if (value.mechanic.kind === 'death-prevention') {
      assertKeys(value.mechanic, ['kind', 'hitPointsAfter', 'preventsMassiveDamage'], `${path} death prevention mechanic`)
      if (
        trigger.kind !== 'before-drop-to-zero' || mechanicTargeting?.kind !== 'self' ||
        (mechanicCost?.economy ?? 'none') !== 'none' ||
        !finiteInteger(value.mechanic.hitPointsAfter, 1, 1_000_000) ||
        (value.mechanic.preventsMassiveDamage != null && typeof value.mechanic.preventsMassiveDamage !== 'boolean')
      ) throw new Error(`${path} death prevention declaration is invalid`)
    } else if (value.mechanic.kind === 'spell-defeat-healing') {
      assertKeys(value.mechanic, ['kind', 'minimumSpellLevel', 'baseMultiplier', 'schoolMultipliers', 'excludedCreatureTypes', 'oncePerTurn'], `${path} spell defeat healing mechanic`)
      if (
        trigger.kind !== 'after-spell-cast' || mechanicTargeting?.kind !== 'self' ||
        !finiteInteger(value.mechanic.minimumSpellLevel, 1, 9) ||
        !finiteInteger(value.mechanic.baseMultiplier, 1, 20) ||
        (value.mechanic.oncePerTurn != null && typeof value.mechanic.oncePerTurn !== 'boolean')
      ) throw new Error(`${path} spell defeat healing declaration is invalid`)
      if (value.mechanic.schoolMultipliers != null) {
        if (!record(value.mechanic.schoolMultipliers)) throw new Error(`${path} spell defeat school multipliers are invalid`)
        for (const [school, multiplier] of Object.entries(value.mechanic.schoolMultipliers)) {
          if (!SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId) || !finiteInteger(multiplier, 1, 20)) {
            throw new Error(`${path} spell defeat school multipliers are invalid`)
          }
        }
      }
      if (value.mechanic.excludedCreatureTypes != null && (
        !Array.isArray(value.mechanic.excludedCreatureTypes) || value.mechanic.excludedCreatureTypes.length < 1 ||
        value.mechanic.excludedCreatureTypes.length > 32 ||
        value.mechanic.excludedCreatureTypes.some((type) => typeof type !== 'string' || !type.trim() || type.length > 80)
      )) throw new Error(`${path} spell defeat excluded creature types are invalid`)
    } else if (value.mechanic.kind === 'summoned-creature-bonus') {
      assertKeys(value.mechanic, ['kind', 'source', 'temporaryHitPoints', 'maximumHitPointBonus', 'weaponDamageBonus', 'spellSchools', 'spellIds'], `${path} summoned creature bonus mechanic`)
      if (
        value.mechanic.source !== 'spell' || trigger.kind !== 'after-spell-cast' ||
        (mechanicCost?.economy ?? 'none') !== 'none' ||
        (value.mechanic.temporaryHitPoints == null && value.mechanic.maximumHitPointBonus == null &&
          value.mechanic.weaponDamageBonus == null) ||
        (value.mechanic.spellSchools != null && (
          !Array.isArray(value.mechanic.spellSchools) || value.mechanic.spellSchools.length < 1 ||
          value.mechanic.spellSchools.some((school) => !SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId))
        )) || (value.mechanic.spellIds != null && (
          !Array.isArray(value.mechanic.spellIds) || value.mechanic.spellIds.length < 1 ||
          value.mechanic.spellIds.length > 32 ||
          value.mechanic.spellIds.some((spellId) => typeof spellId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(spellId)) ||
          new Set(value.mechanic.spellIds).size !== value.mechanic.spellIds.length
        ))
      ) throw new Error(`${path} summoned creature bonus declaration is invalid`)
      if (value.mechanic.temporaryHitPoints) validateFormula(value.mechanic.temporaryHitPoints, `${path} summoned temporary hit points`)
      if (value.mechanic.maximumHitPointBonus) validateFormula(value.mechanic.maximumHitPointBonus, `${path} summoned maximum hit point bonus`)
      if (value.mechanic.weaponDamageBonus) validateFormula(value.mechanic.weaponDamageBonus, `${path} summoned weapon damage bonus`)
    } else if (value.mechanic.kind === 'creature-form-eligibility') {
      assertKeys(value.mechanic, ['kind', 'system', 'creatureTypes', 'maximumChallengeRating', 'specificFormIds', 'requiresKnownForm', 'resourceCost', 'resourceMode', 'durationHours', 'activationEconomy', 'useCoreMovementLimits'], `${path} creature form eligibility mechanic`)
      if (
        value.mechanic.system !== 'wild-shape' || trigger.kind !== 'active-use' ||
        mechanicTargeting?.kind !== 'self' || (mechanicCost?.economy ?? 'none') !== 'none' ||
        !Array.isArray(value.mechanic.creatureTypes) || value.mechanic.creatureTypes.length < 1 ||
        value.mechanic.creatureTypes.length > 32 || value.mechanic.creatureTypes.some((type) =>
          typeof type !== 'string' || !type.trim() || type.length > 80) ||
        (value.mechanic.specificFormIds != null && (
          !Array.isArray(value.mechanic.specificFormIds) || value.mechanic.specificFormIds.length < 1 ||
          value.mechanic.specificFormIds.length > 64 || value.mechanic.specificFormIds.some((id) =>
            typeof id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(id)))) ||
        (value.mechanic.requiresKnownForm != null && typeof value.mechanic.requiresKnownForm !== 'boolean') ||
        (value.mechanic.resourceCost != null && !finiteInteger(value.mechanic.resourceCost, 1, 20)) ||
        (value.mechanic.resourceMode != null && (
          typeof value.mechanic.resourceMode !== 'string' ||
          !['core-wild-shape', 'ability-uses'].includes(value.mechanic.resourceMode)
        )) ||
        (value.mechanic.activationEconomy != null && value.mechanic.activationEconomy !== 'action' && value.mechanic.activationEconomy !== 'bonusAction') ||
        (value.mechanic.useCoreMovementLimits != null && typeof value.mechanic.useCoreMovementLimits !== 'boolean')
      ) throw new Error(`${path} creature form eligibility declaration is invalid`)
      validateFormula(value.mechanic.maximumChallengeRating, `${path} maximum challenge rating`)
      if (value.mechanic.durationHours) validateFormula(value.mechanic.durationHours, `${path} creature form duration`)
      if (value.mechanic.resourceMode === 'ability-uses' && (!record(value.limits) || value.limits.uses == null)) {
        throw new Error(`${path} ability-use creature form must declare a use limit`)
      }
    } else if (value.mechanic.kind === 'creature-form-control') {
      assertKeys(value.mechanic, ['kind', 'system', 'activationEconomy', 'inFormHealing'], `${path} creature form control mechanic`)
      const healing = value.mechanic.inFormHealing
      if (
        value.mechanic.system !== 'wild-shape' || trigger.kind !== 'active-use' ||
        mechanicTargeting?.kind !== 'self' || (mechanicCost?.economy ?? 'none') !== 'none' ||
        (value.mechanic.activationEconomy != null &&
          value.mechanic.activationEconomy !== 'action' && value.mechanic.activationEconomy !== 'bonusAction') ||
        (healing == null && value.mechanic.activationEconomy == null)
      ) throw new Error(`${path} creature form control declaration is invalid`)
      if (healing != null) {
        if (!record(healing)) throw new Error(`${path} in-form healing declaration is invalid`)
        assertKeys(healing, ['economy', 'resource', 'dicePerResourceLevel', 'maximumResourceLevel'], `${path} in-form healing`)
        if (
          !['action', 'bonusAction'].includes(String(healing.economy)) ||
          healing.resource !== 'spell-slot' || !record(healing.dicePerResourceLevel)
        ) throw new Error(`${path} in-form healing declaration is invalid`)
        assertKeys(healing.dicePerResourceLevel, ['count', 'sides'], `${path} in-form healing dice`)
        if (
          !finiteInteger(healing.dicePerResourceLevel.count, 1, 20) ||
          !finiteInteger(healing.dicePerResourceLevel.sides, 2, 100) ||
          (healing.maximumResourceLevel != null && !finiteInteger(healing.maximumResourceLevel, 1, 9))
        ) throw new Error(`${path} in-form healing declaration is invalid`)
      }
    } else if (value.mechanic.kind === 'bonus-weapon-attack') {
      assertKeys(value.mechanic, ['kind', 'event'], `${path} bonus weapon attack mechanic`)
      if (
        value.mechanic.event !== 'after-attack-action' || trigger.kind !== 'after-attack-roll' ||
        mechanicTargeting?.kind !== 'self' || mechanicCost?.economy !== 'bonusAction' ||
        !record(value.limits) || value.limits.uses == null ||
        !['combat', 'short-rest', 'long-rest'].includes(String(value.limits.reset))
      ) throw new Error(`${path} bonus weapon attack declaration is invalid`)
    } else if (value.mechanic.kind === 'turn-start-saving-throw-aura') {
      assertKeys(value.mechanic, [
        'kind', 'radiusFeet', 'relation', 'ability', 'dcAbility', 'condition',
        'durationRounds', 'breakOnDamage', 'magical', 'requiresMutualSight',
        'successfulSaveImmunityRounds', 'requiredEffectId',
      ], `${path} turn start saving throw aura mechanic`)
      if (
        trigger.kind !== 'active-use' || mechanicTargeting?.kind !== 'self' ||
        !finiteInteger(value.mechanic.radiusFeet, 5, 1_000) ||
        !['enemy', 'any'].includes(String(value.mechanic.relation)) ||
        !ABILITIES.has(value.mechanic.ability as AbilityKey) ||
        !ABILITIES.has(value.mechanic.dcAbility as AbilityKey) ||
        !CONDITION_IDS.has(String(value.mechanic.condition)) ||
        !finiteInteger(value.mechanic.durationRounds, 1, 14_400) ||
        (value.mechanic.breakOnDamage != null && typeof value.mechanic.breakOnDamage !== 'boolean') ||
        (value.mechanic.magical != null && typeof value.mechanic.magical !== 'boolean') ||
        (value.mechanic.requiresMutualSight != null && typeof value.mechanic.requiresMutualSight !== 'boolean') ||
        (value.mechanic.successfulSaveImmunityRounds != null &&
          !finiteInteger(value.mechanic.successfulSaveImmunityRounds, 1, 14_400))
      ) throw new Error(`${path} turn start saving throw aura declaration is invalid`)
      if (value.mechanic.requiredEffectId != null) {
        assertId(value.mechanic.requiredEffectId, `${path} turn start saving throw aura required effect`)
      }
    } else {
      throw new Error(`${path}机械协议无效`)
    }
  }

  if (value.predicates != null) {
    if (!record(value.predicates)) throw new Error(`${path}条件无效`)
    assertKeys(value.predicates, ['minimumLevel', 'classId', 'subclassId', 'equipmentIds', 'minimumDistanceFeet', 'maximumDistanceFeet', 'targetRelation', 'actorHasConditions', 'actorLacksConditions', 'targetHasConditions', 'targetLacksConditions', 'actorIllumination', 'targetIllumination', 'parentDamageTypes', 'parentSpellSchools', 'minimumParentSpellLevel', 'maximumParentSpellLevel', 'targetMaximumSizeRank', 'targetCreatureTypes', 'resources', 'subclassChoices', 'oncePerTurn'], `${path}条件`)
    const predicates = value.predicates
    if (predicates.minimumLevel != null && !finiteInteger(predicates.minimumLevel, 1, 20)) throw new Error(`${path}最低等级无效`)
    if (predicates.classId != null && !CLASS_IDS.has(predicates.classId as Dnd5eClassId)) throw new Error(`${path}职业条件无效`)
    if (predicates.subclassId != null) assertId(predicates.subclassId, `${path}子职条件`)
    if (predicates.minimumDistanceFeet != null && !finiteInteger(predicates.minimumDistanceFeet, 0, 10_000)) throw new Error(`${path}最小距离无效`)
    if (predicates.maximumDistanceFeet != null && !finiteInteger(predicates.maximumDistanceFeet, 0, 10_000)) throw new Error(`${path}最大距离无效`)
    if (predicates.targetRelation != null && !['self', 'ally', 'enemy', 'any'].includes(String(predicates.targetRelation))) throw new Error(`${path}目标关系无效`)
    if (predicates.equipmentIds != null && (!Array.isArray(predicates.equipmentIds) || predicates.equipmentIds.some((id) => typeof id !== 'string' || !ID.test(id)))) throw new Error(`${path}装备条件无效`)
    for (const key of ['actorHasConditions', 'actorLacksConditions', 'targetHasConditions', 'targetLacksConditions'] as const) {
      const conditions = predicates[key]
      if (conditions != null && (!Array.isArray(conditions) || conditions.some((condition) => !CONDITION_IDS.has(String(condition))))) throw new Error(`${path}状态条件无效`)
    }
    for (const key of ['actorIllumination', 'targetIllumination'] as const) {
      const illumination = predicates[key]
      if (illumination != null && (
        !Array.isArray(illumination) || illumination.length < 1 ||
        illumination.some((entry) => !['bright', 'dim', 'darkness', 'magical-darkness'].includes(String(entry))) ||
        new Set(illumination).size !== illumination.length
      )) throw new Error(`${path}光照条件无效`)
    }
    if (predicates.parentDamageTypes != null && (
      !Array.isArray(predicates.parentDamageTypes) || predicates.parentDamageTypes.length < 1 ||
      predicates.parentDamageTypes.some((damageType) => !DAMAGE_TYPES.has(String(damageType)))
    )) throw new Error(`${path}父伤害类型条件无效`)
    if (predicates.parentSpellSchools != null && (
      !Array.isArray(predicates.parentSpellSchools) || predicates.parentSpellSchools.length < 1 ||
      predicates.parentSpellSchools.some((school) => !SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId)) ||
      new Set(predicates.parentSpellSchools).size !== predicates.parentSpellSchools.length
    )) throw new Error(`${path}父法术学派条件无效`)
    if (predicates.minimumParentSpellLevel != null && !finiteInteger(predicates.minimumParentSpellLevel, 0, 9)) throw new Error(`${path}父法术最低环级无效`)
    if (predicates.maximumParentSpellLevel != null && !finiteInteger(predicates.maximumParentSpellLevel, 0, 9)) throw new Error(`${path}父法术最高环级无效`)
    if (predicates.minimumParentSpellLevel != null && predicates.maximumParentSpellLevel != null && predicates.minimumParentSpellLevel > predicates.maximumParentSpellLevel) throw new Error(`${path}父法术环级范围无效`)
    if (predicates.targetMaximumSizeRank != null && !finiteInteger(predicates.targetMaximumSizeRank, 0, 5)) {
      throw new Error(`${path}目标体型条件无效`)
    }
    if (predicates.targetCreatureTypes != null && (
      !Array.isArray(predicates.targetCreatureTypes) || predicates.targetCreatureTypes.length < 1 ||
      predicates.targetCreatureTypes.length > 32 ||
      predicates.targetCreatureTypes.some((type) => typeof type !== 'string' || !type.trim() || type.length > 80) ||
      new Set(predicates.targetCreatureTypes.map((type) => String(type).trim().toLocaleLowerCase())).size !== predicates.targetCreatureTypes.length
    )) throw new Error(`${path}目标生物类型无效`)
    if (predicates.resources != null) validateResourceAmounts(predicates.resources, `${path}资源条件`, 'minimum')
    if (predicates.subclassChoices != null) {
      if (!Array.isArray(predicates.subclassChoices) || predicates.subclassChoices.length > 16) {
        throw new Error(`${path}子职选择条件无效`)
      }
      const choices = new Set<string>()
      for (const choice of predicates.subclassChoices) {
        if (!record(choice)) throw new Error(`${path}子职选择条件无效`)
        assertKeys(choice, ['groupId', 'optionId'], `${path}子职选择条件`)
        assertId(choice.groupId, `${path}子职选择组`)
        assertId(choice.optionId, `${path}子职选择项`)
        const key = `${choice.groupId}/${choice.optionId}`
        if (choices.has(key)) throw new Error(`${path}子职选择条件重复`)
        choices.add(key)
      }
    }
  }

  if (value.cost != null) {
    if (!record(value.cost)) throw new Error(`${path}消耗无效`)
    assertKeys(value.cost, ['economy', 'movementFeet', 'resources', 'uses'], `${path}消耗`)
    if (value.cost.economy != null && !['action', 'bonusAction', 'reaction', 'none'].includes(String(value.cost.economy))) throw new Error(`${path}行动消耗无效`)
    if (value.cost.movementFeet != null && !finiteInteger(value.cost.movementFeet, 0, 1_000)) throw new Error(`${path}移动消耗无效`)
    if (value.cost.uses != null && !finiteInteger(value.cost.uses, 1, 1_000_000)) throw new Error(`${path}次数消耗无效`)
    if (value.cost.resources != null) validateResourceAmounts(value.cost.resources, `${path}资源消耗`, 'amount')
    if (value.cost.uses != null && (!record(value.limits) || value.limits.uses == null || value.limits.reset == null || value.limits.reset === 'none')) {
      throw new Error(`${path}声明次数消耗时必须提供可恢复的次数公式`)
    }
  }
  if (value.requirements != null) {
    if (!Array.isArray(value.requirements) || value.requirements.length > 32) throw new Error(`${path}通用条件无效`)
    const issues = value.requirements.flatMap((requirement) =>
      validateDnd5eActivityPredicateV1(requirement as Dnd5ePredicateV1))
    if (issues.length > 0) throw new Error(`${path}通用条件无效：${issues.join('；')}`)
  }

  const activityChoiceOptions = new Map<string, Set<string>>()
  if (value.choices != null) {
    if (!Array.isArray(value.choices) || value.choices.length < 1 || value.choices.length > 16) {
      throw new Error(`${path}运行时选择无效`)
    }
    for (const [index, choice] of value.choices.entries()) {
      if (!record(choice)) throw new Error(`${path}运行时选择 ${index} 无效`)
      assertKeys(choice, ['id', 'label', 'options', 'defaultOptionId'], `${path}运行时选择`)
      assertId(choice.id, `${path}运行时选择`)
      assertText(choice.label, `${path}运行时选择名称`, 160)
      if (activityChoiceOptions.has(choice.id)) throw new Error(`${path}运行时选择 ID 重复`)
      if (!Array.isArray(choice.options) || choice.options.length < 2 || choice.options.length > 32) {
        throw new Error(`${path}运行时选择选项无效`)
      }
      const options = new Set<string>()
      for (const option of choice.options) {
        if (!record(option)) throw new Error(`${path}运行时选择选项无效`)
        assertKeys(option, ['id', 'label', 'description', 'requirements'], `${path}运行时选择选项`)
        assertId(option.id, `${path}运行时选择选项`)
        assertText(option.label, `${path}运行时选择选项名称`, 160)
        if (option.description != null && (typeof option.description !== 'string' || option.description.length > 1_000)) {
          throw new Error(`${path}运行时选择选项说明无效`)
        }
        if (option.requirements != null) {
          if (!Array.isArray(option.requirements) || option.requirements.length > 16) throw new Error(`${path}运行时选择选项条件无效`)
          const issues = option.requirements.flatMap((requirement) => validateDnd5eActivityPredicateV1(requirement as Dnd5ePredicateV1))
          if (issues.length > 0) throw new Error(`${path}运行时选择选项条件无效：${issues.join('；')}`)
        }
        if (options.has(option.id)) throw new Error(`${path}运行时选择选项 ID 重复`)
        options.add(option.id)
      }
      if (choice.defaultOptionId != null && !options.has(String(choice.defaultOptionId))) {
        throw new Error(`${path}运行时选择默认项无效`)
      }
      activityChoiceOptions.set(choice.id, options)
    }
  }

  validateTargeting(value.targeting, `${path}目标`)
  const rollIds = new Set<string>()
  if (value.rolls != null) {
    if (!Array.isArray(value.rolls) || value.rolls.length > 32) throw new Error(`${path}骰子声明无效`)
    for (const roll of value.rolls) {
      if (!record(roll)) throw new Error(`${path}骰子声明无效`)
      assertId(roll.id, `${path}骰子`)
      if (rollIds.has(roll.id)) throw new Error(`${path}骰子 ID 重复`)
      rollIds.add(roll.id)
      assertText(roll.label, `${path}骰子名称`, 160)
      if (roll.kind === 'damage') {
        assertKeys(roll, ['id', 'kind', 'label', 'dice', 'damageType', 'hostRoll'], `${path}伤害骰`)
        validateDice(roll.dice, `${path}伤害骰`)
        if (roll.hostRoll != null) validateHostRollRecipe(roll.hostRoll, `${path}伤害骰`, true)
        if (roll.damageType !== 'parent-weapon' && !DAMAGE_TYPES.has(String(roll.damageType))) throw new Error(`${path}伤害类型无效`)
      } else if (roll.kind === 'healing') {
        assertKeys(roll, ['id', 'kind', 'label', 'dice', 'hostRoll'], `${path}治疗骰`)
        validateDice(roll.dice, `${path}治疗骰`)
        if (roll.hostRoll != null) validateHostRollRecipe(roll.hostRoll, `${path}治疗骰`, false)
      } else if (roll.kind === 'attack') {
        assertKeys(roll, ['id', 'kind', 'label', 'ability', 'proficiency'], `${path}攻击骰`)
        if (!ABILITIES.has(roll.ability as AbilityKey) || typeof roll.proficiency !== 'boolean') throw new Error(`${path}攻击骰无效`)
      } else if (roll.kind === 'saving-throw') {
        assertKeys(roll, ['id', 'kind', 'label', 'ability', 'abilityOptions', 'dc', 'onSuccess', 'rollMode', 'rollModeByCreatureType'], `${path}豁免`)
        if (!ABILITIES.has(roll.ability as AbilityKey)) throw new Error(`${path}豁免属性无效`)
        if (roll.abilityOptions != null) validateAbilityOptions(roll.abilityOptions, roll.ability as AbilityKey, `${path}豁免`)
        if (roll.onSuccess != null && !['none', 'half'].includes(String(roll.onSuccess))) throw new Error(`${path}豁免成功效果无效`)
        if (roll.rollMode != null && !['normal', 'advantage', 'disadvantage', 'host-derived'].includes(String(roll.rollMode))) throw new Error(`${path}豁免掷骰模式无效`)
        if (roll.rollModeByCreatureType != null) {
          if (!record(roll.rollModeByCreatureType)) throw new Error(`${path}生物类型豁免模式无效`)
          assertKeys(roll.rollModeByCreatureType, ['creatureTypes', 'mode'], `${path}生物类型豁免模式`)
          if (
            !Array.isArray(roll.rollModeByCreatureType.creatureTypes) ||
            roll.rollModeByCreatureType.creatureTypes.length < 1 ||
            roll.rollModeByCreatureType.creatureTypes.length > 32 ||
            roll.rollModeByCreatureType.creatureTypes.some((type) => typeof type !== 'string' || !type.trim() || type.length > 80) ||
            !['advantage', 'disadvantage'].includes(String(roll.rollModeByCreatureType.mode))
          ) throw new Error(`${path}生物类型豁免模式无效`)
        }
        validateFormula(roll.dc, `${path}豁免 DC`)
      } else throw new Error(`${path}骰子类型无效`)
    }
  }

  if (
    !Array.isArray(value.effects) ||
    (
      value.effects.length < 1 &&
      value.mechanic == null &&
      value.automation !== 'manual' &&
      value.automation !== 'partial'
    ) ||
    value.effects.length > 64
  ) throw new Error(`${path}效果无效`)
  for (const effect of value.effects) validateEffect(effect, rollIds, `${path}效果`)
  for (const effect of value.effects as DeclarativeSubclassEffectV1[]) {
    if (effect.whenChoice && !activityChoiceOptions.get(effect.whenChoice.choiceId)?.has(effect.whenChoice.optionId)) {
      throw new Error(`${path}效果引用了不存在的运行时选择`)
    }
  }
  const branchedEffects = (value.effects as DeclarativeSubclassEffectV1[])
    .filter((effect) => effect.when === 'save-failure' || effect.when === 'save-success')
  const savingThrowCount = ((value.rolls ?? []) as DeclarativeSubclassRollV1[])
    .filter((roll) => roll.kind === 'saving-throw').length
  if (branchedEffects.length > 0 && savingThrowCount !== 1) {
    throw new Error(`${path}豁免分支必须且只能对应一个豁免检定`)
  }
  if (branchedEffects.some((effect) => effect.kind === 'spend-resource' || effect.kind === 'restore-resource')) {
    throw new Error(`${path}资源效果不能依赖目标豁免分支`)
  }
  const activityEffectIds = new Set(activityEffectDefinitions.map((effect) => effect.id))
  for (const effect of value.effects) {
    if (effect.kind === 'activity-effect' && !activityEffectIds.has(effect.effectId)) {
      throw new Error(`${path}引用了不存在的 Activity 效果：${effect.effectId}`)
    }
  }
  if (
    value.mechanic?.kind === 'combat-maneuver' &&
    !rollIds.has(String(value.mechanic.superiorityRollId))
  ) {
    throw new Error(`${path}战技协议引用了未声明卓越骰`)
  }
  if (value.limits != null) {
    if (!record(value.limits)) throw new Error(`${path}次数限制无效`)
    assertKeys(value.limits, ['oncePerTurn', 'reset', 'uses'], `${path}次数限制`)
    if (value.limits.oncePerTurn != null && typeof value.limits.oncePerTurn !== 'boolean') throw new Error(`${path}每回合限制无效`)
    if (value.limits.reset != null && !['combat', 'short-rest', 'long-rest', 'none'].includes(String(value.limits.reset))) throw new Error(`${path}恢复时点无效`)
    if (value.limits.uses != null) validateFormula(value.limits.uses, `${path}次数公式`)
  }
  if (value.duration != null) validateDuration(value.duration, `${path}持续时间`)
}

function validateResourceAmounts(value: unknown, label: string, amountKey: 'minimum' | 'amount'): void {
  if (!Array.isArray(value) || value.length > 32) throw new Error(`${label}无效`)
  for (const entry of value) {
    if (!record(entry)) throw new Error(`${label}无效`)
    assertKeys(entry, ['resourceId', amountKey, 'scope'], label)
    assertId(entry.resourceId, label)
    if (entry.scope != null && !['plugin', 'core'].includes(String(entry.scope))) {
      throw new Error(`${label}作用域无效`)
    }
    if (!finiteInteger(entry[amountKey], 1, 1_000_000)) throw new Error(`${label}数量无效`)
  }
}

function validateTargeting(value: unknown, label: string): asserts value is DeclarativeSubclassTargetingV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}无效`)
  if (value.kind === 'self') {
    assertKeys(value, ['kind'], label)
    return
  }
  if (value.kind === 'single-creature') assertKeys(value, ['kind', 'relation', 'rangeFeet', 'includeSelf', 'requiresSight'], label)
  else if (value.kind === 'multiple-creatures') assertKeys(value, ['kind', 'relation', 'rangeFeet', 'maximumTargets', 'includeSelf'], label)
  else if (value.kind === 'area') assertKeys(value, ['kind', 'relation', 'includeSelf', 'maximumTargets', 'shape', 'rangeFeet', 'radiusFeet', 'lengthFeet', 'widthFeet', 'heightFeet'], label)
  else throw new Error(`${label}类型无效`)
  if (value.relation != null && !['ally', 'enemy', 'any'].includes(String(value.relation))) throw new Error(`${label}关系无效`)
  if (value.requiresSight != null && typeof value.requiresSight !== 'boolean') throw new Error(`${label}视线要求无效`)
  if (value.includeSelf != null && typeof value.includeSelf !== 'boolean') throw new Error(`${label}自身选项无效`)
  if (value.rangeFeet != null && !finiteInteger(value.rangeFeet, 0, 10_000)) throw new Error(`${label}距离无效`)
  if (value.maximumTargets != null && !finiteInteger(value.maximumTargets, 1, 256)) throw new Error(`${label}数量无效`)
  if (value.kind === 'area') {
    if (!['circle', 'cone', 'line', 'rect'].includes(String(value.shape))) throw new Error(`${label}范围形状无效`)
    for (const key of ['radiusFeet', 'lengthFeet', 'widthFeet', 'heightFeet'] as const) {
      if (value[key] != null && !finiteInteger(value[key], 1, 10_000)) throw new Error(`${label}范围尺寸无效`)
    }
  }
}

function validateEffect(value: unknown, rollIds: ReadonlySet<string>, label: string): asserts value is DeclarativeSubclassEffectV1 {
  if (!record(value) || typeof value.kind !== 'string') throw new Error(`${label}无效`)
  if (value.when != null && !['always', 'save-failure', 'save-success'].includes(String(value.when))) {
    throw new Error(`${label}豁免分支无效`)
  }
  if (value.whenChoice != null) {
    if (!record(value.whenChoice)) throw new Error(`${label}选择分支无效`)
    assertKeys(value.whenChoice, ['choiceId', 'optionId'], `${label}选择分支`)
    assertId(value.whenChoice.choiceId, `${label}选择`)
    assertId(value.whenChoice.optionId, `${label}选择项`)
  }
  if (value.kind === 'damage' || value.kind === 'healing') {
    assertKeys(value, ['kind', 'target', 'rollId', 'when', 'whenChoice'], label)
    if (!rollIds.has(String(value.rollId))) throw new Error(`${label}引用了不存在的骰子`)
  } else if (value.kind === 'temporary-hit-points') {
    assertKeys(value, ['kind', 'target', 'amount', 'rollId', 'when', 'whenChoice'], label)
    if ((value.amount == null) === (value.rollId == null)) throw new Error(`${label}必须且只能声明 amount 或 rollId`)
    if (value.amount != null) validateFormula(value.amount, `${label}数值`)
    if (value.rollId != null && !rollIds.has(String(value.rollId))) throw new Error(`${label}引用了不存在的骰子`)
  } else if (value.kind === 'standard-condition') {
    assertKeys(value, ['kind', 'target', 'condition', 'duration', 'when', 'whenChoice'], label)
    if (!CONDITION_IDS.has(String(value.condition))) throw new Error(`${label}标准状态无效`)
    validateDuration(value.duration, `${label}持续时间`)
  } else if (value.kind === 'activity-effect') {
    assertKeys(value, ['kind', 'target', 'effectId', 'when', 'whenChoice'], label)
    assertId(value.effectId, `${label} Activity 效果`)
  } else if (value.kind === 'move') {
    assertKeys(value, ['kind', 'target', 'distanceFeet', 'mode', 'originIllumination', 'destinationIllumination', 'requiresLineOfSight', 'ignoresOpportunityAttacks', 'when', 'whenChoice'], label)
    if (!finiteInteger(value.distanceFeet, 0, 10_000) || (value.mode != null && !['push', 'pull', 'teleport', 'swap'].includes(String(value.mode)))) throw new Error(`${label}移动无效`)
    for (const field of ['originIllumination', 'destinationIllumination'] as const) {
      if (value[field] != null && (
        !Array.isArray(value[field]) || value[field].length < 1 ||
        value[field].some((entry) => !['dim', 'darkness', 'magical-darkness'].includes(String(entry)))
      )) throw new Error(`${label}照明条件无效`)
    }
    if (value.requiresLineOfSight != null && typeof value.requiresLineOfSight !== 'boolean') throw new Error(`${label}视线条件无效`)
    if (value.ignoresOpportunityAttacks != null && typeof value.ignoresOpportunityAttacks !== 'boolean') throw new Error(`${label}借机攻击条件无效`)
  } else if (value.kind === 'dispel-area') {
    assertKeys(value, ['kind', 'target', 'areaKind', 'radiusFeet', 'maximumSpellLevel', 'when', 'whenChoice'], label)
    if (value.target !== 'actor' || value.areaKind !== 'magical-darkness' || !finiteInteger(value.radiusFeet, 1, 10_000)) {
      throw new Error(`${label}区域解除条件无效`)
    }
    validateFormula(value.maximumSpellLevel, `${label}最高法术环级`)
  } else if (value.kind === 'command-owned-companion') {
    assertKeys(value, ['kind', 'target', 'command', 'when', 'whenChoice'], label)
    if (value.target !== 'target' || !['attack', 'dash', 'disengage', 'dodge', 'help'].includes(String(value.command))) {
      throw new Error(`${label}伙伴指令无效`)
    }
  } else if (value.kind === 'spend-resource' || value.kind === 'restore-resource') {
    assertKeys(value, ['kind', 'resourceId', 'amount', 'scope', 'whenEmpty', 'when', 'whenChoice'], label)
    assertId(value.resourceId, label)
    if (value.scope != null && !['plugin', 'core'].includes(String(value.scope))) throw new Error(`${label}资源作用域无效`)
    validateFormula(value.amount, `${label}数值`)
    if (value.whenEmpty != null && (value.kind !== 'restore-resource' || typeof value.whenEmpty !== 'boolean')) {
      throw new Error(`${label}空资源恢复条件无效`)
    }
    return
  } else throw new Error(`${label}类型无效`)
  if (!['actor', 'target', 'all-targets'].includes(String(value.target))) throw new Error(`${label}目标无效`)
}

function validateLevelTable(
  value: unknown,
  label: string,
  entryValueKey: 'sides' | 'maxSelections' | 'maximum',
  valueMinimum: number,
  valueMaximum: number,
  minimumLevel = 1,
): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error(`${label}无效`)
  let previousLevel = 0
  for (const entry of value) {
    if (!record(entry)) throw new Error(`${label}条目无效`)
    assertKeys(entry, ['level', entryValueKey], `${label}条目`)
    if (
      !finiteInteger(entry.level, minimumLevel, 20) ||
      Number(entry.level) <= previousLevel ||
      !finiteInteger(entry[entryValueKey], valueMinimum, valueMaximum)
    ) throw new Error(`${label}条目无效`)
    previousLevel = Number(entry.level)
  }
}

function validateKnownCountTable(value: unknown, label: string): asserts value is readonly number[] {
  if (
    !Array.isArray(value) ||
    value.length !== 20 ||
    value.some((entry) => !finiteInteger(entry, 0, 100))
  ) throw new Error(`${label}必须包含 1–20 级的 20 个非负整数`)
  for (let index = 1; index < value.length; index += 1) {
    if (Number(value[index]) < Number(value[index - 1])) throw new Error(`${label}不能随等级降低`)
  }
}

function validateChoiceGroups(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${path}选择组列表无效`)
  const groupIds = new Set<string>()
  for (const group of value) {
    if (!record(group)) throw new Error(`${path}选择组无效`)
    assertKeys(group, ['id', 'level', 'name', 'description', 'maxSelections', 'maxSelectionsByLevel', 'options'], `${path}选择组`)
    assertId(group.id, `${path}选择组`)
    if (groupIds.has(group.id)) throw new Error(`${path}选择组 ID 重复`)
    groupIds.add(group.id)
    if (!finiteInteger(group.level, 1, 20) || !finiteInteger(group.maxSelections, 1, 64)) {
      throw new Error(`${path}选择组等级或上限无效`)
    }
    assertText(group.name, `${path}选择组名称`, 160)
    if (group.description != null && (typeof group.description !== 'string' || group.description.length > 4_000)) {
      throw new Error(`${path}选择组说明无效`)
    }
    if (!Array.isArray(group.options) || group.options.length < Number(group.maxSelections) || group.options.length > 128) {
      throw new Error(`${path}选择组选项无效`)
    }
    const optionIds = new Set<string>()
    for (const option of group.options) {
      if (!record(option)) throw new Error(`${path}选择组选项无效`)
      assertKeys(option, ['id', 'name', 'summary'], `${path}选择组选项`)
      assertId(option.id, `${path}选择组选项`)
      if (optionIds.has(option.id)) throw new Error(`${path}选择组选项 ID 重复`)
      optionIds.add(option.id)
      assertText(option.name, `${path}选择组选项名称`, 160)
      assertText(option.summary, `${path}选择组选项摘要`)
    }
    if (group.maxSelectionsByLevel != null) {
      validateLevelTable(group.maxSelectionsByLevel, `${path}选择组分级上限`, 'maxSelections', 1, 64, Number(group.level))
      let previousMaximum = Number(group.maxSelections)
      for (const step of group.maxSelectionsByLevel as Array<Record<string, unknown>>) {
        if (Number(step.maxSelections) < previousMaximum || Number(step.maxSelections) > group.options.length) {
          throw new Error(`${path}选择组分级上限必须累计递增且不超过选项数`)
        }
        previousMaximum = Number(step.maxSelections)
      }
    }
  }
}

export function validateDeclarativeSubclassSpellcastingV1(
  value: unknown,
  path = '子职施法',
): asserts value is DeclarativeSubclassSpellcastingV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, [
    'progression', 'learning', 'ability', 'spellListClassId',
    'cantripChoiceGroupId', 'spellChoiceGroupId',
    'cantripsKnownByClassLevel', 'spellsKnownByClassLevel',
    'requiredCantripIds',
    'allowedSchools', 'unrestrictedSpellsKnownByClassLevel',
    'ritualCasting', 'focus',
  ], path)
  if (value.progression !== 'one-third' || value.learning !== 'known') {
    throw new Error(`${path}目前仅支持 one-third + known`)
  }
  if (!ABILITIES.has(value.ability as AbilityKey)) throw new Error(`${path}施法属性无效`)
  if (!SPELLCASTING_CLASS_IDS.has(value.spellListClassId as Dnd5eSpellcastingClassId)) {
    throw new Error(`${path}法术表职业无效`)
  }
  assertId(value.cantripChoiceGroupId, `${path}戏法选择组`)
  assertId(value.spellChoiceGroupId, `${path}法术选择组`)
  if (value.cantripChoiceGroupId === value.spellChoiceGroupId) throw new Error(`${path}选择组 ID 不能相同`)
  validateKnownCountTable(value.cantripsKnownByClassLevel, `${path}戏法已知表`)
  validateKnownCountTable(value.spellsKnownByClassLevel, `${path}法术已知表`)
  if (value.requiredCantripIds != null) {
    if (
      !Array.isArray(value.requiredCantripIds) ||
      value.requiredCantripIds.length < 1 ||
      value.requiredCantripIds.length > 32 ||
      value.requiredCantripIds.some((id) => typeof id !== 'string' || !ID.test(id)) ||
      new Set(value.requiredCantripIds).size !== value.requiredCantripIds.length
    ) throw new Error(`${path}固定戏法无效`)
    const positiveKnownCounts = value.cantripsKnownByClassLevel
      .map(Number)
      .filter((count) => count > 0)
    if (
      positiveKnownCounts.length < 1 ||
      value.requiredCantripIds.length > Math.min(...positiveKnownCounts)
    ) throw new Error(`${path}固定戏法数不能超过已知戏法上限`)
  }
  if (value.allowedSchools != null) {
    if (
      !Array.isArray(value.allowedSchools) ||
      value.allowedSchools.length < 1 ||
      value.allowedSchools.length > SPELL_SCHOOLS.size ||
      value.allowedSchools.some((school) => !SPELL_SCHOOLS.has(school as Dnd5eSpellbookSchoolId)) ||
      new Set(value.allowedSchools).size !== value.allowedSchools.length
    ) throw new Error(`${path}学派限制无效`)
  }
  if (value.unrestrictedSpellsKnownByClassLevel != null) {
    validateKnownCountTable(value.unrestrictedSpellsKnownByClassLevel, `${path}不限学派已知表`)
    for (let index = 0; index < 20; index += 1) {
      if (Number(value.unrestrictedSpellsKnownByClassLevel[index]) > Number(value.spellsKnownByClassLevel[index])) {
        throw new Error(`${path}不限学派法术数不能超过总已知法术数`)
      }
    }
  }
  if (typeof value.ritualCasting !== 'boolean') throw new Error(`${path}仪式施法标记无效`)
  assertText(value.focus, `${path}法器`, 160)
}

export function validateDeclarativeSubclassSpellListsV1(
  value: unknown,
  path = '子职法术表',
): asserts value is readonly DeclarativeSubclassSpellListV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new Error(`${path}无效`)
  const listIds = new Set<string>()
  for (const list of value) {
    if (!record(list)) throw new Error(`${path}条目无效`)
    assertKeys(list, ['id', 'name', 'mode', 'entries'], `${path}条目`)
    assertId(list.id, `${path}条目`)
    if (listIds.has(list.id)) throw new Error(`${path} ID 重复`)
    listIds.add(list.id)
    assertText(list.name, `${path}名称`, 160)
    if (!['always-prepared', 'expanded-list'].includes(String(list.mode))) throw new Error(`${path}模式无效`)
    if (!Array.isArray(list.entries) || list.entries.length < 1 || list.entries.length > 20) {
      throw new Error(`${path}等级条目无效`)
    }
    let previousLevel = 0
    for (const entry of list.entries) {
      if (!record(entry)) throw new Error(`${path}等级条目无效`)
      assertKeys(entry, ['classLevel', 'spellIds'], `${path}等级条目`)
      if (!finiteInteger(entry.classLevel, 1, 20) || Number(entry.classLevel) <= previousLevel) {
        throw new Error(`${path}等级必须严格递增`)
      }
      previousLevel = Number(entry.classLevel)
      if (
        !Array.isArray(entry.spellIds) || entry.spellIds.length < 1 || entry.spellIds.length > 16 ||
        entry.spellIds.some((spellId) => typeof spellId !== 'string' || !ID.test(spellId)) ||
        new Set(entry.spellIds).size !== entry.spellIds.length
      ) throw new Error(`${path}法术 ID 列表无效`)
    }
  }
}

export function validateDeclarativeSubclassDefinitionV1(value: unknown, path = '子职'): asserts value is DeclarativeSubclassDefinitionV1 {
  if (!record(value)) throw new Error(`${path}无效`)
  assertKeys(value, [
    'schemaVersion', 'id', 'classId', 'name', 'summary',
    'resources', 'choiceGroups', 'spellcasting', 'spellLists', 'advancements', 'combatHooks', 'abilities',
  ], path)
  if (value.schemaVersion !== 1) throw new Error(`${path} schemaVersion 不受支持`)
  assertId(value.id, path)
  if (!CLASS_IDS.has(value.classId as Dnd5eClassId)) throw new Error(`${path}所属职业无效`)
  assertText(value.name, `${path}名称`, 160)
  assertText(value.summary, `${path}摘要`)
  if (!Array.isArray(value.abilities) || value.abilities.length < 1 || value.abilities.length > 128) throw new Error(`${path}能力列表无效`)
  const abilityIds = new Set<string>()
  for (const ability of value.abilities as DeclarativeSubclassAbilityV1[]) {
    validateDeclarativeSubclassAbilityV1(ability, `${path}能力`)
    if (abilityIds.has(ability.id)) throw new Error(`${path}能力 ID 重复`)
    abilityIds.add(ability.id)
  }
  const resourceIds = new Set<string>()
  const resourcesById = new Map<string, DeclarativeSubclassResourceV1>()
  if (value.resources != null) {
    if (!Array.isArray(value.resources) || value.resources.length > 64) throw new Error(`${path}资源列表无效`)
    for (const resource of value.resources) {
      if (!record(resource)) throw new Error(`${path}资源无效`)
      assertKeys(resource, ['id', 'label', 'minimumLevel', 'maximum', 'maximumByClassLevel', 'resetOn', 'die'], `${path}资源`)
      assertId(resource.id, `${path}资源`)
      if (resourceIds.has(resource.id)) throw new Error(`${path}资源 ID 重复`)
      resourceIds.add(resource.id)
      resourcesById.set(resource.id, resource as unknown as DeclarativeSubclassResourceV1)
      assertText(resource.label, `${path}资源名称`, 160)
      if (resource.minimumLevel != null && !finiteInteger(resource.minimumLevel, 1, 20)) throw new Error(`${path}资源等级无效`)
      validateFormula(resource.maximum, `${path}资源上限`)
      if (resource.maximumByClassLevel != null) {
        validateLevelTable(resource.maximumByClassLevel, `${path}资源上限成长表`, 'maximum', 0, 1_000_000)
        let previousMaximum = -1
        for (const step of resource.maximumByClassLevel as Array<Record<string, unknown>>) {
          if (Number(step.maximum) < previousMaximum) throw new Error(`${path}资源上限不能随等级降低`)
          previousMaximum = Number(step.maximum)
        }
      }
      if (!['combat', 'short-rest', 'long-rest'].includes(String(resource.resetOn))) throw new Error(`${path}资源恢复时点无效`)
      if (resource.die != null) {
        if (!record(resource.die)) throw new Error(`${path}资源骰无效`)
        assertKeys(resource.die, ['sides', 'sidesByClassLevel'], `${path}资源骰`)
        if (!finiteInteger(resource.die.sides, 2, 100)) throw new Error(`${path}资源骰面数无效`)
        if (resource.die.sidesByClassLevel != null) {
          validateLevelTable(resource.die.sidesByClassLevel, `${path}资源骰成长表`, 'sides', 2, 100)
          let previousSides = Number(resource.die.sides)
          for (const step of resource.die.sidesByClassLevel as Array<Record<string, unknown>>) {
            if (Number(step.sides) < previousSides) throw new Error(`${path}资源骰面数不能随等级降低`)
            previousSides = Number(step.sides)
          }
        }
      }
    }
  }
  // Limited-use abilities are materialized as Host-owned plugin resources by
  // the compiler. Make those stable local ids available to sibling abilities
  // (for example an event-triggered recharge Activity).
  for (const ability of value.abilities as DeclarativeSubclassAbilityV1[]) {
    if (ability.limits?.uses && ability.limits.reset && ability.limits.reset !== 'none') {
      resourceIds.add(`decl-${value.id}-${ability.id}-uses`)
    }
  }
  if (value.choiceGroups != null) validateChoiceGroups(value.choiceGroups, path)
  const choiceOptionsByGroupId = new Map<string, ReadonlySet<string>>(
    (value.choiceGroups as DeclarativeSubclassChoiceGroupV1[] | undefined)?.map((group) => [
      group.id,
      new Set(group.options.map((option) => option.id)),
    ]) ?? [],
  )
  if (value.spellcasting != null) validateDeclarativeSubclassSpellcastingV1(value.spellcasting, `${path}施法`)
  if (value.spellLists != null) validateDeclarativeSubclassSpellListsV1(value.spellLists, `${path}法术表`)
  if (value.advancements != null) {
    if (!Array.isArray(value.advancements) || value.advancements.length < 1 || value.advancements.length > 64) {
      throw new Error(`${path}构筑成长列表无效`)
    }
    const errors = validateDnd5eAdvancementCollectionV1(
      value.advancements as Dnd5eAdvancementDefinitionV1[],
    )
    if (errors.length > 0) throw new Error(`${path}构筑成长无效：${errors.join('；')}`)
  }
  if (value.combatHooks != null) {
    if (!Array.isArray(value.combatHooks) || value.combatHooks.length > 128) throw new Error(`${path}战斗钩子列表无效`)
    const hookIds = new Set<string>()
    for (const hook of value.combatHooks) {
      if (!record(hook)) throw new Error(`${path}战斗钩子无效`)
      assertKeys(
        hook,
        ['id', 'timing', 'abilityId', 'decision', 'activation', 'retention', 'exclusiveGroup', 'oncePerTurn'],
        `${path}战斗钩子`,
      )
      assertId(hook.id, `${path}战斗钩子`)
      if (hookIds.has(hook.id)) throw new Error(`${path}战斗钩子 ID 重复`)
      hookIds.add(hook.id)
      if (!COMBAT_HOOK_TIMINGS.has(hook.timing as DeclarativeSubclassCombatHookTimingV1)) {
        throw new Error(`${path}战斗钩子时点无效`)
      }
      assertId(hook.abilityId, `${path}战斗钩子能力`)
      if (!abilityIds.has(hook.abilityId)) throw new Error(`${path}战斗钩子引用了未声明能力：${hook.abilityId}`)
      if (!['automatic', 'actor-choice', 'target-choice', 'dm-confirm'].includes(String(hook.decision))) {
        throw new Error(`${path}战斗钩子决策模式无效`)
      }
      if (
        hook.activation != null &&
        !['automatic', 'prearm', 'interrupt'].includes(String(hook.activation))
      ) {
        throw new Error(`${path}战斗钩子激活模式无效`)
      }
      if (
        hook.retention != null &&
        !['single-attempt', 'until-triggered', 'until-turn-end'].includes(String(hook.retention))
      ) {
        throw new Error(`${path}战斗钩子保留策略无效`)
      }
      const activation = hook.activation ??
        (hook.decision === 'automatic' ? 'automatic' : 'interrupt')
      if (activation === 'prearm') {
        if (hook.decision !== 'actor-choice') {
          throw new Error(`${path}预激活战斗钩子必须由行动者决定`)
        }
        if (!['before-attack-roll', 'after-attack-roll', 'after-attack-hit'].includes(String(hook.timing))) {
          throw new Error(`${path}预激活战斗钩子必须绑定攻击检定时点`)
        }
      } else if (hook.retention != null) {
        throw new Error(`${path}只有预激活战斗钩子可以声明保留策略`)
      }
      if (hook.exclusiveGroup != null) {
        assertId(hook.exclusiveGroup, `${path}战斗钩子互斥组`)
        if (activation !== 'prearm') throw new Error(`${path}只有预激活战斗钩子可以声明互斥组`)
      }
      if (activation === 'automatic' && hook.decision !== 'automatic') {
        throw new Error(`${path}自动战斗钩子必须使用 automatic 决策模式`)
      }
      if (hook.oncePerTurn != null && typeof hook.oncePerTurn !== 'boolean') throw new Error(`${path}战斗钩子回合限制无效`)
    }
  }
  for (const ability of value.abilities as DeclarativeSubclassAbilityV1[]) {
    if (ability.mechanic?.kind === 'persistent-companion') {
      const options = choiceOptionsByGroupId.get(ability.mechanic.choiceGroupId)
      if (
        !options || ability.mechanic.companions.some((companion) => !options.has(companion.optionId))
      ) throw new Error(`${path}能力 ${ability.id} 引用了无效的伙伴选择`)
    }
    const mitigationMechanic = ability.mechanic?.kind === 'damage-mitigation-interrupt'
      ? ability.mechanic
      : undefined
    if (mitigationMechanic?.mode === 'ward-pool') {
      const poolAbility = (value.abilities as DeclarativeSubclassAbilityV1[]).find(
        (candidate) => candidate.id === mitigationMechanic.poolAbilityId,
      )
      if (
        poolAbility?.mechanic?.kind !== 'ward-pool' ||
        poolAbility.level > ability.level
      ) {
        throw new Error(`${path}能力 ${ability.id} 引用了无效或尚未获得的结界生命池`)
      }
    }
    const choiceMechanic = ability.mechanic?.kind === 'post-spell-random-table-choice'
      ? ability.mechanic
      : undefined
    if (choiceMechanic) {
      const tableAbility = (value.abilities as DeclarativeSubclassAbilityV1[]).find(
        (candidate) => candidate.id === choiceMechanic.tableAbilityId,
      )
      if (
        tableAbility?.mechanic?.kind !== 'post-spell-random-table' ||
        ability.level < tableAbility.level
      ) {
        throw new Error(`${path}能力 ${ability.id} 引用了无效的施法后随机表能力`)
      }
    }
    const reactionMechanic = ability.mechanic?.kind === 'reaction-weapon-attack'
      ? ability.mechanic
      : undefined
    if (reactionMechanic?.event === 'marked-target-attacks') {
      const markAbility = (value.abilities as DeclarativeSubclassAbilityV1[]).find(
        (candidate) => candidate.id === reactionMechanic.markAbilityId,
      )
      if (
        markAbility?.mechanic?.kind !== 'marked-target' ||
        markAbility.level > ability.level
      ) throw new Error(`${path}能力 ${ability.id} 引用了无效或尚未获得的目标标记`)
    }
    for (const choice of ability.predicates?.subclassChoices ?? []) {
      const options = choiceOptionsByGroupId.get(choice.groupId)
      if (!options?.has(choice.optionId)) {
        throw new Error(`${path}能力 ${ability.id} 引用了未声明子职选择：${choice.groupId}/${choice.optionId}`)
      }
    }
    const referenced = [
      ...(ability.predicates?.resources ?? []).flatMap((entry) =>
        entry.scope === 'core' ? [] : [entry.resourceId]),
      ...(ability.cost?.resources ?? []).flatMap((entry) =>
        entry.scope === 'core' ? [] : [entry.resourceId]),
      ...(ability.rolls ?? []).flatMap((roll) =>
        (roll.kind === 'damage' || roll.kind === 'healing') && roll.hostRoll
          ? [roll.hostRoll.die.resourceId]
          : []
      ),
      ...(ability.mechanic?.kind === 'combat-maneuver' ? [ability.mechanic.resourceId] : []),
      ...ability.effects.flatMap((effect) => effect.kind === 'spend-resource' || effect.kind === 'restore-resource'
        ? effect.scope === 'core' ? [] : [effect.resourceId]
        : []),
    ]
    const missing = referenced.find((resourceId) => !resourceIds.has(resourceId))
    if (missing) throw new Error(`${path}能力 ${ability.id} 引用了未声明资源：${missing}`)
    for (const roll of ability.rolls ?? []) {
      if (
        roll.kind === 'damage' &&
        roll.damageType === 'parent-weapon' &&
        ability.mechanic?.kind !== 'weapon-damage-rider' &&
        (
          !roll.hostRoll ||
          (
            ability.trigger.kind !== 'after-attack-hit' &&
            ability.mechanic?.kind !== 'combat-maneuver'
          )
        )
      ) {
        throw new Error(`${path}能力 ${ability.id} 只有命中后 Host 掷骰可以继承武器伤害类型`)
      }
      if ((roll.kind !== 'damage' && roll.kind !== 'healing') || !roll.hostRoll) continue
      const resourceId = roll.hostRoll.die.resourceId
      const resource = resourcesById.get(resourceId)
      if (!resource?.die) throw new Error(`${path}能力 ${ability.id} 的 Host 掷骰资源没有声明资源骰：${resourceId}`)
      if (roll.dice.count < 1) throw new Error(`${path}能力 ${ability.id} 的 Host 掷骰数量必须大于零`)
      const maximumDiceCount = roll.dice.count +
        (roll.dice.scaling?.steps.reduce((total, step) => total + step.addDice, 0) ?? 0)
      if (maximumDiceCount > 12) {
        throw new Error(`${path}能力 ${ability.id} 的 Host 单项掷骰数量不能超过 12`)
      }
      if (roll.dice.sides !== resource.die.sides) {
        throw new Error(`${path}能力 ${ability.id} 的 Host 掷骰基础骰面必须匹配资源骰：${resourceId}`)
      }
      if (!ability.cost?.resources?.some((cost) => cost.resourceId === resourceId && cost.amount > 0)) {
        throw new Error(`${path}能力 ${ability.id} 必须声明消耗 Host 掷骰资源：${resourceId}`)
      }
    }
  }
}

export function declarativeAbilityCompatibilityV1(ability: DeclarativeSubclassAbilityV1): DeclarativeAbilityCompatibilityEntryV1 {
  const reasons: string[] = []
  const auditedCombatManeuver = ability.mechanic?.kind === 'combat-maneuver'
  const auditedMartialSpellSynergy = ability.mechanic?.kind === 'martial-spell-synergy'
  const auditedRageFeature = ability.mechanic?.kind === 'rage-feature'
  const auditedOpeningAttack = ability.mechanic?.kind === 'opening-attack'
  const auditedHiddenSpellSave =
    ability.mechanic?.kind === 'hidden-spell-save-disadvantage'
  const auditedUtilityProjection =
    ability.mechanic?.kind === 'utility-projection-control' ||
    ability.mechanic?.kind === 'utility-projection-attack-advantage'
  const auditedNextD20 = ability.mechanic?.kind === 'next-d20-advantage'
  const auditedPostD20Adjustment = ability.mechanic?.kind === 'post-d20-adjustment'
  const auditedD20ChoiceReroll = ability.mechanic?.kind === 'd20-choice-reroll'
  const auditedPostSpellRandomTable =
    ability.mechanic?.kind === 'post-spell-random-table'
  const auditedPostSpellRandomTableChoice =
    ability.mechanic?.kind === 'post-spell-random-table-choice'
  const auditedSpellDamageMaxDieBonus =
    ability.mechanic?.kind === 'spell-damage-max-die-bonus'
  const auditedPersistentCompanion = ability.mechanic?.kind === 'persistent-companion'
  const auditedCompanionProfileUpgrade = ability.mechanic?.kind === 'companion-profile-upgrade'
  const auditedCreatureSpaceTraversal = ability.mechanic?.kind === 'creature-space-traversal'
  const auditedEnvironmentalMovement = ability.mechanic?.kind === 'environmental-movement'
  const auditedPersistentProjection = ability.mechanic?.kind === 'persistent-projection'
  const auditedPersistentProjectionUpgrade = ability.mechanic?.kind === 'persistent-projection-upgrade'
  const auditedAlternateResourceSpellcasting = ability.mechanic?.kind === 'alternate-resource-spellcasting'
  const auditedGrantedDieCombatOptions = ability.mechanic?.kind === 'granted-die-combat-options'
  const auditedAttackDisadvantage = ability.mechanic?.kind === 'attack-disadvantage-interrupt'
  const auditedAttackRetarget = ability.mechanic?.kind === 'attack-retarget-interrupt'
  const auditedDamageMitigation = ability.mechanic?.kind === 'damage-mitigation-interrupt'
  const auditedWardPool = ability.mechanic?.kind === 'ward-pool'
  const auditedSpellResistanceAura = ability.mechanic?.kind === 'spell-damage-resistance-aura'
  const auditedStoredD20Replacement = ability.mechanic?.kind === 'stored-d20-replacement'
  const auditedAttacksPerAction = ability.mechanic?.kind === 'attacks-per-action'
  const auditedWeaponDamageRider = ability.mechanic?.kind === 'weapon-damage-rider'
  const auditedSpellDamageAbilityModifier = ability.mechanic?.kind === 'spell-damage-ability-modifier'
  const auditedSpellAbilityCheckBonus = ability.mechanic?.kind === 'spell-ability-check-bonus'
  const auditedSpellInterception = ability.mechanic?.kind === 'spell-interception'
  const auditedSpellTargetExpansion = ability.mechanic?.kind === 'spell-target-expansion'
  const auditedDamageRollMaximization = ability.mechanic?.kind === 'damage-roll-maximization'
  const auditedAttackTradeoff = ability.mechanic?.kind === 'attack-tradeoff'
  const auditedPassiveDefense = ability.mechanic?.kind === 'passive-defense'
  const auditedReactionWeaponAttack = ability.mechanic?.kind === 'reaction-weapon-attack'
  const auditedMarkedTarget = ability.mechanic?.kind === 'marked-target'
  const auditedDeathPrevention = ability.mechanic?.kind === 'death-prevention'
  const auditedSpellDefeatHealing = ability.mechanic?.kind === 'spell-defeat-healing'
  const auditedSummonedCreatureBonus = ability.mechanic?.kind === 'summoned-creature-bonus'
  const auditedCreatureFormEligibility = ability.mechanic?.kind === 'creature-form-eligibility'
  const auditedCreatureFormControl = ability.mechanic?.kind === 'creature-form-control'
  const auditedBonusWeaponAttack = ability.mechanic?.kind === 'bonus-weapon-attack'
  const auditedTurnStartSavingThrowAura =
    ability.mechanic?.kind === 'turn-start-saving-throw-aura'
  const auditedMechanic = auditedCombatManeuver || auditedMartialSpellSynergy ||
    auditedRageFeature || auditedOpeningAttack || auditedHiddenSpellSave ||
    auditedUtilityProjection || auditedNextD20 || auditedPostD20Adjustment ||
    auditedD20ChoiceReroll ||
    auditedPostSpellRandomTable || auditedPostSpellRandomTableChoice ||
    auditedSpellDamageMaxDieBonus || auditedPersistentCompanion || auditedCompanionProfileUpgrade ||
    auditedCreatureSpaceTraversal || auditedEnvironmentalMovement || auditedPersistentProjection || auditedPersistentProjectionUpgrade || auditedAlternateResourceSpellcasting || auditedGrantedDieCombatOptions || auditedAttackDisadvantage || auditedAttackRetarget ||
    auditedDamageMitigation || auditedWardPool || auditedSpellResistanceAura ||
    auditedStoredD20Replacement || auditedAttacksPerAction || auditedWeaponDamageRider ||
    auditedSpellDamageAbilityModifier || auditedSpellAbilityCheckBonus || auditedSpellInterception || auditedSpellTargetExpansion || auditedDamageRollMaximization || auditedAttackTradeoff || auditedPassiveDefense || auditedReactionWeaponAttack ||
    auditedMarkedTarget || auditedDeathPrevention || auditedSpellDefeatHealing || auditedSummonedCreatureBonus || auditedCreatureFormEligibility || auditedCreatureFormControl || auditedBonusWeaponAttack || auditedTurnStartSavingThrowAura
  if (ability.canModifyEnemyD20 && !auditedStoredD20Replacement) {
    reasons.push('改变敌方 d20 需要玩家声明并由 DM 在投掷后 Interrupt 窗口确认')
  }
  if (!auditedMechanic && ability.effects.some((effect) =>
    effect.kind === 'temporary-hit-points' &&
    effect.amount?.kind === 'fixed' &&
    effect.amount.value === 0
  )) reasons.push('旧 feature/action 未提供结构化效果，需由 DM 补全后才能自动结算')
  if (ability.predicates?.equipmentIds?.length) reasons.push('战斗快照尚未暴露可验证的装备实例 ID')
  if (!auditedMechanic && (ability.cost?.movementFeet ?? 0) > 0) reasons.push('移动消耗尚未接入通用特性事务')
  if (ability.limits?.uses && (!ability.limits.reset || ability.limits.reset === 'none')) reasons.push('有限次数必须声明战斗、短休或长休恢复时点')
  if (!auditedMechanic && ability.rolls?.some((roll) => roll.kind === 'attack')) reasons.push('声明式能力攻击检定尚需通用攻击事务')
  if (!auditedMechanic && (ability.rolls?.filter((roll) => roll.kind === 'saving-throw').length ?? 0) > 1) {
    reasons.push('单个能力包含多个独立豁免，仍需声明各效果对应的检查分支')
  }
  if (ability.rolls?.some((roll) =>
    (roll.kind === 'damage' || roll.kind === 'healing') &&
    roll.dice.scaling &&
    !roll.hostRoll &&
    ability.mechanic?.kind !== 'weapon-damage-rider'
  )) reasons.push('动态增加骰数尚需按角色快照生成 Host 掷骰配方')
  if (!auditedPersistentProjection && (ability.duration?.kind === 'concentration' || ability.effects.some((effect) => effect.kind === 'standard-condition' && effect.duration.kind === 'concentration'))) reasons.push('声明式专注来源尚未开放安全绑定')
  // Permanent standard conditions are safe data-only ActiveEffects. Their
  // removal remains an explicit spell, rule or DM transaction, so they no
  // longer require an up-front adjudication merely because they are durable.
  // Standard conditions now compile to the shared ActiveEffect duration
  // contract, including source-turn-end. Keep the compatibility audit aligned
  // with the actual Activity compiler instead of downgrading valid workshop
  // content to partial automation.
  if (
    ability.duration &&
    ability.duration.kind !== 'instantaneous' &&
    ability.mechanic?.kind !== 'utility-projection-attack-advantage' &&
    ability.mechanic?.kind !== 'persistent-projection' &&
    ability.mechanic?.kind !== 'marked-target'
  ) reasons.push('能力级持续时间尚未绑定具体状态或区域实例')

  const safeTurnStartResourceRestore = ability.trigger.kind === 'turn-start' &&
    (ability.cost?.economy ?? 'none') === 'none' &&
    !(ability.rolls?.length) &&
    ability.effects.length > 0 &&
    ability.effects.every((effect) => effect.kind === 'restore-resource')
  const activityTriggerRouted = ability.trigger.kind === 'after-damage-taken' ||
    ability.trigger.kind === 'after-spell-cast' || ability.trigger.kind === 'after-condition-attempted' ||
    ability.trigger.kind === 'after-condition-applied' ||
    ability.trigger.kind === 'turn-start'
  if (
    !auditedMechanic &&
    !safeTurnStartResourceRestore &&
    !activityTriggerRouted &&
    ability.trigger.kind !== 'active-use' &&
    ability.trigger.kind !== 'after-attack-hit'
  ) {
    reasons.push('该触发时点已保留协议，但尚未接入权威事件调度器')
  }
  if (ability.trigger.kind === 'after-attack-hit') {
    if (
      (ability.cost?.economy ?? 'none') !== 'none' &&
      !auditedReactionWeaponAttack
    ) reasons.push('命中后需要选择是否消耗行动经济，必须经过 Interrupt')
    // Generic after-hit Activities are now routed through the production
    // trigger window. The Host compiles and rolls their dice only after the
    // actor accepts the Interrupt, so a bespoke weapon-rider mechanic is not
    // required for ordinary data-only damage/healing operations.
  }
  // An explicitly assisted declaration may intentionally have no Host-side
  // effect yet.  Its action economy, resources, targeting and rolls are still
  // an executable safe subset; the remaining narrative effect is guarded by
  // the shared DM-approval boundary instead of degrading the whole feature to
  // non-actionable manual metadata.
  const executableEffects = auditedMechanic || ability.effects.length > 0 || ability.automation === 'partial'
  if (ability.automation === 'partial' && reasons.length === 0) reasons.push('作者要求在执行安全子集前由 DM 确认')
  if (ability.automation === 'manual' && reasons.length === 0) reasons.push('作者将该能力标记为仅供 DM 手动裁定')
  let effective: DeclarativeSubclassAbilityV1['automation']
  if (ability.automation === 'manual') effective = 'manual'
  else if (!executableEffects) effective = 'manual'
  else if (reasons.length > 0 || ability.automation === 'partial') effective = 'partial'
  else effective = 'full'
  return { abilityId: ability.id, requested: ability.automation, effective, reasons }
}

export function declarativeSubclassCompatibilityReportV1(
  subclasses: readonly DeclarativeSubclassDefinitionV1[],
): DeclarativeAbilityCompatibilityReportV1 {
  const abilities = subclasses.flatMap((subclass) => {
    const hooksByAbility = new Map<string, DeclarativeSubclassCombatHookV1[]>()
    for (const hook of subclass.combatHooks ?? []) {
      hooksByAbility.set(hook.abilityId, [...(hooksByAbility.get(hook.abilityId) ?? []), hook])
    }
    return subclass.abilities.map((ability) => {
      const entry = declarativeAbilityCompatibilityV1(ability)
      const reasons = [...entry.reasons]
      const abilityHooks = hooksByAbility.get(ability.id) ?? []
      const hasHostRollRecipe = ability.rolls?.some((roll) =>
        (roll.kind === 'damage' || roll.kind === 'healing') && roll.hostRoll != null
      ) === true
      const hasSupportedPrearmHook = abilityHooks.some((hook) =>
        ['before-attack-roll', 'after-attack-roll', 'after-attack-hit'].includes(hook.timing) &&
        (hook.activation ?? (hook.decision === 'automatic' ? 'automatic' : 'interrupt')) === 'prearm' &&
        hook.decision === 'actor-choice' &&
        (
          ability.trigger.kind === 'after-attack-hit' ||
          ability.mechanic?.kind === 'combat-maneuver' ||
          (
            ability.mechanic?.kind === 'damage-roll-maximization' &&
            ability.mechanic.deliveries.some((delivery) =>
              delivery === 'weapon-attack' || delivery === 'feature'
            )
          )
        )
      )
      if (
        hasHostRollRecipe &&
        ability.mechanic?.kind !== 'combat-maneuver' &&
        ability.trigger.kind !== 'active-use' &&
        !hasSupportedPrearmHook
      ) {
        reasons.push('Host 掷骰配方当前只支持主动能力或绑定到 actor-choice 的命中后预激活钩子')
      }
      for (const hook of abilityHooks) {
        const auditedMartialSpellSynergyHook =
          ability.mechanic?.kind === 'martial-spell-synergy' &&
          hook.activation === 'automatic' &&
          hook.decision === 'automatic' &&
          (
            (ability.mechanic.operation === 'weapon-hit-save-pressure' && hook.timing === 'after-attack-hit') ||
            (
              (ability.mechanic.operation === 'cantrip-then-bonus-attack' ||
                ability.mechanic.operation === 'spell-then-bonus-attack') &&
              hook.timing === 'spell-cast'
            )
          )
        const auditedRageFeatureHook =
          ability.mechanic?.kind === 'rage-feature' &&
          hook.activation === 'automatic' &&
          hook.decision === 'automatic'
        const auditedDamageMaximizationHook =
          ability.mechanic?.kind === 'damage-roll-maximization' &&
          hook.timing === 'after-attack-hit' &&
          hook.activation === 'prearm' &&
          hook.decision === 'actor-choice' &&
          ability.mechanic.deliveries.some((delivery) =>
            delivery === 'weapon-attack' || delivery === 'feature'
          )
        const directlyExecutable = auditedMartialSpellSynergyHook || auditedRageFeatureHook ||
          auditedDamageMaximizationHook ||
          (
            hook.timing === 'after-attack-hit' ||
            (
              ability.mechanic?.kind === 'combat-maneuver' &&
              ['before-attack-roll', 'after-attack-roll'].includes(hook.timing)
            )
          ) &&
          (
            (hook.activation == null && hook.decision === 'automatic') ||
            hook.activation === 'automatic' ||
            (hook.activation === 'prearm' && hook.decision === 'actor-choice')
          ) &&
          (
            ability.trigger.kind === 'after-attack-hit' ||
            ability.mechanic?.kind === 'combat-maneuver'
          )
        if (!directlyExecutable) {
          reasons.push(`战斗钩子 ${hook.id}（${hook.timing}/${hook.decision}）已注册，但尚未接入权威事件决策窗口`)
        }
      }
      return {
        ...entry,
        effective: entry.effective === 'full' && reasons.length > 0 ? 'partial' as const : entry.effective,
        reasons,
      }
    })
  })
  return {
    full: abilities.filter((entry) => entry.effective === 'full').length,
    partial: abilities.filter((entry) => entry.effective === 'partial').length,
    manual: abilities.filter((entry) => entry.effective === 'manual').length,
    abilities,
  }
}

export function parseDnd5eDeclarativeRulesPackageV1(bytes: ArrayBuffer): Dnd5eDeclarativeRulesPackageV1 | null {
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('规则包不是有效的 UTF-8 文件')
  }
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('{')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(source) as unknown
  } catch {
    throw new Error('声明式规则包必须是纯 JSON；禁止 JavaScript、eval 和 Function')
  }
  if (!record(parsed) || parsed.format !== DND5E_DECLARATIVE_PACKAGE_FORMAT) {
    throw new Error('JSON 规则包缺少受支持的声明式格式标识')
  }
  assertKeys(parsed, ['format', 'schemaVersion', 'manifest', 'subclasses', 'classes', 'legacy'], '规则包')
  if (parsed.schemaVersion !== 1) throw new Error('声明式规则包 schemaVersion 不受支持')
  if (!record(parsed.manifest)) throw new Error('声明式规则包清单无效')
  assertKeys(parsed.manifest, [
    'id', 'name', 'version', 'publisher', 'license', 'description', 'apiVersion', 'rulesetId',
    'stateSchemaVersion', 'manifestSchemaVersion', 'minimumGameProtocolVersion', 'dependencies',
    'conflicts', 'declaredCapabilities', 'distributionPolicy', 'contentCategory', 'pluginKind',
  ], '规则包清单')
  assertId(parsed.manifest.id, '规则包清单')
  for (const key of ['name', 'version', 'publisher', 'license'] as const) assertText(parsed.manifest[key], `规则包${key}`, 200)
  if (parsed.manifest.description != null && typeof parsed.manifest.description !== 'string') throw new Error('规则包说明无效')
  if (parsed.manifest.apiVersion !== 2 || parsed.manifest.rulesetId !== 'dnd5e-2014-srd-5.1') throw new Error('规则包 API 或 Ruleset 不兼容')
  if (parsed.manifest.stateSchemaVersion != null && !finiteInteger(parsed.manifest.stateSchemaVersion, 1, 1_000)) throw new Error('规则包状态版本无效')
  if (parsed.manifest.manifestSchemaVersion != null && parsed.manifest.manifestSchemaVersion !== 1) throw new Error('规则包清单版本无效')
  if (parsed.manifest.pluginKind != null && parsed.manifest.pluginKind !== 'content-package') {
    throw new Error('声明式规则包必须声明为 content-package')
  }
  if (parsed.manifest.minimumGameProtocolVersion != null && !finiteInteger(parsed.manifest.minimumGameProtocolVersion, 1, 10_000)) throw new Error('规则包最低游戏协议无效')
  const manifestId = parsed.manifest.id
  if (parsed.manifest.dependencies != null && (
    !Array.isArray(parsed.manifest.dependencies) || parsed.manifest.dependencies.length > 32 ||
    parsed.manifest.dependencies.some((dependency) =>
      !record(dependency) || !ID.test(String(dependency.id ?? '')) ||
      dependency.id === manifestId ||
      typeof dependency.versionRange !== 'string' || dependency.versionRange.length < 1 ||
      dependency.versionRange.length > 120 ||
      (dependency.optional != null && typeof dependency.optional !== 'boolean'))
  )) throw new Error('规则包依赖声明无效')
  if (parsed.manifest.conflicts != null && (
    !Array.isArray(parsed.manifest.conflicts) || parsed.manifest.conflicts.length > 32 ||
    parsed.manifest.conflicts.some((pluginId) =>
      typeof pluginId !== 'string' || !ID.test(pluginId) || pluginId === manifestId)
  )) throw new Error('规则包冲突声明无效')
  const declaredCapabilities = new Set([
    'damage', 'healing', 'temporary-hit-points', 'standard-condition', 'movement',
    'resource', 'summon', 'persistent-area', 'spell-transaction', 'interrupt',
  ])
  if (parsed.manifest.declaredCapabilities != null && (
    !Array.isArray(parsed.manifest.declaredCapabilities) ||
    parsed.manifest.declaredCapabilities.length > declaredCapabilities.size ||
    parsed.manifest.declaredCapabilities.some((capability) =>
      typeof capability !== 'string' || !declaredCapabilities.has(capability))
  )) throw new Error('规则包 capability 声明无效')
  if (parsed.manifest.distributionPolicy != null && ![
    'room-distributable', 'room-ephemeral', 'account-entitled', 'local-only',
  ].includes(String(parsed.manifest.distributionPolicy))) throw new Error('规则包分发策略无效')
  if (parsed.manifest.contentCategory != null && ![
    'rules', 'classes', 'subclasses', 'feats', 'spells', 'items', 'monsters', 'adventure', 'mixed',
  ].includes(String(parsed.manifest.contentCategory))) throw new Error('规则包内容分类无效')
  if (!Array.isArray(parsed.subclasses) || parsed.subclasses.length > 64) throw new Error('声明式子职列表无效')
  const subclassIds = new Set<string>()
  for (const subclass of parsed.subclasses) {
    validateDeclarativeSubclassDefinitionV1(subclass)
    if (subclassIds.has(subclass.id)) throw new Error('声明式子职 ID 重复')
    subclassIds.add(subclass.id)
  }
  if (parsed.classes != null) {
    if (!Array.isArray(parsed.classes) || parsed.classes.length > 32) throw new Error('声明式职业列表无效')
    const classIds = new Set<string>()
    for (const definition of parsed.classes) {
      validateDeclarativeClassDefinitionV1(definition)
      if (classIds.has(definition.id)) throw new Error('声明式职业 ID 重复')
      classIds.add(definition.id)
    }
  }
  return parsed as unknown as Dnd5eDeclarativeRulesPackageV1
}

export { migrateLegacyFeatureActionToDeclarativeV1 } from './plugins/pluginLegacyMigration'
