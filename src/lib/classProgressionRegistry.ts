import type { Character } from '../types/character'
import {
  registeredClassDefinitions,
  type ClassProgressionAdapter,
} from './classDefinitionRegistry'
import { syncClassTraitUses, syncQiForCharacter } from './traitRegistry'

export type { ClassProgressionAdapter } from './classDefinitionRegistry'

const progressionAdapters = new Map<string, ClassProgressionAdapter>()

export function registerClassProgression(adapter: ClassProgressionAdapter): () => void {
  progressionAdapters.set(adapter.id, adapter)
  return () => {
    if (progressionAdapters.get(adapter.id) === adapter) progressionAdapters.delete(adapter.id)
  }
}

export function registeredClassProgressions(): readonly ClassProgressionAdapter[] {
  const combined = new Map(
    registeredClassDefinitions().map((definition) => [definition.progression.id, definition.progression]),
  )
  for (const [id, adapter] of progressionAdapters) combined.set(id, adapter)
  return [...combined.values()]
}

export function classProgressionForCharacter(character: Character): ClassProgressionAdapter | undefined {
  return registeredClassProgressions().find((adapter) => adapter.matches(character))
}

export function hasClassSkillTree(character: Character): boolean {
  return !!classProgressionForCharacter(character)?.hasSkillTree
}

export function syncCharacterClassTraits(character: Character): Character {
  return syncQiForCharacter(syncClassTraitUses(character))
}

export function syncCharacterClassSkills(character: Character): Character {
  return registeredClassProgressions().reduce((current, adapter) => adapter.syncSkills(current), character)
}

export function syncCharacterClassProgression(character: Character): Character {
  return syncCharacterClassSkills(syncCharacterClassTraits(character))
}

function skillAdapter(character: Character, skillId: string): ClassProgressionAdapter | undefined {
  return registeredClassProgressions().find(
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
