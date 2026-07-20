import { useMemo, useState } from 'react'
import { Download, FolderOpen, Plus, Save, Trash2 } from 'lucide-react'
import { ABILITIES, SKILLS, type AbilityKey } from '../../lib/dnd'
import {
  buildDnd5eCustomRulesPluginSource,
  DND5E_DAMAGE_TYPES,
  DND5E_SRD_MONSTERS,
  DND5E_STANDARD_CONDITIONS,
  dnd5eCustomRulesPluginFileName,
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomHeadlessActionDraft,
  type Dnd5eCustomRulesPluginDraft,
  type Dnd5eDamageType,
  type Dnd5ePluginAbilityGenerationDefinition,
  type Dnd5ePluginBackgroundDefinition,
  type Dnd5ePluginFeatureDefinition,
  type Dnd5ePluginItemDefinition,
  type Dnd5ePluginRaceDefinition,
  type Dnd5ePluginSpellDefinition,
} from '../../rulesets/dnd5e'

interface RaceDraft {
  id: string
  name: string
  description: string
  speedFeet: number
  abilityBonuses: Record<AbilityKey, number>
  flexibleCount: number
  flexibleAmount: number
  flexibleExclude: AbilityKey[]
}

interface MethodDraft {
  id: string
  name: string
  summary: string
  kind: 'standard-array' | 'point-buy' | 'roll'
  scores: string
  budget: number
  minimum: number
  maximum: number
  costs: string
  diceCount: number
  dieSides: number
  dropLowest: number
}

interface BackgroundDraft {
  id: string
  name: string
  description: string
  skillProficiencies: string[]
  toolProficiencies: string
  languages: number
  featureName: string
  featureDescription: string
}

interface FeatureDraft {
  id: string
  name: string
  summary: string
  description: string
  minimumLevel: number
  headless: HeadlessEffectEditorDraft
}

interface HeadlessEffectEditorDraft {
  enabled: boolean
  actionLabel: string
  economy: 'action' | 'bonusAction' | 'reaction' | 'none'
  targetingKind: 'self' | 'single-creature' | 'area'
  relation: 'any' | 'ally' | 'enemy'
  includeSelf: boolean
  rangeFeet: number
  areaShape: 'circle' | 'cone' | 'line' | 'rect'
  areaRadiusFeet: number
  areaWidthFeet: number
  areaHeightFeet: number
  areaLengthFeet: number
  maximumTargets: number
  summonEnabled: boolean
  summonMonsterId: string
  summonLabel: string
  summonDurationRounds: number
  summonConcentration: boolean
  summonSide: 'ally' | 'enemy'
  damageEnabled: boolean
  damageCount: number
  damageSides: number
  damageModifier: number
  damageType: Dnd5eDamageType
  healingEnabled: boolean
  healingCount: number
  healingSides: number
  healingModifier: number
  conditionEnabled: boolean
  condition: keyof typeof DND5E_STANDARD_CONDITIONS
  conditionExpiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
  conditionRounds: number
  conditionSaveAbility: AbilityKey
  conditionSaveDc: number
  interruptEnabled: boolean
  interruptAudience: 'actor' | 'target' | 'dm'
  interruptPrompt: string
  interruptTimeoutSeconds: number
}

interface SpellDraft {
  id: string
  name: string
  englishName: string
  level: number
  school: Dnd5ePluginSpellDefinition['school']
  classes: Dnd5ePluginSpellDefinition['classes']
  ritual: boolean
  castingTimeUnit: Dnd5ePluginSpellDefinition['castingTime']['unit']
  castingTimeValue: number
  reactionTrigger: string
  rangeType: Dnd5ePluginSpellDefinition['range']['type']
  rangeFeet: number
  verbal: boolean
  somatic: boolean
  material: boolean
  materialText: string
  durationType: Dnd5ePluginSpellDefinition['duration']['type']
  durationValue: number
  durationUnit: NonNullable<Dnd5ePluginSpellDefinition['duration']['unit']>
  concentration: boolean
  description: string
  higherLevels: string
  resolution: 'spell-attack' | 'saving-throw' | 'automatic'
  saveAbility: AbilityKey
  saveOnSuccess: 'none' | 'half' | 'full'
  upcastDamageDicePerLevel: number
  headless: HeadlessEffectEditorDraft
}

interface ItemDraft {
  id: string
  name: string
  description: string
  rulesText: string
  kind: 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable'
  slot: 'mainWeapon' | 'offHand' | 'armor' | 'helmet' | 'shoes' | 'ring' | 'necklace'
  weaponMode: 'melee' | 'ranged'
  weaponCategory: 'simple' | 'martial'
  attackAbility: 'str' | 'dex' | 'finesse'
  damageCount: number
  damageSides: number
  damageType: 'slashing' | 'piercing' | 'bludgeoning'
  reachFeet: number
  rangeNormal: number
  rangeLong: number
  armorCategory: 'light' | 'medium' | 'heavy'
  baseArmorClass: number
  dexterityBonus: 'full' | 'max-2' | 'none'
  shieldBonus: number
  weaponAttackBonus: number
  weaponDamageBonus: number
  armorClassBonus: number
  savingThrowBonus: number
  speedBonusFeet: number
  healingCount: number
  healingSides: number
  healingBonus: number
  attackRerollEnabled: boolean
  attackRerollCharges: number
  attackRerollResetOn: 'none' | 'short-rest' | 'long-rest' | 'dawn'
}

type BuilderSection = 'races' | 'backgrounds' | 'features' | 'spells' | 'items' | 'methods'

interface SavedBuilderDraft {
  metadata: { id: string; name: string; version: string; publisher: string; license: string; description: string }
  races: RaceDraft[]
  backgrounds: BackgroundDraft[]
  features: FeatureDraft[]
  spells: SpellDraft[]
  items: ItemDraft[]
  methods: MethodDraft[]
}

const DRAFT_STORAGE_KEY = 'dndstars5e:custom-rules-workshop:v1'
const SPELL_SCHOOLS = [['abjuration', '防护'], ['conjuration', '咒法'], ['divination', '预言'], ['enchantment', '惑控'], ['evocation', '塑能'], ['illusion', '幻术'], ['necromancy', '死灵'], ['transmutation', '变化']] as const
const CASTING_UNITS = [['action', '动作'], ['bonus-action', '附赠动作'], ['reaction', '反应'], ['minute', '分钟'], ['hour', '小时']] as const
const RANGE_TYPES = [['self', '自身'], ['touch', '触及'], ['distance', '距离'], ['sight', '视线'], ['unlimited', '无限'], ['special', '特殊']] as const
const DURATION_TYPES = [['instantaneous', '立即'], ['timed', '计时'], ['until-dispelled', '直到被解除'], ['special', '特殊']] as const
const DURATION_UNITS = [['round', '轮'], ['minute', '分钟'], ['hour', '小时'], ['day', '日']] as const
const SPELL_CLASSES = [['bard', '吟游诗人'], ['cleric', '牧师'], ['druid', '德鲁伊'], ['paladin', '圣武士'], ['ranger', '游侠'], ['sorcerer', '术士'], ['warlock', '邪术师'], ['wizard', '法师']] as const
const ITEM_KINDS = [['weapon', '武器'], ['armor', '护甲'], ['shield', '盾牌'], ['accessory', '饰品／其他装备'], ['consumable', '治疗消耗品']] as const
const EQUIPMENT_SLOTS = [['mainWeapon', '主手'], ['offHand', '副手'], ['armor', '护甲'], ['helmet', '头部'], ['shoes', '足部'], ['ring', '戒指'], ['necklace', '颈部']] as const
const WEAPON_CATEGORIES = [['simple', '简易武器'], ['martial', '军用武器']] as const
const WEAPON_MODES = [['melee', '近战'], ['ranged', '远程']] as const
const ATTACK_ABILITIES = [['str', '力量'], ['dex', '敏捷'], ['finesse', '灵巧（取高）']] as const
const WEAPON_DAMAGE_TYPES = [['slashing', '挥砍'], ['piercing', '穿刺'], ['bludgeoning', '钝击']] as const
const ARMOR_CATEGORIES = [['light', '轻甲'], ['medium', '中甲'], ['heavy', '重甲']] as const
const DEXTERITY_BONUSES = [['full', '完整敏捷调整'], ['max-2', '敏捷最高 +2'], ['none', '不加敏捷']] as const
const ACTION_ECONOMIES = [['action', '动作'], ['bonusAction', '附赠动作'], ['reaction', '反应'], ['none', '免费行动']] as const
const TARGETING_KINDS = [['self', '自身'], ['single-creature', '单一生物'], ['area', '范围模板']] as const
const TARGET_RELATIONS = [['enemy', '敌方'], ['ally', '友方'], ['any', '任意']] as const
const AREA_SHAPES = [['circle', '圆形'], ['cone', '锥形'], ['line', '线形'], ['rect', '矩形']] as const
const INTERRUPT_AUDIENCES = [['dm', 'DM'], ['actor', '行动者'], ['target', '目标']] as const
const CONDITION_EXPIRATIONS = [
  ['source-next-turn-start', '来源下回合开始'],
  ['target-next-turn-start', '目标下回合开始'],
  ['target-turn-end', '目标回合结束'],
  ['target-turn-end-save', '目标回合结束重复豁免'],
] as const
const DAMAGE_TYPE_LABELS: Record<Dnd5eDamageType, string> = {
  acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场',
  lightning: '闪电', necrotic: '黯蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵',
  radiant: '光耀', slashing: '挥砍', thunder: '雷鸣',
}
const HEADLESS_DAMAGE_TYPES = DND5E_DAMAGE_TYPES.map((id) => [id, DAMAGE_TYPE_LABELS[id]] as const)
const SUMMON_MONSTERS = DND5E_SRD_MONSTERS.map((monster) => [monster.id, `${monster.name}（CR ${monster.challenge.rating}）`] as const)
const HEADLESS_CONDITIONS = Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => [condition.id, condition.label] as const)

interface Props {
  defaultPublisher?: string
  busy?: boolean
  onInstall(file: File): Promise<void>
}

const emptyBonuses = (): Record<AbilityKey, number> => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })

function newRace(index: number): RaceDraft {
  return {
    id: `custom-race-${index}`,
    name: `自定义种族 ${index}`,
    description: '',
    speedFeet: 30,
    abilityBonuses: emptyBonuses(),
    flexibleCount: 0,
    flexibleAmount: 1,
    flexibleExclude: [],
  }
}

function newMethod(index: number): MethodDraft {
  return {
    id: `custom-method-${index}`,
    name: `自定义加点 ${index}`,
    summary: '由房间 DM 配置的属性生成规则。',
    kind: 'standard-array',
    scores: '15, 14, 13, 12, 10, 8',
    budget: 27,
    minimum: 8,
    maximum: 15,
    costs: '8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9',
    diceCount: 4,
    dieSides: 6,
    dropLowest: 1,
  }
}

function newBackground(index: number): BackgroundDraft {
  return {
    id: `custom-background-${index}`, name: `自定义背景 ${index}`, description: '',
    skillProficiencies: [], toolProficiencies: '', languages: 0,
    featureName: '', featureDescription: '',
  }
}

function newFeature(index: number): FeatureDraft {
  return {
    id: `custom-feature-${index}`, name: `自定义特性 ${index}`,
    summary: '由 DM 提供的自定义特性。', description: '', minimumLevel: 1,
    headless: newHeadlessEffectDraft(),
  }
}

function newHeadlessEffectDraft(): HeadlessEffectEditorDraft {
  return {
      enabled: false,
      actionLabel: '使用特性', economy: 'action', targetingKind: 'single-creature',
      relation: 'enemy', includeSelf: false, rangeFeet: 60,
      areaShape: 'circle', areaRadiusFeet: 10, areaWidthFeet: 10, areaHeightFeet: 10,
      areaLengthFeet: 30, maximumTargets: 16,
      summonEnabled: false, summonMonsterId: 'srd-5.1:wolf', summonLabel: '',
      summonDurationRounds: 10, summonConcentration: true, summonSide: 'ally',
      damageEnabled: true, damageCount: 1, damageSides: 6, damageModifier: 0, damageType: 'force',
      healingEnabled: false, healingCount: 1, healingSides: 8, healingModifier: 0,
      conditionEnabled: false, condition: 'prone', conditionExpiresAt: 'target-turn-end',
      conditionRounds: 1, conditionSaveAbility: 'con', conditionSaveDc: 10,
      interruptEnabled: false, interruptAudience: 'dm',
      interruptPrompt: '是否允许结算这项自定义效果？', interruptTimeoutSeconds: 30,
  }
}

function restoreFeatureDraft(value: Partial<FeatureDraft>, index: number): FeatureDraft {
  const fallback = newFeature(index + 1)
  return {
    ...fallback,
    ...value,
    headless: { ...fallback.headless, ...(value.headless ?? {}) },
  }
}

function newSpell(index: number): SpellDraft {
  return {
    id: `custom-spell-${index}`, name: `自定义法术 ${index}`, englishName: '', level: 1,
    school: 'evocation', classes: ['wizard'], ritual: false,
    castingTimeUnit: 'action', castingTimeValue: 1, reactionTrigger: '', rangeType: 'distance', rangeFeet: 60,
    verbal: true, somatic: true, material: false, materialText: '',
    durationType: 'instantaneous', durationValue: 1, durationUnit: 'round', concentration: false,
    description: '', higherLevels: '', resolution: 'spell-attack', saveAbility: 'dex', saveOnSuccess: 'half',
    upcastDamageDicePerLevel: 1, headless: { ...newHeadlessEffectDraft(), actionLabel: '施放法术' },
  }
}

function newItem(index: number): ItemDraft {
  return {
    id: `custom-item-${index}`, name: `自定义武器 ${index}`, description: '', rulesText: '',
    kind: 'weapon', slot: 'mainWeapon', weaponMode: 'melee', weaponCategory: 'martial',
    attackAbility: 'str', damageCount: 1, damageSides: 8, damageType: 'slashing',
    reachFeet: 5, rangeNormal: 20, rangeLong: 60,
    armorCategory: 'light', baseArmorClass: 11, dexterityBonus: 'full', shieldBonus: 2,
    weaponAttackBonus: 0, weaponDamageBonus: 0, armorClassBonus: 0,
    savingThrowBonus: 0, speedBonusFeet: 0,
    healingCount: 1, healingSides: 4, healingBonus: 0,
    attackRerollEnabled: false, attackRerollCharges: 4, attackRerollResetOn: 'long-rest',
  }
}

function restoreSpellDraft(value: Partial<SpellDraft>, index: number): SpellDraft {
  const fallback = newSpell(index + 1)
  return { ...fallback, ...value, headless: { ...fallback.headless, ...(value.headless ?? {}) } }
}

function restoreItemDraft(value: Partial<ItemDraft>, index: number): ItemDraft {
  return { ...newItem(index + 1), ...value }
}

function numericList(value: string): number[] {
  return value.split(/[，,\s]+/).filter(Boolean).map(Number)
}

function costTable(value: string): Record<number, number> {
  const result: Record<number, number> = {}
  for (const entry of value.split(/[，,]+/)) {
    const [score, cost] = entry.trim().split(/[:：]/).map(Number)
    if (Number.isFinite(score) && Number.isFinite(cost)) result[score] = cost
  }
  return result
}

function toRaceDefinition(race: RaceDraft): Dnd5ePluginRaceDefinition {
  const abilityBonuses = Object.fromEntries(
    ABILITIES.flatMap(({ key }) => race.abilityBonuses[key] === 0 ? [] : [[key, race.abilityBonuses[key]]]),
  ) as Partial<Record<AbilityKey, number>>
  return {
    id: race.id.trim(),
    name: race.name.trim(),
    description: race.description.trim(),
    speedFeet: race.speedFeet,
    abilityBonuses,
    ...(race.flexibleCount > 0 ? {
      flexibleAbilityBonus: {
        count: race.flexibleCount,
        amount: race.flexibleAmount,
        ...(race.flexibleExclude.length > 0 ? { exclude: race.flexibleExclude } : {}),
      },
    } : {}),
  }
}

function toMethodDefinition(method: MethodDraft): Dnd5ePluginAbilityGenerationDefinition {
  const base = { id: method.id.trim(), name: method.name.trim(), summary: method.summary.trim() }
  if (method.kind === 'standard-array') return { ...base, kind: 'standard-array', scores: numericList(method.scores) }
  if (method.kind === 'point-buy') return {
    ...base,
    kind: 'point-buy',
    budget: method.budget,
    minimum: method.minimum,
    maximum: method.maximum,
    costs: costTable(method.costs),
  }
  return {
    ...base,
    kind: 'roll',
    diceCount: method.diceCount,
    dieSides: method.dieSides,
    dropLowest: method.dropLowest,
  }
}

function toBackgroundDefinition(background: BackgroundDraft): Dnd5ePluginBackgroundDefinition {
  const tools = background.toolProficiencies.split(/[，,]+/).map((value) => value.trim()).filter(Boolean)
  return {
    id: background.id.trim(), name: background.name.trim(), description: background.description.trim(),
    skillProficiencies: [...background.skillProficiencies],
    ...(tools.length > 0 ? { toolProficiencies: tools } : {}),
    ...(background.languages > 0 ? { languages: background.languages } : {}),
    ...(background.featureName.trim() && background.featureDescription.trim() ? {
      feature: { name: background.featureName.trim(), description: background.featureDescription.trim() },
    } : {}),
  }
}

function toFeatureDefinition(feature: FeatureDraft): Dnd5ePluginFeatureDefinition {
  if (!feature.headless.enabled) {
    return {
      id: feature.id.trim(), name: feature.name.trim(), summary: feature.summary.trim(),
      description: feature.description.trim(), minimumLevel: feature.minimumLevel, automation: 'manual',
    }
  }
  const targeting = feature.headless.targetingKind === 'self'
    ? { kind: 'self' as const }
    : feature.headless.targetingKind === 'single-creature'
      ? {
          kind: 'single-creature' as const,
          relation: feature.headless.relation,
          rangeFeet: feature.headless.rangeFeet,
          includeSelf: feature.headless.includeSelf,
        }
      : {
          kind: 'area' as const,
          relation: feature.headless.relation,
          includeSelf: feature.headless.includeSelf,
          maximumTargets: feature.headless.maximumTargets,
          template: feature.headless.areaShape === 'circle'
            ? {
                shape: 'circle' as const, origin: 'point' as const,
                radiusFeet: feature.headless.areaRadiusFeet, placeRangeFeet: feature.headless.rangeFeet,
              }
            : feature.headless.areaShape === 'cone'
              ? {
                  shape: 'cone' as const, origin: 'self' as const,
                  lengthFeet: feature.headless.areaLengthFeet, aimRangeFeet: feature.headless.rangeFeet,
                }
              : feature.headless.areaShape === 'line'
                ? {
                    shape: 'line' as const, origin: 'self' as const,
                    widthFeet: feature.headless.areaWidthFeet, lengthFeet: feature.headless.areaLengthFeet,
                    aimRangeFeet: feature.headless.rangeFeet,
                  }
                : {
                    shape: 'rect' as const, origin: 'point' as const,
                    widthFeet: feature.headless.areaWidthFeet, heightFeet: feature.headless.areaHeightFeet,
                    placeRangeFeet: feature.headless.rangeFeet, rotatable: true,
                  },
        }
  return {
    id: feature.id.trim(), name: feature.name.trim(), summary: feature.summary.trim(),
    description: feature.description.trim(), minimumLevel: feature.minimumLevel, automation: 'full',
    action: {
      id: feature.id.trim(),
      label: feature.headless.actionLabel.trim() || `使用${feature.name.trim()}`,
      description: feature.summary.trim(),
      economy: feature.headless.economy,
      targeting,
      ...(feature.headless.interruptEnabled ? {
        interrupt: {
          prompt: feature.headless.interruptPrompt.trim(),
          audience: feature.headless.interruptAudience,
          options: [
            { id: 'apply', label: '确认结算' },
            { id: 'cancel', label: '取消' },
          ],
          defaultOptionId: 'cancel',
          cancelOptionId: 'cancel',
          timeoutMs: feature.headless.interruptTimeoutSeconds * 1_000,
        },
      } : {}),
      ...(feature.headless.summonEnabled && feature.headless.targetingKind === 'area' ? {
        summon: {
          monsterId: feature.headless.summonMonsterId as `srd-5.1:${string}`,
          ...(feature.headless.summonLabel.trim() ? { label: feature.headless.summonLabel.trim() } : {}),
          durationRounds: feature.headless.summonDurationRounds,
          concentration: feature.headless.summonConcentration,
          side: feature.headless.summonSide,
        },
      } : {}),
    },
  }
}

function toHeadlessActionDraftFromEditor(id: string, name: string, headless: HeadlessEffectEditorDraft): Dnd5eCustomHeadlessActionDraft | undefined {
  if (!headless.enabled) return undefined
  const effects: Dnd5eCustomHeadlessActionDraft['effects'] = []
  if (headless.damageEnabled) effects.push({
    kind: 'damage',
    dice: {
      count: headless.damageCount,
      sides: headless.damageSides,
      modifier: headless.damageModifier,
    },
    damageType: headless.damageType,
  })
  if (headless.healingEnabled) effects.push({
    kind: 'healing',
    dice: {
      count: headless.healingCount,
      sides: headless.healingSides,
      modifier: headless.healingModifier,
    },
  })
  if (headless.conditionEnabled) effects.push({
    kind: 'condition',
    condition: headless.condition,
    duration: {
      expiresAt: headless.conditionExpiresAt,
      remainingRounds: headless.conditionRounds,
      ...(headless.conditionExpiresAt === 'target-turn-end-save' ? {
        saveAbility: headless.conditionSaveAbility,
        saveDc: headless.conditionSaveDc,
      } : {}),
    },
  })
  return {
    id: id.trim(),
    label: headless.actionLabel.trim() || name.trim(),
    effects,
    ...(headless.interruptEnabled ? { requiredInterruptOptionId: 'apply' } : {}),
  }
}

function toHeadlessActionDraft(feature: FeatureDraft): Dnd5eCustomHeadlessActionDraft | undefined {
  return toHeadlessActionDraftFromEditor(feature.id, feature.name, feature.headless)
}

function toSpellDefinition(spell: SpellDraft): Dnd5ePluginSpellDefinition {
  return {
    id: spell.id.trim(), name: spell.name.trim(),
    ...(spell.englishName.trim() ? { englishName: spell.englishName.trim() } : {}),
    level: spell.level, school: spell.school, ritual: spell.ritual,
    castingTime: {
      value: spell.castingTimeValue, unit: spell.castingTimeUnit,
      ...(spell.castingTimeUnit === 'reaction' && spell.reactionTrigger.trim()
        ? { reactionTrigger: spell.reactionTrigger.trim() }
        : {}),
    },
    range: {
      type: spell.rangeType,
      ...(spell.rangeType === 'distance' ? { feet: spell.rangeFeet } : {}),
    },
    components: {
      verbal: spell.verbal, somatic: spell.somatic, material: spell.material,
      ...(spell.material && spell.materialText.trim() ? { materialText: spell.materialText.trim() } : {}),
    },
    duration: {
      type: spell.durationType, concentration: spell.durationType !== 'instantaneous' && spell.concentration,
      ...(spell.durationType === 'timed' ? { value: spell.durationValue, unit: spell.durationUnit } : {}),
    },
    classes: [...spell.classes], description: spell.description.trim(),
    ...(spell.higherLevels.trim() ? { higherLevels: spell.higherLevels.trim() } : {}),
    ...(spell.headless.enabled ? {
      mechanics: {
        kind: spell.headless.damageEnabled ? 'damage' as const : spell.headless.conditionEnabled ? 'control' as const : 'utility' as const,
        resolution: spell.resolution,
        ...(spell.resolution === 'saving-throw' ? { savingThrow: { ability: spell.saveAbility, onSuccess: spell.saveOnSuccess } } : {}),
        ...(spell.headless.damageEnabled ? {
          damage: {
            dice: { count: spell.headless.damageCount, sides: spell.headless.damageSides, bonus: spell.headless.damageModifier },
            type: spell.headless.damageType,
          },
        } : {}),
        ...(spell.headless.conditionEnabled ? {
          conditions: [{
            condition: spell.headless.condition,
            trigger: spell.resolution === 'spell-attack' ? 'on-hit' as const : spell.resolution === 'saving-throw' ? 'on-failed-save' as const : 'always' as const,
            duration: spell.concentration
              ? { kind: 'concentration' as const }
              : spell.headless.conditionExpiresAt === 'target-turn-end-save'
                ? { kind: 'save-ends' as const, timing: 'target-turn-end' as const, maximumRounds: spell.headless.conditionRounds, saveAbility: spell.headless.conditionSaveAbility }
                : { kind: 'fixed-rounds' as const, rounds: spell.headless.conditionRounds },
          }],
        } : {}),
        ...(spell.level > 0 && spell.headless.damageEnabled && spell.upcastDamageDicePerLevel > 0 ? {
          upcast: { fromSlotLevel: spell.level, effects: [{ kind: 'damage-dice' as const, diceCountPerSlot: spell.upcastDamageDicePerLevel }] },
        } : {}),
      },
      automation: { mode: 'headless-action' as const, actionId: spell.id.trim() },
    } : { automation: { mode: 'reference-only' as const } }),
  }
}

function staticEffects(item: ItemDraft) {
  const effects = {
    ...(item.weaponAttackBonus ? { weaponAttackBonus: item.weaponAttackBonus } : {}),
    ...(item.weaponDamageBonus ? { weaponDamageBonus: item.weaponDamageBonus } : {}),
    ...(item.armorClassBonus ? { armorClassBonus: item.armorClassBonus } : {}),
    ...(item.savingThrowBonus ? { savingThrowBonus: item.savingThrowBonus } : {}),
    ...(item.speedBonusFeet ? { speedBonusFeet: item.speedBonusFeet } : {}),
  }
  return Object.keys(effects).length > 0 ? effects : undefined
}

function toItemDefinition(item: ItemDraft): Dnd5ePluginItemDefinition {
  const common = {
    id: item.id.trim(), name: item.name.trim(), description: item.description.trim(),
    rulesText: item.rulesText.trim(), weightLb: 0, stackable: false,
  }
  if (item.kind === 'consumable') return {
    ...common, category: 'consumable', icon: 'healing-potion', stackable: true,
    use: {
      economy: 'action', consumeQuantity: 1,
      effect: { kind: 'healing', dice: { count: item.healingCount, sides: item.healingSides, bonus: item.healingBonus } },
    },
  }
  const effects = staticEffects(item)
  if (item.kind === 'weapon') return {
    ...common, category: 'equipment', icon: 'weapon',
    ...(item.attackRerollEnabled ? {
      resources: [{ id: 'charges', label: '充能', maximum: item.attackRerollCharges, initial: item.attackRerollCharges, resetOn: item.attackRerollResetOn }],
      headlessEffects: [{ kind: 'attack-roll-reroll' as const, resourceId: 'charges', maximumDice: 1 as const, trigger: 'after-attack-roll' as const, appliesTo: 'attacks-with-this-weapon' as const }],
    } : {}),
    equipment: {
      slot: item.slot, ...(effects ? { effects } : {}),
      dnd5e: {
        kind: 'weapon', category: item.weaponCategory, mode: item.weaponMode,
        damage: { count: item.damageCount, sides: item.damageSides, type: item.damageType },
        attackAbility: item.attackAbility,
        ...(item.weaponMode === 'melee' ? { reachFeet: item.reachFeet } : {
          rangeFeet: { normal: item.rangeNormal, long: item.rangeLong },
        }),
      },
    },
  }
  if (item.kind === 'armor') return {
    ...common, category: 'equipment', icon: 'armor',
    equipment: {
      slot: 'armor', ...(effects ? { effects } : {}),
      dnd5e: {
        kind: 'armor', category: item.armorCategory,
        baseArmorClass: item.baseArmorClass, dexterityBonus: item.dexterityBonus,
      },
    },
  }
  if (item.kind === 'shield') return {
    ...common, category: 'equipment', icon: 'shield',
    equipment: {
      slot: 'offHand', ...(effects ? { effects } : {}),
      dnd5e: { kind: 'shield', armorClassBonus: item.shieldBonus },
    },
  }
  return {
    ...common, category: 'equipment', icon: 'generic',
    equipment: { slot: item.slot, ...(effects ? { effects } : {}) },
  }
}

export default function Dnd5eCustomPluginBuilder({ defaultPublisher = '房间 DM', busy = false, onInstall }: Props) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<BuilderSection>('races')
  const [metadata, setMetadata] = useState({
    id: 'local.dm.custom-rules',
    name: '房间自定义规则',
    version: '1.0.0',
    publisher: defaultPublisher || '房间 DM',
    license: '自定义内容；由房间 DM 负责授权',
    description: '由 DNDSTARS DM 规则包工作室生成。',
  })
  const [races, setRaces] = useState<RaceDraft[]>([])
  const [backgrounds, setBackgrounds] = useState<BackgroundDraft[]>([])
  const [features, setFeatures] = useState<FeatureDraft[]>([])
  const [spells, setSpells] = useState<SpellDraft[]>([])
  const [items, setItems] = useState<ItemDraft[]>([])
  const [methods, setMethods] = useState<MethodDraft[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(null)

  const draft = useMemo<Dnd5eCustomRulesPluginDraft>(() => ({
    manifest: {
      ...metadata,
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      stateSchemaVersion: 1,
    },
    races: races.map(toRaceDefinition),
    backgrounds: backgrounds.map(toBackgroundDefinition),
    features: features.map(toFeatureDefinition),
    spells: spells.map(toSpellDefinition),
    items: items.map(toItemDefinition),
    abilityGenerationMethods: methods.map(toMethodDefinition),
    headlessActions: [
      ...features.flatMap((feature) => {
        const action = toHeadlessActionDraft(feature)
        return action ? [action] : []
      }),
      ...spells.flatMap((spell) => {
        const action = toHeadlessActionDraftFromEditor(spell.id, spell.name, { ...spell.headless, healingEnabled: false, interruptEnabled: false })
        return action ? [action] : []
      }),
    ],
  }), [backgrounds, features, items, metadata, methods, races, spells])

  const savedDraft = (): SavedBuilderDraft => ({ metadata, races, backgrounds, features, spells, items, methods })

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedDraft()))
      setLocalError(null)
      setLocalNotice('草稿已保存在当前浏览器。')
    } catch {
      setLocalError('浏览器无法保存规则包草稿。')
    }
  }

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return setLocalError('尚未保存本地草稿。')
      const saved = JSON.parse(raw) as Partial<SavedBuilderDraft>
      if (!saved.metadata || !Array.isArray(saved.races) || !Array.isArray(saved.methods)) {
        return setLocalError('本地草稿格式无效。')
      }
      setMetadata(saved.metadata)
      setRaces(saved.races)
      setBackgrounds(Array.isArray(saved.backgrounds) ? saved.backgrounds : [])
      setFeatures(Array.isArray(saved.features)
        ? saved.features.map((feature, index) => restoreFeatureDraft(feature, index))
        : [])
      setSpells(Array.isArray(saved.spells) ? saved.spells.map((spell, index) => restoreSpellDraft(spell, index)) : [])
      setItems(Array.isArray(saved.items) ? saved.items.map((item, index) => restoreItemDraft(item, index)) : [])
      setMethods(saved.methods)
      setLocalError(null)
      setLocalNotice('已载入当前浏览器保存的草稿。')
    } catch {
      setLocalError('读取本地草稿失败。')
    }
  }

  const buildFile = () => {
    const errors = validateDnd5eCustomRulesPluginDraft(draft)
    if (errors.length > 0) {
      setLocalError(errors.join('；'))
      setLocalNotice(null)
      return null
    }
    setLocalError(null)
    const source = buildDnd5eCustomRulesPluginSource(draft)
    return new File([source], dnd5eCustomRulesPluginFileName(draft.manifest.id), { type: 'text/javascript' })
  }

  const download = () => {
    const file = buildFile()
    if (!file) return
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const install = async () => {
    const file = buildFile()
    if (file) await onInstall(file)
  }

  const patchRace = (index: number, patch: Partial<RaceDraft>) => {
    setRaces((current) => current.map((race, itemIndex) => itemIndex === index ? { ...race, ...patch } : race))
  }
  const patchMethod = (index: number, patch: Partial<MethodDraft>) => {
    setMethods((current) => current.map((method, itemIndex) => itemIndex === index ? { ...method, ...patch } : method))
  }
  const patchBackground = (index: number, patch: Partial<BackgroundDraft>) => setBackgrounds((current) =>
    current.map((background, itemIndex) => itemIndex === index ? { ...background, ...patch } : background))
  const patchFeature = (index: number, patch: Partial<FeatureDraft>) => setFeatures((current) =>
    current.map((feature, itemIndex) => itemIndex === index ? { ...feature, ...patch } : feature))
  const patchSpell = (index: number, patch: Partial<SpellDraft>) => setSpells((current) =>
    current.map((spell, itemIndex) => itemIndex === index ? { ...spell, ...patch } : spell))
  const patchItem = (index: number, patch: Partial<ItemDraft>) => setItems((current) =>
    current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))

  return (
    <section data-testid="custom-rules-plugin-builder" className="glass mb-5 rounded-2xl border border-arcane-400/15 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">DM 规则包工作室</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            用表单创建装备、特性、法术、种族、背景与加点规则。生成内容仍在 Worker 沙箱中运行，可保存草稿、下载文件或发布到当前房间。
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
          {open ? '收起工作室' : '打开规则包工作室'}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {([
              ['插件 ID', 'id'], ['插件名称', 'name'], ['版本', 'version'],
              ['发布者', 'publisher'], ['许可证', 'license'], ['说明', 'description'],
            ] as const).map(([label, key]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
                <input
                  aria-label={label}
                  value={metadata[key]}
                  onChange={(event) => setMetadata((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
                />
              </label>
            ))}
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="规则内容分类">
            {([
              ['races', '种族', races.length], ['backgrounds', '背景', backgrounds.length],
              ['features', '特性', features.length], ['spells', '法术', spells.length],
              ['items', '装备／物品', items.length], ['methods', '加点规则', methods.length],
            ] as const).map(([section, label, count]) => (
              <button
                key={section}
                type="button"
                aria-pressed={activeSection === section}
                onClick={() => setActiveSection(section)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${activeSection === section ? 'border-arcane-400/45 bg-arcane-500/12 text-arcane-100' : 'border-white/8 bg-white/[0.025] text-slate-500 hover:text-slate-200'}`}
              >
                {label} · {count}
              </button>
            ))}
          </nav>

          {activeSection === 'races' && <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-200">自定义种族</h3><p className="mt-1 text-xs text-slate-600">固定调整与“任选若干属性”可以同时使用。</p></div>
              <button type="button" onClick={() => setRaces((current) => [...current, newRace(current.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> 添加种族</button>
            </div>
            <div className="space-y-3">
              {races.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">尚未添加种族。</p>}
              {races.map((race, index) => (
                <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <BuilderInput label="种族 ID" value={race.id} onChange={(value) => patchRace(index, { id: value })} />
                    <BuilderInput label="显示名称" value={race.name} onChange={(value) => patchRace(index, { name: value })} />
                    <BuilderNumber label="速度（尺）" value={race.speedFeet} min={0} max={500} onChange={(value) => patchRace(index, { speedFeet: value })} />
                    <BuilderInput label="说明" value={race.description} onChange={(value) => patchRace(index, { description: value })} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {ABILITIES.map((ability) => (
                      <BuilderNumber key={ability.key} label={`${ability.label}固定调整`} value={race.abilityBonuses[ability.key]} min={-10} max={10} onChange={(value) => patchRace(index, { abilityBonuses: { ...race.abilityBonuses, [ability.key]: value } })} />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[140px_140px_1fr_auto] md:items-end">
                    <BuilderNumber label="可选属性数量" value={race.flexibleCount} min={0} max={6} onChange={(value) => patchRace(index, { flexibleCount: value })} />
                    <BuilderNumber label="每项调整" value={race.flexibleAmount} min={-10} max={10} onChange={(value) => patchRace(index, { flexibleAmount: value })} />
                    <fieldset><legend className="mb-1.5 text-xs font-semibold text-slate-500">不可选择的属性</legend><div className="flex flex-wrap gap-1.5">{ABILITIES.map((ability) => <button key={ability.key} type="button" aria-pressed={race.flexibleExclude.includes(ability.key)} onClick={() => patchRace(index, { flexibleExclude: race.flexibleExclude.includes(ability.key) ? race.flexibleExclude.filter((key) => key !== ability.key) : [...race.flexibleExclude, ability.key] })} className={`rounded-lg border px-2 py-1 text-xs ${race.flexibleExclude.includes(ability.key) ? 'border-amber-400/35 bg-amber-500/10 text-amber-100' : 'border-white/8 text-slate-500'}`}>{ability.label}</button>)}</div></fieldset>
                    <button type="button" aria-label={`删除种族 ${race.name}`} onClick={() => setRaces((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>}

          {activeSection === 'backgrounds' && <div>
            <SectionHeader
              title="自定义背景"
              description="背景技能会自动进入角色与 Headless 熟练项；工具、语言和背景特性作为结构化资料保存。"
              actionLabel="添加背景"
              onAdd={() => setBackgrounds((current) => [...current, newBackground(current.length + 1)])}
            />
            <div className="space-y-3">
              {backgrounds.length === 0 && <EmptyState>尚未添加背景。</EmptyState>}
              {backgrounds.map((background, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <BuilderInput label="背景 ID" value={background.id} onChange={(value) => patchBackground(index, { id: value })} />
                  <BuilderInput label="显示名称" value={background.name} onChange={(value) => patchBackground(index, { name: value })} />
                  <BuilderNumber label="额外语言数量" value={background.languages} min={0} max={8} onChange={(value) => patchBackground(index, { languages: value })} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <BuilderTextarea label="背景说明" value={background.description} onChange={(value) => patchBackground(index, { description: value })} />
                  <BuilderInput label="工具熟练（逗号分隔）" value={background.toolProficiencies} onChange={(value) => patchBackground(index, { toolProficiencies: value })} />
                </div>
                <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold text-slate-500">技能熟练（最多 2 项）</legend><div className="flex flex-wrap gap-1.5">
                  {SKILLS.map((skill) => {
                    const selected = background.skillProficiencies.includes(skill.key)
                    return <button key={skill.key} type="button" aria-pressed={selected} onClick={() => patchBackground(index, {
                      skillProficiencies: selected
                        ? background.skillProficiencies.filter((key) => key !== skill.key)
                        : background.skillProficiencies.length < 2 ? [...background.skillProficiencies, skill.key] : background.skillProficiencies,
                    })} className={`rounded-lg border px-2 py-1 text-xs ${selected ? 'border-amber-400/35 bg-amber-500/10 text-amber-100' : 'border-white/8 text-slate-500'}`}>{skill.label}</button>
                  })}
                </div></fieldset>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(180px,0.5fr)_1fr_auto] md:items-end">
                  <BuilderInput label="背景特性名称" value={background.featureName} onChange={(value) => patchBackground(index, { featureName: value })} />
                  <BuilderTextarea label="背景特性说明" value={background.featureDescription} onChange={(value) => patchBackground(index, { featureDescription: value })} />
                  <DeleteButton label={`删除背景 ${background.name}`} onClick={() => setBackgrounds((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              </article>)}
            </div>
          </div>}

          {activeSection === 'features' && <div>
            <SectionHeader
              title="自定义特性"
              description="可保持 DM 裁定，也可用声明式效果编辑器生成受控 Headless Action；所有目标、骰子和结果仍由 DM 权威 Host 复核。"
              actionLabel="添加特性"
              onAdd={() => setFeatures((current) => [...current, newFeature(current.length + 1)])}
            />
            <div className="space-y-3">
              {features.length === 0 && <EmptyState>尚未添加特性。</EmptyState>}
              {features.map((feature, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <BuilderInput label="特性 ID" value={feature.id} onChange={(value) => patchFeature(index, { id: value })} />
                  <BuilderInput label="显示名称" value={feature.name} onChange={(value) => patchFeature(index, { name: value })} />
                  <BuilderNumber label="最低等级" value={feature.minimumLevel} min={1} max={20} onChange={(value) => patchFeature(index, { minimumLevel: value })} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[0.65fr_1.35fr_auto] md:items-end">
                  <BuilderInput label="摘要" value={feature.summary} onChange={(value) => patchFeature(index, { summary: value })} />
                  <BuilderTextarea label="规则正文" value={feature.description} onChange={(value) => patchFeature(index, { description: value })} />
                  <DeleteButton label={`删除特性 ${feature.name}`} onClick={() => setFeatures((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
                <HeadlessEffectEditor
                  value={feature.headless}
                  onChange={(headless) => patchFeature(index, { headless })}
                />
              </article>)}
            </div>
          </div>}

          {activeSection === 'spells' && <div>
            <SectionHeader
              title="自定义法术"
              description="法术资料与机械效果分开配置；启用法术效果编辑器后，Host 会接管法术位、成分、命中／豁免、升环和专注事务。"
              actionLabel="添加法术"
              onAdd={() => setSpells((current) => [...current, newSpell(current.length + 1)])}
            />
            <div className="space-y-3">
              {spells.length === 0 && <EmptyState>尚未添加法术。</EmptyState>}
              {spells.map((spell, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <BuilderInput label="法术 ID" value={spell.id} onChange={(value) => patchSpell(index, { id: value })} />
                  <BuilderInput label="中文名称" value={spell.name} onChange={(value) => patchSpell(index, { name: value })} />
                  <BuilderInput label="英文名称（可选）" value={spell.englishName} onChange={(value) => patchSpell(index, { englishName: value })} />
                  <BuilderNumber label="环级" value={spell.level} min={0} max={9} onChange={(value) => patchSpell(index, { level: value })} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <BuilderSelect label="学派" value={spell.school} options={SPELL_SCHOOLS} onChange={(value) => patchSpell(index, { school: value as SpellDraft['school'] })} />
                  <BuilderSelect label="施法时间" value={spell.castingTimeUnit} options={CASTING_UNITS} onChange={(value) => patchSpell(index, { castingTimeUnit: value as SpellDraft['castingTimeUnit'] })} />
                  <BuilderNumber label="施法时间数值" value={spell.castingTimeValue} min={1} max={1000} onChange={(value) => patchSpell(index, { castingTimeValue: value })} />
                  <BuilderSelect label="射程类型" value={spell.rangeType} options={RANGE_TYPES} onChange={(value) => patchSpell(index, { rangeType: value as SpellDraft['rangeType'] })} />
                </div>
                {spell.castingTimeUnit === 'reaction' && <div className="mt-3"><BuilderInput label="反应触发条件" value={spell.reactionTrigger} onChange={(value) => patchSpell(index, { reactionTrigger: value })} /></div>}
                {spell.rangeType === 'distance' && <div className="mt-3 max-w-48"><BuilderNumber label="射程（尺）" value={spell.rangeFeet} min={0} max={10000} onChange={(value) => patchSpell(index, { rangeFeet: value })} /></div>}
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <BuilderSelect label="持续时间" value={spell.durationType} options={DURATION_TYPES} onChange={(value) => patchSpell(index, { durationType: value as SpellDraft['durationType'] })} />
                  {spell.durationType === 'timed' && <><BuilderNumber label="持续数值" value={spell.durationValue} min={1} max={10000} onChange={(value) => patchSpell(index, { durationValue: value })} /><BuilderSelect label="持续单位" value={spell.durationUnit} options={DURATION_UNITS} onChange={(value) => patchSpell(index, { durationUnit: value as SpellDraft['durationUnit'] })} /></>}
                </div>
                <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold text-slate-500">成分与标记</legend><div className="flex flex-wrap gap-2">
                  <Toggle label="言语 V" value={spell.verbal} onChange={(value) => patchSpell(index, { verbal: value })} />
                  <Toggle label="姿势 S" value={spell.somatic} onChange={(value) => patchSpell(index, { somatic: value })} />
                  <Toggle label="材料 M" value={spell.material} onChange={(value) => patchSpell(index, { material: value })} />
                  <Toggle label="仪式" value={spell.ritual} onChange={(value) => patchSpell(index, { ritual: value })} />
                  <Toggle label="专注" value={spell.concentration} onChange={(value) => patchSpell(index, { concentration: value })} />
                </div></fieldset>
                {spell.material && <div className="mt-3"><BuilderInput label="材料说明" value={spell.materialText} onChange={(value) => patchSpell(index, { materialText: value })} /></div>}
                <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold text-slate-500">职业（至少 1 项）</legend><div className="flex flex-wrap gap-1.5">
                  {SPELL_CLASSES.map(([id, label]) => <Toggle key={id} label={label} value={spell.classes.includes(id)} onChange={(selected) => patchSpell(index, { classes: selected ? [...spell.classes, id] : spell.classes.filter((value) => value !== id) })} />)}
                </div></fieldset>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <BuilderTextarea label="规则正文" value={spell.description} onChange={(value) => patchSpell(index, { description: value })} />
                  <BuilderTextarea label="升环说明（可选）" value={spell.higherLevels} onChange={(value) => patchSpell(index, { higherLevels: value })} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <BuilderSelect label="结算方式" value={spell.resolution} options={[["spell-attack", "法术攻击"], ["saving-throw", "目标豁免"], ["automatic", "自动生效"]]} onChange={(resolution) => patchSpell(index, { resolution: resolution as SpellDraft['resolution'] })} />
                  {spell.resolution === 'saving-throw' && <><BuilderSelect label="豁免属性" value={spell.saveAbility} options={ABILITIES.map((ability) => [ability.key, ability.label] as const)} onChange={(saveAbility) => patchSpell(index, { saveAbility: saveAbility as AbilityKey })} /><BuilderSelect label="豁免成功" value={spell.saveOnSuccess} options={[["none", "无伤害"], ["half", "伤害减半"], ["full", "仍受全额"]]} onChange={(saveOnSuccess) => patchSpell(index, { saveOnSuccess: saveOnSuccess as SpellDraft['saveOnSuccess'] })} /></>}
                  {spell.level > 0 && <BuilderNumber label="每升一环增加伤害骰" value={spell.upcastDamageDicePerLevel} min={0} max={100} onChange={(upcastDamageDicePerLevel) => patchSpell(index, { upcastDamageDicePerLevel })} />}
                </div>
                <HeadlessEffectEditor title="法术效果编辑器" mode="spell" value={spell.headless} onChange={(headless) => patchSpell(index, { headless })} />
                <div className="mt-3 flex justify-end"><DeleteButton label={`删除法术 ${spell.name}`} onClick={() => setSpells((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>
              </article>)}
            </div>
          </div>}

          {activeSection === 'items' && <div>
            <SectionHeader
              title="自定义装备与物品"
              description="支持武器、护甲、盾牌、饰品和治疗消耗品；固定效果由 Host 写入 Headless。"
              actionLabel="添加物品"
              onAdd={() => setItems((current) => [...current, newItem(current.length + 1)])}
            />
            <div className="space-y-3">
              {items.length === 0 && <EmptyState>尚未添加装备或物品。</EmptyState>}
              {items.map((item, index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <BuilderInput label="物品 ID" value={item.id} onChange={(value) => patchItem(index, { id: value })} />
                  <BuilderInput label="显示名称" value={item.name} onChange={(value) => patchItem(index, { name: value })} />
                  <BuilderSelect label="物品类型" value={item.kind} options={ITEM_KINDS} onChange={(value) => patchItem(index, { kind: value as ItemDraft['kind'] })} />
                  {item.kind !== 'armor' && item.kind !== 'shield' && item.kind !== 'consumable' && <BuilderSelect label="装备槽位" value={item.slot} options={EQUIPMENT_SLOTS} onChange={(value) => patchItem(index, { slot: value as ItemDraft['slot'] })} />}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2"><BuilderTextarea label="物品说明" value={item.description} onChange={(value) => patchItem(index, { description: value })} /><BuilderTextarea label="规则正文" value={item.rulesText} onChange={(value) => patchItem(index, { rulesText: value })} /></div>
                {item.kind === 'weapon' && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <BuilderSelect label="武器类别" value={item.weaponCategory} options={WEAPON_CATEGORIES} onChange={(value) => patchItem(index, { weaponCategory: value as ItemDraft['weaponCategory'] })} />
                  <BuilderSelect label="攻击模式" value={item.weaponMode} options={WEAPON_MODES} onChange={(value) => patchItem(index, { weaponMode: value as ItemDraft['weaponMode'] })} />
                  <BuilderSelect label="攻击属性" value={item.attackAbility} options={ATTACK_ABILITIES} onChange={(value) => patchItem(index, { attackAbility: value as ItemDraft['attackAbility'] })} />
                  <BuilderSelect label="伤害类型" value={item.damageType} options={WEAPON_DAMAGE_TYPES} onChange={(value) => patchItem(index, { damageType: value as ItemDraft['damageType'] })} />
                  <BuilderNumber label="伤害骰数量" value={item.damageCount} min={0} max={20} onChange={(value) => patchItem(index, { damageCount: value })} />
                  <BuilderNumber label="伤害骰面数" value={item.damageSides} min={2} max={1000} onChange={(value) => patchItem(index, { damageSides: value })} />
                  {item.weaponMode === 'melee' ? <BuilderNumber label="触及（尺）" value={item.reachFeet} min={0} max={500} onChange={(value) => patchItem(index, { reachFeet: value })} /> : <><BuilderNumber label="普通射程" value={item.rangeNormal} min={0} max={10000} onChange={(value) => patchItem(index, { rangeNormal: value })} /><BuilderNumber label="最大射程" value={item.rangeLong} min={0} max={10000} onChange={(value) => patchItem(index, { rangeLong: value })} /></>}
                </div>}
                {item.kind === 'armor' && <div className="mt-3 grid gap-3 sm:grid-cols-3"><BuilderSelect label="护甲类别" value={item.armorCategory} options={ARMOR_CATEGORIES} onChange={(value) => patchItem(index, { armorCategory: value as ItemDraft['armorCategory'] })} /><BuilderNumber label="基础 AC" value={item.baseArmorClass} min={0} max={50} onChange={(value) => patchItem(index, { baseArmorClass: value })} /><BuilderSelect label="敏捷调整" value={item.dexterityBonus} options={DEXTERITY_BONUSES} onChange={(value) => patchItem(index, { dexterityBonus: value as ItemDraft['dexterityBonus'] })} /></div>}
                {item.kind === 'shield' && <div className="mt-3 max-w-48"><BuilderNumber label="盾牌 AC 加值" value={item.shieldBonus} min={-20} max={20} onChange={(value) => patchItem(index, { shieldBonus: value })} /></div>}
                {item.kind === 'consumable' && <div className="mt-3 grid gap-3 sm:grid-cols-3"><BuilderNumber label="治疗骰数量" value={item.healingCount} min={1} max={40} onChange={(value) => patchItem(index, { healingCount: value })} /><BuilderNumber label="治疗骰面数" value={item.healingSides} min={2} max={100} onChange={(value) => patchItem(index, { healingSides: value })} /><BuilderNumber label="固定治疗" value={item.healingBonus} min={-1000} max={1000} onChange={(value) => patchItem(index, { healingBonus: value })} /></div>}
                {item.kind !== 'consumable' && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5"><BuilderNumber label="武器命中" value={item.weaponAttackBonus} min={-20} max={20} onChange={(value) => patchItem(index, { weaponAttackBonus: value })} /><BuilderNumber label="武器伤害" value={item.weaponDamageBonus} min={-20} max={20} onChange={(value) => patchItem(index, { weaponDamageBonus: value })} /><BuilderNumber label="AC" value={item.armorClassBonus} min={-20} max={20} onChange={(value) => patchItem(index, { armorClassBonus: value })} /><BuilderNumber label="全部豁免" value={item.savingThrowBonus} min={-20} max={20} onChange={(value) => patchItem(index, { savingThrowBonus: value })} /><BuilderNumber label="速度（尺）" value={item.speedBonusFeet} min={-500} max={500} onChange={(value) => patchItem(index, { speedBonusFeet: value })} /></div>}
                {item.kind === 'weapon' && <section className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-cyan-100">装备效果编辑器</h4><p className="mt-1 text-xs text-slate-500">当前开放的安全纵向切片：实例充能＋攻击骰后重掷一枚 d20。资源与骰子只由 Host 事务修改。</p></div><Toggle label="4 充能重掷攻击骰" value={item.attackRerollEnabled} onChange={(attackRerollEnabled) => patchItem(index, { attackRerollEnabled })} /></div>
                  {item.attackRerollEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2"><BuilderNumber label="最大充能" value={item.attackRerollCharges} min={1} max={1000000} onChange={(attackRerollCharges) => patchItem(index, { attackRerollCharges })} /><BuilderSelect label="恢复时点" value={item.attackRerollResetOn} options={[["none", "不自动恢复"], ["short-rest", "短休"], ["long-rest", "长休"], ["dawn", "黎明（暂由 DM／战役日历推进）"]]} onChange={(attackRerollResetOn) => patchItem(index, { attackRerollResetOn: attackRerollResetOn as ItemDraft['attackRerollResetOn'] })} /></div>}
                </section>}
                <div className="mt-3 flex justify-end"><DeleteButton label={`删除物品 ${item.name}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>
              </article>)}
            </div>
          </div>}

          {activeSection === 'methods' && <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-200">属性生成／加点规则</h3><p className="mt-1 text-xs text-slate-600">支持标准数组、购点成本表和自定义投骰。</p></div>
              <button type="button" onClick={() => setMethods((current) => [...current, newMethod(current.length + 1)])} className="inline-flex items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> 添加加点规则</button>
            </div>
            <div className="space-y-3">
              {methods.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">尚未添加属性生成规则。</p>}
              {methods.map((method, index) => (
                <article key={index} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <BuilderInput label="规则 ID" value={method.id} onChange={(value) => patchMethod(index, { id: value })} />
                    <BuilderInput label="显示名称" value={method.name} onChange={(value) => patchMethod(index, { name: value })} />
                    <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">规则类型</span><select aria-label="规则类型" value={method.kind} onChange={(event) => patchMethod(index, { kind: event.target.value as MethodDraft['kind'] })} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100"><option value="standard-array">标准数组</option><option value="point-buy">购点</option><option value="roll">投骰</option></select></label>
                    <BuilderInput label="简要说明" value={method.summary} onChange={(value) => patchMethod(index, { summary: value })} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    {method.kind === 'standard-array' && <BuilderInput label="六个数值（逗号分隔）" value={method.scores} onChange={(value) => patchMethod(index, { scores: value })} className="min-w-72 flex-1" />}
                    {method.kind === 'point-buy' && <><BuilderNumber label="预算" value={method.budget} min={0} max={1000} onChange={(value) => patchMethod(index, { budget: value })} /><BuilderNumber label="最低值" value={method.minimum} min={1} max={30} onChange={(value) => patchMethod(index, { minimum: value })} /><BuilderNumber label="最高值" value={method.maximum} min={1} max={30} onChange={(value) => patchMethod(index, { maximum: value })} /><BuilderInput label="成本表（分数:成本）" value={method.costs} onChange={(value) => patchMethod(index, { costs: value })} className="min-w-80 flex-1" /></>}
                    {method.kind === 'roll' && <><BuilderNumber label="骰子数量" value={method.diceCount} min={1} max={20} onChange={(value) => patchMethod(index, { diceCount: value })} /><BuilderNumber label="骰子面数" value={method.dieSides} min={2} max={1000} onChange={(value) => patchMethod(index, { dieSides: value })} /><BuilderNumber label="舍弃最低骰数量" value={method.dropLowest} min={0} max={19} onChange={(value) => patchMethod(index, { dropLowest: value })} /></>}
                    <button type="button" aria-label={`删除加点规则 ${method.name}`} onClick={() => setMethods((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-auto rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>}

          {localError && <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{localError}</p>}
          {localNotice && <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">{localNotice}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={loadDraft} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><FolderOpen className="h-4 w-4" /> 载入本地草稿</button>
            <button type="button" disabled={busy} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><Save className="h-4 w-4" /> 保存本地草稿</button>
            <button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"><Download className="h-4 w-4" /> 下载插件文件</button>
            <button type="button" disabled={busy} onClick={() => void install()} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? '正在保存…' : '保存、启用并发布'}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function HeadlessEffectEditor({
  value,
  onChange,
  title = 'Headless 效果编辑器',
  mode = 'feature',
}: {
  value: HeadlessEffectEditorDraft
  onChange(value: HeadlessEffectEditorDraft): void
  title?: string
  mode?: 'feature' | 'spell'
}) {
  const patch = (next: Partial<HeadlessEffectEditorDraft>) => onChange({ ...value, ...next })
  return (
    <section className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.045] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-violet-100">{title}</h4>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            只生成伤害、治疗和标准状态 capability。地图目标、范围、行动经济、骰子与最终写入都由 Host 校验。
          </p>
        </div>
        <Toggle label={value.enabled ? '已启用自动结算' : '启用自动结算'} value={value.enabled} onChange={(enabled) => patch({ enabled })} />
      </div>

      {value.enabled && <div className="mt-4 space-y-4 border-t border-violet-400/10 pt-4">
        {mode === 'feature' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BuilderInput label="战斗按钮文字" value={value.actionLabel} onChange={(actionLabel) => patch({ actionLabel })} />
          <BuilderSelect label="行动类型" value={value.economy} options={ACTION_ECONOMIES} onChange={(economy) => patch({ economy: economy as HeadlessEffectEditorDraft['economy'] })} />
          <BuilderSelect label="目标模式" value={value.targetingKind} options={TARGETING_KINDS} onChange={(targetingKind) => patch({ targetingKind: targetingKind as HeadlessEffectEditorDraft['targetingKind'] })} />
          {value.targetingKind !== 'self' && <BuilderSelect label="目标关系" value={value.relation} options={TARGET_RELATIONS} onChange={(relation) => patch({ relation: relation as HeadlessEffectEditorDraft['relation'] })} />}
        </div> : <p className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] px-3 py-2 text-xs leading-5 text-cyan-100/70">行动类型、射程与目标取自上方的法术资料；法术位、V／S／M、命中／豁免、升环和专注由 Host 统一校验。</p>}

        {mode === 'feature' && value.targetingKind === 'single-creature' && <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
          <BuilderNumber label="射程（尺）" value={value.rangeFeet} min={0} max={10000} onChange={(rangeFeet) => patch({ rangeFeet })} />
          <div className="pb-0.5"><Toggle label="允许选择自己" value={value.includeSelf} onChange={(includeSelf) => patch({ includeSelf })} /></div>
        </div>}

        {mode === 'feature' && value.targetingKind === 'area' && <div className="rounded-xl border border-white/8 bg-black/10 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BuilderSelect label="范围形状" value={value.areaShape} options={AREA_SHAPES} onChange={(areaShape) => patch({ areaShape: areaShape as HeadlessEffectEditorDraft['areaShape'] })} />
            <BuilderNumber label={value.areaShape === 'circle' || value.areaShape === 'rect' ? '放置射程（尺）' : '瞄准距离（尺）'} value={value.rangeFeet} min={0} max={10000} onChange={(rangeFeet) => patch({ rangeFeet })} />
            <BuilderNumber label="最多目标" value={value.maximumTargets} min={1} max={256} onChange={(maximumTargets) => patch({ maximumTargets })} />
            <div className="self-end pb-0.5"><Toggle label="范围可包含自己" value={value.includeSelf} onChange={(includeSelf) => patch({ includeSelf })} /></div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {value.areaShape === 'circle' && <BuilderNumber label="半径（尺）" value={value.areaRadiusFeet} min={0} max={10000} onChange={(areaRadiusFeet) => patch({ areaRadiusFeet })} />}
            {(value.areaShape === 'line' || value.areaShape === 'rect') && <BuilderNumber label="宽度（尺）" value={value.areaWidthFeet} min={0} max={10000} onChange={(areaWidthFeet) => patch({ areaWidthFeet })} />}
            {value.areaShape === 'rect' && <BuilderNumber label="高度（尺）" value={value.areaHeightFeet} min={0} max={10000} onChange={(areaHeightFeet) => patch({ areaHeightFeet })} />}
            {(value.areaShape === 'line' || value.areaShape === 'cone') && <BuilderNumber label="长度（尺）" value={value.areaLengthFeet} min={0} max={10000} onChange={(areaLengthFeet) => patch({ areaLengthFeet })} />}
          </div>
          <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h5 className="text-xs font-semibold text-cyan-100">召唤生物</h5><p className="mt-1 text-[11px] text-cyan-100/60">在范围锚点创建一个由 DM 操作的 SRD 5.1 生物，并加入权威先攻。</p></div>
              <Toggle label={value.summonEnabled ? '已启用召唤' : '启用召唤'} value={value.summonEnabled} onChange={(summonEnabled) => patch({ summonEnabled })} />
            </div>
            {value.summonEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BuilderSelect label="生物模板" value={value.summonMonsterId} options={SUMMON_MONSTERS} onChange={(summonMonsterId) => patch({ summonMonsterId })} />
              <BuilderInput label="显示名称（可选）" value={value.summonLabel} onChange={(summonLabel) => patch({ summonLabel })} />
              <BuilderNumber label="持续轮数" value={value.summonDurationRounds} min={1} max={14400} onChange={(summonDurationRounds) => patch({ summonDurationRounds })} />
              <BuilderSelect label="阵营关系" value={value.summonSide} options={[["ally", "施法者友方"], ["enemy", "施法者敌方"]]} onChange={(summonSide) => patch({ summonSide: summonSide as HeadlessEffectEditorDraft['summonSide'] })} />
              <div className="self-end pb-0.5"><Toggle label="需要专注" value={value.summonConcentration} onChange={(summonConcentration) => patch({ summonConcentration })} /></div>
            </div>}
          </div>
        </div>}

        <div className="grid gap-3 xl:grid-cols-3">
          <fieldset className={`rounded-xl border p-3 ${value.damageEnabled ? 'border-rose-400/25 bg-rose-500/[0.035]' : 'border-white/8 bg-black/10'}`}>
            <legend className="px-1"><Toggle label="伤害" value={value.damageEnabled} onChange={(damageEnabled) => patch({ damageEnabled })} /></legend>
            {value.damageEnabled && <div className="mt-2 grid grid-cols-2 gap-3">
              <BuilderNumber label="骰子数量" value={value.damageCount} min={1} max={12} onChange={(damageCount) => patch({ damageCount })} />
              <BuilderNumber label="骰面" value={value.damageSides} min={2} max={100} onChange={(damageSides) => patch({ damageSides })} />
              <BuilderNumber label="固定调整值" value={value.damageModifier} min={-1000000} max={1000000} onChange={(damageModifier) => patch({ damageModifier })} />
              <BuilderSelect label="伤害类型" value={value.damageType} options={HEADLESS_DAMAGE_TYPES} onChange={(damageType) => patch({ damageType: damageType as Dnd5eDamageType })} />
            </div>}
          </fieldset>

          {mode === 'feature' && <fieldset className={`rounded-xl border p-3 ${value.healingEnabled ? 'border-emerald-400/25 bg-emerald-500/[0.035]' : 'border-white/8 bg-black/10'}`}>
            <legend className="px-1"><Toggle label="治疗" value={value.healingEnabled} onChange={(healingEnabled) => patch({ healingEnabled })} /></legend>
            {value.healingEnabled && <div className="mt-2 grid grid-cols-2 gap-3">
              <BuilderNumber label="治疗骰数量" value={value.healingCount} min={1} max={12} onChange={(healingCount) => patch({ healingCount })} />
              <BuilderNumber label="治疗骰面" value={value.healingSides} min={2} max={100} onChange={(healingSides) => patch({ healingSides })} />
              <BuilderNumber label="固定治疗值" value={value.healingModifier} min={-1000000} max={1000000} onChange={(healingModifier) => patch({ healingModifier })} />
            </div>}
          </fieldset>}

          <fieldset className={`rounded-xl border p-3 ${value.conditionEnabled ? 'border-amber-400/25 bg-amber-500/[0.035]' : 'border-white/8 bg-black/10'}`}>
            <legend className="px-1"><Toggle label="标准状态" value={value.conditionEnabled} onChange={(conditionEnabled) => patch({ conditionEnabled })} /></legend>
            {value.conditionEnabled && <div className="mt-2 grid grid-cols-2 gap-3">
              <BuilderSelect label="状态" value={value.condition} options={HEADLESS_CONDITIONS} onChange={(condition) => patch({ condition: condition as HeadlessEffectEditorDraft['condition'] })} />
              <BuilderSelect label="解除时点" value={value.conditionExpiresAt} options={CONDITION_EXPIRATIONS} onChange={(conditionExpiresAt) => patch({ conditionExpiresAt: conditionExpiresAt as HeadlessEffectEditorDraft['conditionExpiresAt'] })} />
              <BuilderNumber label="持续轮数" value={value.conditionRounds} min={1} max={14400} onChange={(conditionRounds) => patch({ conditionRounds })} />
              {value.conditionExpiresAt === 'target-turn-end-save' && <>
                <BuilderSelect label="重复豁免属性" value={value.conditionSaveAbility} options={ABILITIES.map((ability) => [ability.key, ability.label] as const)} onChange={(conditionSaveAbility) => patch({ conditionSaveAbility: conditionSaveAbility as AbilityKey })} />
                <BuilderNumber label="重复豁免 DC" value={value.conditionSaveDc} min={1} max={40} onChange={(conditionSaveDc) => patch({ conditionSaveDc })} />
              </>}
            </div>}
          </fieldset>
        </div>

        {!value.damageEnabled && !(mode === 'feature' && value.healingEnabled) && !value.conditionEnabled && !(mode === 'feature' && value.summonEnabled && value.targetingKind === 'area') && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-100">至少启用一种伤害、治疗、标准状态或召唤效果。</p>
        )}

        {mode === 'feature' && <div className="rounded-xl border border-white/8 bg-black/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h5 className="text-xs font-semibold text-slate-300">Interrupt 确认</h5><p className="mt-1 text-[11px] text-slate-600">在掷骰和写入前暂停事务；取消或超时不会消耗行动经济。</p></div>
            <Toggle label="启用 Interrupt" value={value.interruptEnabled} onChange={(interruptEnabled) => patch({ interruptEnabled })} />
          </div>
          {value.interruptEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2"><BuilderInput label="确认提示" value={value.interruptPrompt} onChange={(interruptPrompt) => patch({ interruptPrompt })} /></div>
            <BuilderSelect label="回答者" value={value.interruptAudience} options={INTERRUPT_AUDIENCES} onChange={(interruptAudience) => patch({ interruptAudience: interruptAudience as HeadlessEffectEditorDraft['interruptAudience'] })} />
            <BuilderNumber label="超时（秒）" value={value.interruptTimeoutSeconds} min={5} max={300} onChange={(interruptTimeoutSeconds) => patch({ interruptTimeoutSeconds })} />
          </div>}
        </div>}
      </div>}
    </section>
  )
}

function BuilderInput({ label, value, onChange, className = '' }: { label: string; value: string; onChange(value: string): void; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(value: number): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderTextarea({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><textarea aria-label={label} value={value} rows={3} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm leading-5 text-slate-100 outline-none focus:border-arcane-400/50" /></label>
}

function BuilderSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-arcane-400/50">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <button type="button" aria-pressed={value} onClick={() => onChange(!value)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${value ? 'border-arcane-400/40 bg-arcane-500/12 text-arcane-100' : 'border-white/8 text-slate-500'}`}>{label}</button>
}

function SectionHeader({ title, description, actionLabel, onAdd }: { title: string; description: string; actionLabel: string; onAdd(): void }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-200">{title}</h3><p className="mt-1 text-xs text-slate-600">{description}</p></div><button type="button" onClick={onAdd} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-arcane-500/12 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" /> {actionLabel}</button></div>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">{children}</p>
}

function DeleteButton({ label, onClick }: { label: string; onClick(): void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
}
