/** UI adapter only: these levels come from the Host, and selection is not authority. */
export async function selectDnd5eReactionSlotLevel(
  levels: readonly number[] | undefined,
  choose: (options: readonly { id: string; label: string }[]) => Promise<unknown>,
): Promise<{ accepted: true; castLevel?: number } | { accepted: false }> {
  if (levels == null) return { accepted: true }
  if (!levels.length || levels.some(level => !Number.isInteger(level) || level < 1 || level > 9)) return { accepted: false }
  const unique = [...new Set(levels)].sort((a, b) => a - b)
  const selected = await choose([...unique.map(level => ({ id: `slot-${level}`, label: `使用 ${level} 环法术位` })), { id: 'decline', label: '取消施放' }])
  const level = unique.find(value => selected === `slot-${value}`)
  return level == null ? { accepted: false } : { accepted: true, castLevel: level }
}
