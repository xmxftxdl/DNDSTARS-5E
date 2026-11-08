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
  if (record.schema === 'stars-character' && record.version !== 1) return null
  if (
    record.schema === 'stars-character' &&
    record.character &&
    typeof record.character === 'object' && !Array.isArray(record.character) &&
    typeof (record.character as Record<string, unknown>).name === 'string'
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

export function readCharacterImport(text: string): Partial<Character> {
  let data: unknown
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')) } catch {
    throw new Error('文件不是有效的 JSON，可能已损坏。请重新导出角色后再导入。')
  }
  if (data && typeof data === 'object' && 'schema' in data && data.schema === 'stars-character' &&
      (!('version' in data) || data.version !== 1)) {
    throw new Error('这个角色文件的版本暂不支持，请使用当前版本重新导出。')
  }
  const character = parseCharacterExport(data)
  if (!character) throw new Error('文件中没有可识别的角色资料，请选择角色 JSON，而不是规则包或战役文件。')
  return character
}
