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
  if (Object.keys(normalized).length > 0) return normalized
  const primary = dnd5eClassDefinition(character.charClass)
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
