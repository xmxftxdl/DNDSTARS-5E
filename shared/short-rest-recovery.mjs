export const SHORT_REST_RECOVERY_RESOURCE = 'dnd5e-rest-recovery'
export const SHORT_REST_RECOVERY_RECEIPT_LIMIT = 10000
const object = value => value != null && typeof value === 'object' && !Array.isArray(value)
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 160
const integer = value => Number.isSafeInteger(value) && value >= 0
export function validShortRestRecoveryJournal(value) {
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.receipts) ||
    value.receipts.length > SHORT_REST_RECOVERY_RECEIPT_LIMIT || (value.updatedAt != null && !integer(value.updatedAt))) return false
  const ids = new Set()
  return value.receipts.every(row => {
    if (!object(row) || Object.keys(row).some(key => !['command','hitDiceHealing','songOfRestHealing','healingApplied'].includes(key))) return false
    const c = row.command
    if (!object(c) || Object.keys(c).some(key => !['id','advanceId','characterId','mapId','tokenId','poolIndex','expectedPoolCurrent','songOfRestBardId'].includes(key)) ||
      !['id','advanceId','characterId','mapId','tokenId'].every(key => id(c[key])) ||
      !integer(c.poolIndex) || c.poolIndex > 100 || !integer(c.expectedPoolCurrent) || c.expectedPoolCurrent < 1 ||
      (c.songOfRestBardId !== undefined && !id(c.songOfRestBardId)) || ids.has(c.id) ||
      ![row.hitDiceHealing,row.songOfRestHealing,row.healingApplied].every(integer) ||
      row.healingApplied > row.hitDiceHealing + row.songOfRestHealing ||
      (!c.songOfRestBardId && row.songOfRestHealing !== 0)) return false
    ids.add(c.id)
    return true
  })
}
