import type { AbilityKey } from '../../lib/dnd'

export interface Dnd5eAbilityCheckRule {
  mode: 'advantage' | 'disadvantage'
  ability?: AbilityKey
  skill?: string
  sense?: 'hearing' | 'sight' | 'smell'
  excludedSkills?: readonly string[]
}

const abilities: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const validSkill = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(value)

export function validDnd5eAbilityCheckRule(value: unknown): value is Dnd5eAbilityCheckRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rule = value as Dnd5eAbilityCheckRule
  return (rule.mode === 'advantage' || rule.mode === 'disadvantage') &&
    (rule.ability === undefined || abilities.includes(rule.ability)) &&
    (rule.skill === undefined || validSkill(rule.skill)) &&
    (rule.sense === undefined || rule.sense === 'hearing' || rule.sense === 'sight' || rule.sense === 'smell') &&
    (rule.excludedSkills === undefined || (Array.isArray(rule.excludedSkills) &&
      rule.excludedSkills.every(validSkill) &&
      (rule.skill === undefined || !rule.excludedSkills.includes(rule.skill))))
}

export function normalizeDnd5eAbilityCheckRules(value: unknown): Dnd5eAbilityCheckRule[] | undefined {
  if (!Array.isArray(value) || !value.every(validDnd5eAbilityCheckRule)) return undefined
  return value.map(rule => ({ ...rule, excludedSkills: rule.excludedSkills ? [...new Set(rule.excludedSkills)] : undefined }))
}

export function dnd5eAbilityCheckRuleAbilities(
  rules: readonly Dnd5eAbilityCheckRule[] | undefined,
  mode: Dnd5eAbilityCheckRule['mode'],
  skill?: string,
  sense?: Dnd5eAbilityCheckRule['sense'],
): AbilityKey[] {
  return (rules ?? []).filter(rule => rule.mode === mode &&
    (rule.sense === undefined || rule.sense === sense) &&
    (rule.skill === undefined || rule.skill === skill) &&
    (skill === undefined || !rule.excludedSkills?.includes(skill)))
    .flatMap(rule => rule.ability ? [rule.ability] : abilities)
}
