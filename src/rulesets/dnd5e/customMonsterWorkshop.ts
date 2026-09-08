import { SKILLS, type AbilityKey } from '../../lib/dnd'
import {
  DND5E_DAMAGE_TYPES,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterMechanicEffectV2,
  type Dnd5eMonsterMechanicEffectTargetV2,
  type Dnd5eMonsterMechanicSubjectV2,
  type Dnd5eMonsterMechanicTrigger,
  type Dnd5eMonsterMechanicTriggerEventV2,
  type Dnd5eMonsterMechanicTriggerV2,
  type Dnd5eMonsterEquipment,
  type Dnd5eMonsterSize,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTargetPriority,
  type Dnd5eMonsterTrait,
  dnd5eMonsterProficiencyBonus,
} from './monsters'
import {
  evaluateDnd5eWorkshopDamageFormula,
  type Dnd5eWorkshopDamageFormulaV1,
} from './workshopDamageFormula'
import { DND5E_STANDARD_CONDITIONS, type Dnd5eStandardConditionId } from './conditions'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'
import type { Dnd5eTokenStatusMarkerGrantDeclaration } from './tokenStatusMarkers'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const DND5E_SKILL_LABEL_BY_KEY = new Map(SKILLS.map((skill) => [skill.key, skill.label]))
const ROOM_MONSTER_ID_PATTERN = /^room-monster:[a-z0-9][a-z0-9-]{0,95}$/

function normalizedCustomMonsterSlug(value: string): string {
  const normalized = value.toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
  return normalized || `custom-${uid()}`
}

export interface Dnd5eMonsterWorkshopTemplateSource {
  templateId: string
  monsterId: string
  monsterName: string
  section: 'trait' | 'action' | 'bonus-action' | 'reaction' | 'legendary' | 'lair'
}

export interface Dnd5eCustomMonsterTraitDraft {
  name: string
  description: string
  automation: 'headless' | 'dm-adjudication'
  ruleKind:
    | 'none'
    | 'undead-fortitude'
    | 'regeneration'
    | 'swarm'
    | 'nimble-escape'
    | 'keen-sense'
    | 'ambusher'
    | 'charge-damage'
    | 'relentless'
    | 'sneak-attack'
    | 'surprise-attack'
    | 'stench'
    | 'magic-resistance'
    | 'limited-magic-immunity'
    | 'magic-weapons'
    | 'pack-tactics'
    | 'conditional-target-bonus'
  amount: number
  dcBase: number
  damageTypes: Dnd5eDamageType[]
  requiresPositiveHp: boolean
  excludedOnCritical: boolean
  diesAtZeroWhenSuppressed: boolean
  keenSense: 'smell' | 'hearing' | 'sight'
  keenSenseSkillKey: string
  keenSenseCheckBonus: number
  keenSenseBlindsightFeet: number
  chargeMinimumFeet: number
  chargeActionId: string
  chargeDamageDice: string
  chargeDamageType: Dnd5eDamageType
  chargeSaveEnabled: boolean
  chargeSaveAbility: AbilityKey
  chargeSaveDc: number
  chargeSaveCondition: Dnd5eStandardConditionId
  relentlessMaximumDamage: number
  sneakAttackDamageDice: string
  surpriseAttackDamageDice: string
  stenchRangeFeet: number
  stenchSaveDc: number
  limitedMagicImmunityMaximumSpellLevel: number
  limitedMagicImmunityAdvantageAboveMaximum: boolean
  limitedMagicImmunityAllowsWilling: boolean
  targetBonusConditions: Dnd5eStandardConditionId[]
  targetAttackBonus: number
  targetDamageBonus: number
  /** Complete catalog rule retained when the basic form cannot express every field. */
  preservedTrait?: Dnd5eMonsterTrait
  templateSource?: Dnd5eMonsterWorkshopTemplateSource
}

export interface Dnd5eCustomMonsterActionDraft {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'area-saving-throw' | 'summon' | 'movement' | 'other'
  automation: 'headless' | 'dm-adjudication'
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  toHit: number
  reachFeet: number
  rangeNormal: number
  rangeLong: number
  damageDice: string
  damageModifierFormula?: Dnd5eWorkshopDamageFormulaV1
  damageType: Dnd5eDamageType
  additionalDamage: Array<{ id: string; dice: string; damageType: Dnd5eDamageType; modifierFormula?: Dnd5eWorkshopDamageFormulaV1 }>
  criticalThreshold: number
  criticalExtraDamage: Array<{ id: string; dice: string; damageType: Dnd5eDamageType }>
  onHitSaveEnabled: boolean
  onHitSaveAbility: AbilityKey
  onHitSaveDc: number
  onHitCondition: Dnd5eStandardConditionId | 'disease'
  attacksPerAction: number
  category: 'action' | 'bonus-action' | 'reaction' | 'legendary' | 'lair'
  usageKind: 'at-will' | 'per-day' | 'recharge'
  usageMax: number
  rechargeMinimum: number
  rechargeDieSides: number
  legendaryCost: number
  referencedActionId: string
  movementSpeedFraction: number
  reactionTriggerActionId: string
  areaShape: 'circle' | 'cone' | 'line'
  areaSizeFeet: number
  areaWidthFeet: number
  areaSaveAbility: AbilityKey
  /** Empty/omitted keeps a fixed save; 2+ entries let each target choose. */
  areaSaveAbilityChoices?: AbilityKey[]
  areaSaveDc: number
  areaDamageDice: string
  areaDamageModifierFormula?: Dnd5eWorkshopDamageFormulaV1
  /** 空字符串表示 AI／原文没有提供，必须由 DM 明确补齐。 */
  areaDamageType: Dnd5eDamageType | ''
  areaDamageOnSuccessfulSave: 'none' | 'half'
  areaTarget: 'hostile' | 'all-creatures-except-self'
  areaMagical: boolean
  summonMonsterId: string
  summonCountMode: 'fixed' | 'dice'
  summonCount: number
  summonCountDice: string
  summonDurationRounds: number
  summonTiming: 'immediate' | 'source-next-turn-start'
  summonConcentration: boolean
  summonConcentrationEndsOnAppearance: boolean
  summonSide: 'ally' | 'enemy'
  /** Complete catalog action retained when the basic form is only an editable projection. */
  preservedAction?: Dnd5eMonsterAction
  templateSource?: Dnd5eMonsterWorkshopTemplateSource
}

export interface Dnd5eCustomMonsterEquipmentDraft {
  id: string
  name: string
  category: Dnd5eMonsterEquipment['category']
  quantity: number
  description: string
  armorClass?: number
  linkedActionId: string
}

export interface Dnd5eCustomMonsterSkillDraft {
  id: string
  key: string
  name: string
  bonus: number
}

export interface Dnd5eCustomMonsterSenseDraft {
  id: string
  name: string
  distanceFeet?: number
}

export interface Dnd5eCustomMonsterSpellDraft {
  id: string
  name: string
  level: number
  usageKind: 'slots' | 'at-will' | 'per-day'
  usageMax: number
}

export interface Dnd5eCustomMonsterMechanicDraft {
  id: string
  name: string
  trigger: Dnd5eMonsterMechanicTriggerEventV2
  triggerSubject: Dnd5eMonsterMechanicSubjectV2
  triggerRadiusFeet: number
  movementComparison: 'at-least' | 'at-most'
  movementFeet: number
  triggerAttackMode: 'any' | 'melee' | 'ranged' | 'spell' | 'unarmed'
  triggerDamageTypes: Dnd5eDamageType[]
  savingThrowTiming: 'before' | 'after'
  savingThrowOutcome: 'any' | 'success' | 'failure'
  hpPercentageAtOrBelow?: number
  hpPercentageAtOrAbove?: number
  hpBelow?: number
  hpAtOrBelow?: number
  hpAbove?: number
  hpAtOrAbove?: number
  requiresPositiveHp: boolean
  effectKind:
    | 'healing'
    | 'temporary-hit-points'
    | 'damage'
    | 'damage-replacement'
    | 'standard-condition'
    | 'tactical-status'
    | 'remove-standard-condition'
    | 'summon'
    | 'area-attack'
    | 'roll-modifier'
    | 'attack'
    | 'action-grant'
    | 'equipment-modifier'
  effectTarget: Dnd5eMonsterMechanicEffectTargetV2
  healingDice: string
  damageType: Dnd5eDamageType | 'inherit-trigger'
  condition: Dnd5eStandardConditionId
  statusMarkerId: Dnd5eTokenStatusMarkerGrantDeclaration['statusId']
  durationKind: 'permanent' | 'until-target-turn-start' | 'until-source-turn-start' | 'rounds'
  durationRounds: number
  summonMonsterId: string
  summonCount: number
  summonDurationRounds: number
  areaShape: 'circle' | 'cone' | 'line'
  areaRangeFeet: number
  areaSizeFeet: number
  modifierRoll: 'attack' | 'damage' | 'saving-throw'
  modifierMode: 'bonus' | 'advantage' | 'disadvantage'
  modifierBonus: number
  attackMode: 'melee' | 'ranged'
  attackToHit: number
  attackEconomy: 'none' | 'reaction'
  attackDamageMode: 'dice' | 'fixed'
  attackFixedDamage: number
  damageReplacementOperation: 'negate' | 'halve' | 'reduce-by' | 'set-to' | 'convert-to-healing'
  damageReplacementAmount: number
  actionGrantResource: 'action' | 'bonus-action' | 'reaction'
  equipmentModifierEquipment: 'armor' | 'main-weapon'
  equipmentModifierOperation: 'armor-class-bonus' | 'magic-weapon-bonus'
  equipmentModifierBonus: number
  equipmentModifierEquipmentId: string
  limit: Dnd5eMonsterMechanicTrigger['limit']
  automation: 'full' | 'partial' | 'manual'
  /** 表单编辑首个效果；高级 JSON 中的其余效果必须无损保留。 */
  preservedEffects?: readonly Dnd5eMonsterMechanicEffectV2[]
}

export interface Dnd5eCustomMonsterDraft {
  /** 原始结构化数据；表单未覆盖的高级字段会在保存时原样透传。 */
  preservedStatBlock?: Dnd5eMonsterStatBlock
  /** Multiattacks selected from the ability library are stored outside the flat action editor. */
  preservedMultiattacks?: readonly Dnd5eMonsterAction[]
  id?: string
  slug?: string
  name: string
  englishName: string
  size: Dnd5eMonsterSize
  creatureType: string
  alignment: string
  armorClass: number
  armorClassNote: string
  hitPointsAverage: number
  hitPointsDice: string
  walk: number
  fly: number
  swim: number
  climb: number
  burrow: number
  hover: boolean
  abilities: Record<AbilityKey, number>
  savingThrows: Partial<Record<AbilityKey, number>>
  skills: Dnd5eCustomMonsterSkillDraft[]
  senses: Dnd5eCustomMonsterSenseDraft[]
  damageVulnerabilities: Dnd5eDamageType[]
  damageResistances: Dnd5eDamageType[]
  damageImmunities: Dnd5eDamageType[]
  /**
   * Advanced, source-aware defenses imported from a stat block.
   * The basic workshop does not infer or edit these rules from prose.
   */
  damageDefenseRules?: NonNullable<Dnd5eMonsterStatBlock['damageDefenseRules']>
  /** Canonical defense clauses that still require DM adjudication. */
  unparsedDamageDefenses?: NonNullable<Dnd5eMonsterStatBlock['unparsedDamageDefenses']>
  conditionImmunities: Dnd5eStandardConditionId[]
  tokenStatusMarkerGrants: Dnd5eTokenStatusMarkerGrantDeclaration[]
  passivePerception: number
  languages: string
  challengeRating: string
  xp: number
  description: string
  portrait?: string
  tokenPortrait?: string
  initiativePortrait?: string
  equipment: Dnd5eCustomMonsterEquipmentDraft[]
  legendaryResistanceUses: number
  legendaryActionPoints: number
  lairInitiative: number
  spellcastingEnabled: boolean
  spellcastingDescription: string
  spellcastingCasterLevel: number
  spellcastingAbility: AbilityKey
  spellcastingSaveDc: number
  spellcastingAttackBonus: number
  spellSlots: Record<string, number>
  spells: Dnd5eCustomMonsterSpellDraft[]
  spellcastingAutomation: 'headless' | 'dm-adjudication'
  targetingPriority: Dnd5eMonsterTargetPriority
  headlessMechanics: Dnd5eCustomMonsterMechanicDraft[]
  traits: Dnd5eCustomMonsterTraitDraft[]
  actions: Dnd5eCustomMonsterActionDraft[]
}

function uid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 16)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function createDnd5eCustomMonsterTraitDraft(): Dnd5eCustomMonsterTraitDraft {
  return {
    name: '',
    description: '',
    automation: 'dm-adjudication',
    ruleKind: 'none',
    amount: 10,
    dcBase: 5,
    damageTypes: [],
    requiresPositiveHp: true,
    excludedOnCritical: true,
    diesAtZeroWhenSuppressed: true,
    keenSense: 'smell',
    keenSenseSkillKey: 'perception',
    keenSenseCheckBonus: 4,
    keenSenseBlindsightFeet: 10,
    chargeMinimumFeet: 20,
    chargeActionId: '',
    chargeDamageDice: '2d10',
    chargeDamageType: 'piercing',
    chargeSaveEnabled: false,
    chargeSaveAbility: 'str',
    chargeSaveDc: 13,
    chargeSaveCondition: 'prone',
    relentlessMaximumDamage: 10,
    sneakAttackDamageDice: '2d6',
    surpriseAttackDamageDice: '2d6',
    stenchRangeFeet: 10,
    stenchSaveDc: 13,
    limitedMagicImmunityMaximumSpellLevel: 6,
    limitedMagicImmunityAdvantageAboveMaximum: true,
    limitedMagicImmunityAllowsWilling: true,
    targetBonusConditions: ['frightened', 'stunned'],
    targetAttackBonus: 2,
    targetDamageBonus: 2,
  }
}

export function createDnd5eCustomMonsterActionDraft(): Dnd5eCustomMonsterActionDraft {
  return {
    id: `attack-${uid().slice(0, 8)}`,
    name: '爪击',
    description: '',
    kind: 'weapon-attack',
    automation: 'headless',
    mode: 'melee',
    toHit: 3,
    reachFeet: 5,
    rangeNormal: 30,
    rangeLong: 120,
    damageDice: '1d6+1',
    damageType: 'slashing',
    additionalDamage: [],
    criticalThreshold: 20,
    criticalExtraDamage: [],
    onHitSaveEnabled: false,
    onHitSaveAbility: 'str',
    onHitSaveDc: 12,
    onHitCondition: 'prone',
    attacksPerAction: 1,
    category: 'action',
    usageKind: 'at-will',
    usageMax: 1,
    rechargeMinimum: 5,
    rechargeDieSides: 6,
    legendaryCost: 1,
    referencedActionId: '',
    movementSpeedFraction: 0.5,
    reactionTriggerActionId: '',
    areaShape: 'cone',
    areaSizeFeet: 15,
    areaWidthFeet: 5,
    areaSaveAbility: 'dex',
    areaSaveAbilityChoices: [],
    areaSaveDc: 12,
    areaDamageDice: '2d6',
    areaDamageType: '',
    areaDamageOnSuccessfulSave: 'half',
    areaTarget: 'all-creatures-except-self',
    areaMagical: false,
    summonMonsterId: '',
    summonCountMode: 'fixed',
    summonCount: 1,
    summonCountDice: '1d3',
    summonDurationRounds: 10,
    summonTiming: 'immediate',
    summonConcentration: false,
    summonConcentrationEndsOnAppearance: false,
    summonSide: 'ally',
  }
}

export function createDnd5eCustomMonsterMechanicDraft(): Dnd5eCustomMonsterMechanicDraft {
  return {
    id: `mechanic-${uid().slice(0, 8)}`,
    name: '低生命恢复',
    trigger: 'turn-start',
    triggerSubject: 'self',
    triggerRadiusFeet: 30,
    movementComparison: 'at-least',
    movementFeet: 20,
    triggerAttackMode: 'any',
    triggerDamageTypes: [],
    savingThrowTiming: 'before',
    savingThrowOutcome: 'any',
    hpPercentageAtOrBelow: 50,
    hpPercentageAtOrAbove: undefined,
    hpBelow: undefined,
    hpAtOrBelow: undefined,
    hpAbove: undefined,
    hpAtOrAbove: undefined,
    requiresPositiveHp: true,
    effectKind: 'healing',
    effectTarget: 'self',
    healingDice: '2d6',
    damageType: 'necrotic',
    condition: 'frightened',
    statusMarkerId: 'marked',
    durationKind: 'rounds',
    durationRounds: 1,
    summonMonsterId: 'srd-5.1:wolf',
    summonCount: 1,
    summonDurationRounds: 10,
    areaShape: 'circle',
    areaRangeFeet: 60,
    areaSizeFeet: 15,
    modifierRoll: 'attack',
    modifierMode: 'bonus',
    modifierBonus: 2,
    attackMode: 'melee',
    attackToHit: 5,
    attackEconomy: 'reaction',
    attackDamageMode: 'dice',
    attackFixedDamage: 8,
    damageReplacementOperation: 'negate',
    damageReplacementAmount: 0,
    actionGrantResource: 'action',
    equipmentModifierEquipment: 'armor',
    equipmentModifierOperation: 'armor-class-bonus',
    equipmentModifierBonus: 1,
    equipmentModifierEquipmentId: '',
    limit: 'once-per-combat',
    automation: 'full',
  }
}

export function createDnd5eCustomMonsterDraft(): Dnd5eCustomMonsterDraft {
  return {
    name: '自定义怪物',
    englishName: 'Custom Monster',
    size: '中型',
    creatureType: '怪兽',
    alignment: '无阵营',
    armorClass: 12,
    armorClassNote: '',
    hitPointsAverage: 11,
    hitPointsDice: '2d8+2',
    walk: 30,
    fly: 0,
    swim: 0,
    climb: 0,
    burrow: 0,
    hover: false,
    abilities: { str: 12, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
    savingThrows: {},
    skills: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    tokenStatusMarkerGrants: [],
    passivePerception: 10,
    languages: '',
    challengeRating: '1/4',
    xp: 50,
    description: '由 DM 创建的房间怪物。',
    portrait: undefined,
    tokenPortrait: undefined,
    initiativePortrait: undefined,
    equipment: [],
    legendaryResistanceUses: 0,
    legendaryActionPoints: 3,
    lairInitiative: 20,
    spellcastingEnabled: false,
    spellcastingDescription: '',
    spellcastingCasterLevel: 1,
    spellcastingAbility: 'int',
    spellcastingSaveDc: 11,
    spellcastingAttackBonus: 3,
    spellSlots: {},
    spells: [],
    spellcastingAutomation: 'dm-adjudication',
    targetingPriority: 'nearest',
    headlessMechanics: [],
    traits: [],
    actions: [createDnd5eCustomMonsterActionDraft()],
  }
}

/**
 * Local workshop drafts predate several structured combat fields. Treat local
 * storage as untrusted versioned input and hydrate every collection before a
 * component or compiler is allowed to call array helpers on it.
 */
export function restoreDnd5eCustomMonsterDraft(
  value: Partial<Dnd5eCustomMonsterDraft> | null | undefined,
): Dnd5eCustomMonsterDraft {
  const fallback = createDnd5eCustomMonsterDraft()
  const source = value && typeof value === 'object' ? value : {}
  return {
    ...fallback,
    ...source,
    abilities: source.abilities && typeof source.abilities === 'object'
      ? { ...fallback.abilities, ...source.abilities }
      : fallback.abilities,
    savingThrows: source.savingThrows && typeof source.savingThrows === 'object'
      ? { ...source.savingThrows }
      : {},
    skills: Array.isArray(source.skills) ? source.skills.map((entry) => ({ ...entry })) : [],
    senses: Array.isArray(source.senses) ? source.senses.map((entry) => ({ ...entry })) : [],
    damageVulnerabilities: Array.isArray(source.damageVulnerabilities)
      ? [...source.damageVulnerabilities]
      : [],
    damageResistances: Array.isArray(source.damageResistances)
      ? [...source.damageResistances]
      : [],
    damageImmunities: Array.isArray(source.damageImmunities)
      ? [...source.damageImmunities]
      : [],
    conditionImmunities: Array.isArray(source.conditionImmunities)
      ? [...source.conditionImmunities]
      : [],
    tokenStatusMarkerGrants: Array.isArray(source.tokenStatusMarkerGrants)
      ? source.tokenStatusMarkerGrants.map((entry) => ({
          ...entry,
          application: entry.application ?? 'marker',
        }))
      : [],
    equipment: Array.isArray(source.equipment)
      ? source.equipment.map((entry) => ({ ...entry }))
      : [],
    spellSlots: source.spellSlots && typeof source.spellSlots === 'object'
      ? { ...source.spellSlots }
      : {},
    spells: Array.isArray(source.spells) ? source.spells.map((entry) => ({ ...entry })) : [],
    headlessMechanics: Array.isArray(source.headlessMechanics)
      ? source.headlessMechanics.map((entry) => ({
          ...createDnd5eCustomMonsterMechanicDraft(),
          ...entry,
          triggerDamageTypes: Array.isArray(entry.triggerDamageTypes)
            ? [...entry.triggerDamageTypes]
            : [],
          preservedEffects: Array.isArray(entry.preservedEffects)
            ? entry.preservedEffects.map((effect) => ({ ...effect }))
            : undefined,
        }))
      : [],
    traits: Array.isArray(source.traits)
      ? source.traits.map((entry) => ({
          ...createDnd5eCustomMonsterTraitDraft(),
          ...entry,
          damageTypes: Array.isArray(entry.damageTypes) ? [...entry.damageTypes] : [],
          targetBonusConditions: Array.isArray(entry.targetBonusConditions)
            ? [...entry.targetBonusConditions]
            : [],
        }))
      : [],
    actions: Array.isArray(source.actions)
      ? source.actions.map((entry) => ({
          ...createDnd5eCustomMonsterActionDraft(),
          ...entry,
          additionalDamage: Array.isArray(entry.additionalDamage)
            ? entry.additionalDamage.map((damage) => ({ ...damage }))
            : [],
          criticalExtraDamage: Array.isArray(entry.criticalExtraDamage)
            ? entry.criticalExtraDamage.map((damage) => ({ ...damage }))
            : [],
          areaSaveAbilityChoices: Array.isArray(entry.areaSaveAbilityChoices)
            ? [...entry.areaSaveAbilityChoices]
            : [],
        }))
      : [createDnd5eCustomMonsterActionDraft()],
  }
}

function parseDice(value: string): { count: number; sides: number; bonus: number } {
  const match = value.replace(/\s+/g, '').match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i)
  if (!match) throw new Error(`伤害骰格式无效：${value}`)
  const count = Number(match[1])
  const sides = Number(match[2])
  const bonus = match[3] ? Number(`${match[3]}${match[4]}`) : 0
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(sides) || sides < 2) throw new Error(`伤害骰格式无效：${value}`)
  return { count, sides, bonus }
}

const AREA_ACTION_DAMAGE_TYPE_PATTERNS: readonly [RegExp, Dnd5eDamageType][] = [
  [/强酸|酸蚀|acid/i, 'acid'],
  [/钝击|bludgeoning/i, 'bludgeoning'],
  [/寒冷|冰冷|cold/i, 'cold'],
  [/火焰|fire/i, 'fire'],
  [/力场|force/i, 'force'],
  [/闪电|雷电|lightning/i, 'lightning'],
  [/黯蚀|死灵|necrotic/i, 'necrotic'],
  [/穿刺|piercing/i, 'piercing'],
  [/毒素|毒液|poison/i, 'poison'],
  [/心灵|psychic/i, 'psychic'],
  [/光耀|radiant/i, 'radiant'],
  [/挥砍|slashing/i, 'slashing'],
  [/雷鸣|thunder/i, 'thunder'],
]

const AREA_ACTION_ABILITY_PATTERNS: readonly [RegExp, AbilityKey][] = [
  [/力量|strength|\bstr\b/i, 'str'],
  [/敏捷|dexterity|\bdex\b/i, 'dex'],
  [/体质|constitution|\bcon\b/i, 'con'],
  [/智力|intelligence|\bint\b/i, 'int'],
  [/感知|wisdom|\bwis\b/i, 'wis'],
  [/魅力|charisma|\bcha\b/i, 'cha'],
]

export function validateDnd5eCustomMonsterAreaActionDraft(
  action: Dnd5eCustomMonsterActionDraft,
): string[] {
  if (action.kind !== 'area-saving-throw') return []
  const issues: string[] = []
  if (!action.name.trim()) issues.push('名称不能为空')
  if (!action.description.trim()) issues.push('必须保留完整规则描述')
  if (!/^[a-z][a-z0-9-]*$/.test(action.id)) issues.push('动作 ID 必须使用小写字母、数字和连字符')
  if (action.category !== 'action' && action.category !== 'legendary') {
    issues.push('范围豁免动作目前只支持普通动作或传奇动作')
  }
  try {
    parseDice(action.areaDamageDice)
  } catch {
    issues.push('伤害骰格式无效（例如 2d6）')
  }
  if (!action.areaDamageType || !DND5E_DAMAGE_TYPES.includes(action.areaDamageType)) {
    issues.push('请选择伤害类型')
  }
  if (!ABILITY_KEYS.includes(action.areaSaveAbility)) issues.push('请选择豁免属性')
  const abilityChoices = action.areaSaveAbilityChoices ?? []
  if (abilityChoices.length > 0 && (
    abilityChoices.length < 2 ||
    abilityChoices.length > ABILITY_KEYS.length ||
    new Set(abilityChoices).size !== abilityChoices.length ||
    abilityChoices.some((ability) => !ABILITY_KEYS.includes(ability)) ||
    !abilityChoices.includes(action.areaSaveAbility)
  )) issues.push('目标自选豁免必须包含至少两个不重复属性，并包含默认属性')
  if (!Number.isInteger(action.areaSaveDc) || action.areaSaveDc < 1 || action.areaSaveDc > 100) {
    issues.push('豁免 DC 必须是 1–100 的整数')
  }
  if (!Number.isInteger(action.areaSizeFeet) || action.areaSizeFeet < 1) {
    issues.push(action.areaShape === 'circle' ? '半径必须大于 0 尺' : '范围长度必须大于 0 尺')
  }
  if (action.areaShape === 'line' && (!Number.isInteger(action.areaWidthFeet) || action.areaWidthFeet < 1)) {
    issues.push('线形宽度必须大于 0 尺')
  }
  if (action.usageKind === 'recharge' && (
    !Number.isInteger(action.rechargeDieSides) || action.rechargeDieSides < 2 ||
    !Number.isInteger(action.rechargeMinimum) || action.rechargeMinimum < 1 ||
    action.rechargeMinimum > action.rechargeDieSides
  )) issues.push('充能下限必须在充能骰范围内')
  return issues
}

export function validateDnd5eCustomMonsterSummonActionDraft(
  action: Dnd5eCustomMonsterActionDraft,
): string[] {
  if (action.kind !== 'summon') return []
  const issues: string[] = []
  if (!action.name.trim()) issues.push('名称不能为空')
  if (!/^[a-z][a-z0-9-]*$/.test(action.id)) issues.push('动作 ID 必须使用小写字母、数字和连字符')
  if (!/^(?:srd-5\.1|room-monster):[a-z0-9][a-z0-9-]{0,95}$/.test(action.summonMonsterId)) {
    issues.push('请选择当前目录中的召唤怪物')
  }
  if (action.category !== 'action' && action.category !== 'legendary') {
    issues.push('召唤目前仅支持普通动作或传奇动作')
  }
  if (action.summonCountMode === 'fixed') {
    if (!Number.isInteger(action.summonCount) || action.summonCount < 1 || action.summonCount > 20) {
      issues.push('固定召唤数量必须是 1–20 的整数')
    }
  } else {
    try {
      const dice = parseDice(action.summonCountDice)
      const minimum = dice.count + dice.bonus
      const maximum = dice.count * dice.sides + dice.bonus
      if (minimum < 1 || maximum > 20) issues.push('随机召唤数量的结果范围必须在 1–20 内')
    } catch {
      issues.push('随机数量必须使用骰式，例如 1d3 或 1d6')
    }
  }
  if (!Number.isInteger(action.summonDurationRounds) || action.summonDurationRounds < 1 || action.summonDurationRounds > 10_000) {
    issues.push('持续轮数必须是 1–10000 的整数')
  }
  if (action.summonConcentrationEndsOnAppearance && (
    !action.summonConcentration || action.summonTiming !== 'source-next-turn-start'
  )) issues.push('“出现后结束专注”只能用于下回合开始时出现的召唤')
  return issues
}

/**
 * Only offer the one-click area-action conversion when the source text
 * actually declares every structural ingredient needed by Headless. This
 * prevents passive traits and spell-list headings from inheriting synthetic
 * cone/DC/damage defaults merely because they contain a die expression.
 */
export function canConvertDnd5eCustomMonsterTraitToAreaAction(
  trait: Pick<Dnd5eCustomMonsterTraitDraft, 'name' | 'description'>,
): boolean {
  const text = `${trait.name} ${trait.description}`
  const hasArea = /(锥(?:形|状)?|线形|直线|半径|范围|尺内|英尺内|cone|line|radius|area|within\s+\d+\s*(?:feet|ft))/i.test(text)
  const hasSave = /(豁免|saving\s+throw|\bsave\b)/i.test(text)
  const hasDc = /\bdc\s*\d+/i.test(text)
  const hasDamageDice = /\d+\s*d\s*\d+/i.test(text) && /(伤害|damage)/i.test(text)
  return hasArea && hasSave && hasDc && hasDamageDice
}

/**
 * 将 AI 放错到“特性”里的主动范围能力转成可编辑的 Headless 动作草稿。
 * 只提取原文明确给出的数值；伤害类型缺失时故意保持为空，等待 DM 确认。
 */
export function createDnd5eCustomMonsterAreaActionDraftFromTrait(
  trait: Pick<Dnd5eCustomMonsterTraitDraft, 'name' | 'description'>,
): Dnd5eCustomMonsterActionDraft {
  if (!canConvertDnd5eCustomMonsterTraitToAreaAction(trait)) {
    throw new Error('该特性没有同时提供范围、豁免 DC 与伤害骰，不能自动转为 Headless 范围动作')
  }
  const text = `${trait.name} ${trait.description}`
  const draft = createDnd5eCustomMonsterActionDraft()
  const dice = text.match(/(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i)
  const dc = text.match(/\bdc\s*(\d+)/i)
  const distance = text.match(/(\d+)\s*(?:尺|英尺|ft\.?)/i)
  const recharge = text.match(/充能\s*(\d+)(?:\s*[-–—至~]\s*(\d+))?/i)
  const damageType = AREA_ACTION_DAMAGE_TYPE_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? ''
  const saveAbility = AREA_ACTION_ABILITY_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? 'dex'
  const areaShape = /线形|直线|line/i.test(text)
    ? 'line' as const
    : /圆形|半径|radius|circle/i.test(text)
      ? 'circle' as const
      : 'cone' as const
  const rechargeMinimum = recharge ? Number(recharge[1]) : 5
  const rechargeDieSides = recharge ? Number(recharge[2] ?? 6) : 6
  return {
    ...draft,
    id: `area-action-${uid().slice(0, 8)}`,
    name: trait.name.trim() || '范围豁免能力',
    description: trait.description.trim(),
    kind: 'area-saving-throw',
    automation: 'headless',
    category: 'action',
    areaShape,
    areaSizeFeet: distance ? Number(distance[1]) : 15,
    areaWidthFeet: 5,
    areaSaveAbility: saveAbility,
    areaSaveAbilityChoices: [],
    areaSaveDc: dc ? Number(dc[1]) : 12,
    areaDamageDice: dice
      ? `${dice[1]}d${dice[2]}${dice[3] ? `${dice[3]}${dice[4]}` : ''}`
      : '2d6',
    areaDamageType: damageType,
    areaDamageOnSuccessfulSave: /减半|一半|half/i.test(text) ? 'half' : 'none',
    usageKind: recharge ? 'recharge' : 'at-will',
    rechargeMinimum,
    rechargeDieSides,
  }
}

function actionDescription(action: Dnd5eCustomMonsterActionDraft, dice: ReturnType<typeof parseDice>): string {
  if (action.description.trim()) return action.description.trim()
  const mode = action.mode === 'melee' ? '近战' : action.mode === 'ranged' ? '远程' : '近战或远程'
  const range = action.mode === 'melee'
    ? `触及 ${action.reachFeet} 尺`
    : action.mode === 'ranged'
      ? `射程 ${action.rangeNormal}/${action.rangeLong} 尺`
      : `触及 ${action.reachFeet} 尺或射程 ${action.rangeNormal}/${action.rangeLong} 尺`
  const bonus = dice.bonus === 0 ? '' : ` ${dice.bonus > 0 ? '+' : '−'} ${Math.abs(dice.bonus)}`
  return `${mode}武器攻击：命中 ${action.toHit >= 0 ? '+' : ''}${action.toHit}，${range}，单一目标。命中：${Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)}（${dice.count}d${dice.sides}${bonus}）点伤害。`
}

function normalizedAction(action: Dnd5eCustomMonsterActionDraft, monster: Dnd5eCustomMonsterDraft): Dnd5eMonsterAction {
  if (!action.name.trim()) throw new Error('动作名称不能为空')
  const usage = action.usageKind === 'per-day'
    ? { kind: 'per-day' as const, max: Math.max(1, Math.min(99, Math.trunc(action.usageMax))) }
    : action.usageKind === 'recharge'
      ? {
          kind: 'recharge' as const,
          dieSides: Math.max(2, Math.min(100, Math.trunc(action.rechargeDieSides))),
          minimum: Math.max(1, Math.min(Math.trunc(action.rechargeMinimum), Math.max(2, Math.trunc(action.rechargeDieSides)))),
        }
      : undefined
  const metadata = {
    ...(usage ? { usage } : {}),
    ...(action.category === 'legendary' ? { legendaryCost: Math.max(1, Math.min(10, Math.trunc(action.legendaryCost))) } : {}),
    ...(action.referencedActionId.trim() ? { referencedActionId: action.referencedActionId.trim() } : {}),
    ...(action.category === 'reaction' && action.reactionTriggerActionId.trim()
      ? { reactionTrigger: { kind: 'after-action' as const, actionId: action.reactionTriggerActionId.trim() } }
      : {}),
  }
  const rating = monster.challengeRating.includes('/')
    ? Number(monster.challengeRating.split('/')[0]) / Number(monster.challengeRating.split('/')[1])
    : Number(monster.challengeRating)
  const actorSnapshot = {
    level: Number.isFinite(rating) ? Math.max(1, Math.ceil(rating)) : 1,
    proficiencyBonus: dnd5eMonsterProficiencyBonus(monster.challengeRating),
    abilities: monster.abilities,
  }
  if (action.kind === 'area-saving-throw') {
    const issues = validateDnd5eCustomMonsterAreaActionDraft(action)
    if (issues.length > 0) {
      throw new Error(`动作“${action.name || action.id}”无法接入 Headless：${issues.join('；')}`)
    }
    const dice = parseDice(action.areaDamageDice)
    const dynamicModifier = evaluateDnd5eWorkshopDamageFormula(action.areaDamageModifierFormula, actorSnapshot)
    const area = action.areaShape === 'circle'
      ? { shape: 'circle' as const, origin: 'self' as const, radiusFeet: Math.trunc(action.areaSizeFeet) }
      : action.areaShape === 'line'
        ? {
            shape: 'line' as const,
            origin: 'self' as const,
            lengthFeet: Math.trunc(action.areaSizeFeet),
            widthFeet: Math.trunc(action.areaWidthFeet),
            aimRangeFeet: Math.trunc(action.areaSizeFeet),
          }
        : {
            shape: 'cone' as const,
            origin: 'self' as const,
            lengthFeet: Math.trunc(action.areaSizeFeet),
            aimRangeFeet: Math.trunc(action.areaSizeFeet),
          }
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim(),
      kind: 'other',
      automation: 'headless',
      rule: {
        kind: 'area-saving-throw',
        area,
        target: action.areaTarget,
        ability: action.areaSaveAbility,
        ...((action.areaSaveAbilityChoices?.length ?? 0) >= 2
          ? { targetAbilityChoices: [...new Set(action.areaSaveAbilityChoices)] }
          : {}),
        dc: Math.trunc(action.areaSaveDc),
        ...(action.areaMagical ? { magical: true } : {}),
        damage: {
          average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus + dynamicModifier)),
          ...dice,
          bonus: dice.bonus + dynamicModifier,
          ...(action.areaDamageModifierFormula ? {
            modifierFormula: action.areaDamageModifierFormula,
            workshopFixedBonus: dice.bonus,
          } : {}),
          type: action.areaDamageType as Dnd5eDamageType,
        },
        damageOnSuccessfulSave: action.areaDamageOnSuccessfulSave,
      },
      ...metadata,
    }
  }
  if (action.kind === 'summon') {
    const issues = validateDnd5eCustomMonsterSummonActionDraft(action)
    if (issues.length > 0) {
      throw new Error(`动作“${action.name || action.id}”无法接入 Headless：${issues.join('；')}`)
    }
    const count = action.summonCountMode === 'fixed'
      ? { kind: 'fixed' as const, value: Math.trunc(action.summonCount) }
      : { kind: 'dice' as const, ...parseDice(action.summonCountDice) }
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim() ||
        `召唤 ${action.summonCountMode === 'fixed' ? action.summonCount : action.summonCountDice} 个目录生物。`,
      kind: 'other',
      automation: 'headless',
      rule: {
        kind: 'summon',
        monsterId: action.summonMonsterId,
        count,
        timing: action.summonTiming,
        durationRounds: Math.trunc(action.summonDurationRounds),
        concentration: action.summonConcentration,
        concentrationEndsOnAppearance: action.summonConcentrationEndsOnAppearance,
        side: action.summonSide,
      },
      ...metadata,
    }
  }
  if (action.kind === 'movement') {
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim() ||
        `该生物向一名可见敌人直线移动至多等于其速度 ${Math.round(action.movementSpeedFraction * 100)}% 的距离。`,
      kind: 'other',
      automation: 'dm-adjudication',
      movement: {
        kind: 'straight-toward-visible-hostile',
        maximumSpeedFraction: Math.max(0.05, Math.min(1, action.movementSpeedFraction)),
      },
      ...metadata,
    }
  }
  if (action.kind === 'other') {
    if (!action.description.trim()) throw new Error(`动作“${action.name}”需要填写规则描述`)
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim(),
      kind: 'other',
      automation: 'dm-adjudication',
      ...metadata,
    }
  }
  const parsed = parseDice(action.damageDice)
  const mainDynamicModifier = evaluateDnd5eWorkshopDamageFormula(action.damageModifierFormula, actorSnapshot)
  const additionalDamage = action.additionalDamage.map((component) => {
    const dice = parseDice(component.dice)
    const dynamicModifier = evaluateDnd5eWorkshopDamageFormula(component.modifierFormula, actorSnapshot)
    return {
      average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus + dynamicModifier)),
      ...dice,
      bonus: dice.bonus + dynamicModifier,
      ...(component.modifierFormula ? { modifierFormula: component.modifierFormula } : {}),
      ...(component.modifierFormula ? { workshopFixedBonus: dice.bonus } : {}),
      type: component.damageType,
    }
  })
  const criticalExtraDamage = action.criticalExtraDamage.map((component) => {
    const dice = parseDice(component.dice)
    return {
      average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
      ...dice,
      type: component.damageType,
    }
  })
  const attack = {
    mode: action.mode,
    toHit: Math.trunc(action.toHit),
    ...(action.mode !== 'ranged' ? { reachFeet: Math.max(0, Math.trunc(action.reachFeet)) } : {}),
    ...(action.mode !== 'melee' ? {
      rangeFeet: {
        normal: Math.max(0, Math.trunc(action.rangeNormal)),
        long: Math.max(Math.trunc(action.rangeNormal), Math.trunc(action.rangeLong)),
      },
    } : {}),
    target: '单一目标',
    damage: [{
      average: Math.max(0, Math.floor(parsed.count * (parsed.sides + 1) / 2 + parsed.bonus + mainDynamicModifier)),
      ...parsed,
      bonus: parsed.bonus + mainDynamicModifier,
      ...(action.damageModifierFormula ? { modifierFormula: action.damageModifierFormula } : {}),
      ...(action.damageModifierFormula ? { workshopFixedBonus: parsed.bonus } : {}),
      type: action.damageType,
    }, ...additionalDamage],
    ...(action.criticalThreshold < 20 ? {
      criticalThreshold: Math.max(2, Math.min(20, Math.trunc(action.criticalThreshold))),
    } : {}),
    ...(criticalExtraDamage.length > 0 ? { criticalExtraDamage } : {}),
    ...(action.onHitSaveEnabled ? {
      onHitRule: {
        kind: 'saving-throw-condition' as const,
        ability: action.onHitSaveAbility,
        dc: Math.max(1, Math.min(100, Math.trunc(action.onHitSaveDc))),
        condition: action.onHitCondition,
      },
    } : {}),
  } as const
  return {
    id: action.id,
    name: action.name.trim(),
    description: actionDescription(action, parsed),
    kind: 'weapon-attack',
    automation: action.category === 'lair' ||
      (action.category === 'reaction' && !action.reactionTriggerActionId.trim())
      ? 'dm-adjudication'
      : action.automation,
    attack,
    ...metadata,
  }
}

export function buildDnd5eCustomMonster(draft: Dnd5eCustomMonsterDraft): Dnd5eMonsterStatBlock {
  const slug = normalizedCustomMonsterSlug(draft.slug ?? `custom-${uid()}`)
  const requestedId = draft.id?.trim()
  const id = requestedId && ROOM_MONSTER_ID_PATTERN.test(requestedId)
    ? requestedId
    : `room-monster:${slug}`
  const preserved = draft.preservedStatBlock
  const normalizedDraftActions = draft.actions.map((draftAction) => {
    const normalized = normalizedAction(draftAction, draft)
    const previous = draftAction.preservedAction ?? [
      ...(preserved?.actions ?? []),
      ...(preserved?.bonusActions ?? []),
      ...(preserved?.reactions ?? []),
      ...(preserved?.legendaryActions ?? []),
      ...(preserved?.lairActions ?? []),
    ].find((action) => action.id === normalized.id && action.kind === normalized.kind)
    if (!previous) return normalized
    if (normalized.kind !== 'weapon-attack' || !normalized.attack || !previous.attack) {
      const mergedRule = previous.rule && normalized.rule && previous.rule.kind === normalized.rule.kind
        ? { ...previous.rule, ...normalized.rule } as Dnd5eMonsterAction['rule']
        : normalized.rule ?? previous.rule
      return {
        ...previous,
        ...normalized,
        ...(mergedRule ? { rule: mergedRule } : {}),
        ...(draftAction.preservedAction?.automation
          ? { automation: draftAction.preservedAction.automation }
          : {}),
      }
    }
    return {
      ...previous,
      ...normalized,
      attack: {
        ...previous.attack,
        ...normalized.attack,
        damage: normalized.attack.damage,
      },
    }
  })
  const actionById = new Map(normalizedDraftActions.map((action) => [action.id, action]))
  const actionsForCategory = (category: Dnd5eCustomMonsterActionDraft['category']) =>
    draft.actions.flatMap((action) => action.category === category ? [actionById.get(action.id)!] : [])
  const baseActions = actionsForCategory('action')
  const repeated = draft.actions.filter((action) =>
    action.category === 'action' && action.kind === 'weapon-attack' && action.attacksPerAction > 1)
  const actions: Dnd5eMonsterAction[] = [...baseActions]
  const preservedMultiattacks = [
    ...(preserved?.actions ?? []),
    ...(draft.preservedMultiattacks ?? []),
  ].filter((action, index, entries) =>
    action.kind === 'multiattack' &&
    (action.sequence?.every((id) => baseActions.some((candidate) => candidate.id === id)) ||
      (!!action.randomRepeat && baseActions.some((candidate) => candidate.id === action.randomRepeat?.actionId))) &&
    entries.findIndex((candidate) => candidate.id === action.id) === index,
  )
  if (preservedMultiattacks.length > 0) {
    actions.unshift(...preservedMultiattacks.map((action) => structuredClone(action)))
  } else if (repeated.length > 0) {
    const sequence = repeated.flatMap((action) => Array.from({ length: Math.min(10, Math.max(2, Math.trunc(action.attacksPerAction))) }, () => action.id))
    const childrenHeadless = repeated.every((action) => action.automation === 'headless')
    actions.unshift({
      id: 'multiattack',
      name: '多重攻击',
      description: `该怪物进行 ${sequence.length} 次攻击。`,
      kind: 'multiattack',
      sequence,
      automation: childrenHeadless ? 'headless' : 'dm-adjudication',
    })
  }
  const traits = draft.traits.filter((trait) => trait.name.trim() || trait.description.trim()).map((trait) => {
    const rule = trait.ruleKind === 'undead-fortitude'
      ? {
          kind: 'undead-fortitude' as const,
          dcBase: Math.max(1, Math.min(100, Math.trunc(trait.dcBase))),
          excludedDamageTypes: [...new Set(trait.damageTypes)],
          excludedOnCritical: trait.excludedOnCritical,
        }
      : trait.ruleKind === 'regeneration'
        ? {
            kind: 'regeneration' as const,
            amount: Math.max(1, Math.trunc(trait.amount)),
            requiresPositiveHp: trait.requiresPositiveHp,
            suppressedByDamageTypes: [...new Set(trait.damageTypes)],
            diesAtZeroWhenSuppressed: trait.diesAtZeroWhenSuppressed,
          }
        : trait.ruleKind === 'swarm'
          ? { kind: 'swarm' as const, cannotRegainHitPoints: true as const, cannotGainTemporaryHitPoints: true as const }
          : trait.ruleKind === 'nimble-escape'
            ? { kind: 'nimble-escape' as const, bonusActionOptions: ['disengage', 'hide'] as const }
            : trait.ruleKind === 'keen-sense'
              ? {
                  kind: 'keen-sense' as const,
                  sense: trait.keenSense,
                  skillKey: trait.keenSenseSkillKey.trim() || 'perception',
                  checkBonus: Math.max(-100, Math.min(100, Math.trunc(trait.keenSenseCheckBonus))),
                  ...(trait.keenSenseBlindsightFeet > 0
                    ? { blindsightFeet: Math.trunc(trait.keenSenseBlindsightFeet) }
                    : {}),
                }
              : trait.ruleKind === 'ambusher'
                ? { kind: 'ambusher' as const, initiativeAdvantageWhenSurprising: true as const }
                : trait.ruleKind === 'charge-damage'
                  ? (() => {
                      const dice = parseDice(trait.chargeDamageDice)
                      if (!trait.chargeActionId.trim()) {
                        throw new Error(`特性“${trait.name}”必须选择触发追加伤害的攻击动作`)
                      }
                      return {
                        kind: 'charge-damage' as const,
                        minimumStraightMovementFeet: Math.max(5, Math.trunc(trait.chargeMinimumFeet)),
                        actionId: trait.chargeActionId.trim(),
                        extraDamage: {
                          average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
                          ...dice,
                          type: trait.chargeDamageType,
                        },
                        ...(trait.chargeSaveEnabled ? {
                          savingThrowOnHit: {
                            ability: trait.chargeSaveAbility,
                            dc: Math.max(1, Math.min(100, Math.trunc(trait.chargeSaveDc))),
                            conditionOnFailedSave: trait.chargeSaveCondition,
                          },
                        } : {}),
                      }
                    })()
                  : trait.ruleKind === 'magic-resistance'
                    ? { kind: 'magic-resistance' as const, savingThrowAdvantageAgainstMagic: true as const }
                    : trait.ruleKind === 'relentless'
                      ? {
                          kind: 'relentless' as const,
                          maximumDamage: Math.max(1, Math.min(
                            1_000_000,
                            Math.trunc(trait.relentlessMaximumDamage),
                          )),
                        }
                      : trait.ruleKind === 'sneak-attack'
                        ? (() => {
                            const dice = parseDice(trait.sneakAttackDamageDice)
                            return {
                              kind: 'sneak-attack' as const,
                              oncePerTurn: true as const,
                              allyDistanceFeet: 5,
                              requireNoDisadvantage: true as const,
                              advantageOrAdjacentAlly: true as const,
                              extraDamage: {
                                average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
                                ...dice,
                                type: 'inherit-primary' as const,
                              },
                            }
                          })()
                        : trait.ruleKind === 'surprise-attack'
                          ? (() => {
                              const dice = parseDice(trait.surpriseAttackDamageDice)
                              return {
                                kind: 'surprise-attack' as const,
                                requiredRound: 1 as const,
                                targetState: 'currently-surprised' as const,
                                applyOn: 'each-qualifying-hit' as const,
                                extraDamage: {
                                  average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
                                  ...dice,
                                  type: 'inherit-primary' as const,
                                },
                              }
                            })()
                          : trait.ruleKind === 'stench'
                            ? {
                                kind: 'turn-start-saving-throw-aura' as const,
                                ruleId: 'stench',
                                rangeFeet: Math.max(5, Math.min(1_000, Math.trunc(trait.stenchRangeFeet))),
                                relation: 'any' as const,
                                ability: 'con' as const,
                                dc: Math.max(1, Math.min(100, Math.trunc(trait.stenchSaveDc))),
                                magical: false,
                                condition: 'poisoned' as const,
                                duration: 'until-target-next-turn-start' as const,
                                successfulSaveImmunityRounds: 14_400,
                              }
                    : trait.ruleKind === 'limited-magic-immunity'
                      ? {
                          kind: 'limited-magic-immunity' as const,
                          maximumSpellLevel: Math.max(
                            0,
                            Math.min(9, Math.trunc(trait.limitedMagicImmunityMaximumSpellLevel)),
                          ),
                          advantageAboveMaximum: trait.limitedMagicImmunityAdvantageAboveMaximum,
                          allowsWilling: trait.limitedMagicImmunityAllowsWilling,
                        }
                      : trait.ruleKind === 'magic-weapons'
                        ? { kind: 'magic-weapons' as const, weaponAttacksMagical: true as const }
                    : trait.ruleKind === 'pack-tactics'
                      ? {
                          kind: 'pack-tactics' as const,
                          allyDistanceFeet: 5,
                          requiresAllyNotIncapacitated: true as const,
                        }
                    : trait.ruleKind === 'conditional-target-bonus'
                      ? {
                          kind: 'conditional-target-bonus' as const,
                          targetConditions: [...new Set(trait.targetBonusConditions)],
                          attackBonus: Math.max(-100, Math.min(100, Math.trunc(trait.targetAttackBonus))),
                          damageBonus: Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(trait.targetDamageBonus))),
                        }
                      : undefined
    const headlessRule = rule?.kind === 'undead-fortitude' ||
      rule?.kind === 'regeneration' ||
      rule?.kind === 'swarm' ||
      rule?.kind === 'nimble-escape' ||
      rule?.kind === 'magic-resistance' ||
      rule?.kind === 'limited-magic-immunity' ||
      rule?.kind === 'magic-weapons' ||
      rule?.kind === 'charge-damage' ||
      rule?.kind === 'relentless' ||
      rule?.kind === 'sneak-attack' ||
      rule?.kind === 'surprise-attack' ||
      rule?.kind === 'turn-start-saving-throw-aura' ||
      rule?.kind === 'conditional-target-bonus'
    const normalizedTrait: Dnd5eMonsterTrait = {
      name: trait.name.trim(),
      description: trait.description.trim(),
      automation: headlessRule ? ('headless' as const) : ('dm-adjudication' as const),
      ...(rule ? { rule } : {}),
    }
    if (!trait.preservedTrait) return normalizedTrait
    return {
      ...structuredClone(trait.preservedTrait),
      ...normalizedTrait,
      automation: trait.preservedTrait.automation ?? normalizedTrait.automation,
      ...(rule ? { rule } : trait.preservedTrait.rule ? { rule: structuredClone(trait.preservedTrait.rule) } : {}),
    }
  })
  const traitNameIncludes = (pattern: RegExp) => traits.some((trait) => pattern.test(trait.name))
  const capabilities = {
    swarm: traitNameIncludes(/群集|swarm/i),
    shapechanger: traitNameIncludes(/变形|shapechange/i),
    regeneration: traitNameIncludes(/再生|regeneration/i),
    spellcaster: draft.spellcastingEnabled || traitNameIncludes(/施法|spellcasting/i),
    legendary: preserved?.capabilities?.legendary === true ||
      draft.legendaryResistanceUses > 0 ||
      draft.actions.some((action) => action.category === 'legendary'),
    hasFlySpeed: draft.fly > 0,
    hasSwimSpeed: draft.swim > 0,
  }
  const headlessMechanics: Dnd5eMonsterMechanicTriggerV2[] = (draft.headlessMechanics ?? []).map((mechanic) => {
    const fixedDamageType: Dnd5eDamageType = mechanic.damageType === 'inherit-trigger'
      ? 'force'
      : mechanic.damageType
    if (!mechanic.name.trim()) throw new Error('怪物机制名称不能为空')
    const dice = (
      ['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind) ||
      (mechanic.effectKind === 'attack' && mechanic.attackDamageMode === 'dice')
    )
      ? parseDice(mechanic.healingDice)
      : undefined
    const effect: Dnd5eMonsterMechanicEffectV2 = mechanic.effectKind === 'healing' || mechanic.effectKind === 'temporary-hit-points'
      ? { id: 'effect-0', kind: mechanic.effectKind, target: 'self' as const, dice: dice! }
      : mechanic.effectKind === 'damage'
        ? { id: 'effect-0', kind: 'damage' as const, target: mechanic.effectTarget, dice: dice!, damageType: mechanic.damageType }
        : mechanic.effectKind === 'damage-replacement'
          ? {
              id: 'effect-0', kind: 'damage-replacement' as const,
              target: mechanic.effectTarget,
              operation: mechanic.damageReplacementOperation,
              ...(
                mechanic.damageReplacementOperation === 'reduce-by' ||
                mechanic.damageReplacementOperation === 'set-to'
                  ? { amount: Math.max(0, Math.trunc(mechanic.damageReplacementAmount)) }
                  : {}
              ),
            }
        : mechanic.effectKind === 'standard-condition'
          ? {
              id: 'effect-0', kind: 'standard-condition' as const, target: mechanic.effectTarget,
              condition: mechanic.condition,
              duration: mechanic.durationKind === 'rounds'
                ? { kind: 'rounds' as const, rounds: Math.max(1, Math.trunc(mechanic.durationRounds)) }
                : { kind: mechanic.durationKind },
            }
          : mechanic.effectKind === 'tactical-status'
            ? {
                id: 'effect-0', kind: 'tactical-status' as const, target: mechanic.effectTarget,
                statusId: mechanic.statusMarkerId,
                duration: mechanic.durationKind === 'rounds'
                  ? { kind: 'rounds' as const, rounds: Math.max(1, Math.trunc(mechanic.durationRounds)) }
                  : { kind: mechanic.durationKind },
              }
          : mechanic.effectKind === 'remove-standard-condition'
            ? {
                id: 'effect-0', kind: 'remove-standard-condition' as const,
                target: mechanic.effectTarget, condition: mechanic.condition,
              }
          : mechanic.effectKind === 'summon'
            ? {
                id: 'effect-0', kind: 'summon' as const, monsterId: mechanic.summonMonsterId,
                count: Math.max(1, Math.trunc(mechanic.summonCount)),
                durationRounds: Math.max(1, Math.trunc(mechanic.summonDurationRounds)),
              }
            : mechanic.effectKind === 'roll-modifier'
              ? {
                  id: 'effect-0', kind: 'roll-modifier' as const, target: mechanic.effectTarget,
                  roll: mechanic.modifierRoll, mode: mechanic.modifierMode,
                  ...(mechanic.modifierMode === 'bonus'
                    ? { bonus: Math.trunc(mechanic.modifierBonus) }
                    : {}),
                }
              : mechanic.effectKind === 'attack'
                ? {
                    id: 'effect-0', kind: 'attack' as const, target: mechanic.effectTarget,
                    attackMode: mechanic.attackMode,
                    toHit: Math.trunc(mechanic.attackToHit),
                    economy: mechanic.attackEconomy,
                    damage: mechanic.attackDamageMode === 'fixed'
                      ? {
                          average: Math.max(0, Math.trunc(mechanic.attackFixedDamage)),
                          count: 0, sides: 2,
                          bonus: Math.max(0, Math.trunc(mechanic.attackFixedDamage)),
                          type: fixedDamageType,
                        }
                      : {
                          average: Math.max(0, Math.floor(dice!.count * (dice!.sides + 1) / 2 + dice!.bonus)),
                          ...dice!,
                          type: fixedDamageType,
                        },
                  }
                : mechanic.effectKind === 'action-grant'
                  ? {
                      id: 'effect-0', kind: 'action-grant' as const,
                      target: mechanic.effectTarget,
                      resource: mechanic.actionGrantResource,
                    }
                  : mechanic.effectKind === 'equipment-modifier'
                    ? {
                        id: 'effect-0', kind: 'equipment-modifier' as const,
                        target: mechanic.effectTarget,
                        equipment: mechanic.equipmentModifierEquipment,
                        operation: mechanic.equipmentModifierOperation,
                        bonus: Math.trunc(mechanic.equipmentModifierBonus),
                        ...(mechanic.equipmentModifierEquipmentId.trim()
                          ? { equipmentId: mechanic.equipmentModifierEquipmentId.trim() }
                          : {}),
                        duration: mechanic.durationKind === 'rounds'
                          ? { kind: 'rounds' as const, rounds: Math.max(1, Math.trunc(mechanic.durationRounds)) }
                          : { kind: mechanic.durationKind },
                      }
                : {
                id: 'effect-0', kind: 'area-attack' as const, shape: mechanic.areaShape,
                rangeFeet: Math.max(0, Math.trunc(mechanic.areaRangeFeet)),
                sizeFeet: Math.max(5, Math.trunc(mechanic.areaSizeFeet)),
                dice: dice!, damageType: fixedDamageType,
              }
    return {
      schemaVersion: 2,
      id: mechanic.id,
      name: mechanic.name.trim(),
      trigger: {
        event: mechanic.trigger,
        ...(mechanic.triggerSubject !== 'self' ? { subject: mechanic.triggerSubject } : {}),
        ...(mechanic.triggerSubject !== 'self'
          ? { radiusFeet: Math.max(5, Math.trunc(mechanic.triggerRadiusFeet)) }
          : {}),
        ...((mechanic.trigger === 'movement' || mechanic.trigger === 'after-move-hit')
          ? {
              movement: {
                comparison: mechanic.movementComparison,
                feet: Math.max(0, Math.trunc(mechanic.movementFeet)),
              },
            }
          : {}),
        ...(
          ['after-hit', 'after-move-hit', 'after-miss', 'when-hit'].includes(mechanic.trigger) &&
          mechanic.triggerAttackMode !== 'any'
            ? { attackMode: mechanic.triggerAttackMode }
            : {}
        ),
        ...(
          ['before-damaged', 'after-damaged', 'after-dealt-damage'].includes(mechanic.trigger) &&
          mechanic.triggerDamageTypes.length > 0
            ? { damageTypes: [...new Set(mechanic.triggerDamageTypes)] }
            : {}
        ),
        ...(
          mechanic.trigger === 'saving-throw-magic' || mechanic.trigger === 'saving-throw-physical'
            ? {
                savingThrowTiming: mechanic.savingThrowTiming,
                ...(mechanic.savingThrowTiming === 'after' && mechanic.savingThrowOutcome !== 'any'
                  ? { savingThrowOutcome: mechanic.savingThrowOutcome }
                  : {}),
              }
            : {}
        ),
      },
      predicates: {
        ...(Number.isFinite(mechanic.hpPercentageAtOrBelow)
          ? { hpPercentageAtOrBelow: Math.max(0, Math.min(100, Number(mechanic.hpPercentageAtOrBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpPercentageAtOrAbove)
          ? { hpPercentageAtOrAbove: Math.max(0, Math.min(100, Number(mechanic.hpPercentageAtOrAbove))) }
          : {}),
        ...(Number.isFinite(mechanic.hpBelow)
          ? { hpBelow: Math.max(0, Math.trunc(Number(mechanic.hpBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpAtOrBelow)
          ? { hpAtOrBelow: Math.max(0, Math.trunc(Number(mechanic.hpAtOrBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpAbove)
          ? { hpAbove: Math.max(0, Math.trunc(Number(mechanic.hpAbove))) }
          : {}),
        ...(Number.isFinite(mechanic.hpAtOrAbove)
          ? { hpAtOrAbove: Math.max(0, Math.trunc(Number(mechanic.hpAtOrAbove))) }
          : {}),
        requiresPositiveHp: mechanic.requiresPositiveHp,
      },
      effects: [effect, ...(mechanic.preservedEffects?.slice(1).map((entry) => structuredClone(entry)) ?? [])],
      limit: mechanic.limit,
      automation: mechanic.automation,
    }
  })
  const monster: Dnd5eMonsterStatBlock = {
    ...preserved,
    id,
    slug,
    name: draft.name.trim(),
    englishName: draft.englishName.trim() || draft.name.trim(),
    source: 'DM 自定义',
    size: draft.size,
    creatureType: draft.creatureType.trim(),
    alignment: draft.alignment.trim(),
    armorClass: {
      value: Math.trunc(draft.armorClass),
      ...(draft.armorClassNote.trim() ? { note: draft.armorClassNote.trim() } : {}),
    },
    hitPoints: { average: Math.trunc(draft.hitPointsAverage), dice: draft.hitPointsDice.replace(/\s+/g, '') },
    speed: {
      walk: Math.trunc(draft.walk),
      ...(draft.fly > 0 ? { fly: Math.trunc(draft.fly), hover: draft.hover } : {}),
      ...(draft.swim > 0 ? { swim: Math.trunc(draft.swim) } : {}),
      ...(draft.climb > 0 ? { climb: Math.trunc(draft.climb) } : {}),
      ...(draft.burrow > 0 ? { burrow: Math.trunc(draft.burrow) } : {}),
    },
    abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.trunc(draft.abilities[key])])) as Record<AbilityKey, number>,
    savingThrows: Object.fromEntries(Object.entries(draft.savingThrows)
      .filter(([, value]) => Number.isFinite(value))
      .map(([key, value]) => [key, Math.trunc(value!)])),
    skills: draft.skills
      .filter((skill, index, skills) => {
        const key = skill.key.trim()
        return !!key && skills.findIndex((candidate) => candidate.key.trim() === key) === index
      })
      .map((skill) => {
      const key = skill.key.trim()
      return {
        key,
        name: (DND5E_SKILL_LABEL_BY_KEY.get(key) ?? skill.name.trim()) || key,
        bonus: Math.trunc(skill.bonus),
      }
      }),
    senses: [
      ...draft.senses.filter((sense) => sense.name.trim()).map((sense) => ({
        name: sense.name.trim(),
        ...(Number.isFinite(sense.distanceFeet) ? { distanceFeet: Math.max(0, Math.trunc(sense.distanceFeet!)) } : {}),
      })),
      ...traits.flatMap((trait) =>
        trait.rule?.kind === 'keen-sense' && (trait.rule.blindsightFeet ?? 0) > 0
          ? [{ name: '盲视', distanceFeet: trait.rule.blindsightFeet }]
          : []),
    ].filter((sense, index, senses) =>
      senses.findIndex((candidate) =>
        candidate.name === sense.name && candidate.distanceFeet === sense.distanceFeet) === index),
    damageVulnerabilities: [...new Set(draft.damageVulnerabilities)],
    damageResistances: [...new Set(draft.damageResistances)],
    damageImmunities: [...new Set(draft.damageImmunities)],
    ...(draft.damageDefenseRules !== undefined
      ? {
          damageDefenseRules: draft.damageDefenseRules.map((rule) =>
            structuredClone(rule)),
        }
      : {}),
    ...(draft.unparsedDamageDefenses !== undefined
      ? {
          unparsedDamageDefenses: draft.unparsedDamageDefenses.map((defense) =>
            structuredClone(defense)),
        }
      : {}),
    conditionImmunities: [...new Set(draft.conditionImmunities)],
    tokenStatusMarkerGrants: (draft.tokenStatusMarkerGrants ?? []).map((grant) => ({
      ...grant,
      application: grant.application ?? 'marker',
    })).filter((grant, index, grants) =>
      grants.findIndex((candidate) =>
        candidate.statusId === grant.statusId && candidate.target === grant.target &&
        candidate.application === grant.application) === index),
    passivePerception: Math.trunc(draft.passivePerception),
    languages: draft.languages.split(/[,，、]/).map((entry) => entry.trim()).filter(Boolean),
    challenge: { rating: draft.challengeRating.trim(), xp: Math.trunc(draft.xp) },
    legendaryResistanceUses: Math.max(0, Math.min(99, Math.trunc(draft.legendaryResistanceUses))),
    legendaryActionPoints: Math.max(0, Math.min(99, Math.trunc(draft.legendaryActionPoints))),
    lairInitiative: Math.max(0, Math.min(99, Math.trunc(draft.lairInitiative))),
    ...(draft.portrait ? { portrait: draft.portrait } : {}),
    ...(draft.tokenPortrait ? { tokenPortrait: draft.tokenPortrait } : {}),
    ...(draft.initiativePortrait ? { initiativePortrait: draft.initiativePortrait } : {}),
    equipment: draft.equipment.filter((item) => item.name.trim()).map((item) => ({
      id: item.id,
      name: item.name.trim(),
      category: item.category,
      quantity: Math.max(1, Math.min(999, Math.trunc(item.quantity))),
      ...(item.description.trim() ? { description: item.description.trim() } : {}),
      ...(Number.isFinite(item.armorClass) ? { armorClass: Math.max(0, Math.trunc(item.armorClass!)) } : {}),
      ...(item.linkedActionId.trim() ? { linkedActionId: item.linkedActionId.trim() } : {}),
    })),
    traits,
    actions,
    bonusActions: actionsForCategory('bonus-action'),
    reactions: actionsForCategory('reaction'),
    legendaryActions: actionsForCategory('legendary'),
    lairActions: actionsForCategory('lair'),
    spellcasting: draft.spellcastingEnabled ? {
      description: draft.spellcastingDescription.trim() || '该生物拥有施法能力。',
      casterLevel: Math.max(1, Math.min(30, Math.trunc(draft.spellcastingCasterLevel))),
      ability: draft.spellcastingAbility,
      saveDc: Math.max(1, Math.min(100, Math.trunc(draft.spellcastingSaveDc))),
      attackBonus: Math.max(-100, Math.min(100, Math.trunc(draft.spellcastingAttackBonus))),
      slots: Object.fromEntries(Object.entries(draft.spellSlots)
        .filter(([level, count]) => /^[1-9]$/.test(level) && Number.isFinite(count) && count > 0)
        .map(([level, count]) => [level, Math.max(0, Math.min(99, Math.trunc(count)))])),
      spells: draft.spells.filter((spell) => spell.id.trim() && spell.name.trim()).map((spell) => ({
        id: spell.id.trim(),
        name: spell.name.trim(),
        level: Math.max(0, Math.min(9, Math.trunc(spell.level))),
        ...(spell.usageKind === 'at-will'
          ? { usage: { kind: 'at-will' as const } }
          : spell.usageKind === 'per-day'
            ? { usage: { kind: 'per-day' as const, max: Math.max(1, Math.min(99, Math.trunc(spell.usageMax))) } }
            : {}),
      })),
      automation: draft.spellcastingAutomation,
    } : undefined,
    capabilities,
    targetingPreference: { schemaVersion: 1, priority: draft.targetingPriority ?? 'nearest' },
    headlessMechanics,
    description: draft.description.trim(),
  }
  const parsed = parseDnd5eMonsterStatBlock(monster)
  if (!parsed.ok) throw new Error(parsed.issues.map((entry) => entry.message).join('；'))
  return parsed.value
}

const WRAPPED_ACTION_DAMAGE_TYPES: readonly [RegExp, Dnd5eDamageType][] = [
  [/强酸|酸蚀|acid/i, 'acid'], [/钝击|bludgeoning/i, 'bludgeoning'],
  [/寒冷|cold/i, 'cold'], [/火焰|fire/i, 'fire'], [/力场|force/i, 'force'],
  [/闪电|lightning/i, 'lightning'], [/黯蚀|死灵|necrotic/i, 'necrotic'],
  [/穿刺|piercing/i, 'piercing'], [/毒素|poison/i, 'poison'], [/心灵|psychic/i, 'psychic'],
  [/光耀|radiant/i, 'radiant'], [/挥砍|slashing/i, 'slashing'], [/雷鸣|thunder/i, 'thunder'],
]

function repairWrappedActionDrafts(
  actions: readonly Dnd5eCustomMonsterActionDraft[],
): Dnd5eCustomMonsterActionDraft[] {
  const repaired: Dnd5eCustomMonsterActionDraft[] = []
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    const continuation = actions[index + 1]
    const continuationHeading = continuation?.name.match(
      /^([+−-]\s*\d+)\s*[,，]\s*(?:伤害|damage)$/i,
    )
    const canMerge = action.kind === 'weapon-attack' &&
      continuation?.kind === 'other' &&
      continuation.category === action.category &&
      /(?:命中|to hit)\s*$/i.test(action.description.trim()) &&
      !!continuationHeading &&
      /\d+\s*d\s*\d+/i.test(continuation.description)
    if (!canMerge || !continuation || !continuationHeading) {
      repaired.push(action)
      continue
    }
    const combinedDescription = `${action.description.trim()} ${continuation.name}：${continuation.description.trim()}`
    const dice = combinedDescription.match(/(\d+)\s*d\s*(\d+)(?:\s*([+−-])\s*(\d+))?/i)
    const damageType = WRAPPED_ACTION_DAMAGE_TYPES.find(([pattern]) => pattern.test(combinedDescription))?.[1]
    repaired.push({
      ...action,
      description: combinedDescription,
      toHit: Number(continuationHeading[1].replace(/\s+/g, '').replace('−', '-')),
      damageDice: dice
        ? `${dice[1]}d${dice[2]}${dice[3] ? `${dice[3].replace('−', '-')}${dice[4]}` : ''}`
        : action.damageDice,
      damageType: damageType ?? action.damageType,
      automation: 'headless',
    })
    index += 1
  }
  return repaired
}

export function dnd5eCustomMonsterDraftFromStatBlock(monster: Dnd5eMonsterStatBlock): Dnd5eCustomMonsterDraft {
  const actionGroups: readonly [
    Dnd5eCustomMonsterActionDraft['category'],
    readonly Dnd5eMonsterAction[],
  ][] = [
    ['action', monster.actions.filter((action) => action.kind !== 'multiattack')],
    ['bonus-action', monster.bonusActions ?? []],
    ['reaction', monster.reactions ?? []],
    ['legendary', monster.legendaryActions ?? []],
    ['lair', monster.lairActions ?? []],
  ]
  const mappedDraftActions: Dnd5eCustomMonsterActionDraft[] = actionGroups.flatMap(([category, entries]) =>
    entries.map((action) => {
      const damage = action.attack?.damage[0]
      const usage = action.usage
      const areaRule = action.rule?.kind === 'area-saving-throw' && !action.rule.variants && action.rule.damage
        ? action.rule
        : undefined
      const summonRule = action.rule?.kind === 'summon' ? action.rule : undefined
      const areaDamage = areaRule?.damage
      return {
        id: action.id,
        name: action.name,
        description: action.description,
        kind: action.kind === 'weapon-attack'
          ? 'weapon-attack'
          : areaRule
            ? 'area-saving-throw'
            : summonRule
              ? 'summon'
            : action.movement
              ? 'movement'
              : 'other',
        automation: action.automation ?? (action.kind === 'weapon-attack' ? 'headless' : 'dm-adjudication'),
        mode: action.attack?.mode ?? 'melee',
        toHit: action.attack?.toHit ?? 0,
        reachFeet: action.attack?.reachFeet ?? 5,
        rangeNormal: action.attack?.rangeFeet?.normal ?? 30,
        rangeLong: action.attack?.rangeFeet?.long ?? 120,
        damageDice: damage ? `${damage.count}d${damage.sides}${(damage.workshopFixedBonus ?? damage.bonus) === 0 ? '' : (damage.workshopFixedBonus ?? damage.bonus) > 0 ? `+${damage.workshopFixedBonus ?? damage.bonus}` : damage.workshopFixedBonus ?? damage.bonus}` : '1d4',
        damageModifierFormula: damage?.modifierFormula,
        damageType: damage?.type ?? 'bludgeoning',
        additionalDamage: (action.attack?.damage.slice(1) ?? []).map((component) => ({
          id: `damage-${uid().slice(0, 8)}`,
          dice: `${component.count}d${component.sides}${(component.workshopFixedBonus ?? component.bonus) === 0 ? '' : (component.workshopFixedBonus ?? component.bonus) > 0 ? `+${component.workshopFixedBonus ?? component.bonus}` : component.workshopFixedBonus ?? component.bonus}`,
          damageType: component.type,
          modifierFormula: component.modifierFormula,
        })),
        criticalThreshold: action.attack?.criticalThreshold ?? 20,
        criticalExtraDamage: (action.attack?.criticalExtraDamage ?? []).map((component) => ({
          id: `critical-damage-${uid().slice(0, 8)}`,
          dice: `${component.count}d${component.sides}${component.bonus === 0 ? '' : component.bonus > 0 ? `+${component.bonus}` : component.bonus}`,
          damageType: component.type,
        })),
        onHitSaveEnabled: action.attack?.onHitRule?.kind === 'saving-throw-condition',
        onHitSaveAbility: action.attack?.onHitRule?.ability ?? 'str',
        onHitSaveDc: action.attack?.onHitRule?.dc ?? 12,
        onHitCondition: action.attack?.onHitRule?.condition ?? 'prone',
        attacksPerAction: category === 'action'
          ? Math.max(1, monster.actions.find((candidate) => candidate.kind === 'multiattack')?.sequence?.filter((id) => id === action.id).length ?? 1)
          : 1,
        category,
        usageKind: usage?.kind ?? 'at-will',
        usageMax: usage?.kind === 'per-day' ? usage.max : 1,
        rechargeMinimum: usage?.kind === 'recharge' ? usage.minimum : 5,
        rechargeDieSides: usage?.kind === 'recharge' ? usage.dieSides : 6,
        legendaryCost: action.legendaryCost ?? 1,
        referencedActionId: action.referencedActionId ?? '',
        movementSpeedFraction: action.movement?.maximumSpeedFraction ?? 0.5,
        reactionTriggerActionId: action.reactionTrigger?.actionId ?? '',
        areaShape: areaRule?.area.shape === 'circle'
          ? 'circle'
          : areaRule?.area.shape === 'line'
            ? 'line'
            : 'cone',
        areaSizeFeet: areaRule?.area.shape === 'circle'
          ? areaRule.area.radiusFeet
          : areaRule?.area.shape === 'line' || areaRule?.area.shape === 'cone'
            ? areaRule.area.lengthFeet
            : 15,
        areaWidthFeet: areaRule?.area.shape === 'line' ? areaRule.area.widthFeet : 5,
        areaSaveAbility: areaRule?.ability ?? 'dex',
        areaSaveAbilityChoices: areaRule?.targetAbilityChoices
          ? [...areaRule.targetAbilityChoices]
          : [],
        areaSaveDc: areaRule?.dc ?? 12,
        areaDamageDice: areaDamage
          ? `${areaDamage.count}d${areaDamage.sides}${(areaDamage.workshopFixedBonus ?? areaDamage.bonus) === 0 ? '' : (areaDamage.workshopFixedBonus ?? areaDamage.bonus) > 0 ? `+${areaDamage.workshopFixedBonus ?? areaDamage.bonus}` : areaDamage.workshopFixedBonus ?? areaDamage.bonus}`
          : '2d6',
        areaDamageModifierFormula: areaDamage?.modifierFormula,
        areaDamageType: areaDamage?.type ?? '',
        areaDamageOnSuccessfulSave: areaRule?.damageOnSuccessfulSave ?? 'none',
        areaTarget: areaRule?.target ?? 'all-creatures-except-self',
        areaMagical: areaRule?.magical ?? false,
        summonMonsterId: summonRule?.monsterId ?? '',
        summonCountMode: summonRule?.count.kind ?? 'fixed',
        summonCount: summonRule?.count.kind === 'fixed' ? summonRule.count.value : 1,
        summonCountDice: summonRule?.count.kind === 'dice'
          ? `${summonRule.count.count}d${summonRule.count.sides}${summonRule.count.bonus === 0 ? '' : summonRule.count.bonus > 0 ? `+${summonRule.count.bonus}` : summonRule.count.bonus}`
          : '1d3',
        summonDurationRounds: summonRule?.durationRounds ?? 10,
        summonTiming: summonRule?.timing ?? 'immediate',
        summonConcentration: summonRule?.concentration ?? false,
        summonConcentrationEndsOnAppearance: summonRule?.concentrationEndsOnAppearance ?? false,
        summonSide: summonRule?.side ?? 'ally',
        preservedAction: structuredClone(action),
      }
    }),
  )
  const draftActions = repairWrappedActionDrafts(mappedDraftActions)
  return {
    preservedStatBlock: structuredClone(monster),
    preservedMultiattacks: monster.actions
      .filter((action) => action.kind === 'multiattack')
      .map((action) => structuredClone(action)),
    id: monster.id,
    slug: monster.slug,
    name: monster.name,
    englishName: monster.englishName,
    size: monster.size,
    creatureType: monster.creatureType,
    alignment: monster.alignment,
    armorClass: monster.armorClass.value,
    armorClassNote: monster.armorClass.note ?? '',
    hitPointsAverage: monster.hitPoints.average,
    hitPointsDice: monster.hitPoints.dice,
    walk: monster.speed.walk,
    fly: monster.speed.fly ?? 0,
    swim: monster.speed.swim ?? 0,
    climb: monster.speed.climb ?? 0,
    burrow: monster.speed.burrow ?? 0,
    hover: monster.speed.hover ?? false,
    abilities: { ...monster.abilities },
    savingThrows: { ...(monster.savingThrows ?? {}) },
    skills: (monster.skills ?? [])
      .filter((skill, index, skills) => skills.findIndex((candidate) => candidate.key === skill.key) === index)
      .map((skill) => ({
        id: `skill-${uid().slice(0, 8)}`,
        ...skill,
        name: DND5E_SKILL_LABEL_BY_KEY.get(skill.key) ?? skill.name,
      })),
    senses: monster.senses
      .filter((sense) => !monster.traits.some((trait) =>
        trait.rule?.kind === 'keen-sense' &&
        sense.name === '盲视' &&
        sense.distanceFeet === trait.rule.blindsightFeet))
      .map((sense) => ({ id: `sense-${uid().slice(0, 8)}`, ...sense })),
    damageVulnerabilities: [...(monster.damageVulnerabilities ?? [])],
    damageResistances: [...(monster.damageResistances ?? [])],
    damageImmunities: [...(monster.damageImmunities ?? [])],
    damageDefenseRules: monster.damageDefenseRules?.map((rule) =>
      structuredClone(rule)),
    unparsedDamageDefenses: monster.unparsedDamageDefenses?.map((defense) =>
      structuredClone(defense)),
    conditionImmunities: (monster.conditionImmunities ?? [])
      .filter((condition): condition is Dnd5eStandardConditionId =>
        Object.values(DND5E_STANDARD_CONDITIONS).some((definition) => definition.id === condition)),
    tokenStatusMarkerGrants: (monster.tokenStatusMarkerGrants ?? []).map((grant) => ({ ...grant })),
    passivePerception: monster.passivePerception,
    languages: monster.languages.join('、'),
    challengeRating: monster.challenge.rating,
    xp: monster.challenge.xp,
    description: monster.description,
    portrait: monster.portrait,
    tokenPortrait: monster.tokenPortrait,
    initiativePortrait: monster.initiativePortrait,
    equipment: (monster.equipment ?? []).map((item) => ({
      ...item,
      description: item.description ?? '',
      linkedActionId: item.linkedActionId ?? '',
    })),
    legendaryResistanceUses: monster.legendaryResistanceUses ?? 0,
    legendaryActionPoints: monster.legendaryActionPoints ?? 3,
    lairInitiative: monster.lairInitiative ?? 20,
    spellcastingEnabled: !!monster.spellcasting,
    spellcastingDescription: monster.spellcasting?.description ?? '',
    spellcastingCasterLevel: monster.spellcasting?.casterLevel ?? 1,
    spellcastingAbility: monster.spellcasting?.ability ?? 'int',
    spellcastingSaveDc: monster.spellcasting?.saveDc ?? 11,
    spellcastingAttackBonus: monster.spellcasting?.attackBonus ?? 3,
    spellSlots: { ...(monster.spellcasting?.slots ?? {}) },
    spells: (monster.spellcasting?.spells ?? []).map((spell) => ({
      id: spell.id,
      name: spell.name,
      level: spell.level,
      usageKind: spell.usage?.kind ?? 'slots',
      usageMax: spell.usage?.kind === 'per-day' ? spell.usage.max : 1,
    })),
    spellcastingAutomation: monster.spellcasting?.automation ?? 'dm-adjudication',
    targetingPriority: monster.targetingPreference?.priority ?? 'nearest',
    headlessMechanics: (monster.headlessMechanics ?? []).map((mechanic) => {
      const effect = mechanic.schemaVersion === 1
        ? { id: 'effect-0', kind: 'healing' as const, target: 'self' as const, dice: mechanic.effect.dice }
        : mechanic.effects[0]
      const dice = effect?.kind === 'attack'
        ? effect.damage
        : effect && 'dice' in effect
          ? effect.dice
          : { count: 2, sides: 6, bonus: 0 }
      const duration = effect?.kind === 'standard-condition' || effect?.kind === 'tactical-status' || effect?.kind === 'equipment-modifier'
        ? effect.duration
        : { kind: 'rounds' as const, rounds: 1 }
      return {
        id: mechanic.id,
        name: mechanic.name,
        trigger: mechanic.schemaVersion === 1 ? mechanic.event : mechanic.trigger.event,
        triggerSubject: mechanic.schemaVersion === 2 ? mechanic.trigger.subject ?? 'self' : 'self',
        triggerRadiusFeet: mechanic.schemaVersion === 2 ? mechanic.trigger.radiusFeet ?? 30 : 30,
        triggerAttackMode: mechanic.schemaVersion === 2 ? mechanic.trigger.attackMode ?? 'any' : 'any',
        triggerDamageTypes: mechanic.schemaVersion === 2 ? [...(mechanic.trigger.damageTypes ?? [])] : [],
        savingThrowTiming: mechanic.schemaVersion === 2
          ? mechanic.trigger.savingThrowTiming ?? (
              effect?.kind === 'roll-modifier' && effect.roll === 'saving-throw' ? 'before' : 'after'
            )
          : 'before',
        savingThrowOutcome: mechanic.schemaVersion === 2 ? mechanic.trigger.savingThrowOutcome ?? 'any' : 'any',
        movementComparison: mechanic.schemaVersion === 2
          ? mechanic.trigger.movement?.comparison ?? 'at-least'
          : 'at-least',
        movementFeet: mechanic.schemaVersion === 2 ? mechanic.trigger.movement?.feet ?? 20 : 20,
        hpPercentageAtOrBelow: mechanic.predicates.hpPercentageAtOrBelow,
        hpPercentageAtOrAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpPercentageAtOrAbove : undefined,
        hpBelow: mechanic.schemaVersion === 2 ? mechanic.predicates.hpBelow : undefined,
        hpAtOrBelow: mechanic.schemaVersion === 2 ? mechanic.predicates.hpAtOrBelow : undefined,
        hpAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpAbove : undefined,
        hpAtOrAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpAtOrAbove : undefined,
        requiresPositiveHp: mechanic.predicates.requiresPositiveHp,
        effectKind: effect?.kind ?? 'healing',
        effectTarget: effect && 'target' in effect ? effect.target : 'self',
        healingDice: `${dice.count}d${dice.sides}${dice.bonus === 0 ? '' : dice.bonus > 0 ? `+${dice.bonus}` : dice.bonus}`,
        damageType: effect?.kind === 'attack'
          ? effect.damage.type
          : effect && 'damageType' in effect
            ? effect.damageType
            : 'necrotic',
        condition: effect?.kind === 'standard-condition' || effect?.kind === 'remove-standard-condition'
          ? effect.condition
          : 'frightened',
        statusMarkerId: effect?.kind === 'tactical-status' ? effect.statusId : 'marked',
        durationKind: duration.kind,
        durationRounds: duration.kind === 'rounds' ? duration.rounds : 1,
        summonMonsterId: effect?.kind === 'summon' ? effect.monsterId : 'srd-5.1:wolf',
        summonCount: effect?.kind === 'summon' ? effect.count : 1,
        summonDurationRounds: effect?.kind === 'summon' ? effect.durationRounds : 10,
        areaShape: effect?.kind === 'area-attack' ? effect.shape : 'circle',
        areaRangeFeet: effect?.kind === 'area-attack' ? effect.rangeFeet : 60,
        areaSizeFeet: effect?.kind === 'area-attack' ? effect.sizeFeet : 15,
        modifierRoll: effect?.kind === 'roll-modifier' ? effect.roll : 'attack',
        modifierMode: effect?.kind === 'roll-modifier' ? effect.mode : 'bonus',
        modifierBonus: effect?.kind === 'roll-modifier' ? effect.bonus ?? 0 : 2,
        damageReplacementOperation: effect?.kind === 'damage-replacement' ? effect.operation : 'halve',
        damageReplacementAmount: effect?.kind === 'damage-replacement' ? effect.amount ?? 0 : 0,
        attackMode: effect?.kind === 'attack' ? effect.attackMode ?? 'melee' : 'melee',
        attackToHit: effect?.kind === 'attack' ? effect.toHit : 5,
        attackEconomy: effect?.kind === 'attack' ? effect.economy ?? 'none' : 'reaction',
        attackDamageMode: effect?.kind === 'attack' && effect.damage.count === 0 ? 'fixed' : 'dice',
        attackFixedDamage: effect?.kind === 'attack' ? effect.damage.average : 8,
        actionGrantResource: effect?.kind === 'action-grant' ? effect.resource : 'action',
        equipmentModifierEquipment: effect?.kind === 'equipment-modifier' ? effect.equipment : 'armor',
        equipmentModifierOperation: effect?.kind === 'equipment-modifier' ? effect.operation : 'armor-class-bonus',
        equipmentModifierBonus: effect?.kind === 'equipment-modifier' ? effect.bonus : 1,
        equipmentModifierEquipmentId: effect?.kind === 'equipment-modifier' ? effect.equipmentId ?? '' : '',
        limit: mechanic.limit,
        automation: mechanic.schemaVersion === 1 ? 'full' : mechanic.automation,
        preservedEffects: mechanic.schemaVersion === 1
          ? undefined
          : mechanic.effects.map((entry) => structuredClone(entry)),
      }
    }),
    traits: monster.traits.map((trait) => ({
      ...createDnd5eCustomMonsterTraitDraft(),
      name: trait.name,
      description: trait.description,
      automation: trait.automation ?? 'dm-adjudication',
      preservedTrait: structuredClone(trait),
      ruleKind: (() => {
        const kind = trait.rule?.kind
        if (kind === 'turn-start-saving-throw-aura') {
          return trait.rule?.ruleId === 'stench' ? 'stench' : 'none'
        }
        return kind === 'undead-fortitude' ||
          kind === 'regeneration' ||
          kind === 'swarm' ||
          kind === 'nimble-escape' ||
          kind === 'keen-sense' ||
          kind === 'ambusher' ||
          kind === 'charge-damage' ||
          kind === 'relentless' ||
          kind === 'sneak-attack' ||
          kind === 'surprise-attack' ||
          kind === 'magic-resistance' ||
          kind === 'limited-magic-immunity' ||
          kind === 'magic-weapons' ||
          kind === 'pack-tactics' ||
          kind === 'conditional-target-bonus'
          ? kind
          : 'none'
      })(),
      amount: trait.rule?.kind === 'regeneration' ? trait.rule.amount : 10,
      dcBase: trait.rule?.kind === 'undead-fortitude' ? trait.rule.dcBase : 5,
      damageTypes: trait.rule?.kind === 'regeneration'
        ? [...trait.rule.suppressedByDamageTypes]
        : trait.rule?.kind === 'undead-fortitude'
          ? [...trait.rule.excludedDamageTypes]
          : [],
      requiresPositiveHp: trait.rule?.kind === 'regeneration' ? trait.rule.requiresPositiveHp : true,
      excludedOnCritical: trait.rule?.kind === 'undead-fortitude' ? trait.rule.excludedOnCritical : true,
      diesAtZeroWhenSuppressed: trait.rule?.kind === 'regeneration' ? trait.rule.diesAtZeroWhenSuppressed : true,
      keenSense: trait.rule?.kind === 'keen-sense' ? trait.rule.sense : 'smell',
      keenSenseSkillKey: trait.rule?.kind === 'keen-sense' ? trait.rule.skillKey : 'perception',
      keenSenseCheckBonus: trait.rule?.kind === 'keen-sense' ? trait.rule.checkBonus : 4,
      keenSenseBlindsightFeet: trait.rule?.kind === 'keen-sense' ? trait.rule.blindsightFeet ?? 0 : 10,
      chargeMinimumFeet: trait.rule?.kind === 'charge-damage'
        ? trait.rule.minimumStraightMovementFeet
        : 20,
      chargeActionId: trait.rule?.kind === 'charge-damage' ? trait.rule.actionId : '',
      chargeDamageDice: trait.rule?.kind === 'charge-damage'
        ? `${trait.rule.extraDamage?.count ?? 2}d${trait.rule.extraDamage?.sides ?? 10}${
            (trait.rule.extraDamage?.bonus ?? 0) === 0
              ? ''
              : (trait.rule.extraDamage?.bonus ?? 0) > 0
                ? `+${trait.rule.extraDamage?.bonus ?? 0}`
                : trait.rule.extraDamage?.bonus ?? 0
          }`
        : '2d10',
      chargeDamageType: trait.rule?.kind === 'charge-damage'
        ? trait.rule.extraDamage?.type ?? 'piercing'
        : 'piercing',
      chargeSaveEnabled: trait.rule?.kind === 'charge-damage' && trait.rule.savingThrowOnHit != null,
      chargeSaveAbility: trait.rule?.kind === 'charge-damage'
        ? trait.rule.savingThrowOnHit?.ability ?? 'str'
        : 'str',
      chargeSaveDc: trait.rule?.kind === 'charge-damage'
        ? trait.rule.savingThrowOnHit?.dc ?? 13
        : 13,
      chargeSaveCondition: trait.rule?.kind === 'charge-damage'
        ? trait.rule.savingThrowOnHit?.conditionOnFailedSave ?? 'prone'
        : 'prone',
      relentlessMaximumDamage: trait.rule?.kind === 'relentless'
        ? trait.rule.maximumDamage
        : 10,
      sneakAttackDamageDice: trait.rule?.kind === 'sneak-attack'
        ? `${trait.rule.extraDamage.count}d${trait.rule.extraDamage.sides}${
            trait.rule.extraDamage.bonus === 0
              ? ''
              : trait.rule.extraDamage.bonus > 0
                ? `+${trait.rule.extraDamage.bonus}`
                : trait.rule.extraDamage.bonus
          }`
        : '2d6',
      surpriseAttackDamageDice: trait.rule?.kind === 'surprise-attack'
        ? `${trait.rule.extraDamage.count}d${trait.rule.extraDamage.sides}${
            trait.rule.extraDamage.bonus === 0
              ? ''
              : trait.rule.extraDamage.bonus > 0
                ? `+${trait.rule.extraDamage.bonus}`
                : trait.rule.extraDamage.bonus
          }`
        : '2d6',
      stenchRangeFeet: trait.rule?.kind === 'turn-start-saving-throw-aura' && trait.rule.ruleId === 'stench'
        ? trait.rule.rangeFeet
        : 10,
      stenchSaveDc: trait.rule?.kind === 'turn-start-saving-throw-aura' && trait.rule.ruleId === 'stench'
        ? trait.rule.dc
        : 13,
      limitedMagicImmunityMaximumSpellLevel: trait.rule?.kind === 'limited-magic-immunity'
        ? trait.rule.maximumSpellLevel
        : 6,
      limitedMagicImmunityAdvantageAboveMaximum: trait.rule?.kind === 'limited-magic-immunity'
        ? trait.rule.advantageAboveMaximum
        : true,
      limitedMagicImmunityAllowsWilling: trait.rule?.kind === 'limited-magic-immunity'
        ? trait.rule.allowsWilling
        : true,
      targetBonusConditions: trait.rule?.kind === 'conditional-target-bonus'
        ? [...trait.rule.targetConditions]
        : ['frightened', 'stunned'],
      targetAttackBonus: trait.rule?.kind === 'conditional-target-bonus' ? trait.rule.attackBonus : 2,
      targetDamageBonus: trait.rule?.kind === 'conditional-target-bonus' ? trait.rule.damageBonus : 2,
    })),
    actions: draftActions,
  }
}

export { DND5E_DAMAGE_TYPES }
