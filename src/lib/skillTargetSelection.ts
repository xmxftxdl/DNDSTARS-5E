import type { Token } from '../store/maps'
import type { CombatSkill } from '../types/character'

export type SkillTargetSequence = 'single' | 'repeat-primary' | 'choose-each'

export interface SkillTargetSelectionProfile {
  sequence: SkillTargetSequence
  shotCount(skill: CombatSkill): number
}

const repeatedPrimary: SkillTargetSelectionProfile = {
  sequence: 'repeat-primary',
  shotCount: (skill) => Math.max(1, skill.arrowShots ?? 1),
}

const chooseEach: SkillTargetSelectionProfile = {
  sequence: 'choose-each',
  shotCount: (skill) => Math.max(1, skill.arrowShots ?? 1),
}

const selectionProfiles = new Map<string, SkillTargetSelectionProfile>(Object.entries({
  multiShot: repeatedPrimary,
  encircle: repeatedPrimary,
  rageShot: chooseEach,
}))

export function registerSkillTargetSelection(
  skillTreeId: string,
  profile: SkillTargetSelectionProfile,
): () => void {
  selectionProfiles.set(skillTreeId, profile)
  return () => {
    if (selectionProfiles.get(skillTreeId) === profile) selectionProfiles.delete(skillTreeId)
  }
}

export function getSkillTargetSelectionProfile(skill: CombatSkill): SkillTargetSelectionProfile {
  return (skill.skillTreeId && selectionProfiles.get(skill.skillTreeId)) || {
    sequence: 'single',
    shotCount: () => 1,
  }
}

export function usesArrowSequencePackets(skill: CombatSkill, hasExplicitTargets = false): boolean {
  const profile = getSkillTargetSelectionProfile(skill)
  return profile.sequence === 'repeat-primary' || (profile.sequence === 'choose-each' && hasExplicitTargets)
}

export function buildSkillTargetTokenIds(input: {
  skill: CombatSkill
  primaryTarget: Token
  candidates: Token[]
  chooseTarget?: (input: {
    shotIndex: number
    shotCount: number
    primaryTarget: Token
    candidates: Token[]
  }) => Token | undefined
}): string[] | undefined {
  const profile = getSkillTargetSelectionProfile(input.skill)
  const shotCount = profile.shotCount(input.skill)
  if (profile.sequence === 'single') return undefined
  if (profile.sequence === 'repeat-primary') {
    return Array.from({ length: shotCount }, () => input.primaryTarget.id)
  }
  const targets = [input.primaryTarget]
  for (let shotIndex = 1; shotIndex < shotCount; shotIndex += 1) {
    targets.push(
      input.chooseTarget?.({
        shotIndex,
        shotCount,
        primaryTarget: input.primaryTarget,
        candidates: input.candidates,
      }) ?? input.primaryTarget,
    )
  }
  return targets.map((target) => target.id)
}
