import type { Dnd5ePluginRacialSavingThrowAdvantages, Dnd5ePluginStaticCombatModifiers } from './pluginApi'

export interface Dnd5eCoreRaceMechanics {
  id: 'dwarf' | 'elf' | 'halfling' | 'human' | 'dragonborn' | 'gnome' | 'half-elf' | 'half-orc' | 'tiefling'
  size: 'small' | 'medium'
  speedFeet: number
  skillProficiencies?: readonly string[]
  skillProficiencyChoiceCount?: number
  weaponProficiencies?: readonly string[]
  savingThrowAdvantages?: Dnd5ePluginRacialSavingThrowAdvantages
  staticModifiers?: Dnd5ePluginStaticCombatModifiers
}

const CORE_RACE_MECHANICS: Readonly<Record<Dnd5eCoreRaceMechanics['id'], Dnd5eCoreRaceMechanics>> = {
  dwarf: {
    id: 'dwarf',
    size: 'medium',
    speedFeet: 25,
    weaponProficiencies: [
      'dnd5e-battleaxe',
      'dnd5e-handaxe',
      'dnd5e-light-hammer',
      'dnd5e-warhammer',
    ],
    savingThrowAdvantages: {
      conditions: ['poisoned', '中毒'],
      damageTypes: ['poison'],
    },
    staticModifiers: {
      darkvisionRangeFeet: 60,
      damageResistances: ['poison'],
    },
  },
  elf: {
    id: 'elf',
    size: 'medium',
    speedFeet: 30,
    skillProficiencies: ['perception'],
    savingThrowAdvantages: {
      conditions: ['charmed', '魅惑'],
    },
    staticModifiers: {
      darkvisionRangeFeet: 60,
      conditionImmunities: ['magical-sleep', '魔法睡眠'],
    },
  },
  halfling: {
    id: 'halfling',
    size: 'small',
    speedFeet: 25,
    savingThrowAdvantages: {
      conditions: ['frightened', '惊惧'],
    },
  },
  human: {
    id: 'human',
    size: 'medium',
    speedFeet: 30,
  },
  dragonborn: {
    id: 'dragonborn',
    size: 'medium',
    speedFeet: 30,
  },
  gnome: {
    id: 'gnome',
    size: 'small',
    speedFeet: 25,
    savingThrowAdvantages: {
      magicAbilities: ['int', 'wis', 'cha'],
    },
    staticModifiers: {
      darkvisionRangeFeet: 60,
    },
  },
  'half-elf': {
    id: 'half-elf',
    size: 'medium',
    speedFeet: 30,
    skillProficiencyChoiceCount: 2,
    savingThrowAdvantages: {
      conditions: ['charmed', '魅惑'],
    },
    staticModifiers: {
      darkvisionRangeFeet: 60,
      conditionImmunities: ['magical-sleep', '魔法睡眠'],
    },
  },
  'half-orc': {
    id: 'half-orc',
    size: 'medium',
    speedFeet: 30,
    skillProficiencies: ['intimidation'],
    staticModifiers: {
      darkvisionRangeFeet: 60,
    },
  },
  tiefling: {
    id: 'tiefling',
    size: 'medium',
    speedFeet: 30,
    staticModifiers: {
      darkvisionRangeFeet: 60,
      damageResistances: ['fire'],
    },
  },
}

function normalizedRaceIdentity(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function dnd5eCoreRaceMechanics(
  race: string | undefined,
  raceId?: string,
): Dnd5eCoreRaceMechanics | undefined {
  const identities = [race, raceId].map(normalizedRaceIdentity).filter(Boolean)
  const matches = (...values: readonly string[]) => identities.some((identity) =>
    values.some((value) => identity === value || identity.endsWith(`:${value}`)))
  if (matches(
    'dwarf', 'hill-dwarf', 'mountain-dwarf',
    '矮人', '丘陵矮人', '山地矮人',
  )) return CORE_RACE_MECHANICS.dwarf
  if (matches(
    'elf', 'high-elf', 'wood-elf', 'drow', 'dark-elf',
    '精灵', '高等精灵', '木精灵', '卓尔', '黑暗精灵',
  )) return CORE_RACE_MECHANICS.elf
  if (matches(
    'halfling', 'lightfoot-halfling', 'stout-halfling',
    '半身人', '轻足半身人', '强心半身人', '强心半身人（stout）',
  )) return CORE_RACE_MECHANICS.halfling
  if (matches('human', 'variant-human', '人类', '变体人类')) return CORE_RACE_MECHANICS.human
  if (matches('dragonborn', '龙裔')) return CORE_RACE_MECHANICS.dragonborn
  if (matches(
    'gnome', 'rock-gnome', 'forest-gnome',
    '侏儒', '岩地侏儒', '森林侏儒',
  )) return CORE_RACE_MECHANICS.gnome
  if (matches('half-elf', 'half elf', '半精灵')) return CORE_RACE_MECHANICS['half-elf']
  if (matches('half-orc', 'half orc', '半兽人')) return CORE_RACE_MECHANICS['half-orc']
  if (matches('tiefling', '提夫林')) return CORE_RACE_MECHANICS.tiefling
  return undefined
}

export function mergeDnd5eRacialSavingThrowAdvantages(
  ...values: readonly (Dnd5ePluginRacialSavingThrowAdvantages | undefined)[]
): Dnd5ePluginRacialSavingThrowAdvantages | undefined {
  const conditions = [...new Set(values.flatMap((value) => value?.conditions ?? []))]
  const damageTypes = [...new Set(values.flatMap((value) => value?.damageTypes ?? []))]
  const magicAbilities = [...new Set(values.flatMap((value) => value?.magicAbilities ?? []))]
  return conditions.length || damageTypes.length || magicAbilities.length
    ? {
        ...(conditions.length ? { conditions } : {}),
        ...(damageTypes.length ? { damageTypes } : {}),
        ...(magicAbilities.length ? { magicAbilities } : {}),
      }
    : undefined
}
