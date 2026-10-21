/** Compares named subclass table rows with explicit reduction dice. Never rewrites drafts. */
export function dnd5eSourceReductionProgressionIssues(source: string, content: unknown): string[] {
  if (!content || typeof content !== 'object') return []
  const subclasses = (content as { subclasses?: unknown }).subclasses
  if (!Array.isArray(subclasses)) return []
  const issues: string[] = []
  const lines = source.split(/\r?\n/).map(line => line.replace(/\s+/g, ''))
  for (const subclass of subclasses) {
    if (!subclass || !Array.isArray(subclass.abilities)) continue
    for (const ability of subclass.abilities) {
      const dice = ability?.mechanic?.kind === 'damage-mitigation-interrupt' ? ability.mechanic.reductionDice : undefined
      if (!dice || typeof ability.name !== 'string' || !Number.isInteger(ability.level)) continue
      const name = ability.name.replace(/\s+/g, '')
      if (!name) continue
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const namedDice = new RegExp(`${escaped}[（(](\\d+)[dD](\\d+)[）)]`, 'g')
      const rows = lines.flatMap(line => {
        const level = line.match(/^(\d{1,2})(?:st|nd|rd|th|级)/i)
        const matches = [...line.matchAll(namedDice)]
        if (!level || matches.length !== 1) return []
        return [{ level: Number(level[1]), count: Number(matches[0][1]), sides: Number(matches[0][2]) }]
      }).sort((a, b) => a.level - b.level)
      // Ambiguous or incomplete tables do not become guessed numeric requirements.
      if (rows.length < 2 || rows[0].level !== ability.level || rows.some(row => row.level < 1 || row.level > 20 || row.count < 1 || row.sides < 2) || new Set(rows.map(row => row.level)).size !== rows.length) continue
      const upgrades = Array.isArray(dice.upgrades) ? dice.upgrades.filter((row: unknown): row is { level: number; count: number } =>
        row != null && typeof row === 'object' && 'level' in row && 'count' in row && Number.isInteger(row.level) && Number.isInteger(row.count)) : []
      const levels = [...new Set([...rows.map(row => row.level), ...upgrades.map((row: { level: number }) => row.level)])]
        .filter(level => Number.isInteger(level) && level >= rows[0].level && level <= 20)
      for (const level of levels) {
        const expected = rows.filter(row => row.level <= level).at(-1)!
        const actualUpgrade = upgrades.filter((row: { level: number }) => row.level <= level)
          .sort((a: { level: number }, b: { level: number }) => a.level - b.level).at(-1)
        const actualCount = actualUpgrade?.count ?? dice.count
        if (actualCount !== expected.count || dice.sides !== expected.sides) issues.push(
          `原文等级表中「${ability.name}」在${level}级应为${expected.count}d${expected.sides}；能力 ${String(ability.id)} 的 reductionDice 当前为${String(actualCount)}d${String(dice.sides)}，需保留原文骰数及升级等级。`,
        )
      }
    }
  }
  return issues
}
