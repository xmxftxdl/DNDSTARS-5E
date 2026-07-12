import type { CombatSkill } from '../types/character'

const skillRanges = new Map<string, number>([
  ['burstKick', 5],
  ['riseKick', 5],
  ['windKickCombo', 5],
  ['shadowDance', 15],
  ['multiShot', 30],
  ['clusterShot', 20],
  ['vineHookShot', 20],
  ['bindShot', 20],
  ['basicShot', 90],
  ['netArrow', 60],
  ['explosiveArrow', 60],
  ['magicArrow', 60],
  ['rageShot', 60],
  ['refluxMagicArrow', 60],
  ['windStepShot', 60],
  ['arcaneBreak', 90],
  ['antiMagicArrow', 90],
])

export function registerSkillRange(skillTreeId: string, rangeFeet: number): () => void {
  const previous = skillRanges.get(skillTreeId)
  skillRanges.set(skillTreeId, rangeFeet)
  return () => {
    if (skillRanges.get(skillTreeId) !== rangeFeet) return
    if (previous == null) skillRanges.delete(skillTreeId)
    else skillRanges.set(skillTreeId, previous)
  }
}

export function singleTargetRangeFeet(skill: CombatSkill): number | null {
  if (skill.skillTreeId && skillRanges.has(skill.skillTreeId)) {
    return skillRanges.get(skill.skillTreeId)!
  }
  const isBasicShot = skill.skillTreeId === 'basicShot' || skill.name === '基础射击'
  if (!skill.tags?.includes('ranged') && !isBasicShot) return null
  return 90
}
