export function dnd5eActivityCreatureTypeMatches(expected: string, actual: string): boolean {
  const aliases: Record<string, string> = {
    构装: 'construct', 构装体: 'construct', 构装生物: 'construct', 不死: 'undead', 不死生物: 'undead', 亡灵: 'undead',
    植物: 'plant', 元素: 'elemental', 元素生物: 'elemental', 天界: 'celestial', 邪魔: 'fiend', 精类: 'fey',
    类人: 'humanoid', 类人生物: 'humanoid', 野兽: 'beast', 异怪: 'aberration', 龙: 'dragon', 巨人: 'giant', 泥怪: 'ooze', 怪兽: 'monstrosity',
  }
  const canonical = (value: string) => aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase()
  return canonical(expected) === canonical(actual)
}
