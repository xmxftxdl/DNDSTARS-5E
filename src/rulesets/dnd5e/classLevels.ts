import type { Character } from '../../types/character'
import { dnd5eClassDefinition, type Dnd5eClassId } from './classes'

export type Dnd5eClassLevels = Partial<Record<string, number>>

export function normalizeDnd5eClassLevels(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels'>,
): Dnd5eClassLevels {
  const normalized: Dnd5eClassLevels = {}
  for (const [classId, rawLevel] of Object.entries(character.dnd5eClassLevels ?? {}) as Array<[string, number]>) {
    if (!dnd5eClassDefinition(classId) || !Number.isFinite(rawLevel)) continue
    const level = Math.max(0, Math.min(20, Math.floor(rawLevel)))
    if (level > 0) normalized[classId] = level
  }
  const primary = dnd5eClassDefinition(character.charClass)
  const classIds = Object.keys(normalized)
  if (classIds.length > 0) {
    // Older saves could change charClass without replacing the original
    // single-class level map. In a valid multiclass record the starting class
    // must always be present, so a one-entry mismatch is safe to repair.
    if (primary && classIds.length === 1 && normalized[primary.id] == null) {
      return { [primary.id]: Math.max(1, Math.min(20, Math.floor(character.level || normalized[classIds[0]] || 1))) }
    }
    return normalized
  }
  return primary ? { [primary.id]: Math.max(1, Math.min(20, Math.floor(character.level || 1))) } : {}
}

export function dnd5eTotalCharacterLevel(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels'>,
): number {
  const levels = normalizeDnd5eClassLevels(character)
  const total = Object.values(levels).reduce<number>((sum, level) => sum + (level ?? 0), 0)
  return Math.max(1, Math.min(20, total || Math.floor(character.level || 1)))
}

export function dnd5eCharacterClassLevel(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels'>,
  classId: Dnd5eClassId | string,
): number {
  return normalizeDnd5eClassLevels(character)[classId] ?? 0
}
