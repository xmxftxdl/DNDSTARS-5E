import type { AbilityKey } from '../../lib/dnd'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import generatedSrdMonsterCatalog from './generated/srdMonsters.generated.json'
import reviewedMonsterTranslations from './generated/srdMonsterTranslationsZh.reviewed.generated.json'
import { getDnd5eRoomMonster } from './roomMonsterCatalog'
import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eStandardConditionId } from './conditions'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
import type {
  Dnd5eActiveEffectModifiers,
  Dnd5eActiveEffectPeriodicDamage,
  Dnd5eActiveEffectRemoval,
  Dnd5eActiveEffectRepeatSave,
} from './activeEffects'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'

export { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
export { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'
export type Dnd5eMonsterSize = '微型' | '小型' | '中型' | '大型' | '超大型' | '巨型'
export type Dnd5eMonsterAutomation = 'headless' | 'dm-adjudication'
export type Dnd5eMonsterTargetPriority =
  | 'nearest'
  | 'lowest-current-hp'
  | 'lowest-hp-percentage'
  | 'lowest-armor-class'
  | 'highest-threat'

export interface Dnd5eMonsterTargetingPreferenceV1 {
  schemaVersion: 1
  priority: Dnd5eMonsterTargetPriority
}

export type Dnd5eMonsterBehaviorStyle =
  | 'balanced'
  | 'aggressive'
  | 'defensive'
  | 'skirmisher'
  | 'cowardly'

export interface Dnd5eMonsterBehaviorPreferenceV1 {
  schemaVersion: 1
  style: Dnd5eMonsterBehaviorStyle
}

export interface Dnd5eMonsterMechanicTriggerV1 {
  schemaVersion: 1
  id: string
  name: string
  event: 'turn-start'
  predicates: {
    hpPercentageAtOrBelow: number
    requiresPositiveHp: boolean
  }
  effect: {
    kind: 'healing'
    dice: { count: number; sides: number; bonus: number }
  }
  limit: 'once-per-turn' | 'once-per-combat' | 'unlimited'
  automation: 'headless'
}

export type Dnd5eMonsterMechanicTriggerEventV2 =
  | 'turn-start'
  | 'turn-end'
  | 'after-hit'
  | 'after-miss'
  | 'when-hit'
  | 'after-dealt-damage'
  | 'after-damaged'
  | 'saving-throw-magic'
  | 'saving-throw-physical'
  | 'movement'
  | 'phase-transition'

export type Dnd5eMonsterMechanicSubjectV2 = 'self' | 'ally-within' | 'hostile-within'

export type Dnd5eMonsterMechanicEffectTargetV2 =
  | 'self'
  | 'trigger-target'
  | 'damage-source'
  | 'selected-subject'

export type Dnd5eMonsterMechanicDurationV2 =
  | { kind: 'permanent' }
  | { kind: 'until-target-turn-start' }
  | { kind: 'until-source-turn-start' }
  | { kind: 'rounds'; rounds: number }

export type Dnd5eMonsterMechanicEffectV2 =
  | {
      id: string
      kind: 'healing'
      target: 'self'
      dice: { count: number; sides: number; bonus: number }
    }
  | {
      id: string
      kind: 'temporary-hit-points'
      target: 'self'
      dice: { count: number; sides: number; bonus: number }
    }
  | {
      id: string
      kind: 'damage'
      target: Dnd5eMonsterMechanicEffectTargetV2
      dice: { count: number; sides: number; bonus: number }
      /** 固定类型，或从触发本机制的权威伤害事件继承其首个伤害类型。 */
      damageType: Dnd5eDamageType | 'inherit-trigger'
    }
  | {
      id: string
      kind: 'standard-condition'
      target: Dnd5eMonsterMechanicEffectTargetV2
      condition: Dnd5eStandardConditionId
      duration: Dnd5eMonsterMechanicDurationV2
    }
  | {
      id: string
      kind: 'remove-standard-condition'
      target: Dnd5eMonsterMechanicEffectTargetV2
      condition: Dnd5eStandardConditionId
    }
  | {
      id: string
      kind: 'summon'
      monsterId: string
      count: number
      durationRounds: number
    }
  | {
      id: string
      kind: 'area-attack'
      shape: 'circle' | 'cone' | 'line'
      rangeFeet: number
      sizeFeet: number
      dice: { count: number; sides: number; bonus: number }
      damageType: Dnd5eDamageType
    }
  | {
      id: string
      kind: 'roll-modifier'
      target: Dnd5eMonsterMechanicEffectTargetV2
      roll: 'attack' | 'damage' | 'saving-throw'
      mode: 'bonus' | 'advantage' | 'disadvantage'
      bonus?: number
    }
  | {
      id: string
      kind: 'attack'
      target: Dnd5eMonsterMechanicEffectTargetV2
      /** Legacy mechanics omit this field and resolve as melee attacks. */
      attackMode?: 'melee' | 'ranged'
      toHit: number
      economy?: 'none' | 'reaction'
      damage: Dnd5eMonsterDamage
    }

export interface Dnd5eMonsterMechanicTriggerV2 {
  schemaVersion: 2
  id: string
  name: string
  trigger: {
    event: Dnd5eMonsterMechanicTriggerEventV2
    subject?: Dnd5eMonsterMechanicSubjectV2
    radiusFeet?: number
    movement?: { comparison: 'at-least' | 'at-most'; feet: number }
  }
  predicates: {
    hpPercentageAtOrBelow?: number
    hpPercentageAtOrAbove?: number
    /** 当前生命值严格小于该固定数值。 */
    hpBelow?: number
    /** 当前生命值小于或等于该固定数值。 */
    hpAtOrBelow?: number
    /** 当前生命值严格大于该固定数值。 */
    hpAbove?: number
    /** 当前生命值大于或等于该固定数值。 */
    hpAtOrAbove?: number
    requiresPositiveHp: boolean
  }
  effects: readonly Dnd5eMonsterMechanicEffectV2[]
  limit: 'once-per-turn' | 'once-per-combat' | 'unlimited'
  automation: 'full' | 'partial' | 'manual'
}

export type Dnd5eMonsterMechanicTrigger = Dnd5eMonsterMechanicTriggerV1 | Dnd5eMonsterMechanicTriggerV2

export interface Dnd5eMonsterDamage {
  average: number
  count: number
  sides: number
  bonus: number
  type: Dnd5eDamageType
}

/**
 * A deterministic effect resolved after one concrete weapon attack hits.
 * The stable id and array index identify the effect within that attack; a
 * resolver pairs them with the concrete attack index inside a Multiattack.
 */
export interface Dnd5eMonsterSavingThrowDamageOnHitEffect {
  id: string
  kind: 'saving-throw-damage'
  ability: AbilityKey
  dc: number
  /** The saving throw is against a magical effect rather than the weapon damage. */
  magical?: boolean
  damage: readonly Dnd5eMonsterDamage[]
  damageOnSuccessfulSave: 'none' | 'half'
  /** A condition applied by this same saving throw only when the save fails. */
  conditionOnFailedSave?: Dnd5eMonsterFailedSaveCondition
  /** Additional dependent or margin-gated conditions from the same save. */
  additionalConditionsOnFailedSave?: readonly Dnd5eMonsterFailedSaveCondition[]
  /**
   * A special outcome caused by this effect's final damage component. It is
   * eligible only when removing this effect's damage would leave the target
   * above 0 hit points, so base weapon damage cannot trigger it accidentally.
   */
  onEffectDamageReducesTargetToZero?: {
    stabilize: true
    conditions: readonly {
      condition: Dnd5eStandardConditionId
      durationRounds: number
      /** The dependent condition ends when this source-specific condition ends. */
      dependsOnCondition?: Dnd5eStandardConditionId
    }[]
  }
}

/**
 * A saving throw caused by a weapon hit whose only additional outcome is a
 * condition. Keeping this separate from saving-throw-damage avoids inventing
 * a zero-damage component for effects such as a bone devil's poisoned sting.
 */
export interface Dnd5eMonsterSavingThrowConditionOnHitEffect {
  id: string
  kind: 'saving-throw-condition'
  ability: AbilityKey
  dc: number
  /** The saving throw is against a magical effect rather than the weapon damage. */
  magical?: boolean
  conditionOnFailedSave: Dnd5eMonsterFailedSaveCondition
  /** Additional dependent or margin-gated conditions from the same save. */
  additionalConditionsOnFailedSave?: readonly Dnd5eMonsterFailedSaveCondition[]
}

export interface Dnd5eMonsterSourceLinkedConditionOnHitEffect {
  id: string
  kind: 'source-linked-condition'
  relation: {
    kind: 'grapple' | 'attachment' | 'swallowed' | 'engulfed'
    /**
     * Stable source-local capacity bucket. Different actions may intentionally
     * share one slot group (for example, two claws backed by the same pool).
     */
    slotGroup: string
    capacity: number
    maxDistanceFeet: number
    /** Tiny=0, Small=1, Medium=2, Large=3, Huge=4, Gargantuan=5. */
    targetMaxSizeRank: number
    whenCapacityFull: 'skip-application' | 'linked-target-only'
    /**
     * How the two combatants remain coupled while this relation is active.
     * Ordinary grapples drag the target; swallowed/engulfed targets are
     * carried; an attached cloaker rides its target.
     */
    movement?: 'drag-target' | 'carry-target' | 'source-rides-target'
    /** Defaults to true for grapples/attachments and false for internal holds. */
    endsOnSourceIncapacitated?: boolean
    attackAdvantageAgainstLinkedTarget?: boolean
    /** The relation's source attack automatically hits this already-linked target. */
    attackAutomaticallyHitsLinkedTarget?: boolean
  }
  /** Omit only when the relation has no ordinary escape check (for example swallowed). */
  escapeDc?: number
  /** Some relations are applied only after a failed save on the weapon hit. */
  savingThrow?: {
    ability: AbilityKey
    dc: number
    magical?: boolean
  }
  conditions: readonly {
    condition: Dnd5eStandardConditionId
    /** Dependent conditions end together with their source-specific parent. */
    dependsOnCondition?: Dnd5eStandardConditionId
  }[]
  /**
   * Non-standard mechanical states that end with the relation root. This is
   * intentionally bounded text rather than an executable callback; examples
   * include "unable-to-breathe" while engulfed.
   */
  dependentLegacyConditions?: readonly string[]
  /** Mechanical relation roots such as a cloaker attachment have no standard condition. */
  rootLegacyCondition?: string
  /** Conditions that apply only when the triggering attack had effective advantage. */
  conditionsWhenAttackHasAdvantage?: readonly {
    condition: Dnd5eStandardConditionId
  }[]
  /**
   * Replaces an existing relation from another slot group atomically. Tarrasque
   * Swallow, for example, ends the Bite grapple only after Swallow hits.
   */
  removeSourceRelationSlotGroupOnApply?: string
  /** Mechanical modifiers owned by the root relation for exactly its lifetime. */
  modifiers?: Dnd5eActiveEffectModifiers
  /** Optional damage carried by the root relation for exactly its lifetime. */
  periodicDamage?: Omit<Dnd5eActiveEffectPeriodicDamage, 'lastResolvedTurnKey'>
}

export interface Dnd5eMonsterPersistentOnHitEffect {
  id: string
  kind: 'persistent-effect'
  /** Whether the persistent rider itself is magical, independent of a save. */
  magical?: boolean
  /** Omit when a hit always applies the effect. */
  savingThrow?: {
    ability: AbilityKey
    dc: number
    magical?: boolean
  }
  /** Creature categories that do not receive or roll against this effect. */
  targetCreatureTypeExclusions?: readonly ('construct' | 'undead')[]
  /** Creature categories that are eligible to receive or roll against this effect. */
  targetCreatureTypeRequirements?: readonly ['humanoid']
  definitionId: string
  label: string
  /** A non-standard ailment projected alongside any standard condition. */
  ailment?: 'disease' | 'curse'
  /** Combat duration. Omit for a permanent effect. */
  durationRounds?: number
  standardCondition?: Dnd5eStandardConditionId
  periodicDamage?: Omit<Dnd5eActiveEffectPeriodicDamage, 'lastResolvedTurnKey'>
  /**
   * A calendar-time maximum-HP reduction retained for the campaign clock.
   * Headless combat must never reinterpret this declaration as turn damage.
   */
  campaignPeriodicHitPointMaximumReduction?: {
    intervalHours: number
    reduction: {
      average: number
      count: number
      sides: number
      bonus: number
    }
    execution: 'campaign-time-only'
    recovery: 'when-effect-removed'
  }
  repeatSave?: Dnd5eActiveEffectRepeatSave
  modifiers?: Dnd5eActiveEffectModifiers
  removal?: Dnd5eActiveEffectRemoval
  stacking: 'refresh' | 'increase-periodic-dice'
}

export interface Dnd5eMonsterForcedMovementOnHitEffect {
  id: string
  kind: 'forced-movement'
  resistance:
    | {
        kind: 'saving-throw'
        ability: AbilityKey
        dc: number
        magical?: boolean
      }
    | {
        kind: 'opposed-ability-check'
        sourceAbility: AbilityKey
        targetAbility: AbilityKey
      }
  direction: 'away-from-source' | 'toward-source'
  maximumDistanceFeet: number
  /** Tiny=0, Small=1, Medium=2, Large=3, Huge=4, Gargantuan=5. */
  targetMaxSizeRank?: number
  /** Optional condition applied when the target fails to resist the movement. */
  conditionOnFailedResistance?: Dnd5eStandardConditionId
}

export interface Dnd5eMonsterHitPointMaximumReductionOnHitEffect {
  id: string
  kind: 'hit-point-maximum-reduction'
  /** Selects already-resolved, post-defense damage from this concrete hit. */
  damageBasis:
    | { kind: 'all-attack-damage' }
    | { kind: 'damage-type'; damageType: Dnd5eDamageType }
  /** Omit for effects such as a vampire's Bite that do not allow a save. */
  savingThrow?: {
    ability: AbilityKey
    dc: number
    magical?: boolean
  }
  recovery: 'long-rest' | 'greater-restoration-or-other-magic'
  /** The source regains HP equal to the selected damage, not the capped max-HP delta. */
  healSourceByAmount?: boolean
}

export type Dnd5eMonsterOnHitEffect =
  | Dnd5eMonsterSavingThrowDamageOnHitEffect
  | Dnd5eMonsterSavingThrowConditionOnHitEffect
  | Dnd5eMonsterSourceLinkedConditionOnHitEffect
  | Dnd5eMonsterPersistentOnHitEffect
  | Dnd5eMonsterForcedMovementOnHitEffect
  | Dnd5eMonsterHitPointMaximumReductionOnHitEffect

export interface Dnd5eMonsterWeaponAttack {
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  /** Explicit ability used by the attack. Older catalog rows are inferred conservatively. */
  attackAbility?: 'str' | 'dex'
  toHit: number
  reachFeet?: number
  rangeFeet?: { normal: number; long: number }
  /** A target restriction on the attack itself, not merely an on-hit rider. */
  targetMaxSizeRank?: number
  target: string
  damage: readonly Dnd5eMonsterDamage[]
  /**
   * Alternate damage used when a melee-or-ranged attack is made beyond its
   * melee reach. Omit when both modes use the same damage expression.
   */
  rangedDamage?: readonly Dnd5eMonsterDamage[]
  /** Natural d20 result that starts the critical range. Defaults to 20. */
  criticalThreshold?: number
  /** Extra dice added only on a critical hit, after normal damage dice are doubled. */
  criticalExtraDamage?: readonly Dnd5eMonsterDamage[]
  /** 群集在生命值不高于一半时使用的替代伤害。 */
  damageAtHalfHp?: readonly Dnd5eMonsterDamage[]
  onHit?: string
  /** Indexed structured effects resolved independently for every attack hit. */
  onHitEffects?: readonly Dnd5eMonsterOnHitEffect[]
  /** Legacy single-condition representation retained for saved custom monsters. */
  onHitRule?: {
    kind: 'saving-throw-condition'
    ability: AbilityKey
    dc: number
    condition: Dnd5eStandardConditionId | 'disease'
  }
}

export interface Dnd5eMonsterAreaSavingThrowEffect {
  area: SkillAoeTargeting
  target: 'hostile' | 'all-creatures-except-self'
  /** Creature categories excluded by the SRD action before any saving throw is rolled. */
  targetCreatureTypeExclusions?: readonly ('aberration' | 'demon' | 'undead')[]
  ability: AbilityKey
  dc: number
  /** The saving throw is against a magical monster effect. */
  magical?: boolean
  /** Every submitted target must be visible to the acting monster. */
  requiresSourceCanSeeTarget?: boolean
  /** Every submitted target must be able to see the acting monster. */
  requiresTargetCanSeeSource?: boolean
  /** Every submitted target must be able to hear the acting monster. */
  requiresTargetCanHearSource?: boolean
  /** Omit for pure control effects such as Frightful Presence. */
  damage?: Dnd5eMonsterDamage
  damageOnSuccessfulSave?: 'none' | 'half'
  conditionOnFailedSave?: Dnd5eMonsterFailedSaveCondition
  /** Additional margin-gated or dependent conditions caused by the same save. */
  additionalConditionsOnFailedSave?: readonly Dnd5eMonsterFailedSaveCondition[]
  forcedMovementOnFailedSave?: {
    direction: 'away-from-source'
    maximumDistanceFeet: number
  }
  activeEffectOnFailedSave?: {
    id: string
    label: string
    durationRounds: number
    repeatSaveAtEndOfTargetTurn: boolean
    modifiers: Pick<
      Dnd5eActiveEffectModifiers,
      | 'speedMultiplier'
      | 'preventReactions'
      | 'maximumAttacksPerTurn'
      | 'actionOrBonusActionOnly'
      | 'strengthRollMode'
    >
  }
  /** Source-specific immunity granted after this Frightful Presence save. */
  frightfulPresenceImmunityRounds?: number
  /** Immunity granted on an initial success or when the failed-save effect ends. */
  immunityOnSuccessfulSaveOrEffectEnd?: Dnd5eMonsterActionImmunityRule
}

export interface Dnd5eMonsterFailedSaveCondition {
  condition: Dnd5eStandardConditionId
  durationRounds: number
  repeatSaveAtEndOfTargetTurn: boolean
  /** Use the end of the source's next turn instead of target-round ticking. */
  expiresAtSourceTurnEnd?: boolean
  /** Repeat saves have disadvantage while the source remains visible. */
  repeatSaveDisadvantageWhenSourceVisible?: boolean
  breakOnDamage?: boolean
  /** Another creature within reach can spend an action to wake this target. */
  canBeAwakenedByAction?: boolean
  /** Apply only when the saving throw total misses the DC by at least this amount. */
  minimumFailureMargin?: number
  /** The condition is removed automatically when its sibling parent ends. */
  dependsOnCondition?: Dnd5eStandardConditionId
  /** Healing is prevented while this condition instance remains active. */
  preventHealing?: boolean
  /** A failed repeat save replaces this condition with a permanent condition. */
  onRepeatSaveFailureTransition?: {
    replaceWithCondition: Dnd5eStandardConditionId
    duration: 'permanent'
  }
}

export type Dnd5eMonsterActionImmunityRule = {
  durationRounds: number
  scope:
    | { kind: 'source-action' }
    | {
        kind: 'catalog-action'
        /** Stable key checked by this action before it accepts a target. */
        actionKey: string
        /** Stable action-family keys granted when immunity begins. */
        grantedActionKeys: readonly string[]
      }
}

export interface Dnd5eMonsterAreaSavingThrowVariant extends Dnd5eMonsterAreaSavingThrowEffect {
  id: string
  name: string
}

export type Dnd5eMonsterAreaSavingThrowRule =
  | ({ kind: 'area-saving-throw'; variants?: never } & Dnd5eMonsterAreaSavingThrowEffect)
  | {
      kind: 'area-saving-throw'
      variants: readonly Dnd5eMonsterAreaSavingThrowVariant[]
    }

export interface Dnd5eMonsterLegendaryWingAttackRule {
  /** Stable SRD data for the dragon legendary action; never parsed from translated prose. */
  kind: 'legendary-wing-attack'
  rangeFeet: number
  target: 'all-creatures-except-self'
  ability: 'dex'
  dc: number
  damage: Dnd5eMonsterDamage & { type: 'bludgeoning' }
  damageOnSuccessfulSave: 'none'
  conditionOnFailedSave: 'prone'
  followUpMovement: {
    kind: 'grant-fly-movement'
    maximumSpeedFraction: number
  }
}

export type Dnd5eMonsterSpecialActionRule =
  | {
      kind: 'ability-check'
      ability: AbilityKey
      skillKey?: string
    }
  | {
      /** Fixed-range self teleport to one visible, unoccupied destination. */
      kind: 'teleport'
      target: 'self'
      rangeFeet: number
      requiresVisibleDestination: true
      requiresUnoccupiedDestination: true
    }
  | {
      /**
       * A monster-authored invisibility action. Break conditions are stable
       * identifiers, never inferred from translated action prose.
       */
      kind: 'invisibility'
      target: 'self'
      concentration: true
      maximumDurationRounds?: number
      breakOn: readonly ('makes-attack' | 'casts-spell')[]
      breakOnMonsterAbilityIds?: readonly string[]
    }
  | {
      kind: 'saving-throw-condition'
      rangeFeet: number
      ability: AbilityKey
      dc: number
      condition: Dnd5eStandardConditionId
      magical?: boolean
      requiresSourceCanSeeTarget?: boolean
      requiresTargetCanSeeSource?: boolean
      durationRounds?: number
      expiresAtSourceTurnEnd?: boolean
      repeatSaveAtEndOfTargetTurn?: boolean
      repeatSaveDisadvantageWhenSourceVisible?: boolean
      additionalConditionsOnFailedSave?: readonly Dnd5eMonsterFailedSaveCondition[]
      immunityOnSuccessfulSaveOrEffectEnd?: Dnd5eMonsterActionImmunityRule
      preventReactions?: boolean
      repeatSaveOnDamage?: boolean
    }
  | {
      kind: 'conditioned-damage-and-healing'
      requiredCondition: Dnd5eStandardConditionId
      requireSameSource: boolean
      damage: Dnd5eMonsterDamage
    }
  | {
      /** SRD celestials' finite-use touch: deterministic healing plus bounded cures. */
      kind: 'healing-touch'
      rangeFeet: 5
      target: 'another-living-creature'
      healing: { count: number; sides: number; bonus: number }
      removes: readonly ('curse' | 'disease' | 'poisoned' | 'blinded' | 'deafened')[]
    }
  | {
      /** Roper Reel: move every target held by one source-linked slot group. */
      kind: 'source-linked-reel'
      slotGroup: string
      maximumDistanceFeet: number
    }
  | {
      /**
       * Converts a creature already grappled by this source into a carried
       * engulf relation. A composite Multiattack may satisfy the grapple
       * prerequisite with its immediately preceding hit pair.
       */
      kind: 'source-linked-engulf'
      targetMaxSizeRank: number
      effect: Dnd5eMonsterSourceLinkedConditionOnHitEffect
    }
  | {
      /**
       * Throws one creature held by a source-linked grapple. The Host owns
       * wall-aware placement while Headless verifies the submitted straight
       * displacement, releases the exact relation and resolves any collision.
       */
      kind: 'throw-linked-target'
      slotGroup: string
      maximumDistanceFeet: number
      targetMaxSizeRank: number
      collisionDamage: {
        distanceFeetPerDie: number
        sides: number
        type: Dnd5eDamageType
      }
      conditionAfterThrow: Dnd5eStandardConditionId
    }
  | {
      /**
       * A defensive reaction that raises AC against one qualifying melee
       * attack. The Headless engine only spends the reaction when the bonus
       * actually changes the hit into a miss.
       */
      kind: 'parry'
      armorClassBonus: number
      requiresSight: true
      requiresWieldedMeleeWeapon: true
    }
  | {
      /** Chain Devil Unnerving Mask, offered when a visible creature starts its turn. */
      kind: 'turn-start-saving-throw-reaction'
      rangeFeet: number
      ability: AbilityKey
      dc: number
      condition: Dnd5eStandardConditionId
      duration: 'until-target-turn-end'
      magical: true
      requiresMutualVisualSight: true
    }
  | Dnd5eMonsterLegendaryWingAttackRule
  | Dnd5eMonsterAreaSavingThrowRule

export function dnd5eMonsterAreaSavingThrowVariants(
  action: Pick<Dnd5eMonsterAction, 'name' | 'rule'>,
): readonly Dnd5eMonsterAreaSavingThrowVariant[] {
  const rule = action.rule
  if (rule?.kind !== 'area-saving-throw') return []
  if (rule.variants) return rule.variants
  return [{ id: 'default', name: action.name, ...rule }]
}

export function dnd5eMonsterAreaSavingThrowEffect(
  action: Pick<Dnd5eMonsterAction, 'name' | 'rule'>,
  variantId?: string,
): Dnd5eMonsterAreaSavingThrowVariant | undefined {
  const variants = dnd5eMonsterAreaSavingThrowVariants(action)
  if (variants.length === 0) return undefined
  if (action.rule?.kind === 'area-saving-throw' && action.rule.variants) {
    return variantId ? variants.find((variant) => variant.id === variantId) : undefined
  }
  return variantId == null || variantId === 'default' ? variants[0] : undefined
}

export interface Dnd5eMonsterTrait {
  name: string
  description: string
  automation?: Dnd5eMonsterAutomation
  rule?: {
    /**
     * Declarative catalog ownership for the already-authoritative Legendary
     * Resistance resource. Runtime uses remain stored on the stat block and
     * combatant state rather than duplicated in this declaration.
     */
    kind: 'legendary-resistance'
    maximumUses: number
  } | {
    kind: 'undead-fortitude'
    dcBase: number
    excludedDamageTypes: readonly Dnd5eDamageType[]
    excludedOnCritical: boolean
  } | {
    kind: 'regeneration'
    amount: number
    requiresPositiveHp: boolean
    suppressedByDamageTypes: readonly Dnd5eDamageType[]
    diesAtZeroWhenSuppressed: boolean
  } | {
    kind: 'swarm'
    cannotRegainHitPoints: true
    cannotGainTemporaryHitPoints: true
  } | {
    kind: 'nimble-escape'
    bonusActionOptions: readonly ['disengage', 'hide']
  } | {
    /** Flying movement does not provoke opportunity attacks. */
    kind: 'flyby'
    movementMode: 'fly'
    provokesOpportunityAttacks: false
  } | {
    /** A conditional skill bonus tied to one sense, with an optional combat sense. */
    kind: 'keen-sense'
    sense: 'smell' | 'hearing' | 'sight'
    skillKey: string
    checkBonus: number
    blindsightFeet?: number
  } | {
    /** Initiative advantage only when the creature actually starts combat as an ambusher. */
    kind: 'ambusher'
    initiativeAdvantageWhenSurprising: true
  } | {
    /** Doppelganger-style first-round advantage against a still-surprised target. */
    kind: 'ambusher-attack-advantage'
    requiredRound: 1
    targetState: 'currently-surprised'
  } | {
    /** Advantage on concrete melee attacks against a target below maximum HP. */
    kind: 'blood-frenzy'
    attackMode: 'melee'
    targetHitPoints: 'below-maximum'
  } | {
    /** Extra damage on every qualifying hit against a still-surprised target. */
    kind: 'surprise-attack'
    requiredRound: 1
    targetState: 'currently-surprised'
    applyOn: 'each-qualifying-hit'
    extraDamage: Omit<Dnd5eMonsterDamage, 'type'> & { type: 'inherit-primary' }
  } | {
    /** Assassin: first-round advantage before the target acts and critical hits against surprise. */
    kind: 'assassinate'
    requiredRound: 1
    advantageAgainst: 'target-not-yet-acted'
    automaticCriticalAgainst: 'currently-surprised'
  } | {
    /** Rogue-style monster Sneak Attack, consumed by the first qualifying hit each turn. */
    kind: 'sneak-attack'
    oncePerTurn: true
    allyDistanceFeet: number
    requireNoDisadvantage: true
    advantageOrAdjacentAlly: true
    extraDamage: Omit<Dnd5eMonsterDamage, 'type'> & { type: 'inherit-primary' }
  } | {
    /** Hobgoblin Martial Advantage, consumed by the first qualifying hit each turn. */
    kind: 'martial-advantage'
    oncePerTurn: true
    allyDistanceFeet: number
    requiresAdjacentAlly: true
    extraDamage: Omit<Dnd5eMonsterDamage, 'type'> & { type: 'inherit-primary' }
  } | {
    /**
     * SRD monster Reckless. Catalog monsters use the tactical default of
     * activating this optional feature at turn start.
     */
    kind: 'reckless'
    activation: 'turn-start-tactical-default'
    outgoing: {
      delivery: 'weapon-attack'
      mode: 'melee'
      rollMode: 'advantage'
      duration: 'current-turn'
    }
    incoming: {
      rollMode: 'advantage'
      duration: 'until-source-turn-start'
    }
  } | {
    /** Marilith-style reaction refresh at the start of every creature's turn. */
    kind: 'reactive'
    reactionRefresh: 'every-turn-start'
  } | {
    /** Conditional damage after a straight-line approach; path qualification remains authoritative. */
    kind: 'charge-damage'
    minimumStraightMovementFeet: number
    actionId: string
    extraDamage: Dnd5eMonsterDamage
  } | {
    kind: 'magic-resistance'
    savingThrowAdvantageAgainstMagic: true
  } | {
    kind: 'limited-magic-immunity'
    maximumSpellLevel: number
    advantageAboveMaximum: boolean
    allowsWilling: boolean
  } | {
    /** Every weapon attack made by this stat block counts as magical. */
    kind: 'magic-weapons'
    weaponAttacksMagical: true
  } | {
    /** Flesh Golem: low hit points can force attacks against the nearest visible creature. */
    kind: 'berserk'
    hitPointThreshold: number
    dieSides: number
    minimum: number
    target: 'nearest-visible-creature'
    endsWhenFullyHealed: true
  } | {
    /** A damage type temporarily imposes disadvantage on this creature's rolls. */
    kind: 'damage-aversion'
    damageType: Dnd5eDamageType
    attackRollMode: 'disadvantage'
    abilityCheckRollMode: 'disadvantage'
    duration: 'until-end-of-next-turn'
  } | {
    /** The creature cannot be affected by spells or effects that alter its form. */
    kind: 'immutable-form'
    immuneToFormAlteringEffects: true
  } | {
    /** Incoming damage of one type is replaced by healing for the same amount. */
    kind: 'damage-absorption'
    damageType: Dnd5eDamageType
    healing: 'damage-taken'
  } | {
    /** Advantage while an active ally is close enough to the attack target. */
    kind: 'pack-tactics'
    allyDistanceFeet: number
    requiresAllyNotIncapacitated: true
  } | {
    kind: 'conditional-target-bonus'
    targetConditions: readonly Dnd5eStandardConditionId[]
    attackBonus: number
    damageBonus: number
  } | {
    /** Waterborne contact disease that is checked after a creature lands a nearby melee hit. */
    kind: 'mucous-cloud'
    saveDc: number
    condition: 'disease'
    maximumTriggerDistanceFeet: number
  } | {
    /** Unlimited survival when one qualifying damage instance would reduce the creature to 0 HP. */
    kind: 'relentless'
    maximumDamage: number
  } | {
    /** A passive area saving throw emitted exactly once when this creature dies. */
    kind: 'death-area-saving-throw'
    ruleId: string
    area: Extract<SkillAoeTargeting, { shape: 'circle' }> & { origin: 'self' }
    target: 'all-creatures-except-self'
    ability: AbilityKey
    dc: number
    damage?: Dnd5eMonsterDamage
    damageOnSuccessfulSave?: 'none' | 'half'
    conditionOnFailedSave?: Dnd5eMonsterFailedSaveCondition
  } | {
    /**
     * An optional magical gaze offered at another creature's turn start.
     * The Headless transaction remains authoritative for mutual visual
     * contact, range, surprise, the avert-eyes choice and staged conditions.
     */
    kind: 'turn-start-gaze'
    ruleId: string
    rangeFeet: number
    ability: AbilityKey
    dc: number
    magical: true
    allowAvertEyes: true
    requiresMutualVisualSight: true
    initialCondition: 'restrained'
    failureCondition: 'petrified'
    /** Medusa petrifies immediately when the first save misses by this much. */
    immediateFailureMargin?: number
  }
}

export interface Dnd5eMonsterActionUsage {
  kind: 'recharge'
  dieSides: number
  minimum: number
}

export interface Dnd5eMonsterActionPerDayUsage {
  kind: 'per-day'
  max: number
}

export interface Dnd5eMonsterEquipment {
  id: string
  name: string
  category: 'weapon' | 'armor' | 'shield' | 'gear' | 'consumable' | 'other'
  quantity: number
  description?: string
  armorClass?: number
  linkedActionId?: string
}

export type Dnd5eMonsterTargetEligibilityPredicate =
  | {
      /** A durable relation whose authoritative source is the acting monster. */
      kind: 'source-linked-relation'
      relationKind: 'grapple' | 'attachment' | 'swallowed' | 'engulfed'
      slotGroup?: string
    }
  | {
      /** Semantic incapacitation also includes stunned, paralyzed, and similar states. */
      kind: 'incapacitated'
    }
  | {
      kind: 'standard-condition'
      condition: Dnd5eStandardConditionId
    }

export interface Dnd5eMonsterTargetEligibility {
  kind: 'any-of'
  predicates: readonly Dnd5eMonsterTargetEligibilityPredicate[]
  /**
   * Alternatives that Headless cannot trust without an explicit authorized
   * transaction field. They remain visible to the DM but never pass automatic
   * eligibility on their own.
   */
  dmAdjudicationAlternatives?: readonly {
    kind: 'willing-target'
  }[]
}

export interface Dnd5eMonsterAction {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'multiattack' | 'other'
  /** Ordinary stat-block actions default to an action; reviewed exceptions may use a bonus action. */
  economy?: 'action' | 'bonus-action'
  automation?: Dnd5eMonsterAutomation
  attack?: Dnd5eMonsterWeaponAttack
  sequence?: readonly string[]
  /**
   * A Multiattack whose number of identical weapon occurrences is decided by
   * one authoritative die roll supplied with the transaction.  This keeps
   * variable attacks such as the Violet Fungus's 1d4 Rotting Touches
   * deterministic and replayable instead of sampling inside the rules core.
   */
  randomRepeat?: {
    actionId: string
    dieSides: number
    minimum: number
    maximum: number
  }
  /**
   * Restricts hybrid child attacks in this multiattack to one concrete mode.
   * For example, the Cult Fanatic may throw one dagger at range, but its
   * two-attack Multiattack explicitly permits melee attacks only.
   */
  sequenceAttackMode?: 'melee' | 'ranged'
  usage?: Dnd5eMonsterActionUsage | Dnd5eMonsterActionPerDayUsage
  legendaryCost?: number
  /** Structured non-weapon rule resolved entirely by the Headless engine. */
  rule?: Dnd5eMonsterSpecialActionRule
  /** Source-linked relation precondition shared by weapon and special actions. */
  relationRequirement?:
    | {
        kind: 'none-from-source'
        slotGroup: string
      }
    | {
        kind: 'target-linked-to-source'
        slotGroup: string
      }
  /** Target prerequisites shared by direct use and every Multiattack occurrence. */
  targetEligibility?: Dnd5eMonsterTargetEligibility
  /** 传奇动作直接调用普通武器动作时指向其 ID。 */
  referencedActionId?: string
  movement?: {
    kind: 'straight-toward-visible-hostile'
    maximumSpeedFraction: number
  }
  reactionTrigger?: {
    kind: 'after-action'
    actionId: string
  }
}

export interface Dnd5eMonsterSpellcasting {
  description: string
  casterLevel?: number
  ability?: AbilityKey
  saveDc?: number
  attackBonus?: number
  school?: string
  componentsRequired?: readonly ('V' | 'S' | 'M')[]
  slots?: Readonly<Record<string, number>>
  spells?: readonly {
    id: string
    name: string
    level: number
    usage?: { kind: 'at-will' } | { kind: 'per-day'; max: number }
  }[]
  automation: Dnd5eMonsterAutomation
}

export interface Dnd5eMonsterCapabilities {
  swarm: boolean
  shapechanger: boolean
  regeneration: boolean
  spellcaster: boolean
  legendary: boolean
  hasFlySpeed: boolean
  hasSwimSpeed: boolean
}

export interface Dnd5eMonsterStatBlock {
  id: string
  slug: string
  name: string
  englishName: string
  source: 'SRD 5.1' | 'DM 自定义'
  sourcePage?: number
  size: Dnd5eMonsterSize
  creatureType: string
  subtypes?: readonly string[]
  alignment: string
  armorClass: { value: number; note?: string }
  hitPoints: { average: number; dice: string }
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: boolean }
  abilities: Record<AbilityKey, number>
  savingThrows?: Partial<Record<AbilityKey, number>>
  skills?: readonly { key: string; name: string; bonus: number }[]
  damageVulnerabilities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  damageImmunities?: readonly Dnd5eDamageType[]
  /** Source-aware defenses such as immunity to nonmagical, nonsilvered weapons. */
  damageDefenseRules?: readonly Dnd5eConditionalDamageDefense[]
  /** Canonical clauses retained for DM adjudication instead of being silently discarded. */
  unparsedDamageDefenses?: readonly {
    outcome: 'immune' | 'resistant' | 'vulnerable'
    text: string
  }[]
  conditionImmunities?: readonly string[]
  senses: readonly { name: string; distanceFeet?: number }[]
  passivePerception: number
  languages: readonly string[]
  challenge: { rating: string; xp: number }
  legendaryResistanceUses?: number
  /** Defaults to 3 for legacy legendary monsters. */
  legendaryActionPoints?: number
  /** Lair actions normally resolve on initiative count 20. */
  lairInitiative?: number
  /** Room-owned compressed images. Data URLs are validated at the schema boundary. */
  tokenPortrait?: string
  initiativePortrait?: string
  equipment?: readonly Dnd5eMonsterEquipment[]
  traits: readonly Dnd5eMonsterTrait[]
  actions: readonly Dnd5eMonsterAction[]
  bonusActions?: readonly Dnd5eMonsterAction[]
  reactions?: readonly Dnd5eMonsterAction[]
  legendaryActions?: readonly Dnd5eMonsterAction[]
  lairActions?: readonly Dnd5eMonsterAction[]
  spellcasting?: Dnd5eMonsterSpellcasting
  capabilities?: Dnd5eMonsterCapabilities
  /** 自动回合选择目标时的模板默认值；单个地图 Token 可以由 DM 覆盖。 */
  targetingPreference?: Dnd5eMonsterTargetingPreferenceV1
  /** 仅包含 Host 白名单效果的声明式怪物机制。 */
  headlessMechanics?: readonly Dnd5eMonsterMechanicTrigger[]
  description: string
}

interface GeneratedDnd5eMonsterCatalog {
  schemaVersion: 1
  count: number
  source: {
    rules: string
    rulesUrl: string
    license: string
    transcription: string
    transcriptionCommit: string
    transcriptionUrl: string
  }
  monsters: readonly Dnd5eMonsterStatBlock[]
}

interface ReviewedMonsterTextRow {
  id?: string
  key?: string
  index?: number
  name: string
  description?: string
}

interface ReviewedMonsterTranslation {
  name: string
  alignment: string
  subtypes: readonly string[]
  armorClassNote: string
  skills: readonly ReviewedMonsterTextRow[]
  languages: readonly string[]
  conditionImmunities: readonly string[]
  traits: readonly ReviewedMonsterTextRow[]
  actions: readonly ReviewedMonsterTextRow[]
  reactions: readonly ReviewedMonsterTextRow[]
  legendaryActions: readonly ReviewedMonsterTextRow[]
  lairActions: readonly ReviewedMonsterTextRow[]
  spellcastingDescription: string
  description: string
  reviewedBy: string
  reviewedAt: string
}

const REVIEWED_MONSTER_TRANSLATIONS = reviewedMonsterTranslations as Readonly<Record<string, ReviewedMonsterTranslation>>

function translatedMonsterRows(
  rows: readonly Dnd5eMonsterAction[] | undefined,
  translations: readonly ReviewedMonsterTextRow[],
): readonly Dnd5eMonsterAction[] | undefined {
  if (!rows) return undefined
  const byId = new Map(translations.map((translation) => [translation.id, translation]))
  return rows.map((row) => {
    const translation = byId.get(row.id)
    return translation ? { ...row, name: translation.name, description: translation.description ?? row.description } : row
  })
}

function applyReviewedMonsterTranslation(
  monster: Dnd5eMonsterStatBlock,
  translation: ReviewedMonsterTranslation,
): Dnd5eMonsterStatBlock {
  const skillNames = new Map(translation.skills.map((skill) => [skill.key, skill.name]))
  return {
    ...monster,
    name: translation.name,
    alignment: translation.alignment,
    ...(monster.subtypes ? { subtypes: translation.subtypes } : {}),
    armorClass: {
      ...monster.armorClass,
      ...(monster.armorClass.note ? { note: translation.armorClassNote } : {}),
    },
    ...(monster.skills ? {
      skills: monster.skills.map((skill) => ({ ...skill, name: skillNames.get(skill.key) ?? skill.name })),
    } : {}),
    languages: translation.languages,
    conditionImmunities: translation.conditionImmunities,
    traits: monster.traits.map((trait, index) => ({
      ...trait,
      name: translation.traits.find((row) => row.index === index)?.name ?? trait.name,
      description: translation.traits.find((row) => row.index === index)?.description ?? trait.description,
    })),
    actions: translatedMonsterRows(monster.actions, translation.actions) ?? monster.actions,
    reactions: translatedMonsterRows(monster.reactions, translation.reactions),
    legendaryActions: translatedMonsterRows(monster.legendaryActions, translation.legendaryActions),
    lairActions: translatedMonsterRows(monster.lairActions, translation.lairActions),
    ...(monster.spellcasting ? {
      spellcasting: {
        ...monster.spellcasting,
        description: translation.spellcastingDescription,
        spells: monster.spellcasting.spells?.map((spell) => ({
          ...spell,
          name: DND5E_SRD_SPELL_NAMES_ZH[spell.id] ?? spell.name,
        })),
      },
    } : {}),
    description: translation.description,
  }
}

/**
 * Text translation must never remove the small set of core SRD mechanics that
 * already have native Headless handlers. The pinned catalog deliberately keeps
 * prose-only abilities conservative, so these stable SRD IDs provide the
 * structured rules required by the engine without depending on English text.
 */
const ADULT_DRAGON_FRIGHTFUL_PRESENCE_DCS = {
  'adult-black-dragon': 16,
  'adult-blue-dragon': 17,
  'adult-brass-dragon': 16,
  'adult-bronze-dragon': 17,
  'adult-copper-dragon': 16,
  'adult-gold-dragon': 21,
  'adult-green-dragon': 16,
  'adult-red-dragon': 19,
  'adult-silver-dragon': 18,
  'adult-white-dragon': 14,
} as const

function dragonLegendaryWingAttackRule(
  rangeFeet: number,
  dc: number,
  damageBonus: number,
): Dnd5eMonsterLegendaryWingAttackRule {
  return {
    kind: 'legendary-wing-attack',
    rangeFeet,
    target: 'all-creatures-except-self',
    ability: 'dex',
    dc,
    damage: {
      average: 7 + damageBonus,
      count: 2,
      sides: 6,
      bonus: damageBonus,
      type: 'bludgeoning',
    },
    damageOnSuccessfulSave: 'none',
    conditionOnFailedSave: 'prone',
    followUpMovement: {
      kind: 'grant-fly-movement',
      maximumSpeedFraction: 0.5,
    },
  }
}

/**
 * The 20 SRD dragons share an action id but not a save DC, radius or damage
 * bonus. Keep those values keyed by stable stat-block slug so Chinese catalog
 * translations cannot silently disable or alter the Headless resolver.
 */
const DRAGON_LEGENDARY_WING_ATTACK_RULES = {
  'adult-black-dragon': dragonLegendaryWingAttackRule(10, 19, 6),
  'adult-blue-dragon': dragonLegendaryWingAttackRule(10, 20, 7),
  'adult-brass-dragon': dragonLegendaryWingAttackRule(10, 19, 6),
  'adult-bronze-dragon': dragonLegendaryWingAttackRule(10, 20, 7),
  'adult-copper-dragon': dragonLegendaryWingAttackRule(10, 19, 6),
  'adult-gold-dragon': dragonLegendaryWingAttackRule(10, 22, 8),
  'adult-green-dragon': dragonLegendaryWingAttackRule(10, 19, 6),
  'adult-red-dragon': dragonLegendaryWingAttackRule(10, 22, 8),
  'adult-silver-dragon': dragonLegendaryWingAttackRule(10, 22, 8),
  'adult-white-dragon': dragonLegendaryWingAttackRule(10, 19, 6),
  'ancient-black-dragon': dragonLegendaryWingAttackRule(15, 23, 8),
  'ancient-blue-dragon': dragonLegendaryWingAttackRule(15, 24, 9),
  'ancient-brass-dragon': dragonLegendaryWingAttackRule(15, 22, 8),
  'ancient-bronze-dragon': dragonLegendaryWingAttackRule(15, 24, 9),
  'ancient-copper-dragon': dragonLegendaryWingAttackRule(15, 23, 8),
  'ancient-gold-dragon': dragonLegendaryWingAttackRule(15, 25, 10),
  'ancient-green-dragon': dragonLegendaryWingAttackRule(15, 23, 8),
  'ancient-red-dragon': dragonLegendaryWingAttackRule(15, 25, 10),
  'ancient-silver-dragon': dragonLegendaryWingAttackRule(15, 25, 10),
  'ancient-white-dragon': dragonLegendaryWingAttackRule(15, 22, 8),
} as const satisfies Readonly<Record<string, Dnd5eMonsterLegendaryWingAttackRule>>

function bronzeDragonBreathVariants(input: {
  dc: number
  lightningLengthFeet: number
  lightningWidthFeet: number
  lightningAverage: number
  lightningDice: number
  repulsionDistanceFeet: number
}): readonly Dnd5eMonsterAreaSavingThrowVariant[] {
  return [
    {
      id: 'lightning-breath',
      name: '\u95ea\u7535\u5410\u606f',
      area: {
        shape: 'line', origin: 'self',
        lengthFeet: input.lightningLengthFeet,
        widthFeet: input.lightningWidthFeet,
        aimRangeFeet: input.lightningLengthFeet,
      },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: input.dc,
      damage: {
        average: input.lightningAverage,
        count: input.lightningDice,
        sides: 10,
        bonus: 0,
        type: 'lightning',
      },
      damageOnSuccessfulSave: 'half',
    },
    {
      id: 'repulsion-breath',
      name: '\u6392\u65a5\u5410\u606f',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'all-creatures-except-self',
      ability: 'str',
      dc: input.dc,
      forcedMovementOnFailedSave: {
        direction: 'away-from-source',
        maximumDistanceFeet: input.repulsionDistanceFeet,
      },
    },
  ]
}

function copperDragonBreathVariants(input: {
  dc: number
  acidLengthFeet: number
  acidWidthFeet: number
  acidAverage: number
  acidDice: number
  slowingLengthFeet: number
}): readonly Dnd5eMonsterAreaSavingThrowVariant[] {
  return [
    {
      id: 'acid-breath',
      name: '\u9178\u6db2\u5410\u606f',
      area: {
        shape: 'line', origin: 'self',
        lengthFeet: input.acidLengthFeet,
        widthFeet: input.acidWidthFeet,
        aimRangeFeet: input.acidLengthFeet,
      },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: input.dc,
      damage: {
        average: input.acidAverage,
        count: input.acidDice,
        sides: 8,
        bonus: 0,
        type: 'acid',
      },
      damageOnSuccessfulSave: 'half',
    },
    {
      id: 'slowing-breath',
      name: '\u8fdf\u7f13\u5410\u606f',
      area: {
        shape: 'cone', origin: 'self',
        lengthFeet: input.slowingLengthFeet,
        aimRangeFeet: input.slowingLengthFeet,
      },
      target: 'all-creatures-except-self',
      ability: 'con',
      dc: input.dc,
      activeEffectOnFailedSave: {
        id: 'slowing-breath-effect',
        label: '\u8fdf\u7f13\u5410\u606f',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
        modifiers: {
          speedMultiplier: 0.5,
          preventReactions: true,
          maximumAttacksPerTurn: 1,
          actionOrBonusActionOnly: true,
        },
      },
    },
  ]
}

function goldDragonBreathVariants(input: {
  dc: number
  lengthFeet: number
  fireAverage: number
  fireDice: number
}): readonly Dnd5eMonsterAreaSavingThrowVariant[] {
  return [
    {
      id: 'fire-breath',
      name: '\u706b\u7130\u5410\u606f',
      area: {
        shape: 'cone', origin: 'self',
        lengthFeet: input.lengthFeet,
        aimRangeFeet: input.lengthFeet,
      },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: input.dc,
      damage: {
        average: input.fireAverage,
        count: input.fireDice,
        sides: 10,
        bonus: 0,
        type: 'fire',
      },
      damageOnSuccessfulSave: 'half',
    },
    {
      id: 'weakening-breath',
      name: '\u8870\u5f31\u5410\u606f',
      area: {
        shape: 'cone', origin: 'self',
        lengthFeet: input.lengthFeet,
        aimRangeFeet: input.lengthFeet,
      },
      target: 'all-creatures-except-self',
      ability: 'str',
      dc: input.dc,
      activeEffectOnFailedSave: {
        id: 'weakening-breath-effect',
        label: '\u8870\u5f31\u5410\u606f',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
        modifiers: {
          strengthRollMode: 'disadvantage',
        },
      },
    },
  ]
}

const ADULT_DRAGON_SINGLE_BREATH_RULES = {
  'adult-black-dragon': {
    actionId: 'acid-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 5, aimRangeFeet: 60 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 18,
      damage: { average: 54, count: 12, sides: 8, bonus: 0, type: 'acid' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-blue-dragon': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 90, widthFeet: 5, aimRangeFeet: 90 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 19,
      damage: { average: 66, count: 12, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-green-dragon': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
      target: 'all-creatures-except-self', ability: 'con', dc: 18,
      damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-red-dragon': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 21,
      damage: { average: 63, count: 18, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-white-dragon': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
      target: 'all-creatures-except-self', ability: 'con', dc: 19,
      damage: { average: 54, count: 12, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
} as const

const ADULT_DRAGON_MULTI_BREATH_RULES = {
  'adult-brass-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'fire-breath',
        name: '火焰吐息',
        area: { shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 5, aimRangeFeet: 60 },
        target: 'all-creatures-except-self', ability: 'dex', dc: 18,
        damage: { average: 45, count: 13, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'all-creatures-except-self', ability: 'con', dc: 18,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 100,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'adult-bronze-dragon': {
    actionId: 'breath-weapons',
    variants: bronzeDragonBreathVariants({
      dc: 19,
      lightningLengthFeet: 90,
      lightningWidthFeet: 5,
      lightningAverage: 66,
      lightningDice: 12,
      repulsionDistanceFeet: 60,
    }),
  },
  'adult-copper-dragon': {
    actionId: 'breath-weapons',
    variants: copperDragonBreathVariants({
      dc: 18,
      acidLengthFeet: 60,
      acidWidthFeet: 5,
      acidAverage: 54,
      acidDice: 12,
      slowingLengthFeet: 60,
    }),
  },
  'adult-gold-dragon': {
    actionId: 'breath-weapons',
    variants: goldDragonBreathVariants({
      dc: 21,
      lengthFeet: 60,
      fireAverage: 66,
      fireDice: 12,
    }),
  },
  'adult-silver-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'all-creatures-except-self', ability: 'con', dc: 20,
        damage: { average: 58, count: 13, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'all-creatures-except-self', ability: 'con', dc: 20,
        conditionOnFailedSave: {
          condition: 'paralyzed',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
      },
    ],
  },
} as const

const ANCIENT_DRAGON_FRIGHTFUL_PRESENCE_DCS = {
  'ancient-black-dragon': 19,
  'ancient-blue-dragon': 20,
  'ancient-brass-dragon': 18,
  'ancient-bronze-dragon': 20,
  'ancient-copper-dragon': 19,
  'ancient-gold-dragon': 24,
  'ancient-green-dragon': 19,
  'ancient-red-dragon': 21,
  'ancient-silver-dragon': 21,
  'ancient-white-dragon': 16,
} as const

const ANCIENT_DRAGON_SINGLE_BREATH_RULES = {
  'ancient-black-dragon': {
    actionId: 'acid-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 90, widthFeet: 10, aimRangeFeet: 90 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 22,
      damage: { average: 67, count: 15, sides: 8, bonus: 0, type: 'acid' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-blue-dragon': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 120, widthFeet: 10, aimRangeFeet: 120 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 23,
      damage: { average: 88, count: 16, sides: 10, bonus: 0, type: 'lightning' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-green-dragon': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
      target: 'all-creatures-except-self', ability: 'con', dc: 22,
      damage: { average: 77, count: 22, sides: 6, bonus: 0, type: 'poison' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-red-dragon': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 24,
      damage: { average: 91, count: 26, sides: 6, bonus: 0, type: 'fire' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-white-dragon': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
      target: 'all-creatures-except-self', ability: 'con', dc: 22,
      damage: { average: 72, count: 16, sides: 8, bonus: 0, type: 'cold' }, damageOnSuccessfulSave: 'half',
    },
  },
} as const

const ANCIENT_DRAGON_MULTI_BREATH_RULES = {
  'ancient-brass-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'fire-breath',
        name: '火焰吐息',
        area: { shape: 'line', origin: 'self', lengthFeet: 90, widthFeet: 10, aimRangeFeet: 90 },
        target: 'all-creatures-except-self', ability: 'dex', dc: 21,
        damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
        target: 'all-creatures-except-self', ability: 'con', dc: 21,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 100,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'ancient-bronze-dragon': {
    actionId: 'breath-weapons',
    variants: bronzeDragonBreathVariants({
      dc: 23,
      lightningLengthFeet: 120,
      lightningWidthFeet: 10,
      lightningAverage: 88,
      lightningDice: 16,
      repulsionDistanceFeet: 60,
    }),
  },
  'ancient-copper-dragon': {
    actionId: 'breath-weapons',
    variants: copperDragonBreathVariants({
      dc: 22,
      acidLengthFeet: 90,
      acidWidthFeet: 10,
      acidAverage: 63,
      acidDice: 14,
      slowingLengthFeet: 90,
    }),
  },
  'ancient-gold-dragon': {
    actionId: 'breath-weapons',
    variants: goldDragonBreathVariants({
      dc: 24,
      lengthFeet: 90,
      fireAverage: 71,
      fireDice: 13,
    }),
  },
  'ancient-silver-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
        target: 'all-creatures-except-self', ability: 'con', dc: 24,
        damage: { average: 67, count: 15, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
        target: 'all-creatures-except-self', ability: 'con', dc: 24,
        conditionOnFailedSave: {
          condition: 'paralyzed',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
      },
    ],
  },
} as const

const CORE_SINGLE_AREA_ACTION_RULES = {
  'dust-mephit': {
    actionId: 'blinding-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 10,
      conditionOnFailedSave: {
        condition: 'blinded',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
      },
    },
  },
  'black-dragon-wyrmling': {
    actionId: 'acid-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 15, widthFeet: 5, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 11,
      damage: { average: 22, count: 5, sides: 8, bonus: 0, type: 'acid' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'blue-dragon-wyrmling': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 30, widthFeet: 5, aimRangeFeet: 30 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 12,
      damage: { average: 22, count: 4, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  behir: {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 20, widthFeet: 5, aimRangeFeet: 20 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 16,
      damage: { average: 66, count: 12, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'green-dragon-wyrmling': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'con', dc: 11,
      damage: { average: 21, count: 6, sides: 6, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'half-red-dragon-veteran': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 15,
      damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'hell-hound': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 12,
      damage: { average: 21, count: 6, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'ice-mephit': {
    actionId: 'frost-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 10,
      damage: { average: 5, count: 2, sides: 4, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'iron-golem': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'con', dc: 19,
      damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'magma-mephit': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 11,
      damage: { average: 7, count: 2, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'steam-mephit': {
    actionId: 'steam-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 10,
      damage: { average: 4, count: 1, sides: 8, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'red-dragon-wyrmling': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 13,
      damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'white-dragon-wyrmling': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'con', dc: 12,
      damage: { average: 22, count: 5, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'winter-wolf': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 12,
      damage: { average: 18, count: 4, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-black-dragon': {
    actionId: 'acid-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 30, widthFeet: 5, aimRangeFeet: 30 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 14,
      damage: { average: 49, count: 11, sides: 8, bonus: 0, type: 'acid' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-blue-dragon': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 5, aimRangeFeet: 60 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 16,
      damage: { average: 55, count: 10, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-green-dragon': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'all-creatures-except-self', ability: 'con', dc: 14,
      damage: { average: 42, count: 12, sides: 6, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-red-dragon': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'all-creatures-except-self', ability: 'dex', dc: 17,
      damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-white-dragon': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'all-creatures-except-self', ability: 'con', dc: 15,
      damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
} as const

const CORE_MULTI_AREA_ACTION_RULES = {
  'bronze-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: bronzeDragonBreathVariants({
      dc: 12,
      lightningLengthFeet: 40,
      lightningWidthFeet: 5,
      lightningAverage: 16,
      lightningDice: 3,
      repulsionDistanceFeet: 30,
    }),
  },
  'copper-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: copperDragonBreathVariants({
      dc: 11,
      acidLengthFeet: 20,
      acidWidthFeet: 5,
      acidAverage: 18,
      acidDice: 4,
      slowingLengthFeet: 15,
    }),
  },
  'gold-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: goldDragonBreathVariants({
      dc: 13,
      lengthFeet: 15,
      fireAverage: 22,
      fireDice: 4,
    }),
  },
  'brass-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'fire-breath',
        name: '火焰吐息',
        area: { shape: 'line', origin: 'self', lengthFeet: 20, widthFeet: 5, aimRangeFeet: 20 },
        target: 'all-creatures-except-self', ability: 'dex', dc: 11,
        damage: { average: 14, count: 4, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'all-creatures-except-self', ability: 'con', dc: 11,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'young-bronze-dragon': {
    actionId: 'breath-weapons',
    variants: bronzeDragonBreathVariants({
      dc: 15,
      lightningLengthFeet: 60,
      lightningWidthFeet: 5,
      lightningAverage: 55,
      lightningDice: 10,
      repulsionDistanceFeet: 40,
    }),
  },
  'young-copper-dragon': {
    actionId: 'breath-weapons',
    variants: copperDragonBreathVariants({
      dc: 14,
      acidLengthFeet: 40,
      acidWidthFeet: 5,
      acidAverage: 40,
      acidDice: 9,
      slowingLengthFeet: 30,
    }),
  },
  'young-gold-dragon': {
    actionId: 'breath-weapons',
    variants: goldDragonBreathVariants({
      dc: 17,
      lengthFeet: 30,
      fireAverage: 55,
      fireDice: 10,
    }),
  },
  'silver-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'all-creatures-except-self', ability: 'con', dc: 13,
        damage: { average: 18, count: 4, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'all-creatures-except-self', ability: 'con', dc: 13,
        conditionOnFailedSave: {
          condition: 'paralyzed',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
      },
    ],
  },
  'young-brass-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'fire-breath',
        name: '火焰吐息',
        area: { shape: 'line', origin: 'self', lengthFeet: 40, widthFeet: 5, aimRangeFeet: 40 },
        target: 'all-creatures-except-self', ability: 'dex', dc: 14,
        damage: { average: 42, count: 12, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
        target: 'all-creatures-except-self', ability: 'con', dc: 14,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 50,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'young-silver-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
        target: 'all-creatures-except-self', ability: 'con', dc: 17,
        damage: { average: 54, count: 12, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
        target: 'all-creatures-except-self', ability: 'con', dc: 17,
        conditionOnFailedSave: {
          condition: 'paralyzed',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
      },
    ],
  },
} as const

function applyCoreMonsterMechanicalRules(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterStatBlock {
  if (monster.slug === 'aboleth') {
    const actions = monster.actions.map((action) => {
      if (action.id === 'multiattack') return { ...action, automation: 'headless' as const }
      if (action.id === 'tentacle' && action.attack) {
        return {
          ...action,
          automation: 'headless' as const,
          attack: {
            ...action.attack,
            // The delayed one-minute transformation is preserved as a durable
            // disease marker; map environment rules decide underwater effects.
            onHit: 'DC 14 Constitution save; on a failure the target contracts the aboleth tentacle disease.',
            onHitRule: {
              kind: 'saving-throw-condition' as const,
              ability: 'con' as const,
              dc: 14,
              condition: 'disease' as const,
            },
            // The SRD's later 1d12 acid damage is not part of the initial hit.
            damage: action.attack.damage.filter((component) => component.type !== 'acid'),
          },
        }
      }
      if (action.id === 'enslave') {
        return {
          ...action,
          automation: 'headless' as const,
          usage: { kind: 'per-day' as const, max: 3 },
          rule: {
            kind: 'saving-throw-condition' as const,
            rangeFeet: 30,
            ability: 'wis' as const,
            dc: 14,
            condition: 'charmed' as const,
            preventReactions: true,
            repeatSaveOnDamage: true,
          },
        }
      }
      return action
    })
    return {
      ...monster,
      traits: monster.traits.map((trait, index) => {
        if (index === 1) {
          return {
            ...trait,
            automation: 'headless' as const,
            rule: {
              kind: 'mucous-cloud' as const,
              saveDc: 14,
              condition: 'disease' as const,
              maximumTriggerDistanceFeet: 5,
            },
          }
        }
        return trait
      }),
      actions,
      legendaryActionPoints: 3,
      legendaryActions: monster.legendaryActions?.map((action) => {
        if (action.id === 'detect') {
          return {
            ...action,
            automation: 'headless' as const,
            rule: { kind: 'ability-check' as const, ability: 'wis' as const, skillKey: 'perception' },
          }
        }
        if (action.id === 'psychic-drain-costs-2-actions') {
          return {
            ...action,
            automation: 'headless' as const,
            rule: {
              kind: 'conditioned-damage-and-healing' as const,
              requiredCondition: 'charmed' as const,
              requireSameSource: true,
              damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'psychic' as const },
            },
          }
        }
        return action
      }),
    }
  }

  const frightfulPresenceDc = ADULT_DRAGON_FRIGHTFUL_PRESENCE_DCS[
    monster.slug as keyof typeof ADULT_DRAGON_FRIGHTFUL_PRESENCE_DCS
  ]
  const singleBreath = ADULT_DRAGON_SINGLE_BREATH_RULES[
    monster.slug as keyof typeof ADULT_DRAGON_SINGLE_BREATH_RULES
  ]
  const multiBreath = ADULT_DRAGON_MULTI_BREATH_RULES[
    monster.slug as keyof typeof ADULT_DRAGON_MULTI_BREATH_RULES
  ]
  const wingAttackRule = DRAGON_LEGENDARY_WING_ATTACK_RULES[
    monster.slug as keyof typeof DRAGON_LEGENDARY_WING_ATTACK_RULES
  ]
  if (frightfulPresenceDc != null) {
    return {
      ...monster,
      actions: monster.actions.map((action) => {
        if (action.id === 'multiattack') return { ...action, automation: 'headless' as const }
        if (action.id === 'frightful-presence') return {
          ...action,
          automation: 'headless' as const,
          rule: {
            kind: 'area-saving-throw' as const,
            area: { shape: 'circle' as const, origin: 'self' as const, radiusFeet: 120 },
            target: 'hostile' as const,
            ability: 'wis' as const,
            dc: frightfulPresenceDc,
            conditionOnFailedSave: {
              condition: 'frightened' as const,
              durationRounds: 10,
              repeatSaveAtEndOfTargetTurn: true,
            },
            frightfulPresenceImmunityRounds: 14_400,
          },
        }
        if (singleBreath && action.id === singleBreath.actionId) return {
          ...action,
          automation: 'headless' as const,
          rule: singleBreath.rule,
        }
        if (multiBreath && action.id === multiBreath.actionId) return {
          ...action,
          automation: 'headless' as const,
          rule: {
            kind: 'area-saving-throw' as const,
            variants: multiBreath.variants,
          },
        }
        return action
      }),
      legendaryActions: monster.legendaryActions?.map((action) => {
        if (action.id === 'detect') {
          return {
            ...action,
            automation: 'headless' as const,
            rule: { kind: 'ability-check' as const, ability: 'wis' as const, skillKey: 'perception' },
          }
        }
        if (action.id === 'wing-attack-costs-2-actions' && wingAttackRule) {
          return {
            ...action,
            automation: 'headless' as const,
            rule: wingAttackRule,
          }
        }
        return action
      }),
    }
  }

  const ancientFrightfulPresenceDc = ANCIENT_DRAGON_FRIGHTFUL_PRESENCE_DCS[
    monster.slug as keyof typeof ANCIENT_DRAGON_FRIGHTFUL_PRESENCE_DCS
  ]
  const ancientSingleBreath = ANCIENT_DRAGON_SINGLE_BREATH_RULES[
    monster.slug as keyof typeof ANCIENT_DRAGON_SINGLE_BREATH_RULES
  ]
  const ancientMultiBreath = ANCIENT_DRAGON_MULTI_BREATH_RULES[
    monster.slug as keyof typeof ANCIENT_DRAGON_MULTI_BREATH_RULES
  ]
  const ancientWingAttackRule = DRAGON_LEGENDARY_WING_ATTACK_RULES[
    monster.slug as keyof typeof DRAGON_LEGENDARY_WING_ATTACK_RULES
  ]
  if (ancientFrightfulPresenceDc != null) {
    return {
      ...monster,
      actions: monster.actions.map((action) => {
        if (action.id === 'multiattack') return { ...action, automation: 'headless' as const }
        if (action.id === 'frightful-presence') return {
          ...action,
          automation: 'headless' as const,
          rule: {
            kind: 'area-saving-throw' as const,
            area: { shape: 'circle' as const, origin: 'self' as const, radiusFeet: 120 },
            target: 'hostile' as const,
            ability: 'wis' as const,
            dc: ancientFrightfulPresenceDc,
            conditionOnFailedSave: {
              condition: 'frightened' as const,
              durationRounds: 10,
              repeatSaveAtEndOfTargetTurn: true,
            },
            frightfulPresenceImmunityRounds: 14_400,
          },
        }
        if (ancientSingleBreath && action.id === ancientSingleBreath.actionId) {
          return { ...action, automation: 'headless' as const, rule: ancientSingleBreath.rule }
        }
        if (ancientMultiBreath && action.id === ancientMultiBreath.actionId) {
          return {
            ...action,
            automation: 'headless' as const,
            rule: {
              kind: 'area-saving-throw' as const,
              variants: ancientMultiBreath.variants,
            },
          }
        }
        return action
      }),
      legendaryActions: monster.legendaryActions?.map((action) => {
        if (action.id === 'detect') {
          return {
            ...action,
            automation: 'headless' as const,
            rule: { kind: 'ability-check' as const, ability: 'wis' as const, skillKey: 'perception' },
          }
        }
        if (action.id === 'wing-attack-costs-2-actions' && ancientWingAttackRule) {
          return {
            ...action,
            automation: 'headless' as const,
            rule: ancientWingAttackRule,
          }
        }
        return action
      }),
    }
  }

  const coreSingleAreaAction = CORE_SINGLE_AREA_ACTION_RULES[
    monster.slug as keyof typeof CORE_SINGLE_AREA_ACTION_RULES
  ]
  const coreMultiAreaAction = CORE_MULTI_AREA_ACTION_RULES[
    monster.slug as keyof typeof CORE_MULTI_AREA_ACTION_RULES
  ]
  if (coreSingleAreaAction || coreMultiAreaAction) {
    return {
      ...monster,
      actions: monster.actions.map((action) => {
        if (coreSingleAreaAction && action.id === coreSingleAreaAction.actionId) {
          return {
            ...action,
            automation: 'headless' as const,
            rule: coreSingleAreaAction.rule,
          }
        }
        if (coreMultiAreaAction && action.id === coreMultiAreaAction.actionId) {
          return {
            ...action,
            automation: 'headless' as const,
            rule: {
              kind: 'area-saving-throw' as const,
              variants: coreMultiAreaAction.variants,
            },
          }
        }
        return action
      }),
    }
  }

  if (monster.slug === 'chimera' || monster.slug === 'dragon-turtle') {
    const isChimera = monster.slug === 'chimera'
    const multiattackSequence = isChimera
      ? ['bite', 'horns', 'claws'] as const
      : ['bite', 'claw', 'claw'] as const
    const breathActionId = isChimera ? 'fire-breath' : 'steam-breath'
    return {
      ...monster,
      actions: monster.actions.map((action) => {
        if (action.id === 'multiattack') {
          return {
            ...action,
            kind: 'multiattack' as const,
            automation: 'headless' as const,
            sequence: multiattackSequence,
          }
        }
        if (action.id === breathActionId) {
          return {
            ...action,
            automation: 'headless' as const,
            rule: {
              kind: 'area-saving-throw' as const,
              area: {
                shape: 'cone' as const,
                origin: 'self' as const,
                lengthFeet: isChimera ? 15 : 60,
                aimRangeFeet: isChimera ? 15 : 60,
              },
              target: 'all-creatures-except-self' as const,
              ability: isChimera ? 'dex' as const : 'con' as const,
              dc: isChimera ? 15 : 18,
              damage: isChimera
                ? { average: 31, count: 7, sides: 8, bonus: 0, type: 'fire' as const }
                : { average: 52, count: 15, sides: 6, bonus: 0, type: 'fire' as const },
              damageOnSuccessfulSave: 'half' as const,
            },
          }
        }
        return action
      }),
    }
  }

  if (monster.slug === 'zombie') {
    return {
      ...monster,
      traits: monster.traits.map((trait, index) => index === 0 ? {
        ...trait,
        automation: 'headless',
        rule: {
          kind: 'undead-fortitude',
          dcBase: 5,
          excludedDamageTypes: ['radiant'],
          excludedOnCritical: true,
        },
      } : trait),
    }
  }

  if (monster.slug === 'wolf' || monster.slug === 'dire-wolf') {
    const dc = monster.slug === 'wolf' ? 11 : 13
    return {
      ...monster,
      actions: monster.actions.map((action) => action.id === 'bite' && action.attack ? {
        ...action,
        automation: 'headless',
        attack: {
          ...action.attack,
          onHit: `目标进行 DC ${dc} 力量豁免，失败则倒地。`,
          onHitRule: { kind: 'saving-throw-condition', ability: 'str', dc, condition: 'prone' },
        },
      } : action),
    }
  }

  if (monster.slug === 'ankheg') {
    return {
      ...monster,
      actions: monster.actions.map((action) => action.id === 'acid-spray' ? {
        ...action,
        automation: 'headless',
        rule: {
          kind: 'area-saving-throw',
          area: {
            shape: 'line',
            origin: 'self',
            lengthFeet: 30,
            widthFeet: 5,
            aimRangeFeet: 30,
          },
          target: 'all-creatures-except-self',
          ability: 'dex',
          dc: 13,
          damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'acid' },
          damageOnSuccessfulSave: 'half',
        },
      } : action),
    }
  }

  if (monster.slug === 'bugbear') {
    return {
      ...monster,
      actions: monster.actions.map((action) =>
        action.id === 'javelin' && action.attack
          ? {
              ...action,
              attack: {
                ...action.attack,
                rangedDamage: [{
                  average: 5,
                  count: 1,
                  sides: 6,
                  bonus: 2,
                  type: 'piercing',
                }],
              },
            }
          : action),
    }
  }

  if (monster.slug === 'cult-fanatic') {
    return {
      ...monster,
      actions: monster.actions.map((action) =>
        action.id === 'multiattack'
          ? { ...action, sequenceAttackMode: 'melee' as const }
          : action),
    }
  }

  if (monster.slug === 'goblin') {
    return {
      ...monster,
      traits: monster.traits.map((trait, index) => index === 0 ? {
        ...trait,
        automation: 'headless',
        rule: {
          kind: 'nimble-escape',
          bonusActionOptions: ['disengage', 'hide'],
        },
      } : trait),
    }
  }

  return monster
}

export const DND5E_SRD_MONSTER_CATALOG_METADATA = generatedSrdMonsterCatalog as unknown as GeneratedDnd5eMonsterCatalog

/**
 * Complete SRD 5.1 catalog. Context-reviewed Chinese entries override the
 * pinned English transcription by slug. Unreviewed entries intentionally keep
 * the English SRD prose instead of falling back to legacy project copy.
 */
const CATALOG_FIXED_DAMAGE_ATTACKS = {
  bat: { actionId: 'bite', toHit: 0, damageType: 'piercing' },
  badger: { actionId: 'bite', toHit: 2, damageType: 'piercing' },
  cat: { actionId: 'claws', toHit: 0, damageType: 'slashing' },
  crab: { actionId: 'claw', toHit: 0, damageType: 'bludgeoning' },
  hawk: { actionId: 'talons', toHit: 5, damageType: 'slashing' },
  lizard: { actionId: 'bite', toHit: 0, damageType: 'piercing' },
  owl: { actionId: 'talons', toHit: 3, damageType: 'slashing' },
  quipper: { actionId: 'bite', toHit: 5, damageType: 'piercing' },
  rat: { actionId: 'bite', toHit: 0, damageType: 'piercing' },
  raven: { actionId: 'beak', toHit: 4, damageType: 'piercing' },
  weasel: { actionId: 'bite', toHit: 5, damageType: 'piercing' },
} as const

const CATALOG_BASE_WEAPON_ATTACKS = {
  'flying-snake': {
    actionId: 'bite',
    attack: {
      mode: 'melee',
      toHit: 6,
      reachFeet: 5,
      target: 'one target',
      damage: [
        { average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' },
        { average: 7, count: 3, sides: 4, bonus: 0, type: 'poison' },
      ],
    },
  },
  guard: {
    actionId: 'spear',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 3,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [{ average: 4, count: 1, sides: 6, bonus: 1, type: 'piercing' }],
    },
  },
  hobgoblin: {
    actionId: 'longsword',
    attack: {
      mode: 'melee',
      toHit: 3,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 5, count: 1, sides: 8, bonus: 1, type: 'slashing' }],
    },
  },
  'half-red-dragon-veteran': {
    actionId: 'longsword',
    attack: {
      mode: 'melee',
      toHit: 5,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 7, count: 1, sides: 8, bonus: 3, type: 'slashing' }],
    },
  },
  'tribal-warrior': {
    actionId: 'spear',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 3,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [{ average: 4, count: 1, sides: 6, bonus: 1, type: 'piercing' }],
    },
  },
  merfolk: {
    actionId: 'spear',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 2,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [{ average: 4, count: 1, sides: 8, bonus: 0, type: 'piercing' }],
      rangedDamage: [{ average: 3, count: 1, sides: 6, bonus: 0, type: 'piercing' }],
    },
  },
  roper: {
    actionId: 'tendril',
    attack: {
      mode: 'melee',
      toHit: 7,
      reachFeet: 50,
      target: 'one creature',
      damage: [],
    },
  },
  veteran: {
    actionId: 'longsword',
    attack: {
      mode: 'melee',
      toHit: 5,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 7, count: 1, sides: 8, bonus: 3, type: 'slashing' }],
    },
  },
} as const

/**
 * The SRD generator intentionally leaves attacks with prose alternatives in
 * DM adjudication when it cannot infer one unambiguous damage expression.
 * These catalog-owned rows choose one canonical, legal branch for the stable
 * source action id. Other legal branches are exposed as sibling actions below
 * instead of silently dropping damage dice or guessing at runtime.
 */
const CATALOG_EXACT_WEAPON_ATTACKS = {
  cloaker: [{
    actionId: 'bite',
    attack: {
      mode: 'melee',
      toHit: 6,
      reachFeet: 5,
      target: 'one creature',
      damage: [
        { average: 10, count: 2, sides: 6, bonus: 3, type: 'piercing' },
      ],
      onHitEffects: [{
        id: 'bite-attachment',
        kind: 'source-linked-condition',
        relation: {
          kind: 'attachment',
          slotGroup: 'bite',
          capacity: 1,
          maxDistanceFeet: 5,
          targetMaxSizeRank: 3,
          whenCapacityFull: 'linked-target-only',
          movement: 'source-rides-target',
          endsOnSourceIncapacitated: true,
          attackAdvantageAgainstLinkedTarget: true,
        },
        escapeDc: 16,
        conditions: [],
        rootLegacyCondition: 'attached',
        conditionsWhenAttackHasAdvantage: [{ condition: 'blinded' }],
      }],
    },
  }],
  gnoll: [{
    actionId: 'spear',
    branchNote:
      'Headless uses the one-handed melee or thrown branch here; the optional two-handed melee branch remains a DM choice.',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 4,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [{ average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' }],
      rangedDamage: [{ average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' }],
    },
  }],
  'guardian-naga': [{
    actionId: 'spit-poison',
    attack: {
      mode: 'ranged',
      toHit: 8,
      rangeFeet: { normal: 15, long: 30 },
      target: 'one creature',
      damage: [],
      onHit: 'DC 15 Constitution save; 10d8 poison damage, half on a success.',
      onHitEffects: [{
        id: 'poison-save-damage',
        kind: 'saving-throw-damage',
        ability: 'con',
        dc: 15,
        damage: [
          { average: 45, count: 10, sides: 8, bonus: 0, type: 'poison' },
        ],
        damageOnSuccessfulSave: 'half',
      }],
    },
  }],
  octopus: [{
    actionId: 'tentacles',
    attack: {
      mode: 'melee',
      toHit: 4,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'bludgeoning' }],
      onHitEffects: [{
        id: 'tentacles-grapple',
        kind: 'source-linked-condition',
        relation: {
          kind: 'grapple',
          slotGroup: 'tentacles',
          capacity: 1,
          maxDistanceFeet: 5,
          targetMaxSizeRank: 5,
          whenCapacityFull: 'linked-target-only',
        },
        escapeDc: 10,
        conditions: [{ condition: 'grappled' }],
      }],
    },
  }],
  'poisonous-snake': [{
    actionId: 'bite',
    attack: {
      mode: 'melee',
      toHit: 5,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' }],
      onHit: 'DC 10 Constitution save; 2d4 poison damage, half on a success.',
      onHitEffects: [{
        id: 'poison-save-damage',
        kind: 'saving-throw-damage',
        ability: 'con',
        dc: 10,
        damage: [{ average: 5, count: 2, sides: 4, bonus: 0, type: 'poison' }],
        damageOnSuccessfulSave: 'half',
      }],
    },
  }],
  scorpion: [{
    actionId: 'sting',
    attack: {
      mode: 'melee',
      toHit: 2,
      reachFeet: 5,
      target: 'one creature',
      damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' }],
      onHit: 'DC 9 Constitution save; 1d8 poison damage, half on a success.',
      onHitEffects: [{
        id: 'poison-save-damage',
        kind: 'saving-throw-damage',
        ability: 'con',
        dc: 9,
        damage: [{ average: 4, count: 1, sides: 8, bonus: 0, type: 'poison' }],
        damageOnSuccessfulSave: 'half',
      }],
    },
  }],
  spider: [{
    actionId: 'bite',
    attack: {
      mode: 'melee',
      toHit: 4,
      reachFeet: 5,
      target: 'one creature',
      damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' }],
      onHit: 'DC 9 Constitution save; 1d4 poison damage on a failure.',
      onHitEffects: [{
        id: 'poison-save-damage',
        kind: 'saving-throw-damage',
        ability: 'con',
        dc: 9,
        damage: [{ average: 2, count: 1, sides: 4, bonus: 0, type: 'poison' }],
        damageOnSuccessfulSave: 'none',
      }],
    },
  }],
  sprite: [
    {
      actionId: 'longsword',
      attack: {
        mode: 'melee',
        toHit: 2,
        reachFeet: 5,
        target: 'one target',
        damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'slashing' }],
      },
    },
    {
      actionId: 'shortbow',
      attack: {
        mode: 'ranged',
        toHit: 6,
        rangeFeet: { normal: 40, long: 160 },
        target: 'one target',
        damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' }],
        onHit: 'DC 10 Constitution save; poisoned for 1 minute on a failure, and unconscious when the result is 5 or lower.',
        onHitEffects: [{
          id: 'shortbow-poisoned-unconscious',
          kind: 'saving-throw-condition',
          ability: 'con',
          dc: 10,
          conditionOnFailedSave: {
            condition: 'poisoned',
            durationRounds: 10,
            repeatSaveAtEndOfTargetTurn: false,
          },
          additionalConditionsOnFailedSave: [{
            condition: 'unconscious',
            durationRounds: 10,
            repeatSaveAtEndOfTargetTurn: false,
            minimumFailureMargin: 5,
            dependsOnCondition: 'poisoned',
            breakOnDamage: true,
            canBeAwakenedByAction: true,
          }],
        }],
      },
    },
  ],
  djinni: [{
    actionId: 'scimitar',
    branchNote: 'Headless 固定分支：本动作选择闪电伤害；雷鸣伤害请使用“弯刀（雷鸣）”。',
    attack: {
      mode: 'melee',
      toHit: 9,
      reachFeet: 5,
      target: 'one target',
      damage: [
        { average: 12, count: 2, sides: 6, bonus: 5, type: 'slashing' },
        { average: 3, count: 1, sides: 6, bonus: 0, type: 'lightning' },
      ],
    },
  }],
  drider: [{
    actionId: 'longsword',
    branchNote: 'Headless 固定分支：本动作以单手使用长剑；双手伤害请使用“长剑（双手）”。',
    attack: {
      mode: 'melee',
      toHit: 6,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 7, count: 1, sides: 8, bonus: 3, type: 'slashing' }],
    },
  }],
  erinyes: [
    {
      actionId: 'longsword',
      branchNote: 'Headless 固定分支：本动作以单手使用长剑；双手伤害请使用“长剑（双手）”。',
      attack: {
        mode: 'melee',
        toHit: 8,
        reachFeet: 5,
        target: 'one target',
        damage: [
          { average: 8, count: 1, sides: 8, bonus: 4, type: 'slashing' },
          { average: 13, count: 3, sides: 8, bonus: 0, type: 'poison' },
        ],
      },
    },
    {
      actionId: 'longbow',
      attack: {
        mode: 'ranged',
        toHit: 7,
        rangeFeet: { normal: 150, long: 600 },
        target: 'one target',
        damage: [
          { average: 7, count: 1, sides: 8, bonus: 3, type: 'piercing' },
          { average: 13, count: 3, sides: 8, bonus: 0, type: 'poison' },
        ],
        onHit: 'DC 14 Constitution save; poisoned until removed by lesser restoration or similar magic.',
        onHitEffects: [{
          id: 'longbow-poisoned',
          kind: 'saving-throw-condition',
          ability: 'con',
          dc: 14,
          conditionOnFailedSave: {
            condition: 'poisoned',
            // The condition has no natural expiry. One million rounds is the
            // schema's persistent-condition ceiling; condition-removal magic
            // can still remove the source-specific active effect normally.
            durationRounds: 1_000_000,
            repeatSaveAtEndOfTargetTurn: false,
          },
        }],
      },
    },
  ],
  gladiator: [{
    actionId: 'spear',
    branchNote:
      'Headless 固定分支：近战时本动作以单手使用长矛，远程时使用投掷伤害；双手近战请使用“长矛（双手近战）”。',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 7,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [{ average: 11, count: 2, sides: 6, bonus: 4, type: 'piercing' }],
      rangedDamage: [{ average: 11, count: 2, sides: 6, bonus: 4, type: 'piercing' }],
    },
  }],
  lamia: [{
    actionId: 'intoxicating-touch',
    attack: {
      mode: 'melee',
      toHit: 5,
      reachFeet: 5,
      target: 'one creature',
      damage: [],
      onHitEffects: [{
        id: 'intoxicating-touch-curse',
        kind: 'persistent-effect',
        magical: true,
        definitionId: 'srd-5.1:monster:lamia:intoxicating-touch-curse',
        label: 'Intoxicating Touch',
        ailment: 'curse',
        durationRounds: 600,
        modifiers: {
          abilityCheckDisadvantages: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
          savingThrowDisadvantages: ['wis'],
        },
        stacking: 'refresh',
      }],
    },
  }],
  kraken: [{
    actionId: 'bite',
    attack: {
      mode: 'melee',
      toHit: 17,
      reachFeet: 5,
      target: 'one target',
      damage: [
        { average: 23, count: 3, sides: 8, bonus: 10, type: 'piercing' },
      ],
    },
  }],
  'purple-worm': [
    {
      actionId: 'bite',
      attack: {
        mode: 'melee',
        toHit: 14,
        reachFeet: 10,
        target: 'one target',
        damage: [
          { average: 22, count: 3, sides: 8, bonus: 9, type: 'piercing' },
        ],
        onHitEffects: [{
          id: 'bite-swallow',
          kind: 'source-linked-condition',
          savingThrow: { ability: 'dex', dc: 19 },
          relation: {
            kind: 'swallowed',
            slotGroup: 'swallow',
            capacity: 20,
            maxDistanceFeet: 5,
            targetMaxSizeRank: 3,
            whenCapacityFull: 'skip-application',
            movement: 'carry-target',
            endsOnSourceIncapacitated: false,
          },
          conditions: [
            { condition: 'restrained' },
            { condition: 'blinded', dependsOnCondition: 'restrained' },
          ],
          periodicDamage: {
            timing: 'source-turn-start',
            count: 6,
            sides: 6,
            modifier: 0,
            type: 'acid',
          },
        }],
      },
    },
    {
      actionId: 'tail-stinger',
      attack: {
        mode: 'melee',
        toHit: 14,
        reachFeet: 10,
        target: 'one creature',
        damage: [
          { average: 19, count: 3, sides: 6, bonus: 9, type: 'piercing' },
        ],
        onHitEffects: [{
          id: 'poison-save-damage',
          kind: 'saving-throw-damage',
          ability: 'con',
          dc: 19,
          damage: [
            { average: 42, count: 12, sides: 6, bonus: 0, type: 'poison' },
          ],
          damageOnSuccessfulSave: 'half',
        }],
      },
    },
  ],
  sahuagin: [{
    actionId: 'spear',
    branchNote:
      'Headless 固定分支：近战时本动作以单手使用长矛，远程时使用投掷伤害；双手近战请使用“长矛（双手近战）”。',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 3,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [{ average: 4, count: 1, sides: 6, bonus: 1, type: 'piercing' }],
      rangedDamage: [{ average: 4, count: 1, sides: 6, bonus: 1, type: 'piercing' }],
    },
  }],
  salamander: [{
    actionId: 'spear',
    branchNote:
      'Headless 固定分支：近战时本动作以单手使用长矛，远程时使用投掷伤害；双手近战请使用“长矛（双手近战）”。',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 7,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one target',
      damage: [
        { average: 11, count: 2, sides: 6, bonus: 4, type: 'piercing' },
        { average: 3, count: 1, sides: 6, bonus: 0, type: 'fire' },
      ],
      rangedDamage: [
        { average: 11, count: 2, sides: 6, bonus: 4, type: 'piercing' },
        { average: 3, count: 1, sides: 6, bonus: 0, type: 'fire' },
      ],
    },
  }],
  'werewolf-human': [{
    actionId: 'spear',
    branchNote:
      'Headless 固定分支：近战时本动作以单手使用长矛，远程时使用投掷伤害；双手近战请使用“长矛（双手近战）”。',
    attack: {
      mode: 'melee-or-ranged',
      toHit: 4,
      reachFeet: 5,
      rangeFeet: { normal: 20, long: 60 },
      target: 'one creature',
      damage: [{ average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' }],
      rangedDamage: [{ average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' }],
    },
  }],
  wight: [{
    actionId: 'longsword',
    branchNote: 'Headless 固定分支：本动作以单手使用长剑；双手伤害请使用“长剑（双手）”。',
    attack: {
      mode: 'melee',
      toHit: 4,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 6, count: 1, sides: 8, bonus: 2, type: 'slashing' }],
    },
  }],
  'horned-devil': [{
    actionId: 'hurl-flame',
    attack: {
      mode: 'ranged',
      toHit: 7,
      rangeFeet: { normal: 150, long: 150 },
      target: 'one target',
      damage: [{ average: 14, count: 4, sides: 6, bonus: 0, type: 'fire' }],
    },
  }],
  oni: [{
    actionId: 'glaive',
    branchNote:
      'Headless 固定分支：本动作使用鬼人的大型／真实形态伤害；小型或中型形态请使用“长柄刀（小型／中型形态）”。',
    attack: {
      mode: 'melee',
      toHit: 7,
      reachFeet: 10,
      target: 'one target',
      damage: [{ average: 15, count: 2, sides: 10, bonus: 4, type: 'slashing' }],
    },
  }],
} as const satisfies Readonly<Record<string, readonly {
  actionId: string
  branchNote?: string
  attack: Dnd5eMonsterWeaponAttack
}[]>>

const CATALOG_WEAPON_ATTACK_VARIANTS = {
  djinni: [{
    sourceActionId: 'scimitar',
    id: 'scimitar-thunder',
    nameSuffix: '（雷鸣）',
    branchNote: 'Headless 固定分支：本动作选择雷鸣伤害。',
    attack: {
      mode: 'melee',
      toHit: 9,
      reachFeet: 5,
      target: 'one target',
      damage: [
        { average: 12, count: 2, sides: 6, bonus: 5, type: 'slashing' },
        { average: 3, count: 1, sides: 6, bonus: 0, type: 'thunder' },
      ],
    },
  }],
  drider: [{
    sourceActionId: 'longsword',
    id: 'longsword-two-handed',
    nameSuffix: '（双手）',
    branchNote: 'Headless 固定分支：本动作以双手使用长剑。',
    attack: {
      mode: 'melee',
      toHit: 6,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 8, count: 1, sides: 10, bonus: 3, type: 'slashing' }],
    },
  }],
  erinyes: [{
    sourceActionId: 'longsword',
    id: 'longsword-two-handed',
    nameSuffix: '（双手）',
    branchNote: 'Headless 固定分支：本动作以双手使用长剑。',
    attack: {
      mode: 'melee',
      toHit: 8,
      reachFeet: 5,
      target: 'one target',
      damage: [
        { average: 9, count: 1, sides: 10, bonus: 4, type: 'slashing' },
        { average: 13, count: 3, sides: 8, bonus: 0, type: 'poison' },
      ],
    },
  }],
  gladiator: [{
    sourceActionId: 'spear',
    id: 'spear-two-handed',
    nameSuffix: '（双手近战）',
    branchNote: 'Headless 固定分支：本动作以双手发动近战长矛攻击。',
    attack: {
      mode: 'melee',
      toHit: 7,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 13, count: 2, sides: 8, bonus: 4, type: 'piercing' }],
    },
  }],
  sahuagin: [{
    sourceActionId: 'spear',
    id: 'spear-two-handed',
    nameSuffix: '（双手近战）',
    branchNote: 'Headless 固定分支：本动作以双手发动近战长矛攻击。',
    attack: {
      mode: 'melee',
      toHit: 3,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 5, count: 1, sides: 8, bonus: 1, type: 'piercing' }],
    },
  }],
  salamander: [{
    sourceActionId: 'spear',
    id: 'spear-two-handed',
    nameSuffix: '（双手近战）',
    branchNote: 'Headless 固定分支：本动作以双手发动近战长矛攻击。',
    attack: {
      mode: 'melee',
      toHit: 7,
      reachFeet: 5,
      target: 'one target',
      damage: [
        { average: 13, count: 2, sides: 8, bonus: 4, type: 'piercing' },
        { average: 3, count: 1, sides: 6, bonus: 0, type: 'fire' },
      ],
    },
  }],
  'werewolf-human': [{
    sourceActionId: 'spear',
    id: 'spear-two-handed',
    nameSuffix: '（双手近战）',
    branchNote: 'Headless 固定分支：本动作以双手发动近战长矛攻击。',
    attack: {
      mode: 'melee',
      toHit: 4,
      reachFeet: 5,
      target: 'one creature',
      damage: [{ average: 6, count: 1, sides: 8, bonus: 2, type: 'piercing' }],
    },
  }],
  wight: [{
    sourceActionId: 'longsword',
    id: 'longsword-two-handed',
    nameSuffix: '（双手）',
    branchNote: 'Headless 固定分支：本动作以双手使用长剑。',
    attack: {
      mode: 'melee',
      toHit: 4,
      reachFeet: 5,
      target: 'one target',
      damage: [{ average: 7, count: 1, sides: 10, bonus: 2, type: 'slashing' }],
    },
  }],
  oni: [{
    sourceActionId: 'glaive',
    id: 'glaive-small-or-medium',
    nameSuffix: '（小型／中型形态）',
    branchNote: 'Headless 固定分支：本动作使用鬼人的小型或中型形态伤害。',
    attack: {
      mode: 'melee',
      toHit: 7,
      reachFeet: 10,
      target: 'one target',
      damage: [{ average: 9, count: 1, sides: 10, bonus: 4, type: 'slashing' }],
    },
  }],
} as const satisfies Readonly<Record<string, readonly {
  sourceActionId: string
  id: string
  nameSuffix: string
  branchNote: string
  attack: Dnd5eMonsterWeaponAttack
}[]>>

const CATALOG_ASSASSIN_POISON_WEAPON_ATTACKS = {
  shortsword: {
    mode: 'melee',
    toHit: 6,
    reachFeet: 5,
    target: 'one target',
    damage: [
      { average: 6, count: 1, sides: 6, bonus: 3, type: 'piercing' },
    ],
    onHit: 'DC 15 Constitution save; 7d6 poison damage, half on a success.',
    onHitEffects: [{
      id: 'poison-save-damage',
      kind: 'saving-throw-damage',
      ability: 'con',
      dc: 15,
      damage: [
        { average: 24, count: 7, sides: 6, bonus: 0, type: 'poison' },
      ],
      damageOnSuccessfulSave: 'half',
    }],
  },
  'light-crossbow': {
    mode: 'ranged',
    toHit: 6,
    rangeFeet: { normal: 80, long: 320 },
    target: 'one target',
    damage: [
      { average: 7, count: 1, sides: 8, bonus: 3, type: 'piercing' },
    ],
    onHit: 'DC 15 Constitution save; 7d6 poison damage, half on a success.',
    onHitEffects: [{
      id: 'poison-save-damage',
      kind: 'saving-throw-damage',
      ability: 'con',
      dc: 15,
      damage: [
        { average: 24, count: 7, sides: 6, bonus: 0, type: 'poison' },
      ],
      damageOnSuccessfulSave: 'half',
    }],
  },
} as const satisfies Readonly<Record<'shortsword' | 'light-crossbow', Dnd5eMonsterWeaponAttack>>

const CATALOG_POISON_SAVE_DAMAGE_ATTACKS = {
  'giant-poisonous-snake': {
    actionId: 'bite',
    dc: 11,
    damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'poison' },
  },
  'giant-scorpion': {
    actionId: 'sting',
    dc: 12,
    damage: { average: 22, count: 4, sides: 10, bonus: 0, type: 'poison' },
  },
  'guardian-naga': {
    actionId: 'bite',
    dc: 15,
    damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'poison' },
  },
  imp: {
    actionId: 'sting-bite-in-beast-form',
    dc: 11,
    damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'poison' },
  },
  'purple-worm': {
    actionId: 'tail-stinger',
    dc: 19,
    damage: { average: 42, count: 12, sides: 6, bonus: 0, type: 'poison' },
  },
  'spirit-naga': {
    actionId: 'bite',
    dc: 13,
    damage: { average: 31, count: 7, sides: 8, bonus: 0, type: 'poison' },
  },
  'swarm-of-poisonous-snakes': {
    actionId: 'bites',
    dc: 10,
    damage: { average: 14, count: 4, sides: 6, bonus: 0, type: 'poison' },
  },
  wyvern: {
    actionId: 'stinger',
    dc: 15,
    damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'poison' },
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  dc: number
  damage: Dnd5eMonsterDamage
}>>

const CATALOG_COMPLEX_POISON_ATTACKS = {
  'giant-centipede': {
    actionId: 'bite',
    dc: 11,
    damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'poison' },
    damageOnSuccessfulSave: 'none',
    stableAtZero: true,
  },
  'giant-spider': {
    actionId: 'bite',
    dc: 11,
    damage: { average: 9, count: 2, sides: 8, bonus: 0, type: 'poison' },
    damageOnSuccessfulSave: 'half',
    stableAtZero: true,
  },
  'giant-wasp': {
    actionId: 'sting',
    dc: 11,
    damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'poison' },
    damageOnSuccessfulSave: 'half',
    stableAtZero: true,
  },
  'giant-wolf-spider': {
    actionId: 'bite',
    dc: 11,
    damage: { average: 7, count: 2, sides: 6, bonus: 0, type: 'poison' },
    damageOnSuccessfulSave: 'half',
    stableAtZero: true,
  },
  'phase-spider': {
    actionId: 'bite',
    dc: 11,
    damage: { average: 18, count: 4, sides: 8, bonus: 0, type: 'poison' },
    damageOnSuccessfulSave: 'half',
    stableAtZero: true,
  },
  quasit: {
    actionId: 'claw-bite-in-beast-form',
    dc: 10,
    damage: { average: 5, count: 2, sides: 4, bonus: 0, type: 'poison' },
    damageOnSuccessfulSave: 'none',
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
    },
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  dc: number
  damage: Dnd5eMonsterDamage
  damageOnSuccessfulSave: 'none' | 'half'
  stableAtZero?: true
  conditionOnFailedSave?: Dnd5eMonsterFailedSaveCondition
}>>

const CATALOG_SAVING_THROW_CONDITION_ATTACKS = {
  'bearded-devil': {
    actionId: 'beard',
    effectId: 'beard-poisoned',
    ability: 'con',
    dc: 12,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
      preventHealing: true,
    },
  },
  'bone-devil': {
    actionId: 'sting',
    effectId: 'sting-poisoned',
    ability: 'con',
    dc: 14,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
    },
  },
  couatl: {
    actionId: 'bite',
    effectId: 'bite-poisoned-unconscious',
    ability: 'con',
    dc: 13,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 14_400,
      repeatSaveAtEndOfTargetTurn: false,
    },
    additionalConditionsOnFailedSave: [{
      condition: 'unconscious',
      durationRounds: 14_400,
      repeatSaveAtEndOfTargetTurn: false,
      dependsOnCondition: 'poisoned',
      canBeAwakenedByAction: true,
    }],
  },
  cockatrice: {
    actionId: 'bite',
    effectId: 'bite-petrification',
    ability: 'con',
    dc: 11,
    magical: true,
    conditionOnFailedSave: {
      condition: 'restrained',
      durationRounds: 1,
      repeatSaveAtEndOfTargetTurn: true,
      onRepeatSaveFailureTransition: {
        replaceWithCondition: 'petrified',
        duration: 'permanent',
      },
    },
  },
  'deep-gnome-svirfneblin': {
    actionId: 'poisoned-dart',
    effectId: 'dart-poisoned',
    ability: 'con',
    dc: 12,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
    },
  },
  drow: {
    actionId: 'hand-crossbow',
    effectId: 'crossbow-poisoned-unconscious',
    ability: 'con',
    dc: 13,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 600,
      repeatSaveAtEndOfTargetTurn: false,
    },
    additionalConditionsOnFailedSave: [{
      condition: 'unconscious',
      durationRounds: 600,
      repeatSaveAtEndOfTargetTurn: false,
      minimumFailureMargin: 5,
      dependsOnCondition: 'poisoned',
      breakOnDamage: true,
      canBeAwakenedByAction: true,
    }],
  },
  ettercap: {
    actionId: 'bite',
    effectId: 'bite-poisoned',
    ability: 'con',
    dc: 11,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
    },
  },
  lich: {
    actionId: 'paralyzing-touch',
    effectId: 'touch-paralyzed',
    ability: 'con',
    dc: 18,
    conditionOnFailedSave: {
      condition: 'paralyzed',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
    },
  },
  pseudodragon: {
    actionId: 'sting',
    effectId: 'sting-poisoned-unconscious',
    ability: 'con',
    dc: 11,
    conditionOnFailedSave: {
      condition: 'poisoned',
      durationRounds: 600,
      repeatSaveAtEndOfTargetTurn: false,
    },
    additionalConditionsOnFailedSave: [{
      condition: 'unconscious',
      durationRounds: 600,
      repeatSaveAtEndOfTargetTurn: false,
      minimumFailureMargin: 5,
      dependsOnCondition: 'poisoned',
      breakOnDamage: true,
      canBeAwakenedByAction: true,
    }],
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  effectId: string
  ability: AbilityKey
  dc: number
  magical?: boolean
  conditionOnFailedSave: Dnd5eMonsterFailedSaveCondition
  additionalConditionsOnFailedSave?: readonly Dnd5eMonsterFailedSaveCondition[]
}>>

const CATALOG_PRONE_BITE_DCS = {
  mastiff: 11,
  'winter-wolf': 14,
  worg: 13,
} as const

const CATALOG_PRONE_ATTACK_SAVES = {
  'giant-crocodile': { actionId: 'tail', dc: 16 },
  'gibbering-mouther': { actionId: 'bites', dc: 10, targetMaxSizeRank: 2 },
  gladiator: { actionId: 'shield-bash', dc: 15, targetMaxSizeRank: 2 },
  'stone-giant': { actionId: 'rock', dc: 17 },
  tarrasque: { actionId: 'tail', dc: 20 },
} as const

const CATALOG_SOURCE_LINKED_CONDITION_ATTACKS = {
  ankheg: {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 3,
    whenCapacityFull: 'linked-target-only',
    attackAdvantageAgainstLinkedTarget: true,
    escapeDc: 13,
    conditions: [{ condition: 'grappled' }],
  },
  behir: {
    actionId: 'constrict',
    effectId: 'constrict-grapple',
    slotGroup: 'constrict',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 3,
    whenCapacityFull: 'skip-application',
    escapeDc: 16,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'chain-devil': {
    actionId: 'chain',
    effectId: 'chain-grapple',
    slotGroup: 'chain',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 14,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
    periodicDamage: {
      timing: 'target-turn-start',
      count: 2,
      sides: 6,
      modifier: 0,
      type: 'piercing',
    },
  },
  chuul: {
    actionId: 'pincer',
    effectId: 'pincer-grapple',
    slotGroup: 'pincer',
    capacity: 2,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 3,
    whenCapacityFull: 'skip-application',
    escapeDc: 14,
    conditions: [{ condition: 'grappled' }],
  },
  'constrictor-snake': {
    actionId: 'constrict',
    effectId: 'constrict-grapple',
    slotGroup: 'constrict',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 14,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  couatl: {
    actionId: 'constrict',
    effectId: 'constrict-grapple',
    slotGroup: 'constrict',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 15,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  crocodile: {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 12,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'giant-crab': {
    actionId: 'claw',
    effectId: 'claw-grapple',
    slotGroup: 'claw',
    capacity: 2,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'skip-application',
    escapeDc: 11,
    conditions: [{ condition: 'grappled' }],
  },
  'giant-constrictor-snake': {
    actionId: 'constrict',
    effectId: 'constrict-grapple',
    slotGroup: 'constrict',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 16,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'giant-crocodile': {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 16,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'giant-frog': {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 11,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'giant-octopus': {
    actionId: 'tentacles',
    effectId: 'tentacles-grapple',
    slotGroup: 'tentacles',
    capacity: 1,
    maxDistanceFeet: 15,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 16,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'giant-scorpion': {
    actionId: 'claw',
    effectId: 'claw-grapple',
    slotGroup: 'claw',
    capacity: 2,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'skip-application',
    escapeDc: 12,
    conditions: [{ condition: 'grappled' }],
  },
  'giant-toad': {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 13,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  glabrezu: {
    actionId: 'pincer',
    effectId: 'pincer-grapple',
    slotGroup: 'pincer',
    capacity: 2,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'skip-application',
    escapeDc: 15,
    conditions: [{ condition: 'grappled' }],
  },
  marilith: {
    actionId: 'tail',
    effectId: 'tail-grapple',
    slotGroup: 'tail',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'linked-target-only',
    attackAutomaticallyHitsLinkedTarget: true,
    escapeDc: 19,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  kraken: {
    actionId: 'tentacle',
    effectId: 'tentacle-grapple',
    slotGroup: 'tentacle',
    capacity: 10,
    maxDistanceFeet: 30,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'skip-application',
    escapeDc: 18,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  otyugh: {
    actionId: 'tentacle',
    effectId: 'tentacle-grapple',
    slotGroup: 'tentacle',
    capacity: 2,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'skip-application',
    escapeDc: 13,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  remorhaz: {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 17,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  roc: {
    actionId: 'talons',
    effectId: 'talons-grapple',
    slotGroup: 'talons',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 19,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  salamander: {
    actionId: 'tail',
    effectId: 'tail-grapple',
    slotGroup: 'tail',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    attackAutomaticallyHitsLinkedTarget: true,
    escapeDc: 14,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  roper: {
    actionId: 'tendril',
    effectId: 'tendril-grapple',
    slotGroup: 'tendril',
    capacity: 6,
    maxDistanceFeet: 50,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'skip-application',
    escapeDc: 15,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
    modifiers: {
      abilityCheckDisadvantages: ['str'],
      savingThrowDisadvantages: ['str'],
    },
  },
  tarrasque: {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 20,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  'tyrannosaurus-rex': {
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 17,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  effectId: string
  slotGroup: string
  capacity: number
  maxDistanceFeet: number
  targetMaxSizeRank: number
  whenCapacityFull: 'skip-application' | 'linked-target-only'
  attackAdvantageAgainstLinkedTarget?: boolean
  attackAutomaticallyHitsLinkedTarget?: boolean
  escapeDc: number
  conditions: readonly {
    condition: 'grappled' | 'restrained'
    dependsOnCondition?: 'grappled' | 'restrained'
  }[]
  modifiers?: Dnd5eActiveEffectModifiers
  periodicDamage?: Omit<Dnd5eActiveEffectPeriodicDamage, 'lastResolvedTurnKey'>
}>>

const CATALOG_DAMAGE_OR_GRAPPLE_ATTACKS = {
  'vampire-spawn': {
    actionId: 'claws',
    grappleActionId: 'claws-grapple',
    effectId: 'claws-grapple',
    slotGroup: 'claws-grapple',
    escapeDc: 13,
  },
  'vampire-vampire': {
    actionId: 'unarmed-strike',
    grappleActionId: 'unarmed-strike-grapple',
    effectId: 'unarmed-strike-grapple',
    slotGroup: 'unarmed-strike-grapple',
    escapeDc: 18,
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  grappleActionId: string
  effectId: string
  slotGroup: string
  escapeDc: number
}>>

const CATALOG_FORCED_MOVEMENT_ATTACKS = {
  balor: {
    actionId: 'whip',
    effect: {
      id: 'whip-pull',
      kind: 'forced-movement',
      resistance: {
        kind: 'saving-throw',
        ability: 'str',
        dc: 20,
      },
      direction: 'toward-source',
      maximumDistanceFeet: 25,
    },
  },
  merrow: {
    actionId: 'harpoon',
    effect: {
      id: 'harpoon-pull',
      kind: 'forced-movement',
      resistance: {
        kind: 'opposed-ability-check',
        sourceAbility: 'str',
        targetAbility: 'str',
      },
      direction: 'toward-source',
      maximumDistanceFeet: 20,
      targetMaxSizeRank: 4,
    },
  },
  'dragon-turtle': {
    actionId: 'tail',
    effect: {
      id: 'tail-push',
      kind: 'forced-movement',
      resistance: {
        kind: 'saving-throw',
        ability: 'str',
        dc: 20,
      },
      direction: 'away-from-source',
      maximumDistanceFeet: 10,
      conditionOnFailedResistance: 'prone',
    },
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  effect: Dnd5eMonsterForcedMovementOnHitEffect
}>>

const CATALOG_PERSISTENT_EFFECT_ATTACKS = {
  'bearded-devil': {
    actionId: 'glaive',
    effect: {
      id: 'glaive-infernal-wound',
      kind: 'persistent-effect',
      savingThrow: { ability: 'con', dc: 12 },
      targetCreatureTypeExclusions: ['construct', 'undead'],
      definitionId: 'srd-5.1:monster:infernal-wound',
      label: 'Infernal Wound',
      periodicDamage: {
        timing: 'target-turn-start',
        count: 1,
        sides: 10,
        modifier: 0,
      },
      removal: {
        action: {
          label: 'Stanch Infernal Wound',
          economy: 'action',
          maxDistanceFeet: 5,
          abilityCheck: { ability: 'wis', skill: 'medicine', dc: 12 },
        },
        onMagicalHealing: true,
      },
      stacking: 'increase-periodic-dice',
    },
  },
  'fire-elemental': {
    actionId: 'touch',
    effect: {
      id: 'touch-ignite',
      kind: 'persistent-effect',
      definitionId: 'srd-5.1:monster:fire-elemental:ignite',
      label: 'Ignited',
      periodicDamage: {
        timing: 'target-turn-start',
        count: 1,
        sides: 10,
        modifier: 0,
        type: 'fire',
      },
      removal: {
        action: {
          label: 'Douse Flames',
          economy: 'action',
          maxDistanceFeet: 5,
        },
      },
      stacking: 'refresh',
    },
  },
  'horned-devil': {
    actionId: 'tail',
    effect: {
      id: 'tail-infernal-wound',
      kind: 'persistent-effect',
      savingThrow: { ability: 'con', dc: 17 },
      targetCreatureTypeExclusions: ['construct', 'undead'],
      definitionId: 'srd-5.1:monster:infernal-wound',
      label: 'Infernal Wound',
      periodicDamage: {
        timing: 'target-turn-start',
        count: 3,
        sides: 6,
        modifier: 0,
      },
      removal: {
        action: {
          label: 'Stanch Infernal Wound',
          economy: 'action',
          maxDistanceFeet: 5,
          abilityCheck: { ability: 'wis', skill: 'medicine', dc: 12 },
        },
        onMagicalHealing: true,
      },
      stacking: 'increase-periodic-dice',
    },
  },
  'pit-fiend': {
    actionId: 'bite',
    effect: {
      id: 'bite-poison',
      kind: 'persistent-effect',
      savingThrow: { ability: 'con', dc: 21 },
      definitionId: 'srd-5.1:monster:pit-fiend:bite-poison',
      label: 'Pit Fiend Bite Poison',
      standardCondition: 'poisoned',
      periodicDamage: {
        timing: 'target-turn-start',
        count: 6,
        sides: 6,
        modifier: 0,
        type: 'poison',
      },
      repeatSave: {
        ability: 'con',
        dc: 21,
        timing: 'target-turn-end',
        onSuccess: 'remove',
      },
      modifiers: { preventHealing: true },
      stacking: 'refresh',
    },
  },
  rakshasa: {
    actionId: 'claw',
    effect: {
      id: 'claw-rest-curse',
      kind: 'persistent-effect',
      magical: true,
      definitionId: 'srd-5.1:monster:rakshasa:claw-rest-curse',
      label: 'Rakshasa Claw Curse',
      ailment: 'curse',
      stacking: 'refresh',
    },
  },
  mummy: {
    actionId: 'rotting-fist',
    effect: {
      id: 'rotting-fist-mummy-rot',
      kind: 'persistent-effect',
      magical: true,
      savingThrow: { ability: 'con', dc: 12, magical: true },
      definitionId: 'srd-5.1:monster:mummy:mummy-rot',
      label: 'Mummy Rot',
      ailment: 'curse',
      modifiers: { preventHealing: true },
      campaignPeriodicHitPointMaximumReduction: {
        intervalHours: 24,
        reduction: {
          average: 10,
          count: 3,
          sides: 6,
          bonus: 0,
        },
        execution: 'campaign-time-only',
        recovery: 'when-effect-removed',
      },
      stacking: 'refresh',
    },
  },
  'mummy-lord': {
    actionId: 'rotting-fist',
    effect: {
      id: 'rotting-fist-mummy-rot',
      kind: 'persistent-effect',
      magical: true,
      savingThrow: { ability: 'con', dc: 16, magical: true },
      definitionId: 'srd-5.1:monster:mummy:mummy-rot',
      label: 'Mummy Rot',
      ailment: 'curse',
      modifiers: { preventHealing: true },
      campaignPeriodicHitPointMaximumReduction: {
        intervalHours: 24,
        reduction: {
          average: 10,
          count: 3,
          sides: 6,
          bonus: 0,
        },
        execution: 'campaign-time-only',
        recovery: 'when-effect-removed',
      },
      stacking: 'refresh',
    },
  },
  'wereboar-hybrid': {
    actionId: 'tusks',
    effect: {
      id: 'tusks-lycanthropy',
      kind: 'persistent-effect',
      magical: true,
      savingThrow: { ability: 'con', dc: 12 },
      targetCreatureTypeRequirements: ['humanoid'],
      definitionId: 'srd-5.1:monster:wereboar:lycanthropy',
      label: 'Wereboar Lycanthropy',
      ailment: 'curse',
      stacking: 'refresh',
    },
  },
  'wererat-hybrid': {
    actionId: 'bite',
    effect: {
      id: 'bite-lycanthropy',
      kind: 'persistent-effect',
      magical: true,
      savingThrow: { ability: 'con', dc: 11 },
      targetCreatureTypeRequirements: ['humanoid'],
      definitionId: 'srd-5.1:monster:wererat:lycanthropy',
      label: 'Wererat Lycanthropy',
      ailment: 'curse',
      stacking: 'refresh',
    },
  },
  'werewolf-hybrid': {
    actionId: 'bite',
    effect: {
      id: 'bite-lycanthropy',
      kind: 'persistent-effect',
      magical: true,
      savingThrow: { ability: 'con', dc: 12 },
      targetCreatureTypeRequirements: ['humanoid'],
      definitionId: 'srd-5.1:monster:werewolf:lycanthropy',
      label: 'Werewolf Lycanthropy',
      ailment: 'curse',
      stacking: 'refresh',
    },
  },
  'death-dog': {
    actionId: 'bite',
    effect: {
      id: 'bite-disease',
      kind: 'persistent-effect',
      savingThrow: { ability: 'con', dc: 12 },
      definitionId: 'srd-5.1:monster:death-dog:bite-disease',
      label: 'Death Dog Disease',
      ailment: 'disease',
      standardCondition: 'poisoned',
      stacking: 'refresh',
    },
  },
  otyugh: {
    actionId: 'bite',
    effect: {
      id: 'bite-disease',
      kind: 'persistent-effect',
      savingThrow: { ability: 'con', dc: 15 },
      definitionId: 'srd-5.1:monster:otyugh:bite-disease',
      label: 'Otyugh Disease',
      ailment: 'disease',
      standardCondition: 'poisoned',
      stacking: 'refresh',
    },
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  effect: Dnd5eMonsterPersistentOnHitEffect
}>>

const CATALOG_HIT_POINT_MAXIMUM_REDUCTION_ATTACKS = {
  'clay-golem': {
    actionId: 'slam',
    effectId: 'slam-hit-point-maximum-reduction',
    damageBasis: { kind: 'all-attack-damage' },
    savingThrow: { ability: 'con', dc: 15 },
    recovery: 'greater-restoration-or-other-magic',
  },
  wight: {
    actionId: 'life-drain',
    effectId: 'life-drain-hit-point-maximum-reduction',
    damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
    savingThrow: { ability: 'con', dc: 13 },
    recovery: 'long-rest',
  },
  'vampire-spawn': {
    actionId: 'bite',
    effectId: 'bite-hit-point-maximum-reduction',
    damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
    recovery: 'long-rest',
    healSourceByAmount: true,
  },
  'vampire-vampire': {
    actionId: 'bite',
    effectId: 'bite-hit-point-maximum-reduction',
    damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
    recovery: 'long-rest',
    healSourceByAmount: true,
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  effectId: string
  damageBasis:
    | { kind: 'all-attack-damage' }
    | { kind: 'damage-type'; damageType: Dnd5eDamageType }
  savingThrow?: { ability: AbilityKey; dc: number; magical?: boolean }
  recovery: 'long-rest' | 'greater-restoration-or-other-magic'
  healSourceByAmount?: boolean
}>>

const VAMPIRE_BITE_TARGET_ELIGIBILITY = {
  kind: 'any-of',
  predicates: [
    {
      kind: 'source-linked-relation',
      relationKind: 'grapple',
    },
    { kind: 'incapacitated' },
    {
      kind: 'standard-condition',
      condition: 'restrained',
    },
  ],
  // "Willing" is SRD-legal, but Headless has no authenticated target-consent
  // field. Keep the option visible for DM adjudication without guessing it.
  dmAdjudicationAlternatives: [{ kind: 'willing-target' }],
} as const satisfies Dnd5eMonsterTargetEligibility

const CATALOG_MAGICAL_WEAPON_TRAIT_MONSTERS = new Set([
  'androsphinx',
  'balor',
  'clay-golem',
  'couatl',
  'deva',
  'erinyes',
  'flesh-golem',
  'gynosphinx',
  'iron-golem',
  'marilith',
  'oni',
  'pit-fiend',
  'planetar',
  'solar',
  'stone-golem',
  'unicorn',
])

const CATALOG_RELENTLESS_DAMAGE_THRESHOLDS = {
  boar: 7,
  'giant-boar': 10,
  'wereboar-boar': 14,
  'wereboar-human': 14,
  'wereboar-hybrid': 14,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_BLOOD_FRENZY_TRAIT_INDEX = {
  'giant-shark': 0,
  'hunter-shark': 0,
  quipper: 0,
  sahuagin: 0,
  'swarm-of-quippers': 0,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_FLYBY_TRAIT_INDEX = {
  'flying-snake': 0,
  'giant-owl': 0,
  owl: 0,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_SURPRISE_ATTACK_TRAITS = {
  bugbear: {
    traitIndex: 1,
    extraDamage: {
      average: 7,
      count: 2,
      sides: 6,
      bonus: 0,
      type: 'inherit-primary',
    },
  },
  doppelganger: {
    traitIndex: 2,
    extraDamage: {
      average: 10,
      count: 3,
      sides: 6,
      bonus: 0,
      type: 'inherit-primary',
    },
  },
} as const

const CATALOG_AMBUSHER_ATTACK_TRAIT_INDEX = {
  doppelganger: 1,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_ASSASSINATE_TRAIT_INDEX = {
  assassin: 0,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_SNEAK_ATTACK_TRAITS = {
  assassin: {
    traitIndex: 2,
    extraDamage: {
      average: 13,
      count: 4,
      sides: 6,
      bonus: 0,
      type: 'inherit-primary',
    },
  },
  spy: {
    traitIndex: 1,
    extraDamage: {
      average: 7,
      count: 2,
      sides: 6,
      bonus: 0,
      type: 'inherit-primary',
    },
  },
} as const

const CATALOG_MARTIAL_ADVANTAGE_TRAIT_INDEX = {
  hobgoblin: 0,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_DEATH_AREA_TRAITS = {
  balor: {
    ruleId: 'death-throes',
    radiusFeet: 30,
    ability: 'dex',
    dc: 20,
    damage: { average: 70, count: 20, sides: 6, bonus: 0, type: 'fire' },
    damageOnSuccessfulSave: 'half',
  },
  'dust-mephit': {
    ruleId: 'death-burst',
    radiusFeet: 5,
    ability: 'con',
    dc: 10,
    conditionOnFailedSave: {
      condition: 'blinded',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
    },
  },
  'ice-mephit': {
    ruleId: 'death-burst',
    radiusFeet: 5,
    ability: 'dex',
    dc: 10,
    damage: { average: 4, count: 1, sides: 8, bonus: 0, type: 'slashing' },
    damageOnSuccessfulSave: 'half',
  },
  'magma-mephit': {
    ruleId: 'death-burst',
    radiusFeet: 5,
    ability: 'dex',
    dc: 11,
    damage: { average: 7, count: 2, sides: 6, bonus: 0, type: 'fire' },
    damageOnSuccessfulSave: 'half',
  },
  magmin: {
    ruleId: 'death-burst',
    radiusFeet: 10,
    ability: 'dex',
    dc: 11,
    damage: { average: 7, count: 2, sides: 6, bonus: 0, type: 'fire' },
    damageOnSuccessfulSave: 'half',
  },
  'steam-mephit': {
    ruleId: 'death-burst',
    radiusFeet: 5,
    ability: 'dex',
    dc: 10,
    damage: { average: 4, count: 1, sides: 8, bonus: 0, type: 'fire' },
    damageOnSuccessfulSave: 'none',
  },
} as const

const CATALOG_RECKLESS_TRAIT_INDEX = {
  berserker: 0,
  minotaur: 2,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_REACTIVE_TRAIT_INDEX = {
  marilith: 2,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_PARRY_ARMOR_CLASS_BONUSES = {
  'bandit-captain': 2,
  erinyes: 4,
  gladiator: 3,
  knight: 2,
  marilith: 5,
  noble: 2,
} as const satisfies Readonly<Record<string, number>>

const CATALOG_LEGENDARY_ACTION_REFERENCES = {
  lich: [{
    legacyActionId: 'paralyzing-touch-costs-2-actions',
    actionId: 'paralyzing-touch-costs-2-actions',
    referencedActionId: 'paralyzing-touch',
    automation: 'headless',
  }],
  unicorn: [{
    legacyActionId: 'hooves',
    actionId: 'legendary-hooves',
    referencedActionId: 'hooves',
    automation: 'headless',
  }],
  'vampire-vampire': [
    {
      legacyActionId: 'unarmed-strike',
      actionId: 'legendary-unarmed-strike',
      referencedActionId: 'unarmed-strike',
      automation: 'headless',
    },
    {
      legacyActionId: 'bite-costs-2-actions',
      actionId: 'legendary-bite-costs-2-actions',
      referencedActionId: 'bite',
      automation: 'headless',
    },
  ],
} as const

const CATALOG_HEALING_TOUCH_RULES = {
  deva: {
    usage: { kind: 'per-day', max: 3 },
    healing: { count: 4, sides: 8, bonus: 2 },
    removes: ['curse', 'disease', 'poisoned', 'blinded', 'deafened'],
  },
  planetar: {
    usage: { kind: 'per-day', max: 4 },
    healing: { count: 6, sides: 8, bonus: 3 },
    removes: ['curse', 'disease', 'poisoned', 'blinded', 'deafened'],
  },
  solar: {
    usage: { kind: 'per-day', max: 4 },
    healing: { count: 8, sides: 8, bonus: 4 },
    removes: ['curse', 'disease', 'poisoned', 'blinded', 'deafened'],
  },
  unicorn: {
    usage: { kind: 'per-day', max: 3 },
    healing: { count: 2, sides: 8, bonus: 2 },
    removes: ['disease', 'poisoned'],
  },
} as const satisfies Readonly<Record<string, {
  usage: Dnd5eMonsterActionPerDayUsage
  healing: { count: number; sides: number; bonus: number }
  removes: readonly ('curse' | 'disease' | 'poisoned' | 'blinded' | 'deafened')[]
}>>

/**
 * Reviewed self-only teleports whose complete SRD destination contract is
 * expressible by the shared map transaction. Blink Dog and Unicorn are
 * intentionally absent: their optional attack ordering / willing multi-map
 * passenger semantics require a larger structured rule.
 */
const CATALOG_SELF_TELEPORT_RULES = {
  androsphinx: { section: 'legendary', actionId: 'teleport-costs-2-actions', rangeFeet: 120 },
  balor: { section: 'action', actionId: 'teleport', rangeFeet: 120 },
  gynosphinx: { section: 'legendary', actionId: 'teleport-costs-2-actions', rangeFeet: 120 },
  marilith: { section: 'action', actionId: 'teleport', rangeFeet: 120 },
  nalfeshnee: { section: 'action', actionId: 'teleport', rangeFeet: 120 },
  solar: { section: 'legendary', actionId: 'teleport', rangeFeet: 120 },
} as const satisfies Readonly<Record<string, {
  section: 'action' | 'legendary'
  actionId: string
  rangeFeet: number
}>>

const CATALOG_INVISIBILITY_RULES = {
  duergar: {
    actionId: 'invisibility',
    maximumDurationRounds: 600,
    breakOn: ['makes-attack', 'casts-spell'],
    breakOnMonsterAbilityIds: ['enlarge'],
  },
  imp: {
    actionId: 'invisibility',
    breakOn: ['makes-attack'],
  },
  quasit: {
    actionId: 'invisibility',
    breakOn: ['makes-attack'],
    breakOnMonsterAbilityIds: ['scare'],
  },
  sprite: {
    actionId: 'invisibility',
    breakOn: ['makes-attack', 'casts-spell'],
  },
  'will-o-wisp': {
    actionId: 'invisibility',
    breakOn: ['makes-attack'],
    breakOnMonsterAbilityIds: ['consume-life'],
  },
} as const satisfies Readonly<Record<string, {
  actionId: string
  maximumDurationRounds?: number
  breakOn: readonly ('makes-attack' | 'casts-spell')[]
  breakOnMonsterAbilityIds?: readonly string[]
}>>

/**
 * Reviewed combat actions whose translated prose is fully represented by the
 * bounded special-action schema.  This table intentionally omits cinematic,
 * shapechanging and persistent-volume actions until their complete semantics
 * can be expressed without parsing prose at runtime.
 */
const CATALOG_STRUCTURED_SPECIAL_ACTIONS = {
  cloaker: {
    moan: {
      kind: 'area-saving-throw',
      area: { shape: 'circle', origin: 'self', radiusFeet: 60 },
      target: 'all-creatures-except-self',
      targetCreatureTypeExclusions: ['aberration'],
      ability: 'wis',
      dc: 13,
      requiresTargetCanHearSource: true,
      conditionOnFailedSave: {
        condition: 'frightened',
        durationRounds: 1,
        repeatSaveAtEndOfTargetTurn: false,
        expiresAtSourceTurnEnd: true,
      },
      immunityOnSuccessfulSaveOrEffectEnd: {
        durationRounds: 14_400,
        scope: { kind: 'source-action' },
      },
    },
  },
  gorgon: {
    'petrifying-breath': {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'all-creatures-except-self',
      ability: 'con',
      dc: 13,
      conditionOnFailedSave: {
        condition: 'restrained',
        durationRounds: 1,
        repeatSaveAtEndOfTargetTurn: true,
        onRepeatSaveFailureTransition: {
          replaceWithCondition: 'petrified',
          duration: 'permanent',
        },
      },
    },
  },
  quasit: {
    scare: {
      kind: 'saving-throw-condition',
      rangeFeet: 20,
      ability: 'wis',
      dc: 10,
      condition: 'frightened',
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
      repeatSaveDisadvantageWhenSourceVisible: true,
    },
  },
  'stone-golem': {
    slow: {
      kind: 'area-saving-throw',
      area: { shape: 'circle', origin: 'self', radiusFeet: 10 },
      target: 'hostile',
      ability: 'wis',
      dc: 17,
      magical: true,
      requiresSourceCanSeeTarget: true,
      activeEffectOnFailedSave: {
        id: 'stone-golem-slow',
        label: '石魔像缓慢',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
        modifiers: {
          speedMultiplier: 0.5,
          preventReactions: true,
          maximumAttacksPerTurn: 1,
          actionOrBonusActionOnly: true,
        },
      },
    },
  },
  'storm-giant': {
    'lightning-strike': {
      kind: 'area-saving-throw',
      area: { shape: 'circle', origin: 'point', radiusFeet: 10, placeRangeFeet: 500 },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: 17,
      magical: true,
      damage: { average: 54, count: 12, sides: 8, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  vrock: {
    'stunning-screech': {
      kind: 'area-saving-throw',
      area: { shape: 'circle', origin: 'self', radiusFeet: 20 },
      target: 'all-creatures-except-self',
      targetCreatureTypeExclusions: ['demon'],
      ability: 'con',
      dc: 14,
      requiresTargetCanHearSource: true,
      conditionOnFailedSave: {
        condition: 'stunned',
        durationRounds: 1,
        repeatSaveAtEndOfTargetTurn: false,
        expiresAtSourceTurnEnd: true,
      },
    },
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, Dnd5eMonsterSpecialActionRule>>>>

const CATALOG_STRUCTURED_LEGENDARY_SPECIAL_ACTIONS = {
  lich: {
    'frightening-gaze-costs-2-actions': {
      kind: 'saving-throw-condition',
      rangeFeet: 10,
      ability: 'wis',
      dc: 18,
      condition: 'frightened',
      magical: true,
      requiresSourceCanSeeTarget: true,
      durationRounds: 10,
      repeatSaveAtEndOfTargetTurn: true,
      immunityOnSuccessfulSaveOrEffectEnd: {
        durationRounds: 14_400,
        scope: { kind: 'source-action' },
      },
    },
  },
  solar: {
    'blinding-gaze-costs-3-actions': {
      kind: 'saving-throw-condition',
      rangeFeet: 30,
      ability: 'con',
      dc: 15,
      condition: 'blinded',
      magical: true,
      requiresSourceCanSeeTarget: true,
      requiresTargetCanSeeSource: true,
    },
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, Dnd5eMonsterSpecialActionRule>>>>

const CATALOG_STRUCTURED_SPECIAL_ACTION_USAGE = {
  vrock: {
    'stunning-screech': { kind: 'recharge', dieSides: 6, minimum: 6 },
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, Dnd5eMonsterActionUsage>>>>

interface Dnd5eCatalogCompositeSpecialAction {
  rule: Dnd5eMonsterSpecialActionRule
  relationRequirement?: Dnd5eMonsterAction['relationRequirement']
}

/**
 * Reviewed non-spell children used by composite Multiattacks. These rules are
 * explicit because the SRD prose includes visibility, linked-target, staged
 * condition, repeat-save and immunity semantics that cannot be inferred safely.
 */
const CATALOG_COMPOSITE_SPECIAL_ACTIONS: Readonly<
  Record<string, Readonly<Record<string, Dnd5eCatalogCompositeSpecialAction>>>
> = {
  'gibbering-mouther': {
    'blinding-spittle': {
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 15 },
        target: 'all-creatures-except-self',
        ability: 'dex',
        dc: 13,
        requiresSourceCanSeeTarget: true,
        conditionOnFailedSave: {
          condition: 'blinded',
          durationRounds: 1,
          repeatSaveAtEndOfTargetTurn: false,
          expiresAtSourceTurnEnd: true,
        },
      },
    },
  },
  nalfeshnee: {
    'horror-nimbus': {
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'circle', origin: 'self', radiusFeet: 15 },
        target: 'all-creatures-except-self',
        ability: 'wis',
        dc: 15,
        magical: true,
        requiresTargetCanSeeSource: true,
        conditionOnFailedSave: {
          condition: 'frightened',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
        immunityOnSuccessfulSaveOrEffectEnd: {
          durationRounds: 14_400,
          scope: { kind: 'source-action' },
        },
      },
    },
  },
  kraken: {
    fling: {
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'tentacle',
      },
      rule: {
        kind: 'throw-linked-target',
        slotGroup: 'tentacle',
        maximumDistanceFeet: 60,
        targetMaxSizeRank: 3,
        collisionDamage: {
          distanceFeetPerDie: 10,
          sides: 6,
          type: 'bludgeoning',
        },
        conditionAfterThrow: 'prone',
      },
    },
  },
  roper: {
    reel: {
      rule: {
        kind: 'source-linked-reel',
        slotGroup: 'tendril',
        maximumDistanceFeet: 25,
      },
    },
  },
  'shambling-mound': {
    engulf: {
      rule: {
        kind: 'source-linked-engulf',
        targetMaxSizeRank: 2,
        effect: {
          id: 'engulf',
          kind: 'source-linked-condition',
          relation: {
            kind: 'engulfed',
            slotGroup: 'engulf',
            capacity: 1,
            maxDistanceFeet: 5,
            targetMaxSizeRank: 2,
            whenCapacityFull: 'skip-application',
            movement: 'carry-target',
            endsOnSourceIncapacitated: false,
          },
          escapeDc: 14,
          conditions: [
            { condition: 'grappled' },
            {
              condition: 'restrained',
              dependsOnCondition: 'grappled',
            },
            {
              condition: 'blinded',
              dependsOnCondition: 'grappled',
            },
          ],
          dependentLegacyConditions: ['unable-to-breathe'],
          periodicDamage: {
            timing: 'source-turn-start',
            count: 2,
            sides: 8,
            modifier: 4,
            type: 'bludgeoning',
            savingThrow: {
              ability: 'con',
              dc: 14,
              damageOnSuccessfulSave: 'none',
            },
          },
        },
      },
    },
  },
  tarrasque: {
    'frightful-presence': {
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'circle', origin: 'self', radiusFeet: 120 },
        target: 'hostile',
        ability: 'wis',
        dc: 17,
        conditionOnFailedSave: {
          condition: 'frightened',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
          repeatSaveDisadvantageWhenSourceVisible: true,
        },
        immunityOnSuccessfulSaveOrEffectEnd: {
          durationRounds: 14_400,
          scope: { kind: 'source-action' },
        },
      },
    },
  },
  chuul: {
    tentacles: {
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'pincer',
      },
      rule: {
        kind: 'saving-throw-condition',
        rangeFeet: 10,
        ability: 'con',
        dc: 13,
        condition: 'poisoned',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
        additionalConditionsOnFailedSave: [{
          condition: 'paralyzed',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: false,
          dependsOnCondition: 'poisoned',
        }],
      },
    },
  },
  mummy: {
    'dreadful-glare': {
      rule: {
        kind: 'saving-throw-condition',
        rangeFeet: 60,
        ability: 'wis',
        dc: 11,
        condition: 'frightened',
        magical: true,
        requiresSourceCanSeeTarget: true,
        requiresTargetCanSeeSource: true,
        durationRounds: 1,
        expiresAtSourceTurnEnd: true,
        additionalConditionsOnFailedSave: [{
          condition: 'paralyzed',
          durationRounds: 1,
          repeatSaveAtEndOfTargetTurn: false,
          expiresAtSourceTurnEnd: true,
          minimumFailureMargin: 5,
          dependsOnCondition: 'frightened',
        }],
        immunityOnSuccessfulSaveOrEffectEnd: {
          durationRounds: 14_400,
          scope: {
            kind: 'catalog-action',
            actionKey: 'mummy:dreadful-glare',
            grantedActionKeys: ['mummy:dreadful-glare'],
          },
        },
      },
    },
  },
  'mummy-lord': {
    'dreadful-glare': {
      rule: {
        kind: 'saving-throw-condition',
        rangeFeet: 60,
        ability: 'wis',
        dc: 16,
        condition: 'frightened',
        magical: true,
        requiresSourceCanSeeTarget: true,
        requiresTargetCanSeeSource: true,
        durationRounds: 1,
        expiresAtSourceTurnEnd: true,
        additionalConditionsOnFailedSave: [{
          condition: 'paralyzed',
          durationRounds: 1,
          repeatSaveAtEndOfTargetTurn: false,
          expiresAtSourceTurnEnd: true,
          minimumFailureMargin: 5,
          dependsOnCondition: 'frightened',
        }],
        immunityOnSuccessfulSaveOrEffectEnd: {
          durationRounds: 14_400,
          scope: {
            kind: 'catalog-action',
            actionKey: 'mummy-lord:dreadful-glare',
            grantedActionKeys: [
              'mummy:dreadful-glare',
              'mummy-lord:dreadful-glare',
            ],
          },
        },
      },
    },
  },
}

interface Dnd5eCatalogMultiattackOverride {
  sequence: readonly string[]
  sequenceAttackMode?: 'melee' | 'ranged'
  alternatives?: readonly {
    id: string
    sequence: readonly string[]
    sequenceAttackMode?: 'melee' | 'ranged'
  }[]
}

interface Dnd5eCatalogMultiattackCandidate {
  id: string
  sequence: readonly string[]
  sequenceAttackMode?: 'melee' | 'ranged'
}

/**
 * The SRD generator deliberately leaves prose containing "or"/"alternatively"
 * for DM adjudication. These reviewed overrides keep each legal sequence as a
 * separate stable action so the Host, tactical planner, and simulator can use
 * the existing atomic Multiattack transaction without guessing player intent.
 */
const CATALOG_MULTIATTACK_OVERRIDES: Readonly<Record<string, Dnd5eCatalogMultiattackOverride>> = {
  'bandit-captain': {
    sequence: ['scimitar', 'scimitar', 'dagger'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-daggers-ranged',
      sequence: ['dagger', 'dagger'],
      sequenceAttackMode: 'ranged',
    }],
  },
  'half-red-dragon-veteran': {
    sequence: ['longsword', 'longsword', 'shortsword'],
  },
  veteran: {
    sequence: ['longsword', 'longsword', 'shortsword'],
  },
  assassin: {
    sequence: ['shortsword', 'shortsword'],
  },
  behir: {
    sequence: ['bite', 'constrict'],
  },
  'giant-scorpion': {
    sequence: ['claw', 'claw', 'sting'],
  },
  'barbed-devil': {
    sequence: ['tail', 'claw', 'claw'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-hurl-flame',
      sequence: ['hurl-flame', 'hurl-flame'],
      sequenceAttackMode: 'ranged',
    }],
  },
  'bone-devil': {
    sequence: ['claw', 'claw', 'sting'],
    sequenceAttackMode: 'melee',
  },
  centaur: {
    sequence: ['pike', 'hooves'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-longbow',
      sequence: ['longbow', 'longbow'],
      sequenceAttackMode: 'ranged',
    }],
  },
  chimera: {
    sequence: ['bite', 'horns', 'claws'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-fire-breath-instead-of-bite',
        sequence: ['fire-breath', 'horns', 'claws'],
      },
      {
        id: 'multiattack-fire-breath-instead-of-horns',
        sequence: ['bite', 'fire-breath', 'claws'],
      },
    ],
  },
  'dragon-turtle': {
    sequence: ['bite', 'claw', 'claw'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-bite-and-tail',
      sequence: ['bite', 'tail'],
      sequenceAttackMode: 'melee',
    }],
  },
  efreeti: {
    sequence: ['scimitar', 'scimitar'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-hurl-flame',
      sequence: ['hurl-flame', 'hurl-flame'],
      sequenceAttackMode: 'ranged',
    }],
  },
  ettercap: {
    sequence: ['bite', 'claws'],
    sequenceAttackMode: 'melee',
  },
  'iron-golem': {
    sequence: ['sword', 'sword'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-slams',
        sequence: ['slam', 'slam'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-sword-and-slam',
        sequence: ['sword', 'slam'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  lizardfolk: {
    sequence: ['bite', 'heavy-club'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-bite-javelin',
        sequence: ['bite', 'javelin'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-bite-spiked-shield',
        sequence: ['bite', 'spiked-shield'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-heavy-club-javelin',
        sequence: ['heavy-club', 'javelin'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-heavy-club-spiked-shield',
        sequence: ['heavy-club', 'spiked-shield'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-javelin-spiked-shield',
        sequence: ['javelin', 'spiked-shield'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  medusa: {
    sequence: ['snake-hair', 'shortsword', 'shortsword'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-longbow',
      sequence: ['longbow', 'longbow'],
      sequenceAttackMode: 'ranged',
    }],
  },
  roc: {
    sequence: ['beak', 'talons'],
    sequenceAttackMode: 'melee',
  },
  scout: {
    sequence: ['shortsword', 'shortsword'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-longbow',
      sequence: ['longbow', 'longbow'],
      sequenceAttackMode: 'ranged',
    }],
  },
  'werebear-bear': {
    sequence: ['claw', 'claw'],
    sequenceAttackMode: 'melee',
  },
  'werebear-human': {
    sequence: ['greataxe', 'greataxe'],
    sequenceAttackMode: 'melee',
  },
  'werebear-hybrid': {
    sequence: ['claw', 'claw'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-greataxe',
      sequence: ['greataxe', 'greataxe'],
      sequenceAttackMode: 'melee',
    }],
  },
  'wereboar-human': {
    sequence: ['maul', 'maul'],
    sequenceAttackMode: 'melee',
  },
  'wererat-human': {
    sequence: ['shortsword', 'shortsword'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-hand-crossbow',
      sequence: ['hand-crossbow', 'hand-crossbow'],
      sequenceAttackMode: 'ranged',
    }],
  },
  'weretiger-human': {
    sequence: ['scimitar', 'scimitar'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-longbow',
      sequence: ['longbow', 'longbow'],
      sequenceAttackMode: 'ranged',
    }],
  },
  'weretiger-hybrid': {
    sequence: ['claw', 'claw'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-scimitar',
        sequence: ['scimitar', 'scimitar'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-longbow',
        sequence: ['longbow', 'longbow'],
        sequenceAttackMode: 'ranged',
      },
    ],
  },
  balor: {
    sequence: ['longsword', 'whip'],
    sequenceAttackMode: 'melee',
  },
  'bearded-devil': {
    sequence: ['beard', 'glaive'],
    sequenceAttackMode: 'melee',
  },
  'chain-devil': {
    sequence: ['chain', 'chain'],
    sequenceAttackMode: 'melee',
  },
  chuul: {
    sequence: ['pincer', 'pincer'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-pincers-and-tentacles',
      sequence: ['pincer', 'pincer', 'tentacles'],
      sequenceAttackMode: 'melee',
    }],
  },
  'clay-golem': {
    sequence: ['slam', 'slam'],
    sequenceAttackMode: 'melee',
  },
  cloaker: {
    sequence: ['bite', 'tail'],
    sequenceAttackMode: 'melee',
  },
  'death-dog': {
    sequence: ['bite', 'bite'],
    sequenceAttackMode: 'melee',
  },
  djinni: {
    sequence: ['scimitar', 'scimitar', 'scimitar'],
    sequenceAttackMode: 'melee',
  },
  drider: {
    sequence: ['longbow', 'longbow', 'longbow'],
    sequenceAttackMode: 'ranged',
    alternatives: [
      {
        id: 'multiattack-longsword',
        sequence: ['longsword', 'longsword', 'longsword'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-bite-and-longbow',
        sequence: ['bite', 'longbow', 'longbow'],
      },
      {
        id: 'multiattack-bite-and-longsword',
        sequence: ['bite', 'longsword', 'longsword'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  erinyes: {
    sequence: ['longsword', 'longsword', 'longsword'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-two-longswords-and-longbow',
        sequence: ['longsword', 'longsword', 'longbow'],
      },
      {
        id: 'multiattack-longsword-and-two-longbows',
        sequence: ['longsword', 'longbow', 'longbow'],
      },
      {
        id: 'multiattack-longbow',
        sequence: ['longbow', 'longbow', 'longbow'],
        sequenceAttackMode: 'ranged',
      },
    ],
  },
  'fire-elemental': {
    sequence: ['touch', 'touch'],
    sequenceAttackMode: 'melee',
  },
  'giant-crocodile': {
    sequence: ['bite', 'tail'],
    sequenceAttackMode: 'melee',
  },
  'gibbering-mouther': {
    sequence: ['bites', 'blinding-spittle'],
    sequenceAttackMode: 'melee',
  },
  glabrezu: {
    sequence: ['pincer', 'pincer', 'fist', 'fist'],
    sequenceAttackMode: 'melee',
  },
  gladiator: {
    sequence: ['spear', 'spear', 'spear'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-shield-bash-and-two-spears',
        sequence: ['shield-bash', 'spear', 'spear'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-two-shield-bashes-and-spear',
        sequence: ['shield-bash', 'shield-bash', 'spear'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-shield-bashes',
        sequence: ['shield-bash', 'shield-bash', 'shield-bash'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-spears-ranged',
        sequence: ['spear', 'spear'],
        sequenceAttackMode: 'ranged',
      },
    ],
  },
  grick: {
    sequence: ['tentacles', 'beak'],
    sequenceAttackMode: 'melee',
  },
  'horned-devil': {
    sequence: ['fork', 'fork', 'tail'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-forks-and-hurl-flame',
        sequence: ['fork', 'fork', 'hurl-flame'],
      },
      {
        id: 'multiattack-fork-tail-and-hurl-flame',
        sequence: ['fork', 'tail', 'hurl-flame'],
      },
      {
        id: 'multiattack-fork-and-two-hurl-flames',
        sequence: ['fork', 'hurl-flame', 'hurl-flame'],
      },
      {
        id: 'multiattack-tail-and-two-hurl-flames',
        sequence: ['tail', 'hurl-flame', 'hurl-flame'],
      },
      {
        id: 'multiattack-hurl-flames',
        sequence: ['hurl-flame', 'hurl-flame', 'hurl-flame'],
        sequenceAttackMode: 'ranged',
      },
    ],
  },
  hydra: {
    sequence: ['bite', 'bite', 'bite', 'bite', 'bite'],
    sequenceAttackMode: 'melee',
  },
  kraken: {
    sequence: ['tentacle', 'tentacle', 'tentacle'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-two-tentacles-and-fling',
        sequence: ['tentacle', 'tentacle', 'fling'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-tentacle-and-two-flings',
        sequence: ['tentacle', 'fling', 'fling'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-flings',
        sequence: ['fling', 'fling', 'fling'],
      },
    ],
  },
  lamia: {
    sequence: ['claws', 'dagger'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-claws-and-intoxicating-touch',
      sequence: ['claws', 'intoxicating-touch'],
      sequenceAttackMode: 'melee',
    }],
  },
  manticore: {
    sequence: ['bite', 'claw', 'claw'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-tail-spikes',
      sequence: ['tail-spike', 'tail-spike', 'tail-spike'],
      sequenceAttackMode: 'ranged',
    }],
  },
  marilith: {
    sequence: ['longsword', 'longsword', 'longsword', 'longsword', 'longsword', 'longsword', 'tail'],
    sequenceAttackMode: 'melee',
  },
  merrow: {
    sequence: ['bite', 'claws'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-bite-and-harpoon',
      sequence: ['bite', 'harpoon'],
    }],
  },
  mummy: {
    sequence: ['dreadful-glare', 'rotting-fist'],
    sequenceAttackMode: 'melee',
  },
  'mummy-lord': {
    sequence: ['dreadful-glare', 'rotting-fist'],
    sequenceAttackMode: 'melee',
  },
  nalfeshnee: {
    sequence: ['horror-nimbus', 'bite', 'claw', 'claw'],
    sequenceAttackMode: 'melee',
  },
  oni: {
    sequence: ['claw-oni-form-only', 'claw-oni-form-only'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-glaive',
      sequence: ['glaive', 'glaive'],
      sequenceAttackMode: 'melee',
    }],
  },
  otyugh: {
    sequence: ['bite', 'tentacle', 'tentacle'],
    sequenceAttackMode: 'melee',
  },
  'pit-fiend': {
    sequence: ['bite', 'claw', 'mace', 'tail'],
    sequenceAttackMode: 'melee',
  },
  'purple-worm': {
    sequence: ['bite', 'tail-stinger'],
    sequenceAttackMode: 'melee',
  },
  rakshasa: {
    sequence: ['claw', 'claw'],
    sequenceAttackMode: 'melee',
  },
  roper: {
    sequence: ['tendril', 'tendril', 'tendril', 'tendril', 'reel', 'bite'],
    sequenceAttackMode: 'melee',
  },
  sahuagin: {
    sequence: ['bite', 'claws'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-bite-and-spear',
      sequence: ['bite', 'spear'],
      sequenceAttackMode: 'melee',
    }],
  },
  salamander: {
    sequence: ['spear', 'tail'],
    sequenceAttackMode: 'melee',
  },
  'shambling-mound': {
    sequence: ['slam', 'slam', 'engulf'],
    sequenceAttackMode: 'melee',
  },
  tarrasque: {
    sequence: ['bite', 'claw', 'claw', 'horns', 'tail'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-swallow',
        sequence: ['swallow', 'claw', 'claw', 'horns', 'tail'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-frightful-presence',
        sequence: ['frightful-presence', 'bite', 'claw', 'claw', 'horns', 'tail'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-frightful-presence-and-swallow',
        sequence: ['frightful-presence', 'swallow', 'claw', 'claw', 'horns', 'tail'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  'tyrannosaurus-rex': {
    sequence: ['bite', 'tail'],
    sequenceAttackMode: 'melee',
  },
  'vampire-spawn': {
    sequence: ['claws', 'claws'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-claws-and-bite',
        sequence: ['claws', 'bite'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-claws-and-grapple',
        sequence: ['claws', 'claws-grapple'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-grapple-and-claws',
        sequence: ['claws-grapple', 'claws'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-grapples',
        sequence: ['claws-grapple', 'claws-grapple'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-grapple-and-bite',
        sequence: ['claws-grapple', 'bite'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  'vampire-vampire': {
    sequence: ['unarmed-strike', 'unarmed-strike'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-unarmed-strike-and-bite',
        sequence: ['unarmed-strike', 'bite'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-unarmed-strike-and-grapple',
        sequence: ['unarmed-strike', 'unarmed-strike-grapple'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-grapple-and-unarmed-strike',
        sequence: ['unarmed-strike-grapple', 'unarmed-strike'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-unarmed-grapples',
        sequence: ['unarmed-strike-grapple', 'unarmed-strike-grapple'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-unarmed-grapple-and-bite',
        sequence: ['unarmed-strike-grapple', 'bite'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  'wereboar-hybrid': {
    sequence: ['maul', 'maul'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-maul-and-tusks',
      sequence: ['maul', 'tusks'],
      sequenceAttackMode: 'melee',
    }],
  },
  'wererat-hybrid': {
    sequence: ['shortsword', 'shortsword'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-hand-crossbow',
        sequence: ['hand-crossbow', 'hand-crossbow'],
        sequenceAttackMode: 'ranged',
      },
      {
        id: 'multiattack-shortsword-and-hand-crossbow',
        sequence: ['shortsword', 'hand-crossbow'],
      },
      {
        id: 'multiattack-shortsword-and-bite',
        sequence: ['shortsword', 'bite'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-hand-crossbow-and-bite',
        sequence: ['hand-crossbow', 'bite'],
      },
    ],
  },
  'werewolf-human': {
    sequence: ['spear', 'spear'],
    sequenceAttackMode: 'melee',
    alternatives: [{
      id: 'multiattack-spears-ranged',
      sequence: ['spear', 'spear'],
      sequenceAttackMode: 'ranged',
    }],
  },
  'werewolf-hybrid': {
    sequence: ['bite', 'claws'],
    sequenceAttackMode: 'melee',
  },
  wight: {
    sequence: ['longbow', 'longbow'],
    sequenceAttackMode: 'ranged',
    alternatives: [
      {
        id: 'multiattack-longsword',
        sequence: ['longsword', 'longsword'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-life-drain-and-longsword',
        sequence: ['life-drain', 'longsword'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
  wyvern: {
    sequence: ['bite', 'stinger'],
    sequenceAttackMode: 'melee',
    alternatives: [
      {
        id: 'multiattack-claws-and-stinger',
        sequence: ['claws', 'stinger'],
        sequenceAttackMode: 'melee',
      },
      {
        id: 'multiattack-bite-and-claws',
        sequence: ['bite', 'claws'],
        sequenceAttackMode: 'melee',
      },
    ],
  },
}

/**
 * These are complete legal choices from a broader prose Multiattack whose
 * remaining branches still require DM adjudication. They are separate stable
 * actions so exposing a useful candidate never turns the original prose into
 * a false Headless claim.
 */
const CATALOG_MULTIATTACK_CANDIDATES: Readonly<
  Record<string, readonly Dnd5eCatalogMultiattackCandidate[]>
> = {
  'gibbering-mouther': [{
    id: 'multiattack-bites-only',
    sequence: ['bites'],
    sequenceAttackMode: 'melee',
  }],
  mummy: [{
    id: 'multiattack-rotting-fist-only',
    sequence: ['rotting-fist'],
    sequenceAttackMode: 'melee',
  }],
  'mummy-lord': [{
    id: 'multiattack-rotting-fist-only',
    sequence: ['rotting-fist'],
    sequenceAttackMode: 'melee',
  }],
  nalfeshnee: [{
    id: 'multiattack-weapons-only',
    sequence: ['bite', 'claw', 'claw'],
    sequenceAttackMode: 'melee',
  }],
}

function applyCatalogMonsterActionRules(
  monster: Dnd5eMonsterStatBlock,
): Dnd5eMonsterStatBlock {
  const selfTeleport = CATALOG_SELF_TELEPORT_RULES[
    monster.slug as keyof typeof CATALOG_SELF_TELEPORT_RULES
  ]
  const invisibility = CATALOG_INVISIBILITY_RULES[
    monster.slug as keyof typeof CATALOG_INVISIBILITY_RULES
  ]
  const healingTouch = CATALOG_HEALING_TOUCH_RULES[
    monster.slug as keyof typeof CATALOG_HEALING_TOUCH_RULES
  ]
  const fixedDamageAttack = CATALOG_FIXED_DAMAGE_ATTACKS[
    monster.slug as keyof typeof CATALOG_FIXED_DAMAGE_ATTACKS
  ]
  const baseWeaponAttack = CATALOG_BASE_WEAPON_ATTACKS[
    monster.slug as keyof typeof CATALOG_BASE_WEAPON_ATTACKS
  ]
  const exactWeaponAttacks = CATALOG_EXACT_WEAPON_ATTACKS[
    monster.slug as keyof typeof CATALOG_EXACT_WEAPON_ATTACKS
  ] ?? []
  const weaponAttackVariants = CATALOG_WEAPON_ATTACK_VARIANTS[
    monster.slug as keyof typeof CATALOG_WEAPON_ATTACK_VARIANTS
  ] ?? []
  const poisonSaveDamageAttack = CATALOG_POISON_SAVE_DAMAGE_ATTACKS[
    monster.slug as keyof typeof CATALOG_POISON_SAVE_DAMAGE_ATTACKS
  ]
  const complexPoisonAttack = CATALOG_COMPLEX_POISON_ATTACKS[
    monster.slug as keyof typeof CATALOG_COMPLEX_POISON_ATTACKS
  ]
  const savingThrowConditionAttack = CATALOG_SAVING_THROW_CONDITION_ATTACKS[
    monster.slug as keyof typeof CATALOG_SAVING_THROW_CONDITION_ATTACKS
  ]
  const proneBiteDc = CATALOG_PRONE_BITE_DCS[
    monster.slug as keyof typeof CATALOG_PRONE_BITE_DCS
  ]
  const proneAttackSave = CATALOG_PRONE_ATTACK_SAVES[
    monster.slug as keyof typeof CATALOG_PRONE_ATTACK_SAVES
  ]
  const sourceLinkedConditionAttack = CATALOG_SOURCE_LINKED_CONDITION_ATTACKS[
    monster.slug as keyof typeof CATALOG_SOURCE_LINKED_CONDITION_ATTACKS
  ]
  const damageOrGrappleAttack = CATALOG_DAMAGE_OR_GRAPPLE_ATTACKS[
    monster.slug as keyof typeof CATALOG_DAMAGE_OR_GRAPPLE_ATTACKS
  ]
  const forcedMovementAttack = CATALOG_FORCED_MOVEMENT_ATTACKS[
    monster.slug as keyof typeof CATALOG_FORCED_MOVEMENT_ATTACKS
  ]
  const persistentEffectAttack = CATALOG_PERSISTENT_EFFECT_ATTACKS[
    monster.slug as keyof typeof CATALOG_PERSISTENT_EFFECT_ATTACKS
  ]
  const hitPointMaximumReductionAttack =
    CATALOG_HIT_POINT_MAXIMUM_REDUCTION_ATTACKS[
      monster.slug as keyof typeof CATALOG_HIT_POINT_MAXIMUM_REDUCTION_ATTACKS
    ]
  const legendaryActionReferences = CATALOG_LEGENDARY_ACTION_REFERENCES[
    monster.slug as keyof typeof CATALOG_LEGENDARY_ACTION_REFERENCES
  ] ?? []
  const structuredSpecialActions = CATALOG_STRUCTURED_SPECIAL_ACTIONS[
    monster.slug as keyof typeof CATALOG_STRUCTURED_SPECIAL_ACTIONS
  ] ?? {}
  const structuredLegendarySpecialActions = CATALOG_STRUCTURED_LEGENDARY_SPECIAL_ACTIONS[
    monster.slug as keyof typeof CATALOG_STRUCTURED_LEGENDARY_SPECIAL_ACTIONS
  ] ?? {}
  const structuredSpecialActionUsage = CATALOG_STRUCTURED_SPECIAL_ACTION_USAGE[
    monster.slug as keyof typeof CATALOG_STRUCTURED_SPECIAL_ACTION_USAGE
  ] ?? {}
  const compositeSpecialActions = CATALOG_COMPOSITE_SPECIAL_ACTIONS[monster.slug] ?? {}
  const multiattackOverride = CATALOG_MULTIATTACK_OVERRIDES[monster.slug]
  const multiattackCandidates = CATALOG_MULTIATTACK_CANDIDATES[monster.slug] ?? []
  const optionalSpecialMultiattacks = monster.actions.flatMap((action) => {
    if (action.kind !== 'multiattack' || !action.sequence?.length) return []
    const hasStructuredSpecial = action.sequence.some((actionId) => {
      const child = monster.actions.find((candidate) => candidate.id === actionId)
      return child?.kind === 'other' && child.automation === 'headless' && !!child.rule
    })
    if (!hasStructuredSpecial) return []
    const weaponSequence = action.sequence.filter((actionId) => {
      const child = monster.actions.find((candidate) => candidate.id === actionId)
      return child?.kind === 'weapon-attack' && child.automation === 'headless'
    })
    return weaponSequence.length > 0 ? [{ action, weaponSequence }] : []
  })

  return {
    ...monster,
    actions: [
      ...monster.actions.map((action) => {
        const structuredRule = structuredSpecialActions[
          action.id as keyof typeof structuredSpecialActions
        ] as Dnd5eMonsterSpecialActionRule | undefined
        if (structuredRule) {
          const structuredUsage = structuredSpecialActionUsage[
            action.id as keyof typeof structuredSpecialActionUsage
          ] as Dnd5eMonsterActionUsage | undefined
          return {
            ...action,
            kind: 'other' as const,
            automation: 'headless' as const,
            usage: structuredUsage ?? action.usage,
            rule: structuredRule,
          }
        }
        if (
          selfTeleport?.section === 'action' &&
          action.id === selfTeleport.actionId
        ) {
          return {
            ...action,
            kind: 'other' as const,
            automation: 'headless' as const,
            rule: {
              kind: 'teleport' as const,
              target: 'self' as const,
              rangeFeet: selfTeleport.rangeFeet,
              requiresVisibleDestination: true as const,
              requiresUnoccupiedDestination: true as const,
            },
          }
        }
        if (invisibility && action.id === invisibility.actionId) {
          return {
            ...action,
            kind: 'other' as const,
            automation: 'headless' as const,
            rule: {
              kind: 'invisibility' as const,
              target: 'self' as const,
              concentration: true as const,
              maximumDurationRounds: 'maximumDurationRounds' in invisibility
                ? invisibility.maximumDurationRounds
                : undefined,
              breakOn: invisibility.breakOn,
              breakOnMonsterAbilityIds: 'breakOnMonsterAbilityIds' in invisibility
                ? invisibility.breakOnMonsterAbilityIds
                : undefined,
            },
          }
        }
        if (healingTouch && action.id === 'healing-touch') {
          return {
            ...action,
            kind: 'other' as const,
            automation: 'headless' as const,
            usage: healingTouch.usage,
            rule: {
              kind: 'healing-touch' as const,
              rangeFeet: 5 as const,
              target: 'another-living-creature' as const,
              healing: healingTouch.healing,
              removes: healingTouch.removes,
            },
          }
        }
        const compositeSpecialAction = compositeSpecialActions[action.id]
        const exactWeaponAttack = exactWeaponAttacks.find((candidate) =>
          candidate.actionId === action.id)
        const assassinPoisonWeaponAttack = monster.slug === 'assassin' &&
          (action.id === 'shortsword' || action.id === 'light-crossbow')
          ? CATALOG_ASSASSIN_POISON_WEAPON_ATTACKS[action.id]
          : undefined
        if (monster.slug === 'tarrasque' && action.id === 'swallow') {
          const bite = monster.actions.find((candidate) =>
            candidate.id === 'bite')?.attack
          if (bite) {
            return {
              ...action,
              kind: 'weapon-attack' as const,
              automation: 'headless' as const,
              referencedActionId: 'bite',
              relationRequirement: {
                kind: 'target-linked-to-source' as const,
                slotGroup: 'bite',
              },
              attack: {
                ...bite,
                targetMaxSizeRank: 3,
                onHitEffects: [{
                  id: 'swallow',
                  kind: 'source-linked-condition' as const,
                  relation: {
                    kind: 'swallowed' as const,
                    slotGroup: 'swallow',
                    capacity: 20,
                    maxDistanceFeet: 5,
                    targetMaxSizeRank: 3,
                    whenCapacityFull: 'skip-application' as const,
                    movement: 'carry-target' as const,
                    endsOnSourceIncapacitated: false,
                  },
                  conditions: [
                    { condition: 'restrained' as const },
                    {
                      condition: 'blinded' as const,
                      dependsOnCondition: 'restrained' as const,
                    },
                  ],
                  periodicDamage: {
                    timing: 'source-turn-start' as const,
                    count: 16,
                    sides: 6,
                    modifier: 0,
                    type: 'acid' as const,
                  },
                  removeSourceRelationSlotGroupOnApply: 'bite',
                }],
              },
            }
          }
        }
        if (monster.slug === 'roper' && action.id === 'bite') {
          return {
            ...action,
            relationRequirement: {
              kind: 'target-linked-to-source' as const,
              slotGroup: 'tendril',
            },
          }
        }
        if (compositeSpecialAction) {
          return {
            ...action,
            kind: 'other' as const,
            automation: 'headless' as const,
            rule: compositeSpecialAction.rule,
            relationRequirement: compositeSpecialAction.relationRequirement,
          }
        }
        if (fixedDamageAttack && action.id === fixedDamageAttack.actionId) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              mode: 'melee' as const,
              toHit: fixedDamageAttack.toHit,
              reachFeet: 5,
              target: 'one creature',
              damage: [{
                average: 1,
                count: 0,
                sides: 4,
                bonus: 1,
                type: fixedDamageAttack.damageType,
              }],
            },
          }
        }
        if (baseWeaponAttack && action.id === baseWeaponAttack.actionId) {
          const sourceLinkedEffect =
            sourceLinkedConditionAttack &&
            action.id === sourceLinkedConditionAttack.actionId
              ? ({
                  id: sourceLinkedConditionAttack.effectId,
                  kind: 'source-linked-condition' as const,
                  relation: {
                    kind: 'grapple' as const,
                    slotGroup: sourceLinkedConditionAttack.slotGroup,
                    capacity: sourceLinkedConditionAttack.capacity,
                    maxDistanceFeet: sourceLinkedConditionAttack.maxDistanceFeet,
                    targetMaxSizeRank: sourceLinkedConditionAttack.targetMaxSizeRank,
                    whenCapacityFull: sourceLinkedConditionAttack.whenCapacityFull,
                    attackAdvantageAgainstLinkedTarget:
                      'attackAdvantageAgainstLinkedTarget' in sourceLinkedConditionAttack
                        ? sourceLinkedConditionAttack.attackAdvantageAgainstLinkedTarget
                        : undefined,
                    attackAutomaticallyHitsLinkedTarget:
                      'attackAutomaticallyHitsLinkedTarget' in sourceLinkedConditionAttack
                        ? sourceLinkedConditionAttack.attackAutomaticallyHitsLinkedTarget
                        : undefined,
                  },
                  escapeDc: sourceLinkedConditionAttack.escapeDc,
                  conditions: sourceLinkedConditionAttack.conditions,
                  modifiers:
                    'modifiers' in sourceLinkedConditionAttack
                      ? sourceLinkedConditionAttack.modifiers
                      : undefined,
                  periodicDamage:
                    'periodicDamage' in sourceLinkedConditionAttack
                      ? sourceLinkedConditionAttack.periodicDamage
                      : undefined,
                } as Dnd5eMonsterSourceLinkedConditionOnHitEffect)
              : undefined
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...baseWeaponAttack.attack,
              onHitEffects: sourceLinkedEffect
                ? [sourceLinkedEffect]
                : undefined,
            },
          }
        }
        if (exactWeaponAttack) {
          return {
            ...action,
            description:
              ('branchNote' in exactWeaponAttack && exactWeaponAttack.branchNote
                ? `${exactWeaponAttack.branchNote}\n${action.description}`
                : action.description),
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: exactWeaponAttack.attack,
          }
        }
        if (monster.slug === 'manticore' && action.id === 'tail-spike') {
          return {
            ...action,
            usage: { kind: 'per-day' as const, max: 24 },
          }
        }
        if (monster.slug === 'violet-fungus' && action.id === 'multiattack') {
          return {
            ...action,
            kind: 'multiattack' as const,
            automation: 'headless' as const,
            sequence: undefined,
            randomRepeat: {
              actionId: 'rotting-touch',
              dieSides: 4,
              minimum: 1,
              maximum: 4,
            },
          }
        }
        if (optionalSpecialMultiattacks.some((entry) => entry.action.id === action.id)) {
          return {
            ...action,
            automation: 'headless' as const,
          }
        }
        if (multiattackOverride && action.id === 'multiattack') {
          return {
            ...action,
            kind: 'multiattack' as const,
            automation: 'headless' as const,
            sequence: multiattackOverride.sequence,
            sequenceAttackMode: multiattackOverride.sequenceAttackMode,
          }
        }
        if (
          savingThrowConditionAttack &&
          action.id === savingThrowConditionAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              onHitEffects: [
                ...(action.attack.onHitEffects ?? []),
                {
                  id: savingThrowConditionAttack.effectId,
                  kind: 'saving-throw-condition' as const,
                  ability: savingThrowConditionAttack.ability,
                  dc: savingThrowConditionAttack.dc,
                  magical: 'magical' in savingThrowConditionAttack
                    ? savingThrowConditionAttack.magical
                    : undefined,
                  conditionOnFailedSave:
                    savingThrowConditionAttack.conditionOnFailedSave,
                  additionalConditionsOnFailedSave:
                    'additionalConditionsOnFailedSave' in savingThrowConditionAttack
                      ? savingThrowConditionAttack.additionalConditionsOnFailedSave
                      : undefined,
                },
              ],
            },
          }
        }
        if (monster.slug === 'ankheg' && action.id === 'acid-spray') {
          return {
            ...action,
            relationRequirement: {
              kind: 'none-from-source' as const,
              slotGroup: 'bite',
            },
          }
        }
        if (
          damageOrGrappleAttack &&
          action.id === damageOrGrappleAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
          }
        }
        if (
          sourceLinkedConditionAttack &&
          action.id === sourceLinkedConditionAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              ...(monster.slug === 'behir'
                ? { targetMaxSizeRank: 3 }
                : monster.slug === 'kraken'
                  ? { toHit: 17 }
                  : {}),
              onHitEffects: [
                ...(action.attack.onHitEffects ?? []),
                {
                  id: sourceLinkedConditionAttack.effectId,
                  kind: 'source-linked-condition' as const,
                  relation: {
                    kind: 'grapple' as const,
                    slotGroup: sourceLinkedConditionAttack.slotGroup,
                    capacity: sourceLinkedConditionAttack.capacity,
                    maxDistanceFeet: sourceLinkedConditionAttack.maxDistanceFeet,
                    targetMaxSizeRank: sourceLinkedConditionAttack.targetMaxSizeRank,
                    whenCapacityFull: sourceLinkedConditionAttack.whenCapacityFull,
                    attackAdvantageAgainstLinkedTarget:
                      'attackAdvantageAgainstLinkedTarget' in sourceLinkedConditionAttack
                        ? sourceLinkedConditionAttack.attackAdvantageAgainstLinkedTarget
                        : undefined,
                    attackAutomaticallyHitsLinkedTarget:
                      'attackAutomaticallyHitsLinkedTarget' in sourceLinkedConditionAttack
                        ? sourceLinkedConditionAttack.attackAutomaticallyHitsLinkedTarget
                        : undefined,
                  },
                  escapeDc: sourceLinkedConditionAttack.escapeDc,
                  conditions: sourceLinkedConditionAttack.conditions,
                  modifiers:
                    'modifiers' in sourceLinkedConditionAttack
                      ? sourceLinkedConditionAttack.modifiers
                      : undefined,
                  periodicDamage:
                    'periodicDamage' in sourceLinkedConditionAttack
                      ? sourceLinkedConditionAttack.periodicDamage
                      : undefined,
                },
              ],
            },
          }
        }
        if (
          forcedMovementAttack &&
          action.id === forcedMovementAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              onHitEffects: [
                ...(action.attack.onHitEffects ?? []),
                forcedMovementAttack.effect,
              ],
            },
          }
        }
        if (
          hitPointMaximumReductionAttack &&
          action.id === hitPointMaximumReductionAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            ...(
              (
                monster.slug === 'vampire-spawn' ||
                monster.slug === 'vampire-vampire'
              ) &&
              action.id === 'bite'
                ? {
                    targetEligibility:
                      VAMPIRE_BITE_TARGET_ELIGIBILITY,
                  }
                : {}
            ),
            attack: {
              ...action.attack,
              onHitEffects: [
                ...(action.attack.onHitEffects ?? []),
                {
                  id: hitPointMaximumReductionAttack.effectId,
                  kind: 'hit-point-maximum-reduction' as const,
                  damageBasis: hitPointMaximumReductionAttack.damageBasis,
                  savingThrow:
                    'savingThrow' in hitPointMaximumReductionAttack
                      ? hitPointMaximumReductionAttack.savingThrow
                      : undefined,
                  recovery: hitPointMaximumReductionAttack.recovery,
                  healSourceByAmount:
                    'healSourceByAmount' in hitPointMaximumReductionAttack
                      ? hitPointMaximumReductionAttack.healSourceByAmount
                      : undefined,
                },
              ],
            },
          }
        }
        if (
          persistentEffectAttack &&
          action.id === persistentEffectAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              onHitEffects: [
                ...(action.attack.onHitEffects ?? []),
                persistentEffectAttack.effect,
              ],
            },
          }
        }
        if (assassinPoisonWeaponAttack) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: assassinPoisonWeaponAttack,
          }
        }
        if (
          complexPoisonAttack &&
          action.id === complexPoisonAttack.actionId &&
          action.attack
        ) {
          const stableAtZero = 'stableAtZero' in complexPoisonAttack &&
            complexPoisonAttack.stableAtZero
          const conditionOnFailedSave = 'conditionOnFailedSave' in complexPoisonAttack
            ? complexPoisonAttack.conditionOnFailedSave
            : undefined
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              onHit: `DC ${complexPoisonAttack.dc} Constitution save; ` +
                `${complexPoisonAttack.damage.count}d${complexPoisonAttack.damage.sides} poison damage, ` +
                `${complexPoisonAttack.damageOnSuccessfulSave} on a success.`,
              onHitEffects: [{
                id: 'poison-save-damage',
                kind: 'saving-throw-damage' as const,
                ability: 'con' as const,
                dc: complexPoisonAttack.dc,
                damage: [complexPoisonAttack.damage],
                damageOnSuccessfulSave: complexPoisonAttack.damageOnSuccessfulSave,
                conditionOnFailedSave,
                onEffectDamageReducesTargetToZero: stableAtZero
                  ? {
                      stabilize: true as const,
                      conditions: [
                        { condition: 'poisoned' as const, durationRounds: 600 },
                        {
                          condition: 'paralyzed' as const,
                          durationRounds: 600,
                          dependsOnCondition: 'poisoned' as const,
                        },
                      ],
                    }
                  : undefined,
              }],
            },
          }
        }
        if (
          poisonSaveDamageAttack &&
          action.id === poisonSaveDamageAttack.actionId &&
          action.attack
        ) {
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              damage: action.attack.damage.filter((damage) => damage.type !== 'poison'),
              onHit: `DC ${poisonSaveDamageAttack.dc} Constitution save; ` +
                `${poisonSaveDamageAttack.damage.count}d${poisonSaveDamageAttack.damage.sides} ` +
                'poison damage, half on a success.',
              onHitEffects: [{
                id: 'poison-save-damage',
                kind: 'saving-throw-damage' as const,
                ability: 'con' as const,
                dc: poisonSaveDamageAttack.dc,
                damage: [poisonSaveDamageAttack.damage],
                damageOnSuccessfulSave: 'half' as const,
              }],
            },
          }
        }
        if (proneBiteDc != null && action.id === 'bite' && action.attack) {
          return {
            ...action,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              onHit: `DC ${proneBiteDc} Strength save; prone on a failure.`,
              onHitRule: {
                kind: 'saving-throw-condition' as const,
                ability: 'str' as const,
                dc: proneBiteDc,
                condition: 'prone' as const,
              },
            },
          }
        }
        if (proneAttackSave && action.id === proneAttackSave.actionId && action.attack) {
          return {
            ...action,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              targetMaxSizeRank:
                'targetMaxSizeRank' in proneAttackSave
                  ? proneAttackSave.targetMaxSizeRank
                  : action.attack.targetMaxSizeRank,
              onHit: `DC ${proneAttackSave.dc} Strength save; prone on a failure.`,
              onHitRule: {
                kind: 'saving-throw-condition' as const,
                ability: 'str' as const,
                dc: proneAttackSave.dc,
                condition: 'prone' as const,
              },
            },
          }
        }
        if (monster.slug === 'balor' && action.id === 'longsword' && action.attack) {
          return {
            ...action,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              criticalExtraDamage: [
                { average: 13, count: 3, sides: 8, bonus: 0, type: 'slashing' as const },
                { average: 13, count: 3, sides: 8, bonus: 0, type: 'lightning' as const },
              ],
            },
          }
        }
        if (monster.slug === 'pit-fiend' && action.id === 'mace' && action.attack) {
          return {
            ...action,
            automation: 'headless' as const,
            attack: {
              ...action.attack,
              damage: [
                ...action.attack.damage,
                { average: 21, count: 6, sides: 6, bonus: 0, type: 'fire' as const },
              ],
            },
          }
        }
        if (monster.slug === 'barbed-devil' && action.id === 'hurl-flame' && action.attack) {
          return { ...action, automation: 'headless' as const }
        }
        return action
      }),
      ...(monster.slug === 'will-o-wisp'
        ? [{
            id: 'consume-life',
            name: 'Consume Life',
            description:
              'Bonus action; the DM adjudicates the zero-hit-point target save, death, and healing.',
            kind: 'other' as const,
            economy: 'bonus-action' as const,
            automation: 'dm-adjudication' as const,
          }]
        : []),
      ...(damageOrGrappleAttack
        ? monster.actions.flatMap((source) => {
            if (
              source.id !== damageOrGrappleAttack.actionId ||
              !source.attack
            ) return []
            return [{
              ...source,
              id: damageOrGrappleAttack.grappleActionId,
              name: `${source.name} (Grapple)`,
              description:
                `Instead of dealing damage, this attack grapples its target ` +
                `(escape DC ${damageOrGrappleAttack.escapeDc}).`,
              kind: 'weapon-attack' as const,
              automation: 'headless' as const,
              attack: {
                ...source.attack,
                damage: [],
                onHitEffects: [{
                  id: damageOrGrappleAttack.effectId,
                  kind: 'source-linked-condition' as const,
                  relation: {
                    kind: 'grapple' as const,
                    slotGroup: damageOrGrappleAttack.slotGroup,
                    capacity: 2,
                    maxDistanceFeet: 5,
                    targetMaxSizeRank: 3,
                    whenCapacityFull: 'skip-application' as const,
                  },
                  escapeDc: damageOrGrappleAttack.escapeDc,
                  conditions: [{ condition: 'grappled' as const }],
                }],
              },
            }]
          })
        : []),
      ...weaponAttackVariants.flatMap((variant) => {
        const source = monster.actions.find((action) =>
          action.id === variant.sourceActionId)
        if (!source) return []
        return [{
          ...source,
          id: variant.id,
          name: `${source.name}${variant.nameSuffix}`,
          description: `${variant.branchNote}\n${source.description}`,
          kind: 'weapon-attack' as const,
          automation: 'headless' as const,
          attack: variant.attack,
        }]
      }),
      ...(multiattackOverride?.alternatives ?? []).map((alternative) => {
        const base = monster.actions.find((action) => action.id === 'multiattack')
        const child = monster.actions.find((action) => action.id === alternative.sequence[0])
        return {
          id: alternative.id,
          name: `${base?.name ?? 'Multiattack'}：${child?.name ?? alternative.sequence[0]} ×${alternative.sequence.length}`,
          description: base?.description ?? '',
          kind: 'multiattack' as const,
          automation: 'headless' as const,
          sequence: alternative.sequence,
          sequenceAttackMode: alternative.sequenceAttackMode,
        }
      }),
      ...multiattackCandidates.map((candidate) => {
        const base = monster.actions.find((action) => action.id === 'multiattack')
        const child = monster.actions.find((action) => action.id === candidate.sequence[0])
        return {
          id: candidate.id,
          name: `${base?.name ?? 'Multiattack'}: ${child?.name ?? candidate.sequence[0]}`,
          description: `A complete Headless choice from: ${base?.description ?? 'Multiattack'}`,
          kind: 'multiattack' as const,
          automation: 'headless' as const,
          sequence: candidate.sequence,
          sequenceAttackMode: candidate.sequenceAttackMode,
        }
      }),
      ...optionalSpecialMultiattacks.map(({ action, weaponSequence }) => ({
        id: `${action.id}-weapons-only`,
        name: `${action.name}: Weapons Only`,
        description:
          `The creature declines the optional special action and resolves only ` +
          `the weapon attacks from: ${action.description}`,
        kind: 'multiattack' as const,
        automation: 'headless' as const,
        sequence: weaponSequence,
        sequenceAttackMode: action.sequenceAttackMode,
      })),
    ],
    reactions: monster.reactions?.map((reaction) => {
      if (monster.slug === 'chain-devil' && reaction.id === 'unnerving-mask') {
        return {
          ...reaction,
          automation: 'headless' as const,
          rule: {
            kind: 'turn-start-saving-throw-reaction' as const,
            rangeFeet: 30,
            ability: 'wis' as const,
            dc: 14,
            condition: 'frightened' as const,
            duration: 'until-target-turn-end' as const,
            magical: true as const,
            requiresMutualVisualSight: true as const,
          },
        }
      }
      const armorClassBonus = CATALOG_PARRY_ARMOR_CLASS_BONUSES[
        monster.slug as keyof typeof CATALOG_PARRY_ARMOR_CLASS_BONUSES
      ]
      if (armorClassBonus == null || reaction.id !== 'parry') return reaction
      return {
        ...reaction,
        automation: 'headless' as const,
        rule: {
          kind: 'parry' as const,
          armorClassBonus,
          requiresSight: true as const,
          requiresWieldedMeleeWeapon: true as const,
        },
      }
    }),
    legendaryActions: monster.legendaryActions?.map((action) => {
      const structuredRule = structuredLegendarySpecialActions[
        action.id as keyof typeof structuredLegendarySpecialActions
      ] as Dnd5eMonsterSpecialActionRule | undefined
      if (structuredRule) {
        return {
          ...action,
          kind: 'other' as const,
          automation: 'headless' as const,
          rule: structuredRule,
        }
      }
      if (
        selfTeleport?.section === 'legendary' &&
        action.id === selfTeleport.actionId
      ) {
        return {
          ...action,
          kind: 'other' as const,
          automation: 'headless' as const,
          rule: {
            kind: 'teleport' as const,
            target: 'self' as const,
            rangeFeet: selfTeleport.rangeFeet,
            requiresVisibleDestination: true as const,
            requiresUnoccupiedDestination: true as const,
          },
        }
      }
      const reference = legendaryActionReferences.find((candidate) =>
        candidate.legacyActionId === action.id)
      if (!reference) return action
      return {
        ...action,
        id: reference.actionId,
        referencedActionId: reference.referencedActionId,
        automation: reference.automation,
      }
    }),
  }
}

function applyCatalogMonsterTraitRules(
  monster: Dnd5eMonsterStatBlock,
): Dnd5eMonsterStatBlock {
  const traits = monster.traits.map((trait, traitIndex) => {
    if (monster.slug === 'flesh-golem') {
      if (traitIndex === 0) {
        return {
          ...trait,
          automation: 'headless' as const,
          rule: {
            kind: 'berserk' as const,
            hitPointThreshold: 40,
            dieSides: 6,
            minimum: 6,
            target: 'nearest-visible-creature' as const,
            endsWhenFullyHealed: true as const,
          },
        }
      }
      if (traitIndex === 1) {
        return {
          ...trait,
          automation: 'headless' as const,
          rule: {
            kind: 'damage-aversion' as const,
            damageType: 'fire' as const,
            attackRollMode: 'disadvantage' as const,
            abilityCheckRollMode: 'disadvantage' as const,
            duration: 'until-end-of-next-turn' as const,
          },
        }
      }
      if (traitIndex === 2) {
        return {
          ...trait,
          automation: 'headless' as const,
          rule: {
            kind: 'immutable-form' as const,
            immuneToFormAlteringEffects: true as const,
          },
        }
      }
      if (traitIndex === 3) {
        return {
          ...trait,
          automation: 'headless' as const,
          rule: {
            kind: 'damage-absorption' as const,
            damageType: 'lightning' as const,
            healing: 'damage-taken' as const,
          },
        }
      }
    }
    const flybyTraitIndex = CATALOG_FLYBY_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_FLYBY_TRAIT_INDEX
    ]
    if (flybyTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'flyby' as const,
          movementMode: 'fly' as const,
          provokesOpportunityAttacks: false as const,
        },
      }
    }
    if (
      monster.legendaryResistanceUses != null &&
      /legendary resistance|传奇抗性/i.test(trait.name.trim())
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'legendary-resistance' as const,
          maximumUses: monster.legendaryResistanceUses,
        },
      }
    }
    const assassinateTraitIndex = CATALOG_ASSASSINATE_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_ASSASSINATE_TRAIT_INDEX
    ]
    if (assassinateTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'assassinate' as const,
          requiredRound: 1 as const,
          advantageAgainst: 'target-not-yet-acted' as const,
          automaticCriticalAgainst: 'currently-surprised' as const,
        },
      }
    }
    const sneakAttack = CATALOG_SNEAK_ATTACK_TRAITS[
      monster.slug as keyof typeof CATALOG_SNEAK_ATTACK_TRAITS
    ]
    if (sneakAttack?.traitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'sneak-attack' as const,
          oncePerTurn: true as const,
          allyDistanceFeet: 5,
          requireNoDisadvantage: true as const,
          advantageOrAdjacentAlly: true as const,
          extraDamage: sneakAttack.extraDamage,
        },
      }
    }
    const martialAdvantageTraitIndex = CATALOG_MARTIAL_ADVANTAGE_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_MARTIAL_ADVANTAGE_TRAIT_INDEX
    ]
    if (martialAdvantageTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'martial-advantage' as const,
          oncePerTurn: true as const,
          allyDistanceFeet: 5,
          requiresAdjacentAlly: true as const,
          extraDamage: {
            average: 7,
            count: 2,
            sides: 6,
            bonus: 0,
            type: 'inherit-primary' as const,
          },
        },
      }
    }
    const deathArea = CATALOG_DEATH_AREA_TRAITS[
      monster.slug as keyof typeof CATALOG_DEATH_AREA_TRAITS
    ]
    if (
      deathArea &&
      /^(?:Death Burst|Death Throes|死亡爆发|死亡挣扎|临死爆发|死亡爆裂)$/i.test(
        trait.name.trim(),
      )
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'death-area-saving-throw' as const,
          ruleId: deathArea.ruleId,
          area: {
            shape: 'circle' as const,
            origin: 'self' as const,
            radiusFeet: deathArea.radiusFeet,
          },
          target: 'all-creatures-except-self' as const,
          ability: deathArea.ability,
          dc: deathArea.dc,
          ...('damage' in deathArea ? { damage: deathArea.damage } : {}),
          ...('damageOnSuccessfulSave' in deathArea
            ? { damageOnSuccessfulSave: deathArea.damageOnSuccessfulSave }
            : {}),
          ...('conditionOnFailedSave' in deathArea
            ? { conditionOnFailedSave: deathArea.conditionOnFailedSave }
            : {}),
        },
      }
    }
    const bloodFrenzyTraitIndex = CATALOG_BLOOD_FRENZY_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_BLOOD_FRENZY_TRAIT_INDEX
    ]
    if (bloodFrenzyTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'blood-frenzy' as const,
          attackMode: 'melee' as const,
          targetHitPoints: 'below-maximum' as const,
        },
      }
    }
    const surpriseAttack = CATALOG_SURPRISE_ATTACK_TRAITS[
      monster.slug as keyof typeof CATALOG_SURPRISE_ATTACK_TRAITS
    ]
    if (surpriseAttack?.traitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'surprise-attack' as const,
          requiredRound: 1 as const,
          targetState: 'currently-surprised' as const,
          applyOn: 'each-qualifying-hit' as const,
          extraDamage: surpriseAttack.extraDamage,
        },
      }
    }
    const ambusherAttackTraitIndex = CATALOG_AMBUSHER_ATTACK_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_AMBUSHER_ATTACK_TRAIT_INDEX
    ]
    if (ambusherAttackTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'ambusher-attack-advantage' as const,
          requiredRound: 1 as const,
          targetState: 'currently-surprised' as const,
        },
      }
    }
    const recklessTraitIndex = CATALOG_RECKLESS_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_RECKLESS_TRAIT_INDEX
    ]
    if (recklessTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'reckless' as const,
          activation: 'turn-start-tactical-default' as const,
          outgoing: {
            delivery: 'weapon-attack' as const,
            mode: 'melee' as const,
            rollMode: 'advantage' as const,
            duration: 'current-turn' as const,
          },
          incoming: {
            rollMode: 'advantage' as const,
            duration: 'until-source-turn-start' as const,
          },
        },
      }
    }
    const reactiveTraitIndex = CATALOG_REACTIVE_TRAIT_INDEX[
      monster.slug as keyof typeof CATALOG_REACTIVE_TRAIT_INDEX
    ]
    if (reactiveTraitIndex === traitIndex) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'reactive' as const,
          reactionRefresh: 'every-turn-start' as const,
        },
      }
    }
    const relentlessMaximumDamage = CATALOG_RELENTLESS_DAMAGE_THRESHOLDS[
      monster.slug as keyof typeof CATALOG_RELENTLESS_DAMAGE_THRESHOLDS
    ]
    if (
      relentlessMaximumDamage != null &&
      /^(?:Relentless|坚韧不屈|鍧氶煣涓嶅眻)$/i.test(trait.name.trim())
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'relentless' as const,
          maximumDamage: relentlessMaximumDamage,
        },
      }
    }
    if (
      (monster.slug === 'basilisk' || monster.slug === 'medusa') &&
      /^(?:Petrifying Gaze|石化凝视)$/i.test(trait.name.trim())
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'turn-start-gaze' as const,
          ruleId: 'petrifying-gaze',
          rangeFeet: 30,
          ability: 'con' as const,
          dc: monster.slug === 'medusa' ? 14 : 12,
          magical: true as const,
          allowAvertEyes: true as const,
          requiresMutualVisualSight: true as const,
          initialCondition: 'restrained' as const,
          failureCondition: 'petrified' as const,
          ...(monster.slug === 'medusa' ? { immediateFailureMargin: 5 } : {}),
        },
      }
    }
    if (
      CATALOG_MAGICAL_WEAPON_TRAIT_MONSTERS.has(monster.slug) &&
      /^(?:Magic Weapons|Angelic Weapons|Hellish Weapons|魔法武器|天使武器|地狱武器|炼狱武器)$/i.test(trait.name.trim())
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'magic-weapons' as const,
          weaponAttacksMagical: true as const,
        },
      }
    }
    if (
      monster.slug === 'ogre-zombie' &&
      /^(?:Undead Fortitude|亡灵坚韧)$/i.test(trait.name.trim())
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'undead-fortitude' as const,
          dcBase: 5,
          excludedDamageTypes: ['radiant'] as const,
          excludedOnCritical: true,
        },
      }
    }
    if (
      monster.slug === 'rakshasa' &&
      /^(?:Limited Magic Immunity|有限魔法免疫)$/i.test(trait.name.trim())
    ) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'limited-magic-immunity' as const,
          maximumSpellLevel: 6 as const,
          advantageAboveMaximum: true as const,
          allowsWilling: true as const,
        },
      }
    }
    if (/^(?:Magic Resistance|魔法抗性)$/i.test(trait.name.trim())) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'magic-resistance' as const,
          savingThrowAdvantageAgainstMagic: true as const,
        },
      }
    }
    if (/^(?:Pack Tactics|集群战术)$/i.test(trait.name.trim())) {
      return {
        ...trait,
        automation: 'headless' as const,
        rule: {
          kind: 'pack-tactics' as const,
          allyDistanceFeet: 5,
          requiresAllyNotIncapacitated: true as const,
        },
      }
    }
    return trait
  })
  return { ...monster, traits }
}

export const DND5E_SRD_MONSTERS: readonly Dnd5eMonsterStatBlock[] =
  DND5E_SRD_MONSTER_CATALOG_METADATA.monsters.map((monster) => {
    const translation = REVIEWED_MONSTER_TRANSLATIONS[monster.slug]
    return applyCatalogMonsterTraitRules(
      applyCatalogMonsterActionRules(
        applyCoreMonsterMechanicalRules(
          translation ? applyReviewedMonsterTranslation(monster, translation) : monster,
        ),
      ),
    )
  })

const MONSTERS_BY_ID = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.id, monster]))
const MONSTERS_BY_SLUG = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.slug, monster]))

export function getDnd5eSrdMonster(id: string): Dnd5eMonsterStatBlock | undefined {
  return getDnd5eRoomMonster(id) ?? MONSTERS_BY_ID.get(id)
}

export function getDnd5eSrdMonsterBySlug(slug: string): Dnd5eMonsterStatBlock | undefined {
  return MONSTERS_BY_SLUG.get(slug)
}

export function searchDnd5eSrdMonsters(query: string): readonly Dnd5eMonsterStatBlock[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return DND5E_SRD_MONSTERS
  return DND5E_SRD_MONSTERS.filter((monster) => [
    monster.name,
    monster.englishName,
    monster.creatureType,
    monster.alignment,
    monster.challenge.rating,
    ...monster.subtypes ?? [],
  ].some((value) => value.toLowerCase().includes(normalized)))
}

export function dnd5eMonsterProficiencyBonus(challengeRating: string): number {
  const rating = challengeRating.includes('/')
    ? Number(challengeRating.split('/')[0]) / Number(challengeRating.split('/')[1])
    : Number(challengeRating)
  if (!Number.isFinite(rating) || rating <= 4) return 2
  if (rating <= 8) return 3
  if (rating <= 12) return 4
  if (rating <= 16) return 5
  if (rating <= 20) return 6
  if (rating <= 24) return 7
  if (rating <= 28) return 8
  return 9
}

/**
 * Returns the actual ability behind a monster weapon attack without equating
 * "melee" with Strength. Legacy SRD rows omit this field, so compare both the
 * attack and primary-damage modifiers against STR/DEX plus proficiency. Ties
 * remain unknown rather than imposing an incorrect ability-specific effect.
 */
export function dnd5eMonsterWeaponAttackAbility(
  monster: Pick<Dnd5eMonsterStatBlock, 'abilities' | 'challenge'>,
  attack: Pick<Dnd5eMonsterWeaponAttack, 'attackAbility' | 'mode' | 'toHit' | 'damage'>,
): 'str' | 'dex' | undefined {
  if (attack.attackAbility) return attack.attackAbility
  const proficiency = dnd5eMonsterProficiencyBonus(monster.challenge.rating)
  const primaryDamageBonus = attack.damage[0]?.bonus
  const candidates = (['str', 'dex'] as const).map((ability) => {
    const modifier = Math.floor((monster.abilities[ability] - 10) / 2)
    const attackDelta = attack.toHit - proficiency - modifier
    const damageDelta = primaryDamageBonus == null ? undefined : primaryDamageBonus - modifier
    return {
      ability,
      attackExact: attackDelta === 0,
      damageExact: damageDelta === 0,
      sharedDelta: damageDelta != null && attackDelta === damageDelta,
    }
  })
  const exact = candidates.filter((candidate) =>
    candidate.attackExact && (primaryDamageBonus == null || candidate.damageExact))
  if (exact.length === 1) return exact[0]!.ability
  const partialExact = candidates.filter((candidate) =>
    candidate.attackExact || candidate.damageExact)
  if (partialExact.length === 1) return partialExact[0]!.ability
  const consistent = candidates.filter((candidate) => candidate.sharedDelta)
  return consistent.length === 1 ? consistent[0]!.ability : undefined
}

/** The map pathfinder distinguishes ground, climb, and swim terrain. */
export function dnd5eMonsterMapSpeed(monster: Dnd5eMonsterStatBlock): number {
  return Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.swim ?? 0, monster.speed.climb ?? 0)
}

export function dnd5eMonsterSpeedText(monster: Dnd5eMonsterStatBlock): string {
  const values = [`${monster.speed.walk} 尺`]
  if (monster.speed.fly != null) values.push(`飞行 ${monster.speed.fly} 尺${monster.speed.hover ? '（悬浮）' : ''}`)
  if (monster.speed.swim != null) values.push(`游泳 ${monster.speed.swim} 尺`)
  if (monster.speed.climb != null) values.push(`攀爬 ${monster.speed.climb} 尺`)
  if (monster.speed.burrow != null) values.push(`掘穴 ${monster.speed.burrow} 尺`)
  return values.join('，')
}

export function dnd5eMonsterDamageDice(value: Dnd5eMonsterDamage): string {
  if (value.bonus === 0) return `${value.count}d${value.sides}`
  return `${value.count}d${value.sides}${value.bonus > 0 ? '+' : ''}${value.bonus}`
}
