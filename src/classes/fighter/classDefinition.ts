import { DEFAULT_COMBAT_STAT_PROFILE, type ClassDefinition, type ClassProgressionAdapter } from '../../lib/classDefinitionTypes'
import {
  DND5E_CHAIN_MAIL,
  DND5E_FIGHTER_STARTING_EQUIPMENT,
  DND5E_LONGSWORD,
  DND5E_SHIELD,
  FIGHTER_RESOURCE_KEYS,
  fighterActionSurgeUses,
  fighterIndomitableUses,
  fighterSuperiorityDiceMax,
} from '../../rulesets/dnd5e'

const progression: ClassProgressionAdapter = {
  id: 'dnd5e-fighter',
  matches: (character) => character.charClass === '战士',
  ownsSkill: () => false,
  syncSkills: (character) => character,
  canLearnSkill: () => false,
  canUpgradeSkillRank: () => false,
  getSkillRank: () => 0,
}

export const FIGHTER_CLASS_DEFINITION: ClassDefinition = {
  id: 'dnd5e-fighter',
  classNames: ['战士'],
  matchesClassName: (className) => className === '战士',
  progression,
  combatStats: DEFAULT_COMBAT_STAT_PROFILE,
  defaultEquipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
  knownEquipment: [DND5E_LONGSWORD, DND5E_SHIELD, DND5E_CHAIN_MAIL],
  resources: [
    {
      key: FIGHTER_RESOURCE_KEYS.secondWind,
      label: '回气',
      shortLabel: '回气',
      isAvailable: () => true,
      max: () => 1,
      resetOn: 'short-rest',
    },
    {
      key: FIGHTER_RESOURCE_KEYS.actionSurge,
      label: '动作如潮',
      shortLabel: '动作如潮',
      isAvailable: (character) => character.level >= 2,
      max: (character) => fighterActionSurgeUses(character.level),
      resetOn: 'short-rest',
    },
    {
      key: FIGHTER_RESOURCE_KEYS.indomitable,
      label: '不屈',
      shortLabel: '不屈',
      isAvailable: (character) => character.level >= 9,
      max: (character) => fighterIndomitableUses(character.level),
      resetOn: 'long-rest',
    },
    {
      key: FIGHTER_RESOURCE_KEYS.superiorityDice,
      label: '优势骰',
      shortLabel: '优势骰',
      isAvailable: (character) => character.level >= 3 && character.dnd5eClassChoices?.fighter?.subclass === 'battle-master',
      max: (character) => fighterSuperiorityDiceMax(character.level),
      resetOn: 'short-rest',
    },
  ],
  combatActions: [{ type: 'dnd5e-fighter-feature' }],
}
