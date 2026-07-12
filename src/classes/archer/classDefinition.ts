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
  isArcherLineClass,
  isBaseArcherClass,
  isIntraPanelPrerequisite,
  isSkillClassAllowed,
  isSkillLearned,
  meetsSkillPrerequisite,
  skillTreeDisplaySectionLabel,
  visibleSkillTreeDisplaySections,
  visibleSkillsByDisplaySection,
} from './skillTree'
import { CRIT_RING, DEFAULT_ARCHER_EQUIPMENT, LEATHER_ARMOR, LEATHER_CAP, LONG_BOW } from '../../lib/equipmentDefaults'
import { maxQiForLevel } from './resourceRules'
import { syncArcherCombatSkills } from './skillTreeSync'
import {
  DEFAULT_COMBAT_STAT_PROFILE,
  type ClassDefinition,
  type ClassProgressionAdapter,
  type ClassSkillTreeDefinition,
  type ClassSkillTreeNodeView,
} from '../../lib/classDefinitionTypes'

const progression: ClassProgressionAdapter = {
  id: 'archer-line',
  hasSkillTree: true,
  matches: (character) => isArcherLineClass(character.charClass),
  ownsSkill: (skillId) => !!getArcherSkillDef(skillId),
  syncSkills: syncArcherCombatSkills,
  canLearnSkill,
  canUpgradeSkillRank,
  getSkillRank,
}

const skillTree: ClassSkillTreeDefinition = {
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
  progression,
  combatStats: DEFAULT_COMBAT_STAT_PROFILE,
  defaultEquipment: DEFAULT_ARCHER_EQUIPMENT,
  knownEquipment: [LONG_BOW, LEATHER_ARMOR, LEATHER_CAP, CRIT_RING],
  skillTree,
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
