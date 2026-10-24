import type { Character } from '../types/character'

export interface CharacterExportFile {
  schema: 'stars-character'
  version: 1
  exportedAt: string
  character: Character
}

export function prepareDmCharacterImport(character: Partial<Character>, roomId: string): Partial<Character> {
  return {
    ...character,
    roomId,
    roomMemberId: undefined,
    ownerAccountId: undefined,
    player: 'DM 待分配',
    visibleToPlayers: true,
  }
}

export function makeCharacterExport(character: Character): CharacterExportFile {
  return {
    schema: 'stars-character',
    version: 1,
    exportedAt: new Date().toISOString(),
    character,
  }
}

export function parseCharacterExport(data: unknown): Partial<Character> | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (
    record.schema === 'stars-character' &&
    record.character &&
    typeof record.character === 'object'
  ) {
    return record.character as Partial<Character>
  }
  if (typeof record.name === 'string' && record.abilities && typeof record.abilities === 'object') {
    return record as Partial<Character>
  }
  return null
}

export function characterExportFileName(character: Character): string {
  const safeName = (character.name || 'character')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 48)
  return `${safeName || 'character'}.stars-character.json`
}
