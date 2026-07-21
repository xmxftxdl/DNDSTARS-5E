export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export const ABILITIES: { key: AbilityKey; label: string; full: string }[] = [
  { key: 'str', label: '力量', full: 'Strength' },
  { key: 'dex', label: '敏捷', full: 'Dexterity' },
  { key: 'con', label: '体质', full: 'Constitution' },
  { key: 'int', label: '智力', full: 'Intelligence' },
  { key: 'wis', label: '感知', full: 'Wisdom' },
  { key: 'cha', label: '魅力', full: 'Charisma' },
]

export interface SkillDef {
  key: string
  label: string
  ability: AbilityKey
}

export const SKILLS: SkillDef[] = [
  { key: 'acrobatics', label: '杂技', ability: 'dex' },
  { key: 'animalHandling', label: '驯兽', ability: 'wis' },
  { key: 'arcana', label: '奥秘', ability: 'int' },
  { key: 'athletics', label: '运动', ability: 'str' },
  { key: 'deception', label: '欺瞒', ability: 'cha' },
  { key: 'history', label: '历史', ability: 'int' },
  { key: 'insight', label: '洞悉', ability: 'wis' },
  { key: 'intimidation', label: '威吓', ability: 'cha' },
  { key: 'investigation', label: '调查', ability: 'int' },
  { key: 'medicine', label: '医药', ability: 'wis' },
  { key: 'nature', label: '自然', ability: 'int' },
  { key: 'perception', label: '察觉', ability: 'wis' },
  { key: 'performance', label: '表演', ability: 'cha' },
  { key: 'persuasion', label: '游说', ability: 'cha' },
  { key: 'religion', label: '宗教', ability: 'int' },
  { key: 'sleightOfHand', label: '巧手', ability: 'dex' },
  { key: 'stealth', label: '隐匿', ability: 'dex' },
  { key: 'survival', label: '生存', ability: 'wis' },
]

export const MAX_ABILITY_SCORE = 30
export const ABILITY_BASELINE = 10

/** D&D 5e 2014 属性调整值：向下取整 (score - 10) / 2。 */
export function abilityMod(score: number): number {
  return Math.floor((clampAbilityScore(score) - ABILITY_BASELINE) / 2)
}

export function clampAbilityScore(score: number): number {
  return Math.max(1, Math.min(MAX_ABILITY_SCORE, score))
}

/** D&D 5e 2014 熟练加值：1/5/9/13/17 级时依次提升。 */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.min(20, Math.max(1, level)) - 1) / 4)
}

/** 把调整值格式化为带正负号的字符串，如 +3 / -1 */
export function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
