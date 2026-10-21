/** Unspecified sizes preserve legacy behavior; declared sizes require authoritative evidence. */
export function persistentAreaSizeAllowed(filter: { targetSizeRanks?: readonly number[] }, sizeRank: number | undefined): boolean {
  const ranks = filter.targetSizeRanks
  if (ranks === undefined) return true
  return Array.isArray(ranks) && ranks.length > 0 && ranks.length <= 6 &&
    new Set(ranks).size === ranks.length && ranks.every(rank => Number.isInteger(rank) && rank >= 0 && rank <= 5) &&
    Number.isInteger(sizeRank) && ranks.includes(sizeRank!)
}

const creatureTypes = {
  aberration: '异怪', beast: '野兽', celestial: '天界', construct: '构装', dragon: '龙',
  elemental: '元素', fey: '精类', fiend: '邪魔', giant: '巨人', humanoid: '类人生物',
  monstrosity: '怪兽', ooze: '泥怪', plant: '植物', undead: '不死',
} as const

/** Monster catalog translations must not change mechanical subtype checks. */
export function dnd5eCreatureSubtypeMatches(types: readonly string[] | undefined, required: string): boolean {
  const canonical = (value: string) => {
    const normalized = value.trim().toLowerCase()
    return normalized === '恶魔' ? 'demon' : normalized === '魔鬼' ? 'devil' : normalized
  }
  return types?.some(type => canonical(type) === canonical(required)) === true
}

export function normalizePersistentAreaCreatureTypes(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 14 ||
    value.some(type => typeof type !== 'string' || !Object.hasOwn(creatureTypes, type)) ||
    new Set(value).size !== value.length) return undefined
  return [...value]
}

export function persistentAreaCreatureTypesAllowed(
  filter: { includedCreatureTypes?: readonly string[]; excludedCreatureTypes?: readonly string[] },
  types: readonly string[],
): boolean {
  const canonical = types.flatMap(value => {
    const normalized = value.trim().toLowerCase()
    return Object.entries(creatureTypes).filter(([id, label]) =>
      normalized === id || normalized.includes(label) || (id === 'fey' && normalized.includes('妖精')),
    ).map(([id]) => id)
  })
  return (!filter.includedCreatureTypes?.length || filter.includedCreatureTypes.some(type => canonical.includes(type))) &&
    !filter.excludedCreatureTypes?.some(type => canonical.includes(type))
}
