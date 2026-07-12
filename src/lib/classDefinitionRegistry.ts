import type { Character } from '../types/character'
import type { CharacterEquipment, EquipmentItem } from '../types/equipment'
import type { AbilityKey } from './dnd'
import {
  ARCHER_SPEC_LEVEL,
  ARCHER_TREE_MAX_UNLOCK,
  MAX_SKILL_RANK,
  buildSkillDescription,
  buildSkillTierDescription,
  canLearnSkill,
  canUpgradeSkillRank,
  getArcherSkillDef,
  getAvailableSkillPoints,
  getPrerequisiteLabel,
  getSkillClassRequirement,
  getSkillRank,
  isBaseArcherClass,
  isIntraPanelPrerequisite,
  isSkillClassAllowed,
  isSkillLearned,
  isArcherLineClass,
  meetsSkillPrerequisite,
  skillTreeDisplaySectionLabel,
  visibleSkillTreeDisplaySections,
  visibleSkillsByDisplaySection,
} from './archerSkillTree'
import { CRIT_RING, DEFAULT_ARCHER_EQUIPMENT, EQUIPMENT_CATALOG, LEATHER_ARMOR, LEATHER_CAP, LONG_BOW } from './equipmentDefaults'
import { syncArcherCombatSkills } from './skillTreeSync'
import { maxQiForLevel } from './classResourceRules'

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

const archerProgression: ClassProgressionAdapter = {
  id: 'archer-line',
  hasSkillTree: true,
  matches: (character) => isArcherLineClass(character.charClass),
  ownsSkill: (skillId) => !!getArcherSkillDef(skillId),
  syncSkills: syncArcherCombatSkills,
  canLearnSkill,
  canUpgradeSkillRank,
  getSkillRank,
}

const archerSkillTree: ClassSkillTreeDefinition = {
  buildView(character) {
    const bySection = visibleSkillsByDisplaySection(character)
    const sectionIds = visibleSkillTreeDisplaySections(character)
    const nodes = sectionIds.flatMap((sectionId) =>
      bySection[sectionId].map((definition): ClassSkillTreeNodeView => {
        const learned = isSkillLearned(character, definition.id)
        const rank = getSkillRank(character, definition.id)
        const tier = definition.tiers[Math.max(0, rank - 1)] ?? definition.tiers[0]
        const prerequisiteLabel = getPrerequisiteLabel(definition)
        return {
          id: definition.id,
          name: definition.name,
          emoji: definition.emoji,
          sectionId,
          column: definition.treeColumn,
          row: definition.treeRow,
          unlockLevel: definition.unlockLevel,
          cooldown: definition.cooldown,
          apCost: tier.apCost ?? definition.apCost,
          maxRank: MAX_SKILL_RANK,
          prerequisite: definition.prerequisite
            ? {
                skillId: definition.prerequisite.skillId,
                label: prerequisiteLabel ?? undefined,
                withinSection: isIntraPanelPrerequisite(definition),
              }
            : undefined,
          classRequirement: getSkillClassRequirement(definition) ?? undefined,
          description: buildSkillDescription(definition, Math.max(1, rank)),
          tierDescriptions: definition.tiers.map((_, index) => buildSkillTierDescription(definition, index + 1)),
          state: {
            learned,
            rank,
            levelOk: character.level >= definition.unlockLevel,
            prerequisiteOk: meetsSkillPrerequisite(character, definition),
            classOk: isSkillClassAllowed(character, definition),
            canLearn: canLearnSkill(character, definition.id),
            canUpgrade: canUpgradeSkillRank(character, definition.id),
          },
        }
      }),
    )
    return {
      sections: sectionIds.map((id) => ({ id, label: skillTreeDisplaySectionLabel(id) })),
      nodes,
      availablePoints: getAvailableSkillPoints(character),
      earnedPoints: Math.floor(character.level / 5) * 2,
      pointRuleLabel: '每 5 级 +2',
      headerNote: isBaseArcherClass(character.charClass)
        ? `弓手技能至 ${ARCHER_TREE_MAX_UNLOCK} 级 · ${ARCHER_SPEC_LEVEL} 级后可进阶逐风者/影舞者`
        : undefined,
    }
  },
}

export const ARCHER_CLASS_DEFINITION: ClassDefinition = {
  id: 'archer-line',
  classNames: ['弓手', '逐风者', '影舞者'],
  matchesClassName: isArcherLineClass,
  progression: archerProgression,
  combatStats: DEFAULT_COMBAT_STAT_PROFILE,
  defaultEquipment: DEFAULT_ARCHER_EQUIPMENT,
  knownEquipment: [LONG_BOW, LEATHER_ARMOR, LEATHER_CAP, CRIT_RING],
  skillTree: archerSkillTree,
  resources: [
    {
      key: 'qi',
      label: '气',
      isAvailable: (character) => character.charClass === '影舞者',
      max: (character) => maxQiForLevel(character.level),
      resetOn: 'long-rest',
    },
  ],
}

export const HEAVY_GUNNER_CLASS_DEFINITION: ClassDefinition = {
  id: 'heavy-gunner',
  classNames: ['重炮手'],
  matchesClassName: (className) => className === '重炮手',
  progression: {
    id: 'heavy-gunner',
    matches: (character) => character.charClass === '重炮手',
    ownsSkill: () => false,
    syncSkills: (character) => character,
    canLearnSkill: () => false,
    canUpgradeSkillRank: () => false,
    getSkillRank: () => 0,
  },
  combatStats: DEFAULT_COMBAT_STAT_PROFILE,
  combatActions: [{ type: 'bullet-match-swap' }],
}

const definitions = new Map<string, ClassDefinition>([
  [ARCHER_CLASS_DEFINITION.id, ARCHER_CLASS_DEFINITION],
  [HEAVY_GUNNER_CLASS_DEFINITION.id, HEAVY_GUNNER_CLASS_DEFINITION],
])

export function registerClassDefinition(definition: ClassDefinition): () => void {
  const previous = definitions.get(definition.id)
  definitions.set(definition.id, definition)
  return () => {
    if (definitions.get(definition.id) !== definition) return
    if (previous) definitions.set(definition.id, previous)
    else definitions.delete(definition.id)
  }
}

export function registeredClassDefinitions(): readonly ClassDefinition[] {
  return [...definitions.values()]
}

export function classDefinitionForClassName(className: string): ClassDefinition | undefined {
  return [...definitions.values()].find((definition) => definition.matchesClassName(className))
}

export function classDefinitionForCharacter(character: Character): ClassDefinition | undefined {
  return classDefinitionForClassName(character.charClass)
}

export function classCombatActionAvailable(character: Character, actionType: string): boolean {
  return classDefinitionForCharacter(character)?.combatActions?.some((action) => action.type === actionType) ?? false
}

export function equipmentCatalogForCharacter(character: Character): EquipmentItem[] {
  return classDefinitionForCharacter(character)?.knownEquipment ?? EQUIPMENT_CATALOG
}
