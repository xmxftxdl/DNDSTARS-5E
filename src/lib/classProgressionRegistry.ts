import type { Character } from '../types/character'
import {
  canLearnSkill as canLearnArcherSkill,
  canUpgradeSkillRank as canUpgradeArcherSkillRank,
  getArcherSkillDef,
  getSkillRank as getArcherSkillRank,
  isArcherLineClass,
} from './archerSkillTree'
import { syncArcherCombatSkills } from './skillTreeSync'
import { syncClassTraitUses, syncQiForCharacter } from './traitRegistry'

export interface ClassProgressionAdapter {
  id: string
  hasSkillTree?: boolean
  matches(character: Character): boolean
  ownsSkill(skillId: string): boolean
  syncSkills(character: Character): Character
  canLearnSkill(character: Character, skillId: string): boolean
  canUpgradeSkillRank(character: Character, skillId: string): boolean
  getSkillRank(character: Character, skillId: string): number
}

const archerProgressionAdapter: ClassProgressionAdapter = {
  id: 'archer-line',
  hasSkillTree: true,
  matches: (character) => isArcherLineClass(character.charClass),
  ownsSkill: (skillId) => !!getArcherSkillDef(skillId),
  syncSkills: syncArcherCombatSkills,
  canLearnSkill: canLearnArcherSkill,
  canUpgradeSkillRank: canUpgradeArcherSkillRank,
  getSkillRank: getArcherSkillRank,
}

const progressionAdapters = new Map<string, ClassProgressionAdapter>([
  [archerProgressionAdapter.id, archerProgressionAdapter],
])

export function registerClassProgression(adapter: ClassProgressionAdapter): () => void {
  progressionAdapters.set(adapter.id, adapter)
  return () => {
    if (progressionAdapters.get(adapter.id) === adapter) progressionAdapters.delete(adapter.id)
  }
}

export function registeredClassProgressions(): readonly ClassProgressionAdapter[] {
  return [...progressionAdapters.values()]
}

export function classProgressionForCharacter(character: Character): ClassProgressionAdapter | undefined {
  return [...progressionAdapters.values()].find((adapter) => adapter.matches(character))
}

export function hasClassSkillTree(character: Character): boolean {
  return !!classProgressionForCharacter(character)?.hasSkillTree
}

export function syncCharacterClassTraits(character: Character): Character {
  return syncQiForCharacter(syncClassTraitUses(character))
}

export function syncCharacterClassSkills(character: Character): Character {
  return [...progressionAdapters.values()].reduce((current, adapter) => adapter.syncSkills(current), character)
}

export function syncCharacterClassProgression(character: Character): Character {
  return syncCharacterClassSkills(syncCharacterClassTraits(character))
}

function skillAdapter(character: Character, skillId: string): ClassProgressionAdapter | undefined {
  return [...progressionAdapters.values()].find(
    (adapter) => adapter.matches(character) && adapter.ownsSkill(skillId),
  )
}

export function canLearnClassSkill(character: Character, skillId: string): boolean {
  return skillAdapter(character, skillId)?.canLearnSkill(character, skillId) ?? false
}

export function canUpgradeClassSkillRank(character: Character, skillId: string): boolean {
  return skillAdapter(character, skillId)?.canUpgradeSkillRank(character, skillId) ?? false
}

export function getClassSkillRank(character: Character, skillId: string): number {
  return skillAdapter(character, skillId)?.getSkillRank(character, skillId) ?? 0
}
