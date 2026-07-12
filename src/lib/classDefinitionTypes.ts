import type { Character } from '../types/character'
import type { CharacterEquipment, EquipmentItem } from '../types/equipment'
import type { AbilityKey } from './dnd'

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

export interface ClassCombatStatProfile {
  physicalAttack: { ability: AbilityKey; multiplier: number }
  defense: { ability: AbilityKey; multiplier: number }
  magicAttack: { ability: AbilityKey; multiplier: number }
  magicDefense: { ability: AbilityKey; multiplier: number }
  maxHp: { base: number; ability: AbilityKey; useModifier: boolean; multiplierPerLevel: number }
  critDamage: { basePercent: number; ability: AbilityKey; percentPerPoint: number }
}

export interface ClassSkillTreeNodeView {
  id: string
  name: string
  emoji: string
  sectionId: string
  column: number
  row: number
  unlockLevel: number
  cooldown: number
  apCost: number
  maxRank: number
  prerequisite?: { skillId: string; label?: string; withinSection: boolean }
  classRequirement?: string
  description: string
  tierDescriptions: string[]
  state: {
    learned: boolean
    rank: number
    levelOk: boolean
    prerequisiteOk: boolean
    classOk: boolean
    canLearn: boolean
    canUpgrade: boolean
  }
}

export interface ClassSkillTreeView {
  sections: Array<{ id: string; label: string }>
  nodes: ClassSkillTreeNodeView[]
  availablePoints: number
  earnedPoints: number
  pointRuleLabel: string
  headerNote?: string
}

export interface ClassSkillTreeDefinition {
  buildView(character: Character): ClassSkillTreeView
}

export type ClassResourceReset = 'combat' | 'short-rest' | 'long-rest'

export interface ClassResourceDefinition {
  key: string
  label: string
  shortLabel?: string
  isAvailable(character: Character): boolean
  max(character: Character): number
  resetOn: ClassResourceReset
}

export interface ClassCombatActionDefinition {
  type: string
}

export interface ClassDefinition {
  id: string
  classNames: readonly string[]
  matchesClassName(className: string): boolean
  progression: ClassProgressionAdapter
  combatStats: ClassCombatStatProfile
  defaultEquipment?: CharacterEquipment
  knownEquipment?: EquipmentItem[]
  skillTree?: ClassSkillTreeDefinition
  resources?: readonly ClassResourceDefinition[]
  combatActions?: readonly ClassCombatActionDefinition[]
}

export const DEFAULT_COMBAT_STAT_PROFILE: ClassCombatStatProfile = {
  physicalAttack: { ability: 'dex', multiplier: 2 },
  defense: { ability: 'con', multiplier: 1.5 },
  magicAttack: { ability: 'int', multiplier: 2 },
  magicDefense: { ability: 'wis', multiplier: 1.5 },
  maxHp: { base: 6, ability: 'con', useModifier: true, multiplierPerLevel: 1 },
  critDamage: { basePercent: 125, ability: 'dex', percentPerPoint: 1.5 },
}
