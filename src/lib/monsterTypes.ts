export const CREATURE_TYPES = [
  '\u52a8\u7269',
  '\u4eba\u7c7b',
  '\u9f99',
  '\u7cbe\u7c7b',
  '\u5143\u7d20',
  '\u673a\u68b0',
  '\u9b54\u7269',
  '\u690d\u7269',
  '\u5f02\u602a',
  '\u91ce\u517d',
  '\u5929\u754c\u751f\u7269',
  '\u6784\u88c5\u4f53',
  '\u5143\u7d20\u751f\u7269',
  '\u90aa\u9b54',
  '\u5de8\u4eba',
  '\u7c7b\u4eba\u751f\u7269',
  '\u602a\u517d',
  '\u6ce5\u602a',
  '\u4ea1\u7075',
] as const
export type StandardCreatureType = (typeof CREATURE_TYPES)[number]
/**
 * Maps may contain campaign-specific creature types in addition to the core
 * catalogue. Keeping the persisted value as a string lets a DM name those
 * types without weakening the closed list used by rules-aware pickers.
 */
export type CreatureType = StandardCreatureType | (string & {})

export const CREATURE_SIZES = [
  '\u5fae\u578b',
  '\u5c0f\u578b',
  '\u4e2d\u578b',
  '\u5927\u578b',
  '\u8d85\u5927\u578b',
  '\u5de8\u578b',
] as const
export type CreatureSize = (typeof CREATURE_SIZES)[number]

export const CREATURE_SIZE_FOOTPRINT_CELLS: Record<CreatureSize, number> = {
  '\u5fae\u578b': 1,
  '\u5c0f\u578b': 1,
  '\u4e2d\u578b': 1,
  '\u5927\u578b': 2,
  '\u8d85\u5927\u578b': 3,
  '\u5de8\u578b': 4,
}

const SIZE_SET = new Set<string>(CREATURE_SIZES)

const TYPE_ALIASES: Record<StandardCreatureType, RegExp> = {
  '\u52a8\u7269': /\u52a8\u7269|\u91ce\u517d|\u86db\u5f62/,
  '\u4eba\u7c7b': /\u4eba\u7c7b|\u7c7b\u4eba\u751f\u7269|\u517d\u4eba|\u54e5\u5e03\u6797|\u5de8\u4eba|\u65bd\u6cd5\u8005/,
  '\u9f99': /\u9f99|\u9f99\u7c7b/,
  '\u7cbe\u7c7b': /\u7cbe\u7c7b|\u5996\u7cbe|\u7cbe\u7075/,
  '\u5143\u7d20': /\u5143\u7d20|\u6ce5\u6d46/,
  '\u673a\u68b0': /\u673a\u68b0|\u6784\u88c5|\u76d4\u7532/,
  '\u9b54\u7269': /\u9b54\u7269|\u602a\u517d|\u4ea1\u7075|\u4e0d\u6b7b|\u90aa\u9b54|\u9b54\u6cd5|\u98de\u884c/,
  '\u690d\u7269': /\u690d\u7269/,
  '\u5f02\u602a': /\u5f02\u602a/,
  '\u91ce\u517d': /\u91ce\u517d|\u52a8\u7269|\u86db\u5f62/,
  '\u5929\u754c\u751f\u7269': /\u5929\u754c\u751f\u7269|\u5929\u754c/,
  '\u6784\u88c5\u4f53': /\u6784\u88c5\u4f53|\u6784\u88c5|\u673a\u68b0/,
  '\u5143\u7d20\u751f\u7269': /\u5143\u7d20\u751f\u7269|\u5143\u7d20/,
  '\u90aa\u9b54': /\u90aa\u9b54/,
  '\u5de8\u4eba': /\u5de8\u4eba/,
  '\u7c7b\u4eba\u751f\u7269': /\u7c7b\u4eba\u751f\u7269|\u4eba\u7c7b|\u517d\u4eba|\u54e5\u5e03\u6797/,
  '\u602a\u517d': /\u602a\u517d|\u9b54\u7269/,
  '\u6ce5\u602a': /\u6ce5\u602a|\u6ce5\u6d46/,
  '\u4ea1\u7075': /\u4ea1\u7075|\u4e0d\u6b7b/,
}

export function normalizeCreatureTypes(value: unknown): CreatureType[] {
  if (!Array.isArray(value)) return []
  const result: CreatureType[] = []
  for (const item of value.slice(0, 32)) {
    if (typeof item !== 'string') continue
    const normalized = Array.from(item.trim())
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0
        return codePoint >= 32 && codePoint !== 127
      })
      .join('')
      .slice(0, 40)
    if (!normalized || result.some((entry) => entry.toLocaleLowerCase('zh-CN') === normalized.toLocaleLowerCase('zh-CN'))) continue
    result.push(normalized as CreatureType)
  }
  return result
}

export function normalizeCreatureSize(value: unknown): CreatureSize | undefined {
  return typeof value === 'string' && SIZE_SET.has(value) ? (value as CreatureSize) : undefined
}

export function inferCreatureTypesFromTags(tags: readonly string[] = []): CreatureType[] {
  const joined = tags.join(' ')
  const types: CreatureType[] = []
  for (const type of CREATURE_TYPES) {
    if (TYPE_ALIASES[type].test(joined)) types.push(type)
  }
  return types.length > 0 ? types : ['\u9b54\u7269']
}

export function inferCreatureSizeFromTags(tags: readonly string[] = []): CreatureSize {
  if (tags.includes('\u5de8\u578b')) return '\u5de8\u578b'
  if (tags.includes('\u8d85\u5927\u578b')) return '\u8d85\u5927\u578b'
  if (tags.includes('\u5927\u578b')) return '\u5927\u578b'
  if (tags.includes('\u5c0f\u578b')) return '\u5c0f\u578b'
  if (tags.includes('\u5fae\u578b')) return '\u5fae\u578b'
  return '\u4e2d\u578b'
}

export function creatureSizeToFootprintCells(size?: CreatureSize): number {
  return CREATURE_SIZE_FOOTPRINT_CELLS[size ?? '\u4e2d\u578b']
}

export function creatureSizeToTokenSize(size?: CreatureSize): number {
  return creatureSizeToFootprintCells(size)
}

export function sizeFromTokenSize(tokenSize?: number): CreatureSize {
  const cells = Math.max(1, Math.round(tokenSize ?? 1))
  if (cells >= 4) return '\u5de8\u578b'
  if (cells >= 3) return '\u8d85\u5927\u578b'
  if (cells >= 2) return '\u5927\u578b'
  return '\u4e2d\u578b'
}
