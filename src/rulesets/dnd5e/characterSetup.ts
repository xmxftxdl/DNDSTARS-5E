import type { AbilityKey } from '../../lib/dnd'
import type { Abilities } from '../../types/character'
import {
  dnd5ePluginRaceDefinition,
  type Dnd5ePluginFlexibleAbilityBonus,
} from './pluginApi'
import { dnd5eCoreRaceMechanics } from './coreRaceMechanics'

export type Dnd5eCoreAbilityGenerationMethod = 'beginner-recommended' | 'standard-array' | 'point-buy' | 'roll-4d6'
export type Dnd5eAbilityGenerationMethod = Dnd5eCoreAbilityGenerationMethod | `${string}:${string}`
export type Dnd5eCombatPreference = 'frontline' | 'ranged' | 'magic' | 'support' | 'versatile'
export type Dnd5ePartyRolePreference = 'damage' | 'defense' | 'support' | 'exploration' | 'control'
export type Dnd5ePowerPreference = 'martial' | 'arcane' | 'divine' | 'nature' | 'innate'
export type Dnd5eHeritagePreference = 'versatile' | 'sturdy' | 'agile' | 'mystical' | 'intimidating'
export type Dnd5eComplexityPreference = 'straightforward' | 'adaptive' | 'tactical'
export type Dnd5eMagicCommitmentPreference = 'none' | 'hybrid' | 'full'
export type Dnd5eDefensePreference = 'armored' | 'endurance' | 'mobility' | 'avoidance'
export type Dnd5eUtilityPreference = 'social' | 'knowledge' | 'wilderness' | 'stealth' | 'adaptable'
export type Dnd5eOrderPreference = 'lawful' | 'neutral' | 'chaotic'
export type Dnd5eMoralityPreference = 'good' | 'neutral' | 'evil'

export interface Dnd5eBeginnerPreferences {
  combat: Dnd5eCombatPreference
  role: Dnd5ePartyRolePreference
  power: Dnd5ePowerPreference
  complexity: Dnd5eComplexityPreference
  magicCommitment: Dnd5eMagicCommitmentPreference
  defense: Dnd5eDefensePreference
  utility: Dnd5eUtilityPreference
  heritage: Dnd5eHeritagePreference
  order: Dnd5eOrderPreference
  morality: Dnd5eMoralityPreference
}

export interface Dnd5eClassRecommendationCandidate {
  charClass: string
  score: number
  matchPercent: number
  matchedPreferences: string[]
  reasons: string[]
}

export interface Dnd5eRaceRecommendationCandidate {
  race: string
  score: number
  racialBonusChoices: AbilityKey[]
  finalAbilities: Abilities
  reasons: string[]
}

export interface Dnd5eClassAbilityFit {
  charClass: string
  primaryAbilities: AbilityKey[]
  secondaryAbilities: AbilityKey[]
  rating: 'excellent' | 'good' | 'weak'
  summary: string
}

export interface Dnd5eCharacterRecommendation {
  charClass: string
  race: string
  alignment: string
  background: string
  classCandidates: Dnd5eClassRecommendationCandidate[]
  raceCandidates: Dnd5eRaceRecommendationCandidate[]
  reasons: string[]
}

export interface Dnd5eFourD6Roll {
  dice: readonly [number, number, number, number]
  discardedIndex: number
  total: number
}

export interface Dnd5eAbilityRoll {
  dice: readonly number[]
  discardedIndices: readonly number[]
  total: number
}

export interface Dnd5ePointBuyRule {
  budget: number
  minimum: number
  maximum: number
  costs: Readonly<Record<number, number>>
}

export const DND5E_STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const
export const DND5E_POINT_BUY_BUDGET = 27
export const DND5E_CORE_POINT_BUY_RULE: Dnd5ePointBuyRule = {
  budget: DND5E_POINT_BUY_BUDGET,
  minimum: 8,
  maximum: 15,
  costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
}

export const DEFAULT_DND5E_BEGINNER_PREFERENCES: Dnd5eBeginnerPreferences = {
  combat: 'versatile',
  role: 'defense',
  power: 'martial',
  complexity: 'adaptive',
  magicCommitment: 'hybrid',
  defense: 'armored',
  utility: 'adaptable',
  heritage: 'versatile',
  order: 'neutral',
  morality: 'good',
}

const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const CLASS_ORDER = [
  '野蛮人', '吟游诗人', '牧师', '德鲁伊', '战士', '武僧',
  '圣武士', '游侠', '游荡者', '术士', '邪术师', '法师',
] as const

const CLASS_ABILITY_PRIORITY: Readonly<Record<string, readonly AbilityKey[]>> = {
  野蛮人: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  吟游诗人: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  牧师: ['wis', 'con', 'str', 'cha', 'dex', 'int'],
  德鲁伊: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
  战士: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  武僧: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  圣武士: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
  游侠: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  游荡者: ['dex', 'con', 'cha', 'int', 'wis', 'str'],
  术士: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  邪术师: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  法师: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
}

const SCORE_BY_COMBAT: Record<Dnd5eCombatPreference, Partial<Record<string, number>>> = {
  frontline: { 野蛮人: 18, 战士: 18, 圣武士: 16, 武僧: 12, 牧师: 8, 德鲁伊: 6 },
  ranged: { 游侠: 18, 游荡者: 17, 战士: 12, 邪术师: 10, 术士: 8, 法师: 7 },
  magic: { 法师: 18, 术士: 18, 邪术师: 17, 吟游诗人: 13, 牧师: 11, 德鲁伊: 11 },
  support: { 牧师: 18, 吟游诗人: 17, 德鲁伊: 15, 圣武士: 12, 法师: 6 },
  versatile: { 战士: 11, 吟游诗人: 11, 游侠: 11, 德鲁伊: 10, 牧师: 10, 圣武士: 9, 游荡者: 8 },
}

const SCORE_BY_ROLE: Record<Dnd5ePartyRolePreference, Partial<Record<string, number>>> = {
  damage: { 野蛮人: 18, 游荡者: 18, 术士: 17, 战士: 16, 法师: 16, 邪术师: 15, 武僧: 13 },
  defense: { 战士: 20, 圣武士: 20, 野蛮人: 14, 牧师: 12, 德鲁伊: 8 },
  support: { 牧师: 20, 吟游诗人: 20, 德鲁伊: 17, 圣武士: 14, 法师: 7 },
  exploration: { 游侠: 20, 游荡者: 20, 德鲁伊: 15, 武僧: 9, 吟游诗人: 8 },
  control: { 法师: 20, 吟游诗人: 17, 德鲁伊: 17, 邪术师: 13, 术士: 10, 牧师: 8 },
}

const SCORE_BY_POWER: Record<Dnd5ePowerPreference, Partial<Record<string, number>>> = {
  martial: { 战士: 14, 野蛮人: 14, 游荡者: 12, 武僧: 12, 游侠: 8, 圣武士: 7 },
  arcane: { 法师: 14, 吟游诗人: 12, 邪术师: 12, 术士: 12, 游荡者: 3 },
  divine: { 牧师: 16, 圣武士: 16, 武僧: 3 },
  nature: { 德鲁伊: 16, 游侠: 14, 野蛮人: 5 },
  innate: { 术士: 16, 邪术师: 15, 武僧: 8, 吟游诗人: 4 },
}

const SCORE_BY_COMPLEXITY: Record<Dnd5eComplexityPreference, Partial<Record<string, number>>> = {
  straightforward: { 战士: 9, 野蛮人: 9, 游荡者: 8, 邪术师: 7, 牧师: 5, 武僧: 5 },
  adaptive: { 游侠: 8, 圣武士: 8, 牧师: 8, 武僧: 8, 战士: 7, 吟游诗人: 7, 邪术师: 7, 德鲁伊: 6 },
  tactical: { 法师: 10, 德鲁伊: 10, 吟游诗人: 9, 术士: 8, 牧师: 8, 武僧: 7, 邪术师: 6 },
}

const SCORE_BY_MAGIC_COMMITMENT: Record<Dnd5eMagicCommitmentPreference, Partial<Record<string, number>>> = {
  none: { 战士: 12, 野蛮人: 12, 游荡者: 11, 武僧: 10, 游侠: 4 },
  hybrid: { 圣武士: 12, 游侠: 12, 邪术师: 11, 武僧: 7, 牧师: 6, 战士: 4 },
  full: { 法师: 12, 术士: 12, 牧师: 12, 德鲁伊: 12, 吟游诗人: 12, 邪术师: 9 },
}

const SCORE_BY_DEFENSE: Record<Dnd5eDefensePreference, Partial<Record<string, number>>> = {
  armored: { 战士: 10, 圣武士: 10, 牧师: 9, 游侠: 6, 野蛮人: 4 },
  endurance: { 野蛮人: 10, 战士: 7, 德鲁伊: 7, 圣武士: 6, 牧师: 5 },
  mobility: { 武僧: 10, 游荡者: 10, 游侠: 8, 吟游诗人: 5, 野蛮人: 5 },
  avoidance: { 法师: 10, 术士: 9, 邪术师: 8, 吟游诗人: 8, 游荡者: 6, 德鲁伊: 5 },
}

const SCORE_BY_UTILITY: Record<Dnd5eUtilityPreference, Partial<Record<string, number>>> = {
  social: { 吟游诗人: 12, 圣武士: 10, 邪术师: 10, 术士: 9, 游荡者: 8, 牧师: 7 },
  knowledge: { 法师: 12, 吟游诗人: 9, 牧师: 9, 德鲁伊: 8, 邪术师: 5 },
  wilderness: { 游侠: 12, 德鲁伊: 12, 野蛮人: 8, 牧师: 4 },
  stealth: { 游荡者: 12, 游侠: 10, 武僧: 8, 吟游诗人: 4 },
  adaptable: { 吟游诗人: 11, 战士: 9, 牧师: 9, 德鲁伊: 8, 游侠: 8, 游荡者: 8, 圣武士: 7 },
}

const HERITAGE_RACES: Record<Dnd5eHeritagePreference, readonly string[]> = {
  versatile: ['人类', '半精灵'],
  sturdy: ['矮人', '半兽人', '人类'],
  agile: ['精灵', '半身人', '人类'],
  mystical: ['侏儒', '提夫林', '半精灵', '人类'],
  intimidating: ['半兽人', '龙裔', '提夫林'],
}

const HERITAGE_LABELS: Record<Dnd5eHeritagePreference, string> = {
  versatile: '灵活且适应力强',
  sturdy: '坚韧可靠',
  agile: '轻盈敏捷',
  mystical: '神秘而魔法化',
  intimidating: '强悍有压迫感',
}

function emptyAbilities(value = 0): Abilities {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value }
}

export function dnd5eClassAbilityPriority(charClass: string): readonly AbilityKey[] {
  return CLASS_ABILITY_PRIORITY[charClass] ?? ABILITY_KEYS
}

export function recommendedDnd5eBaseAbilities(charClass: string): Abilities {
  return recommendedDnd5eBaseAbilitiesFromArray(charClass, DND5E_STANDARD_ARRAY)
}

export function recommendedDnd5eBaseAbilitiesFromArray(charClass: string, scores: readonly number[]): Abilities {
  const result = emptyAbilities(8)
  const ordered = [...scores].sort((left, right) => right - left)
  dnd5eClassAbilityPriority(charClass).forEach((ability, index) => {
    result[ability] = ordered[index] ?? 8
  })
  return result
}

export function recommendedHalfElfAbilityChoices(charClass: string): readonly [AbilityKey, AbilityKey] {
  const choices = dnd5eClassAbilityPriority(charClass).filter((ability) => ability !== 'cha')
  return [choices[0] ?? 'dex', choices[1] ?? 'con']
}

export function dnd5eRacialAbilityBonuses(
  race: string,
  racialBonusChoices: readonly AbilityKey[] = [],
): Abilities {
  const bonuses = emptyAbilities()
  const pluginRace = dnd5ePluginRaceDefinition(race)
  if (pluginRace) {
    for (const ability of ABILITY_KEYS) bonuses[ability] = pluginRace.abilityBonuses?.[ability] ?? 0
    const flexible = pluginRace.flexibleAbilityBonus
    if (flexible) {
      const excluded = new Set(flexible.exclude ?? [])
      for (const ability of [...new Set(racialBonusChoices)].filter((key) => !excluded.has(key)).slice(0, flexible.count)) {
        bonuses[ability] += flexible.amount
      }
    }
    return bonuses
  }
  if (race === '人类') {
    for (const ability of ABILITY_KEYS) bonuses[ability] = 1
  } else if (race === '矮人') bonuses.con = 2
  else if (race === '精灵' || race === '半身人') bonuses.dex = 2
  else if (race === '龙裔') {
    bonuses.str = 2
    bonuses.cha = 1
  } else if (race === '侏儒') bonuses.int = 2
  else if (race === '半精灵') {
    bonuses.cha = 2
    for (const ability of [...new Set(racialBonusChoices)].filter((key) => key !== 'cha').slice(0, 2)) {
      bonuses[ability] = 1
    }
  } else if (race === '半兽人') {
    bonuses.str = 2
    bonuses.con = 1
  } else if (race === '提夫林') {
    bonuses.int = 1
    bonuses.cha = 2
  }
  return bonuses
}

export function applyDnd5eRacialAbilityBonuses(base: Abilities, bonuses: Abilities): Abilities {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, base[key] + bonuses[key]])) as Abilities
}

export function dnd5eRaceSpeed(race: string): number {
  const pluginRace = dnd5ePluginRaceDefinition(race)
  if (pluginRace) return pluginRace.speedFeet
  return dnd5eCoreRaceMechanics(race)?.speedFeet ?? 30
}

export function dnd5eFlexibleRacialAbilityBonus(race: string): Dnd5ePluginFlexibleAbilityBonus | undefined {
  const pluginRace = dnd5ePluginRaceDefinition(race)
  if (pluginRace?.flexibleAbilityBonus) return pluginRace.flexibleAbilityBonus
  return race === '半精灵' ? { count: 2, amount: 1, exclude: ['cha'] } : undefined
}

const CORE_RACES = ['矮人', '精灵', '半身人', '人类', '龙裔', '侏儒', '半精灵', '半兽人', '提夫林'] as const
const ABILITY_LABELS: Readonly<Record<AbilityKey, string>> = {
  str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力',
}

const PREFERENCE_LABELS = {
  combat: {
    frontline: '站在前线近战', ranged: '保持距离精准攻击', magic: '用魔法改变局势',
    support: '治疗并支援同伴', versatile: '灵活应对不同局面',
  },
  role: {
    damage: '主要输出', defense: '保护队友', support: '辅助与恢复',
    exploration: '侦察与探索', control: '控制战场',
  },
  power: {
    martial: '训练与武艺', arcane: '学习奥术', divine: '信仰与誓言',
    nature: '自然与荒野', innate: '天生或契约力量',
  },
  complexity: {
    straightforward: '规则清晰、快速上手', adaptive: '有选择但不过度繁琐', tactical: '研究资源与战术组合',
  },
  magicCommitment: {
    none: '主要依靠非魔法能力', hybrid: '武艺与少量魔法结合', full: '完整施法者玩法',
  },
  defense: {
    armored: '依靠护甲与盾牌', endurance: '靠生命与减伤硬撑',
    mobility: '高速移动避开危险', avoidance: '保持距离或用法术防护',
  },
  utility: {
    social: '交涉与影响他人', knowledge: '调查、知识与解谜', wilderness: '野外生存与追踪',
    stealth: '潜行、侦察与开锁', adaptable: '各种场景都能搭把手',
  },
} as const

function classPreferenceContributions(
  preferences: Dnd5eBeginnerPreferences,
  charClass: string,
): Array<{ label: string; score: number; maximum: number }> {
  const rows = [
    { label: `战斗方式：${PREFERENCE_LABELS.combat[preferences.combat]}`, table: SCORE_BY_COMBAT[preferences.combat] },
    { label: `队伍定位：${PREFERENCE_LABELS.role[preferences.role]}`, table: SCORE_BY_ROLE[preferences.role] },
    { label: `力量来源：${PREFERENCE_LABELS.power[preferences.power]}`, table: SCORE_BY_POWER[preferences.power] },
    { label: `操作复杂度：${PREFERENCE_LABELS.complexity[preferences.complexity]}`, table: SCORE_BY_COMPLEXITY[preferences.complexity] },
    { label: `魔法投入：${PREFERENCE_LABELS.magicCommitment[preferences.magicCommitment]}`, table: SCORE_BY_MAGIC_COMMITMENT[preferences.magicCommitment] },
    { label: `生存方式：${PREFERENCE_LABELS.defense[preferences.defense]}`, table: SCORE_BY_DEFENSE[preferences.defense] },
    { label: `非战斗专长：${PREFERENCE_LABELS.utility[preferences.utility]}`, table: SCORE_BY_UTILITY[preferences.utility] },
  ]
  return rows.map(({ label, table }) => ({
    label,
    score: table[charClass] ?? 0,
    maximum: Math.max(0, ...Object.values(table).filter((value): value is number => typeof value === 'number')),
  }))
}

export function rankDnd5eClasses(preferences: Dnd5eBeginnerPreferences): Dnd5eClassRecommendationCandidate[] {
  return CLASS_ORDER.map((charClass) => {
    const contributions = classPreferenceContributions(preferences, charClass)
    const score = contributions.reduce((total, contribution) => total + contribution.score, 0)
    const maximum = contributions.reduce((total, contribution) => total + contribution.maximum, 0)
    const strongest = contributions
      .filter((contribution) => contribution.score > 0)
      .sort((left, right) => right.score - left.score || right.score / Math.max(1, right.maximum) - left.score / Math.max(1, left.maximum))
    return {
      charClass,
      score,
      matchPercent: Math.round(score / Math.max(1, maximum) * 100),
      matchedPreferences: strongest.slice(0, 4).map((contribution) => contribution.label),
      reasons: strongest.slice(0, 3).map((contribution) => `${charClass}很契合你的“${contribution.label}”选择。`),
    }
  }).sort((left, right) =>
    right.score - left.score || CLASS_ORDER.indexOf(left.charClass as typeof CLASS_ORDER[number]) - CLASS_ORDER.indexOf(right.charClass as typeof CLASS_ORDER[number]),
  )
}

export function dnd5eClassAbilityFit(charClass: string, abilities: Abilities): Dnd5eClassAbilityFit {
  const physicalPrimary: AbilityKey = abilities.dex > abilities.str ? 'dex' : 'str'
  const profiles: Readonly<Record<string, { primary: AbilityKey[]; secondary: AbilityKey[] }>> = {
    野蛮人: { primary: ['str'], secondary: ['con', 'dex'] },
    吟游诗人: { primary: ['cha'], secondary: ['dex', 'con'] },
    牧师: { primary: ['wis'], secondary: ['con'] },
    德鲁伊: { primary: ['wis'], secondary: ['con', 'dex'] },
    战士: { primary: [physicalPrimary], secondary: ['con'] },
    武僧: { primary: ['dex', 'wis'], secondary: ['con'] },
    圣武士: { primary: ['str', 'cha'], secondary: ['con'] },
    游侠: { primary: ['dex', 'wis'], secondary: ['con'] },
    游荡者: { primary: ['dex'], secondary: ['con', 'cha'] },
    术士: { primary: ['cha'], secondary: ['con', 'dex'] },
    邪术师: { primary: ['cha'], secondary: ['con', 'dex'] },
    法师: { primary: ['int'], secondary: ['con', 'dex'] },
  }
  const profile = profiles[charClass] ?? { primary: [dnd5eClassAbilityPriority(charClass)[0] ?? 'str'], secondary: [] }
  const lowestPrimary = Math.min(...profile.primary.map((ability) => abilities[ability]))
  const rating = lowestPrimary >= 15 ? 'excellent' : lowestPrimary >= 13 ? 'good' : 'weak'
  const primaryText = profile.primary.map((ability) => `${ABILITY_LABELS[ability]} ${abilities[ability]}`).join('、')
  const ratingText = rating === 'excellent' ? '主属性突出，适合直接开局' : rating === 'good' ? '主属性可用，后续属性提升可继续强化' : '主属性偏低，建议重新分配较高数值'
  return {
    charClass,
    primaryAbilities: profile.primary,
    secondaryAbilities: profile.secondary,
    rating,
    summary: `${charClass}的主属性为${profile.primary.map((ability) => ABILITY_LABELS[ability]).join('与')}；当前${primaryText}，${ratingText}。`,
  }
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function recommendedDnd5eRacialBonusChoices(
  race: string,
  charClass: string,
  baseAbilities: Abilities,
): AbilityKey[] {
  const flexible = dnd5eFlexibleRacialAbilityBonus(race)
  if (!flexible) return []
  const excluded = new Set(flexible.exclude ?? [])
  const fit = dnd5eClassAbilityFit(charClass, baseAbilities)
  const priority = [...fit.primaryAbilities, ...fit.secondaryAbilities, ...dnd5eClassAbilityPriority(charClass)]
  return [...new Set(priority)]
    .filter((ability) => !excluded.has(ability))
    .sort((left, right) => {
      const leftGain = abilityModifier(baseAbilities[left] + flexible.amount) - abilityModifier(baseAbilities[left])
      const rightGain = abilityModifier(baseAbilities[right] + flexible.amount) - abilityModifier(baseAbilities[right])
      return rightGain - leftGain || priority.indexOf(left) - priority.indexOf(right)
    })
    .slice(0, flexible.count)
}

export function recommendDnd5eRaces(
  charClass: string,
  baseAbilities: Abilities,
  races: readonly string[] = CORE_RACES,
  heritage?: Dnd5eHeritagePreference,
): Dnd5eRaceRecommendationCandidate[] {
  const fit = dnd5eClassAbilityFit(charClass, baseAbilities)
  const heritageRaces = heritage ? HERITAGE_RACES[heritage] : []
  return [...new Set(races)].map((race) => {
    const racialBonusChoices = recommendedDnd5eRacialBonusChoices(race, charClass, baseAbilities)
    const bonuses = dnd5eRacialAbilityBonuses(race, racialBonusChoices)
    const finalAbilities = applyDnd5eRacialAbilityBonuses(baseAbilities, bonuses)
    let score = 0
    const reasons: string[] = []
    for (const ability of fit.primaryAbilities) {
      const bonus = bonuses[ability]
      const modifierGain = abilityModifier(finalAbilities[ability]) - abilityModifier(baseAbilities[ability])
      score += bonus * 10 + modifierGain * 8
      if (bonus !== 0) reasons.push(`${ABILITY_LABELS[ability]} ${baseAbilities[ability]}→${finalAbilities[ability]}，直接强化${charClass}主属性。`)
    }
    for (const ability of fit.secondaryAbilities) {
      const bonus = bonuses[ability]
      const modifierGain = abilityModifier(finalAbilities[ability]) - abilityModifier(baseAbilities[ability])
      score += bonus * 4 + modifierGain * 3
      if (bonus !== 0 && reasons.length < 3) reasons.push(`${ABILITY_LABELS[ability]} ${baseAbilities[ability]}→${finalAbilities[ability]}，补强职业常用副属性。`)
    }
    if (race === '人类') score += 3
    const heritageIndex = heritageRaces.indexOf(race)
    if (heritageIndex >= 0) {
      score += (heritageRaces.length - heritageIndex) * 8
      reasons.push(`符合你选择的“${heritage ? HERITAGE_LABELS[heritage] : ''}”种族气质。`)
    }
    if (reasons.length === 0) reasons.push(`不会直接提高${fit.primaryAbilities.map((ability) => ABILITY_LABELS[ability]).join('与')}，但仍可按角色概念自由选择。`)
    return { race, score, racialBonusChoices, finalAbilities, reasons }
  }).sort((left, right) => right.score - left.score || races.indexOf(left.race) - races.indexOf(right.race))
}

export function recommendDnd5eCharacter(preferences: Dnd5eBeginnerPreferences): Dnd5eCharacterRecommendation {
  const classCandidates = rankDnd5eClasses(preferences)
  const charClass = classCandidates[0].charClass
  const baseAbilities = recommendedDnd5eBaseAbilities(charClass)
  const raceCandidates = recommendDnd5eRaces(charClass, baseAbilities, CORE_RACES, preferences.heritage)
  const race = raceCandidates[0].race
  const alignment = `${preferences.order === 'lawful' ? '守序' : preferences.order === 'chaotic' ? '混乱' : '中立'}${
    preferences.morality === 'good' ? '善良' : preferences.morality === 'evil' ? '邪恶' : preferences.order === 'neutral' ? '' : '中立'
  }` || '绝对中立'
  const normalizedAlignment = alignment === '中立' ? '绝对中立' : alignment
  const background = preferences.power === 'divine' || ['牧师', '圣武士'].includes(charClass)
    ? '侍僧'
    : '自定义背景'
  return {
    charClass,
    race,
    alignment: normalizedAlignment,
    background,
    classCandidates,
    raceCandidates,
    reasons: [
      ...classCandidates[0].reasons,
      `${race}在你的种族气质偏好、${charClass}主属性和推荐加点之间综合匹配最高。`,
      ...raceCandidates[0].reasons.slice(0, 2),
      background === '侍僧' ? '侍僧是 SRD 5.1 提供的完整示例背景。' : '可用 SRD 5.1 自定义背景规则塑造经历。',
    ],
  }
}

export function dnd5ePointBuyCost(score: number): number {
  return dnd5ePointBuyCostForRule(score, DND5E_CORE_POINT_BUY_RULE)
}

export function dnd5ePointBuyCostForRule(score: number, rule: Dnd5ePointBuyRule): number {
  return rule.costs[score] ?? Number.POSITIVE_INFINITY
}

export function dnd5ePointBuySpent(abilities: Abilities): number {
  return ABILITY_KEYS.reduce((total, ability) => total + dnd5ePointBuyCost(abilities[ability]), 0)
}

export function dnd5ePointBuyRemaining(abilities: Abilities): number {
  return dnd5ePointBuyRemainingForRule(abilities, DND5E_CORE_POINT_BUY_RULE)
}

export function dnd5ePointBuySpentForRule(abilities: Abilities, rule: Dnd5ePointBuyRule): number {
  return ABILITY_KEYS.reduce((total, ability) => total + dnd5ePointBuyCostForRule(abilities[ability], rule), 0)
}

export function dnd5ePointBuyRemainingForRule(abilities: Abilities, rule: Dnd5ePointBuyRule): number {
  return rule.budget - dnd5ePointBuySpentForRule(abilities, rule)
}

export function rollDnd5eAbilityScore(
  rule: { diceCount: number; dieSides: number; dropLowest: number },
  random: () => number = Math.random,
): Dnd5eAbilityRoll {
  const dice = Array.from(
    { length: rule.diceCount },
    () => Math.min(rule.dieSides, Math.max(1, Math.floor(random() * rule.dieSides) + 1)),
  )
  const discardedIndices = dice
    .map((die, index) => ({ die, index }))
    .sort((left, right) => left.die - right.die || left.index - right.index)
    .slice(0, rule.dropLowest)
    .map(({ index }) => index)
    .sort((left, right) => left - right)
  const discarded = new Set(discardedIndices)
  return {
    dice,
    discardedIndices,
    total: dice.reduce((total, die, index) => total + (discarded.has(index) ? 0 : die), 0),
  }
}

export function rollDnd5eFourD6DropLowest(random: () => number = Math.random): Dnd5eFourD6Roll {
  const rolled = rollDnd5eAbilityScore({ diceCount: 4, dieSides: 6, dropLowest: 1 }, random)
  const dice = rolled.dice as [number, number, number, number]
  const discardedIndex = rolled.discardedIndices[0]
  return {
    dice,
    discardedIndex,
    total: rolled.total,
  }
}
