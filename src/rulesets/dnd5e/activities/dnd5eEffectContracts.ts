import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5eSpellbookSchoolId } from '../spellbook'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

export const DND5E_EFFECT_SCHEMA_VERSION = 1 as const

/**
 * Closed character-snapshot capabilities used by permanent content Effects.
 *
 * These identifiers deliberately mirror the audited Host snapshot fields. A
 * content package may choose one of them and provide data, but it cannot add a
 * new executable capability or a callback. Temporary combat Effects do not
 * consume this modifier; it is projected while a character is built.
 */
export const DND5E_CHARACTER_CAPABILITY_IDS_V1 = Object.freeze([
  'initiativeBonus',
  'hitPointsPerLevelBonus',
  'passivePerceptionBonus',
  'passiveInvestigationBonus',
  'minimumHitDieHealingConstitutionMultiplier',
  'cannotBeSurprisedWhileConscious',
  'unseenAttackersDoNotGainAdvantage',
  'ignoreLongRangeRangedWeaponDisadvantage',
  'ignoreNearbyHostileRangedAttackDisadvantage',
  'ignoreLoadingWeaponProperty',
  'allowNonLightTwoWeaponFighting',
  'ignoreRangedWeaponCoverBonus',
  'mediumArmorDexterityCapBonus',
  'ignoreMediumArmorStealthDisadvantage',
  'dualWieldMeleeArmorClassBonus',
  'mountedMeleeAdvantageAgainstSmallerUnmounted',
  'redirectMountedCreatureAttacksToRider',
  'grantMountedCreatureDexterityEvasion',
  'preventOpportunityAttacksFromMeleeAttackTargets',
  'opportunityAttacksIgnoreDisengage',
  'opportunityAttackHitStopsMovement',
  'opportunityAttacksOnEnterReachWeaponIds',
  'ignoreDifficultTerrainWhileDashing',
  'climbWithoutSpeedCostMultiplier',
  'runningJumpMinimumApproachFeet',
  'standFromProneMovementCostFeet',
  'spellAttackRangeMultiplier',
  'ignoreSpellAttackCoverBonus',
  'spellSavingThrowAdvantageWithinFeet',
  'imposeConcentrationCheckDisadvantageOnDamage',
  'meleeWeaponDamageRerollOncePerTurn',
  'shieldDexteritySaveBonusWhenSoleTarget',
  'shieldSuccessfulDexteritySaveNegatesDamage',
  'combatManeuverDieSidesOverride',
  'opportunityAttackSpellReplacement',
  'ignoreOccupiedHandsForSomaticComponents',
  'retainHiddenOnRangedWeaponMiss',
  'naturalOneReroll',
] as const)

export type Dnd5eCharacterCapabilityIdV1 = typeof DND5E_CHARACTER_CAPABILITY_IDS_V1[number]

export type Dnd5eEffectDurationV1 =
  | { kind: 'instantaneous' }
  | { kind: 'rounds'; rounds: number; expiresAt: 'source-turn-start' | 'source-turn-end' | 'target-turn-start' | 'target-turn-end' }
  | {
      kind: 'save-ends'
      maximumRounds: number
      timing: 'target-turn-start' | 'target-turn-end'
      ability: AbilityKey
      abilityOptions?: readonly AbilityKey[]
      dc: Dnd5eFormulaV1
      /** Optional Host-rolled damage after each failed repeat save. */
      damageOnFailure?: {
        count: number
        sides: number
        modifier?: Dnd5eFormulaV1
        type: Dnd5eDamageType
      }
    }
  | { kind: 'concentration'; maximumRounds: number }
  | { kind: 'permanent' }

export type Dnd5eEffectModifierV1 =
  | { kind: 'armor-class'; mode: 'add' | 'minimum' | 'maximum' | 'override'; value: Dnd5eFormulaV1 }
  | { kind: 'speed'; mode: 'add' | 'multiply' | 'minimum' | 'maximum' | 'override'; value: Dnd5eFormulaV1 }
  | { kind: 'attack-roll'; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1 }
  | { kind: 'attack-target-lock'; attacksAgainstOthersThanSource: 'disadvantage' }
  | {
      kind: 'ability-check'
      mode: 'advantage' | 'disadvantage'
      /** If both are omitted the mode applies to every ability check; if both are present, both must match. */
      ability?: AbilityKey
      skill?: string
    }
  | { kind: 'weapon-damage-roll'; mode: 'add'; value: Dnd5eFormulaV1; appliesTo?: 'this-weapon' | 'all-weapon-attacks' }
  /** Replaces the ordinary base weapon damage; triggered Activities supply the new damage. */
  | { kind: 'weapon-damage-replacement'; attackModes: readonly ('melee' | 'ranged')[] }
  /** A move ending beyond the source boundary requires the declared save. */
  | { kind: 'movement-boundary-save'; maximumDistanceFeet: number; ability: AbilityKey; dc: Dnd5eFormulaV1 }
  /**
   * Binds an attack/damage bonus and an optional damage die to the concrete
   * weapon held in the selected slot when the Effect is created. The Host
   * resolves the inventory instance id; content never supplies one.
   */
  | {
      kind: 'weapon-enchantment'
      weaponSlot: 'main-hand' | 'off-hand'
      attackAndDamageBonus: Dnd5eFormulaV1
      bonusDamage?: { count: number; sides: number; type: Dnd5eDamageType; magical?: boolean }
    }
  /** Temporarily rewrites a closed portion of a qualifying attack profile. */
  | {
      kind: 'attack-profile'
      attackModes: readonly ('melee' | 'ranged' | 'unarmed')[]
      weaponIds?: readonly string[]
      reachBonusFeet?: number
      damageTypeOverride?: Dnd5eDamageType
    }
  | { kind: 'saving-throw'; ability?: AbilityKey; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1 }
  /** Grants proficiency without stacking a second proficiency bonus. */
  | { kind: 'saving-throw-proficiency'; ability: AbilityKey }
  | { kind: 'damage-resistance'; damageType: Dnd5eDamageType }
  | { kind: 'damage-immunity'; damageType: Dnd5eDamageType }
  | { kind: 'damage-vulnerability'; damageType: Dnd5eDamageType }
  | { kind: 'condition-immunity'; condition: Dnd5eStandardConditionId }
  /** Permanent, allowlisted projection into the immutable character snapshot. */
  | {
      kind: 'character-capability'
      capability: Dnd5eCharacterCapabilityIdV1
      value: boolean | number | readonly string[]
    }
  /** Contextual racial save advantage that cannot be represented by an unconditional save modifier. */
  | {
      kind: 'racial-saving-throw-advantage'
      conditions?: readonly string[]
      damageTypes?: readonly Dnd5eDamageType[]
      magicAbilities?: readonly AbilityKey[]
    }
  | { kind: 'prohibit-reaction' }
  | { kind: 'forced-flee-from-source' }
  | { kind: 'maximum-attacks-per-turn'; value: number }
  /** Grants a Host-projected darkvision range while this Effect is active. */
  | { kind: 'darkvision'; rangeFeet: number }
  | { kind: 'flight-speed'; speedFeet: number }
  /** Allows the affected creature to perceive invisible creatures while this Effect is active. */
  | { kind: 'see-invisible' }
  | { kind: 'spell-save-disadvantage-aura'; radiusFeet: number; damageTypes?: readonly Dnd5eDamageType[]; spellcastingClassIds?: readonly string[] }
  /** Allows qualifying action-cast spells to consume a bonus action while active. */
  | { kind: 'spell-action-as-bonus-action'; spellcastingClassIds: readonly string[] }
  | {
      kind: 'damage-reduction'
      amount: Dnd5eFormulaV1
      damageTypes?: readonly Dnd5eDamageType[]
      minimumIncomingDamage?: number
      maximumCurrentHitPointPercent?: number
      oncePerTurn?: boolean
      deliveries?: readonly ('weapon-attack' | 'spell' | 'other')[]
      magical?: boolean
      requiresHeavyArmor?: boolean
      resourceId?: string
      resourceCost?: number
    }
  | {
      kind: 'on-hit-bonus-damage'
      amount: Dnd5eFormulaV1
      damageType: Dnd5eDamageType | 'inherit-primary'
      appliesTo: 'this-weapon' | 'all-weapon-attacks'
      doubleDiceOnCritical?: boolean
      oncePerTurn?: boolean
      targetCreatureTypes?: readonly string[]
      resourceId?: string
      resourceCost?: number
    }
  | {
      kind: 'attack-roll-reroll'
      maximumDice: 1
      appliesTo: 'this-weapon' | 'all-weapon-attacks'
      resourceId?: string
      resourceCost?: number
    }
  | { kind: 'death-prevention'; hitPointsAfter: number; preventsMassiveDamage?: boolean; resourceId?: string; resourceCost?: number }

export type Dnd5eTriggerEventV1 =
  | 'combat-start'
  | 'combat-end'
  | 'round-start'
  | 'round-end'
  | 'turn-start'
  | 'turn-end'
  | 'before-attack'
  | 'after-attack'
  | 'on-hit'
  | 'on-miss'
  | 'attack-declared'
  | 'before-attack-roll'
  | 'after-attack-roll'
  | 'attack-hit'
  | 'attack-missed'
  | 'attack-resolved'
  | 'before-damage'
  | 'after-damage'
  | 'before-save'
  | 'after-save'
  | 'on-move'
  | 'movement-started'
  | 'movement-completed'
  | 'on-enter-area'
  | 'on-leave-area'
  | 'on-cast'
  | 'after-cast'
  | 'spell-cast'
  | 'spell-resolved'
  | 'skill-used'
  | 'item-used'
  | 'feature-used'
  | 'action-resolved'
  | 'd20-roll-resolved'
  | 'reaction-window'
  | 'legendary-action-window'
  | 'lair-action-window'
  | 'on-concentration-check'
  | 'on-condition-attempted'
  | 'on-condition-applied'
  | 'on-defeat'
  | 'creature-dropped-to-zero'
  | 'before-drop-to-zero'
  | 'short-rest-complete'
  | 'long-rest-complete'

export const DND5E_TRIGGER_EVENT_IDS_V1: readonly Dnd5eTriggerEventV1[] = [
  'combat-start', 'combat-end', 'round-start', 'round-end', 'turn-start', 'turn-end',
  'before-attack', 'after-attack', 'on-hit', 'on-miss',
  'attack-declared', 'before-attack-roll', 'after-attack-roll', 'attack-hit', 'attack-missed', 'attack-resolved',
  'before-damage', 'after-damage', 'before-save', 'after-save',
  'on-move', 'movement-started', 'movement-completed', 'on-enter-area', 'on-leave-area',
  'on-cast', 'after-cast', 'spell-cast', 'spell-resolved', 'skill-used', 'item-used', 'feature-used',
  'action-resolved', 'd20-roll-resolved', 'reaction-window', 'legendary-action-window', 'lair-action-window',
  'on-concentration-check', 'on-condition-attempted', 'on-condition-applied', 'on-defeat', 'creature-dropped-to-zero', 'before-drop-to-zero',
  'short-rest-complete', 'long-rest-complete',
]

export type Dnd5eActivityLifecycleStageV1 =
  | 'combat'
  | 'turn'
  | 'declaration'
  | 'targeting'
  | 'roll'
  | 'damage'
  | 'effects'
  | 'movement'
  | 'rest'

export type Dnd5eActivityLifecycleTimingV1 = 'before' | 'after' | 'boundary'

export interface Dnd5eActivityLifecycleEventDescriptorV1 {
  event: Dnd5eTriggerEventV1
  stage: Dnd5eActivityLifecycleStageV1
  timing: Dnd5eActivityLifecycleTimingV1
  /** Whether actor/target/DM confirmation may pause the authority transaction here. */
  interruptible: boolean
}

/**
 * Canonical FVTT-style workflow windows offered to new Activity content.
 * Older aliases remain readable through the V1 adapter, but the workshop no
 * longer creates them.
 */
export const DND5E_ACTIVITY_LIFECYCLE_EVENTS_V1: readonly Dnd5eActivityLifecycleEventDescriptorV1[] = [
  ['combat-start', 'combat', 'boundary', false], ['combat-end', 'combat', 'boundary', false],
  ['round-start', 'turn', 'boundary', false], ['round-end', 'turn', 'boundary', false],
  ['turn-start', 'turn', 'boundary', true], ['turn-end', 'turn', 'boundary', true],
  ['attack-declared', 'declaration', 'after', true], ['before-attack-roll', 'roll', 'before', true],
  ['after-attack-roll', 'roll', 'after', true], ['attack-hit', 'roll', 'after', true],
  ['attack-missed', 'roll', 'after', true], ['attack-resolved', 'roll', 'after', false],
  ['before-damage', 'damage', 'before', true], ['after-damage', 'damage', 'after', true],
  ['before-save', 'roll', 'before', true], ['after-save', 'roll', 'after', true],
  ['movement-started', 'movement', 'before', true], ['movement-completed', 'movement', 'after', true],
  ['on-enter-area', 'movement', 'after', true], ['on-leave-area', 'movement', 'after', true],
  ['spell-cast', 'declaration', 'after', true], ['spell-resolved', 'effects', 'after', true],
  ['skill-used', 'effects', 'after', true], ['item-used', 'effects', 'after', true],
  ['feature-used', 'effects', 'after', true], ['action-resolved', 'effects', 'after', true],
  ['d20-roll-resolved', 'roll', 'after', true], ['reaction-window', 'declaration', 'boundary', true],
  ['legendary-action-window', 'turn', 'boundary', true], ['lair-action-window', 'turn', 'boundary', true],
  ['on-concentration-check', 'roll', 'after', true],
  ['on-condition-attempted', 'effects', 'before', true], ['on-condition-applied', 'effects', 'after', true],
  ['before-drop-to-zero', 'damage', 'before', true], ['creature-dropped-to-zero', 'damage', 'after', true],
  ['short-rest-complete', 'rest', 'after', false], ['long-rest-complete', 'rest', 'after', false],
].map(([event, stage, timing, interruptible]) => ({ event, stage, timing, interruptible })) as readonly Dnd5eActivityLifecycleEventDescriptorV1[]

export type Dnd5ePredicateV1 =
  | { kind: 'minimum-level'; level: number }
  | { kind: 'class-level'; classId: string; minimum: number }
  | { kind: 'hp-percentage'; subject: 'actor' | 'target'; comparison: 'at-most' | 'at-least'; value: number }
  | {
      kind: 'hp-value'
      subject: 'actor' | 'target'
      comparison: 'below' | 'at-most' | 'at-least' | 'above'
      /** Formula thresholds cover effects that test HP after their own rolled damage. */
      value: number | Dnd5eFormulaV1
    }
  | { kind: 'ability-score'; subject: 'actor' | 'target'; ability: AbilityKey; comparison: 'below' | 'at-most' | 'at-least' | 'above'; value: number }
  | { kind: 'condition'; subject: 'actor' | 'target'; condition: Dnd5eStandardConditionId; present: boolean }
  | { kind: 'illumination'; subject: 'actor' | 'target'; values: readonly ('bright' | 'dim' | 'darkness' | 'magical-darkness')[] }
  | { kind: 'target-relation'; relation: 'self' | 'ally' | 'enemy' | 'any' }
  /** Distinguishes the actor from another selected creature without redefining ally semantics. */
  | { kind: 'target-identity'; identity: 'self' | 'other' }
  | { kind: 'active-effect'; subject: 'actor' | 'target'; effectId: string; present: boolean; source: 'any' | 'self' }
  | { kind: 'distance'; minimumFeet?: number; maximumFeet?: number }
  | { kind: 'resource'; resourceId: string; minimum: Dnd5eFormulaV1 }
  | { kind: 'resource-capacity'; resourceId: string; minimumMissing: Dnd5eFormulaV1 }
  | { kind: 'once-per-turn'; key: string }
  | {
      kind: 'event-source'
      source: 'attack' | 'spell' | 'skill' | 'item' | 'feature' | 'movement' | 'action' | 'combat'
      sourceId?: string
      activityId?: string
    }
  /** Exact stable-id match. Prefer this over legacy sourceId/activityId for new content. */
  | { kind: 'activity-definition'; definitionId: string }
  | { kind: 'weapon-property'; property: string; present: boolean }
  /** Uses the Host-authored attack profile; clients cannot claim proficiency. */
  | { kind: 'attack-proficiency'; proficient: boolean }
  /** Matches the concrete Host-derived weapon ID of the triggering attack. */
  | { kind: 'attack-weapon'; weaponIds: readonly string[] }
  /** Distinguishes attacks made as part of the Attack action from bonus/reaction attacks. */
  | { kind: 'attack-origin'; origins: readonly ('attack-action' | 'bonus-action' | 'reaction' | 'other')[] }
  /** Uses the concrete grip chosen by the Host for the triggering weapon attack. */
  | { kind: 'attack-hands'; hands: 1 | 2 }
  | {
      kind: 'attack-mode'
      mode?: 'melee' | 'ranged' | 'spell' | 'unarmed'
      modes?: readonly ('melee' | 'ranged' | 'spell' | 'unarmed')[]
    }
  | { kind: 'attack-result'; result: 'hit' | 'miss' | 'critical-hit' | 'critical-miss' }
  | {
      kind: 'attack-outcome'
      outcomes: readonly ('critical-hit' | 'target-dropped-to-zero')[]
      match?: 'any' | 'all'
    }
  | { kind: 'damage-type'; damageTypes: readonly Dnd5eDamageType[] }
  | {
      kind: 'damage-event'
      minimumAmount?: number
      maximumAmount?: number
      minimumTemporaryHitPointsBefore?: number
      maximumTemporaryHitPointsAfter?: number
    }
  | { kind: 'size-rank'; subject: 'actor' | 'target'; minimum?: number; maximum?: number }
  | { kind: 'creature-type'; subject: 'actor' | 'target'; types: readonly string[] }
  | { kind: 'movement-distance'; minimumFeet?: number; maximumFeet?: number }
  | { kind: 'movement-property'; straightLine?: boolean; dashedThisTurn?: boolean }
  | { kind: 'spell-used'; spellId?: string; schools?: readonly Dnd5eSpellbookSchoolId[]; minimumLevel?: number; maximumLevel?: number }
  | { kind: 'skill-used'; skillId?: string }
  | { kind: 'action-economy-available'; economy: 'action' | 'bonus-action' | 'reaction'; amount?: 1 }
  | {
      kind: 'armor-equipped'
      subject: 'actor' | 'target'
      categories: readonly ('none' | 'light' | 'medium' | 'heavy')[]
      proficient?: boolean
    }
  | {
      kind: 'armor-proficiency'
      subject: 'actor' | 'target'
      categories: readonly ('light' | 'medium' | 'heavy' | 'shield')[]
      match?: 'any' | 'all'
    }
  | {
      kind: 'held-item'
      subject: 'actor' | 'target'
      slot: 'main-hand' | 'off-hand' | 'either-hand'
      /** Every requested role must be present; a weapon may also be a focus. */
      roles?: readonly ('weapon' | 'shield' | 'spellcasting-focus' | 'other')[]
      itemIds?: readonly string[]
      weaponModes?: readonly ('melee' | 'ranged')[]
      requiredWeaponProperties?: readonly string[]
      proficient?: boolean
    }
  | { kind: 'free-hands'; subject: 'actor' | 'target'; minimum: 0 | 1 | 2 }
  | { kind: 'spellcasting-capability'; subject: 'actor' | 'target'; capable: boolean; classIds?: readonly string[] }
  | { kind: 'choice'; choiceId: string; optionId: string }

export interface Dnd5eTriggerLimitV1 {
  uses: number
  reset: 'turn' | 'round' | 'combat' | 'short-rest' | 'long-rest' | 'never'
}

export interface Dnd5eTriggerDefinitionV1 {
  id: string
  event: Dnd5eTriggerEventV1
  predicates?: readonly Dnd5ePredicateV1[]
  activityId?: string
  effectId?: string
  decision?: 'automatic' | 'actor-choice' | 'target-choice' | 'dm-approval'
  limit?: Dnd5eTriggerLimitV1
}

export interface Dnd5eEffectDefinitionV1 {
  schemaVersion: typeof DND5E_EFFECT_SCHEMA_VERSION
  id: string
  name: string
  duration: Dnd5eEffectDurationV1
  conditions?: readonly Dnd5eStandardConditionId[]
  /** Data-only non-standard battlefield state, for example `banished`. */
  extensionCondition?: string
  modifiers?: readonly Dnd5eEffectModifierV1[]
  /** Closed lifecycle events that remove the effect after the event commits. */
  breakOn?: readonly (
    | 'takes-damage'
    | 'targeted-by-attack'
    | 'hit-by-attack'
    | 'makes-attack'
    | 'casts-spell'
    | 'moves'
    | 'spends-action'
    | 'spends-bonus-action'
    | 'spends-reaction'
    | 'awakened'
    | 'magical-healing'
    | 'short-rest-complete'
    | 'long-rest-complete'
  )[]
  /** Removes a source-linked effect when authoritative combat facts invalidate the link. */
  sourceLink?: {
    sourceAttacksOtherTarget?: true
    sourceCastsSpellOnOtherTarget?: true
    targetHarmedBySourceAlly?: true
    /** The source must refresh this Activity Effect before ending each turn. */
    sourceRequiresEffectAtSourceTurnEnd?: string
    maximumDistanceFeetAtSourceTurnEnd?: number
    maximumDistanceFeet?: number
    requiresLineOfEffect?: true
  }
  /** Fixed-DC action escape shared by restraints, grapples and similar effects. */
  escapeCheck?: {
    ability: AbilityKey
    skill?: 'athletics' | 'acrobatics'
    alternativeAbility?: AbilityKey
    alternativeSkill?: 'athletics' | 'acrobatics'
    dc: Dnd5eFormulaV1
    economy: 'action'
  }
  /** Host-rolled recurring damage resolved by the ordinary turn-boundary transaction. */
  periodicDamage?: {
    timing: 'target-turn-start' | 'target-turn-end' | 'source-turn-start'
    count: number
    sides: number
    modifier?: Dnd5eFormulaV1
    type: Dnd5eDamageType
    magical?: boolean
  }
  grants?: readonly string[]
  triggers?: readonly Dnd5eTriggerDefinitionV1[]
  stacking: 'replace' | 'refresh-duration' | 'stack' | 'highest' | 'lowest' | 'unique-by-source'
  /** Mutually exclusive stance/mode group scoped to the applying source. */
  exclusiveGroup?: string
  concentration?: boolean
  dispel?: { kind: 'spell-level'; level: number } | { kind: 'dm-adjudication'; reason: string }
}
