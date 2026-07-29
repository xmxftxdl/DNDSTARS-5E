import type { AbilityKey } from '../../lib/dnd'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import generatedSrdMonsterCatalog from './generated/srdMonsters.generated.json'
import reviewedMonsterTranslations from './generated/srdMonsterTranslationsZh.reviewed.generated.json'
import { getDnd5eRoomMonster } from './roomMonsterCatalog'
import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eStandardConditionId } from './conditions'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
import type { Dnd5eActiveEffectModifiers } from './activeEffects'
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
  damage: readonly Dnd5eMonsterDamage[]
  damageOnSuccessfulSave: 'none' | 'half'
  /** A condition applied by this same saving throw only when the save fails. */
  conditionOnFailedSave?: Dnd5eMonsterFailedSaveCondition
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
  conditionOnFailedSave: Dnd5eMonsterFailedSaveCondition
}

export interface Dnd5eMonsterSourceLinkedConditionOnHitEffect {
  id: string
  kind: 'source-linked-condition'
  relation: {
    kind: 'grapple'
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
    attackAdvantageAgainstLinkedTarget?: boolean
  }
  escapeDc: number
  conditions: readonly {
    condition: 'grappled' | 'restrained'
    /** Dependent conditions end together with their source-specific parent. */
    dependsOnCondition?: 'grappled' | 'restrained'
  }[]
}

export type Dnd5eMonsterOnHitEffect =
  | Dnd5eMonsterSavingThrowDamageOnHitEffect
  | Dnd5eMonsterSavingThrowConditionOnHitEffect
  | Dnd5eMonsterSourceLinkedConditionOnHitEffect

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
  ability: AbilityKey
  dc: number
  /** Omit for pure control effects such as Frightful Presence. */
  damage?: Dnd5eMonsterDamage
  damageOnSuccessfulSave?: 'none' | 'half'
  conditionOnFailedSave?: Dnd5eMonsterFailedSaveCondition
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
}

export interface Dnd5eMonsterFailedSaveCondition {
  condition: Dnd5eStandardConditionId
  durationRounds: number
  repeatSaveAtEndOfTargetTurn: boolean
  breakOnDamage?: boolean
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

export type Dnd5eMonsterSpecialActionRule =
  | {
      kind: 'ability-check'
      ability: AbilityKey
      skillKey?: string
    }
  | {
      kind: 'saving-throw-condition'
      rangeFeet: number
      ability: AbilityKey
      dc: number
      condition: Dnd5eStandardConditionId
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

export interface Dnd5eMonsterAction {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'multiattack' | 'other'
  automation?: Dnd5eMonsterAutomation
  attack?: Dnd5eMonsterWeaponAttack
  sequence?: readonly string[]
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
  relationRequirement?: {
    kind: 'none-from-source'
    slotGroup: string
  }
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
      legendaryActions: monster.legendaryActions?.map((action) => action.id === 'detect' ? {
        ...action,
        automation: 'headless',
        rule: { kind: 'ability-check', ability: 'wis', skillKey: 'perception' },
      } : action),
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
      legendaryActions: monster.legendaryActions?.map((action) => action.id === 'detect' ? {
        ...action,
        automation: 'headless',
        rule: { kind: 'ability-check', ability: 'wis', skillKey: 'perception' },
      } : action),
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
} as const satisfies Readonly<Record<string, {
  actionId: string
  effectId: string
  ability: AbilityKey
  dc: number
  conditionOnFailedSave: Dnd5eMonsterFailedSaveCondition
}>>

const CATALOG_PRONE_BITE_DCS = {
  mastiff: 11,
  'winter-wolf': 14,
  worg: 13,
} as const

const CATALOG_PRONE_ATTACK_SAVES = {
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
} as const satisfies Readonly<Record<string, {
  actionId: string
  effectId: string
  slotGroup: string
  capacity: number
  maxDistanceFeet: number
  targetMaxSizeRank: number
  whenCapacityFull: 'skip-application' | 'linked-target-only'
  attackAdvantageAgainstLinkedTarget?: boolean
  escapeDc: number
  conditions: readonly {
    condition: 'grappled' | 'restrained'
    dependsOnCondition?: 'grappled' | 'restrained'
  }[]
}>>

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
    traitIndex: 1,
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
  unicorn: {
    legacyActionId: 'hooves',
    actionId: 'legendary-hooves',
    referencedActionId: 'hooves',
  },
  'vampire-vampire': {
    legacyActionId: 'unarmed-strike',
    actionId: 'legendary-unarmed-strike',
    referencedActionId: 'unarmed-strike',
  },
} as const

interface Dnd5eCatalogMultiattackOverride {
  sequence: readonly string[]
  sequenceAttackMode?: 'melee' | 'ranged'
  alternatives?: readonly {
    id: string
    sequence: readonly string[]
    sequenceAttackMode?: 'melee' | 'ranged'
  }[]
}

/**
 * The SRD generator deliberately leaves prose containing "or"/"alternatively"
 * for DM adjudication. These reviewed overrides keep each legal sequence as a
 * separate stable action so the Host, tactical planner, and simulator can use
 * the existing atomic Multiattack transaction without guessing player intent.
 */
const CATALOG_MULTIATTACK_OVERRIDES: Readonly<Record<string, Dnd5eCatalogMultiattackOverride>> = {
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
}

function applyCatalogMonsterActionRules(
  monster: Dnd5eMonsterStatBlock,
): Dnd5eMonsterStatBlock {
  const fixedDamageAttack = CATALOG_FIXED_DAMAGE_ATTACKS[
    monster.slug as keyof typeof CATALOG_FIXED_DAMAGE_ATTACKS
  ]
  const baseWeaponAttack = CATALOG_BASE_WEAPON_ATTACKS[
    monster.slug as keyof typeof CATALOG_BASE_WEAPON_ATTACKS
  ]
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
  const legendaryActionReference = CATALOG_LEGENDARY_ACTION_REFERENCES[
    monster.slug as keyof typeof CATALOG_LEGENDARY_ACTION_REFERENCES
  ]
  const multiattackOverride = CATALOG_MULTIATTACK_OVERRIDES[monster.slug]

  return {
    ...monster,
    actions: [
      ...monster.actions.map((action) => {
        const assassinPoisonWeaponAttack = monster.slug === 'assassin' &&
          (action.id === 'shortsword' || action.id === 'light-crossbow')
          ? CATALOG_ASSASSIN_POISON_WEAPON_ATTACKS[action.id]
          : undefined
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
          return {
            ...action,
            kind: 'weapon-attack' as const,
            automation: 'headless' as const,
            attack: baseWeaponAttack.attack,
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
                  conditionOnFailedSave:
                    savingThrowConditionAttack.conditionOnFailedSave,
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
                  },
                  escapeDc: sourceLinkedConditionAttack.escapeDc,
                  conditions: sourceLinkedConditionAttack.conditions,
                },
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
    legendaryActions: monster.legendaryActions?.map((action) =>
      legendaryActionReference &&
      action.id === legendaryActionReference.legacyActionId
        ? {
            ...action,
            id: legendaryActionReference.actionId,
            referencedActionId: legendaryActionReference.referencedActionId,
          }
        : action),
  }
}

function applyCatalogMonsterTraitRules(
  monster: Dnd5eMonsterStatBlock,
): Dnd5eMonsterStatBlock {
  const traits = monster.traits.map((trait, traitIndex) => {
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
