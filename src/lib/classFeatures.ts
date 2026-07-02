import type { Character, CombatSkill, Trait } from '../types/character'
import {
  MAX_FEATURE_LEVEL,
  FEATURE_RANK_THRESHOLDS,
  pendingTraitChoices,
  stripArcherLineTraits,
  syncClassTraitUses,
  isArcherLineFeatureKey,
  type ClassFeatureKey,
} from './traitRegistry'

export type { ClassFeatureKey } from './traitRegistry'
export {
  applyTraitFeatureRank,
  createClassTrait,
  formatFeatureDescription,
  getClassFeatureDef,
  MAX_FEATURE_LEVEL,
  FEATURE_RANK_THRESHOLDS,
  usageLabel,
  pendingTraitChoices,
  resetCombatTraitUses,
  maxQiForLevel,
  syncQiForCharacter,
  TRAIT_CHOICE_GROUPS,
  isBaseArcher,
  isWindrunner,
  isArcherLineFeatureKey,
  migrateCharacterTraits,
} from './traitRegistry'

export function eagleEyeDexBonus(featureRank: number): number {
  return 10 + (featureRank - 1) * 5
}

export function featureUpgradePointsEarned(charLevel: number): number {
  return FEATURE_RANK_THRESHOLDS.filter((t) => charLevel >= t).length
}

export function featureUpgradePointsSpent(c: Character): number {
  return c.traits
    .filter((t) => t.featureKey)
    .reduce((sum, t) => sum + Math.max(0, t.level - 1), 0)
}

/** 根据等级与已消耗升级点计算当前可用特性升级点 */
export function availableFeatureUpgradePoints(c: Character, level = c.level): number {
  return Math.max(0, featureUpgradePointsEarned(level) - featureUpgradePointsSpent(c))
}

export function grantFeaturePointsOnLevelUp(
  oldLevel: number,
  newLevel: number,
  currentPoints: number,
): number {
  if (newLevel <= oldLevel) return currentPoints
  let points = currentPoints
  for (const t of FEATURE_RANK_THRESHOLDS) {
    if (oldLevel < t && newLevel >= t) points++
  }
  return points
}

export function nextFeatureUpgradeCharacterLevel(charLevel: number): number | null {
  for (const t of FEATURE_RANK_THRESHOLDS) {
    if (charLevel < t) return t
  }
  return null
}

export function featureRankFromCharacterLevel(charLevel: number): number {
  void charLevel
  return 1
}

export function nextFeatureRankCharacterLevel(charLevel: number): number | null {
  return nextFeatureUpgradeCharacterLevel(charLevel)
}

export function canUpgradeClassTrait(c: Character, trait: Trait): boolean {
  if (!trait.featureKey) return false
  if ((c.featureUpgradePoints ?? 0) <= 0) return false
  return trait.level < MAX_FEATURE_LEVEL
}

export function isBasicShot(skill: CombatSkill): boolean {
  return skill.skillTreeId === 'basicShot' || skill.name === '基础射击'
}

export function isRangedNormalShot(skill: CombatSkill): boolean {
  return isBasicShot(skill)
}

export function isSingleArrowSkill(skill: CombatSkill): boolean {
  if (skill.arrowShots === 1) return true
  if (skill.name === '远程射击' || skill.name === '基础射击') return true
  return skill.damageCount === 1 && (skill.tags?.includes('ranged') ?? false)
}

export function findClassTrait(c: Character, key: ClassFeatureKey): Trait | undefined {
  return c.traits.find((t) => t.featureKey === key)
}

export function isArcherClass(charClass: string): boolean {
  return charClass.includes('弓手') || charClass === '逐风者' || charClass === '影舞者'
}

export function needsArcherLv1Choice(c: Character): boolean {
  return pendingTraitChoices(c).some((g) => g.id === 'archer-lv1')
}

export function needsArcherLv3Choice(c: Character): boolean {
  return pendingTraitChoices(c).some((g) => g.id === 'archer-lv3')
}

export function hasArcherLv3Trait(c: Character): boolean {
  return c.traits.some((t) => t.featureKey === 'eagleEye' || t.featureKey === 'stableMind')
}

export function canArmDoubleArrow(c: Character | undefined): boolean {
  if (!c) return false
  const trait = findClassTrait(c, 'doubleArrow')
  return !!trait && trait.maxUses > 0 && trait.uses > 0
}

export function canUseDoubleArrow(c: Character | undefined, skill: CombatSkill): boolean {
  if (!c || !canArmDoubleArrow(c)) return false
  if (skill.damageCount <= 0) return false
  return isBasicShot(skill) && (skill.arrowShots ?? 1) === 1
}

export function canUseArmorPiercing(
  c: Character | undefined,
  skill: CombatSkill,
  isCrit: boolean,
): boolean {
  if (!c || !isCrit) return false
  const trait = findClassTrait(c, 'armorPiercingArrow')
  if (!trait) return false
  if (trait.maxUses > 0 && trait.uses <= 0) return false
  return isBasicShot(skill)
}

export function isArcherFeatureKey(key: ClassFeatureKey | undefined): boolean {
  return isArcherLineFeatureKey(key)
}

export function stripArcherClassTraits(traits: Trait[]): Trait[] {
  return stripArcherLineTraits(traits)
}

export function syncArcherTraits(c: Character): Character {
  return syncClassTraitUses(c)
}

export { pixelToCell } from './gridCombat'
