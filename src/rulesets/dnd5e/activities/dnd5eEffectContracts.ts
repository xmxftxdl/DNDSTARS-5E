import type { Dnd5eAttackAttemptWard } from '../attackAttemptWard'
import type { Dnd5eSolidMaterialTraversal } from '../solidMaterialTraversal'
import type { MapSurfaceMaterial } from '../../../lib/mapSurfaceMaterials'
import type { Dnd5eEffectGrantChargeDeclaration } from '../effectGrantCharges'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eRollDiceModifier } from '../rollDiceModifiers'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5eSpellbookSchoolId } from '../spellbook'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import type { Dnd5ePluginStaticCombatModifiers } from '../plugins/pluginMechanicsContracts'

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
  'inherentLight',
  'unarmoredArmorClassBase', 'unarmoredArmorClassAllowsShield', 'naturalWeapons',
  'initiativeBonus',
  'initiativeBonusFromAbility',
  'existingMovementSpeedBonuses', 'swimSpeedMinimumFeet',
  'hitPointsPerLevelBonus',
  'passivePerceptionBonus',
  'passiveInvestigationBonus',
  'minimumHitDieHealingConstitutionMultiplier',
  'cannotBeSurprisedWhileConscious',
  'unseenAttackersDoNotGainAdvantage',
  'ignoreLongRangeRangedWeaponDisadvantage',
  'ignoreNearbyHostileRangedAttackDisadvantage',
  'ignoreLoadingWeaponProperty',
  'swimSpeedEqualsWalking', 'canBreatheWater',
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
  'opportunityAttacksOnMoveWithinReach',
  'opportunityAttacksOnEnterReachWeaponIds',
  'ignoreDifficultTerrainWhileDashing',
  'grappleEscapeAdvantage',
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
  | { kind: 'rounds'; rounds: number; expiresAt: 'source-turn-start' | 'source-turn-end' | 'target-turn-start' | 'target-turn-end'; includeCreationTurn?: boolean }
  | {
      kind: 'save-ends'
      maximumRounds: number
      timing: 'target-turn-start' | 'target-turn-end'
      ability: AbilityKey
      abilityOptions?: readonly AbilityKey[]
      dc: Dnd5eFormulaV1
      /** Only offer and accept this repeat save while the target cannot see the Effect source. */
      requiresSourceNotVisible?: boolean
      /** Optional Host-rolled damage after each failed repeat save. */
      damageOnFailure?: {
        count: number
        sides: number
        modifier?: Dnd5eFormulaV1
        type: Dnd5eDamageType
        destroysBodyOnDeath?: boolean
      }
      /**
       * Optional cumulative save track. Omitted values preserve the ordinary
       * "one successful save ends" rule. Initial progress is useful when the
       * failed application save is also the first failure in the sequence.
       */
      successesRequired?: number
      failuresRequired?: number
      initialSuccesses?: number
      initialFailures?: number
      /** Closed transition after the configured failure threshold is reached. */
      onFailureThreshold?:
        | { outcome: 'retain-effect' }
        | {
            outcome?: 'replace-condition'
            replaceWithCondition: Dnd5eStandardConditionId
            duration: 'permanent' | 'source-concentration-then-permanent'
          }
    }
  | { kind: 'concentration'; maximumRounds: number }
  | { kind: 'permanent' }

export type Dnd5eEffectModifierV1 =
  | { kind: 'attacks-by-source-critical-threshold'; threshold: number }
  | { kind: 'damage-rolls-by-source-bonus'; value: Dnd5eFormulaV1 }
  | { kind: 'roll-dice'; dice: Dnd5eRollDiceModifier }
  | { kind: 'armor-class'; mode: 'add' | 'minimum' | 'maximum' | 'override'; value: Dnd5eFormulaV1;
      /** Host binds the recipients of this Effect; no client-supplied participant IDs. */
      cohortProximity?: { maximumFeet: number; match: 'any' | 'all' } }
  /**
   * Adds to the Effect source's AC only when the affected creature attacks that
   * source. This models source-relative cover such as Arcane Hand's
   * Interposing Hand without projecting a global AC bonus onto the caster.
   */
  | { kind: 'attacks-against-source-armor-class'; bonus: number }
  | { kind: 'speed'; mode: 'add' | 'multiply' | 'minimum' | 'maximum' | 'override'; value: Dnd5eFormulaV1 }
  | { kind: 'attack-roll'; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1; ability?: AbilityKey;
      /** Advantage conditional on the live Effect source's position and perception. */
      sourceProximity?: import('../sourceProximityAttack').Dnd5eSourceProximityAttack }
  /** Weapon attack category, including natural weapons and unarmed strikes, excluding spell attacks. */
  | { kind: 'weapon-attack-roll'; mode: 'advantage' | 'disadvantage'; weaponCategories?: readonly ('simple' | 'martial')[] }
  | { kind: 'attacks-against-target'; mode: 'advantage' | 'disadvantage' }
  /** Defender-side weapon attacks only; includes thrown/natural weapons, excludes spell attacks. */
  | { kind: 'weapon-attacks-against-target'; mode: 'advantage' | 'disadvantage'; delivery?: 'melee' | 'ranged' }
  /** Movement does not provoke; independent of the Disengage action. */
  | { kind: 'prevent-movement-opportunity-attacks' }
  /** After a weapon attack on the bearer's turn, grant walking speed until that turn ends. */
  | { kind: 'speed-after-own-turn-weapon-attack'; bonusFeet: number; attackActionOnly?: boolean }
  | { kind: 'cannot-be-surprised-while-conscious' }
  /** Blocks return to life while this effect is active, independent of willingness. */
  | { kind: 'revival-prevention' }
  | { kind: 'next-d20-advantage'; rollKinds: readonly ('attack' | 'ability-check' | 'saving-throw')[] }
  /** Subjective hostility only; does not change ownership or true allegiance. */
  | { kind: 'perceive-visible-creatures-as-hostile' }
  /** Take an otherwise legal opportunity attack instead of declining it. */
  | { kind: 'mandatory-opportunity-attacks' }
  | { kind: 'random-visible-creature-targets' }
  | { kind: 'attack-target-lock'; attacksAgainstOthersThanSource: 'disadvantage'; sourceRangeFeet?: number; notifySourceOnDamage?: true }
  | {
      kind: 'ability-check'
      mode: 'advantage' | 'disadvantage'
      /** If both are omitted the mode applies to every ability check; if both are present, both must match. */
      ability?: AbilityKey
      skill?: string
      /** Skills excluded from this modifier only; other effects still apply. */
      excludedSkills?: readonly string[]
      sense?: 'hearing' | 'sight' | 'smell'
    }
  /** Perception checks are disadvantaged only when inspecting somebody other than this Effect's source. */
  | { kind: 'ability-check'; mode: 'add'; skill: string; ability?: AbilityKey; value: Dnd5eFormulaV1; excludedSkills?: readonly string[] }
  | { kind: 'perception-target-lock'; disadvantageAgainstOthersThanSource: true }
  /** Source-centered ability/skill bonus aura resolved from Host distances. */
  | {
      kind: 'skill-check-bonus-aura'
      skill: string
      bonus: number
      radiusFeet: number
      relation: 'ally-and-self'
      /** Optional travel-state riders granted to every creature currently receiving this aura bonus. */
      mundaneTracking?: 'impossible'
      leavesTracks?: false
    }
  /** Raises the raw d20 result (before modifiers) for matching ability checks. */
  | { kind: 'minimum-ability-check-d20'; ability: AbilityKey; minimum: number }
  | { kind: 'weapon-damage-roll'; mode: 'add'; value: Dnd5eFormulaV1; appliesTo?: 'this-weapon' | 'all-weapon-attacks' }
  /** Multiplies the full qualifying weapon damage packet before defenses. */
  | {
      kind: 'weapon-damage-multiplier'
      multiplier: number
      ability?: 'str' | 'dex'
      attackModes?: readonly ('melee' | 'ranged')[]
    }
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
      /** Retain binding on transfer, but only its original source may benefit. */
      sourceWielderOnly?: true
      weaponBaseIds?: readonly string[]
      /** Allows magical weapons without an intrinsic bonus to both attack and damage. */
      requiresNoIntrinsicAttackAndDamageBonus?: true
      weaponSlot: 'main-hand' | 'off-hand' | 'ammunition-container' | 'inventory-item'
      /** Held weapons only. Unknown Host magic status fails closed. */
      requiresNonmagical?: true
      attackAndDamageBonus: Dnd5eFormulaV1
      /** Held inventory weapon only; never substitutes costly/consumed materials. */
      spellcastingFocusClassIds?: readonly string[]
      /** Consumed by resolved attacks, including misses; not by rejected commands. */
      attackUses?: Dnd5eFormulaV1
      /** Ammunition containers also spend quota when inventory ammunition is withdrawn. */
      consumeOnDraw?: true
      bonusDamage?: { count: number; sides: number; type: Dnd5eDamageType; magical?: boolean }
    }
  /** Binds an AC bonus to the concrete body armor worn when applied. */
  | { kind: 'armor-enchantment'; armorClassBonus: Dnd5eFormulaV1; requiresNonmagical?: true; itemSelection?: 'inventory-item' }
  /** Temporarily rewrites a closed portion of a qualifying attack profile. */
  | {
      kind: 'attack-profile'
      attackModes: readonly ('melee' | 'ranged' | 'unarmed')[]
      weaponIds?: readonly string[]
      reachBonusFeet?: number
      criticalThreshold?: number
      damageTypeOverride?: Dnd5eDamageType
    }
  | { kind: 'saving-throw'; ability?: AbilityKey; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1 }
  | { kind: 'death-saving-throw'; mode: 'advantage' }
  | { kind: 'maximize-healing-dice'; whenOwnedCompanionWithin?: import('../ownedCompanionProximity').Dnd5eOwnedCompanionProximity }
  /** Blocks HP recovery, not temporary HP; ordinary Effect duration controls expiry. */
  | { kind: 'healing-prevention'; scope: 'all' | 'nonmagical' }
  /** Roll at the chosen check/save, never when this Effect is applied. Consumes the whole Effect. */
  | { kind: 'optional-bonus-die'; sides: 4 | 6 | 8 | 10 | 12; appliesTo: readonly ('ability-check' | 'saving-throw')[]; consumeOnUse: boolean; boundTargetSource?: import('../optionalBonusDieEligibility').Dnd5eOptionalBonusDieSourceConstraint }
  /** Grants proficiency without stacking a second proficiency bonus. */
  | { kind: 'attack-action-minimum'; attacks: number }
  | { kind: 'own-turn-attack-action-bonus'; attacks: number }
  | { kind: 'saving-throw-proficiency'; ability: AbilityKey }
  | { kind: 'equipment-proficiency'; categories: readonly ('light' | 'medium' | 'heavy' | 'shield' | 'simple' | 'martial')[] }
  /** Doubles existing skill proficiency; never grants proficiency or stacks expertise. */
  | { kind: 'skill-expertise'; skill: string }
  | { kind: 'damage-resistance'; damageType: Dnd5eDamageType }
  | { kind: 'suppress-damage-resistance'; damageType: Dnd5eDamageType }
  /** Resistance limited by incoming damage provenance, e.g. nonmagical B/P/S. */
  | {
      kind: 'conditional-damage-resistance'
      sourceAura?: import('../sourceAuraRequirement').Dnd5eSourceAuraRequirement
      damageTypes: readonly Dnd5eDamageType[]
      sourceMagical?: boolean
      /** Restrict to attack damage regardless of weapon or Activity origin. */
      attackOnly?: boolean
      deliveries?: readonly ('weapon-attack' | 'spell' | 'other')[]
    }
  | { kind: 'damage-immunity'; damageType: Dnd5eDamageType }
  | { kind: 'next-source-or-ally-attack-vulnerability' }
  | { kind: 'damage-vulnerability'; damageType: Dnd5eDamageType | 'all' }
  | { kind: 'condition-immunity'; condition: Dnd5eStandardConditionId }
  /**
   * Rejects a condition only when its authoritative source belongs to one of
   * the declared creature types. This is the reusable form used by effects
   * such as Protection from Evil and Good; it must not become blanket
   * immunity merely because the protected creature has the Effect.
   */
  | {
      kind: 'condition-immunity-by-source-creature-type'
      conditions: readonly string[]
      sourceCreatureTypes: readonly string[]
    }
  /** Grants save advantage for listed conditions only against listed source creature types. */
  | {
      kind: 'saving-throw-advantage-by-source-creature-type'
      conditions: readonly string[]
      sourceCreatureTypes: readonly string[]
    }
  /** Rejects only magical or only nonmagical attempts to apply listed states. */
  | {
      kind: 'condition-immunity-by-source-magic'
      conditions: readonly string[]
      sourceMagical: boolean
      suppressExisting?: true
    }
  /** Imposes disadvantage only on attacks made by the listed creature types. */
  | {
      kind: 'attacks-against-target-by-creature-type'
      mode: 'disadvantage'
      sourceCreatureTypes: readonly string[]
    }
  /** Permanent, allowlisted projection into the immutable character snapshot. */
  | {
      kind: 'character-capability'
      capability: Dnd5eCharacterCapabilityIdV1
      value: boolean | number | AbilityKey | readonly string[] | NonNullable<Dnd5ePluginStaticCombatModifiers['naturalWeapons']> | NonNullable<Dnd5ePluginStaticCombatModifiers['existingMovementSpeedBonuses']> | NonNullable<Dnd5ePluginStaticCombatModifiers['inherentLight']>
    }
  /** Contextual racial save advantage that cannot be represented by an unconditional save modifier. */
  | {
      kind: 'racial-saving-throw-advantage'
      conditions?: readonly string[]
      damageTypes?: readonly Dnd5eDamageType[]
      magicAbilities?: readonly AbilityKey[]
    }
  | { kind: 'prohibit-reaction' }
  /** Prevents ordinary action-economy transactions without inventing a standard condition. */
  | { kind: 'prevent-actions' }
  /** Denies recovery and rest-completion benefits while this effect is active. */
  | { kind: 'prevent-rest-benefits' }
  | { kind: 'forced-flee-from-source' }
  | { kind: 'maximum-attacks-per-turn'; value: number }
  /**
   * Grants one additional action on each turn, but only for this closed list of
   * basic actions. The Host, not saved content, owns the one-attack cap.
   */
  | {
      kind: 'restricted-extra-action'
      allowedActions: readonly ('weapon-attack' | 'dash' | 'disengage' | 'hide' | 'use-object')[]
      maximumWeaponAttacks: 1
    }
  /** Grants a Host-projected darkvision range while this Effect is active. */
  | { kind: 'darkvision'; rangeFeet: number; ifAbsent?: true; existingBonusFeet?: number; existingRangeSource?: 'race' }
  /** Uses the creature's effective walking speed as its climbing speed. */
  | { kind: 'climb-speed'; mode: 'walking-speed' }
  | { kind: 'swim-speed'; mode: 'walking-speed' }
  /** Grants true sight, including invisible and magically disguised targets, to this range. */
  | { kind: 'truesight'; rangeFeet: number }
  /** Caps visual perception; nonvisual blindsight is independently evaluated. */
  | { kind: 'sight-range-limit'; rangeFeet: number }
  /** Prevents the target from being selected by spells of the listed schools. */
  | {
      kind: 'spell-targeting-immunity'
      schools: readonly Dnd5eSpellbookSchoolId[]
    }
  | { kind: 'flight-speed'; speedFeet: number; hover?: true }
  /** Caps only flying speed, including innate/form flight; zero disables voluntary flight. */
  | { kind: 'flight-speed-limit'; maximumFeet: number }
  /** Keeps the target supported at its current elevation without granting a fly speed. */
  | { kind: 'magically-held-aloft' }
  /** Prevents ordinary falling damage up to this authoritative distance. */
  | { kind: 'safe-fall'; maximumFeet: number }
  /**
   * Keeps an unsupported creature in an authoritative controlled descent.
   * The turn-boundary mover lowers it by at most this distance, suppresses
   * ordinary landing damage and may consume the Effect when it lands.
   */
  | {
      kind: 'controlled-descent'
      maximumFeetPerRound: number
      safeLanding: true
      endsOnLanding: true
      /** Descend despite hover/magical support while an active cap blocks flight. */
      forceWhileFlightBlocked?: true
    }
  /** Spend movement to remove qualifying nonmagical movement-locking effects. */
  | {
      kind: 'automatic-escape'
      conditions: readonly ('grappled' | 'restrained')[]
      movementCostFeet: number
      sourceMagical?: boolean
    }
  /** Ignores speed reductions whose authoritative Active Effect source is magical. */
  | { kind: 'ignore-magical-speed-reductions' }
  | {
      kind: 'action-restriction'
      prohibited: readonly ('attack' | 'spellcasting' | 'object-interaction' | 'speech')[]
      /** When present, ordinary action-economy transactions are limited to this list. */
      allowedBasicActions?: readonly ('dash' | 'dismiss-effect')[]
      /** Registered Activities that remain legal while the ordinary-action whitelist is active. */
      allowedActivityIds?: readonly string[]
    }
  /** Temporarily raises the authoritative hit-point maximum. */
  | { kind: 'hit-point-maximum'; mode: 'add'; value: Dnd5eFormulaV1; increaseCurrentHitPoints?: boolean }
  /** Allows the affected creature to perceive invisible creatures while this Effect is active. */
  | { kind: 'see-invisible' }
  /** Invisible in darkness only to observers relying on darkvision. */
  | { kind: 'darkvision-concealment' }
  /** Emits a Host-rendered light source; dimRadiusFeet is additional distance beyond brightRadiusFeet. */
  | { kind: 'emitted-light'; brightRadiusFeet: number; dimRadiusFeet: number; color: string }
  /**
   * Closed language projection used by communication and readable-object
   * authority checks. `literal-written` deliberately does not decode secret
   * messages, glyphs or ciphers.
   */
  | {
      kind: 'language-capability'
      understandSpoken?: 'all'
      understandWritten?: 'literal-written'
      writtenRequiresTouch?: true
      writtenMinutesPerPage?: 1
      speechUnderstoodBy?: 'any-creature-knowing-a-language'
    }
  /**
   * Suppresses the creature's ordinary language faculties. This is separate
   * from `language-capability`: a temporary magical permission must not make a
   * Feeblemind target capable of understanding or intelligible speech.
   */
  | {
      kind: 'language-restriction'
      understandLanguages: false
      intelligibleCommunication: false
    }
  /**
   * Host-owned attack decoys such as Mirror Image. The array is indexed by
   * remaining decoys minus one, so `[11, 8, 6]` means 11+ with one image,
   * 8+ with two, and 6+ with three. A separate authoritative d20 is always
   * required; the attack roll itself is never reused for redirection.
   */
  | {
      kind: 'attack-decoys'
      count: number
      redirectMinimumD20: readonly number[]
      armorClassBase: number
      armorClassAbility: AbilityKey
      requiresOrdinarySight: true
    }
  /** Closed planar movement/interaction mode consumed by map and targeting authority. */
  | {
      kind: 'planar-phase'
      /** Sight into the material scene does not grant cross-plane interaction. */
      materialSightRangeFeet?: number
      plane: 'ethereal' | 'terrain'
      ignoresMaterialCollision: boolean
      suppressCrossPlaneEffects: true
      unrestrictedVerticalMovement: boolean
    }
  | ({ kind: 'solid-material-traversal' } & Dnd5eSolidMaterialTraversal)
  | { kind: 'source-location-awareness' }
  | { kind: 'tracking-capability'; mundaneTracking: 'impossible'; leavesTracks: false }
  /** Closed environmental permissions queried by travel and hazard authority. */
  | {
      kind: 'environmental-capability'
      breatheIn?: readonly 'water'[]
      doesNotNeedAir?: true
      holdBreathSeconds?: number
      treatLiquidSurfacesAsSolidGround?: true
      ignoreDifficultTerrain?: true
      ignoreDifficultTerrainMaterials?: readonly MapSurfaceMaterial[]
      ignoreUnderwaterMovementPenalty?: true
      ignoreUnderwaterAttackPenalty?: true
      occupyCreatureSpaces?: true
      /** Automatically approaches elevation 0 while the current map is underwater. */
      riseTowardLiquidSurfaceFeetPerRound?: number
      /** Can pass through explicitly mapped openings at least this wide. */
      minimumPassageGapInches?: number
    }
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
      amount: Dnd5eFormulaV1 | { kind: 'weapon-dice'; count: number; bonus?: number }
      damageType: Dnd5eDamageType | 'inherit-primary'
      appliesTo: 'this-weapon' | 'all-weapon-attacks'
      /** Explicit lifetime policy. Omitted retains legacy finite-effect single-hit behavior. */
      consumeEffectOnHit?: boolean
      /** Bind to the single Host-validated creature selected when applying this effect. */
      bindToSelectedTarget?: true
      /** Rewrite every damage component of the qualifying weapon attack before mitigation. */
      attackDamageTypeOverride?: Dnd5eDamageType
      doubleDiceOnCritical?: boolean
      oncePerTurn?: boolean
      targetCreatureTypes?: readonly string[]
      /** Closed target-side state installed only after the rider actually hits. */
      onHitTargetEffect?: {
        revealInvisible?: true
        preventInvisibility?: true
        emittedLight?: { brightRadiusFeet: number; dimRadiusFeet: number; color: string }
      }
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
  | 'rage-start'
  | 'combat-start'
  | 'combat-end'
  | 'round-start'
  | 'round-end'
  | 'turn-start'
  | 'turn-end'
  | 'other-turn-end'
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
  | 'damage-dealt'
  | 'marked-creature-damaged-other'
  | 'other-creature-took-attack-damage'
  | 'temporary-hit-points-gained'
  | 'before-save'
  | 'before-death-save'
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
  | 'spell-countered'
  | 'spell-dispelled'
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
  | 'self-dropped-to-zero'
  | 'self-involuntarily-incapacitated'
  | 'creature-died'
  | 'before-drop-to-zero'
  | 'short-rest-started'
  | 'long-rest-started'
  | 'short-rest-complete'
  | 'long-rest-complete'
  | 'creature-awakened'

export const DND5E_TRIGGER_EVENT_IDS_V1: readonly Dnd5eTriggerEventV1[] = [
  'rage-start',
  'combat-start', 'combat-end', 'round-start', 'round-end', 'turn-start', 'turn-end',
  'other-turn-end',
  'before-attack', 'after-attack', 'on-hit', 'on-miss',
  'attack-declared', 'before-attack-roll', 'after-attack-roll', 'attack-hit', 'attack-missed', 'attack-resolved',
  'before-damage', 'after-damage', 'damage-dealt', 'marked-creature-damaged-other', 'other-creature-took-attack-damage', 'temporary-hit-points-gained', 'before-save', 'before-death-save', 'after-save',
  'on-move', 'movement-started', 'movement-completed', 'on-enter-area', 'on-leave-area',
  'on-cast', 'after-cast', 'spell-cast', 'spell-resolved', 'spell-countered', 'spell-dispelled', 'skill-used', 'item-used', 'feature-used',
  'action-resolved', 'd20-roll-resolved', 'reaction-window', 'legendary-action-window', 'lair-action-window',
  'on-concentration-check', 'on-condition-attempted', 'on-condition-applied', 'on-defeat', 'creature-dropped-to-zero', 'self-dropped-to-zero', 'self-involuntarily-incapacitated', 'creature-died', 'before-drop-to-zero',
  'short-rest-complete', 'long-rest-complete',
  'short-rest-started', 'long-rest-started',
  'creature-awakened',
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
  ['other-turn-end', 'turn', 'boundary', true],
  ['attack-declared', 'declaration', 'after', true], ['before-attack-roll', 'roll', 'before', true],
  ['after-attack-roll', 'roll', 'after', true], ['attack-hit', 'roll', 'after', true],
  ['attack-missed', 'roll', 'after', true], ['attack-resolved', 'roll', 'after', false],
  ['before-damage', 'damage', 'before', true], ['after-damage', 'damage', 'after', true],
  ['damage-dealt', 'damage', 'after', true],
  ['marked-creature-damaged-other', 'damage', 'after', true],
  ['other-creature-took-attack-damage', 'damage', 'after', true],
  ['temporary-hit-points-gained', 'effects', 'after', true],
  ['before-save', 'roll', 'before', true], ['after-save', 'roll', 'after', true],
  ['before-death-save', 'roll', 'before', true],
  ['movement-started', 'movement', 'before', true], ['movement-completed', 'movement', 'after', true],
  ['on-enter-area', 'movement', 'after', true], ['on-leave-area', 'movement', 'after', true],
  ['spell-cast', 'declaration', 'after', true], ['spell-resolved', 'effects', 'after', true],
  ['spell-countered', 'effects', 'after', true], ['spell-dispelled', 'effects', 'after', true],
  ['skill-used', 'effects', 'after', true], ['item-used', 'effects', 'after', true],
  ['feature-used', 'effects', 'after', true], ['action-resolved', 'effects', 'after', true],
  ['d20-roll-resolved', 'roll', 'after', true], ['reaction-window', 'declaration', 'boundary', true],
  ['legendary-action-window', 'turn', 'boundary', true], ['lair-action-window', 'turn', 'boundary', true],
  ['on-concentration-check', 'roll', 'after', true],
  ['on-condition-attempted', 'effects', 'before', true], ['on-condition-applied', 'effects', 'after', true],
  ['before-drop-to-zero', 'damage', 'before', true], ['creature-dropped-to-zero', 'damage', 'after', true], ['self-dropped-to-zero', 'damage', 'after', true], ['self-involuntarily-incapacitated', 'effects', 'after', true],
  ['creature-died', 'effects', 'after', true],
  ['short-rest-complete', 'rest', 'after', false], ['long-rest-complete', 'rest', 'after', false],
  ['short-rest-started','rest','before',false], ['long-rest-started','rest','before',false],
  ['creature-awakened', 'effects', 'after', true],
].map(([event, stage, timing, interruptible]) => ({ event, stage, timing, interruptible })) as readonly Dnd5eActivityLifecycleEventDescriptorV1[]

export type Dnd5ePredicateV1 =
  | { kind: 'ethereal-access'; state: 'known' | 'available' | 'unavailable' }
  | { kind: 'upward-clearance'; subject: 'actor' | 'target'; distanceFeet: number | 'area-height'; blocked: boolean }
  | { kind: 'combat-active' }
  /** Requires a live Host turn; missing turn information satisfies neither case. */
  | { kind: 'turn-owner'; owner: 'actor' | 'other' }
  | { kind: 'minimum-level'; level: number }
  | { kind: 'class-level'; classId: string; minimum: number; maximum?: number }
  | { kind: 'hp-percentage'; subject: 'actor' | 'target'; comparison: 'at-most' | 'at-least'; value: number }
  | {
      kind: 'hp-value'
      subject: 'actor' | 'target'
      comparison: 'below' | 'at-most' | 'at-least' | 'above'
      /** Formula thresholds cover effects that test HP after their own rolled damage. */
      value: number | Dnd5eFormulaV1
    }
  | { kind: 'ability-score'; subject: 'actor' | 'target'; ability: AbilityKey; comparison: 'below' | 'at-most' | 'at-least' | 'above'; value: number }
  /** Effective Host movement speed in feet, after conditions and active modifiers. */
  | { kind: 'speed'; subject: 'actor' | 'target'; comparison: 'below' | 'at-most' | 'at-least' | 'above'; value: number }
  | { kind: 'condition'; subject: 'actor' | 'target'; condition: Dnd5eStandardConditionId; present: boolean }
  | { kind: 'illumination'; subject: 'actor' | 'target'; values: readonly ('bright' | 'dim' | 'darkness' | 'magical-darkness')[] }
  /** Host-derived vertical state; unsupported-airborne is the falling reaction boundary. */
  | { kind: 'airborne-state'; subject: 'actor' | 'target'; state: 'airborne' | 'unsupported-airborne' | 'grounded' }
  | { kind: 'rage-state'; subject: 'actor' | 'target'; active: boolean }
  | { kind: 'target-relation'; relation: 'self' | 'ally' | 'enemy' | 'any'; orCharmedByActor?: true }
  /** Distinguishes the actor from another selected creature without redefining ally semantics. */
  | { kind: 'target-identity'; identity: 'self' | 'other' }
  /** Target is a persistent Host summon owned by the current Activity actor. */
  | { kind: 'owned-companion'; subject: 'target'; bondKey?: string; source?: { packageId: string; activityId: string } }
  /** Host-derived from deafness plus map silence volumes for this Activity source. */
  | { kind: 'can-hear-source' }
  /** Actor and target share a concrete known language; hearing is independent. */
  | { kind: 'shared-language' }
  /** Current linguistic comprehension, including magical grants/restrictions; hearing is separate. */
  | { kind: 'can-understand-source-language' }
  /** Host speech production; does not imply hearing or language understanding. */
  | { kind: 'can-speak'; subject: 'actor' | 'target' }
  /** Remaining temporary HP must belong to this live, unsuspended effect. */
  | { kind: 'effect-bound-temporary-hit-points'; subject: 'actor' | 'target'; effectId: string }
  | ({ kind: 'active-effect'; subject: 'actor' | 'target'; present: boolean; source: 'any' | 'self' | 'target' } & (
      | { effectId: string; anyOf?: never }
      /** Alternatives match one unsuspended Host effect; all tags in an alternative must belong to that effect. */
      | { effectId?: never; anyOf: readonly ({ effectId: string; tags?: never } | { effectId?: never; tags: readonly string[] })[] }
    ))
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
  | { kind: 'attack-magical'; magical: boolean }
  | { kind: 'skill-proficiency'; subject?: 'actor' | 'target'; skill: string; rank: 0 | 1 | 2 }
  /** Host attack classification; independent of delivery or a magical weapon's damage. */
  | { kind: 'attack-category'; category: 'weapon' | 'spell' }
  /** Host delivery distinguishes melee spell attacks from ranged spell attacks. */
  | { kind: 'attack-delivery'; delivery: 'melee' | 'ranged' }
  /** Matches the concrete Host-derived weapon ID of the triggering attack. */
  | { kind: 'attack-weapon'; weaponIds: readonly string[]; identity?: 'instance' | 'base' }
  /** Host equipment classification; unknown, natural and unarmed attacks do not match. */
  | { kind: 'attack-weapon-category'; categories: readonly ('simple' | 'martial')[] }
  /** Distinguishes attacks made as part of the Attack action from bonus/reaction attacks. */
  | { kind: 'attack-origin'; origins: readonly ('attack-action' | 'bonus-action' | 'reaction' | 'other')[] }
  /** Uses the concrete grip chosen by the Host for the triggering weapon attack. */
  | { kind: 'attack-hands'; hands: 1 | 2 }
  | {
      kind: 'attack-mode'
      mode?: 'melee' | 'ranged' | 'spell' | 'unarmed'
      modes?: readonly ('melee' | 'ranged' | 'spell' | 'unarmed')[]
    }
  /** hit/miss include their critical variants; critical selectors match only that variant. */
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
  | { kind: 'movement-distance'; basis?: 'event' | 'straight-streak' | 'before-attack-straight-streak'; minimumFeet?: number; maximumFeet?: number }
  | { kind: 'movement-source-distance'; minimumFeet?: number; maximumFeet?: number }
  | { kind: 'initial-space-exit'; effectTag: string }
  | { kind: 'initial-space-melee-crossing'; effectTag: string }
  | { kind: 'movement-property'; straightLine?: boolean; dashedThisTurn?: boolean; movementKind?: 'voluntary' | 'mounted' | 'forced' | 'teleport' }
  | { kind: 'spell-used'; spellId?: string; schools?: readonly Dnd5eSpellbookSchoolId[]; castingClassIds?: readonly string[]; minimumLevel?: number; maximumLevel?: number }
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
  /** A magical non-spell effect. Does not turn its originating feature into a spell. */
  magical?: true
  /** Host-facing classification for non-condition status effects. */
  disposition?: 'buff' | 'debuff'
  /** Attitude only toward the Host-bound effect source; does not grant control. */
  sourceAttitude?: 'friendly'
  /** On ending, preserve nonmagical knowledge of the bound charmer. */
  endSavingThrow?: import('../effectEndSavingThrow').Dnd5eEffectEndSavingThrow
  onEndAwareness?: 'charmed-by-source'
  /** Closed semantic labels used by restoration/dispel operations. */
  tags?: readonly string[]
  duration: Dnd5eEffectDurationV1
  /**
   * Closed slot-level duration/concentration table for spells whose upcast
   * text changes more than a linear number of rounds (for example Bestow
   * Curse). The highest matching minimum level replaces the base profile.
   */
  castLevelProfiles?: readonly {
    minimumCastLevel: number
    duration: Dnd5eEffectDurationV1
    concentration: boolean
  }[]
  conditions?: readonly Dnd5eStandardConditionId[]
  /** Requires an uninterrupted timed condition; successful completion grants
   * short-rest benefits and a source-specific lockout until the next long rest. */
  completionReward?: { kind: 'short-rest'; requiresCondition: Dnd5eStandardConditionId }
  /** Data-only non-standard battlefield state, for example `banished`. */
  extensionCondition?: string
  modifiers?: readonly Dnd5eEffectModifierV1[]
  /** Closed lifecycle events that remove the effect after the event commits. */
  breakOn?: readonly (
    | 'takes-damage'
    | 'targeted-by-spell'
    | 'targeted-by-attack'
    | 'hit-by-attack'
    | 'makes-attack'
    | 'makes-weapon-attack'
    | 'casts-spell'
    | 'forces-saving-throw'
    | 'deals-damage'
    | 'attacked-by-source-or-ally'
    | 'damaged-by-source-or-ally'
    | 'forced-save-by-source-or-ally'
    | 'attacked-by-source-ally'
    | 'attacked-by-condition-entity'
    | 'damaged-by-condition-entity'
    | 'forced-save-by-condition-entity'
    | 'attacked-by-source'
    | 'damaged-by-source-ally'
    | 'forced-save-by-source-ally'
    | 'witnesses-ally-attacked'
    | 'witnesses-ally-damaged'
    | 'witnesses-source-attack-ally'
    | 'witnesses-source-damage-ally'
    | 'moves'
    | 'spends-action'
    | 'spends-action-except-granted'
    | 'spends-bonus-action'
    | 'spends-reaction'
    | 'awakened'
    | 'magical-healing'
    | 'reduced-to-zero'
    | 'short-rest-complete'
    | 'long-rest-complete'
    | 'source-dies'
    | 'source-long-rest-complete'
  )[]
  /** Removes a source-linked effect when authoritative combat facts invalidate the link. */
  sourceLink?: {
    sourceAttacksOtherTarget?: true
    sourceCastsSpellOnOtherTarget?: true
    targetHarmedBySourceAlly?: true
    /** Remove this effect as soon as the source no longer carries the named Effect. */
    sourceRequiresEffect?: string
    /** Host binds the required source effect created by this same application. */
    sourceRequiresEffectSameApplication?: true
    /** The source must refresh this Activity Effect before ending each turn. */
    sourceRequiresEffectAtSourceTurnEnd?: string
    maximumDistanceFeetAtSourceTurnEnd?: number
    maximumDistanceFeet?: number
    requiresLineOfEffect?: true
    /** Effect ends when the source is incapacitated or under a rule that prohibits speech. */
    sourceMustBeConsciousAndAbleToSpeak?: true
    /** Ends on source incapacitation, without imposing a speech requirement. */
    sourceMustNotBeIncapacitated?: true
    sourceRequiresHeldMeleeWeaponBaseIds?: readonly string[]
    /** Maintain audible, intelligible source speech to a conscious bearer. */
    requiresSourceCommunication?: true
    /** Maintain known-language overlap, independently of magical comprehension. */
    requiresSharedLanguage?: true
  }
  /** Repeated boundary save independent of the Effect's expiry; permanent means no arbitrary timeout. */
  /** Save before casting; failure wastes the spell without removing the effect. */
  attackAttemptWard?: Omit<Dnd5eAttackAttemptWard, 'dc'> & { dc: Dnd5eFormulaV1 }
  spellcastingSave?: { ability: AbilityKey; dc: Dnd5eFormulaV1 }
  repeatSaveAtTurnBoundary?: { ability: AbilityKey; dc: Dnd5eFormulaV1; timing: 'target-turn-start' | 'target-turn-end' }
  /** A Host-owned repeat save queued after the affected creature takes damage. */
  repeatSaveOnDamage?: {
    ability: AbilityKey
    dc: Dnd5eFormulaV1
    mode: 'normal' | 'advantage'
    sourceFilter?: 'any' | 'source-or-allies'
    advantageIfSourceOrAllies?: true
  }
  /** A Host-owned repeat save queued only after the affected creature actually moves. */
  repeatSaveAfterMovement?: {
    ability: AbilityKey
    dc: Dnd5eFormulaV1
  }
  /** Fixed-DC action escape shared by restraints, grapples and similar effects. */
  escapeCheck?: {
    ability: AbilityKey
    skill?: 'athletics' | 'acrobatics'
    alternativeAbility?: AbilityKey
    alternativeSkill?: 'athletics' | 'acrobatics'
    dc: Dnd5eFormulaV1
    economy: 'action'
    /** Closed creature profiles that still spend the action but automatically escape. */
    automaticSuccessStatBlockIds?: readonly string[]
  }
  /** The affected creature may spend its action to repeat a save and end this effect. */
  escapeSavingThrow?: {
    ability: AbilityKey
    dc: Dnd5eFormulaV1
    economy: 'action'
  }
  /** A rules-authored removal. Free removal must be self-only, range zero, without a check. */
  removalAction?: {
    label: string
    economy: 'action' | 'free'
    maxDistanceFeet: number
    selfOnly?: true
    abilityCheck?: {
      ability: AbilityKey
      skill?: 'medicine' | 'arcana' | 'athletics'
      dc: Dnd5eFormulaV1
    }
  }
  /** Applies a standard condition after this affected creature actually takes damage. */
  onDamageCondition?: {
    condition: Dnd5eStandardConditionId
    duration: 'until-target-next-turn-end'
  }
  /** Applies a closed action/movement restriction after this effect ends for any reason. */
  afterEffectEnds?: {
    duration: 'until-target-next-turn-end' | 'rounds'
    /** Required only for a fixed-round transition such as returning from gaseous form. */
    rounds?: number
    /** Voluntary transformations may transition only when their owner dismisses them. */
    trigger?: 'any-removal' | 'manual-removal' | 'non-manual-removal'
    /** Skip the follow-up unless the bearer is unsupported above the ground. */
    requiresAirborne?: boolean
    preventActions: boolean
    preventMovement: boolean
    /** Closed safe-descent profile used after a flying form ends. */
    controlledDescent?: {
      maximumFeetPerRound: number
      safeLanding: true
      endsOnLanding: true
    }
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
  /** Deterministic recurring healing resolved at the target's turn boundary. */
  periodicHealing?: {
    timing: 'target-turn-start' | 'target-turn-end'
    amount: Dnd5eFormulaV1
  }
  /** Restores missing body parts after the target has completed this many turns. */
  /** Prevents animation of remains while this effect lasts. Slot level never implies Wish. */
  undeadCreationProtection?: { minimumPower: 'wish' }
  bodyRestoration?: {
    afterRounds: number
  }
  /** Host-owned campaign-clock save repeated at a fixed calendar interval. */
  calendarRepeatSave?: {
    intervalMinutes: number
    ability: AbilityKey
    dc: Dnd5eFormulaV1
    onSuccess: 'remove'
  }
  /** Banishes foreign-planar targets indefinitely and local natives for a bounded interval. */
  planarBanishment?: {
    foreignCreatureTypes: readonly string[]
    foreignDuration: 'permanent'
    localDurationRounds: number
  }
  grants?: readonly string[]
  /** Remove the granting effect after a successful use of a granted Activity. */
  grantsSingleUse?: true
  grantCharges?: Dnd5eEffectGrantChargeDeclaration
  /** Granted to the bearer only after natural timed completion; interruption cancels it. */
  completionGrant?: { activityIds: readonly string[]; availableRounds: number; continueUntilUsed?: true; recipient?: 'source'; bindTarget?: 'bearer' | 'source'; singleUse?: true }
  /**
   * Keep this Effect persisted but mechanically dormant while another named
   * Effect on the same bearer is active. The Host stores the concrete
   * suspension instance id and clears it atomically when that Effect ends.
   */
  suspendWhileEffectId?: string
  triggers?: readonly Dnd5eTriggerDefinitionV1[]
  /** Stacking applies per bearer; unique-by-source replaces that source's copy on this target only. */
  stacking: 'replace' | 'refresh-duration' | 'stack' | 'highest' | 'lowest' | 'unique-by-source'
  /** Mutually exclusive stance/mode group on one bearer, scoped to the applying source. */
  exclusiveGroup?: string
  /** Bearer-scoped groups replace another source's copy on this target. */
  exclusiveGroupScope?: 'source' | 'bearer'
  concentration?: boolean
  /** Restrained effects from an area control end with the Host-owned granting area, including across maps. */
  bindToGrantingArea?: true
  /** Capture the bearer's original occupied volume from authoritative map geometry. */
  captureInitialSpace?: true
  /** The bounded concentration duration completing naturally promotes this effect to permanent. */
  persistAfterConcentrationCompletes?: true
  dispel?: { kind: 'spell-level'; level: number } | { kind: 'dm-adjudication'; reason: string }
}


