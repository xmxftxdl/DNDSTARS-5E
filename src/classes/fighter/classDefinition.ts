import type { ClassDefinition } from '../../lib/classDefinitionTypes'
import {
  DND5E_FIGHTER_STARTING_EQUIPMENT,
  dnd5eKnownEquipmentForClass,
} from '../../rulesets/dnd5e/equipment'
import {
  FIGHTER_RESOURCE_KEYS,
  fighterActionSurgeUses,
  fighterIndomitableUses,
  fighterSubclassResourceDefinitions,
} from '../../rulesets/dnd5e/fighter'

export const FIGHTER_CLASS_DEFINITION: ClassDefinition = {
  id: 'dnd5e-fighter',
  classNames: ['战士'],
  matchesClassName: (className) => className === '战士',
  defaultEquipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
  knownEquipment: dnd5eKnownEquipmentForClass({ charClass: '战士' }),
  resources: (character) => [
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
    ...fighterSubclassResourceDefinitions(character),
  ],
  combatActions: [{ type: 'dnd5e-fighter-feature' }],
}
