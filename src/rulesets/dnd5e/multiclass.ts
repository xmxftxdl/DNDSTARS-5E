import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import {
  dnd5eClassDefinition,
  dnd5eClassSpellSlots,
  dnd5ePactSlotLevel,
  type Dnd5eClassId,
} from './classes'
import {
  dnd5eCharacterClassLevel,
  dnd5eTotalCharacterLevel,
  normalizeDnd5eClassLevels,
} from './classLevels'
import { dnd5eEffectiveSpellcastingSource } from './subclassSpellcasting'
import { declarativeClassMulticlassPrerequisitesV1 } from './declarativeClass'

export {
  dnd5eCharacterClassLevel,
  dnd5eTotalCharacterLevel,
  normalizeDnd5eClassLevels,
}
export type { Dnd5eClassLevels } from './classLevels'

const MULTICLASS_PREREQUISITES: Readonly<Record<Dnd5eClassId, readonly (readonly AbilityKey[])[]>> = {
  barbarian: [['str']],
  bard: [['cha']],
  cleric: [['wis']],
  druid: [['wis']],
  fighter: [['str', 'dex']],
  monk: [['dex'], ['wis']],
  paladin: [['str'], ['cha']],
  ranger: [['dex'], ['wis']],
  rogue: [['dex']],
  sorcerer: [['cha']],
  warlock: [['cha']],
  wizard: [['int']],
}

const FULL_CASTERS = new Set<Dnd5eClassId>(['bard', 'cleric', 'druid', 'sorcerer', 'wizard'])
const HALF_CASTERS = new Set<Dnd5eClassId>(['paladin', 'ranger'])

export function dnd5eMeetsMulticlassPrerequisite(
  character: Pick<Character, 'abilities'>,
  classId: Dnd5eClassId,
): boolean {
  const core = MULTICLASS_PREREQUISITES[classId]
  if (core) return core.every((alternatives) => alternatives.some((ability) => character.abilities[ability] >= 13))
  const declared = declarativeClassMulticlassPrerequisitesV1(classId)
  if (!declared) return false
  return declared.every((group) => group.oneOf.some((ability) => character.abilities[ability] >= group.minimum))
}

export function validateDnd5eMulticlassLevelGain(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities'>,
  targetClassId: Dnd5eClassId,
): { ok: true } | { ok: false; reason: 'maximum-level' | 'current-class-prerequisite' | 'target-class-prerequisite' } {
  if (dnd5eTotalCharacterLevel(character) >= 20) return { ok: false, reason: 'maximum-level' }
  const levels = normalizeDnd5eClassLevels(character)
  if ((levels[targetClassId] ?? 0) > 0) return { ok: true }
  for (const classId of Object.keys(levels) as Dnd5eClassId[]) {
    if (!dnd5eMeetsMulticlassPrerequisite(character, classId)) {
      return { ok: false, reason: 'current-class-prerequisite' }
    }
  }
  return dnd5eMeetsMulticlassPrerequisite(character, targetClassId)
    ? { ok: true }
    : { ok: false, reason: 'target-class-prerequisite' }
}

/** SRD 5.1 兼职施法者等级；邪术师契约魔法始终保持独立。 */
export function dnd5eMulticlassCasterLevel(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>,
): number {
  const levels = normalizeDnd5eClassLevels(character)
  let casterLevel = 0
  for (const [classId, level] of Object.entries(levels) as Array<[Dnd5eClassId, number]>) {
    const kind = dnd5eEffectiveSpellcastingSource(character as Character, classId)?.definition.spellcasting?.kind
    if (FULL_CASTERS.has(classId) || kind === 'full-known' || kind === 'full-prepared') casterLevel += level
    else if (HALF_CASTERS.has(classId) || kind === 'half-known' || kind === 'half-prepared') casterLevel += Math.floor(level / 2)
    else if (kind === 'one-third-known') {
      casterLevel += Math.floor(level / 3)
    }
  }
  return Math.max(0, Math.min(20, casterLevel))
}

export function dnd5eMulticlassSpellSlots(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>,
): readonly number[] {
  const levels = normalizeDnd5eClassLevels(character)
  const spellcastingClasses = (Object.entries(levels) as Array<[Dnd5eClassId, number]>).flatMap(([classId, level]) => {
    const source = dnd5eEffectiveSpellcastingSource(character as Character, classId)
    return source?.definition.spellcasting && source.definition.spellcasting.kind !== 'pact'
      ? [{ source, level }]
      : []
  })
  // The multiclass slot table applies only after Spellcasting is gained from
  // more than one class. A Paladin/Fighter, for example, keeps the Paladin table.
  if (spellcastingClasses.length === 1) {
    const [{ source, level: classLevel }] = spellcastingClasses
    return dnd5eClassSpellSlots(source.definition, classLevel)
  }
  const casterLevel = dnd5eMulticlassCasterLevel(character)
  const fullCaster = dnd5eClassDefinition('wizard')
  return casterLevel > 0 && fullCaster ? dnd5eClassSpellSlots(fullCaster, casterLevel) : []
}

export function dnd5eMulticlassPactSlots(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels'>,
): { count: number; slotLevel: number } | undefined {
  const warlockLevel = dnd5eCharacterClassLevel(character, 'warlock')
  if (warlockLevel < 1) return undefined
  return {
    count: warlockLevel >= 17 ? 4 : warlockLevel >= 11 ? 3 : warlockLevel >= 2 ? 2 : 1,
    slotLevel: dnd5ePactSlotLevel(warlockLevel),
  }
}

export function addDnd5eMulticlassLevel(character: Character, classId: Dnd5eClassId): Character {
  const validation = validateDnd5eMulticlassLevelGain(character, classId)
  if (!validation.ok) return character
  const levels = normalizeDnd5eClassLevels(character)
  levels[classId] = (levels[classId] ?? 0) + 1
  return {
    ...character,
    level: dnd5eTotalCharacterLevel({ ...character, dnd5eClassLevels: levels }),
    dnd5eClassLevels: levels,
  }
}

export function removeDnd5eMulticlassLevel(character: Character, classId: Dnd5eClassId): Character {
  const levels = normalizeDnd5eClassLevels(character)
  const current = levels[classId] ?? 0
  const primaryClassId = dnd5eClassDefinition(character.charClass)?.id
  if (current < 1 || dnd5eTotalCharacterLevel(character) <= 1 || (classId === primaryClassId && current <= 1)) {
    return character
  }
  if (current === 1) delete levels[classId]
  else levels[classId] = current - 1
  return {
    ...character,
    level: dnd5eTotalCharacterLevel({ ...character, dnd5eClassLevels: levels }),
    dnd5eClassLevels: levels,
  }
}

export const DND5E_MULTICLASS_PREREQUISITES = MULTICLASS_PREREQUISITES
