import { DEFAULT_COMBAT_STAT_PROFILE, type ClassDefinition } from '../../lib/classDefinitionTypes'

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
