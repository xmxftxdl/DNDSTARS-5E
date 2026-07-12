import type { Character } from '../types/character'

export function migrateLegacyCharacterFields(input: Partial<Character>): Partial<Character> {
  const choices = {
    ...(input.traitChoicesDone ?? {}),
    ...(input.archerLv1ChoiceDone ? { 'archer-lv1': true } : {}),
    ...(input.archerLv3ChoiceDone ? { 'archer-lv3': true } : {}),
  }
  const current = { ...input, traitChoicesDone: choices }
  delete current.archerLv1ChoiceDone
  delete current.archerLv3ChoiceDone
  return current
}
