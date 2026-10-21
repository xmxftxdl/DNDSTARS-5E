import { validDnd5eHeldWeaponBaseIds } from './heldMeleeWeaponRequirement'
import { normalizeDnd5eAttackAttemptWard, normalizeDnd5eAttackAttemptWardReceipts, normalizeDnd5eSourceTurnSpellSaveDisadvantage, type Dnd5eAttackAttemptWard, type Dnd5eAttackAttemptWardReceipt, type Dnd5eSourceTurnSpellSaveDisadvantage } from './attackAttemptWard'
import { isDnd5eSourceAuraRequirement, type Dnd5eSourceAuraRequirement } from './sourceAuraRequirement'
import { validDnd5eEffectEndSavingThrow, retainDnd5eEndedEffectSavingThrows, type Dnd5eEffectEndSavingThrow } from './effectEndSavingThrow'
import { normalizeDnd5eLinkedTargetPresentation } from './linkedTargetPresentationSchema'
import { normalizeDnd5eCapturedCreatureIdentity, type Dnd5eCapturedCreatureIdentity } from './capturedCreatureIdentity'
import { normalizeDnd5eSolidMaterialTraversal, type Dnd5eSolidMaterialTraversal } from './solidMaterialTraversal'
import { normalizeDnd5eInitialSpaceBoundary, type Dnd5eInitialSpaceBoundary } from './initialSpaceBoundary'
import { validMapSurfaceMaterials, type MapSurfaceMaterial } from '../../lib/mapSurfaceMaterials'
import { normalizeDnd5eEffectGrantCharges, dnd5eEffectGrantChargeLight, type Dnd5eEffectGrantCharges } from './effectGrantCharges'
import { normalizeDnd5eUndeadCreationProtection, type Dnd5eUndeadCreationProtection } from './undeadCreationProtection'
import { normalizeDnd5eCohortArmorClass, dnd5eCohortArmorClassBonus, type Dnd5eCohortArmorClass } from './cohortArmorClass'
import { validDnd5eSourceProximityAttack, type Dnd5eSourceProximityAttack } from './sourceProximityAttack'
import { validWeaponFocusClassIds } from './weaponFocus'
import { normalizeDnd5eOwnedCompanionProximityRules, dnd5eNearbyOwnedCompanions, type Dnd5eOwnedCompanionProximity, type Dnd5eOwnedCompanionMapContext } from './ownedCompanionProximity'
import { validDnd5eAbilityCheckRule, normalizeDnd5eAbilityCheckRules, dnd5eAbilityCheckRuleAbilities, type Dnd5eAbilityCheckRule } from './abilityCheckRules'
import { SKILLS as EFFECT_SKILLS } from '../../lib/dnd'
import { normalizeDnd5eIncomingWeaponAttackModifiers, type Dnd5eIncomingWeaponAttackModifier } from './incomingWeaponAttackModifiers'
import { normalizeDnd5eCampaignPeriodicHitPointMaximumReduction, type Dnd5eCampaignPeriodicHitPointMaximumReduction } from './calendarMaximumReduction'
import type { AbilityKey } from '../../lib/dnd'
import {
  DND5E_STANDARD_CONDITION_IDS,
  DND5E_STANDARD_CONDITIONS,
  dnd5eConditionRequiresActorSource,
  dnd5eStandardConditionId,
  type Dnd5eStandardConditionId,
} from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import { ACTIVE_EFFECT_BREAK_TRIGGERS } from '../../../shared/active-effect-break-triggers.mjs'
import { normalizeDnd5eRollDiceModifiers, type Dnd5eRollDiceModifier } from './rollDiceModifiers'
import { validDnd5eOptionalBonusDieSourceConstraint, type Dnd5eOptionalBonusDieSourceConstraint } from './optionalBonusDieEligibility'

export const DND5E_ACTIVE_EFFECT_SCHEMA_VERSION = 1 as const
export const DND5E_COMBAT_STATE_SCHEMA_VERSION = 2 as const

export type Dnd5eActiveEffectKind = 'condition' | 'mark' | 'buff' | 'debuff' | 'custom'
export type Dnd5eActiveEffectSourceKind =
  | 'dm'
  | 'spell'
  | 'feature'
  | 'item'
  | 'monster'
  | 'plugin'
  | 'system'
  | 'legacy'

export type Dnd5eActiveEffectStackingPolicy =
  | 'reject'
  | 'refresh-duration'
  | 'replace'
  | 'keep-strongest'
  | 'stack'

export type Dnd5eActiveEffectBreakTrigger = typeof ACTIVE_EFFECT_BREAK_TRIGGERS[number]

export type Dnd5eActiveEffectTurnBoundary =
  | 'source-turn-start'
  | 'source-turn-end'
  | 'target-turn-start'
  | 'target-turn-end'

export type Dnd5eOptionalBonusDieRollKind = 'ability-check' | 'saving-throw'

export interface Dnd5eActiveEffectOptionalBonusDie {
  /** Restricts use to the same effect's Host-bound on-hit target. */
  boundTargetSource?: Dnd5eOptionalBonusDieSourceConstraint
  sides: 4 | 6 | 8 | 10 | 12
  appliesTo: readonly Dnd5eOptionalBonusDieRollKind[]
  /** True removes the effect after a valid use; false retains it until normal expiry. */
  consumeOnUse: boolean
}

export interface Dnd5eActiveEffectSource {
  /** Host-owned execution that created/refreshed an Activity grant. */
  executionId?: string
  kind: Dnd5eActiveEffectSourceKind
  actorId?: string
  /** Stable persisted character id when actorId is a map-token id. */
  characterId?: string
  /** Host-captured source rest watermark; null means no prior long rest. */
  lastLongRestWorldMinute?: number | null
  actorName?: string
  rulesId?: string
  /** The authoritative slot level used to create a spell effect. */
  spellLevel?: number
  /** The caster's save DC captured when a spell effect is created. */
  spellSaveDc?: number
  /** Non-spell magical effects such as a monster's petrifying gaze. */
  magical?: boolean
  label?: string
  pluginId?: string
}

export interface Dnd5eSourceBoundConditionValidation {
  ok: boolean
  effect?: Dnd5eActiveEffectInstance
  reason?: 'missing-source' | 'self-source' | 'unavailable-source'
}

export type Dnd5eActiveEffectDuration =
  | { type: 'permanent' }
  | {
      type: 'rounds'
      remainingRounds: number
      tickOn: Dnd5eActiveEffectTurnBoundary
      /** 防止同一回合边界因多次 Headless 事务而重复扣减。 */
      lastTickTurnKey?: string
    }
  | { type: 'until-turn-boundary'; boundary: Dnd5eActiveEffectTurnBoundary; appliedTurnKey?: string; includeCreationTurn?: boolean }
  | { type: 'concentration'; sourceActorId: string; concentrationId?: string; remainingRounds?: number }

export interface Dnd5eActiveEffectRepeatSave {
  disadvantage?: boolean
  ability: AbilityKey
  dc: number
  timing: 'target-turn-start' | 'target-turn-end' | 'on-damage' | 'after-movement'
  /** The Host's current LOS snapshot must show that the target cannot see the source. */
  requiresSourceNotVisible?: boolean
  /** 受到伤害后额外触发一次豁免；由 Headless 记录待结算项，客户端不能自行伪造。 */
  onDamage?: {
    mode: 'normal' | 'advantage'
    /** Restricts monster charm retries to harm caused by that monster or its allies. */
    sourceFilter?: 'any' | 'source-or-allies'
    /** The retry always occurs, but harm caused by the effect source or its allies grants advantage. */
    advantageIfSourceOrAllies?: true
  }
  /** 部分持续法术会在重复豁免失败时造成伤害；骰池由 Host 校验并结算。 */
  damageOnFailure?: {
    count: number
    sides: number
    modifier?: number
    type: Dnd5eDamageType
    destroysBodyOnDeath?: boolean
  }
  /**
   * A tightly-scoped, authoritative state transition after a failed repeat
   * save. This models staged conditions such as restrained -> petrified
   * without allowing saved content to inject arbitrary Headless operations.
   */
  onFailureTransition?:
    | { outcome: 'retain-effect' }
    | {
        outcome?: 'replace-condition'
        replaceWithCondition: Dnd5eStandardConditionId
        duration: 'permanent' | 'source-concentration-then-permanent'
      }
  /** Cumulative progress for staged saves. Defaults remain 1 success / no failure threshold. */
  successesRequired?: number
  failuresRequired?: number
  successes?: number
  failures?: number
  onSuccess: 'remove'
}

export interface Dnd5eActiveEffectEscapeCheck {
  ability: AbilityKey
  /** Optional skill specialization used by fixed-DC monster escapes. */
  skill?: 'athletics' | 'acrobatics'
  /** 规则允许目标自行选择另一项属性时，Host 会采用目标更有利的合法选项。 */
  alternativeAbility?: AbilityKey
  /** Optional skill specialization for alternativeAbility. */
  alternativeSkill?: 'athletics' | 'acrobatics'
  dc: number
  economy: 'action'
  /** Stat-block profiles whose rules explicitly make this escape check succeed without a roll. */
  automaticSuccessStatBlockIds?: readonly string[]
}

export interface Dnd5eActiveEffectEscapeSavingThrow {
  ability: AbilityKey
  dc: number
  economy: 'action'
}

export interface Dnd5eActiveEffectOnDamageCondition {
  condition: Dnd5eStandardConditionId
  duration: 'until-target-next-turn-end'
}

export interface Dnd5eActiveEffectAfterEffectEnds {
  duration: 'until-target-next-turn-end' | 'rounds'
  rounds?: number
  trigger?: 'any-removal' | 'manual-removal' | 'non-manual-removal'
  requiresAirborne?: boolean
  preventActions: boolean
  preventMovement: boolean
  controlledDescent?: {
    maximumFeetPerRound: number
    safeLanding: true
    endsOnLanding: true
  }
}

/**
 * Authoritative damage resolved at a target turn boundary. The Host supplies
 * the concrete dice in the begin-turn transaction; saved effects only carry
 * the bounded dice declaration.
 */
export interface Dnd5eActiveEffectPeriodicDamage {
  /**
   * Most hazards tick when the affected creature starts its turn. Creatures
   * carried inside a monster instead tick when that source monster starts its
   * turn (for example, swallowed acid damage).
   */
  timing: 'target-turn-start' | 'target-turn-end' | 'source-turn-start'
  count: number
  sides: number
  modifier?: number
  /** Omit for rules that explicitly cause hit-point loss rather than damage. */
  type?: Dnd5eDamageType
  /**
   * Some source-turn hazards allow the affected creature to avoid or reduce
   * the tick (for example a shambling mound's Engulf). The concrete save dice
   * remain transaction input and are never persisted in the effect.
   */
  savingThrow?: {
    ability: AbilityKey
    dc: number
    magical?: boolean
    damageOnSuccessfulSave: 'none' | 'half'
  }
  /** Running damage dealt by this periodic payload, used by bounded attachment rules. */
  cumulativeDamage?: number
  /** Remove the owning effect after its periodic payload has dealt this much damage. */
  removeEffectAfterCumulativeDamage?: number
  /** Prevents a retried begin-turn transaction from applying the damage twice. */
  lastResolvedTurnKey?: string
}

/**
 * A rules-authored way to remove an effect without granting arbitrary saved
 * content an executable callback. Any creature in range may take the action.
 */
export interface Dnd5eActiveEffectRemoval {
  action?: {
    label: string
    economy: 'action' | 'free'
    maxDistanceFeet: number
    /** Only the affected creature may take this removal action. */
    selfOnly?: true
    abilityCheck?: {
      ability: AbilityKey
      skill?: 'medicine' | 'arcana' | 'athletics'
      dc: number
    }
  }
  onMagicalHealing?: true
  /** Host-bound physical instance; loss of sight or transfer is not destruction. */
  onInventoryInstanceDestroyed?: string
  /** Closed source/target lifecycle rules shared by compelled effects. */
  sourceLink?: {
    sourceAttacksOtherTarget?: true
    sourceCastsSpellOnOtherTarget?: true
    targetHarmedBySourceAlly?: true
    sourceRequiresEffect?: string
    sourceRequiresEffectSameApplication?: true
    sourceRequiresEffectInstanceId?: string
    sourceRequiresEffectAtSourceTurnEnd?: string
    maximumDistanceFeetAtSourceTurnEnd?: number
    maximumDistanceFeet?: number
    requiresLineOfEffect?: true
    sourceMustBeConsciousAndAbleToSpeak?: true
    sourceMustNotBeIncapacitated?: true
    sourceRequiresHeldMeleeWeaponBaseIds?: readonly string[]
    requiresSourceCommunication?: true
    requiresSharedLanguage?: true
  }
}

export interface Dnd5eActiveEffectRelation {
  schemaVersion: 1
  kind: 'grapple' | 'attachment' | 'swallowed' | 'engulfed'
  sourceActorId: string
  sourceActionId: string
  slotGroup: string
  maxDistanceFeet: number
  /**
   * drag-target charges the ordinary grapple movement tax; carry-target
   * follows the source for free; source-rides-target follows the affected
   * target (a cloaker attached to its victim).
   */
  movement: 'drag-target' | 'carry-target' | 'source-rides-target'
  endsOnSourceIncapacitated: boolean
  /** Present only after a swallowed relation's source has become a corpse. */
  corpseEscape?: {
    movementCostFeet: number
    applyProne: true
  }
}

export interface Dnd5eActiveEffectSavingThrowRoll {
  disadvantageNegation?: { rollId: string; transactionId: string }
  disadvantageNegationChoice?: { featureId: string; rollId: string; transactionId: string; contextId: string }
  effectId: string
  targetId?: string
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  damageRolls?: readonly number[]
  blessRoll?: number
  baneRoll?: number
  rerollResourceKey?: string; rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
}

export interface Dnd5eActiveEffectPeriodicDamageRoll {
  effectId: string
  targetId: string
  rolls: readonly number[]
  d20?: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  blessRoll?: number
  baneRoll?: number
  rerollResourceKey?: string; rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  legendaryResistance?: boolean
}

export interface Dnd5eActiveEffectRandomConditionRoll {
  effectId: string
  roll: number
}

export interface Dnd5eActiveEffectTurnEndRandomCondition {
  dieSides: number
  minimum: number
  condition: Dnd5eStandardConditionId | 'banished'
}

/** Reads the closed extension emitted by core.turn-end-random-condition. */
export function dnd5eActiveEffectTurnEndRandomCondition(
  effect: Dnd5eActiveEffectInstance,
): Dnd5eActiveEffectTurnEndRandomCondition | undefined {
  if (effect.suspendedBy?.length) return undefined
  const match = effect.legacyCondition?.match(/^turn-end-random-condition:(\d+):(\d+):([a-z-]+)$/)
  if (!match) return undefined
  const dieSides = Number(match[1])
  const minimum = Number(match[2])
  const condition = match[3]!
  if (
    !Number.isInteger(dieSides) || dieSides < 2 || dieSides > 100 ||
    !Number.isInteger(minimum) || minimum < 1 || minimum > dieSides ||
    (condition !== 'banished' && !DND5E_STANDARD_CONDITION_IDS.includes(condition as Dnd5eStandardConditionId))
  ) return undefined
  return { dieSides, minimum, condition: condition as Dnd5eStandardConditionId | 'banished' }
}

export type Dnd5ePersistentDetectionMode =
  | 'magic'
  | 'planar-creatures'
  | 'undead-presence'
  | 'poison-disease'

export interface Dnd5eActiveEffectPersistentDetection {
  mode: Dnd5ePersistentDetectionMode
  rangeFeet: number
}

/** Reads the closed extension emitted by core.persistent-detection. */
export function dnd5eActiveEffectPersistentDetection(
  effect: Dnd5eActiveEffectInstance,
): Dnd5eActiveEffectPersistentDetection | undefined {
  if (effect.suspendedBy?.length) return undefined
  const match = effect.legacyCondition?.match(
    /^persistent-detection:(magic|planar-creatures|poison-disease|undead-presence):(\d+)$/,
  )
  if (!match) return undefined
  const rangeFeet = Number(match[2])
  if (!Number.isInteger(rangeFeet) || rangeFeet < 5 || rangeFeet > 10_000) return undefined
  return { mode: match[1] as Dnd5ePersistentDetectionMode, rangeFeet }
}

/**
 * Headless 可执行的声明式修正。规则包只能写这些公开能力，不能携带任意 JavaScript。
 */
export interface Dnd5eActiveEffectModifiers {
  sourceProximityAttackAdvantage?: Dnd5eSourceProximityAttack
  speedPenaltyFeet?: number
  speedBonusFeet?: number
  speedOverrideFeet?: number
  speedMinimumFeet?: number
  speedMaximumFeet?: number
  /** Multiplies the final speed. Multiple independent effects multiply together. */
  speedMultiplier?: number
  /** Caps the number of attacks the creature can make on each of its turns. */
  maximumAttacksPerTurn?: number
  /** One Host-owned additional action limited to the listed basic action kinds. */
  restrictedExtraAction?: {
    allowedActions: readonly ('weapon-attack' | 'dash' | 'disengage' | 'hide' | 'use-object')[]
    maximumWeaponAttacks: 1
  }
  /** Blocks action, bonus-action and reaction transactions while active. */
  preventActions?: boolean
  preventRestBenefits?: true
  actionRestriction?: {
    prohibited: readonly ('attack' | 'spellcasting' | 'object-interaction' | 'speech')[]
    allowedBasicActions?: readonly ('dash' | 'dismiss-effect')[]
    allowedActivityIds?: readonly string[]
  }
  /** Enemies in this radius have disadvantage on saves against matching spell damage types. */
  spellSaveDisadvantageAura?: {
    radiusFeet: number
    damageTypes: readonly Dnd5eDamageType[]
    spellcastingClassIds?: readonly string[]
  }
  /** Action-cast spells from these classes may consume a bonus action. */
  spellActionAsBonusActionClassIds?: readonly string[]
  /** The creature can use either an action or a bonus action on its turn, but not both. */
  actionOrBonusActionOnly?: boolean
  /**
   * A one-action spell requires this independent roll. Results at or above
   * `delayMinimum` postpone the spell until the creature's next turn.
   */
  actionSpellDelay?: {
    dieSides: 20
    delayMinimum: number
  }
  /** Grants darkvision to at least this range without replacing a longer innate range. */
  darkvisionRangeFeet?: number
  /** Resolved after combining innate and other active darkvision sources. */
  darkvisionIfAbsentFeet?: number
  darkvisionExistingBonusFeet?: number
  darkvisionRacialFallbackFeet?: number
  darkvisionRacialBonusFeet?: number
  /** Uses the final walking speed as the climbing speed. */
  climbSpeedEqualsWalking?: boolean
  climbingCheckAdvantage?: true
  poisonSavingThrowAdvantage?: true
  /** Uses the final walking speed as the swimming speed. */
  swimSpeedEqualsWalking?: boolean
  /** Grants true sight to at least this range. */
  truesightRangeFeet?: number
  sightRangeLimitFeet?: number
  /** Host-enforced immunity to being selected by spells from these schools. */
  spellTargetingImmunitySchools?: readonly import('./spellbook').Dnd5eSpellbookSchoolId[]
  /** Allows ordinary sight to perceive invisible creatures and objects. */
  seeInvisible?: boolean
  /** The bearer retains invisibility effects but cannot benefit from them. */
  suppressInvisibilityBenefits?: true
  invisibleToDarkvision?: boolean
  /** Authoritative language permissions projected by temporary effects. */
  languageCapabilities?: {
    understandSpoken?: 'all'
    understandWritten?: 'literal-written'
    writtenRequiresTouch?: true
    writtenMinutesPerPage?: 1
    speechUnderstoodBy?: 'any-creature-knowing-a-language'
  }
  /** Negative language authority; when present it wins over granted capabilities. */
  languageRestriction?: {
    understandLanguages: false
    intelligibleCommunication: false
  }
  /** Mutable Host-owned decoy pool consumed by redirected attacks. */
  attackDecoys?: {
    remaining: number
    redirectMinimumD20: readonly number[]
    armorClassBase: number
    armorClassAbility: AbilityKey
    requiresOrdinarySight: true
  }
  planarPhase?: {
    materialSightRangeFeet?: number
    plane: 'ethereal' | 'terrain'
    ignoresMaterialCollision: boolean
    suppressCrossPlaneEffects: true
    unrestrictedVerticalMovement: boolean
  }
  solidMaterialTraversal?: Dnd5eSolidMaterialTraversal
  trackingCapability?: { mundaneTracking: 'impossible'; leavesTracks: false }
  /** Environmental travel/survival permissions consumed by Host queries. */
  environmentalCapabilities?: {
    breatheIn?: readonly 'water'[]
    doesNotNeedAir?: true
    holdBreathSeconds?: number
    treatLiquidSurfacesAsSolidGround?: true
    ignoreDifficultTerrain?: true
    ignoreDifficultTerrainMaterials?: readonly MapSurfaceMaterial[]
    ignoreUnderwaterMovementPenalty?: true
    ignoreUnderwaterAttackPenalty?: true
    occupyCreatureSpaces?: true
    riseTowardLiquidSurfaceFeetPerRound?: number
    minimumPassageGapInches?: number
  }
  /** Light emitted by this combatant while the effect remains effective. */
  emittedLight?: {
    brightRadiusFeet: number
    dimRadiusFeet: number
    color: string
    /** The emitted light counts as sunlight for rules that care about sunlight. */
    sunlight?: true
  }
  /** 授予飞行速度，但不改写生物的固有移动资料。 */
  flySpeedFeet?: number
  flySpeedLimitFeet?: number
  hoverWhileFlying?: boolean
  /** Keeps an elevated creature supported without granting voluntary flight. */
  magicallyHeldAloft?: boolean
  submerged?: true
  jumpDistanceMultiplier?: number
  sizeRankDelta?: -1 | 1
  strengthRollMode?: 'advantage' | 'disadvantage'
  /** Grants advantage on checks using the listed abilities. */
  skillCheckBonuses?: readonly { skill: string; ability?: AbilityKey; bonus: number }[]
  abilityCheckRules?: readonly Dnd5eAbilityCheckRule[]
  abilityCheckAdvantages?: readonly AbilityKey[]
  /** Imposes disadvantage on checks using the listed abilities. */
  abilityCheckDisadvantages?: readonly AbilityKey[]
  /** Minimum raw d20 result used by checks with the corresponding ability. */
  minimumAbilityCheckD20ByAbility?: Partial<Record<AbilityKey, number>>
  /** Grants advantage only on checks using one of the listed stable skill ids. */
  skillExpertise?: readonly string[]
  skillCheckAdvantages?: readonly string[]
  /** Imposes disadvantage only on checks using one of the listed stable skill ids. */
  skillCheckDisadvantages?: readonly string[]
  /** Location only, relative to the effect source; callers must verify the same plane. */
  locationKnownToSource?: boolean
  perceptionDisadvantageAgainstOthersThanSource?: boolean
  skillCheckBonusAuras?: readonly {
    skill: string
    bonus: number
    radiusFeet: number
    relation: 'ally-and-self'
    mundaneTracking?: 'impossible'
    leavesTracks?: false
  }[]
  /** Imposes disadvantage on saving throws using the listed abilities. */
  savingThrowDisadvantages?: readonly AbilityKey[]
  /** Grants advantage on saving throws using the listed abilities. */
  savingThrowAdvantages?: readonly AbilityKey[]
  deathSavingThrowAdvantage?: boolean
  maximizeHealingDice?: boolean
  maximizeHealingDiceNearCompanion?: readonly Dnd5eOwnedCompanionProximity[]
  /** Multiplies carrying capacity without changing optional encumbrance thresholds. */
  carryingCapacityMultiplier?: number
  /** Prevents damage and prone from falls no longer than this distance while not incapacitated. */
  safeFallFeet?: number
  /** Host-owned unsupported descent rate; unlike a fly speed this never permits upward movement. */
  controlledDescent?: {
    maximumFeetPerRound: number
    safeLanding: true
    endsOnLanding: true
    forceWhileFlightBlocked?: true
  }
  automaticEscape?: {
    conditions: readonly ('grappled' | 'restrained')[]
    movementCostFeet: number
    sourceMagical?: boolean
  }
  ignoreMagicalSpeedReductions?: boolean
  /**
   * A delayed weapon-hit rider. Dice remain declarations until an actual hit;
   * the Host attack transaction supplies and validates their concrete values.
   */
  onHitBonusDamage?: {
    count: number
    sides: number
    bonus: number
    /** Resolve sides from the current Host weapon profile; stored sides is a serialization placeholder only. */
    useWeaponDie?: true
    damageType: Dnd5eDamageType | 'inherit-primary'
    appliesTo: 'this-weapon' | 'all-weapon-attacks'
    weaponId?: string
    doubleDiceOnCritical: boolean
    oncePerTurn: boolean
    targetCreatureTypes?: readonly string[]
    onHitTargetEffect?: {
      revealInvisible?: true
      preventInvisibility?: true
      emittedLight?: {
        brightRadiusFeet: number
        dimRadiusFeet: number
        color: string
      }
    }
    lastUsedTurnKey?: string
    consumeEffectOnHit: boolean
    /** Host-bound selected creature; never accepted as an Activity author supplied id. */
    boundTargetId?: string
    attackDamageTypeOverride?: Dnd5eDamageType
  }
  /** Additive maximum-hit-point projection from temporary spell/effect state. */
  hitPointMaximumBonus?: number
  /** The application transaction raises current HP by the same delta exactly once. */
  increaseCurrentHitPointsWithMaximum?: boolean
  armorClassBonus?: number
  cohortArmorClass?: Dnd5eCohortArmorClass
  /** Adds to this Effect source's AC only against attacks made by the Effect holder. */
  attacksAgainstSourceArmorClassBonus?: number
  savingThrowBonus?: number
  /** Adds a modifier only to saves made with the corresponding ability. */
  savingThrowBonusByAbility?: Partial<Record<AbilityKey, number>>
  /** Grants proficiency once, evaluated using the target's current proficiency bonus. */
  attackActionMinimum?: number
  ownTurnAttackActionBonus?: number
  equipmentProficiencies?: readonly ('light' | 'medium' | 'heavy' | 'shield' | 'simple' | 'martial')[]
  savingThrowProficiencies?: readonly AbilityKey[]
  /** A player-controlled die that is offered only when it can change a failed d20 result. */
  optionalBonusDie?: Dnd5eActiveEffectOptionalBonusDie
  /** Mandatory fresh dice for each qualifying roll; never consumed as an optional bonus. */
  rollDiceModifiers?: readonly Dnd5eRollDiceModifier[]
  /** Generic advantage/disadvantage applied to every attack roll made by the creature. */
  attackRollAdvantage?: boolean
  attackRollDisadvantage?: boolean
  weaponCategoryRollModes?: readonly { mode: 'advantage' | 'disadvantage'; categories: readonly ('simple' | 'martial')[] }[]
  weaponAttackRollAdvantage?: boolean
  weaponAttackRollDisadvantage?: boolean
  /** Restricts attack-roll disadvantage to attacks using one of these abilities. */
  attackRollDisadvantageAbilities?: readonly AbilityKey[]
  attackRollAdvantageAbilities?: readonly AbilityKey[]
  /** Every eligible attack against the affected creature has advantage. */
  attacksAgainstTargetAdvantage?: boolean
  attacksAgainstTargetDisadvantage?: boolean
  weaponAttacksAgainstTarget?: readonly Dnd5eIncomingWeaponAttackModifier[]
  attacksAgainstTargetDisadvantageCreatureTypes?: readonly string[]
  walkingSpeedBonusFeet?: number
  speedAfterOwnTurnWeaponAttackFeet?: number
  speedAfterOwnTurnWeaponAttackActionOnly?: boolean
  preventMovementOpportunityAttacks?: boolean
  /** Only the effect source's attacks against its bearer receive this threshold. */
  damageRollsBySourceBonus?: number
  attacksBySourceCriticalThreshold?: number
  cannotBeSurprisedWhileConscious?: boolean
  preventsRevival?: boolean
  nextD20AdvantageRollKinds?: readonly ('attack' | 'ability-check' | 'saving-throw')[]
  perceiveVisibleCreaturesAsHostile?: boolean
  mandatoryOpportunityAttacks?: boolean
  randomVisibleCreatureTargets?: boolean
  /** Attacks against creatures other than this effect's source have disadvantage. */
  attackDisadvantageAgainstOthersThanSource?: boolean
  /** Applies only while the bearer is within this distance of the effect source. */
  attackDisadvantageAgainstOthersThanSourceRangeFeet?: number
  notifySourceOnBearerDamage?: true
  /** The next attack by a creature other than this effect's source has advantage. */
  nextAttackAdvantageByOtherThanSource?: boolean
  resistanceToAllDamage?: boolean
  /** Consumed by the next hit by the source or an ally; scoped to that attack packet. */
  nextSourceOrAllyAttackVulnerability?: boolean
  vulnerabilityToAllDamage?: boolean
  weaponDamageD4?: 'add' | 'subtract'
  weaponDamageMultipliers?: readonly {
    multiplier: number
    ability?: 'str' | 'dex'
    attackModes?: readonly ('melee' | 'ranged')[]
  }[]
  /** The ordinary base weapon component is omitted; a registered Activity supplies replacement damage. */
  weaponDamageReplacementAttackModes?: readonly ('melee' | 'ranged')[]
  /** A destination beyond this source-relative boundary requires a Host saving throw. */
  movementBoundarySave?: {
    maximumDistanceFeet: number
    ability: AbilityKey
    dc: number
  }
  /** Closed, data-only attack profile rewrites contributed by Activity effects. */
  attackProfiles?: readonly {
    attackModes: readonly ('melee' | 'ranged' | 'unarmed')[]
    weaponIds?: readonly string[]
    reachBonusFeet?: number
    criticalThreshold?: number
    damageTypeOverride?: Dnd5eDamageType
  }[]
  preventReactions?: boolean
  /** Forces the creature to flee from this effect's source and limits its turn choices. */
  forcedFleeFromSource?: boolean
  /** The creature cannot regain hit points while this effect is active. */
  preventHealing?: boolean
  /** The creature may regain hit points only from magical healing. */
  preventNonmagicalHealing?: boolean
  damageResistance?: Dnd5eDamageType
  /** Suppresses matching resistance while effective; never deletes its source. */
  suppressDamageResistance?: Dnd5eDamageType
  conditionalDamageResistances?: readonly {
    sourceAura?: Dnd5eSourceAuraRequirement
    damageTypes: readonly Dnd5eDamageType[]
    sourceMagical?: boolean
    attackOnly?: boolean
    deliveries?: readonly ('weapon-attack' | 'spell' | 'other')[]
  }[]
  damageImmunity?: Dnd5eDamageType
  damageVulnerability?: Dnd5eDamageType
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  conditionImmunitiesBySourceCreatureType?: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  savingThrowAdvantagesBySourceCreatureType?: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  conditionImmunitiesBySourceMagic?: readonly {
    conditions: readonly string[]
    sourceMagical: boolean
    suppressExisting?: true
  }[]
  /** Calm Emotions: concrete combatants this creature is temporarily indifferent toward. */
  calmEmotionsIndifferentTargetIds?: readonly string[]
  /** 橡棍术只强化施法时所持的短棒或长棍。 */
  shillelagh?: {
    weaponId: string
    spellcastingAbility: AbilityKey
    spellcastingModifier: number
  }
  /** 魔化武器只跟随施法时触碰的那一把武器；bonus 同时用于命中与伤害。 */
  magicWeapon?: {
    weaponId: string
    bonus: 1 | 2 | 3
  }
  armorEnchantment?: { armorId: string; inventoryInstanceId?: string; armorClassBonus: number }
  /** Generic Activity enchantment bound to one authoritative held weapon. */
  weaponEnchantment?: {
    sourceWielderOnly?: true
    weaponId: string
    inventoryInstanceId?: string
    attackAndDamageBonus: 0 | 1 | 2 | 3
    spellcastingFocusClassIds?: readonly string[]
    remainingAttacks?: number
    ammunitionContainer?: boolean
    consumeOnDraw?: true
    /** Host-created binding to a quantity of already drawn ammunition. */
    ammunitionStack?: true
    drawSourceEffectId?: string
    weaponIds?: readonly string[]
    bonusDamage?: {
      count: number
      sides: number
      type: Dnd5eDamageType
      magical?: boolean
    }
  }
}

export interface Dnd5eActiveEffectPeriodicHealing {
  timing: 'target-turn-start' | 'target-turn-end'
  amount: number
  /** Prevents retries of the same turn boundary from healing twice. */
  lastResolvedTurnKey?: string
}

export interface Dnd5eActiveEffectBodyRestoration {
  /** Target-turn boundaries still required before missing parts are restored. */
  roundsRemaining: number
  /** Prevents retries of the same turn boundary from advancing twice. */
  lastResolvedTurnKey?: string
}

export interface Dnd5eActiveEffectCalendarRepeatSave {
  /** Campaign minutes between authoritative retry windows. */
  intervalMinutes: number
  ability: AbilityKey
  dc: number
  /** Some diseases end on a successful repeat save; others merely avoid that day's worsening. */
  onSuccess: 'remove' | 'retain'
  /** Durable campaign consequence applied once for each failed retry window. */
  maximumHitPointReductionOnFailure?: {
    average: number
    count: number
    sides: number
    bonus: number
    recovery: 'when-effect-removed'
  }
  /** Initialized from the character's last reconciled campaign minute. */
  nextWorldMinute?: number
  /** Makes replaying an already reconciled clock boundary idempotent. */
  lastResolvedWorldMinute?: number
}

/**
 * 权威状态实例。状态正文仍由规则包定义；这里只保存跨端同步、生命周期与来源所需的事实。
 */
/** Runtime entity/area IDs include room transaction IDs, unlike short semantic tags. */
function validDnd5eActiveEffectTag(tag: unknown): tag is string {
  return typeof tag === 'string' && (/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(tag) ||
    /^(?:persistent-area|condition-entity):[a-z0-9][a-z0-9._:-]{0,1023}$/.test(tag))
}

export interface Dnd5eActiveEffectInstance {
  schemaVersion: typeof DND5E_ACTIVE_EFFECT_SCHEMA_VERSION
  id: string
  definitionId: string
  label: string
  /** Closed semantic labels used by restoration/dispel operations. */
  tags?: readonly string[]
  /** Unified Activities temporarily granted while this authoritative effect exists. */
  grantedActivities?: readonly string[]
  /** Host-bound target scope for these temporary Activity grants. */
  grantedActivityTargetIds?: readonly string[]
  /** Host-captured dependants of this exact application, retained if their body leaves the map. */
  linkedTargetSnapshots?: readonly { actorId: string; effectId: string; name: string; presentation?: import('./linkedTargetPresentation').Dnd5eLinkedTargetPresentation }[]
  grantedActivitiesSingleUse?: true
  grantedActivityCharges?: Dnd5eEffectGrantCharges
  /** Host timer completion; never an immediately available grant. */
  completionGrant?: { activityIds: readonly string[]; availableRounds: number; continueUntilUsed?: true; recipient?: 'source'; bindTarget?: 'bearer' | 'source'; singleUse?: true }
  kind: Dnd5eActiveEffectKind
  standardCondition?: Dnd5eStandardConditionId
  /** 旧插件状态无法映射到标准 ID 时，保留其原始字符串。 */
  legacyCondition?: string
  source: Dnd5eActiveEffectSource
  /** Host-bound peer: either effect ending or either bearer dying ends both. */
  linkedLifetime?: { actorId: string; characterId?: string; effectId: string; protectedRemoval?: true }
  /** Host-captured container identity. Missing source-map data is not proof of expiry. */
  areaLifetime?: { mapId: string; areaId: string; sourceActorId: string; generation?: number }
  /** Original occupied volume captured by the Host; never follows a moving token. */
  initialSpaceBoundary?: Dnd5eInitialSpaceBoundary
  capturedCreatureIdentity?: Dnd5eCapturedCreatureIdentity
  disguisedCreatureIdentity?: Dnd5eCapturedCreatureIdentity
  disguiseRecognizedByActorIds?: string[]
  appliedAt: number
  /** Host-captured campaign deadline for a bounded planar phase. */
  explorationExpiresAtWorldSecond?: number
  appliedRound?: number
  appliedTurnKey?: string
  duration: Dnd5eActiveEffectDuration
  /** A failed save wastes an attempted spell; it does not end this effect. */
  attackAttemptWard?: Dnd5eAttackAttemptWard
  /** Runtime-only results; content packages cannot pre-author successful attempts. */
  attackAttemptWardReceipts?: Dnd5eAttackAttemptWardReceipt[]
  sourceTurnSpellSaveDisadvantage?: Dnd5eSourceTurnSpellSaveDisadvantage
  spellcastingSave?: { ability: AbilityKey; dc: number }
  repeatSave?: Dnd5eActiveEffectRepeatSave
  escapeCheck?: Dnd5eActiveEffectEscapeCheck
  escapeSavingThrow?: Dnd5eActiveEffectEscapeSavingThrow
  onDamageCondition?: Dnd5eActiveEffectOnDamageCondition
  completionReward?: { kind: 'short-rest' }
  completionRequirement?: { condition: Dnd5eStandardConditionId; interrupted: boolean }
  sourceAttitude?: 'friendly'
  endSavingThrow?: Dnd5eEffectEndSavingThrow
  pendingEndSavingThrow?: Dnd5eEffectEndSavingThrow
  onEndAwareness?: 'charmed-by-source'
  afterEffectEnds?: Dnd5eActiveEffectAfterEffectEnds
  periodicDamage?: Dnd5eActiveEffectPeriodicDamage
  periodicHealing?: Dnd5eActiveEffectPeriodicHealing
  undeadCreationProtection?: Dnd5eUndeadCreationProtection
  bodyRestoration?: Dnd5eActiveEffectBodyRestoration
  calendarRepeatSave?: Dnd5eActiveEffectCalendarRepeatSave
  campaignPeriodicHitPointMaximumReduction?: Dnd5eCampaignPeriodicHitPointMaximumReduction
  removal?: Dnd5eActiveEffectRemoval
  relation?: Dnd5eActiveEffectRelation
  breakOn?: Dnd5eActiveEffectBreakTrigger[]
  /** This effect is valid only while the referenced source-specific effect exists. */
  dependsOnEffectId?: string
  /** Converts a concentration-linked effect to permanent only on natural duration completion. */
  persistAfterConcentrationCompletes?: boolean
  /**
   * Suspension keeps the authoritative effect and its duration alive while
   * excluding its conditions and modifiers from the effective projection.
   */
  suspendedBy?: readonly string[]
  stackingKey: string
  stackingPolicy: Dnd5eActiveEffectStackingPolicy
  potency?: number
  /** Dice provenance for a deferred maximum roll; potency retains the legacy base result. */
  maximizedDamageRoll?: { count: number; sides: number; bonus: number }
  visibility?: 'public' | 'dm-only'
  modifiers?: Dnd5eActiveEffectModifiers
  /** 对应旧 timedEffects 的稳定 ID；迁移期间用于双写和去重。 */
  legacyTimedEffectId?: string
}

export interface Dnd5eEscapableGrapple {
  effectId: string
  grapplerId: string
  resolution: 'fixed-dc' | 'contest'
  dc?: number
}

/**
 * Returns only authoritative grapple roots that expose the ordinary
 * action-based escape flow. UI callers use this instead of guessing from the
 * projected `grappled` condition or nearby tokens.
 */
export function dnd5eEscapableGrapples(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eEscapableGrapple[] {
  const grapples: Dnd5eEscapableGrapple[] = []
  const seenEffectIds = new Set<string>()
  for (const effect of effects ?? []) {
    const grapplerId = effect.source.actorId?.trim()
    const relation = effect.relation
    if (
      effect.standardCondition !== 'grappled' ||
      effect.dependsOnEffectId != null ||
      !grapplerId ||
      relation?.kind !== 'grapple' ||
      relation.sourceActorId !== grapplerId ||
      seenEffectIds.has(effect.id)
    ) continue

    if (effect.escapeCheck?.economy === 'action') {
      seenEffectIds.add(effect.id)
      grapples.push({
        effectId: effect.id,
        grapplerId,
        resolution: 'fixed-dc',
        dc: effect.escapeCheck.dc,
      })
      continue
    }

    const basicGrapple = effect.escapeCheck == null &&
      effect.source.kind === 'feature' &&
      effect.source.rulesId === 'basic-action:grapple' &&
      relation.sourceActionId === 'basic-action:grapple' &&
      relation.slotGroup === 'free-hand' &&
      relation.maxDistanceFeet === 5
    if (!basicGrapple) continue
    seenEffectIds.add(effect.id)
    grapples.push({
      effectId: effect.id,
      grapplerId,
      resolution: 'contest',
    })
  }
  return grapples
}

export interface Dnd5eActiveEffectMutation {
  effects: Dnd5eActiveEffectInstance[]
  status: 'applied' | 'refreshed' | 'replaced' | 'rejected-immune' | 'rejected-duplicate' | 'kept-stronger'
  removedIds: string[]
}

export interface Dnd5eActiveEffectProjection {
  activeEffects?: Dnd5eActiveEffectInstance[]
  /** 兼容旧 UI 的只读投影；调用方不得独立编辑。 */
  conditions: string[]
}

function stableSegment(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase()).replaceAll('%', '_')
}

function positiveInteger(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback
}

export function dnd5eActiveEffectId(prefix: string, ...parts: readonly string[]): string {
  return [prefix, ...parts].map(stableSegment).join(':')
}

export function createDnd5eConditionEffect(input: {
  id?: string
  /** Package-qualified effect identity used by Activity prerequisites. */
  definitionId?: string
  condition: Dnd5eStandardConditionId
  tags?: readonly string[]
  grantedActivities?: readonly string[]
  /** Host-bound target scope for these temporary Activity grants. */
  grantedActivityTargetIds?: readonly string[]
  grantedActivitiesSingleUse?: true
  grantedActivityCharges?: Dnd5eEffectGrantCharges
  /** Host timer completion; never an immediately available grant. */
  completionGrant?: { activityIds: readonly string[]; availableRounds: number; continueUntilUsed?: true; recipient?: 'source'; bindTarget?: 'bearer' | 'source'; singleUse?: true }
  source: Dnd5eActiveEffectSource
  targetId: string
  duration?: Dnd5eActiveEffectDuration
  /** A failed save wastes an attempted spell; it does not end this effect. */
  attackAttemptWard?: Dnd5eAttackAttemptWard
  spellcastingSave?: { ability: AbilityKey; dc: number }
  repeatSave?: Dnd5eActiveEffectRepeatSave
  escapeCheck?: Dnd5eActiveEffectEscapeCheck
  escapeSavingThrow?: Dnd5eActiveEffectEscapeSavingThrow
  onDamageCondition?: Dnd5eActiveEffectOnDamageCondition
  completionReward?: { kind: 'short-rest' }
  completionRequirement?: { condition: Dnd5eStandardConditionId; interrupted: boolean }
  sourceAttitude?: 'friendly'
  endSavingThrow?: Dnd5eEffectEndSavingThrow
  pendingEndSavingThrow?: Dnd5eEffectEndSavingThrow
  onEndAwareness?: 'charmed-by-source'
  afterEffectEnds?: Dnd5eActiveEffectAfterEffectEnds
  periodicDamage?: Dnd5eActiveEffectPeriodicDamage
  periodicHealing?: Dnd5eActiveEffectPeriodicHealing
  undeadCreationProtection?: Dnd5eUndeadCreationProtection
  bodyRestoration?: Dnd5eActiveEffectBodyRestoration
  calendarRepeatSave?: Dnd5eActiveEffectCalendarRepeatSave
  campaignPeriodicHitPointMaximumReduction?: Dnd5eCampaignPeriodicHitPointMaximumReduction
  removal?: Dnd5eActiveEffectRemoval
  relation?: Dnd5eActiveEffectRelation
  breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
  dependsOnEffectId?: string
  persistAfterConcentrationCompletes?: boolean
  suspendedBy?: readonly string[]
  stackingPolicy?: Dnd5eActiveEffectStackingPolicy
  stackingKey?: string
  potency?: number
  /** Dice provenance for a deferred maximum roll; potency retains the legacy base result. */
  maximizedDamageRoll?: { count: number; sides: number; bonus: number }
  modifiers?: Dnd5eActiveEffectModifiers
  appliedAt?: number
  appliedRound?: number
  appliedTurnKey?: string
  visibility?: 'public' | 'dm-only'
}): Dnd5eActiveEffectInstance {
  const definitionId = input.definitionId ?? `condition:${input.condition}`
  const sourceKey = input.source.actorId ?? input.source.rulesId ?? input.source.kind
  return {
    schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
    id: input.id ?? dnd5eActiveEffectId(definitionId, sourceKey, input.targetId),
    definitionId,
    label: DND5E_STANDARD_CONDITIONS[input.condition].label,
    tags: input.tags ? [...new Set(input.tags)] : undefined,
    grantedActivitiesSingleUse: input.grantedActivitiesSingleUse,
    grantedActivityCharges: input.grantedActivityCharges ? structuredClone(input.grantedActivityCharges) : undefined,
    grantedActivityTargetIds: input.grantedActivityTargetIds ? [...input.grantedActivityTargetIds] : undefined,
    completionGrant: input.completionGrant ? { ...input.completionGrant, activityIds: [...input.completionGrant.activityIds] } : undefined,
    grantedActivities: input.grantedActivities
      ? [...new Set(input.grantedActivities)]
      : undefined,
    kind: 'condition',
    standardCondition: input.condition,
    source: { ...input.source },
    appliedAt: input.appliedAt ?? Date.now(),
    appliedRound: input.appliedRound,
    appliedTurnKey: input.appliedTurnKey,
    duration: input.duration ?? { type: 'permanent' },
    attackAttemptWard: normalizeDnd5eAttackAttemptWard(input.attackAttemptWard),
    spellcastingSave: input.spellcastingSave ? { ...input.spellcastingSave } : undefined,
    repeatSave: input.repeatSave ? { ...input.repeatSave } : undefined,
    escapeCheck: input.escapeCheck ? { ...input.escapeCheck } : undefined,
    escapeSavingThrow: input.escapeSavingThrow ? { ...input.escapeSavingThrow } : undefined,
    onDamageCondition: input.onDamageCondition ? { ...input.onDamageCondition } : undefined,
    completionReward: input.completionReward ? { ...input.completionReward } : undefined,
    completionRequirement: input.completionRequirement ? { ...input.completionRequirement } : undefined,
    sourceAttitude: input.sourceAttitude,
    endSavingThrow: input.endSavingThrow ? {...input.endSavingThrow} : undefined,
    pendingEndSavingThrow: input.pendingEndSavingThrow ? {...input.pendingEndSavingThrow} : undefined,
    onEndAwareness: input.onEndAwareness,
    afterEffectEnds: input.afterEffectEnds ? { ...input.afterEffectEnds } : undefined,
    periodicDamage: input.periodicDamage
      ? {
          ...input.periodicDamage,
          savingThrow: input.periodicDamage.savingThrow
            ? { ...input.periodicDamage.savingThrow }
            : undefined,
        }
      : undefined,
    periodicHealing: input.periodicHealing ? { ...input.periodicHealing } : undefined,
    undeadCreationProtection: input.undeadCreationProtection ? { ...input.undeadCreationProtection } : undefined,
    bodyRestoration: input.bodyRestoration ? { ...input.bodyRestoration } : undefined,
    campaignPeriodicHitPointMaximumReduction: normalizeDnd5eCampaignPeriodicHitPointMaximumReduction(input.campaignPeriodicHitPointMaximumReduction),
    calendarRepeatSave: input.calendarRepeatSave
      ? {
          ...input.calendarRepeatSave,
          maximumHitPointReductionOnFailure:
            input.calendarRepeatSave.maximumHitPointReductionOnFailure
              ? { ...input.calendarRepeatSave.maximumHitPointReductionOnFailure }
              : undefined,
        }
      : undefined,
    removal: input.removal
      ? {
          ...input.removal,
          sourceLink: input.removal.sourceLink ? { ...input.removal.sourceLink } : undefined,
          action: input.removal.action
            ? {
                ...input.removal.action,
                abilityCheck: input.removal.action.abilityCheck
                  ? { ...input.removal.action.abilityCheck }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
    relation: input.relation ? { ...input.relation } : undefined,
    breakOn: input.breakOn ? [...new Set(input.breakOn)] : undefined,
    dependsOnEffectId: input.dependsOnEffectId,
    persistAfterConcentrationCompletes: input.persistAfterConcentrationCompletes,
    suspendedBy: input.suspendedBy?.length ? [...new Set(input.suspendedBy)] : undefined,
    stackingKey: input.stackingKey ?? definitionId,
    stackingPolicy: input.stackingPolicy ?? 'refresh-duration',
    potency: input.potency,
    ...(input.maximizedDamageRoll ? { maximizedDamageRoll: { ...input.maximizedDamageRoll } } : {}),
    modifiers: input.modifiers
      ? {
          ...input.modifiers,
          skillCheckBonuses: input.modifiers.skillCheckBonuses?.map(rule => ({ ...rule })),
          abilityCheckRules: normalizeDnd5eAbilityCheckRules(input.modifiers.abilityCheckRules),
          abilityCheckAdvantages: input.modifiers.abilityCheckAdvantages
            ? [...new Set(input.modifiers.abilityCheckAdvantages)]
            : undefined,
          abilityCheckDisadvantages: input.modifiers.abilityCheckDisadvantages
            ? [...new Set(input.modifiers.abilityCheckDisadvantages)]
            : undefined,
          minimumAbilityCheckD20ByAbility: input.modifiers.minimumAbilityCheckD20ByAbility
            ? { ...input.modifiers.minimumAbilityCheckD20ByAbility }
            : undefined,
          weaponCategoryRollModes: input.modifiers.weaponCategoryRollModes?.map(rule => ({ ...rule, categories: [...rule.categories] })),
          attackActionMinimum: input.modifiers.attackActionMinimum,
          ownTurnAttackActionBonus: input.modifiers.ownTurnAttackActionBonus,
          equipmentProficiencies: input.modifiers.equipmentProficiencies ? [...new Set(input.modifiers.equipmentProficiencies)] : undefined,
          savingThrowProficiencies: input.modifiers.savingThrowProficiencies ? [...new Set(input.modifiers.savingThrowProficiencies)] : undefined,
          skillExpertise: input.modifiers.skillExpertise ? [...new Set(input.modifiers.skillExpertise)] : undefined,
          skillCheckAdvantages: input.modifiers.skillCheckAdvantages
            ? [...new Set(input.modifiers.skillCheckAdvantages)]
            : undefined,
          skillCheckDisadvantages: input.modifiers.skillCheckDisadvantages
            ? [...new Set(input.modifiers.skillCheckDisadvantages)]
            : undefined,
          locationKnownToSource: input.modifiers.locationKnownToSource,
          perceptionDisadvantageAgainstOthersThanSource:
            input.modifiers.perceptionDisadvantageAgainstOthersThanSource,
          skillCheckBonusAuras: input.modifiers.skillCheckBonusAuras?.map((aura) => ({ ...aura })),
          savingThrowDisadvantages: input.modifiers.savingThrowDisadvantages
            ? [...new Set(input.modifiers.savingThrowDisadvantages)]
            : undefined,
          savingThrowAdvantages: input.modifiers.savingThrowAdvantages
            ? [...new Set(input.modifiers.savingThrowAdvantages)]
            : undefined,
          deathSavingThrowAdvantage: input.modifiers.deathSavingThrowAdvantage,
          maximizeHealingDice: input.modifiers.maximizeHealingDice,
          maximizeHealingDiceNearCompanion: normalizeDnd5eOwnedCompanionProximityRules(input.modifiers.maximizeHealingDiceNearCompanion),
          attackRollDisadvantageAbilities: input.modifiers.attackRollDisadvantageAbilities
            ? [...new Set(input.modifiers.attackRollDisadvantageAbilities)]
            : undefined,
          attackRollAdvantageAbilities: input.modifiers.attackRollAdvantageAbilities
            ? [...new Set(input.modifiers.attackRollAdvantageAbilities)] : undefined,
          savingThrowBonusByAbility: input.modifiers.savingThrowBonusByAbility
            ? { ...input.modifiers.savingThrowBonusByAbility }
            : undefined,
          conditionalDamageResistances: input.modifiers.conditionalDamageResistances
            ?.map((rule) => ({
              ...rule,
              sourceAura: rule.sourceAura ? { ...rule.sourceAura } : undefined,
              damageTypes: [...new Set(rule.damageTypes)],
              deliveries: rule.deliveries ? [...new Set(rule.deliveries)] : undefined,
            })),
          weaponDamageMultipliers: input.modifiers.weaponDamageMultipliers?.map((rule) => ({
            ...rule,
            attackModes: rule.attackModes ? [...new Set(rule.attackModes)] : undefined,
          })),
          rollDiceModifiers: normalizeDnd5eRollDiceModifiers(input.modifiers.rollDiceModifiers),
          optionalBonusDie: input.modifiers.optionalBonusDie
            ? {
                ...input.modifiers.optionalBonusDie,
                appliesTo: [...new Set(input.modifiers.optionalBonusDie.appliesTo)],
              }
            : undefined,
          shillelagh: input.modifiers.shillelagh
            ? { ...input.modifiers.shillelagh }
            : undefined,
          magicWeapon: input.modifiers.magicWeapon
            ? { ...input.modifiers.magicWeapon }
            : undefined,
          armorEnchantment: input.modifiers.armorEnchantment ? { ...input.modifiers.armorEnchantment } : undefined,
          weaponEnchantment: input.modifiers.weaponEnchantment
            ? {
                ...input.modifiers.weaponEnchantment,
                spellcastingFocusClassIds: input.modifiers.weaponEnchantment.spellcastingFocusClassIds ? [...input.modifiers.weaponEnchantment.spellcastingFocusClassIds] : undefined,
                bonusDamage: input.modifiers.weaponEnchantment.bonusDamage
                  ? { ...input.modifiers.weaponEnchantment.bonusDamage }
                  : undefined,
              }
            : undefined,
          attackProfiles: input.modifiers.attackProfiles?.map((profile) => ({
            ...profile,
            attackModes: [...new Set(profile.attackModes)],
            weaponIds: profile.weaponIds ? [...new Set(profile.weaponIds)] : undefined,
          })),
        }
      : undefined,
    visibility: input.visibility ?? 'public',
  }
}

export function createDnd5eMechanicalEffect(input: {
  id?: string
  definitionId: string
  label: string
  tags?: readonly string[]
  grantedActivities?: readonly string[]
  /** Host-bound target scope for these temporary Activity grants. */
  grantedActivityTargetIds?: readonly string[]
  grantedActivitiesSingleUse?: true
  grantedActivityCharges?: Dnd5eEffectGrantCharges
  /** Host timer completion; never an immediately available grant. */
  completionGrant?: { activityIds: readonly string[]; availableRounds: number; continueUntilUsed?: true; recipient?: 'source'; bindTarget?: 'bearer' | 'source'; singleUse?: true }
  kind?: Exclude<Dnd5eActiveEffectKind, 'condition'>
  source: Dnd5eActiveEffectSource
  targetId: string
  duration?: Dnd5eActiveEffectDuration
  /** A failed save wastes an attempted spell; it does not end this effect. */
  attackAttemptWard?: Dnd5eAttackAttemptWard
  spellcastingSave?: { ability: AbilityKey; dc: number }
  repeatSave?: Dnd5eActiveEffectRepeatSave
  escapeCheck?: Dnd5eActiveEffectEscapeCheck
  escapeSavingThrow?: Dnd5eActiveEffectEscapeSavingThrow
  onDamageCondition?: Dnd5eActiveEffectOnDamageCondition
  completionReward?: { kind: 'short-rest' }
  completionRequirement?: { condition: Dnd5eStandardConditionId; interrupted: boolean }
  sourceAttitude?: 'friendly'
  endSavingThrow?: Dnd5eEffectEndSavingThrow
  pendingEndSavingThrow?: Dnd5eEffectEndSavingThrow
  onEndAwareness?: 'charmed-by-source'
  afterEffectEnds?: Dnd5eActiveEffectAfterEffectEnds
  periodicDamage?: Dnd5eActiveEffectPeriodicDamage
  periodicHealing?: Dnd5eActiveEffectPeriodicHealing
  undeadCreationProtection?: Dnd5eUndeadCreationProtection
  bodyRestoration?: Dnd5eActiveEffectBodyRestoration
  calendarRepeatSave?: Dnd5eActiveEffectCalendarRepeatSave
  campaignPeriodicHitPointMaximumReduction?: Dnd5eCampaignPeriodicHitPointMaximumReduction
  removal?: Dnd5eActiveEffectRemoval
  relation?: Dnd5eActiveEffectRelation
  breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
  dependsOnEffectId?: string
  persistAfterConcentrationCompletes?: boolean
  suspendedBy?: readonly string[]
  stackingPolicy?: Dnd5eActiveEffectStackingPolicy
  stackingKey?: string
  potency?: number
  /** Dice provenance for a deferred maximum roll; potency retains the legacy base result. */
  maximizedDamageRoll?: { count: number; sides: number; bonus: number }
  appliedAt?: number
  appliedRound?: number
  appliedTurnKey?: string
  visibility?: 'public' | 'dm-only'
  legacyCondition?: string
  modifiers?: Dnd5eActiveEffectModifiers
}): Dnd5eActiveEffectInstance {
  const sourceKey = input.source.actorId ?? input.source.rulesId ?? input.source.kind
  return {
    schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
    id: input.id ?? dnd5eActiveEffectId(input.definitionId, sourceKey, input.targetId),
    definitionId: input.definitionId,
    label: input.label,
    tags: input.tags ? [...new Set(input.tags)] : undefined,
    grantedActivitiesSingleUse: input.grantedActivitiesSingleUse,
    grantedActivityCharges: input.grantedActivityCharges ? structuredClone(input.grantedActivityCharges) : undefined,
    grantedActivityTargetIds: input.grantedActivityTargetIds ? [...input.grantedActivityTargetIds] : undefined,
    completionGrant: input.completionGrant ? { ...input.completionGrant, activityIds: [...input.completionGrant.activityIds] } : undefined,
    grantedActivities: input.grantedActivities
      ? [...new Set(input.grantedActivities)]
      : undefined,
    kind: input.kind ?? 'debuff',
    source: { ...input.source },
    appliedAt: input.appliedAt ?? Date.now(),
    appliedRound: input.appliedRound,
    appliedTurnKey: input.appliedTurnKey,
    duration: input.duration ?? { type: 'permanent' },
    attackAttemptWard: normalizeDnd5eAttackAttemptWard(input.attackAttemptWard),
    spellcastingSave: input.spellcastingSave ? { ...input.spellcastingSave } : undefined,
    repeatSave: input.repeatSave ? { ...input.repeatSave } : undefined,
    escapeCheck: input.escapeCheck ? { ...input.escapeCheck } : undefined,
    escapeSavingThrow: input.escapeSavingThrow ? { ...input.escapeSavingThrow } : undefined,
    onDamageCondition: input.onDamageCondition ? { ...input.onDamageCondition } : undefined,
    completionReward: input.completionReward ? { ...input.completionReward } : undefined,
    completionRequirement: input.completionRequirement ? { ...input.completionRequirement } : undefined,
    sourceAttitude: input.sourceAttitude,
    endSavingThrow: input.endSavingThrow ? {...input.endSavingThrow} : undefined,
    pendingEndSavingThrow: input.pendingEndSavingThrow ? {...input.pendingEndSavingThrow} : undefined,
    onEndAwareness: input.onEndAwareness,
    afterEffectEnds: input.afterEffectEnds ? { ...input.afterEffectEnds } : undefined,
    periodicDamage: input.periodicDamage
      ? {
          ...input.periodicDamage,
          savingThrow: input.periodicDamage.savingThrow
            ? { ...input.periodicDamage.savingThrow }
            : undefined,
        }
      : undefined,
    periodicHealing: input.periodicHealing ? { ...input.periodicHealing } : undefined,
    undeadCreationProtection: input.undeadCreationProtection ? { ...input.undeadCreationProtection } : undefined,
    bodyRestoration: input.bodyRestoration ? { ...input.bodyRestoration } : undefined,
    campaignPeriodicHitPointMaximumReduction: normalizeDnd5eCampaignPeriodicHitPointMaximumReduction(input.campaignPeriodicHitPointMaximumReduction),
    calendarRepeatSave: input.calendarRepeatSave
      ? {
          ...input.calendarRepeatSave,
          maximumHitPointReductionOnFailure:
            input.calendarRepeatSave.maximumHitPointReductionOnFailure
              ? { ...input.calendarRepeatSave.maximumHitPointReductionOnFailure }
              : undefined,
        }
      : undefined,
    removal: input.removal
      ? {
          ...input.removal,
          sourceLink: input.removal.sourceLink ? { ...input.removal.sourceLink } : undefined,
          action: input.removal.action
            ? {
                ...input.removal.action,
                abilityCheck: input.removal.action.abilityCheck
                  ? { ...input.removal.action.abilityCheck }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
    relation: input.relation ? { ...input.relation } : undefined,
    breakOn: input.breakOn ? [...new Set(input.breakOn)] : undefined,
    dependsOnEffectId: input.dependsOnEffectId,
    persistAfterConcentrationCompletes: input.persistAfterConcentrationCompletes,
    suspendedBy: input.suspendedBy?.length ? [...new Set(input.suspendedBy)] : undefined,
    stackingKey: input.stackingKey ?? input.definitionId,
    stackingPolicy: input.stackingPolicy ?? 'refresh-duration',
    potency: input.potency,
    ...(input.maximizedDamageRoll ? { maximizedDamageRoll: { ...input.maximizedDamageRoll } } : {}),
    visibility: input.visibility ?? 'public',
    legacyCondition: input.legacyCondition,
    modifiers: input.modifiers
      ? {
          ...input.modifiers,
          skillCheckBonuses: input.modifiers.skillCheckBonuses?.map(rule => ({ ...rule })),
          abilityCheckRules: normalizeDnd5eAbilityCheckRules(input.modifiers.abilityCheckRules),
          abilityCheckAdvantages: input.modifiers.abilityCheckAdvantages
            ? [...new Set(input.modifiers.abilityCheckAdvantages)]
            : undefined,
          abilityCheckDisadvantages: input.modifiers.abilityCheckDisadvantages
            ? [...new Set(input.modifiers.abilityCheckDisadvantages)]
            : undefined,
          minimumAbilityCheckD20ByAbility: input.modifiers.minimumAbilityCheckD20ByAbility
            ? { ...input.modifiers.minimumAbilityCheckD20ByAbility }
            : undefined,
          weaponCategoryRollModes: input.modifiers.weaponCategoryRollModes?.map(rule => ({ ...rule, categories: [...rule.categories] })),
          attackActionMinimum: input.modifiers.attackActionMinimum,
          ownTurnAttackActionBonus: input.modifiers.ownTurnAttackActionBonus,
          equipmentProficiencies: input.modifiers.equipmentProficiencies ? [...new Set(input.modifiers.equipmentProficiencies)] : undefined,
          savingThrowProficiencies: input.modifiers.savingThrowProficiencies ? [...new Set(input.modifiers.savingThrowProficiencies)] : undefined,
          skillExpertise: input.modifiers.skillExpertise ? [...new Set(input.modifiers.skillExpertise)] : undefined,
          skillCheckAdvantages: input.modifiers.skillCheckAdvantages
            ? [...new Set(input.modifiers.skillCheckAdvantages)]
            : undefined,
          skillCheckDisadvantages: input.modifiers.skillCheckDisadvantages
            ? [...new Set(input.modifiers.skillCheckDisadvantages)]
            : undefined,
          locationKnownToSource: input.modifiers.locationKnownToSource,
          perceptionDisadvantageAgainstOthersThanSource:
            input.modifiers.perceptionDisadvantageAgainstOthersThanSource,
          skillCheckBonusAuras: input.modifiers.skillCheckBonusAuras?.map((aura) => ({ ...aura })),
          savingThrowDisadvantages: input.modifiers.savingThrowDisadvantages
            ? [...new Set(input.modifiers.savingThrowDisadvantages)]
            : undefined,
          savingThrowAdvantages: input.modifiers.savingThrowAdvantages
            ? [...new Set(input.modifiers.savingThrowAdvantages)]
            : undefined,
          deathSavingThrowAdvantage: input.modifiers.deathSavingThrowAdvantage,
          maximizeHealingDice: input.modifiers.maximizeHealingDice,
          maximizeHealingDiceNearCompanion: normalizeDnd5eOwnedCompanionProximityRules(input.modifiers.maximizeHealingDiceNearCompanion),
          attackRollDisadvantageAbilities: input.modifiers.attackRollDisadvantageAbilities
            ? [...new Set(input.modifiers.attackRollDisadvantageAbilities)]
            : undefined,
          attackRollAdvantageAbilities: input.modifiers.attackRollAdvantageAbilities
            ? [...new Set(input.modifiers.attackRollAdvantageAbilities)] : undefined,
          savingThrowBonusByAbility: input.modifiers.savingThrowBonusByAbility
            ? { ...input.modifiers.savingThrowBonusByAbility }
            : undefined,
          conditionalDamageResistances: input.modifiers.conditionalDamageResistances
            ?.map((rule) => ({
              ...rule,
              sourceAura: rule.sourceAura ? { ...rule.sourceAura } : undefined,
              damageTypes: [...new Set(rule.damageTypes)],
              deliveries: rule.deliveries ? [...new Set(rule.deliveries)] : undefined,
            })),
          weaponDamageMultipliers: input.modifiers.weaponDamageMultipliers?.map((rule) => ({
            ...rule,
            attackModes: rule.attackModes ? [...new Set(rule.attackModes)] : undefined,
          })),
          rollDiceModifiers: normalizeDnd5eRollDiceModifiers(input.modifiers.rollDiceModifiers),
          optionalBonusDie: input.modifiers.optionalBonusDie
            ? {
                ...input.modifiers.optionalBonusDie,
                appliesTo: [...new Set(input.modifiers.optionalBonusDie.appliesTo)],
              }
            : undefined,
          shillelagh: input.modifiers.shillelagh
            ? { ...input.modifiers.shillelagh }
            : undefined,
          magicWeapon: input.modifiers.magicWeapon
            ? { ...input.modifiers.magicWeapon }
            : undefined,
          armorEnchantment: input.modifiers.armorEnchantment ? { ...input.modifiers.armorEnchantment } : undefined,
          weaponEnchantment: input.modifiers.weaponEnchantment
            ? {
                ...input.modifiers.weaponEnchantment,
                spellcastingFocusClassIds: input.modifiers.weaponEnchantment.spellcastingFocusClassIds ? [...input.modifiers.weaponEnchantment.spellcastingFocusClassIds] : undefined,
                bonusDamage: input.modifiers.weaponEnchantment.bonusDamage
                  ? { ...input.modifiers.weaponEnchantment.bonusDamage }
                  : undefined,
              }
            : undefined,
          attackProfiles: input.modifiers.attackProfiles?.map((profile) => ({
            ...profile,
            attackModes: [...new Set(profile.attackModes)],
            weaponIds: profile.weaponIds ? [...new Set(profile.weaponIds)] : undefined,
          })),
        }
      : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ACTIVE_EFFECT_KINDS = new Set<Dnd5eActiveEffectKind>(['condition', 'mark', 'buff', 'debuff', 'custom'])
const SOURCE_KINDS = new Set<Dnd5eActiveEffectSourceKind>(['dm', 'spell', 'feature', 'item', 'monster', 'plugin', 'system', 'legacy'])
const STACKING_POLICIES = new Set<Dnd5eActiveEffectStackingPolicy>(['reject', 'refresh-duration', 'replace', 'keep-strongest', 'stack'])
const OPTIONAL_BONUS_DIE_SIDES = new Set([4, 6, 8, 10, 12])
const OPTIONAL_BONUS_DIE_ROLL_KINDS = new Set<Dnd5eOptionalBonusDieRollKind>([
  'ability-check',
  'saving-throw',
])
const BREAK_TRIGGERS = new Set<Dnd5eActiveEffectBreakTrigger>(ACTIVE_EFFECT_BREAK_TRIGGERS)
const TURN_BOUNDARIES = new Set<Dnd5eActiveEffectTurnBoundary>(['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end'])
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const ESCAPE_SKILLS = new Set<NonNullable<Dnd5eActiveEffectEscapeCheck['skill']>>(['athletics', 'acrobatics'])
const MAX_ACTIVE_EFFECT_POTENCY = 1_000_000

function dnd5eEscapeSkillMatchesAbility(
  skill: Dnd5eActiveEffectEscapeCheck['skill'],
  ability: AbilityKey,
): boolean {
  return skill == null ||
    (skill === 'athletics' && ability === 'str') ||
    (skill === 'acrobatics' && ability === 'dex')
}

/** Rejects malformed remote/plugin values instead of trusting a TypeScript cast. */
export function normalizeDnd5eActiveEffects(value: unknown): Dnd5eActiveEffectInstance[] {
  if (!Array.isArray(value)) return []
  const effects: Dnd5eActiveEffectInstance[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate) || candidate.schemaVersion !== DND5E_ACTIVE_EFFECT_SCHEMA_VERSION) continue
    if (typeof candidate.id !== 'string' || !candidate.id.trim() || seen.has(candidate.id)) continue
    if (typeof candidate.definitionId !== 'string' || typeof candidate.label !== 'string') continue
    if (!ACTIVE_EFFECT_KINDS.has(candidate.kind as Dnd5eActiveEffectKind)) continue
    if (!isRecord(candidate.source) || !SOURCE_KINDS.has(candidate.source.kind as Dnd5eActiveEffectSourceKind)) continue
    if (!isRecord(candidate.duration) || typeof candidate.duration.type !== 'string') continue
    if (typeof candidate.stackingKey !== 'string' || !STACKING_POLICIES.has(candidate.stackingPolicy as Dnd5eActiveEffectStackingPolicy)) continue
    const standardCondition = typeof candidate.standardCondition === 'string'
      ? dnd5eStandardConditionId(candidate.standardCondition)
      : undefined
    const rawDuration = candidate.duration
    let normalizedDuration: Dnd5eActiveEffectDuration
    if (rawDuration.type === 'permanent') {
      normalizedDuration = { type: 'permanent' }
    } else if (
      rawDuration.type === 'rounds' &&
      TURN_BOUNDARIES.has(rawDuration.tickOn as Dnd5eActiveEffectTurnBoundary)
    ) {
      normalizedDuration = {
        type: 'rounds',
        remainingRounds: positiveInteger(rawDuration.remainingRounds),
        tickOn: rawDuration.tickOn as Dnd5eActiveEffectTurnBoundary,
        lastTickTurnKey: typeof rawDuration.lastTickTurnKey === 'string' && rawDuration.lastTickTurnKey.trim().length > 0
          ? rawDuration.lastTickTurnKey.trim()
          : undefined,
      }
    } else if (rawDuration.type === 'until-turn-boundary' && TURN_BOUNDARIES.has(rawDuration.boundary as Dnd5eActiveEffectTurnBoundary)) {
      normalizedDuration = {
        type: 'until-turn-boundary',
        boundary: rawDuration.boundary as Dnd5eActiveEffectTurnBoundary,
        appliedTurnKey: typeof rawDuration.appliedTurnKey === 'string' ? rawDuration.appliedTurnKey : undefined,
        includeCreationTurn: rawDuration.includeCreationTurn === true &&
          ['source-turn-end', 'target-turn-end'].includes(String(rawDuration.boundary)) ? true : undefined,
      }
    } else if (rawDuration.type === 'concentration' && typeof rawDuration.sourceActorId === 'string') {
      normalizedDuration = {
        type: 'concentration',
        sourceActorId: rawDuration.sourceActorId,
        concentrationId: typeof rawDuration.concentrationId === 'string' ? rawDuration.concentrationId : undefined,
        remainingRounds: rawDuration.remainingRounds == null ? undefined : positiveInteger(rawDuration.remainingRounds),
      }
    } else continue
    const rawSpellcastingSave = candidate.spellcastingSave
    const spellcastingSave = isRecord(rawSpellcastingSave) &&
      ABILITIES.has(rawSpellcastingSave.ability as AbilityKey) &&
      typeof rawSpellcastingSave.dc === 'number' && Number.isSafeInteger(rawSpellcastingSave.dc) && rawSpellcastingSave.dc > 0
      ? { ability: rawSpellcastingSave.ability as AbilityKey, dc: rawSpellcastingSave.dc } : undefined
    const rawRepeatSave = candidate.repeatSave
    const rawFailureDamage = isRecord(rawRepeatSave) ? rawRepeatSave.damageOnFailure : undefined
    const rawFailureTransition = isRecord(rawRepeatSave) ? rawRepeatSave.onFailureTransition : undefined
    const damageOnFailure = rawFailureDamage == null
      ? undefined
      : isRecord(rawFailureDamage) &&
        Number.isInteger(rawFailureDamage.count) && Number(rawFailureDamage.count) >= 1 && Number(rawFailureDamage.count) <= 40 &&
        Number.isInteger(rawFailureDamage.sides) && Number(rawFailureDamage.sides) >= 2 && Number(rawFailureDamage.sides) <= 100 &&
        Number.isInteger(rawFailureDamage.modifier ?? 0) &&
        Number(rawFailureDamage.modifier ?? 0) >= -1_000 && Number(rawFailureDamage.modifier ?? 0) <= 1_000 &&
        (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawFailureDamage.type) &&
        (rawFailureDamage.destroysBodyOnDeath == null || typeof rawFailureDamage.destroysBodyOnDeath === 'boolean')
        ? {
            count: Number(rawFailureDamage.count),
            sides: Number(rawFailureDamage.sides),
            modifier: Number(rawFailureDamage.modifier ?? 0),
            type: rawFailureDamage.type as Dnd5eDamageType,
            ...(rawFailureDamage.destroysBodyOnDeath === true ? { destroysBodyOnDeath: true } : {}),
          }
        : null
    const onFailureTransition = rawFailureTransition == null
      ? undefined
      : isRecord(rawFailureTransition) &&
        rawFailureTransition.outcome === 'retain-effect' &&
        Object.keys(rawFailureTransition).every((key) => key === 'outcome')
        ? { outcome: 'retain-effect' as const }
      : isRecord(rawFailureTransition) &&
        Object.keys(rawFailureTransition).every((key) =>
          key === 'outcome' || key === 'replaceWithCondition' || key === 'duration') &&
        (rawFailureTransition.outcome == null || rawFailureTransition.outcome === 'replace-condition') &&
        (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(
          rawFailureTransition.replaceWithCondition,
        ) &&
        (
          rawFailureTransition.duration === 'permanent' ||
          rawFailureTransition.duration === 'source-concentration-then-permanent'
        )
        ? {
            outcome: rawFailureTransition.outcome === 'replace-condition'
              ? 'replace-condition' as const
              : undefined,
            replaceWithCondition:
              rawFailureTransition.replaceWithCondition as Dnd5eStandardConditionId,
            duration: rawFailureTransition.duration as
              'permanent' | 'source-concentration-then-permanent',
          }
        : null
    // Older authoritative monster effects already used a one-failure
    // transition. Preserve that wire format while allowing new Activities to
    // declare a larger cumulative threshold explicitly.
    const effectiveFailuresRequired = isRecord(rawRepeatSave) &&
      rawRepeatSave.failuresRequired == null && onFailureTransition
      ? 1
      : isRecord(rawRepeatSave) && rawRepeatSave.failuresRequired != null
        ? Number(rawRepeatSave.failuresRequired)
        : undefined
    const repeatSave = isRecord(rawRepeatSave) &&
      ABILITIES.has(rawRepeatSave.ability as AbilityKey) &&
      typeof rawRepeatSave.dc === 'number' && Number.isInteger(rawRepeatSave.dc) && rawRepeatSave.dc > 0 &&
      (rawRepeatSave.timing === 'target-turn-start' || rawRepeatSave.timing === 'target-turn-end' ||
        rawRepeatSave.timing === 'on-damage' || rawRepeatSave.timing === 'after-movement') &&
      (rawRepeatSave.timing !== 'on-damage' || rawRepeatSave.onDamage != null) &&
      (rawRepeatSave.requiresSourceNotVisible == null ||
        typeof rawRepeatSave.requiresSourceNotVisible === 'boolean') &&
      damageOnFailure !== null &&
      onFailureTransition !== null &&
      Number.isInteger(rawRepeatSave.successesRequired ?? 1) &&
      Number(rawRepeatSave.successesRequired ?? 1) >= 1 &&
      Number(rawRepeatSave.successesRequired ?? 1) <= 10 &&
      Number.isInteger(rawRepeatSave.successes ?? 0) &&
      Number(rawRepeatSave.successes ?? 0) >= 0 &&
      Number(rawRepeatSave.successes ?? 0) < Number(rawRepeatSave.successesRequired ?? 1) &&
      (
        effectiveFailuresRequired == null ||
        (
          Number.isInteger(effectiveFailuresRequired) &&
          effectiveFailuresRequired >= 1 &&
          effectiveFailuresRequired <= 10
        )
      ) &&
      Number.isInteger(rawRepeatSave.failures ?? 0) &&
      Number(rawRepeatSave.failures ?? 0) >= 0 &&
      (
        effectiveFailuresRequired == null
          ? Number(rawRepeatSave.failures ?? 0) === 0
          : Number(rawRepeatSave.failures ?? 0) < effectiveFailuresRequired
      ) &&
      ((effectiveFailuresRequired == null) === (onFailureTransition == null)) &&
      (rawRepeatSave.onDamage == null || (
        isRecord(rawRepeatSave.onDamage) &&
        Object.keys(rawRepeatSave.onDamage).every((key) =>
          ['mode', 'sourceFilter', 'advantageIfSourceOrAllies'].includes(key)) &&
        (rawRepeatSave.onDamage.mode === 'normal' || rawRepeatSave.onDamage.mode === 'advantage') &&
        (
          rawRepeatSave.onDamage.sourceFilter == null ||
          rawRepeatSave.onDamage.sourceFilter === 'any' ||
          rawRepeatSave.onDamage.sourceFilter === 'source-or-allies'
        ) &&
        (rawRepeatSave.onDamage.advantageIfSourceOrAllies == null ||
          rawRepeatSave.onDamage.advantageIfSourceOrAllies === true)
      ))
      ? {
          ability: rawRepeatSave.ability as AbilityKey,
          dc: rawRepeatSave.dc,
          timing: rawRepeatSave.timing as 'target-turn-start' | 'target-turn-end' | 'on-damage' | 'after-movement',
          ...(rawRepeatSave.requiresSourceNotVisible === true
            ? { requiresSourceNotVisible: true as const }
            : {}),
          ...(isRecord(rawRepeatSave.onDamage) &&
            (rawRepeatSave.onDamage.mode === 'normal' || rawRepeatSave.onDamage.mode === 'advantage')
            ? { onDamage: {
                mode: rawRepeatSave.onDamage.mode as 'normal' | 'advantage',
                ...(rawRepeatSave.onDamage.sourceFilter === 'any' ||
                    rawRepeatSave.onDamage.sourceFilter === 'source-or-allies'
                  ? { sourceFilter: rawRepeatSave.onDamage.sourceFilter as 'any' | 'source-or-allies' }
                  : {}),
                ...(rawRepeatSave.onDamage.advantageIfSourceOrAllies === true
                  ? { advantageIfSourceOrAllies: true as const }
                  : {}),
              } }
            : {}),
          ...(damageOnFailure ? { damageOnFailure } : {}),
          ...(onFailureTransition ? { onFailureTransition } : {}),
          ...(rawRepeatSave.successesRequired != null
            ? { successesRequired: Number(rawRepeatSave.successesRequired) }
            : {}),
          ...(effectiveFailuresRequired != null
            ? { failuresRequired: effectiveFailuresRequired }
            : {}),
          ...(rawRepeatSave.successes != null ? { successes: Number(rawRepeatSave.successes) } : {}),
          ...(rawRepeatSave.failures != null ? { failures: Number(rawRepeatSave.failures) } : {}),
          onSuccess: 'remove' as const,
          disadvantage:rawRepeatSave.disadvantage===true ? true : undefined,
        }
      : undefined
    const rawEscapeCheck = candidate.escapeCheck
    const escapeCheck = isRecord(rawEscapeCheck) &&
      Object.keys(rawEscapeCheck).every((key) =>
        ['ability', 'skill', 'alternativeAbility', 'alternativeSkill', 'dc', 'economy', 'automaticSuccessStatBlockIds'].includes(key)) &&
      ABILITIES.has(rawEscapeCheck.ability as AbilityKey) &&
      (rawEscapeCheck.skill == null ||
        ESCAPE_SKILLS.has(rawEscapeCheck.skill as NonNullable<Dnd5eActiveEffectEscapeCheck['skill']>)) &&
      dnd5eEscapeSkillMatchesAbility(
        rawEscapeCheck.skill as Dnd5eActiveEffectEscapeCheck['skill'],
        rawEscapeCheck.ability as AbilityKey,
      ) &&
      (rawEscapeCheck.alternativeAbility == null || ABILITIES.has(rawEscapeCheck.alternativeAbility as AbilityKey)) &&
      (rawEscapeCheck.alternativeSkill == null || (
        rawEscapeCheck.alternativeAbility != null &&
        ESCAPE_SKILLS.has(rawEscapeCheck.alternativeSkill as NonNullable<Dnd5eActiveEffectEscapeCheck['skill']>) &&
        dnd5eEscapeSkillMatchesAbility(
          rawEscapeCheck.alternativeSkill as Dnd5eActiveEffectEscapeCheck['skill'],
          rawEscapeCheck.alternativeAbility as AbilityKey,
        )
      )) &&
      typeof rawEscapeCheck.dc === 'number' && Number.isInteger(rawEscapeCheck.dc) &&
      rawEscapeCheck.dc > 0 && rawEscapeCheck.dc <= 100 &&
      rawEscapeCheck.economy === 'action'
      && (rawEscapeCheck.automaticSuccessStatBlockIds == null || (
        Array.isArray(rawEscapeCheck.automaticSuccessStatBlockIds) &&
        rawEscapeCheck.automaticSuccessStatBlockIds.length <= 32 &&
        rawEscapeCheck.automaticSuccessStatBlockIds.every((id) =>
          typeof id === 'string' && id.length > 0 && id.length <= 160)
      ))
      ? {
          ability: rawEscapeCheck.ability as AbilityKey,
          ...(rawEscapeCheck.skill != null
            ? { skill: rawEscapeCheck.skill as Dnd5eActiveEffectEscapeCheck['skill'] }
            : {}),
          ...(rawEscapeCheck.alternativeAbility != null
            ? { alternativeAbility: rawEscapeCheck.alternativeAbility as AbilityKey }
            : {}),
          ...(rawEscapeCheck.alternativeSkill != null
            ? { alternativeSkill: rawEscapeCheck.alternativeSkill as Dnd5eActiveEffectEscapeCheck['skill'] }
            : {}),
          dc: rawEscapeCheck.dc,
          economy: 'action' as const,
          ...(Array.isArray(rawEscapeCheck.automaticSuccessStatBlockIds)
            ? { automaticSuccessStatBlockIds: [...new Set(rawEscapeCheck.automaticSuccessStatBlockIds as string[])] }
            : {}),
        }
      : undefined
    const rawPeriodicDamage = candidate.periodicDamage
    const periodicDamage = isRecord(rawPeriodicDamage) &&
      Object.keys(rawPeriodicDamage).every((key) => [
        'timing',
        'count',
        'sides',
        'modifier',
        'type',
        'savingThrow',
        'cumulativeDamage',
        'removeEffectAfterCumulativeDamage',
        'lastResolvedTurnKey',
      ].includes(key)) &&
      (
        rawPeriodicDamage.timing === 'target-turn-start' ||
        rawPeriodicDamage.timing === 'target-turn-end' ||
        rawPeriodicDamage.timing === 'source-turn-start'
      ) &&
      Number.isInteger(rawPeriodicDamage.count) &&
      Number(rawPeriodicDamage.count) >= 1 &&
      Number(rawPeriodicDamage.count) <= 100 &&
      Number.isInteger(rawPeriodicDamage.sides) &&
      Number(rawPeriodicDamage.sides) >= 2 &&
      Number(rawPeriodicDamage.sides) <= 100 &&
      Number.isInteger(rawPeriodicDamage.modifier ?? 0) &&
      Number(rawPeriodicDamage.modifier ?? 0) >= -1_000 &&
      Number(rawPeriodicDamage.modifier ?? 0) <= 1_000 &&
      Number.isInteger(rawPeriodicDamage.cumulativeDamage ?? 0) &&
      Number(rawPeriodicDamage.cumulativeDamage ?? 0) >= 0 &&
      Number(rawPeriodicDamage.cumulativeDamage ?? 0) <= 1_000_000 &&
      (
        rawPeriodicDamage.removeEffectAfterCumulativeDamage == null ||
        (
          Number.isInteger(rawPeriodicDamage.removeEffectAfterCumulativeDamage) &&
          Number(rawPeriodicDamage.removeEffectAfterCumulativeDamage) >= 1 &&
          Number(rawPeriodicDamage.removeEffectAfterCumulativeDamage) <= 1_000_000
        )
      ) &&
      (
        rawPeriodicDamage.type == null ||
        (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawPeriodicDamage.type)
      ) &&
      (
        rawPeriodicDamage.savingThrow == null ||
        (
          isRecord(rawPeriodicDamage.savingThrow) &&
          Object.keys(rawPeriodicDamage.savingThrow).every((key) => [
            'ability',
            'dc',
            'magical',
            'damageOnSuccessfulSave',
          ].includes(key)) &&
          ABILITIES.has(rawPeriodicDamage.savingThrow.ability as AbilityKey) &&
          Number.isInteger(rawPeriodicDamage.savingThrow.dc) &&
          Number(rawPeriodicDamage.savingThrow.dc) >= 1 &&
          Number(rawPeriodicDamage.savingThrow.dc) <= 100 &&
          (
            rawPeriodicDamage.savingThrow.magical == null ||
            typeof rawPeriodicDamage.savingThrow.magical === 'boolean'
          ) &&
          (
            rawPeriodicDamage.savingThrow.damageOnSuccessfulSave === 'none' ||
            rawPeriodicDamage.savingThrow.damageOnSuccessfulSave === 'half'
          )
        )
      ) &&
      (
        rawPeriodicDamage.lastResolvedTurnKey == null ||
        (
          typeof rawPeriodicDamage.lastResolvedTurnKey === 'string' &&
          rawPeriodicDamage.lastResolvedTurnKey.trim().length > 0 &&
          rawPeriodicDamage.lastResolvedTurnKey.length <= 512
        )
      )
      ? {
          timing: rawPeriodicDamage.timing as
            Dnd5eActiveEffectPeriodicDamage['timing'],
          count: Number(rawPeriodicDamage.count),
          sides: Number(rawPeriodicDamage.sides),
          modifier: Number(rawPeriodicDamage.modifier ?? 0),
          type: rawPeriodicDamage.type as Dnd5eDamageType | undefined,
          cumulativeDamage: Number(rawPeriodicDamage.cumulativeDamage ?? 0) || undefined,
          removeEffectAfterCumulativeDamage:
            rawPeriodicDamage.removeEffectAfterCumulativeDamage == null
              ? undefined
              : Number(rawPeriodicDamage.removeEffectAfterCumulativeDamage),
          savingThrow: isRecord(rawPeriodicDamage.savingThrow)
            ? {
                ability: rawPeriodicDamage.savingThrow.ability as AbilityKey,
                dc: Number(rawPeriodicDamage.savingThrow.dc),
                magical: typeof rawPeriodicDamage.savingThrow.magical === 'boolean'
                  ? rawPeriodicDamage.savingThrow.magical
                  : undefined,
                damageOnSuccessfulSave:
                  rawPeriodicDamage.savingThrow.damageOnSuccessfulSave as 'none' | 'half',
              }
            : undefined,
          lastResolvedTurnKey:
            typeof rawPeriodicDamage.lastResolvedTurnKey === 'string'
              ? rawPeriodicDamage.lastResolvedTurnKey.trim()
              : undefined,
        }
      : undefined
    const rawEscapeSavingThrow = candidate.escapeSavingThrow
    const escapeSavingThrow = isRecord(rawEscapeSavingThrow) &&
      Object.keys(rawEscapeSavingThrow).every((key) =>
        ['ability', 'dc', 'economy'].includes(key)) &&
      ABILITIES.has(rawEscapeSavingThrow.ability as AbilityKey) &&
      Number.isInteger(rawEscapeSavingThrow.dc) &&
      Number(rawEscapeSavingThrow.dc) >= 1 &&
      Number(rawEscapeSavingThrow.dc) <= 100 &&
      rawEscapeSavingThrow.economy === 'action'
      ? {
          ability: rawEscapeSavingThrow.ability as AbilityKey,
          dc: Number(rawEscapeSavingThrow.dc),
          economy: 'action' as const,
        }
      : undefined
    const rawOnDamageCondition = candidate.onDamageCondition
    const onDamageCondition = isRecord(rawOnDamageCondition) &&
      Object.keys(rawOnDamageCondition).every((key) => key === 'condition' || key === 'duration') &&
      (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(rawOnDamageCondition.condition) &&
      rawOnDamageCondition.duration === 'until-target-next-turn-end'
      ? {
          condition: rawOnDamageCondition.condition as Dnd5eStandardConditionId,
          duration: 'until-target-next-turn-end' as const,
        }
      : undefined
    const rawAfterEffectEnds = candidate.afterEffectEnds
    const afterEffectEnds = isRecord(rawAfterEffectEnds) &&
      Object.keys(rawAfterEffectEnds).every((key) =>
        key === 'duration' || key === 'rounds' || key === 'trigger' || key === 'requiresAirborne' ||
        key === 'preventActions' || key === 'preventMovement' || key === 'controlledDescent') &&
      (rawAfterEffectEnds.duration === 'until-target-next-turn-end' || rawAfterEffectEnds.duration === 'rounds') &&
      (rawAfterEffectEnds.duration !== 'rounds' || (
        Number.isInteger(rawAfterEffectEnds.rounds) && Number(rawAfterEffectEnds.rounds) >= 1 &&
        Number(rawAfterEffectEnds.rounds) <= 14_400
      )) &&
      (rawAfterEffectEnds.duration === 'rounds' || rawAfterEffectEnds.rounds == null) &&
      (rawAfterEffectEnds.trigger == null || rawAfterEffectEnds.trigger === 'any-removal' ||
        rawAfterEffectEnds.trigger === 'manual-removal' || rawAfterEffectEnds.trigger === 'non-manual-removal') &&
      (rawAfterEffectEnds.requiresAirborne == null || typeof rawAfterEffectEnds.requiresAirborne === 'boolean') &&
      typeof rawAfterEffectEnds.preventActions === 'boolean' &&
      typeof rawAfterEffectEnds.preventMovement === 'boolean' &&
      (rawAfterEffectEnds.controlledDescent == null || (
        isRecord(rawAfterEffectEnds.controlledDescent) &&
        Object.keys(rawAfterEffectEnds.controlledDescent).every((key) =>
          key === 'maximumFeetPerRound' || key === 'safeLanding' || key === 'endsOnLanding') &&
        Number.isInteger(rawAfterEffectEnds.controlledDescent.maximumFeetPerRound) &&
        Number(rawAfterEffectEnds.controlledDescent.maximumFeetPerRound) >= 1 &&
        Number(rawAfterEffectEnds.controlledDescent.maximumFeetPerRound) <= 10_000 &&
        rawAfterEffectEnds.controlledDescent.safeLanding === true &&
        rawAfterEffectEnds.controlledDescent.endsOnLanding === true
      )) &&
      (rawAfterEffectEnds.preventActions === true || rawAfterEffectEnds.preventMovement === true ||
        rawAfterEffectEnds.controlledDescent != null)
      ? {
          duration: rawAfterEffectEnds.duration as Dnd5eActiveEffectAfterEffectEnds['duration'],
          rounds: rawAfterEffectEnds.duration === 'rounds' ? Number(rawAfterEffectEnds.rounds) : undefined,
          trigger: rawAfterEffectEnds.trigger as Dnd5eActiveEffectAfterEffectEnds['trigger'],
          requiresAirborne: rawAfterEffectEnds.requiresAirborne === true ? true : undefined,
          preventActions: rawAfterEffectEnds.preventActions as boolean,
          preventMovement: rawAfterEffectEnds.preventMovement as boolean,
          controlledDescent: isRecord(rawAfterEffectEnds.controlledDescent)
            ? {
                maximumFeetPerRound: Number(rawAfterEffectEnds.controlledDescent.maximumFeetPerRound),
                safeLanding: true as const,
                endsOnLanding: true as const,
              }
            : undefined,
        }
      : undefined
    const rawPeriodicHealing = candidate.periodicHealing
    const periodicHealing = isRecord(rawPeriodicHealing) &&
      Object.keys(rawPeriodicHealing).every((key) =>
        ['timing', 'amount', 'lastResolvedTurnKey'].includes(key)) &&
      (rawPeriodicHealing.timing === 'target-turn-start' ||
        rawPeriodicHealing.timing === 'target-turn-end') &&
      Number.isInteger(rawPeriodicHealing.amount) &&
      Number(rawPeriodicHealing.amount) >= 0 &&
      Number(rawPeriodicHealing.amount) <= 1_000_000 &&
      (rawPeriodicHealing.lastResolvedTurnKey == null || (
        typeof rawPeriodicHealing.lastResolvedTurnKey === 'string' &&
        rawPeriodicHealing.lastResolvedTurnKey.trim().length > 0 &&
        rawPeriodicHealing.lastResolvedTurnKey.length <= 512
      ))
      ? {
          timing: rawPeriodicHealing.timing as Dnd5eActiveEffectPeriodicHealing['timing'],
          amount: Number(rawPeriodicHealing.amount),
          lastResolvedTurnKey: typeof rawPeriodicHealing.lastResolvedTurnKey === 'string'
            ? rawPeriodicHealing.lastResolvedTurnKey.trim()
            : undefined,
        }
      : undefined
    const undeadCreationProtection = normalizeDnd5eUndeadCreationProtection(candidate.undeadCreationProtection)
    if (candidate.undeadCreationProtection != null && !undeadCreationProtection) continue
    const rawBodyRestoration = candidate.bodyRestoration
    const bodyRestoration = isRecord(rawBodyRestoration) &&
      Object.keys(rawBodyRestoration).every((key) =>
        ['roundsRemaining', 'lastResolvedTurnKey'].includes(key)) &&
      Number.isInteger(rawBodyRestoration.roundsRemaining) &&
      Number(rawBodyRestoration.roundsRemaining) >= 0 &&
      Number(rawBodyRestoration.roundsRemaining) <= 5_256_000 &&
      (rawBodyRestoration.lastResolvedTurnKey == null || (
        typeof rawBodyRestoration.lastResolvedTurnKey === 'string' &&
        rawBodyRestoration.lastResolvedTurnKey.trim().length > 0 &&
        rawBodyRestoration.lastResolvedTurnKey.length <= 512
      ))
      ? {
          roundsRemaining: Number(rawBodyRestoration.roundsRemaining),
          lastResolvedTurnKey: typeof rawBodyRestoration.lastResolvedTurnKey === 'string'
            ? rawBodyRestoration.lastResolvedTurnKey.trim()
            : undefined,
        }
      : undefined
    const rawCampaignPeriodicReduction = candidate.campaignPeriodicHitPointMaximumReduction
    const campaignPeriodicHitPointMaximumReduction = normalizeDnd5eCampaignPeriodicHitPointMaximumReduction(rawCampaignPeriodicReduction)
    if (rawCampaignPeriodicReduction != null && campaignPeriodicHitPointMaximumReduction == null) continue
    const rawCalendarRepeatSave = candidate.calendarRepeatSave
    const rawCalendarMaximumReduction = isRecord(rawCalendarRepeatSave)
      ? rawCalendarRepeatSave.maximumHitPointReductionOnFailure
      : undefined
    const calendarMaximumReduction = rawCalendarMaximumReduction == null
      ? undefined
      : isRecord(rawCalendarMaximumReduction) &&
        Object.keys(rawCalendarMaximumReduction).every((key) => [
          'average',
          'count',
          'sides',
          'bonus',
          'recovery',
        ].includes(key)) &&
        Number.isInteger(rawCalendarMaximumReduction.average) &&
        Number(rawCalendarMaximumReduction.average) >= 0 &&
        Number(rawCalendarMaximumReduction.average) <= 1_000_000 &&
        Number.isInteger(rawCalendarMaximumReduction.count) &&
        Number(rawCalendarMaximumReduction.count) >= 1 &&
        Number(rawCalendarMaximumReduction.count) <= 1_000 &&
        Number.isInteger(rawCalendarMaximumReduction.sides) &&
        Number(rawCalendarMaximumReduction.sides) >= 2 &&
        Number(rawCalendarMaximumReduction.sides) <= 1_000_000 &&
        Number.isInteger(rawCalendarMaximumReduction.bonus) &&
        Number(rawCalendarMaximumReduction.bonus) >= -1_000_000 &&
        Number(rawCalendarMaximumReduction.bonus) <= 1_000_000 &&
        rawCalendarMaximumReduction.recovery === 'when-effect-removed'
        ? {
            average: Number(rawCalendarMaximumReduction.average),
            count: Number(rawCalendarMaximumReduction.count),
            sides: Number(rawCalendarMaximumReduction.sides),
            bonus: Number(rawCalendarMaximumReduction.bonus),
            recovery: 'when-effect-removed' as const,
          }
        : undefined
    const calendarRepeatSave = isRecord(rawCalendarRepeatSave) &&
      Object.keys(rawCalendarRepeatSave).every((key) => [
        'intervalMinutes',
        'ability',
        'dc',
        'onSuccess',
        'maximumHitPointReductionOnFailure',
        'nextWorldMinute',
        'lastResolvedWorldMinute',
      ].includes(key)) &&
      Number.isSafeInteger(rawCalendarRepeatSave.intervalMinutes) &&
      Number(rawCalendarRepeatSave.intervalMinutes) >= 1 &&
      Number(rawCalendarRepeatSave.intervalMinutes) <= 5_256_000 &&
      ABILITIES.has(rawCalendarRepeatSave.ability as AbilityKey) &&
      Number.isInteger(rawCalendarRepeatSave.dc) &&
      Number(rawCalendarRepeatSave.dc) >= 1 &&
      Number(rawCalendarRepeatSave.dc) <= 100 &&
      (rawCalendarRepeatSave.onSuccess === 'remove' || rawCalendarRepeatSave.onSuccess === 'retain') &&
      (rawCalendarMaximumReduction == null || calendarMaximumReduction != null) &&
      (rawCalendarRepeatSave.nextWorldMinute == null || (
        Number.isSafeInteger(rawCalendarRepeatSave.nextWorldMinute) &&
        Number(rawCalendarRepeatSave.nextWorldMinute) >= 0
      )) &&
      (rawCalendarRepeatSave.lastResolvedWorldMinute == null || (
        Number.isSafeInteger(rawCalendarRepeatSave.lastResolvedWorldMinute) &&
        Number(rawCalendarRepeatSave.lastResolvedWorldMinute) >= 0
      ))
      ? {
          intervalMinutes: Number(rawCalendarRepeatSave.intervalMinutes),
          ability: rawCalendarRepeatSave.ability as AbilityKey,
          dc: Number(rawCalendarRepeatSave.dc),
          onSuccess: rawCalendarRepeatSave.onSuccess as 'remove' | 'retain',
          maximumHitPointReductionOnFailure: calendarMaximumReduction,
          nextWorldMinute: rawCalendarRepeatSave.nextWorldMinute == null
            ? undefined
            : Number(rawCalendarRepeatSave.nextWorldMinute),
          lastResolvedWorldMinute: rawCalendarRepeatSave.lastResolvedWorldMinute == null
            ? undefined
            : Number(rawCalendarRepeatSave.lastResolvedWorldMinute),
        }
      : undefined
    const rawRemoval = candidate.removal
    const rawRemovalAction = isRecord(rawRemoval) ? rawRemoval.action : undefined
    const rawRemovalCheck = isRecord(rawRemovalAction)
      ? rawRemovalAction.abilityCheck
      : undefined
    const removalAction = rawRemovalAction == null
      ? undefined
      : isRecord(rawRemovalAction) &&
        Object.keys(rawRemovalAction).every((key) =>
          key === 'label' ||
          key === 'economy' ||
          key === 'maxDistanceFeet' ||
          key === 'selfOnly' ||
          key === 'abilityCheck') &&
        typeof rawRemovalAction.label === 'string' &&
        rawRemovalAction.label.trim().length > 0 &&
        rawRemovalAction.label.length <= 120 &&
        (rawRemovalAction.economy === 'action' ||
          (rawRemovalAction.economy === 'free' && rawRemovalAction.selfOnly === true &&
            rawRemovalAction.maxDistanceFeet === 0 && rawRemovalCheck == null)) &&
        (rawRemovalAction.selfOnly === undefined || rawRemovalAction.selfOnly === true) &&
        typeof rawRemovalAction.maxDistanceFeet === 'number' &&
        Number.isFinite(rawRemovalAction.maxDistanceFeet) &&
        rawRemovalAction.maxDistanceFeet >= 0 &&
        rawRemovalAction.maxDistanceFeet <= 1_000 &&
        (
          rawRemovalCheck == null ||
          (
            isRecord(rawRemovalCheck) &&
            Object.keys(rawRemovalCheck).every((key) =>
              key === 'ability' || key === 'skill' || key === 'dc') &&
            ABILITIES.has(rawRemovalCheck.ability as AbilityKey) &&
            (rawRemovalCheck.skill == null || rawRemovalCheck.skill === 'medicine' || rawRemovalCheck.skill === 'arcana' || rawRemovalCheck.skill === 'athletics') &&
            Number.isInteger(rawRemovalCheck.dc) &&
            Number(rawRemovalCheck.dc) >= 1 &&
            Number(rawRemovalCheck.dc) <= 100
          )
        )
        ? {
            label: rawRemovalAction.label.trim(),
            economy: rawRemovalAction.economy as 'action' | 'free',
            maxDistanceFeet: rawRemovalAction.maxDistanceFeet,
            ...(rawRemovalAction.selfOnly === true ? { selfOnly: true as const } : {}),
            abilityCheck: isRecord(rawRemovalCheck)
              ? {
                  ability: rawRemovalCheck.ability as AbilityKey,
                  skill: rawRemovalCheck.skill as 'medicine' | 'arcana' | 'athletics' | undefined,
                  dc: Number(rawRemovalCheck.dc),
                }
              : undefined,
          }
        : null
    const rawSourceLink = isRecord(rawRemoval) ? rawRemoval.sourceLink : undefined
    const sourceLink = rawSourceLink == null
      ? undefined
      : isRecord(rawSourceLink) &&
        Object.keys(rawSourceLink).every((key) => [
          'sourceAttacksOtherTarget', 'sourceCastsSpellOnOtherTarget',
          'targetHarmedBySourceAlly', 'sourceRequiresEffect', 'sourceRequiresEffectAtSourceTurnEnd',
          'sourceRequiresEffectSameApplication', 'sourceRequiresEffectInstanceId',
          'maximumDistanceFeetAtSourceTurnEnd',
          'maximumDistanceFeet', 'requiresLineOfEffect', 'sourceMustBeConsciousAndAbleToSpeak', 'sourceMustNotBeIncapacitated',
          'requiresSourceCommunication', 'requiresSharedLanguage', 'sourceRequiresHeldMeleeWeaponBaseIds',
        ].includes(key)) &&
        ['sourceAttacksOtherTarget', 'sourceCastsSpellOnOtherTarget', 'targetHarmedBySourceAlly',
          'sourceRequiresEffectSameApplication', 'requiresLineOfEffect', 'sourceMustBeConsciousAndAbleToSpeak', 'sourceMustNotBeIncapacitated', 'requiresSourceCommunication', 'requiresSharedLanguage']
          .every((key) => rawSourceLink[key] == null || rawSourceLink[key] === true) &&
        (rawSourceLink.sourceRequiresHeldMeleeWeaponBaseIds == null || validDnd5eHeldWeaponBaseIds(rawSourceLink.sourceRequiresHeldMeleeWeaponBaseIds)) &&
        (rawSourceLink.maximumDistanceFeetAtSourceTurnEnd == null || (
          typeof rawSourceLink.maximumDistanceFeetAtSourceTurnEnd === 'number' &&
          Number.isFinite(rawSourceLink.maximumDistanceFeetAtSourceTurnEnd) &&
          rawSourceLink.maximumDistanceFeetAtSourceTurnEnd >= 0 &&
          rawSourceLink.maximumDistanceFeetAtSourceTurnEnd <= 10_000
        )) &&
        (rawSourceLink.maximumDistanceFeet == null || (
          typeof rawSourceLink.maximumDistanceFeet === 'number' &&
          Number.isFinite(rawSourceLink.maximumDistanceFeet) &&
          rawSourceLink.maximumDistanceFeet >= 0 && rawSourceLink.maximumDistanceFeet <= 10_000
        )) &&
        (rawSourceLink.sourceRequiresEffectAtSourceTurnEnd == null || (
          typeof rawSourceLink.sourceRequiresEffectAtSourceTurnEnd === 'string' &&
          /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(rawSourceLink.sourceRequiresEffectAtSourceTurnEnd)
        )) &&
        (rawSourceLink.sourceRequiresEffect == null || (
          typeof rawSourceLink.sourceRequiresEffect === 'string' &&
          /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(rawSourceLink.sourceRequiresEffect)
        )) &&
        (rawSourceLink.sourceRequiresEffectSameApplication == null || typeof rawSourceLink.sourceRequiresEffect === 'string') &&
        (rawSourceLink.sourceRequiresEffectInstanceId == null ||
          (rawSourceLink.sourceRequiresEffectSameApplication === true && typeof rawSourceLink.sourceRequiresEffectInstanceId === 'string' &&
            rawSourceLink.sourceRequiresEffectInstanceId.length > 0 && rawSourceLink.sourceRequiresEffectInstanceId.length <= 500)) &&
        Object.values(rawSourceLink).some((value) =>
          value === true || typeof value === 'number' || typeof value === 'string' || Array.isArray(value))
        ? {
            sourceRequiresHeldMeleeWeaponBaseIds: validDnd5eHeldWeaponBaseIds(rawSourceLink.sourceRequiresHeldMeleeWeaponBaseIds) ? [...rawSourceLink.sourceRequiresHeldMeleeWeaponBaseIds] : undefined,
            sourceAttacksOtherTarget: rawSourceLink.sourceAttacksOtherTarget === true ? true as const : undefined,
            sourceCastsSpellOnOtherTarget: rawSourceLink.sourceCastsSpellOnOtherTarget === true ? true as const : undefined,
            targetHarmedBySourceAlly: rawSourceLink.targetHarmedBySourceAlly === true ? true as const : undefined,
            sourceRequiresEffectSameApplication: rawSourceLink.sourceRequiresEffectSameApplication === true ? true as const : undefined,
            sourceRequiresEffectInstanceId: typeof rawSourceLink.sourceRequiresEffectInstanceId === 'string' ? rawSourceLink.sourceRequiresEffectInstanceId : undefined,
            sourceRequiresEffect: typeof rawSourceLink.sourceRequiresEffect === 'string'
              ? rawSourceLink.sourceRequiresEffect
              : undefined,
            sourceRequiresEffectAtSourceTurnEnd:
              typeof rawSourceLink.sourceRequiresEffectAtSourceTurnEnd === 'string'
                ? rawSourceLink.sourceRequiresEffectAtSourceTurnEnd
                : undefined,
            maximumDistanceFeetAtSourceTurnEnd:
              typeof rawSourceLink.maximumDistanceFeetAtSourceTurnEnd === 'number'
                ? rawSourceLink.maximumDistanceFeetAtSourceTurnEnd
                : undefined,
            maximumDistanceFeet: typeof rawSourceLink.maximumDistanceFeet === 'number'
              ? rawSourceLink.maximumDistanceFeet
              : undefined,
            requiresLineOfEffect: rawSourceLink.requiresLineOfEffect === true ? true as const : undefined,
            sourceMustBeConsciousAndAbleToSpeak:
              rawSourceLink.sourceMustBeConsciousAndAbleToSpeak === true ? true as const : undefined,
            sourceMustNotBeIncapacitated:
              rawSourceLink.sourceMustNotBeIncapacitated === true ? true as const : undefined,
            requiresSourceCommunication: rawSourceLink.requiresSourceCommunication === true ? true as const : undefined,
            requiresSharedLanguage: rawSourceLink.requiresSharedLanguage === true ? true as const : undefined,
          }
        : null
    const removal = isRecord(rawRemoval) &&
      Object.keys(rawRemoval).every((key) =>
        key === 'action' || key === 'onMagicalHealing' || key === 'sourceLink' || key === 'onInventoryInstanceDestroyed') &&
      (rawRemoval.onInventoryInstanceDestroyed == null || (typeof rawRemoval.onInventoryInstanceDestroyed === 'string' &&
        rawRemoval.onInventoryInstanceDestroyed.length > 0 && rawRemoval.onInventoryInstanceDestroyed.length <= 200)) &&
      removalAction !== null &&
      sourceLink !== null &&
      (
        rawRemoval.onMagicalHealing == null ||
        rawRemoval.onMagicalHealing === true
      ) &&
      (removalAction != null || rawRemoval.onMagicalHealing === true || sourceLink != null || rawRemoval.onInventoryInstanceDestroyed != null)
      ? {
          action: removalAction,
          sourceLink,
          onInventoryInstanceDestroyed: typeof rawRemoval.onInventoryInstanceDestroyed === 'string' ? rawRemoval.onInventoryInstanceDestroyed : undefined,
          onMagicalHealing:
            rawRemoval.onMagicalHealing === true ? true as const : undefined,
        }
      : undefined
    const rawRelation = candidate.relation
    const rawCorpseEscape = isRecord(rawRelation) ? rawRelation.corpseEscape : undefined
    const corpseEscape = isRecord(rawCorpseEscape) &&
      Object.keys(rawCorpseEscape).every((key) =>
        key === 'movementCostFeet' || key === 'applyProne') &&
      Number.isInteger(rawCorpseEscape.movementCostFeet) &&
      Number(rawCorpseEscape.movementCostFeet) >= 1 &&
      Number(rawCorpseEscape.movementCostFeet) <= 1_000 &&
      rawCorpseEscape.applyProne === true
      ? {
          movementCostFeet: Number(rawCorpseEscape.movementCostFeet),
          applyProne: true as const,
        }
      : undefined
    const relation = isRecord(rawRelation) &&
      Object.keys(rawRelation).every((key) => [
        'schemaVersion',
        'kind',
        'sourceActorId',
        'sourceActionId',
        'slotGroup',
        'maxDistanceFeet',
        'movement',
        'endsOnSourceIncapacitated',
        'corpseEscape',
      ].includes(key)) &&
      rawRelation.schemaVersion === 1 &&
      (
        rawRelation.kind === 'grapple' ||
        rawRelation.kind === 'attachment' ||
        rawRelation.kind === 'swallowed' ||
        rawRelation.kind === 'engulfed'
      ) &&
      typeof rawRelation.sourceActorId === 'string' &&
      rawRelation.sourceActorId.trim().length > 0 &&
      rawRelation.sourceActorId.length <= 320 &&
      typeof candidate.source.actorId === 'string' &&
      rawRelation.sourceActorId.trim() === candidate.source.actorId.trim() &&
      typeof rawRelation.sourceActionId === 'string' &&
      rawRelation.sourceActionId.trim().length > 0 &&
      rawRelation.sourceActionId.length <= 320 &&
      typeof rawRelation.slotGroup === 'string' &&
      rawRelation.slotGroup.trim().length > 0 &&
      rawRelation.slotGroup.length <= 320 &&
      typeof rawRelation.maxDistanceFeet === 'number' &&
      Number.isFinite(rawRelation.maxDistanceFeet) &&
      rawRelation.maxDistanceFeet > 0 &&
      rawRelation.maxDistanceFeet <= 1_000 &&
      (
        rawRelation.movement === 'drag-target' ||
        rawRelation.movement === 'carry-target' ||
        rawRelation.movement === 'source-rides-target'
      ) &&
      typeof rawRelation.endsOnSourceIncapacitated === 'boolean'
      && (rawRelation.corpseEscape == null || corpseEscape != null)
      && (corpseEscape == null || rawRelation.kind === 'swallowed')
      ? {
          schemaVersion: 1 as const,
          kind: rawRelation.kind as Dnd5eActiveEffectRelation['kind'],
          sourceActorId: rawRelation.sourceActorId.trim(),
          sourceActionId: rawRelation.sourceActionId.trim(),
          slotGroup: rawRelation.slotGroup.trim(),
          maxDistanceFeet: rawRelation.maxDistanceFeet,
          movement: rawRelation.movement as Dnd5eActiveEffectRelation['movement'],
          endsOnSourceIncapacitated: rawRelation.endsOnSourceIncapacitated,
          corpseEscape,
        }
      : undefined
    const basicGrappleRelation =
      relation?.sourceActionId === 'basic-action:grapple' &&
      relation.slotGroup === 'free-hand' &&
      relation.maxDistanceFeet === 5 &&
      candidate.source.kind === 'feature' &&
      candidate.source.rulesId === 'basic-action:grapple' &&
      escapeCheck == null
    const basicMountRelation =
      relation?.kind === 'attachment' &&
      relation.sourceActionId === 'basic-action:mount' &&
      relation.slotGroup === 'riding' &&
      relation.maxDistanceFeet === 5 &&
      relation.movement === 'source-rides-target' &&
      candidate.source.kind === 'feature' &&
      candidate.source.rulesId === 'basic-action:mount' &&
      escapeCheck == null
    const hasFixedEscapeCheck =
      escapeCheck?.ability === 'str' &&
      escapeCheck.skill === 'athletics' &&
      escapeCheck.alternativeAbility === 'dex' &&
      escapeCheck.alternativeSkill === 'acrobatics' &&
      escapeCheck.economy === 'action'
    const relationRootMatchesKind = relation == null || (
      relation.kind === 'grapple'
        ? candidate.kind === 'condition' && standardCondition === 'grappled'
        : relation.kind === 'engulfed'
          ? candidate.kind === 'condition' && standardCondition === 'grappled'
          : relation.kind === 'swallowed'
            ? candidate.kind === 'condition' && standardCondition === 'restrained'
            : candidate.kind !== 'condition' &&
              standardCondition == null &&
              candidate.legacyCondition === 'attached'
    )
    const relationRootIsValid = relation == null || (
      relationRootMatchesKind &&
      candidate.dependsOnEffectId == null &&
      (
        basicGrappleRelation ||
        basicMountRelation ||
        relation.kind === 'swallowed' ||
        hasFixedEscapeCheck
      )
    )
    // A malformed or non-root relation must not degrade into an ordinary
    // permanent condition: without its lifecycle metadata it could never be
    // reconciled safely.
    if (rawRelation != null && (relation == null || !relationRootIsValid)) continue
    if (rawPeriodicDamage != null && periodicDamage == null) continue
    if (rawPeriodicHealing != null && periodicHealing == null) continue
    if (rawBodyRestoration != null && bodyRestoration == null) continue
    if (rawCalendarRepeatSave != null && calendarRepeatSave == null) continue
    if (rawRemoval != null && removal == null) continue
    const potency = typeof candidate.potency === 'number' &&
      Number.isFinite(candidate.potency) &&
      candidate.potency >= 0 &&
      candidate.potency <= MAX_ACTIVE_EFFECT_POTENCY
      ? candidate.potency
      : undefined
    const rawMaximum = candidate.maximizedDamageRoll
    const maximizedDamageRoll = isRecord(rawMaximum) &&
      typeof rawMaximum.count === 'number' && Number.isInteger(rawMaximum.count) && rawMaximum.count >= 1 && rawMaximum.count <= 100 &&
      typeof rawMaximum.sides === 'number' && [4, 6, 8, 10, 12, 20, 100].includes(rawMaximum.sides) &&
      typeof rawMaximum.bonus === 'number' && Number.isInteger(rawMaximum.bonus) && Math.abs(rawMaximum.bonus) <= 1000 &&
      potency === Math.max(0, rawMaximum.count * rawMaximum.sides + rawMaximum.bonus)
      ? { count: rawMaximum.count, sides: rawMaximum.sides, bonus: rawMaximum.bonus } : undefined
    if (rawMaximum != null && maximizedDamageRoll == null) continue
    seen.add(candidate.id)
    const rawModifiers = candidate.modifiers
    const rawShillelagh = isRecord(rawModifiers) ? rawModifiers.shillelagh : undefined
    const shillelagh = isRecord(rawShillelagh) &&
      typeof rawShillelagh.weaponId === 'string' &&
      rawShillelagh.weaponId.trim().length > 0 &&
      rawShillelagh.weaponId.length <= 200 &&
      ABILITIES.has(rawShillelagh.spellcastingAbility as AbilityKey) &&
      typeof rawShillelagh.spellcastingModifier === 'number' &&
      Number.isInteger(rawShillelagh.spellcastingModifier) &&
      rawShillelagh.spellcastingModifier >= -10 &&
      rawShillelagh.spellcastingModifier <= 20
      ? {
          weaponId: rawShillelagh.weaponId.trim(),
          spellcastingAbility: rawShillelagh.spellcastingAbility as AbilityKey,
          spellcastingModifier: rawShillelagh.spellcastingModifier,
        }
      : undefined
    const rawMagicWeapon = isRecord(rawModifiers) ? rawModifiers.magicWeapon : undefined
    const magicWeapon = isRecord(rawMagicWeapon) &&
      typeof rawMagicWeapon.weaponId === 'string' &&
      rawMagicWeapon.weaponId.trim().length > 0 &&
      rawMagicWeapon.weaponId.length <= 200 &&
      (rawMagicWeapon.bonus === 1 || rawMagicWeapon.bonus === 2 || rawMagicWeapon.bonus === 3)
      ? {
          weaponId: rawMagicWeapon.weaponId.trim(),
          bonus: rawMagicWeapon.bonus as 1 | 2 | 3,
        }
      : undefined
    const armorEnchantment = isRecord(rawModifiers) && validArmorEnchantment(rawModifiers.armorEnchantment)
      ? { ...rawModifiers.armorEnchantment } : undefined
    const rawWeaponEnchantment = isRecord(rawModifiers) ? rawModifiers.weaponEnchantment : undefined
    const rawWeaponEnchantmentDamage = isRecord(rawWeaponEnchantment)
      ? rawWeaponEnchantment.bonusDamage
      : undefined
    const weaponEnchantment = isRecord(rawWeaponEnchantment) &&
      typeof rawWeaponEnchantment.weaponId === 'string' &&
      rawWeaponEnchantment.weaponId.trim().length > 0 &&
      rawWeaponEnchantment.weaponId.length <= 200 &&
      (rawWeaponEnchantment.inventoryInstanceId == null || (typeof rawWeaponEnchantment.inventoryInstanceId === 'string' && rawWeaponEnchantment.inventoryInstanceId.length > 0 && rawWeaponEnchantment.inventoryInstanceId.length <= 200)) &&
      Number.isInteger(rawWeaponEnchantment.attackAndDamageBonus) &&
      typeof rawWeaponEnchantment.attackAndDamageBonus === 'number' &&
      rawWeaponEnchantment.attackAndDamageBonus >= 0 &&
      rawWeaponEnchantment.attackAndDamageBonus <= 3 &&
      (rawWeaponEnchantment.spellcastingFocusClassIds == null || (validWeaponFocusClassIds(rawWeaponEnchantment.spellcastingFocusClassIds) && typeof rawWeaponEnchantment.inventoryInstanceId === 'string' && rawWeaponEnchantment.ammunitionContainer !== true)) &&
      (rawWeaponEnchantment.remainingAttacks == null || (typeof rawWeaponEnchantment.remainingAttacks === 'number' && Number.isInteger(rawWeaponEnchantment.remainingAttacks) && rawWeaponEnchantment.remainingAttacks >= 1 && rawWeaponEnchantment.remainingAttacks <= 1000)) &&
      (rawWeaponEnchantment.consumeOnDraw == null || (rawWeaponEnchantment.consumeOnDraw === true && rawWeaponEnchantment.ammunitionContainer === true && rawWeaponEnchantment.remainingAttacks != null)) &&
      (rawWeaponEnchantment.ammunitionStack == null || (rawWeaponEnchantment.ammunitionStack === true && rawWeaponEnchantment.ammunitionContainer !== true && typeof rawWeaponEnchantment.inventoryInstanceId === 'string' && typeof rawWeaponEnchantment.drawSourceEffectId === 'string' && rawWeaponEnchantment.drawSourceEffectId.length > 0 && rawWeaponEnchantment.remainingAttacks != null)) &&
      (rawWeaponEnchantmentDamage == null || (
        isRecord(rawWeaponEnchantmentDamage) &&
        Number.isInteger(rawWeaponEnchantmentDamage.count) &&
        typeof rawWeaponEnchantmentDamage.count === 'number' &&
        rawWeaponEnchantmentDamage.count >= 1 && rawWeaponEnchantmentDamage.count <= 40 &&
        Number.isInteger(rawWeaponEnchantmentDamage.sides) &&
        typeof rawWeaponEnchantmentDamage.sides === 'number' &&
        rawWeaponEnchantmentDamage.sides >= 2 && rawWeaponEnchantmentDamage.sides <= 100 &&
        (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawWeaponEnchantmentDamage.type) &&
        (rawWeaponEnchantmentDamage.magical == null || typeof rawWeaponEnchantmentDamage.magical === 'boolean')
      ))
      ? {
          weaponId: rawWeaponEnchantment.weaponId.trim(),
          sourceWielderOnly: rawWeaponEnchantment.sourceWielderOnly === true ? true as const : undefined,
          inventoryInstanceId: rawWeaponEnchantment.inventoryInstanceId as string | undefined,
          remainingAttacks: rawWeaponEnchantment.remainingAttacks as number | undefined,
          ammunitionContainer: rawWeaponEnchantment.ammunitionContainer===true ? true : undefined,
          consumeOnDraw: rawWeaponEnchantment.consumeOnDraw === true ? true as const : undefined,
          ammunitionStack: rawWeaponEnchantment.ammunitionStack === true ? true as const : undefined,
          drawSourceEffectId: typeof rawWeaponEnchantment.drawSourceEffectId === 'string' ? rawWeaponEnchantment.drawSourceEffectId : undefined,
          weaponIds: Array.isArray(rawWeaponEnchantment.weaponIds) ? rawWeaponEnchantment.weaponIds.filter((id):id is string=>typeof id==='string' && id.length>0 && id.length<=200).slice(0,256) : undefined,
          attackAndDamageBonus: rawWeaponEnchantment.attackAndDamageBonus as 0 | 1 | 2 | 3,
          spellcastingFocusClassIds: validWeaponFocusClassIds(rawWeaponEnchantment.spellcastingFocusClassIds) ? [...rawWeaponEnchantment.spellcastingFocusClassIds] : undefined,
          bonusDamage: isRecord(rawWeaponEnchantmentDamage)
            ? {
                count: rawWeaponEnchantmentDamage.count as number,
                sides: rawWeaponEnchantmentDamage.sides as number,
                type: rawWeaponEnchantmentDamage.type as Dnd5eDamageType,
                magical: rawWeaponEnchantmentDamage.magical as boolean | undefined,
              }
            : undefined,
        }
      : undefined
    const rawAttackProfiles = isRecord(rawModifiers) ? rawModifiers.attackProfiles : undefined
    const attackProfiles = Array.isArray(rawAttackProfiles)
      ? rawAttackProfiles.flatMap((rawProfile) => {
          if (!isRecord(rawProfile) || !Array.isArray(rawProfile.attackModes)) return []
          const attackModes = rawProfile.attackModes.filter((entry): entry is 'melee' | 'ranged' | 'unarmed' =>
            entry === 'melee' || entry === 'ranged' || entry === 'unarmed')
          const weaponIds = rawProfile.weaponIds == null
            ? undefined
            : Array.isArray(rawProfile.weaponIds) && rawProfile.weaponIds.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,199}$/.test(entry))
              ? [...new Set(rawProfile.weaponIds)] as string[]
              : null
          const reachBonusFeet = rawProfile.reachBonusFeet == null
            ? undefined
            : typeof rawProfile.reachBonusFeet === 'number' && Number.isFinite(rawProfile.reachBonusFeet) &&
                rawProfile.reachBonusFeet >= 0 && rawProfile.reachBonusFeet <= 1_000
              ? rawProfile.reachBonusFeet
              : null
          const criticalThreshold = rawProfile.criticalThreshold == null ? undefined
            : Number.isInteger(rawProfile.criticalThreshold) && Number(rawProfile.criticalThreshold) >= 2 && Number(rawProfile.criticalThreshold) <= 20
              ? Number(rawProfile.criticalThreshold) : null
          const damageTypeOverride = rawProfile.damageTypeOverride == null
            ? undefined
            : (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawProfile.damageTypeOverride)
              ? rawProfile.damageTypeOverride as Dnd5eDamageType
              : null
          if (
            attackModes.length !== rawProfile.attackModes.length || attackModes.length === 0 ||
            weaponIds === null || reachBonusFeet === null || criticalThreshold === null || damageTypeOverride === null ||
            (reachBonusFeet == null && criticalThreshold == null && damageTypeOverride == null)
          ) return []
          return [{
            attackModes: [...new Set(attackModes)],
            weaponIds,
            reachBonusFeet,
            criticalThreshold,
            damageTypeOverride,
          }]
        })
      : undefined
    const modifiers = isRecord(rawModifiers)
      ? {
          speedPenaltyFeet: typeof rawModifiers.speedPenaltyFeet === 'number' &&
            Number.isFinite(rawModifiers.speedPenaltyFeet) && rawModifiers.speedPenaltyFeet >= 0
            ? rawModifiers.speedPenaltyFeet
            : undefined,
          speedBonusFeet: typeof rawModifiers.speedBonusFeet === 'number' &&
            Number.isFinite(rawModifiers.speedBonusFeet) && rawModifiers.speedBonusFeet >= 0
            ? rawModifiers.speedBonusFeet
            : undefined,
          speedOverrideFeet: typeof rawModifiers.speedOverrideFeet === 'number' &&
            Number.isFinite(rawModifiers.speedOverrideFeet) && rawModifiers.speedOverrideFeet >= 0 &&
            rawModifiers.speedOverrideFeet <= 10_000
            ? rawModifiers.speedOverrideFeet
            : undefined,
          speedMinimumFeet: typeof rawModifiers.speedMinimumFeet === 'number' &&
            Number.isFinite(rawModifiers.speedMinimumFeet) && rawModifiers.speedMinimumFeet >= 0 &&
            rawModifiers.speedMinimumFeet <= 10_000
            ? rawModifiers.speedMinimumFeet
            : undefined,
          speedMaximumFeet: typeof rawModifiers.speedMaximumFeet === 'number' &&
            Number.isFinite(rawModifiers.speedMaximumFeet) && rawModifiers.speedMaximumFeet >= 0 &&
            rawModifiers.speedMaximumFeet <= 10_000
            ? rawModifiers.speedMaximumFeet
            : undefined,
          speedMultiplier: typeof rawModifiers.speedMultiplier === 'number' &&
            Number.isFinite(rawModifiers.speedMultiplier) &&
            rawModifiers.speedMultiplier >= 0 && rawModifiers.speedMultiplier <= 10
            ? rawModifiers.speedMultiplier
            : undefined,
          maximumAttacksPerTurn: typeof rawModifiers.maximumAttacksPerTurn === 'number' &&
            Number.isInteger(rawModifiers.maximumAttacksPerTurn) &&
            rawModifiers.maximumAttacksPerTurn > 0
            ? rawModifiers.maximumAttacksPerTurn
            : undefined,
          restrictedExtraAction: isRecord(rawModifiers.restrictedExtraAction) &&
            Object.keys(rawModifiers.restrictedExtraAction).every((key) =>
              key === 'allowedActions' || key === 'maximumWeaponAttacks') &&
            Array.isArray(rawModifiers.restrictedExtraAction.allowedActions) &&
            rawModifiers.restrictedExtraAction.allowedActions.length > 0 &&
            rawModifiers.restrictedExtraAction.allowedActions.every((entry) =>
              ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'].includes(String(entry))) &&
            rawModifiers.restrictedExtraAction.maximumWeaponAttacks === 1
            ? {
                allowedActions: [...new Set(rawModifiers.restrictedExtraAction.allowedActions)] as
                  ('weapon-attack' | 'dash' | 'disengage' | 'hide' | 'use-object')[],
                maximumWeaponAttacks: 1 as const,
              }
            : undefined,
          preventActions: rawModifiers.preventActions === true ? true : undefined,
          preventRestBenefits: rawModifiers.preventRestBenefits === true ? true as const : undefined,
          actionRestriction: isRecord(rawModifiers.actionRestriction) &&
            Object.keys(rawModifiers.actionRestriction).every((key) =>
              key === 'prohibited' || key === 'allowedBasicActions' || key === 'allowedActivityIds') &&
            Array.isArray(rawModifiers.actionRestriction.prohibited) &&
            rawModifiers.actionRestriction.prohibited.length > 0 &&
            rawModifiers.actionRestriction.prohibited.every((entry) =>
              ['attack', 'spellcasting', 'object-interaction', 'speech'].includes(String(entry))) &&
            (rawModifiers.actionRestriction.allowedBasicActions == null || (
              Array.isArray(rawModifiers.actionRestriction.allowedBasicActions) &&
              rawModifiers.actionRestriction.allowedBasicActions.length > 0 &&
              rawModifiers.actionRestriction.allowedBasicActions.every((entry) =>
                ['dash', 'dismiss-effect'].includes(String(entry))))) &&
            (rawModifiers.actionRestriction.allowedActivityIds == null || (
              Array.isArray(rawModifiers.actionRestriction.allowedActivityIds) &&
              rawModifiers.actionRestriction.allowedActivityIds.length > 0 &&
              rawModifiers.actionRestriction.allowedActivityIds.length <= 32 &&
              rawModifiers.actionRestriction.allowedActivityIds.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(entry))))
            ? {
                prohibited: [...new Set(rawModifiers.actionRestriction.prohibited)] as
                  ('attack' | 'spellcasting' | 'object-interaction' | 'speech')[],
                allowedBasicActions: Array.isArray(rawModifiers.actionRestriction.allowedBasicActions)
                  ? [...new Set(rawModifiers.actionRestriction.allowedBasicActions)] as ('dash' | 'dismiss-effect')[]
                  : undefined,
                allowedActivityIds: Array.isArray(rawModifiers.actionRestriction.allowedActivityIds)
                  ? [...new Set(rawModifiers.actionRestriction.allowedActivityIds)] as string[]
                  : undefined,
              }
            : undefined,
          spellSaveDisadvantageAura: isRecord(rawModifiers.spellSaveDisadvantageAura) &&
            typeof rawModifiers.spellSaveDisadvantageAura.radiusFeet === 'number' &&
            Number.isFinite(rawModifiers.spellSaveDisadvantageAura.radiusFeet) &&
            rawModifiers.spellSaveDisadvantageAura.radiusFeet > 0 &&
            rawModifiers.spellSaveDisadvantageAura.radiusFeet <= 10_000 &&
            Array.isArray(rawModifiers.spellSaveDisadvantageAura.damageTypes) &&
            rawModifiers.spellSaveDisadvantageAura.damageTypes.every((entry) =>
              (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry)) &&
            (rawModifiers.spellSaveDisadvantageAura.spellcastingClassIds == null || (
              Array.isArray(rawModifiers.spellSaveDisadvantageAura.spellcastingClassIds) &&
              rawModifiers.spellSaveDisadvantageAura.spellcastingClassIds.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(entry)))) &&
            (rawModifiers.spellSaveDisadvantageAura.damageTypes.length > 0 ||
              (rawModifiers.spellSaveDisadvantageAura.spellcastingClassIds as unknown[] | undefined)?.length)
            ? {
                radiusFeet: rawModifiers.spellSaveDisadvantageAura.radiusFeet,
                damageTypes: [...new Set(rawModifiers.spellSaveDisadvantageAura.damageTypes)] as Dnd5eDamageType[],
                spellcastingClassIds: Array.isArray(rawModifiers.spellSaveDisadvantageAura.spellcastingClassIds)
                  ? [...new Set(rawModifiers.spellSaveDisadvantageAura.spellcastingClassIds)] as string[]
                  : undefined,
              }
            : undefined,
          spellActionAsBonusActionClassIds: Array.isArray(rawModifiers.spellActionAsBonusActionClassIds) &&
            rawModifiers.spellActionAsBonusActionClassIds.length > 0 &&
            rawModifiers.spellActionAsBonusActionClassIds.every((entry) =>
              typeof entry === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(entry))
            ? [...new Set(rawModifiers.spellActionAsBonusActionClassIds)] as string[]
            : undefined,
          actionOrBonusActionOnly: typeof rawModifiers.actionOrBonusActionOnly === 'boolean'
            ? rawModifiers.actionOrBonusActionOnly
            : undefined,
          actionSpellDelay: isRecord(rawModifiers.actionSpellDelay) &&
            Object.keys(rawModifiers.actionSpellDelay).every((key) =>
              key === 'dieSides' || key === 'delayMinimum') &&
            rawModifiers.actionSpellDelay.dieSides === 20 &&
            typeof rawModifiers.actionSpellDelay.delayMinimum === 'number' &&
            Number.isInteger(rawModifiers.actionSpellDelay.delayMinimum) &&
            rawModifiers.actionSpellDelay.delayMinimum >= 1 &&
            rawModifiers.actionSpellDelay.delayMinimum <= 20
            ? {
                dieSides: 20 as const,
                delayMinimum: rawModifiers.actionSpellDelay.delayMinimum,
              }
            : undefined,
          darkvisionRangeFeet: typeof rawModifiers.darkvisionRangeFeet === 'number' &&
            Number.isFinite(rawModifiers.darkvisionRangeFeet) &&
            rawModifiers.darkvisionRangeFeet > 0 &&
            rawModifiers.darkvisionRangeFeet <= 10_000
            ? rawModifiers.darkvisionRangeFeet
            : undefined,
          darkvisionIfAbsentFeet: typeof rawModifiers.darkvisionIfAbsentFeet === 'number' && Number.isFinite(rawModifiers.darkvisionIfAbsentFeet) && rawModifiers.darkvisionIfAbsentFeet > 0 && rawModifiers.darkvisionIfAbsentFeet <= 10_000 ? rawModifiers.darkvisionIfAbsentFeet : undefined,
          darkvisionExistingBonusFeet: typeof rawModifiers.darkvisionExistingBonusFeet === 'number' && Number.isFinite(rawModifiers.darkvisionExistingBonusFeet) && rawModifiers.darkvisionExistingBonusFeet > 0 && rawModifiers.darkvisionExistingBonusFeet <= 10_000 ? rawModifiers.darkvisionExistingBonusFeet : undefined,
          darkvisionRacialFallbackFeet: typeof rawModifiers.darkvisionRacialFallbackFeet === 'number' && Number.isFinite(rawModifiers.darkvisionRacialFallbackFeet) && rawModifiers.darkvisionRacialFallbackFeet > 0 && rawModifiers.darkvisionRacialFallbackFeet <= 10_000 ? rawModifiers.darkvisionRacialFallbackFeet : undefined,
          darkvisionRacialBonusFeet: typeof rawModifiers.darkvisionRacialBonusFeet === 'number' && Number.isFinite(rawModifiers.darkvisionRacialBonusFeet) && rawModifiers.darkvisionRacialBonusFeet > 0 && rawModifiers.darkvisionRacialBonusFeet <= 10_000 ? rawModifiers.darkvisionRacialBonusFeet : undefined,
          climbSpeedEqualsWalking: typeof rawModifiers.climbSpeedEqualsWalking === 'boolean'
            ? rawModifiers.climbSpeedEqualsWalking
            : undefined,
          climbingCheckAdvantage: rawModifiers.climbingCheckAdvantage === true ? true as const : undefined,
          poisonSavingThrowAdvantage: rawModifiers.poisonSavingThrowAdvantage === true ? true as const : undefined,
          swimSpeedEqualsWalking: typeof rawModifiers.swimSpeedEqualsWalking === 'boolean'
            ? rawModifiers.swimSpeedEqualsWalking
            : undefined,
          sightRangeLimitFeet: typeof rawModifiers.sightRangeLimitFeet === 'number' && Number.isFinite(rawModifiers.sightRangeLimitFeet) && rawModifiers.sightRangeLimitFeet >= 1 && rawModifiers.sightRangeLimitFeet <= 10_000 ? rawModifiers.sightRangeLimitFeet : undefined,
          truesightRangeFeet: typeof rawModifiers.truesightRangeFeet === 'number' &&
            Number.isFinite(rawModifiers.truesightRangeFeet) &&
            rawModifiers.truesightRangeFeet > 0 &&
            rawModifiers.truesightRangeFeet <= 10_000
            ? rawModifiers.truesightRangeFeet
            : undefined,
          spellTargetingImmunitySchools: Array.isArray(rawModifiers.spellTargetingImmunitySchools) &&
            rawModifiers.spellTargetingImmunitySchools.length > 0 &&
            rawModifiers.spellTargetingImmunitySchools.every((entry) =>
              ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'].includes(String(entry))
            )
            ? [...new Set(rawModifiers.spellTargetingImmunitySchools)] as import('./spellbook').Dnd5eSpellbookSchoolId[]
            : undefined,
          suppressInvisibilityBenefits: rawModifiers.suppressInvisibilityBenefits === true ? true as const : undefined,
          invisibleToDarkvision: typeof rawModifiers.invisibleToDarkvision === 'boolean' ? rawModifiers.invisibleToDarkvision : undefined,
          seeInvisible: typeof rawModifiers.seeInvisible === 'boolean'
            ? rawModifiers.seeInvisible
            : undefined,
          languageCapabilities: isRecord(rawModifiers.languageCapabilities) &&
            Object.keys(rawModifiers.languageCapabilities).every((key) => [
              'understandSpoken', 'understandWritten', 'writtenRequiresTouch',
              'writtenMinutesPerPage', 'speechUnderstoodBy',
            ].includes(key)) &&
            (rawModifiers.languageCapabilities.understandSpoken == null ||
              rawModifiers.languageCapabilities.understandSpoken === 'all') &&
            (rawModifiers.languageCapabilities.understandWritten == null ||
              rawModifiers.languageCapabilities.understandWritten === 'literal-written') &&
            (rawModifiers.languageCapabilities.writtenRequiresTouch == null ||
              rawModifiers.languageCapabilities.writtenRequiresTouch === true) &&
            (rawModifiers.languageCapabilities.writtenMinutesPerPage == null ||
              rawModifiers.languageCapabilities.writtenMinutesPerPage === 1) &&
            (rawModifiers.languageCapabilities.speechUnderstoodBy == null ||
              rawModifiers.languageCapabilities.speechUnderstoodBy === 'any-creature-knowing-a-language') &&
            Object.values(rawModifiers.languageCapabilities).some((value) => value != null)
            ? {
                understandSpoken: rawModifiers.languageCapabilities.understandSpoken as 'all' | undefined,
                understandWritten: rawModifiers.languageCapabilities.understandWritten as 'literal-written' | undefined,
                writtenRequiresTouch: rawModifiers.languageCapabilities.writtenRequiresTouch === true
                  ? true as const
                  : undefined,
                writtenMinutesPerPage: rawModifiers.languageCapabilities.writtenMinutesPerPage === 1
                  ? 1 as const
                  : undefined,
                speechUnderstoodBy: rawModifiers.languageCapabilities.speechUnderstoodBy as
                  'any-creature-knowing-a-language' | undefined,
              }
            : undefined,
          languageRestriction: isRecord(rawModifiers.languageRestriction) &&
            Object.keys(rawModifiers.languageRestriction).every((key) =>
              ['understandLanguages', 'intelligibleCommunication'].includes(key)) &&
            rawModifiers.languageRestriction.understandLanguages === false &&
            rawModifiers.languageRestriction.intelligibleCommunication === false
            ? {
                understandLanguages: false as const,
                intelligibleCommunication: false as const,
              }
            : undefined,
          attackDecoys: isRecord(rawModifiers.attackDecoys) &&
            Object.keys(rawModifiers.attackDecoys).every((key) => [
              'remaining', 'redirectMinimumD20', 'armorClassBase',
              'armorClassAbility', 'requiresOrdinarySight',
            ].includes(key)) &&
            Number.isInteger(rawModifiers.attackDecoys.remaining) &&
            Number(rawModifiers.attackDecoys.remaining) >= 1 &&
            Number(rawModifiers.attackDecoys.remaining) <= 20 &&
            Array.isArray(rawModifiers.attackDecoys.redirectMinimumD20) &&
            rawModifiers.attackDecoys.redirectMinimumD20.length >=
              Number(rawModifiers.attackDecoys.remaining) &&
            rawModifiers.attackDecoys.redirectMinimumD20.length <= 20 &&
            rawModifiers.attackDecoys.redirectMinimumD20.every((entry) =>
              Number.isInteger(entry) && Number(entry) >= 1 && Number(entry) <= 20) &&
            Number.isInteger(rawModifiers.attackDecoys.armorClassBase) &&
            Number(rawModifiers.attackDecoys.armorClassBase) >= 0 &&
            Number(rawModifiers.attackDecoys.armorClassBase) <= 100 &&
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(
              String(rawModifiers.attackDecoys.armorClassAbility),
            ) &&
            rawModifiers.attackDecoys.requiresOrdinarySight === true
            ? {
                remaining: Number(rawModifiers.attackDecoys.remaining),
                redirectMinimumD20: [
                  ...(rawModifiers.attackDecoys.redirectMinimumD20 as number[]),
                ],
                armorClassBase: Number(rawModifiers.attackDecoys.armorClassBase),
                armorClassAbility: rawModifiers.attackDecoys.armorClassAbility as AbilityKey,
                requiresOrdinarySight: true as const,
              }
            : undefined,
          planarPhase: isRecord(rawModifiers.planarPhase) &&
            Object.keys(rawModifiers.planarPhase).every((key) => [
              'plane', 'ignoresMaterialCollision', 'suppressCrossPlaneEffects',
              'unrestrictedVerticalMovement', 'materialSightRangeFeet',
            ].includes(key)) &&
            (rawModifiers.planarPhase.plane === 'ethereal' || rawModifiers.planarPhase.plane === 'terrain') &&
            typeof rawModifiers.planarPhase.ignoresMaterialCollision === 'boolean' &&
            rawModifiers.planarPhase.suppressCrossPlaneEffects === true &&
            typeof rawModifiers.planarPhase.unrestrictedVerticalMovement === 'boolean' &&
            (rawModifiers.planarPhase.materialSightRangeFeet == null || (rawModifiers.planarPhase.plane === 'ethereal' &&
              typeof rawModifiers.planarPhase.materialSightRangeFeet === 'number' &&
              Number.isFinite(rawModifiers.planarPhase.materialSightRangeFeet) &&
              rawModifiers.planarPhase.materialSightRangeFeet > 0 && rawModifiers.planarPhase.materialSightRangeFeet <= 10_000)) &&
            (rawModifiers.planarPhase.plane !== 'ethereal' ||
              (rawModifiers.planarPhase.ignoresMaterialCollision && rawModifiers.planarPhase.unrestrictedVerticalMovement)) &&
            (rawModifiers.planarPhase.plane !== 'terrain' ||
              (!rawModifiers.planarPhase.ignoresMaterialCollision && !rawModifiers.planarPhase.unrestrictedVerticalMovement))
            ? {
                plane: rawModifiers.planarPhase.plane as 'ethereal' | 'terrain',
                ignoresMaterialCollision: rawModifiers.planarPhase.ignoresMaterialCollision,
                suppressCrossPlaneEffects: true as const,
                unrestrictedVerticalMovement: rawModifiers.planarPhase.unrestrictedVerticalMovement,
                ...(rawModifiers.planarPhase.materialSightRangeFeet != null
                  ? { materialSightRangeFeet: Number(rawModifiers.planarPhase.materialSightRangeFeet) } : {}),
              }
            : undefined,
          solidMaterialTraversal: normalizeDnd5eSolidMaterialTraversal(rawModifiers.solidMaterialTraversal),
          trackingCapability: isRecord(rawModifiers.trackingCapability) &&
            Object.keys(rawModifiers.trackingCapability).every((key) =>
              ['mundaneTracking', 'leavesTracks'].includes(key)) &&
            rawModifiers.trackingCapability.mundaneTracking === 'impossible' &&
            rawModifiers.trackingCapability.leavesTracks === false
            ? { mundaneTracking: 'impossible' as const, leavesTracks: false as const }
            : undefined,
          environmentalCapabilities: isRecord(rawModifiers.environmentalCapabilities) &&
            Object.keys(rawModifiers.environmentalCapabilities).every((key) =>
              ['breatheIn', 'doesNotNeedAir', 'holdBreathSeconds', 'treatLiquidSurfacesAsSolidGround', 'ignoreDifficultTerrain', 'ignoreDifficultTerrainMaterials',
                'ignoreUnderwaterMovementPenalty', 'ignoreUnderwaterAttackPenalty', 'occupyCreatureSpaces',
                'riseTowardLiquidSurfaceFeetPerRound', 'minimumPassageGapInches'].includes(key)) &&
            (rawModifiers.environmentalCapabilities.doesNotNeedAir == null || rawModifiers.environmentalCapabilities.doesNotNeedAir === true) &&
            (rawModifiers.environmentalCapabilities.holdBreathSeconds == null || (
              Number.isSafeInteger(rawModifiers.environmentalCapabilities.holdBreathSeconds) &&
              Number(rawModifiers.environmentalCapabilities.holdBreathSeconds) >= 1 && Number(rawModifiers.environmentalCapabilities.holdBreathSeconds) <= 86_400)) &&
            (rawModifiers.environmentalCapabilities.breatheIn == null || (
              Array.isArray(rawModifiers.environmentalCapabilities.breatheIn) &&
              rawModifiers.environmentalCapabilities.breatheIn.length === 1 &&
              rawModifiers.environmentalCapabilities.breatheIn[0] === 'water')) &&
            (rawModifiers.environmentalCapabilities.treatLiquidSurfacesAsSolidGround == null ||
              rawModifiers.environmentalCapabilities.treatLiquidSurfacesAsSolidGround === true) &&
            (rawModifiers.environmentalCapabilities.ignoreDifficultTerrainMaterials == null ||
              validMapSurfaceMaterials(rawModifiers.environmentalCapabilities.ignoreDifficultTerrainMaterials)) &&
            (rawModifiers.environmentalCapabilities.ignoreDifficultTerrain == null ||
              rawModifiers.environmentalCapabilities.ignoreDifficultTerrain === true) &&
            (rawModifiers.environmentalCapabilities.ignoreUnderwaterMovementPenalty == null ||
              rawModifiers.environmentalCapabilities.ignoreUnderwaterMovementPenalty === true) &&
            (rawModifiers.environmentalCapabilities.ignoreUnderwaterAttackPenalty == null ||
              rawModifiers.environmentalCapabilities.ignoreUnderwaterAttackPenalty === true) &&
            (rawModifiers.environmentalCapabilities.occupyCreatureSpaces == null ||
              rawModifiers.environmentalCapabilities.occupyCreatureSpaces === true) &&
            (rawModifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound == null || (
              Number.isInteger(rawModifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound) &&
              Number(rawModifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound) >= 1 &&
              Number(rawModifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound) <= 1_000)) &&
            (rawModifiers.environmentalCapabilities.minimumPassageGapInches == null || (
              typeof rawModifiers.environmentalCapabilities.minimumPassageGapInches === 'number' &&
              Number.isInteger(rawModifiers.environmentalCapabilities.minimumPassageGapInches) &&
              rawModifiers.environmentalCapabilities.minimumPassageGapInches >= 1 &&
              rawModifiers.environmentalCapabilities.minimumPassageGapInches <= 120)) &&
            Object.values(rawModifiers.environmentalCapabilities).some((value) => value != null)
            ? {
                doesNotNeedAir: rawModifiers.environmentalCapabilities.doesNotNeedAir === true ? true as const : undefined,
                holdBreathSeconds: typeof rawModifiers.environmentalCapabilities.holdBreathSeconds === 'number' ? rawModifiers.environmentalCapabilities.holdBreathSeconds : undefined,
                breatheIn: Array.isArray(rawModifiers.environmentalCapabilities.breatheIn)
                  ? ['water' as const]
                  : undefined,
                treatLiquidSurfacesAsSolidGround:
                  rawModifiers.environmentalCapabilities.treatLiquidSurfacesAsSolidGround === true
                    ? true as const
                    : undefined,
                ignoreDifficultTerrainMaterials: validMapSurfaceMaterials(rawModifiers.environmentalCapabilities.ignoreDifficultTerrainMaterials)
                  ? [...rawModifiers.environmentalCapabilities.ignoreDifficultTerrainMaterials] : undefined,
                ignoreDifficultTerrain:
                  rawModifiers.environmentalCapabilities.ignoreDifficultTerrain === true ? true as const : undefined,
                ignoreUnderwaterMovementPenalty:
                  rawModifiers.environmentalCapabilities.ignoreUnderwaterMovementPenalty === true ? true as const : undefined,
                ignoreUnderwaterAttackPenalty:
                  rawModifiers.environmentalCapabilities.ignoreUnderwaterAttackPenalty === true ? true as const : undefined,
                occupyCreatureSpaces:
                  rawModifiers.environmentalCapabilities.occupyCreatureSpaces === true ? true as const : undefined,
                riseTowardLiquidSurfaceFeetPerRound:
                  typeof rawModifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound === 'number'
                    ? rawModifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound
                    : undefined,
                minimumPassageGapInches:
                  typeof rawModifiers.environmentalCapabilities.minimumPassageGapInches === 'number'
                    ? rawModifiers.environmentalCapabilities.minimumPassageGapInches
                    : undefined,
              }
            : undefined,
          emittedLight: isRecord(rawModifiers.emittedLight) &&
            Object.keys(rawModifiers.emittedLight).every((key) =>
              ['brightRadiusFeet', 'dimRadiusFeet', 'color', 'sunlight'].includes(key)) &&
            typeof rawModifiers.emittedLight.brightRadiusFeet === 'number' &&
            Number.isInteger(rawModifiers.emittedLight.brightRadiusFeet) &&
            rawModifiers.emittedLight.brightRadiusFeet >= 0 &&
            rawModifiers.emittedLight.brightRadiusFeet <= 10_000 &&
            typeof rawModifiers.emittedLight.dimRadiusFeet === 'number' &&
            Number.isInteger(rawModifiers.emittedLight.dimRadiusFeet) &&
            rawModifiers.emittedLight.dimRadiusFeet >= 0 &&
            rawModifiers.emittedLight.dimRadiusFeet <= 10_000 &&
            rawModifiers.emittedLight.brightRadiusFeet + rawModifiers.emittedLight.dimRadiusFeet >= 1 &&
            typeof rawModifiers.emittedLight.color === 'string' &&
            /^#[0-9a-f]{6}$/i.test(rawModifiers.emittedLight.color) &&
            (rawModifiers.emittedLight.sunlight == null || rawModifiers.emittedLight.sunlight === true)
            ? {
                brightRadiusFeet: rawModifiers.emittedLight.brightRadiusFeet,
                dimRadiusFeet: rawModifiers.emittedLight.dimRadiusFeet,
                color: rawModifiers.emittedLight.color,
                sunlight: rawModifiers.emittedLight.sunlight === true ? true as const : undefined,
              }
            : undefined,
          forcedFleeFromSource: typeof rawModifiers.forcedFleeFromSource === 'boolean'
            ? rawModifiers.forcedFleeFromSource
            : undefined,
          flySpeedLimitFeet: typeof rawModifiers.flySpeedLimitFeet === 'number' && Number.isFinite(rawModifiers.flySpeedLimitFeet) && rawModifiers.flySpeedLimitFeet >= 0 && rawModifiers.flySpeedLimitFeet <= 1_000 ? rawModifiers.flySpeedLimitFeet : undefined,
          flySpeedFeet: typeof rawModifiers.flySpeedFeet === 'number' &&
            Number.isFinite(rawModifiers.flySpeedFeet) &&
            rawModifiers.flySpeedFeet > 0 &&
            rawModifiers.flySpeedFeet <= 1_000
            ? rawModifiers.flySpeedFeet
            : undefined,
          hoverWhileFlying: rawModifiers.hoverWhileFlying === true ? true : undefined,
          magicallyHeldAloft: rawModifiers.magicallyHeldAloft === true ? true : undefined,
          submerged: rawModifiers.submerged === true ? true as const : undefined,
          jumpDistanceMultiplier: typeof rawModifiers.jumpDistanceMultiplier === 'number' &&
            Number.isFinite(rawModifiers.jumpDistanceMultiplier) &&
            rawModifiers.jumpDistanceMultiplier >= 1 &&
            rawModifiers.jumpDistanceMultiplier <= 10
            ? rawModifiers.jumpDistanceMultiplier
            : undefined,
          sizeRankDelta: rawModifiers.sizeRankDelta === -1 || rawModifiers.sizeRankDelta === 1
            ? rawModifiers.sizeRankDelta as -1 | 1
            : undefined,
          strengthRollMode: rawModifiers.strengthRollMode === 'advantage' ||
            rawModifiers.strengthRollMode === 'disadvantage'
            ? rawModifiers.strengthRollMode as 'advantage' | 'disadvantage'
            : undefined,
          skillCheckBonuses: validSkillCheckBonuses(rawModifiers.skillCheckBonuses) ? rawModifiers.skillCheckBonuses.map(rule => ({ ...rule })) : undefined,
          abilityCheckRules: normalizeDnd5eAbilityCheckRules(rawModifiers.abilityCheckRules),
          abilityCheckAdvantages: Array.isArray(rawModifiers.abilityCheckAdvantages) &&
            rawModifiers.abilityCheckAdvantages.every((entry) => ABILITIES.has(entry as AbilityKey))
            ? [...new Set(rawModifiers.abilityCheckAdvantages)] as AbilityKey[]
            : undefined,
          abilityCheckDisadvantages: Array.isArray(rawModifiers.abilityCheckDisadvantages) &&
            rawModifiers.abilityCheckDisadvantages.every((entry) => ABILITIES.has(entry as AbilityKey))
            ? [...new Set(rawModifiers.abilityCheckDisadvantages)] as AbilityKey[]
            : undefined,
          minimumAbilityCheckD20ByAbility: isRecord(rawModifiers.minimumAbilityCheckD20ByAbility) &&
            Object.entries(rawModifiers.minimumAbilityCheckD20ByAbility).every(([ability, value]) =>
              ABILITIES.has(ability as AbilityKey) &&
              typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20)
            ? { ...rawModifiers.minimumAbilityCheckD20ByAbility } as Partial<Record<AbilityKey, number>>
            : undefined,
          ownTurnAttackActionBonus: Number.isInteger(rawModifiers.ownTurnAttackActionBonus) && Number(rawModifiers.ownTurnAttackActionBonus) >= 1 && Number(rawModifiers.ownTurnAttackActionBonus) <= 10 ? Number(rawModifiers.ownTurnAttackActionBonus) : undefined,
          attackActionMinimum: Number.isInteger(rawModifiers.attackActionMinimum) && Number(rawModifiers.attackActionMinimum) >= 1 && Number(rawModifiers.attackActionMinimum) <= 10 ? Number(rawModifiers.attackActionMinimum) : undefined,
          equipmentProficiencies: validEquipmentProficiencies(rawModifiers.equipmentProficiencies) ? [...new Set(rawModifiers.equipmentProficiencies)] : undefined,
          savingThrowProficiencies: Array.isArray(rawModifiers.savingThrowProficiencies) && rawModifiers.savingThrowProficiencies.length > 0 && rawModifiers.savingThrowProficiencies.every(entry => ['str','dex','con','int','wis','cha'].includes(String(entry)))
            ? [...new Set(rawModifiers.savingThrowProficiencies)] as AbilityKey[] : undefined,
          skillExpertise: Array.isArray(rawModifiers.skillExpertise) && rawModifiers.skillExpertise.length > 0 && rawModifiers.skillExpertise.every(entry => typeof entry === 'string' && EFFECT_SKILLS.some(skill => skill.key === entry))
            ? [...new Set(rawModifiers.skillExpertise)] as string[] : undefined,
          skillCheckAdvantages: Array.isArray(rawModifiers.skillCheckAdvantages) &&
            rawModifiers.skillCheckAdvantages.every((entry) => typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
            ? [...new Set(rawModifiers.skillCheckAdvantages)] as string[]
            : undefined,
          skillCheckDisadvantages: Array.isArray(rawModifiers.skillCheckDisadvantages) &&
            rawModifiers.skillCheckDisadvantages.every((entry) => typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
            ? [...new Set(rawModifiers.skillCheckDisadvantages)] as string[]
            : undefined,
          locationKnownToSource: typeof rawModifiers.locationKnownToSource === 'boolean' ? rawModifiers.locationKnownToSource : undefined,
          perceptionDisadvantageAgainstOthersThanSource:
            typeof rawModifiers.perceptionDisadvantageAgainstOthersThanSource === 'boolean'
              ? rawModifiers.perceptionDisadvantageAgainstOthersThanSource
              : undefined,
          skillCheckBonusAuras: Array.isArray(rawModifiers.skillCheckBonusAuras) &&
            rawModifiers.skillCheckBonusAuras.length > 0 &&
            rawModifiers.skillCheckBonusAuras.every((rawAura) =>
              isRecord(rawAura) &&
              Object.keys(rawAura).every((key) => [
                'skill', 'bonus', 'radiusFeet', 'relation', 'mundaneTracking', 'leavesTracks',
              ].includes(key)) &&
              typeof rawAura.skill === 'string' && EFFECT_SKILLS.some(skill => skill.key === rawAura.skill) &&
              typeof rawAura.bonus === 'number' && Number.isInteger(rawAura.bonus) &&
              rawAura.bonus >= -100 && rawAura.bonus <= 100 &&
              typeof rawAura.radiusFeet === 'number' && Number.isInteger(rawAura.radiusFeet) &&
              rawAura.radiusFeet >= 0 && rawAura.radiusFeet <= 10_000 &&
              rawAura.relation === 'ally-and-self' &&
              ((rawAura.mundaneTracking == null) === (rawAura.leavesTracks == null)) &&
              (rawAura.mundaneTracking == null || rawAura.mundaneTracking === 'impossible') &&
              (rawAura.leavesTracks == null || rawAura.leavesTracks === false))
            ? rawModifiers.skillCheckBonusAuras.map((rawAura) => ({
                skill: (rawAura as { skill: string }).skill,
                bonus: (rawAura as { bonus: number }).bonus,
                radiusFeet: (rawAura as { radiusFeet: number }).radiusFeet,
                relation: 'ally-and-self' as const,
                mundaneTracking: (rawAura as { mundaneTracking?: 'impossible' }).mundaneTracking,
                leavesTracks: (rawAura as { leavesTracks?: false }).leavesTracks,
              }))
            : undefined,
          savingThrowDisadvantages: Array.isArray(rawModifiers.savingThrowDisadvantages) &&
            rawModifiers.savingThrowDisadvantages.every((entry) => ABILITIES.has(entry as AbilityKey))
            ? [...new Set(rawModifiers.savingThrowDisadvantages)] as AbilityKey[]
            : undefined,
          savingThrowAdvantages: Array.isArray(rawModifiers.savingThrowAdvantages) &&
            rawModifiers.savingThrowAdvantages.every((entry) => ABILITIES.has(entry as AbilityKey))
            ? [...new Set(rawModifiers.savingThrowAdvantages)] as AbilityKey[]
            : undefined,
          deathSavingThrowAdvantage: typeof rawModifiers.deathSavingThrowAdvantage === 'boolean'
            ? rawModifiers.deathSavingThrowAdvantage
            : undefined,
          maximizeHealingDiceNearCompanion: normalizeDnd5eOwnedCompanionProximityRules(rawModifiers.maximizeHealingDiceNearCompanion),
          maximizeHealingDice: typeof rawModifiers.maximizeHealingDice === 'boolean'
            ? rawModifiers.maximizeHealingDice
            : undefined,
          attackRollDisadvantageAbilities: Array.isArray(rawModifiers.attackRollDisadvantageAbilities) &&
            rawModifiers.attackRollDisadvantageAbilities.every((entry) => ABILITIES.has(entry as AbilityKey))
            ? [...new Set(rawModifiers.attackRollDisadvantageAbilities)] as AbilityKey[]
            : undefined,
          attackRollAdvantageAbilities: Array.isArray(rawModifiers.attackRollAdvantageAbilities) &&
            rawModifiers.attackRollAdvantageAbilities.every((entry) => ABILITIES.has(entry as AbilityKey))
            ? [...new Set(rawModifiers.attackRollAdvantageAbilities)] as AbilityKey[] : undefined,
          carryingCapacityMultiplier: typeof rawModifiers.carryingCapacityMultiplier === 'number' &&
            Number.isFinite(rawModifiers.carryingCapacityMultiplier) &&
            rawModifiers.carryingCapacityMultiplier >= 1 &&
            rawModifiers.carryingCapacityMultiplier <= 10
            ? rawModifiers.carryingCapacityMultiplier
            : undefined,
          safeFallFeet: typeof rawModifiers.safeFallFeet === 'number' &&
            Number.isFinite(rawModifiers.safeFallFeet) &&
            rawModifiers.safeFallFeet >= 0 &&
            rawModifiers.safeFallFeet <= 1_000
            ? rawModifiers.safeFallFeet
            : undefined,
          controlledDescent: isRecord(rawModifiers.controlledDescent) &&
            Object.keys(rawModifiers.controlledDescent).every((key) => [
              'maximumFeetPerRound', 'safeLanding', 'endsOnLanding', 'forceWhileFlightBlocked',
            ].includes(key)) &&
            typeof rawModifiers.controlledDescent.maximumFeetPerRound === 'number' &&
            Number.isInteger(rawModifiers.controlledDescent.maximumFeetPerRound) &&
            rawModifiers.controlledDescent.maximumFeetPerRound >= 1 &&
            rawModifiers.controlledDescent.maximumFeetPerRound <= 1_000 &&
            rawModifiers.controlledDescent.safeLanding === true &&
            rawModifiers.controlledDescent.endsOnLanding === true &&
            (rawModifiers.controlledDescent.forceWhileFlightBlocked == null || rawModifiers.controlledDescent.forceWhileFlightBlocked === true)
            ? {
                maximumFeetPerRound: rawModifiers.controlledDescent.maximumFeetPerRound,
                safeLanding: true as const,
                endsOnLanding: true as const,
                ...(rawModifiers.controlledDescent.forceWhileFlightBlocked === true ? { forceWhileFlightBlocked: true as const } : {}),
              }
            : undefined,
          automaticEscape: isRecord(rawModifiers.automaticEscape) &&
            Object.keys(rawModifiers.automaticEscape).every((key) => [
              'conditions', 'movementCostFeet', 'sourceMagical',
            ].includes(key)) &&
            Array.isArray(rawModifiers.automaticEscape.conditions) &&
            rawModifiers.automaticEscape.conditions.length > 0 &&
            rawModifiers.automaticEscape.conditions.length <= 2 &&
            rawModifiers.automaticEscape.conditions.every((condition) =>
              condition === 'grappled' || condition === 'restrained') &&
            typeof rawModifiers.automaticEscape.movementCostFeet === 'number' &&
            Number.isInteger(rawModifiers.automaticEscape.movementCostFeet) &&
            rawModifiers.automaticEscape.movementCostFeet >= 0 &&
            rawModifiers.automaticEscape.movementCostFeet <= 1_000 &&
            (rawModifiers.automaticEscape.sourceMagical == null ||
              typeof rawModifiers.automaticEscape.sourceMagical === 'boolean')
            ? {
                conditions: [...new Set(rawModifiers.automaticEscape.conditions)] as ('grappled' | 'restrained')[],
                movementCostFeet: rawModifiers.automaticEscape.movementCostFeet,
                sourceMagical: rawModifiers.automaticEscape.sourceMagical as boolean | undefined,
              }
            : undefined,
          ignoreMagicalSpeedReductions: rawModifiers.ignoreMagicalSpeedReductions === true
            ? true
            : undefined,
          onHitBonusDamage: isRecord(rawModifiers.onHitBonusDamage) &&
            Object.keys(rawModifiers.onHitBonusDamage).every((key) => [
              'count', 'sides', 'bonus', 'damageType', 'appliesTo', 'weaponId',
              'doubleDiceOnCritical', 'oncePerTurn', 'targetCreatureTypes', 'onHitTargetEffect',
              'lastUsedTurnKey', 'consumeEffectOnHit', 'useWeaponDie', 'boundTargetId', 'attackDamageTypeOverride',
            ].includes(key)) &&
            (rawModifiers.onHitBonusDamage.boundTargetId === undefined ||
              (typeof rawModifiers.onHitBonusDamage.boundTargetId === 'string' && rawModifiers.onHitBonusDamage.boundTargetId.trim().length > 0)) &&
            (rawModifiers.onHitBonusDamage.attackDamageTypeOverride === undefined ||
              (DND5E_DAMAGE_TYPES.includes(rawModifiers.onHitBonusDamage.attackDamageTypeOverride as Dnd5eDamageType) &&
                typeof rawModifiers.onHitBonusDamage.boundTargetId === 'string' && rawModifiers.onHitBonusDamage.consumeEffectOnHit === true)) &&
            (rawModifiers.onHitBonusDamage.useWeaponDie === undefined ||
              (rawModifiers.onHitBonusDamage.useWeaponDie === true && rawModifiers.onHitBonusDamage.sides === 2 && Number(rawModifiers.onHitBonusDamage.count) >= 1)) &&
            typeof rawModifiers.onHitBonusDamage.count === 'number' &&
            Number.isInteger(rawModifiers.onHitBonusDamage.count) &&
            rawModifiers.onHitBonusDamage.count >= 0 &&
            rawModifiers.onHitBonusDamage.count <= 1_000 &&
            typeof rawModifiers.onHitBonusDamage.sides === 'number' &&
            Number.isInteger(rawModifiers.onHitBonusDamage.sides) &&
            rawModifiers.onHitBonusDamage.sides >= 2 &&
            rawModifiers.onHitBonusDamage.sides <= 10_000 &&
            typeof rawModifiers.onHitBonusDamage.bonus === 'number' &&
            Number.isInteger(rawModifiers.onHitBonusDamage.bonus) &&
            Math.abs(rawModifiers.onHitBonusDamage.bonus) <= 1_000_000 &&
            (rawModifiers.onHitBonusDamage.damageType === 'inherit-primary' ||
              DND5E_DAMAGE_TYPES.includes(rawModifiers.onHitBonusDamage.damageType as Dnd5eDamageType)) &&
            (rawModifiers.onHitBonusDamage.appliesTo === 'this-weapon' ||
              rawModifiers.onHitBonusDamage.appliesTo === 'all-weapon-attacks') &&
            (rawModifiers.onHitBonusDamage.weaponId == null ||
              typeof rawModifiers.onHitBonusDamage.weaponId === 'string') &&
            typeof rawModifiers.onHitBonusDamage.doubleDiceOnCritical === 'boolean' &&
            typeof rawModifiers.onHitBonusDamage.oncePerTurn === 'boolean' &&
            (rawModifiers.onHitBonusDamage.targetCreatureTypes == null || (
              Array.isArray(rawModifiers.onHitBonusDamage.targetCreatureTypes) &&
              rawModifiers.onHitBonusDamage.targetCreatureTypes.every((entry) => typeof entry === 'string')
            )) &&
            (rawModifiers.onHitBonusDamage.onHitTargetEffect == null || (
              isRecord(rawModifiers.onHitBonusDamage.onHitTargetEffect) &&
              Object.keys(rawModifiers.onHitBonusDamage.onHitTargetEffect).every((key) =>
                ['revealInvisible', 'preventInvisibility', 'emittedLight'].includes(key)) &&
              (rawModifiers.onHitBonusDamage.onHitTargetEffect.revealInvisible == null ||
                rawModifiers.onHitBonusDamage.onHitTargetEffect.revealInvisible === true) &&
              (rawModifiers.onHitBonusDamage.onHitTargetEffect.preventInvisibility == null ||
                rawModifiers.onHitBonusDamage.onHitTargetEffect.preventInvisibility === true) &&
              (rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight == null || (
                isRecord(rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight) &&
                typeof rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet === 'number' &&
                Number.isInteger(rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet) &&
                rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet >= 0 &&
                rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet <= 10_000 &&
                typeof rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet === 'number' &&
                Number.isInteger(rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet) &&
                rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet >= 0 &&
                rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet <= 10_000 &&
                rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet +
                  rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet >= 1 &&
                typeof rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.color === 'string' &&
                /^#[0-9a-f]{6}$/i.test(rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.color)
              ))
            )) &&
            (rawModifiers.onHitBonusDamage.lastUsedTurnKey == null ||
              typeof rawModifiers.onHitBonusDamage.lastUsedTurnKey === 'string') &&
            typeof rawModifiers.onHitBonusDamage.consumeEffectOnHit === 'boolean'
            ? {
                ...(rawModifiers.onHitBonusDamage.useWeaponDie === true ? { useWeaponDie: true as const } : {}),
                ...(typeof rawModifiers.onHitBonusDamage.boundTargetId === 'string' ? { boundTargetId: rawModifiers.onHitBonusDamage.boundTargetId } : {}),
                ...(rawModifiers.onHitBonusDamage.attackDamageTypeOverride ? { attackDamageTypeOverride: rawModifiers.onHitBonusDamage.attackDamageTypeOverride as Dnd5eDamageType } : {}),
                count: rawModifiers.onHitBonusDamage.count,
                sides: rawModifiers.onHitBonusDamage.sides,
                bonus: rawModifiers.onHitBonusDamage.bonus,
                damageType: rawModifiers.onHitBonusDamage.damageType as Dnd5eDamageType | 'inherit-primary',
                appliesTo: rawModifiers.onHitBonusDamage.appliesTo as 'this-weapon' | 'all-weapon-attacks',
                weaponId: typeof rawModifiers.onHitBonusDamage.weaponId === 'string'
                  ? rawModifiers.onHitBonusDamage.weaponId
                  : undefined,
                doubleDiceOnCritical: rawModifiers.onHitBonusDamage.doubleDiceOnCritical,
                oncePerTurn: rawModifiers.onHitBonusDamage.oncePerTurn,
                targetCreatureTypes: Array.isArray(rawModifiers.onHitBonusDamage.targetCreatureTypes)
                  ? [...rawModifiers.onHitBonusDamage.targetCreatureTypes] as string[]
                  : undefined,
                onHitTargetEffect: isRecord(rawModifiers.onHitBonusDamage.onHitTargetEffect)
                  ? {
                      revealInvisible: rawModifiers.onHitBonusDamage.onHitTargetEffect.revealInvisible === true
                        ? true as const
                        : undefined,
                      preventInvisibility: rawModifiers.onHitBonusDamage.onHitTargetEffect.preventInvisibility === true
                        ? true as const
                        : undefined,
                      emittedLight: isRecord(rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight)
                        ? {
                            brightRadiusFeet: rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet as number,
                            dimRadiusFeet: rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet as number,
                            color: rawModifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.color as string,
                          }
                        : undefined,
                    }
                  : undefined,
                lastUsedTurnKey: typeof rawModifiers.onHitBonusDamage.lastUsedTurnKey === 'string'
                  ? rawModifiers.onHitBonusDamage.lastUsedTurnKey
                  : undefined,
                consumeEffectOnHit: rawModifiers.onHitBonusDamage.consumeEffectOnHit,
              }
            : undefined,
          hitPointMaximumBonus: typeof rawModifiers.hitPointMaximumBonus === 'number' &&
            Number.isFinite(rawModifiers.hitPointMaximumBonus) &&
            rawModifiers.hitPointMaximumBonus >= 0 &&
            rawModifiers.hitPointMaximumBonus <= 1_000_000
            ? rawModifiers.hitPointMaximumBonus
            : undefined,
          increaseCurrentHitPointsWithMaximum:
            typeof rawModifiers.increaseCurrentHitPointsWithMaximum === 'boolean'
              ? rawModifiers.increaseCurrentHitPointsWithMaximum
              : undefined,
          armorClassBonus: typeof rawModifiers.armorClassBonus === 'number' &&
            Number.isFinite(rawModifiers.armorClassBonus) &&
            rawModifiers.armorClassBonus >= -20 &&
            rawModifiers.armorClassBonus <= 20
            ? rawModifiers.armorClassBonus
            : undefined,
          cohortArmorClass: normalizeDnd5eCohortArmorClass(rawModifiers.cohortArmorClass),
          sourceProximityAttackAdvantage: validDnd5eSourceProximityAttack(rawModifiers.sourceProximityAttackAdvantage)
            ? { ...rawModifiers.sourceProximityAttackAdvantage } : undefined,
          attacksAgainstSourceArmorClassBonus:
            typeof rawModifiers.attacksAgainstSourceArmorClassBonus === 'number' &&
            Number.isInteger(rawModifiers.attacksAgainstSourceArmorClassBonus) &&
            rawModifiers.attacksAgainstSourceArmorClassBonus >= -20 &&
            rawModifiers.attacksAgainstSourceArmorClassBonus <= 20
              ? rawModifiers.attacksAgainstSourceArmorClassBonus
              : undefined,
          savingThrowBonus: typeof rawModifiers.savingThrowBonus === 'number' &&
            Number.isFinite(rawModifiers.savingThrowBonus) &&
            rawModifiers.savingThrowBonus >= -20 &&
            rawModifiers.savingThrowBonus <= 20
            ? rawModifiers.savingThrowBonus
            : undefined,
          savingThrowBonusByAbility: typeof rawModifiers.savingThrowBonusByAbility === 'object' &&
            rawModifiers.savingThrowBonusByAbility != null &&
            !Array.isArray(rawModifiers.savingThrowBonusByAbility) &&
            Object.entries(rawModifiers.savingThrowBonusByAbility).every(([ability, value]) =>
              ABILITIES.has(ability as AbilityKey) &&
              typeof value === 'number' &&
              Number.isFinite(value) &&
              value >= -20 &&
              value <= 20
            )
            ? { ...rawModifiers.savingThrowBonusByAbility } as Partial<Record<AbilityKey, number>>
            : undefined,
          rollDiceModifiers: normalizeDnd5eRollDiceModifiers(rawModifiers.rollDiceModifiers),
          optionalBonusDie: isRecord(rawModifiers.optionalBonusDie) &&
            OPTIONAL_BONUS_DIE_SIDES.has(rawModifiers.optionalBonusDie.sides as number) &&
            Array.isArray(rawModifiers.optionalBonusDie.appliesTo) &&
            rawModifiers.optionalBonusDie.appliesTo.length > 0 &&
            rawModifiers.optionalBonusDie.appliesTo.every((entry) =>
              OPTIONAL_BONUS_DIE_ROLL_KINDS.has(entry as Dnd5eOptionalBonusDieRollKind)
            ) &&
            typeof rawModifiers.optionalBonusDie.consumeOnUse === 'boolean' &&
            (rawModifiers.optionalBonusDie.boundTargetSource === undefined ||
              validDnd5eOptionalBonusDieSourceConstraint(rawModifiers.optionalBonusDie.boundTargetSource))
            ? {
                sides: rawModifiers.optionalBonusDie.sides as Dnd5eActiveEffectOptionalBonusDie['sides'],
                appliesTo: [...new Set(rawModifiers.optionalBonusDie.appliesTo)] as Dnd5eOptionalBonusDieRollKind[],
                consumeOnUse: rawModifiers.optionalBonusDie.consumeOnUse,
                ...(rawModifiers.optionalBonusDie.boundTargetSource ? {
                  boundTargetSource: { ...rawModifiers.optionalBonusDie.boundTargetSource as Dnd5eOptionalBonusDieSourceConstraint },
                } : {}),
              }
            : undefined,
          attackRollAdvantage: typeof rawModifiers.attackRollAdvantage === 'boolean'
            ? rawModifiers.attackRollAdvantage
            : undefined,
          weaponCategoryRollModes: validWeaponCategoryRollModes(rawModifiers.weaponCategoryRollModes) ? rawModifiers.weaponCategoryRollModes.map(rule => ({ ...rule, categories: [...rule.categories] })) : undefined,
          weaponAttackRollAdvantage: typeof rawModifiers.weaponAttackRollAdvantage === 'boolean' ? rawModifiers.weaponAttackRollAdvantage : undefined,
          weaponAttackRollDisadvantage: typeof rawModifiers.weaponAttackRollDisadvantage === 'boolean' ? rawModifiers.weaponAttackRollDisadvantage : undefined,
          attackRollDisadvantage: typeof rawModifiers.attackRollDisadvantage === 'boolean'
            ? rawModifiers.attackRollDisadvantage
            : undefined,
          attacksAgainstTargetAdvantage: typeof rawModifiers.attacksAgainstTargetAdvantage === 'boolean'
            ? rawModifiers.attacksAgainstTargetAdvantage
            : undefined,
          attacksAgainstTargetDisadvantage: typeof rawModifiers.attacksAgainstTargetDisadvantage === 'boolean'
            ? rawModifiers.attacksAgainstTargetDisadvantage
            : undefined,
          weaponAttacksAgainstTarget: normalizeDnd5eIncomingWeaponAttackModifiers(rawModifiers.weaponAttacksAgainstTarget),
          attacksAgainstTargetDisadvantageCreatureTypes:
            Array.isArray(rawModifiers.attacksAgainstTargetDisadvantageCreatureTypes) &&
            rawModifiers.attacksAgainstTargetDisadvantageCreatureTypes.length > 0 &&
            rawModifiers.attacksAgainstTargetDisadvantageCreatureTypes.length <= 32 &&
            rawModifiers.attacksAgainstTargetDisadvantageCreatureTypes.every((entry) =>
              typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
              ? [...new Set(rawModifiers.attacksAgainstTargetDisadvantageCreatureTypes)] as string[]
              : undefined,
          speedAfterOwnTurnWeaponAttackActionOnly: rawModifiers.speedAfterOwnTurnWeaponAttackActionOnly === true ? true : undefined,
          walkingSpeedBonusFeet: typeof rawModifiers.walkingSpeedBonusFeet === 'number' && Number.isInteger(rawModifiers.walkingSpeedBonusFeet) && rawModifiers.walkingSpeedBonusFeet >= 1 && rawModifiers.walkingSpeedBonusFeet <= 1000 ? rawModifiers.walkingSpeedBonusFeet : undefined,
          speedAfterOwnTurnWeaponAttackFeet: typeof rawModifiers.speedAfterOwnTurnWeaponAttackFeet === 'number' &&
            Number.isInteger(rawModifiers.speedAfterOwnTurnWeaponAttackFeet) && rawModifiers.speedAfterOwnTurnWeaponAttackFeet >= 1 && rawModifiers.speedAfterOwnTurnWeaponAttackFeet <= 1000
            ? rawModifiers.speedAfterOwnTurnWeaponAttackFeet : undefined,
          preventMovementOpportunityAttacks: typeof rawModifiers.preventMovementOpportunityAttacks === 'boolean'
            ? rawModifiers.preventMovementOpportunityAttacks : undefined,
          damageRollsBySourceBonus: typeof rawModifiers.damageRollsBySourceBonus === 'number' && Number.isInteger(rawModifiers.damageRollsBySourceBonus) && Math.abs(rawModifiers.damageRollsBySourceBonus) <= 1000 ? rawModifiers.damageRollsBySourceBonus : undefined,
          attacksBySourceCriticalThreshold: typeof rawModifiers.attacksBySourceCriticalThreshold === 'number' &&
            Number.isInteger(rawModifiers.attacksBySourceCriticalThreshold) && rawModifiers.attacksBySourceCriticalThreshold >= 2 && rawModifiers.attacksBySourceCriticalThreshold <= 20
            ? rawModifiers.attacksBySourceCriticalThreshold : undefined,
          preventsRevival: typeof rawModifiers.preventsRevival === 'boolean' ? rawModifiers.preventsRevival : undefined,
          nextD20AdvantageRollKinds: Array.isArray(rawModifiers.nextD20AdvantageRollKinds) && rawModifiers.nextD20AdvantageRollKinds.length > 0 &&
            rawModifiers.nextD20AdvantageRollKinds.every(kind => ['attack', 'ability-check', 'saving-throw'].includes(kind))
            ? [...new Set(rawModifiers.nextD20AdvantageRollKinds)] as ('attack' | 'ability-check' | 'saving-throw')[] : undefined,
          cannotBeSurprisedWhileConscious: typeof rawModifiers.cannotBeSurprisedWhileConscious === 'boolean'
            ? rawModifiers.cannotBeSurprisedWhileConscious
            : undefined,
          randomVisibleCreatureTargets: typeof rawModifiers.randomVisibleCreatureTargets === 'boolean'
            ? rawModifiers.randomVisibleCreatureTargets : undefined,
          mandatoryOpportunityAttacks: typeof rawModifiers.mandatoryOpportunityAttacks === 'boolean'
            ? rawModifiers.mandatoryOpportunityAttacks : undefined,
          perceiveVisibleCreaturesAsHostile: typeof rawModifiers.perceiveVisibleCreaturesAsHostile === 'boolean'
            ? rawModifiers.perceiveVisibleCreaturesAsHostile : undefined,
          attackDisadvantageAgainstOthersThanSource:
            typeof rawModifiers.attackDisadvantageAgainstOthersThanSource === 'boolean'
              ? rawModifiers.attackDisadvantageAgainstOthersThanSource
              : undefined,
          nextAttackAdvantageByOtherThanSource:
            typeof rawModifiers.nextAttackAdvantageByOtherThanSource === 'boolean'
              ? rawModifiers.nextAttackAdvantageByOtherThanSource
              : undefined,
          notifySourceOnBearerDamage: rawModifiers.notifySourceOnBearerDamage === true ? true as const : undefined,
          attackDisadvantageAgainstOthersThanSourceRangeFeet:
            typeof rawModifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet === 'number' &&
            Number.isFinite(rawModifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet) &&
            rawModifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet >= 0 &&
            rawModifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet <= 10000
              ? rawModifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet : undefined,
          resistanceToAllDamage: typeof rawModifiers.resistanceToAllDamage === 'boolean'
            ? rawModifiers.resistanceToAllDamage
            : undefined,
          nextSourceOrAllyAttackVulnerability: typeof rawModifiers.nextSourceOrAllyAttackVulnerability === 'boolean'
            ? rawModifiers.nextSourceOrAllyAttackVulnerability : undefined,
          vulnerabilityToAllDamage: typeof rawModifiers.vulnerabilityToAllDamage === 'boolean'
            ? rawModifiers.vulnerabilityToAllDamage
            : undefined,
          weaponDamageD4: rawModifiers.weaponDamageD4 === 'add' ||
            rawModifiers.weaponDamageD4 === 'subtract'
            ? rawModifiers.weaponDamageD4 as 'add' | 'subtract'
            : undefined,
          weaponDamageReplacementAttackModes:
            Array.isArray(rawModifiers.weaponDamageReplacementAttackModes) &&
            rawModifiers.weaponDamageReplacementAttackModes.length > 0 &&
            rawModifiers.weaponDamageReplacementAttackModes.length <= 2 &&
            rawModifiers.weaponDamageReplacementAttackModes.every((mode) => mode === 'melee' || mode === 'ranged') &&
            new Set(rawModifiers.weaponDamageReplacementAttackModes).size === rawModifiers.weaponDamageReplacementAttackModes.length
              ? [...rawModifiers.weaponDamageReplacementAttackModes] as ('melee' | 'ranged')[]
              : undefined,
          movementBoundarySave: isRecord(rawModifiers.movementBoundarySave) &&
            typeof rawModifiers.movementBoundarySave.maximumDistanceFeet === 'number' &&
            Number.isFinite(rawModifiers.movementBoundarySave.maximumDistanceFeet) &&
            rawModifiers.movementBoundarySave.maximumDistanceFeet >= 0 &&
            rawModifiers.movementBoundarySave.maximumDistanceFeet <= 10_000 &&
            ABILITIES.has(rawModifiers.movementBoundarySave.ability as AbilityKey) &&
            typeof rawModifiers.movementBoundarySave.dc === 'number' &&
            Number.isInteger(rawModifiers.movementBoundarySave.dc) &&
            rawModifiers.movementBoundarySave.dc >= 1 &&
            rawModifiers.movementBoundarySave.dc <= 100
            ? {
                maximumDistanceFeet: rawModifiers.movementBoundarySave.maximumDistanceFeet,
                ability: rawModifiers.movementBoundarySave.ability as AbilityKey,
                dc: rawModifiers.movementBoundarySave.dc,
              }
            : undefined,
          preventReactions: typeof rawModifiers.preventReactions === 'boolean'
            ? rawModifiers.preventReactions
            : undefined,
          preventHealing: typeof rawModifiers.preventHealing === 'boolean'
            ? rawModifiers.preventHealing
            : undefined,
          preventNonmagicalHealing:
            typeof rawModifiers.preventNonmagicalHealing === 'boolean'
              ? rawModifiers.preventNonmagicalHealing
              : undefined,
          suppressDamageResistance: (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawModifiers.suppressDamageResistance)
            ? rawModifiers.suppressDamageResistance as Dnd5eDamageType : undefined,
          damageResistance: (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawModifiers.damageResistance)
            ? rawModifiers.damageResistance as Dnd5eDamageType
            : undefined,
          conditionalDamageResistances: Array.isArray(rawModifiers.conditionalDamageResistances) &&
            rawModifiers.conditionalDamageResistances.length > 0 &&
            rawModifiers.conditionalDamageResistances.every((rawRule) =>
              isRecord(rawRule) &&
              Object.keys(rawRule).every((key) => ['damageTypes', 'sourceMagical', 'attackOnly', 'deliveries', 'sourceAura'].includes(key)) &&
              Array.isArray(rawRule.damageTypes) && rawRule.damageTypes.length > 0 &&
              rawRule.damageTypes.every((entry) => DND5E_DAMAGE_TYPES.includes(entry as Dnd5eDamageType)) &&
              (rawRule.sourceMagical == null || typeof rawRule.sourceMagical === 'boolean') &&
              (rawRule.attackOnly == null || typeof rawRule.attackOnly === 'boolean') &&
              (rawRule.sourceAura == null || isDnd5eSourceAuraRequirement(rawRule.sourceAura)) &&
              (rawRule.deliveries == null || (
                Array.isArray(rawRule.deliveries) && rawRule.deliveries.length > 0 &&
                rawRule.deliveries.every((entry) => ['weapon-attack', 'spell', 'other'].includes(String(entry)))
              )))
            ? rawModifiers.conditionalDamageResistances.map((rawRule) => ({
                sourceAura: isDnd5eSourceAuraRequirement((rawRule as Record<string, unknown>).sourceAura) ? { ...(rawRule as { sourceAura: Dnd5eSourceAuraRequirement }).sourceAura } : undefined,
                damageTypes: [...new Set((rawRule as { damageTypes: Dnd5eDamageType[] }).damageTypes)],
                sourceMagical: (rawRule as { sourceMagical?: boolean }).sourceMagical,
                attackOnly: (rawRule as { attackOnly?: boolean }).attackOnly,
                deliveries: (rawRule as { deliveries?: ('weapon-attack' | 'spell' | 'other')[] }).deliveries
                  ? [...new Set((rawRule as { deliveries: ('weapon-attack' | 'spell' | 'other')[] }).deliveries)]
                  : undefined,
              }))
            : undefined,
          weaponDamageMultipliers: Array.isArray(rawModifiers.weaponDamageMultipliers) &&
            rawModifiers.weaponDamageMultipliers.length > 0 &&
            rawModifiers.weaponDamageMultipliers.every((rawRule) =>
              isRecord(rawRule) &&
              Object.keys(rawRule).every((key) => ['multiplier', 'ability', 'attackModes'].includes(key)) &&
              typeof rawRule.multiplier === 'number' && Number.isFinite(rawRule.multiplier) &&
              rawRule.multiplier >= 0 && rawRule.multiplier <= 10 &&
              (rawRule.ability == null || rawRule.ability === 'str' || rawRule.ability === 'dex') &&
              (rawRule.attackModes == null || (
                Array.isArray(rawRule.attackModes) && rawRule.attackModes.length > 0 &&
                rawRule.attackModes.every((entry) => entry === 'melee' || entry === 'ranged')
              )))
            ? rawModifiers.weaponDamageMultipliers.map((rawRule) => ({
                multiplier: (rawRule as { multiplier: number }).multiplier,
                ability: (rawRule as { ability?: 'str' | 'dex' }).ability,
                attackModes: (rawRule as { attackModes?: ('melee' | 'ranged')[] }).attackModes
                  ? [...new Set((rawRule as { attackModes: ('melee' | 'ranged')[] }).attackModes)]
                  : undefined,
              }))
            : undefined,
          damageImmunity: (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawModifiers.damageImmunity)
            ? rawModifiers.damageImmunity as Dnd5eDamageType
            : undefined,
          damageVulnerability: (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawModifiers.damageVulnerability)
            ? rawModifiers.damageVulnerability as Dnd5eDamageType
            : undefined,
          conditionImmunities: Array.isArray(rawModifiers.conditionImmunities) &&
            rawModifiers.conditionImmunities.every((entry) =>
              (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(entry),
            )
            ? [...new Set(rawModifiers.conditionImmunities)] as Dnd5eStandardConditionId[]
            : undefined,
          conditionImmunitiesBySourceCreatureType:
            Array.isArray(rawModifiers.conditionImmunitiesBySourceCreatureType) &&
            rawModifiers.conditionImmunitiesBySourceCreatureType.length > 0 &&
            rawModifiers.conditionImmunitiesBySourceCreatureType.length <= 32 &&
            rawModifiers.conditionImmunitiesBySourceCreatureType.every((rawRule) =>
              isRecord(rawRule) &&
              Object.keys(rawRule).every((key) => ['conditions', 'sourceCreatureTypes'].includes(key)) &&
              Array.isArray(rawRule.conditions) && rawRule.conditions.length > 0 &&
              rawRule.conditions.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry)) &&
              Array.isArray(rawRule.sourceCreatureTypes) && rawRule.sourceCreatureTypes.length > 0 &&
              rawRule.sourceCreatureTypes.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
            )
              ? rawModifiers.conditionImmunitiesBySourceCreatureType.map((rawRule) => ({
                  conditions: [...new Set((rawRule as { conditions: string[] }).conditions)],
                  sourceCreatureTypes: [...new Set((rawRule as { sourceCreatureTypes: string[] }).sourceCreatureTypes)],
                }))
              : undefined,
          conditionImmunitiesBySourceMagic:
            Array.isArray(rawModifiers.conditionImmunitiesBySourceMagic) &&
            rawModifiers.conditionImmunitiesBySourceMagic.length > 0 &&
            rawModifiers.conditionImmunitiesBySourceMagic.length <= 32 &&
            rawModifiers.conditionImmunitiesBySourceMagic.every((rawRule) =>
              isRecord(rawRule) &&
              Object.keys(rawRule).every((key) => ['conditions', 'sourceMagical', 'suppressExisting'].includes(key)) &&
              Array.isArray(rawRule.conditions) && rawRule.conditions.length > 0 &&
              rawRule.conditions.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry)) &&
              typeof rawRule.sourceMagical === 'boolean' &&
              (rawRule.suppressExisting == null || rawRule.suppressExisting === true)
            )
              ? rawModifiers.conditionImmunitiesBySourceMagic.map((rawRule) => ({
                  conditions: [...new Set((rawRule as { conditions: string[] }).conditions)],
                  sourceMagical: (rawRule as { sourceMagical: boolean }).sourceMagical,
                  suppressExisting: (rawRule as { suppressExisting?: true }).suppressExisting,
                }))
              : undefined,
          calmEmotionsIndifferentTargetIds:
            Array.isArray(rawModifiers.calmEmotionsIndifferentTargetIds) &&
            rawModifiers.calmEmotionsIndifferentTargetIds.length > 0 &&
            rawModifiers.calmEmotionsIndifferentTargetIds.length <= 100 &&
            rawModifiers.calmEmotionsIndifferentTargetIds.every((entry) =>
              typeof entry === 'string' && entry.trim().length > 0 && entry.length <= 240)
              ? [...new Set(rawModifiers.calmEmotionsIndifferentTargetIds.map((entry) => entry.trim()))]
              : undefined,
          savingThrowAdvantagesBySourceCreatureType:
            Array.isArray(rawModifiers.savingThrowAdvantagesBySourceCreatureType) &&
            rawModifiers.savingThrowAdvantagesBySourceCreatureType.length > 0 &&
            rawModifiers.savingThrowAdvantagesBySourceCreatureType.length <= 32 &&
            rawModifiers.savingThrowAdvantagesBySourceCreatureType.every((rawRule) =>
              isRecord(rawRule) &&
              Object.keys(rawRule).every((key) => ['conditions', 'sourceCreatureTypes'].includes(key)) &&
              Array.isArray(rawRule.conditions) && rawRule.conditions.length > 0 &&
              rawRule.conditions.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry)) &&
              Array.isArray(rawRule.sourceCreatureTypes) && rawRule.sourceCreatureTypes.length > 0 &&
              rawRule.sourceCreatureTypes.every((entry) =>
                typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
            )
              ? rawModifiers.savingThrowAdvantagesBySourceCreatureType.map((rawRule) => ({
                  conditions: [...new Set((rawRule as { conditions: string[] }).conditions)],
                  sourceCreatureTypes: [...new Set((rawRule as { sourceCreatureTypes: string[] }).sourceCreatureTypes)],
                }))
              : undefined,
          attackProfiles: attackProfiles?.length ? attackProfiles : undefined,
          shillelagh,
          magicWeapon,
          armorEnchantment,
          weaponEnchantment,
        }
      : undefined
    const dependsOnEffectId = typeof candidate.dependsOnEffectId === 'string' &&
      candidate.dependsOnEffectId.trim().length > 0 &&
      candidate.dependsOnEffectId.length <= 320 &&
      candidate.dependsOnEffectId.trim() !== candidate.id.trim()
      ? candidate.dependsOnEffectId.trim()
      : undefined
    const suspendedBy = Array.isArray(candidate.suspendedBy) &&
      candidate.suspendedBy.length > 0 &&
      candidate.suspendedBy.every((entry) =>
        typeof entry === 'string' &&
        entry.trim().length > 0 &&
        entry.length <= 200
      )
      ? [...new Set(candidate.suspendedBy.map((entry) => entry.trim()))]
      : undefined
    const persistAfterConcentrationCompletes = candidate.persistAfterConcentrationCompletes === true
      ? true
      : undefined
    const grantedActivities = Array.isArray(candidate.grantedActivities) &&
      candidate.grantedActivities.length > 0 && candidate.grantedActivities.length <= 32 &&
      candidate.grantedActivities.every((entry) =>
        typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(entry))
      ? [...new Set(candidate.grantedActivities)] as string[]
      : undefined
    if (candidate.grantedActivities != null && grantedActivities == null) continue
    if (candidate.grantedActivitiesSingleUse != null && (candidate.grantedActivitiesSingleUse !== true || !grantedActivities?.length)) continue
    const grantedActivityCharges = candidate.grantedActivityCharges == null ? undefined : normalizeDnd5eEffectGrantCharges(candidate.grantedActivityCharges)
    if (candidate.grantedActivityCharges != null && (!grantedActivityCharges || !grantedActivities?.length || candidate.grantedActivitiesSingleUse)) continue
    const grantedActivityTargetIds = Array.isArray(candidate.grantedActivityTargetIds) && candidate.grantedActivityTargetIds.length > 0 && candidate.grantedActivityTargetIds.length <= 64 &&
      candidate.grantedActivityTargetIds.every(id => typeof id === 'string' && id.trim() === id && id.length > 0 && id.length <= 160) && grantedActivities?.length
      ? [...new Set(candidate.grantedActivityTargetIds)] as string[] : undefined
    if (candidate.grantedActivityTargetIds != null && !grantedActivityTargetIds) continue
    const linkedTargetSnapshots = candidate.linkedTargetSnapshots == null ? undefined :
      Array.isArray(candidate.linkedTargetSnapshots) && candidate.linkedTargetSnapshots.length > 0 && candidate.linkedTargetSnapshots.length <= 64 &&
      candidate.linkedTargetSnapshots.every(entry => isRecord(entry) &&
        Object.keys(entry).every(key => ['actorId', 'effectId', 'name', 'presentation'].includes(key)) &&
        (entry.presentation == null || normalizeDnd5eLinkedTargetPresentation(entry.presentation) != null) &&
        ['actorId', 'effectId', 'name'].every(key => typeof entry[key] === 'string' && entry[key].trim().length > 0 && entry[key].length <= 500)) &&
      new Set(candidate.linkedTargetSnapshots.map(entry => entry.effectId)).size === candidate.linkedTargetSnapshots.length
        ? candidate.linkedTargetSnapshots.map(entry => ({ actorId: entry.actorId as string, effectId: entry.effectId as string, name: entry.name as string,
          ...(entry.presentation == null ? {} : { presentation: normalizeDnd5eLinkedTargetPresentation(entry.presentation)! }) })) : undefined
    if (candidate.linkedTargetSnapshots != null && !linkedTargetSnapshots) continue
    const completionGrant = isRecord(candidate.completionGrant) && Array.isArray(candidate.completionGrant.activityIds) &&
      candidate.completionGrant.activityIds.length > 0 && candidate.completionGrant.activityIds.length <= 32 &&
      candidate.completionGrant.activityIds.every(entry => typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(entry)) &&
      Number.isSafeInteger(candidate.completionGrant.availableRounds) && Number(candidate.completionGrant.availableRounds) >= 1 && Number(candidate.completionGrant.availableRounds) <= 14400 &&
      (candidate.completionGrant.singleUse == null || candidate.completionGrant.singleUse === true) &&
      (candidate.completionGrant.continueUntilUsed == null || (candidate.completionGrant.continueUntilUsed === true && candidate.completionGrant.singleUse === true && candidate.completionGrant.recipient == null)) &&
      (candidate.completionGrant.recipient == null || candidate.completionGrant.recipient === 'source') &&
      (candidate.completionGrant.bindTarget == null || ['source', 'bearer'].includes(String(candidate.completionGrant.bindTarget))) &&
      normalizedDuration.type === 'rounds'
      ? { continueUntilUsed: candidate.completionGrant.continueUntilUsed as true | undefined, singleUse: candidate.completionGrant.singleUse as true | undefined, recipient: candidate.completionGrant.recipient as 'source' | undefined, bindTarget: candidate.completionGrant.bindTarget as 'source' | 'bearer' | undefined, activityIds: [...new Set(candidate.completionGrant.activityIds)] as string[], availableRounds: Number(candidate.completionGrant.availableRounds) } : undefined
    if (candidate.completionGrant != null && !completionGrant) continue
    const normalizedGrantedActivities =
      candidate.source.pluginId === 'srd-5.1' && candidate.source.rulesId === 'magic-jar' &&
      candidate.definitionId.includes(':magic-jar-controller')
        ? [...new Set([
            ...(grantedActivities ?? []),
            'spell:magic-jar:possess',
            'spell:magic-jar:return',
            'spell:magic-jar:return-body',
          ])]
        : grantedActivities
    effects.push({
      ...(candidate as unknown as Dnd5eActiveEffectInstance),
      explorationExpiresAtWorldSecond: Number.isSafeInteger(candidate.explorationExpiresAtWorldSecond) &&
        Number(candidate.explorationExpiresAtWorldSecond) >= 0 ? Number(candidate.explorationExpiresAtWorldSecond) : undefined,
      id: candidate.id.trim(),
      definitionId: candidate.definitionId.trim(),
      label: candidate.label.trim(),
      tags: Array.isArray(candidate.tags) && candidate.tags.length > 0 && candidate.tags.length <= 32 &&
        candidate.tags.every(validDnd5eActiveEffectTag)
        ? [...new Set(candidate.tags)] as string[]
        : undefined,
      grantedActivities: normalizedGrantedActivities,
      completionGrant,
      initialSpaceBoundary: normalizeDnd5eInitialSpaceBoundary(candidate.initialSpaceBoundary),
      capturedCreatureIdentity: normalizeDnd5eCapturedCreatureIdentity(candidate.capturedCreatureIdentity),
      disguisedCreatureIdentity: normalizeDnd5eCapturedCreatureIdentity(candidate.disguisedCreatureIdentity),
      disguiseRecognizedByActorIds: candidate.disguisedCreatureIdentity && Array.isArray(candidate.disguiseRecognizedByActorIds) && candidate.disguiseRecognizedByActorIds.length <= 1000 && candidate.disguiseRecognizedByActorIds.every(id => typeof id === "string" && id.trim().length > 0 && id.length <= 256) ? [...new Set(candidate.disguiseRecognizedByActorIds)] as string[] : undefined,
      areaLifetime: isRecord(candidate.areaLifetime) &&
        Object.keys(candidate.areaLifetime).every(key => ['mapId', 'areaId', 'sourceActorId', 'generation'].includes(key)) &&
        (candidate.areaLifetime.generation == null || (Number.isSafeInteger(candidate.areaLifetime.generation) && Number(candidate.areaLifetime.generation) >= 0)) &&
        ['mapId', 'areaId', 'sourceActorId'].every(key => typeof (candidate.areaLifetime as Record<string, unknown>)[key] === 'string' &&
          String((candidate.areaLifetime as Record<string, unknown>)[key]).trim().length > 0 &&
          String((candidate.areaLifetime as Record<string, unknown>)[key]).length <= 256)
        ? { mapId: candidate.areaLifetime.mapId as string, areaId: candidate.areaLifetime.areaId as string,
            sourceActorId: candidate.areaLifetime.sourceActorId as string,
            ...(candidate.areaLifetime.generation != null ? { generation: candidate.areaLifetime.generation as number } : {}) } : undefined,
      linkedLifetime: isRecord(candidate.linkedLifetime) &&
        (candidate.linkedLifetime.protectedRemoval == null || candidate.linkedLifetime.protectedRemoval === true) &&
        typeof candidate.linkedLifetime.actorId === 'string' && candidate.linkedLifetime.actorId.length > 0 && candidate.linkedLifetime.actorId.length <= 256 &&
        typeof candidate.linkedLifetime.effectId === 'string' && candidate.linkedLifetime.effectId.length > 0 && candidate.linkedLifetime.effectId.length <= 256 &&
        (candidate.linkedLifetime.characterId == null || (typeof candidate.linkedLifetime.characterId === 'string' && candidate.linkedLifetime.characterId.length > 0 && candidate.linkedLifetime.characterId.length <= 256))
        ? { actorId: candidate.linkedLifetime.actorId, effectId: candidate.linkedLifetime.effectId,
          characterId: candidate.linkedLifetime.characterId as string | undefined,
          ...(candidate.linkedLifetime.protectedRemoval === true ? { protectedRemoval: true as const } : {}) } : undefined,
      grantedActivityTargetIds,
      linkedTargetSnapshots,
      grantedActivitiesSingleUse: candidate.grantedActivitiesSingleUse === true ? true : undefined,
      grantedActivityCharges,
      standardCondition,
      source: {
        ...(candidate.source as unknown as Dnd5eActiveEffectSource),
        ...(Number.isInteger(candidate.source.spellLevel) &&
          Number(candidate.source.spellLevel) >= 0 &&
          Number(candidate.source.spellLevel) <= 9
          ? { spellLevel: Number(candidate.source.spellLevel) }
          : {}),
        ...(Number.isInteger(candidate.source.spellSaveDc) &&
          Number(candidate.source.spellSaveDc) >= 1 &&
          Number(candidate.source.spellSaveDc) <= 100
          ? { spellSaveDc: Number(candidate.source.spellSaveDc) }
          : {}),
        ...(typeof candidate.source.magical === 'boolean'
          ? { magical: candidate.source.magical }
          : {}),
      },
      duration: normalizedDuration,
      attackAttemptWard: normalizeDnd5eAttackAttemptWard(candidate.attackAttemptWard),
      attackAttemptWardReceipts: normalizeDnd5eAttackAttemptWard(candidate.attackAttemptWard)
        ? normalizeDnd5eAttackAttemptWardReceipts(candidate.attackAttemptWardReceipts) : undefined,
      sourceTurnSpellSaveDisadvantage: normalizeDnd5eSourceTurnSpellSaveDisadvantage(candidate.sourceTurnSpellSaveDisadvantage),
      spellcastingSave,
      repeatSave,
      escapeCheck,
      escapeSavingThrow,
      onDamageCondition,
      completionReward: isRecord(candidate.completionReward) && candidate.completionReward.kind === 'short-rest' ? {kind: 'short-rest' as const} : undefined,
      completionRequirement: isRecord(candidate.completionRequirement) && DND5E_STANDARD_CONDITION_IDS.includes(candidate.completionRequirement.condition as Dnd5eStandardConditionId) && typeof candidate.completionRequirement.interrupted === 'boolean'
        ? { condition: candidate.completionRequirement.condition as Dnd5eStandardConditionId, interrupted: candidate.completionRequirement.interrupted } : undefined,
      endSavingThrow: validDnd5eEffectEndSavingThrow(candidate.endSavingThrow) ? {...candidate.endSavingThrow} : undefined,
      pendingEndSavingThrow: validDnd5eEffectEndSavingThrow(candidate.pendingEndSavingThrow) ? {...candidate.pendingEndSavingThrow} : undefined,
      onEndAwareness: candidate.onEndAwareness === 'charmed-by-source' && typeof candidate.source.actorId === 'string' && candidate.source.actorId.trim() ? 'charmed-by-source' : undefined,
      sourceAttitude: candidate.sourceAttitude === 'friendly' && typeof candidate.source.actorId === 'string' && candidate.source.actorId.trim() ? 'friendly' : undefined,
      afterEffectEnds,
      periodicDamage,
      periodicHealing,
      undeadCreationProtection,
      bodyRestoration,
      calendarRepeatSave,
      campaignPeriodicHitPointMaximumReduction,
      removal,
      relation,
      dependsOnEffectId,
      ...(suspendedBy ? { suspendedBy } : {}),
      persistAfterConcentrationCompletes,
      potency,
      ...(maximizedDamageRoll ? { maximizedDamageRoll } : {}),
      breakOn: Array.isArray(candidate.breakOn)
        ? [...new Set(candidate.breakOn.filter((entry): entry is Dnd5eActiveEffectBreakTrigger => BREAK_TRIGGERS.has(entry as Dnd5eActiveEffectBreakTrigger)))]
        : undefined,
      modifiers: modifiers && (
        modifiers.speedPenaltyFeet != null ||
        modifiers.speedBonusFeet != null ||
        modifiers.speedOverrideFeet != null ||
        modifiers.speedMinimumFeet != null ||
        modifiers.speedMaximumFeet != null ||
        modifiers.speedMultiplier != null ||
        modifiers.maximumAttacksPerTurn != null ||
        modifiers.restrictedExtraAction != null ||
        modifiers.preventActions != null ||
        modifiers.preventRestBenefits != null ||
        modifiers.actionRestriction != null ||
        modifiers.spellSaveDisadvantageAura != null ||
        modifiers.actionOrBonusActionOnly != null ||
        modifiers.actionSpellDelay != null ||
        modifiers.darkvisionRangeFeet != null ||
        modifiers.darkvisionIfAbsentFeet != null ||
        modifiers.darkvisionExistingBonusFeet != null ||
        modifiers.darkvisionRacialFallbackFeet != null ||
        modifiers.darkvisionRacialBonusFeet != null ||
        modifiers.climbSpeedEqualsWalking != null ||
        modifiers.climbingCheckAdvantage != null ||
        modifiers.poisonSavingThrowAdvantage != null ||
        modifiers.swimSpeedEqualsWalking != null ||
        modifiers.sightRangeLimitFeet != null ||
        modifiers.truesightRangeFeet != null ||
        modifiers.spellTargetingImmunitySchools != null ||
        modifiers.seeInvisible != null ||
        modifiers.suppressInvisibilityBenefits != null ||
        modifiers.invisibleToDarkvision != null ||
        modifiers.languageCapabilities != null ||
        modifiers.languageRestriction != null ||
        modifiers.attackDecoys != null ||
        modifiers.planarPhase != null ||
        modifiers.solidMaterialTraversal != null ||
        modifiers.trackingCapability != null ||
        modifiers.environmentalCapabilities != null ||
        modifiers.emittedLight != null ||
        modifiers.flySpeedLimitFeet != null ||
        modifiers.flySpeedFeet != null ||
        modifiers.hoverWhileFlying != null ||
        modifiers.magicallyHeldAloft != null ||
        modifiers.submerged != null ||
        modifiers.jumpDistanceMultiplier != null ||
        modifiers.sizeRankDelta != null ||
        modifiers.strengthRollMode != null ||
        modifiers.skillCheckBonuses != null ||
        modifiers.abilityCheckRules != null ||
        modifiers.abilityCheckAdvantages != null ||
        modifiers.abilityCheckDisadvantages != null ||
        modifiers.minimumAbilityCheckD20ByAbility != null ||
        modifiers.skillExpertise != null ||
        modifiers.attackActionMinimum != null ||
        modifiers.ownTurnAttackActionBonus != null ||
        modifiers.equipmentProficiencies != null ||
        modifiers.savingThrowProficiencies != null ||
        modifiers.skillCheckAdvantages != null ||
        modifiers.skillCheckDisadvantages != null ||
        modifiers.locationKnownToSource != null ||
        modifiers.perceptionDisadvantageAgainstOthersThanSource != null ||
        modifiers.skillCheckBonusAuras != null ||
        modifiers.savingThrowDisadvantages != null ||
        modifiers.savingThrowAdvantages != null ||
        modifiers.deathSavingThrowAdvantage != null ||
        modifiers.maximizeHealingDiceNearCompanion != null ||
        modifiers.maximizeHealingDice != null ||
        modifiers.carryingCapacityMultiplier != null ||
        modifiers.safeFallFeet != null ||
        modifiers.controlledDescent != null ||
        modifiers.automaticEscape != null ||
        modifiers.ignoreMagicalSpeedReductions != null ||
        modifiers.onHitBonusDamage != null ||
        modifiers.hitPointMaximumBonus != null ||
        modifiers.increaseCurrentHitPointsWithMaximum != null ||
        modifiers.armorClassBonus != null ||
        modifiers.cohortArmorClass != null ||
        modifiers.sourceProximityAttackAdvantage != null ||
        modifiers.attacksAgainstSourceArmorClassBonus != null ||
        modifiers.savingThrowBonus != null ||
        modifiers.savingThrowBonusByAbility != null ||
        modifiers.optionalBonusDie != null || modifiers.rollDiceModifiers != null ||
        modifiers.attackRollAdvantage != null ||
        modifiers.weaponCategoryRollModes != null ||
        modifiers.weaponAttackRollAdvantage != null ||
        modifiers.weaponAttackRollDisadvantage != null ||
        modifiers.attackRollDisadvantage != null ||
        modifiers.attackRollDisadvantageAbilities != null ||
        modifiers.attackRollAdvantageAbilities != null ||
        modifiers.attacksAgainstTargetAdvantage != null ||
        modifiers.attacksAgainstTargetDisadvantage != null ||
        modifiers.weaponAttacksAgainstTarget != null ||
        modifiers.attacksAgainstTargetDisadvantageCreatureTypes != null ||
        modifiers.walkingSpeedBonusFeet != null ||
        modifiers.speedAfterOwnTurnWeaponAttackFeet != null ||
        modifiers.preventMovementOpportunityAttacks != null ||
        modifiers.damageRollsBySourceBonus != null ||
        modifiers.attacksBySourceCriticalThreshold != null ||
        modifiers.cannotBeSurprisedWhileConscious != null ||
        modifiers.preventsRevival != null ||
        modifiers.nextD20AdvantageRollKinds != null ||
        modifiers.perceiveVisibleCreaturesAsHostile != null ||
        modifiers.randomVisibleCreatureTargets != null ||
        modifiers.mandatoryOpportunityAttacks != null ||
        modifiers.attackDisadvantageAgainstOthersThanSource != null ||
        modifiers.notifySourceOnBearerDamage != null ||
        modifiers.nextAttackAdvantageByOtherThanSource != null ||
        modifiers.resistanceToAllDamage != null ||
        modifiers.nextSourceOrAllyAttackVulnerability != null ||
        modifiers.vulnerabilityToAllDamage != null ||
        modifiers.weaponDamageD4 != null ||
        modifiers.weaponDamageReplacementAttackModes != null ||
        modifiers.movementBoundarySave != null ||
        modifiers.preventReactions != null ||
        modifiers.forcedFleeFromSource != null ||
        modifiers.preventHealing != null ||
        modifiers.preventNonmagicalHealing != null ||
        modifiers.damageResistance != null ||
        modifiers.suppressDamageResistance != null ||
        modifiers.conditionalDamageResistances != null ||
        modifiers.weaponDamageMultipliers != null ||
        modifiers.damageImmunity != null ||
        modifiers.damageVulnerability != null ||
        modifiers.conditionImmunities != null ||
        modifiers.conditionImmunitiesBySourceCreatureType != null ||
        modifiers.savingThrowAdvantagesBySourceCreatureType != null ||
        modifiers.conditionImmunitiesBySourceMagic != null ||
        modifiers.calmEmotionsIndifferentTargetIds != null ||
        modifiers.attackProfiles != null ||
        modifiers.shillelagh != null ||
        modifiers.magicWeapon != null ||
        modifiers.weaponEnchantment != null || modifiers.armorEnchantment != null
      )
        ? modifiers
        : undefined,
    })
  }
  let connected = effects
  for (;;) {
    const byId = new Map(connected.map((effect) => [effect.id, effect]))
    const ids = new Set(byId.keys())
    const next = connected.filter((effect) =>
      effect.dependsOnEffectId == null || ids.has(effect.dependsOnEffectId))
    if (next.length !== connected.length) {
      connected = next
      continue
    }
    const cyclicOrDependingOnCycle = new Set<string>()
    for (const effect of next) {
      const path = new Set<string>()
      let current: Dnd5eActiveEffectInstance | undefined = effect
      while (current?.dependsOnEffectId) {
        if (path.has(current.id)) {
          for (const id of path) cyclicOrDependingOnCycle.add(id)
          break
        }
        path.add(current.id)
        current = byId.get(current.dependsOnEffectId)
      }
    }
    if (cyclicOrDependingOnCycle.size === 0) return next
    connected = next.filter((effect) => !cyclicOrDependingOnCycle.has(effect.id))
  }
}

export interface Dnd5eActiveEffectValidationResult {
  ok: boolean
  effects: Dnd5eActiveEffectInstance[]
  issues: string[]
}

/**
 * 共享资源边界使用严格模式：本地迁移可以修复旧数据，但远端损坏数据必须 fail closed。
 */
export function validateDnd5eActiveEffectsStrict(value: unknown): Dnd5eActiveEffectValidationResult {
  if (value == null) return { ok: true, effects: [], issues: [] }
  if (!Array.isArray(value)) return { ok: false, effects: [], issues: ['activeEffects 必须是数组'] }
  const effects = normalizeDnd5eActiveEffects(value)
  const issues: string[] = []
  if (effects.length !== value.length) issues.push('activeEffects 含有无法解析或重复的实例')
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index]
    if (!isRecord(raw)) continue
    if (isRecord(raw.duration) && raw.duration.includeCreationTurn != null &&
      (typeof raw.duration.includeCreationTurn !== 'boolean' || raw.duration.type !== 'until-turn-boundary' ||
        !['source-turn-end', 'target-turn-end'].includes(String(raw.duration.boundary)))) {
      issues.push(`activeEffects[${index}].duration.includeCreationTurn is invalid`)
    }
    if (isRecord(raw.source) && raw.source.lastLongRestWorldMinute !== undefined && raw.source.lastLongRestWorldMinute !== null && !(typeof raw.source.lastLongRestWorldMinute === 'number' && Number.isSafeInteger(raw.source.lastLongRestWorldMinute) && raw.source.lastLongRestWorldMinute >= 0)) issues.push(`activeEffects[${index}].source.lastLongRestWorldMinute 无效`)
    if (raw.explorationExpiresAtWorldSecond != null &&
      (!Number.isSafeInteger(raw.explorationExpiresAtWorldSecond) || Number(raw.explorationExpiresAtWorldSecond) < 0))
      issues.push(`activeEffects[${index}].explorationExpiresAtWorldSecond is invalid`)
    const effect = effects.find((candidate) => candidate.id === raw.id)
    if (!effect) {
      if (raw.escapeCheck != null) {
        const rawWithoutRelation = { ...raw, relation: undefined }
        const normalizedWithoutRelation = normalizeDnd5eActiveEffects([rawWithoutRelation])[0]
        if (normalizedWithoutRelation?.escapeCheck == null) {
          issues.push(`activeEffects[${index}].escapeCheck 损坏`)
        }
      }
      if (raw.relation != null) issues.push(`activeEffects[${index}].relation is invalid`)
      continue
    }
    for (const field of ['endSavingThrow','pendingEndSavingThrow'] as const) if (raw[field] != null && !validDnd5eEffectEndSavingThrow(raw[field])) issues.push(`activeEffects[${index}].${field} is invalid`)
    if (raw.onEndAwareness != null && effect.onEndAwareness == null) issues.push(`activeEffects[${index}].onEndAwareness is invalid`)
    if (raw.sourceAttitude != null && effect.sourceAttitude == null) issues.push(`activeEffects[${index}].sourceAttitude is invalid`)
    if (raw.attackAttemptWard != null && effect.attackAttemptWard == null) issues.push(`activeEffects[${index}].attackAttemptWard is invalid`)
    if (raw.attackAttemptWardReceipts != null && effect.attackAttemptWardReceipts == null) issues.push(`activeEffects[${index}].attackAttemptWardReceipts is invalid`)
    if (raw.sourceTurnSpellSaveDisadvantage != null && effect.sourceTurnSpellSaveDisadvantage == null) issues.push(`activeEffects[${index}].sourceTurnSpellSaveDisadvantage is invalid`)
    if (raw.spellcastingSave != null && effect.spellcastingSave == null) issues.push(`activeEffects[${index}].spellcastingSave is invalid`)
    if (raw.repeatSave != null && effect.repeatSave == null) issues.push(`activeEffects[${index}].repeatSave 损坏`)
    if (raw.escapeCheck != null && effect.escapeCheck == null) issues.push(`activeEffects[${index}].escapeCheck 损坏`)
    if (raw.escapeSavingThrow != null && effect.escapeSavingThrow == null) {
      issues.push(`activeEffects[${index}].escapeSavingThrow is invalid`)
    }
    if (raw.onDamageCondition != null && effect.onDamageCondition == null) {
      issues.push(`activeEffects[${index}].onDamageCondition is invalid`)
    }
    if (raw.afterEffectEnds != null && effect.afterEffectEnds == null) {
      issues.push(`activeEffects[${index}].afterEffectEnds is invalid`)
    }
    if (
      raw.persistAfterConcentrationCompletes != null &&
      raw.persistAfterConcentrationCompletes !== true
    ) issues.push(`activeEffects[${index}].persistAfterConcentrationCompletes is invalid`)
    if (raw.periodicDamage != null && effect.periodicDamage == null) {
      issues.push(`activeEffects[${index}].periodicDamage is invalid`)
    }
    if (raw.periodicHealing != null && effect.periodicHealing == null) {
      issues.push(`activeEffects[${index}].periodicHealing is invalid`)
    }
    if (raw.undeadCreationProtection != null && effect.undeadCreationProtection == null) {
      issues.push(`activeEffects[${index}].undeadCreationProtection is invalid`)
    }
    if (raw.bodyRestoration != null && effect.bodyRestoration == null) {
      issues.push(`activeEffects[${index}].bodyRestoration is invalid`)
    }
    if (raw.campaignPeriodicHitPointMaximumReduction != null && effect.campaignPeriodicHitPointMaximumReduction == null) {
      issues.push(`activeEffects[${index}].campaignPeriodicHitPointMaximumReduction is invalid`)
    }
    if (raw.calendarRepeatSave != null && effect.calendarRepeatSave == null) {
      issues.push(`activeEffects[${index}].calendarRepeatSave is invalid`)
    }
    if (raw.tags != null && (
      !Array.isArray(raw.tags) || raw.tags.length < 1 || raw.tags.length > 32 ||
      raw.tags.some((tag) => !validDnd5eActiveEffectTag(tag)) ||
      effect.tags?.length !== new Set(raw.tags).size
    )) issues.push(`activeEffects[${index}].tags is invalid`)
    if (raw.removal != null && effect.removal == null) {
      issues.push(`activeEffects[${index}].removal is invalid`)
    }
    if (raw.relation != null && effect.relation == null) issues.push(`activeEffects[${index}].relation is invalid`)
    if (raw.maximizedDamageRoll != null && effect.maximizedDamageRoll == null) issues.push(`activeEffects[${index}].maximizedDamageRoll 无效`)
    if (raw.potency != null && effect.potency == null) issues.push(`activeEffects[${index}].potency 无效`)
    if (raw.dependsOnEffectId != null && effect.dependsOnEffectId == null) {
      issues.push(`activeEffects[${index}].dependsOnEffectId is invalid`)
    }
    if (raw.suspendedBy != null && (
      !Array.isArray(raw.suspendedBy) ||
      raw.suspendedBy.length === 0 ||
      raw.suspendedBy.some((entry) =>
        typeof entry !== 'string' ||
        entry.trim().length === 0 ||
        entry.length > 200
      ) ||
      raw.suspendedBy.length !== new Set(raw.suspendedBy).size ||
      effect.suspendedBy?.length !== new Set(raw.suspendedBy).size
    )) {
      issues.push(`activeEffects[${index}].suspendedBy is invalid`)
    }
    if (isRecord(raw.source) && raw.source.spellLevel != null && effect.source.spellLevel == null) {
      issues.push(`activeEffects[${index}].source.spellLevel 无效`)
    }
    if (isRecord(raw.source) && raw.source.spellSaveDc != null && effect.source.spellSaveDc == null) {
      issues.push(`activeEffects[${index}].source.spellSaveDc 无效`)
    }
    if (raw.completionReward != null && (!effect.completionReward || !effect.completionRequirement || effect.duration.type !== 'rounds')) issues.push(`activeEffects[${index}].completionReward 无效或缺少有时限的持续条件`)
    if (raw.completionRequirement != null && !effect.completionRequirement) issues.push(`activeEffects[${index}].completionRequirement 无效`)
    if (raw.linkedLifetime != null && !effect.linkedLifetime) issues.push(`activeEffects[${index}].linkedLifetime 无效`)
    if (raw.areaLifetime != null && !effect.areaLifetime) issues.push(`activeEffects[${index}].areaLifetime 无效`)
    if (raw.initialSpaceBoundary != null && !effect.initialSpaceBoundary) issues.push(`activeEffects[${index}].initialSpaceBoundary 无效`)
    if (raw.capturedCreatureIdentity != null && !effect.capturedCreatureIdentity) issues.push(`activeEffects[${index}].capturedCreatureIdentity 无效`)
    if (raw.disguiseRecognizedByActorIds != null && (!effect.disguisedCreatureIdentity || !effect.disguiseRecognizedByActorIds)) issues.push(`activeEffects[${index}].disguiseRecognizedByActorIds 无效`)
    if (raw.disguisedCreatureIdentity != null && !effect.disguisedCreatureIdentity) issues.push(`activeEffects[${index}].disguisedCreatureIdentity 无效`)
    if (Array.isArray(raw.breakOn) && (effect.breakOn?.length ?? 0) !== new Set(raw.breakOn).size) {
      issues.push(`activeEffects[${index}].breakOn 含未知触发器`)
    }
    if (isRecord(raw.duration) && raw.duration.type === 'rounds' && (
      !Number.isInteger(raw.duration.remainingRounds) || Number(raw.duration.remainingRounds) <= 0
    )) issues.push(`activeEffects[${index}].duration.remainingRounds 无效`)
    if (isRecord(raw.duration) && raw.duration.type === 'rounds' && raw.duration.lastTickTurnKey != null && (
      typeof raw.duration.lastTickTurnKey !== 'string' ||
      raw.duration.lastTickTurnKey.trim().length === 0 ||
      raw.duration.lastTickTurnKey.length > 512
    )) issues.push(`activeEffects[${index}].duration.lastTickTurnKey 无效`)
    if (raw.modifiers != null) {
      if (!isRecord(raw.modifiers)) issues.push(`activeEffects[${index}].modifiers 损坏`)
      else {
        if (raw.modifiers.speedPenaltyFeet != null && (
          typeof raw.modifiers.speedPenaltyFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.speedPenaltyFeet) || raw.modifiers.speedPenaltyFeet < 0
        )) issues.push(`activeEffects[${index}].modifiers.speedPenaltyFeet 无效`)
        if (raw.modifiers.speedBonusFeet != null && (
          typeof raw.modifiers.speedBonusFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.speedBonusFeet) || raw.modifiers.speedBonusFeet < 0
        )) issues.push(`activeEffects[${index}].modifiers.speedBonusFeet 无效`)
        for (const speedField of ['speedOverrideFeet', 'speedMinimumFeet', 'speedMaximumFeet'] as const) {
          const value = raw.modifiers[speedField]
          if (value != null && (
            typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000
          )) issues.push(`activeEffects[${index}].modifiers.${speedField} is invalid`)
        }
        if (raw.modifiers.speedMultiplier != null && (
          typeof raw.modifiers.speedMultiplier !== 'number' ||
          !Number.isFinite(raw.modifiers.speedMultiplier) ||
          raw.modifiers.speedMultiplier < 0 || raw.modifiers.speedMultiplier > 10
        )) issues.push(`activeEffects[${index}].modifiers.speedMultiplier 无效`)
        if (raw.modifiers.maximumAttacksPerTurn != null && (
          typeof raw.modifiers.maximumAttacksPerTurn !== 'number' ||
          !Number.isInteger(raw.modifiers.maximumAttacksPerTurn) ||
          raw.modifiers.maximumAttacksPerTurn <= 0
        )) issues.push(`activeEffects[${index}].modifiers.maximumAttacksPerTurn 无效`)
        if (raw.modifiers.restrictedExtraAction != null && effect.modifiers?.restrictedExtraAction == null) {
          issues.push(`activeEffects[${index}].modifiers.restrictedExtraAction 无效`)
        }
        if (raw.modifiers.preventActions != null && raw.modifiers.preventActions !== true) {
          issues.push(`activeEffects[${index}].modifiers.preventActions 无效`)
        }
        if (raw.modifiers.preventRestBenefits != null && raw.modifiers.preventRestBenefits !== true) {
          issues.push(`activeEffects[${index}].modifiers.preventRestBenefits 无效`)
        }
        for (const key of ['climbingCheckAdvantage', 'poisonSavingThrowAdvantage'] as const) {
          if (raw.modifiers[key] != null && raw.modifiers[key] !== true) {
            issues.push(`activeEffects[${index}].modifiers.${key} is invalid`)
          }
        }
        if (raw.modifiers.actionRestriction != null && effect.modifiers?.actionRestriction == null) {
          issues.push(`activeEffects[${index}].modifiers.actionRestriction is invalid`)
        }
        if (raw.modifiers.hoverWhileFlying != null && raw.modifiers.hoverWhileFlying !== true) {
          issues.push(`activeEffects[${index}].modifiers.hoverWhileFlying is invalid`)
        }
        if (raw.modifiers.spellSaveDisadvantageAura != null && (
          !isRecord(raw.modifiers.spellSaveDisadvantageAura) ||
          typeof raw.modifiers.spellSaveDisadvantageAura.radiusFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.spellSaveDisadvantageAura.radiusFeet) ||
          raw.modifiers.spellSaveDisadvantageAura.radiusFeet <= 0 ||
          raw.modifiers.spellSaveDisadvantageAura.radiusFeet > 10_000 ||
          !Array.isArray(raw.modifiers.spellSaveDisadvantageAura.damageTypes) ||
          raw.modifiers.spellSaveDisadvantageAura.damageTypes.some((entry) =>
            !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry)) ||
          (raw.modifiers.spellSaveDisadvantageAura.spellcastingClassIds != null && (
            !Array.isArray(raw.modifiers.spellSaveDisadvantageAura.spellcastingClassIds) ||
            raw.modifiers.spellSaveDisadvantageAura.spellcastingClassIds.some((entry) =>
              typeof entry !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry)))) ||
          (raw.modifiers.spellSaveDisadvantageAura.damageTypes.length < 1 &&
            (!Array.isArray(raw.modifiers.spellSaveDisadvantageAura.spellcastingClassIds) ||
              raw.modifiers.spellSaveDisadvantageAura.spellcastingClassIds.length < 1))
        )) issues.push(`activeEffects[${index}].modifiers.spellSaveDisadvantageAura 无效`)
        if (raw.modifiers.spellActionAsBonusActionClassIds != null && (
          !Array.isArray(raw.modifiers.spellActionAsBonusActionClassIds) ||
          raw.modifiers.spellActionAsBonusActionClassIds.length < 1 ||
          raw.modifiers.spellActionAsBonusActionClassIds.some((entry) =>
            typeof entry !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry))
        )) issues.push(`activeEffects[${index}].modifiers.spellActionAsBonusActionClassIds 无效`)
        if (raw.modifiers.actionOrBonusActionOnly != null &&
          typeof raw.modifiers.actionOrBonusActionOnly !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.actionOrBonusActionOnly 无效`)
        }
        if (raw.modifiers.actionSpellDelay != null && effect.modifiers?.actionSpellDelay == null) {
          issues.push(`activeEffects[${index}].modifiers.actionSpellDelay 无效`)
        }
        if (raw.modifiers.darkvisionRangeFeet != null && (
          typeof raw.modifiers.darkvisionRangeFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.darkvisionRangeFeet) ||
          raw.modifiers.darkvisionRangeFeet <= 0 ||
          raw.modifiers.darkvisionRangeFeet > 10_000
        )) issues.push(`activeEffects[${index}].modifiers.darkvisionRangeFeet 无效`)
        for (const key of ['darkvisionIfAbsentFeet', 'darkvisionExistingBonusFeet', 'darkvisionRacialFallbackFeet', 'darkvisionRacialBonusFeet'] as const) {
          const value = raw.modifiers[key]
          if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10_000)) issues.push(`activeEffects[${index}].modifiers.${key} 无效`)
        }
        if (raw.modifiers.climbSpeedEqualsWalking != null &&
          typeof raw.modifiers.climbSpeedEqualsWalking !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.climbSpeedEqualsWalking 无效`)
        }
        if (raw.modifiers.swimSpeedEqualsWalking != null &&
          typeof raw.modifiers.swimSpeedEqualsWalking !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.swimSpeedEqualsWalking 无效`)
        }
        if (raw.modifiers.sightRangeLimitFeet != null && (typeof raw.modifiers.sightRangeLimitFeet !== 'number' || !Number.isFinite(raw.modifiers.sightRangeLimitFeet) || raw.modifiers.sightRangeLimitFeet < 1 || raw.modifiers.sightRangeLimitFeet > 10_000)) issues.push(`activeEffects[${index}].modifiers.sightRangeLimitFeet 无效`)
        if (raw.modifiers.truesightRangeFeet != null && (
          typeof raw.modifiers.truesightRangeFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.truesightRangeFeet) ||
          raw.modifiers.truesightRangeFeet <= 0 ||
          raw.modifiers.truesightRangeFeet > 10_000
        )) issues.push(`activeEffects[${index}].modifiers.truesightRangeFeet 无效`)
        if (raw.modifiers.spellTargetingImmunitySchools != null && (
          !Array.isArray(raw.modifiers.spellTargetingImmunitySchools) ||
          raw.modifiers.spellTargetingImmunitySchools.length < 1 ||
          raw.modifiers.spellTargetingImmunitySchools.some((entry) =>
            !['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'].includes(String(entry))
          )
        )) issues.push(`activeEffects[${index}].modifiers.spellTargetingImmunitySchools 无效`)
        if (raw.modifiers.suppressInvisibilityBenefits != null && raw.modifiers.suppressInvisibilityBenefits !== true) issues.push(`activeEffects[${index}].modifiers.suppressInvisibilityBenefits 无效`)
        if (raw.modifiers.invisibleToDarkvision != null && typeof raw.modifiers.invisibleToDarkvision !== 'boolean') issues.push(`activeEffects[${index}].modifiers.invisibleToDarkvision 无效`)
        if (raw.modifiers.seeInvisible != null && typeof raw.modifiers.seeInvisible !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.seeInvisible 无效`)
        }
        if (raw.modifiers.languageCapabilities != null && (
          !isRecord(raw.modifiers.languageCapabilities) ||
          Object.keys(raw.modifiers.languageCapabilities).some((key) => ![
            'understandSpoken', 'understandWritten', 'writtenRequiresTouch',
            'writtenMinutesPerPage', 'speechUnderstoodBy',
          ].includes(key)) ||
          (raw.modifiers.languageCapabilities.understandSpoken != null &&
            raw.modifiers.languageCapabilities.understandSpoken !== 'all') ||
          (raw.modifiers.languageCapabilities.understandWritten != null &&
            raw.modifiers.languageCapabilities.understandWritten !== 'literal-written') ||
          (raw.modifiers.languageCapabilities.writtenRequiresTouch != null &&
            raw.modifiers.languageCapabilities.writtenRequiresTouch !== true) ||
          (raw.modifiers.languageCapabilities.writtenMinutesPerPage != null &&
            raw.modifiers.languageCapabilities.writtenMinutesPerPage !== 1) ||
          (raw.modifiers.languageCapabilities.speechUnderstoodBy != null &&
            raw.modifiers.languageCapabilities.speechUnderstoodBy !== 'any-creature-knowing-a-language') ||
          !Object.values(raw.modifiers.languageCapabilities).some((value) => value != null)
        )) issues.push(`activeEffects[${index}].modifiers.languageCapabilities 无效`)
        if (raw.modifiers.languageRestriction != null && (
          !isRecord(raw.modifiers.languageRestriction) ||
          Object.keys(raw.modifiers.languageRestriction).some((key) =>
            !['understandLanguages', 'intelligibleCommunication'].includes(key)) ||
          raw.modifiers.languageRestriction.understandLanguages !== false ||
          raw.modifiers.languageRestriction.intelligibleCommunication !== false
        )) issues.push(`activeEffects[${index}].modifiers.languageRestriction 无效`)
        if (raw.modifiers.attackDecoys != null && (
          !isRecord(raw.modifiers.attackDecoys) ||
          Object.keys(raw.modifiers.attackDecoys).some((key) => ![
            'remaining', 'redirectMinimumD20', 'armorClassBase',
            'armorClassAbility', 'requiresOrdinarySight',
          ].includes(key)) ||
          !Number.isInteger(raw.modifiers.attackDecoys.remaining) ||
          Number(raw.modifiers.attackDecoys.remaining) < 1 ||
          Number(raw.modifiers.attackDecoys.remaining) > 20 ||
          !Array.isArray(raw.modifiers.attackDecoys.redirectMinimumD20) ||
          raw.modifiers.attackDecoys.redirectMinimumD20.length <
            Number(raw.modifiers.attackDecoys.remaining) ||
          raw.modifiers.attackDecoys.redirectMinimumD20.length > 20 ||
          raw.modifiers.attackDecoys.redirectMinimumD20.some((entry) =>
            !Number.isInteger(entry) || Number(entry) < 1 || Number(entry) > 20) ||
          !Number.isInteger(raw.modifiers.attackDecoys.armorClassBase) ||
          Number(raw.modifiers.attackDecoys.armorClassBase) < 0 ||
          Number(raw.modifiers.attackDecoys.armorClassBase) > 100 ||
          !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(
            String(raw.modifiers.attackDecoys.armorClassAbility),
          ) ||
          raw.modifiers.attackDecoys.requiresOrdinarySight !== true
        )) issues.push(`activeEffects[${index}].modifiers.attackDecoys 无效`)
        if (raw.modifiers.planarPhase != null && (
          !isRecord(raw.modifiers.planarPhase) ||
          Object.keys(raw.modifiers.planarPhase).some((key) => ![
            'plane', 'ignoresMaterialCollision', 'suppressCrossPlaneEffects',
            'unrestrictedVerticalMovement', 'materialSightRangeFeet',
          ].includes(key)) ||
          !['ethereal', 'terrain'].includes(String(raw.modifiers.planarPhase.plane)) ||
          typeof raw.modifiers.planarPhase.ignoresMaterialCollision !== 'boolean' ||
          raw.modifiers.planarPhase.suppressCrossPlaneEffects !== true ||
          typeof raw.modifiers.planarPhase.unrestrictedVerticalMovement !== 'boolean' ||
          (raw.modifiers.planarPhase.materialSightRangeFeet != null && (raw.modifiers.planarPhase.plane !== 'ethereal' ||
            typeof raw.modifiers.planarPhase.materialSightRangeFeet !== 'number' ||
            !Number.isFinite(raw.modifiers.planarPhase.materialSightRangeFeet) ||
            raw.modifiers.planarPhase.materialSightRangeFeet <= 0 || raw.modifiers.planarPhase.materialSightRangeFeet > 10_000)) ||
          (raw.modifiers.planarPhase.plane === 'ethereal' &&
            (!raw.modifiers.planarPhase.ignoresMaterialCollision || !raw.modifiers.planarPhase.unrestrictedVerticalMovement)) ||
          (raw.modifiers.planarPhase.plane === 'terrain' &&
            (raw.modifiers.planarPhase.ignoresMaterialCollision || raw.modifiers.planarPhase.unrestrictedVerticalMovement))
        )) issues.push(`activeEffects[${index}].modifiers.planarPhase 无效`)
        if (raw.modifiers.solidMaterialTraversal != null && !normalizeDnd5eSolidMaterialTraversal(raw.modifiers.solidMaterialTraversal)) {
          issues.push(`activeEffects[${index}].modifiers.solidMaterialTraversal 无效`)
        }
        if (raw.modifiers.trackingCapability != null && (
          !isRecord(raw.modifiers.trackingCapability) ||
          Object.keys(raw.modifiers.trackingCapability).some((key) =>
            !['mundaneTracking', 'leavesTracks'].includes(key)) ||
          raw.modifiers.trackingCapability.mundaneTracking !== 'impossible' ||
          raw.modifiers.trackingCapability.leavesTracks !== false
        )) issues.push(`activeEffects[${index}].modifiers.trackingCapability 无效`)
        if (raw.modifiers.environmentalCapabilities != null && (
          !isRecord(raw.modifiers.environmentalCapabilities) ||
          Object.keys(raw.modifiers.environmentalCapabilities).some((key) =>
            !['breatheIn', 'doesNotNeedAir', 'holdBreathSeconds', 'treatLiquidSurfacesAsSolidGround', 'ignoreDifficultTerrain', 'ignoreDifficultTerrainMaterials',
              'ignoreUnderwaterMovementPenalty', 'ignoreUnderwaterAttackPenalty', 'occupyCreatureSpaces',
              'riseTowardLiquidSurfaceFeetPerRound', 'minimumPassageGapInches'].includes(key)) ||
          (raw.modifiers.environmentalCapabilities.doesNotNeedAir != null && raw.modifiers.environmentalCapabilities.doesNotNeedAir !== true) ||
          (raw.modifiers.environmentalCapabilities.holdBreathSeconds != null && (
            !Number.isSafeInteger(raw.modifiers.environmentalCapabilities.holdBreathSeconds) ||
            Number(raw.modifiers.environmentalCapabilities.holdBreathSeconds) < 1 || Number(raw.modifiers.environmentalCapabilities.holdBreathSeconds) > 86_400)) ||
          (raw.modifiers.environmentalCapabilities.breatheIn != null && (
            !Array.isArray(raw.modifiers.environmentalCapabilities.breatheIn) ||
            raw.modifiers.environmentalCapabilities.breatheIn.length !== 1 ||
            raw.modifiers.environmentalCapabilities.breatheIn[0] !== 'water')) ||
          (raw.modifiers.environmentalCapabilities.treatLiquidSurfacesAsSolidGround != null &&
            raw.modifiers.environmentalCapabilities.treatLiquidSurfacesAsSolidGround !== true) ||
          (raw.modifiers.environmentalCapabilities.ignoreDifficultTerrainMaterials != null &&
            !validMapSurfaceMaterials(raw.modifiers.environmentalCapabilities.ignoreDifficultTerrainMaterials)) ||
          (raw.modifiers.environmentalCapabilities.ignoreDifficultTerrain != null &&
            raw.modifiers.environmentalCapabilities.ignoreDifficultTerrain !== true) ||
          (raw.modifiers.environmentalCapabilities.ignoreUnderwaterMovementPenalty != null &&
            raw.modifiers.environmentalCapabilities.ignoreUnderwaterMovementPenalty !== true) ||
          (raw.modifiers.environmentalCapabilities.ignoreUnderwaterAttackPenalty != null &&
            raw.modifiers.environmentalCapabilities.ignoreUnderwaterAttackPenalty !== true) ||
          (raw.modifiers.environmentalCapabilities.occupyCreatureSpaces != null &&
            raw.modifiers.environmentalCapabilities.occupyCreatureSpaces !== true) ||
          (raw.modifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound != null && (
            typeof raw.modifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound !== 'number' ||
            !Number.isInteger(raw.modifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound) ||
            raw.modifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound < 1 ||
            raw.modifiers.environmentalCapabilities.riseTowardLiquidSurfaceFeetPerRound > 1_000)) ||
          (raw.modifiers.environmentalCapabilities.minimumPassageGapInches != null && (
            typeof raw.modifiers.environmentalCapabilities.minimumPassageGapInches !== 'number' ||
            !Number.isInteger(raw.modifiers.environmentalCapabilities.minimumPassageGapInches) ||
            raw.modifiers.environmentalCapabilities.minimumPassageGapInches < 1 ||
            raw.modifiers.environmentalCapabilities.minimumPassageGapInches > 120)) ||
          !Object.values(raw.modifiers.environmentalCapabilities).some((value) => value != null)
        )) issues.push(`activeEffects[${index}].modifiers.environmentalCapabilities 无效`)
        if (raw.modifiers.emittedLight != null && (
          !isRecord(raw.modifiers.emittedLight) ||
          Object.keys(raw.modifiers.emittedLight).some((key) =>
            !['brightRadiusFeet', 'dimRadiusFeet', 'color', 'sunlight'].includes(key)) ||
          typeof raw.modifiers.emittedLight.brightRadiusFeet !== 'number' ||
          !Number.isInteger(raw.modifiers.emittedLight.brightRadiusFeet) ||
          raw.modifiers.emittedLight.brightRadiusFeet < 0 || raw.modifiers.emittedLight.brightRadiusFeet > 10_000 ||
          typeof raw.modifiers.emittedLight.dimRadiusFeet !== 'number' ||
          !Number.isInteger(raw.modifiers.emittedLight.dimRadiusFeet) ||
          raw.modifiers.emittedLight.dimRadiusFeet < 0 || raw.modifiers.emittedLight.dimRadiusFeet > 10_000 ||
          raw.modifiers.emittedLight.brightRadiusFeet + raw.modifiers.emittedLight.dimRadiusFeet < 1 ||
          typeof raw.modifiers.emittedLight.color !== 'string' ||
          !/^#[0-9a-f]{6}$/i.test(raw.modifiers.emittedLight.color) ||
          (raw.modifiers.emittedLight.sunlight != null && raw.modifiers.emittedLight.sunlight !== true)
        )) issues.push(`activeEffects[${index}].modifiers.emittedLight 无效`)
        if (raw.modifiers.forcedFleeFromSource != null && typeof raw.modifiers.forcedFleeFromSource !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.forcedFleeFromSource 无效`)
        }
        if (raw.modifiers.flySpeedLimitFeet != null && (typeof raw.modifiers.flySpeedLimitFeet !== 'number' || !Number.isFinite(raw.modifiers.flySpeedLimitFeet) || raw.modifiers.flySpeedLimitFeet < 0 || raw.modifiers.flySpeedLimitFeet > 1_000)) issues.push(`activeEffects[${index}].modifiers.flySpeedLimitFeet 无效`)
        if (raw.modifiers.flySpeedFeet != null && (
          typeof raw.modifiers.flySpeedFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.flySpeedFeet) ||
          raw.modifiers.flySpeedFeet <= 0 ||
          raw.modifiers.flySpeedFeet > 1_000
        )) issues.push(`activeEffects[${index}].modifiers.flySpeedFeet 无效`)
        if (raw.modifiers.magicallyHeldAloft != null && raw.modifiers.magicallyHeldAloft !== true) {
          issues.push(`activeEffects[${index}].modifiers.magicallyHeldAloft 无效`)
        }
        if (raw.modifiers.submerged != null && raw.modifiers.submerged !== true) issues.push(`activeEffects[${index}].modifiers.submerged 无效`)
        if (raw.modifiers.jumpDistanceMultiplier != null && (
          typeof raw.modifiers.jumpDistanceMultiplier !== 'number' ||
          !Number.isFinite(raw.modifiers.jumpDistanceMultiplier) ||
          raw.modifiers.jumpDistanceMultiplier < 1 ||
          raw.modifiers.jumpDistanceMultiplier > 10
        )) issues.push(`activeEffects[${index}].modifiers.jumpDistanceMultiplier 无效`)
        if (raw.modifiers.sizeRankDelta != null &&
          raw.modifiers.sizeRankDelta !== -1 && raw.modifiers.sizeRankDelta !== 1) {
          issues.push(`activeEffects[${index}].modifiers.sizeRankDelta 无效`)
        }
        if (raw.modifiers.strengthRollMode != null &&
          raw.modifiers.strengthRollMode !== 'advantage' &&
          raw.modifiers.strengthRollMode !== 'disadvantage') {
          issues.push(`activeEffects[${index}].modifiers.strengthRollMode 无效`)
        }
        if (raw.modifiers.skillCheckBonuses !== undefined && !validSkillCheckBonuses(raw.modifiers.skillCheckBonuses)) issues.push('activeEffects skillCheckBonuses invalid')
        if (raw.modifiers.abilityCheckRules != null && !normalizeDnd5eAbilityCheckRules(raw.modifiers.abilityCheckRules)) {
          issues.push(`activeEffects[${index}].modifiers.abilityCheckRules 无效`)
        }
        if (raw.modifiers.abilityCheckAdvantages != null && (
          !Array.isArray(raw.modifiers.abilityCheckAdvantages) ||
          raw.modifiers.abilityCheckAdvantages.some((entry) => !ABILITIES.has(entry as AbilityKey))
        )) issues.push(`activeEffects[${index}].modifiers.abilityCheckAdvantages 无效`)
        if (raw.modifiers.abilityCheckDisadvantages != null && (
          !Array.isArray(raw.modifiers.abilityCheckDisadvantages) ||
          raw.modifiers.abilityCheckDisadvantages.some((entry) => !ABILITIES.has(entry as AbilityKey))
        )) issues.push(`activeEffects[${index}].modifiers.abilityCheckDisadvantages 无效`)
        if (raw.modifiers.minimumAbilityCheckD20ByAbility != null && (
          !isRecord(raw.modifiers.minimumAbilityCheckD20ByAbility) ||
          Object.entries(raw.modifiers.minimumAbilityCheckD20ByAbility).some(([ability, value]) =>
            !ABILITIES.has(ability as AbilityKey) || typeof value !== 'number' ||
            !Number.isInteger(value) || value < 1 || value > 20)
        )) issues.push(`activeEffects[${index}].modifiers.minimumAbilityCheckD20ByAbility 无效`)
        if (raw.modifiers.ownTurnAttackActionBonus != null && (!Number.isInteger(raw.modifiers.ownTurnAttackActionBonus) || Number(raw.modifiers.ownTurnAttackActionBonus) < 1 || Number(raw.modifiers.ownTurnAttackActionBonus) > 10)) issues.push('activeEffects ownTurnAttackActionBonus invalid')
        if (raw.modifiers.attackActionMinimum != null && (!Number.isInteger(raw.modifiers.attackActionMinimum) || Number(raw.modifiers.attackActionMinimum) < 1 || Number(raw.modifiers.attackActionMinimum) > 10)) issues.push('activeEffects attackActionMinimum invalid')
        if (raw.modifiers.equipmentProficiencies != null && !validEquipmentProficiencies(raw.modifiers.equipmentProficiencies)) issues.push('activeEffects equipmentProficiencies invalid')
        if (raw.modifiers.savingThrowProficiencies != null && (!Array.isArray(raw.modifiers.savingThrowProficiencies) || raw.modifiers.savingThrowProficiencies.length === 0 || raw.modifiers.savingThrowProficiencies.some(entry => !['str','dex','con','int','wis','cha'].includes(String(entry))))) issues.push('activeEffects savingThrowProficiencies invalid')
        if (raw.modifiers.skillExpertise != null && (!Array.isArray(raw.modifiers.skillExpertise) || raw.modifiers.skillExpertise.length === 0 || raw.modifiers.skillExpertise.some(entry => typeof entry !== 'string' || !EFFECT_SKILLS.some(skill => skill.key === entry)))) issues.push('activeEffects skillExpertise invalid')
        if (raw.modifiers.skillCheckAdvantages != null && (
          !Array.isArray(raw.modifiers.skillCheckAdvantages) ||
          raw.modifiers.skillCheckAdvantages.some((entry) => typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
        )) issues.push(`activeEffects[${index}].modifiers.skillCheckAdvantages 无效`)
        if (raw.modifiers.skillCheckDisadvantages != null && (
          !Array.isArray(raw.modifiers.skillCheckDisadvantages) ||
          raw.modifiers.skillCheckDisadvantages.some((entry) => typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
        )) issues.push(`activeEffects[${index}].modifiers.skillCheckDisadvantages 无效`)
        if (
          raw.modifiers.perceptionDisadvantageAgainstOthersThanSource != null &&
          typeof raw.modifiers.perceptionDisadvantageAgainstOthersThanSource !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.perceptionDisadvantageAgainstOthersThanSource 无效`)
        if (raw.modifiers.locationKnownToSource != null && typeof raw.modifiers.locationKnownToSource !== 'boolean') issues.push('activeEffects locationKnownToSource invalid')
        if (raw.modifiers.skillCheckBonusAuras != null && (
          !Array.isArray(raw.modifiers.skillCheckBonusAuras) ||
          raw.modifiers.skillCheckBonusAuras.length === 0 ||
          raw.modifiers.skillCheckBonusAuras.some((aura) =>
            !isRecord(aura) ||
            Object.keys(aura).some((key) => ![
              'skill', 'bonus', 'radiusFeet', 'relation', 'mundaneTracking', 'leavesTracks',
            ].includes(key)) ||
            typeof aura.skill !== 'string' || !EFFECT_SKILLS.some(skill => skill.key === aura.skill) ||
            typeof aura.bonus !== 'number' || !Number.isInteger(aura.bonus) || aura.bonus < -100 || aura.bonus > 100 ||
            typeof aura.radiusFeet !== 'number' || !Number.isInteger(aura.radiusFeet) ||
            aura.radiusFeet < 0 || aura.radiusFeet > 10_000 || aura.relation !== 'ally-and-self' ||
            ((aura.mundaneTracking == null) !== (aura.leavesTracks == null)) ||
            (aura.mundaneTracking != null && aura.mundaneTracking !== 'impossible') ||
            (aura.leavesTracks != null && aura.leavesTracks !== false)
          )
        )) issues.push(`activeEffects[${index}].modifiers.skillCheckBonusAuras 无效`)
        if (raw.modifiers.savingThrowDisadvantages != null && (
          !Array.isArray(raw.modifiers.savingThrowDisadvantages) ||
          raw.modifiers.savingThrowDisadvantages.some((entry) => !ABILITIES.has(entry as AbilityKey))
        )) issues.push(`activeEffects[${index}].modifiers.savingThrowDisadvantages 无效`)
        if (raw.modifiers.savingThrowAdvantages != null && (
          !Array.isArray(raw.modifiers.savingThrowAdvantages) ||
          raw.modifiers.savingThrowAdvantages.some((entry) => !ABILITIES.has(entry as AbilityKey))
        )) issues.push(`activeEffects[${index}].modifiers.savingThrowAdvantages 无效`)
        if (raw.modifiers.deathSavingThrowAdvantage != null &&
          typeof raw.modifiers.deathSavingThrowAdvantage !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.deathSavingThrowAdvantage 无效`)
        }
        if (raw.modifiers.maximizeHealingDiceNearCompanion !== undefined &&
          !normalizeDnd5eOwnedCompanionProximityRules(raw.modifiers.maximizeHealingDiceNearCompanion)) issues.push(`activeEffects[${index}].modifiers.maximizeHealingDiceNearCompanion 无效`)
        if (raw.modifiers.maximizeHealingDice != null &&
          typeof raw.modifiers.maximizeHealingDice !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.maximizeHealingDice 无效`)
        }
        if (raw.modifiers.carryingCapacityMultiplier != null && (
          typeof raw.modifiers.carryingCapacityMultiplier !== 'number' ||
          !Number.isFinite(raw.modifiers.carryingCapacityMultiplier) ||
          raw.modifiers.carryingCapacityMultiplier < 1 ||
          raw.modifiers.carryingCapacityMultiplier > 10
        )) issues.push(`activeEffects[${index}].modifiers.carryingCapacityMultiplier 无效`)
        if (raw.modifiers.safeFallFeet != null && (
          typeof raw.modifiers.safeFallFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.safeFallFeet) ||
          raw.modifiers.safeFallFeet < 0 ||
          raw.modifiers.safeFallFeet > 1_000
        )) issues.push(`activeEffects[${index}].modifiers.safeFallFeet 无效`)
        if (raw.modifiers.controlledDescent != null && (
          !isRecord(raw.modifiers.controlledDescent) ||
          Object.keys(raw.modifiers.controlledDescent).some((key) => ![
            'maximumFeetPerRound', 'safeLanding', 'endsOnLanding', 'forceWhileFlightBlocked',
          ].includes(key)) ||
          typeof raw.modifiers.controlledDescent.maximumFeetPerRound !== 'number' ||
          !Number.isInteger(raw.modifiers.controlledDescent.maximumFeetPerRound) ||
          raw.modifiers.controlledDescent.maximumFeetPerRound < 1 ||
          raw.modifiers.controlledDescent.maximumFeetPerRound > 1_000 ||
          raw.modifiers.controlledDescent.safeLanding !== true ||
          raw.modifiers.controlledDescent.endsOnLanding !== true ||
          (raw.modifiers.controlledDescent.forceWhileFlightBlocked != null && raw.modifiers.controlledDescent.forceWhileFlightBlocked !== true)
        )) issues.push(`activeEffects[${index}].modifiers.controlledDescent 无效`)
        if (raw.modifiers.automaticEscape != null && (
          !isRecord(raw.modifiers.automaticEscape) ||
          Object.keys(raw.modifiers.automaticEscape).some((key) => ![
            'conditions', 'movementCostFeet', 'sourceMagical',
          ].includes(key)) ||
          !Array.isArray(raw.modifiers.automaticEscape.conditions) ||
          raw.modifiers.automaticEscape.conditions.length < 1 ||
          raw.modifiers.automaticEscape.conditions.length > 2 ||
          raw.modifiers.automaticEscape.conditions.some((condition) =>
            condition !== 'grappled' && condition !== 'restrained') ||
          typeof raw.modifiers.automaticEscape.movementCostFeet !== 'number' ||
          !Number.isInteger(raw.modifiers.automaticEscape.movementCostFeet) ||
          raw.modifiers.automaticEscape.movementCostFeet < 0 ||
          raw.modifiers.automaticEscape.movementCostFeet > 1_000 ||
          (raw.modifiers.automaticEscape.sourceMagical != null &&
            typeof raw.modifiers.automaticEscape.sourceMagical !== 'boolean')
        )) issues.push(`activeEffects[${index}].modifiers.automaticEscape 无效`)
        if (raw.modifiers.ignoreMagicalSpeedReductions != null &&
          raw.modifiers.ignoreMagicalSpeedReductions !== true) {
          issues.push(`activeEffects[${index}].modifiers.ignoreMagicalSpeedReductions 无效`)
        }
        if (raw.modifiers.onHitBonusDamage != null && (
          !isRecord(raw.modifiers.onHitBonusDamage) ||
          Object.keys(raw.modifiers.onHitBonusDamage).some((key) => ![
            'count', 'sides', 'bonus', 'damageType', 'appliesTo', 'weaponId',
            'doubleDiceOnCritical', 'oncePerTurn', 'targetCreatureTypes', 'onHitTargetEffect',
            'lastUsedTurnKey', 'consumeEffectOnHit', 'useWeaponDie', 'boundTargetId', 'attackDamageTypeOverride',
          ].includes(key)) ||
          (raw.modifiers.onHitBonusDamage.boundTargetId !== undefined &&
            (typeof raw.modifiers.onHitBonusDamage.boundTargetId !== 'string' || !raw.modifiers.onHitBonusDamage.boundTargetId.trim())) ||
          (raw.modifiers.onHitBonusDamage.attackDamageTypeOverride !== undefined &&
            (!DND5E_DAMAGE_TYPES.includes(raw.modifiers.onHitBonusDamage.attackDamageTypeOverride as Dnd5eDamageType) ||
              typeof raw.modifiers.onHitBonusDamage.boundTargetId !== 'string' || raw.modifiers.onHitBonusDamage.consumeEffectOnHit !== true)) ||
          (raw.modifiers.onHitBonusDamage.useWeaponDie !== undefined &&
            (raw.modifiers.onHitBonusDamage.useWeaponDie !== true || raw.modifiers.onHitBonusDamage.sides !== 2 || Number(raw.modifiers.onHitBonusDamage.count) < 1)) ||
          typeof raw.modifiers.onHitBonusDamage.count !== 'number' ||
          !Number.isInteger(raw.modifiers.onHitBonusDamage.count) ||
          raw.modifiers.onHitBonusDamage.count < 0 || raw.modifiers.onHitBonusDamage.count > 1_000 ||
          typeof raw.modifiers.onHitBonusDamage.sides !== 'number' ||
          !Number.isInteger(raw.modifiers.onHitBonusDamage.sides) ||
          raw.modifiers.onHitBonusDamage.sides < 2 || raw.modifiers.onHitBonusDamage.sides > 10_000 ||
          typeof raw.modifiers.onHitBonusDamage.bonus !== 'number' ||
          !Number.isInteger(raw.modifiers.onHitBonusDamage.bonus) ||
          Math.abs(raw.modifiers.onHitBonusDamage.bonus) > 1_000_000 ||
          (raw.modifiers.onHitBonusDamage.damageType !== 'inherit-primary' &&
            !DND5E_DAMAGE_TYPES.includes(raw.modifiers.onHitBonusDamage.damageType as Dnd5eDamageType)) ||
          !['this-weapon', 'all-weapon-attacks'].includes(String(raw.modifiers.onHitBonusDamage.appliesTo)) ||
          (raw.modifiers.onHitBonusDamage.weaponId != null &&
            typeof raw.modifiers.onHitBonusDamage.weaponId !== 'string') ||
          typeof raw.modifiers.onHitBonusDamage.doubleDiceOnCritical !== 'boolean' ||
          typeof raw.modifiers.onHitBonusDamage.oncePerTurn !== 'boolean' ||
          (raw.modifiers.onHitBonusDamage.targetCreatureTypes != null && (
            !Array.isArray(raw.modifiers.onHitBonusDamage.targetCreatureTypes) ||
            raw.modifiers.onHitBonusDamage.targetCreatureTypes.some((entry) => typeof entry !== 'string')
          )) ||
          (raw.modifiers.onHitBonusDamage.onHitTargetEffect != null && (
            !isRecord(raw.modifiers.onHitBonusDamage.onHitTargetEffect) ||
            Object.keys(raw.modifiers.onHitBonusDamage.onHitTargetEffect).some((key) =>
              !['revealInvisible', 'preventInvisibility', 'emittedLight'].includes(key)) ||
            (raw.modifiers.onHitBonusDamage.onHitTargetEffect.revealInvisible != null &&
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.revealInvisible !== true) ||
            (raw.modifiers.onHitBonusDamage.onHitTargetEffect.preventInvisibility != null &&
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.preventInvisibility !== true) ||
            (raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight != null && (
              !isRecord(raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight) ||
              typeof raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet !== 'number' ||
              !Number.isInteger(raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet) ||
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet < 0 ||
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet > 10_000 ||
              typeof raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet !== 'number' ||
              !Number.isInteger(raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet) ||
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet < 0 ||
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet > 10_000 ||
              raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.brightRadiusFeet +
                raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.dimRadiusFeet < 1 ||
              typeof raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.color !== 'string' ||
              !/^#[0-9a-f]{6}$/i.test(raw.modifiers.onHitBonusDamage.onHitTargetEffect.emittedLight.color)
            ))
          )) ||
          (raw.modifiers.onHitBonusDamage.lastUsedTurnKey != null &&
            typeof raw.modifiers.onHitBonusDamage.lastUsedTurnKey !== 'string') ||
          typeof raw.modifiers.onHitBonusDamage.consumeEffectOnHit !== 'boolean'
        )) issues.push(`activeEffects[${index}].modifiers.onHitBonusDamage 无效`)
        if (raw.modifiers.hitPointMaximumBonus != null && (
          typeof raw.modifiers.hitPointMaximumBonus !== 'number' ||
          !Number.isFinite(raw.modifiers.hitPointMaximumBonus) ||
          raw.modifiers.hitPointMaximumBonus < 0 ||
          raw.modifiers.hitPointMaximumBonus > 1_000_000
        )) issues.push(`activeEffects[${index}].modifiers.hitPointMaximumBonus 无效`)
        if (raw.modifiers.increaseCurrentHitPointsWithMaximum != null &&
          typeof raw.modifiers.increaseCurrentHitPointsWithMaximum !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.increaseCurrentHitPointsWithMaximum 无效`)
        }
        if (raw.modifiers.armorClassBonus != null && (
          typeof raw.modifiers.armorClassBonus !== 'number' ||
          !Number.isFinite(raw.modifiers.armorClassBonus) ||
          raw.modifiers.armorClassBonus < -20 ||
          raw.modifiers.armorClassBonus > 20
        )) issues.push(`activeEffects[${index}].modifiers.armorClassBonus 无效`)
        if (raw.modifiers.cohortArmorClass != null && !normalizeDnd5eCohortArmorClass(raw.modifiers.cohortArmorClass)) {
          issues.push(`activeEffects[${index}].modifiers.cohortArmorClass 无效`)
        }
        if (raw.modifiers.sourceProximityAttackAdvantage !== undefined && !validDnd5eSourceProximityAttack(raw.modifiers.sourceProximityAttackAdvantage)) {
          issues.push(`activeEffects[${index}].modifiers.sourceProximityAttackAdvantage 无效`)
        }
        if (raw.modifiers.attacksAgainstSourceArmorClassBonus != null && (
          typeof raw.modifiers.attacksAgainstSourceArmorClassBonus !== 'number' ||
          !Number.isInteger(raw.modifiers.attacksAgainstSourceArmorClassBonus) ||
          raw.modifiers.attacksAgainstSourceArmorClassBonus < -20 ||
          raw.modifiers.attacksAgainstSourceArmorClassBonus > 20
        )) issues.push(`activeEffects[${index}].modifiers.attacksAgainstSourceArmorClassBonus 无效`)
        if (raw.modifiers.savingThrowBonus != null && (
          typeof raw.modifiers.savingThrowBonus !== 'number' ||
          !Number.isFinite(raw.modifiers.savingThrowBonus) ||
          raw.modifiers.savingThrowBonus < -20 ||
          raw.modifiers.savingThrowBonus > 20
        )) issues.push(`activeEffects[${index}].modifiers.savingThrowBonus 无效`)
        if (raw.modifiers.savingThrowBonusByAbility != null && (
          typeof raw.modifiers.savingThrowBonusByAbility !== 'object' ||
          Array.isArray(raw.modifiers.savingThrowBonusByAbility) ||
          Object.entries(raw.modifiers.savingThrowBonusByAbility).some(([ability, value]) =>
            !ABILITIES.has(ability as AbilityKey) ||
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < -20 ||
            value > 20
          )
        )) issues.push(`activeEffects[${index}].modifiers.savingThrowBonusByAbility 无效`)
        if (raw.modifiers.rollDiceModifiers != null && !normalizeDnd5eRollDiceModifiers(raw.modifiers.rollDiceModifiers)) {
          issues.push(`activeEffects[${index}].modifiers.rollDiceModifiers 无效`)
        }
        if (raw.modifiers.optionalBonusDie != null && (
          !isRecord(raw.modifiers.optionalBonusDie) ||
          !OPTIONAL_BONUS_DIE_SIDES.has(raw.modifiers.optionalBonusDie.sides as number) ||
          !Array.isArray(raw.modifiers.optionalBonusDie.appliesTo) ||
          raw.modifiers.optionalBonusDie.appliesTo.length === 0 ||
          raw.modifiers.optionalBonusDie.appliesTo.some((entry) =>
            !OPTIONAL_BONUS_DIE_ROLL_KINDS.has(entry as Dnd5eOptionalBonusDieRollKind)
          ) ||
          typeof raw.modifiers.optionalBonusDie.consumeOnUse !== 'boolean' ||
          (raw.modifiers.optionalBonusDie.boundTargetSource !== undefined &&
            !validDnd5eOptionalBonusDieSourceConstraint(raw.modifiers.optionalBonusDie.boundTargetSource))
        )) issues.push(`activeEffects[${index}].modifiers.optionalBonusDie 无效`)
        if (
          raw.modifiers.attackRollAdvantage != null &&
          typeof raw.modifiers.attackRollAdvantage !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.attackRollAdvantage 无效`)
        if (raw.modifiers.weaponCategoryRollModes !== undefined && !validWeaponCategoryRollModes(raw.modifiers.weaponCategoryRollModes)) issues.push('activeEffects weaponCategoryRollModes invalid')
        for (const key of ['weaponAttackRollAdvantage', 'weaponAttackRollDisadvantage'] as const) {
          if (raw.modifiers[key] != null && typeof raw.modifiers[key] !== 'boolean') issues.push(`activeEffects[${index}].modifiers.${key} 无效`)
        }
        if (
          raw.modifiers.attackRollDisadvantage != null &&
          typeof raw.modifiers.attackRollDisadvantage !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.attackRollDisadvantage 无效`)
        if (raw.modifiers.attackRollDisadvantageAbilities != null && (
          !Array.isArray(raw.modifiers.attackRollDisadvantageAbilities) ||
          raw.modifiers.attackRollDisadvantageAbilities.some((entry) => !ABILITIES.has(entry as AbilityKey))
        )) issues.push(`activeEffects[${index}].modifiers.attackRollDisadvantageAbilities is invalid`)
        if (raw.modifiers.attackRollAdvantageAbilities != null && (
          !Array.isArray(raw.modifiers.attackRollAdvantageAbilities) ||
          raw.modifiers.attackRollAdvantageAbilities.some((entry) => !ABILITIES.has(entry as AbilityKey))
        )) issues.push(`activeEffects[${index}].modifiers.attackRollAdvantageAbilities is invalid`)
        if (
          raw.modifiers.attacksAgainstTargetAdvantage != null &&
          typeof raw.modifiers.attacksAgainstTargetAdvantage !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.attacksAgainstTargetAdvantage is invalid`)
        if (
          raw.modifiers.attacksAgainstTargetDisadvantage != null &&
          typeof raw.modifiers.attacksAgainstTargetDisadvantage !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.attacksAgainstTargetDisadvantage is invalid`)
        if (raw.modifiers.speedAfterOwnTurnWeaponAttackActionOnly != null &&
          typeof raw.modifiers.speedAfterOwnTurnWeaponAttackActionOnly !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.speedAfterOwnTurnWeaponAttackActionOnly is invalid`)
        }
        if (raw.modifiers.walkingSpeedBonusFeet != null && (typeof raw.modifiers.walkingSpeedBonusFeet !== 'number' ||
          !Number.isInteger(raw.modifiers.walkingSpeedBonusFeet) || raw.modifiers.walkingSpeedBonusFeet < 1 || raw.modifiers.walkingSpeedBonusFeet > 1000)) {
          issues.push(`activeEffects[${index}].modifiers.walkingSpeedBonusFeet is invalid`)
        }
        if (raw.modifiers.speedAfterOwnTurnWeaponAttackFeet != null && (
          typeof raw.modifiers.speedAfterOwnTurnWeaponAttackFeet !== 'number' ||
          !Number.isInteger(raw.modifiers.speedAfterOwnTurnWeaponAttackFeet) ||
          raw.modifiers.speedAfterOwnTurnWeaponAttackFeet < 1 || raw.modifiers.speedAfterOwnTurnWeaponAttackFeet > 1000
        )) issues.push(`activeEffects[${index}].modifiers.speedAfterOwnTurnWeaponAttackFeet is invalid`)
        if (raw.modifiers.damageRollsBySourceBonus != null && (typeof raw.modifiers.damageRollsBySourceBonus !== 'number' || !Number.isInteger(raw.modifiers.damageRollsBySourceBonus) || Math.abs(raw.modifiers.damageRollsBySourceBonus) > 1000)) issues.push(`activeEffects[${index}].modifiers.damageRollsBySourceBonus is invalid`)
        if (raw.modifiers.attacksBySourceCriticalThreshold != null && (
          typeof raw.modifiers.attacksBySourceCriticalThreshold !== 'number' || !Number.isInteger(raw.modifiers.attacksBySourceCriticalThreshold) ||
          raw.modifiers.attacksBySourceCriticalThreshold < 2 || raw.modifiers.attacksBySourceCriticalThreshold > 20
        )) issues.push(`activeEffects[${index}].modifiers.attacksBySourceCriticalThreshold is invalid`)
        if (
          raw.modifiers.preventMovementOpportunityAttacks != null &&
          typeof raw.modifiers.preventMovementOpportunityAttacks !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.preventMovementOpportunityAttacks is invalid`)
        if (raw.modifiers.randomVisibleCreatureTargets != null &&
          typeof raw.modifiers.randomVisibleCreatureTargets !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.randomVisibleCreatureTargets is invalid`)
        if (raw.modifiers.mandatoryOpportunityAttacks != null &&
          typeof raw.modifiers.mandatoryOpportunityAttacks !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.mandatoryOpportunityAttacks is invalid`)
        if (raw.modifiers.perceiveVisibleCreaturesAsHostile != null &&
          typeof raw.modifiers.perceiveVisibleCreaturesAsHostile !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.perceiveVisibleCreaturesAsHostile is invalid`)
        if (
          raw.modifiers.cannotBeSurprisedWhileConscious != null &&
          typeof raw.modifiers.cannotBeSurprisedWhileConscious !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.cannotBeSurprisedWhileConscious is invalid`)
        if (raw.modifiers.preventsRevival != null && typeof raw.modifiers.preventsRevival !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.preventsRevival is invalid`)
        }
        if (raw.modifiers.nextD20AdvantageRollKinds != null && (!Array.isArray(raw.modifiers.nextD20AdvantageRollKinds) ||
          raw.modifiers.nextD20AdvantageRollKinds.length < 1 || raw.modifiers.nextD20AdvantageRollKinds.length > 3 ||
          new Set(raw.modifiers.nextD20AdvantageRollKinds).size !== raw.modifiers.nextD20AdvantageRollKinds.length ||
          raw.modifiers.nextD20AdvantageRollKinds.some(kind => !['attack', 'ability-check', 'saving-throw'].includes(kind)))) {
          issues.push(`activeEffects[${index}].modifiers.nextD20AdvantageRollKinds is invalid`)
        }
        if (
          raw.modifiers.attackDisadvantageAgainstOthersThanSource != null &&
          typeof raw.modifiers.attackDisadvantageAgainstOthersThanSource !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.attackDisadvantageAgainstOthersThanSource 无效`)
        if (raw.modifiers.notifySourceOnBearerDamage != null && raw.modifiers.notifySourceOnBearerDamage !== true) {
          issues.push(`activeEffects[${index}].modifiers.notifySourceOnBearerDamage 无效`)
        }
        if (raw.modifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet != null &&
          (raw.modifiers.attackDisadvantageAgainstOthersThanSource !== true ||
            typeof raw.modifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet !== 'number' ||
            !Number.isFinite(raw.modifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet) ||
            raw.modifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet < 0 ||
            raw.modifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet > 10000)) {
          issues.push(`activeEffects[${index}].modifiers.attackDisadvantageAgainstOthersThanSourceRangeFeet 无效`)
        }
        if (
          raw.modifiers.nextAttackAdvantageByOtherThanSource != null &&
          typeof raw.modifiers.nextAttackAdvantageByOtherThanSource !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.nextAttackAdvantageByOtherThanSource 无效`)
        if (
          raw.modifiers.resistanceToAllDamage != null &&
          typeof raw.modifiers.resistanceToAllDamage !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.resistanceToAllDamage 无效`)
        if (raw.modifiers.nextSourceOrAllyAttackVulnerability != null &&
          typeof raw.modifiers.nextSourceOrAllyAttackVulnerability !== 'boolean')
          issues.push(`activeEffects[${index}].modifiers.nextSourceOrAllyAttackVulnerability is invalid`)
        if (
          raw.modifiers.vulnerabilityToAllDamage != null &&
          typeof raw.modifiers.vulnerabilityToAllDamage !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.vulnerabilityToAllDamage is invalid`)
        if (raw.modifiers.weaponDamageD4 != null &&
          raw.modifiers.weaponDamageD4 !== 'add' &&
          raw.modifiers.weaponDamageD4 !== 'subtract') {
          issues.push(`activeEffects[${index}].modifiers.weaponDamageD4 无效`)
        }
        if (raw.modifiers.preventReactions != null && typeof raw.modifiers.preventReactions !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.preventReactions 无效`)
        }
        if (raw.modifiers.preventHealing != null && typeof raw.modifiers.preventHealing !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.preventHealing 无效`)
        }
        if (
          raw.modifiers.preventNonmagicalHealing != null &&
          typeof raw.modifiers.preventNonmagicalHealing !== 'boolean'
        ) issues.push(`activeEffects[${index}].modifiers.preventNonmagicalHealing 无效`)
        if (raw.modifiers.damageResistance != null && !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(raw.modifiers.damageResistance)) {
          issues.push(`activeEffects[${index}].modifiers.damageResistance 无效`)
        }
        if (raw.modifiers.suppressDamageResistance != null && !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(raw.modifiers.suppressDamageResistance)) {
          issues.push(`activeEffects[${index}].modifiers.suppressDamageResistance 无效`)
        }
        if (raw.modifiers.conditionalDamageResistances != null && (
          !Array.isArray(raw.modifiers.conditionalDamageResistances) ||
          raw.modifiers.conditionalDamageResistances.length === 0 ||
          raw.modifiers.conditionalDamageResistances.some((rule) =>
            !isRecord(rule) ||
            Object.keys(rule).some((key) => !['damageTypes', 'sourceMagical', 'attackOnly', 'deliveries', 'sourceAura'].includes(key)) ||
            !Array.isArray(rule.damageTypes) || rule.damageTypes.length === 0 ||
            rule.damageTypes.some((entry) => !DND5E_DAMAGE_TYPES.includes(entry as Dnd5eDamageType)) ||
            (rule.sourceMagical != null && typeof rule.sourceMagical !== 'boolean') ||
            (rule.attackOnly != null && typeof rule.attackOnly !== 'boolean') ||
            (rule.sourceAura != null && !isDnd5eSourceAuraRequirement(rule.sourceAura)) ||
            (rule.deliveries != null && (
              !Array.isArray(rule.deliveries) || rule.deliveries.length === 0 ||
              rule.deliveries.some((entry) => !['weapon-attack', 'spell', 'other'].includes(String(entry)))
            ))
          )
        )) issues.push(`activeEffects[${index}].modifiers.conditionalDamageResistances 无效`)
        if (raw.modifiers.weaponDamageMultipliers != null && (
          !Array.isArray(raw.modifiers.weaponDamageMultipliers) ||
          raw.modifiers.weaponDamageMultipliers.length === 0 ||
          raw.modifiers.weaponDamageMultipliers.some((rule) =>
            !isRecord(rule) ||
            Object.keys(rule).some((key) => !['multiplier', 'ability', 'attackModes'].includes(key)) ||
            typeof rule.multiplier !== 'number' || !Number.isFinite(rule.multiplier) ||
            rule.multiplier < 0 || rule.multiplier > 10 ||
            (rule.ability != null && rule.ability !== 'str' && rule.ability !== 'dex') ||
            (rule.attackModes != null && (
              !Array.isArray(rule.attackModes) || rule.attackModes.length === 0 ||
              rule.attackModes.some((entry) => entry !== 'melee' && entry !== 'ranged')
            ))
          )
        )) issues.push(`activeEffects[${index}].modifiers.weaponDamageMultipliers 无效`)
        if (raw.modifiers.weaponDamageReplacementAttackModes != null && (
          !Array.isArray(raw.modifiers.weaponDamageReplacementAttackModes) ||
          raw.modifiers.weaponDamageReplacementAttackModes.length < 1 ||
          raw.modifiers.weaponDamageReplacementAttackModes.length > 2 ||
          raw.modifiers.weaponDamageReplacementAttackModes.some((mode) => mode !== 'melee' && mode !== 'ranged') ||
          new Set(raw.modifiers.weaponDamageReplacementAttackModes).size !== raw.modifiers.weaponDamageReplacementAttackModes.length
        )) issues.push(`activeEffects[${index}].modifiers.weaponDamageReplacementAttackModes 无效`)
        if (raw.modifiers.movementBoundarySave != null && (
          !isRecord(raw.modifiers.movementBoundarySave) ||
          typeof raw.modifiers.movementBoundarySave.maximumDistanceFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.movementBoundarySave.maximumDistanceFeet) ||
          raw.modifiers.movementBoundarySave.maximumDistanceFeet < 0 ||
          raw.modifiers.movementBoundarySave.maximumDistanceFeet > 10_000 ||
          !ABILITIES.has(raw.modifiers.movementBoundarySave.ability as AbilityKey) ||
          typeof raw.modifiers.movementBoundarySave.dc !== 'number' ||
          !Number.isInteger(raw.modifiers.movementBoundarySave.dc) ||
          raw.modifiers.movementBoundarySave.dc < 1 ||
          raw.modifiers.movementBoundarySave.dc > 100
        )) issues.push(`activeEffects[${index}].modifiers.movementBoundarySave 无效`)
        if (raw.modifiers.damageImmunity != null && !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(raw.modifiers.damageImmunity)) {
          issues.push(`activeEffects[${index}].modifiers.damageImmunity 无效`)
        }
        if (raw.modifiers.damageVulnerability != null && !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(raw.modifiers.damageVulnerability)) {
          issues.push(`activeEffects[${index}].modifiers.damageVulnerability 无效`)
        }
        if (raw.modifiers.conditionImmunities != null && (
          !Array.isArray(raw.modifiers.conditionImmunities) ||
          raw.modifiers.conditionImmunities.some((entry) =>
            !(DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(entry),
          )
        )) issues.push(`activeEffects[${index}].modifiers.conditionImmunities 无效`)
        if (raw.modifiers.weaponAttacksAgainstTarget != null && !normalizeDnd5eIncomingWeaponAttackModifiers(raw.modifiers.weaponAttacksAgainstTarget)) {
          issues.push(`activeEffects[${index}].modifiers.weaponAttacksAgainstTarget is invalid`)
        }
        if (raw.modifiers.attacksAgainstTargetDisadvantageCreatureTypes != null && (
          !Array.isArray(raw.modifiers.attacksAgainstTargetDisadvantageCreatureTypes) ||
          raw.modifiers.attacksAgainstTargetDisadvantageCreatureTypes.length < 1 ||
          raw.modifiers.attacksAgainstTargetDisadvantageCreatureTypes.length > 32 ||
          raw.modifiers.attacksAgainstTargetDisadvantageCreatureTypes.some((entry) =>
            typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
        )) issues.push(`activeEffects[${index}].modifiers.attacksAgainstTargetDisadvantageCreatureTypes 无效`)
        if (raw.modifiers.conditionImmunitiesBySourceCreatureType != null && (
          !Array.isArray(raw.modifiers.conditionImmunitiesBySourceCreatureType) ||
          raw.modifiers.conditionImmunitiesBySourceCreatureType.length < 1 ||
          raw.modifiers.conditionImmunitiesBySourceCreatureType.length > 32 ||
          raw.modifiers.conditionImmunitiesBySourceCreatureType.some((rule) =>
            !isRecord(rule) ||
            !Array.isArray(rule.conditions) || rule.conditions.length < 1 ||
            rule.conditions.some((condition) =>
              typeof condition !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(condition)) ||
            !Array.isArray(rule.sourceCreatureTypes) || rule.sourceCreatureTypes.length < 1 ||
            rule.sourceCreatureTypes.some((entry) =>
              typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
          )
        )) issues.push(`activeEffects[${index}].modifiers.conditionImmunitiesBySourceCreatureType 无效`)
        if (raw.modifiers.conditionImmunitiesBySourceMagic != null && (
          !Array.isArray(raw.modifiers.conditionImmunitiesBySourceMagic) ||
          raw.modifiers.conditionImmunitiesBySourceMagic.length < 1 ||
          raw.modifiers.conditionImmunitiesBySourceMagic.length > 32 ||
          raw.modifiers.conditionImmunitiesBySourceMagic.some((rule) =>
            !isRecord(rule) ||
            !Array.isArray(rule.conditions) || rule.conditions.length < 1 ||
            rule.conditions.some((condition) =>
              typeof condition !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(condition)) ||
            typeof rule.sourceMagical !== 'boolean' ||
            (rule.suppressExisting != null && rule.suppressExisting !== true)
          )
        )) issues.push(`activeEffects[${index}].modifiers.conditionImmunitiesBySourceMagic 无效`)
        if (raw.modifiers.calmEmotionsIndifferentTargetIds != null && (
          !Array.isArray(raw.modifiers.calmEmotionsIndifferentTargetIds) ||
          raw.modifiers.calmEmotionsIndifferentTargetIds.length < 1 ||
          raw.modifiers.calmEmotionsIndifferentTargetIds.length > 100 ||
          raw.modifiers.calmEmotionsIndifferentTargetIds.some((entry) =>
            typeof entry !== 'string' || entry.trim().length === 0 || entry.length > 240) ||
          new Set(raw.modifiers.calmEmotionsIndifferentTargetIds).size !==
            raw.modifiers.calmEmotionsIndifferentTargetIds.length
        )) issues.push(`activeEffects[${index}].modifiers.calmEmotionsIndifferentTargetIds 无效`)
        if (raw.modifiers.savingThrowAdvantagesBySourceCreatureType != null && (
          !Array.isArray(raw.modifiers.savingThrowAdvantagesBySourceCreatureType) ||
          raw.modifiers.savingThrowAdvantagesBySourceCreatureType.length < 1 ||
          raw.modifiers.savingThrowAdvantagesBySourceCreatureType.length > 32 ||
          raw.modifiers.savingThrowAdvantagesBySourceCreatureType.some((rule) =>
            !isRecord(rule) ||
            !Array.isArray(rule.conditions) || rule.conditions.length < 1 ||
            rule.conditions.some((condition) =>
              typeof condition !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(condition)) ||
            !Array.isArray(rule.sourceCreatureTypes) || rule.sourceCreatureTypes.length < 1 ||
            rule.sourceCreatureTypes.some((entry) =>
              typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
          )
        )) issues.push(`activeEffects[${index}].modifiers.savingThrowAdvantagesBySourceCreatureType 无效`)
        if (raw.modifiers.shillelagh != null && (
          !isRecord(raw.modifiers.shillelagh) ||
          typeof raw.modifiers.shillelagh.weaponId !== 'string' ||
          raw.modifiers.shillelagh.weaponId.trim().length === 0 ||
          raw.modifiers.shillelagh.weaponId.length > 200 ||
          !ABILITIES.has(raw.modifiers.shillelagh.spellcastingAbility as AbilityKey) ||
          typeof raw.modifiers.shillelagh.spellcastingModifier !== 'number' ||
          !Number.isInteger(raw.modifiers.shillelagh.spellcastingModifier) ||
          raw.modifiers.shillelagh.spellcastingModifier < -10 ||
          raw.modifiers.shillelagh.spellcastingModifier > 20
        )) issues.push(`activeEffects[${index}].modifiers.shillelagh 无效`)
        if (raw.modifiers.magicWeapon != null && (
          !isRecord(raw.modifiers.magicWeapon) ||
          typeof raw.modifiers.magicWeapon.weaponId !== 'string' ||
          raw.modifiers.magicWeapon.weaponId.trim().length === 0 ||
          raw.modifiers.magicWeapon.weaponId.length > 200 ||
          (raw.modifiers.magicWeapon.bonus !== 1 &&
            raw.modifiers.magicWeapon.bonus !== 2 &&
            raw.modifiers.magicWeapon.bonus !== 3)
        )) issues.push(`activeEffects[${index}].modifiers.magicWeapon 无效`)
        if (raw.modifiers.armorEnchantment != null && !validArmorEnchantment(raw.modifiers.armorEnchantment)) issues.push(`activeEffects[${index}].modifiers.armorEnchantment 无效`)
        if (raw.modifiers.weaponEnchantment != null && (
          !isRecord(raw.modifiers.weaponEnchantment) ||
          (raw.modifiers.weaponEnchantment.sourceWielderOnly != null && (raw.modifiers.weaponEnchantment.sourceWielderOnly !== true || raw.modifiers.weaponEnchantment.ammunitionContainer === true)) ||
          (raw.modifiers.weaponEnchantment.spellcastingFocusClassIds != null && (!validWeaponFocusClassIds(raw.modifiers.weaponEnchantment.spellcastingFocusClassIds) || !raw.modifiers.weaponEnchantment.inventoryInstanceId || raw.modifiers.weaponEnchantment.ammunitionContainer === true)) ||
          (raw.modifiers.weaponEnchantment.ammunitionContainer != null && typeof raw.modifiers.weaponEnchantment.ammunitionContainer !== 'boolean') ||
          (raw.modifiers.weaponEnchantment.consumeOnDraw != null && (raw.modifiers.weaponEnchantment.consumeOnDraw !== true || raw.modifiers.weaponEnchantment.ammunitionContainer !== true || raw.modifiers.weaponEnchantment.remainingAttacks == null)) ||
          (raw.modifiers.weaponEnchantment.ammunitionStack != null && (raw.modifiers.weaponEnchantment.ammunitionStack !== true || raw.modifiers.weaponEnchantment.ammunitionContainer === true || !raw.modifiers.weaponEnchantment.inventoryInstanceId || !raw.modifiers.weaponEnchantment.drawSourceEffectId || raw.modifiers.weaponEnchantment.remainingAttacks == null)) ||
          (raw.modifiers.weaponEnchantment.weaponIds != null && (!Array.isArray(raw.modifiers.weaponEnchantment.weaponIds) || raw.modifiers.weaponEnchantment.weaponIds.length>256 || raw.modifiers.weaponEnchantment.weaponIds.some(id=>typeof id!=='string' || !id || id.length>200))) ||
          typeof raw.modifiers.weaponEnchantment.weaponId !== 'string' ||
          raw.modifiers.weaponEnchantment.weaponId.trim().length === 0 ||
          raw.modifiers.weaponEnchantment.weaponId.length > 200 ||
          (raw.modifiers.weaponEnchantment.inventoryInstanceId != null && (typeof raw.modifiers.weaponEnchantment.inventoryInstanceId !== 'string' || !raw.modifiers.weaponEnchantment.inventoryInstanceId || raw.modifiers.weaponEnchantment.inventoryInstanceId.length > 200)) ||
          !Number.isInteger(raw.modifiers.weaponEnchantment.attackAndDamageBonus) ||
          typeof raw.modifiers.weaponEnchantment.attackAndDamageBonus !== 'number' ||
          raw.modifiers.weaponEnchantment.attackAndDamageBonus < 0 ||
          raw.modifiers.weaponEnchantment.attackAndDamageBonus > 3 ||
          (raw.modifiers.weaponEnchantment.remainingAttacks != null && (typeof raw.modifiers.weaponEnchantment.remainingAttacks !== 'number' || !Number.isInteger(raw.modifiers.weaponEnchantment.remainingAttacks) || raw.modifiers.weaponEnchantment.remainingAttacks < 1 || raw.modifiers.weaponEnchantment.remainingAttacks > 1000)) ||
          (raw.modifiers.weaponEnchantment.bonusDamage != null && (
            !isRecord(raw.modifiers.weaponEnchantment.bonusDamage) ||
            !Number.isInteger(raw.modifiers.weaponEnchantment.bonusDamage.count) ||
            typeof raw.modifiers.weaponEnchantment.bonusDamage.count !== 'number' ||
            raw.modifiers.weaponEnchantment.bonusDamage.count < 1 ||
            raw.modifiers.weaponEnchantment.bonusDamage.count > 40 ||
            !Number.isInteger(raw.modifiers.weaponEnchantment.bonusDamage.sides) ||
            typeof raw.modifiers.weaponEnchantment.bonusDamage.sides !== 'number' ||
            raw.modifiers.weaponEnchantment.bonusDamage.sides < 2 ||
            raw.modifiers.weaponEnchantment.bonusDamage.sides > 100 ||
            !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(raw.modifiers.weaponEnchantment.bonusDamage.type) ||
            (raw.modifiers.weaponEnchantment.bonusDamage.magical != null &&
              typeof raw.modifiers.weaponEnchantment.bonusDamage.magical !== 'boolean')
          ))
        )) issues.push(`activeEffects[${index}].modifiers.weaponEnchantment 无效`)
        if (raw.modifiers.attackProfiles != null && (
          !Array.isArray(raw.modifiers.attackProfiles) || raw.modifiers.attackProfiles.length === 0 ||
          raw.modifiers.attackProfiles.some((profile) =>
            !isRecord(profile) || !Array.isArray(profile.attackModes) || profile.attackModes.length === 0 ||
            profile.attackModes.some((mode) => mode !== 'melee' && mode !== 'ranged' && mode !== 'unarmed') ||
            (profile.weaponIds != null && (!Array.isArray(profile.weaponIds) || profile.weaponIds.some((id) =>
              typeof id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(id)))) ||
            (profile.reachBonusFeet != null && (
              typeof profile.reachBonusFeet !== 'number' || !Number.isFinite(profile.reachBonusFeet) ||
              profile.reachBonusFeet < 0 || profile.reachBonusFeet > 1_000)) ||
            (profile.damageTypeOverride != null &&
              !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(profile.damageTypeOverride)) ||
            (profile.criticalThreshold != null && (!Number.isInteger(profile.criticalThreshold) || Number(profile.criticalThreshold) < 2 || Number(profile.criticalThreshold) > 20)) ||
            (profile.reachBonusFeet == null && profile.criticalThreshold == null && profile.damageTypeOverride == null)
          )
        )) issues.push(`activeEffects[${index}].modifiers.attackProfiles 无效`)
      }
    }
  }
  return { ok: issues.length === 0, effects, issues: [...new Set(issues)] }
}

export function dnd5eActiveEffectIsSuspended(
  effect: Pick<Dnd5eActiveEffectInstance, 'suspendedBy'>,
): boolean {
  return (effect.suspendedBy?.length ?? 0) > 0
}

/** Returns only effects whose mechanics currently participate in resolution. */
export function effectiveDnd5eActiveEffects(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectInstance[] {
  const unsuspended = normalizeDnd5eActiveEffects(effects).filter(
    (effect) => !dnd5eActiveEffectIsSuspended(effect) && effect.grantedActivityCharges?.current !== 0,
  )
  const suppressions = unsuspended.flatMap((effect) =>
    effect.modifiers?.conditionImmunitiesBySourceMagic?.filter((rule) => rule.suppressExisting === true) ?? [])
  if (!suppressions.length) return unsuspended
  return unsuspended.filter((effect) => {
    const condition = effect.standardCondition ?? effect.legacyCondition
    if (!condition) return true
    const normalizedCondition = dnd5eStandardConditionId(condition) ?? condition.trim().toLowerCase()
    return !suppressions.some((rule) =>
      (effect.source.magical === true) === rule.sourceMagical &&
      rule.conditions.some((candidate) =>
        (dnd5eStandardConditionId(candidate) ?? candidate.trim().toLowerCase()) === normalizedCondition))
  })
}

/**
 * Migrates the duplicated repeat-save lifecycle emitted by older compound
 * Activity effects. The extension row is the root and any standard-condition
 * projection follows it, so every turn boundary asks for exactly one d20.
 */
export function reconcileDnd5eCompoundRepeatSaveEffects(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectInstance[] {
  const normalized = normalizeDnd5eActiveEffects(effects)
  const roots = normalized.filter((effect) =>
    effect.repeatSave != null && effect.definitionId.endsWith(':extension'))
  if (roots.length === 0) return normalized
  return normalized.map((effect) => {
    if (!effect.repeatSave || effect.definitionId.endsWith(':extension')) return effect
    const root = roots.find((candidate) =>
      candidate.source.actorId === effect.source.actorId &&
      candidate.source.rulesId === effect.source.rulesId &&
      candidate.definitionId.slice(0, -':extension'.length) === effect.definitionId)
    return root
      ? { ...effect, repeatSave: undefined, dependsOnEffectId: root.id }
      : effect
  })
}

export function dnd5eActiveSpeedPenalty(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  const active = effectiveDnd5eActiveEffects(effects)
  const ignoresMagical = active.some((effect) => effect.modifiers?.ignoreMagicalSpeedReductions === true)
  return active.reduce(
    (total, effect) => total + (
      ignoresMagical && effect.source.magical === true
        ? 0
        : Math.max(0, effect.modifiers?.speedPenaltyFeet ?? 0)
    ),
    0,
  )
}

export function dnd5eActiveSpeedBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (total, effect) => total + Math.max(0, effect.modifiers?.speedBonusFeet ?? 0),
    0,
  )
}

/** Independent multipliers compose; for example Haste x2 and Slow x0.5 cancel. */
export function dnd5eActiveSpeedMultiplier(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  const active = effectiveDnd5eActiveEffects(effects)
  const ignoresMagical = active.some((effect) => effect.modifiers?.ignoreMagicalSpeedReductions === true)
  return active.reduce(
    (multiplier, effect) => {
      const factor = effect.modifiers?.speedMultiplier ?? 1
      return multiplier * (ignoresMagical && effect.source.magical === true && factor < 1 ? 1 : factor)
    },
    1,
  )
}

/**
 * Whether one projected condition may still reduce speed after contextual
 * magical-speed protection is applied. A legacy/static condition with no
 * source Effect remains authoritative because its provenance is unknown.
 */
export function dnd5eActiveConditionSpeedReductionApplies(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  condition: string,
): boolean {
  const normalized = normalizeDnd5eActiveEffects(effects).filter(
    (effect) => !dnd5eActiveEffectIsSuspended(effect) && effect.grantedActivityCharges?.current !== 0,
  )
  const active = effectiveDnd5eActiveEffects(normalized)
  if (!active.some((effect) => effect.modifiers?.ignoreMagicalSpeedReductions === true)) return true
  const standard = dnd5eStandardConditionId(condition)
  if (!standard) return true
  const matching = normalized.filter((effect) => effect.standardCondition === standard)
  return matching.length === 0 || matching.some((effect) => effect.source.magical !== true)
}

/** The smallest active attack cap wins. */
export function dnd5eActiveMaximumAttacksPerTurn(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number | undefined {
  const caps = effectiveDnd5eActiveEffects(effects)
    .map((effect) => effect.modifiers?.maximumAttacksPerTurn)
    .filter((cap): cap is number => cap != null)
  return caps.length > 0 ? Math.min(...caps) : undefined
}

export function dnd5eActiveActionOrBonusActionOnly(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.actionOrBonusActionOnly === true,
  )
}

/** The earliest active threshold wins when several effects delay action spells. */
export function dnd5eActiveActionSpellDelay(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): { dieSides: 20; delayMinimum: number } | undefined {
  const delays = effectiveDnd5eActiveEffects(effects)
    .map((effect) => effect.modifiers?.actionSpellDelay)
    .filter((delay): delay is NonNullable<typeof delay> => delay != null)
  if (delays.length === 0) return undefined
  return delays.reduce((strictest, delay) =>
    delay.delayMinimum < strictest.delayMinimum ? delay : strictest)
}

export interface Dnd5eActiveActionRestriction {
  prohibited: readonly ('attack' | 'spellcasting' | 'object-interaction' | 'speech')[]
  allowedBasicActions?: readonly ('dash' | 'dismiss-effect')[]
  allowedActivityIds?: readonly string[]
}

/** Combines live restrictions without letting one Effect loosen another. */
export function dnd5eActiveActionRestriction(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveActionRestriction | undefined {
  const restrictions = effectiveDnd5eActiveEffects(effects)
    .map((effect) => effect.modifiers?.actionRestriction)
    .filter((restriction): restriction is NonNullable<typeof restriction> => restriction != null)
  if (restrictions.length === 0) return undefined
  const allowedLists = restrictions
    .map((restriction) => restriction.allowedBasicActions)
    .filter((actions): actions is NonNullable<typeof actions> => actions != null)
  const allowedBasicActions = allowedLists.length > 0
    ? allowedLists.reduce<('dash' | 'dismiss-effect')[]>((intersection, actions) =>
        intersection.filter((action) => actions.includes(action)), [...allowedLists[0]!])
    : undefined
  const allowedActivityLists = restrictions
    .map((restriction) => restriction.allowedActivityIds)
    .filter((activityIds): activityIds is NonNullable<typeof activityIds> => activityIds != null)
  const allowedActivityIds = allowedActivityLists.length > 0
    ? allowedActivityLists.reduce<string[]>((intersection, activityIds) =>
        intersection.filter((activityId) => activityIds.includes(activityId)), [...allowedActivityLists[0]!])
    : undefined
  return {
    prohibited: [...new Set(restrictions.flatMap((restriction) => restriction.prohibited))],
    ...(allowedBasicActions ? { allowedBasicActions } : {}),
    ...(allowedActivityIds ? { allowedActivityIds } : {}),
  }
}

export function dnd5eActiveDarkvisionRangeFeet(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (maximum, effect) => Math.max(maximum, effect.modifiers?.darkvisionRangeFeet ?? 0),
    0,
  )
}

export function dnd5eActiveEffectsSeeInvisible(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.seeInvisible === true,
  )
}

function dnd5eActiveEffectIsGaseousForm(effect: Dnd5eActiveEffectInstance): boolean {
  const rulesId = effect.source.rulesId?.trim().toLowerCase()
  return rulesId === 'gaseous-form' ||
    rulesId?.endsWith(':gaseous-form') === true ||
    effect.definitionId.toLowerCase().split(':').includes('gaseous-form')
}

/** Applies the strictest live flight-only cap after all innate, form and granted speeds. */
export function dnd5eLimitFlySpeed(effects: readonly Dnd5eActiveEffectInstance[] | undefined, speed: number): number {
  const active = effectiveDnd5eActiveEffects(effects)
  const ignoresMagical = active.some(effect => effect.modifiers?.ignoreMagicalSpeedReductions === true)
  return active.reduce((value, effect) => ignoresMagical && effect.source.magical === true
    ? value : Math.min(value, effect.modifiers?.flySpeedLimitFeet ?? Infinity), Math.max(0, speed))
}

export function dnd5eActiveFlySpeed(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number | undefined {
  const speed = effectiveDnd5eActiveEffects(effects).reduce(
    (maximum, effect) => Math.max(
      maximum,
      effect.modifiers?.flySpeedFeet ?? (dnd5eActiveEffectIsGaseousForm(effect) ? 10 : 0),
    ),
    0,
  )
  const limited = dnd5eLimitFlySpeed(effects, speed)
  return limited > 0 ? limited : undefined
}

export function dnd5eActiveHoverWhileFlying(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.hoverWhileFlying === true || dnd5eActiveEffectIsGaseousForm(effect),
  )
}

export function dnd5eActiveMagicallyHeldAloft(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.magicallyHeldAloft === true,
  )
}

export function dnd5eActiveSubmerged(effects: readonly Dnd5eActiveEffectInstance[] | undefined): boolean {
  return effectiveDnd5eActiveEffects(effects).some(effect=>effect.modifiers?.submerged===true)
}

export function dnd5eActiveJumpDistanceMultiplier(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (multiplier, effect) => Math.max(multiplier, effect.modifiers?.jumpDistanceMultiplier ?? 1),
    1,
  )
}

export function dnd5eActiveSizeRankDelta(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (total, effect) => total + (effect.modifiers?.sizeRankDelta ?? 0),
    0,
  )
}

export function dnd5eActiveStrengthRollFlags(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): { advantage: boolean; disadvantage: boolean } {
  const modes = effectiveDnd5eActiveEffects(effects).map((effect) => effect.modifiers?.strengthRollMode)
  return {
    advantage: modes.includes('advantage'),
    disadvantage: modes.includes('disadvantage'),
  }
}

export function dnd5eActiveAbilityCheckAdvantages(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  context: { skill?: string; sense?: Dnd5eAbilityCheckRule['sense'] } = {},
): AbilityKey[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => [...(effect.modifiers?.abilityCheckAdvantages ?? []),
      ...dnd5eAbilityCheckRuleAbilities(effect.modifiers?.abilityCheckRules, 'advantage', context.skill, context.sense)],
  ))]
}

export function dnd5eActiveAbilityCheckDisadvantages(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  context: { skill?: string; sense?: Dnd5eAbilityCheckRule['sense'] } = {},
): AbilityKey[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => [...(effect.modifiers?.abilityCheckDisadvantages ?? []),
      ...dnd5eAbilityCheckRuleAbilities(effect.modifiers?.abilityCheckRules, 'disadvantage', context.skill, context.sense)],
  ))]
}

export function dnd5eActiveWeaponDamageMultiplier(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  context: { mode: 'melee' | 'ranged'; strengthBased: boolean },
): number {
  const ability = context.strengthBased ? 'str' : 'dex'
  return effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => effect.modifiers?.weaponDamageMultipliers ?? [],
  ).filter((rule) =>
    (rule.ability == null || rule.ability === ability) &&
    (rule.attackModes == null || rule.attackModes.includes(context.mode)),
  ).reduce((multiplier, rule) => multiplier * rule.multiplier, 1)
}

export function dnd5eActiveMinimumAbilityCheckD20(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  ability: AbilityKey,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (minimum, effect) => Math.max(
      minimum,
      effect.modifiers?.minimumAbilityCheckD20ByAbility?.[ability] ?? 1,
    ),
    1,
  )
}

export type Dnd5eRestrictedExtraActionKind =
  'weapon-attack' | 'dash' | 'disengage' | 'hide' | 'use-object'

export function dnd5eActiveRestrictedExtraActions(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): readonly NonNullable<Dnd5eActiveEffectModifiers['restrictedExtraAction']>[] {
  return effectiveDnd5eActiveEffects(effects).flatMap((effect) =>
    effect.modifiers?.restrictedExtraAction ? [effect.modifiers.restrictedExtraAction] : [])
}

export function dnd5eAvailableRestrictedExtraActionKinds(input: {
  effects: readonly Dnd5eActiveEffectInstance[] | undefined
  usesByEffect: Readonly<Record<string, string>> | undefined
  turnKey: string | undefined
}): readonly Dnd5eRestrictedExtraActionKind[] {
  if (!input.turnKey) return []
  const available = new Set<Dnd5eRestrictedExtraActionKind>()
  for (const effect of effectiveDnd5eActiveEffects(input.effects)) {
    if (input.usesByEffect?.[effect.id] === input.turnKey) continue
    for (const action of effect.modifiers?.restrictedExtraAction?.allowedActions ?? []) {
      available.add(action)
    }
  }
  return [...available]
}

export function dnd5eActivePreventsActions(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some((effect) => effect.modifiers?.preventActions === true)
}

/** Gaseous Form replaces every ordinary locomotion mode with its 10-foot flight. */
export function dnd5eActiveRequiresFlightMovement(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(dnd5eActiveEffectIsGaseousForm)
}

export function dnd5eActiveSpeedOverride(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number | undefined {
  const active = effectiveDnd5eActiveEffects(effects)
  const ignoresMagical = active.some((effect) => effect.modifiers?.ignoreMagicalSpeedReductions === true)
  const values = [
    ...(active.some(dnd5eActiveEffectIsGaseousForm) ? [10] : []),
    ...active
    .filter((effect) => !(ignoresMagical && effect.source.magical === true))
    .flatMap((effect) => effect.modifiers?.speedOverrideFeet == null
      ? []
      : [effect.modifiers.speedOverrideFeet]),
  ]
  return values.length > 0 ? Math.min(...values) : undefined
}

export function dnd5eActiveSpeedMinimum(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (value, effect) => Math.max(value, effect.modifiers?.speedMinimumFeet ?? 0),
    0,
  )
}

export interface Dnd5eActiveLanguageCapabilities {
  understandSpoken: boolean
  understandLiteralWritten: boolean
  writtenRequiresTouch: boolean
  writtenMinutesPerPage?: 1
  speechUnderstoodByAnyLanguageKnower: boolean
  understandLanguagesRestricted: boolean
  intelligibleCommunicationRestricted: boolean
}

/**
 * Host-facing language projection. Consumers must still check audibility,
 * contact with the writing and elapsed reading time; this helper only answers
 * which permissions the currently effective effects grant.
 */
export function dnd5eActiveLanguageCapabilities(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveLanguageCapabilities {
  const active = effectiveDnd5eActiveEffects(effects)
    .flatMap((effect) => effect.modifiers?.languageCapabilities
      ? [effect.modifiers.languageCapabilities]
      : [])
  const restrictions = effectiveDnd5eActiveEffects(effects)
    .flatMap((effect) => effect.modifiers?.languageRestriction
      ? [effect.modifiers.languageRestriction]
      : [])
  const understandLanguagesRestricted = restrictions.some(
    (restriction) => restriction.understandLanguages === false,
  )
  const intelligibleCommunicationRestricted = restrictions.some(
    (restriction) => restriction.intelligibleCommunication === false,
  )
  const understandLiteralWritten = active.some(
    (capability) => capability.understandWritten === 'literal-written',
  ) && !understandLanguagesRestricted
  return {
    understandSpoken: !understandLanguagesRestricted &&
      active.some((capability) => capability.understandSpoken === 'all'),
    understandLiteralWritten,
    writtenRequiresTouch: understandLiteralWritten && active.every(
      (capability) => capability.understandWritten !== 'literal-written' ||
        capability.writtenRequiresTouch === true,
    ),
    writtenMinutesPerPage: understandLiteralWritten ? 1 : undefined,
    speechUnderstoodByAnyLanguageKnower: !intelligibleCommunicationRestricted && active.some(
      (capability) => capability.speechUnderstoodBy === 'any-creature-knowing-a-language',
    ),
    understandLanguagesRestricted,
    intelligibleCommunicationRestricted,
  }
}

/**
 * Host communication gate for source-linked telepathic networks. The current
 * battle map is the same-plane boundary; callers must not use this result for
 * actors projected from another scene/plane.
 */
export function dnd5eShareActiveTelepathicBond(
  leftEffects: readonly Dnd5eActiveEffectInstance[] | undefined,
  rightEffects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  const left = new Set(dnd5eActiveTelepathicBondNetworkKeys(leftEffects))
  return dnd5eActiveTelepathicBondNetworkKeys(rightEffects).some((key) => left.has(key))
}

/** Stable source-linked network identities used by same-plane communication UIs. */
export function dnd5eActiveTelepathicBondNetworkKeys(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): string[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects)
    .filter((effect) => effect.legacyCondition === 'telepathic-bond')
    .map((effect) => `${effect.source.actorId ?? ''}:${effect.source.rulesId ?? effect.definitionId}`))]
}

export interface Dnd5eActiveTrackingCapability {
  mundaneTrackingPossible: boolean
  leavesTracks: boolean
}

export interface Dnd5eActivePlanarPhase {
  materialSightRangeFeet?: number
  plane: 'material' | 'ethereal' | 'terrain'
  ignoresMaterialCollision: boolean
  suppressCrossPlaneEffects: boolean
  unrestrictedVerticalMovement: boolean
}

/** Shared targeting/map query for effects such as Etherealness. */
export function dnd5eActivePlanarPhase(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActivePlanarPhase {
  const phase = effectiveDnd5eActiveEffects(effects)
    .map((effect) => effect.modifiers?.planarPhase)
    .find((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
  return phase
    ? {
        plane: phase.plane,
        ignoresMaterialCollision: phase.ignoresMaterialCollision,
        suppressCrossPlaneEffects: phase.suppressCrossPlaneEffects,
        unrestrictedVerticalMovement: phase.unrestrictedVerticalMovement,
        ...(phase.materialSightRangeFeet != null ? { materialSightRangeFeet: phase.materialSightRangeFeet } : {}),
      }
    : {
        plane: 'material',
        ignoresMaterialCollision: false,
        suppressCrossPlaneEffects: false,
        unrestrictedVerticalMovement: false,
      }
}

/** Authoritative overland/tracking query; magical tracking is intentionally a separate caller decision. */
export function dnd5eActiveTrackingCapability(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveTrackingCapability {
  const protectedFromMundaneTracking = effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.trackingCapability?.mundaneTracking === 'impossible')
  return {
    mundaneTrackingPossible: !protectedFromMundaneTracking,
    leavesTracks: !protectedFromMundaneTracking,
  }
}

export interface Dnd5eActiveEnvironmentalCapabilities {
  canBreatheWater: boolean
  doesNotNeedAir: boolean
  holdBreathSeconds?: number
  treatsLiquidSurfacesAsSolidGround: boolean
  ignoresDifficultTerrain: boolean
  ignoredDifficultTerrainMaterials: readonly MapSurfaceMaterial[]
  ignoresUnderwaterMovementPenalty: boolean
  ignoresUnderwaterAttackPenalty: boolean
  canOccupyCreatureSpaces: boolean
  riseTowardLiquidSurfaceFeetPerRound?: number
  minimumPassageGapInches?: number
}

/** Host query shared by suffocation, travel and map surface validation. */
export function dnd5eActiveEnvironmentalCapabilities(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  intrinsic?: { canBreatheWater?: boolean },
): Dnd5eActiveEnvironmentalCapabilities {
  const active = effectiveDnd5eActiveEffects(effects)
    .flatMap((effect) => effect.modifiers?.environmentalCapabilities
      ? [effect.modifiers.environmentalCapabilities]
      : [])
  return {
    canBreatheWater: intrinsic?.canBreatheWater === true || active.some((capability) => capability.breatheIn?.includes('water') === true),
    doesNotNeedAir: active.some(capability => capability.doesNotNeedAir === true),
    holdBreathSeconds: Math.max(0, ...active.map(capability => capability.holdBreathSeconds ?? 0)) || undefined,
    treatsLiquidSurfacesAsSolidGround: active.some(
      (capability) => capability.treatLiquidSurfacesAsSolidGround === true,
    ),
    ignoredDifficultTerrainMaterials: [...new Set(active.flatMap(capability => capability.ignoreDifficultTerrainMaterials ?? []))],
    ignoresDifficultTerrain: active.some((capability) => capability.ignoreDifficultTerrain === true),
    ignoresUnderwaterMovementPenalty: active.some(
      (capability) => capability.ignoreUnderwaterMovementPenalty === true,
    ),
    ignoresUnderwaterAttackPenalty: active.some(
      (capability) => capability.ignoreUnderwaterAttackPenalty === true,
    ),
    canOccupyCreatureSpaces: active.some(
      (capability) => capability.occupyCreatureSpaces === true,
    ),
    riseTowardLiquidSurfaceFeetPerRound: active.reduce(
      (maximum, capability) => Math.max(maximum, capability.riseTowardLiquidSurfaceFeetPerRound ?? 0),
      0,
    ) || undefined,
    minimumPassageGapInches: active
      .flatMap((capability) => capability.minimumPassageGapInches == null
        ? []
        : [capability.minimumPassageGapInches])
      .sort((left, right) => left - right)[0],
  }
}

/**
 * Water Walk forces a submerged target 60 feet toward the liquid surface at
 * the start of each of its turns, stopping at the surface.
 */
export function dnd5eWaterWalkSurfaceRiseElevation(input: {
  elevationFeet: number
  activeEffects?: readonly Dnd5eActiveEffectInstance[]
  underwater: boolean
}): number {
  const surfaceRise = dnd5eActiveEnvironmentalCapabilities(
    input.activeEffects,
  ).riseTowardLiquidSurfaceFeetPerRound
  if (!surfaceRise || input.elevationFeet >= 0 || !input.underwater) {
    return input.elevationFeet
  }
  return Math.min(0, input.elevationFeet + surfaceRise)
}

export function dnd5eActiveSpeedMaximum(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number | undefined {
  const active = effectiveDnd5eActiveEffects(effects)
  const ignoresMagical = active.some((effect) => effect.modifiers?.ignoreMagicalSpeedReductions === true)
  const values = active
    .filter((effect) => !(ignoresMagical && effect.source.magical === true))
    .flatMap((effect) => effect.modifiers?.speedMaximumFeet == null
      ? []
      : [effect.modifiers.speedMaximumFeet])
  return values.length > 0 ? Math.min(...values) : undefined
}

export function dnd5eActiveClimbSpeedEqualsWalking(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.climbSpeedEqualsWalking === true,
  )
}

export function dnd5eActiveSwimSpeedEqualsWalking(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.swimSpeedEqualsWalking === true,
  )
}

export function dnd5eActiveTruesightRangeFeet(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (maximum, effect) => Math.max(maximum, effect.modifiers?.truesightRangeFeet ?? 0),
    0,
  )
}

export function dnd5eActiveSpellTargetingImmunitySchools(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): readonly import('./spellbook').Dnd5eSpellbookSchoolId[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => effect.modifiers?.spellTargetingImmunitySchools ?? [],
  ))]
}

/**
 * Returns durable rule-state ids written through the Host `core.rule-state`
 * operation. Consumers must match an exact id; arbitrary text never becomes
 * executable behavior merely by appearing in a content description.
 */
export function dnd5eActiveRuleStateIds(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): readonly string[] {
  const prefix = 'rule-state:'
  return [...new Set((effects ?? []).flatMap((effect) =>
    !(effect.suspendedBy?.length) && effect.legacyCondition?.startsWith(prefix)
      ? [effect.legacyCondition.slice(prefix.length)]
      : []))]
}

export function dnd5eHasActiveRuleState(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  stateId: string,
): boolean {
  return dnd5eActiveRuleStateIds(effects).includes(stateId)
}

export function dnd5eHasActiveSpellRuleState(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  spellId: string,
  family: string,
): boolean {
  return dnd5eHasActiveRuleState(effects, `spell:${spellId}:${family}`)
}

function validWeaponCategoryRollModes(value: unknown): value is NonNullable<Dnd5eActiveEffectModifiers['weaponCategoryRollModes']> {
  return Array.isArray(value) && value.length > 0 && value.every(rule =>
    rule != null && typeof rule === 'object' && !Array.isArray(rule) &&
    Object.keys(rule).every(key => ['mode', 'categories'].includes(key)) &&
    ['advantage', 'disadvantage'].includes(rule.mode) &&
    Array.isArray(rule.categories) && rule.categories.length >= 1 && rule.categories.length <= 2 &&
    rule.categories.every((category: unknown) => category === 'simple' || category === 'martial') &&
    new Set(rule.categories).size === rule.categories.length)
}

export function dnd5eActiveAttackRollFlags(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  ability?: AbilityKey,
  attackCategory?: 'weapon' | 'spell',
  weaponCategory?: 'simple' | 'martial',
): {
  advantage: boolean
  disadvantage: boolean
  advantageReasons: readonly string[]
  disadvantageReasons: readonly string[]
} {
  const active = effectiveDnd5eActiveEffects(effects)
  const advantageEffects = active.filter((effect) =>
    (attackCategory === 'weapon' && weaponCategory != null && effect.modifiers?.weaponCategoryRollModes?.some(rule => rule.mode === 'advantage' && rule.categories.includes(weaponCategory))) ||
    (attackCategory === 'weapon' && effect.modifiers?.weaponAttackRollAdvantage === true) ||
    effect.modifiers?.attackRollAdvantage === true ||
    (ability != null && effect.modifiers?.attackRollAdvantageAbilities?.includes(ability) === true) ||
    effect.legacyCondition === 'rule-state:spell:foresight:roll-mode-modifier')
  const disadvantageEffects = active.filter((effect) =>
    (attackCategory === 'weapon' && weaponCategory != null && effect.modifiers?.weaponCategoryRollModes?.some(rule => rule.mode === 'disadvantage' && rule.categories.includes(weaponCategory))) ||
    (attackCategory === 'weapon' && effect.modifiers?.weaponAttackRollDisadvantage === true) ||
    effect.modifiers?.attackRollDisadvantage === true ||
    (ability != null && effect.modifiers?.attackRollDisadvantageAbilities?.includes(ability) === true))
  return {
    advantage: advantageEffects.length > 0,
    disadvantage: disadvantageEffects.length > 0,
    advantageReasons: [...new Set(advantageEffects.map((effect) =>
      `${effect.label || effect.source.label || '状态效果'}令攻击具有优势`))],
    disadvantageReasons: [...new Set(disadvantageEffects.map((effect) =>
      `${effect.label || effect.source.label || '状态效果'}令攻击具有劣势`))],
  }
}

export function dnd5eActiveEffectsGrantAttackAdvantageAgainstTarget(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.attacksAgainstTargetAdvantage === true,
  )
}

export function dnd5eActiveEffectsImposeAttackDisadvantageAgainstTarget(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.attacksAgainstTargetDisadvantage === true,
  )
}

export function dnd5eActiveEffectsPreventMovementOpportunityAttacks(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.preventMovementOpportunityAttacks === true,
  )
}

export function dnd5eActiveRevivalPrevented(effects: readonly Dnd5eActiveEffectInstance[] | undefined): boolean {
  return effectiveDnd5eActiveEffects(effects).some(effect => effect.modifiers?.preventsRevival === true)
}

export function dnd5eActiveCannotBeSurprisedWhileConscious(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.cannotBeSurprisedWhileConscious === true,
  )
}

/**
 * Some effects live on the defender but modify only attacks made by the
 * effect's source against that exact defender. Keeping this directional
 * relationship on the authoritative effect prevents another creature from
 * borrowing the bonus merely because it attacks the same target.
 */
export function dnd5eActiveTargetLinkedAttackRollFlags(
  targetEffects: readonly Dnd5eActiveEffectInstance[] | undefined,
  attackerId: string,
  attackerCreatureType?: string,
  turn?: { combatId: string; round: number; initiativeIndex: number; initiativeOrder: readonly string[]; initiativeSlotIds?: readonly string[]; turnSlotId?: string },
  attack?: { category: 'weapon' | 'spell'; delivery?: 'melee' | 'ranged' },
): {
  advantage: boolean
  disadvantage: boolean
  advantageReasons: readonly string[]
  disadvantageReasons: readonly string[]
} {
  const active = effectiveDnd5eActiveEffects(targetEffects)
  const trueStrikeEffects = active.filter((effect) =>
    effect.source.actorId === attackerId &&
    effect.legacyCondition === 'rule-state:spell:true-strike:target-linked-effect' &&
    !!turn && turn.initiativeOrder[turn.initiativeIndex] === attackerId &&
    effect.appliedTurnKey !== `${turn.combatId}:${turn.round}:${turn.initiativeSlotIds?.[turn.initiativeIndex] ?? turn.turnSlotId ?? attackerId}`)
  const protectedCreatureTypes = new Set([
    'aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead',
    '异怪', '天界生物', '元素生物', '精类', '邪魔', '不死生物',
  ])
  const protectionEffects = !!attackerCreatureType &&
    protectedCreatureTypes.has(attackerCreatureType.trim().toLowerCase())
    ? active.filter((effect) =>
        effect.legacyCondition ===
          'rule-state:spell:protection-from-evil-and-good:roll-mode-modifier')
    : []
  const canonicalAttackerType = dnd5eCanonicalCreatureType(attackerCreatureType)
  const typedDisadvantageEffects = canonicalAttackerType
    ? active.filter((effect) =>
        effect.modifiers?.attacksAgainstTargetDisadvantageCreatureTypes
          ?.includes(canonicalAttackerType) === true)
    : []
  const unconditionalDisadvantageEffects = active.filter((effect) =>
    effect.modifiers?.attacksAgainstTargetDisadvantage === true)
  const weaponEffects = (mode: 'advantage' | 'disadvantage') => attack?.category === 'weapon'
    ? active.filter(effect => effect.modifiers?.weaponAttacksAgainstTarget?.some(modifier =>
      modifier.mode === mode && (modifier.delivery === undefined || modifier.delivery === attack.delivery))) : []
  const advantageEffects = [...new Set([...trueStrikeEffects, ...weaponEffects('advantage')])]
  const disadvantageEffects = [...new Set([
    ...protectionEffects,
    ...typedDisadvantageEffects,
    ...unconditionalDisadvantageEffects,
    ...weaponEffects('disadvantage'),
  ])]
  return {
    advantage: advantageEffects.length > 0,
    disadvantage: disadvantageEffects.length > 0,
    advantageReasons: [...new Set(advantageEffects.map((effect) =>
      `${effect.label || effect.source.label || '状态效果'}令攻击具有优势`))],
    disadvantageReasons: [...new Set(disadvantageEffects.map((effect) =>
      `${effect.label || effect.source.label || '状态效果'}令该攻击具有劣势`))],
  }
}

function dnd5eCanonicalCreatureType(value?: string): string | undefined {
  const type = value?.trim().toLowerCase()
  if (!type) return undefined
  if (type === 'aberration' || type.includes('异怪')) return 'aberration'
  if (type === 'celestial' || type.includes('天界')) return 'celestial'
  if (type === 'elemental' || type.includes('元素')) return 'elemental'
  if (type === 'fey' || type.includes('精类') || type.includes('妖精')) return 'fey'
  if (type === 'fiend' || type.includes('邪魔')) return 'fiend'
  if (type === 'undead' || type.includes('亡灵') || type.includes('不死')) return 'undead'
  return type
}

/** Contextual condition immunity queried before a source applies a condition. */
export function dnd5eActiveConditionImmuneBySourceCreatureType(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  condition: string,
  sourceCreatureType?: string,
): boolean {
  const canonicalSourceType = dnd5eCanonicalCreatureType(sourceCreatureType)
  if (!canonicalSourceType) return false
  const normalizedCondition = dnd5eStandardConditionId(condition) ?? condition.trim().toLowerCase()
  return effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.conditionImmunitiesBySourceCreatureType?.some((rule) =>
      rule.conditions.some((candidate) =>
        (dnd5eStandardConditionId(candidate) ?? candidate.trim().toLowerCase()) === normalizedCondition) &&
      rule.sourceCreatureTypes.includes(canonicalSourceType)) === true)
}

export function dnd5eActiveSavingThrowAdvantageBySourceCreatureType(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  condition: string | undefined,
  sourceCreatureType?: string,
): boolean {
  const canonicalSourceType = dnd5eCanonicalCreatureType(sourceCreatureType)
  if (!canonicalSourceType) return false
  const normalizedCondition = condition
    ? dnd5eStandardConditionId(condition) ?? condition.trim().toLowerCase()
    : undefined
  return effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.savingThrowAdvantagesBySourceCreatureType?.some((rule) =>
      rule.conditions.some((candidate) =>
        candidate === 'any' ||
        (normalizedCondition != null &&
          (dnd5eStandardConditionId(candidate) ?? candidate.trim().toLowerCase()) === normalizedCondition)) &&
      rule.sourceCreatureTypes.includes(canonicalSourceType)) === true)
}

/** Contextual immunity qualified by the authoritative magical provenance. */
export function dnd5eActiveConditionImmuneBySourceMagic(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  condition: string,
  sourceMagical: boolean | undefined,
): boolean {
  if (sourceMagical == null) return false
  const normalizedCondition = dnd5eStandardConditionId(condition) ?? condition.trim().toLowerCase()
  return effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.conditionImmunitiesBySourceMagic?.some((rule) =>
      rule.sourceMagical === sourceMagical && rule.conditions.some((candidate) =>
        (dnd5eStandardConditionId(candidate) ?? candidate.trim().toLowerCase()) === normalizedCondition)) === true)
}

export interface Dnd5eIncomingConditionImmunityBlock {
  effect: Dnd5eActiveEffectInstance
  condition: Dnd5eStandardConditionId
  reason: 'condition-immunity' | 'source-creature-type' | 'source-magic'
  sourceCreatureTypes: readonly string[]
}

/**
 * Validates newly introduced or retargeted standard-condition effects against
 * the target's already-authoritative defenses. Removal and duration-only edits
 * remain legal so a DM can clean up historical state without immunity trapping it.
 */
export function dnd5eIncomingConditionImmunityBlocks(input: {
  currentEffects: readonly Dnd5eActiveEffectInstance[] | undefined
  nextEffects: readonly Dnd5eActiveEffectInstance[] | undefined
  conditionImmunities?: readonly string[]
  sourceCreatureTypesByActorId?: Readonly<Record<string, readonly string[]>>
}): Dnd5eIncomingConditionImmunityBlock[] {
  const current = normalizeDnd5eActiveEffects(input.currentEffects)
  const next = normalizeDnd5eActiveEffects(input.nextEffects)
  const currentById = new Map(current.map((effect) => [effect.id, effect]))
  const unconditionalImmunities = new Set([
    ...(input.conditionImmunities ?? []).flatMap((value) => {
      const standard = dnd5eStandardConditionId(value)
      return standard ? [standard] : []
    }),
    ...dnd5eActiveConditionImmunities(current),
  ])
  return next.flatMap((effect) => {
    const condition = effect.standardCondition
    if (!condition) return []
    const previous = currentById.get(effect.id)
    if (
      previous?.standardCondition === condition &&
      previous.source.actorId === effect.source.actorId &&
      previous.source.magical === effect.source.magical
    ) return []
    const sourceCreatureTypes = effect.source.actorId
      ? input.sourceCreatureTypesByActorId?.[effect.source.actorId] ?? []
      : []
    const reason = unconditionalImmunities.has(condition)
      ? 'condition-immunity' as const
      : sourceCreatureTypes.some((sourceCreatureType) =>
          dnd5eActiveConditionImmuneBySourceCreatureType(current, condition, sourceCreatureType))
        ? 'source-creature-type' as const
        : dnd5eActiveConditionImmuneBySourceMagic(
            current,
            condition,
            effect.source.magical,
          )
          ? 'source-magic' as const
          : undefined
    return reason ? [{ effect, condition, reason, sourceCreatureTypes }] : []
  })
}

export function dnd5eActiveSkillCheckAdvantages(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): string[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => effect.modifiers?.skillCheckAdvantages ?? [],
  ))]
}

export function dnd5eActiveSkillCheckDisadvantages(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): string[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => effect.modifiers?.skillCheckDisadvantages ?? [],
  ))]
}

/**
 * Enthrall-style source-relative Perception penalty. The check must name the
 * creature being perceived so the Host can distinguish the effect source from
 * every other possible target without trusting client-side roll mode choices.
 */
export function dnd5eActivePerceptionDisadvantageApplies(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  perceivedTargetId: string | undefined,
): boolean {
  if (!perceivedTargetId) return false
  return effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.perceptionDisadvantageAgainstOthersThanSource === true &&
    effect.source.actorId != null &&
    effect.source.actorId !== perceivedTargetId)
}

export function dnd5eActivePerceptionTargetRequired(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.perceptionDisadvantageAgainstOthersThanSource === true &&
    effect.source.actorId != null)
}

export function dnd5eActiveSavingThrowDisadvantages(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): AbilityKey[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(
    (effect) => effect.modifiers?.savingThrowDisadvantages ?? [],
  ))]
}

export function dnd5eActiveSavingThrowAdvantages(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): AbilityKey[] {
  const active = effectiveDnd5eActiveEffects(effects)
  const allAbilities: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  return [...new Set([
    ...active.flatMap(
    (effect) => effect.modifiers?.savingThrowAdvantages ?? [],
    ),
    ...(dnd5eHasActiveSpellRuleState(active, 'foresight', 'roll-mode-modifier') ? allAbilities : []),
  ])]
}

export function dnd5eActiveCarryingCapacityMultiplier(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (multiplier, effect) => Math.max(multiplier, effect.modifiers?.carryingCapacityMultiplier ?? 1),
    1,
  )
}

export function dnd5eActiveSafeFallFeet(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (maximum, effect) => Math.max(maximum, effect.modifiers?.safeFallFeet ?? 0),
    0,
  )
}

function validArmorEnchantment(value: unknown): value is NonNullable<Dnd5eActiveEffectModifiers['armorEnchantment']> {
  if (!isRecord(value)) return false
  return Object.keys(value).every(key => ['armorId', 'inventoryInstanceId', 'armorClassBonus'].includes(key)) &&
    typeof value.armorId === 'string' && value.armorId.trim().length > 0 && value.armorId.length <= 200 &&
    (value.inventoryInstanceId == null || typeof value.inventoryInstanceId === 'string' && value.inventoryInstanceId.length > 0 && value.inventoryInstanceId.length <= 200) &&
    typeof value.armorClassBonus === 'number' && Number.isInteger(value.armorClassBonus) && value.armorClassBonus >= 1 && value.armorClassBonus <= 3
}

export function dnd5eActiveArmorEnchantmentBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  armor: { itemId: string; inventoryInstanceId?: string } | undefined,
): number {
  if (!armor) return 0
  return effectiveDnd5eActiveEffects(effects).reduce((highest, effect) => {
    const binding = effect.modifiers?.armorEnchantment
    const matches = binding && binding.armorId === armor.itemId &&
      (binding.inventoryInstanceId == null || binding.inventoryInstanceId === armor.inventoryInstanceId)
    return matches ? Math.max(highest, binding.armorClassBonus) : highest
  }, 0)
}

export function dnd5eActiveArmorClassBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  cohortContext?: Parameters<typeof dnd5eCohortArmorClassBonus>[1],
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (total, effect) => total + (effect.modifiers?.armorClassBonus ?? 0) +
      dnd5eCohortArmorClassBonus(effect.modifiers?.cohortArmorClass, cohortContext),
    0,
  )
}

function validEquipmentProficiencies(value: unknown): value is NonNullable<Dnd5eActiveEffectModifiers['equipmentProficiencies']> {
  return Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string' && ['light','medium','heavy','shield','simple','martial'].includes(entry))
}

export function dnd5eActiveSavingThrowProficiencyBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  ability: AbilityKey | undefined,
  target?: { proficiencyBonus?: number; savingThrowProficiencies?: readonly AbilityKey[] },
): number {
  return ability && !target?.savingThrowProficiencies?.includes(ability) &&
    effectiveDnd5eActiveEffects(effects).some(effect => effect.modifiers?.savingThrowProficiencies?.includes(ability))
    ? Math.max(0, target?.proficiencyBonus ?? 0) : 0
}

export function dnd5eActiveSavingThrowBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  ability?: AbilityKey,
  target?: { proficiencyBonus?: number; savingThrowProficiencies?: readonly AbilityKey[] },
): number {
  const active = effectiveDnd5eActiveEffects(effects)
  const grantedProficiency = dnd5eActiveSavingThrowProficiencyBonus(active, ability, target)
  return active.reduce(
    (total, effect) => total +
      (effect.modifiers?.savingThrowBonus ?? 0) +
      (ability ? effect.modifiers?.savingThrowBonusByAbility?.[ability] ?? 0 : 0),
    grantedProficiency,
  )
}

export function dnd5eActiveOptionalBonusDice(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  rollKind: Dnd5eOptionalBonusDieRollKind,
): Dnd5eActiveEffectInstance[] {
  return effectiveDnd5eActiveEffects(effects).filter((effect) =>
    effect.modifiers?.optionalBonusDie?.appliesTo.includes(rollKind) === true,
  )
}

export function dnd5eActiveResistanceToAllDamage(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.resistanceToAllDamage === true,
  )
}

export function dnd5eActiveWeaponDamageD4Mode(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): 'add' | 'subtract' | undefined {
  const modes = effectiveDnd5eActiveEffects(effects)
    .map((effect) => effect.modifiers?.weaponDamageD4)
    .filter((mode): mode is 'add' | 'subtract' => mode != null)
  if (modes.includes('add') && modes.includes('subtract')) return undefined
  return modes[0]
}

export function dnd5eActiveDeathSavingThrowAdvantage(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.deathSavingThrowAdvantage === true,
  )
}

export function dnd5eActiveAttacksAgainstSourceArmorClassBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  sourceActorId: string,
): number {
  return effectiveDnd5eActiveEffects(effects).reduce(
    (total, effect) => total + (
      effect.source.actorId === sourceActorId
        ? effect.modifiers?.attacksAgainstSourceArmorClassBonus ?? 0
        : 0
    ),
    0,
  )
}

export function dnd5eActiveMaximizeHealingDice(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  context?: Dnd5eOwnedCompanionMapContext,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.maximizeHealingDice === true ||
      (!!context && (effect.modifiers?.maximizeHealingDiceNearCompanion ?? []).some(query =>
        dnd5eNearbyOwnedCompanions({ ...context, query }).length > 0)),
  ) || dnd5eHasActiveSpellRuleState(effects, 'beacon-of-hope', 'maximum-healing')
}

export function dnd5eActiveControlledDescent(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectModifiers['controlledDescent'] | undefined {
  return effectiveDnd5eActiveEffects(effects)
    .flatMap((effect) => effect.modifiers?.controlledDescent
      ? [effect.modifiers.controlledDescent]
      : [])
    .filter((descent) => !descent.forceWhileFlightBlocked || dnd5eLimitFlySpeed(effects, 1) === 0)
    .sort((left, right) => Number(right.forceWhileFlightBlocked === true) - Number(left.forceWhileFlightBlocked === true) || right.maximumFeetPerRound - left.maximumFeetPerRound)[0]
}

export interface Dnd5eAutomaticEscapePlan {
  effectIds: readonly string[]
  conditions: readonly ('grappled' | 'restrained')[]
  movementCostFeet: number
}

export interface Dnd5eSwallowedCorpseEscapePlan {
  effectIds: readonly string[]
  sourceActorIds: readonly string[]
  movementCostFeet: number
  applyProne: true
}

/**
 * Returns the stable container for a live swallow or a still-unescaped corpse
 * containment relation. Suspended dependent conditions do not remove the
 * physical inside/outside boundary.
 */
export function dnd5eSwallowedContainerActorId(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): string | undefined {
  return normalizeDnd5eActiveEffects(effects).find((effect) =>
    effect.dependsOnEffectId == null &&
    effect.relation?.kind === 'swallowed')?.relation?.sourceActorId
}

/**
 * Reads the closed corpse-exit receipt created by Headless relation
 * reconciliation. Suspended swallowed conditions remain persisted only so the
 * source/action provenance can be checked; they no longer affect the bearer.
 */
export function dnd5eSwallowedCorpseEscapePlan(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eSwallowedCorpseEscapePlan | undefined {
  const roots = normalizeDnd5eActiveEffects(effects).filter((effect) =>
    effect.dependsOnEffectId == null &&
    effect.relation?.kind === 'swallowed' &&
    effect.relation.corpseEscape != null)
  if (roots.length === 0) return undefined
  return {
    effectIds: roots.map((effect) => effect.id),
    sourceActorIds: [...new Set(roots.map((effect) => effect.relation!.sourceActorId))],
    movementCostFeet: roots.reduce(
      (total, effect) => total + effect.relation!.corpseEscape!.movementCostFeet,
      0,
    ),
    applyProne: true,
  }
}

/**
 * Finds movement-locking effects that one active automatic-escape permission
 * can remove. The permission never removes itself and never guesses unknown
 * source provenance.
 */
export function dnd5eActiveAutomaticEscapePlan(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eAutomaticEscapePlan | undefined {
  const active = effectiveDnd5eActiveEffects(effects)
  const permissions = active.flatMap((effect) =>
    effect.modifiers?.automaticEscape ? [effect.modifiers.automaticEscape] : [])
  if (!permissions.length) return undefined
  const removable = active.filter((effect) => {
    const condition = effect.standardCondition
    if (condition !== 'grappled' && condition !== 'restrained') return false
    return permissions.some((permission) =>
      permission.conditions.includes(condition) &&
      (permission.sourceMagical == null || (effect.source.magical === true) === permission.sourceMagical))
  })
  if (!removable.length) return undefined
  const removableById = new Map(removable.map((effect) => [effect.id, effect]))
  const rootEffectId = (effect: Dnd5eActiveEffectInstance): string => {
    const visited = new Set<string>([effect.id])
    let current = effect
    while (current.dependsOnEffectId) {
      const parent = removableById.get(current.dependsOnEffectId)
      if (!parent || visited.has(parent.id)) break
      visited.add(parent.id)
      current = parent
    }
    return current.id
  }
  const costByRestraint = new Map<string, number>()
  for (const effect of removable) {
    const condition = effect.standardCondition as 'grappled' | 'restrained'
    const cost = Math.min(...permissions.filter((permission) =>
      permission.conditions.includes(condition) &&
      (permission.sourceMagical == null || (effect.source.magical === true) === permission.sourceMagical))
      .map((permission) => permission.movementCostFeet))
    const rootId = rootEffectId(effect)
    costByRestraint.set(rootId, Math.max(costByRestraint.get(rootId) ?? 0, cost))
  }
  return {
    effectIds: removable.map((effect) => effect.id),
    conditions: [...new Set(removable.map((effect) => effect.standardCondition as 'grappled' | 'restrained'))],
    // One source-linked restraint can project more than one condition. A
    // constrict, for example, creates a grapple root plus a dependent
    // restrained effect, but Freedom of Movement pays only once to escape the
    // creature's single restraint. Independent roots still cost separately.
    movementCostFeet: [...costByRestraint.values()].reduce((total, cost) => total + cost, 0),
  }
}

/**
 * Projects the conditions that would remain after taking the automatic-escape
 * option. Unknown legacy conditions stay locked, and a standard condition is
 * removed only when every active source for it is part of the escape plan.
 */
export function dnd5eConditionsAfterAutomaticEscape(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  conditions: readonly string[],
): string[] {
  const plan = dnd5eActiveAutomaticEscapePlan(effects)
  if (!plan) return [...conditions]
  const removableIds = new Set(plan.effectIds)
  const active = effectiveDnd5eActiveEffects(effects)
  return conditions.filter((condition) => {
    const standard = dnd5eStandardConditionId(condition)
    if (!standard) return true
    const matching = active.filter((effect) => effect.standardCondition === standard)
    return matching.length === 0 || matching.some((effect) => !removableIds.has(effect.id))
  })
}

export function dnd5eActiveEmittedLight(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectModifiers['emittedLight'] | undefined {
  // Not holding an existing bound item disables its combat modifiers, not its light.
  // Keep every other suspension (including antimagic) authoritative.
  const lightEffects = effects?.map(effect =>
    effect.modifiers?.weaponEnchantment?.inventoryInstanceId && effect.modifiers.emittedLight
      ? { ...effect, suspendedBy: effect.suspendedBy?.filter(reason => reason !== 'inventory-binding:not-held') }
      : effect)
  return effectiveDnd5eActiveEffects(lightEffects)
    .flatMap((effect) => {
      const light = effect.grantedActivityCharges?.lightTiers
        ? dnd5eEffectGrantChargeLight(effect.grantedActivityCharges) : effect.modifiers?.emittedLight
      return light ? [light] : []
    })
    .sort((left, right) =>
      (right.brightRadiusFeet + right.dimRadiusFeet) -
        (left.brightRadiusFeet + left.dimRadiusFeet))[0]
}

export interface Dnd5eActiveOnHitBonusDamage {
  effectId: string
  rider: NonNullable<Dnd5eActiveEffectModifiers['onHitBonusDamage']>
}

/** Returns delayed damage riders that are still eligible this turn. */
export function dnd5eActiveOnHitBonusDamage(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  input: { weaponId?: string; targetCreatureType?: string; targetId?: string; spellAttack?: boolean; turnKey: string },
): Dnd5eActiveOnHitBonusDamage[] {
  const targetType = input.targetCreatureType?.trim().toLocaleLowerCase()
  return effectiveDnd5eActiveEffects(effects).flatMap((effect) => {
    const rider = effect.modifiers?.onHitBonusDamage
    if (!rider) return []
    if (rider.boundTargetId && (rider.boundTargetId !== input.targetId || !input.weaponId || input.spellAttack)) return []
    if (rider.oncePerTurn && rider.lastUsedTurnKey === input.turnKey) return []
    if (rider.appliesTo === 'this-weapon' && (!rider.weaponId || rider.weaponId !== input.weaponId)) return []
    if (rider.targetCreatureTypes?.length && (
      !targetType || !rider.targetCreatureTypes.some((candidate) =>
        candidate.trim().toLocaleLowerCase() === targetType)
    )) return []
    return [{ effectId: effect.id, rider }]
  }).sort((left, right) => left.effectId.localeCompare(right.effectId))
}

export function dnd5eActiveVulnerabilityToAllDamage(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some(
    (effect) => effect.modifiers?.vulnerabilityToAllDamage === true,
  )
}

export function dnd5eActiveHitPointMaximumBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return Math.floor(effectiveDnd5eActiveEffects(effects).reduce(
    (total, effect) => total + Math.max(0, effect.modifiers?.hitPointMaximumBonus ?? 0),
    0,
  ))
}

/**
 * Whether an Activity-owned effect replaces the ordinary weapon damage dice
 * for this attack. Replacement damage is resolved by the correlated Activity
 * trigger, while class riders and item riders continue to settle normally.
 */
export function dnd5eActiveWeaponDamageReplacementApplies(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  mode: 'melee' | 'ranged' | 'unarmed',
): boolean {
  if (mode === 'unarmed') return false
  return effectiveDnd5eActiveEffects(effects).some((effect) =>
    effect.modifiers?.weaponDamageReplacementAttackModes?.includes(mode) === true,
  )
}

export interface Dnd5eActiveMovementBoundarySave {
  effectId: string
  sourceActorId: string
  maximumDistanceFeet: number
  ability: AbilityKey
  dc: number
}

/** Returns every effective source-relative movement boundary in stable order. */
export function dnd5eActiveMovementBoundarySaves(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveMovementBoundarySave[] {
  return effectiveDnd5eActiveEffects(effects).flatMap((effect) => {
    const boundary = effect.modifiers?.movementBoundarySave
    const sourceActorId = effect.source.actorId
    if (!boundary || !sourceActorId) return []
    return [{ effectId: effect.id, sourceActorId, ...boundary }]
  }).sort((left, right) => left.effectId.localeCompare(right.effectId))
}

export interface Dnd5eActiveMovementRepeatSave {
  effectId: string
  sourceActorId: string
  ability: AbilityKey
  dc: number
}

/** Repeat saves whose trigger is a committed, non-zero movement transaction. */
export function dnd5eActiveMovementRepeatSaves(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveMovementRepeatSave[] {
  return effectiveDnd5eActiveEffects(effects).flatMap((effect) => {
    const repeat = effect.repeatSave
    const sourceActorId = effect.source.actorId
    if (repeat?.timing !== 'after-movement' || !sourceActorId) return []
    return [{
      effectId: effect.id,
      sourceActorId,
      ability: repeat.ability,
      dc: repeat.dc,
    }]
  }).sort((left, right) => left.effectId.localeCompare(right.effectId))
}

export interface Dnd5eActiveDirectionalCompulsion {
  effectId: string
  sourceActorId: string
  commandKey: string
}

/** Closed extension condition consumed by the ordinary movement authority. */
export function dnd5eActiveDirectionalCompulsions(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveDirectionalCompulsion[] {
  const prefix = 'directional-compulsion:'
  return effectiveDnd5eActiveEffects(effects).flatMap((effect) => {
    const sourceActorId = effect.source.actorId
    const extension = effect.legacyCondition
    if (!sourceActorId || !extension?.startsWith(prefix)) return []
    const commandKey = extension.slice(prefix.length)
    return /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(commandKey)
      ? [{ effectId: effect.id, sourceActorId, commandKey }]
      : []
  }).sort((left, right) => left.effectId.localeCompare(right.effectId))
}

/** Item bindings remain magical while unequipped; ending the effect removes this identity. */
export function dnd5eEnchantedInventoryInstanceIds(effects: readonly Dnd5eActiveEffectInstance[] | undefined): string[] {
  return [...new Set((effects ?? []).flatMap(effect => [effect.modifiers?.weaponEnchantment?.inventoryInstanceId, effect.modifiers?.armorEnchantment?.inventoryInstanceId].filter((id): id is string => Boolean(id))))]
}

/** Current magical bindings, including zero-bonus enchantments; no intrinsic item facts. */
export function dnd5eMagicallyEnchantedWeaponIds(effects: readonly Dnd5eActiveEffectInstance[] | undefined): string[] {
  return [...new Set(effectiveDnd5eActiveEffects(effects).flatMap(effect => {
    const binding = effect.modifiers?.weaponEnchantment
    return [effect.modifiers?.magicWeapon?.weaponId,
      binding && !binding.ammunitionContainer ? binding.weaponId : undefined,
    ].filter((id): id is string => Boolean(id))
  }))]
}

/** 返回指定武器当前获得的最高“魔化武器”加值。 */
export function dnd5eActiveMagicWeaponBonus(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  weaponId: string | undefined,
): 0 | 1 | 2 | 3 {
  if (!weaponId) return 0
  return effectiveDnd5eActiveEffects(effects).reduce<0 | 1 | 2 | 3>((highest, effect) => {
    const magicWeapon = effect.modifiers?.magicWeapon
    const enchantment = effect.modifiers?.weaponEnchantment
    const candidate = Math.max(
      magicWeapon?.weaponId === weaponId ? magicWeapon.bonus : 0,
      enchantment?.weaponId === weaponId ? enchantment.attackAndDamageBonus : 0,
    ) as 0 | 1 | 2 | 3
    return candidate > highest ? candidate : highest
  }, 0)
}

export interface Dnd5eActiveWeaponEnchantmentDamage {
  effectId: string
  count: number
  sides: number
  type: Dnd5eDamageType
  magical: boolean
}

/**
 * Returns one damage rider per effective enchantment bound to the concrete
 * weapon. The effect id is retained so Host dice declarations stay unique.
 */
export function dnd5eActiveAmmunitionEnchantment(effects:readonly Dnd5eActiveEffectInstance[]|undefined,weaponId:string|undefined):Dnd5eActiveEffectInstance|undefined {
  if(!weaponId)return undefined
  return effectiveDnd5eActiveEffects(effects).filter(effect=>(effect.modifiers?.weaponEnchantment?.ammunitionContainer || effect.modifiers?.weaponEnchantment?.ammunitionStack) && effect.modifiers.weaponEnchantment.weaponIds?.includes(weaponId)).sort((a,b)=>Number(!!b.modifiers?.weaponEnchantment?.ammunitionStack)-Number(!!a.modifiers?.weaponEnchantment?.ammunitionStack)||a.id.localeCompare(b.id))[0]
}

export function dnd5eActiveWeaponEnchantmentDamage(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  weaponId: string | undefined,
): Dnd5eActiveWeaponEnchantmentDamage[] {
  if (!weaponId) return []
  const ammunitionEffectId=dnd5eActiveAmmunitionEnchantment(effects,weaponId)?.id
  const appliedDefinitions = new Set<string>()
  const potency = (effect: Dnd5eActiveEffectInstance) => {
    const dice=effect.modifiers?.weaponEnchantment?.bonusDamage
    return dice ? dice.count * (dice.sides + 1) : 0
  }
  return effectiveDnd5eActiveEffects(effects).sort((left,right)=>potency(right)-potency(left)||left.id.localeCompare(right.id)).flatMap((effect) => {
    const enchantment = effect.modifiers?.weaponEnchantment
    if((enchantment?.ammunitionContainer || enchantment?.ammunitionStack) && effect.id!==ammunitionEffectId)return []
    if (!enchantment || !(enchantment.weaponId === weaponId || (enchantment.ammunitionContainer || enchantment.ammunitionStack) && enchantment.weaponIds?.includes(weaponId)) || !enchantment.bonusDamage) return []
    if (appliedDefinitions.has(effect.definitionId)) return []
    appliedDefinitions.add(effect.definitionId)
    return [{
      effectId: effect.id,
      count: enchantment.bonusDamage.count,
      sides: enchantment.bonusDamage.sides,
      type: enchantment.bonusDamage.type,
      magical: enchantment.bonusDamage.magical ?? true,
    }]
  })
}

export interface Dnd5eActiveAttackProfileRewrite {
  reachBonusFeet: number
  criticalThreshold?: number
  damageTypeOverride?: Dnd5eDamageType
}

/**
 * Merges data-only attack profile rewrites from effective authoritative Effects.
 * Reach bonuses stack; the newest matching damage-type override wins.
 */
export function dnd5eActiveAttackProfileRewrite(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  attackMode: 'melee' | 'ranged' | 'unarmed',
  weaponId?: string,
): Dnd5eActiveAttackProfileRewrite {
  let reachBonusFeet = 0
  let criticalThreshold: number | undefined
  let damageTypeOverride: Dnd5eDamageType | undefined
  for (const effect of effectiveDnd5eActiveEffects(effects)) {
    for (const profile of effect.modifiers?.attackProfiles ?? []) {
      if (!profile.attackModes.includes(attackMode)) continue
      if (profile.weaponIds?.length && (!weaponId || !profile.weaponIds.includes(weaponId))) continue
      reachBonusFeet += Math.max(0, profile.reachBonusFeet ?? 0)
      if (profile.criticalThreshold != null) criticalThreshold = Math.min(criticalThreshold ?? 20, profile.criticalThreshold)
      if (profile.damageTypeOverride) damageTypeOverride = profile.damageTypeOverride
    }
  }
  return { reachBonusFeet, damageTypeOverride, ...(criticalThreshold != null ? { criticalThreshold } : {}) }
}

export function dnd5eActiveConditionImmunities(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eStandardConditionId[] {
  const active = effectiveDnd5eActiveEffects(effects)
  const audited: Dnd5eStandardConditionId[] = [
    ...(dnd5eHasActiveSpellRuleState(active, 'heroes-feast', 'condition-immunity') ? ['frightened', 'poisoned'] as const : []),
    ...(dnd5eHasActiveSpellRuleState(active, 'mind-blank', 'condition-immunity') ? ['charmed'] as const : []),
    ...(dnd5eHasActiveSpellRuleState(active, 'freedom-of-movement', 'condition-immunity') ? ['paralyzed', 'restrained'] as const : []),
    ...(dnd5eHasActiveSpellRuleState(active, 'protection-from-evil-and-good', 'condition-immunity') ? ['charmed', 'frightened'] as const : []),
  ]
  return [...new Set([...active.flatMap(
    (effect) => effect.modifiers?.conditionImmunities ?? [],
  ), ...audited])]
}

export function dnd5eActiveEffectsPreventReactions(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).some((effect) => effect.modifiers?.preventReactions === true)
}

export function dnd5eActiveForcedFleeSourceId(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): string | undefined {
  return effectiveDnd5eActiveEffects(effects).find((effect) =>
    effect.modifiers?.forcedFleeFromSource === true && !!effect.source.actorId,
  )?.source.actorId
}

export function dnd5eConditionsFromActiveEffects(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  preservedConditions: readonly string[] = [],
): string[] {
  const conditions: string[] = []
  const seen = new Set<string>()
  const add = (value: string, preserveAlias = false) => {
    const standard = dnd5eStandardConditionId(value)
    const normalized = preserveAlias ? value : standard ?? value
    const key = standard ? `standard:${standard}` : `extension:${value}`
    if (seen.has(key)) return
    seen.add(key)
    conditions.push(normalized)
  }
  for (const effect of effectiveDnd5eActiveEffects(effects)) {
    if (effect.standardCondition) {
      const legacyAlias = effect.legacyCondition
      add(legacyAlias ?? effect.standardCondition, !!legacyAlias)
    }
    else if (effect.legacyCondition) add(effect.legacyCondition)
  }
  for (const value of preservedConditions) add(value)
  return conditions
}

/** Host-side validation for conditions whose mechanics refer to their source. */
export function validateDnd5eSourceBoundConditions(input: {
  effects: readonly Dnd5eActiveEffectInstance[]
  targetActorId: string
  availableActorIds: ReadonlySet<string>
}): Dnd5eSourceBoundConditionValidation {
  for (const effect of input.effects) {
    if (!dnd5eConditionRequiresActorSource(effect.standardCondition)) continue
    const sourceActorId = effect.source.actorId?.trim()
    if (!sourceActorId) return { ok: false, effect, reason: 'missing-source' }
    if (sourceActorId === input.targetActorId) return { ok: false, effect, reason: 'self-source' }
    if (!input.availableActorIds.has(sourceActorId)) {
      return { ok: false, effect, reason: 'unavailable-source' }
    }
    // The author remains authoritative for attribution and duration. A condition
    // may instead refer to a separately selected creature (for example fear).
    const entities = effect.tags?.filter(tag => tag.startsWith('condition-entity:')) ?? []
    if (entities.length > 1) return { ok: false, effect, reason: 'unavailable-source' }
    if (entities.length === 1) {
      const entityId = entities[0].slice('condition-entity:'.length)
      if (!entityId) return { ok: false, effect, reason: 'missing-source' }
      if (entityId === input.targetActorId) return { ok: false, effect, reason: 'self-source' }
      if (!input.availableActorIds.has(entityId)) return { ok: false, effect, reason: 'unavailable-source' }
    }
  }
  return { ok: true }
}

/** ActiveEffect 是唯一事实源；所有持久化层均使用此函数同时生成实例与只读投影。 */
export function projectDnd5eActiveEffectState(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectProjection {
  const activeEffects = normalizeDnd5eActiveEffects(effects)
  return {
    activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
    conditions: dnd5eConditionsFromActiveEffects(activeEffects),
  }
}

export function removeDnd5eActiveEffectById(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  id: string
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  return removeDnd5eActiveEffectsByIds({
    effects: input.effects,
    ids: [input.id],
  })
}

export function removeDnd5eActiveEffectsByStandardCondition(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  condition: Dnd5eStandardConditionId
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const effects = normalizeDnd5eActiveEffects(input.effects)
  return removeDnd5eActiveEffectsByIds({
    effects,
    ids: effects
      .filter((effect) => effect.standardCondition === input.condition)
      .map((effect) => effect.id),
  })
}

/**
 * Retains source knowledge explicitly granted when a charm effect ends.
 * Keeping or suspending the original effect does not count as ending it.
 */
export function retainDnd5eEndedEffectAwareness(
  before: readonly Dnd5eActiveEffectInstance[],
  after: readonly Dnd5eActiveEffectInstance[],
): Dnd5eActiveEffectInstance[] {
  const result = retainDnd5eEndedEffectSavingThrows(before, after), retained = new Set(result.map(effect => effect.id))
  for (const effect of before) {
    if (retained.has(effect.id) || effect.onEndAwareness !== 'charmed-by-source' ||
      effect.standardCondition !== 'charmed' || !effect.source.actorId) continue
    const id = dnd5eActiveEffectId('awareness', 'charmed-by', effect.source.characterId ?? effect.source.actorId)
    if (retained.has(id)) continue
    result.push({schemaVersion:1,id,definitionId:'awareness:charmed-by-source',kind:'mark',
      label:`知晓曾被${effect.source.actorName || '来源生物'}魅惑`,tags:['effect-awareness'],
      source:{kind:'system',actorId:effect.source.actorId,characterId:effect.source.characterId,
        actorName:effect.source.actorName,rulesId:effect.source.rulesId,label:effect.source.label,magical:false},
      // Preserve the originating effect's provenance; this is not a new spell.
      appliedAt:effect.appliedAt,duration:{type:'permanent'},stackingKey:id,stackingPolicy:'replace',visibility:effect.visibility,
    })
    retained.add(id)
  }
  return result
}

/** Removes requested effects and their transitive dependents in one mutation. */
export function removeDnd5eActiveEffectsByIds(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  ids: readonly string[]
  /** Internal lifecycle callers have already validated the ending condition. */
  allowProtectedLifecycle?: true
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const effects = normalizeDnd5eActiveEffects(input.effects)
  const protectedIds = new Set(effects.filter(effect => effect.linkedLifetime?.protectedRemoval).map(effect => effect.id))
  const removedIds = new Set(input.ids.filter(id => input.allowProtectedLifecycle || !protectedIds.has(id)))
  for (;;) {
    const sizeBefore = removedIds.size
    for (const effect of effects) {
      if (effect.dependsOnEffectId && removedIds.has(effect.dependsOnEffectId)) {
        removedIds.add(effect.id)
      }
    }
    if (removedIds.size === sizeBefore) break
  }
  return {
    effects: retainDnd5eEndedEffectAwareness(effects, effects.filter((effect) => !removedIds.has(effect.id))),
    removed: effects.filter((effect) => removedIds.has(effect.id)),
  }
}

export function applyDnd5eActiveEffect(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  incoming: Dnd5eActiveEffectInstance
  conditionImmunities?: readonly string[]
}): Dnd5eActiveEffectMutation {
  const effects = normalizeDnd5eActiveEffects(input.effects)
  if (
    input.incoming.standardCondition &&
    (input.conditionImmunities ?? []).some((value) => dnd5eStandardConditionId(value) === input.incoming.standardCondition)
  ) return { effects, status: 'rejected-immune', removedIds: [] }

  const matching = effects.filter((effect) => effect.stackingKey === input.incoming.stackingKey)
  if (effects.some(effect => effect.linkedLifetime?.protectedRemoval &&
    (effect.id === input.incoming.id || effect.stackingKey === input.incoming.stackingKey))) {
    return { effects, status: 'rejected-duplicate', removedIds: [] }
  }
  if (input.incoming.stackingPolicy === 'stack') {
    const occupiedIds = new Set(effects.map((effect) => effect.id))
    let incoming = input.incoming
    if (occupiedIds.has(incoming.id)) {
      let ordinal = 2
      while (occupiedIds.has(`${input.incoming.id}:stack-${ordinal}`)) ordinal += 1
      incoming = { ...input.incoming, id: `${input.incoming.id}:stack-${ordinal}` }
    }
    return { effects: [...effects, incoming], status: 'applied', removedIds: [] }
  }
  if (matching.length === 0) {
    return { effects: [...effects.filter((effect) => effect.id !== input.incoming.id), input.incoming], status: 'applied', removedIds: [] }
  }
  if (input.incoming.stackingPolicy === 'reject') {
    return { effects, status: 'rejected-duplicate', removedIds: [] }
  }
  if (input.incoming.stackingPolicy === 'keep-strongest') {
    const strongest = Math.max(...matching.map((effect) => effect.potency ?? 0))
    if (strongest >= (input.incoming.potency ?? 0)) return { effects, status: 'kept-stronger', removedIds: [] }
  }
  const removedIds = matching.map((effect) => effect.id)
  if (input.incoming.stackingPolicy === 'refresh-duration') {
    const existing = matching[0]
    // Reapplying an ongoing disease/curse must not postpone its next day tick.
    const incomingPeriodic = input.incoming.campaignPeriodicHitPointMaximumReduction
    const existingPeriodic = existing.campaignPeriodicHitPointMaximumReduction
    const refreshed = { ...input.incoming, id: existing.id,
      ...(incomingPeriodic && existingPeriodic ? {
        campaignPeriodicHitPointMaximumReduction: {
          ...incomingPeriodic,
          nextWorldMinute: existingPeriodic.nextWorldMinute,
          lastResolvedWorldMinute: existingPeriodic.lastResolvedWorldMinute,
        },
      } : {}),
    }
    return {
      effects: [...effects.filter((effect) => effect.stackingKey !== input.incoming.stackingKey), refreshed],
      status: 'refreshed',
      removedIds: removedIds.slice(1),
    }
  }
  return {
    effects: [...effects.filter((effect) => effect.stackingKey !== input.incoming.stackingKey), input.incoming],
    status: 'replaced',
    removedIds,
  }
}

export function removeDnd5eActiveEffectsForEvent(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  trigger: Dnd5eActiveEffectBreakTrigger
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const effects = normalizeDnd5eActiveEffects(input.effects)
  return removeDnd5eActiveEffectsByIds({
    effects,
    allowProtectedLifecycle: true,
    ids: effects
      .filter((effect) => effect.breakOn?.includes(input.trigger) === true)
      .map((effect) => effect.id),
  })
}

/**
 * Removes post-effect restrictions whose lifetime is defined only by a combat
 * turn boundary. Once combat ends there is no next target turn that can expire
 * them, so retaining them would lock exploration actions indefinitely.
 *
 * Round-based post-effects (for example Wind Walk's one-minute transition)
 * remain intact because campaign time can continue advancing those effects.
 */
export function removeDnd5eTurnBoundAfterEffectsAtCombatEnd(
  effects?: readonly Dnd5eActiveEffectInstance[],
): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const normalized = normalizeDnd5eActiveEffects(effects)
  return removeDnd5eActiveEffectsByIds({
    effects: normalized,
    ids: normalized.filter((effect) =>
      effect.duration.type === 'until-turn-boundary' &&
      (
        effect.definitionId.endsWith(':after-effect-ends') ||
        effect.source.rulesId?.endsWith(':after-effect-ends') === true
      ),
    ).map((effect) => effect.id),
  })
}

export function dnd5eActiveEffectRemainingLabel(effect: Pick<Dnd5eActiveEffectInstance, 'duration'>): string {
  if (effect.duration.type === 'permanent') return '永久（由 DM 或规则解除）'
  if (effect.duration.type === 'concentration') {
    return effect.duration.remainingRounds == null
      ? '专注期间'
      : `专注期间，最多 ${effect.duration.remainingRounds} 轮`
  }
  if (effect.duration.type === 'rounds') return `剩余 ${effect.duration.remainingRounds} 轮`
  if (effect.duration.includeCreationTurn === true) {
    return effect.duration.boundary === 'source-turn-end' ? '直到来源最近一次回合结束（包含当前回合）' : '直到目标最近一次回合结束（包含当前回合）'
  }
  const labels: Record<Dnd5eActiveEffectTurnBoundary, string> = {
    'source-turn-start': '来源下回合开始',
    'source-turn-end': '来源下回合结束',
    'target-turn-start': '目标下回合开始',
    'target-turn-end': '目标下回合结束',
  }
  return `直到${labels[effect.duration.boundary]}`
}

/** Called only after a weapon attack has fully resolved, so its last use still applies. */
export function spendDnd5eWeaponEnchantmentAttack(effects: readonly Dnd5eActiveEffectInstance[] | undefined, weaponId: string | undefined): Dnd5eActiveEffectInstance[] {
  const ammunitionEffectId=dnd5eActiveAmmunitionEnchantment(effects,weaponId)?.id
  const effectiveIds = new Set(effectiveDnd5eActiveEffects(effects).map(effect => effect.id))
  return (effects ?? []).flatMap(effect => {
    const binding = effect.modifiers?.weaponEnchantment
    if((binding?.ammunitionContainer || binding?.ammunitionStack) && effect.id!==ammunitionEffectId)return [effect]
    if (!weaponId || !binding || !(binding.weaponId === weaponId || (binding.ammunitionContainer || binding.ammunitionStack) && binding.weaponIds?.includes(weaponId)) || binding.remainingAttacks == null || !effectiveIds.has(effect.id)) return [effect]
    if (binding.remainingAttacks <= 1) return []
    return [{...effect,modifiers:{...effect.modifiers,weaponEnchantment:{...binding,remainingAttacks:binding.remainingAttacks-1}}}]
  })
}

/** Record loss of an uninterrupted completion requirement before projecting state.
 * Once interrupted, restoring the condition does not restore completion eligibility.
 */
export function reconcileDnd5eEffectCompletionRequirements(effects: readonly Dnd5eActiveEffectInstance[], previousEffects: readonly Dnd5eActiveEffectInstance[] = effects): Dnd5eActiveEffectInstance[] {
  if (!effects.some(effect => effect.completionRequirement)) return [...effects]
  const active = effectiveDnd5eActiveEffects(effects)
  const activeIds = new Set(active.map(effect => effect.id))
  const conditions = new Set(active.flatMap(effect => effect.standardCondition ? [effect.standardCondition] : []))
  const previous = new Map(previousEffects.map(effect => [effect.id,effect]))
  return effects.map(effect => {
    const requirement = effect.completionRequirement
    const prior = previous.get(effect.id)
    const previouslyInterrupted = prior?.appliedAt === effect.appliedAt && prior?.completionRequirement?.interrupted === true
    if (!requirement || requirement.interrupted || (!previouslyInterrupted && activeIds.has(effect.id) && conditions.has(requirement.condition))) return effect
    return {...effect,completionRequirement:{...requirement,interrupted:true}}
  })
}


/** Omitted targets are a UI availability query; execution must pass concrete targets. */
export function dnd5eGrantedActivityTargetsAllowed(effect: Dnd5eActiveEffectInstance, targetIds?: readonly string[]): boolean {
  return (!effect.grantedActivityCharges || (normalizeDnd5eEffectGrantCharges(effect.grantedActivityCharges)?.current ?? 0) > 0) &&
    !dnd5eActiveEffectIsSuspended(effect) && (effect.grantedActivityTargetIds == null || targetIds == null ||
    (targetIds.length > 0 && targetIds.every(id => effect.grantedActivityTargetIds!.includes(id))))
}

function validSkillCheckBonuses(value: unknown): value is NonNullable<Dnd5eActiveEffectModifiers['skillCheckBonuses']> {
  return Array.isArray(value) && value.length > 0 && value.every(rule =>
    rule != null && typeof rule === 'object' && !Array.isArray(rule) &&
    Object.keys(rule).every(key => ['skill', 'ability', 'bonus'].includes(key)) &&
    typeof rule.skill === 'string' && Number.isFinite(rule.bonus) &&
    validDnd5eAbilityCheckRule({ mode: 'advantage', skill: rule.skill, ability: rule.ability }))
}

export function dnd5eActiveSkillCheckBonus(effects: readonly Dnd5eActiveEffectInstance[] | undefined, ability: AbilityKey, skill?: string): number {
  if (!skill) return 0
  return effectiveDnd5eActiveEffects(effects).flatMap(effect => effect.modifiers?.skillCheckBonuses ?? [])
    .filter(rule => rule.skill === skill && (rule.ability == null || rule.ability === ability))
    .reduce((total, rule) => total + rule.bonus, 0)
}


/** Subjective hostility never grants sight of a creature; callers still check perception. */
export function dnd5eActivePerceivesVisibleCreaturesAsHostile(effects: readonly Dnd5eActiveEffectInstance[] | undefined): boolean {
  return effectiveDnd5eActiveEffects(effects).some(effect => effect.modifiers?.perceiveVisibleCreaturesAsHostile === true)
}

export function dnd5eActiveRequiresOpportunityAttacks(effects: readonly Dnd5eActiveEffectInstance[] | undefined): boolean {
  return effectiveDnd5eActiveEffects(effects).some(effect => effect.modifiers?.mandatoryOpportunityAttacks === true)
}

export function dnd5eActiveRandomizesVisibleCreatureTargets(effects: readonly Dnd5eActiveEffectInstance[] | undefined): boolean {
  return effectiveDnd5eActiveEffects(effects).some(effect => effect.modifiers?.randomVisibleCreatureTargets === true)
}

/** Active source instances are retained so an embedded endpoint can end exactly its granting spell. */
export function dnd5eActiveSolidMaterialTraversals(effects: readonly Dnd5eActiveEffectInstance[] | undefined) {
  return effectiveDnd5eActiveEffects(effects).flatMap(effect => effect.modifiers?.solidMaterialTraversal
    ? [{ effect, rule: effect.modifiers.solidMaterialTraversal }] : [])
}


