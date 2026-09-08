import type { Character } from '../../types/character'
import { normalizeDnd5eClassLevels } from './classLevels'
import {
  dnd5eClassDefinition,
  dnd5eClassDefinitionForCharacter,
  type Dnd5eClassId,
} from './classes'

export type Dnd5eArmorProficiency = 'light' | 'medium' | 'heavy' | 'shield'

const STARTING_ARMOR_PROFICIENCIES: Readonly<Record<string, readonly Dnd5eArmorProficiency[]>> = {
  barbarian: ['light', 'medium', 'shield'],
  bard: ['light'],
  cleric: ['light', 'medium', 'shield'],
  druid: ['light', 'medium', 'shield'],
  fighter: ['light', 'medium', 'heavy', 'shield'],
  monk: [],
  paladin: ['light', 'medium', 'heavy', 'shield'],
  ranger: ['light', 'medium', 'shield'],
  rogue: ['light'],
  sorcerer: [],
  warlock: ['light'],
  wizard: [],
}

const MULTICLASS_ARMOR_PROFICIENCIES: Readonly<Record<string, readonly Dnd5eArmorProficiency[]>> = {
  barbarian: ['shield'],
  bard: ['light'],
  cleric: ['light', 'medium', 'shield'],
  druid: ['light', 'medium', 'shield'],
  fighter: ['light', 'medium', 'shield'],
  monk: [],
  paladin: ['light', 'medium', 'shield'],
  ranger: ['light', 'medium', 'shield'],
  rogue: ['light'],
  sorcerer: [],
  warlock: ['light'],
  wizard: [],
}

function declaredArmorProficiencies(value: string | undefined): readonly Dnd5eArmorProficiency[] {
  if (!value || value === '无') return []
  const result = new Set<Dnd5eArmorProficiency>()
  if (value.includes('所有护甲')) ['light', 'medium', 'heavy'].forEach((entry) => result.add(entry as Dnd5eArmorProficiency))
  if (value.includes('轻甲')) result.add('light')
  if (value.includes('中甲')) result.add('medium')
  if (value.includes('重甲')) result.add('heavy')
  if (value.includes('盾牌')) result.add('shield')
  return [...result]
}

/** Core/class-side capability projection. Plugin ancestry grants are merged at the content-catalog boundary. */
export function dnd5eBaseArmorProficiencies(character: Character): ReadonlySet<Dnd5eArmorProficiency> {
  const classLevels = normalizeDnd5eClassLevels(character)
  const primaryClassId = dnd5eClassDefinitionForCharacter(character)?.id
  const result = new Set<Dnd5eArmorProficiency>()
  for (const classId of Object.keys(classLevels) as Dnd5eClassId[]) {
    const definition = dnd5eClassDefinition(classId)
    const declared = classId === primaryClassId
      ? STARTING_ARMOR_PROFICIENCIES[classId] ?? declaredArmorProficiencies(definition?.armorProficiencies)
      : MULTICLASS_ARMOR_PROFICIENCIES[classId] ?? []
    declared.forEach((proficiency) => result.add(proficiency))
  }
  if (
    (classLevels.cleric ?? 0) >= 1 &&
    character.dnd5eClassChoices?.classes?.cleric?.subclass === 'life'
  ) result.add('heavy')
  return result
}

export interface Dnd5eSpellcastingCapabilityV1 {
  capable: boolean
  classIds: readonly string[]
}

/** Class/subclass casting only. Innate ancestry grants are merged by the plugin content catalog. */
export function dnd5eBaseSpellcastingCapabilityV1(character: Character): Dnd5eSpellcastingCapabilityV1 {
  const classLevels = normalizeDnd5eClassLevels(character)
  const classIds = Object.entries(classLevels).flatMap(([classId, level]) => {
    const definition = dnd5eClassDefinition(classId)
    if (!definition?.spellcasting || !level) return []
    const unlockLevel = definition.features.find((feature) => feature.id === 'spellcasting')?.level ?? 1
    return level >= unlockLevel ? [classId] : []
  })
  const fighterSubclass = character.dnd5eClassChoices?.fighter?.subclass ??
    character.dnd5eClassChoices?.classes?.fighter?.subclass
  if ((classLevels.fighter ?? 0) >= 3 && fighterSubclass === 'eldritch-knight') classIds.push('fighter')
  if ((classLevels.rogue ?? 0) >= 3 && character.dnd5eClassChoices?.classes?.rogue?.subclass === 'arcane-trickster') {
    classIds.push('rogue')
  }
  const unique = [...new Set(classIds)]
  return { capable: unique.length > 0, classIds: unique }
}
