import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eMetamagicId } from '../../lib/sharedCombatTypes'
import type { Character } from '../../types/character'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import { dnd5eClassDefinitionForCharacter, dnd5eClassProgression, dnd5ePactSlotLevel, dnd5ePreparedSpellCount, type Dnd5eClassId } from './classes'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import type { Dnd5eDamageType } from './monsters'
import { dnd5eBardMagicalSecretsOptions } from './spellCatalog'
import { imposeDnd5eRollDisadvantage } from './rollMode'

export type Dnd5eSpellSchool = '防护' | '咒法' | '预言' | '附魔' | '塑能' | '幻术' | '死灵' | '变化'
export type Dnd5eSpellCastingTime = 'action' | 'bonus-action' | 'reaction'
export type Dnd5eSpellEffectKind =
  | 'spell-attack'
  | 'saving-throw'
  | 'automatic-damage'
  | 'healing'
  | 'fixed-healing'
  | 'healing-pool'
  | 'temporary-hit-points'
  | 'stabilize'
  | 'remove-condition'
  | 'active-effect'
  | 'mark'
  | 'armor-class-buff'
  | 'attack-save-buff'
  | 'attack-save-debuff'
  | 'power-word-kill'
  | 'power-word-stun'
  | 'counterspell'
  | 'persistent-area'

export interface Dnd5eSpellDamageComponentDefinition {
  dice: { count: number; sides: number; bonus: number; perHigherSlot?: number }
  damageType: Dnd5eDamageType
  /** 焰击术等法术只把升环伤害加到施法者本次选择的伤害类型。 */
  higherSlotChoice?: boolean
}

export interface Dnd5eSrdSpellDefinition {
  id: string
  name: string
  englishName: string
  level: number
  school: Dnd5eSpellSchool
  classes: readonly Dnd5eClassId[]
  castingTime: Dnd5eSpellCastingTime
  rangeFeet: number
  target: 'hostile' | 'ally' | 'area'
  effect: Dnd5eSpellEffectKind
  saveAbility?: AbilityKey
  damageOnSuccessfulSave?: 'none' | 'half'
  dice: { count: number; sides: number; bonus: number; perHigherSlot?: number }
  damageType?: Dnd5eDamageType
  /** 与主伤害骰池同时结算的其他伤害类型；一次伤害事件内分别应用抗性/易伤。 */
  additionalDamageComponents?: readonly Dnd5eSpellDamageComponentDefinition[]
  /** 主伤害骰池是否可承接“每升一环”的伤害类型选择。 */
  primaryHigherSlotChoice?: boolean
  /** 少数法术攻击即使未命中也会造成部分初始伤害。 */
  spellAttackMissDamage?: 'half'
  /** 命中后在目标下一回合结束时自动触发的后续伤害骰池。 */
  delayedDamage?: {
    dice: { count: number; sides: number; bonus: number; perHigherSlot?: number }
    damageType: Dnd5eDamageType
    timing: 'target-next-turn-end'
  }
  cantripScaling?: boolean
  addSpellcastingModifier?: boolean
  bonusPerDie?: boolean
  concentration?: boolean
  concentrationDurationRounds?: number
  maximumTargets?: number
  additionalTargetsPerHigherSlot?: number
  maximumTargetSeparationFeet?: number
  /** 连锁类法术：后续目标只需位于第一个目标指定距离内。 */
  secondaryTargetsWithinFeetOfFirst?: number
  /** 地图选区模板；尺寸属于法术效果，placeRangeFeet 仅限制模板原点。 */
  area?: SkillAoeTargeting
  /** 少数“选择区域内生物”的法术允许施法者选择自己。 */
  areaIncludesSelf?: boolean
  /** 每道射线单独攻击时的基础射线数。 */
  baseProjectiles?: number
  additionalProjectilesPerHigherSlot?: number
  onHitEffect?: 'ray-of-frost' | 'shocking-grasp' | 'guiding-bolt' | 'chill-touch'
  onFailedSaveEffect?:
    | 'vicious-mockery'
    | 'thunderwave-push'
    | 'sunburst-blindness'
    | 'blindness-deafness'
    | 'hold-person'
    | 'hold-monster'
    | 'banishment'
    | 'faerie-fire'
  appliedEffect?:
    | 'invisibility'
    | 'greater-invisibility'
    | 'barkskin'
    | 'protection-from-poison'
    | 'death-ward'
  effectDurationRounds?: number
  conditionOptions?: readonly ('blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease')[]
  fixedHealing?: number
  fixedHealingPerHigherSlot?: number
  healingPool?: number
  hitPointThreshold?: number
  description: string
}

export const DND5E_SRD_COMBAT_SPELLS: readonly Dnd5eSrdSpellDefinition[] = [
  {
    id: 'flaming-sphere', name: '炽焰法球', englishName: 'Flaming Sphere', level: 2, school: '咒法',
    classes: ['druid', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'area', effect: 'persistent-area',
    dice: { count: 0, sides: 6, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 100,
    area: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 60 },
    description: '在射程内未被占据的空间创造一个直径5尺的火焰球，持续至多1分钟并需要专注。生物在法球5尺内结束回合时进行敏捷豁免；失败受到2d6火焰伤害，成功减半。每使用高于2环一环的法术位，伤害增加1d6。施法后的每个你的回合中，可以用附赠动作将法球移动至多30尺；若撞击生物，该生物立即进行同一豁免，法球在其空间停止。',
  },
  {
    id: 'spike-growth', name: '荆棘丛生', englishName: 'Spike Growth', level: 2, school: '变化',
    classes: ['druid', 'ranger'], castingTime: 'action', rangeFeet: 150, target: 'area', effect: 'persistent-area',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 100,
    maximumTargets: 100,
    area: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 150 },
    description: '使射程内一点周围20尺半径的地面长出坚硬尖刺，持续至多10分钟并需要专注。区域成为困难地形；生物在区域内每移动5尺受到2d4穿刺伤害。地面外观保持自然，施法时未看见区域形成的生物必须以动作进行感知（察觉）检定对抗施法豁免DC，才能在进入前辨认危险。',
  },
  {
    id: 'spirit-guardians', name: '灵体卫士', englishName: 'Spirit Guardians', level: 3, school: '咒法',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 0, target: 'area', effect: 'persistent-area',
    dice: { count: 0, sides: 8, bonus: 0 }, concentration: true, concentrationDurationRounds: 100,
    maximumTargets: 100, areaIncludesSelf: true,
    area: { shape: 'circle', origin: 'self', radiusFeet: 15 },
    description: '呼唤灵体环绕你15尺，持续至多10分钟并需要专注。施法时指定任意数量可见生物不受影响；本实现默认排除友方。受影响生物在区域内的移动速度减半，并在一个回合内第一次进入区域或在其中开始回合时进行感知豁免；失败受到3d8光耀伤害（邪恶施法者改为黯蚀伤害），成功减半。每使用高于3环一环的法术位，伤害增加1d8。',
  },
  {
    id: 'moonbeam', name: '月华之光', englishName: 'Moonbeam', level: 2, school: '塑能',
    classes: ['druid'], castingTime: 'action', rangeFeet: 120, target: 'area', effect: 'persistent-area',
    dice: { count: 0, sides: 10, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 100,
    area: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 120 },
    description: '在射程内一点创造一道半径5尺、高40尺的银白光柱，持续至多1分钟并需要专注。生物在一个回合内第一次进入光柱或在其中开始回合时进行体质豁免；失败受到2d10光耀伤害，成功减半。每使用高于2环一环的法术位，伤害增加1d10。施法后的每个你的回合中，可以用动作将光柱向任意方向移动至多60尺。',
  },
  {
    id: 'faerie-fire', name: '妖火', englishName: 'Faerie Fire', level: 1, school: '塑能',
    classes: ['bard', 'druid'], castingTime: 'action', rangeFeet: 60, target: 'area', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 100,
    area: { shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20, placeRangeFeet: 60 },
    onFailedSaveEffect: 'faerie-fire',
    description: '指定60尺内一处20尺立方区域。区域内生物进行敏捷豁免；失败者被光包围，无法受益于隐形，且能看见它的攻击者对其攻击具有优势。需要专注，持续至多1分钟。',
  },
  {
    id: 'invisibility', name: '隐形术', englishName: 'Invisibility', level: 2, school: '幻术',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'active-effect',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 600,
    maximumTargets: 1, additionalTargetsPerHigherSlot: 1, appliedEffect: 'invisibility',
    description: '触碰一个生物，使其及其随身着装与携带物隐形。目标发动攻击或施展法术时效果结束。需要专注，持续至多1小时；每升一环可额外指定一个目标。',
  },
  {
    id: 'greater-invisibility', name: '高等隐形术', englishName: 'Greater Invisibility', level: 4, school: '幻术',
    classes: ['bard', 'sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'active-effect',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    appliedEffect: 'greater-invisibility',
    description: '触碰一个生物，使其及其随身着装与携带物隐形。攻击或施法不会终止此效果。需要专注，持续至多1分钟。',
  },
  {
    id: 'barkskin', name: '树肤术', englishName: 'Barkskin', level: 2, school: '变化',
    classes: ['druid', 'ranger'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'active-effect',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 600,
    appliedEffect: 'barkskin',
    description: '触碰一个自愿生物。法术持续期间，无论目标着装何种护甲，其AC都不会低于16。需要专注，持续至多1小时。',
  },
  {
    id: 'protection-from-poison', name: '防护毒素', englishName: 'Protection from Poison', level: 2, school: '防护',
    classes: ['cleric', 'druid', 'paladin', 'ranger'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'active-effect',
    dice: { count: 0, sides: 4, bonus: 0 }, appliedEffect: 'protection-from-poison', effectDurationRounds: 600,
    description: '触碰一个生物并中和其所受毒素，结束中毒状态。目标在1小时内对抗中毒的豁免具有优势，并对毒素伤害具有抗性。',
  },
  {
    id: 'death-ward', name: '防死结界', englishName: 'Death Ward', level: 4, school: '防护',
    classes: ['cleric', 'paladin'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'active-effect',
    dice: { count: 0, sides: 4, bonus: 0 }, appliedEffect: 'death-ward', effectDurationRounds: 4_800,
    description: '触碰一个生物并给予死亡防护。目标第一次因伤害降至0生命时改为降至1；若受到不造成伤害但会直接致死的效果，则取消该致死效果。触发后法术结束，未触发时持续8小时。',
  },
  {
    id: 'spare-the-dying', name: '维生术', englishName: 'Spare the Dying', level: 0, school: '死灵',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'stabilize',
    dice: { count: 0, sides: 4, bonus: 0 },
    description: '触碰一名生命值为0但尚未死亡的活体生物，使其伤势稳定。该法术对构装生物和亡灵无效。',
  },
  {
    id: 'false-life', name: '虚假生命', englishName: 'False Life', level: 1, school: '死灵',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 0, target: 'ally', effect: 'temporary-hit-points',
    dice: { count: 1, sides: 4, bonus: 4 }, fixedHealingPerHigherSlot: 5,
    description: '以死灵魔法强化自身，获得1d4＋4点临时生命值，持续1小时。每使用高一环法术位，额外获得5点临时生命值。',
  },
  {
    id: 'guiding-bolt', name: '曳光弹', englishName: 'Guiding Bolt', level: 1, school: '塑能',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 120, target: 'hostile', effect: 'spell-attack',
    dice: { count: 4, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'radiant', onHitEffect: 'guiding-bolt',
    description: '进行一次远程法术攻击。命中造成4d6光耀伤害；在你的下一回合结束前，下一次对该目标的攻击检定具有优势。每升一环增加1d6伤害。',
  },
  {
    id: 'acid-arrow', name: '马友夫强酸箭', englishName: 'Acid Arrow', level: 2, school: '塑能',
    classes: ['wizard'], castingTime: 'action', rangeFeet: 90, target: 'hostile', effect: 'spell-attack',
    dice: { count: 4, sides: 4, bonus: 0, perHigherSlot: 1 }, damageType: 'acid', spellAttackMissDamage: 'half',
    delayedDamage: {
      dice: { count: 2, sides: 4, bonus: 0, perHigherSlot: 1 }, damageType: 'acid', timing: 'target-next-turn-end',
    },
    description: '进行一次远程法术攻击。命中时立即造成4d4强酸伤害，并在目标下一回合结束时再造成2d4强酸伤害；未命中时只造成初始伤害的一半，且没有后续伤害。每升一环，初始与后续伤害各增加1d4。',
  },
  {
    id: 'hellish-rebuke', name: '炼狱叱喝', englishName: 'Hellish Rebuke', level: 1, school: '塑能',
    classes: ['warlock'], castingTime: 'reaction', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 2, sides: 10, bonus: 0, perHigherSlot: 1 }, damageType: 'fire', damageOnSuccessfulSave: 'half',
    description: '当60尺内你能看见的生物伤害你时，以反应迫使其进行敏捷豁免；失败受到2d10火焰伤害，成功减半。每升一环增加1d10。系统在符合触发条件时询问。',
  },
  {
    id: 'blindness-deafness', name: '目盲/耳聋术', englishName: 'Blindness/Deafness', level: 2, school: '死灵',
    classes: ['bard', 'cleric', 'sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 30, target: 'hostile', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 0, sides: 4, bonus: 0 }, maximumTargets: 1, additionalTargetsPerHigherSlot: 1,
    onFailedSaveEffect: 'blindness-deafness', conditionOptions: ['blinded', 'deafened'],
    description: '选择使目标目盲或耳聋。目标进行体质豁免；失败承受所选状态1分钟，并在其每个回合结束时重复豁免，成功则结束。每升一环可多选择一个目标。',
  },
  {
    id: 'hold-person', name: '人类定身术', englishName: 'Hold Person', level: 2, school: '附魔',
    classes: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'wis',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 1, additionalTargetsPerHigherSlot: 1, maximumTargetSeparationFeet: 30,
    onFailedSaveEffect: 'hold-person',
    description: '一名类人生物进行感知豁免；失败则陷入麻痹。目标在每个回合结束时重复豁免，成功则结束。需要专注，至多1分钟；每升一环可多选择一个彼此相距不超过30尺的目标。',
  },
  {
    id: 'lesser-restoration', name: '次级复原术', englishName: 'Lesser Restoration', level: 2, school: '防护',
    classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'remove-condition',
    dice: { count: 0, sides: 4, bonus: 0 }, conditionOptions: ['blinded', 'deafened', 'paralyzed', 'poisoned', 'disease'],
    description: '触碰一名生物，结束影响它的一种疾病，或结束目盲、耳聋、麻痹、毒素状态中的一种。',
  },
  {
    id: 'mass-healing-word', name: '群体治愈真言', englishName: 'Mass Healing Word', level: 3, school: '塑能',
    classes: ['cleric'], castingTime: 'bonus-action', rangeFeet: 60, target: 'ally', effect: 'healing',
    dice: { count: 1, sides: 4, bonus: 0, perHigherSlot: 1 }, addSpellcastingModifier: true, maximumTargets: 6,
    description: '以附赠动作使射程内至多六名生物各恢复1d4＋施法属性调整值的生命。每升一环增加1d4治疗。对构装生物和亡灵无效。',
  },
  {
    id: 'mass-cure-wounds', name: '群体疗伤术', englishName: 'Mass Cure Wounds', level: 5, school: '塑能',
    classes: ['bard', 'cleric', 'druid'], castingTime: 'action', rangeFeet: 60, target: 'ally', effect: 'healing',
    dice: { count: 3, sides: 8, bonus: 0, perHigherSlot: 1 }, addSpellcastingModifier: true, maximumTargets: 6,
    area: { shape: 'circle', origin: 'point', radiusFeet: 30, placeRangeFeet: 60 }, areaIncludesSelf: true,
    description: '在60尺内选择一点，并选择以该点为中心30尺半径内至多六名生物；每个目标恢复3d8＋施法属性调整值的生命。每升一环增加1d8治疗。对构装生物和亡灵无效。',
  },
  {
    id: 'flame-strike', name: '焰击术', englishName: 'Flame Strike', level: 5, school: '塑能',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 60, target: 'area', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 4, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'fire', primaryHigherSlotChoice: true,
    additionalDamageComponents: [{
      dice: { count: 4, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'radiant', higherSlotChoice: true,
    }],
    damageOnSuccessfulSave: 'half', maximumTargets: 100,
    area: { shape: 'circle', origin: 'point', radiusFeet: 10, placeRangeFeet: 60 },
    description: '在60尺内一点降下一道半径10尺、高40尺的圣火柱。区域内生物进行敏捷豁免；失败受到4d6火焰伤害和4d6光耀伤害，成功则两种伤害均减半。使用6环或更高法术位时，每高一环可选择让火焰或光耀伤害增加1d6。',
  },
  {
    id: 'counterspell', name: '法术反制', englishName: 'Counterspell', level: 3, school: '防护',
    classes: ['sorcerer', 'warlock', 'wizard'], castingTime: 'reaction', rangeFeet: 60, target: 'hostile', effect: 'counterspell',
    dice: { count: 0, sides: 4, bonus: 0 },
    description: '当60尺内你能看见的生物施法时，以反应尝试中断该法术。3环及以下法术自动失败；更高环法术需要进行DC 10＋法术环级的施法属性检定。升环可自动反制不高于所用法术位环级的法术。',
  },
  {
    id: 'banishment', name: '放逐术', englishName: 'Banishment', level: 4, school: '防护',
    classes: ['cleric', 'paladin', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'cha',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 1, additionalTargetsPerHigherSlot: 1, onFailedSaveEffect: 'banishment',
    description: '目标进行魅力豁免；失败则被放逐并在持续期间陷入失能。需要专注，至多1分钟；每升一环可多选择一个目标。异界生物维持满时长后的位面归返由DM裁定。',
  },
  {
    id: 'hold-monster', name: '怪物定身术', englishName: 'Hold Monster', level: 5, school: '附魔',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 90, target: 'hostile', effect: 'saving-throw', saveAbility: 'wis',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 1, additionalTargetsPerHigherSlot: 1, maximumTargetSeparationFeet: 30,
    onFailedSaveEffect: 'hold-monster',
    description: '一名非亡灵生物进行感知豁免；失败则陷入麻痹。目标在每个回合结束时重复豁免，成功则结束。需要专注，至多1分钟；每升一环可多选择一个彼此相距不超过30尺的目标。',
  },
  {
    id: 'heal', name: '医疗术', englishName: 'Heal', level: 6, school: '塑能',
    classes: ['cleric', 'druid'], castingTime: 'action', rangeFeet: 60, target: 'ally', effect: 'fixed-healing',
    dice: { count: 0, sides: 4, bonus: 0 }, fixedHealing: 70, fixedHealingPerHigherSlot: 10,
    description: '目标恢复70点生命，并结束影响它的目盲、耳聋和疾病。每升一环额外恢复10点生命。对构装生物和亡灵无效。',
  },
  {
    id: 'power-word-stun', name: '律令震慑', englishName: 'Power Word Stun', level: 8, school: '附魔',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'power-word-stun',
    dice: { count: 0, sides: 4, bonus: 0 }, hitPointThreshold: 150,
    description: '若目标当前生命值不高于150，则陷入震慑；否则法术无效。目标在每个回合结束时进行体质豁免，成功则结束震慑。',
  },
  {
    id: 'mass-heal', name: '群体医疗术', englishName: 'Mass Heal', level: 9, school: '塑能',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 60, target: 'ally', effect: 'healing-pool',
    dice: { count: 0, sides: 4, bonus: 0 }, healingPool: 700, maximumTargets: 100,
    description: '将700点治疗分配给射程内可见的生物；每个目标恢复分配到的数值，并结束影响它的所有疾病、目盲与耳聋。对构装生物和亡灵无效。',
  },
  {
    id: 'acid-splash', name: '酸液飞溅', englishName: 'Acid Splash', level: 0, school: '咒法',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 1, sides: 6, bonus: 0 }, damageType: 'acid', cantripScaling: true,
    maximumTargets: 2, maximumTargetSeparationFeet: 5,
    description: '选择射程内一个生物，或选择射程内彼此相距不超过5尺的两个生物。目标分别进行敏捷豁免；失败受到酸蚀伤害，成功不受伤害。伤害骰在5、11、17级增加。',
  },
  {
    id: 'hunters-mark', name: '猎人印记', englishName: "Hunter's Mark", level: 1, school: '预言',
    classes: ['ranger'], castingTime: 'bonus-action', rangeFeet: 90, target: 'hostile', effect: 'mark',
    dice: { count: 0, sides: 6, bonus: 0 }, concentration: true, concentrationDurationRounds: 600,
    description: '以附赠动作标记射程内一个生物并保持专注，基础持续至多1小时（3至4环为8小时，5环及以上为24小时）。每当你以武器攻击命中该目标时，额外造成1d6同类伤害；目标降至0生命后可在后续回合转移印记。',
  },
  {
    id: 'fire-bolt', name: '火焰箭', englishName: 'Fire Bolt', level: 0, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 120, target: 'hostile', effect: 'spell-attack',
    dice: { count: 1, sides: 10, bonus: 0 }, damageType: 'fire', cantripScaling: true,
    description: '进行一次远程法术攻击；命中造成火焰伤害。伤害骰在5、11、17级增加。',
  },
  {
    id: 'ray-of-frost', name: '冷冻射线', englishName: 'Ray of Frost', level: 0, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'spell-attack',
    dice: { count: 1, sides: 8, bonus: 0 }, damageType: 'cold', cantripScaling: true,
    onHitEffect: 'ray-of-frost',
    description: '进行一次远程法术攻击。命中时目标受到冷冻伤害，且速度降低10尺，直到你的下一回合开始。伤害骰在5、11、17级增加。',
  },
  {
    id: 'shocking-grasp', name: '电爪', englishName: 'Shocking Grasp', level: 0, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 5, target: 'hostile', effect: 'spell-attack',
    dice: { count: 1, sides: 8, bonus: 0 }, damageType: 'lightning', cantripScaling: true,
    onHitEffect: 'shocking-grasp',
    description: '进行一次近战法术攻击；若目标穿戴金属护甲，该攻击具有优势。命中时造成闪电伤害，且目标直到其下一回合开始前不能进行反应。伤害骰在5、11、17级增加。',
  },
  {
    id: 'chill-touch', name: '冻寒之触', englishName: 'Chill Touch', level: 0, school: '死灵',
    classes: ['sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 120, target: 'hostile', effect: 'spell-attack',
    dice: { count: 1, sides: 8, bonus: 0 }, damageType: 'necrotic', cantripScaling: true,
    onHitEffect: 'chill-touch',
    description: '进行一次远程法术攻击；命中造成黯蚀伤害，且目标在你的下一回合开始前无法恢复生命值。若目标为亡灵，其在此期间对你进行的攻击检定具有劣势。伤害骰在5、11、17级增加。',
  },
  {
    id: 'eldritch-blast', name: '魔能爆', englishName: 'Eldritch Blast', level: 0, school: '塑能',
    classes: ['warlock'], castingTime: 'action', rangeFeet: 120, target: 'hostile', effect: 'spell-attack',
    dice: { count: 1, sides: 10, bonus: 0 }, damageType: 'force', cantripScaling: true,
    description: '向射程内生物发射一道爆裂能量并进行远程法术攻击；命中造成1d10力场伤害。5、11、17级时分别增加至2、3、4道射线；每道射线分别进行攻击检定，并可指定同一或不同目标。',
  },
  {
    id: 'produce-flame', name: '燃火术', englishName: 'Produce Flame', level: 0, school: '咒法',
    classes: ['druid'], castingTime: 'action', rangeFeet: 30, target: 'hostile', effect: 'spell-attack',
    dice: { count: 1, sides: 8, bonus: 0 }, damageType: 'fire', cantripScaling: true,
    description: '将火焰投向生物并进行一次远程法术攻击；命中造成火焰伤害。伤害骰在5、11、17级增加。',
  },
  {
    id: 'poison-spray', name: '毒气喷溅', englishName: 'Poison Spray', level: 0, school: '咒法',
    classes: ['druid', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 10, target: 'hostile', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 1, sides: 12, bonus: 0 }, damageType: 'poison', cantripScaling: true,
    description: '目标进行体质豁免；失败受到毒素伤害，成功不受伤害。伤害骰在5、11、17级增加。',
  },
  {
    id: 'sacred-flame', name: '圣火术', englishName: 'Sacred Flame', level: 0, school: '塑能',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 1, sides: 8, bonus: 0 }, damageType: 'radiant', cantripScaling: true,
    description: '目标进行敏捷豁免；失败受到光耀伤害，成功不受伤害。伤害骰在5、11、17级增加。',
  },
  {
    id: 'vicious-mockery', name: '恶言相加', englishName: 'Vicious Mockery', level: 0, school: '附魔',
    classes: ['bard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'wis',
    dice: { count: 1, sides: 4, bonus: 0 }, damageType: 'psychic', cantripScaling: true,
    onFailedSaveEffect: 'vicious-mockery',
    description: '目标进行感知豁免；失败受到心灵伤害，并在其下回合结束前进行的下一次攻击检定中具有劣势。成功则不受影响。伤害骰在5、11、17级增加。',
  },
  {
    id: 'cure-wounds', name: '疗伤术', englishName: 'Cure Wounds', level: 1, school: '塑能',
    classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'], castingTime: 'action', rangeFeet: 5, target: 'ally', effect: 'healing',
    dice: { count: 1, sides: 8, bonus: 0, perHigherSlot: 1 }, addSpellcastingModifier: true,
    description: '触碰一名生物，使其恢复1d8＋施法属性调整值的生命；升环时每高一环增加1d8。对构装体与亡灵无效。',
  },
  {
    id: 'healing-word', name: '治愈真言', englishName: 'Healing Word', level: 1, school: '塑能',
    classes: ['bard', 'cleric', 'druid'], castingTime: 'bonus-action', rangeFeet: 60, target: 'ally', effect: 'healing',
    dice: { count: 1, sides: 4, bonus: 0, perHigherSlot: 1 }, addSpellcastingModifier: true,
    description: '以附赠动作令射程内一名生物恢复1d4＋施法属性调整值的生命；升环时每高一环增加1d4。对构装体与亡灵无效。',
  },
  {
    id: 'bane', name: '灾祸术', englishName: 'Bane', level: 1, school: '附魔',
    classes: ['bard', 'cleric'], castingTime: 'action', rangeFeet: 30, target: 'hostile', effect: 'attack-save-debuff',
    saveAbility: 'cha', dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 3, additionalTargetsPerHigherSlot: 1,
    description: '选择射程内至多三个生物。每个目标进行魅力豁免；失败者在法术持续期间每次进行攻击检定或豁免时掷 1d4，并从检定结果中减去该数值。每使用高一环法术位可多选择一个目标；需要专注，持续至多 1 分钟。',
  },
  {
    id: 'bless', name: '祝福术', englishName: 'Bless', level: 1, school: '附魔',
    classes: ['cleric', 'paladin'], castingTime: 'action', rangeFeet: 30, target: 'ally', effect: 'attack-save-buff',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 10,
    maximumTargets: 3, additionalTargetsPerHigherSlot: 1,
    description: '选择射程内至多三个生物。法术持续期间，目标每次进行攻击检定或豁免时掷 1d4，并将结果加入检定。每使用高一环法术位可多选择一个目标；需要专注，持续至多 1 分钟。',
  },
  {
    id: 'shield-of-faith', name: '虔诚护盾', englishName: 'Shield of Faith', level: 1, school: '防护',
    classes: ['cleric', 'paladin'], castingTime: 'bonus-action', rangeFeet: 60, target: 'ally', effect: 'armor-class-buff',
    dice: { count: 0, sides: 4, bonus: 0 }, concentration: true, concentrationDurationRounds: 100,
    description: '以附赠动作使射程内一个生物获得 +2 AC。法术需要专注，持续至多 10 分钟。',
  },
  {
    id: 'inflict-wounds', name: '致伤术', englishName: 'Inflict Wounds', level: 1, school: '死灵',
    classes: ['cleric'], castingTime: 'action', rangeFeet: 5, target: 'hostile', effect: 'spell-attack',
    dice: { count: 3, sides: 10, bonus: 0, perHigherSlot: 1 }, damageType: 'necrotic',
    description: '进行一次近战法术攻击；命中造成3d10黯蚀伤害，升环时每高一环增加1d10。',
  },
  {
    id: 'magic-missile', name: '魔法飞弹', englishName: 'Magic Missile', level: 1, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 120, target: 'hostile', effect: 'automatic-damage',
    dice: { count: 3, sides: 4, bonus: 0, perHigherSlot: 1 }, damageType: 'force', bonusPerDie: true,
    maximumTargets: 3, additionalTargetsPerHigherSlot: 1,
    description: '产生三枚自动命中的飞弹；每枚造成1d4＋1力场伤害。飞弹可分别指定射程内可见的目标，也可让多枚命中同一目标；升环时每高一环额外产生一枚飞弹。',
  },
  {
    id: 'scorching-ray', name: '灼热射线', englishName: 'Scorching Ray', level: 2, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 120, target: 'hostile', effect: 'spell-attack',
    dice: { count: 2, sides: 6, bonus: 0 }, damageType: 'fire',
    baseProjectiles: 3, additionalProjectilesPerHigherSlot: 1,
    description: '创造三道火焰射线；每道射线分别进行远程法术攻击，命中造成2d6火焰伤害。射线可以分配给同一或不同目标；每升一环增加一道射线。',
  },
  {
    id: 'shield', name: '护盾术', englishName: 'Shield', level: 1, school: '防护',
    classes: ['sorcerer', 'wizard'], castingTime: 'reaction', rangeFeet: 0, target: 'ally', effect: 'armor-class-buff',
    dice: { count: 0, sides: 4, bonus: 0 },
    description: '当你被一次攻击命中或成为魔法飞弹的目标时，以反应施放：直到你的下回合开始，你的 AC 获得 +5 加值（包括对触发攻击），并且你不受魔法飞弹伤害。系统会在符合触发条件时询问是否施放。',
  },
  {
    id: 'burning-hands', name: '燃烧之手', englishName: 'Burning Hands', level: 1, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 15, target: 'area', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 3, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'fire', damageOnSuccessfulSave: 'half',
    maximumTargets: 20, maximumTargetSeparationFeet: 30,
    area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
    description: '15尺锥状区域内的生物进行敏捷豁免；失败受到3d6火焰伤害，成功减半。每使用高一环法术位，伤害增加1d6。地图中由玩家选择锥形范围内目标，DM端验证射程与目标关系。',
  },
  {
    id: 'thunderwave', name: '雷鸣波', englishName: 'Thunderwave', level: 1, school: '塑能',
    classes: ['bard', 'druid', 'sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 15, target: 'area', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 2, sides: 8, bonus: 0, perHigherSlot: 1 }, damageType: 'thunder', damageOnSuccessfulSave: 'half',
    maximumTargets: 20,
    area: { shape: 'line', origin: 'self', widthFeet: 15, lengthFeet: 15, aimRangeFeet: 15 },
    onFailedSaveEffect: 'thunderwave-push',
    description: '以自身为源点形成15尺立方区域。区域内生物进行体质豁免；失败受到2d8雷鸣伤害并被推离你10尺，成功则伤害减半且不被推动。每使用高一环法术位，伤害增加1d8。',
  },
  {
    id: 'shatter', name: '粉碎音波', englishName: 'Shatter', level: 2, school: '塑能',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'area', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 3, sides: 8, bonus: 0, perHigherSlot: 1 }, damageType: 'thunder', damageOnSuccessfulSave: 'half',
    maximumTargets: 20, maximumTargetSeparationFeet: 20,
    area: { shape: 'circle', origin: 'point', radiusFeet: 10, placeRangeFeet: 60 },
    description: '射程内一点周围10尺球形区域中的生物进行体质豁免；失败受到3d8雷鸣伤害，成功减半。每使用高一环法术位，伤害增加1d8。地图中选择同一区域内目标。',
  },
  {
    id: 'fireball', name: '火球术', englishName: 'Fireball', level: 3, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 150, target: 'area', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 8, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'fire', damageOnSuccessfulSave: 'half',
    maximumTargets: 20, maximumTargetSeparationFeet: 40,
    area: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 150 },
    description: '射程内一点周围20尺球形区域中的生物进行敏捷豁免；失败受到8d6火焰伤害，成功减半。每使用高一环法术位，伤害增加1d6。地图中选择同一区域内目标。',
  },
  {
    id: 'lightning-bolt', name: '闪电束', englishName: 'Lightning Bolt', level: 3, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 100, target: 'area', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 8, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'lightning', damageOnSuccessfulSave: 'half',
    maximumTargets: 20, maximumTargetSeparationFeet: 100,
    area: { shape: 'line', origin: 'self', widthFeet: 5, lengthFeet: 100, aimRangeFeet: 100 },
    description: '从你所在位置延伸出100尺长、5尺宽的直线；线内生物进行敏捷豁免，失败受到8d6闪电伤害，成功减半。每使用高一环法术位，伤害增加1d6；目标是否位于同一直线由DM确认。',
  },
  {
    id: 'circle-of-death', name: '死亡法阵', englishName: 'Circle of Death', level: 6, school: '死灵',
    classes: ['sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 150, target: 'area', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 8, sides: 6, bonus: 0, perHigherSlot: 2 }, damageType: 'necrotic', damageOnSuccessfulSave: 'half',
    maximumTargets: 100, maximumTargetSeparationFeet: 120,
    area: { shape: 'circle', origin: 'point', radiusFeet: 60, placeRangeFeet: 150 },
    description: '射程内一点周围60尺球形区域中的生物进行体质豁免；失败受到8d6黯蚀伤害，成功减半。每使用高一环法术位，伤害增加2d6。地图中由玩家选择同一球形区域内的目标，DM端复核目标关系。',
  },
  {
    id: 'blight', name: '枯萎术', englishName: 'Blight', level: 4, school: '死灵',
    classes: ['druid', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 30, target: 'hostile', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 8, sides: 8, bonus: 0, perHigherSlot: 1 }, damageType: 'necrotic', damageOnSuccessfulSave: 'half',
    description: '目标进行体质豁免；失败受到8d8黯蚀伤害，成功减半，升环时每高一环增加1d8。构装生物和亡灵不受影响；植物目标以劣势豁免且伤害取最大值。',
  },
  {
    id: 'cone-of-cold', name: '寒冰锥', englishName: 'Cone of Cold', level: 5, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'area', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 8, sides: 8, bonus: 0, perHigherSlot: 1 }, damageType: 'cold', damageOnSuccessfulSave: 'half',
    maximumTargets: 100, maximumTargetSeparationFeet: 120,
    area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
    description: '60尺锥状区域内的生物进行体质豁免；失败受到8d8冷冻伤害，成功减半。每升一环增加1d8；被该伤害杀死的生物成为冰冻塑像，直至解冻。',
  },
  {
    id: 'chain-lightning', name: '连锁闪电', englishName: 'Chain Lightning', level: 6, school: '塑能',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 150, target: 'hostile', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 10, sides: 8, bonus: 0 }, damageType: 'lightning', damageOnSuccessfulSave: 'half',
    maximumTargets: 4, additionalTargetsPerHigherSlot: 1, secondaryTargetsWithinFeetOfFirst: 30,
    description: '首个目标及其30尺内至多三个不同的后续目标分别进行敏捷豁免；失败受到10d8闪电伤害，成功减半。每升一环增加一个后续目标。',
  },
  {
    id: 'disintegrate', name: '解离术', englishName: 'Disintegrate', level: 6, school: '变化',
    classes: ['sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'dex',
    dice: { count: 10, sides: 6, bonus: 40, perHigherSlot: 3 }, damageType: 'force', damageOnSuccessfulSave: 'none',
    description: '目标进行敏捷豁免；失败受到10d6＋40力场伤害，成功不受伤害。每升一环增加3d6；因此降至0生命的生物会被解离。',
  },
  {
    id: 'freezing-sphere', name: '冰封法球', englishName: 'Freezing Sphere', level: 6, school: '塑能',
    classes: ['wizard'], castingTime: 'action', rangeFeet: 300, target: 'area', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 10, sides: 6, bonus: 0, perHigherSlot: 1 }, damageType: 'cold', damageOnSuccessfulSave: 'half',
    maximumTargets: 100, maximumTargetSeparationFeet: 120,
    area: { shape: 'circle', origin: 'point', radiusFeet: 60, placeRangeFeet: 300 },
    description: '立即发射模式：射程内一点周围60尺球状区域内的生物进行体质豁免；失败受到10d6冷冻伤害，成功减半，每升一环增加1d6。延迟发射与冻结水面仍由DM裁定。',
  },
  {
    id: 'finger-of-death', name: '死亡一指', englishName: 'Finger of Death', level: 7, school: '死灵',
    classes: ['sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 7, sides: 8, bonus: 30 }, damageType: 'necrotic', damageOnSuccessfulSave: 'half',
    description: '目标进行体质豁免；失败受到7d8＋30黯蚀伤害，成功减半。若以此法术杀死人形生物，其在你的下回合开始时成为永久受控僵尸；僵尸生成与控制目前由DM裁定。',
  },
  {
    id: 'sunburst', name: '阳炎爆', englishName: 'Sunburst', level: 8, school: '塑能',
    classes: ['druid', 'sorcerer', 'wizard'], castingTime: 'action', rangeFeet: 150, target: 'area', effect: 'saving-throw', saveAbility: 'con',
    dice: { count: 12, sides: 6, bonus: 0 }, damageType: 'radiant', damageOnSuccessfulSave: 'half',
    maximumTargets: 100, maximumTargetSeparationFeet: 120,
    area: { shape: 'circle', origin: 'point', radiusFeet: 60, placeRangeFeet: 150 },
    onFailedSaveEffect: 'sunburst-blindness',
    description: '以射程内一点为中心形成60尺半径区域。区域内生物进行体质豁免；失败受到12d6光耀伤害并目盲1分钟，成功则伤害减半且不目盲。亡灵和泥怪以劣势豁免；目盲目标每回合结束时可再次豁免，成功则结束目盲。',
  },
  {
    id: 'power-word-kill', name: '律令死亡', englishName: 'Power Word Kill', level: 9, school: '附魔',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'], castingTime: 'action', rangeFeet: 60, target: 'hostile', effect: 'power-word-kill',
    dice: { count: 0, sides: 4, bonus: 0 },
    description: '对射程内一个生物说出死亡律令。若目标当前生命值不高于100，目标立即死亡；否则法术无效。临时生命值不计入这项门槛。',
  },
] as const

const spellsById = new Map(DND5E_SRD_COMBAT_SPELLS.map((spell) => [spell.id, spell]))

export function getDnd5eSrdCombatSpell(id: string): Dnd5eSrdSpellDefinition | undefined {
  return spellsById.get(id)
}

export function dnd5eCantripDiceMultiplier(level: number): number {
  if (level >= 17) return 4
  if (level >= 11) return 3
  if (level >= 5) return 2
  return 1
}

export function dnd5eSpellDiceCount(spell: Dnd5eSrdSpellDefinition, casterLevel: number, slotLevel: number): number {
  if (spell.level === 0) return spell.dice.count * dnd5eCantripDiceMultiplier(casterLevel)
  return spell.dice.count + Math.max(0, slotLevel - spell.level) * (spell.dice.perHigherSlot ?? 0)
}

export function dnd5eSpellDamageDiceCounts(
  spell: Dnd5eSrdSpellDefinition,
  casterLevel: number,
  slotLevel: number,
  higherSlotDamageType?: Dnd5eDamageType,
): readonly number[] {
  const higherSlots = Math.max(0, slotLevel - spell.level)
  const selectedChoice = higherSlots > 0 ? higherSlotDamageType : undefined
  const primaryHigherDice = spell.primaryHigherSlotChoice
    ? selectedChoice === spell.damageType ? higherSlots * (spell.dice.perHigherSlot ?? 0) : 0
    : higherSlots * (spell.dice.perHigherSlot ?? 0)
  const primary = spell.level === 0
    ? spell.dice.count * dnd5eCantripDiceMultiplier(casterLevel)
    : spell.dice.count + primaryHigherDice
  return [
    primary,
    ...(spell.additionalDamageComponents ?? []).map((component) => component.dice.count + (
      component.higherSlotChoice
        ? selectedChoice === component.damageType ? higherSlots * (component.dice.perHigherSlot ?? 0) : 0
        : higherSlots * (component.dice.perHigherSlot ?? 0)
    )),
  ]
}

export function dnd5eSpellHigherSlotDamageChoices(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
): readonly Dnd5eDamageType[] {
  if (slotLevel <= spell.level) return []
  return [
    ...(spell.primaryHigherSlotChoice && spell.damageType ? [spell.damageType] : []),
    ...(spell.additionalDamageComponents ?? []).flatMap((component) =>
      component.higherSlotChoice ? [component.damageType] : [],
    ),
  ]
}

export function dnd5eSpellDelayedDamageDiceCount(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
): number {
  const delayed = spell.delayedDamage
  if (!delayed) return 0
  return delayed.dice.count + Math.max(0, slotLevel - spell.level) * (delayed.dice.perHigherSlot ?? 0)
}

export function dnd5eSpellProjectileCount(
  spell: Dnd5eSrdSpellDefinition,
  casterLevel: number,
  slotLevel: number,
): number | undefined {
  if (spell.id === 'eldritch-blast') return dnd5eCantripDiceMultiplier(casterLevel)
  if (spell.id === 'magic-missile') return dnd5eSpellDiceCount(spell, casterLevel, slotLevel)
  if (spell.baseProjectiles == null) return undefined
  return Math.max(1, spell.baseProjectiles +
    Math.max(0, slotLevel - spell.level) * (spell.additionalProjectilesPerHigherSlot ?? 0))
}

export function dnd5eSpellConcentrationDurationRounds(spell: Dnd5eSrdSpellDefinition, slotLevel: number): number {
  if (spell.id === 'hunters-mark') {
    if (slotLevel >= 5) return 14_400
    if (slotLevel >= 3) return 4_800
  }
  return Math.max(1, spell.concentrationDurationRounds ?? 1)
}

export function dnd5eSpellMaximumTargets(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
  casterLevel?: number,
): number {
  const projectiles = dnd5eSpellProjectileCount(spell, casterLevel ?? 1, slotLevel)
  if (projectiles != null) return projectiles
  return Math.max(1, (spell.maximumTargets ?? 1) +
    Math.max(0, slotLevel - spell.level) * (spell.additionalTargetsPerHigherSlot ?? 0))
}

export function dnd5eSpellAllowsRepeatedTargets(spell: Dnd5eSrdSpellDefinition): boolean {
  return spell.id === 'magic-missile' || spell.id === 'eldritch-blast' || spell.baseProjectiles != null
}

export function dnd5eSpellUsesSequencedAttacks(spell: Dnd5eSrdSpellDefinition): boolean {
  return spell.effect === 'spell-attack' && (spell.id === 'eldritch-blast' || spell.baseProjectiles != null)
}

export function dnd5eSpellAreaLabel(
  spell: Pick<Dnd5eSrdSpellDefinition, 'area'> & Partial<Pick<Dnd5eSrdSpellDefinition, 'id'>>,
): string | undefined {
  const area = spell.area
  if (!area) return undefined
  if (area.shape === 'circle') {
    const placement = area.origin === 'point' && area.placeRangeFeet != null ? `${area.placeRangeFeet}尺内一点，` : '以自身为中心，'
    return `${placement}${area.radiusFeet}尺半径球形（直径${area.radiusFeet * 2}尺）`
  }
  if (area.shape === 'cone') return `自身起点，${area.lengthFeet}尺锥形`
  if (area.shape === 'line') {
    if (spell.id === 'thunderwave') return '自身起点，15×15尺立方区域'
    return `自身起点，${area.lengthFeet}尺长、${area.widthFeet}尺宽直线`
  }
  return `${area.placeRangeFeet != null ? `${area.placeRangeFeet}尺内，` : ''}${area.widthFeet}×${area.heightFeet}尺区域`
}

export function dnd5eSpellSelectionKey(character: Pick<Character, 'charClass'>): 'spell-known' | 'spell-prepared' | undefined {
  const kind = dnd5eClassDefinitionForCharacter(character)?.spellcasting?.kind
  if (!kind) return undefined
  return kind === 'full-known' || kind === 'half-known' || kind === 'pact' ? 'spell-known' : 'spell-prepared'
}

export const DND5E_BARD_MAGICAL_SECRETS_KEY = 'magical-secrets'
export const DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY = 'lore-additional-magical-secrets'

export function dnd5eBardMagicalSecretsLimit(character: Pick<Character, 'charClass' | 'level'>): number {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (definition?.id !== 'bard') return 0
  if (character.level >= 18) return 6
  if (character.level >= 14) return 4
  return character.level >= 10 ? 2 : 0
}

export function dnd5eLoreAdditionalMagicalSecretsLimit(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassChoices'>,
): number {
  const definition = dnd5eClassDefinitionForCharacter(character)
  const subclass = definition && character.dnd5eClassChoices?.classes?.[definition.id]?.subclass
  return definition?.id === 'bard' && subclass === 'lore' && character.level >= 6 ? 2 : 0
}

export function dnd5eBardMagicalSecretsMaxSpellLevel(character: Pick<Character, 'charClass' | 'level'>): number {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (definition?.id !== 'bard') return 0
  const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, character.level - 1))]
  return progression.spellSlots.length
}

export function dnd5eBardMagicalSecretSpellIds(character: Character): readonly string[] {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (definition?.id !== 'bard') return []
  const selections = character.dnd5eClassChoices?.classes?.bard?.selections
  const allowed = new Set(dnd5eBardMagicalSecretsOptions(dnd5eBardMagicalSecretsMaxSpellLevel(character)).map((spell) => spell.id))
  const core = (selections?.[DND5E_BARD_MAGICAL_SECRETS_KEY] ?? [])
    .slice(0, dnd5eBardMagicalSecretsLimit(character))
  const lore = (selections?.[DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY] ?? [])
    .slice(0, dnd5eLoreAdditionalMagicalSecretsLimit(character))
  return [...new Set([...core, ...lore])].filter((id) => allowed.has(id))
}

/** All spells selected on the character sheet, including reference-only entries. */
export function dnd5eSelectedSpellIds(character: Character): readonly string[] {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (!definition?.spellcasting) return []
  const selections = character.dnd5eClassChoices?.classes?.[definition.id]?.selections
  return [...new Set([
    ...(selections?.['spell-cantrips'] ?? []),
    ...(selections?.[dnd5eSpellSelectionKey(character) ?? ''] ?? []),
    ...(selections?.['spell-mastery-1'] ?? []),
    ...(selections?.['spell-mastery-2'] ?? []),
    ...(selections?.['signature-spells'] ?? []),
    ...(selections?.['mystic-arcanum-6'] ?? []),
    ...(selections?.['mystic-arcanum-7'] ?? []),
    ...(selections?.['mystic-arcanum-8'] ?? []),
    ...(selections?.['mystic-arcanum-9'] ?? []),
    ...dnd5eBardMagicalSecretSpellIds(character),
  ])]
}

export function dnd5eSelectedCombatSpellIds(character: Character): readonly string[] {
  return dnd5eSelectedSpellIds(character).filter((id) => spellsById.has(id))
}

export interface Dnd5eFreeSpellCastSource {
  kind: 'spell-mastery' | 'signature-spell' | 'mystic-arcanum'
  resourceKey?: string
}

export function dnd5eCanOverchannelSpell(
  caster: { classId?: Dnd5eClassId; subclassId?: string; level: number },
  spell: Pick<Dnd5eSrdSpellDefinition, 'classes' | 'damageType' | 'level' | 'school'>,
  slotLevel: number,
): boolean {
  return caster.classId === 'wizard' && caster.subclassId === 'evocation' && caster.level >= 14 &&
    spell.classes.includes('wizard') && spell.school === '塑能' && spell.damageType != null &&
    spell.level >= 1 && Number.isInteger(slotLevel) && slotLevel >= spell.level && slotLevel <= 5
}

/** 塑能学派“法术塑形”只适用于会迫使区域内生物进行豁免的塑能法术。 */
export function dnd5eCanSculptSpell(
  caster: { classId?: Dnd5eClassId; subclassId?: string; level: number },
  spell: Pick<Dnd5eSrdSpellDefinition, 'effect' | 'level' | 'school' | 'target'>,
): boolean {
  return caster.classId === 'wizard' && caster.subclassId === 'evocation' && caster.level >= 2 &&
    spell.school === '塑能' && spell.target === 'area' && spell.effect === 'saving-throw'
}

export function dnd5eSculptSpellMaximumTargets(
  spell: Pick<Dnd5eSrdSpellDefinition, 'level'>,
): number {
  return 1 + Math.max(0, Math.floor(spell.level))
}

export const DND5E_IMPLEMENTED_METAMAGIC_IDS = [
  'careful', 'distant', 'extended', 'heightened', 'quickened', 'subtle', 'twinned',
] as const satisfies readonly Dnd5eMetamagicId[]

export type Dnd5eImplementedMetamagicId = typeof DND5E_IMPLEMENTED_METAMAGIC_IDS[number]

const METAMAGIC_LABELS: Record<Dnd5eMetamagicId, string> = {
  careful: '谨慎法术',
  distant: '远距法术',
  empowered: '强效法术',
  extended: '延效法术',
  heightened: '升阶法术',
  quickened: '瞬发法术',
  subtle: '精妙法术',
  twinned: '孪生法术',
}

export function dnd5eMetamagicLabel(kind: Dnd5eMetamagicId): string {
  return METAMAGIC_LABELS[kind]
}

export function dnd5eMetamagicCost(kind: Dnd5eMetamagicId, spellLevel?: number): number {
  if (kind === 'heightened') return 3
  if (kind === 'quickened') return 2
  if (kind === 'twinned') {
    return spellLevel == null || !Number.isInteger(spellLevel) || spellLevel < 0
      ? Number.POSITIVE_INFINITY
      : Math.max(1, spellLevel)
  }
  return (DND5E_IMPLEMENTED_METAMAGIC_IDS as readonly Dnd5eMetamagicId[]).includes(kind)
    ? 1
    : Number.POSITIVE_INFINITY
}

export function dnd5eMetamagicAvailableForSpell(
  kind: Dnd5eMetamagicId,
  spell: Dnd5eSrdSpellDefinition,
  slotLevel = spell.level,
): kind is Dnd5eImplementedMetamagicId {
  if (!(DND5E_IMPLEMENTED_METAMAGIC_IDS as readonly Dnd5eMetamagicId[]).includes(kind)) return false
  if (kind === 'careful') return spell.effect === 'saving-throw'
  if (kind === 'distant') return spell.rangeFeet > 0
  if (kind === 'extended') {
    return spell.concentration === true && dnd5eSpellConcentrationDurationRounds(spell, spell.level) >= 10
  }
  if (kind === 'heightened') return spell.effect === 'saving-throw' || spell.effect === 'attack-save-debuff'
  if (kind === 'quickened') return spell.castingTime === 'action'
  if (kind === 'twinned') {
    return spell.target !== 'area' && spell.rangeFeet > 0 &&
      dnd5eSpellMaximumTargets(spell, slotLevel) === 1
  }
  return kind === 'subtle'
}

export function dnd5eCanEmpowerSpell(
  spell: Pick<Dnd5eSrdSpellDefinition, 'damageType' | 'dice' | 'effect' | 'additionalDamageComponents' | 'delayedDamage'>,
): boolean {
  return spell.damageType != null && spell.dice.count > 0 &&
    (spell.additionalDamageComponents?.length ?? 0) === 0 && spell.delayedDamage == null &&
    (spell.effect === 'spell-attack' || spell.effect === 'saving-throw' || spell.effect === 'automatic-damage')
}

export function dnd5eMetamagicRangeFeet(
  spell: Pick<Dnd5eSrdSpellDefinition, 'rangeFeet'>,
  distant: boolean,
): number {
  if (!distant) return spell.rangeFeet
  return spell.rangeFeet <= 5 ? 30 : spell.rangeFeet * 2
}

export function dnd5eCarefulSpellMaximumTargets(charismaScore: number): number {
  return Math.max(1, rules.abilityModifier(charismaScore))
}

export function dnd5eHeightenedSavingThrowMode(
  mode: 'normal' | 'advantage' | 'disadvantage',
  heightened: boolean,
): 'normal' | 'advantage' | 'disadvantage' {
  return heightened ? imposeDnd5eRollDisadvantage(mode, 'heightened-spell').mode : mode
}

export function dnd5eDraconicAncestorDamageType(
  ancestorId: string | undefined,
): Extract<Dnd5eDamageType, 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'> | undefined {
  const damageType = ancestorId?.split('-').at(-1)
  return damageType === 'acid' || damageType === 'cold' || damageType === 'fire' ||
    damageType === 'lightning' || damageType === 'poison'
    ? damageType
    : undefined
}

/**
 * Returns the resistance type granted by Draconic Bloodline's Elemental Affinity,
 * or undefined when this cast is not eligible. Resource availability is validated
 * by the caller because Metamagic and this option share the same point pool.
 */
export function dnd5eDraconicElementalResistanceType(
  caster: {
    classId?: Dnd5eClassId
    subclassId?: string
    level: number
    classSelections: Readonly<Record<string, readonly string[] | undefined>>
  },
  spell: Pick<Dnd5eSrdSpellDefinition, 'damageType'>,
): Extract<Dnd5eDamageType, 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'> | undefined {
  if (caster.classId !== 'sorcerer' || caster.subclassId !== 'draconic' || caster.level < 6) return undefined
  const damageType = dnd5eDraconicAncestorDamageType(caster.classSelections['dragon-ancestor']?.[0])
  return damageType && spell.damageType === damageType ? damageType : undefined
}

function mysticArcanumClassLevel(spellLevel: number): number | undefined {
  if (spellLevel === 6) return 11
  if (spellLevel === 7) return 13
  if (spellLevel === 8) return 15
  if (spellLevel === 9) return 17
  return undefined
}

export function dnd5eFreeSpellCastSource(
  caster: {
    classId?: Dnd5eClassId
    level: number
    classSelections: Readonly<Record<string, readonly string[] | undefined>>
    classResources: Readonly<Record<string, { current: number; max: number } | undefined>>
  },
  spell: Pick<Dnd5eSrdSpellDefinition, 'id' | 'level'>,
  slotLevel: number,
): Dnd5eFreeSpellCastSource | undefined {
  if (slotLevel !== spell.level) return undefined
  if (caster.classId === 'warlock') {
    const requiredLevel = mysticArcanumClassLevel(spell.level)
    const resourceKey = `dnd5e-mystic-arcanum-${spell.level}`
    if (
      requiredLevel != null && caster.level >= requiredLevel &&
      caster.classSelections[`mystic-arcanum-${spell.level}`]?.includes(spell.id) &&
      (caster.classResources[resourceKey]?.current ?? 0) > 0
    ) return { kind: 'mystic-arcanum', resourceKey }
    return undefined
  }
  if (caster.classId !== 'wizard') return undefined
  if (
    caster.level >= 18 &&
    ((spell.level === 1 && caster.classSelections['spell-mastery-1']?.includes(spell.id)) ||
      (spell.level === 2 && caster.classSelections['spell-mastery-2']?.includes(spell.id)))
  ) return { kind: 'spell-mastery' }
  if (caster.level < 20 || spell.level !== 3) return undefined
  const index = caster.classSelections['signature-spells']?.indexOf(spell.id) ?? -1
  if (index < 0 || index > 1) return undefined
  const resourceKey = `dnd5e-signature-spell-${index + 1}`
  return (caster.classResources[resourceKey]?.current ?? 0) > 0
    ? { kind: 'signature-spell', resourceKey }
    : undefined
}

export function dnd5eAvailableCombatSpells(character: Character): readonly Dnd5eSrdSpellDefinition[] {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (!definition?.spellcasting) return []
  const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, character.level - 1))]
  const highestLevel = definition.spellcasting.kind === 'pact'
    ? dnd5ePactSlotLevel(character.level)
    : progression.spellSlots.length
  return DND5E_SRD_COMBAT_SPELLS.filter((spell) =>
    spell.classes.includes(definition.id) && (spell.level === 0 ? (progression.cantripsKnown ?? 0) > 0 : spell.level <= highestLevel),
  )
}

export function dnd5eCombatSpellSelectionLimits(character: Character): { cantrips: number; spells: number } {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (!definition?.spellcasting) return { cantrips: 0, spells: 0 }
  const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, character.level - 1))]
  let spells = definition.spellcasting.kind === 'full-known' || definition.spellcasting.kind === 'half-known' || definition.spellcasting.kind === 'pact'
    ? progression.spellsKnown ?? 0
    : dnd5ePreparedSpellCount(character) ?? 0
  // 吟游诗人表中的 Spells Known 已包含 10、14、18 级各两项魔法奥秘，
  // 因此普通吟游诗人法表选择必须扣除这些独立名额。逸闻学院的额外魔法奥秘不计入该表。
  if (definition.id === 'bard') spells = Math.max(0, spells - dnd5eBardMagicalSecretsLimit(character))
  return { cantrips: progression.cantripsKnown ?? 0, spells }
}
