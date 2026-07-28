import type { AbilityKey } from '../../lib/dnd'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import generatedSrdMonsterCatalog from './generated/srdMonsters.generated.json'
import reviewedMonsterTranslations from './generated/srdMonsterTranslationsZh.reviewed.generated.json'
import { getDnd5eRoomMonster } from './roomMonsterCatalog'
import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eStandardConditionId } from './conditions'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
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
}

export type Dnd5eMonsterOnHitEffect = Dnd5eMonsterSavingThrowDamageOnHitEffect

export interface Dnd5eMonsterWeaponAttack {
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  toHit: number
  reachFeet?: number
  rangeFeet?: { normal: number; long: number }
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
  target: 'hostile'
  ability: AbilityKey
  dc: number
  /** Omit for pure control effects such as Frightful Presence. */
  damage?: Dnd5eMonsterDamage
  damageOnSuccessfulSave?: 'none' | 'half'
  conditionOnFailedSave?: {
    condition: Dnd5eStandardConditionId
    durationRounds: number
    repeatSaveAtEndOfTargetTurn: boolean
    breakOnDamage?: boolean
  }
  /** Source-specific immunity granted after this Frightful Presence save. */
  frightfulPresenceImmunityRounds?: number
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

const ADULT_DRAGON_SINGLE_BREATH_RULES = {
  'adult-black-dragon': {
    actionId: 'acid-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 5, aimRangeFeet: 60 },
      target: 'hostile', ability: 'dex', dc: 18,
      damage: { average: 54, count: 12, sides: 8, bonus: 0, type: 'acid' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-blue-dragon': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 90, widthFeet: 5, aimRangeFeet: 90 },
      target: 'hostile', ability: 'dex', dc: 19,
      damage: { average: 66, count: 12, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-green-dragon': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
      target: 'hostile', ability: 'con', dc: 18,
      damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-red-dragon': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
      target: 'hostile', ability: 'dex', dc: 21,
      damage: { average: 63, count: 18, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'adult-white-dragon': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
      target: 'hostile', ability: 'con', dc: 19,
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
        target: 'hostile', ability: 'dex', dc: 18,
        damage: { average: 45, count: 13, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'hostile', ability: 'con', dc: 18,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 100,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'adult-silver-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'hostile', ability: 'con', dc: 20,
        damage: { average: 58, count: 13, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'hostile', ability: 'con', dc: 20,
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
      target: 'hostile', ability: 'dex', dc: 22,
      damage: { average: 67, count: 15, sides: 8, bonus: 0, type: 'acid' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-blue-dragon': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 120, widthFeet: 10, aimRangeFeet: 120 },
      target: 'hostile', ability: 'dex', dc: 23,
      damage: { average: 88, count: 16, sides: 10, bonus: 0, type: 'lightning' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-green-dragon': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
      target: 'hostile', ability: 'con', dc: 22,
      damage: { average: 77, count: 22, sides: 6, bonus: 0, type: 'poison' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-red-dragon': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
      target: 'hostile', ability: 'dex', dc: 24,
      damage: { average: 91, count: 26, sides: 6, bonus: 0, type: 'fire' }, damageOnSuccessfulSave: 'half',
    },
  },
  'ancient-white-dragon': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
      target: 'hostile', ability: 'con', dc: 22,
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
        target: 'hostile', ability: 'dex', dc: 21,
        damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
        target: 'hostile', ability: 'con', dc: 21,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 100,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'ancient-silver-dragon': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
        target: 'hostile', ability: 'con', dc: 24,
        damage: { average: 67, count: 15, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 90, aimRangeFeet: 90 },
        target: 'hostile', ability: 'con', dc: 24,
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
      target: 'hostile', ability: 'dex', dc: 10,
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
      target: 'hostile', ability: 'dex', dc: 11,
      damage: { average: 22, count: 5, sides: 8, bonus: 0, type: 'acid' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'blue-dragon-wyrmling': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 30, widthFeet: 5, aimRangeFeet: 30 },
      target: 'hostile', ability: 'dex', dc: 12,
      damage: { average: 22, count: 4, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  behir: {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 20, widthFeet: 5, aimRangeFeet: 20 },
      target: 'hostile', ability: 'dex', dc: 16,
      damage: { average: 66, count: 12, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'green-dragon-wyrmling': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'con', dc: 11,
      damage: { average: 21, count: 6, sides: 6, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'half-red-dragon-veteran': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'dex', dc: 15,
      damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'hell-hound': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'dex', dc: 12,
      damage: { average: 21, count: 6, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'ice-mephit': {
    actionId: 'frost-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'dex', dc: 10,
      damage: { average: 5, count: 2, sides: 4, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'iron-golem': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'con', dc: 19,
      damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'magma-mephit': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'dex', dc: 11,
      damage: { average: 7, count: 2, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'red-dragon-wyrmling': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'dex', dc: 13,
      damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'white-dragon-wyrmling': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'con', dc: 12,
      damage: { average: 22, count: 5, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'winter-wolf': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      target: 'hostile', ability: 'dex', dc: 12,
      damage: { average: 18, count: 4, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-black-dragon': {
    actionId: 'acid-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 30, widthFeet: 5, aimRangeFeet: 30 },
      target: 'hostile', ability: 'dex', dc: 14,
      damage: { average: 49, count: 11, sides: 8, bonus: 0, type: 'acid' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-blue-dragon': {
    actionId: 'lightning-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 5, aimRangeFeet: 60 },
      target: 'hostile', ability: 'dex', dc: 16,
      damage: { average: 55, count: 10, sides: 10, bonus: 0, type: 'lightning' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-green-dragon': {
    actionId: 'poison-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'hostile', ability: 'con', dc: 14,
      damage: { average: 42, count: 12, sides: 6, bonus: 0, type: 'poison' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-red-dragon': {
    actionId: 'fire-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'hostile', ability: 'dex', dc: 17,
      damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'fire' },
      damageOnSuccessfulSave: 'half',
    },
  },
  'young-white-dragon': {
    actionId: 'cold-breath',
    rule: {
      kind: 'area-saving-throw',
      area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
      target: 'hostile', ability: 'con', dc: 15,
      damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'cold' },
      damageOnSuccessfulSave: 'half',
    },
  },
} as const

const CORE_MULTI_AREA_ACTION_RULES = {
  'brass-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'fire-breath',
        name: '火焰吐息',
        area: { shape: 'line', origin: 'self', lengthFeet: 20, widthFeet: 5, aimRangeFeet: 20 },
        target: 'hostile', ability: 'dex', dc: 11,
        damage: { average: 14, count: 4, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'hostile', ability: 'con', dc: 11,
        conditionOnFailedSave: {
          condition: 'unconscious',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: false,
          breakOnDamage: true,
        },
      },
    ],
  },
  'silver-dragon-wyrmling': {
    actionId: 'breath-weapons',
    variants: [
      {
        id: 'cold-breath',
        name: '寒冷吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'hostile', ability: 'con', dc: 13,
        damage: { average: 18, count: 4, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'hostile', ability: 'con', dc: 13,
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
        target: 'hostile', ability: 'dex', dc: 14,
        damage: { average: 42, count: 12, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'sleep-breath',
        name: '睡眠吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
        target: 'hostile', ability: 'con', dc: 14,
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
        target: 'hostile', ability: 'con', dc: 17,
        damage: { average: 54, count: 12, sides: 8, bonus: 0, type: 'cold' },
        damageOnSuccessfulSave: 'half',
      },
      {
        id: 'paralyzing-breath',
        name: '麻痹吐息',
        area: { shape: 'cone', origin: 'self', lengthFeet: 30, aimRangeFeet: 30 },
        target: 'hostile', ability: 'con', dc: 17,
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
              target: 'hostile' as const,
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
          target: 'hostile',
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

const CATALOG_PRONE_BITE_DCS = {
  mastiff: 11,
  'winter-wolf': 14,
  worg: 13,
} as const

const CATALOG_PRONE_ATTACK_SAVES = {
  'stone-giant': { actionId: 'rock', dc: 17 },
  tarrasque: { actionId: 'tail', dc: 20 },
} as const

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
  const proneBiteDc = CATALOG_PRONE_BITE_DCS[
    monster.slug as keyof typeof CATALOG_PRONE_BITE_DCS
  ]
  const proneAttackSave = CATALOG_PRONE_ATTACK_SAVES[
    monster.slug as keyof typeof CATALOG_PRONE_ATTACK_SAVES
  ]
  const multiattackSequence =
    monster.slug === 'half-red-dragon-veteran' || monster.slug === 'veteran'
      ? ['longsword', 'longsword', 'shortsword'] as const
      : monster.slug === 'assassin'
        ? ['shortsword', 'shortsword'] as const
        : undefined

  return {
    ...monster,
    actions: monster.actions.map((action) => {
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
      if (multiattackSequence && action.id === 'multiattack') {
        return {
          ...action,
          kind: 'multiattack' as const,
          automation: 'headless' as const,
          sequence: multiattackSequence,
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
  }
}

function applyCatalogMonsterTraitRules(
  monster: Dnd5eMonsterStatBlock,
): Dnd5eMonsterStatBlock {
  const traits = monster.traits.map((trait) => {
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
