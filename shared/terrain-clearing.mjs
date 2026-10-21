/** Closed declaration for persistent terrain that can be cleared by hand. */
export function validTerrainClearing(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 1 && Number.isSafeInteger(value.squareFeetPerMinute) &&
    value.squareFeetPerMinute >= 1 && value.squareFeetPerMinute <= 10000
}

/** Host progress per terrain cell. One cell can gain at most one work-round in a combat round. */
export function validTerrainClearingProgress(value, cells) {
  if (value == null) return true
  if (!Array.isArray(value) || value.length > 1024 || !Array.isArray(cells)) return false
  const available = new Set(cells.map(cell => `${cell?.col}:${cell?.row}`)), seen = new Set()
  return value.every(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      Object.keys(entry).some(key => !['col', 'row', 'workedRounds', 'lastCombatId', 'lastRound'].includes(key)) ||
      !Number.isSafeInteger(entry.col) || !Number.isSafeInteger(entry.row) ||
      !Number.isSafeInteger(entry.workedRounds) || entry.workedRounds < 1 || entry.workedRounds > 10000000 ||
      typeof entry.lastCombatId !== 'string' || !entry.lastCombatId.trim() || entry.lastCombatId.length > 160 ||
      !Number.isSafeInteger(entry.lastRound) || entry.lastRound < 1 || entry.lastRound > 1000000000) return false
    const key = `${entry.col}:${entry.row}`
    if (!available.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
